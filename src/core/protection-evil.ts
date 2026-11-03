import type {ActiveEffect} from './types'
export const PROTECTED_TYPES=['aberration','celestial','elemental','fey','fiend','undead']
export const protectionBlocks=(effects:ActiveEffect[],type:string|undefined,sourceId?:string)=>
 (effects.some(e=>e.key==='protection-from-evil-and-good')&&PROTECTED_TYPES.includes(type??''))||effects.some(e=>e.protectedTypes?.includes(type??'')||!!sourceId&&e.protectedSourceIds?.includes(sourceId))
export const protectionSaveAdvantage=(effects:ActiveEffect[],effect:ActiveEffect)=>
 protectionBlocks(effects,effect.sourceCreatureType,effect.sourceId)&&[effect.condition,...effect.conditions??[]].some(c=>c==='charmed'||c==='frightened')
