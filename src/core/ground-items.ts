import {itemSpellBusy} from './item-spells'
import {systemMessage} from '../shared/localization/system-messages'
import {stashWeaponEnchantments,restoreWeaponEnchantments} from './weapon-spell-persistence'
import {transferHutInventory} from './scene-magic-inventory'
import type { MapWorld, Adventure, MapScene, Position } from './map-types'
import type { GroundItem, SceneToolCommand } from './scene-tools-types'
import { applyRuntime, runtimeDerived, runtimeState, findItem } from './runtime'
import { inventoryName } from './special-weapons'
import { distance, inside } from './map'
import { sightLine } from './map-spatial'
import { applyCombat } from './combat'
import { assertExplorationReady, explorationMember, explorationSpend } from './exploration'
import { appendBroadcast, publicAudience } from './broadcast'
import { clone } from './engine'
import type { Catalogue } from './engine'
export const newGroundItem = (p: Position, itemId = 'torch', name = '火把'): GroundItem => ({
  id: crypto.randomUUID(),
  x: p.x,
  y: p.y,
  itemId,
  name,
  icon: '物',
  color: '#a86c42',
  note: '',
  initialQuantity: 1,
  quantity: 1,
  hidden: false,
  enabled: true,
  range: 5,
  requiresGM: false,
  cost: 'free',
})
export function pickupGround(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  c: Extract<SceneToolCommand, { type: 'ground-pickup' }>,
  cat: Catalogue,
  dice: (n: number) => number,
  actionId: string,
) {
  if (a.activeSceneId !== s.id) throw Error('只能拾取当前场景物品')
  const g = s.groundItems?.find((g) => g.id === c.itemId),
    t = s.tokens.find((t) => t.characterId === c.characterId && !t.hidden),
    index = world.characters.findIndex((p) => p.id === c.characterId),
    character = world.characters[index]
  if (!g || g.hidden || !g.enabled || !t || !character) throw Error('物品或角色不可操作')
  if (
    g.specialWeapon &&
    (c.quantity !== 1 ||
      g.quantity !== 1 ||
      (g.inventoryInstanceId &&
        character.inventory.some((r) => r.instanceId === g.inventoryInstanceId)))
  )
    throw Error('特殊武器只能整件拾取且实例不能重复')
  if (g.cost === 'action' && c.cost !== 'action') throw Error('该物品必须明确选择使用动作')
  if (!Number.isInteger(c.quantity) || c.quantity < 1 || g.quantity < c.quantity)
    throw Error('物品余量不足，请刷新后重新选择数量')
  if (!inside(s, g) || distance(s, t, g) > g.range || !sightLine(s, t, g, 'blocksTargeting').clear)
    throw Error('物品超出拾取距离或被阻隔，请先靠近')
  if (
    (character.npcOwnerId &&
      !a.ai?.npcs.some((n) => n.characterId === character.id && n.npcType === 'important')) ||
    runtimeDerived(character, cat).conditions.includes('incapacitated') ||
    runtimeState(character, cat).death.dead
  )
    throw Error('角色不能拾取物品')
  const e = world.encounters.find((e) => e.id === s.encounterId),
    cost = g.cost === 'action' ? 'action' : c.cost
  if (
    world.encounters.some(
      (other) =>
        other.phase === 'active' &&
        other.id !== e?.id &&
        other.actors.some((t) => t.characterId === character.id),
    )
  )
    throw Error('角色正在其他遭遇中')
  if (e?.phase === 'active') {
    const actor = e.actors.find((t) => t.characterId === character.id)
    if (!actor) throw Error('角色尚未参战')
    const result = applyCombat(
      e,
      world.characters,
      cat,
      { type: 'interact', actorId: actor.id, cost, note: '拾取' + g.name },
      dice,
    )
    world.encounters[world.encounters.indexOf(e)] = result.encounter
    world.characters = result.characters
  } else {
    const m = explorationMember(a, t.id)
    if (a.exploration && a.exploration.status !== 'closed' && !m)
      throw Error('探索未开放或该角色未加入名单')
    if (m) {
      assertExplorationReady(world, a, m, cat)
      explorationSpend(m, cost === 'action' ? 'action' : 'interaction')
      a.exploration!.acted = true
      m.trail = []
    }
  }
  if (
    g.customItem &&
    !cat.items.some((i) => i.id === g.itemId) &&
    !world.characters[index]!.build.customItems.some((i) => i.id === g.itemId)
  )
    world.characters[index]!.build.customItems.push(clone(g.customItem))
  if(g.inventoryState){
    const target=world.characters[index]!,snapshot=clone(g.inventoryState)
    const instanceId=c.quantity===g.quantity?snapshot.instanceId:crypto.randomUUID()
    if(world.characters.some(c=>c.inventory.some(r=>r.instanceId===instanceId)))throw Error('掉落物实例已存在于背包，请GM核对，不能复制物品')
    transferHutInventory(world,snapshot.instanceId,g.quantity,c.quantity,instanceId)
    target.inventory.push({...snapshot,instanceId,quantity:c.quantity,equipped:false,equipmentSlot:null,grip:null,containerId:null})
    for(const object of a.m3?.entities??[])if(!object.boundCharacterId&&object.sceneId===s.id&&object.x===g.x&&object.y===g.y&&object.inventoryInstanceId===snapshot.instanceId){object.boundCharacterId=target.id;object.inventoryInstanceId=instanceId}
    restoreWeaponEnchantments(target,target.inventory.at(-1)!)
    target.revision++;target.updatedAt=new Date().toISOString()
  }else world.characters[index] = applyRuntime(
    world.characters[index]!,
    cat,
    {
      type: 'item-add',
      itemId: g.itemId,
      quantity: c.quantity,
      purchase: false,
      note: s.name + ' · ' + g.name,
    },
    dice,
  )
  if(!g.inventoryState){const row=world.characters[index]!.inventory.at(-1);if(row)transferHutInventory(world,g.inventoryInstanceId??g.id,g.quantity,c.quantity,row.instanceId)}
  if (g.specialWeapon) {
    const row = world.characters[index]!.inventory.at(-1)!
    row.specialWeapon = clone(g.specialWeapon)
    if (g.inventoryInstanceId) row.instanceId = g.inventoryInstanceId
  }
  for(const effect of a.sceneEffects?.regions??[])if(effect.status==='active'&&effect.anchor.kind==='inventory'&&effect.anchor.id===(g.inventoryState?.instanceId??g.inventoryInstanceId))effect.anchor.ownerId=character.id
  for(const container of a.sceneEffects?.supplies?.containers??[])if(container.groundItemId===g.id){container.ownerId=character.id;container.groundItemId=undefined;container.instanceId=world.characters[index]!.inventory.at(-1)!.instanceId;container.sceneId=s.id}
  g.quantity -= c.quantity
  appendBroadcast(a, actionId, {
    message: systemMessage('ground.picked',{actor:character.build.name,item:g.name,quantity:c.quantity}),
    category: 'interaction',
    type: 'ground.picked',
    title: '拾取物品',
    text: `${character.build.name}拾取${g.name} ×${c.quantity}。`,
    sceneId: s.id,
    audience: publicAudience(),
    facts: { characterId: character.id, itemId: g.itemId, quantity: c.quantity },
  })
  return `${character.build.name}拾取${g.name} ×${c.quantity}`
}
export function dropGround(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  c: Extract<SceneToolCommand, { type: 'ground-drop' }>,
  cat: Catalogue,
  dice: (n: number) => number,
  actionId: string,
  mandatory=false,
) {
  if (a.activeSceneId !== s.id) throw Error('只能在当前场景放下物品')
  const index = world.characters.findIndex((p) => p.id === c.characterId),
    character = world.characters[index],
    token = s.tokens.find((t) => t.characterId === c.characterId && !t.hidden),
    row = character?.inventory.find((r) => r.instanceId === c.instanceId)
  if (
    !character ||
    !token ||
    !row ||
    row.quantity !== 1 ||
    row.equipped ||
    row.containerId ||
    character.inventory.some((r) => r.containerId === row.instanceId)
  )
    throw Error('请选择随身、未装备的单件物品，并先清空容器')
  if(!mandatory&&itemSpellBusy(character,row))throw Error('物品用于连续施法中，请先取消原施法')
  if (
    runtimeDerived(character, cat).conditions.includes('incapacitated') ||
    runtimeState(character, cat).death.dead
  )
    throw Error('失能或死亡时不能放下物品')
  if ((s.groundItems?.length ?? 0) >= 100) throw Error('地面物品已达场景容量上限')
  const item = findItem(character, cat, row.itemId)!,
    e = world.encounters.find((e) => e.id === s.encounterId)
  if(mandatory){ /* The original confirmed spell authorises this mandatory drop. */ }
  else if (e?.phase === 'active') {
    const actor = e.actors.find((a) => a.characterId === character.id)
    if (!actor) throw Error('角色尚未参战')
    const next = applyCombat(
      e,
      world.characters,
      cat,
      {
        type: 'interact',
        actorId: actor.id,
        cost: c.cost,
        note: '放下物品 ' + inventoryName(row, item.name),
      },
      dice,
    )
    world.encounters[world.encounters.indexOf(e)] = next.encounter
    world.characters = next.characters
  } else {
    const m = explorationMember(a, token.id)
    if (a.exploration && a.exploration.status !== 'closed' && !m)
      throw Error('探索未开放或角色不在名单')
    if (m) {
      assertExplorationReady(world, a, m, cat)
      explorationSpend(m, c.cost === 'action' ? 'action' : 'interaction')
      a.exploration!.acted = true
      m.trail = []
    }
  }
  stashWeaponEnchantments(world.characters[index]!,row)
  const ground = newGroundItem(token, row.itemId, inventoryName(row, item.name))
  const droppedId=row.quantity>1?crypto.randomUUID():row.instanceId
  transferHutInventory(world,row.instanceId,row.quantity,1,droppedId)
  ground.inventoryState={...clone(row),instanceId:droppedId,equipped:false,equipmentSlot:null,grip:null,containerId:null}
  for(const object of a.m3?.entities??[])if(object.boundCharacterId===character.id&&object.inventoryInstanceId===row.instanceId){delete object.boundCharacterId;object.inventoryInstanceId=droppedId;object.sceneId=s.id;object.x=token.x;object.y=token.y;object.height=token.spatial?.height??0}
  ground.note = row.note
  if (!cat.items.some((i) => i.id === item.id)) ground.customItem = clone(item)
  if (row.specialWeapon) {
    ground.specialWeapon = clone(row.specialWeapon)
    ground.inventoryInstanceId = row.instanceId
  }
  world.characters[index] = applyRuntime(
    world.characters[index]!,
    cat,
    {
      type: 'item-remove',
      instanceId: row.instanceId,
      quantity: 1,
      consume: false,
      note: '放在场景地面',
    },
    dice,
  )
  ;(s.groundItems ??= []).push(ground)
  for(const container of a.sceneEffects?.supplies?.containers??[])if(container.instanceId===row.instanceId&&(!container.ownerId||container.ownerId===character.id)){container.groundItemId=ground.id;container.ownerId=character.id;container.sceneId=s.id}
  appendBroadcast(a, actionId, {
    message: systemMessage('ground.dropped',{actor:character.build.name,item:ground.name}),
    category: 'interaction',
    type: 'ground.dropped',
    title: '放下物品',
    text: `${character.build.name}放下${ground.name}。`,
    sceneId: s.id,
    audience: publicAudience(),
    facts: { characterId: character.id, itemId: row.itemId, quantity: 1 },
  })
  return `${character.build.name}放下${ground.name}，保留独立物品配置`
}
