import {systemMessage} from '../shared/localization/system-messages'
import type { Adventure, MapScene, MapToken, MapWorld } from './map-types'
import type { Catalogue } from './engine'
import type {
  SceneEffect,
  SceneEffectAction,
  SceneEffectCast,
} from '../persistence/scene-effects-schema'
import { m1Entity } from './m1-utility'
import {
  sceneEffects,
  anchoredGeometry,
  tokenPoint,
  endSceneCast,
  endSceneEffect,
  effectEvent,
} from './scene-effects'
import {
  queueMagic,
  magicDistance,
  magicTouches,
  magicCrossing,
  magicPointVisible,
  soundBetween,
  hearsSound,
  type MagicHazard,
} from './scene-magic'
import { terrainEntityId, terrainTurn, pendingTerrain } from './scene-terrain'
import { m3ActionCost } from './m3-world-actions'
import { m3GroundAt } from './m3-ground'
import { flamingSphereRoute } from './scene-magic-route'
import { m3Landing, m3State } from './m3-world-cast'
import { m3Hazard } from './m3-space-events'
import { defaultEnvironment, savingRoll, freshTurn, rollDamage, checkedDie } from './combat-rules'
import { prepareDice } from './dice-source'
import { physicalPropagation, regionContains } from './scene-propagation'
import { sceneCenter, geometryContains, volumeRay } from './scene-effect-geometry'
import { validateLightning } from './scene-magic-cast'
import { fireStoredSpell, payStoredSpell } from './scene-magic-storage'
import { appendBroadcast } from './broadcast'
import { tokenPerception } from './m3-map-perception'
import type { DamageType } from './combat-types'
import { sceneMagicSchema } from '../persistence/scene-magic-schema'
export const magicOperation = (op: string) =>
  [
    'weather',
    'mental-alarm',
    'adopt-zone',
    'wind-flames',
    'magic-move',
    'magic-strike',
    'magic-push',
    'magic-trigger',
    'magic-decision',
    'hut-light',
    'mundane-locks',
    'magic-cross',
  ].includes(op)
function actor(w: MapWorld, a: Adventure, id: string) {
  const v = m1Entity(w, a, id)
  if (!v) throw Error('实际人物数据已失效')
  return (
    v.actor ?? {
      id: v.id,
      characterId: v.c?.id ?? null,
      npc: v.body ?? null,
      side: 'neutral' as const,
      initiative: null,
      surprised: false,
      turn: freshTurn(),
    }
  )
}
export function resolveMagicHazard(
  w: MapWorld,
  a: Adventure,
  h: MagicHazard,
  cat: Catalogue,
  dice: (n: number) => number,
  note: string,
) {
  const e = sceneEffects(a).regions.find((e) => e.id === h.effectId),
    m = h.magic,
    entity = m1Entity(w, a, h.entityId)
  if (!e || !m || !entity || h.status !== 'pending' || m.rolled)
    throw Error('区域事件已处理、须先选择目标或继续强制位移')
  if (m.decision === undefined) throw Error('施法者／GM须明确是否让此可见目标受影响')
  if (m.decision === 'skip') {
    h.status = 'resolved'
    h.note = '明确跳过该目标；本回合不再申请'
    return h.note
  }
  const env = defaultEnvironment()
  env.advantage = !!entity.body?.magicResistance
  if (m.save) {
    const roll = savingRoll(
      actor(w, a, entity.id),
      m.save,
      env,
      w.characters,
      cat,
      dice,
      'normal',
      true,
    )
    h.rolls = roll.dice
    h.total = roll.total
    h.success = !roll.autoFail && roll.total >= m.dc
  }
  if (m.formula) {
    const roll = rollDamage(m.formula, dice)
    h.rolls.push(...roll.dice)
    const amount = h.success ? (m.half ? Math.floor(roll.total / 2) : 0) : roll.total
    h.damage = amount ? m3Hazard(w, a, entity.id, amount, m.type as DamageType, cat, dice) : 0
  }
  m.rolled = true
  h.note = note
  if (e.spellId === 'moonbeam' && !h.success) {
    const live = m1Entity(w, a, entity.id)!
    if (live.c?.runtime?.wildShape) live.c.runtime.wildShape = null
    const forms = live.state.effects?.filter((f) => f.key === 'polymorph') ?? []
    for (const f of forms) if (f.castId) endSceneCast(w, a, f.castId, '月华之光迫使变形复原')
    live.state.effects = live.state.effects?.filter(
      (f) => !['polymorph', 'alter-self'].includes(f.key),
    )
    live.state.effects ??= []
    live.state.effects.push({
      id: crypto.randomUUID(),
      key: 'moonbeam-no-shape',
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
      note: '离开此来源月华之光前不能变形',
      visibility: 'public',
    })
  }
  if (m.push && !h.success)
    return `${e.name}豁免失败；结果已保存，等待沿风向强制移动15尺，不重复掷骰`
  h.status = 'resolved'
  if (m.endsSource) endSceneCast(w, a, e.castId, '一次性装置后果已结算')
  return `${e.name}：${entity.name}${m.save ? `豁免${h.total}，${h.success ? '成功' : '失败'}` : ''}${h.damage !== undefined ? `；实际伤害${h.damage}` : ''}；只结算一次`
}
/** Only source-qualified, actually audible messages are published. Device secrets
 * and the trigger recipe are never copied into a public message. */
