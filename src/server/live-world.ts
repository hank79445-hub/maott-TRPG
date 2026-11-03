import type { MapWorld } from '../core/map-types'

/** Runtime projection only. The persisted world and archive always retain full snapshots. */
export function liveWorld(world: MapWorld): MapWorld {
  return {
    ...world,
    characters: world.characters.map((c) => ({ ...c, journal: c.journal?.slice(-40) })),
    adventures: world.adventures.map((a) => {
      return {
        ...a,
        testBattle: undefined,
        designNotebook: undefined,
        checkpoints: [],
        aiLog: undefined,
        ...(a.broadcastLog
          ? { broadcastLog: { ...a.broadcastLog, events: a.broadcastLog.events.slice(-100) } }
          : {}),
        log: a.log.slice(-60).map((l) => ({ ...l, before: null })),
        ...(a.battles ? { battles: { ...a.battles, history: [] } } : {}),
      }
    }),
    encounters: world.encounters.map((e) => ({
      ...e,
      log: e.log.slice(-60).map((l) => ({ ...l, before: null })),
    })),
  }
}
