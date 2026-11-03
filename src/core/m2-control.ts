import type {ActiveEffect} from './types'
import type {DamagePart} from './combat-types'
import {prepareDice} from './dice-source'
/** Shared initial control data. Timing and action enforcement remain in authoritative engines. */
export function m2ControlEffect(id:string,dc:number):Partial<ActiveEffect>|null{
 if(id==='enthrall')return {visibility:'owner',note:'注目术：感知（察觉）检定与被动察觉−10；没有魅惑或失能'}
 if(id==='slow')return {acBonus:-2,noReaction:true,repeatSave:{ability:'wis',dc},visibility:'public'}
 if(id==='ray-of-enfeeblement')return {repeatSave:{ability:'con',dc},visibility:'public'}
 return null
}
export const slowed=(effects:readonly ActiveEffect[])=>effects.some(e=>e.key==='slow'&&e.spellId==='slow')
export const enfeebled=(effects:readonly ActiveEffect[])=>effects.some(e=>e.key==='ray-of-enfeeblement')
export function reduceEnfeebled(roll:DamagePart['roll'],effects:readonly ActiveEffect[],dice:(n:number)=>number){
 if(enfeebled(effects)&&roll.dice.length){
  prepareDice(1,8,'衰弱射线：伤害骰减值',dice)
  const n=dice(8);if(!Number.isInteger(n)||n<1||n>8)throw Error('衰弱射线需要有效d8骰面')
  roll.total=Math.max(0,roll.total-n);roll.flat-=n;roll.formula+=' -1d8['+n+']（衰弱射线）'
 }
 return roll
}
