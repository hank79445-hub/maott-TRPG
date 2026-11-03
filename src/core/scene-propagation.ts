import { sceneIllumination } from './scene-lighting'
import {magicCrossing} from './scene-magic'
import type { SceneQueryCache } from './scene-query-cache'
import type { MapWorld, Adventure, MapScene } from './map-types'
import type { SceneEffect } from '../persistence/scene-effects-schema'
import { anchoredGeometry } from './scene-effects'
import {
  geometryContains,
  volumeRay,
  geometryRayBreaks,
  sceneCenter,
  type ScenePoint,
} from './scene-effect-geometry'
import { segmentsIntersect, wallActive, effectiveWallCover } from './map-spatial'
const EPSILON = 1e-8
export type PropagationChannel = 'visual' | 'light' | 'sound' | 'effect' | 'movement' | 'projectile'
export interface PropagationResult {
  clear: boolean
  uncertain: boolean
  reasons: string[]
  blockerIds: string[]
}
/** Independent channels; darkness and fog never become physical total cover. */
export function physicalPropagation(
  a: Adventure,
  s: MapScene,
  from: ScenePoint,
  to: ScenePoint,
  channel: PropagationChannel,
  cache?: SceneQueryCache,
): PropagationResult {
  const reasons: string[] = [],
    blockerIds: string[] = []
  let uncertain = false
  if (
    from.layer &&
    from.layer !== 'material' &&
    from.layer === to.layer &&
    from.anchorId === to.anchorId
  )
    return { clear: true, uncertain: false, reasons, blockerIds }
  const floor = a.m3?.environments.find((f) => f.sceneId === s.id)?.floorHeight ?? 0
  const key = s.id + ':' + channel
  let candidates = cache?.barriers.get(key)
  if (!candidates) {
    candidates = (s.walls ?? []).filter(w => wallActive(s,w) && (channel === 'visual' ? w.blocksSight : channel === 'light' ? (w.blocksLight ?? w.blocksSight) : channel === 'sound' ? (w.blocksSound ?? false) : channel === 'movement' ? w.blocksMovement : w.blocksTargeting && effectiveWallCover(w) === 'total'))
    cache?.barriers.set(key,candidates)
  }
  for (const w of candidates) {
    // Conservative broad phase; intersections and uncertain heights remain exact.
    if (Math.max(from.x,to.x) < Math.min(w.a.x,w.b.x) - EPSILON || Math.min(from.x,to.x) > Math.max(w.a.x,w.b.x) + EPSILON || Math.max(from.y,to.y) < Math.min(w.a.y,w.b.y) - EPSILON || Math.min(from.y,to.y) > Math.max(w.a.y,w.b.y) + EPSILON) continue
    const blocks =
      channel === 'visual'
        ? w.blocksSight
        : channel === 'light'
          ? (w.blocksLight ?? w.blocksSight)
          : channel === 'sound'
            ? (w.blocksSound ?? false)
            : channel === 'movement'
              ? w.blocksMovement
              : channel === 'effect'
                ? w.blocksTargeting && effectiveWallCover(w) === 'total'
                : w.blocksTargeting && effectiveWallCover(w) === 'total'
    if (!blocks || !wallActive(s, w) || !segmentsIntersect(from, to, w.a, w.b)) continue
    const vx = to.x - from.x,
      vy = to.y - from.y,
      wx = w.b.x - w.a.x,
      wy = w.b.y - w.a.y,
      den = vx * wy - vy * wx
    const t = Math.abs(den) > 1e-9 ? ((w.a.x - from.x) * wy - (w.a.y - from.y) * wx) / den : 0.5
    const height = from.height + (to.height - from.height) * t
    if (height < floor || (w.heightFeet !== undefined && height > floor + w.heightFeet)) continue
    if (w.heightFeet === undefined && Math.max(from.height, to.height) > floor + s.grid.feet) {
      uncertain = true
      reasons.push('相交墙体高度尚未核实')
    } else
      reasons.push(
        '墙门阻断' +
          {
            visual: '视线',
            light: '光线',
            sound: '声音',
            effect: '效果传播',
            movement: '移动',
            projectile: '投射物',
          }[channel],
      )
    blockerIds.push(w.id)
  }
  return { clear: !blockerIds.length, uncertain, reasons: [...new Set(reasons)], blockerIds }
}
export function regionContains(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  p: ScenePoint,
  cache?: SceneQueryCache,
) {
  const current = anchoredGeometry(world, a, e, cache)
  if (
    e.status !== 'active' ||
    e.covered ||
    !current ||
    current.scene.id !== s.id ||
    (current.layer ?? e.layer ?? 'material') !== (p.layer ?? 'material') ||
    (current.layer === 'pocket' && current.anchorId !== p.anchorId) ||
    !geometryContains(current.geometry, p, s.grid.feet)
  )
    return false
  if(e.spellId!=='tiny-hut')try{magicCrossing(world,a,s,{...sceneCenter(current.geometry),layer:current.layer,anchorId:current.anchorId},p,e.sourceId,{spellLevel:e.slotLevel})}catch{return false}
  if(['fog-cloud','stinking-cloud'].includes(e.spellId)&&a.sceneEffects?.regions.some(w=>w.status==='active'&&w.spellId==='wind-wall'&&w.sceneId===s.id&&w.geometry&&volumeRay(w.geometry,sceneCenter(current.geometry),p,s.grid.feet)))return false
  // Ordinary spell volumes do not spread through a solid total-cover barrier.
  return physicalPropagation(
    a,
    s,
    { ...sceneCenter(current.geometry), layer: current.layer, anchorId: current.anchorId },
    p,
    e.light ? 'light' : 'effect',
    cache,
  ).clear
}
export function queryPropagation(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  from: ScenePoint,
  to: ScenePoint,
  channel: PropagationChannel,
  options: { ignoreMagicalDarkness?: boolean; ignoreObscurity?: boolean } = {},
  cache?: SceneQueryCache,
): PropagationResult {
  const result = physicalPropagation(a, s, from, to, channel, cache)
  if (!result.clear) return result
  for (const e of a.sceneEffects?.regions ?? []) {
    if (e.status !== 'active' || e.covered || e.legacy&&!e.magic?.migrated) continue
    if(e.spellId==='tiny-hut'&&e.magic&&channel==='visual'){const g=anchoredGeometry(world,a,e,cache);if(g?.scene.id===s.id&&!geometryContains(g.geometry,from,s.grid.feet)&&volumeRay(g.geometry,from,to,s.grid.feet)){result.clear=false;result.blockerIds.push(e.id);result.reasons.push('小屋外部不透明')}continue}
    const visual =
      channel === 'visual' &&
      ((e.obscurity === 'heavy' && !options.ignoreObscurity) ||
        (['magical-darkness', 'absolute-darkness'].includes(e.obscurity) &&
          !options.ignoreObscurity &&
          (!options.ignoreMagicalDarkness||e.obscurity==='absolute-darkness')))
    if (!visual && !e.channels.includes(channel)) continue
    const current = anchoredGeometry(world, a, e, cache)
    if (
      !current ||
      current.scene.id !== s.id ||
      (current.layer ?? e.layer ?? 'material') !== (to.layer ?? 'material') ||
      (current.layer === 'pocket' && current.anchorId !== to.anchorId) ||
      !volumeRay(current.geometry, from, to, s.grid.feet)
    )
      continue
    if(visual&&['fog-cloud','stinking-cloud'].includes(e.spellId)){
      const breaks=geometryRayBreaks(current.geometry,from,to,s.grid.feet)
      for(const wall of a.sceneEffects?.regions??[])if(wall.status==='active'&&wall.spellId==='wind-wall'&&wall.sceneId===s.id&&wall.geometry)breaks.push(...geometryRayBreaks(wall.geometry,from,to,s.grid.feet))
      breaks.sort((a,b)=>a-b)
      if(!breaks.slice(1).some((v,i)=>{const t=(v+breaks[i]!)/2;return regionContains(world,a,s,e,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,height:from.height+(to.height-from.height)*t,layer:to.layer,anchorId:to.anchorId},cache)}))continue
    }
    if (visual && e.obscurity === 'magical-darkness') {
      const breaks = geometryRayBreaks(current.geometry, from, to, s.grid.feet)
      for (const light of a.sceneEffects?.regions ?? []) {
        if (
          light.status !== 'active' ||
          !light.light ||
          light.slotLevel <= 2 ||
          !light.light.magical ||
          light.covered
        )
          continue
        const g = anchoredGeometry(world, a, light, cache)
        if (g?.scene.id === s.id)
          breaks.push(
            ...geometryRayBreaks(
              { ...g.geometry, size: light.light.bright + light.light.dimExtra },
              from,
              to,
              s.grid.feet,
            ),
          )
      }
      breaks.sort((a, b) => a - b)
      const at = (t: number) => ({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        height: from.height + (to.height - from.height) * t,
        layer: to.layer,
        anchorId: to.anchorId,
      })
      if (
        !breaks.slice(1).some((t, i) => {
          const p = at((t + breaks[i]!) / 2)
          return (
            regionContains(world, a, s, e, p, cache) &&
            sceneIllumination(world, a, s, p, cache).level === 'dark'
          )
        })
      )
        continue
    }
    // A ray through a volume completely behind a solid barrier cannot leak that volume's identity.
    if (
      !physicalPropagation(
        a,
        s,
        { ...sceneCenter(current.geometry), layer: current.layer, anchorId: current.anchorId },
        from,
        'effect',
      ).clear &&
      !physicalPropagation(
        a,
        s,
        { ...sceneCenter(current.geometry), layer: current.layer, anchorId: current.anchorId },
        to,
        'effect',
      ).clear
    )
      continue
    result.clear = false
    result.blockerIds.push(e.id)
    result.reasons.push(
      visual
        ? e.obscurity === 'heavy'
          ? '浓雾造成重度遮蔽'
          : '魔法黑暗阻断视觉'
        : '场景效果阻断' + channel,
    )
  }
  return result
}