export function magicSound(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  text: string,
  range: number,
  mental = false,
  verifiedRemote = false,
) {
  const g = anchoredGeometry(w, a, e)
  if (!g) return
  const origin = sceneCenter(g.geometry)
  const ids = verifiedRemote
    ? [e.sourceId]
    : s.tokens
        .filter((t) =>
          mental
            ? terrainEntityId(t) === e.sourceId &&
              magicDistance(tokenPoint(t), origin, s.grid.feet) <= 5280
            : hearsSound(w, a, t) &&
              magicDistance(tokenPoint(t), origin, s.grid.feet) <= range &&
              soundBetween(w, a, s, origin, tokenPoint(t)),
        )
        .map(terrainEntityId)
  if (!ids.length) {
    if (mental)
      effectEvent(
        a,
        e,
        'check',
        '精神警报已触发；施法者不在可测距场景，须由GM核实跨场景距离（不超过1英里）后发送',
      )
    return
  }
  const ev = appendBroadcast(a, crypto.randomUUID(), {message:systemMessage(mental?'spell.mental-alarm':'spell.sound'),
    category: 'resolution',
    type: 'spell.scene-sound',
    title: mental ? '魔法心灵警报' : '可听见的声音',
    text,
    narration: 'direct',
    audience: {
      kind: 'personal',
      characterIds: ids.filter((id) => w.characters.some((c) => c.id === id)),
    },
    sceneId: s.id,
  })
  for (const n of a.ai?.npcs ?? [])
    if (ids.includes(n.characterId ?? n.id)) {
      n.experiences ??= []
      if (n.experiences.length >= 500) {
        const i = n.experiences.findIndex((e) => !e.pinned && e.importance !== 'major')
        if (i < 0) continue
        n.experiences.splice(i, 1)
      }
      n.experiences.push({
        id: crypto.randomUUID(),
        sourceId: ev.id,
        branchId: ev.branchId,
        sceneId: s.id,
        at: ev.at,
        text,
        characterId: null,
        visibility: 'public',
        pinned: false,
        kind: 'event',
        knowledgeSource: 'witness',
      })
    }
  effectEvent(a, e, 'check', '声音已按真实距离与传播发送；接收者：' + ids.join('、'))
  for (const id of ids) {
    const target = m1Entity(w, a, id)
    if (
      mental &&
      target &&
      target.state.hp > 0 &&
      !target.state.effects?.some((f) => f.key === 'sleep')
    ) {
      target.state.conditions = (target.state.conditions ?? []).filter((c) => c !== 'unconscious')
      target.state.effects = target.state.effects?.filter((f) =>
        f.key === 'sleeping' ? false : true,
      )
    }
  }
}
export function triggerDevice(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  t: MapToken,
  kind: 'enter' | 'touch' | 'open' | 'uncover' | 'speak' | 'gm',
  receipt: string,
  cat?: Catalogue,
  dice?: (n: number) => number,
  text = '',
) {
  const m = e.magic,
    id = terrainEntityId(t)
  if (!m || e.status !== 'active' || m.excludedIds.includes(id) || (m.triggered && !m.repeat))
    return
  const g = anchoredGeometry(w, a, e)
  if (!g) return
  const p = tokenPoint(t),
    origin = sceneCenter(g.geometry),
    dist = magicDistance(p, origin, s.grid.feet)
  if (
    e.spellId === 'arcane-lock' &&
    kind === 'speak' &&
    m.password &&
    text === m.password &&
    dist <= 5 &&
    soundBetween(w, a, s, p, origin)
  ) {
    m.suppressedUntil =
      (w.characters.find((c) => c.id === e.clockSourceId)?.runtime?.hours ?? e.createdHour) + 1 / 60
    return
  }
  if (!['alarm', 'magic-mouth', 'glyph-of-warding'].includes(e.spellId)) return
  if (
    e.spellId === 'glyph-of-warding' &&
    m.password &&
    kind === 'speak' &&
    text === m.password &&
    dist <= 30 &&
    soundBetween(w, a, s, p, origin)
  ) {
    if (!m.passwordPasses.some((p) => p.entityId === id && p.turnKey === terrainTurn(w, a, s)))
      m.passwordPasses.push({ entityId: id, turnKey: terrainTurn(w, a, s) })
    return
  }
  if (
    e.spellId === 'glyph-of-warding' &&
    m.passwordPasses.some((p) => p.entityId === id && p.turnKey === terrainTurn(w, a, s))
  )
    return
  const object =
      e.anchor.kind === 'object' ? a.m3?.entities.find((o) => o.id === e.anchor.id) : undefined,
    contactDistance = object
      ? Math.max(
          0,
          (object.x - p.x) * s.grid.feet,
          (p.x - object.x) * s.grid.feet - object.width,
          (object.y - p.y) * s.grid.feet,
          (p.y - object.y) * s.grid.feet - object.depth,
          object.height - p.height,
          p.height - object.height - object.heightFeet,
        )
      : dist
  if (
    ['touch', 'open', 'uncover'].includes(kind) &&
    (contactDistance > 5 || !physicalPropagation(a, s, p, origin, 'effect').clear)
  )
    return
  const trigger = m.trigger ?? {
    kind: 'enter',
    range: 0,
    sense: 'either',
    types: [],
    description: '',
  }
  if (
    kind !== 'gm' &&
    (e.spellId === 'alarm' ? !['enter', 'touch', 'open'].includes(kind) : trigger.kind !== kind)
  )
    return
  if (
    e.spellId === 'alarm' ? !magicTouches(w, a, s, e, t) : dist > Math.min(30, trigger.range || 30)
  )
    return
  if (trigger.phrase && trigger.phrase !== text) return
  const senses = trigger.sense
  if (kind !== 'gm' && senses === 'sound' && !soundBetween(w, a, s, p, origin)) return
  if (kind !== 'gm' && senses === 'sight' && !physicalPropagation(a, s, origin, p, 'visual').clear)
    return
  const body = m1Entity(w, a, id)?.body
  if (trigger.types.length && !trigger.types.includes(body?.creatureType ?? 'humanoid')) return
  const key = `device:${e.id}:${id}:${receipt}`
  if (sceneEffects(a).events.some((v) => v.receipt === key)) return
  effectEvent(a, e, 'check', '已确认装置触发', key)
  if (e.spellId === 'alarm') {
    magicSound(w, a, s, e, '警戒术响起警报。', 60, m.alarm === 'mental')
    return
  }
  if (e.spellId === 'magic-mouth') {
    magicSound(w, a, s, e, m.message, 60)
    m.triggered = true
    if (!m.repeat) endSceneEffect(a, e, '魔嘴已经完整传达原文')
    return
  }
  if (!cat || !dice) {
    const state = sceneEffects(a)
    state.hazards.push({
      id: crypto.randomUUID(),
      effectId: e.id,
      entityId: id,
      sceneId: s.id,
      receipt: `glyph:${key}`,
      phase: 'trigger',
      status: 'pending',
      turnKey: terrainTurn(w, a, s),
      distance: 0,
      rolls: [],
      note: '已触发守卫刻文，等待GM执行符文；不重做触发',
      magic: { dc: m.dc, half: false, rolled: false, endsSource: false },
    })
    m.triggered = true
    return
  }
  detonateGlyph(w, a, s, e, t, cat, dice)
}
/** Input is an already accepted utterance. No parsing of commands or proposals,
 * no dice or generated response here; a rune only creates a GM-review event. */
