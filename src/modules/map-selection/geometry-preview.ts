import type { SceneGeometry } from '../../persistence/scene-effects-schema'
import type { MapScene } from '../../core/map-types'
import { geometryContains } from '../../core/scene-effect-geometry'
import { shapeContains } from '../../core/map-area'
export type PreviewGeometry = SceneGeometry | (Omit<SceneGeometry, 'shape'> & { shape: 'cone' })
/** Conservative bounds only prune impossible cells; the original predicate decides coverage. */
export function geometryPreviewCells(g: PreviewGeometry, grid: MapScene['grid']) {
  const cells: { x: number; y: number }[] = [],
    radius =
      (g.shape === 'cube' || g.shape === 'square' ? g.size / Math.SQRT2 : g.size + g.width / 2) /
        grid.feet +
      g.originSpan +
      1,
    c = { x: g.x + g.originSpan / 2, y: g.y + g.originSpan / 2 },
    pad = g.width / grid.feet / 2 + 1
  const ps = g.shape === 'wall' && g.points?.length ? g.points : undefined
  const minX = Math.max(0, Math.floor(ps ? Math.min(...ps.map((p) => p.x)) - pad : c.x - radius)),
    maxX = Math.min(
      grid.columns - 1,
      Math.ceil(ps ? Math.max(...ps.map((p) => p.x)) + pad : c.x + radius),
    ),
    minY = Math.max(0, Math.floor(ps ? Math.min(...ps.map((p) => p.y)) - pad : c.y - radius)),
    maxY = Math.min(
      grid.rows - 1,
      Math.ceil(ps ? Math.max(...ps.map((p) => p.y)) + pad : c.y + radius),
    )
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++)
      if (
        g.shape === 'cone'
          ? shapeContains(grid, { ...g, shape: 'cone', origin: { x: c.x, y: c.y } }, { x, y })
          : geometryContains(g, { x: x + 0.5, y: y + 0.5, height: g.height }, grid.feet)
      )
        cells.push({ x, y })
  return cells
}
