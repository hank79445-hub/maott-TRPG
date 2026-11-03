import type { PersistentZone } from './combat-types'
import {concentrationMatches} from './spell-source-state'
import type { Character } from './types'
export const ZONE_SPELLS = [
  'moonbeam',
  'spirit-guardians',
  'cloud-of-daggers',
  'hunger-of-hadar',
  'cordon-of-arrows',
] as const
export const isZoneSpell = (id: string): id is PersistentZone['spellId'] =>
  ZONE_SPELLS.some((s) => s === id)
export function zoneAlive(z: PersistentZone, c?: Character) {
  return (
    !!c &&
    (c.runtime?.hours ?? 0) < z.expiresHour &&
    (z.spellId === 'cordon-of-arrows'
      ? (z.ammunition ?? 0) > 0
      : concentrationMatches({key:z.spellId,castId:z.castId},c.runtime?.concentration))
  )
}
export function zoneDamage(z: PersistentZone, phase: string) {
  switch (z.spellId) {
    case 'moonbeam':
      return { formula: z.slotLevel + 'd10', type: z.damageType, save: 'con' as const, half: true }
    case 'spirit-guardians':
      return { formula: z.slotLevel + 'd8', type: z.damageType, save: 'wis' as const, half: true }
    case 'cloud-of-daggers':
      return {
        formula: 4 + Math.max(0, z.slotLevel - 2) * 2 + 'd4',
        type: 'slashing' as const,
        save: null,
        half: false,
      }
    case 'cordon-of-arrows':
      return { formula: '2d4', type: 'piercing' as const, save: 'dex' as const, half: false }
    case 'hunger-of-hadar':
      return {
        formula: '2d6',
        type: phase === 'start' ? ('cold' as const) : ('acid' as const),
        save: phase === 'start' ? null : ('dex' as const),
        half: false,
      }
  }
}
