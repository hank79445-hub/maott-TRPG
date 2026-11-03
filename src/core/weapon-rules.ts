import type { Character, InventoryItem, Item } from './types'
import type { CombatCommand, Environment } from './combat-types'
import type { AttackCost } from './attack-methods'
export function unarmedCommand(
  actorId: string,
  targetId: string,
  kind: 'grapple' | 'prone' | 'push',
  save: 'str' | 'dex',
  hand: 'main-hand' | 'off-hand',
  cost: AttackCost,
  env: Environment,
  handling?: import('./combat-types').WeaponHandling,
): Extract<CombatCommand, { type: 'unarmed' }> {
  if (!['action', 'haste', 'martial', 'flurry', 'opportunity', 'agile'].includes(cost))
    throw Error('此攻击来源不能用于徒手擒抱或推撞')
  return {
    type: 'unarmed',
    actorId,
    targetId,
    kind,
    save,
    hand,
    cost: cost as Extract<CombatCommand, { type: 'unarmed' }>['cost'],
    env,
    ...(handling && (handling.before.length || handling.after.length) ? { handling } : {}),
  }
}

export const requiresTwoHands = (item: Item, mounted = false) =>
  !!item.properties?.includes('two-handed') ||
  (!!item.properties?.includes('two-handed-unless-mounted') && !mounted)

export const isMonkWeapon = (item: Item) =>
  item.kind === 'weapon' &&
  (item.category === 'simple-melee' ||
    (item.category === 'martial-melee' && !!item.properties?.includes('light')))

// Callers supply the normalized equipped inventory, never raw legacy flags.
export function martialArtsEligible(c: Character, inventory: InventoryItem[], items: Item[]) {
  return (
    c.build.classId === 'monk' &&
    !c.runtime?.wildShape &&
    !inventory.some((row) => {
      if (!row.equipped) return false
      const item = items.find((i) => i.id === row.itemId)
      return (
        !!item &&
        (item.kind === 'armor' ||
          item.kind === 'shield' ||
          (item.kind === 'weapon' && !isMonkWeapon(item)))
      )
    })
  )
}

export function initialEquipment(inventory: InventoryItem[], items: Item[], errors: string[]) {
  const hands = inventory.filter(
    (r) =>
      r.equipped &&
      items.some(
        (i) => i.id === r.itemId && (i.kind === 'weapon' || i.kind === 'shield' || i.holdable),
      ),
  )
  const two = hands.filter((r) => requiresTwoHands(items.find((i) => i.id === r.itemId)!))
  if (hands.length > 2 || (two.length && hands.length > 1))
    errors.push('初始双手／手持装备冲突：请只选择当前持用的武器或盾牌，其余留在背包')
  for (const row of inventory.filter((r) => r.equipped)) {
    const item = items.find((i) => i.id === row.itemId)!
    if (hands.includes(row)) {
      const order = hands.indexOf(row)
      row.equipmentSlot = order === 0 ? 'main-hand' : order === 1 ? 'off-hand' : null
      row.grip = row.equipmentSlot ? (requiresTwoHands(item) ? 'two-handed' : 'one-handed') : null
    } else if (item.kind === 'armor' || item.wearSlot) {
      row.equipmentSlot = item.kind === 'armor' ? 'armor' : item.wearSlot
      row.grip = null
    }
  }
}
