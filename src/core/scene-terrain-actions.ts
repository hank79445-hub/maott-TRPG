import { resolveMagicHazard, detonateGlyph } from './scene-magic-actions'
import type { Adventure, MapWorld } from './map-types'
import type { Catalogue } from './engine'
import type { SceneEffectAction } from '../persistence/scene-effects-schema'
import type { ActiveEffect } from './types'
import { m1Entity } from './m1-utility'
import { sceneEffects, endSceneCast, effectEvent } from './scene-effects'
import {
  terrainTouches,
  terrainEntityId,
  terrainTurn,
  pendingTerrain,
  terrainPhase,
  clearTerrainTurn,
} from './scene-terrain'
import { m3ActionCost, applyM3Action } from './m3-world-actions'
import { m3Hazard } from './m3-space-events'
import { runtimeDerived, applyRuntime } from './runtime'
import {
  combatStats,
  freshTurn,
  savingRoll,
  defaultEnvironment,
  rollDamage,
  d20,
} from './combat-rules'
import { applyMap, distance } from './map'
import { geometryContains } from './scene-effect-geometry'
import { tokenPoint } from './scene-effects'
export const terrainOperation = (op: string) =>
  [
    'hazard',
    'hazard-order',
    'escape',
    'search-terrain',
    'burn-web',
    'clear-growth',
    'environment-round',
    'resume-route',
  ].includes(op)
type TerrainAction = Extract<
  SceneEffectAction,
  {
    operation:
      | 'hazard'
      | 'hazard-order'
      | 'escape'
      | 'search-terrain'
      | 'burn-web'
      | 'clear-growth'
      | 'environment-round'
      | 'resume-route'
  }
