import type { MapScene, MapToken, MapWall, Position } from './map-types'

const EPS = 1e-8
const cross = (a: Position, b: Position, c: Position) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
const on = (a: Position, b: Position, p: Position) =>
  Math.abs(cross(a, b, p)) < EPS &&
  p.x >= Math.min(a.x, b.x) - EPS &&
  p.x <= Math.max(a.x, b.x) + EPS &&
  p.y >= Math.min(a.y, b.y) - EPS &&
  p.y <= Math.max(a.y, b.y) + EPS
/** Closed segments: passing exactly through a wall junction does not create a loophole. */
export function segmentsIntersect(a: Position, b: Position, c: Position, d: Position) {
  const ac = cross(a, b, c),
    ad = cross(a, b, d),
    ca = cross(c, d, a),
    cb = cross(c, d, b)
  return (
    (ac * ad < -EPS && ca * cb < -EPS) || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)
  )
}
export function wallState(scene: Pick<MapScene, 'points'>, wall: MapWall) {
  return wall.kind === 'door' && wall.pointId
    ? (scene.points.find((p) => p.id === wall.pointId)?.state ?? 'closed')
    : wall.state
}
export const wallActive = (scene: Pick<MapScene, 'points'>, wall: MapWall) =>
  wall.kind !== 'door' || wallState(scene, wall) !== 'open'
export function newWall(a: Position, b: Position, kind: MapWall['kind'] = 'wall'): MapWall {
  return {
    id: crypto.randomUUID(),
    name: kind === 'door' ? '门段' : '墙体',
    a: { ...a },
    b: { ...b },
    kind,
    state: 'closed',
    pointId: null,
    blocksMovement: true,
    blocksSight: true,
    blocksTargeting: true,
    cover: 'total',
    hidden: false,
    color: kind === 'door' ? '#d6a45f' : '#b9cad0',
  }
}
export function validateWalls(scene: MapScene) {
  const walls = scene.walls ?? []
  if (walls.length > 400 || new Set(walls.map((w) => w.id)).size !== walls.length)
    throw new Error('墙门数量超过 400 或 ID 重复')
  const links = walls.flatMap((w) => (w.pointId ? [w.pointId] : []))
  if (new Set(links).size !== links.length) throw new Error('同一门互动点只能关联一个门段')
  for (const wall of walls) {
    for (const p of [wall.a, wall.b])
      if (
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > scene.grid.columns ||
        p.y > scene.grid.rows
      )
        throw new Error('墙门端点超出网格边界')
    if (Math.hypot(wall.a.x - wall.b.x, wall.a.y - wall.b.y) < 0.05)
      throw new Error('墙门两端不能重合')
    if (wall.pointId) {
      const point = scene.points.find((p) => p.id === wall.pointId)
      if (
        wall.kind !== 'door' ||
        point?.kind !== 'door' ||
        !point.enabled ||
        !['open', 'closed', 'locked'].includes(point.state)
      )
        throw new Error('门段必须关联启用且状态有效的门互动点；删除互动点前请解除关联')
      // Interaction handle must be adjacent to the segment, rather than opening a remote door.
      const p = { x: point.x + 0.5, y: point.y + 0.5 },
        dx = wall.b.x - wall.a.x,
        dy = wall.b.y - wall.a.y,
        t = Math.max(
          0,
          Math.min(1, ((p.x - wall.a.x) * dx + (p.y - wall.a.y) * dy) / (dx * dx + dy * dy)),
        )
      if (Math.hypot(p.x - wall.a.x - t * dx, p.y - wall.a.y - t * dy) > 1)
        throw new Error('关联门互动点必须位于门段附近（一格内）')
    }
  }
}
function centers(token: Position & { span?: number }) {
  const n = token.span ?? 1
  return Array.from({ length: n * n }, (_, i) => ({
    x: token.x + (i % n) + 0.5,
    y: token.y + Math.floor(i / n) + 0.5,
  }))
}
export const COVER_NAMES = {
  none: '无掩护',
  half: '半掩护',
  'three-quarters': '四分之三掩护',
  total: '完全掩护',
} as const
export type Cover = keyof typeof COVER_NAMES
const covers: Cover[] = ['none', 'half', 'three-quarters', 'total']
export const strongerCover = (a: Cover, b: Cover): Cover =>
  covers[Math.max(covers.indexOf(a), covers.indexOf(b))]!
