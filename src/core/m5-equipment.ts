import type { MapWorld, Adventure, MapScene } from './map-types'
import type { Catalogue } from './engine'
import type { SceneEffectAction } from '../persistence/scene-effects-schema'
import { m1Entity } from './m1-utility'
import { newGroundItem } from './ground-items'
import { isWeaponEnchantment } from './weapon-spell-persistence'
import { tokenPoint } from './scene-effects'
import { magicDistance } from './scene-magic'
export function registerNpcEquipment(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  op: Extract<SceneEffectAction, { operation: 'm5-equipment' }>,
  cat: Catalogue,
) {
  const t = m1Entity(w, a, op.actorId),
    o = a.m3?.entities.find(
      (o) => o.id === op.equipment.objectId && o.enabled && o.sceneId === s.id,
    ),
    item = cat.items.find((i) => i.id === op.equipment.itemId)
  if (
    !t?.body ||
    t.c ||
    !t.token ||
    !s.tokens.includes(t.token) ||
    !o ||
    item?.kind !== 'weapon' ||
    !op.equipment.attackIds.length ||
    op.equipment.attackIds.some(
      (id) => !t.body!.attacks.some((at) => at.id === id && !at.unarmed && at.kind !== 'spell'),
    )
  )
    throw Error('NPC装备须关联本场景实际物件、规则武器及真实武器攻击')
  if (w.characters.some((c) => c.inventory.some((r) => r.instanceId === o.inventoryInstanceId)))
    throw Error('物件仍在真实角色背包中；须先实际放下再移交NPC')
  if (
    magicDistance(
      tokenPoint(t.token),
      { x: o.x + 0.5, y: o.y + 0.5, height: o.height },
      s.grid.feet,
    ) > 5
  )
    throw Error('实际NPC须在物件触及范围内')
  if (
    t.body.equipment?.some(
      (g) => g.objectId !== o.id && g.attackIds.some((id) => op.equipment.attackIds.includes(id)),
    )
  )
    throw Error('一个实际攻击不能同时关联多件武器')
  const hands =
    (t.body.equipment ?? [])
      .filter((g) => g.held && g.objectId !== o.id && g.id !== op.equipment.id)
      .reduce(
        (n, g) =>
          n +
          (cat.items.find((i) => i.id === g.itemId)?.properties?.includes('two-handed') ? 2 : 1),
        0,
      ) + (t.body.effects.some((f) => f.key === 'flame-blade-held') ? 1 : 0)
  if (op.equipment.held && hands + (item.properties?.includes('two-handed') ? 2 : 1) > 2)
    throw Error('实际持握装备超过可用双手')
  if (
    op.equipment.held &&
    t.body.effects.some((f) => f.key === 'flame-blade-held') &&
    (item.properties?.includes('two-handed') ||
      t.body.equipment?.some((g) => g.held && g.objectId !== o.id))
  )
    throw Error('火焰刀已占手，没有足够空手持握该装备')
  const previous =
    a.ai?.npcs.flatMap(
      (n) => n.body?.equipment?.filter((g) => g.objectId === o.id).map((g) => ({ n, g })) ?? [],
    ) ?? []
  for (const { n, g } of previous) {
    const holder = m1Entity(w, a, n.id)
    if (!holder?.body) continue
    const effects = holder.body.effects.filter(
      (f) => isWeaponEnchantment(f) && f.weapon!.instanceId === g.id,
    )
    holder.body.effects = holder.body.effects.filter(
      (f) =>
        !effects.includes(f) && !(f.key === 'shillelagh' && f.note === g.id && holder.id !== t.id),
    )
    if (holder.id !== t.id) g.held = false
    for (const f of effects)
      (t.body.effects ??= []).push({ ...f, weapon: { ...f.weapon!, instanceId: op.equipment.id } })
  }
  const ground = s.groundItems?.find(
    (g) =>
      g.enabled &&
      g.quantity === 1 &&
      (g.inventoryState?.instanceId ?? g.inventoryInstanceId) === o.inventoryInstanceId,
  )
  if (ground?.specialWeapon || ground?.inventoryState?.specialWeapon)
    throw Error('特殊武器须使用真实职业卡管理，不能转换为简明NPC武器而丢失能力')
  if (ground) {
    for (const f of ground.inventoryState?.spellEnchantments ?? [])
      t.body.effects.push({ ...f, weapon: { ...f.weapon!, instanceId: op.equipment.id } })
    ground.enabled = false
    ground.quantity = 0
    delete ground.inventoryState?.spellEnchantments
  }
  t.body.equipment = [
    ...(t.body.equipment ?? []).filter((g) => g.id !== op.equipment.id && g.objectId !== o.id),
    structuredClone(op.equipment),
  ]
  o.boundCharacterId = t.id
  o.inventoryInstanceId ??= op.equipment.id
  return '已登记并移交实际NPC装备；既有附魔随真实物件转移，未创建免费物品'
}
export function dropNpcEquipment(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  actorId: string,
  equipmentId: string,
  cat: Catalogue,
) {
  const t = m1Entity(w, a, actorId),
    gear = t?.body?.equipment?.find((g) => g.id === equipmentId),
    object = a.m3?.entities.find((o) => o.id === gear?.objectId && o.enabled),
    item = gear && cat.items.find((i) => i.id === gear.itemId)
  if (
    !t?.body ||
    !t.token ||
    ![...s.tokens, ...(s.defeatedTokens ?? [])].includes(t.token) ||
    !gear?.held ||
    !object ||
    !item
  )
    throw Error('须有当前实际持握、可移交的NPC武器')
  const instanceId = object.inventoryInstanceId ?? gear.id
  if (
    s.groundItems?.some(
      (g) => g.enabled && (g.inventoryState?.instanceId ?? g.inventoryInstanceId) === instanceId,
    ) ||
    w.characters.some((c) => c.inventory.some((r) => r.instanceId === instanceId))
  )
    throw Error('实际武器已在地面或角色背包，不能复制')
  const effects = t.body.effects.filter(
      (f) => isWeaponEnchantment(f) && f.weapon!.instanceId === gear.id,
    ),
    ground = newGroundItem(t.token, item.id, item.name)
  ground.inventoryState = {
    instanceId,
    itemId: item.id,
    quantity: 1,
    equipped: false,
    equipmentSlot: null,
    grip: null,
    source: '实际NPC装备移交',
    note: '由场景中已登记的实际NPC装备移交',
    ...(effects.length
      ? {
          spellEnchantments: structuredClone(effects).map((f) => ({
            ...f,
            weapon: { ...f.weapon!, instanceId },
          })),
        }
      : {}),
  }
  ;(s.groundItems ??= []).push(ground)
  t.body.effects = t.body.effects.filter(
    (f) => !effects.includes(f) && !(f.key === 'shillelagh' && f.note === gear.id),
  )
  gear.held = false
  object.boundCharacterId = undefined
  object.inventoryInstanceId = instanceId
  object.x = t.token.x
  object.y = t.token.y
  object.height = t.token.spatial?.height ?? 0
  const fact = a.sceneEffects?.m5?.metals.find((m) => m.objectId === object.id)
  if (fact) fact.contactIds = fact.contactIds.filter((id) => id !== t.id)
  return '实际NPC武器已放到地面，附魔实例保留；橡棍随放下结束'
}
