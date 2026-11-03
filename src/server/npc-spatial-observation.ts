import { createHash } from 'node:crypto'
import type { Room } from '../online/protocol'
import type { NpcProfile } from '../core/ai-types'
import type { MapPoint, MapToken } from '../core/map-types'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { distance } from '../core/map'
import { combatStats, freshTurn } from '../core/combat-rules'
import { tokenPerception, m3PerceptionCache } from '../core/m3-map-perception'
import { visibleDoorSurface } from '../core/door-surface'
import { tokenStatuses } from './token-status'
import { defaultSpatialPolicy } from '../persistence/npc-spatial-schema'
import { fogSignature } from '../core/fog'

const capturedSpatial = new WeakMap<Room, string>()

export const spatialHash = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex')
export function npcSupplies(room: Room, npc: NpcProfile) {
  const cat = catalogue([srd, ...room.world.packs]),
    character = room.world.characters.find((c) => c.id === npc.characterId)
  const rows = character
    ? character.inventory.map((i) => ({ id: i.instanceId, itemId: i.itemId, quantity: i.quantity }))
    : (npc.consumables ?? []).map((i) => ({
        ...i,
        quantity: Math.max(0, i.quantity - (npc.consumablesUsed?.[i.id] ?? 0)),
      }))
  const available = rows.filter((i) => i.quantity > 0)
  return {
    items: available
      .slice(0, 40)
      .map((i) => ({
        ...i,
        name: cat.items.find((item) => item.id === i.itemId)?.name ?? '已登记物品',
      })),
    truncated: available.length > 40,
  }
}
export function npcCanSeeCell(room: Room, npc: NpcProfile, p: { x: number; y: number }) {
  const { a, scene, token, cat } = spatialSource(room, npc)
  if (!scene || !token) return false
  const target: MapToken = {
    ...p,
    id: 'destination',
    name: '',
    span: 1,
    hidden: false,
    color: '#000000',
    facing: 0,
    characterId: null,
    actorId: null,
  }
  return tokenPerception(room.world, a, scene, token, target, cat, false).canSee
}
export function spatialSource(room: Room, npc: NpcProfile) {
  const a = room.world.adventures[0]!,
    scene = a.scenes.find((s) => s.id === npc.sceneId)
  const token = scene?.tokens.find(
    (t) => t.npcId === npc.id || (!!npc.characterId && t.characterId === npc.characterId),
  )
  const actor = room.world.encounters.flatMap((e) => e.actors).find((t) => t.id === npc.actorId)
  const cat = catalogue([srd, ...room.world.packs])
  const stats = combatStats(
    actor ?? {
      id: npc.id,
      characterId: npc.characterId,
      npc: npc.body,
      side: npc.side,
      initiative: null,
      surprised: false,
      turn: freshTurn(),
    },
    room.world.characters,
    cat,
  )
  return { a, scene, token, stats, cat, actor }
}
export function pointOperations(p: MapPoint) {
  return p.kind === 'exit'
    ? ['travel', ...(p.check ? ['check'] : [])]
    : p.kind === 'door'
      ? ['toggle', ...(p.check ? ['check'] : [])]
      : [
          'use',
          ...(p.check ? ['check'] : []),
          ...(p.kind === 'chest' && p.state === 'open' ? ['claim'] : []),
        ]
}
export function npcSpatialObservation(room: Room, npc: NpcProfile, sharedCache?: ReturnType<typeof m3PerceptionCache>) {
  const branchId = room.world.adventures[0]?.broadcastLog?.branchId ?? 'legacy'
  let source: ReturnType<typeof spatialSource> | undefined
  try {
    source = spatialSource(room, npc)
  } catch {
    /* An incomplete NPC has no fabricated fallback body. */
  }
  if (!source)
    return {
      version: spatialHash([branchId, npc.id, npc.revision, 'unavailable']),
      available: false as const,
      sceneId: npc.sceneId,
      own: null,
      units: [],
      points: [],
      lastSeen: [],
      exits: [],
    }
  const { a, scene, token, stats, cat } = source
  if (
    !scene ||
    !token ||
    !npc.enabled ||
    (npc.initiallyAbsent && !npc.appeared) ||
    (!npc.characterId && !npc.body) ||
    stats.dead ||
    stats.hp <= 0
  ) {
    return {
      version: spatialHash([branchId, npc.id, npc.revision, 'unavailable']),
      available: false as const,
      sceneId: npc.sceneId,
      own: null,
      units: [],
      points: [],
      lastSeen: [],
      exits: [],
    }
  }
  const cache = sharedCache ?? m3PerceptionCache()
  const units = scene.tokens
    .filter(
      (t) =>
        t.id === token.id ||
        (!t.hidden &&
          tokenPerception(room.world, a, scene, token, t, cat, false, cache).canPerceive),
    )
    .map((t) => ({
      id: t.id,
      actorId: t.actorId,
      characterId: t.characterId,
      name: t.name,
      x: t.x,
      y: t.y,
      span: t.span,
      height: t.spatial?.height ?? 0,
      layer: t.spatial?.layer ?? 'material',
      distance: distance(scene, token, t),
      statuses: tokenStatuses(room, t, t.id === token.id, false, cat),
    }))
  const points = scene.points
    .filter((p) => {
      if (p.hidden || !p.enabled) return false
      const target: MapToken = {
        id: 'point:' + p.id,
        x: p.x,
        y: p.y,
        span: 1,
        hidden: false,
        name: p.name,
        characterId: null,
        actorId: null,
        color: '#000000',
        facing: 0,
      }
      return tokenPerception(room.world, a, scene, token, target, cat, false, cache).canSee ||
        !!visibleDoorSurface(room.world, a, scene, p, token, cat, undefined, cache)
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      x: p.x,
      y: p.y,
      state: p.state,
      range: p.range,
      distance: distance(scene, token, p),
      operations: pointOperations(p),
    }))
  const observed = new Set([...units.map((t) => t.id), ...points.map((p) => p.id)])
  const lastSeen = (a.ai?.spatialState?.branchId === branchId ? a.ai.spatialState.seen : [])
    .filter((s) => s.npcId === npc.id && s.sceneId === scene.id && !observed.has(s.id))
    .map(({ id, name, kind, x, y, at }) => ({
      id,
      name,
      kind,
      x,
      y,
      at,
      certainty: 'last-seen' as const,
    }))
  const policy = npc.spatialPolicy ?? defaultSpatialPolicy()
  const exits = policy.knownExits.flatMap((k) => {
    const s = a.scenes.find((s) => s.id === k.sceneId),
      p = s?.points.find((p) => p.id === k.pointId)
    if (!p || p.kind !== 'exit') return []
    // Only GM-authored route grants disclose a destination; unrelated graph edges stay private.
    return [
      { sceneId: k.sceneId, pointId: k.pointId, name: p.name, targetSceneId: p.targetSceneId },
    ]
  })
  const own = {
    id: token.id,
    x: token.x,
    y: token.y,
    span: token.span,
    speed: stats.speed,
    sceneId: scene.id,
    supplies: npcSupplies(room, npc),
  }
  return {
    available: true as const,
    version: spatialHash([branchId, npc.revision, own, units, points, policy]),
    sceneId: scene.id,
    grid: { columns: scene.grid.columns, rows: scene.grid.rows, feet: scene.grid.feet },
    own,
    units,
    points,
    lastSeen,
    exits,
  }
}

