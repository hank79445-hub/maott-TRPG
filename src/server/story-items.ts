import type { Room, RoomCommand, RoomMember } from '../online/protocol'
import { adventure, RoomError } from './room-engine'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { packSchema } from '../persistence/schema'
export function changeStoryItem(room: Room, member: RoomMember, c: RoomCommand) {
  if (c.kind !== 'story-item-save' && c.kind !== 'story-item-delete') return false
  if (member.role !== 'gm' || member.revoked) throw new RoomError('剧情物品编辑仅限有效GM', 403)
  const packId = 'story-' + adventure(room).id
  const pack =
    room.world.packs.find(
      (p) => p.id.startsWith('story-') && p.items.some((i) => i.id === c.itemId),
    ) ?? room.world.packs.find((p) => p.id === packId)
  const existing = pack?.items.find((i) => i.id === c.itemId)
  if (existing && (existing.kind !== 'gear' || existing.source.edition !== 'custom'))
    throw new RoomError('规则能力物品请使用原规则包编辑，不能作为纯剧情道具覆盖')
  if (c.kind === 'story-item-delete') {
    if (!existing) throw new RoomError('剧情物品不存在，不能删除其他规则包定义')
    const refs: string[] = []
    for (const a of room.world.adventures) {
      for (const s of a.scenes) {
        for (const p of s.points)
          if (
            p.loot.some((i) => i.itemId === c.itemId) ||
            p.consume?.itemId === c.itemId ||
            p.itemUse?.requirements.some((i) => i.itemId === c.itemId)
          )
            refs.push(s.name + '／' + p.name)
        if (s.groundItems?.some((i) => i.itemId === c.itemId)) refs.push(s.name + '地面物品')
      }
      for (const n of a.ai?.npcs ?? [])
        if (
          n.consumables?.some((i) => i.itemId === c.itemId) ||
          n.stock.some((i) => i.itemId === c.itemId)
        )
          refs.push(n.name + '库存')
    }
    for (const p of room.world.packs)
      for (const i of p.items)
        if (i.contents?.some((r) => r.itemId === c.itemId)) refs.push(i.name + '内容')
    for (const ch of room.world.characters)
      if (ch.inventory.some((i) => i.itemId === c.itemId)) refs.push(ch.build.name + '背包')
    if (refs.length)
      throw new RoomError('物品仍被引用，请先解除或替换：' + refs.slice(0, 8).join('、'))
    pack!.items = pack!.items.filter((i) => i.id !== c.itemId)
  } else {
    if (!existing && catalogue([srd, ...room.world.packs]).items.some((i) => i.id === c.itemId))
      throw new RoomError('物品编号已存在，不能覆盖其他定义')
    if (!pack && room.world.packs.length >= 20) throw new RoomError('规则包容量已满')
    const target = structuredClone(
      pack ?? {
        id: packId,
        version: '1',
        name: '房间剧情物品',
        attribution: 'GM自定剧情道具；无自动规则效果',
        classes: [],
        backgrounds: [],
        species: [],
        feats: [],
        spells: [],
        items: [],
      },
    )
    const item = {
      id: c.itemId,
      name: c.name,
      english: '',
      summary: c.description,
      kind: 'gear' as const,
      cost: c.cost,
      weight: c.weight,
      source: { pack: target.id, version: target.version, page: 0, edition: 'custom' as const },
    }
    target.items = target.items.filter((i) => i.id !== c.itemId)
    target.items.push(item)
    const checked = packSchema.parse(target)
    if (pack) room.world.packs[room.world.packs.indexOf(pack)] = checked
    else room.world.packs.push(checked)
  }
  room.worldRevision++
  room.events.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    sessionId: member.id,
    detail:
      c.kind === 'story-item-save' ? 'GM保存剧情物品：' + c.name : 'GM删除剧情物品：' + c.reason,
  })
  return true
}
