export interface DieFace {
  sides: number
  value: number
  label: string
  source?: 'gm' | 'automatic'
}
export interface DiceOutcome {
  label: string
  dice: number[]
  total: number
  bonus?: number
  chosen?: number
  mode?: string
  reasons?: string[]
  damageType?: string
}
export class DiceRequired extends Error {
  constructor(
    public sides: number[],
    public label: string,
    public rolls: DieFace[],
  ) {
    super('等待 GM 录入实体骰')
  }
}
interface Source {
  values: DieFace[]
  cursor: number
  rolls: DieFace[]
  outcomes: DiceOutcome[]
  manual: boolean
  label: string
}
let active: Source | undefined
export const manualDiceActive = () => active?.manual === true
export const diceTraceCount = () => active?.rolls.length ?? 0
export function secureDie(sides: number) {
  if (!Number.isInteger(sides) || sides < 2 || sides > 100) throw Error('无效骰子')
  const limit = 2 ** 32 - (2 ** 32 % sides),
    data = new Uint32Array(1)
  do {
    crypto.getRandomValues(data)
  } while (data[0]! >= limit)
  return (data[0]! % sides) + 1
}
/** Scope is synchronous, restored even if a reducer throws. No async work may run inside it. */
export function withDiceSource<T>(manual: boolean, values: DieFace[], fn: () => T) {
  const previous = active,
    state: Source = { values, cursor: 0, rolls: [], outcomes: [], manual, label: '规则骰' }
  active = state
  try {
    const value = fn()
    if (state.cursor < values.length)
      throw Error(`存在未被规则使用的骰值（已用 ${state.cursor}／${values.length}）`)
    return { value, rolls: state.rolls, outcomes: state.outcomes }
  } finally {
    active = previous
  }
}
export function prepareDice(
  count: number,
  sides: number,
  label: string,
  source?: (n: number) => number,
) {
  if (source && source !== sourcedDie) return
  if (!active) return
  active.label = label
  if (active.manual && active.values.length - active.cursor < count)
    throw new DiceRequired(
      Array.from(
        { length: Math.min(100, count - Math.max(0, active.values.length - active.cursor)) },
        () => sides,
      ),
      label,
      [...active.rolls],
    )
}
export function recordDiceOutcome(outcome: DiceOutcome, source: (n: number) => number) {
  if (active && source === sourcedDie) active.outcomes.push(outcome)
}
export function annotateDamageRoll(
  type: string,
  roll: {
    dice: number[]
    total: number
    flat: number
    formula: string
    rerolls?: { from: number; to: number; reason: string }[]
  },
) {
  const o = active?.outcomes.find((o) => o.dice === roll.dice)
  if (o) {
    o.damageType = type
    o.total = roll.total
    o.bonus = roll.flat
    o.label = '伤害／治疗 ' + roll.formula
    if (roll.rerolls?.length) o.reasons = roll.rerolls.map((r) => `${r.reason}：${r.from}→${r.to}`)
  }
}
export function sourcedDie(sides: number): number {
  if (!active) return secureDie(sides)
  if (active.rolls.length >= 1000) throw Error('本次规则骰数量超过上限')
  const saved = active.values[active.cursor]
  if (!saved && active.manual) throw new DiceRequired([sides], active.label, [...active.rolls])
  if (
    saved &&
    (saved.sides !== sides ||
      !Number.isInteger(saved.value) ||
      saved.value < 1 ||
      saved.value > sides)
  )
    throw Error('骰值与当前规则骰组不匹配')
  const value = saved?.value ?? secureDie(sides)
  active.cursor++
  active.rolls.push({
    sides,
    value,
    label: active.label,
    source: saved?.source ?? (active.manual ? 'gm' : 'automatic'),
  })
  return value
}
