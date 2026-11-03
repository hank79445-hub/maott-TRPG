import type { AuthoringCharacter } from '../persistence/authoring-character-schema'
import {
  newCharacter,
  clone,
  validate,
  startingInventory,
  getChoices,
  type Catalogue,
} from './engine'
import { runtimeState, validateInventory, validateRuntimeArchive } from './runtime'
import { applyLevelUp, validateGrowthArchive } from './growth'
import { scriptCharacter } from './character-config'

/** Uses the same validation and growth path as players; no model-supplied derived statistics. */
export function compileNpcCharacter(
  source: AuthoringCharacter,
  name: string,
  npcId: string,
  cat: Catalogue,
) {
  let c = newCharacter()
  c.build = clone(source.build)
  c.build.name = name
  if (c.build.adjustments.length) throw Error('职业卡不能以GM调整字段代替合法职业构建')
  if (c.build.customItems.length)
    throw Error('职业卡仅引用当前规则目录／GM提供物品包，不能自行定义customItems')
  const issues = validate(c.build, cat)
  const allowed = new Set(getChoices(c.build, cat).map((n) => n.id))
  for (const [key, value] of Object.entries(c.build.choices))
    if (value.length && !allowed.has(key)) throw Error('职业卡未知选择：' + key)
  if (issues.length)
    throw Error('职业卡一级构建：' + issues.map((i) => i.key + '：' + i.message).join('；'))
  const inventory = startingInventory(c.build, cat)
  c.status = 'complete'
  c.purpose = 'npc'
  c.npcOwnerId = npcId
  c.inventory = inventory.inventory
  c.coins = inventory.coins
  c.runtime = runtimeState(c, cat)
  for (const step of source.growth) {
    c = applyLevelUp(
      c,
      cat,
      { ...step, expectedRevision: c.revision, confirmed: true, reason: '剧本初始职业卡逐级构建' },
      () => {
        throw Error('初始职业卡仅支持固定升级HP')
      },
    )
  }
  validateGrowthArchive(c, cat)
  // The authored initial character starts rested; level-up itself does not heal a live character.
  c.runtime = null
  c.runtime = runtimeState(c, cat)
  validateInventory(c, cat)
  validateRuntimeArchive(c, cat)
  return scriptCharacter(c)
}
