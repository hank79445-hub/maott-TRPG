import type { ActiveEffect, Ability, Spell } from './types'
import type { DamageType } from './combat-types'
import { appliedEffects } from './effects'
import { restoreCondition } from './support-spells'
export const RESTORATION_BUFFS = [
  'aid','beacon-of-hope','heroism','shield-of-faith','mage-armor','barkskin',
  'protection-from-poison','protection-from-energy','enhance-ability',
  'bless','bane','longstrider','feign-death',
  'sanctuary',
] as const
export const hpSpellBonus = (effects: ActiveEffect[]) => appliedEffects(effects).reduce((n,e)=>n+(e.hpBonus??0),0)
export function restorationBuff(spellId: string, slot: number, choice: string | undefined, modifier: number): Partial<ActiveEffect> | null {
  switch (spellId) {
    case 'feign-death': return {conditions:['blinded','incapacitated'],speedZero:true,conditionImmunities:['poisoned']}
    case 'aid': return {hpBonus:5*Math.max(1,slot-1)}
    case 'beacon-of-hope': return {saveAdvantage:['wis'],deathSaveAdvantage:true,maximizeHealing:true}
    case 'heroism': return {conditionImmunities:['frightened'],note:String(Math.max(0,modifier))}
    case 'shield-of-faith': return {acBonus:2}
    case 'mage-armor': return {acBase:13}
    case 'barkskin': return {acFloor:17}
    case 'protection-from-poison': return {damageResistances:['poison'],savePurposeAdvantage:['poison']}
    case 'protection-from-energy': return {damageResistances:[choice as DamageType]}
    case 'enhance-ability': return {checkAdvantage:choice as Ability}
    case 'bless': return {attackDie:4,saveDie:4}
    case 'bane': return {attackDie:-4,saveDie:-4}
    case 'longstrider': return {speedBonus:10}
    default:return null
  }
}
export function validateRestorationChoice(id: string, choice?: string, willing?: boolean) {
  if (id === 'protection-from-energy' && !['acid','cold','fire','lightning','thunder'].includes(choice??''))
    throw Error('防护能量须选择强酸、寒冷、火焰、闪电或雷鸣')
  if (id === 'enhance-ability' && !['str','dex','int','wis','cha'].includes(choice??''))
    throw Error('2024强化属性须选择力量、敏捷、智力、感知或魅力，不含体质')
  if (['heroism','mage-armor','barkskin','protection-from-energy','protection-from-evil-and-good','warding-bond','feign-death'].includes(id) && willing !== true)
    throw Error('此法术须确认受术者自愿')
}
export function addRestorationBuff(
  state: {hp:number;conditions:string[];effects:ActiveEffect[]}, spell:Spell,
  effect:ActiveEffect, slot:number, choice:string|undefined, modifier:number,
) {
  const config = restorationBuff(spell.id,slot,choice,modifier)
  if (!config) return false
  const before = hpSpellBonus(state.effects)
  if (spell.id === 'protection-from-poison') restoreCondition(state,'poisoned')
  state.effects = state.effects.filter(e=>!(e.key===spell.id&&e.sourceId===effect.sourceId))
  state.effects.push({...effect,...config})
  // Aid raises current HP only by the newly effective increase, never by recasting the same strength.
  if (spell.id === 'aid') state.hp += Math.max(0,hpSpellBonus(state.effects)-before)
  return true
}

export const maximizesHealing = (effects:ActiveEffect[]) => appliedEffects(effects).some(e=>e.maximizeHealing)
/** Maximize only the dice in an actual healing roll; flat modifiers remain unchanged. */
export function healingRollTotal(effects: ActiveEffect[], roll: import('./combat-types').DamageRoll) {
  if (!maximizesHealing(effects)) return roll.total
  const match = roll.formula.replace(/\s/g,'').match(/^(\d+)d(\d+)(?:[+-]\d+)?$/i)
  if (!match) return roll.total
  return Number(match[1])*Number(match[2])+roll.flat
}
