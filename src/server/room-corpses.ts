import { randomUUID } from 'node:crypto'
import { dropNpcEquipment } from '../core/m5-equipment'
import { pickupGround, newGroundItem } from '../core/ground-items'
import { assertGmActionControl } from './gm-control'
import type { Room, RoomMember } from '../online/protocol'
import { catalogue, clone } from '../core/engine'
import { srd } from '../content/srd'
import { m1Entity, assertM1InventoryChange } from '../core/m1-utility'
import { distance } from '../core/map'
import { sightLine } from '../core/map-spatial'
import { fogMapAllowed, fogEntityAllowed } from './fog'
import { explorationMember, assertExplorationReady, explorationSpend } from '../core/exploration'
import { applyCombat } from '../core/combat'
import { validateInventory, runtimeDerived } from '../core/runtime'

export type CorpseLoot = {
  source: 'inventory' | 'stock' | 'consumable' | 'coins' | 'equipment'
  id: string
  itemId: string
  name: string
  quantity: number
  blocked?: string
}
export interface CorpseView {
  id: string
  entityId: string
  name: string
  x: number
  y: number
  inspectable: boolean
  recordId?: string
  loot: CorpseLoot[]
}
function corpseSource(room: Room, id: string) {
  const a = room.world.adventures[0],
    s = a?.scenes.find((s) => s.id === a.activeSceneId)
  const token = s?.defeatedTokens?.find((t) => t.id === id)
  const entity =
    token &&
    a &&
    m1Entity(room.world, a, token.npcId ?? token.characterId ?? token.actorId ?? token.id)
  if (!a || !s || !token || !entity?.dead) return
  return { a, s, token, entity }
}
function lootRows(room: Room, source: NonNullable<ReturnType<typeof corpseSource>>): CorpseLoot[] {
  const { entity } = source,
    cat = catalogue([srd, ...room.world.packs]),
    rows: CorpseLoot[] = []
  const anchored = (id: string) =>
    room.world.adventures.some(
      (a) =>
        a.m1Utility?.objects.some((o) => o.inventoryInstanceId === id) ||
        a.sceneEffects?.supplies?.containers.some((o) => o.instanceId === id) ||
        a.sceneEffects?.regions.some(
          (o) => o.status === 'active' && o.anchor.kind === 'inventory' && o.anchor.id === id,
        ),
    )
  const name = (id: string) =>
    [...cat.items, ...(entity.c?.build.customItems ?? [])].find((i) => i.id === id)?.name ?? id
  if (entity.c) {
    for (const item of entity.c.inventory.filter((i) => i.quantity > 0))
      rows.push({
        source: 'inventory',
        id: item.instanceId,
        itemId: item.itemId,
        name: name(item.itemId),
        quantity: item.quantity,
        ...(protectedInventory(room, source, item.instanceId)
          ? { blocked: '绑定、装备或特殊物品请GM在原装备／物品入口解除后转移' }
          : {}),
      })
  }
  if (entity.n) {
    for (const item of entity.n.stock.filter((i) => i.quantity > 0))
      rows.push({
        source: 'stock',
        id: item.id ?? item.itemId,
        itemId: item.itemId,
        name: name(item.itemId),
        quantity: item.quantity,
        ...(item.inventoryState && anchored(item.inventoryState.instanceId)
          ? { blocked: '绑定物件请GM在原入口核对转移' }
          : {}),
      })
    for (const item of entity.n.consumables ?? []) {
      const quantity = Math.max(0, item.quantity - (entity.n.consumablesUsed?.[item.id] ?? 0))
      if (quantity)
        rows.push({
          source: 'consumable',
          id: item.id,
          itemId: item.itemId,
          name: name(item.itemId),
          quantity,
        })
    }
  }
  if (!entity.c)
    for (const gear of entity.body?.equipment ?? []) {
      if (!gear.held) continue
      const object = source.a.m3?.entities.find(
        (o) => o.id === gear.objectId && o.enabled && o.sceneId === source.s.id,
      )
      rows.push({
        source: 'equipment',
        id: gear.id,
        itemId: gear.itemId,
        name: name(gear.itemId),
        quantity: 1,
        ...(!object ? { blocked: '实际装备物件尚未核对，请GM登记' } : {}),
      })
    }
  const coins = entity.c?.coins ?? entity.n?.coins ?? 0
  if (coins > 0)
    rows.push({ source: 'coins', id: 'coins', itemId: '', name: '金币', quantity: coins })
  return rows
}
function protectedInventory(
  room: Room,
  source: NonNullable<ReturnType<typeof corpseSource>>,
  id: string,
) {
  const c = source.entity.c!,
    row = c.inventory.find((i) => i.instanceId === id)!
  return (
    row.equipped ||
    !!row.containerId ||
    c.inventory.some((i) => i.containerId === id) ||
    !!row.specialWeapon ||
    !!row.spellEnchantments?.length ||
    !!row.consumable ||
    room.world.adventures.some(
      (a) =>
        a.m1Utility?.objects.some((o) => o.inventoryInstanceId === id) ||
        a.sceneEffects?.supplies?.containers.some((o) => o.instanceId === id) ||
        a.sceneEffects?.regions.some(
          (o) => o.status === 'active' && o.anchor.kind === 'inventory' && o.anchor.id === id,
        ),
    ) ||
    c.runtime?.effects?.some((f) => f.weapon?.instanceId === id)
  )
}
export function projectCorpses(room: Room, member: RoomMember): CorpseView[] {
  if (member.revoked) return []
  const a = room.world.adventures[0],
    s = a?.scenes.find((s) => s.id === a.activeSceneId)
  return (s?.defeatedTokens ?? []).flatMap((t) => {
    const source = corpseSource(room, t.id)
    if (
      !source ||
      (member.role !== 'gm' &&
        (t.hidden ||
          (s!.fog?.mode === 'enclosed'
            ? !fogMapAllowed(room, member, s!.id, t)
            : !fogEntityAllowed(room, member, s!.id, t))))
    )
      return []
    const inspectable =
      member.role === 'gm' ||
      (s!.tokens.some(
        (from) =>
          member.characterIds.includes(from.characterId ?? '') && distance(s!, from, t) <= 5,
      ) &&
        fogEntityAllowed(room, member, s!.id, t))
    return [
      {
        id: t.id,
        entityId: source.entity.id,
        recordId: a!.m1Utility?.corpses.find((c) => c.entityId === source.entity.id && c.dead)?.id,
        name: source.entity.name + '的遗体',
        x: t.x,
        y: t.y,
        inspectable,
        loot: inspectable ? lootRows(room, source) : [],
      },
    ]
  })
}
export function lootCorpse(
  room: Room,
  member: RoomMember,
  command: {
    corpseId: string
    characterId: string
    source: CorpseLoot['source']
    itemId: string
    quantity: number
  },
) {
  const source = corpseSource(room, command.corpseId),
    c = room.world.characters.find((c) => c.id === command.characterId)
  if (
    !source ||
    !c ||
    member.revoked ||
    (member.role !== 'gm' && !member.characterIds.includes(c.id))
  )
    throw Error('无权搜刮该遗体或操控该角色')
  assertGmActionControl(room, member, {
    kind: 'runtime',
    characterId: c.id,
    command: { type: 'heal', amount: 0 },
  })
  const { a, s, token, entity } = source,
    cat = catalogue([srd, ...room.world.packs])
  const state = runtimeDerived(c, cat)
  if (
    state.conditions.some((id) =>
      ['incapacitated', 'unconscious', 'paralyzed', 'petrified', 'stunned'].includes(id),
    )
  )
    throw Error('当前状态不能搜刮')
  const from = s.tokens.find((t) => t.characterId === c.id && !t.hidden)
  if (!from || !c.runtime || c.runtime.hp <= 0 || c.runtime.death?.dead)
    throw Error('须由场景内可行动角色搜刮')
  if (
    token.hidden ||
    !fogEntityAllowed(room, member, s.id, token) ||
    distance(s, from, token) > 5 ||
    !sightLine(s, from, token, 'blocksTargeting').clear
  )
    throw Error('请靠近可感知的遗体；不能隔墙或未知房间搜刮')
  const row = lootRows(room, source).find(
    (r) => r.source === command.source && r.id === command.itemId,
  )
  if (
    !row ||
    row.blocked ||
    command.quantity <= 0 ||
    command.quantity > row.quantity ||
    (!Number.isInteger(command.quantity) && row.source !== 'coins')
  )
    throw Error(row?.blocked ?? '遗体库存已变化，请刷新后选择实际剩余数量')
  if (
    row.source !== 'coins' &&
    ![...cat.items, ...c.build.customItems].some((i) => i.id === row.itemId)
  )
    throw Error('接收方缺少物品规则定义，请GM先核对')
  if (row.source === 'inventory') {
    const original = [...cat.items, ...entity.c!.build.customItems].find((i) => i.id === row.itemId)
    const received = [...cat.items, ...c.build.customItems].find((i) => i.id === row.itemId)
    if (JSON.stringify(original) !== JSON.stringify(received))
      throw Error('双方物品定义不一致，请GM核对')
  }
  if (row.source === 'inventory')
    assertM1InventoryChange(room.world, entity.c!.id, {
      type: 'item-remove',
      instanceId: row.id,
      quantity: command.quantity,
    })
  if (row.source === 'stock') {
    const stock = entity.n!.stock.find((i) => (i.id ?? i.itemId) === row.id && i.quantity > 0)!
    if (stock.inventoryState) {
      const ground = newGroundItem(token, stock.itemId, row.name)
      ground.quantity = command.quantity
      ground.initialQuantity = command.quantity
      ground.inventoryState = {
        ...clone(stock.inventoryState),
        quantity: command.quantity,
        instanceId:
          command.quantity === stock.quantity ? stock.inventoryState.instanceId : randomUUID(),
      }
      ;(s.groundItems ??= []).push(ground)
      pickupGround(
        room.world,
        a,
        s,
        {
          type: 'ground-pickup',
          sceneId: s.id,
          itemId: ground.id,
          characterId: c.id,
          quantity: command.quantity,
          cost: room.world.encounters.some((e) => e.id === s.encounterId && e.phase === 'active')
            ? 'action'
            : 'free',
        },
        cat,
        () => {
          throw Error('遗体库存转移不应掷骰')
        },
        randomUUID(),
      )
      stock.quantity -= command.quantity
      if (stock.quantity) stock.inventoryState.quantity = stock.quantity
      else delete stock.inventoryState
      room.worldRevision++
      return
    }
  }
  if (row.source === 'equipment') {
    dropNpcEquipment(room.world, a, s, entity.id, row.id, cat)
    const ground = s.groundItems!.at(-1)!
    pickupGround(
      room.world,
      a,
      s,
      {
        type: 'ground-pickup',
        sceneId: s.id,
        itemId: ground.id,
        characterId: c.id,
        quantity: 1,
        cost: room.world.encounters.some((e) => e.id === s.encounterId && e.phase === 'active')
          ? 'action'
          : 'free',
      },
      cat,
      () => {
        throw Error('遗体装备领取不应掷骰')
      },
      randomUUID(),
    )
    room.worldRevision++
    return
  }
  const encounter = room.world.encounters.find(
    (e) => e.id === s.encounterId && e.phase === 'active',
  )
  if (
    room.world.encounters.some(
      (e) =>
        e.phase === 'active' &&
        e.id !== encounter?.id &&
        e.actors.some((t) => t.characterId === c.id),
    )
  )
    throw Error('角色正在其他战斗中')
  if (encounter) {
    const actor = encounter.actors.find((t) => t.characterId === c.id)
    if (!actor) throw Error('角色未加入当前遭遇')
    room.world.encounters = room.world.encounters.map((e) =>
      e.id === encounter.id
        ? applyCombat(e, room.world.characters, cat, {
            type: 'interact',
            actorId: actor.id,
            cost: 'action',
            note: '搜刮遗体',
          }).encounter
        : e,
    )
  } else {
    const budget = explorationMember(a, from.id)
    if (a.exploration?.status === 'active' && !budget) throw Error('角色未加入探索名单')
    if (budget) {
      assertExplorationReady(room.world, a, budget, cat)
      explorationSpend(budget, budget.interaction ? 'interaction' : 'action')
      a.exploration!.acted = true
      budget.trail = []
    }
  }
  if (row.source === 'coins') {
    c.coins += command.quantity
    if (entity.c) entity.c.coins -= command.quantity
    else entity.n!.coins -= command.quantity
  } else {
    const original =
      row.source === 'inventory'
        ? entity.c!.inventory.find((i) => i.instanceId === row.id)
        : undefined
    c.inventory.push({
      ...(original
        ? clone(original)
        : { itemId: row.itemId, source: '遗体搜刮', equipped: false, note: '' }),
      instanceId: randomUUID(),
      quantity: command.quantity,
      containerId: null,
      equipmentSlot: null,
      grip: null,
    })
    if (original) {
      original.quantity -= command.quantity
      entity.c!.inventory = entity.c!.inventory.filter((i) => i.quantity > 0)
    } else if (row.source === 'stock')
      entity.n!.stock.find((i) => (i.id ?? i.itemId) === row.id && i.quantity > 0)!.quantity -=
        command.quantity
    else entity.n!.consumables!.find((i) => i.id === row.id)!.quantity -= command.quantity
  }
  c.revision++
  c.updatedAt = new Date().toISOString()
  validateInventory(c, cat)
  if (entity.c) {
    entity.c.revision++
    entity.c.updatedAt = c.updatedAt
  }
  room.worldRevision++
}
