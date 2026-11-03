import type { Combatant, AttackSpec, NpcAttack } from './combat-types'
import type { Character } from './types'
import type { Catalogue } from './engine'
import { combatCharacter } from './combat-rules'
import { findItem, runtimeState } from './runtime'
export interface NpcEquipment {
  id: string
  objectId: string
  itemId: string
  attackIds: string[]
  held: boolean
  proficient?: boolean
  magical: boolean
  material: 'metal' | 'wood' | 'other'
}
/** Monster attack formulas already contain their original ability modifier. */
export function replaceNpcWeaponModifier(formula: string, oldModifier: number) {
  const m = /^(\d{1,2}d\d{1,3})([+-]\d+)?$/.exec(formula.replace(/\s/g, ''))
  if (!m) throw Error('NPC克敌机先须核实含原攻击属性修正的实际武器伤害公式')
  const flat = Number(m[2] ?? 0) - oldModifier
  return m[1]! + (flat ? (flat > 0 ? '+' : '') + flat : '')
}
export function actualWeapon(a: Combatant, cs: Character[], cat: Catalogue, id?: string) {
  const c = combatCharacter(a, cs),
    row = c?.inventory.find((r) => r.instanceId === id),
    gear = a.npc?.equipment?.find((g) => g.id === id),
    item = c && row ? findItem(c, cat, row.itemId) : cat.items.find((i) => i.id === gear?.itemId)
  if (!item || item.kind !== 'weapon' || (row ? row.quantity !== 1 : !gear))
    throw Error('须选择一件已登记的真实武器实例，NPC攻击名称不能替代装备')
  return {
    id: id!,
    item,
    magical: !!row?.specialWeapon || !!gear?.magical,
    effects: c ? runtimeState(c, cat).effects : a.npc!.effects,
    row,
    gear,
  }
}
export function validateEnchantment(
  a: Combatant,
  cs: Character[],
  cat: Catalogue,
  id: string | undefined,
  spellId: string,
  sourceId: string,
) {
  const w = actualWeapon(a, cs, cat, id)
  if (
    w.magical ||
    w.effects.some(
      (f) =>
        f.weapon?.instanceId === w.id &&
        !(f.key === 'magic-weapon' && f.sourceId === sourceId && spellId === 'magic-weapon'),
    )
  )
    throw Error('该武器已为魔法武器，请选择真实非魔法武器')
  return w
}
export function npcWeaponSpec(a: Combatant, w: NpcAttack, spec: AttackSpec) {
  if (w.unarmed) return spec
  const gear = a.npc?.equipment?.find((g) => g.held && g.attackIds.includes(w.id))
  if (!gear) return spec
  const effects = a.npc!.effects,
    enchants = effects.filter((f) => f.weapon?.instanceId === gear.id),
    bonus = Math.max(0, ...enchants.map((f) => f.weapon!.bonus))
  spec = { ...spec, weaponId: gear.itemId, instanceId: gear.id, bonus: spec.bonus + bonus }
  const shill = effects.find((f) => f.key === 'shillelagh' && f.note === gear.id)
  if (shill && !spec.ranged) {
    const ability = shill.ability!,
      mod = Math.floor((a.npc!.scores[ability] - 10) / 2)
    if (!w.ability) throw Error('NPC橡棍攻击须核实原攻击属性')
    spec = {
      ...spec,
      ability,
      modifier: mod,
      damage: (a.npc!.spellcasting?.level ?? 1) >= 5 ? '1d10' : '1d8',
      bonus: spec.bonus - Math.floor((a.npc!.scores[w.ability] - 10) / 2) + mod,
      type: shill.supportChoice === 'force' ? 'force' : spec.type,
    }
  }
  return spec
}
