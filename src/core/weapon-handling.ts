import type { Character } from './types'
import type { Catalogue } from './engine'
import type { WeaponHandling } from './combat-types'
import { applyRuntime, findItem } from './runtime'
import { assignedSlot, equipmentLayout, handSlot } from './equipment'
import { hasFeat } from './advanced-rules'
import { requiresTwoHands } from './weapon-rules'

export function previewWeaponHandling(c: Character, cat: Catalogue, ops: WeaponHandling['before']) {
  let next = c
  for (const op of ops) {
    const row = next.inventory.find((r) => r.instanceId === op.instanceId)
    if (
      !row ||
      row.quantity !== 1 ||
      row.containerId ||
      findItem(next, cat, row.itemId)?.kind !== 'weapon'
    )
      throw Error('拔收限随身单件武器；盾牌或从容器取物需另行处理')
    const layout = equipmentLayout(next, cat),
      slot = op.slot ?? assignedSlot(next, cat, row) ?? 'main-hand'
    if (!handSlot(slot)) throw Error('拔出武器请选择手持槽')
    if (op.equipped && row.equipped) throw Error('此武器已在手中，换握请使用独立持用操作')
    if (!op.equipped && !row.equipped) throw Error('此武器已经收起')
    if (op.equipped && layout.slots[slot]?.some((r) => r.instanceId !== row.instanceId))
      throw Error('请先收起该手物品；替换不是一次拔出操作')
    next = applyRuntime(next, cat, { ...op, slot }, () => 1)
  }
  return next
}
export function validateHandling(
  c: Character,
  cat: Catalogue,
  handling: WeaponHandling,
  cost: string,
) {
  const count = handling.before.length + handling.after.length
  if (!count) return
  if (!['action', 'nick'].includes(cost)) throw Error('只有攻击动作内的攻击可附带拔收武器')
  if (count > (hasFeat(c.build, 'dual-wielder', cat) ? 2 : 1))
    throw Error('每次攻击只能附带一次拔／收武器（双持客可两把）')
  if (
    count > 1 &&
    [...handling.before, ...handling.after].some((op) => {
      const row = c.inventory.find((r) => r.instanceId === op.instanceId),
        item = row && findItem(c, cat, row.itemId)
      return item && requiresTwoHands(item, c.runtime?.mounted)
    })
  )
    throw Error('双持客的两把拔收不适用于双手武器')
  const afterBefore = previewWeaponHandling(c, cat, handling.before)
  previewWeaponHandling(afterBefore, cat, handling.after)
}
export function handlingPreview(c: Character, cat: Catalogue, handling: WeaponHandling) {
  try {
    return previewWeaponHandling(c, cat, handling.before)
  } catch {
    return c
  }
}
