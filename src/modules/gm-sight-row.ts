import type { MapWorld, MapToken } from '../core/map-types'
import type { Catalogue } from '../core/engine'
import { m3PerceptionCache, tokenPerception } from '../core/m3-map-perception'
import { sightLine, coverBetween } from '../core/map-spatial'
import { withEvaluation } from '../core/evaluation'
/** GM already has the full world. Compute only the selected row, not N² pairs. */
export function gmSightRow(world: MapWorld, sceneId: string, sourceId: string, cat: Catalogue) {
  return withEvaluation(() => selectedSightRow(world,sceneId,sourceId,cat))
}
function selectedSightRow(world: MapWorld, sceneId: string, sourceId: string, cat: Catalogue) {
  const a = world.adventures.find(a => a.scenes.some(s => s.id === sceneId)), s = a?.scenes.find(s => s.id === sceneId)
  const from = s?.tokens.find(t => t.id === sourceId)
  if (!a || !s || !from) return []
  const cache = m3PerceptionCache()
  return s.tokens.filter(t => !t.hidden && t.id !== from.id).map((to: MapToken) => ({ fromId: from.id, toId: to.id,
    sightClear: tokenPerception(world,a,s,from,to,cat,undefined,cache).canSee,
    targetingClear: sightLine(s,from,to,'blocksTargeting').clear,
    cover: coverBetween(s,from,to).degree,
  }))
}
