import { createHash, randomUUID } from 'node:crypto'
import type { Room, RoomMember } from '../online/protocol'
import type {
  ContainerAction,
  ContainerRow,
  PointContainerView,
} from '../persistence/point-container-schema'
import { adventure, activeScene, RoomError } from './room-engine'
import { clone, catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { distance } from '../core/map'
import { sightLine } from '../core/map-spatial'
import { pointInteractor } from '../core/point-interactor'
import { scenePointVisible } from '../core/scene-effect-view'
import { fogMapAllowed } from './fog'
import { assertGmActionControl } from './gm-control'
import { copper, tradeItemReason } from './trade-engine'
import { findItem, validateInventory } from '../core/runtime'
import { inventoryName } from '../core/special-weapons'
import { inventoryTag } from '../core/equipment'
import { applyCombat } from '../core/combat'
import { assertExplorationReady, explorationMember, explorationSpend } from '../core/exploration'

function context(
  room: Room,
  member: RoomMember,
  sceneId: string,
  pointId: string,
  characterId: string,
) {
  const a = adventure(room),
    s = activeScene(room),
    c = room.world.characters.find((c) => c.id === characterId)
  const p = s?.points.find((p) => p.id === pointId),
    token = s?.tokens.find((t) => t.characterId === characterId && !t.hidden)
  if (
    member.revoked ||
    member.role === 'ai' ||
    !c ||
    c.npcOwnerId ||
    c.purpose === 'npc' ||
    (member.role !== 'gm' && !member.characterIds.includes(characterId))
  )
    throw new RoomError('无权操作该角色的容器物品', 403)
  if (!s || s.id !== sceneId || !p || p.hidden || !p.enabled || p.kind !== 'chest' || !token)
    throw new RoomError('容器当前不可访问', 403)
  const repeat = p.repeatAccess !== false
  if (p.state === 'resolved' && !repeat) throw new RoomError('此容器为一次性访问，已完成；请GM明确重置', 409)
  if (p.state !== 'open' && !(p.state === 'resolved' && repeat)) throw new RoomError('请先使用并打开容器', 409)
  const cat = catalogue([srd, ...room.world.packs])
  assertGmActionControl(room, member, {
    kind: 'runtime',
    characterId,
    command: { type: 'heal', amount: 0 },
  })
  pointInteractor(room.world, a, s, characterId, undefined, cat, () => {
    throw Error('查看容器不应掷骰')
  })
  if (
    distance(s, token, p) > p.range ||
    !sightLine(s, token, p, 'blocksTargeting').clear ||
    (member.role !== 'gm' &&
      (!scenePointVisible(room.world, a, s, [token], p, cat) ||
        (s.fog?.enabled && !fogMapAllowed(room, member, s.id, p))))
  )
    throw new RoomError('请靠近可感知的容器，不能隔墙或未知区域操作', 403)
  const lock = a.sceneEffects?.regions.find(
    (e) =>
      e.status === 'active' &&
      e.spellId === 'arcane-lock' &&
      e.magic?.pointId === p.id &&
      (e.magic.suppressedUntil ?? 0) <=
        (room.world.characters.find((c) => c.id === e.clockSourceId)?.runtime?.hours ??
          e.createdHour),
  )
  if (lock && !lock.magic!.allowedIds.includes(characterId) && lock.sourceId !== characterId)
    throw new RoomError('容器当前锁定', 403)
  return { a, s, c, p, token, cat }
}

export function pointContainerView(
  room: Room,
  member: RoomMember,
  sceneId: string,
  pointId: string,
  characterId: string,
): PointContainerView {
  const { a, s, c, p, cat } = context(room, member, sceneId, pointId, characterId)
  const row = (
    id: string,
    itemId: string,
    quantity: number,
    stored?: NonNullable<typeof p.containerInventory>[number],
  ): ContainerRow => {
    const item = findItem(c, cat, itemId)
    return {
      id,
      itemId,
      quantity,
      name: stored ? inventoryName(stored, item?.name ?? itemId) : (item?.name ?? itemId),
      tag: item ? inventoryTag(item) : 'misc',
      ...(!item ? { reason: '角色缺少该物品的规则定义，请GM核对' } : {}),
    }
  }
  const coins = (amount: number): ContainerRow[] =>
    amount > 0
      ? [
          {
            id: 'coins',
            itemId: 'coins',
            name: '金币',
            quantity: amount,
            tag: 'coins',
            coins: true,
          },
        ]
      : []
  return {
    sceneId: s.id,
    pointId: p.id,
    characterId,
    name: p.name,
    characterName: c.build.name,
    stamp: createHash('sha256')
      .update(
        JSON.stringify([
          a.broadcastLog?.branchId ?? 'legacy',
          s.id,
          p.id,
          p.state,
          p.loot,
          p.coins,
          p.containerInventory ?? [],
        ]),
      )
      .digest('hex'),
    reviewRequired: !!p.assistedReview?.enabled,
    items: [
      ...coins(p.coins),
      ...p.loot.map((v, i) => row('legacy:' + i, v.itemId, v.quantity)),
      ...(p.containerInventory ?? []).map((v) =>
        row('stored:' + v.instanceId, v.itemId, v.quantity, v),
      ),
    ],
    inventory: [
      ...coins(c.coins),
      ...c.inventory.map((v) => ({
        ...row('inventory:' + v.instanceId, v.itemId, v.quantity, v),
        reason: tradeItemReason(room, c, v) || undefined,
      })),
    ],
  }
}

export function executeContainer(
  room: Room,
  member: RoomMember,
  action: ContainerAction,
  approved: boolean,
) {
  const original = pointContainerView(
    room,
    member,
    action.sceneId,
    action.pointId,
    action.characterId,
  )
  if (original.stamp !== action.stamp) throw new RoomError('容器内容已变化，请刷新后重新选择', 409)
  if (original.reviewRequired && member.role !== 'gm' && !approved)
    throw new RoomError('此容器取放需要GM审核')
  const next = { ...room, world: clone(room.world) },
    { a, s, p, token, cat } = context(
      next,
      member,
      action.sceneId,
      action.pointId,
      action.characterId,
    )
  let c = next.world.characters.find((c) => c.id === action.characterId)!
  const rows =
    action.operation === 'take-all'
      ? original.items.filter((r) => !r.reason)
      : (action.operation === 'put' ? original.inventory : original.items).filter(
          (r) => r.id === action.rowId,
        )
  if (!rows.length) throw new RoomError('没有可转移内容，请刷新容器')
  const person = pointInteractor(next.world, a, s, c.id, undefined, cat, () => {
    throw Error('容器转移不应掷骰')
  })
  for (const row of rows) {
    const quantity = action.operation === 'take-all' ? row.quantity : action.quantity!
    if (
      row.reason ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > row.quantity ||
      (!row.coins && !Number.isInteger(quantity))
    )
      throw new RoomError(row.reason ?? '实际可转移数量不足')
    if (row.coins) {
      const amount = copper(quantity),
        pc = copper(c.coins),
        chest = copper(p.coins)
      const nextPc = action.operation === 'put' ? pc - amount : pc + amount
      const nextChest = action.operation === 'put' ? chest + amount : chest - amount
      if (Math.min(nextPc, nextChest) < 0 || Math.max(nextPc, nextChest) > 100000000)
        throw new RoomError('金币余额或上限不足')
      c.coins = nextPc / 100
      p.coins = nextChest / 100
    } else if (action.operation === 'put') {
      const item = c.inventory.find((v) => 'inventory:' + v.instanceId === row.id)!
      if ((p.containerInventory?.length ?? 0) >= 100) throw new RoomError('容器物品条目已满')
      ;(p.containerInventory ??= []).push({
        ...clone(item),
        instanceId: quantity === item.quantity ? item.instanceId : randomUUID(),
        quantity,
        equipped: false,
        containerId: null,
        equipmentSlot: null,
        grip: null,
      })
      item.quantity -= quantity
    } else if (row.id.startsWith('stored:')) {
      const item = p.containerInventory!.find((v) => 'stored:' + v.instanceId === row.id)!
      c.inventory.push({
        ...clone(item),
        instanceId: quantity === item.quantity ? item.instanceId : randomUUID(),
        quantity,
        equipped: false,
        containerId: null,
        equipmentSlot: null,
        grip: null,
      })
      item.quantity -= quantity
    } else {
      const item = p.loot[Number(row.id.slice(7))]!
      person.grant([{ itemId: item.itemId, quantity }], 0)
      c = next.world.characters.find((v) => v.id === action.characterId)!
      item.quantity -= quantity
    }
  }
  c.inventory = c.inventory.filter((v) => v.quantity > 0)
  p.loot = p.loot.filter((v) => v.quantity > 0)
  p.containerInventory = p.containerInventory?.filter((v) => v.quantity > 0)
  p.state = 'open'
  if (p.repeatAccess === false && action.operation !== 'put' && !p.loot.length && !p.coins && !p.containerInventory?.length) p.state = 'resolved'
  const encounter = next.world.encounters.find(
    (e) => e.id === s.encounterId && e.phase === 'active',
  )
  if (
    next.world.encounters.some(
      (e) =>
        e.phase === 'active' &&
        e.id !== encounter?.id &&
        e.actors.some((t) => t.characterId === c.id),
    )
  )
    throw new RoomError('人物正在其他遭遇中')
  if (encounter) {
    const actor = encounter.actors.find((t) => t.characterId === c.id)
    if (!actor) throw new RoomError('角色未加入当前遭遇')
    const result = applyCombat(encounter, next.world.characters, cat, {
      type: 'interact',
      actorId: actor.id,
      cost: p.cost,
      note: '容器取放：' + p.name,
    })
    next.world.encounters = next.world.encounters.map((e) =>
      e.id === encounter.id ? result.encounter : e,
    )
  } else {
    const budget = explorationMember(a, token.id)
    if (a.exploration?.status === 'active' && !budget) throw new RoomError('角色未加入探索名单')
    if (budget) {
      assertExplorationReady(next.world, a, budget, cat)
      explorationSpend(
        budget,
        p.cost === 'free' ? (budget.interaction ? 'interaction' : 'action') : p.cost,
      )
      a.exploration!.acted = true
      budget.trail = []
    }
  }
  validateInventory(c, cat)
  c.revision++
  c.updatedAt = new Date().toISOString()
  room.world = next.world
  room.worldRevision++
  room.events.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    sessionId: member.id,
    characterId: c.id,
    detail: `${c.build.name} · ${action.operation === 'put' ? '放入' : '领取'} · ${p.name}`,
  })
}
