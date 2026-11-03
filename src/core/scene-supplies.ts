import type { Adventure, AdventureState, MapWorld, MapScene } from './map-types'
import type { Catalogue } from './engine'
import type {
  SceneEffectCast,
  SceneEffectAction,
  SceneEffect,
} from '../persistence/scene-effects-schema'
import type { SupplyBatch, SupplyContainer } from '../persistence/scene-supply-schema'
import { sceneSuppliesSchema, supplyCastSchema } from '../persistence/scene-supply-schema'
import { sceneEffects, tokenPoint, endSceneEffect, anchoredGeometry } from './scene-effects'
import { geometryContains, sceneCenter, volumeRay } from './scene-effect-geometry'
import { physicalPropagation } from './scene-propagation'
import { magicCrossing, magicDistance } from './scene-magic'
import { m1Entity } from './m1-utility'
import { m3GroundAt } from './m3-ground'
import { m3State } from './m3-world-cast'

export const M4_SUPPLY_SPELLS = ['create-or-destroy-water', 'create-food-and-water'] as const
export const isSupplySpell = (id: string) => (M4_SUPPLY_SPELLS as readonly string[]).includes(id)
/** Food ounces and fluid ounces are separate integer quantities. They never
 * share a floating point pool or turn into free healing/rations. */
export const supplyState = (a: Adventure) =>
  (sceneEffects(a).supplies ??= sceneSuppliesSchema.parse({}))
