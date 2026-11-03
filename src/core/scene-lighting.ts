import {magicCrossing} from './scene-magic'
import type { SceneQueryCache } from './scene-query-cache'
import type { Adventure, MapWorld, MapScene, MapToken } from './map-types'
import type { ScenePoint } from './scene-effect-geometry'
import { sceneCenter,volumeRay }  from './scene-effect-geometry'
import { anchoredGeometry } from './scene-effects'
import { physicalPropagation, queryPropagation, regionContains } from './scene-propagation'
export interface Illumination {
  level: 'bright' | 'dim' | 'dark'
  magicalDarkness: boolean
  sunlight: boolean
  sourceIds: string[]
}
export function sceneIllumination(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  p: ScenePoint,
  cache?: SceneQueryCache,
): Illumination {
  const key =
      p.x + ':' + p.y + ':' + p.height + ':' + (p.layer ?? 'material') + ':' + (p.anchorId ?? ''),
    cached = cache?.illumination.get(key)
  if (cached) return cached
  let groups = cache?.effects.get(s.id)
  if (!groups) {
    const active = (a.sceneEffects?.regions ?? []).filter(e => e.status === 'active' && !e.covered && anchoredGeometry(world,a,e,cache)?.scene.id === s.id)
    groups = { lights: active.filter(e => !!e.light), shadows: active.filter(e => ['magical-darkness','absolute-darkness'].includes(e.obscurity)), huts: active.filter(e => e.spellId === 'tiny-hut' && e.magic) }
    cache?.effects.set(s.id,groups)
  }
  const ambient = a.m3?.environments.find((f) => f.sceneId === s.id)?.light ?? 'bright'
  let magicalDarkness = ambient === 'magical-darkness',
    absolute = ambient === 'magical-darkness'
  for (const e of groups.shadows)
    if (
      ['magical-darkness', 'absolute-darkness'].includes(e.obscurity) &&
      regionContains(world, a, s, e, p, cache)
    ) {
      magicalDarkness = true
      absolute ||= e.obscurity === 'absolute-darkness'
    }
  let level: Illumination['level'] =
      magicalDarkness || ambient === 'dark' ? 'dark' : ambient === 'dim' ? 'dim' : 'bright',
    sunlight = false
  const sourceIds: string[] = []
  for (const e of groups.lights) {
    if (
      e.status !== 'active' ||
      e.covered ||
      !e.light ||
      absolute ||
      (magicalDarkness && (!e.light.magical || e.slotLevel <= 2))
    )
      continue
    if(e.spellId==='moonbeam'){if(regionContains(world,a,s,e,p,cache)){if(level==='dark')level='dim';sourceIds.push(e.id)}continue}
    const current = anchoredGeometry(world, a, e, cache)
    if (
      !current ||
      current.scene.id !== s.id ||
      (current.layer ?? e.layer ?? 'material') !== (p.layer ?? 'material') ||
      (current.layer === 'pocket' && current.anchorId !== p.anchorId)
    )
      continue
    const g = current.geometry,
      c = sceneCenter(g),
      d =
        g.shape === 'emanation'
          ? Math.hypot(
              Math.max(g.x - p.x, p.x - g.x - g.originSpan, 0) * s.grid.feet,
              Math.max(g.y - p.y, p.y - g.y - g.originSpan, 0) * s.grid.feet,
              p.height - c.height,
            )
          : Math.hypot((p.x - c.x) * s.grid.feet, (p.y - c.y) * s.grid.feet, p.height - c.height)
    if (
      d > e.light.bright + e.light.dimExtra ||
      !physicalPropagation(
        a,
        s,
        { ...c, layer: current.layer, anchorId: current.anchorId },
        p,
        'light',
        cache,
      ).clear
    )
      continue
    try{magicCrossing(world,a,s,{...c,layer:current.layer,anchorId:current.anchorId},p,e.sourceId,{spellLevel:e.slotLevel})}catch{continue}
    const next = d <= e.light.bright && e.light.bright > 0 ? 'bright' : 'dim'
    if (next === 'bright' || level === 'dark') level = next
    if (e.light.sunlight && next === 'bright') sunlight = true
    sourceIds.push(e.id)
  }
  for(const e of groups.huts)if(e.magic&&regionContains(world,a,s,e,p,cache)){level=e.magic.hutLight==='dark'?'dark':'dim';sunlight=false}
  const result = { level, magicalDarkness, sourceIds, sunlight }
  cache?.illumination.set(key, result)
  return result
}
export function sceneVision(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  from: ScenePoint,
  to: ScenePoint,
  sense: {
    blindsight?: number
    truesight?: number
    devilsSight?: number
    darkvision?: number
    blinded?: boolean
  },
  cache?: SceneQueryCache,
) {
  const distance = Math.max(
      Math.abs(to.x - from.x) * s.grid.feet,
      Math.abs(to.y - from.y) * s.grid.feet,
      Math.abs(to.height - from.height),
    ),
    blind = (sense.blindsight ?? 0) > 0 && (sense.blindsight ?? 0) >= distance,
    trueSight = (sense.truesight ?? 0) > 0 && (sense.truesight ?? 0) >= distance,
    devil = (sense.devilsSight ?? 0) > 0 && (sense.devilsSight ?? 0) >= distance
  const ray = queryPropagation(
      world,
      a,
      s,
      from,
      to,
      'visual',
      { ignoreMagicalDarkness: trueSight || devil || blind, ignoreObscurity: blind },
      cache,
    ),
    light = sceneIllumination(world, a, s, to, cache)
  return {
    ray,
    light,
    lightlyObscured: !blind && !!a.sceneEffects?.regions.some(e=>e.status==='active'&&e.obscurity==='light'&&e.sceneId===s.id&&e.geometry&&volumeRay(e.geometry,from,to,s.grid.feet)&&physicalPropagation(a,s,from,to,'visual').clear),
    illuminated:
      light.level !== 'dark' ||
      blind ||
      (!sense.blinded &&
        (trueSight ||
          devil ||
          (!light.magicalDarkness &&
            (sense.darkvision ?? 0) >= distance &&
            (sense.darkvision ?? 0) > 0))),
    magicalDarkness: light.magicalDarkness && !trueSight && !devil && !blind,
  }
}
/** Retain the existing occupied-cell ray rule for large creatures. One blocked
 * centre ray must not erase a visible portion of an otherwise legal target. */
export function tokenSceneVision(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  from: MapToken,
  to: MapToken,
  sense: Parameters<typeof sceneVision>[5],
  cache?: SceneQueryCache,
) {
  const points = (t: MapToken) => {
    const p = [
      {
        x: t.x + t.span / 2,
        y: t.y + t.span / 2,
        height: t.spatial?.height ?? 0,
        layer: t.spatial?.layer ?? 'material',
        anchorId: t.spatial?.anchorId,
      },
    ]
    if (t.span > 1)
      for (let y = 0; y < t.span; y++)
        for (let x = 0; x < t.span; x++)
          p.push({
            x: t.x + x + 0.5,
            y: t.y + y + 0.5,
            height: t.spatial?.height ?? 0,
            layer: t.spatial?.layer ?? 'material',
            anchorId: t.spatial?.anchorId,
          })
    return p
  }
  let first: ReturnType<typeof sceneVision> | undefined,
    best = undefined as ReturnType<typeof sceneVision> | undefined
  for (const p of points(from))
    for (const q of points(to)) {
      const result = sceneVision(world, a, s, p, q, sense, cache)
      first ??= result
      if (result.ray.clear) {
        best ??= result
        if (result.illuminated) return result
      }
    }
  return best ?? first!
}
