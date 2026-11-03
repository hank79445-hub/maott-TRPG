import type { Adventure, MapScene, MapWorld, MapToken } from './map-types'
import type { Catalogue } from './engine'
import type { Encounter, PendingAction } from './combat-types'
import type { SceneEffectAction } from '../persistence/scene-effects-schema'
import { m5StateSchema } from '../persistence/scene-m5-schema'
import { sceneEffects, tokenPoint } from './scene-effects'
import { m1Entity } from './m1-utility'
import { combatStats, freshTurn } from './combat-rules'
import { m3Landing, m3State } from './m3-world-cast'
import { m3GroundAt } from './m3-ground'
import { physicalPropagation } from './scene-propagation'
import { magicCrossing, magicDistance, queueMagic, windMovementCost } from './scene-magic'
import {
  pendingTerrain,
  queueTerrain,
  terrainMultiplier,
  prepareTerrainRoute,
} from './scene-terrain'
import { shapeContains } from './map-area'
import { magicSound } from './scene-magic-actions'

const state = (a: Adventure) => (sceneEffects(a).m5 ??= m5StateSchema.parse({}))
const position = (t: MapToken) => ({ x: t.x, y: t.y, height: t.spatial?.height ?? 0 })
export function refreshM5AttackEnvironment(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: Encounter,
  cat: Catalogue,
) {
  const p = e.pending,
    actor = p && e.actors.find((t) => t.id === p.actorId),
    from = actor && m1Entity(w, a, actor.characterId ?? actor.npcId ?? actor.id)?.token
  if (!p || p.kind !== 'attack' || !actor || !from) return
  const active = e.actors.some((source) => {
    const state = combatStats(source, w.characters, cat),
      token = m1Entity(w, a, source.characterId ?? source.npcId ?? source.id)?.token,
      conc =
        w.characters.find((c) => c.id === source.characterId)?.runtime?.concentration ??
        source.npc?.concentration
    return (
      source.side === actor.side &&
      token &&
      s.tokens.includes(token) &&
      state.hp > 0 &&
      !state.dead &&
      !state.conditions.includes('incapacitated') &&
      state.effects.some((f) => f.key === 'crusaders-mantle') &&
      conc?.spellId === 'crusaders-mantle' &&
      magicDistance(tokenPoint(from), tokenPoint(token), s.grid.feet) <= 30
    )
  })
  for (const row of p.targets) row.env.crusaderActive = !!active
}
/** Effects are derived only from the canonical resolved pending frame. No model
 * text, background art or client-supplied spell parameters create these facts. */
