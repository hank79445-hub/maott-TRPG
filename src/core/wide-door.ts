import type { MapScene, Position, MapWall } from './map-types'
import { newPoint } from './map'
import { newWall } from './map-spatial'
export interface DoorPreset {
  length: number
  axis: 'horizontal' | 'vertical'
  side: 1 | -1
}
export function wideDoorGeometry(s: Pick<MapScene, 'grid'>, start: Position, p: DoorPreset) {
  if (
    !Number.isInteger(p.length) ||
    p.length < 1 ||
    p.length > 40 ||
    !Number.isInteger(start.x) ||
    !Number.isInteger(start.y)
  )
    throw Error('宽门长度须为1–40整数格，起点须为网格顶点')
  const end = {
      x: start.x + (p.axis === 'horizontal' ? p.length : 0),
      y: start.y + (p.axis === 'vertical' ? p.length : 0),
    },
    anchor =
      p.axis === 'horizontal'
        ? { x: start.x, y: start.y + (p.side === 1 ? 0 : -1) }
        : { x: start.x + (p.side === 1 ? 0 : -1), y: start.y }
  if (
    [start, end].some((q) => q.x < 0 || q.y < 0 || q.x > s.grid.columns || q.y > s.grid.rows) ||
    anchor.x < 0 ||
    anchor.y < 0 ||
    anchor.x >= s.grid.columns ||
    anchor.y >= s.grid.rows
  )
    throw Error('宽门或操作侧超出地图；调整方向、操作侧或起点')
  return { start, end, anchor }
}
export function addWideDoor(s: MapScene, start: Position, preset: DoorPreset) {
  const g = wideDoorGeometry(s, start, preset),
    horizontal = preset.axis === 'horizontal'
  if (
    s.walls?.some((w) =>
      horizontal
        ? w.a.y === start.y &&
          w.b.y === start.y &&
          Math.min(w.a.x, w.b.x) < g.end.x &&
          Math.max(w.a.x, w.b.x) > start.x
        : w.a.x === start.x &&
          w.b.x === start.x &&
          Math.min(w.a.y, w.b.y) < g.end.y &&
          Math.max(w.a.y, w.b.y) > start.y,
    )
  )
    throw Error('新门与现有墙门重叠；请先明确拆分原墙段，不会自动删墙')
  const point = newPoint('door', g.anchor),
    wall = newWall(start, g.end, 'door')
  point.name = wall.name = preset.length + '格大门'
  wall.pointId = point.id
  s.points.push(point)
  ;(s.walls ??= []).push(wall)
  return { wall, point }
}
/** Only footprints straddling the actual plane prevent closing; adjacent tiles are legal. */
export function assertDoorClear(s: MapScene, pointId?: string | null, wallId?: string) {
  for (const w of s.walls ?? []) {
    if (w.kind !== 'door' || !(pointId ? w.pointId === pointId : w.id === wallId)) continue
    for (const t of s.tokens) {
      if (
        (t.spatial?.layer && t.spatial.layer !== 'material') ||
        (w.heightFeet !== undefined && (t.spatial?.height ?? 0) >= w.heightFeet)
      )
        continue
      let lo = 0,
        hi = 1
      for (const axis of ['x', 'y'] as const) {
        const delta = w.b[axis] - w.a[axis],
          min = t[axis] + 1e-6,
          max = t[axis] + t.span - 1e-6
        if (Math.abs(delta) < 1e-9) {
          if (w.a[axis] <= min || w.a[axis] >= max) {
            lo = 2
            break
          }
        } else {
          let a = (min - w.a[axis]) / delta,
            b = (max - w.a[axis]) / delta
          if (a > b) [a, b] = [b, a]
          lo = Math.max(lo, a)
          hi = Math.min(hi, b)
        }
      }
      if (lo < hi) throw Error('门段被棋子占据，人物占用门面，不能关闭；请先移开跨越门面的棋子')
    }
  }
}
