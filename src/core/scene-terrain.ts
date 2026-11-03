import { magicMovement, magicTouches, queueMagic } from './scene-magic'
import type { Adventure, MapScene, MapToken, MapWorld } from './map-types'
import type { SceneEffect, SceneGeometry } from '../persistence/scene-effects-schema'
import type { Catalogue } from './engine'
import { geometryContains } from './scene-effect-geometry'
import { regionContains, physicalPropagation } from './scene-propagation'
import { sceneEffects, tokenPoint, endSceneEffect, anchoredGeometry } from './scene-effects'
import { m1Entity } from './m1-utility'
import { m3GroundAt } from './m3-ground'
import { TERRAIN_RULES } from './scene-terrain-rules'
export const terrainEntityId = (t: MapToken) => t.characterId ?? t.npcId ?? t.actorId ?? t.id
export function terrainTurn(world: MapWorld, a: Adventure, s: MapScene) {
  const battle = world.encounters.find((e) => e.id === s.encounterId && e.phase === 'active')
  return [
    a.broadcastLog?.branchId ?? 'legacy',
    battle
      ? `${battle.id}:${battle.tick}`
      : a.exploration?.status === 'active'
        ? a.exploration.roundId
        : `time:${Math.floor((world.characters.find((c) => a.party.includes(c.id))?.runtime?.hours ?? 0) * 600 + 1e-7)}`,
  ].join(':')
}
export function terrainTouches(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  t: MapToken,
  ground = false,
) {
  if (!e.terrain || e.terrain.enrichment || !e.geometry) return false
  if (ground && Math.abs((t.spatial?.height ?? 0) - m3GroundAt(a, s, t)) > 1e-7) return false
  for (let dy = 0; dy < t.span; dy++)
    for (let dx = 0; dx < t.span; dx++) {
      const x = t.x + dx,
        y = t.y + dy,
        key = `${Math.floor(x)},${Math.floor(y)}`
      if (e.terrain.excludedCells.includes(key)) continue
      if (e.spellId === 'plant-growth' && !e.terrain.plantCells.includes(key)) continue
      const p = { ...tokenPoint(t), x: x + 0.5, y: y + 0.5 }
      if (regionContains(world, a, s, e, p)) return true
    }
  return false
}
/** Same category difficult terrain never stacks. Plant Growth's 4ft replaces
 * ordinary terrain; crawling/climbing additions are applied by the caller. */
