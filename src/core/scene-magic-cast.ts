import {itemWaivesMaterials} from './item-spells'
import type { Adventure, MapWorld, MapScene } from './map-types'
import type {
  SceneEffect,
  SceneEffectCast,
  SceneGeometry,
} from '../persistence/scene-effects-schema'
import { sceneMagicSchema, sceneMagicChoiceSchema } from '../persistence/scene-magic-schema'
import type { Catalogue } from './engine'
import { runtimeSpells, runtimeDerived, castSlotLevel } from './runtime'
import { m3Caster } from './m3-world-cast'
import { m3GroundAt } from './m3-ground'
import { m1Entity } from './m1-utility'
import { sceneEffects, tokenPoint, endSceneCast } from './scene-effects'
import { terrainTurn, terrainEntityId } from './scene-terrain'
import { geometryContains, sceneCenter } from './scene-effect-geometry'
import { magicDistance, magicTouches, queueMagic, magicCrossing } from './scene-magic'
import { physicalPropagation } from './scene-propagation'
import { sceneVision } from './scene-lighting'
import { tokenM3State, tokenPerception } from './m3-map-perception'
import { volumeRay } from './scene-effect-geometry'
import { wallActive } from './map-spatial'
import { magicPointVisible } from './scene-magic'
import { MAGIC_RULES } from './scene-magic-rules'
import { validateStoredSpell } from './scene-magic-storage'
type Caster = ReturnType<typeof m3Caster>
const materialCosts: Record<string, { kind: string; value: number }> = {
  'arcane-lock': { kind: 'gold-dust', value: 25 },
  'magic-mouth': { kind: 'jade-dust', value: 10 },
  'glyph-of-warding': { kind: 'diamond-dust', value: 200 },
  'magic-circle': { kind: 'silver-salt', value: 100 },
}
function supplies(w: MapWorld, a: Adventure, c: Caster, ids: string[]) {
  return ids.map((id) => {
    const m = sceneEffects(a).materials.find((m) => m.ownerId === c.id && m.instanceId === id),
      row = c.c?.inventory.find((i) => i.instanceId === id && i.quantity > 0),
      supply = c.n?.consumables?.find(
        (i) => i.id === id && i.quantity - (c.n?.consumablesUsed?.[id] ?? 0) > 0,
      )
    if (!m || (!row && !supply)) throw Error('材料必须是已核验、仍由施法者持有的实际库存')
    return m
  })
}
export function validateMagicCast(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  c: Caster,
  op: SceneEffectCast,
  spellId: string,
  slot: number,
  cat: Catalogue,
) {
  if (
    w.encounters.some((b) => b.id === s.encounterId && b.phase === 'active') &&
    /minute|hour/i.test(cat.spells.find((sp) => sp.id === spellId)?.castingTime ?? '')
  )
    throw Error('分钟／小时施法须在战斗外完整施放')
  const r = MAGIC_RULES[spellId]!,
    m = sceneMagicChoiceSchema.parse(op.magic ?? {}),
    t = c.token!
  const point = s.points.find((p) => p.id === m.pointId && p.enabled),
    object = a.m3?.entities.find((o) => o.id === op.objectId && o.enabled && o.sceneId === s.id)
  const self = ['gust-of-wind', 'spirit-guardians', 'tiny-hut'].includes(spellId)
  const locations = self
    ? [{ x: t.x, y: t.y, height: t.spatial?.height ?? 0 }]
    : spellId === 'wind-wall' && m.path.length
      ? [m.path[0]!]
      : object
        ? [{ x: object.x, y: object.y, height: object.height }]
        : point
          ? [{ x: point.x, y: point.y, height: m3GroundAt(a, s, point) }]
          : op.points
  if (locations.length !== 1) throw Error('本法术须明确一个实际起点／物件，不能同时指定多个中心')
  const p = locations[0]!,
    to = { x: p.x + 0.5, y: p.y + 0.5, height: p.height }
  if (
    p.x < 0 ||
    p.y < 0 ||
    p.x >= s.grid.columns ||
    p.y >= s.grid.rows ||
    (magicDistance(tokenPoint(t), to, s.grid.feet) > r.range && !self)
  )
    throw Error('区域起点超出实际场景或施法距离')
  if (!physicalPropagation(a, s, tokenPoint(t), to, 'effect').clear)
    throw Error('法术起点被完全遮挡')
  magicCrossing(w, a, s, tokenPoint(t), to, c.id, { spellLevel: slot })
  if (
    ['knock', 'magic-mouth', 'magic-circle', 'call-lightning', 'conjure-animals'].includes(spellId)
  ) {
    const senses = tokenM3State(w, a, t, cat),
      seen = sceneVision(w, a, s, tokenPoint(t), to, senses)
    if (
      !seen.ray.clear ||
      !seen.illuminated ||
      (senses.blinded && senses.blindsight < magicDistance(tokenPoint(t), to, s.grid.feet))
    )
      throw Error('此法术要求施法者真实可见的起点／物件')
  }
  if (
    spellId === 'spirit-guardians' &&
    m.excludedIds.some((id) => {
      const target = m1Entity(w, a, id)?.token
      return (
        !target || !s.tokens.includes(target) || !tokenPerception(w, a, s, t, target, cat).canSee
      )
    })
  )
    throw Error('灵体卫士只能将施法时本人可见的真实生物列入豁免名单')
  let anchor: SceneEffect['anchor'] = { kind: 'point', offsetHeight: 0 }
  if (['gust-of-wind', 'spirit-guardians'].includes(spellId))
    anchor = { kind: 'creature', id: c.id, offsetHeight: 0 }
  if (['arcane-lock', 'knock'].includes(spellId)) {
    if (!point || !['door', 'chest'].includes(point.kind))
      throw Error('须选择已启用的真实门／窗／容器互动点')
    if (spellId === 'arcane-lock' && !['closed', 'locked'].includes(point.state))
      throw Error('秘法锁只能施放于已关闭的实际门／容器')
    if (
      spellId === 'knock' &&
      !sceneEffects(a).regions.some(
        (e) =>
          e.status === 'active' && e.spellId === 'arcane-lock' && e.magic?.pointId === point.id,
      ) &&
      point.state !== 'locked' &&
      !sceneEffects(a).locks.some(
        (l) => l.pointId === point.id && (l.locks || l.barred || l.jammed),
      )
    )
      throw Error('目标没有待开启的普通锁、门闩、卡死或秘法锁')
  }
  if (['magic-mouth', 'glyph-of-warding'].includes(spellId)) {
    if (
      !object ||
      object.boundCharacterId ||
      (spellId === 'glyph-of-warding' && (object.width > 10 || object.depth > 10))
    )
      throw Error('须选择未被穿戴／携带的实际物件或表面；符文表面至多10尺')
    anchor = { kind: 'object', id: object.id, offsetHeight: 0 }
    if (
      point &&
      (point.x < object.x ||
        point.y < object.y ||
        (point.x - object.x) * s.grid.feet > object.width ||
        (point.y - object.y) * s.grid.feet > object.depth)
    )
      throw Error('关联的开启互动点必须对应同一实际物件，不得关联远处门／箱')
  }
  if (spellId === 'magic-mouth' && (!m.message.trim() || !m.wordCountConfirmed || !m.trigger))
    throw Error('魔嘴术须填写完整原文、确认25词以内并明确可见／可听触发条件；不会自动截字')
  if (spellId === 'glyph-of-warding') {
    if (!m.trigger) throw Error('守卫刻文须明确触发条件')
    if (m.glyph === 'spell') validateStoredSpell(w, a, c, op, slot, cat)
    else if (!['acid', 'cold', 'fire', 'lightning', 'thunder'].includes(m.damageType))
      throw Error('爆炸符文伤害请选择强酸／冷冻／火焰／闪电／雷鸣')
  }
  if (spellId === 'wind-wall') {
    if (m.path.length < 2) throw Error('风墙须至少两个连续路径点')
    const length = m.path
      .slice(1)
      .reduce(
        (n, p, i) =>
          n + Math.hypot((p.x - m.path[i]!.x) * s.grid.feet, (p.y - m.path[i]!.y) * s.grid.feet),
        0,
      )
    if (
      length > 50 + 1e-7 ||
      m.path.some(
        (q) =>
          q.x >= s.grid.columns ||
          q.y >= s.grid.rows ||
          q.height !== m3GroundAt(a, s, q) ||
          magicDistance(tokenPoint(t), { ...q, x: q.x + 0.5, y: q.y + 0.5 }, s.grid.feet) > 120,
      )
    )
      throw Error('风墙须在真实地面形成总长至多50尺、120尺内连续路径')
    for (let i = 1; i < m.path.length; i++) {
      if (
        !physicalPropagation(
          a,
          s,
          { ...m.path[i - 1]!, x: m.path[i - 1]!.x + 0.5, y: m.path[i - 1]!.y + 0.5 },
          { ...m.path[i]!, x: m.path[i]!.x + 0.5, y: m.path[i]!.y + 0.5 },
          'effect',
        ).clear
      )
        throw Error('风墙连续路径不能穿过实际完全遮挡的墙门')
      magicCrossing(w, a, s, m.path[i - 1]!, m.path[i]!, c.id, { spellLevel: slot })
    }
  }
  if (
    ['flaming-sphere', 'magic-circle', 'cordon-of-arrows'].includes(spellId) &&
    p.height !== m3GroundAt(a, s, p)
  )
    throw Error('须选择真实地面／平台')
  if (
    ['flaming-sphere', 'conjure-animals'].includes(spellId) &&
    s.tokens.some((o) => o.x === p.x && o.y === p.y && (o.spatial?.height ?? 0) === p.height)
  )
    throw Error('效果须从未被生物占据的位置出现')
  if (spellId === 'call-lightning') {
    const env = a.m3?.environments.find((e) => e.sceneId === s.id)
    if (
      !env ||
      p.height <= (t.spatial?.height ?? 0) ||
      (!env.openSky && (env.ceilingHeight === undefined || p.height + 10 > env.ceilingHeight))
    )
      throw Error('须核实天空／天花板；雷云须在施法者上方并容纳10尺厚云层')
    if (!m.strike) throw Error('须明确云下首次雷击落点')
    validateLightning(s, p, m.strike)
    if (
      !magicPointVisible(w, a, s, t, { ...m.strike, x: m.strike.x + 0.5, y: m.strike.y + 0.5 }, cat)
    )
      throw Error('首次雷击点必须真实可见')
    const cloud = {
      ...p,
      shape: 'cylinder' as const,
      size: 60,
      heightFeet: 10,
      width: 5,
      angle: 0,
      originSpan: 1,
    }
    if (
      (s.walls ?? []).some(
        (wall) =>
          wallActive(s, wall) &&
          wall.blocksTargeting &&
          (wall.heightFeet === undefined || p.height < env.floorHeight + wall.heightFeet) &&
          volumeRay(
            cloud,
            { ...wall.a, height: p.height },
            { ...wall.b, height: p.height },
            s.grid.feet,
          ),
      )
    )
      throw Error('雷云所需空间与实际墙体冲突，或相关墙高尚未核实')
    if (m.storm && (!env.openSky || !env.storm)) throw Error('风暴加骰须先由GM核实已有室外风暴事实')
  }
  if (spellId === 'magic-circle' && !m.types.length) throw Error('法阵须选择至少一个真实生物类型')
  if (spellId === 'spirit-guardians' && !['radiant', 'necrotic'].includes(m.damageType))
    throw Error('灵体卫士须选择光耀或暗蚀伤害')
  if (spellId === 'tiny-hut') {
    const g: SceneGeometry = {
      ...p,
      shape: 'emanation',
      size: 10,
      heightFeet: 0,
      width: 5,
      angle: 0,
      originSpan: t.span,
    }
    const temp = {
      status: 'active',
      covered: false,
      sceneId: s.id,
      layer: t.spatial?.layer ?? 'material',
      anchor: { kind: 'point', offsetHeight: 0 },
      geometry: g,
    } as SceneEffect
    for (const o of s.tokens)
      if (magicTouches(w, a, s, temp, o) && !magicTouches(w, a, s, temp, o, true))
        throw Error('小屋不能完整容纳区域内全部生物，本次施法失败；请调整位置')
  }
  const cost = materialCosts[spellId]
  if (cost && !itemWaivesMaterials(c.c?runtimeSpells(c.c,cat).find(g=>g.key===op.key):undefined)) {
    const mats = supplies(w, a, c, m.materialIds)
    if (mats.length !== 1 || mats[0]!.kind !== cost.kind || mats[0]!.valueGP < cost.value)
      throw Error(`须核实并消耗价值至少${cost.value}GP的${cost.kind}，不能以金币代替`)
  }
  if (spellId === 'cordon-of-arrows') {
    const count = slot >= 3 ? 6 : 4
    if (m.ammunitionIds.length !== count)
      throw Error(`箭簇须选择${count}支实际非魔法箭／弩矢；普通NPC需先由GM配置真实弹药库存`)
    for (const id of new Set(m.ammunitionIds)) {
      const row = c.c?.inventory.find((i) => i.instanceId === id),
        supply = c.n?.consumables?.find((i) => i.id === id)
      if (
        !(row || supply) ||
        !['arrow', 'arrows', 'bolt', 'bolts', 'crossbow-bolts'].includes((row ?? supply)!.itemId) ||
        row?.specialWeapon ||
        (row?.quantity ?? (supply?.quantity ?? 0) - (c.n?.consumablesUsed?.[id] ?? 0)) <
          m.ammunitionIds.filter((x) => x === id).length
      )
        throw Error('箭簇弹药必须来自本人实际非魔法箭／弩矢库存')
    }
  }
  return { locations, anchor, m }
}
export function consumeMagicMaterials(
  w: MapWorld,
  a: Adventure,
  c: Caster,
  op: SceneEffectCast,
  spellId: string,
  cat:Catalogue,
) {
  const m = sceneMagicChoiceSchema.parse(op.magic ?? {}),
    ids = materialCosts[spellId] && !itemWaivesMaterials(c.c?runtimeSpells(c.c,cat).find(g=>g.key===op.key):undefined) ? m.materialIds : []
  for (const id of [...ids, ...(spellId === 'cordon-of-arrows' ? m.ammunitionIds : [])]) {
    const live = m1Entity(w, a, c.id)!
    if (live.c) {
      const row = live.c.inventory.find((i) => i.instanceId === id)!
      row.quantity--
      if (!row.quantity) live.c.inventory = live.c.inventory.filter((i) => i !== row)
    } else {
      live.n!.consumablesUsed ??= {}
      live.n!.consumablesUsed[id] = (live.n!.consumablesUsed[id] ?? 0) + 1
    }
  }
}
export function validateLightning(
  s: MapScene,
  cloud: { x: number; y: number; height: number },
  strike: { x: number; y: number; height: number },
) {
  if (
    strike.x < 0 ||
    strike.y < 0 ||
    strike.x >= s.grid.columns ||
    strike.y >= s.grid.rows ||
    strike.height >= cloud.height ||
    Math.hypot((strike.x - cloud.x) * s.grid.feet, (strike.y - cloud.y) * s.grid.feet) > 60
  )
    throw Error('雷击点必须位于真实雷云下方60尺半径内')
}
export function configureMagicRegion(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  c: Caster,
  op: SceneEffectCast,
  e: SceneEffect,
  cat: Catalogue,
) {
  const r = MAGIC_RULES[e.spellId]!,
    m = sceneMagicChoiceSchema.parse(op.magic ?? {}),
    grant = c.c ? runtimeSpells(c.c, cat).find((g) => g.key === op.key) : undefined,
    ability = c.body?.abilities?.find((b) => b.id === op.key),
    attr = grant?.ability ?? ability?.ability ?? c.body?.spellcasting?.ability ?? 'wis'
  const bonus = c.c
    ? Math.ceil(c.c.level / 4) + 1 + runtimeDerived(c.c, cat).mods[attr]
    : (c.body?.spellcasting?.dc ??
        8 +
          (c.body?.templateMetadata?.proficiencyBonus ?? 2) +
          Math.floor(((c.body?.scores[attr] ?? 10) - 10) / 2)) - 8
  e.geometry = {
    ...e.geometry!,
    shape: r.shape,
    size: r.size,
    heightFeet: r.height,
    width: e.spellId === 'wind-wall' ? 1 : 10,
    angle: m.angle,
    originSpan:
      e.spellId === 'spirit-guardians' || e.spellId === 'tiny-hut'
        ? c.token!.span
        : e.spellId === 'conjure-animals'
          ? 2
          : 1,
    ...(e.spellId === 'wind-wall' ? { points: m.path } : {}),
    ...(e.spellId === 'alarm' && m.pointId ? { shape: 'cube' as const, size: s.grid.feet } : {}),
  }
  delete e.light
  e.magic = sceneMagicSchema.parse({
    dc: 8 + bonus,
    attackBonus: bonus,
    createdTurn: terrainTurn(w, a, s),
    angle: m.angle,
    damageType: m.damageType,
    storm: m.storm,
    excludedIds: m.excludedIds,
    pointId: m.pointId,
    allowedIds: m.excludedIds,
    password: m.password,
    alarm: m.alarm,
    trigger: m.trigger,
    message: m.message,
    repeat: m.repeat,
    glyph: m.glyph,
    types: m.types,
    reverse: m.reverse,
    hutLight: m.hutLight,
    ammunition: e.spellId === 'cordon-of-arrows' ? m.ammunitionIds.length : 0,
    origin: sceneCenter(e.geometry),
  })
  if (e.spellId === 'silence') e.channels = ['sound']
  if (e.spellId === 'hunger-of-hadar') e.obscurity = 'absolute-darkness'
  if (e.spellId === 'moonbeam' || e.spellId === 'flaming-sphere')
    e.light = {
      bright: e.spellId === 'flaming-sphere' ? 20 : 0,
      dimExtra: e.spellId === 'flaming-sphere' ? 20 : 5,
      sunlight: false,
      magical: true,
      flame: e.spellId === 'flaming-sphere',
      color: r.color,
    }
  if (e.spellId === 'tiny-hut') {
    for (const old of sceneEffects(a).regions.filter(
      (old) =>
        old.id !== e.id &&
        old.spellId === 'tiny-hut' &&
        old.sourceId === e.sourceId &&
        old.status === 'active',
    ))
      endSceneCast(w, a, old.castId, '来源再次施放小屋')
    e.magic.inside = [
      ...s.tokens.filter((t) => magicTouches(w, a, s, e, t, true)).map(terrainEntityId),
      ...(a.m3?.entities
        .filter(
          (o) =>
            o.enabled &&
            o.sceneId === s.id &&
            [0, o.width / s.grid.feet].every((x) =>
              [0, o.depth / s.grid.feet].every((y) =>
                [0, o.heightFeet].every((height) =>
                  geometryContains(
                    e.geometry!,
                    { x: o.x + x, y: o.y + y, height: o.height + height },
                    s.grid.feet,
                  ),
                ),
              ),
            ),
        )
        .map((o) => o.id) ?? []),
    ]
    for (const t of s.tokens.filter((t) => e.magic!.inside.includes(terrainEntityId(t)))) {
      const entity = m1Entity(w, a, terrainEntityId(t))
      for (const row of entity?.c?.inventory ?? []) {
        e.magic.inside.push(row.instanceId)
        e.magic.allowedInventory.push({ instanceId: row.instanceId, quantity: row.quantity })
      }
      for (const row of entity?.n?.consumables ?? []) {
        e.magic.inside.push(row.id)
        const quantity = row.quantity - (entity?.n?.consumablesUsed?.[row.id] ?? 0)
        if (quantity > 0) e.magic.allowedInventory.push({ instanceId: row.id, quantity })
      }
    }
    for (const ground of s.groundItems ?? [])
      if (
        ground.enabled &&
        geometryContains(
          e.geometry!,
          { x: ground.x + 0.5, y: ground.y + 0.5, height: m3GroundAt(a, s, ground) },
          s.grid.feet,
        )
      ) {
        const id = ground.inventoryState?.instanceId ?? ground.inventoryInstanceId ?? ground.id
        e.magic.inside.push(id)
        e.magic.allowedInventory.push({ instanceId: id, quantity: ground.quantity })
      }
  }
  e.hidden = ['magic-mouth', 'glyph-of-warding', 'alarm', 'arcane-lock', 'silence'].includes(
    e.spellId,
  )
  if (e.spellId === 'conjure-animals') e.magic.initialMembers = []
  if (e.spellId === 'knock') {
    const target = sceneEffects(a).regions.find(
      (old) =>
        old.status === 'active' &&
        old.spellId === 'arcane-lock' &&
        old.magic?.pointId === m.pointId,
    )
    if (target) target.magic!.suppressedUntil = e.createdHour + 1 / 6
    else {
      const p = s.points.find((p) => p.id === m.pointId)!,
        lock = sceneEffects(a).locks.find((l) => l.pointId === p.id)
      if (lock) {
        if (lock.locks) lock.locks--
        else if (lock.barred) lock.barred = false
        else lock.jammed = false
        if (!lock.locks && !lock.barred && !lock.jammed) p.state = 'closed'
      } else p.state = 'closed'
    }
    e.status = 'ended'
  }
  return e
}
