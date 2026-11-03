import type { Character, EquipmentSlot, Grip, InventoryItem, InventoryTag, Item } from './types'
import type { Catalogue } from './engine'
import { requiresTwoHands } from './weapon-rules'

export const SLOT_NAMES: Record<EquipmentSlot, string> = {
  head: '头部',
  cloak: '披风',
  armor: '护甲',
  clothing: '衣服',
  hands: '手套',
  feet: '足部',
  accessories: '饰品',
  'main-hand': '主手',
  'off-hand': '另一只手',
}
export const TAG_NAMES: Record<InventoryTag, string> = {
  weapons: '武器',
  armor: '护甲与穿戴',
  consumables: '消耗品',
  tools: '工具',
  materials: '法器与材料',
  containers: '容器',
  misc: '杂物',
}
export const handSlot = (slot?: EquipmentSlot | null) => slot === 'main-hand' || slot === 'off-hand'
export const equipmentItem = (c: Character, cat: Catalogue, id: string) =>
  [...cat.items, ...c.build.customItems].find((x) => x.id === id)
export function compatibleSlots(item: Item): EquipmentSlot[] {
  if (item.kind === 'armor') return ['armor']
  if (item.kind === 'shield') return ['main-hand', 'off-hand']
  const slots: EquipmentSlot[] = item.wearSlot && item.wearSlot !== 'armor' ? [item.wearSlot] : []
  if (
    item.kind === 'weapon' ||
    item.holdable === true ||
    (item.kind === 'tool' && item.holdable !== false)
  )
    slots.push('main-hand', 'off-hand')
  return slots
}
export const canUseTwoHands = (item: Item) =>
  item.kind === 'weapon' &&
  !!item.properties?.some((p) => p.startsWith('two-handed') || p.startsWith('versatile'))