/** Public dialogue needs perceived positions, not private resources or full self effects. */
export function npcDialogueSpatialSummary(room:Room,npc:NpcProfile){
 const view=npcSpatialObservation(room,npc)
 return {available:view.available,sceneId:view.sceneId,own:view.own?{id:view.own.id,x:view.own.x,y:view.own.y}:null,
  units:view.units.slice().sort((a,b)=>a.distance-b.distance).slice(0,40).map(({statuses,...unit})=>unit),
  points:view.points.slice().sort((a,b)=>a.distance-b.distance).slice(0,40),lastSeen:view.lastSeen.slice(-20),
  omitted:{units:Math.max(0,view.units.length-40),points:Math.max(0,view.points.length-40)}}
}

/** Only called inside an accepted room transaction, not while rendering player snapshots. */
export function captureNpcSpatial(room: Room) {
  const a = room.world.adventures[0]!,
    branchId = a.broadcastLog?.branchId ?? 'legacy'
  if (!a.ai?.npcs.some((n) => n.spatialPolicy?.enabled)) return
  const fingerprint = () => {
    const npcs = a.ai!.npcs.filter(n => n.spatialPolicy?.enabled), ids = new Set(npcs.map(n => n.sceneId))
    return spatialHash([branchId,room.worldRevision,npcs,a.scenes.filter(s=>ids.has(s.id)).map(s=>[fogSignature(room.world,a,s),s.points]),room.world.characters.map(c=>[c.id,c.inventory]),a.ai!.spatialState?.seen])
  }
  if (capturedSpatial.get(room) === fingerprint()) return
  const state = (a.ai.spatialState ??= {
    branchId,
    nextSequence: 1,
    seen: [],
    tasks: [],
    events: [],
  })
  if (state.branchId !== branchId) {
    // Saved state is from the restored checkpoint. Rebind its knowledge but require explicit task resume.
    state.branchId = branchId
    state.events = []
    state.decisions = []
    for (const task of state.tasks) {
      task.branchId = branchId
      if (!['completed', 'canceled'].includes(task.status)) {
        task.status = 'paused'
        task.approved = false
        task.reason = '读档分支已变化，请GM重新批准'
      }
    }
  }
  const caches = new Map<string, ReturnType<typeof m3PerceptionCache>>()
  for (const n of a.ai.npcs.filter((n) => n.spatialPolicy?.enabled)) {
    let cache=caches.get(n.sceneId)
    if(!cache){cache=m3PerceptionCache();caches.set(n.sceneId,cache)}
    const view = npcSpatialObservation(room, n, cache)
    if (!view.available) continue
    const rows = [
      ...view.units.map((u) => ({
        npcId: n.id,
        sceneId: n.sceneId,
        id: u.id,
        name: u.name,
        kind: 'unit' as const,
        x: u.x,
        y: u.y,
        at: room.worldRevision,
      })),
      ...view.points.map((p) => ({
        npcId: n.id,
        sceneId: n.sceneId,
        id: p.id,
        name: p.name,
        kind: 'point' as const,
        x: p.x,
        y: p.y,
        at: room.worldRevision,
      })),
    ]
    const ids = new Set(rows.map((r) => r.id))
    const retained = state.seen.filter((r) => r.npcId === n.id && !ids.has(r.id))
    state.seen = [
      ...state.seen.filter((r) => r.npcId !== n.id),
      ...[...retained, ...rows].slice(-128),
    ].slice(-4000)
    if ([...state.events].reverse().find((e) => e.npcId === n.id)?.version !== view.version) {
      state.events.push({
        sequence: state.nextSequence++,
        npcId: n.id,
        version: view.version,
        sceneId: n.sceneId,
      })
      state.events = state.events.slice(-300)
    }
  }
  capturedSpatial.set(room, fingerprint())
}
