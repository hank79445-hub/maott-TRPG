import type { Intent } from './protocol'
import type { CombatCommand } from '../core/combat-types'
export const isHitReaction = (command: CombatCommand) =>
  command.type === 'reaction-defense' ||
  (command.type === 'feature' &&
    [
      'origin/interception',
      'phb/protective-field',
      'phb/maneuver-parry',
      'phb/feat-defensive-duelist',
      'phb/valor-defense',
      'phb/valor-offense',
      'phb/guided-strike',
      'phb/maneuver-precision',
    ].includes(command.id))
import type { Encounter } from '../core/combat-types'
/** A narrow exception: another defender's approved reaction cannot invalidate
 * this request, but a replaced/resolved window or changed ownership still can. */
export function sameDefenseWindow(intent: Intent, encounter: Encounter | undefined) {
  const action = intent.action
  return (
    action.kind === 'map' &&
    action.command.type === 'combat' &&
    isHitReaction(action.command.command) &&
    !!intent.pendingWindow &&
    encounter?.pending?.id === intent.pendingWindow
  )
}
