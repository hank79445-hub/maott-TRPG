import {projectM5,type M5View} from './m5-view'
import {MAGIC_RULES} from './scene-magic-rules'
import {containerPlace,batchPlace} from './scene-supplies'
import { TERRAIN_RULES } from './scene-terrain-rules'
import { sceneQueryCache } from './scene-query-cache'
import type { Adventure, MapScene, MapToken, MapWorld } from './map-types'
import type { Catalogue } from './engine'
import type { SceneGeometry } from '../persistence/scene-effects-schema'
import { anchoredGeometry, tokenPoint } from './scene-effects'
import { sceneIllumination, sceneVision } from './scene-lighting'
import { regionContains } from './scene-propagation'
import { tokenM3State, tokenPerception, m3PerceptionCache } from './m3-map-perception'
import { sceneCenter } from './scene-effect-geometry'
import { geometryCellBounds } from './geometry-cell-bounds'
type RegionStroke={a:{x:number;y:number};b:{x:number;y:number};width:number}
export interface SceneEffectView {
  id: string
  name: string
  spellId: string
  covered: boolean
  sourceId?: string
  endsAt?: number
  requiresGeometry: boolean
  concentration: boolean
  coverable: boolean
  anchorOwned?: boolean
  geometry?: SceneGeometry
  labelPosition?: { x: number; y: number }
  color: string
  pattern: 'rays' | 'fog' | 'dark' | 'hazard'
  groundOnly?: boolean
  groundHeight?: number
  movementMultiplier?: number
  cells: string[]
  cellsByObserver?: Record<string, string[]>
  strokes?: RegionStroke[]
  strokesByObserver?: Record<string, RegionStroke[]>
}
export interface SceneLightingView {
  observerId: string
  runs: { x: number; y: number; length: number; kind: 'bright' | 'dim' | 'dark' | 'sunlight' }[]
}
export interface SceneMapEffects {
  m5?:M5View
  supplies?:{containers:{id:string;name:string;open:boolean;waterCapacity:number;foodCapacity:number}[];batches:{id:string;kind:'water'|'food';units:number;containerId?:string;appearance:string;rotten:boolean;point?:{x:number;y:number;height:number}}[]}
  regions: SceneEffectView[]
  lighting: SceneLightingView[]
  routes?: { id: string; entityId: string; steps: number }[]
  waiting?: string[]
}
export function scenePointVisible(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  observers: MapToken[],
  p: {
    x: number
    y: number
    height?: number
    layer?: import('./m3-spatial').SpaceLayer
    anchorId?: string
  },
  cat: Catalogue,
) {
  if (
    !a.sceneEffects?.regions.some(
      (e) =>
        e.status === 'active' && (anchoredGeometry(world, a, e)?.scene.id ?? e.sceneId) === s.id,
    )
  )
    if ((a.m3?.environments.find(f => f.sceneId === s.id)?.light ?? 'bright') === 'bright') return true
  const to = {
    x: p.x + 0.5,
    y: p.y + 0.5,
    height: p.height ?? 0,
    layer: p.layer ?? 'material',
    anchorId: p.anchorId,
  }
  return observers.some((t) => {
    const sense = tokenM3State(world, a, t, cat),
      vision = sceneVision(world, a, s, tokenPoint(t), to, sense)
    return (
      (vision.ray.clear && vision.illuminated && !sense.blinded) ||
      (vision.ray.clear &&
        sense.blindsight > 0 &&
        Math.max(
          Math.abs(to.x - tokenPoint(t).x) * s.grid.feet,
          Math.abs(to.y - tokenPoint(t).y) * s.grid.feet,
          Math.abs(to.height - tokenPoint(t).height),
        ) <= sense.blindsight)
    )
  })
}
/** Deliberately explicit projection: no cast IDs, GM notes, hidden sources,
 * source clocks, event receipts or material inventories enter this payload. */
