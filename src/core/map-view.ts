import type { MapScene, Position } from './map-types'

export const MAP_CELL_SIZE = 64
export const gridSize = (grid: MapScene['grid']) => grid.cellPixels ?? MAP_CELL_SIZE
export const gridOffset = (grid: MapScene['grid']) => ({
  x: grid.offsetX ?? 0,
  y: grid.offsetY ?? 0,
})
export function cellAtPixel(grid: MapScene['grid'], pixel: Position): Position | null {
  const offset = gridOffset(grid)
  const cell = {
    x: Math.floor((pixel.x - offset.x) / gridSize(grid)),
    y: Math.floor((pixel.y - offset.y) / gridSize(grid)),
  }
  return Number.isFinite(cell.x) &&
    Number.isFinite(cell.y) &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < grid.columns &&
    cell.y < grid.rows
    ? cell
    : null
}
export function cellCenter(grid: MapScene['grid'], cell: Position): Position {
  const offset = gridOffset(grid)
  return {
    x: (cell.x + 0.5) * gridSize(grid) + offset.x,
    y: (cell.y + 0.5) * gridSize(grid) + offset.y,
  }
}
