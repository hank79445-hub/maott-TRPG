import type { MapWorld } from './map-types'
/** Preserve initial-object permission across real splits/transfers. A mixed or
 * unverified stack does not acquire permission merely by sharing an item name. */
export function transferHutInventory(
  w: MapWorld,
  fromId: string,
  sourceQuantity: number,
  quantity: number,
  toId: string,
) {
  if (fromId === toId) return
  for (const a of w.adventures)
    for (const e of a.sceneEffects?.regions ?? []) {
      if (e.status !== 'active' || e.spellId !== 'tiny-hut' || !e.magic) continue
      const row = e.magic.allowedInventory.find((i) => i.instanceId === fromId)
      if (!row || row.quantity < sourceQuantity) continue
      row.quantity = Math.max(0, sourceQuantity - quantity)
      e.magic.allowedInventory = e.magic.allowedInventory.filter((i) => i.quantity > 0)
      const to = e.magic.allowedInventory.find((i) => i.instanceId === toId)
      if (to) to.quantity += quantity
      else e.magic.allowedInventory.push({ instanceId: toId, quantity })
      if (!e.magic.inside.includes(toId)) e.magic.inside.push(toId)
    }
}
