import {systemMessage} from '../shared/localization/system-messages'
import {
  appendBroadcast,
  broadcasts,
  gmAudience,
  publicAudience,
  fireEventTemplates,
} from '../core/broadcast'
import type { BroadcastEvent, BroadcastFeed } from '../core/broadcast-types'
import type { Room, RoomCommand, RoomMember } from '../online/protocol'
import type { MapWorld } from '../core/map-types'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { runtimeDerived } from '../core/runtime'
import { routineExploration } from '../core/narration-policy'
import { redactFogEvent } from './fog-broadcast'

export function canReadBroadcast(room: Room, member: RoomMember, event: BroadcastEvent) {
  if (member.revoked) return false
  if (member.role === 'gm') return true
  if (event.audience.kind === 'public') return !event.fogKnowledge || event.fogKnowledge.witnesses.some(id=>member.characterIds.includes(id)||member.actorIds.includes(id))
  if (member.role === 'ai' || event.audience.kind === 'gm') return false
  return event.audience.characterIds.some((id) => member.characterIds.includes(id))
}
export function broadcastFeed(
  room: Room,
  member: RoomMember,
  after = 0,
  limit = 200,
): BroadcastFeed {
  const journal = room.world.adventures[0]?.broadcastLog
  if (!journal)
    return { branchId: 'legacy', head: 0, earliest: 1, cursor: 0, gap: false, events: [] }
  const head = journal.nextSequence - 1,
    earliest = journal.events[0]?.sequence ?? journal.nextSequence
  const scanned = journal.events.filter((e) => e.sequence > after).slice(0, limit)
  const visibleIds = new Set(
    journal.events.filter((e) => canReadBroadcast(room, member, e)).map((e) => e.id),
  )
  const events = scanned
    .filter((e) => visibleIds.has(e.id))
    .map((e) => ({
      ...(member.role==='gm'?e:redactFogEvent(e,[...member.characterIds,...member.actorIds])),
      perceivedBy: member.role === 'gm' ? e.perceivedBy : undefined,
      npcWitnesses: member.role === 'gm' ? e.npcWitnesses : undefined,
      audience: member.role === 'gm' ? e.audience : { kind: e.audience.kind, characterIds: [] },
      causeId: e.causeId && visibleIds.has(e.causeId) ? e.causeId : null,
      supersedes: e.supersedes.filter((id) => visibleIds.has(id)),
    }))
  return {
    branchId: journal.branchId,
    head,
    earliest,
    cursor: scanned.at(-1)?.sequence ?? Math.min(after, head),
    gap: after < earliest - 1,
    events,
  }
}
/** Runs on the cloned transaction. The store persists facts and state before notifying anyone. */
export function finalizeRoomBroadcast(
  room: Room,
  before: MapWorld,
  command: RoomCommand,
  actionId: string,
) {
  const a = room.world.adventures[0]!,
    old = before.adventures[0]!
  let action = command
  if (command.kind === 'intent-review' && command.approve) {
    const intent = room.intents.find((i) => i.id === command.intentId)
    if (intent) action = intent.action
  }
  const scene = a.scenes.find((s) => s.id === a.activeSceneId)
  const audienceFor = (id: string) =>
    scene?.tokens.some((t) => t.characterId === id && !t.hidden) ? publicAudience() : gmAudience()
  if (action.kind === 'runtime') {
    const c = room.world.characters.find((c) => c.id === action.characterId),
      prior = before.characters.find((c) => c.id === action.characterId),
      cmd = action.command
    if (c && prior) {
      const npc = a.ai?.npcs.find((n) => n.characterId === c.id)
      if (npc && !!c.runtime?.death?.dead !== !!prior.runtime?.death?.dead) {
        const publicNpc =
          !npc.hidden &&
          scene?.tokens.some((t) => !t.hidden && (t.npcId === npc.id || t.characterId === c.id))
        appendBroadcast(a, actionId, {
          category: 'resolution',
          type: 'life.state',
          narration: 'direct',
          title: '生命状态已确认',
          text: `${npc.name}：${c.runtime?.death?.dead ? '死亡' : '已恢复生命状态'}。`,
          message:systemMessage(c.runtime?.death?.dead?'life.dead':'life.recovered',{actor:npc.name}),
          audience: publicNpc ? publicAudience() : gmAudience(),
          facts: { npcId: npc.id, characterId: c.id, dead: !!c.runtime?.death?.dead },
        })
      }
      const audience = audienceFor(c.id),
        check = c.runtime?.advanced?.lastCheck
      if (cmd.type === 'check' && check) {
        appendBroadcast(a, actionId, {
          category: 'resolution',
          type: 'character.check',
          message:systemMessage(`${cmd.kind==='save'?'character.save':'character.check'}.${check.dc===null?'open':!check.autoFail&&check.total>=check.dc?'pass':'fail'}`,{actor:c.build.name,total:check.total}),
          title: cmd.kind === 'save' ? '豁免结果' : '检定结果',
          text: `${c.build.name}的${cmd.kind === 'save' ? '豁免' : '检定'}总值为 ${check.total}${check.dc === null ? '，未指定 DC。' : `，${!check.autoFail && check.total >= check.dc ? '成功' : '失败'}。`}`,
          audience,
          facts: {
            characterId: c.id,
            kind: check.kind,
            key: check.key,
            total: check.total,
            success: check.dc === null ? null : !check.autoFail && check.total >= check.dc,
          },
        })
      } else if (cmd.type === 'rest' || cmd.type === 'time') {
        appendBroadcast(a, actionId, {
          category: 'progress',
          type: cmd.type === 'rest' ? 'rest.' + cmd.kind : 'time.advance',
          message:cmd.type==='rest'?systemMessage(cmd.kind==='long'?'rest.long':'rest.short',{actor:c.build.name}):systemMessage('time.advance',{actor:c.build.name,hours:cmd.hours}),
          title: cmd.type === 'rest' ? '休息完成' : '时间推进',
          text:
            cmd.type === 'rest'
              ? `${c.build.name}完成${cmd.kind === 'long' ? '长休' : '短休'}。`
              : `${c.build.name}的冒险时间推进 ${cmd.hours} 小时。`,
          audience,
          facts: { characterId: c.id, hours: c.runtime?.hours ?? 0 },
        })
      } else if (cmd.type === 'undo') {
        const { journal } = broadcasts(a)
        const previousBranch = journal.branchId
        journal.branchId = crypto.randomUUID()
        appendBroadcast(a, actionId, {
          category: 'progress',
          type: 'branch.undo',
          phase: 'correction',
          title: '角色操作撤销',
          text: `GM 已撤销${c.build.name}的先前操作，请以当前状态为准。`,
          message:systemMessage('character.undo',{actor:c.build.name}),
          audience,
          facts: { previousBranch },
        })
      } else if (
        [
          'damage',
          'heal',
          'condition',
          'death-save',
          'concentration',
          'end-concentration',
        ].includes(cmd.type)
      ) {
        appendBroadcast(a, actionId, {
          category: 'resolution',
          type: 'character.' + cmd.type,
          message:systemMessage(cmd.type==='damage'?'character.damage':cmd.type==='heal'?'character.heal':cmd.type==='condition'?'character.condition':'character.saveResolved',{actor:c.build.name}),
          title: '角色结果已确认',
          text: `${c.build.name}的${cmd.type === 'damage' ? '伤害' : cmd.type === 'heal' ? '治疗' : cmd.type === 'condition' ? '状态' : '豁免／专注'}已处理并保存。`,
          audience,
          facts: {
            characterId: c.id,
            critical:
              cmd.type === 'damage' &&
              !!cmd.critical &&
              (c.runtime?.hp ?? 0) + (c.runtime?.temporaryHp ?? 0) <
                (prior.runtime?.hp ?? 0) + (prior.runtime?.temporaryHp ?? 0),
            damage: Math.max(
              0,
              (prior.runtime?.hp ?? 0) +
                (prior.runtime?.temporaryHp ?? 0) -
                (c.runtime?.hp ?? 0) -
                (c.runtime?.temporaryHp ?? 0),
            ),
            hpBefore: prior.runtime?.hp ?? 0,
            hpAfter: c.runtime?.hp ?? 0,
            maxHp: runtimeDerived(c, catalogue([srd, ...room.world.packs])).hp,
            hpChange: (c.runtime?.hp ?? 0) - (prior.runtime?.hp ?? 0),
            temporaryHpChange: (c.runtime?.temporaryHp ?? 0) - (prior.runtime?.temporaryHp ?? 0),
            adjudicated: true,
          },
        })
      }
      // Full journal text is deliberately GM-only; it may contain DCs and private equipment notes.
      if (c.journal?.at(-1)?.id !== prior.journal?.at(-1)?.id)
        appendBroadcast(a, actionId, {message:systemMessage('audit.character'),
          category: 'interaction',
          type: 'character.audit',
          title: '角色操作明细',
          text: (c.journal?.at(-1)?.detail ?? '操作已保存').slice(0, 6000),
          audience: gmAudience(),
          facts: { characterId: c.id, operation: cmd.type },
        })
    }
  } else if (action.kind === 'give') {
    const from = room.world.characters.find((c) => c.id === action.fromId)!,
      to = room.world.characters.find((c) => c.id === action.toId)!
    const item = before.characters
      .find((c) => c.id === from.id)
      ?.inventory.find((i) => i.instanceId === action.instanceId)
    const name = catalogue().items.find((i) => i.id === item?.itemId)?.name ?? '物品'
    appendBroadcast(a, actionId, {
      category: 'interaction',
      type: 'item.given',
      message:systemMessage('item.given',{actor:from.build.name,target:to.build.name,item:name,quantity:action.quantity}),
      title: '物品给予',
      text: `${from.build.name}给予${to.build.name}${name} ×${action.quantity}。`,
      facts: {
        fromId: from.id,
        toId: to.id,
        itemId: item?.itemId ?? null,
        quantity: action.quantity,
      },
    })
  }
  if (action.kind === 'runtime' || action.kind === 'give' || action.kind === 'npc')
    fireEventTemplates(a, room.world, actionId)
  for (const event of a.broadcastLog?.events ?? []) {
    if (event.sequence > (old.broadcastLog?.nextSequence ?? 1) - 1) {
      event.roomId = room.id
      event.worldRevision = room.worldRevision
      event.actionId = actionId
      const explore = old.exploration?.status !== 'closed' ? old.exploration : undefined
      if (explore) {
        event.facts.turnId ??= `explore:${explore.id}:${explore.roundId}`
        event.facts.explorationId ??= explore.id
        event.facts.round ??= explore.round
      }
      const encounter = room.world.encounters.find((e) => e.id === scene?.encounterId)
      const prior = before.encounters.find((e) => e.id === scene?.encounterId)
      event.facts.inCombat = encounter?.phase === 'active' || prior?.phase === 'active'
      if (routineExploration(event)) event.facts.narrationIgnored = 'routine-exploration'
      if (encounter && (encounter.phase === 'active' || prior?.phase === 'active')) {
        event.facts.encounterId ??= encounter.id
        event.facts.round ??= prior?.phase === 'active' ? prior.round : encounter.round
        event.facts.turnId ??= `${encounter.id}:${prior?.phase === 'active' ? prior.tick : encounter.tick}`
      }
    }
  }
}