const webWalker=(w:MapWorld,a:Adventure,t:MapToken)=>m1Entity(w,a,terrainEntityId(t))?.body?.templateMetadata?.abilities.some(x=>x.id==='web-walker')??false
export function terrainMultiplier(world: MapWorld, a: Adventure, s: MapScene, t: MapToken) {
  return Math.max(
    a.sceneEffects?.regions.some(e=>e.spellId==='hunger-of-hadar'&&e.status==='active'&&e.magic&&magicTouches(world,a,s,e,t))?2:1,
    ...(a.sceneEffects?.regions ?? [])
      .filter(
        (e) =>
          e.status === 'active' &&
          e.sceneId === s.id &&
          e.terrain && !(e.spellId==='web'&&webWalker(world,a,t)) &&
          terrainTouches(world, a, s, e, t, e.terrain.groundOnly),
      )
      .map((e) => e.terrain!.multiplier),
  )
}
export function terrainGeometry(
  spellId: string,
  p: { x: number; y: number; height: number },
  surface = false,
): SceneGeometry {
  const r = TERRAIN_RULES[spellId]!
  return {
    shape: r.shape,
    ...p,
    size: r.size,
    heightFeet: surface ? 5 : r.height,
    width: 5,
    angle: 0,
    originSpan: 1,
  }
}
/** Environment facts come from registered entities, never from the background image. */
export function validateTerrainFacts(
  a: Adventure,
  s: MapScene,
  spellId: string,
  g: SceneGeometry,
  facts:
    | {
        plantIds?: string[]
        supportIds?: string[]
        webSupport?: string
        excludedCells?: string[]
        enrichment?: boolean
      }
    | undefined,
) {
  if (
    facts?.excludedCells?.some((key) => {
      const [x, y] = key.split(',').map(Number)
      return x! < 0 || y! < 0 || x! >= s.grid.columns || y! >= s.grid.rows
    })
  )
    throw Error('排除通道超出实际场景')
  if (spellId === 'web') {
    if (!facts?.webSupport) throw Error('蛛网须明确相对支撑、贴面或无支撑')
    const supports = (facts.supportIds ?? []).map((id) =>
      a.m3?.entities.find((e) => e.id === id && e.enabled && e.sceneId === s.id),
    )
    const valid = supports.every(
      (e) =>
        e &&
        ['surface', 'stone', 'object'].includes(e.kind) &&
        e.height <= g.height + (g.heightFeet || g.size) &&
        e.height + e.heightFeet >= g.height,
    )
    if (
      !valid ||
      (facts.webSupport === 'surface' && supports.length < 1) ||
      (facts.webSupport === 'opposing' && supports.length < 2)
    )
      throw Error('蛛网支撑须关联实际表面；无支撑请选择无支撑分支')
    if (facts.webSupport !== 'unsupported') {
      const c = { x: g.x + 0.5, y: g.y + 0.5 }
      if (
        supports.some(
          (e) =>
            Math.max(Math.abs(e!.x - c.x), Math.abs(e!.y - c.y)) * s.grid.feet >
            g.size + Math.max(e!.width, e!.depth),
        )
      )
        throw Error('实际支撑不在蛛网附近')
      if (
        facts.webSupport === 'opposing' &&
        !supports.some((e, i) =>
          supports.some(
            (o, j) =>
              i !== j && ((e!.x - c.x) * (o!.x - c.x) <= 0 || (e!.y - c.y) * (o!.y - c.y) <= 0),
          ),
        )
      )
        throw Error('请选择位于区域相对两侧的支撑')
    }
  }
  const cells: string[] = []
  if (spellId === 'plant-growth') {
    const plants = (facts?.plantIds ?? []).map((id) =>
      a.m3?.entities.find(
        (e) => e.id === id && e.enabled && e.sceneId === s.id && e.kind === 'plants' && !e.magical,
      ),
    )
    if (!plants.length || plants.some((e) => !e))
      throw Error('植物滋长须关联GM已核实的真实普通植物，不能从图片猜测')
    for (let y = 0; y < s.grid.rows; y++)
      for (let x = 0; x < s.grid.columns; x++)
        if (
          plants.some(
            (e) =>
              x + 0.5 >= e!.x &&
              y + 0.5 >= e!.y &&
              x + 0.5 < e!.x + e!.width / s.grid.feet &&
              y + 0.5 < e!.y + e!.depth / s.grid.feet,
          ) &&
          (facts?.enrichment ||
            geometryContains(g, { x: x + 0.5, y: y + 0.5, height: g.height }, s.grid.feet))
        )
          cells.push(`${x},${y}`)
    if (!cells.length) throw Error('法术范围内没有已登记的普通植物')
  }
  return cells
}
export function pendingTerrain(a: Adventure, id?: string) {
  return (a.sceneEffects?.hazards ?? []).filter(
    (h) => h.status === 'pending' && (!id || h.entityId === id),
  )
}
export function prepareTerrainRoute(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  path: { x: number; y: number; height: number }[],
  mode: 'map' | 'walk' | 'climb' | 'swim' | 'fly',
  reactionsConfirmed: boolean,
  supportId?: string,
  forced = false,
) {
  const id = terrainEntityId(t)
  if (pendingTerrain(a, id).length) throw Error('请先结算该人物待处理的区域事件，再确认继续移动')
  if (!a.sceneEffects?.regions.some((e) => e.status === 'active' && (e.terrain||e.magic))) return path
  const eventId = crypto.randomUUID(),
    state = sceneEffects(a)
  let previous = {
    ...t,
    spatial: {
      ...t.spatial,
      height: t.spatial?.height ?? 0,
      layer: t.spatial?.layer ?? 'material',
    },
  }
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!,
      next = { ...previous, ...p, spatial: { ...previous.spatial, height: p.height } }
    const dist = Math.max(
      Math.abs(p.x - previous.x) * s.grid.feet,
      Math.abs(p.y - previous.y) * s.grid.feet,
      Math.abs(p.height - previous.spatial.height),
    )
    for (const e of state.regions.filter(
      (e) => e.status === 'active' && e.terrain && e.sceneId === s.id,
    )) {
      const inside = terrainTouches(
          world,
          a,
          s,
          e,
          next,
          e.terrain!.groundOnly && e.spellId !== 'sleet-storm',
        ),
        was = terrainTouches(
          world,
          a,
          s,
          e,
          previous,
          e.terrain!.groundOnly && e.spellId !== 'sleet-storm',
        )
      if (inside && !was) queueTerrain(world, a, s, next, 'enter', `${eventId}:${i}`, e)
      if (inside && e.spellId === 'spike-growth') {
        const travel = (e.terrain!.travel ??= [])
        let entry = travel.find((v) => v.entityId === id)
        if (!entry) {
          entry = { entityId: id, remainder: 0 }
          travel.push(entry)
        }
        const count = Math.floor((entry.remainder + dist + 1e-7) / 5)
        entry.remainder = (entry.remainder + dist) % 5
        if (count) queueTerrain(world, a, s, next, 'spikes', `${eventId}:${i}`, e, count * 5)
      }
    }
    magicMovement(world,a,s,previous,next,`${eventId}:${i}`)
    const speedChanged=state.regions.some(e=>e.status==='active'&&e.spellId==='spirit-guardians'&&e.magic&&e.sourceId!==id&&!e.magic.excludedIds.includes(id)&&magicTouches(world,a,s,e,next)&&!magicTouches(world,a,s,e,previous))
    if (!forced&&(pendingTerrain(a, id).length||speedChanged)) {
      for (const r of state.routes.filter((r) => r.entityId === id && r.status === 'paused'))
        r.status = 'canceled'
      const remaining = path.slice(i + 1)
      if (remaining.length) {
        if (state.routes.length >= 1000) throw Error('暂停路线已满，请先归档')
        state.routes.push({
          id: crypto.randomUUID(),
          sceneId: s.id,
          entityId: id,
          tokenId: t.id,
          branchId: a.broadcastLog?.branchId ?? 'legacy',
          start: { ...p },
          path: remaining,
          mode,
          reactionsConfirmed,
          supportId,
          status: 'paused',
        })
      }
      return path.slice(0, i + 1)
    }
    previous = next
  }
  for (const r of state.routes.filter((r) => r.entityId === id && r.status === 'paused'))
    r.status = 'canceled'
  return path
}
/** Stable ordered candidates. Dice are a separate transaction, so pausing never
 * undoes an already walked segment or repeats a previous segment's damage. */
