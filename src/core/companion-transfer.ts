import type { Encounter } from './combat-types'
import type { Character } from './types'
import { clone } from './engine'
import { freshTurn } from './combat-rules'
import { reconcileEncounter } from './combat-lifecycle'
/** A world transaction moves the live proxy; older encounters remain history.
 * The most recent owner/source record wins, including a dismissed record.
 */
export function transferCompanions(
  next: Encounter,
  encounters: Encounter[],
  characters: Character[],
  instances:import('../persistence/summon-schema').SummonInstance[]=[],
) {
  const seen = new Set<string>()
  for (const previous of encounters
    .filter((e) => e.id !== next.id)
    .slice()
    .reverse()) {
    reconcileEncounter(previous, characters)
    for (const actor of previous.actors
      .filter((a) => a.companion)
      .slice()
      .reverse()) {
      const owner = previous.actors.find((a) => a.id === actor.companion!.ownerId),
        nextOwner = next.actors.find((a) => !!a.characterId&&a.characterId===owner?.characterId||!!a.npcId&&a.npcId===owner?.npcId),
        key = actor.companion!.instanceId ?? `${owner?.characterId}:${actor.companion!.source}:${actor.companion!.surgeId ?? ''}`
      if (!nextOwner || seen.has(key)) continue
      seen.add(key)
      if (previous.phase !== 'ended' || actor.companion!.dismissed) continue
      if (next.actors.length >= 100) throw new Error('带入伙伴后遭遇参与者超过上限')
      const instance=instances.find(i=>i.id===actor.companion!.instanceId)
      if(instance&&instance.state!=='present')continue
      const copy = clone(actor),
        oldId = copy.id
      if(instance?.body)copy.npc=clone(instance.body)
      copy.id = crypto.randomUUID()
      for (const c of characters)
        for (const f of c.runtime?.effects ?? []) {
          if (f.sourceId === oldId) f.sourceId = copy.id
          if (f.charmSources)
            f.charmSources = f.charmSources.map((id) => (id === oldId ? copy.id : id))
        }
      copy.companion!.ownerId = nextOwner.id
      copy.companion!.commandedTick = undefined
      copy.turn = freshTurn()
      copy.initiative = null
      copy.npc!.effects = copy.npc!.effects.map((f) => ({
        ...f,
        expiresAt: null,
        sourceId: f.sourceId === oldId ? copy.id : f.sourceId,
      }))
      actor.companion!.dismissed = true
      next.actors.push(copy)
    }
  }
}
