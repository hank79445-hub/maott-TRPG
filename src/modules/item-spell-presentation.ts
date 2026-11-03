import { i18n } from '../app/i18n'
export const itemCastLabel = (mode: string) =>
  i18n.global.locale.value === 'en'
    ? `Item spell (level ${mode.split('-')[1]})`
    : `物品施法（${mode.split('-')[1]}环）`
export const itemCastText = (usable = true) =>
  i18n.global.locale.value === 'en'
    ? usable
      ? 'Cast spell'
      : 'Cannot cast from this item: check spell-list eligibility, charges and location'
    : usable
      ? '施放法术'
      : '当前不可施放：请核对法术列表资格、充能和物品位置'

export function containerAccessLabel(point: {
  kind: string
  state: string
  repeatAccess?: boolean
}) {
  if (point.kind !== 'chest') return point.state
  const en = i18n.global.locale.value === 'en'
  if (['open', 'resolved'].includes(point.state) && point.repeatAccess !== false)
    return en ? 'Open · repeatable' : '已打开 · 可重复访问'
  if (point.state === 'resolved') return en ? 'Completed (one-time)' : '已完成（一次性）'
  return (
    (
      {
        ready: en ? 'Not opened' : '未打开',
        locked: en ? 'Locked' : '已锁定',
        closed: en ? 'Closed' : '已关闭',
        open: en ? 'Opened' : '已打开',
      } as Record<string, string>
    )[point.state] ?? point.state
  )
}
