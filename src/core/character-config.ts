import { clone } from './engine'
import type { Character } from './types'
import { scriptCharacterSchema } from '../persistence/npc-static-schema'
export function scriptCharacter(character: Character) {
  const {
    runtime,
    revision: _r,
    status: _s,
    purpose: _p,
    npcOwnerId: _n,
    journal: _j,
    createdAt: _c,
    updatedAt: _u,
    ...config
  } = clone(character)
  const allowed = [
    'hp',
    'temporaryHp',
    'resources',
    'conditions',
    'exhaustion',
    'hitDice',
    'death',
    'heroicInspiration',
    'preparedSpells',
    'restSpellChoices',
    'knownBeasts',
  ]
  const initial = Object.fromEntries(
    Object.entries(runtime ?? {}).filter(([k]) => allowed.includes(k)),
  )
  const initialConsumableDurations: { instanceId: string; hours: number }[] = []
  for (const row of config.inventory) {
    delete row.craftedBy
    delete row.craftedAt
    if (row.consumable?.expiresAt !== undefined) {
      initialConsumableDurations.push({
        instanceId: row.instanceId,
        hours: Math.max(0, row.consumable.expiresAt - (runtime?.hours ?? 0)),
      })
      delete row.consumable.expiresAt
    }
  }
  return scriptCharacterSchema.parse({ ...config, initial, initialConsumableDurations })
}
