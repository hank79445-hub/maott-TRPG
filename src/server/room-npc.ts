import {systemMessage} from '../shared/localization/system-messages'
import { scheduleResponses } from './npc-activity'
import { executeFog } from './fog'
import { executeTrade } from './trade-engine'
import { executeSpatialCommand } from './npc-spatial'
import {executeKnowledgeCommand} from './npc-knowledge'
import { executeMemoryCommand } from './npc-memory-management'
import { appendBroadcast, publicAudience, gmAudience } from '../core/broadcast'
import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import type { BroadcastEvent } from '../core/broadcast-types'
import type { NpcProfile } from '../core/ai-types'
import { clone, catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { runtimeState } from '../core/runtime'
import { attachSceneNpcs, syncNpcTokens, isNpcCharacter } from '../core/npc-map'
import { distance } from '../core/map'
import { sightLine } from '../core/map-spatial'
import { importRoomCharacters } from './room-characters'
import { npcCapabilities } from '../core/npc-strategy'
import { adventure, activeScene, RoomError, executeCommand } from './room-engine'
import {
  journal,
  newNpcTask,
  profileOf,
  npcPosition,
  canTalk,
  liveConversation,
  npcJob,
  internalMember,
  prepareScriptedNpc,
  assertNpcReady,
  npcKnowsEvent,
} from './room-ai'

function gm(m: RoomMember) {
  if (m.role !== 'gm') throw new RoomError('NPC 管理、主动任务与规划需要 GM', 403)
}
function busy(room: Room, n: NpcProfile) {
  return journal(room).jobs.some(
    (j) =>
      j.kind === 'npc' &&
      !j.activityTest &&
      j.npcId === n.id &&
      j.branchId === journal(room).branchId &&
      (!['published', 'canceled', 'rejected', 'stale', 'interrupted'].includes(j.status) ||
        room.intents.some((i) => i.id === j.intentId && i.status === 'pending')),
  )
}
export function executeNpcManagement(room: Room, member: RoomMember, c: RoomCommand) {
  if (executeTrade(room, member, c)) return true
  if (executeFog(room, member, c)) return true
  if (executeSpatialCommand(room,member,c)) return true
  if(executeKnowledgeCommand(room,member,c))return true
  if (executeMemoryCommand(room, member, c)) return true
  if (
    ![
      'npc-story-confirm',
      'npc-character-copy',
      'scene-effect-visibility',
      'npc-attach',
      'npc-plan',
      'npc-proactive',
      'npc-plan-step',
      'npc-proposal',
    ].includes(c.kind)
  )
    return false
  gm(member)
  if (c.kind === 'scene-effect-visibility') {
    const token = activeScene(room)?.tokens.find((t) => t.id === c.tokenId)
    if (!token) throw new RoomError('当前场景棋子已不存在')
    const character = room.world.characters.find((char) => char.id === token.characterId),
      actor = room.world.encounters.flatMap((e) => e.actors).find((a) => a.id === token.actorId),
      n = adventure(room).ai?.npcs.find((n) => n.id === token.npcId),
      state = character
        ? runtimeState(character, catalogue([srd, ...room.world.packs]))
        : (actor?.npc ?? n?.body ?? token.npcBody),
      effect = state?.effects?.find((e) => e.id === c.effectId)
    if (!effect) throw new RoomError('来源效果已结束，请刷新')
    effect.visibility = c.visibility
    if (character) {
      character.runtime = state as ReturnType<typeof runtimeState>
      character.revision++
    }
    room.worldRevision++
    return true
  }
  if (c.kind === 'npc-story-confirm') {
    const a = adventure(room),
      ev = a.broadcastLog?.events.find((e) => e.id === c.eventId)
    if (
      !ev ||
      ev.type !== 'point.story.pending' ||
      ev.branchId !== a.broadcastLog?.branchId ||
      ev.sceneId !== a.activeSceneId ||
      a.broadcastLog?.events.some((e) => e.supersedes.includes(ev.id))
    )
      throw new RoomError('待确认剧情结果已处理或已失效')
    const n = a.ai?.npcs.find((n) => n.id === ev.facts.npcId)
    if (!n || n.sceneId !== ev.sceneId) throw new RoomError('关联 NPC 已离场或不存在')
    appendBroadcast(a, crypto.randomUUID(), {message:systemMessage(c.approve?'point.story.confirmed':'point.story.rejected'),
      category: 'interaction',
      type: c.approve ? 'point.story' : 'point.story.rejected',
      title: c.approve ? 'GM 确认剧情结果' : 'GM 拒绝剧情结果',
      text: c.approve ? ev.text : c.reason,
      sceneId: ev.sceneId,
      causeId: ev.id,
      supersedes: [ev.id],
      audience: c.approve && ev.facts.publicStory && !n.hidden ? publicAudience() : gmAudience(),
      facts: { ...ev.facts, adjudicated: true },
    })
    return true
  }
  if (c.kind === 'npc-character-copy') {
    const n = profileOf(room, c.npcId)
    if (busy(room, n)) throw new RoomError('该 NPC 已有待处理任务或意图，请先处理后更换角色卡')
    if (n.npcType !== 'important' || (n.characterId && !c.replace))
      throw new RoomError('请选择重要NPC；更换已有职业卡须明确确认替换')
    if (
      room.world.encounters.some(
        (e) => e.phase !== 'ended' && e.actors.some((a) => a.id === n.actorId),
      )
    )
      throw new RoomError('战斗中不能更换 NPC 角色卡')
    const previousCard = room.world.characters.find((old) => old.id === n.characterId)
    const archive = clone(c.archive),
      original = archive.character.id
    archive.character.id = crypto.randomUUID()
    delete archive.character.npcOwnerId
    archive.character.build.name = n.name
    archive.character.runtime = null
    for (const item of archive.character.inventory)
      if (item.craftedBy === original) item.craftedBy = archive.character.id
    importRoomCharacters(room, [archive], { purpose: 'npc' })
    const copied = room.world.characters.at(-1)!
    if (previousCard) {
      const retained = room.world.characters.find((old) => old.id === previousCard.id)
      if (retained) delete retained.npcOwnerId
    }
    copied.npcOwnerId = n.id
    n.characterId = copied.id
    n.body = null
    n.abilities = npcCapabilities(room.world, n, true)
    n.actorId = null
    n.revision++
    for (const scene of adventure(room).scenes)
      scene.tokens = scene.tokens.filter((t) => t.npcId !== n.id)
    syncNpcTokens(adventure(room), room.world)
  } else if (c.kind === 'npc-attach') {
    const n = profileOf(room, c.npcId),
      a = adventure(room),
      scene = a.scenes.find((s) => s.id === n.sceneId)!
    const e = room.world.encounters.find((e) => e.id === scene.encounterId)
    if (!e || e.phase !== 'setup') throw new RoomError('请先为该场景创建尚未开始的遭遇')
    if (e.session) throw new RoomError('请通过战斗桌的参战名单选择 NPC；取消准备后可重新确认名单')
    if (!n.characterId && !n.body && !n.actorId)
      throw new RoomError('请先配置 NPC 数据卡或完整角色卡')
    attachSceneNpcs(a, room.world, scene, catalogue([srd, ...room.world.packs]))
    syncNpcTokens(a, room.world)
    room.worldRevision++
  } else if (c.kind === 'npc-plan') {
    const n = profileOf(room, c.npcId)
    if (
      journal(room).turns?.some(
        (r) =>
          r.npcId === n.id &&
          r.branchId === journal(room).branchId &&
          !['completed', 'canceled'].includes(r.state),
      )
    )
      throw new RoomError('该 NPC 正在执行已批准回合，请先接管后重新规划')
    if (busy(room, n)) throw new RoomError('该 NPC 已有待处理任务或意图，请先处理')
    const job = newNpcTask(
      room,
      member,
      n,
      n.characterId ?? adventure(room).party[0]!,
      'combat',
      'NPC 回合规划',
      n.goals,
    )
    liveConversation(room, job)
    prepareScriptedNpc(room, job)
  } else if (c.kind === 'npc-proactive') {
    const n = profileOf(room, c.npcId)
    if (n.npcType !== 'important') throw new RoomError('普通 NPC 使用固定对话，不调用主动 AI')
    if (isNpcCharacter(room.world, c.characterId))
      throw new RoomError('当前主动交谈的对象须为玩家角色')
    if (busy(room, n)) throw new RoomError('该 NPC 已有待处理任务或意图，请先处理')
    canTalk(room, member, n, c.characterId)
    newNpcTask(
      room,
      member,
      n,
      c.characterId,
      'proactive',
      'NPC 主动交谈：' + c.reason,
      n.goals,
      c.visibility,
    )
  } else if (c.kind === 'npc-proposal') {
    const job = npcJob(room, c.jobId),
      n = profileOf(room, job.npcId)
    if (
      job.status !== 'published' ||
      job.branchId !== adventure(room).broadcastLog?.branchId ||
      job.profileRevision !== n.revision
    )
      throw new RoomError('会话已过期，请重新交谈或规划')
    if (job.intentId && room.intents.some((i) => i.id === job.intentId && i.status === 'pending'))
      throw new RoomError('该会话已有待审提议')
    if (c.directive.kind === 'none') throw new RoomError('请选择实际行为')
    job.baseWorldRevision = room.worldRevision
    liveConversation(room, job)
    job.proposal = clone(c.directive)
    executeCommand(room, internalMember(room, n), {
      kind: 'intent-submit',
      action: {
        kind: 'npc',
        npcId: n.id,
        profileRevision: n.revision,
        conversationId: job.id,
        characterId: job.characterId,
        directive: clone(c.directive),
      },
      summary: n.name + ' · GM 行为提议',
      source: 'external',
      baseWorldRevision: room.worldRevision,
    })
    job.intentId = room.intents.at(-1)!.id
    job.reason += '；GM：' + c.reason
  } else if (c.kind === 'npc-plan-step') {
    const job = npcJob(room, c.jobId),
      n = profileOf(room, job.npcId)
    if (
      job.purpose !== 'combat' ||
      job.status !== 'published' ||
      job.branchId !== adventure(room).broadcastLog?.branchId ||
      n.revision !== job.profileRevision
    )
      throw new RoomError('规划已过期，请重新规划')
    if (c.step !== job.nextStep || !job.plan[c.step]) throw new RoomError('只能提交未执行的下一步')
    if (job.intentId && room.intents.some((i) => i.id === job.intentId && i.status === 'pending'))
      throw new RoomError('请先处理上一条意图')
    const e = room.world.encounters.find((e) => e.id === activeScene(room)?.encounterId)
    if (e?.pending) throw new RoomError('请先完成反应与最终结算')
    job.baseWorldRevision = room.worldRevision
    liveConversation(room, job)
    executeCommand(room, internalMember(room, n), {
      kind: 'intent-submit',
      action: {
        kind: 'npc',
        npcId: n.id,
        profileRevision: n.revision,
        conversationId: job.id,
        characterId: job.characterId,
        directive: job.plan[c.step]!,
      },
      summary: n.name + ' · 规划第 ' + (c.step + 1) + ' 步',
      source: 'external',
      baseWorldRevision: room.worldRevision,
    })
    job.intentId = room.intents.at(-1)!.id
    job.nextStep++
    job.reason += '；GM：' + c.reason
  }
  return true
}

/** Only confirmed, public events can wake a configured NPC. Never let a generated reply wake itself. */
export function scheduleNpcActivity(room: Room, events: BroadcastEvent[]) {
  const a = adventure(room),
    scene = activeScene(room),
    j = journal(room),
    member = room.members.find((m) => m.role === 'gm' && !m.revoked)
  if (!scene || !member) return
  j.activations ??= []
  for (const n of a.ai?.npcs.filter((n) => n.enabled && n.sceneId === scene.id) ?? []) {
    const marker = scene.tokens.find((t) => t.npcId === n.id)
    if (!marker) continue
    try {
      assertNpcReady(room, n)
    } catch {
      continue
    }
    const e = room.world.encounters.find((e) => e.id === scene.encounterId),
      actor = e?.actors.find((t) => t.id === n.actorId)
    const turn = events.find(
      (ev) =>
        ['turn.change', 'encounter.active'].includes(ev.type) && ev.audience.kind === 'public',
    )
    if (turn && actor && e?.phase === 'active' && e.actors[e.current]?.id === actor.id)
      for (const old of j.jobs)
        if (
          old.kind === 'npc' &&
          old.npcId === n.id &&
          old.purpose === 'combat' &&
          ['stale', 'interrupted'].includes(old.status)
        ) {
          old.status = 'canceled'
          old.attempt = null
          old.error = '旧回合规划已取消；本回合可重新规划'
        }
    if (
      n.combatPolicy.planOnTurn &&
      !(n.turnHold && n.turnHold.encounterId === e?.id && n.turnHold.tick === e?.tick) &&
      turn &&
      actor &&
      e?.phase === 'active' &&
      e.actors[e.current]?.id === actor.id &&
      !e.pending &&
      !busy(room, n) &&
      !j.activations.some(
        (t) => t.npcId === n.id && t.branchId === j.branchId && t.eventId === turn.id,
      )
    ) {
      const beforeIds = new Set(j.jobs.map((t) => t.id))
      try {
        const task = newNpcTask(
          room,
          member,
          n,
          n.characterId ?? a.party[0]!,
          'combat',
          'NPC 回合触发规划',
          n.goals,
          'public',
          [turn.id],
        )
        liveConversation(room, task)
        prepareScriptedNpc(room, task)
        j.activations.push({
          npcId: n.id,
          sceneId: scene.id,
          branchId: j.branchId,
          eventId: turn.id,
          at: new Date().toISOString(),
        })
      } catch {
        j.jobs = j.jobs.filter((t) => beforeIds.has(t.id))
        /* Queue saturation or an incapacitated actor must not roll back game facts. */
      }
    }
  }
  scheduleResponses(room, events)
  j.activations = j.activations.slice(-1000)
}