export function containerPlace(
  w: MapWorld,
  a: Adventure,
  c: SupplyContainer,
): import('./scene-effect-geometry').ScenePoint & { sceneId: string; ownerId?: string } {
  if (!c) throw Error('补给引用的真实容器不存在')
  if (c.objectId) {
    const o = a.m3?.entities.find((o) => o.id === c.objectId && o.enabled)
    if (!o) throw Error('容器实际物件已移除')
    return {
      sceneId: o.sceneId,
      x: o.x + 0.5,
      y: o.y + 0.5,
      height: o.height,
      layer: o.layer ?? 'material',
    }
  }
  const dropped = a.scenes.flatMap((s) =>
    (s.groundItems ?? [])
      .filter(
        (g) =>
          g.enabled &&
          (!c.ownerId || !!c.groundItemId) &&
          (!c.groundItemId || g.id === c.groundItemId) &&
          g.quantity === 1 &&
          (g.inventoryState?.instanceId ?? g.inventoryInstanceId) === c.instanceId,
      )
      .map((g) => ({
        sceneId: s.id,
        x: g.x + 0.5,
        y: g.y + 0.5,
        height: m3GroundAt(a, s, g),
        layer: 'material' as const,
      })),
  )
  if (dropped.length === 1) return dropped[0]!
  const owners = [
    ...w.characters.map((c) => ({ id: c.id, rows: c.inventory })),
    ...(a.ai?.npcs ?? []).map((n) => ({
      id: n.characterId ?? n.id,
      rows: (n.consumables ?? []).map((r) => ({
        instanceId: r.id,
        quantity: r.quantity - (n.consumablesUsed?.[r.id] ?? 0),
      })),
    })),
  ]
  const expectedOwner = c.ownerId ? (m1Entity(w, a, c.ownerId)?.id ?? c.ownerId) : undefined
  const hits = owners
    .filter((o) => !expectedOwner || o.id === expectedOwner)
    .flatMap((o) =>
      o.rows
        .filter((r) => r.instanceId === c.instanceId && r.quantity > 0)
        .map((row) => ({ owner: o.id, row })),
    )
  if (hits.length !== 1 || hits[0]!.row.quantity !== 1)
    throw Error('容器须为唯一、数量1的实际库存实例，不能用堆叠或丢失物品承载')
  const entity = m1Entity(w, a, hits[0]!.owner),
    t = entity?.token,
    s = a.scenes.find((s) => t && s.tokens.includes(t))
  if (!t || !s) throw Error('容器持有人不在可定位场景')
  return { ...tokenPoint(t), sceneId: s.id, ownerId: entity!.id }
}
export function batchPlace(w: MapWorld, a: Adventure, b: SupplyBatch) {
  if (b.liquidId || b.pileId) {
    const o = a.m3?.entities.find((o) => o.id === (b.liquidId ?? b.pileId) && o.enabled)
    if (!o) throw Error('实际液体已不存在')
    return {
      sceneId: o.sceneId,
      x: o.x + 0.5,
      y: o.y + 0.5,
      height: o.height,
      layer: o.layer ?? 'material',
    }
  }
  return b.containerId
    ? containerPlace(
        w,
        a,
        supplyState(a).containers.find((c) => c.id === b.containerId)!,
      )
    : {
        ...b.point!,
        x: b.point!.x + 0.5,
        y: b.point!.y + 0.5,
        sceneId: b.sceneId,
        layer: b.layer ?? 'material',
      }
}
function room(
  w: MapWorld,
  a: Adventure,
  c: SupplyContainer,
  kind: 'water' | 'food',
  units: number,
) {
  containerPlace(w, a, c)
  if (!c.open) throw Error('容器必须实际打开')
  const used = supplyState(a)
    .batches.filter((b) => b.containerId === c.id && b.kind === kind)
    .reduce((n, b) => n + b.units, 0)
  if (used + units > (kind === 'water' ? c.waterCapacity : c.foodCapacity))
    throw Error('容器真实容量不足；请减少数量或另选容器／明确地面')
}
export function validateSupplyCast(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  id: string,
  op: SceneEffectCast,
  slot: number,
) {
  const caster = m1Entity(w, a, op.casterId)!,
    choice = supplyCastSchema.parse(op.supply),
    state = supplyState(a)
  if (id === 'create-food-and-water' ? choice.branch !== 'food' : choice.branch === 'food')
    throw Error('所选水／粮分支与实际法术不符')
  const water = choice.branch === 'food' ? 3840 : (choice.waterUnits ?? slot * 1280)
  if (choice.branch !== 'food' && (water < 1 || water > slot * 1280))
    throw Error('造水／枯水数量须为正且不超过每环10加仑')
  const container = choice.containerId
      ? state.containers.find((c) => c.id === choice.containerId)
      : undefined,
    foodContainer = choice.foodContainerId
      ? state.containers.find((c) => c.id === choice.foodContainerId)
      : undefined
  if ((choice.containerId && !container) || (choice.foodContainerId && !foodContainer))
    throw Error('请选择已登记的真实容器')
  if (['create-water', 'destroy-water'].includes(choice.branch) && !container)
    throw Error('造水／枯水须选择打开的真实容器')
  if (choice.branch === 'create-water' && container) room(w, a, container, 'water', water)
  if (choice.branch === 'destroy-water' && container) {
    if (!container.open) throw Error('容器必须打开')
    if (
      state.batches
        .filter((b) => b.containerId === container.id && b.kind === 'water')
        .reduce((n, b) => n + b.units, 0) < water
    )
      throw Error('容器内实际水量不足，不会虚构水量')
  }
  if (choice.branch === 'food') {
    if (container) room(w, a, container, 'water', 3840)
    if (foodContainer) room(w, a, foodContainer, 'food', 720)
  }
  const needGround = choice.branch === 'food' && (!container || !foodContainer),
    needArea = ['rain', 'clear-fog'].includes(choice.branch)
  if ((needGround || needArea) && op.points.length !== 1)
    throw Error('须明确一个真实地面／区域落点')
  const places = [
    ...(container ? [containerPlace(w, a, container)] : []),
    ...(foodContainer ? [containerPlace(w, a, foodContainer)] : []),
    ...(needGround || needArea
      ? op.points.map((p) => ({
          ...p,
          x: p.x + 0.5,
          y: p.y + 0.5,
          sceneId: s.id,
          layer: 'material' as const,
        }))
      : []),
  ]
  for (const p of places) {
    if (
      p.sceneId !== s.id ||
      (p.layer ?? 'material') !== (caster.token!.spatial?.layer ?? 'material') ||
      magicDistance(tokenPoint(caster.token!), p, s.grid.feet) > 30 ||
      !physicalPropagation(a, s, tokenPoint(caster.token!), p, 'effect').clear
    )
      throw Error('水／粮目标须在真实同空间30尺内且无完全遮挡')
    magicCrossing(w, a, s, tokenPoint(caster.token!), p, caster.id, { spellLevel: slot })
  }
  if (needGround && op.points[0]!.height !== m3GroundAt(a, s, op.points[0]!))
    throw Error('食物和水须放在真实地面／平台')
  return {
    choice,
    locations: [{ x: places[0]!.x - 0.5, y: places[0]!.y - 0.5, height: places[0]!.height }],
    water,
  }
}
export function addSupplyBatch(w: MapWorld, a: Adventure, b: SupplyBatch) {
  const state = supplyState(a)
  if (state.batches.length >= 5000) throw Error('补给批次已满，请先归档')
  if (b.kind === 'water' && b.point) {
    const id = crypto.randomUUID()
    m3State(a).entities.push({
      id,
      sceneId: b.sceneId,
      name: '实际淡水',
      kind: 'liquid',
      ...b.point,
      layer: b.layer ?? 'material',
      width: 5,
      depth: 5,
      heightFeet: 0.1,
      weight: (b.units / 128) * 8,
      loose: true,
      enabled: true,
      hidden: b.hidden,
    })
    b.liquidId = id
  }
  if (b.kind === 'food' && b.point) {
    const id = crypto.randomUUID()
    m3State(a).entities.push({
      id,
      sceneId: b.sceneId,
      name: b.appearance,
      kind: 'object',
      ...b.point,
      layer: b.layer ?? 'material',
      width: 5,
      depth: 5,
      heightFeet: 0.5,
      weight: b.units / 16,
      loose: true,
      enabled: true,
      hidden: b.hidden,
    })
    b.pileId = id
  }
  state.batches.push(b)
}
function add(
  w: MapWorld,
  a: Adventure,
  e: SceneEffect,
  kind: 'water' | 'food',
  units: number,
  containerId: string | undefined,
  appearance: string,
  point?: SceneEffectCast['points'][number],
) {
  addSupplyBatch(w, a, {
    id: crypto.randomUUID(),
    castId: e.castId,
    clockSourceId: e.clockSourceId,
    layer: e.layer,
    kind,
    units,
    sceneId: e.sceneId,
    ...(containerId
      ? { containerId }
      : { point: point ?? { x: e.geometry!.x, y: e.geometry!.y, height: e.geometry!.height } }),
    createdHour: e.createdHour,
    ...(kind === 'food' ? { spoilsAt: e.createdHour + 24 } : {}),
    rotten: false,
    appearance,
    origin: 'spell',
    hidden: false,
  })
}
export function applySupplyCast(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  op: SceneEffectCast,
) {
  const choice = supplyCastSchema.parse(op.supply),
    state = supplyState(a),
    units = choice.waterUnits ?? e.slotLevel * 1280
  delete e.light
  e.concentration = false
  e.status = 'ended'
  e.reason = '瞬间物理结果已写入真实补给／环境，不随专注或解除撤回'
  if (choice.branch === 'create-water') add(w, a, e, 'water', units, choice.containerId, '干净的水')
  else if (choice.branch === 'food') {
    add(w, a, e, 'water', 3840, choice.containerId, '淡水', op.points[0])
    add(w, a, e, 'food', 720, choice.foodContainerId, choice.appearance, op.points[0])
  } else if (choice.branch === 'destroy-water') {
    let left = units
    for (const b of state.batches.filter(
      (b) => b.containerId === choice.containerId && b.kind === 'water',
    )) {
      const take = Math.min(left, b.units)
      b.units -= take
      left -= take
      if (!left) break
    }
  } else {
    const side = 30 + (e.slotLevel - 1) * 5,
      g = { ...e.geometry!, shape: 'cube' as const, size: side, heightFeet: side }
    e.geometry = g
    for (const other of sceneEffects(a).regions) {
      const current = anchoredGeometry(w, a, other)
      if (!current || current.scene.id !== s.id || other.status !== 'active') continue
      if (
        choice.branch === 'rain' &&
        other.spellId === 'mundane-light' &&
        other.light?.flame &&
        !other.covered &&
        !other.light.protected &&
        geometryContains(g, sceneCenter(current.geometry), s.grid.feet) &&
        physicalPropagation(a, s, sceneCenter(g), sceneCenter(current.geometry), 'effect').clear
      )
        endSceneEffect(a, other, '造水降雨浇灭实际外露普通火焰')
      if (
        choice.branch === 'clear-fog' &&
        ['fog-cloud', 'stinking-cloud'].includes(other.spellId) &&
        other.geometry &&
        (other.layer ?? 'material') === (e.layer ?? 'material')
      ) {
        const c = sceneCenter(g),
          x0 = c.x - side / s.grid.feet / 2,
          y0 = c.y - side / s.grid.feet / 2,
          x1 = x0 + side / s.grid.feet,
          y1 = y0 + side / s.grid.feet
        other.geometry.cuts ??= []
        for (let y = Math.floor(y0); y < Math.ceil(y1); y++)
          for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
            const left = Math.max(x, x0),
              top = Math.max(y, y0),
              right = Math.min(x + 1, x1),
              bottom = Math.min(y + 1, y1),
              point = {
                x: (left + right) / 2,
                y: (top + bottom) / 2,
                height: c.height,
                layer: e.layer,
              }
            if (
              !volumeRay(
                other.geometry,
                point,
                { ...point, height: c.height + side },
                s.grid.feet,
              ) ||
              !physicalPropagation(a, s, c, point, 'effect').clear
            )
              continue
            try {
              magicCrossing(w, a, s, c, point, e.sourceId, { spellLevel: e.slotLevel })
            } catch {
              continue
            }
            if (other.geometry.cuts.length >= 200) throw Error('局部移除记录已满，请先由GM整理区域')
            other.geometry.cuts.push({
              x: left,
              y: top,
              height: c.height,
              width: (right - left) * s.grid.feet,
              depth: (bottom - top) * s.grid.feet,
              heightFeet: side,
            })
          }
      }
    }
    if (choice.branch === 'rain')
      for (const object of a.m3?.entities ?? [])
        if (
          object.enabled &&
          object.sceneId === s.id &&
          !object.boundCharacterId &&
          geometryContains(
            g,
            { x: object.x + 0.5, y: object.y + 0.5, height: object.height },
            s.grid.feet,
          ) &&
          physicalPropagation(
            a,
            s,
            sceneCenter(g),
            { x: object.x + 0.5, y: object.y + 0.5, height: object.height },
            'effect',
          ).clear
        )
          object.effects = object.effects?.filter((f) => f.key !== 'burning')
  }
}
export const supplyOperation = (s: string) =>
  ['supply-container', 'supply-seed', 'supply-transfer', 'supply-consume'].includes(s)