export function queueTerrain(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  phase: 'created' | 'enter' | 'start' | 'end' | 'spikes' | 'burn',
  receipt: string,
  only?: SceneEffect,
  distance = 0,
) {
  const id = terrainEntityId(t),
    entity = m1Entity(world, a, id)
  if (!entity || entity.dead) return
  const state = sceneEffects(a),
    turnKey = terrainTurn(world, a, s)
  for (const e of (only ? [only] : state.regions).filter(
    (e) => e.status === 'active' && e.terrain && e.sceneId === s.id,
  )) {
    if(e.spellId==='web'&&webWalker(world,a,t)&&phase!=='burn')continue
    if (!terrainTouches(world, a, s, e, t, e.terrain!.groundOnly && e.spellId !== 'sleet-storm'))
      continue
    const key = `${e.id}:${id}:${phase}:${receipt}`
    if (state.hazards.some((h) => h.receipt === key)) continue
    if (
      ['web', 'sleet-storm'].includes(e.spellId) &&
      phase === 'enter' &&
      state.hazards.some(
        (h) =>
          h.effectId === e.id && h.entityId === id && h.phase === phase && h.turnKey === turnKey,
      )
    )
      continue
    const valid =
      phase === 'created'
        ? ['grease', 'entangle'].includes(e.spellId) &&
          (e.spellId !== 'entangle' || id !== e.sourceId)
        : phase === 'enter'
          ? ['grease', 'web', 'sleet-storm'].includes(e.spellId)
          : phase === 'start'
            ? ['web', 'sleet-storm', 'stinking-cloud'].includes(e.spellId)
            : phase === 'end'
              ? e.spellId === 'grease'
              : phase === 'spikes'
                ? e.spellId === 'spike-growth'
                : e.spellId === 'web'
    if (!valid) continue
    if (state.hazards.length >= 10000) throw Error('区域触发记录已满，请先归档')
    state.hazards.push({
      id: crypto.randomUUID(),
      effectId: e.id,
      entityId: id,
      sceneId: s.id,
      receipt: key,
      phase,
      status: 'pending',
      turnKey,
      distance,
      rolls: [],
      note: '',
    })
  }
}
export function terrainPhase(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  phase: 'start' | 'end',
  cat: Catalogue,
) {
  const turn = terrainTurn(world, a, s)
  if (phase === 'start')
    for (const e of a.sceneEffects?.regions ?? []) {
      if (e.status !== 'active' || e.spellId !== 'web' || !e.terrain) continue
      if (
        e.sourceId === terrainEntityId(t) &&
        e.terrain.webSupport === 'unsupported' &&
        e.terrain.createdTurn !== turn
      )
        endSceneEffect(a, e, '无支撑蛛网于来源下回合初塌落')
      for (const burn of e.terrain.burns) {
        const g = {
          shape: 'cube' as const,
          x: burn.x,
          y: burn.y,
          height: burn.height,
          size: 5,
          heightFeet: 5,
          width: 5,
          angle: 0,
          originSpan: 1,
        }
        if (geometryContains(g, tokenPoint(t), s.grid.feet))
          queueTerrain(
            world,
            a,
            s,
            t,
            'burn',
            turn + ':' + [burn.x, burn.y, burn.height].join(','),
            e,
          )
      }
    }
  queueTerrain(world, a, s, t, phase, turn)
  queueMagic(world,a,s,t,phase,turn)
}
export function clearTerrainTurn(world: MapWorld, a: Adventure, t: MapToken) {
  const entity = m1Entity(world, a, terrainEntityId(t))
  if (!entity) return
  entity.state.effects = (entity.state.effects ?? []).filter((f) => f.key !== 'stinking-cloud-turn')
}
/** Restoring keeps receipts that were already true at the checkpoint. Only their
 * branch prefix changes; future receipts were removed with the restored world. */
