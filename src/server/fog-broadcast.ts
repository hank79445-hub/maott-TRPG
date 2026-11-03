import type { Room } from '../online/protocol'
import type { MapWorld } from '../core/map-types'
import type { BroadcastEvent } from '../core/broadcast-types'
import { adventure } from './room-engine'
import { fogEntityAllowed, fogDoorAccess, createFogAccess } from './fog'
import { enclosedMode } from '../core/enclosed-exploration'
/** Capture event-time knowledge. Looking at a later snapshot cannot reveal old hidden actors. */
export function captureFogBroadcasts(room: Room, before: MapWorld) {
  const a = adventure(room),
    old = before.adventures.find((v) => v.id === a.id),
    ids = new Set(old?.broadcastLog?.events.map((e) => e.id) ?? [])
  for (const e of a.broadcastLog?.events ?? []) {
    const s = a.scenes.find((s) => s.id === e.sceneId)
    if (
      ids.has(e.id) ||
      e.fogKnowledge ||
      !s?.fog?.enabled ||
      e.audience.kind !== 'public' ||
      (!enclosedMode(s)&&(e.type === 'npc.reply' ||e.type === 'ai.narration' ||e.type.startsWith('template.')))
    )
      continue
    const prior = old?.scenes.find((v) => v.id === s.id),
      tokens = [...s.tokens, ...(prior?.tokens ?? []), ...(s.defeatedTokens ?? [])].filter(
        (t, i, rows) => rows.findIndex((r) => r.id === t.id) === i,
      ),
      refs = new Set(Object.values(e.facts).filter((v): v is string => typeof v === 'string'))
    const related = tokens.filter(
      (t) =>
        [t.id, t.characterId, t.npcId, t.actorId].some((id) => id && refs.has(id)) ||
        ((/combat|battle/.test(e.type)||enclosedMode(s)) && e.text.includes(t.name)),
    )
    const points = s.points.filter((p) => refs.has(p.id)||(enclosedMode(s)&&e.text.includes(p.name)))
    if (!related.length && !points.length) continue
    const members = room.members
        .filter((m) => !m.revoked && m.role === 'player')
        .flatMap((m) => [
          ...m.characterIds.map((id) => ({ ...m, characterIds: [id], actorIds: [] })),
          ...m.actorIds.map((id) => ({ ...m, characterIds: [], actorIds: [id] })),
        ]),
      names: NonNullable<BroadcastEvent['fogKnowledge']>['names'] = []
    for (const token of related) {
      const knownTo = new Set<string>()
      for (const m of members) {
        const now = fogEntityAllowed(room, m, s.id, token),
          then = prior?.fog?.enabled
            ? fogEntityAllowed({ ...room, world: before }, m, s.id, token)
            : false
        if (now || then) for (const id of [...m.characterIds, ...m.actorIds]) knownTo.add(id)
      }
      names.push({
        name: token.name,
        aliases: [token.id, token.characterId, token.npcId, token.actorId].filter(
          (v): v is string => !!v,
        ),
        knownTo: [...knownTo],
      })
    }
    for (const p of points) {
      const t = {
        ...p,
        id: 'point:' + p.id,
        span: 1,
        actorId: null,
        characterId: null,
        color: '#000000',
        facing: 0,
      }
      const knownTo = members
        .filter((m) => p.kind==='door'?!!fogDoorAccess(room,m,s.id,p.id,undefined,createFogAccess(room,m,s.id,false)):fogEntityAllowed(room, m, s.id, t))
        .flatMap((m) => [...m.characterIds, ...m.actorIds])
      names.push({ name: p.name, aliases: [p.id], knownTo })
    }
    e.fogKnowledge = { witnesses: [...new Set(names.flatMap((n) => n.knownTo))], names }
    if (e.narration === 'generate') e.narration = 'context'
  }
}
export function redactFogEvent(e: BroadcastEvent, characters: readonly string[]) {
  const hidden =
    e.fogKnowledge?.names.filter((n) => !n.knownTo.some((id) => characters.includes(id))) ?? []
  let text = e.text,
    title = e.title
  for (const n of hidden.sort((a, b) => b.name.length - a.name.length)) {
    if (n.name) {
      text = text.replaceAll(n.name, '未辨明的人物／对象')
      title = title.replaceAll(n.name, '未辨明对象')
    }
  }
  return {
    ...e,
    text,
    title,
    facts: hidden.length ? { adjudicated: e.facts.adjudicated === true } : e.facts,
    message: hidden.length ? undefined : e.message,
    fogKnowledge: undefined,
  }
}
