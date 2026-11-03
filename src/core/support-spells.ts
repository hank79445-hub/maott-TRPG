import { SKILLS, type ActiveEffect } from './types'
import { DAMAGE_NAMES, type DamageType } from './combat-types'
import { appliedEffects } from './effects'
import { prepareDice, recordDiceOutcome } from './dice-source'
import { validateRestorationChoice } from './spell-restoration'

export const SUPPORT_SPELLS = ['guidance', 'resistance', 'lesser-restoration'] as const
export const RESTORABLE_CONDITIONS = ['blinded', 'deafened', 'paralyzed', 'poisoned'] as const
export const RESISTANCE_TYPES: DamageType[] = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'radiant',
  'slashing',
  'thunder',
]
export interface SupportSpellChoice {
  supportChoice?: string
  willing?: boolean
}
export function validateSupportSpell(id: string, choice: SupportSpellChoice) {
  if(id==='command'&&!['approach','drop','flee','grovel','halt'].includes(choice.supportChoice??''))throw Error('命令术须选择接近、丢弃、逃跑、趴下或止步之一')
  validateRestorationChoice(id, choice.supportChoice, choice.willing)
  if (id === 'blindness-deafness' && !['blinded', 'deafened'].includes(choice.supportChoice ?? ''))
    throw Error('目盲术／耳聋术须明确选择目盲或耳聋')
  if (id === 'guidance' && !Object.hasOwn(SKILLS, choice.supportChoice ?? ''))
    throw Error('神导术须选择一项有效技能')
  if (id === 'resistance' && !RESISTANCE_TYPES.includes(choice.supportChoice as DamageType))
    throw Error('抵抗术须选择条文允许的伤害类型（不含力场、心灵）')
  if (
    id === 'lesser-restoration' &&
    !RESTORABLE_CONDITIONS.includes(choice.supportChoice as (typeof RESTORABLE_CONDITIONS)[number])
  )
    throw Error('次级复原术须选择目盲、耳聋、麻痹或中毒之一')
  if (['guidance', 'resistance'].includes(id) && choice.willing !== true)
    throw Error('神导术／抵抗术须确认受术者自愿')
}
/** Guidance is persistent for the selected skill; neither saves nor unrelated checks consume it. */
export function guidanceBonus(
  effects: ActiveEffect[],
  skill: string,
  dice: (sides: number) => number,
) {
  if (!appliedEffects(effects).some((e) => e.key === 'guidance' && e.supportChoice === skill))
    return 0
  prepareDice(1, 4, '神导术：所选技能加值', dice)
  const bonus = dice(4)
  if (!Number.isInteger(bonus) || bonus < 1 || bonus > 4) throw Error('神导术需要有效d4骰值')
  return bonus
}
/** One benefit per creature per turn, even across refreshes or different sources. */
export function resistanceReduction(
  effects: ActiveEffect[],
  type: DamageType,
  amount: number,
  turn: string,
  dice: (sides: number) => number,
  tracker?: { resistanceUsedTurn?: string | null },
  outsideTurn = turn,
) {
  const used = tracker?.resistanceUsedTurn
  if (
    used &&
    (used.startsWith(turn + '|') || (turn.startsWith('outside:') && used.endsWith('|' + turn)))
  )
    return 0
  if (amount <= 0 || effects.some((e) => e.key === 'resistance' && e.resistanceUsedTurn === turn))
    return 0
  const effect = appliedEffects(effects).find(
    (e) => e.key === 'resistance' && e.supportChoice === type,
  )
  if (!effect) return 0
  prepareDice(1, 4, '抵抗术：所选类型减伤', dice)
  const reduction = dice(4)
  if (!Number.isInteger(reduction) || reduction < 1 || reduction > 4)
    throw Error('抵抗术需要有效d4骰值')
  if (tracker) tracker.resistanceUsedTurn = turn + '|' + outsideTurn
  recordDiceOutcome({ label: '抵抗术减伤', dice: [reduction], total: reduction }, dice)
  for (const e of effects.filter((e) => e.key === 'resistance')) e.resistanceUsedTurn = turn
  return Math.min(amount, reduction)
}
/** Cure the chosen condition across direct and source effects, retaining unrelated conditions/benefits. */
export function restoreCondition(
  state: { conditions: string[]; effects: ActiveEffect[] },
  condition: string,
) {
  state.conditions = state.conditions.filter((c) => c !== condition)
  state.effects = state.effects.flatMap((effect) => {
    if (effect.condition !== condition && !effect.conditions?.includes(condition)) return [effect]
    const next = { ...effect }
    if (next.condition === condition) delete next.condition
    if (next.conditions) {
      next.conditions = next.conditions.filter((c) => c !== condition)
      if (!next.conditions.length) delete next.conditions
    }
    const residual =
      next.condition ||
      next.conditions?.length ||
      next.startDamage ||
      next.weapon ||
      next.acBonus ||
      next.acBase ||
      next.speedPenalty ||
      next.speedBonus ||
      next.attackDie ||
      next.saveDie ||
      next.attackAdvantage ||
      next.attackDisadvantage ||
      next.noReaction ||
      next.blocksHealing ||
      next.speedZero
    return residual ? [next] : []
  })
}

export function supportChoiceName(choice: string) {
  return (
    SKILLS[choice]?.name ??
    (DAMAGE_NAMES as Record<string, string>)[choice] ??
    (
      { blinded: '目盲', deafened: '耳聋', paralyzed: '麻痹', poisoned: '中毒' } as Record<
        string,
        string
      >
    )[choice] ??
    choice
  )
}