export function notifyMagicSpeech(
  w: MapWorld,
  a: Adventure,
  id: string,
  text: string,
  receipt: string,
) {
  const entity = m1Entity(w, a, id),
    s = a.scenes.find((s) => s.id === a.activeSceneId)
  if (!entity?.token || !s || !s.tokens.includes(entity.token) || !text.trim()) return
  for (const e of a.sceneEffects?.regions ?? [])
    if (e.status === 'active' && e.sceneId === s.id)
      triggerDevice(w, a, s, e, entity.token, 'speak', receipt, undefined, undefined, text.trim())
}
export function detonateGlyph(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  t: MapToken,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const m = e.magic!
  m.triggered = true
  if (m.glyph === 'spell') {
    fireStoredSpell(w, a, s, e, t, cat, dice)
    endSceneEffect(a, e, '储存法术已释放，无需重新支付或维持专注')
    return
  }
  const g = { ...anchoredGeometry(w, a, e)!.geometry, shape: 'sphere' as const, size: 20 },
    state = sceneEffects(a)
  for (const target of s.tokens) {
    if (
      !geometryContains(g, tokenPoint(target), s.grid.feet) ||
      !physicalPropagation(a, s, sceneCenter(g), tokenPoint(target), 'effect').clear
    )
      continue
    const key = `explosion:${e.id}:${terrainEntityId(target)}`
    if (state.hazards.some((h) => h.receipt === key)) continue
    state.hazards.push({
      id: crypto.randomUUID(),
      effectId: e.id,
      entityId: terrainEntityId(target),
      sceneId: s.id,
      receipt: key,
      phase: 'strike',
      status: 'pending',
      turnKey: terrainTurn(w, a, s),
      distance: 0,
      rolls: [],
      note: '爆炸符文已触发，分目标保存豁免',
      magic: {
        dc: m.dc,
        save: 'dex',
        formula: `${e.slotLevel + 2}d8`,
        type: m.damageType,
        half: true,
        rolled: false,
        decision: 'apply',
        endsSource: false,
      },
    })
  }
  endSceneEffect(a, e, '爆炸已触发，已发生的各目标后果保留至结算')
}
export function magicCreated(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  op: SceneEffectCast,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  if (e.spellId === 'glyph-of-warding' && e.magic?.glyph === 'spell')
    e.magic.stored = payStoredSpell(w, a, op, cat, dice)
  if (e.spellId === 'knock') magicSound(w, a, s, e, '一声清晰的敲击声传来。', 300)
  if (e.spellId === 'hunger-of-hadar') magicSound(w, a, s, e, '传来低声呢喃与蠕动的声响。', 50)
  for (const t of s.tokens) queueMagic(w, a, s, t, 'created', e.id, e)
  if (e.spellId === 'call-lightning' && op.magic?.strike)
    strikeLightning(w, a, s, e, op.magic.strike, e.id)
  if (e.spellId === 'gust-of-wind') windFlames(w, a, s, e, dice)
  if (e.spellId === 'flaming-sphere') igniteObjects(w, a, s, e)
}
function igniteObjects(w: MapWorld, a: Adventure, s: MapScene, e: SceneEffect) {
  for (const object of a.m3?.entities ?? []) {
    if (
      !object.enabled ||
      !object.loose ||
      object.boundCharacterId ||
      object.sceneId !== s.id ||
      !a.sceneEffects?.objectBodies.some((b) => b.objectId === object.id && b.combustible)
    )
      continue
    if (
      !regionContains(w, a, s, e, {
        x: object.x + 0.5,
        y: object.y + 0.5,
        height: object.height,
      }) ||
      object.effects?.some((f) => f.key === 'burning')
    )
      continue
    object.effects ??= []
    object.effects.push({
      id: crypto.randomUUID(),
      key: 'burning',
      name: '实际可燃物已引燃',
      sourceId: e.sourceId,
      spellId: e.spellId,
      castId: e.castId,
      page: 0,
      concentration: false,
      expiresAt: null,
      encounterId: 'outside',
      phase: 'start',
      note: '只登记真实燃烧事实；燃速／损伤由GM依据材质核实，不捏造自动伤害',
    })
    effectEvent(a, e, 'check', '火球已引燃GM核实的未穿戴／携带可燃物：' + object.name)
  }
}
export function windFlames(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  dice: (n: number) => number,
) {
  for (const light of a.sceneEffects?.regions ?? []) {
    if (
      light.status !== 'active' ||
      light.spellId !== 'mundane-light' ||
      !light.light?.flame ||
      e.magic!.fixtureRolls.includes(light.id)
    )
      continue
    const g = anchoredGeometry(w, a, light)
    if (!g || g.scene.id !== s.id || !regionContains(w, a, s, e, sceneCenter(g.geometry))) continue
    const protectedFlame = light.covered || light.light.protected
    if (protectedFlame) prepareDice(1, 6, '造风术：受保护火焰50%熄灭（d6的1–3）', dice)
    const extinguish = !protectedFlame || checkedDie(dice, 6) <= 3
    e.magic!.fixtureRolls.push(light.id)
    if (extinguish) endSceneEffect(a, light, '造风术熄灭实际火焰；受保护火焰已按50%掷骰')
  }
}
function strikeLightning(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  p: { x: number; y: number; height: number },
  receipt: string,
) {
  validateLightning(s, e.geometry!, p)
  for (const t of s.tokens)
    if (
      magicDistance(tokenPoint(t), { ...p, x: p.x + 0.5, y: p.y + 0.5 }, s.grid.feet) <= 5 &&
      physicalPropagation(a, s, { ...p, x: p.x + 0.5, y: p.y + 0.5 }, tokenPoint(t), 'effect').clear
    )
      queueMagic(w, a, s, t, 'strike', receipt, e)
}
export function applyMagicOperation(
  w: MapWorld,
  a: Adventure,
  op: SceneEffectAction,
  cat: Catalogue,
  dice: (n: number) => number,
): string {
  const state = sceneEffects(a)
  if (op.operation === 'mental-alarm') {
    const e = state.regions.find(
      (e) =>
        e.id === op.effectId &&
        e.status === 'active' &&
        e.spellId === 'alarm' &&
        e.magic?.alarm === 'mental',
    )
    const ev = state.events.find(
      (v) =>
        v.id === op.eventId && v.effectId === e?.id && v.receipt?.startsWith(`device:${e?.id}:`),
    )
    if (!e || !ev || !m1Entity(w, a, e.sourceId))
      throw Error('须选择已实际触发的精神警报及仍存在的施法者')
    const s = a.scenes.find((s) => s.id === e.sceneId)!,
      key = `mental-delivery:${ev.id}`
    if (s.tokens.some((t) => terrainEntityId(t) === e.sourceId))
      throw Error('同场景精神警报按实际位置测距，无需跨场景裁定')
    if (op.distance > 5280) throw Error('精神警报仅能在1英里内接收')
    if (state.events.some((v) => v.receipt === key)) throw Error('本次精神警报已经发送')
    magicSound(w, a, s, e, '警戒术响起心灵警报。', 5280, true, true)
    effectEvent(a, e, 'check', `GM核实跨场景距离${op.distance}尺；精神警报已私密发送`, key)
    return '跨场景精神警报已按GM核实距离私密发送一次'
  }
  if (op.operation === 'weather') {
    const env = a.m3?.environments.find((e) => e.sceneId === op.sceneId)
    if (!env?.openSky) throw Error('须先核实该场景为室外开放天空')
    env.storm = op.storm
    return 'GM已明确室外现有风暴事实，未改变其他光照／高度设置'
  }
  if (op.operation === 'adopt-zone') {
    const e = state.regions.find((e) => e.id === op.effectId && e.status === 'active' && e.legacy),
      battle = w.encounters.find((b) => b.id === e?.legacy?.encounterId),
      zone = battle?.zones?.find((z) => z.id === e?.legacy?.zoneId),
      s = a.scenes.find((s) => s.id === e?.sceneId)
    if (
      !e ||
      !zone ||
      !battle ||
      !s ||
      !e.geometry ||
      battle.pending ||
      battle.reactionParents?.length
    )
      throw Error('须先结束原结算／反应并补齐真实区域几何，才能移交唯一执行权')
    e.magic = sceneMagicSchema.parse({
      dc: zone.dc,
      damageType: zone.damageType,
      ammunition: zone.ammunition ?? 0,
      excludedIds: zone.excludedIds.map(
        (id) =>
          battle.actors.find((a) => a.id === id)?.characterId ??
          battle.actors.find((a) => a.id === id)?.npcId ??
          id,
      ),
      createdTurn: terrainTurn(w, a, s),
      migrated: true,
      oldReceipts: Object.entries(zone.triggered).map(([id, tick]) => ({
        entityId:
          battle.actors.find((a) => a.id === id)?.characterId ??
          battle.actors.find((a) => a.id === id)?.npcId ??
          id,
        phase: 'any',
        tick,
      })),
    })
    for (const [id, phases] of Object.entries(zone.phaseTriggered ?? {}))
      for (const [phase, tick] of Object.entries(phases))
        e.magic.oldReceipts.push({
          entityId:
            battle.actors.find((a) => a.id === id)?.characterId ??
            battle.actors.find((a) => a.id === id)?.npcId ??
            id,
          phase,
          tick,
        })
    battle.zones = battle.zones!.filter((z) => z !== zone)
    if (e.spellId === 'hunger-of-hadar') e.obscurity = 'absolute-darkness'
    effectEvent(a, e, 'migrated', 'GM明确移交唯一执行权；保留弹药、排除对象和已经触发的时机')
    return '旧区域已移交场景执行器，原执行器实例已移除；未重掷或补触发历史伤害'
  }
  if (op.operation === 'mundane-locks') {
    const p = a.scenes.flatMap((s) => s.points).find((p) => p.id === op.pointId && p.enabled)
    if (!p || !['door', 'chest'].includes(p.kind)) throw Error('须关联真实门／容器互动点')
    state.locks ??= []
    state.locks = state.locks
      .filter((l) => l.pointId !== p.id)
      .concat({ pointId: p.id, locks: op.locks, barred: op.barred, jammed: op.jammed })
    if (op.locks || op.barred || op.jammed) p.state = 'locked'
    return '已核实普通锁／门闩／卡死；不替代秘法锁'
  }
  if (op.operation === 'magic-decision') {
    const h = state.hazards.find(
      (h) => h.id === op.eventId && h.status === 'pending' && h.magic && !h.magic.rolled,
    )
    if (!h) throw Error('目标申请已失效')
    h.magic!.decision = op.apply ? 'apply' : 'skip'
    return '目标决定已保存，尚未重掷或扣费'
  }
  if (op.operation === 'magic-push') {
    const h = state.hazards.find(
        (h) =>
          h.id === op.eventId &&
          h.status === 'pending' &&
          h.magic?.rolled &&
          h.magic.push &&
          !h.success,
      ),
      entity = h && m1Entity(w, a, h.entityId),
      s = a.scenes.find((s) => s.id === h?.sceneId)
    if (!h || !entity?.token || !s) throw Error('强制位移已完成或尚未确认豁免')
    const push = h.magic!.push!,
      t = entity.token
    const direction = (push.angle * Math.PI) / 180,
      steps = push.travel / s.grid.feet
    if (
      t.x !== push.from.x + Math.round(Math.cos(direction)) * steps ||
      t.y !== push.from.y + Math.round(Math.sin(direction)) * steps ||
      (t.spatial?.height ?? 0) !== push.from.height
    )
      throw Error('原位置已变化，需GM复核强制路线')
    h.status = 'resolved'
    const angle = (push.angle * Math.PI) / 180
    while (push.travel < push.feet) {
      const to = {
        x: t.x + Math.round(Math.cos(angle)),
        y: t.y + Math.round(Math.sin(angle)),
        height: t.spatial?.height ?? 0,
      }
      if (to.x === t.x && to.y === t.y) break
      try {
        m3Landing(s, t, to, t.spatial?.layer ?? 'material')
        if (
          !physicalPropagation(
            a,
            s,
            tokenPoint(t),
            { ...to, x: to.x + t.span / 2, y: to.y + t.span / 2 },
            'movement',
          ).clear
        )
          break
        magicCrossing(
          w,
          a,
          s,
          tokenPoint(t),
          { ...to, x: to.x + t.span / 2, y: to.y + t.span / 2 },
          entity.id,
          { forced: true },
        )
      } catch {
        break
      }
      t.x = to.x
      t.y = to.y
      push.travel += s.grid.feet
      for (const e of state.regions) queueMagic(w, a, s, t, 'enter', h.id + ':' + push.travel, e)
      const floor = m3GroundAt(a, s, t)
      if (to.height > floor) {
        m3State(a).events.push({
          id: crypto.randomUUID(),
          type: 'fall',
          entityId: entity.id,
          sceneId: s.id,
          from: to,
          layer: t.spatial?.layer ?? 'material',
          status: 'pending',
          note: '风向强制移动后失去支撑，使用真实坠落结算',
        })
        break
      }
      if (pendingTerrain(a, entity.id).length) {
        if (push.travel < push.feet)
          state.hazards.push({
            ...structuredClone(h),
            id: crypto.randomUUID(),
            receipt: h.receipt + ':continue:' + push.travel,
            status: 'pending',
            note: '继续剩余强制移动，先处理新触发的前一后果',
          })
        break
      }
    }
    return `已沿真实风向强制移动${push.travel}尺；实体阻挡／新后果处停止，不消耗移动或触发借机`
  }
  if (!('effectId' in op)) throw Error('未知区域操作')
  const e = state.regions.find((e) => e.id === op.effectId && e.status === 'active'),
    s = a.scenes.find((s) => s.id === e?.sceneId)
  if (!e?.magic || !s || !e.geometry) throw Error('实际法术区域已失效')
  if (op.operation === 'wind-flames') {
    if (e.spellId !== 'gust-of-wind') throw Error('仅造风术可处理受保护火焰')
    windFlames(w, a, s, e, dice)
    return '实际火焰按来源去重处理，未重复掷50%骰'
  }
  if (op.operation === 'magic-trigger') {
    const target = m1Entity(w, a, op.entityId)?.token
    if (!target || !s.tokens.includes(target)) throw Error('触发者须位于真实场景')
    triggerDevice(w, a, s, e, target, op.event, crypto.randomUUID(), cat, dice, op.text)
    return '已按实际装置与传播检查触发；未伪造不可感知条件'
  }
  if (!('actorId' in op)) throw Error('须指定实际操作人物')
  const entity = op.actorId ? m1Entity(w, a, op.actorId) : undefined
  if (op.operation === 'magic-cross') {
    if (e.spellId !== 'magic-circle' || !entity?.token || !s.tokens.includes(entity.token))
      throw Error('须选择本法阵场景中的实际传送人物')
    const turn = terrainTurn(w, a, s)
    if (
      e.magic.crossings.some(
        (c) =>
          c.entityId === entity.id &&
          c.turnKey === turn &&
          c.to.x === op.to.x &&
          c.to.y === op.to.y &&
          c.to.height === op.to.height,
      )
    )
      throw Error('本次法阵穿越已经判定；不能反复申请刷骰')
    const roll = savingRoll(
        actor(w, a, entity.id),
        'cha',
        defaultEnvironment(),
        w.characters,
        cat,
        dice,
      ),
      success = !roll.autoFail && roll.total >= e.magic.dc
    e.magic.crossings.push({ entityId: entity.id, turnKey: turn, to: op.to, success })
    effectEvent(
      a,
      e,
      'check',
      `${entity.name}法阵穿越魅力豁免${roll.total}，${success ? '成功' : '失败'}；仍需原传送入口支付与执行`,
    )
    return '法阵穿越豁免已保存；不自动传送、不重扣行动或法术位'
  }
  if (
    !entity?.token ||
    entity.dead ||
    entity.state.hp <= 0 ||
    !s.tokens.includes(entity.token) ||
    entity.id !== e.sourceId
  )
    throw Error('须由同场景、存活的原施法者操作')
  if (op.operation === 'hut-light') {
    if (e.spellId !== 'tiny-hut') throw Error('仅小屋可切换内部照明')
    e.magic.hutLight = op.light
    return '小屋内部照明已切换，不产生外部照明'
  }
  if (op.operation !== 'magic-move' && op.operation !== 'magic-strike')
    throw Error('未知持续法术后续操作')
  if (pendingTerrain(a, entity.id).length) throw Error('请先处理施法者待结算后果')
  const turn = terrainTurn(w, a, s)
  if (e.magic.lastMoveTurn === turn) throw Error('本回合此区域后续操作已经使用')
  if (op.operation === 'magic-strike') {
    if (e.spellId !== 'call-lightning') throw Error('只有召雷术可再次雷击')
    if (
      !physicalPropagation(
        a,
        s,
        tokenPoint(entity.token),
        { ...op.to, x: op.to.x + 0.5, y: op.to.y + 0.5 },
        'visual',
      ).clear
    )
      throw Error('雷击点必须可见')
    if (
      !magicPointVisible(
        w,
        a,
        s,
        entity.token,
        { ...op.to, x: op.to.x + 0.5, y: op.to.y + 0.5 },
        cat,
      )
    )
      throw Error('雷击点须真实可见')
    validateLightning(s, e.geometry, op.to)
    m3ActionCost(w, a, entity.id, 'action', cat, true)
    e.magic.lastMoveTurn = turn
    strikeLightning(w, a, s, e, op.to, crypto.randomUUID())
    return '已消耗魔法动作；真实云下雷击后果等待逐目标结算'
  }
  const distances: Record<string, number> = {
      'gust-of-wind': 0,
      moonbeam: 60,
      'cloud-of-daggers': 30,
      'flaming-sphere': 30,
      'conjure-animals': 30,
    },
    max = distances[e.spellId]
  if (max === undefined) throw Error('此法术没有移动／转向操作')
  const from = sceneCenter(e.geometry),
    to = { ...op.to, x: op.to.x + 0.5, y: op.to.y + 0.5 }
  if (e.spellId !== 'gust-of-wind' && magicDistance(from, to, s.grid.feet) > max)
    throw Error('超出本次区域移动距离')
  if (op.to.x < 0 || op.to.y < 0 || op.to.x >= s.grid.columns || op.to.y >= s.grid.rows)
    throw Error('区域落点超出场景')
  if (e.spellId === 'conjure-animals') {
    if (e.magic.moveBudget < 30) throw Error('须先在自己的回合实际移动，才能随同移动灵体群')
    if (s.tokens.some((t) => t.x === op.to.x && t.y === op.to.y))
      throw Error('灵体群须移动至未占据位置')
    e.magic.moveBudget = 0
  } else
    m3ActionCost(
      w,
      a,
      entity.id,
      ['flaming-sphere', 'gust-of-wind'].includes(e.spellId) ? 'bonus' : 'action',
      cat,
      true,
    )
  e.magic.lastMoveTurn = turn
  if (e.spellId === 'gust-of-wind') {
    if (e.magic.createdTurn === turn) throw Error('造风之回合已包含初始方向；后续回合才能附赠转向')
    if (op.angle === undefined) throw Error('须明确风向角度')
    e.magic.angle = e.geometry.angle = op.angle
  } else {
    const rolling =
      e.spellId === 'flaming-sphere' ? flamingSphereRoute(w, a, s, from, to, e.sourceId) : undefined
    const steps = rolling
      ? rolling.length
      : e.spellId === 'cloud-of-daggers'
        ? 1
        : Math.max(1, Math.ceil(magicDistance(from, to, s.grid.feet) / s.grid.feet))
    for (let i = 1; i <= steps; i++) {
      const actual = rolling?.[i - 1]
      const p = actual
        ? { ...actual, x: actual.x - 0.5, y: actual.y - 0.5 }
        : {
            x: from.x - 0.5 + ((op.to.x - from.x + 0.5) * i) / steps,
            y: from.y - 0.5 + ((op.to.y - from.y + 0.5) * i) / steps,
            height: from.height + ((op.to.height - from.height) * i) / steps,
          }
      if (
        e.spellId !== 'cloud-of-daggers' &&
        !rolling &&
        !physicalPropagation(
          a,
          s,
          sceneCenter(e.geometry),
          { ...p, x: p.x + 0.5, y: p.y + 0.5 },
          'movement',
        ).clear
      )
        throw Error('区域移动路径被真实墙门阻断')
      e.geometry = { ...e.geometry, ...p }
      if (e.spellId === 'flaming-sphere') igniteObjects(w, a, s, e)
      const targets = s.tokens.filter((t) => magicTouches(w, a, s, e, t))
      if (e.spellId === 'flaming-sphere') {
        const target = targets[0]
        if (target) queueMagic(w, a, s, target, 'strike', `${e.id}:${turn}:${i}`, e)
      } else for (const t of s.tokens) queueMagic(w, a, s, t, 'moved', `${e.id}:${turn}:${i}`, e)
      if (e.spellId === 'flaming-sphere' && targets.length) break
    }
  }
  effectEvent(a, e, 'moved', op.note)
  return '已按真实距离、动作和路径更新持续区域；区域后果独立审核'
}
