import type { Character } from './types'
import type { Encounter } from './combat-types'
import type { Catalogue } from './engine'
import { combatStats } from './combat-rules'
import type { MapWorld } from './map-types'
import { distance } from './map'

export function removeGrappleCopies(world: MapWorld, ids: Set<string>) {
  for (const c of world.characters)
    if (c.runtime?.effects) c.runtime.effects = c.runtime.effects.filter((f) => !ids.has(f.id))
  for (const e of world.encounters)
    for (const a of e.actors) if (a.npc) a.npc.effects = a.npc.effects.filter((f) => !ids.has(f.id))
  for (const a of world.adventures) {
    for (const n of a.ai?.npcs ?? [])
      if (n.body) n.body.effects = n.body.effects.filter((f) => !ids.has(f.id))
    for (const s of a.scenes)
      for (const t of s.tokens)
        if (t.npcBody) t.npcBody.effects = t.npcBody.effects.filter((f) => !ids.has(f.id))
  }
}
export function reconcileMapGrapples(world: MapWorld, cat: Catalogue) {
  const placements = world.adventures.flatMap((a) =>
    a.scenes.flatMap((s) => s.tokens.map((t) => ({ a, s, t }))),
  )
  const remove = new Set<string>()
  for (const e of world.encounters)
    for (const actor of e.actors) {
      if (
        !e.session &&
        !world.adventures.some(
          (a) =>
            a.scenes.some((s) => s.encounterId === e.id) ||
            a.battles?.history.some((h) => h.id === e.id),
        )
      )
        continue
      const body = world.characters.find((c) => c.id === actor.characterId)?.runtime ?? actor.npc
      for (const f of body?.effects ?? []) {
        if (!f.grapple || f.encounterId !== e.id) continue
        const source = e.actors.find((a) => a.id === f.sourceId)
        const from = placements.find(
          (p) => source?.characterId && p.t.characterId === source.characterId,
        )
        const to = placements.find(
          (p) =>
            (actor.characterId && p.t.characterId === actor.characterId) ||
            p.t.actorId === actor.id ||
            p.t.npcSourceActorId === actor.id ||
            p.t.npcBody?.effects.some((x) => x.id === f.id) ||
            p.a.ai?.npcs.some(
              (n) =>
                n.id === p.t.npcId &&
                (n.actorId === actor.id || n.body?.effects.some((x) => x.id === f.id)),
            ),
        )
        if (
          !from ||
          !to ||
          from.s.id !== to.s.id ||
          distance(from.s, from.t, to.t) > f.grapple.range ||
          !source ||
          combatStats(source, world.characters, cat).conditions.includes('incapacitated')
        )
          remove.add(f.id)
      }
    }
  if (remove.size) removeGrappleCopies(world, remove)
  for (const e of world.encounters) reconcileGrapples(e, world.characters, cat)
}

export function reconcileGrapples(e: Encounter, cs: Character[], cat: Catalogue) {
  for (const target of e.actors) {
    const body = cs.find((c) => c.id === target.characterId)?.runtime ?? target.npc
    if (!body?.effects) continue
    body.effects = body.effects.filter((f) => {
      if (!f.grapple || f.encounterId !== e.id) return true
      const source = e.actors.find((a) => a.id === f.sourceId)
      return (
        !!source &&
        !source.companion?.dismissed &&
        !combatStats(source, cs, cat).conditions.includes('incapacitated') &&
        !combatStats(source, cs, cat).dead
      )
    })
  }
  for (const a of e.actors) {
    const c = cs.find((c) => c.id === a.characterId)
    if (!c?.runtime) continue
    c.runtime.grapples = [
      ...(c.runtime.grapples ?? []).filter((g) => g.encounterId !== e.id),
      ...e.actors.flatMap((t) => {
        const body = cs.find((c) => c.id === t.characterId)?.runtime ?? t.npc
        return (body?.effects ?? [])
          .filter((f) => f.grapple && f.sourceId === a.id && f.encounterId === e.id)
          .map((f) => ({ targetId: t.id, encounterId: e.id, hand: f.grapple!.hand }))
      }),
    ]
  }
}
