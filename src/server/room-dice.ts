import { withEvaluation } from '../core/evaluation'
import {memoryLedger} from './npc-memory-ledger'
import {practicalEffectInputCharacter} from './practical-effect-inputs'
import {practicalDiceFingerprint} from './practical-dice'
import {practicalCast,reconcilePracticalCasting} from './practical-spell-inputs'
import {withCompletedCasting} from '../core/completed-casting'
import {inheritKnowledgeReports} from './npc-knowledge'
import {reconcileSceneEffects} from '../core/scene-effects'
import {reconcileM3World} from '../core/m3-world-lifecycle'
import {reconcileWorld} from '../core/combat-lifecycle'
import { withInventoryClocks } from '../core/inventory-clock'
import { syncGmSpellRequests } from './room-spells'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { runtimeSpells } from '../core/runtime'
import { randomUUID } from 'node:crypto'
import { clone } from '../core/engine'
import { DiceRequired, withDiceSource } from '../core/dice-source'
import type { DieFace } from '../core/dice-source'
import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import type { DicePending, DiceRecord, RoomDiceState, RoomDiceView } from '../online/dice-types'
import { executeCommand, RoomError, hash } from './room-engine'
import { advanceNpcTurns } from './room-npc-execution'
const state = (r: Room): RoomDiceState =>
  (r.dice ??= { mode: 'automatic', pending: [], records: [] })
