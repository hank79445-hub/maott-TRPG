import { clone } from './engine'
import { newAdventure } from './map'
import { exportMap, importMap } from '../persistence/map-archive'
import type { Character } from './types'
import type { ScriptDefinition } from '../persistence/script-schema'

/** Reuse the archive remapper for character, inventory and effect references. */
export async function prepareScriptParty(
  definition: ScriptDefinition,
  players: Character[],
  bindings: Record<string, string>,
) {
  const adventure = newAdventure('开团角色副本')
  adventure.party = players.map((c) => c.id)
  const world = {
    adventures: [adventure],
    characters: clone(players),
    encounters: [],
    packs: clone(definition.packs),
  }
  const imported = await importMap(
    JSON.parse(await exportMap(world, [], adventure.id)),
    { adventures: [], characters: [], encounters: [], packs: [] },
    [],
  )
  const mapping = Object.fromEntries(
    players.map((c, i) => [c.id, imported.world.characters[i]!.id]),
  )
  return {
    players: imported.world.characters,
    bindings: Object.fromEntries(
      Object.entries(bindings).map(([slot, id]) => [slot, mapping[id] ?? id]),
    ),
    mapping,
  }
}