// Read old equipped flags without rewriting an archive or discarding surplus flags.
// Unplaced legacy rows remain visible for the player to resolve explicitly.
export function equipmentLayout(c: Character, cat: Catalogue) {
  const slots: Partial<Record<EquipmentSlot, InventoryItem[]>> = {}
  const unplaced: InventoryItem[] = []
  const equipped = c.inventory.filter((x) => x.equipped)
  const place = (row: InventoryItem, slot: EquipmentSlot) => {
    ;(slots[slot] ??= []).push(row)
  }
  for (const row of equipped.filter((x) => x.equipmentSlot)) place(row, row.equipmentSlot!)
  unplaced.push(...equipped.filter((x) => x.equipmentSlot === null))
  // Prioritize the shield so the usual weapon-and-shield arrangement is retained.
  const legacy = equipped
    .filter((x) => x.equipmentSlot === undefined)
    .sort(
      (a, b) =>
        Number(equipmentItem(c, cat, b.itemId)?.kind === 'shield') -
        Number(equipmentItem(c, cat, a.itemId)?.kind === 'shield'),
    )
  for (const row of legacy) {
    const item = equipmentItem(c, cat, row.itemId)
    if (
      !item ||
      row.quantity !== 1 ||
      (item.kind === 'shield' &&
        Object.values(slots)
          .flat()
          .some((x) => equipmentItem(c, cat, x.itemId)?.kind === 'shield'))
    ) {
      unplaced.push(row)
      continue
    }
    const options = compatibleSlots(item)
    const preferred = item.kind === 'shield' ? (['off-hand', 'main-hand'] as const) : options
    const slot = preferred.find((x) => x === 'accessories' || !slots[x]?.length)
    if (slot) place(row, slot)
    else unplaced.push(row)
  }
  return { slots, unplaced }
}
export function assignedSlot(c: Character, cat: Catalogue, row: InventoryItem) {
  if (!row.equipped) return undefined
  return (Object.entries(equipmentLayout(c, cat).slots) as [EquipmentSlot, InventoryItem[]][]).find(
    ([, rows]) => rows.some((x) => x.instanceId === row.instanceId),
  )?.[0]
}
export function gripOf(c: Character, cat: Catalogue, row: InventoryItem): Grip {
  if (row.grip) return row.grip
  const item = equipmentItem(c, cat, row.itemId)
  const slot = assignedSlot(c, cat, row)
  const other = slot === 'main-hand' ? 'off-hand' : 'main-hand'
  return item &&
    requiresTwoHands(item, c.runtime?.mounted) &&
    handSlot(slot) &&
    !equipmentLayout(c, cat).slots[other]?.length
    ? 'two-handed'
    : 'one-handed'
}
export function clearEquipment(row: InventoryItem) {
  row.equipped = false
  row.equipmentSlot = null
  row.grip = null
}
export function freeHandSlots(c: Character, cat: Catalogue): ('main-hand' | 'off-hand')[] {
  const layout = equipmentLayout(c, cat),
    held = [...(layout.slots['main-hand'] ?? []), ...(layout.slots['off-hand'] ?? [])]
  if (held.some((row) => gripOf(c, cat, row) === 'two-handed')) return []
  return (['main-hand', 'off-hand'] as const).filter(
    (hand) => !layout.slots[hand]?.length && !c.runtime?.grapples?.some((g) => g.hand === hand) && !c.runtime?.effects?.some(f=>f.key==='flame-blade-held'&&f.supportChoice===hand),
  )
}
export function equippedInventory(c: Character, cat: Catalogue) {
  const placed = new Map<InventoryItem['instanceId'], EquipmentSlot>()
  for (const [slot, rows] of Object.entries(equipmentLayout(c, cat).slots))
    for (const row of rows) placed.set(row.instanceId, slot as EquipmentSlot)
  return c.inventory.map((row) => ({
    ...row,
    equipped: placed.has(row.instanceId),
    grip: handSlot(placed.get(row.instanceId)) ? gripOf(c, cat, row) : null,
  }))
}
// Freeze inferred positions on the first write. Pending legacy marks must not
// silently move into a newly emptied hand or armor slot.
export function materializeEquipment(c: Character, cat: Catalogue) {
  const actual = equippedInventory(c, cat)
  const layout = equipmentLayout(c, cat)
  for (const [slot, rows] of Object.entries(layout.slots))
    for (const row of rows) {
      row.equipmentSlot = slot as EquipmentSlot
      row.grip = actual.find((x) => x.instanceId === row.instanceId)!.grip
    }
  for (const row of layout.unplaced) {
    row.equipmentSlot = null
    row.grip = null
  }
}
export function validateEquipment(c: Character, cat: Catalogue) {
  const used = new Set<EquipmentSlot>()
  for (const row of c.inventory) {
    if (!row.equipmentSlot) {
      if (row.grip) throw new Error('持用方式必须对应手持槽')
      continue
    }
    const item = equipmentItem(c, cat, row.itemId)!
    if (!row.equipped || row.quantity !== 1 || !compatibleSlots(item).includes(row.equipmentSlot))
      throw new Error('装备部位、物品种类或数量不合法')
    if (row.equipmentSlot !== 'accessories' && used.has(row.equipmentSlot))
      throw new Error('同一装备槽不能重复占用')
    used.add(row.equipmentSlot)
    if (!handSlot(row.equipmentSlot) && row.grip) throw new Error('穿戴物品不能设置手持方式')
    if (row.grip === 'two-handed') {
      if (!canUseTwoHands(item)) throw new Error('该物品没有双手或两用武器属性')
      const other = row.equipmentSlot === 'main-hand' ? 'off-hand' : 'main-hand'
      if (equipmentLayout(c, cat).slots[other]?.length) throw new Error('双手持用需要另一只手空闲')
    }
  }
}
export function inventoryTag(item: Item): InventoryTag {
  if (item.inventoryTag) return item.inventoryTag
  if (item.kind === 'weapon') return 'weapons'
  if (item.kind === 'armor' || item.kind === 'shield' || item.wearSlot) return 'armor'
  if (item.kind === 'tool') return 'tools'
  if (item.category === 'container') return 'containers'
  return 'misc'
}
export function inventoryGroups(c: Character, cat: Catalogue, search = '', location = '*') {
  const term = search.trim().toLocaleLowerCase()
  const rows = c.inventory.filter((row) => {
    if (row.equipped) return false
    if (location !== '*' && (row.containerId || '') !== location) return false
    const item = equipmentItem(c, cat, row.itemId)
    return (
      item &&
      `${row.specialWeapon?.name ?? ''} ${row.specialWeapon?.description ?? ''} ${item.name} ${item.english} ${row.note} ${row.source}`
        .toLocaleLowerCase()
        .includes(term)
    )
  })
  // Only visually combine interchangeable rows. Original instances and sources are kept.
  const groups = new Map<
    string,
    { item: Item; rows: InventoryItem[]; quantity: number; tag: InventoryTag }
  >()
  for (const row of rows) {
    const item = equipmentItem(c, cat, row.itemId)!
    const key =
      item.kind === 'weapon' ||
      item.kind === 'armor' ||
      item.kind === 'shield' ||
      inventoryTag(item) === 'containers' ||
      item.source.pack !== 'srd-5.2.1'
        ? row.instanceId
        : JSON.stringify([row.itemId, row.source, row.note, row.containerId || null])
    const group = groups.get(key)
    if (group) {
      group.rows.push(row)
      group.quantity += row.quantity
    } else groups.set(key, { item, rows: [row], quantity: row.quantity, tag: inventoryTag(item) })
  }
  return [...groups.values()]
}
