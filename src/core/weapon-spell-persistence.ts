import type { MapWorld, Adventure } from './map-types'
import type { Character, ActiveEffect, InventoryItem } from './types'
import { m1Entity } from './m1-utility'
import { concentrationMatches } from './spell-source-state'
export const isWeaponEnchantment = (f: ActiveEffect) =>
  !!f.weapon && ['magic-weapon', 'elemental-weapon'].includes(f.key)
export function stashWeaponEnchantments(c: Character, row: InventoryItem) {
  const list = (c.runtime?.effects ?? []).filter(
    (f) => isWeaponEnchantment(f) && f.weapon!.instanceId === row.instanceId,
  )
  if (!list.length) return
  row.spellEnchantments = structuredClone(list)
  c.runtime!.effects = (c.runtime!.effects ?? []).filter((f) => !list.includes(f))
}
export function restoreWeaponEnchantments(c: Character, row: InventoryItem) {
  if (!c.runtime || !row.spellEnchantments) return
  c.runtime.effects = [
    ...(c.runtime.effects ?? []),
    ...row.spellEnchantments
      .filter((f) => !(c.runtime!.effects ?? []).some((e) => e.id === f.id))
      .map((f) => ({ ...f, weapon: { ...f.weapon!, instanceId: row.instanceId } })),
  ]
  delete row.spellEnchantments
}
export function reconcileDroppedWeaponSpells(w: MapWorld, a: Adventure) {
  const alive = (f: ActiveEffect) => {
    if (!isWeaponEnchantment(f)) return true
    const source = m1Entity(w, a, f.sourceId),
      clock = w.characters.find((c) => c.id === f.clockSourceId)?.runtime?.hours
    const current = source?.state.effects?.find((e) => e.key === 'magic-weapon-source')
    return (
      (f.endsAt === undefined || clock === undefined || clock < f.endsAt) &&
      (!f.concentration ||
        concentrationMatches(
          f,
          source?.c?.runtime?.concentration ?? source?.body?.concentration,
        )) &&
      (f.key !== 'magic-weapon' || !current || !current.castId || current.castId === f.castId)
    )
  }
  for (const c of w.characters)
    if (c.runtime?.effects) c.runtime.effects = c.runtime.effects.filter(alive)
  for (const n of a.ai?.npcs ?? []) if (n.body) n.body.effects = n.body.effects.filter(alive)
  for (const e of w.encounters)
    for (const t of e.actors) if (t.npc) t.npc.effects = t.npc.effects.filter(alive)
  for (const s of a.scenes)
    for (const g of s.groundItems ?? [])
      if (g.inventoryState?.spellEnchantments)
        g.inventoryState.spellEnchantments = g.inventoryState.spellEnchantments.filter(alive)
}
