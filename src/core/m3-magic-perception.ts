import type { ActiveEffect } from './types'
import { appliedEffects } from './effects'
export const CREATURE_TYPES=['aberration','beast','celestial','construct','dragon','elemental','fey','fiend','giant','humanoid','monstrosity','ooze','plant','undead'] as const
export type CreatureType=(typeof CREATURE_TYPES)[number]
export function magicalCreatureType(realType:string|undefined,effects:ActiveEffect[]){
  return appliedEffects(effects).find(f=>f.key==='arcanist-s-magic-aura'&&f.m3?.option==='mask')?.m3?.creatureType??realType
}
export function magicalAura(real:{magical:boolean;school?:string},effects:ActiveEffect[]){
  const aura=appliedEffects(effects).find(f=>f.key==='arcanist-s-magic-aura'&&f.m3?.option==='false-aura')?.m3
  return aura?{magical:!!aura.magical,...(aura.magical&&aura.school?{school:aura.school}:{})}:real
}
/** A self-targeted sense (See Invisibility, natural Truesight etc.) is not a
 * Divination spell targeting the protected creature or a scrying sensor. */
export function magicalPerceptionAllowed(effects:ActiveEffect[],method:'divination-target'|'scrying-sensor'|'ordinary-sense'|'self-divination-sense'){
  return !effects.some(f=>f.key==='nondetection')||!['divination-target','scrying-sensor'].includes(method)
}
