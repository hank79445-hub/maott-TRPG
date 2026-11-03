import type { MapScene, MapToken, MapWorld } from '../core/map-types'
import type { BroadcastEvent } from '../core/broadcast-types'
import type { Room, RoomMember } from '../online/protocol'
import { enclosedMode, publishedCells } from '../core/enclosed-exploration'
import { fogIds } from './fog'
import type { MapFeedback, MapFeedbackFeed, MapFeedbackKind } from '../online/map-feedback-types'
import { canReadBroadcast } from './room-broadcast'
import { redactFogEvent } from './fog-broadcast'
import { fogEntityAllowed } from './fog'
const journal = (world: MapWorld) => world.adventures[0]?.broadcastLog
const center = (t: Pick<MapToken, 'x' | 'y' | 'span'>) => ({
  x: t.x + t.span / 2,
  y: t.y + t.span / 2,
})
const owns = (m: RoomMember, t?: MapToken) =>
  !!t && (m.characterIds.includes(t.characterId ?? '') || m.actorIds.includes(t.actorId ?? ''))
function visibleEntity(room: Room, m: RoomMember, s: MapScene, t: MapToken) {
  return m.role === 'gm' || (!t.hidden && fogEntityAllowed(room, m, s.id, t))
}
function token(s: MapScene, refs: unknown[]) {
  return s.tokens.find((t) =>
    [t.id, t.actorId, t.characterId, t.npcId].some((id) => !!id && refs.includes(id)),
  )
}
/** Capture at the successful transaction boundary, before projecting the snapshot. */
export function collectMapFeedback(room: Room, before: MapWorld) {
  const a = room.world.adventures[0],
    old = before.adventures.find((v) => v.id === a?.id),
    log = journal(room.world)
  if (!a || !old || !log) return
  if (room.mapFeedback?.branchId !== log.branchId)
    room.mapFeedback = { branchId: log.branchId, nextSequence: 1, events: [] }
  const state = room.mapFeedback!,
    oldIds = new Set(old.broadcastLog?.events.map((e) => e.id) ?? [])
  const events = log.events.filter(
    (e) => !oldIds.has(e.id) && e.phase === 'confirmed' && !e.supersedes.length,
  )
  const members = room.members.filter((m) => !m.revoked && (m.role === 'gm' || m.role === 'player'))
  const visibilityCaches = new Map<MapWorld, Map<string, boolean>>()
  function visible(snapshot: Room, m: RoomMember, s: MapScene, t: MapToken) {
    let cache = visibilityCaches.get(snapshot.world)
    if (!cache) {
      cache = new Map()
      visibilityCaches.set(snapshot.world, cache)
    }
    const key = m.id + ':' + s.id + ':' + t.id + ':' + t.x + ':' + t.y + ':' + t.hidden
    if (!cache.has(key)) cache.set(key, visibleEntity(snapshot, m, s, t))
    return cache.get(key)!
  }
  function add(
    base: Omit<MapFeedback, 'sequence' | 'roomId' | 'branchId' | 'at' | 'own'>,
    m: RoomMember,
    own: boolean,
  ) {
    if (state.events.some((e) => e.id === base.id && e.memberId === m.id)) return
    let seq = state.events.find((e) => e.id === base.id)?.sequence
    if (!seq) seq = state.nextSequence++
    state.events.push({
      ...base,
      roomId: room.id,
      branchId: log!.branchId,
      sequence: seq,
      at: new Date().toISOString(),
      own,
      memberId: m.id,
      gmOnly: m.role === 'gm',
    })
  }
  for (const e of events) {
    const s = a.scenes.find((s) => s.id === e.sceneId)
    if (!s) continue
    for (const m of members) {
      if (!canReadBroadcast(room, m, e)) continue
      const f = (m.role === 'gm' ? e : redactFogEvent(e, [...m.characterIds, ...m.actorIds])).facts
      const target =
          token(s, [f.actorId, f.tokenId, f.characterId, f.actorNpcId]) ??
          ((e.type === 'life.state' && f.dead === true) ||
          e.type === 'target.resolved' ||
          e.type === 'effect.health'
            ? token({ ...s, tokens: s.defeatedTokens ?? [] }, [f.actorId, f.tokenId, f.characterId])
            : undefined),
        source = token(s, [f.sourceId])
      let kind: MapFeedbackKind | undefined,
        title = '',
        amount: number | undefined,
        anchor = target ? center(target) : undefined
      if (target && !visible(room, m, s, target)) continue
      if (e.type === 'target.resolved' && target) {
        kind = f.kind === 'attack' && f.hit === false ? 'miss' : 'hit'
        title =
          kind === 'miss'
            ? '未命中'
            : f.critical === true
              ? '暴击'
              : f.kind === 'save'
                ? f.hit
                  ? '豁免失败'
                  : '豁免成功'
                : '命中'
        if (typeof f.damage === 'number' && f.damage > 0) {
          amount = f.damage
          kind = 'damage'
          title = (f.critical ? '暴击 · ' : '') + '伤害'
        } else if (typeof f.hpChange === 'number' && f.hpChange > 0) {
          kind = 'heal'
          amount = f.hpChange
          title = '治疗'
        }
      } else if (e.type === 'effect.health' && target && typeof f.hpChange === 'number') {
        kind = 'health'
        amount = f.hpChange
        title = '生命变化'
        if (!amount && typeof f.temporaryHpChange === 'number' && f.temporaryHpChange) {
          kind = 'shield'
          amount = f.temporaryHpChange
          title = '临时生命'
        }
      } else if (e.type === 'life.state' && target && typeof f.dead === 'boolean') {
        kind = f.dead ? 'death' : 'condition'
        title = f.dead ? '死亡' : f.stable ? '稳定' : '生命状态更新'
      } else if (e.type === 'reaction.confirmed' && source && visible(room, m, s, source)) {
        kind = 'shield'
        title = '反应已确认'
        anchor = center(source)
      } else if ((e.type === 'combat.save' || e.type === 'combat.concentration') && target) {
        kind = 'shield'
        title = f.success ? '豁免成功' : '豁免失败'
      } else if (e.type === 'token.moved' && target) {
        kind = 'move'
        title = f.adjudicated ? '调整位置' : '移动已确认'
      } else if (e.type === 'token.jumped' && target) {
        kind = 'arrival'
        title = '落地'
      } else if (e.type === 'exploration.condition-ended' && target) {
        kind = 'condition'
        title = '状态结束'
      } else if (e.type === 'region.enter' && target) {
        kind = 'region'
        title = '进入区域'
      } else if (e.type === 'point.result' || e.type === 'door.change') {
        const wall = s.walls?.find((w) => w.id === f.wallId),
          p = s.points.find((p) => p.id === (f.pointId ?? wall?.pointId))
        if (!p) continue
        const marker = {
          ...p,
          span: 1,
          characterId: null,
          actorId: null,
          color: '#000000',
          facing: 0,
        } as MapToken
        if (!visible(room, m, s, marker)) continue
        kind = 'interaction'
        title = e.type === 'door.change' ? (f.open ? '开启' : '关闭') : '互动已确认'
        anchor = center(marker)
      }
      if (!kind || !anchor) continue
      const base: Omit<MapFeedback, 'sequence' | 'roomId' | 'branchId' | 'at' | 'own'> = {
        id: e.id,
        sceneId: s.id,
        kind,
        title,
        anchor,
        ...(target ? { tokenId: target.id } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(f.critical === true ? { critical: true } : {}),
      }
      // Both endpoints must be known. The client also clips the entire ray against its current fog.
      if (
        e.type === 'target.resolved' &&
        f.ranged === true &&
        source &&
        visible(room, m, s, source)
      )
        base.source = center(source)
      add(base, m, owns(m, target) || owns(m, source))
    }
  }
  // Spatial/summoning confirmations have no suitable public broadcast payload. Capture only
  // actual committed entities, with endpoint-specific event-time permissions; no spell-name guessing.
  if (events.some((e) => e.type === 'spell.m3-result' || e.type === 'spell.summon-result')) {
    const cause = events.find(
      (e) => e.type === 'spell.m3-result' || e.type === 'spell.summon-result',
    )!.id
    for (const s of a.scenes) {
      const prior = old.scenes.find((v) => v.id === s.id)
      for (const t of s.tokens) {
        const p = old.scenes.flatMap((s) => s.tokens).find((p) => p.id === t.id)
        if (p && p.x === t.x && p.y === t.y && prior?.tokens.some((p) => p.id === t.id)) continue
        for (const m of members)
          if (visible(room, m, s, t))
            add(
              {
                id: cause + ':arrival:' + t.id,
                sceneId: s.id,
                kind: p ? 'arrival' : 'appearance',
                anchor: center(t),
                tokenId: t.id,
                title: p ? '位移已确认' : '出现',
              },
              m,
              owns(m, t),
            )
      }
      for (const t of prior?.tokens ?? [])
        if (!a.scenes.some((s) => s.tokens.some((n) => n.id === t.id)))
          for (const m of members)
            if (visible({ ...room, world: before }, m, prior!, t))
              add(
                {
                  id: cause + ':departure:' + t.id,
                  sceneId: s.id,
                  kind: 'departure',
                  anchor: center(t),
                  tokenId: t.id,
                  title: '离场',
                },
                m,
                owns(m, t),
              )
    }
  }
  state.events = state.events.slice(-512)
}
export function projectMapFeedback(room: Room, m: RoomMember): MapFeedbackFeed {
  const branchId = journal(room.world)?.branchId ?? 'legacy',
    state = room.mapFeedback?.branchId === branchId ? room.mapFeedback : undefined
  const scene = room.world.adventures[0]?.activeSceneId
  const adventure=room.world.adventures[0],current=adventure?.scenes.find(s=>s.id===scene),published=m.role!=='gm'&&current&&enclosedMode(current)?publishedCells(adventure!,current,fogIds(room,m,current.id)):undefined
  const allowed=(e:MapFeedback)=>!published||published.has(Math.floor(e.anchor.x)+','+Math.floor(e.anchor.y))&&(!e.tokenId||!current?.tokens.find(t=>t.id===e.tokenId)?.hidden)
  const log = journal(room.world)?.events ?? [],
    superseded = new Set(log.flatMap((e) => e.supersedes))
  for (let changed = true; changed;) {
    changed = false
    for (const e of log)
      if (e.causeId && superseded.has(e.causeId) && !superseded.has(e.id)) {
        superseded.add(e.id)
        changed = true
      }
  }
  const ownRecords = m.revoked
    ? []
    : (state?.events ?? []).filter(
        (e) =>
          e.memberId === m.id &&
          (!e.gmOnly || m.role === 'gm') &&
          (m.role === 'gm' || e.sceneId === scene),
      )
  return {
    roomId: room.id,
    branchId,
    head: (state?.nextSequence ?? 1) - 1,
    earliest: state?.events[0]?.sequence ?? 1,
    invalidated: ownRecords.filter((e) => superseded.has(e.id)||!allowed(e)).map((e) => e.id),
    events: ownRecords
      .filter((e) => !superseded.has(e.id)&&allowed(e))
      .slice(-64)
      .map(({ memberId: _, gmOnly: __, ...e }) => ({...e,source:e.source&&published&&!published.has(Math.floor(e.source.x)+','+Math.floor(e.source.y))?undefined:e.source})),
  }
}
