import type { MapPoint } from './map-types'
/** Only the acting inventory is supplied. Never inspect or borrow party inventory. */
export function pointItemPlan(
  p: MapPoint,
  quantity: (id: string) => number,
  selected: string[] = [],
  confirmed = false,
  bypass = false,
  limits?: Record<string, number>,
) {
  const policy = p.itemUse
  if (!policy || ['open', 'resolved', 'disarmed'].includes(p.state))
    return { open: false, attempt: [], success: [] }
  if (p.consume) throw Error('新版物品条件与旧消耗条件不能同时配置')
  if (bypass) return { open: policy.effect === 'open', attempt: [], success: [] }
  if (new Set(selected).size !== selected.length) throw Error('所选物品重复')
  const eligible = policy.requirements.filter(
    (r) =>
      quantity(r.itemId) >= r.quantity && (r.mode === 'possess' || selected.includes(r.itemId)),
  )
  const valid =
    policy.match === 'all' ? eligible.length === policy.requirements.length : eligible.length > 0
  if (!valid) {
    if (policy.fallback === 'check') return { open: false, attempt: [], success: [] }
    throw Error('物品条件未满足；请核对本人背包、数量及所选物品，或申请GM裁定')
  }
  const rows = policy.match === 'all' ? eligible : eligible.filter((r) => r.mode !== 'possess')
  if (policy.match === 'any' && rows.length > 1) throw Error('任选条件请只选择一种使用物品')
  const chosen = policy.match === 'any' ? (rows.length ? rows : [eligible[0]!]) : rows
  if (!confirmed && chosen.some((r) => r.mode === 'attempt' || r.mode === 'success'))
    throw Error('所选物品可能消耗，请明确确认后提交')
  if (
    limits &&
    chosen.some(
      (r) => (r.mode === 'attempt' || r.mode === 'success') && r.quantity > (limits[r.itemId] ?? 0),
    )
  )
    throw Error('实际消耗超过本次确认数量，请重新核对并确认')
  return {
    open: policy.effect === 'open',
    attempt: chosen.filter((r) => r.mode === 'attempt'),
    success: chosen.filter((r) => r.mode === 'success'),
  }
}
