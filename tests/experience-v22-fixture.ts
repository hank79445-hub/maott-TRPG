import { fogTradeFixture } from './fog-trade-fixture'
import { newPoint } from '../src/core/map'
import { pointContainerView } from '../src/server/point-container'
export async function containerFixture() {
  const f = await fogTradeFixture()
  const point = newPoint('chest', { x: 2, y: 2 })
  point.name = '合成物品堆'
  point.state = 'open'
  point.range = 5
  point.loot = [{ itemId: 'torch', quantity: 3 }]
  point.coins = 12.34
  point.note = '不得下发的GM秘密'
  point.containerDesign = { gmNote: '隐藏配置', emptyReason: '' }
  f.scene.points = [point]
  return {
    ...f,
    point,
    current: () => ({
      c: f.room.world.characters.find((c) => c.id === f.c.id)!,
      p: f.room.world.adventures[0]!.scenes.find((s) => s.id === f.scene.id)!.points[0]!,
    }),
    view: () => pointContainerView(f.room, f.player, f.scene.id, point.id, f.c.id),
  }
}
