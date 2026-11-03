import type { AdventureState, MapWorld } from './map-types'
import {validateSupplies} from './scene-supplies'
/** Validate references without advancing clocks, ending spells or mutating an
 * imported archive/checkpoint. Reconciliation is a separate transaction. */
export function validateSceneEffects(a: AdventureState, world: MapWorld) {
  const state = a.sceneEffects
  if (!state) return
  validateSupplies(world,a)
  for (const rows of [state.regions, state.casts, state.events, state.objectAttacks])
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw Error('场景效果包含重复实例／记录ID')
  for (const e of state.regions) {
    if (e.status !== 'active') continue
    const scene = a.scenes.find((s) => s.id === e.sceneId)
    if (!scene || !world.characters.some((c) => c.id === e.clockSourceId))
      throw Error('有效场景效果缺少实际场景或时钟来源')
    if (!e.geometry && !e.requiresGeometry)
      throw Error('有效场景效果缺少几何；旧区域须明确标记待补登记')
    if(e.magic?.pointId&&!scene.points.some(p=>p.id===e.magic!.pointId&&p.enabled))
      throw Error('有效门锁／警戒／刻纹缺少启用的实际互动点')
    if (e.anchor.kind === 'object' && !a.m3?.entities.some((o) => o.id === e.anchor.id))
      throw Error('场景效果的实际物件引用缺失')
    if (
      e.anchor.kind === 'inventory' &&
      !world.characters.some(
        (c) =>
          (!e.anchor.ownerId || c.id === e.anchor.ownerId) &&
          c.inventory.some((i) => i.instanceId === e.anchor.id),
      ) &&
      !a.scenes.some((s) =>
        s.groundItems?.some(
          (g) =>
            (g.inventoryState?.instanceId ?? g.inventoryInstanceId) === e.anchor.id &&
            g.quantity > 0,
        ),
      )
    )
      throw Error('场景效果的实际单件库存／掉落物引用缺失')
    if (
      e.legacy && !e.magic?.migrated &&
      !world.encounters.some(
        (encounter) =>
          encounter.id === e.legacy!.encounterId &&
          encounter.zones?.some((z) => z.id === e.legacy!.zoneId),
      )
    )
      throw Error('旧区域兼容映射缺少原执行器实例')
  }
  for (const c of state.casts)
    if (
      !c.settled &&
      !c.canceled &&
      c.encounterId &&
      !world.encounters.some(
        (e) =>
          e.id === c.encounterId &&
          [e.pending, ...(e.reactionParents ?? [])].some((p) => p?.sceneEffectCastId === c.id),
      )
    )
      throw Error('待结算场景施法缺少原反应窗口')
  for(const h of state.hazards??[])if(!state.regions.some(e=>e.id===h.effectId)||!a.scenes.some(s=>s.id===h.sceneId))throw Error('区域后果缺少实际来源或场景')
  for(const r of state.routes??[])if(r.status==='paused'&&!a.scenes.some(s=>s.id===r.sceneId&&s.tokens.some(t=>t.id===r.tokenId)))throw Error('暂停区域路线缺少实际棋子')
  for (const body of state.objectBodies)
    if (body.hp > body.maxHp || !a.m3?.entities.some((o) => o.id === body.objectId))
      throw Error('物件耐久数据或实际引用不完整')
}
