import {reconcileM5Links} from './m5-world-outcomes'
import {reconcileDroppedWeaponSpells} from './weapon-spell-persistence'
import { M4_SUPPLY_SPELLS,reconcileSupplies } from './scene-supplies'
import { reconcileMagic } from './scene-magic'
import { M4_MAGIC_SPELLS } from './scene-magic-rules'
import { reconcileTerrain } from './scene-terrain'
import { M4_TERRAIN_SPELLS } from './scene-terrain-rules'
import { physicalPropagation } from './scene-propagation'
import { sceneCenter, geometryContains } from './scene-effect-geometry'
import type { SceneQueryCache } from './scene-query-cache'
import type { Adventure, MapWorld, MapScene, MapToken } from './map-types'
import type { SceneEffect, SceneEffects, SceneGeometry } from '../persistence/scene-effects-schema'
import { m1Entity } from './m1-utility'
import { concentrationMatches } from './spell-source-state'
import { clone } from './engine'
export const M4_LIGHT_SPELLS = [
  'dancing-lights',
  'light',
  'produce-flame',
  'continual-flame',
  'daylight',
  'darkness',
  'fog-cloud',
] as const
export const M4_SCENE_SPELLS = [...M4_LIGHT_SPELLS, ...M4_TERRAIN_SPELLS, ...M4_MAGIC_SPELLS,...M4_SUPPLY_SPELLS]
export const M4_EXCLUSIVE_SCENE_SPELLS=M4_SCENE_SPELLS.filter(id=>!['moonbeam','spirit-guardians','cloud-of-daggers','hunger-of-hadar','cordon-of-arrows'].includes(id))
export const sceneEffects = (a: Adventure): SceneEffects =>
  (a.sceneEffects ??= {
    version: 1,
    regions: [],
    casts: [],
    events: [],
    materials: [],
    objectBodies: [],
    objectAttacks: [],
    hazards: [], routes: [], locks: [],
  })
