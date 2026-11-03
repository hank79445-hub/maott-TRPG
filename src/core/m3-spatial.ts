import type { ActiveEffect } from './types'
import { appliedEffects } from './effects'
import {slowed} from './m2-control'

export type SpaceLayer = 'material' | 'ethereal' | 'pocket' | 'stone'
export type MovementMode = 'walk' | 'climb' | 'swim' | 'fly' | 'levitate'
export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'
export interface SpatialState {
  returnOrigin?:{x:number;y:number;height:number;layer:SpaceLayer}
  fallUsedAt?:string
  liftKind?:'levitate'|'fly'
  height: number
  layer: SpaceLayer
  anchorId?: string
  supportId?: string
}
export interface M3EffectState {
  naturalDamageType?:'bludgeoning'|'piercing'|'slashing'
  option?: 'aquatic' | 'appearance' | 'weapons' | 'enlarge' | 'reduce' | 'mask' | 'false-aura'
  description?: string
  creatureType?: import('./m3-magic-perception').CreatureType
  school?: string
  magical?: boolean
  images?: number
  withinAura?:boolean
  lastTurn?: string
  origin?: { x: number; y: number; height: number; layer: SpaceLayer }
  sourceSize?: CreatureSize
}
export interface SpatialCapabilities {
  walk: number; climb: number; swim: number; fly: number; levitate:number; hover: boolean
  noTracks:boolean;waterBreathing: boolean; waterWalk: boolean; handsFreeClimb: boolean
  darkvision: number; seeInvisible: boolean; seeEthereal: boolean
  size: CreatureSize; cannotSpeak: boolean; cannotManipulate: boolean
}
const sizes: CreatureSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']
/** Input walk already includes ordinary additions, exhaustion and Slow. Fixed
 * movement and Speed-derived movement deliberately follow different paths. */
export function spatialCapabilities(
  base: { walk: number; climb?: number; swim?: number; fly?: number; hover?: boolean; waterBreathing?:boolean; handsFreeClimb?:boolean; darkvision?: number; size?: string; derivedModes?:boolean; speedPenalty?:number },
  raw: ActiveEffect[], blocked = false,
): SpatialCapabilities {
  const effects = appliedEffects(raw), has = (key: string) => effects.some(f => f.key === key)
  const gas = has('gaseous-form'), haste = has('haste'), lethargy = has('haste-lethargy')
  const factor = haste ? 2 : 1
  let walk = Math.max(0, base.walk) * factor
  // 2024 Speed glossary: temporary changes also affect every existing special speed.
  // Walking-derived class speeds have already received these changes in runtimeDerived.
  const change=effects.reduce((n,e)=>n+(e.speedBonus??0)-(e.speedPenalty??0),0)-(base.speedPenalty??0)
  const special=(speed:number)=>Math.max(0,speed+change)/(slowed(effects)?2:1)*factor
  let climb = base.derivedModes ? Math.max(0,base.climb??0)*factor : (base.climb??0)>0?special(base.climb!):0
  let swim = base.derivedModes ? Math.max(0,base.swim??0)*factor : (base.swim??0)>0?special(base.swim!):0
  let fly = base.derivedModes ? Math.max(0,base.fly??0)*factor : (base.fly??0)>0?special(base.fly!):0
  if (has('spider-climb')) climb = Math.max(climb, walk)
  if (effects.some(f => f.key === 'alter-self' && f.m3?.option === 'aquatic')) swim = Math.max(swim, walk)
  if (has('fly')) fly = Math.max(fly, special(60))
  if (gas) { walk = climb = swim = 0; fly = special(10) }
  let levitate=has('levitate')?walk:0
  if (has('levitate')) walk = swim = fly = 0
  if (blocked || lethargy) walk = climb = swim = fly = levitate = 0
  const sizeIndex = Math.max(0, sizes.indexOf((base.size ?? 'medium') as CreatureSize))
  const enlargement = effects.find(f => f.key === 'enlarge-reduce')
  const size = sizes[Math.max(0, Math.min(sizes.length - 1, sizeIndex + (enlargement ? enlargement.m3?.option === 'reduce' ? -1 : 1 : 0)))]!
  return {
    walk, climb, swim, fly, levitate,hover: gas || has('fly') || !!base.hover,
    noTracks:has('pass-without-trace'),handsFreeClimb: !!base.handsFreeClimb||has('spider-climb'),
    waterBreathing: !!base.waterBreathing||has('water-breathing') || effects.some(f => f.key === 'alter-self' && f.m3?.option === 'aquatic'),
    waterWalk: has('water-walk'), darkvision: Math.max(base.darkvision ?? 0, has('darkvision') ? 150 : 0),
    seeInvisible: has('see-invisibility'), seeEthereal: has('see-invisibility'), size,
    cannotSpeak: gas, cannotManipulate: gas,
  }
}
export const spatialState = (state?: SpatialState): SpatialState => state ?? { height: 0, layer: 'material' }
export function spatialDistance(a: { x: number; y: number; spatial?: SpatialState }, b: { x: number; y: number; spatial?: SpatialState }, feet = 5) {
  return Math.max(Math.abs(a.x - b.x) * feet, Math.abs(a.y - b.y) * feet, Math.abs(spatialState(a.spatial).height - spatialState(b.spatial).height))
}
export interface PerceptionResult {
  locationKnown: boolean; canSee: boolean; canPerceive: boolean; sameInteractionSpace: boolean; reasons: string[]
}
/** All geometry and location knowledge must be supplied by the authoritative
 * map/context caller; a special sense never overrides a solid obstruction. */
