import type { Adventure, MapWorld, MapScene, MapPoint, Position, MapToken } from './map-types'
import { blocked, occupied, inside } from './map'
import { movementWalls } from './map-spatial'
export function defaultArrival(s: MapScene, p: MapPoint) {
  const anchor = { x: Math.min(p.x + 1, s.grid.columns - 1), y: p.y }
  const cells: string[] = []
  for (let y = anchor.y; y < Math.min(s.grid.rows, anchor.y + 3); y++)
    for (let x = anchor.x; x < Math.min(s.grid.columns, anchor.x + 3); x++) cells.push(x + ',' + y)
  return { anchor, cells, relative: true }
}
export function validatePortals(a: Pick<Adventure, 'scenes'>) {
  for (const s of a.scenes)
    for (const p of s.points) {
      if (!p.portal) continue
      if (p.kind !== 'exit') throw Error('通行口必须是场景入口／出口互动点')
      const arrival = p.portal.arrival
      if (
        arrival &&
        (!arrival.cells.length ||
          !arrival.cells.includes(arrival.anchor.x + ',' + arrival.anchor.y) ||
          arrival.cells.some((k) => {
            const [x, y] = k.split(',').map(Number)
            return !inside(s, { x: x!, y: y! })
          }))
      )
        throw Error('通行口到达区域或锚点超出地图／为空')
      if (!p.portal.targetPointId) continue
      const target = a.scenes.find((t) => t.id === p.targetSceneId),
        other = target?.points.find((q) => q.id === p.portal!.targetPointId)
      if (!target || target.id === s.id || other?.kind !== 'exit')
        throw Error('配对通行口引用缺失；请先解除配对再删除或改类型')
      if (
        p.portal.bidirectional &&
        (other.targetSceneId !== s.id ||
          other.portal?.targetPointId !== p.id ||
          !other.portal.bidirectional)
      )
        throw Error('双向通行口不一致，请使用配对入口')
    }
}
export function pairPortals(
  a: Adventure,
  c: {
    sceneId: string
    pointId: string
    targetSceneId: string | null
    targetPointId: string | null
    bidirectional: boolean
  },
) {
  const s = a.scenes.find((s) => s.id === c.sceneId),
    p = s?.points.find((p) => p.id === c.pointId)
  if (!s || p?.kind !== 'exit') throw Error('源通行口不存在')
  const prior = a.scenes
    .find((s) => s.id === p.targetSceneId)
    ?.points.find((q) => q.id === p.portal?.targetPointId)
  if (!c.targetSceneId || !c.targetPointId) {
    if (prior?.portal?.targetPointId === p.id) {
      prior.portal.targetPointId = null
      prior.portal.bidirectional = false
      prior.targetSceneId = null
    }
    p.portal = { ...p.portal, targetPointId: null, bidirectional: false }
    p.targetSceneId = null
    return
  }
  const to = a.scenes.find((s) => s.id === c.targetSceneId),
    q = to?.points.find((q) => q.id === c.targetPointId)
  if (!to || to.id === s.id || q?.kind !== 'exit') throw Error('请选择另一场景的通行口')
  if (p.portal?.targetPointId && (p.targetSceneId !== to.id || p.portal.targetPointId !== q.id))
    throw Error('请先解除现有配对')
  if (
    c.bidirectional &&
    q.portal?.targetPointId &&
    (q.targetSceneId !== s.id || q.portal.targetPointId !== p.id)
  )
    throw Error('目标通行口已有连接，请先解除')
  p.targetSceneId = to.id
  p.portal = {
    ...p.portal,
    targetPointId: q.id,
    bidirectional: c.bidirectional,
    arrival: p.portal?.arrival ?? defaultArrival(s, p),
  }
  q.portal = {
    targetPointId: null,
    bidirectional: false,
    ...q.portal,
    arrival: q.portal?.arrival ?? defaultArrival(to, q),
  }
  if (c.bidirectional) {
    q.targetSceneId = s.id
    q.portal = {
      ...q.portal,
      targetPointId: p.id,
      bidirectional: true,
      arrival: q.portal?.arrival ?? defaultArrival(to, q),
    }
  } else if (prior?.portal?.targetPointId === p.id) {
    prior.portal.targetPointId = null
    prior.portal.bidirectional = false
    prior.targetSceneId = null
  }
}
export function planPortalArrival(world: MapWorld, a: Adventure, to: MapScene, point: MapPoint) {
  const arrival = point.portal?.arrival
  if (!arrival) throw Error('目标通行口尚未配置到达区')
  const allowed = new Set(arrival.cells),
    reachable = new Set<string>(),
    queue = [arrival.anchor]
  while (queue.length) {
    const p = queue.shift()!,
      key = p.x + ',' + p.y
    if (reachable.has(key) || !allowed.has(key) || blocked(to, p)) continue
    reachable.add(key)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const q = { x: p.x + dx!, y: p.y + dy! }
      if (allowed.has(q.x + ',' + q.y) && !movementWalls(to, { span: 1 } as MapToken, p, q).length)
        queue.push(q)
    }
  }
  const followers =
    a.ai?.npcs.filter(
      (n) =>
        n.npcType === 'important' &&
        n.followParty &&
        n.enabled &&
        n.sceneId === a.activeSceneId &&
        !(n.initiallyAbsent && !n.appeared),
    ) ?? []
  const excluded = new Set(followers.map((n) => n.id)),
    taken = new Set(
      to.tokens
        .filter(
          (t) =>
            !(t.characterId && a.party.includes(t.characterId)) && !excluded.has(t.npcId ?? ''),
        )
        .flatMap((t) => occupied(t).map((p) => p.x + ',' + p.y)),
    )
  const candidates = [...reachable]
    .map((k) => {
      const [x, y] = k.split(',').map(Number)
      return { x: x!, y: y! }
    })
    .sort(
      (p, q) =>
        Math.max(Math.abs(p.x - arrival.anchor.x), Math.abs(p.y - arrival.anchor.y)) -
          Math.max(Math.abs(q.x - arrival.anchor.x), Math.abs(q.y - arrival.anchor.y)) ||
        p.y - q.y ||
        p.x - q.x,
    )
  const party: Record<string, Position> = {},
    npcs: Record<string, Position> = {}
  const place = (id: string, span: number, out: Record<string, Position>) => {
    const p = candidates.find(
      (p) =>
        occupied({ ...p, span } as MapToken).every(
          (c) => reachable.has(c.x + ',' + c.y) && !taken.has(c.x + ',' + c.y),
        ) && !movementWalls(to, { span } as MapToken, p, p).length,
    )
    if (!p) throw Error('到达区空间不足或有墙体／占位冲突，整队暂缓；GM请调整区域')
    out[id] = p
    for (const c of occupied({ ...p, span } as MapToken)) taken.add(c.x + ',' + c.y)
  }
  for (const id of a.party)
    place(
      id,
      (
        a.scenes.find((s) => s.id === a.activeSceneId)?.tokens.find((t) => t.characterId === id) ??
        to.tokens.find((t) => t.characterId === id)
      )?.span ?? 1,
      party,
    )
  for (const n of followers)
    place(n.id, a.scenes.flatMap((s) => s.tokens).find((t) => t.npcId === n.id)?.span ?? 1, npcs)
  return { party, npcs, facing: arrival.facing }
}
