import type { AuthorScene } from '../persistence/script-authoring-schema'
import type { MapWall } from './map-types'
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message)
}
export function validatePointFootprints(scene: AuthorScene, floor: Set<string>) {
  for (const point of scene.points) {
    const a = point.appearance
    if (!a || a.visibility === 'omit') continue
    need(
      point.x + a.width <= scene.width && point.y + a.height <= scene.height,
      scene.name + '/' + point.name + '外观占地越界',
    )
    for (let y = point.y; y < point.y + a.height; y++)
      for (let x = point.x; x < point.x + a.width; x++)
        need(floor.has(`${x},${y}`), scene.name + '/' + point.name + '外观占地不在楼层')
  }
}
// Use unit edges so a structural door replaces only its own part of a generated boundary.
function edges(w: Pick<MapWall, 'a' | 'b'>) {
  need((w.a.x === w.b.x) !== (w.a.y === w.b.y), '墙门必须为非零水平或垂直线段')
  const horizontal = w.a.y === w.b.y,
    cells: string[] = []
  const start = horizontal ? Math.min(w.a.x, w.b.x) : Math.min(w.a.y, w.b.y)
  const end = horizontal ? Math.max(w.a.x, w.b.x) : Math.max(w.a.y, w.b.y)
  for (let v = start; v < end; v++) cells.push(horizontal ? `h:${v},${w.a.y}` : `v:${w.a.x},${v}`)
  return cells
}
export function compileAuthorWalls(
  scene: AuthorScene,
  generated: MapWall[],
  points: Map<string, string>,
): MapWall[] {
  const used = new Set<string>(),
    pointUsed = new Set<string>(),
    keys = new Set<string>(),
    explicit: MapWall[] = []
  for (const wall of scene.walls ?? []) {
    need(!keys.has(wall.key), '墙门编号重复')
    keys.add(wall.key)
    need(
      [wall.a, wall.b].every((p) => p.x <= scene.width && p.y <= scene.height),
      '墙门端点越界',
    )
    const units = edges(wall)
    need(
      units.every((k) => !used.has(k)),
      '墙门线段重叠',
    )
    units.forEach((k) => used.add(k))
    const point = wall.point ? scene.points.find((p) => p.key === wall.point) : undefined
    if (wall.point) {
      need(
        wall.kind === 'door' && point?.kind === 'door' && !pointUsed.has(wall.point),
        '墙门互动引用无效或重复',
      )
      const center = { x: point.x + 0.5, y: point.y + 0.5 }
      const adjacent =
        wall.a.x === wall.b.x
          ? Math.abs(center.x - wall.a.x) === 0.5 &&
            center.y > Math.min(wall.a.y, wall.b.y) &&
            center.y < Math.max(wall.a.y, wall.b.y)
          : Math.abs(center.y - wall.a.y) === 0.5 &&
            center.x > Math.min(wall.a.x, wall.b.x) &&
            center.x < Math.max(wall.a.x, wall.b.x)
      need(adjacent, `场景 ${scene.key} / 门段 ${wall.key} / 互动点 ${wall.point}：墙门互动点必须紧邻对应门段；端点 ${JSON.stringify(wall.a)}→${JSON.stringify(wall.b)}，格中心 ${JSON.stringify(center)}。法向距离须0.5格且投影严格位于两端之间；修改草稿坐标后重检，不自动移动。`)
      pointUsed.add(wall.point)
    }
    explicit.push({
      id: crypto.randomUUID(),
      name: wall.kind === 'door' ? '结构门' : '结构墙',
      a: wall.a,
      b: wall.b,
      kind: wall.kind,
      state: wall.state,
      pointId: wall.point ? points.get(scene.key + '/' + wall.point)! : null,
      blocksMovement: true,
      blocksSight: true,
      blocksTargeting: true,
      hidden: wall.hidden,
      heightFeet:wall.heightFeet,gapFeet:wall.gapFeet,
      color: '#313b40',
    })
  }
  return [...generated.filter((w) => !edges(w).some((k) => used.has(k))), ...explicit]
}