export function rebaseTerrainBranch(a: Adventure, branch: string) {
  const state = a.sceneEffects
  if (!state) return
  const key = (value: string) => value.replace(/^[^:]+:/, branch + ':')
  for (const h of state.hazards ?? []) {
    const old = h.turnKey
    h.turnKey = key(old)
    h.receipt = h.receipt.replace(old, h.turnKey)
  }
  for (const e of state.regions)
    if (e.terrain) {
      e.terrain.createdTurn = key(e.terrain.createdTurn)
      for (const b of e.terrain.burns) b.startedTurn = key(b.startedTurn)
    }
  for(const e of state.regions)if(e.magic){e.magic.createdTurn=key(e.magic.createdTurn);if(e.magic.lastMoveTurn)e.magic.lastMoveTurn=key(e.magic.lastMoveTurn);for(const c of [...e.magic.crossings,...e.magic.passwordPasses])c.turnKey=key(c.turnKey)}
  for (const r of state.routes ?? []) r.branchId = branch
}
export function reconcileTerrain(world: MapWorld, a: Adventure) {
  const state = a.sceneEffects
  if (!state) return
  state.hazards ??= []
  state.routes ??= []
  for (const e of state.regions)
    if (e.terrain) {
      const now =
        world.characters.find((c) => c.id === e.clockSourceId)?.runtime?.hours ?? e.createdHour
      for (const b of e.terrain.burns.filter((b) => b.endsAt <= now)) {
        const cuts = (e.geometry!.cuts ??= [])
        if (!cuts.some((c) => c.x === b.x && c.y === b.y && c.height === b.height))
          cuts.push({ x: b.x, y: b.y, height: b.height, width: 5, depth: 5, heightFeet: 5 })
        e.geometry!.cuts = cuts
      }
      e.terrain.burns = e.terrain.burns.filter((b) => b.endsAt > now)
      const scene = a.scenes.find((s) => s.id === e.sceneId)
      if (
        e.status === 'active' &&
        e.spellId === 'web' &&
        scene &&
        e.terrain.webSupport !== 'unsupported' &&
        e.terrain.supportIds.some((id) => !a.m3?.entities.some((o) => o.id === id && o.enabled))
      ) {
        e.terrain.webSupport = 'unsupported'
        e.terrain.createdTurn = terrainTurn(world, a, scene)
      }
      if (e.status === 'active' && e.spellId === 'sleet-storm' && scene)
        for (const flame of state.regions.filter(
          (f) =>
            f.status === 'active' && f.spellId === 'mundane-light' && f.light?.flame && !f.covered,
        )) {
          const g = anchoredGeometry(world, a, flame)
          if (
            g &&
            regionContains(world, a, scene, e, {
              x: g.geometry.x + 0.5,
              y: g.geometry.y + 0.5,
              height: g.geometry.height,
              layer: g.layer,
              anchorId: g.anchorId,
            })
          )
            endSceneEffect(a, flame, '雪雨暴浇熄实际暴露明火')
        }
      for (const s of a.scenes)
        for (const t of s.tokens) {
          const entity = m1Entity(world, a, terrainEntityId(t))
          if (!entity) continue
          entity.state.effects = (entity.state.effects ?? []).filter(
            (f) =>
              !(
                f.castId === e.castId &&
                ['entangle-region', 'web-region'].includes(f.key) &&
                (e.status !== 'active' ||
                  (e.spellId === 'web' &&
                    !terrainTouches(world, a, s, e, t, e.terrain!.groundOnly)))
              ),
          )
        }
    }
  for (const h of state.hazards.filter((h) => h.status === 'pending')) {
    const e = state.regions.find((e) => e.id === h.effectId),
      entity = m1Entity(world, a, h.entityId)
    if (
      !e ||
      !entity ||
      entity.dead ||
      (e.status !== 'active' && ['entangle', 'web'].includes(e.spellId) && h.phase !== 'burn')
    ) {
      h.status = 'canceled'
      h.note = '目标失效或持续束缚来源结束，未重掷；已触发的伤害与瞬时后果仍保留'
    }
  }
}
