import type { BroadcastEvent } from './broadcast-types'
/** Classify the event's original context, never the room's current combat mode. */
export function routineExploration(event: BroadcastEvent) {
  if (event.facts.inCombat === true || (event.facts.inCombat !== false && event.facts.encounterId))
    return false
  if (['token.moved', 'token.jumped', 'exploration.round-ended'].includes(event.type)) return true
  return (
    event.type === 'exploration.action' &&
    ['dash', 'jump', 'wind', 'wind-focus', 'cunning-dash'].includes(
      String(event.facts.action ?? ''),
    )
  )
}
