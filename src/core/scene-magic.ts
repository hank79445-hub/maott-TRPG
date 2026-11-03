import type { Adventure, MapScene, MapToken, MapWorld } from './map-types'
import type { Catalogue } from './engine'
import type { SceneEffect, SceneEffects } from '../persistence/scene-effects-schema'
import type { ActiveEffect } from './types'
import { triggerDevice } from './scene-magic-actions'
import { magicalCreatureType } from './m3-magic-perception'
import {
  sceneEffects,
  anchoredGeometry,
  tokenPoint,
  endSceneCast,
  endSceneEffect,
  effectEvent,
} from './scene-effects'
import { geometryContains, volumeRay, sceneCenter, type ScenePoint } from './scene-effect-geometry'
import { physicalPropagation, regionContains, queryPropagation } from './scene-propagation'
import { terrainTurn, terrainEntityId } from './scene-terrain'
import { m1Entity } from './m1-utility'
import { sceneVision } from './scene-lighting'
import { tokenPerception, tokenM3State } from './m3-map-perception'
import { actorCreatureType } from './control-spells'
import { freshTurn, combatStats } from './combat-rules'
export function sceneCreatureType(w: MapWorld, a: Adventure, id: string) {
  const e = m1Entity(w, a, id)
  return e
    ? actorCreatureType(
        e.actor ?? {
          id: e.id,
          characterId: e.c?.id ?? null,
          npc: e.body ?? null,
          side: 'neutral',
          initiative: null,
          surprised: false,
          turn: freshTurn(),
        },
        w.characters,
        true,
      )
    : undefined
}
import { m3GroundAt } from './m3-ground'
import { catalogue } from './engine'
import { srd } from '../content/srd'
import { runtimeDerived } from './runtime'
export const magicDistance = (p: ScenePoint, q: ScenePoint, feet: number) =>
  Math.max(Math.abs(p.x - q.x) * feet, Math.abs(p.y - q.y) * feet, Math.abs(p.height - q.height))
export function magicPointVisible(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  p: ScenePoint,
  cat: Catalogue,
) {
  const sense = tokenM3State(w, a, t, cat),
    v = sceneVision(w, a, s, tokenPoint(t), p, sense)
  return (
    v.ray.clear &&
    v.illuminated &&
    (!sense.blinded ||
      (sense.blindsight > 0 && sense.blindsight >= magicDistance(tokenPoint(t), p, s.grid.feet)))
  )
}
export function magicTouches(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  t: MapToken,
  fully = false,
) {
  const wall = anchoredGeometry(w, a, e)?.geometry
  if (!fully && wall?.shape === 'wall') {
    if (
      e.status !== 'active' ||
      e.sceneId !== s.id ||
      (e.layer ?? 'material') !== (t.spatial?.layer ?? 'material')
    )
      return false
    const half = wall.width / s.grid.feet / 2,
      bottom = t.spatial?.height ?? 0
    return (wall.points ?? []).slice(1).some((b, i) => {
      const start = wall.points![i]!
      if (start.height > bottom + t.span * s.grid.feet || start.height + wall.heightFeet < bottom)
        return false
      let near = 0,
        far = 1
      for (const axis of ['x', 'y'] as const) {
        const d = b[axis] - start[axis],
          lo = t[axis] - half,
          hi = t[axis] + t.span + half
        if (Math.abs(d) < 1e-9) {
          if (start[axis] < lo || start[axis] > hi) return false
        } else {
          const p = (lo - start[axis]) / d,
            q = (hi - start[axis]) / d
          near = Math.max(near, Math.min(p, q))
          far = Math.min(far, Math.max(p, q))
          if (near > far) return false
        }
      }
      return true
    })
  }
  const points: ScenePoint[] = []
  for (let y = 0; y < t.span; y++)
    for (let x = 0; x < t.span; x++)
      points.push({ ...tokenPoint(t), x: t.x + x + 0.5, y: t.y + y + 0.5 })
  if (fully)
    for (const x of [0.001, t.span - 0.001])
      for (const y of [0.001, t.span - 0.001])
        for (const height of [
          t.spatial?.height ?? 0,
          (t.spatial?.height ?? 0) + t.span * s.grid.feet,
        ])
          points.push({ ...tokenPoint(t), x: t.x + x, y: t.y + y, height })
  return fully
    ? points.every((p) => regionContains(w, a, s, e, p))
    : points.some((p) => regionContains(w, a, s, e, p))
}
export function soundBetween(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  from: ScenePoint,
  to: ScenePoint,
) {
  return queryPropagation(w, a, s, from, to, 'sound').clear
}
export function hearsSound(w: MapWorld, a: Adventure, t: MapToken) {
  const entity = m1Entity(w, a, terrainEntityId(t))
  // Narrative NPCs may have no combat body. Missing combat data is not Deafened;
  // their existing language/permission checks remain the communication authority.
  if (!entity) return true
  const cat = catalogue([srd, ...w.packs])
  return !(
    entity.c
      ? runtimeDerived(entity.c, cat).conditions
      : combatStats(
          entity.actor ?? {
            id: entity.id,
            characterId: null,
            npc: entity.body ?? null,
            side: 'neutral',
            initiative: null,
            surprised: false,
            turn: freshTurn(),
          },
          w.characters,
          cat,
        ).conditions
  ).includes('deafened')
}
export function silenced(w: MapWorld, a: Adventure, s: MapScene, t: MapToken) {
  return !!a.sceneEffects?.regions.some(
    (e) => e.spellId === 'silence' && magicTouches(w, a, s, e, t, true),
  )
}
/** A barrier is directional for sight and selective for movement/effects. It is
 * deliberately not inserted into the static wall list or a universal cover flag. */