const branch = (r: Room) => r.world.adventures[0]?.broadcastLog?.branchId ?? ''
function contextHash(room: Room, member: RoomMember, command: RoomCommand) {
  const source =
    command.kind === 'intent-review'
      ? room.members.find(
          (m) => m.id === room.intents.find((i) => i.id === command.intentId)?.sessionId,
        )
      : member
  return hash(
    JSON.stringify({
      environment: room.environment,
      source: source && {
        id: source.id,
        revoked: source.revoked,
        role: source.role,
        characterIds: source.characterIds,
        actorIds: source.actorIds,
      },
    }),
  )
}
function visibility(room: Room, member: RoomMember, command: RoomCommand) {
  if(command.kind==='practical-effect-input')return {audience:'character' as const,characterId:practicalEffectInputCharacter(room,command.taskId),initiatorSessionId:member.id}
  if(command.kind==='practical-frame-action')return {audience:'gm' as const,initiatorSessionId:member.id}
  if(command.kind==='practical-staging-roll')return {audience:'gm' as const,initiatorSessionId:member.id}
  if(command.kind==='practical-initiative'){const actor=room.world.encounters.flatMap(e=>e.actors).find(a=>a.id===command.actorId)??room.practicalReview?.reinforcements.flatMap(p=>p.staging.actors).find(a=>a.id===command.actorId);return {audience:'character' as const,characterId:actor?.characterId??undefined,initiatorSessionId:member.id}}
  if(command.kind==='trade'){const op=command.command;return {audience:'character' as const,characterId:'tradeId'in op?room.world.adventures[0]?.trades?.sessions.find(t=>t.id===op.tradeId)?.characterId:undefined,initiatorSessionId:member.id}}
  if(command.kind==='npc-spatial')return {audience:'gm' as const,initiatorSessionId:member.id}
  if(command.kind.startsWith('spell-gm-')||command.kind==='scene-effect'||command.kind==='m3-spatial'||command.kind==='spatial')return {audience:'gm' as const,initiatorSessionId:member.id}
  const intent =
    command.kind === 'intent-review'
      ? room.intents.find((i) => i.id === command.intentId)
      : undefined
  const action = intent?.action ?? command,
    initiatorSessionId = intent?.sessionId ?? member.id
  if(action.kind==='scene-effect'||action.kind==='spatial')return {audience:'gm' as const,initiatorSessionId}
  if(action.kind==='map'&&action.command.type==='explore'&&action.command.command.operation==='spell-cast'){
    const cmd=action.command.command,caster=room.world.characters.find(c=>room.world.adventures.some(a=>a.scenes.some(s=>s.tokens.some(t=>t.id===cmd.tokenId&&t.characterId===c.id))))
    if(caster&&runtimeSpells(caster,catalogue([srd,...room.world.packs])).some(g=>g.key===cmd.key&&g.spell.id==='augury'))
      return {audience:'gm' as const,characterId:caster.id,initiatorSessionId}
  }
  if(action.kind==='map'){
    const cmd=action.command
    const control=cmd.type==='combat'&&['control-ruling','fear-context','command-complete'].includes(cmd.command.type)||cmd.type==='explore'&&cmd.command.operation==='control-ruling'
    const hasTruth=room.world.characters.some(c=>c.runtime?.effects?.some(f=>f.key==='zone-of-truth-source'))||room.world.encounters.some(e=>e.actors.some(a=>a.npc?.effects.some(f=>f.key==='zone-of-truth-source')))
    const temporal=cmd.type==='move'||cmd.type==='combat'&&cmd.command.type==='next'||cmd.type==='explore'&&['toggle','finish','end'].includes(cmd.command.operation)
    if(control||hasTruth&&temporal)return {audience:'gm' as const,initiatorSessionId}
  }
  if (action.kind === 'map' && action.command.type === 'discovery-check') {
    const id = action.command.attemptId,
      record = room.world.adventures[0]?.scenes
        .flatMap((s) => s.discoveryAttempts ?? [])
        .find((x) => x.id === id)
    return { audience: 'character' as const, characterId: record?.characterId, initiatorSessionId }
  }
  if (action?.kind === 'runtime')
    return { audience: 'character' as const, characterId: action.characterId, initiatorSessionId }
  const scene = room.world.adventures[0]?.scenes.find(
    (s) => s.id === room.world.adventures[0]?.activeSceneId,
  )
  if (action.kind === 'map' && action.command.type === 'combat') {
    const c = action.command.command,
      e = room.world.encounters.find((e) => e.id === scene?.encounterId)
    const actor = 'actorId' in c ? e?.actors.find((a) => a.id === c.actorId) : undefined
    if (actor) {
      const ids = new Set([
        actor.id,
        ...('targetId' in c ? [c.targetId] : []),
        ...('targets' in c && Array.isArray(c.targets)
          ? c.targets.filter((id): id is string => typeof id === 'string')
          : []),
        ...(e?.pending ? [e.pending.actorId, ...e.pending.targets.map((t) => t.id)] : []),
      ])
      const hidden = [...ids].some(
        (id) => !scene?.tokens.some((t) => t.actorId === id && !t.hidden),
      )
      return {
        audience: hidden ? ('gm' as const) : ('public' as const),
        characterId: actor.characterId ?? undefined,
        initiatorSessionId,
      }
    }
  }
  return {
    audience: scene?.tokens.some((t) => t.hidden) ? ('gm' as const) : ('public' as const),
    initiatorSessionId,
  }
}
function details(room: Room, command: RoomCommand, characterId?: string) {
  const action =
    command.kind === 'intent-review'
      ? room.intents.find((i) => i.id === command.intentId)?.action
      : command
  if (characterId && action?.kind === 'runtime')
    return (
      room.world.characters.find((c) => c.id === characterId)?.journal?.at(-1)?.detail ??
      '规则骰已确认'
    )
  // Combat logs may contain NPC AC, DC and GM notes; never forward them as a public roll caption.
  return '规则骰已确认；命中、抗性与资源按原结算流程处理'
}
/** Attempts one logical command against a clone. Missing dice commit only its request, never partial rule changes. */
function attempt(
  room: Room,
  member: RoomMember,
  command: RoomCommand,
  manual: boolean,
  values: DieFace[] = [],
  existing?: DicePending,
  npc = false,
) {
  const trial = clone(room),
    scope = existing ?? visibility(room, member, command)
  memoryLedger(room)?.attach(trial)
  // The trusted replay is the same request, not a competing submission. Keep
  // the persisted request until success; only hide it inside this atomic trial.
  if(existing&&['practical-effect-input','practical-initiative'].includes(command.kind))state(trial).pending=state(trial).pending.filter(p=>p.id!==existing.id)
  if(existing?.practicalBasis&&existing.practicalBasis===practicalDiceFingerprint(trial,command)&&command.kind==='intent-review'){const i=trial.intents.find(i=>i.id===command.intentId);if(i)i.baseWorldRevision=trial.worldRevision}
  try {
    const result = withDiceSource(manual, values, () => withInventoryClocks(trial.world.characters, () => {
      const run = ()=> npc
        ? advanceNpcTurns(trial)
        : executeCommand(
            trial,
            trial.members.find((m) => m.id === member.id)!,
            clone(command),
          )
      reconcilePracticalCasting(trial)
      const intent=command.kind==='intent-review'?trial.intents.find(i=>i.id===command.intentId):undefined,cast=intent&&practicalCast(trial,intent.action),progress=intent&&trial.practicalReview?.castings?.find(p=>p.intentId===intent.id&&p.branchId===branch(trial)&&p.status==='completed')
      const output=cast&&progress?withCompletedCasting(cast.id,cast.key,progress.durationHours,run):run()
      if(intent?.status==='approved'&&progress)progress.status='committed'
      reconcileWorld(trial.world);reconcileSceneEffects(trial.world);reconcileM3World(trial.world,catalogue([srd,...trial.world.packs]));reconcileSceneEffects(trial.world)
      syncGmSpellRequests(trial)
      return output
    }))
    if (existing) state(trial).pending = state(trial).pending.filter((p) => p.id !== existing.id)
    if (result.rolls.length)
      state(trial).records.push({
        ...(existing?{sourcePendingId:existing.id}:{}),
        id: randomUUID(),
        at: new Date().toISOString(),
        sessionId: scope.initiatorSessionId ?? existing?.sessionId ?? member.id,
        characterId: scope.characterId,
        audience: scope.audience,
        mode: manual
          ? 'manual'
          : result.rolls.some((r) => r.source === 'gm')
            ? 'mixed'
            : 'automatic',
        label: result.rolls[0]!.label,
        rolls: result.rolls,
        outcomes: result.outcomes,
        detail: details(trial, command, scope.characterId),
      })
    state(trial).records = state(trial).records.slice(-200)
    while (state(trial).records.reduce((n, r) => n + r.rolls.length, 0) > 4000)
      state(trial).records.shift()
    Object.assign(room, trial)
    inheritKnowledgeReports(trial,room)
    return true
  } catch (e) {
    if (!(e instanceof DiceRequired)) throw e
    const s = state(room)
    const request: DicePending = {
      id: existing?.id ?? randomUUID(),
      at: existing?.at ?? new Date().toISOString(),
      sessionId: existing?.sessionId ?? member.id,
      command: clone(command),
      worldRevision: room.worldRevision,
      branchId: branch(room),
      rolls: values.length > e.rolls.length ? values : e.rolls,
      sides: e.sides,
      label: e.label,
      draft: [],
      characterId: scope.characterId,
      audience: scope.audience,
      npc,
      step: values.length,
      contextHash: contextHash(room, member, command),
      practicalBasis:practicalDiceFingerprint(room,command),
    }
    request.initiatorSessionId = scope.initiatorSessionId
    if (existing) s.pending = s.pending.map((p) => (p.id === existing.id ? request : p))
    else {
      if (s.pending.length >= 20) throw new RoomError('待输入骰组已满')
      s.pending.push(request)
    }
    return false
  }
}
export function executeRoomDice(room: Room, member: RoomMember, command: RoomCommand) {
  return withEvaluation(() => executeRoomDiceUncached(room,member,command))
}
function executeRoomDiceUncached(room: Room, member: RoomMember, command: RoomCommand) {
  const s = state(room)
  if (
    ['dice-config', 'dice-input', 'dice-draft', 'dice-auto', 'dice-cancel'].includes(command.kind)
  ) {
    if (member.role !== 'gm') throw new RoomError('实体骰设置与录入需要 GM', 403)
    if (command.kind === 'dice-config') {
      s.mode = command.mode
      return
    }
    if (!('id' in command)) throw new RoomError('骰组编号缺失')
    const p = s.pending.find((p) => p.id === command.id)
    if (!p) throw new RoomError('骰组不存在或已完成')
    if (command.kind === 'dice-cancel') {
      s.pending = s.pending.filter((x) => x.id !== p.id)
      if(p.command.kind==='npc-spatial'&&'taskId'in p.command.command){
        const taskId=p.command.command.taskId,t=room.world.adventures[0]?.ai?.spatialState?.tasks.find(t=>t.id===taskId)
        if(t&&!['completed','canceled'].includes(t.status)){t.status='paused';t.approved=false;t.reason='GM取消实体骰；请重新批准或取消任务'}
      }
      if (p.command.kind === 'map' && p.command.command.type === 'discovery-check') {
        const id = p.command.command.attemptId,
          record = room.world.adventures[0]?.scenes
            .flatMap((s) => s.discoveryAttempts ?? [])
            .find((x) => x.id === id)
        if (record) record.status = 'canceled'
      }
      if (p.npc) {
        const e = room.world.encounters.find((e) => e.phase === 'active'),
          a = room.world.adventures[0],
          n = a?.ai?.npcs.find((n) => n.actorId === e?.actors[e.current]?.id)
        if (n && e) {
          n.turnHold = { encounterId: e.id, tick: e.tick, state: 'manual' }
          for (const run of a?.aiLog?.turns ?? [])
            if (run.npcId === n.id && run.encounterId === e.id && run.tick === e.tick) {
              run.state = 'canceled'
              run.reason = 'GM取消实体骰并接管'
            }
          room.worldRevision++
        }
      }
      room.events.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        sessionId: member.id,
        detail: 'GM取消待输入骰组；未提交的事务没有执行：' + command.reason,
      })
      return
    }
    const original = room.members.find((m) => m.id === p.sessionId)
    if (
      !original ||
      (p.worldRevision !== room.worldRevision&&(!p.practicalBasis||p.practicalBasis!==practicalDiceFingerprint(room,p.command))) ||
      p.branchId !== branch(room) ||
      p.contextHash !== contextHash(room, original, p.command)
    )
      throw new RoomError('世界、权限、环境或存档分支已变化，请取消旧骰组并重新发起', 409)
    if (command.kind === 'dice-draft' || command.kind === 'dice-input') {
      if (
        command.faces.length > p.sides.length ||
        command.faces.some((n, i) => !Number.isInteger(n) || n < 1 || n > p.sides[i]!)
      )
        throw new RoomError('骰面数量或范围不合法')
      if (command.kind === 'dice-draft') {
        p.draft = [...command.faces]
        return
      }
      if (command.faces.length !== p.sides.length) throw new RoomError('请填写完整骰组')
      const values = [
        ...p.rolls,
        ...command.faces.map((value, i) => ({
          sides: p.sides[i]!,
          value,
          label: p.label,
          source: 'gm' as const,
        })),
      ]
      const source = room.members.find((m) => m.id === p.sessionId && !m.revoked)
      if (!source) throw new RoomError('原行动身份已失效')
      attempt(room, source, p.command, true, values, p, !!p.npc)
      return
    }
    if (command.kind === 'dice-auto') {
      const source = room.members.find((m) => m.id === p.sessionId && !m.revoked)
      if (!source) throw new RoomError('原行动身份已失效')
      attempt(room, source, p.command, false, p.rolls, p, !!p.npc)
      room.events.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        sessionId: member.id,
        detail: 'GM将单次待输入改用自动骰：' + command.reason,
      })
      return
    }
  }
  if(command.kind==='npc-spatial'&&command.command.operation==='advance'){
    const taskId=command.command.taskId
    if(s.pending.some(p=>p.branchId===branch(room)&&p.command.kind==='npc-spatial'&&'taskId'in p.command.command&&p.command.command.taskId===taskId))throw new RoomError('该任务已有待输入骰组，请勿重复推进')
  }
  const blocking = s.pending.some(
    (p) => p.worldRevision === room.worldRevision && p.branchId === branch(room),
  )
  if (
    blocking &&
    [
      'map',
      'runtime',
      'give',
      'npc',
      'intent-review',
      'npc-turn-control',
      'npc-plan-step',
      'npc-proposal',
      'npc-reply-review',
      'npc-talk-review',
      'character-import',
    ].includes(command.kind)
  ) {
    const reload = command.kind === 'map' && command.command.type === 'restore'
    if (!reload) throw new RoomError('请先完成或取消待输入骰组，避免行动冲突')
  }
  attempt(room, member, command, s.mode === 'manual')
  state(room).pending = state(room).pending.filter((p) => p.branchId === branch(room))
}
export function advanceNpcDice(room: Room) {
  if (state(room).pending.length) return
  const gm = room.members.find((m) => m.role === 'gm' && !m.revoked)
  if (gm)
    attempt(
      room,
      gm,
      { kind: 'environment', environment: clone(room.environment) },
      state(room).mode === 'manual',
      [],
      undefined,
      true,
    )
}
export function advanceDiscoveryDice(room: Room) {
  for (let count = 0; count < 100; count++) {
    if (state(room).pending.length) return
    const a = room.world.adventures[0],
      scene = a?.scenes.find((s) => s.id === a.activeSceneId),
      record = scene?.discoveryAttempts?.find(
        (x) => x.branchId === branch(room) && x.status === 'pending',
      ),
      gm = room.members.find((m) => m.role === 'gm' && !m.revoked)
    if (!record || !scene || !gm) return
    if (
      !attempt(
        room,
        gm,
        {
          kind: 'map',
          command: { type: 'discovery-check', sceneId: scene.id, attemptId: record.id },
        },
        state(room).mode === 'manual',
      )
    )
      return
  }
}
export function projectDice(room: Room, member: RoomMember): RoomDiceView {
  const s = room.dice ?? { mode: 'automatic', pending: [], records: [] }
  const visible = (p: Pick<DiceRecord, 'audience' | 'characterId' | 'sessionId'>) =>
    member.role === 'gm' ||
    p.audience === 'public' ||
    (p.audience === 'character' &&
      (p.sessionId === member.id || member.characterIds.includes(p.characterId ?? '')))
  return {
    mode: s.mode,
    pending: s.pending.filter(visible).map(({ command, rolls: _r, contextHash: stamp, practicalBasis, ...p }) => ({
      ...clone(p),
      stale:
        (p.worldRevision !== room.worldRevision&&(!practicalBasis||practicalBasis!==practicalDiceFingerprint(room,command))) ||
        p.branchId !== branch(room) ||
        stamp !==
          contextHash(room, room.members.find((m) => m.id === p.sessionId) ?? member, command),
      draft: member.role === 'gm' ? clone(p.draft) : [],
    })),
    records: s.records.filter(visible).map((p) => clone(p)),
  }
}
