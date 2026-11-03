import type { Encounter } from '../core/combat-types'
/** Remap links after copying actors; logical rule IDs and recorded rolls stay intact. */
export function remapComplexReferences(e: Encounter, actors: Map<string, string>) {
  const actorId = (id: string) => actors.get(id) ?? id
  for (const a of e.actors) if (a.companion) a.companion.ownerId = actorId(a.companion.ownerId)
  for (const a of e.actors)
    for (const f of a.npc?.effects ?? [])
      if (f.charmSources) f.charmSources = f.charmSources.map(actorId)
  for (const a of e.actors)
    if (a.turn.lastAttack) a.turn.lastAttack.targetId = actorId(a.turn.lastAttack.targetId)
  for (const target of e.pending?.targets ?? [])
    for (const interception of target.interceptions ?? [])
      interception.sourceId = actorId(interception.sourceId)
  if (e.pending?.metamagic) {
    e.pending.metamagic.protectedIds = e.pending.metamagic.protectedIds.map(actorId)
    e.pending.metamagic.heightenedId = actorId(e.pending.metamagic.heightenedId)
  }
  for (const z of e.zones ?? []) {
    z.sourceId = actorId(z.sourceId)
    z.excludedIds = z.excludedIds.map(actorId)
    z.triggered = Object.fromEntries(
      Object.entries(z.triggered).map(([id, tick]) => [actorId(id), tick]),
    )
    if (z.phaseTriggered)
      z.phaseTriggered = Object.fromEntries(
        Object.entries(z.phaseTriggered).map(([id, phases]) => [actorId(id), phases]),
      )
  }
}
