import type { Item } from './types'
import builtins from '../content/items'
export function automaticDamageItem(item: Item | undefined) {
  if (!item || !['acid', 'alchemists-fire', 'holy-water'].includes(item.id)) return false
  const base = builtins.find((i) => i.id === item.id)
  return (
    !!base &&
    JSON.stringify(item.source) === JSON.stringify(base.source) &&
    item.summary === base.summary
  )
}
