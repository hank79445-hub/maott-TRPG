import type { Character, Item, InventoryItem, Build, Ability } from './types'
import type { Catalogue } from './engine'
import type { SpellGrant } from './runtime'
import { slotLevels, alwaysPrepared } from './growth-rules'
import { partialCaster } from './advanced-rules'
import type { ItemSpellDefinition } from '../persistence/item-spell-schema'
export const scrollStats = (level: number) =>
  level <= 2
    ? { dc: 13, attackBonus: 5 }
    : level <= 4
      ? { dc: 15, attackBonus: 7 }
      : level <= 6
        ? { dc: 17, attackBonus: 9 }
        : level <= 8
          ? { dc: 18, attackBonus: 10 }
          : { dc: 19, attackBonus: 11 }
export function itemSpellDefinition(
  item: Item | undefined,
  cat: Catalogue,
): ItemSpellDefinition | undefined {
  if (!item) return
  if (item.spellUse) return item.spellUse
  // Compatibility only for a canonical SRD item, never a name or arbitrary prefix.
  const spell = cat.spells.find((s) => 'scroll-' + s.id === item.id)
  if (
    spell &&
    item.source.pack === 'srd-5.2.1' &&
    cat.items.some((i) => i.id === item.id && JSON.stringify(i) === JSON.stringify(item))
  )
    return { spellId: spell.id, level: spell.level }
}
export function itemSpellGrants(
  c: Character,
  b: Build,
  cat: Catalogue,
  normal: SpellGrant[],
): SpellGrant[] {
  const cl = cat.classes.find((cl) => cl.id === b.classId),
    max = Math.max(
      0,
      ...slotLevels(b).map((n, i) => (n ? i + 1 : 0)),
      ...normal
        .filter((g) => g.modes.some((m) => ['at-will', 'free'].includes(m)))
        .map((g) => g.spell.level),
    )
  const live: SpellGrant[] = c.inventory.flatMap((row) => {
    if (row.quantity <= 0 || row.containerId) return []
    const item = [...c.build.customItems, ...cat.items].find((i) => i.id === row.itemId),
      definition = itemSpellDefinition(item, cat),
      spell = cat.spells.find((s) => s.id === definition?.spellId)
    if (!definition || !spell || definition.level < spell.level) return []
    const own = normal.find((g) => g.spell.id === spell.id),
      partial = partialCaster(b)
    if (
      definition.requiresSpellList !== false &&
      !spell.lists.includes(b.classId) &&
      !(partial && spell.lists.includes('wizard')) &&
      !own &&
      !alwaysPrepared(b, cat.subclasses).some((s) => s.id === spell.id)
    )
      return []
    if (
      definition.charges &&
      (row.quantity !== 1 || (row.uses ?? definition.charges) < (definition.chargeCost ?? 1))
    )
      return []
    const ability: Ability = own?.ability ?? cl?.spellAbility ?? (partial ? 'int' : 'cha'),
      stats = scrollStats(definition.level),
      casterLevel = definition.casterLevel ?? Math.max(1, 2 * definition.level - 1),
      attackBonus = definition.attackBonus ?? stats.attackBonus
    return [
      {
        key: `item:${row.instanceId}:${spell.id}`,
        spell: {
          ...spell,
          components:
            definition.components ??
            (definition.charges
              ? '—'
              : spell.components.replace(/,?\s*M\s*(\([^]*\))?/, '').trim()),
        },
        source: item!.name.slice(0, 240),
        ability,
        modes: ['item-' + definition.level],
        sorcerer: false,
        item: {
          instanceId: row.instanceId,
          itemId: row.itemId,
          definition,
          maxLevel: max,
          dc: definition.dc ?? stats.dc,
          attackBonus,
          casterLevel,
          abilityModifier: attackBonus - (Math.floor((casterLevel - 1) / 4) + 2),
        },
      },
    ]
  })
  const receipts = (c.runtime?.itemCasts ?? []).filter(
    (receipt, i, all) =>
      receipt.success &&
      !live.some((g) => g.key === receipt.key) &&
      !all.slice(i + 1).some((r) => r.key === receipt.key),
  )
  for (const receipt of receipts) {
    const item = [...c.build.customItems, ...cat.items].find((i) => i.id === receipt.itemId),
      definition = itemSpellDefinition(item, cat),
      spell = cat.spells.find((s) => s.id === receipt.spellId)
    if (!definition || !spell || definition.spellId !== spell.id) continue
    const casterLevel = definition.casterLevel ?? Math.max(1, 2 * definition.level - 1)
    live.push({
      key: receipt.key,
      spell: {
        ...spell,
        components:
          definition.components ??
          (definition.charges ? '—' : spell.components.replace(/,?\s*M\s*(\([^]*\))?/, '').trim()),
      },
      source: receipt.source,
      ability: receipt.ability,
      modes: [],
      sorcerer: false,
      retired: true,
      item: {
        instanceId: receipt.instanceId,
        itemId: receipt.itemId,
        definition,
        maxLevel: max,
        dc: receipt.dc,
        attackBonus: receipt.attackBonus,
        casterLevel,
        abilityModifier: receipt.attackBonus - (Math.floor((casterLevel - 1) / 4) + 2),
      },
    })
  }
  return live
}
export const itemCastFailed = (c: Character | undefined, key: string) =>
  key.startsWith('item:') &&
  c?.runtime?.itemCasts?.at(-1)?.key === key &&
  c.runtime.itemCasts.at(-1)!.success === false
export const spellUsesSlot = (mode: string) => /^slot(?:-[2-9])?$/.test(mode)
export function itemSpellBusy(c: Character, row: InventoryItem) {
  return !!c.runtime?.concentration?.castingKey?.startsWith('item:' + row.instanceId + ':')
}

export const itemWaivesMaterials = (grant: SpellGrant | undefined) =>
  !!grant?.item && !/(^|[,\s])M([,\s(]|$)/.test(grant.spell.components)