>
function actorOf(world: MapWorld, a: Adventure, id: string) {
  const e = m1Entity(world, a, id)
  if (!e) throw Error('区域目标实际人物卡已失效')
  return (
    e.actor ?? {
      id: e.id,
      characterId: e.c?.id ?? null,
      npc: e.body ?? null,
      side: 'neutral' as const,
      initiative: null,
      surprised: false,
      turn: freshTurn(),
    }
  )
}
function immune(world: MapWorld, a: Adventure, id: string, condition: string, cat: Catalogue) {
  const e = m1Entity(world, a, id)!,
    s = combatStats(actorOf(world, a, id), world.characters, cat)
  return (
    !!e.body?.conditionImmunities.includes(condition) ||
    s.effects.some((f) => f.conditionImmunities?.includes(condition))
  )
}
function check(
  world: MapWorld,
  a: Adventure,
  id: string,
  skill: 'athletics' | 'perception' | 'survival',
  dc: number,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const e = m1Entity(world, a, id)!
  if (e.c) {
    const next = applyRuntime(e.c, cat, { type: 'check', kind: 'skill', id: skill, dc }, dice)
    world.characters[world.characters.findIndex((c) => c.id === e.c!.id)] = next
    return {
      total: next.runtime!.advanced!.lastCheck!.total,
      success:
        !next.runtime!.advanced!.lastCheck!.autoFail &&
        next.runtime!.advanced!.lastCheck!.total >= dc,
    }
  }
  const attr = skill === 'athletics' ? 'str' : 'wis',
    effects = e.state.effects ?? [],
    s = combatStats(actorOf(world, a, id), world.characters, cat)
  const result = d20(
    e.body!.templateMetadata?.skills[skill] ?? Math.floor((e.body!.scores[attr] - 10) / 2),
    effects.filter((f) => f.checkAdvantage === attr).map((f) => f.name),
    s.conditions.includes('poisoned') ? ['中毒'] : [],
    dice,
  )
  return { total: result.total, success: !result.autoFail && result.total >= dc }
}
export function applyTerrainOperation(
  world: MapWorld,
  a: Adventure,
  action: TerrainAction,
  cat: Catalogue,
  dice: (n: number) => number,
): string {
  const state = sceneEffects(a)
  if (action.operation === 'environment-round') {
    const s = a.scenes.find((s) => s.id === a.activeSceneId)
    if (
      !s ||
      a.exploration?.status === 'active' ||
      world.encounters.some((e) => e.id === s.encounterId && e.phase === 'active')
    )
      throw Error('战斗／探索回合须沿用原回合推进，不另开环境时序')
    if (pendingTerrain(a).length) throw Error('请先结算已发生的区域后果')
    for (const t of s.tokens) terrainPhase(world, a, s, t, action.phase, cat)
    if (action.phase === 'start')
      return 'GM已明确当前6秒环境回合开始；已登记实际回合初事件，不重复掷骰'
    if (pendingTerrain(a).length) return '已登记环境回合末后果；结算后再次确认推进，尚未推进时钟'
    for (const t of s.tokens) clearTerrainTurn(world, a, t)
    const clocks = world.characters.filter((c) => a.party.includes(c.id) && c.runtime)
    if (!clocks.length) throw Error('需要实际冒险时钟')
    for (const c of clocks)
      world.characters[world.characters.indexOf(c)] = applyRuntime(
        c,
        cat,
        { type: 'time', hours: 1 / 600 },
        dice,
      )
    for (const t of s.tokens) terrainPhase(world, a, s, t, 'start', cat)
    return 'GM已明确结束环境回合并推进6秒；下一回合初事件已保存，未重置行动资源'
  }
  if (action.operation === 'hazard-order') {
    const first = state.hazards.find((h) => h.id === action.eventIds[0] && h.status === 'pending')
    if (!first) throw Error('原待结算事件已变化')
    const group = state.hazards.filter(
      (h) => h.entityId === first.entityId && h.turnKey === first.turnKey && h.status === 'pending',
    )
    if (
      new Set(action.eventIds).size !== group.length ||
      action.eventIds.length !== group.length ||
      group.some((h) => !action.eventIds.includes(h.id))
    )
      throw Error('须完整排序该人物同时待结算的全部区域事件')
    const indices = group.map((h) => state.hazards.indexOf(h)).sort((a, b) => a - b)
    action.eventIds.forEach((id, i) => {
      state.hazards[indices[i]!] = group.find((h) => h.id === id)!
    })
    return 'GM选择的同时区域后果顺序已保存，未重掷或重复扣费'
  }
  if (action.operation === 'resume-route') {
    const route = state.routes.find((r) => r.id === action.routeId && r.status === 'paused'),
      entity = m1Entity(world, a, action.actorId)
    if (
      !route ||
      !entity?.token ||
      route.entityId !== entity.id ||
      route.branchId !== (a.broadcastLog?.branchId ?? 'legacy')
    )
      throw Error('原暂停路线已失效')
    if (pendingTerrain(a, entity.id).length) throw Error('请先结算该人物待处理区域后果')
    const t = entity.token
    if (
      t.x !== route.start.x ||
      t.y !== route.start.y ||
      (t.spatial?.height ?? 0) !== route.start.height
    )
      throw Error('人物位置已变化，请重新规划路线')
    // The original action is revalidated against current walls, resources and conditions.
    route.status = 'resumed'
    const next =
      route.mode === 'map'
        ? applyMap(
            world,
            a.id,
            {
              type: 'move',
              sceneId: route.sceneId,
              tokenId: route.tokenId,
              path: route.path.map((p) => ({ x: p.x, y: p.y })),
              gm: false,
              reason: '',
              reactionsConfirmed: route.reactionsConfirmed,
            },
            cat,
            dice,
          )
        : applyM3Action(
            world,
            a.id,
            {
              operation: 'move',
              entityId: entity.id,
              to: route.path.at(-1)!,
              mode: route.mode,
              supportId: route.supportId,
              reactionsConfirmed: route.reactionsConfirmed,
              note: action.note,
            },
            cat,
            dice,
          ).world
    Object.assign(world, next)
    return '已按当前实际条件继续原路线；原已走段未重复扣费'
  }
  if (action.operation === 'hazard') {
    const h = state.hazards.find((h) => h.id === action.eventId)
    if (!h || h.status !== 'pending') throw Error('该区域事件已结算或取消，不重复掷骰')
    if (
      state.hazards.some(
        (v) =>
          v.status === 'pending' &&
          v.entityId === h.entityId &&
          state.hazards.indexOf(v) < state.hazards.indexOf(h),
      )
    )
      throw Error('请先处理该人物排在前面的区域事件')
    const e = state.regions.find((e) => e.id === h.effectId),
      s = a.scenes.find((s) => s.id === h.sceneId),
      entity = m1Entity(world, a, h.entityId)
    if(h.magic&&e&&s&&entity?.token){
      if(h.phase==='trigger'&&e.spellId==='glyph-of-warding'){detonateGlyph(world,a,s,e,entity.token,cat,dice);h.status='resolved';return '原触发已执行，符文后果独立保存'}
      return resolveMagicHazard(world,a,h,cat,dice,action.note)
    }
    if (!e?.terrain || !s || !entity?.token || !s.tokens.includes(entity.token))
      throw Error('原区域来源或目标已失效，请先核对')
    if (e.status !== 'active' && ['web', 'entangle'].includes(e.spellId) && h.phase !== 'burn') {
      h.status = 'canceled'
      return '区域来源结束，取消未处理事件'
    }
    if (h.phase === 'spikes' || h.phase === 'burn') {
      const roll = rollDamage(
        `${h.phase === 'spikes' ? Math.floor(h.distance / 5) * 2 : 2}d4`,
        dice,
      )
      h.rolls = roll.dice
      h.total = roll.total
      h.damage = m3Hazard(
        world,
        a,
        entity.id,
        roll.total,
        h.phase === 'spikes' ? 'piercing' : 'fire',
        cat,
        dice,
      )
      if (h.phase === 'spikes' && !e.terrain.knownTo.includes(entity.id))
        e.terrain.knownTo.push(entity.id)
      h.status = 'resolved'
      h.note = action.note
      return `${e.name}：${entity.name}已结算${h.damage}点伤害；该次实际路径／时机只结算一次`
    }
    if (e.spellId === 'stinking-cloud' && immune(world, a, entity.id, 'poisoned', cat)) {
      h.success = true
      h.status = 'resolved'
      h.note = '实际中毒免疫，无需豁免'
      return h.note
    }
    const actor = actorOf(world, a, entity.id),
      env = defaultEnvironment()
    env.advantage = !!entity.body?.magicResistance
    const roll = savingRoll(
      actor,
      e.spellId === 'entangle' ? 'str' : e.spellId === 'stinking-cloud' ? 'con' : 'dex',
      env,
      world.characters,
      cat,
      dice,
      e.spellId === 'stinking-cloud' ? 'poison' : 'normal',
      true,
    )
    h.rolls = roll.dice
    h.total = roll.total
    h.success = !roll.autoFail && roll.total >= e.terrain.dc
    h.status = 'resolved'
    h.note = action.note
    if (!h.success) {
      const live = m1Entity(world, a, entity.id)!,
        effects = (live.state.effects ??= []),
        condition = ['entangle', 'web'].includes(e.spellId)
          ? 'restrained'
          : e.spellId === 'stinking-cloud'
            ? 'poisoned'
            : 'prone'
      if (!immune(world, a, live.id, condition, cat)) {
        if (condition === 'prone')
          live.state.conditions = [...new Set([...(live.state.conditions ?? []), 'prone'])]
        else if (!effects.some((f) => f.castId === e.castId && f.condition === condition)) {
          const f: ActiveEffect = {
            id: crypto.randomUUID(),
            key: e.spellId === 'stinking-cloud' ? 'stinking-cloud-turn' : e.spellId + '-region',
            spellId: e.spellId,
            spellLevel: e.slotLevel,
            castId: e.castId,
            sourceId: e.sourceId,
            clockSourceId: e.clockSourceId,
            name: e.name,
            page: 0,
            concentration: e.spellId === 'stinking-cloud' ? false : e.concentration,
            expiresAt: null,
            encounterId: 'outside',
            phase: 'end',
            condition,
            visibility: 'public',
            note: '来源型区域状态；从原入口脱困／到期处理',
          }
          live.state.effects = [...effects, f]
        }
      }
      if (e.spellId === 'sleet-storm') {
        const conc = live.c?.runtime?.concentration ?? live.body?.concentration
        if (conc?.castId) endSceneCast(world, a, conc.castId, '雪雨暴敏捷豁免失败，失去专注')
        if (live.c?.runtime) live.c.runtime.concentration = null
        else if (live.body) delete live.body.concentration
      }
    }
    return `${e.name}：${entity.name}豁免${h.total}，${h.success ? '成功' : '失败'}；结果已保存`
  }
  const e = state.regions.find((e) => e.id === action.effectId && e.status === 'active'),
    s = a.scenes.find((s) => s.id === e?.sceneId)
  if (!e?.terrain || !s || !e.geometry) throw Error('实际地形区域已失效')
  if (action.operation === 'clear-growth') {
    if (e.spellId !== 'plant-growth' || e.terrain.enrichment)
      throw Error('仅用于GM确认实际修剪／清除繁茂植物')
    e.terrain.plantCells = []
    e.status = 'ended'
    e.reason = action.note
    effectEvent(a, e, 'ended', 'GM核实物理清除，不是解除魔法：' + action.note)
    return '已记录实际清除繁茂植物；原普通地形保持'
  }
  if (action.operation === 'burn-web') {
    if (e.spellId !== 'web') throw Error('仅蛛网按此入口局部燃烧；油腻术不易燃')
    const p = action.point
    if (
      !geometryContains(e.geometry, { x: p.x + 0.5, y: p.y + 0.5, height: p.height }, s.grid.feet)
    )
      throw Error('须选择实际蛛网内5尺立方')
    if (e.terrain.burns.some((b) => b.x === p.x && b.y === p.y && b.height === p.height))
      throw Error('该块蛛网已经燃烧')
    const now =
      world.characters.find((c) => c.id === e.clockSourceId)?.runtime?.hours ?? e.createdHour
    e.terrain.burns.push({ ...p, startedTurn: terrainTurn(world, a, s), endsAt: now + 1 / 600 })
    return 'GM已核实实际火源；仅所选5尺立方燃烧1轮，区域内回合初结算2d4火焰'
  }
  const entity = m1Entity(world, a, action.actorId)
  if (!entity?.token || !s.tokens.includes(entity.token) || entity.dead || entity.state.hp <= 0)
    throw Error('操作人物须在本场景且存活')
  if (pendingTerrain(a, entity.id).length) throw Error('请先处理该人物的待结算区域事件')
  if (action.operation === 'escape') {
    if (
      !['web', 'entangle'].includes(e.spellId) ||
      !entity.state.effects?.some((f) => f.castId === e.castId && f.condition === 'restrained')
    )
      throw Error('本人未受此来源束缚')
    m3ActionCost(world, a, entity.id, 'action', cat)
    const result = check(world, a, entity.id, 'athletics', e.terrain.dc, cat, dice)
    if (result.success) {
      const live = m1Entity(world, a, entity.id)!
      live.state.effects = live.state.effects!.filter(
        (f) => !(f.castId === e.castId && f.condition === 'restrained'),
      )
    }
    effectEvent(
      a,
      e,
      'check',
      `${entity.name}运动脱困：${result.total}，${result.success ? '成功' : '失败'}`,
    )
    return `运动检定${result.total}：${result.success ? '挣脱此来源束缚' : '未挣脱'}；已消耗动作`
  }
  if (e.spellId !== 'spike-growth') throw Error('此搜索入口仅识别荆棘丛生隐藏危险')
  if (e.terrain.knownTo.includes(entity.id)) throw Error('本人已经识别此危险，不重复消耗搜索动作')
  const center = { ...entity.token, x: e.geometry.x, y: e.geometry.y }
  if (distance(s, entity.token, center) > Math.max(60, e.geometry.size + s.grid.feet))
    throw Error('搜索区域过远，请靠近后明确搜索')
  m3ActionCost(world, a, entity.id, 'action', cat)
  const result = check(world, a, entity.id, action.skill, e.terrain.dc, cat, dice)
  if (result.success) e.terrain.knownTo.push(entity.id)
  effectEvent(
    a,
    e,
    'check',
    `${entity.name}搜索识别：${result.total}，${result.success ? '成功' : '失败'}`,
  )
  return `搜索检定${result.total}：${result.success ? '识别了隐藏危险' : '未发现额外危险'}；未向其他人物公开危险轮廓`
}