export function effectEvent(
  a: Adventure,
  e: SceneEffect,
  kind: SceneEffects['events'][number]['kind'],
  reason: string,
  receipt: string = crypto.randomUUID(),
  atHour = e.createdHour,
) {
  const state = sceneEffects(a)
  if (state.events.some((x) => x.receipt === receipt)) return
  if (state.events.length >= 10000) throw Error('场景效果记录达到上限，请先归档')
  state.events.push({
    id: crypto.randomUUID(),
    castId: e.castId,
    effectId: e.id,
    kind,
    atHour,
    receipt,
    reason,
  })
}
export function endSceneEffect(
  a: Adventure,
  e: SceneEffect,
  reason: string,
  atHour = e.createdHour,
) {
  if (e.status === 'ended') return
  e.status = 'ended'
  e.reason = reason
  effectEvent(a, e, 'ended', reason, crypto.randomUUID(), atHour)
}
export function endSceneCast(world: MapWorld, a: Adventure, castId: string, reason: string) {
  const rows = a.sceneEffects?.regions.filter((e) => e.castId === castId) ?? []
  for (const e of rows) {
    endSceneEffect(
      a,
      e,
      reason,
      world.characters.find((c) => c.id === e.clockSourceId)?.runtime?.hours ?? e.createdHour,
    )
    if (e.legacy) {
      const encounter = world.encounters.find((x) => x.id === e.legacy!.encounterId)
      if (encounter) encounter.zones = encounter.zones?.filter((z) => z.id !== e.legacy!.zoneId)
    }
  }
  for (const id of new Set(rows.map((e) => e.sourceId))) {
    const source = m1Entity(world, a, id),
      conc = source?.c?.runtime?.concentration ?? source?.body?.concentration
    if (conc?.castId === castId) {
      if (source?.c?.runtime) source.c.runtime.concentration = null
      else if (source?.body) delete source.body.concentration
    }
  }
  for (const c of world.characters)
    if (c.runtime) c.runtime.effects = c.runtime.effects?.filter((f) => (f.castId !== castId || f.key === 'stinking-cloud-turn'))
  for (const encounter of world.encounters)
    for (const actor of encounter.actors)
      if (actor.npc) actor.npc.effects = actor.npc.effects.filter((f) => (f.castId !== castId || f.key === 'stinking-cloud-turn'))
  for (const npc of a.ai?.npcs ?? [])
    if (npc.body) npc.body.effects = npc.body.effects.filter((f) => (f.castId !== castId || f.key === 'stinking-cloud-turn'))
  for (const object of a.m3?.entities ?? [])
    object.effects = object.effects?.filter((f) => (f.castId !== castId || f.key === 'stinking-cloud-turn'))
}
export const tokenPoint = (t: MapToken) => ({
  x: t.x + t.span / 2,
  y: t.y + t.span / 2,
  height: t.spatial?.height ?? 0,
  layer: t.spatial?.layer ?? 'material',
  anchorId: t.spatial?.anchorId,
})
export function anchoredGeometry(
  world: MapWorld,
  a: Adventure,
  e: SceneEffect,
  cache?: SceneQueryCache,
):
  | {
      scene: MapScene
      geometry: SceneGeometry
      layer?: import('./m3-spatial').SpaceLayer
      anchorId?: string
    }
  | undefined {
  if (cache?.geometry.has(e.id)) return cache.geometry.get(e.id)
  const value = resolveAnchor(world, a, e)
  cache?.geometry.set(e.id, value)
  return value
}
function resolveAnchor(
  world: MapWorld,
  a: Adventure,
  e: SceneEffect,
):
  | {
      scene: MapScene
      geometry: SceneGeometry
      layer?: import('./m3-spatial').SpaceLayer
      anchorId?: string
    }
  | undefined {
  if (!e.geometry) return
  let scene = a.scenes.find((s) => s.id === e.sceneId),
    position:
      | {
          x: number
          y: number
          height: number
          span?: number
          layer?: import('./m3-spatial').SpaceLayer
          anchorId?: string
        }
      | undefined
  if (e.anchor.kind === 'creature') {
    const t = m1Entity(world, a, e.anchor.id!)?.token
    scene = t && a.scenes.find((s) => [...s.tokens, ...(s.defeatedTokens ?? [])].includes(t))
    if (!t || !scene) return
    position = {
      x: t.x,
      y: t.y,
      height: t.spatial?.height ?? 0,
      span: t.span,
      layer: t.spatial?.layer ?? 'material',
      anchorId: t.spatial?.anchorId,
    }
  } else if (e.anchor.kind === 'inventory') {
    const related = new Set([
        ...a.party,
        ...(a.ai?.npcs.flatMap((n) => (n.characterId ? [n.characterId] : [])) ?? []),
      ]),
      owner = world.characters.find(
        (c) =>
          (e.anchor.ownerId ? c.id === e.anchor.ownerId : related.has(c.id)) &&
          c.inventory.some((i) => i.instanceId === e.anchor.id && i.quantity > 0),
      ),
      t = owner && m1Entity(world, a, owner.id)?.token
    if (!owner) {
      const groundScene = a.scenes.find((s) =>
          s.groundItems?.some(
            (g) =>
              g.enabled &&
              g.quantity > 0 &&
              (g.inventoryState?.instanceId ?? g.inventoryInstanceId) === e.anchor.id,
          ),
        ),
        ground = groundScene?.groundItems?.find(
          (g) =>
            g.enabled &&
            g.quantity > 0 &&
            (g.inventoryState?.instanceId ?? g.inventoryInstanceId) === e.anchor.id,
        )
      return groundScene && ground
        ? {
            scene: groundScene,
            geometry: {
              ...e.geometry,
              x: ground.x,
              y: ground.y,
              height:
                a.m3?.environments.find((f) => f.sceneId === groundScene.id)?.floorHeight ?? 0,
              originSpan: 1,
            },
          }
        : undefined
    }
    scene = t && a.scenes.find((s) => [...s.tokens, ...(s.defeatedTokens ?? [])].includes(t))
    if (!t || !scene) return
    position = {
      x: t.x,
      y: t.y,
      height: t.spatial?.height ?? 0,
      span: t.span,
      layer: t.spatial?.layer ?? 'material',
      anchorId: t.spatial?.anchorId,
    }
  } else if (e.anchor.kind === 'object') {
    const o = a.m3?.entities.find((o) => o.id === e.anchor.id && o.enabled)
    scene = o && a.scenes.find((s) => s.id === o.sceneId)
    if (!o || !scene) return
    const t = o.boundCharacterId ? m1Entity(world, a, o.boundCharacterId)?.token : undefined
    if (o.boundCharacterId && !t) return
    if (t) {
      scene = a.scenes.find((s) => s.tokens.includes(t))
      position = {
        x: t.x,
        y: t.y,
        height: t.spatial?.height ?? 0,
        span: t.span,
        layer: t.spatial?.layer ?? 'material',
        anchorId: t.spatial?.anchorId,
      }
    } else
      position = {
        x: o.x,
        y: o.y,
        height: o.height,
        span: Math.max(1, Math.min(80, Math.ceil(Math.max(o.width, o.depth) / scene.grid.feet))),
        layer: o.layer ?? 'material',
        anchorId: o.anchorId,
      }
  }
  if (!scene) return
  return {
    scene,
    layer: position?.layer ?? e.layer ?? 'material',
    anchorId: position?.anchorId ?? e.spaceAnchorId,
    geometry: position
      ? {
          ...e.geometry,
          x: position.x,
          y: position.y,
          height: position.height + e.anchor.offsetHeight,
          originSpan: position.span ?? 1,
        }
      : e.geometry,
  }
}
/** Mirrors retain the old executor as sole authority. No dice, ammo or turn receipts are migrated/reset here. */
export function mirrorLegacyEffects(world: MapWorld, a: Adventure) {
  const zones = world.encounters.flatMap((encounter) => {
    const scene = a.scenes.find(
      (s) => s.encounterId === encounter.id || encounter.session?.sceneId === s.id,
    )
    return scene ? (encounter.zones ?? []).map((zone) => ({ encounter, scene, zone })) : []
  })
  if (!zones.length && !a.sceneEffects) return
  const state = sceneEffects(a)
  for (const { encounter, scene, zone } of zones) {
    let row = state.regions.find(
      (e) => e.legacy?.zoneId === zone.id && e.legacy.encounterId === encounter.id,
    )
    const actor = encounter.actors.find((x) => x.id === zone.sourceId),
      source = actor?.characterId ?? actor?.npcId ?? zone.sourceId,
      t = scene.tokens.find((t) => t.actorId === actor?.id),
      clock =
        world.characters.find((c) => c.id === actor?.characterId) ??
        world.characters.find((c) => a.party.includes(c.id) && c.runtime)
    if (!clock) continue
    const template = zone.template,
      g = template
        ? {
            shape:
              template.shape === 'circle'
                ? ('sphere' as const)
                : template.shape === 'cone'
                  ? ('line' as const)
                  : template.shape,
            x: template.x,
            y: template.y,
            height: t?.spatial?.height ?? 0,
            size: template.size,
            heightFeet:
              zone.spellId === 'moonbeam' ? 40 : template.shape === 'cube' ? template.size : 0,
            width: template.width,
            angle: template.angle,
            originSpan: template.originSpan ?? 1,
          }
        : undefined
    if (!row) {
      if (state.regions.length >= 3000) throw Error('场景效果达到上限')
      row = {
        id: crypto.randomUUID(),
        castId: zone.castId ?? zone.id,
        spellId: zone.spellId,
        name: zone.name,
        sourceId: source,
        sourceKind: actor?.characterId ? 'character' : 'npc',
        sceneId: scene.id,
        clockSourceId: clock.id,
        slotLevel: zone.slotLevel,
        createdHour: clock.runtime?.hours ?? 0,
        endsAt: zone.expiresHour,
        concentration: zone.spellId !== 'cordon-of-arrows',
        status: 'active',
        geometry: g,
        anchor: {
          kind: zone.spellId === 'spirit-guardians' ? 'creature' : 'point',
          id: zone.spellId === 'spirit-guardians' ? source : undefined,
          offsetHeight: 0,
        },
        hidden: !!t?.hidden,
        covered: false,
        obscurity: 'none',
        channels: [],
        legacy: { encounterId: encounter.id, zoneId: zone.id },
        requiresGeometry: !g,
        note: '旧区域兼容映射；原执行器保留全部骰、弹药和时机记录',
      }
      state.regions.push(row)
      effectEvent(a, row, 'migrated', '保留原区域唯一执行权')
    } else {
      row.geometry = g
      row.requiresGeometry = !g
      row.endsAt = zone.expiresHour
      row.status = 'active'
      row.hidden = !!t?.hidden
    }
  }
  for (const row of state.regions.filter((e) => e.legacy && !e.magic?.migrated && e.status === 'active'))
    if (
      !zones.some(
        (z) => z.zone.id === row.legacy!.zoneId && z.encounter.id === row.legacy!.encounterId,
      )
    )
      endSceneEffect(a, row, '原区域执行器已结束此实例')
}
/** Existing Faerie Fire keeps its original creature saves/effects. Only its
 * already-confirmed dim light is projected here; no roll is replayed. */