export function projectSceneEffects(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  cat: Catalogue,
  gm: boolean,
  observers: MapToken[],
): SceneMapEffects {
  const cache = sceneQueryCache(),
    senseCache = new Map<string, ReturnType<typeof tokenM3State>>()
  const supplies=a.sceneEffects?.supplies
  const visibleSupply=(p:{x:number;y:number;height:number;sceneId:string;ownerId?:string})=>p.sceneId===s.id&&(gm||p.ownerId?gm||observers.some(t=>t.characterId===p.ownerId):scenePointVisible(world,a,s,observers,{...p,x:p.x-.5,y:p.y-.5},cat))
  const containers=(supplies?.containers??[]).filter(c=>{try{const object=a.m3?.entities.find(o=>o.id===c.objectId);return (gm||!c.hidden&&!object?.hidden&&(!c.groundItemId||!s.groundItems?.find(g=>g.id===c.groundItemId)?.hidden))&&visibleSupply(containerPlace(world,a,c))}catch{return false}}).map(c=>({id:c.id,name:c.name,open:c.open,waterCapacity:c.waterCapacity,foodCapacity:c.foodCapacity}))
  const publicSupplies={containers,batches:(supplies?.batches??[]).filter(b=>{try{const object=a.m3?.entities.find(o=>o.id===(b.liquidId??b.pileId));return (gm||!b.hidden&&!object?.hidden)&&(b.containerId?containers.some(c=>c.id===b.containerId&&(gm||c.open||observers.some(t=>t.characterId===containerPlace(world,a,supplies!.containers.find(c=>c.id===b.containerId)!).ownerId))):visibleSupply(batchPlace(world,a,b)))}catch{return false}}).map(b=>({id:b.id,kind:b.kind,units:b.units,containerId:b.containerId,appearance:b.appearance,rotten:b.rotten,...(!b.containerId?{point:{x:batchPlace(world,a,b).x-.5,y:batchPlace(world,a,b).y-.5,height:batchPlace(world,a,b).height}}:{})}))}
  const sense = (t: MapToken) => {
    let v = senseCache.get(t.id)
    if (!v) {
      v = tokenM3State(world, a, t, cat)
      senseCache.set(t.id, v)
    }
    return v
  }
  const active = (a.sceneEffects?.regions ?? []).filter(
    (e) =>
      e.status === 'active' &&
      (anchoredGeometry(world, a, e, cache)?.scene.id ?? e.sceneId) === s.id,
  )
  const routes = (a.sceneEffects?.routes ?? [])
    .filter(
      (r) =>
        r.sceneId === s.id &&
        r.status === 'paused' &&
        (gm ||
          observers.some((t) => [t.id, t.characterId, t.actorId, t.npcId].includes(r.entityId))),
    )
    .map((r) => ({ id: r.id, entityId: r.entityId, steps: r.path.length }))
  const waiting = [
    ...new Set(
      (a.sceneEffects?.hazards ?? [])
        .filter(
          (h) =>
            h.status === 'pending' &&
            h.sceneId === s.id &&
            (gm ||
              observers.some((t) =>
                [t.id, t.characterId, t.actorId, t.npcId].includes(h.entityId),
              )),
        )
        .map((h) => h.entityId),
    ),
  ]
  if (!active.length && ((a.m3?.environments.find(f => f.sceneId === s.id)?.light ?? 'bright') === 'bright' || s.fog?.mode === 'enclosed')) return { regions: [], lighting: [], routes, waiting,m5:projectM5(world,a,s,gm,observers),...(supplies?{supplies:publicSupplies}:{}) }
  const regions: SceneEffectView[] = active
    .filter(
      (e) =>
        gm ||
        !e.hidden ||
        observers.some(t=>[t.id,t.characterId,t.npcId,t.actorId].includes(e.sourceId)) ||
        (e.anchor.kind === 'inventory' &&
          observers.some((t) => t.characterId === e.anchor.ownerId)),
    )
    .map((e): SceneEffectView => {
      const current = anchoredGeometry(world, a, e, cache),
        own = observers.some((t) => [t.characterId, t.npcId, t.actorId, t.id].includes(e.sourceId)),
        held =
          e.anchor.kind === 'inventory' &&
          observers.some((t) => t.characterId === e.anchor.ownerId),
        geometry = current?.geometry
      const cells: string[] = [],
        cellsByObserver: Record<string, string[]> = {}
      const strokes:RegionStroke[]=[],strokesByObserver:Record<string,RegionStroke[]>={}
      const floor = a.m3?.environments.find((f) => f.sceneId === s.id)?.floorHeight ?? 0
      for (const observer of gm ? [undefined] : observers.length ? observers : [undefined]) {
        if (
          !gm &&
          e.spellId === 'spike-growth' &&
          (!observer ||
            !e.terrain?.knownTo.includes(
              observer.characterId ?? observer.npcId ?? observer.actorId ?? observer.id,
            ))
        )
          continue
        const height = observer?.spatial?.height ?? floor,
          output: string[] = []
        const visible = (x: number, y: number) => {
          if (gm) return true
          if (!observer) return false
          const senses = sense(observer),
            vision = sceneVision(
              world,
              a,
              s,
              tokenPoint(observer),
              {
                x: x + 0.5,
                y: y + 0.5,
                height,
                layer: observer?.spatial?.layer ?? 'material',
                anchorId: observer?.spatial?.anchorId,
              },
              senses,
              cache,
            )
          return (
            vision.ray.clear &&
            vision.illuminated &&
            (!senses.blinded ||
              (senses.blindsight > 0 &&
                Math.max(
                  Math.abs(observer.x - x) * s.grid.feet,
                  Math.abs(observer.y - y) * s.grid.feet,
                  Math.abs((observer.spatial?.height ?? 0) - height),
                ) <= senses.blindsight))
          )
        }
        const visibleStrokes:RegionStroke[]=[]
        if(geometry?.shape==='wall'&&!e.covered) {
          for(let i=1;i<(geometry.points?.length??0);i++) {
            const a=geometry.points![i-1]!,b=geometry.points![i]!,count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2))
            for(let j=0;j<count;j++) {
              const mid={x:a.x+(b.x-a.x)*(j+.5)/count,y:a.y+(b.y-a.y)*(j+.5)/count}
              if((gm||height>=a.height&&height<=a.height+geometry.heightFeet)&&visible(mid.x-.5,mid.y-.5))
                visibleStrokes.push({a:{x:a.x+(b.x-a.x)*j/count,y:a.y+(b.y-a.y)*j/count},b:{x:a.x+(b.x-a.x)*(j+1)/count,y:a.y+(b.y-a.y)*(j+1)/count},width:geometry.width/s.grid.feet})
            }
          }
        }
        if(observer)strokesByObserver[observer.id]=visibleStrokes
        strokes.push(...visibleStrokes)
        const bounds = geometry && geometryCellBounds(geometry,s.grid.feet,s.grid.columns,s.grid.rows)
        if (geometry && bounds && !e.covered)
          for (let y = bounds.minY; y <= bounds.maxY; y++)
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
              const point = {
                x: x + 0.5,
                y: y + 0.5,
                height,
                layer: observer?.spatial?.layer ?? 'material',
                anchorId: observer?.spatial?.anchorId,
              }
              if (!regionContains(world, a, s, e, point, cache)) continue
              if (
                e.terrain?.excludedCells.includes(`${x},${y}`) ||
                (e.spellId === 'plant-growth' &&
                  (e.terrain?.enrichment || !e.terrain?.plantCells.includes(`${x},${y}`)))
              )
                continue
              let seen = visible(x, y)
              if (!seen && observer && e.obscurity !== 'none') {
                // Show only the perceivable front surface, not the full cloud behind it.
                const from = tokenPoint(observer),
                  dx = from.x - point.x,
                  dy = from.y - point.y,
                  len = Math.hypot(dx, dy),
                  near = {
                    x: point.x + (len ? (dx / len) * 0.72 : 0),
                    y: point.y + (len ? (dy / len) * 0.72 : 0),
                    height,
                    layer: point.layer,
                    anchorId: point.anchorId,
                  }
                seen =
                  !regionContains(world, a, s, e, near, cache) &&
                  visible(near.x - 0.5, near.y - 0.5)
              }
              if (seen) output.push(`${x},${y}`)
            }
        if (observer) cellsByObserver[observer.id] = output
        cells.push(...output)
      }
      // Player geometry can otherwise reveal blocked corners/hidden light positions.
      const lightCenter = e.light && geometry ? sceneCenter(geometry) : undefined
      const anchorObject = e.anchor.kind === 'object' ? a.m3?.entities.find(o => o.id === e.anchor.id) : undefined
      const anchorToken = ['creature', 'inventory'].includes(e.anchor.kind) ? s.tokens.find(t => [t.id,t.characterId,t.npcId,t.actorId].includes(e.anchor.ownerId ?? e.anchor.id)) : undefined
      const knownAnchor = held || !e.hidden && (e.anchor.kind === 'point' ||
        !!anchorObject && !anchorObject.hidden && !anchorObject.effects?.some(f => f.key === 'invisibility' || f.condition === 'invisible' || f.conditions?.includes('invisible')) ||
        !!anchorToken && observers.some(t => tokenPerception(world,a,s,t,anchorToken,cat,false,m3PerceptionCache()).canSee))
      const labelPosition = lightCenter && (gm || knownAnchor && scenePointVisible(world, a, s, observers, { x: lightCenter.x - .5, y: lightCenter.y - .5, height: lightCenter.height, layer: current?.layer, anchorId: current?.anchorId }, cat))
        ? { x: lightCenter.x, y: lightCenter.y } : undefined
      return {
        id: e.id,
        name: e.name,
        spellId: e.spellId,
        covered: e.covered,
        requiresGeometry: e.requiresGeometry,
        concentration: e.concentration,
        coverable: ['object', 'inventory'].includes(e.anchor.kind),
        anchorOwned: held,
        color:
          MAGIC_RULES[e.spellId]?.color ?? TERRAIN_RULES[e.spellId]?.color ??
          e.light?.color ??
          (e.obscurity === 'heavy' ? '#9db7bd' : e.obscurity !== 'none' ? '#121523' : '#98683e'),
        pattern: e.light
          ? 'rays'
          : e.obscurity === 'heavy'
            ? 'fog'
            : e.obscurity !== 'none'
              ? 'dark'
              : 'hazard',
        ...(labelPosition ? { labelPosition } : {}),
        ...(e.terrain
          ? {
              movementMultiplier: e.terrain.multiplier,
              groundOnly: e.terrain.groundOnly,
              groundHeight: e.geometry?.height,
            }
          : {}),
        cells: [...new Set(cells)],
        ...(strokes.length?{strokes}:{}),
        ...(!gm?{strokesByObserver}:{}),
        ...(gm ? { geometry } : { cellsByObserver }),
        ...(gm || own ? { sourceId: e.sourceId, endsAt: e.endsAt } : {}),
      }
    })
    .filter(
      (e) =>
        gm ||
        e.cells.length > 0 ||
        !!e.strokes?.length ||
        !!e.sourceId ||
        e.anchorOwned ||
        (e.covered &&
          observers.some((t) => {
            const original = active.find((row) => row.id === e.id),
              g = original && anchoredGeometry(world, a, original, cache)
            if (!g) return false
            const v = sceneVision(
              world,
              a,
              s,
              tokenPoint(t),
              {
                x: g.geometry.x + 0.5,
                y: g.geometry.y + 0.5,
                height: g.geometry.height,
                layer: g.layer,
                anchorId: g.anchorId,
              },
              sense(t),
              cache,
            )
            return (
              v.ray.clear &&
              v.illuminated &&
              (!sense(t).blinded ||
                (sense(t).blindsight > 0 &&
                  Math.max(
                    Math.abs(t.x - g.geometry.x) * s.grid.feet,
                    Math.abs(t.y - g.geometry.y) * s.grid.feet,
                    Math.abs((t.spatial?.height ?? 0) - g.geometry.height),
                  ) <= sense(t).blindsight))
            )
          })),
    )
  const lighting: SceneLightingView[] = []
  if (!active.some((e) => e.light || e.obscurity !== 'none') && (a.m3?.environments.find(f => f.sceneId === s.id)?.light ?? 'bright') === 'bright') return { regions, lighting,m5:projectM5(world,a,s,gm,observers),...(supplies?{supplies:publicSupplies}:{}) }
  for (const observer of gm ? [undefined] : observers.length ? observers : [undefined]) {
    const senses = observer ? sense(observer) : {},
      height = observer?.spatial?.height ?? 0,
      runs: SceneLightingView['runs'] = []
    for (let y = 0; y < s.grid.rows; y++)
      for (let x = 0; x < s.grid.columns; x++) {
        const p = {
            x: x + 0.5,
            y: y + 0.5,
            height,
            layer: observer?.spatial?.layer ?? 'material',
            anchorId: observer?.spatial?.anchorId,
          },
          light = sceneIllumination(world, a, s, p, cache),
          vision = observer
            ? sceneVision(world, a, s, tokenPoint(observer), p, senses, cache)
            : undefined
        const kind: SceneLightingView['runs'][number]['kind'] =
          !gm && vision && (!vision.ray.clear || !vision.illuminated)
            ? 'dark'
            : light.sunlight
              ? 'sunlight'
              : light.level
        const last = runs.at(-1)
        if (last?.kind === kind && last.y === y && last.x + last.length === x) last.length++
        else runs.push({ x, y, length: 1, kind })
      }
    lighting.push({ observerId: observer?.id ?? '', runs })
  }
  return { routes, waiting, regions, lighting,m5:projectM5(world,a,s,gm,observers),...(supplies?{supplies:publicSupplies}:{}) }
}
