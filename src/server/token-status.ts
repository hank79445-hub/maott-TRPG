import {appliedEffects} from '../core/effects'
import type { Room } from '../online/protocol'
import type { MapToken } from '../core/map-types'
import { catalogue, type Catalogue } from '../core/engine'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { runtimeState, runtimeDerived } from '../core/runtime'
import { combatStats } from '../core/combat-rules'
import { summarizeStatuses } from '../core/status-summary'
export function tokenStatuses(
  room: Room,
  t: MapToken,
  full: boolean,
  allowGm = false,
  cat: Catalogue = catalogue([...BUILTIN_PACKS, ...room.world.packs]),
) {
  const actor = room.world.encounters.flatMap((e) => e.actors).find((a) => a.id === t.actorId),
    c = room.world.characters.find((c) => c.id === t.characterId),
    n = room.world.adventures.flatMap((a) => a.ai?.npcs ?? []).find((n) => n.id === t.npcId),
    body = actor?.npc ?? n?.body ?? t.npcBody
  const runtime = c ? runtimeState(c, cat) : undefined,
    stats = actor ? combatStats(actor, room.world.characters, cat) : undefined
  const conditions =
      stats?.conditions ?? (c ? runtimeDerived(c, cat).conditions : (body?.conditions ?? [])),
    effects = appliedEffects(runtime?.effects ?? body?.effects ?? [])
  const falling=room.world.adventures.some(a=>a.m3?.events.some(e=>e.type==='fall'&&e.status==='pending'&&[t.id,t.characterId,t.actorId,t.npcId].includes(e.entityId)))
  const result = summarizeStatuses(
    [
      ...new Set([
        ...conditions,
        ...effects.flatMap((e) => [...(e.condition ? [e.condition] : []), ...(e.conditions ?? [])]),
      ]),
    ],
    effects,
    full,
    runtime?.hours ??
      room.world.characters.find((c) => room.world.adventures.some((a) => a.party.includes(c.id)))
        ?.runtime?.hours ??
      0,
    (id) =>
      room.world.characters.find((c) => c.id === id)?.build.name ??
      (() => {
        const actor = room.world.encounters.flatMap((e) => e.actors).find((a) => a.id === id)
        return actor ? combatStats(actor, room.world.characters, cat).name : undefined
      })() ??
      room.world.adventures.flatMap((a) => a.ai?.npcs ?? []).find((n) => n.id === id)?.name ??
      '未公开来源',
    allowGm,
    id=>room.world.characters.find(c=>c.id===id)?.runtime?.hours,
  )
  if(falling)result.push({id:'m3-fall',name:effects.some(e=>e.key==='feather-fall')?'缓缓下降（待结算）':'正在坠落（待结算）'})
  return result
}
