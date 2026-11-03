import type { DiceRecord } from '../../online/dice-types'
export function percentileFaces(value: number): [string, string] {
  if (!Number.isInteger(value) || value < 1 || value > 100) throw Error('d100骰值无效')
  return [
    value === 100 ? '00' : String(Math.floor(value / 10) * 10).padStart(2, '0'),
    String(value % 10),
  ]
}
export function freshDiceRecords(records: DiceRecord[], seen: Set<string>, initial: boolean) {
  const fresh = initial ? [] : records.filter((r) => !seen.has(r.id))
  for (const r of records) seen.add(r.id)
  return fresh
}