export function applySupplyOperation(
  w: MapWorld,
  a: Adventure,
  op: SceneEffectAction,
  cat: Catalogue,
  forceId?:string,
) {
  const state = supplyState(a)
  if (op.operation === 'supply-container') {
    const c = { ...op.container }
    const located = containerPlace(w, a, c)
    if (c.instanceId && located.ownerId) c.ownerId = located.ownerId
    const old = state.containers.find((x) => x.id === c.id)
    if (
      state.containers.some(
        (x) =>
          x.id !== c.id &&
          ((x.objectId && x.objectId === c.objectId) ||
            (x.instanceId && x.instanceId === c.instanceId && x.ownerId === c.ownerId)),
      )
    )
      throw Error('同一真实容器不能重复登记容量')
    if (
      old &&
      (old.objectId !== c.objectId || old.instanceId !== c.instanceId || old.ownerId !== c.ownerId)
    )
      throw Error('容器已有稳定实体绑定，不能换壳复制')
    const at = state.containers.indexOf(old!)
    if (at < 0) state.containers.push(c)
    else state.containers[at] = c
    for (const kind of ['water', 'food'] as const)
      if (
        state.batches
          .filter((b) => b.containerId === c.id && b.kind === kind)
          .reduce((n, b) => n + b.units, 0) > (kind === 'water' ? c.waterCapacity : c.foodCapacity)
      )
        throw Error('新容量不能小于实际已存数量')
    return 'GM已核实容器实体、开合与容量'
  }
  if (op.operation === 'supply-seed') {
    const c = state.containers.find((c) => c.id === op.containerId)
    if (!c) throw Error('真实容器不存在')
    room(w, a, c, op.kind, op.units)
    const clock = w.characters.find((c) => a.party.includes(c.id) && c.runtime)
    if (!clock) throw Error('缺少真实时钟')
    state.batches.push({
      id: crypto.randomUUID(),
      castId: crypto.randomUUID(),
      clockSourceId: clock.id,
      kind: op.kind,
      units: op.units,
      sceneId: c.sceneId,
      containerId: c.id,
      createdHour: clock.runtime!.hours ?? 0,
      rotten: false,
      appearance: op.kind === 'water' ? 'GM核实已有水' : 'GM核实已有食物',
      origin: 'scenario',
      hidden: c.hidden,
    })
    return '已登记已有实物数量，未执行法术或发放角色资源'
  }
  if (op.operation !== 'supply-transfer' && op.operation !== 'supply-consume')
    throw Error('未知补给操作')
  if (state.receipts.some((r) => r.id === op.receipt))
    throw Error('本次补给请求已处理，不能重复领取／消耗')
  const b = state.batches.find((b) => b.id === op.batchId),
    actor = m1Entity(w, a, op.actorId),
    place = b && batchPlace(w, a, b),
    scene = a.scenes.find((s) => s.id === place?.sceneId),
    force=forceId===op.actorId?a.summons?.instances.find(i=>i.id===forceId&&i.kind==='force'&&i.state==='present'&&i.control==='controlled'&&(i.forceState?.hp??0)>0):undefined,
    point=actor?.token?tokenPoint(actor.token):force?.position?{x:force.position.x+.5,y:force.position.y+.5,height:force.position.spatial.height,layer:force.position.spatial.layer,anchorId:force.position.spatial.anchorId}:undefined,
    operatorValid=!!scene&&(force?force.position?.sceneId===scene.id:!!actor?.token&&!actor.dead&&actor.state.hp>0&&scene.tokens.includes(actor.token))
  if (
    !b ||
    !point ||
    !operatorValid ||
    !scene ||
    !place ||
    place.layer !== (point!.layer ?? 'material') ||
    magicDistance(point!, place, scene.grid.feet) > 5 ||
    !physicalPropagation(a, scene, point!, place, 'effect').clear ||
    b.units < op.units ||
    b.hidden
  )
    throw Error('须有存活人物在5尺内接触可用的真实补给，数量不能超出库存')
  if (b.containerId && !state.containers.find((c) => c.id === b.containerId)?.open)
    throw Error('先打开补给容器')
  if (op.operation === 'supply-consume') {
    if (b.kind === 'food' && b.rotten) throw Error('该批食物已经腐败，不能作为有效口粮')
    b.units -= op.units
  } else {
    const dest = state.containers.find((c) => c.id === op.containerId)
    if (!dest || dest.id === b.containerId) throw Error('请选择另一实际容器')
    const p = containerPlace(w, a, dest)
    if (
      p.sceneId !== scene.id ||
      p.layer !== (point!.layer ?? 'material') ||
      magicDistance(point!, p, scene.grid.feet) > 5 ||
      !physicalPropagation(a, scene, point!, p, 'effect').clear
    )
      throw Error('接收容器须在本人同层5尺内且可实际接触')
    room(w, a, dest, b.kind, op.units)
    b.units -= op.units
    state.batches.push({
      ...structuredClone(b),
      id: crypto.randomUUID(),
      units: op.units,
      containerId: dest.id,
      point: undefined,
      liquidId: undefined,
      pileId: undefined,
      sceneId: p.sceneId,
    })
  }
  if (state.receipts.length >= 10000) throw Error('补给账本已满')
  state.receipts.push({
    id: op.receipt,
    kind: op.operation,
    batchId: b.id,
    actorId: actor?.id??force!.id,
    units: op.units,
    at: w.characters.find((c) => c.id === b.clockSourceId)?.runtime?.hours ?? b.createdHour,
  })
  reconcileSupplies(w, a)
  return '已按原批次执行一次；未复制、刷新保鲜期或自动治疗'
}
export function assertSupplyInventoryChange(
  w: MapWorld,
  characterId: string,
  command: import('./runtime').RuntimeCommand,
) {
  if (command.type !== 'item-remove') return
  for (const a of w.adventures)
    for (const c of a.sceneEffects?.supplies?.containers ?? [])
      if (
        c.instanceId === command.instanceId &&
        (!c.ownerId || c.ownerId === characterId) &&
        w.characters
          .find((ch) => ch.id === characterId)
          ?.inventory.some((r) => r.instanceId === c.instanceId) &&
        a.sceneEffects?.supplies?.batches.some((b) => b.containerId === c.id && b.units > 0)
      )
        throw Error('该容器仍装有实际补给，请先转移／消耗内容；丢弃或交给他人保留原实例')
}
export function reconcileSupplies(w: MapWorld, a: Adventure) {
  for (const b of a.sceneEffects?.supplies?.batches ?? []) {
    if (b.containerId) {
      const c = a.sceneEffects?.supplies?.containers.find((c) => c.id === b.containerId),
        o = c?.objectId ? a.m3?.entities.find((o) => o.id === c.objectId) : undefined
      if (c)
        try {
          const position = containerPlace(w, a, c)
          b.sceneId = c.sceneId = position.sceneId
        } catch {
          /* Unplaced holders retain their saved location; disabled objects spill below. */
        }
      if (o && !o.enabled) {
        b.hidden = b.hidden || !!c?.hidden || o.hidden
        b.containerId = undefined
        b.sceneId = o.sceneId
        b.point = { x: o.x, y: o.y, height: o.height }
        if (b.kind === 'water' && b.units) {
          const id = crypto.randomUUID()
          m3State(a).entities.push({
            id,
            sceneId: b.sceneId,
            name: '泼洒的实际水',
            kind: 'liquid',
            ...b.point,
            width: 5,
            depth: 5,
            heightFeet: 0.1,
            weight: (b.units / 128) * 8,
            enabled: true,
            hidden: b.hidden,
            loose: true,
          })
          b.liquidId = id
        }
      }
    }
    const now = w.characters.find((c) => c.id === b.clockSourceId)?.runtime?.hours ?? b.createdHour
    if (b.kind === 'food' && b.spoilsAt !== undefined && now >= b.spoilsAt) b.rotten = true
    if (b.liquidId || b.pileId) {
      const object = a.m3?.entities.find((o) => o.id === (b.liquidId ?? b.pileId))
      if (object) {
        if (!object.enabled) b.units = 0
        object.enabled = b.units > 0
        object.weight = b.kind === 'food' ? b.units / 16 : (b.units / 128) * 8
      }
    }
  }
}