export const effectiveWallCover = (w: MapWall): Cover =>
  w.blocksTargeting ? (w.cover ?? 'total') : 'none'
export function rayCover(scene: Pick<MapScene, 'walls' | 'points'>, a: Position, b: Position) {
  const hits = (scene.walls ?? []).filter(
    (w) =>
      wallActive(scene, w) && effectiveWallCover(w) !== 'none' && segmentsIntersect(a, b, w.a, w.b),
  )
  return {
    degree: hits.reduce<Cover>((degree, w) => strongerCover(degree, effectiveWallCover(w)), 'none'),
    blockers: hits,
  }
}
/** GM assigns obstacle degrees; we do not infer body coverage percentages from image pixels. */
export function coverBetween(
  scene: MapScene,
  from: Position & { span?: number },
  to: Position & { span?: number },
) {
  if (from.x === to.x && from.y === to.y)
    return { degree: 'none' as Cover, blockers: [] as MapWall[] }
  let best: ReturnType<typeof rayCover> = { degree: 'total', blockers: [] }
  for (const a of centers(from))
    for (const b of centers(to)) {
      const hit = rayCover(scene, a, b)
      if (covers.indexOf(hit.degree) < covers.indexOf(best.degree) || !best.blockers.length)
        best = hit
      if (hit.degree === 'none') return hit
    }
  return best
}
export interface SpatialResult {
  clear: boolean
  blockers: MapWall[]
}
/** Any unobstructed pair of occupied cell centers is a valid D1 ray. Not partial cover or 3D. */
export function sightLine(
  scene: MapScene,
  from: Position & { span?: number },
  to: Position & { span?: number },
  kind: 'blocksSight' | 'blocksTargeting' = 'blocksSight',
): SpatialResult {
  if (from.x === to.x && from.y === to.y) return { clear: true, blockers: [] }
  const walls = (scene.walls ?? []).filter(
      (w) =>
        (kind === 'blocksTargeting' ? effectiveWallCover(w) === 'total' : w.blocksSight) &&
        wallActive(scene, w),
    ),
    blockers = new Map<string, MapWall>()
  for (const a of centers(from))
    for (const b of centers(to)) {
      const hits = walls.filter((w) => segmentsIntersect(a, b, w.a, w.b))
      if (!hits.length) return { clear: true, blockers: [] }
      hits.forEach((w) => blockers.set(w.id, w))
    }
  return { clear: false, blockers: [...blockers.values()] }
}
function hull(points: Position[]) {
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y),
    build = (ps: Position[]) => {
      const result: Position[] = []
      for (const p of ps) {
        while (result.length > 1 && cross(result[result.length - 2]!, result.at(-1)!, p) <= EPS)
          result.pop()
        result.push(p)
      }
      return result
    }
  return [...build(sorted).slice(0, -1), ...build([...sorted].reverse()).slice(0, -1)]
}
function intersectsInterior(wall: MapWall, polygon: Position[]) {
  // Clip the wall against a convex swept footprint; boundary-only contact is allowed.
  let lo = 0,
    hi = 1
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!,
      b = polygon[(i + 1) % polygon.length]!,
      start = cross(a, b, wall.a),
      change = cross(a, b, wall.b) - start
    if (Math.abs(change) < EPS) {
      if (start <= EPS) return false
      continue
    }
    const t = (EPS - start) / change
    if (change > 0) lo = Math.max(lo, t)
    else hi = Math.min(hi, t)
    if (lo > hi) return false
  }
  return lo <= hi && hi >= 0 && lo <= 1
}
export function movementWalls(scene: MapScene, token: MapToken, from: Position, to: Position) {
  const corners = (p: Position) => [
      { x: p.x, y: p.y },
      { x: p.x + token.span, y: p.y },
      { x: p.x + token.span, y: p.y + token.span },
      { x: p.x, y: p.y + token.span },
    ],
    polygon = hull([...corners(from), ...corners(to)])
  return (scene.walls ?? []).filter(
    (w) =>
      w.blocksMovement &&
      wallActive(scene, w) &&
      (intersectsInterior(w, polygon) ||
        centers({ ...from, span: token.span }).some((a, i) =>
          segmentsIntersect(a, centers({ ...to, span: token.span })[i]!, w.a, w.b),
        )),
  )
}
export const blockerNames = (walls: MapWall[]) =>
  [...new Set(walls.map((w) => (w.hidden ? '隐藏障碍' : w.name.slice(0, 120))))]
    .slice(0, 5)
    .join('、')