export function magicCrossing(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  from: ScenePoint,
  to: ScenePoint,
  id: string,
  options: { forced?: boolean; teleport?: boolean; spellLevel?: number; object?: boolean } = {},
) {
  for (const e of a.sceneEffects?.regions ?? []) {
    if (e.status !== 'active' || !e.magic || e.sceneId !== s.id || !e.geometry) continue
    const g = anchoredGeometry(w, a, e)?.geometry
    if (!g) continue
    const was = geometryContains(g, from, s.grid.feet),
      inside = geometryContains(g, to, s.grid.feet)
    if (e.spellId === 'tiny-hut' && volumeRay(g, from, to, s.grid.feet)) {
      if (options.spellLevel !== undefined) {
        if (options.spellLevel <= 3 && (was !== inside || (!was && !inside)))
          throw Error('小屋阻挡穿过边界的三环及以下法术')
      } else if ((was !== inside || (!was && !inside)) && !e.magic.inside.includes(id))
        throw Error('小屋阻挡未在施放时位于内部的生物／物件')
      else if (!was && inside) {
        const entity = m1Entity(w, a, id)
        for (const row of entity?.c?.inventory ?? [])
          if (
            !e.magic.allowedInventory.some(
              (i) => i.instanceId === row.instanceId && i.quantity >= row.quantity,
            )
          )
            throw Error('小屋阻挡施放后新取得的物件／额外堆叠，请先留在屋外')
        for (const row of entity?.n?.consumables ?? [])
          if (
            row.quantity - (entity?.n?.consumablesUsed?.[row.id] ?? 0) > 0 &&
            !e.magic.allowedInventory.some(
              (i) =>
                i.instanceId === row.id &&
                i.quantity >= row.quantity - (entity?.n?.consumablesUsed?.[row.id] ?? 0),
            )
          )
            throw Error('小屋阻挡新取得的实际物件')
      }
    }
    if (
      e.spellId === 'magic-circle' &&
      was !== inside &&
      !options.forced &&
      options.spellLevel === undefined
    ) {
      const entity = m1Entity(w, a, id),
        type = sceneCreatureType(w, a, id)
      if (
        e.magic.types.includes(type as (typeof e.magic.types)[number]) &&
        (e.magic.reverse ? was : inside)
      ) {
        if (options.teleport) {
          if (
            e.magic.crossings.some(
              (c) =>
                c.entityId === id &&
                c.turnKey === terrainTurn(w, a, s) &&
                c.to.x + (m1Entity(w, a, id)?.token?.span ?? 1) / 2 === to.x &&
                c.to.y + (m1Entity(w, a, id)?.token?.span ?? 1) / 2 === to.y &&
                c.to.height === to.height &&
                c.success,
            )
          )
            continue
          throw Error('法阵：传送穿越须先经魅力豁免；请使用法阵穿越审核')
        }
        throw Error('法阵阻止所选类型自愿穿越此方向')
      }
    }
    if (e.spellId === 'wind-wall' && volumeRay(g, from, to, s.grid.feet)) {
      const entity = m1Entity(w, a, id),
        object = options.object
          ? a.m3?.entities.find((o) => o.id === id && o.enabled && o.sceneId === s.id)
          : undefined,
        flying = from.height > m3GroundAt(a, s, from) || to.height > m3GroundAt(a, s, to),
        size = entity?.c
          ? runtimeDerived(entity.c, catalogue([srd, ...w.packs])).currentSize
          : entity?.body?.size
      if (
        entity?.state.effects?.some((f) => f.key === 'gaseous-form') ||
        (flying &&
          (['tiny', 'small'].includes((size ?? '').toLowerCase()) ||
            (object && Math.max(object.width, object.depth, object.heightFeet) <= 5)))
      )
        throw Error('风墙阻止小型／微型飞行生物、飞行物件和气体形态穿越')
    }
  }
}
export function windMovementCost(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  from: ScenePoint,
  to: ScenePoint,
) {
  return a.sceneEffects?.regions.some(
    (e) =>
      e.status === 'active' &&
      e.spellId === 'gust-of-wind' &&
      magicTouches(w, a, s, e, {
        ...t,
        x: to.x - t.span / 2,
        y: to.y - t.span / 2,
        spatial: { ...t.spatial, layer: t.spatial?.layer ?? 'material', height: to.height },
      }) &&
      (to.x - from.x) * Math.cos(((e.magic?.angle ?? 0) * Math.PI) / 180) +
        (to.y - from.y) * Math.sin(((e.magic?.angle ?? 0) * Math.PI) / 180) <
        -1e-7,
  )
    ? 1
    : 0
}
export function queueMagic(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  phase: 'created' | 'enter' | 'start' | 'end' | 'moved' | 'strike' | 'trigger',
  receipt: string,
  only?: SceneEffect,
) {
  const id = terrainEntityId(t),
    entity = m1Entity(w, a, id)
  if (!entity || entity.dead) return
  const state = sceneEffects(a),
    turn = terrainTurn(w, a, s)
  for (const e of only ? [only] : state.regions) {
    const m = e.magic
    if (
      !m ||
      e.status !== 'active' ||
      e.sceneId !== s.id ||
      !e.geometry ||
      m.excludedIds.includes(id)
    )
      continue
    const inZone = magicTouches(w, a, s, e, t),
      nearSphere =
        e.spellId === 'flaming-sphere' &&
        magicDistance(tokenPoint(t), sceneCenter(e.geometry), s.grid.feet) <= 7.5
    if (!inZone && !nearSphere && !(phase === 'strike' && e.spellId === 'call-lightning')) continue
    let formula: string | undefined,
      save: 'str' | 'dex' | 'con' | 'wis' | undefined,
      type = m.damageType,
      half = false,
      push = false,
      optional = false,
      once = false
    switch (e.spellId) {
      case 'gust-of-wind':
        if (id === e.sourceId || !['created', 'end'].includes(phase)) continue
        save = 'str'
        push = true
        break
      case 'wind-wall':
        if (phase !== 'created') continue
        formula = '4d8'
        save = 'str'
        type = 'bludgeoning'
        half = true
        break
      case 'moonbeam':
        if (!['created', 'enter', 'moved', 'end'].includes(phase)) continue
        formula = `${e.slotLevel}d10`
        save = 'con'
        type = 'radiant'
        half = true
        once = true
        break
      case 'cloud-of-daggers':
        if (!['created', 'enter', 'moved', 'end'].includes(phase)) continue
        formula = `${e.slotLevel * 2}d4`
        type = 'slashing'
        once = true
        break
      case 'spirit-guardians':
        if (!['created', 'enter', 'moved', 'end'].includes(phase) || id === e.sourceId) continue
        formula = `${e.slotLevel}d8`
        save = 'wis'
        half = true
        once = true
        break
      case 'hunger-of-hadar':
        if (!['start', 'end'].includes(phase)) continue
        formula = '2d6'
        type = phase === 'start' ? 'cold' : 'acid'
        if (phase === 'end') save = 'dex'
        break
      case 'cordon-of-arrows':
        if (!['enter', 'end'].includes(phase) || id === e.sourceId || m.ammunition <= 0) continue
        formula = '2d4'
        save = 'dex'
        type = 'piercing'
        break
      case 'flaming-sphere':
        if (!['end', 'strike'].includes(phase) || (phase === 'strike' && !inZone)) continue
        formula = `${e.slotLevel}d6`
        save = 'dex'
        type = 'fire'
        half = true
        break
      case 'call-lightning':
        if (phase !== 'strike') continue
        formula = `${e.slotLevel + (m.storm ? 1 : 0)}d10`
        save = 'dex'
        type = 'lightning'
        half = true
        break
      case 'conjure-animals': {
        if (!['enter', 'moved', 'end'].includes(phase) || id === e.sourceId) continue
        const source = m1Entity(w, a, e.sourceId)?.token
        if (!source) continue
        if (!tokenPerception(w, a, s, source, t, catalogue([srd, ...w.packs])).canSee) continue
        formula = `${e.slotLevel}d10`
        save = 'dex'
        type = 'slashing'
        optional = true
        once = true
        break
      }
      default:
        continue
    }
    const battle = w.encounters.find((b) => b.id === s.encounterId && b.phase === 'active')
    if (
      m.oldReceipts.some(
        (r) =>
          r.entityId === id && r.tick === battle?.tick && (r.phase === 'any' || r.phase === phase),
      )
    )
      continue
    const key = `${e.id}:${id}:${once ? 'any' : phase}:${once ? turn : (phase === 'enter' && e.spellId !== 'cordon-of-arrows') || phase === 'strike' || phase === 'moved' ? receipt : turn}`
    if (state.hazards.some((h) => h.receipt === key)) continue
    if (e.spellId === 'cordon-of-arrows') m.ammunition--
    if (state.hazards.length >= 10000) throw Error('区域事件已满，请先归档')
    state.hazards.push({
      id: crypto.randomUUID(),
      effectId: e.id,
      entityId: id,
      sceneId: s.id,
      receipt: key,
      phase,
      status: 'pending',
      turnKey: turn,
      distance: 0,
      rolls: [],
      note: optional ? '由施法者选择是否影响该可见目标' : '',
      magic: {
        dc: m.dc,
        formula,
        save,
        type,
        half,
        rolled: false,
        endsSource: false,
        ...(optional ? {} : { decision: 'apply' as const }),
        ...(push
          ? {
              push: {
                angle: m.angle,
                feet: 15,
                travel: 0,
                from: { x: t.x, y: t.y, height: t.spatial?.height ?? 0 },
              },
            }
          : {}),
      },
    })
  }
}
export function magicMovement(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  previous: MapToken,
  next: MapToken,
  receipt: string,
) {
  magicCrossing(w, a, s, tokenPoint(previous), tokenPoint(next), terrainEntityId(next))
  for (const e of a.sceneEffects?.regions ?? []) {
    if (e.status !== 'active' || !e.magic || !e.geometry || e.sceneId !== s.id) continue
    if (e.spellId === 'conjure-animals' && e.sourceId === terrainEntityId(next)) {
      const battle = w.encounters.find((b) => b.id === s.encounterId && b.phase === 'active')
      if (
        !battle ||
        battle.actors[battle.current]?.characterId === e.sourceId ||
        battle.actors[battle.current]?.npcId === e.sourceId
      )
        e.magic.moveBudget = 30
    }
    if (e.anchor.kind === 'creature' && e.sourceId === terrainEntityId(next)) {
      // Evaluate each traversed square, rather than sweeping a teleport destination.
      e.geometry = { ...e.geometry, x: next.x, y: next.y, height: next.spatial?.height ?? 0 }
      const anchor = e.anchor
      e.anchor = { kind: 'point', offsetHeight: 0 }
      try {
        for (const other of s.tokens) queueMagic(w, a, s, other, 'moved', receipt, e)
      } finally {
        e.anchor = anchor
      }
    } else if (!magicTouches(w, a, s, e, previous) && magicTouches(w, a, s, e, next)) {
      queueMagic(w, a, s, next, 'enter', receipt, e)
      triggerDevice(w, a, s, e, next, 'enter', receipt)
    }
  }
}
function addRegionEffect(
  w: MapWorld,
  a: Adventure,
  e: SceneEffect,
  t: MapToken,
  key: string,
  patch: Partial<ActiveEffect>,
) {
  const entity = m1Entity(w, a, terrainEntityId(t))
  if (!entity) return
  const effects = (entity.state.effects ??= [])
  const old = effects.find((f) => f.castId === e.castId && f.key === key)
  if (old) Object.assign(old, patch)
  else
    effects.push({
      id: crypto.randomUUID(),
      key,
      spellId: e.spellId,
      spellLevel: e.slotLevel,
      castId: e.castId,
      sourceId: e.sourceId,
      clockSourceId: e.clockSourceId,
      name: e.name,
      page: 0,
      concentration: false,
      expiresAt: null,
      encounterId: 'outside',
      phase: 'end',
      visibility: 'public',
      note: '随实际区域与来源更新',
      ...patch,
    })
}
export function reconcileMagic(w: MapWorld, a: Adventure) {
  for (const e of a.sceneEffects?.regions ?? []) {
    if (!e.magic || !e.geometry) continue
    const s = a.scenes.find((s) => s.id === e.sceneId)
    if (!s) continue
    const g = anchoredGeometry(w, a, e)
    if (e.status === 'active' && e.spellId === 'gust-of-wind')
      for (const fog of a.sceneEffects?.regions ?? []) {
        if (
          fog.status !== 'active' ||
          !['fog-cloud', 'stinking-cloud'].includes(fog.spellId) ||
          fog.sceneId !== s.id ||
          !fog.geometry
        )
          continue
        if (
          volumeRay(
            e.geometry,
            sceneCenter(fog.geometry),
            sceneCenter(fog.geometry),
            s.grid.feet,
          ) ||
          volumeRay(
            fog.geometry,
            sceneCenter(e.geometry),
            {
              ...sceneCenter(e.geometry),
              x:
                sceneCenter(e.geometry).x +
                (Math.cos((e.magic.angle * Math.PI) / 180) * 60) / s.grid.feet,
              y:
                sceneCenter(e.geometry).y +
                (Math.sin((e.magic.angle * Math.PI) / 180) * 60) / s.grid.feet,
            },
            s.grid.feet,
          )
        )
          endSceneCast(w, a, fog.castId, '实际造风路径驱散气雾')
      }
    if (e.status === 'active' && e.spellId === 'tiny-hut') {
      const source = m1Entity(w, a, e.sourceId)?.token
      if (!source || !s.tokens.includes(source) || !magicTouches(w, a, s, e, source))
        endSceneCast(w, a, e.castId, '小屋来源离开固定区域')
    }
    if (
      e.status === 'active' &&
      e.spellId === 'glyph-of-warding' &&
      e.magic.origin &&
      g &&
      magicDistance(e.magic.origin, sceneCenter(g.geometry), s.grid.feet) > 10
    )
      endSceneCast(w, a, e.castId, '符文物件离开原施法位置超过10尺，未触发')
    for (const scene of a.scenes)
      for (const t of scene.tokens) {
        const entity = m1Entity(w, a, terrainEntityId(t))
        if (!entity) continue
        const touching = e.status === 'active' && scene.id === s.id && magicTouches(w, a, s, e, t),
          inside = e.status === 'active' && scene.id === s.id && magicTouches(w, a, s, e, t, true)
        entity.state.effects = (entity.state.effects ?? []).filter(
          (f) =>
            !(
              f.castId === e.castId &&
              [
                'silence-region',
                'hadar-region',
                'guardians-region',
                'moonbeam-no-shape',
                'animals-strength',
              ].includes(f.key) &&
              !(['silence-region', 'hadar-region'].includes(f.key) ? inside : touching)
            ),
        )
        const circleProtection =
          e.status === 'active' &&
          scene.id === s.id &&
          e.spellId === 'magic-circle' &&
          (e.magic.reverse ? !magicTouches(w, a, s, e, t) : magicTouches(w, a, s, e, t))
        entity.state.effects = entity.state.effects.filter(
          (f) =>
            !(f.castId === e.castId && f.key === 'magic-circle-protection' && !circleProtection),
        )
        if (circleProtection) {
          const trapped = e.magic.reverse
            ? s.tokens
                .filter(
                  (t) =>
                    magicTouches(w, a, s, e, t) &&
                    e.magic!.types.includes(
                      sceneCreatureType(w, a, terrainEntityId(t)) as (typeof e.magic.types)[number],
                    ),
                )
                .flatMap((t) =>
                  [t.id, t.characterId, t.actorId, t.npcId].filter((id): id is string => !!id),
                )
            : []
          addRegionEffect(w, a, e, t, 'magic-circle-protection', {
            protectedTypes: e.magic.reverse ? [] : e.magic.types,
            protectedSourceIds: trapped,
          })
        }
        if (
          touching &&
          e.spellId === 'spirit-guardians' &&
          terrainEntityId(t) !== e.sourceId &&
          !e.magic.excludedIds.includes(terrainEntityId(t))
        )
          addRegionEffect(w, a, e, t, 'guardians-region', {})
        if (!inside) continue
        if (e.spellId === 'silence')
          addRegionEffect(w, a, e, t, 'silence-region', {
            condition: 'deafened',
            damageImmunities: ['thunder'],
          })
        if (e.spellId === 'hunger-of-hadar')
          addRegionEffect(w, a, e, t, 'hadar-region', { condition: 'blinded' })
        if (
          e.spellId === 'spirit-guardians' &&
          terrainEntityId(t) !== e.sourceId &&
          !e.magic.excludedIds.includes(terrainEntityId(t))
        )
          addRegionEffect(w, a, e, t, 'guardians-region', {})
      }
    if (e.status === 'active' && e.spellId === 'conjure-animals') {
      const source = m1Entity(w, a, e.sourceId)?.token
      if (
        source &&
        g &&
        geometryContains({ ...g.geometry, size: 5 }, tokenPoint(source), s.grid.feet)
      )
        addRegionEffect(w, a, e, source, 'animals-strength', { saveAdvantage: ['str'] })
      else {
        const entity = m1Entity(w, a, e.sourceId)
        if (entity)
          entity.state.effects = entity.state.effects?.filter(
            (f) => !(f.castId === e.castId && f.key === 'animals-strength'),
          )
      }
    }
  }
}
export type MagicHazard = SceneEffects['hazards'][number]
