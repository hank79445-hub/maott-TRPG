import type { InventoryItem, SpecialWeapon } from './types'
import { DAMAGE_TYPES, type DamageType } from './combat-types'

export const SPECIAL_WEAPONS: { itemId: string; definition: SpecialWeapon }[] = [
  ['greatsword', '燃烧巨剑', 'fire'],
  ['longsword', '寒霜长剑', 'cold'],
  ['warhammer', '雷鸣战锤', 'thunder'],
  ['longbow', '闪电长弓', 'lightning'],
  ['dagger', '腐蚀匕首', 'acid'],
  ['spear', '辉光矛', 'radiant'],
].map(([itemId, name, type]) => ({
  itemId: itemId!,
  definition: {
    templateId: 'v08/' + itemId,
    version: 1,
    name: name!,
    description: '自定义示例：同次武器命中附加伤害；无持续伤害、同调、充能或自动点燃效果。',
    attackBonus: 0,
    damageBonus: 0,
    extraDamage: [{ formula: '1d4', type: type as DamageType }],
  },
}))
export function validateSpecialWeapon(w: SpecialWeapon) {
  if (
    w.version !== 1 ||
    typeof w.templateId !== 'string' ||
    !w.templateId.length ||
    w.templateId.length > 120 ||
    !w.name?.trim() ||
    w.name.length > 120 ||
    typeof w.description !== 'string' ||
    w.description.length > 2000 ||
    ![w.attackBonus, w.damageBonus].every((n) => Number.isInteger(n) && n >= -3 && n <= 3) ||
    !Array.isArray(w.extraDamage) ||
    w.extraDamage.length > 4 ||
    w.extraDamage.some(
      (d) =>
        !/^(?:[1-9]|1[0-2])d(?:4|6|8|10|12)$/.test(d.formula) || !DAMAGE_TYPES.includes(d.type),
    )
  )
    throw Error('特殊武器配置不合法：仅支持结构化命中附伤骰与 -3 至 3 固定加值')
}
export const inventoryName = (row: InventoryItem, baseName: string) =>
  row.specialWeapon?.name || baseName