/** Archive validation is read-only: never refills, expires or spills on import. */
export function validateSupplies(w: MapWorld, a: AdventureState) {
  const state = a.sceneEffects?.supplies
  if (!state) return
  for (const rows of [state.containers, state.batches, state.receipts])
    if (new Set(rows.map((r) => r.id)).size !== rows.length) throw Error('补给实例／凭据ID重复')
  for (const c of state.containers) {
    if (
      state.containers.some(
        (other) =>
          other.id !== c.id &&
          ((c.objectId && other.objectId === c.objectId) ||
            (c.instanceId && other.instanceId === c.instanceId && other.ownerId === c.ownerId)),
      )
    )
      throw Error('同一真实容器被重复登记')
    for (const kind of ['water', 'food'] as const)
      if (
        state.batches
          .filter((b) => b.containerId === c.id && b.kind === kind)
          .reduce((n, b) => n + b.units, 0) > (kind === 'water' ? c.waterCapacity : c.foodCapacity)
      )
        throw Error('实际补给超出容器容量')
    if (state.batches.some((b) => b.containerId === c.id && b.units > 0))
      containerPlace(w, a as Adventure, c)
  }
  for (const b of state.batches) {
    if (
      !w.characters.some((c) => c.id === b.clockSourceId) ||
      !a.scenes.some((s) => s.id === b.sceneId) ||
      (b.containerId && !state.containers.some((c) => c.id === b.containerId))
    )
      throw Error('补给缺少真实时钟、场景或容器')
    if (
      b.units &&
      (b.liquidId || b.pileId) &&
      !a.m3?.entities.some((o) => o.id === (b.liquidId ?? b.pileId) && o.enabled)
    )
      throw Error('实际补给物件引用缺失')
  }
}