export function spatialPerception(input: {
  observer: { spatial?: SpatialState; effects: ActiveEffect[]; blinded?: boolean; blindsight?: number; truesight?: number;darkvision?:number }
  target: { spatial?: SpatialState; effects: ActiveEffect[]; gmHidden?: boolean; invisible?:boolean }
  distance: number; lineOfSight: boolean; locationKnown: boolean; illuminated?: boolean; magicalDarkness?:boolean
}): PerceptionResult {
  const { observer: o, target: t, distance, lineOfSight } = input
  const oe = appliedEffects(o.effects), te = appliedEffects(t.effects)
  const os = spatialState(o.spatial), ts = spatialState(t.spatial)
  const sameInteractionSpace = os.layer === ts.layer && (os.layer !== 'pocket' && os.layer !== 'stone' || os.anchorId === ts.anchorId)
  const cap = spatialCapabilities({ walk: 0,darkvision:o.darkvision }, oe)
  // Blindsight itself works when blinded. A zero range is never a real sense.
  const blindSense = (o.blindsight ?? 0) > 0 && (o.blindsight ?? 0) >= distance
  const trueSense = (o.truesight ?? 0) > 0 && (o.truesight ?? 0) >= distance
  const outlined = te.some(f => ['faerie-fire', 'starry-wisp'].includes(f.key))
  const invisible = (t.invisible||te.some(f => f.condition === 'invisible' || f.conditions?.includes('invisible') || f.key === 'invisibility')) && !outlined
  const layerVisible = sameInteractionSpace || os.layer === 'material' && ts.layer === 'ethereal' && (cap.seeEthereal || trueSense)
    || os.layer === 'ethereal' && ts.layer === 'material' && distance <= 60
  const stone = os.layer === 'stone' || ts.layer === 'stone'
  const visible = !t.gmHidden && !stone && layerVisible && lineOfSight &&
    (blindSense || !o.blinded && (input.illuminated !== false || !input.magicalDarkness && cap.darkvision > 0 && cap.darkvision >= distance || trueSense) && (!invisible || cap.seeInvisible || trueSense))
  const reasons: string[] = []
  if (t.gmHidden) reasons.push('GM隐藏')
  if (!lineOfSight) reasons.push('实体阻隔')
  if (!layerVisible || stone) reasons.push('空间层阻隔')
  if (invisible && !cap.seeInvisible && !trueSense && !blindSense) reasons.push('不可见目标')
  return { locationKnown: !t.gmHidden && (visible || input.locationKnown && sameInteractionSpace), canSee: visible,
    canPerceive: !t.gmHidden && !stone && layerVisible && (visible || input.locationKnown && sameInteractionSpace), sameInteractionSpace, reasons }
}
