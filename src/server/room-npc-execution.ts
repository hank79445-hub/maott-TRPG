import { randomUUID } from 'node:crypto'
import { DiceRequired } from '../core/dice-source'
import type { Room, RoomCommand, RoomMember } from '../online/protocol'
import type { NpcConversation, NpcTurnRun, NpcProfile, NpcDirective } from '../core/ai-types'
import { clone, catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { scriptedNpcPlan, reachableNpcCells } from '../core/npc-strategy'
import { heldNpc } from './gm-control'
import { combatStats, attackOptions } from '../core/combat-rules'
import { syncNpcTokens } from '../core/npc-map'
import { distance, mapEnvironment } from '../core/map'
import { journal, newNpcTask, internalMember, executeNpcAction, profileOf } from './room-ai'
import { activeScene, adventure, executeAction, RoomError, hash } from './room-engine'
import { finalizeRoomBroadcast } from './room-broadcast'
import { aggregateAi } from './room-ai'
import { practicalEnabled } from './practical-review-state'
import { repairNpcRun } from './practical-planning'
import { npcAutomaticAbility } from './practical-casting'

function targetScope(room: Room, steps: NpcDirective[]) {
  const ids = new Set(
      steps.flatMap((d) => [...(d.targets ?? []), ...(d.targetId ? [d.targetId] : [])]),
    ),
    scene = activeScene(room),
    e = room.world.encounters.find((e) => e.id === scene?.encounterId),
    from = scene?.tokens.find((t) => t.actorId === e?.actors[e.current]?.id)
  return JSON.stringify({
    environment: hash(JSON.stringify(room.environment)),
    targets: [...ids].sort().map((id) => {
      const actor = room.world.encounters.flatMap((e) => e.actors).find((a) => a.id === id),
        token = scene?.tokens.find((t) => t.actorId === id)
      return {
        id,
        side: actor?.side,
        dead: actor
          ? combatStats(actor, room.world.characters, catalogue([srd, ...room.world.packs])).dead
          : true,
        position: token ? { x: token.x, y: token.y, hidden: token.hidden } : null,
        perception:
          scene && from && token
            ? ((env) => ({
                distance: env.distance,
                cover: env.cover,
                sees: env.attackerSees,
                seen: env.targetSees,
                advantage: env.advantage,
                disadvantage: env.disadvantage,
              }))(mapEnvironment(scene, from, token, room.environment, 'weapon'))
            : null,
      }
    }),
  })
}
export function refreshNpcRunScope(room:Room,run:NpcTurnRun){run.targetScope=targetScope(room,run.steps.slice(run.nextStep))}
/** Branches revoke execution approval, while GM pause/manual decisions remain durable. */
export function holdNpcAfterBranch(room: Room, branchId: string) {
  const scene = activeScene(room),
    e = room.world.encounters.find((e) => e.id === scene?.encounterId),
    n = adventure(room).ai?.npcs.find((n) => n.actorId === e?.actors[e.current]?.id)
  if (!e || e.phase !== 'active' || !n || !['automatic', 'plan'].includes(n.turnMode ?? '')) return
  const j = journal(room),
    old = [...(j.turns ?? [])].reverse().find((r) => r.npcId === n.id),
    hold =
      n.turnHold?.state ??
      (old?.state === 'canceled' ? 'manual' : old?.state === 'paused' ? 'paused' : null)
  n.turnHold = { encounterId: e.id, tick: e.tick, state: hold ?? 'paused' }
  j.turns ??= []
  j.turns.push({
    id: randomUUID(),
    npcId: n.id,
    jobId: 'branch-hold-' + randomUUID(),
    encounterId: e.id,
    tick: e.tick,
    branchId,
    profileRevision: n.revision,
    mode: n.npcType === 'ordinary' ? 'automatic' : 'plan',
    state: hold === 'manual' ? 'canceled' : hold === 'paused' ? 'paused' : 'review',
    steps: [],
    nextStep: 0,
    executed: 0,
    finishTurn: true,
    reason: '读档／撤销后保留 GM 暂停或接管限制；旧批准失效，请重新批准固定策略或接管后重新规划',
    targetScope: targetScope(room, []),
    conditionsConfirmed: false,
    rider: '',
    needsApproval: true,
  })
  j.turns = j.turns.slice(-100)
}
export function startNpcTurn(room: Room, job: NpcConversation, finishTurn = true) {
  const n = profileOf(room, job.npcId),
    e = room.world.encounters.find((e) => e.id === activeScene(room)?.encounterId)
  if (!e || e.phase !== 'active' || e.actors[e.current]?.id !== n.actorId)
    throw new RoomError('NPC 回合已变化')
  const j = journal(room)
  j.turns ??= []
  const prior = j.turns.find(
    (t) =>
      t.npcId === n.id &&
      t.encounterId === e.id &&
      t.tick === e.tick &&
      t.branchId === j.branchId &&
      !['completed', 'canceled'].includes(t.state),
  )
  if (prior) throw new RoomError('该回合已有执行状态，请暂停、接管或重新审核')
  delete n.turnHold
  const run: NpcTurnRun = {
    id: randomUUID(),
    npcId: n.id,
    jobId: job.id,
    encounterId: e.id,
    tick: e.tick,
    branchId: j.branchId,
    profileRevision: n.revision,
    mode: n.npcType === 'ordinary' ? 'automatic' : 'plan',
    state: 'running',
    steps: clone(job.plan),
    nextStep: 0,
    executed: 0,
    finishTurn,
    reason: '已批准，准备执行',
    targetScope: targetScope(room, job.plan),
    conditionsConfirmed: false,
    rider: '',
  }
  j.turns.push(run)
  j.turns = j.turns.slice(-100)
  return run
}
function pause(run: NpcTurnRun, reason: string, review = false) {
  run.state = review ? 'review' : 'paused'
  run.reason = reason.slice(0, 2000)
}
export function controlNpcTurn(room: Room, member: RoomMember, c: RoomCommand) {
  if (c.kind !== 'npc-turn-control') return false
  if (member.role !== 'gm') throw new RoomError('NPC 回合控制需要 GM', 403)
  const run = journal(room).turns?.find((t) => t.id === c.runId)
  if (!run || (['completed', 'canceled'].includes(run.state) && !run.needsApproval))
    throw new RoomError('回合执行已结束或不存在')
  if (heldNpc(room, run.npcId) && c.action !== 'pause') throw new RoomError('GM接管中，请先归还再审核或继续自动计划')
  const n = profileOf(room, run.npcId),
    e = room.world.encounters.find((e) => e.id === run.encounterId)
  if (
    run.branchId !== journal(room).branchId ||
    e?.phase !== 'active' ||
    e.tick !== run.tick ||
    e.actors[e.current]?.id !== n.actorId
  )
    throw new RoomError('回合或存档分支已变化，不能继续旧批准')
  if (c.action === 'pause') {
    n.turnHold = { encounterId: e.id, tick: e.tick, state: 'paused' }
    pause(run, 'GM 暂停：' + c.reason)
    return true
  }
  if (c.action === 'manual') {
    n.turnHold = { encounterId: e.id, tick: e.tick, state: 'manual' }
    run.needsApproval = false
    run.state = 'canceled'
    run.reason = 'GM 接管：' + c.reason
    return true
  }
  if (run.needsApproval) {
    if (c.action !== 'approve' || run.mode !== 'automatic')
      throw new RoomError(
        '旧分支批准已经失效；普通 NPC 请重新批准固定策略，重要 NPC 请接管后重新规划',
      )
    if (e.pending) throw new RoomError('请先结算当前行动')
    const job = newNpcTask(
      room,
      member,
      n,
      n.characterId ?? adventure(room).party[0]!,
      'combat',
      'GM 重新批准本回合固定策略',
      n.goals,
    )
    job.status = 'published'
    job.text = '固定策略重新获批'
    job.attempt = null
    run.jobId = job.id
    run.needsApproval = false
    run.profileRevision = n.revision
  }
  if (c.action === 'resume' && (run.state === 'review' || n.revision !== run.profileRevision))
    throw new RoomError('该计划需要重新审核，不能直接恢复')
  if (['approve', 'conditions', 'rider'].includes(c.action) && e.pending)
    throw new RoomError('请先完成反应与最终结算，再裁定下一步')
  if (c.action === 'reveal') {
    n.hidden = false
    n.revision++
    syncNpcTokens(adventure(room), room.world)
  }
  if (c.action === 'rider') run.rider = ''
  if (c.action === 'conditions') run.conditionsConfirmed = true
  if (c.action === 'approve' || c.action === 'reveal') {
    run.profileRevision = n.revision
    run.targetScope = targetScope(room, run.steps.slice(run.nextStep))
    const job = journal(room).jobs.find((j) => j.id === run.jobId)
    if (job?.kind === 'npc') {
      job.profileRevision = n.revision
      job.sessionId = member.id
    }
  }
  run.state = 'running'
  delete n.turnHold
  run.reason = 'GM 继续：' + c.reason
  return true
}
/** Runs inside RoomStore's cloned serial transaction. Each attempted step is isolated too. */
export function advanceNpcTurns(room: Room) {
  if (room.gmReview?.settings.practical?.enabled && !practicalEnabled(room, 'combat')) return
  if (!adventure(room).ai?.npcs.length && !adventure(room).aiLog?.turns?.length) return
  for (let count = 0; count < 64; count++) {
    const j = journal(room),
      scene = activeScene(room),
      e = room.world.encounters.find((e) => e.id === scene?.encounterId),
      a = adventure(room)
    for (const r of j.turns ?? [])
      if (
        !['completed', 'canceled'].includes(r.state) &&
        (r.branchId !== j.branchId ||
          !room.world.encounters.some(
            (e) => e.id === r.encounterId && e.phase === 'active' && e.tick === r.tick,
          ))
      ) {
        r.state = 'canceled'
        r.reason = '战斗、回合或存档分支已变化'
      }
    for (const r of j.turns ?? [])
      if (!['completed', 'canceled'].includes(r.state)) {
        const profile = a.ai?.npcs.find((n) => n.id === r.npcId)
        if (!profile) {
          r.state = 'canceled'
          r.reason = 'NPC 已删除'
        } else if (!profile.enabled) {
          pause(r, 'NPC 已停用；重新启用后由 GM 决定继续')
        }
      }
    if (!e || e.phase !== 'active' || !scene) return
    if(a.sceneEffects?.m5?.resolutions.some(r=>r.encounterId===e.id&&r.status==='pending'))return
    const n = a.ai?.npcs.find(
      (n) => n.actorId === e.actors[e.current]?.id && n.sceneId === scene.id && n.enabled,
    )
    if (!n) return
    if (heldNpc(room, n.id)) return
    let run = [...(j.turns ?? [])]
      .reverse()
      .find(
        (r) =>
          r.npcId === n.id &&
          r.encounterId === e.id &&
          r.tick === e.tick &&
          r.branchId === j.branchId,
      )
    if (!run) {
      if (n.turnHold?.encounterId === e.id && n.turnHold.tick === e.tick) {
        holdNpcAfterBranch(room, j.branchId)
        return
      }
      if (n.turnHold) delete n.turnHold
      if (
        n.npcType !== 'ordinary' ||
        n.turnMode !== 'automatic' ||
        !n.combatPolicy.planOnTurn ||
        e.pending
      )
        return
      const gm = room.members.find((m) => m.role === 'gm' && !m.revoked)
      if (!gm) return
      let job = j.jobs.find(
        (t) =>
          t.kind === 'npc' &&
          t.npcId === n.id &&
          t.purpose === 'combat' &&
          t.branchId === j.branchId &&
          ['draft', 'queued', 'fallback'].includes(t.status),
      ) as NpcConversation | undefined
      if (!job) {
        try {
          job = newNpcTask(
            room,
            gm,
            n,
            n.characterId ?? a.party[0]!,
            'combat',
            '固定策略自动回合',
            n.goals,
          )
        } catch {
          return
        }
      }
      job.status = 'published'
      job.attempt = null
      job.plan = []
      job.text = '普通 NPC 固定策略自动执行'
      job.baseWorldRevision = room.worldRevision
      run = startNpcTurn(room, job)
    }
    if (run.state !== 'running') return
    if (n.revision !== run.profileRevision) {
      pause(run, 'NPC 配置已变化，请重新审核', true)
      return
    }
    if (e.pending) {
      run.reason = '等待反应与最终结算'
      return
    }
    if (
      room.intents.some(
        (i) =>
          i.status === 'pending' &&
          i.action.kind === 'map' &&
          i.action.command.type === 'combat' &&
          i.action.command.sceneId === scene.id,
      )
    ) {
      run.reason = '等待本场战斗的待审行动／反应'
      return
    }
    if (run.rider) {
      pause(run, '附加效果需要 GM 裁定：' + run.rider, true)
      return
    }
    if (
      run.mode === 'plan' &&
      run.nextStep < run.steps.length &&
      targetScope(room, run.steps.slice(run.nextStep)) !== run.targetScope && !practicalEnabled(room,'combat')
    ) {
      pause(run, '计划目标的位置、阵营、公开范围或存活状态已变化，请重新审核', true)
      return
    }
    let d: NpcDirective | undefined
    try {
      d =
        run.mode === 'automatic'
          ? run.conditionsConfirmed && run.waitingStep
            ? clone(run.waitingStep)
            : scriptedNpcPlan(room.world, n)[0]
          : run.steps[run.nextStep]
    } catch (err) {
      if (err instanceof DiceRequired) throw err
      pause(run, err instanceof Error ? err.message : '规划失败', true)
      return
    }
    if (n.hidden && d) {
      pause(run, '隐藏 NPC 即将采取可能暴露身份的行动；请公开参战或保持隐藏并接管', true)
      return
    }
    if (run.executed >= 32) {
      pause(run, '达到本回合自动执行上限，请由 GM 接管', true)
      return
    }
    const trial = clone(room),
      before = clone(room.world),
      tNpc = profileOf(trial, n.id),
      job = journal(trial).jobs.find((t) => t.id === run!.jobId)
    let tRun = journal(trial).turns!.find((r) => r.id === run!.id)!
    if (!job || job.kind !== 'npc') {
      pause(run, '批准来源不存在，请重新规划', true)
      return
    }
    job.baseWorldRevision = trial.worldRevision
    try {
      if (d) {
        const env = clone(trial.environment),
          actor = e.actors[e.current]!
        if (['move', 'flee'].includes(d.kind) && !tRun.conditionsConfirmed) {
          const token = scene.tokens.find((t) => t.actorId === actor.id),
            stats = combatStats(actor, room.world.characters, catalogue([srd, ...room.world.packs]))
          const path =
            token &&
            reachableNpcCells(
              scene,
              token,
              Math.max(0, stats.speed + actor.turn.dash - actor.turn.movement),
            ).find((p) => p.x === d!.destination?.x && p.y === d!.destination?.y)?.path
          if (
            path?.some((p) =>
              scene.regions.some(
                (r) => r.tags.includes('danger') && r.cells.includes(`${p.x},${p.y}`),
              ),
            )
          ) {
            run.waitingStep = clone(d)
            pause(run, '移动路线经过危险区域，需要 GM 裁定触发后继续', true)
            return
          }
        }
        if (d.kind === 'attack' && actor.npc?.packTactics) {
          const target = scene.tokens.find((t) => t.actorId === d!.targetId)
          const ally =
            target &&
            e.actors.some((other) => {
              const stats = combatStats(
                other,
                room.world.characters,
                catalogue([srd, ...room.world.packs]),
              )
              return (
                other.id !== actor.id &&
                other.side === actor.side &&
                !stats.dead &&
                stats.hp > 0 &&
                !stats.conditions.includes('incapacitated') &&
                scene.tokens.some((t) => t.actorId === other.id && distance(scene, t, target) <= 5)
              )
            })
          if (ally) {
            env.advantage = true
            env.note += '；群体战术：目标5尺内有未失能盟友'
          }
        }
        // Casting needs the same explicit GM component/area confirmation as player actions.
        const automaticMonster =
          tNpc.npcType === 'ordinary' &&
          tRun.mode === 'automatic' &&
          d.kind === 'ability' &&
          !!actor.npc?.abilities?.some(
            (a) =>
              'monster:' + a.id === d!.abilityId &&
              a.support === 'automatic' &&
              ['healing-word', 'bless', 'hold-person', 'invisibility'].includes(a.spellId ?? '') &&
              tNpc.combatPolicy.monsterAbilityIds?.includes(a.id),
          )
        if (
          d.kind === 'ability' &&
          !automaticMonster &&
          !npcAutomaticAbility(room,n,d) &&
          !tRun.conditionsConfirmed &&
          !tRun.abilityConditions
        ) {
          pause(run, '能力施放条件、范围与材料需要 GM 确认', true)
          return
        }
        executeNpcAction(
          trial,
          internalMember(trial, tNpc),
          {
            kind: 'npc',
            npcId: n.id,
            profileRevision: n.revision,
            conversationId: job.id,
            characterId: job.characterId,
            directive: d,
          },
          true,
          { environment: env, reactionsConfirmed: tRun.conditionsConfirmed },
        )
        tRun = journal(trial).turns!.find((r) => r.id === run!.id)!
        tRun.nextStep += tRun.mode === 'plan' ? 1 : 0
        tRun.executed++
        const liveJob = journal(trial).jobs.find((j) => j.id === job.id)
        if (liveJob?.kind === 'npc') liveJob.nextStep = tRun.nextStep
        if (d.kind === 'attack') {
          const spec = attackOptions(
            actor,
            room.world.characters,
            catalogue([srd, ...room.world.packs]),
          ).find((a) => a.id === d!.attackId)
          if (spec?.effectNote && !(spec.proneRequiresCharge && env.npcChargeConfirmed))
            tRun.rider = spec.effectNote
        }
        tRun.conditionsConfirmed = false
        delete tRun.waitingStep
        tRun.targetScope = targetScope(trial, tRun.steps.slice(tRun.nextStep))
        tRun.reason = d.detail?.startsWith('无有效敌对目标') ? d.detail : '本步骤已执行；继续复验'
      } else {
        if (!tRun.finishTurn) {
          pause(run, '计划已执行完；GM 选择手动结束或接管')
          return
        }
        executeAction(
          trial,
          internalMember(trial, tNpc),
          {
            kind: 'map',
            command: {
              type: 'combat',
              sceneId: scene.id,
              command: {
                type: 'end-turn',
                actorId: n.actorId!,
                encounterId: e.id,
                expectedTick: e.tick,
              },
            },
          },
          true,
        )
        tRun = journal(trial).turns!.find((r) => r.id === run!.id)!
        tRun.state = 'completed'
        tRun.reason =
          (tRun.reason.startsWith('无有效敌对目标') ? '无有效敌对目标；' : '') +
          '本回合执行完毕，已结束回合'
      }
      finalizeRoomBroadcast(
        trial,
        before,
        { kind: 'npc-plan', npcId: n.id },
        tRun.id + ':' + tRun.executed + (d ? '' : ':end'),
      )
      aggregateAi(trial, before, { kind: 'npc-plan', npcId: n.id })
      Object.assign(room, trial)
    } catch (err) {
      if (d) run.waitingStep = clone(d)
      if (err instanceof DiceRequired) throw err
      const reason=err instanceof Error ? err.message : '规则执行失败'
      if(!repairNpcRun(room,run,reason))pause(run,reason,true)
      return
    }
  }
}
