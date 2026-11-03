import { spatialFixture } from './npc-spatial-fixture'
import { defaultMerchant } from '../src/persistence/trade-schema'
import type { RoomMember } from '../src/online/protocol'
export async function fogTradeFixture() {
  const f = await spatialFixture(),
    c = f.room.world.characters[0]!,
    other = f.room.world.characters[1]!,
    token = f.scene.tokens.find((t) => t.characterId === c.id)!
  token.x = 1
  token.y = 2
  f.n.position = { x: 2, y: 2 }
  f.n.stock = [{ id: 'merchant-torch', itemId: 'torch', quantity: 5, priceGP: 1 }]
  f.n.coins = 30
  f.n.merchantPolicy = { ...defaultMerchant(), buy: true }
  f.n.spatialPolicy!.enabled = false
  c.coins = 100
  c.inventory = [
    {
      instanceId: 'dagger-instance',
      itemId: 'dagger',
      quantity: 2,
      source: '初始装备',
      equipped: false,
      note: '私人刻记',
    },
  ]
  const player = {
      ...f.gm,
      id: 'player',
      nickname: '玩家',
      role: 'player',
      characterIds: [c.id],
    } as RoomMember,
    second = { ...player, id: 'second', characterIds: [other.id] } as RoomMember
  f.room.members.push(player, second)
  return { ...f, c, other, player, second, pcToken: token }
}
