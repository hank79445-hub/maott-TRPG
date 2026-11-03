import type { Room, RoomAction, RoomCommand, RoomMember } from '../online/protocol'
import { randomUUID } from 'node:crypto'
import { adventure, activeScene, RoomError } from './room-engine'
import { combatStats, freshTurn } from '../core/combat-rules'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'

export function heldNpc(room: Room, npcId: string) {
  return adventure(room).gmControls?.find((c) => c.targetKind === 'npc' && c.targetId === npcId)
}
export function assertGmActionControl(room: Room, member: RoomMember, action: RoomAction) {
  const a = adventure(room)
  let characterId: string | null | undefined, npcId: string | undefined
  if (action.kind === 'npc') npcId = action.npcId
  else if (action.kind === 'runtime' || action.kind === 'container') characterId = action.characterId
  else if (action.kind === 'give') characterId = action.fromId
  else if(action.kind==='m1')characterId='characterId'in action.action?action.action.characterId:undefined
  else if(action.kind==='scene-effect'){const op=action.action,id='casterId'in op?op.casterId:'actorId'in op?op.actorId:undefined;const t=activeScene(room)?.tokens.find(t=>[t.characterId,t.npcId,t.actorId,t.id].includes(id??''));characterId=t?.characterId;npcId=t?.npcId}
  else if(action.kind==='summon'){const op=action.action;characterId='sourceId'in op?op.sourceId:'instanceId'in op?a.summons?.instances.find(i=>i.id===op.instanceId)?.controllerId:undefined}
  else if(action.kind==='spatial'){const id='casterId'in action.action?action.action.casterId:'entityId'in action.action?action.action.entityId:'';const t=activeScene(room)?.tokens.find(t=>[t.characterId,t.npcId,t.actorId,t.id].includes(id));characterId=t?.characterId;npcId=t?.npcId}
  else {
    const c = action.command
    const scene = 'sceneId' in c ? a.scenes.find((s) => s.id === c.sceneId) : undefined
    if (c.type === 'combat') {
      const e = room.world.encounters.find((e) => e.id === scene?.encounterId)
      const actorId =
        'actorId' in c.command
          ? c.command.actorId
          : c.command.type === 'resolve'
            ? e?.pending?.actorId
            : undefined
      const actor = e?.actors.find((t) => t.id === actorId)
      const owner = actor?.companion
        ? e?.actors.find((t) => t.id === actor.companion!.ownerId)
        : undefined
      characterId = owner?.characterId ?? actor?.characterId
      npcId = actor ? a.ai?.npcs.find((n) => n.actorId === actor.id)?.id : undefined
    } else if (c.type === 'interact' && c.npcId) npcId = c.npcId
    else if ('characterId' in c) characterId = c.characterId
    else {
      const tokenId =
        'tokenId' in c
          ? c.tokenId
          : c.type === 'explore' && 'tokenId' in c.command
            ? c.command.tokenId
            : undefined
      const token = scene?.tokens.find((t) => t.id === tokenId)
      characterId = token?.characterId
      npcId = token?.npcId
    }
  }
  if (characterId) npcId ??= a.ai?.npcs.find((n) => n.characterId === characterId)?.id
  const held = a.gmControls?.find((c) =>
    c.targetKind === 'npc' ? c.targetId === npcId : c.targetId === characterId,
  )
  if (held && (member.role !== 'gm' || held.gmId !== member.id))
    throw new RoomError('该人物由GM接管，当前身份只能查看；请等待明确归还', 403)
}

export function changeGmControl(room: Room, member: RoomMember, command: RoomCommand) {
  if (command.kind !== 'gm-control') return false
  if (member.role !== 'gm' || member.revoked) throw new RoomError('接管与归还需要有效GM身份', 403)
  const a = adventure(room),
    rows = (a.gmControls ??= [])
  const existing = rows.find(
    (c) => c.targetKind === command.targetKind && c.targetId === command.targetId,
  )
  const n =
    command.targetKind === 'npc' ? a.ai?.npcs.find((n) => n.id === command.targetId) : undefined
  if (command.operation === 'take' && command.targetKind === 'npc' && !n)
    throw new RoomError('NPC不存在')
  if (command.operation === 'release') {
    if (!existing) throw new RoomError('该人物当前未被接管')
    if (n && existing.previousController) n.controller = existing.previousController
    a.gmControls = rows.filter((c) => c !== existing)
    for (const run of a.aiLog?.turns ?? [])
      if (run.npcId === n?.id && !['completed', 'canceled'].includes(run.state)) {
        run.state = 'review'
        run.reason = 'GM已归还；请核对已执行步骤后明确继续，不重复自动执行'
      }
  } else {
    if (existing) throw new RoomError('该人物已被接管，请先归还')
    if (rows.length >= 100) throw new RoomError('同时接管人数已达上限，请先归还部分人物')
    const scene = activeScene(room)
    const token = scene?.tokens.find((t) =>
      n ? t.npcId === n.id : t.characterId === command.targetId,
    )
    if (
      !token ||
      (command.targetKind === 'character' &&
        !room.world.characters.some((c) => c.id === command.targetId))
    )
      throw new RoomError('接管对象须位于当前场景')
    if (n && (!n.enabled || (n.initiallyAbsent && !n.appeared)))
      throw new RoomError('待出场或停用NPC不能接管')
    if (
      command.targetKind === 'character' &&
      a.ai?.npcs.some((n) => n.characterId === command.targetId)
    )
      throw new RoomError('NPC职业卡请按NPC接管，避免重复控制对象')
    const e = room.world.encounters.find((e) => e.id === scene?.encounterId)
    const actor = e?.actors.find((actor) => actor.id === (n?.actorId ?? token.actorId))
    const cat = catalogue([srd, ...room.world.packs])
    const body = actor ?? {
      id: token.id,
      characterId: n?.characterId ?? token.characterId,
      npc: n?.body ?? token.npcBody ?? null,
      side: n?.side ?? 'party',
      initiative: null,
      surprised: false,
      turn: freshTurn(),
    }
    if (
      combatStats(body, room.world.characters, cat).dead ||
      (n && combatStats(body, room.world.characters, cat).hp <= 0)
    )
      throw new RoomError('死亡人物不能接管行动')
    rows.push({
      id: randomUUID(),
      targetKind: command.targetKind,
      targetId: command.targetId,
      gmId: member.id,
      at: new Date().toISOString(),
      ...(n ? { previousController: n.controller } : {}),
    })
    if (n) {
      for (const run of a.aiLog?.turns ?? [])
        if (run.npcId === n.id && !['completed', 'canceled'].includes(run.state)) {
          run.state = 'paused'
          run.reason = 'GM接管，保留已执行步骤与待结算事务'
        }
      for (const job of a.aiLog?.jobs ?? [])
        if (
          job.kind === 'npc' &&
          job.npcId === n.id &&
          job.purpose === 'combat' &&
          ['queued', 'running'].includes(job.status)
        ) {
          job.status = 'interrupted'
          job.attempt = null
          job.error = 'GM接管暂停规划，请归还后明确重试'
        }
    }
  }
  a.revision++
  room.events.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    sessionId: member.id,
    detail: `GM${command.operation === 'take' ? '接管' : '归还'}：${n?.name ?? room.world.characters.find((c) => c.id === command.targetId)?.build.name ?? command.targetId}；${command.reason}`,
  })
  return true
}
