import type { ActiveEffect } from './types'
import type { M3EffectState } from './m3-spatial'
export type M3CastChoice = Pick<M3EffectState, 'option' | 'description' | 'creatureType' | 'school' | 'magical' | 'naturalDamageType'>
export const M3_NATIVE_SPELLS = [
  'longstrider','jump','expeditious-retreat','haste','blade-ward','blur','mirror-image',
  'darkvision','invisibility','see-invisibility','pass-without-trace','spider-climb',
  'fly','levitate','feather-fall','water-breathing','water-walk','alter-self',
  'enlarge-reduce','gaseous-form','blink','nondetection','arcanist-s-magic-aura',
] as const
export function validateM3Choice(id: string, choice?: M3CastChoice) {
  if (id === 'alter-self' && !['aquatic','appearance','weapons'].includes(choice?.option ?? '')) throw Error('变身术须选择水生适应、改变外观或天生武器')
  if (id === 'alter-self' && choice?.option === 'appearance' && !choice.description?.trim()) throw Error('请描述同体型、同基本构造的外观')
  if (id === 'enlarge-reduce' && !['enlarge','reduce'].includes(choice?.option ?? '')) throw Error('请选择变大或缩小')
  if (id === 'arcanist-s-magic-aura' && (choice?.option !== 'mask' || !choice.creatureType)) throw Error('生物灵光须明确伪装类型；物品灵光走物件入口')
}
/** Only server-owned constants become effect metadata. Cast input cannot set
 * mirror counts, duration, movement, ability modifiers or turn receipts. */
export function m3SpellEffect(id: string, choice?: M3CastChoice,ability?:import('./types').Ability): Partial<ActiveEffect> | null {
  if (!(M3_NATIVE_SPELLS as readonly string[]).includes(id)) return null
  validateM3Choice(id, choice)
  switch(id) {
    case 'longstrider': return { speedBonus: 10 }
    case 'jump': return { key:'jump-2024' }
    case 'haste': return { acBonus:2, saveAdvantage:['dex'] }
    case 'invisibility': return { condition:'invisible' }
    case 'mirror-image': return { m3:{ images:3 } }
    case 'gaseous-form': return { damageResistances:['bludgeoning','piercing','slashing'],conditionImmunities:['prone'],saveAdvantage:['str','dex','con'] }
    case 'enlarge-reduce': return { m3:{ option:choice!.option }, ...(choice!.option==='enlarge' ? {checkAdvantage:'str',saveAdvantage:['str'] as ActiveEffect['saveAdvantage']} : {}) }
    case 'alter-self': return {ability,m3:{option:choice!.option,description:choice!.description,naturalDamageType:choice!.naturalDamageType??'slashing'}}
    case 'arcanist-s-magic-aura': return {m3:{option:'mask',creatureType:choice!.creatureType}}
    default: return {}
  }
}

export function validateM3Willing(id:string,willing:boolean|undefined,otherTargets:boolean){if(otherTargets&&!willing&&['haste','jump','darkvision','fly','spider-climb','water-breathing','gaseous-form'].includes(id))throw Error('此2024法术要求受术者自愿，不能默认为非自愿目标生效')}