function mirrorFaerieLight(world: MapWorld, a: Adventure) {
  const found = new Set<string>()
  const recipients = a.scenes.flatMap((scene) =>
    scene.tokens.flatMap((token) => {
      const entity = m1Entity(
        world,
        a,
        token.characterId ?? token.npcId ?? token.actorId ?? token.id,
      )
      return entity
        ? [
            {
              scene,
              token,
              entity,
              object: undefined as undefined | NonNullable<Adventure['m3']>['entities'][number],
              effects: entity.state.effects ?? [],
            },
          ]
        : []
    }),
  )
  for (const object of a.m3?.entities ?? [])
    if (object.enabled) {
      const scene = a.scenes.find((s) => s.id === object.sceneId)
      if (scene)
        recipients.push({
          scene,
          token: undefined as never,
          entity: undefined as never,
          object,
          effects: object.effects ?? [],
        })
    }
  for (const r of recipients)
    for (const effect of r.effects.filter((f) => ['faerie-fire','starry-wisp','shining-smite'].includes(f.key) && f.castId)) {
      const id = r.entity?.id ?? r.object!.id,
        key = id + ':' + effect.id
      found.add(key)
      const state = sceneEffects(a)
      let row = state.regions.find(
        (e) => e.legacyLight?.entityId === id && e.legacyLight.effectId === effect.id,
      )
      if (row) continue
      const source = m1Entity(world, a, effect.sourceId),
        clock =
          world.characters.find((c) => c.id === effect.clockSourceId) ??
          world.characters.find((c) => a.party.includes(c.id) && c.runtime)
      if (!clock) continue
      const p = r.token
        ? { x: r.token.x, y: r.token.y, height: r.token.spatial?.height ?? 0 }
        : { x: r.object!.x, y: r.object!.y, height: r.object!.height }
      row = {
        id: crypto.randomUUID(),
        castId: effect.castId!,
        spellId: effect.key,
        name: effect.name,
        sceneId: r.scene.id,
        sourceId: source?.id ?? effect.sourceId,
        sourceKind: source?.c ? 'character' : 'npc',
        clockSourceId: clock.id,
        slotLevel: effect.spellLevel ?? 1,
        createdHour: clock.runtime?.hours ?? 0,
        endsAt: effect.endsAt,
        concentration: effect.concentration,
        status: 'active',
        geometry: {
          shape: 'sphere',
          ...p,
          size: 10,
          heightFeet: 0,
          width: 5,
          angle: 0,
          originSpan: 1,
        },
        anchor: { kind: r.object ? 'object' : 'creature', id, offsetHeight: 0 },
        hidden: r.token?.hidden ?? r.object?.hidden ?? false,
        covered: false,
        light: { bright: effect.key==='shining-smite'?5:0, dimExtra: effect.key==='shining-smite'?0:10, magical: true, sunlight: false, color: '#ba88ec' },
        obscurity: 'none',
        channels: [],
        requiresGeometry: false,
        legacyLight: { entityId: id, effectId: effect.id },
        note: '已确认法术的实际光照映射，不重复结算',
      }
      if (state.regions.length >= 3000) throw Error('场景效果达到上限')
      state.regions.push(row)
      effectEvent(a, row, 'migrated', '保留原妖火唯一结算权')
    }
  for (const e of a.sceneEffects?.regions ?? [])
    if (
      e.legacyLight &&
      e.status === 'active' &&
      !found.has(e.legacyLight.entityId + ':' + e.legacyLight.effectId)
    )
      endSceneEffect(a, e, '原妖火效果已经结束')
}
export function reconcileSceneEffects(world: MapWorld) {
  for (const a of world.adventures) {
    mirrorLegacyEffects(world, a)
    mirrorFaerieLight(world, a)
    const state = a.sceneEffects
    if (!state) continue
    reconcileSupplies(world,a)
    reconcileDroppedWeaponSpells(world,a)
    state.hazards ??= []; state.routes ??= []; state.locks ??= []
    for (const e of state.regions.filter((e) => e.status === 'active' && (!e.legacy||e.magic?.migrated))) {
      const clock = world.characters.find((c) => c.id === e.clockSourceId)?.runtime?.hours
      if (clock !== undefined && e.endsAt !== undefined && clock >= e.endsAt) {
        endSceneEffect(a, e, '冒险时钟达到期限', clock)
        continue
      }
      const source = m1Entity(world, a, e.sourceId)
      if (
        e.concentration &&
        !concentrationMatches(
          { key: e.spellId, castId: e.castId },
          source?.c?.runtime?.concentration ?? source?.body?.concentration,
        )
      ) {
        endSceneEffect(a, e, '此施法来源的专注已结束')
        continue
      }
      if (
        (e.anchor.kind === 'inventory' &&
          !world.characters.some(
            (c) =>
              (!e.anchor.ownerId || c.id === e.anchor.ownerId) &&
              c.inventory.some((i) => i.instanceId === e.anchor.id && i.quantity > 0),
          ) &&
          !a.scenes.some((s) =>
            s.groundItems?.some(
              (g) =>
                g.enabled &&
                g.quantity > 0 &&
                (g.inventoryState?.instanceId ?? g.inventoryInstanceId) === e.anchor.id,
            ),
          )) ||
        (e.anchor.kind === 'object' &&
          !a.m3?.entities.some((o) => o.id === e.anchor.id && o.enabled))
      ) {
        endSceneEffect(a, e, '实际锚点已移除')
        continue
      }
      const current = anchoredGeometry(world, a, e)
      if (current) {
        e.sceneId = current.scene.id
        e.layer = current.layer
        e.spaceAnchorId = current.anchorId
        if (e.anchor.kind !== 'point') e.geometry = clone(current.geometry)
      }
      if (e.spellId === 'dancing-lights' && current && source?.token) {
        const from = tokenPoint(source.token),
          c = {
            x: current.geometry.x + 0.5,
            y: current.geometry.y + 0.5,
            height: current.geometry.height,
          },
          sameScene = current.scene.tokens.includes(source.token)
        if (
          !sameScene ||
          (source.token.spatial?.layer ?? 'material') !== (current.layer ?? 'material') ||
          (current.layer === 'pocket' && source.token.spatial?.anchorId !== current.anchorId) ||
          Math.max(
            Math.abs(c.x - from.x) * current.scene.grid.feet,
            Math.abs(c.y - from.y) * current.scene.grid.feet,
            Math.abs(c.height - from.height),
          ) > 120
        )
          endSceneEffect(a, e, '舞光超出来源120尺')
      }
    }
    for (const e of state.regions.filter(
      (e) => e.status === 'active' && e.spellId === 'dancing-lights' && !e.combined,
    )) {
      if (
        !state.regions.some(
          (o) =>
            o.status === 'active' &&
            o.id !== e.id &&
            o.castId === e.castId &&
            o.geometry &&
            e.geometry &&
            Math.max(Math.abs(o.geometry.x - e.geometry.x), Math.abs(o.geometry.y - e.geometry.y)) *
              a.scenes.find((s) => s.id === e.sceneId)!.grid.feet <=
              20 &&
            Math.abs(o.geometry.height - e.geometry.height) <= 20,
        )
      )
        endSceneEffect(a, e, '没有另一个舞光在20尺内')
    }
    reconcileTerrain(world,a)
    reconcileMagic(world,a)
    reconcileM5Links(world,a)
    for (const c of state.casts.filter((c) => !c.settled && !c.canceled && c.encounterId)) {
      const encounter = world.encounters.find((e) => e.id === c.encounterId)
      if (
        ![encounter?.pending, ...(encounter?.reactionParents ?? [])].some(
          (p) => p?.sceneEffectCastId === c.id,
        )
      )
        c.canceled = true
    }
    for (const c of state.casts.filter(
      (c) => c.spellId === 'dancing-lights' && c.settled && !c.canceled,
    ))
      if (!state.regions.some((e) => e.castId === c.castId && e.status === 'active')) {
        const source = m1Entity(world, a, c.sourceId),
          conc = source?.c?.runtime?.concentration ?? source?.body?.concentration
        if (conc?.castId === c.castId) endSceneCast(world, a, c.castId, '此来源的全部舞光已消失')
      }
    // Apply rule-specific dispelling before calculating illumination, never generic colour/brightness priority.
    for (const e of state.regions.filter(
      (e) => e.status === 'active' && !e.covered && ['daylight', 'darkness'].includes(e.spellId),
    )) {
      const g = anchoredGeometry(world, a, e)
      if (!g) continue
      for (const other of state.regions.filter(
        (o) => o.id !== e.id && o.status === 'active' && !o.covered,
      )) {
        const h = anchoredGeometry(world, a, other)
        if (
          !h ||
          h.scene.id !== g.scene.id ||
          g.layer !== h.layer ||
          (g.layer === 'pocket' && g.anchorId !== h.anchorId)
        )
          continue
        if (
          (e.spellId === 'darkness' &&
            (!other.light || !other.light.magical || other.slotLevel > 2)) ||
          (e.spellId === 'daylight' &&
            (!['magical-darkness', 'absolute-darkness'].includes(other.obscurity) ||
              other.slotLevel > 3))
        )
          continue
        const r = e.spellId === 'darkness' ? 15 : 60,
          rr = other.light ? other.light.bright + other.light.dimExtra : (other.geometry?.size ?? 0)
        const p = { ...sceneCenter(g.geometry), layer: g.layer, anchorId: g.anchorId },
          q = { ...sceneCenter(h.geometry), layer: h.layer, anchorId: h.anchorId },
          dist = Math.hypot(
            (p.x - q.x) * g.scene.grid.feet,
            (p.y - q.y) * g.scene.grid.feet,
            p.height - q.height,
          )
        if (dist > r + rr) continue
        const low = dist ? Math.max(0, (dist - rr) / dist) : 0,
          high = dist ? Math.min(1, r / dist) : 0,
          mid = (low + high) / 2,
          at = (t: number) => ({
            x: p.x + (q.x - p.x) * t,
            y: p.y + (q.y - p.y) * t,
            height: p.height + (q.height - p.height) * t,
            layer: g.layer,
            anchorId: g.anchorId,
          })
        const candidates = [at(mid), at(low), at(high)]
        // Lens circumference and wall endpoints prevent a short partition from being treated as an infinite wall.
        for (const w of g.scene.walls ?? [])
          for (const end of [w.a, w.b])
            for (const dx of [-0.01, 0.01])
              for (const dy of [-0.01, 0.01])
                candidates.push({
                  x: end.x + dx,
                  y: end.y + dy,
                  height: p.height,
                  layer: g.layer,
                  anchorId: g.anchorId,
                })
        const overlaps = candidates.some(
          (point) =>
            geometryContains({ ...g.geometry, size: r }, point, g.scene.grid.feet) &&
            geometryContains({ ...h.geometry, size: rr }, point, g.scene.grid.feet) &&
            physicalPropagation(a, g.scene, p, point, e.light ? 'light' : 'effect').clear &&
            physicalPropagation(a, g.scene, q, point, other.light ? 'light' : 'effect').clear,
        )
        if (overlaps) endSceneCast(world, a, other.castId, e.name + '按2024环级条文解除此来源')
      }
    }
  }
}
