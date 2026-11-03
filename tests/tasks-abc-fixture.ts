import { catalogue, newCharacter, startingInventory } from '../src/core/engine'
import { runtimeState } from '../src/core/runtime'
import { build } from './fixtures'
const cat = catalogue()
export function scrollWizard(scroll = 'fire-bolt', quantity = 1) {
  const c = newCharacter()
  c.build = build('wizard', 'human', 'sage')
  c.status = 'complete'
  c.inventory = startingInventory(c.build, cat).inventory
  c.runtime = runtimeState(c, cat)
  c.inventory.push({
    instanceId: 'scroll-' + scroll,
    itemId: 'scroll-' + scroll,
    quantity,
    source: '合成测试',
    equipped: false,
    note: '实例保留',
  })
  return c
}