export function queueM5Outcomes(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  before: Encounter,
  after: Encounter,
  cat: Catalogue,
) {
  const p = before.pending
  if (!p?.id || !p.spellId || after.pending?.id === p.id) return
  const caster = before.actors.find((t) => t.id === p.actorId),
    source = caster && m1Entity(w, a, caster.characterId ?? caster.npcId ?? caster.id)
  if (!source?.token) return
  const effects = state(a),
    origin = position(source.token),
    queue = (
      kind: (typeof effects.outcomes)[number]['kind'],
      targetId: string | undefined,
      feet: number,
      from = origin,
    ) => {
      const receipt = [before.id, p.id, kind, targetId ?? 'area'].join(':')
      if (effects.outcomes.some((e) => e.receipt === receipt)) return
      if (effects.outcomes.length >= 5000) throw Error('法术地图后果账本已满，请先归档')
      const event: (typeof effects.outcomes)[number] = {
        id: crypto.randomUUID(),
        receipt,
        spellId: p.spellId!,
        sourceId: source.id,
        targetId,
        sceneId: s.id,
        encounterId: before.id,
        attackId: p.id!,
        blockedByAttackId: before.attackWindows?.find((w) => w.id === p.attackWindowId)?.attackId,
        kind,
        feet,
        travel: 0,
        spent: 0,
        layer: source.token!.spatial?.layer ?? 'material',
        spaceAnchorId: source.token!.spatial?.anchorId,
        from,
        origin,
        status: 'pending' as const,
        note: '来源伤害已确认；地图后果只执行一次，不重新掷骰或扣费',
      }
      if (feet === 0 && targetId) event.status = 'resolved'
      effects.outcomes.push(event)
      return event
    }
  for (const row of p.targets) {
    const actor = before.actors.find((t) => t.id === row.id),
      target = actor && m1Entity(w, a, actor.characterId ?? actor.npcId ?? actor.id)
    if (!target?.token || !row.hit || row.sanctuaryBlocked) continue
    if (
      p.spellId === 'thorn-whip' &&
      !['huge', 'gargantuan'].includes(
        combatStats(actor!, w.characters, cat).spatialCapabilities.size,
      )
    )
      queue('pull', target.id, 10, position(target.token))
    if (['thunderwave', 'thunderous-smite'].includes(p.spellId))
      queue('push', target.id, 10, position(target.token))
    if (
      p.spellId === 'dissonant-whispers' &&
      actor?.turn.reaction &&
      !after.actors.find((t) => t.id === actor.id)?.turn.reaction
    )
      queue('flee', target.id, combatStats(actor, w.characters, cat).speed, position(target.token))
  }
  if (['burning-hands', 'fireball'].includes(p.spellId) && p.m5Area) {
    const event = queue('ignite', undefined, 0)
    if (event) {
      for (const o of a.m3?.entities ?? []) {
        if (
          !o.enabled ||
          !o.loose ||
          o.boundCharacterId ||
          o.sceneId !== s.id ||
          (o.layer ?? 'material') !== (source.token.spatial?.layer ?? 'material') ||
          !a.sceneEffects?.objectBodies.some((b) => b.objectId === o.id && b.combustible)
        )
          continue
        if (
          !shapeContains(s.grid, p.m5Area, o) ||
          Math.abs(o.height - origin.height) > p.m5Area.size ||
          !physicalPropagation(
            a,
            s,
            { x: p.m5Area.x + 0.5, y: p.m5Area.y + 0.5, height: origin.height },
            { ...o, x: o.x + 0.5, y: o.y + 0.5 },
            'effect',
          ).clear
        )
          continue
        igniteM5Object(a, o.id, source.id, p.spellId, p.castingId ?? p.id)
      }
      event.status = 'resolved'
    }
  }
  if (p.spellId === 'thunderwave' && p.m5Area) {
    const event = queue('objects', undefined, 10)
    if (event) {
      for (const o of a.m3?.entities ?? []) {
        if (
          !o.enabled ||
          !o.loose ||
          o.boundCharacterId ||
          o.sceneId !== s.id ||
          (o.layer ?? 'material') !== (source.token.spatial?.layer ?? 'material') ||
          o.height < origin.height ||
          o.height + o.heightFeet > origin.height + 15 ||
          !physicalPropagation(
            a,
            s,
            tokenPoint(source.token),
            { x: o.x + 0.5, y: o.y + 0.5, height: o.height },
            'effect',
          ).clear
        )
          continue
        // The rule requires fully contained loose objects; test all footprint corners.
        const width = Math.max(1, o.width / s.grid.feet),
          depth = Math.max(1, o.depth / s.grid.feet)
        if (
          ![
            [0, 0],
            [width - 1, 0],
            [0, depth - 1],
            [width - 1, depth - 1],
          ].every(([dx, dy]) => shapeContains(s.grid, p.m5Area!, { x: o.x + dx!, y: o.y + dy! }))
        )
          continue
        const dx = Math.sign(o.x - origin.x),
          dy = Math.sign(o.y - origin.y)
        if (!dx && !dy) continue
        for (let n = 0; n < Math.floor(10 / s.grid.feet); n++) {
          const to = { x: o.x + dx, y: o.y + dy, height: o.height }
          if (
            to.x < 0 ||
            to.y < 0 ||
            to.x + width > s.grid.columns ||
            to.y + depth > s.grid.rows ||
            !physicalPropagation(
              a,
              s,
              { ...o, x: o.x + 0.5, y: o.y + 0.5 },
              { ...to, x: to.x + 0.5, y: to.y + 0.5 },
              'movement',
            ).clear
          )
            break
          Object.assign(o, to)
        }
      }
      event.status = 'resolved'
    }
    const sound = queue('sound', undefined, 300)
    if (sound) {
      sound.status = 'resolved'
      sound.note = '雷鸣波产生300尺可闻雷响'
      magicSound(
        w,
        a,
        s,
        {
          id: sound.id,
          castId: p.castingId ?? p.id,
          spellId: 'thunderwave',
          name: '雷鸣波',
          sceneId: s.id,
          sourceId: source.id,
          sourceKind: source.c ? 'character' : 'npc',
          clockSourceId: w.characters[0]?.id ?? source.id,
          createdHour: 0,
          slotLevel: p.slotLevel ?? 1,
          concentration: false,
          status: 'active',
          anchor: { kind: 'point', offsetHeight: 0 },
          geometry: {
            shape: 'sphere',
            ...origin,
            size: 0.1,
            heightFeet: 0,
            width: 5,
            angle: 0,
            originSpan: source.token.span,
          },
          hidden: false,
          covered: false,
          channels: [],
          obscurity: 'none',
          requiresGeometry: false,
          note: '已确认的雷鸣声',
        },
        '一阵雷鸣巨响传来。',
        300,
      )
    }
  }
}
export function igniteM5Object(
  a: Adventure,
  objectId: string,
  sourceId: string,
  spellId: string,
  castId: string,
) {
  const object = a.m3?.entities.find((o) => o.id === objectId),
    body = a.sceneEffects?.objectBodies.find((b) => b.objectId === objectId)
  if (
    !object?.enabled ||
    !object.loose ||
    object.boundCharacterId ||
    !body?.combustible ||
    object.effects?.some((f) => f.key === 'burning')
  )
    return false
  ;(object.effects ??= []).push({
    id: crypto.randomUUID(),
    key: 'burning',
    name: '实际物件燃烧',
    sourceId,
    spellId,
    castId,
    page: 0,
    concentration: false,
    expiresAt: null,
    encounterId: 'outside',
    phase: 'start',
    note: '真实未穿戴／携带可燃物已点燃；燃速和后续损伤由GM核实，不捏造固定伤害',
  })
  return true
}
export function reconcileM5Links(w: MapWorld, a: Adventure) {
  // Follow actual inventory transfers. A picked-up object is never a loose burn target.
  for (const o of a.m3?.entities ?? []) {
    if (!o.inventoryInstanceId) continue
    // Inventory instance IDs are scoped to their owner (starting equipment repeats
    // across characters). Never infer ownership by searching the whole party.
    const holder = w.characters.find(
        (c) =>
          c.id === o.boundCharacterId &&
          c.inventory.some((r) => r.instanceId === o.inventoryInstanceId && r.quantity > 0),
      ),
      npc = a.ai?.npcs.find((n) =>
        m1Entity(w, a, n.id)?.body?.equipment?.some((g) => g.objectId === o.id && g.held),
      ),
      ground = a.scenes
        .flatMap((s) => (s.groundItems ?? []).map((g) => ({ s, g })))
        .find(
          ({ s, g }) =>
            s.id === o.sceneId &&
            g.x === o.x &&
            g.y === o.y &&
            g.enabled &&
            g.quantity > 0 &&
            (g.inventoryState?.instanceId ?? g.inventoryInstanceId) === o.inventoryInstanceId,
        )
    const entity = holder || npc ? m1Entity(w, a, holder?.id ?? npc!.id) : undefined
    if (entity?.token) {
      o.boundCharacterId = entity.id
      o.x = entity.token.x
      o.y = entity.token.y
      o.height = entity.token.spatial?.height ?? 0
      o.sceneId = a.scenes.find((s) => s.tokens.includes(entity.token!))?.id ?? o.sceneId
    } else if (ground) {
      delete o.boundCharacterId
      o.x = ground.g.x
      o.y = ground.g.y
      o.sceneId = ground.s.id
    }
    const fact = a.sceneEffects?.m5?.metals.find((m) => m.objectId === o.id)
    if (fact && entity) fact.contactIds = [entity.id]
    else if (fact && ground) fact.contactIds = []
  }
  const active = (a.sceneEffects?.regions ?? []).filter((e) => e.status === 'active' && e.m5)
  for (const e of active) {
    if (e.spellId !== 'witch-bolt') continue
    const source = m1Entity(w, a, e.sourceId),
      target = m1Entity(w, a, e.m5!.targetId ?? ''),
      s = a.scenes.find(
        (s) =>
          source?.token &&
          target?.token &&
          s.tokens.includes(source.token) &&
          s.tokens.includes(target.token),
      )
    if (
      !s ||
      !source?.token ||
      !target?.token ||
      magicDistance(tokenPoint(source.token), tokenPoint(target.token), s.grid.feet) > 60 ||
      (source.token.spatial?.layer ?? 'material') !== (target.token.spatial?.layer ?? 'material') ||
      !physicalPropagation(a, s, tokenPoint(source.token), tokenPoint(target.token), 'effect').clear
    ) {
      e.status = 'ended'
      e.reason = '巫术箭链接超出60尺、完全掩护或不在同一场景／空间'
      const c = source?.c?.runtime?.concentration ?? source?.body?.concentration
      if (c?.castId === e.castId) {
        if (source?.c?.runtime) source.c.runtime.concentration = null
        else if (source?.body) delete source.body.concentration
      }
    }
  }
  const castIds = new Set(
    active
      .filter((e) => e.status === 'active' && e.spellId === 'flame-blade' && e.m5?.held)
      .map((e) => e.castId),
  )
  for (const c of w.characters)
    if (c.runtime?.effects)
      c.runtime.effects = c.runtime.effects.filter(
        (f) => f.key !== 'flame-blade-held' || (!!f.castId && castIds.has(f.castId)),
      )
  for (const n of a.ai?.npcs ?? [])
    if (n.body)
      n.body.effects = n.body.effects.filter(
        (f) => f.key !== 'flame-blade-held' || (!!f.castId && castIds.has(f.castId)),
      )
  for (const encounter of w.encounters)
    for (const actor of encounter.actors)
      if (actor.npc)
        actor.npc.effects = actor.npc.effects.filter(
          (f) => f.key !== 'flame-blade-held' || (!!f.castId && castIds.has(f.castId)),
        )
}
export function applyM5Movement(
  w: MapWorld,
  a: Adventure,
  op: Extract<SceneEffectAction, { operation: 'm5-move' }>,
  cat: Catalogue,
) {
  const event = state(a).outcomes.find((e) => e.id === op.eventId && e.status === 'pending'),
    s = a.scenes.find((s) => s.id === event?.sceneId)
  if (!event || !s || !event.targetId) throw Error('该位移已经完成或不存在')
  if (
    event.blockedByAttackId &&
    w.encounters.some(
      (e) =>
        e.pending?.id === event.blockedByAttackId ||
        e.attackParents?.some((p) => p.id === event.blockedByAttackId),
    )
  )
    throw Error('请先最终确认原攻击伤害，再执行位移')
  const target = m1Entity(w, a, event.targetId),
    t = target?.token
  if (!target || !t || ![...s.tokens, ...(s.defeatedTokens ?? [])].includes(t))
    throw Error('目标已离场，须GM复核原结算后果')
  if (op.skip) {
    if (event.kind !== 'pull') throw Error('必然位移不能以可选拉近方式取消')
    event.status = 'skipped'
    return '已放弃本次可选拉近，不恢复任何费用'
  }
  const expected = event.current ?? event.from
  if (
    (event.layer ?? 'material') !== (t.spatial?.layer ?? 'material') ||
    event.spaceAnchorId !== t.spatial?.anchorId
  )
    throw Error('原空间层已变化，请GM复核原位移')
  if (t.x !== expected.x || t.y !== expected.y || (t.spatial?.height ?? 0) !== expected.height)
    throw Error('原落点已改变，须GM先核对，不能套用旧位移')
  if (
    pendingTerrain(a, target.id).length ||
    a.m3?.events.some((e) => e.entityId === target.id && e.status === 'pending')
  )
    throw Error('先结算本人物已有区域／坠落后果，再继续路线')
  const fromOrigin = { ...event.origin, x: event.origin.x + 0.5, y: event.origin.y + 0.5 },
    distance = (p: { x: number; y: number; height: number }) =>
      magicDistance({ ...p, x: p.x + 0.5, y: p.y + 0.5 }, fromOrigin, s.grid.feet)
  const path = op.path.length ? op.path : []
  if (
    event.kind === 'push' &&
    op.path.length &&
    op.path.length !== Math.floor((event.feet - event.travel) / s.grid.feet)
  )
    throw Error('必然推离须提交完整剩余路线；受实际阻挡时由服务器停止')
  if (event.kind === 'flee' && (!op.safeRouteConfirmed || !op.reactionsConfirmed || !path.length))
    throw Error('不谐低语须GM核实尽可能远离的安全路线及借机攻击；反应移动不是强制推移')
  if (event.kind !== 'flee' && !path.length) {
    const dx = Math.sign(event.origin.x - t.x) * (event.kind === 'pull' ? 1 : -1),
      dy = Math.sign(event.origin.y - t.y) * (event.kind === 'pull' ? 1 : -1)
    for (let n = 1; n <= Math.floor((event.feet - event.travel) / s.grid.feet); n++)
      path.push({ x: t.x + dx * n, y: t.y + dy * n, height: t.spatial?.height ?? 0 })
  }
  for (const to of path) {
    if (event.travel + s.grid.feet > event.feet) throw Error('路线超过本次剩余法术位移')
    if (
      Math.max(Math.abs(to.x - t.x), Math.abs(to.y - t.y)) !== 1 ||
      to.height !== (t.spatial?.height ?? 0)
    )
      throw Error('本次首版路线须逐格、同高度；复杂三维路线另行GM裁定')
    const old = position(t),
      prone = combatStats(
        target.actor ?? {
          id: target.id,
          characterId: target.c?.id ?? null,
          npc: target.body ?? null,
          side: 'neutral',
          initiative: 0,
          surprised: false,
          turn: freshTurn(),
        },
        w.characters,
        cat,
      ).conditions.includes('prone'),
      cost =
        event.kind === 'flee'
          ? s.grid.feet *
            (Math.max(
              terrainMultiplier(w, a, s, { ...t, ...to }),
              s.regions.some(
                (r) => r.tags.includes('difficult') && r.cells.includes(to.x + ',' + to.y),
              )
                ? 2
                : 1,
            ) +
              (prone ? 1 : 0) +
              windMovementCost(w, a, s, t, tokenPoint(t), {
                ...to,
                x: to.x + t.span / 2,
                y: to.y + t.span / 2,
              }))
          : s.grid.feet
    if (event.kind === 'flee' && (event.spent ?? event.travel) + cost > event.feet) break
    if (event.kind === 'pull' ? distance(to) >= distance(old) : distance(to) <= distance(old))
      throw Error('路线方向不符合拉近／远离原来源')
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
        target.id,
        { forced: event.kind !== 'flee' },
      )
    } catch {
      break
    }
    prepareTerrainRoute(w, a, s, t, [to], 'map', op.reactionsConfirmed)
    Object.assign(t, { x: to.x, y: to.y })
    event.travel += s.grid.feet
    event.spent = (event.spent ?? 0) + cost
    event.current = position(t)

    const ground = m3GroundAt(a, s, t)
    if (to.height > ground) {
      m3State(a).events.push({
        id: crypto.randomUUID(),
        type: 'fall',
        entityId: target.id,
        sceneId: s.id,
        from: to,
        layer: t.spatial?.layer ?? 'material',
        status: 'pending',
        note: '法术实际位移失去支撑，先结算坠落',
      })
      return '已在失去支撑处暂停，保留剩余位移'
    }
    if (pendingTerrain(a, target.id).length) {
      if (event.travel >= event.feet) event.status = 'resolved'
      return '已在新触发区域后果处暂停，保留实际行程'
    }
  }
  event.status = 'resolved'
  event.note = op.note
  return `已沿实际合法路线移动${event.travel}尺，受实体／边界／占地限制；${event.kind === 'flee' ? '反应移动，借机由GM核验' : '不消耗自身移动且不触发借机'}`
}
