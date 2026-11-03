import type { Position } from './map-types'

export function fitImage(
  iw: number,
  ih: number,
  width: number,
  height: number,
  mode: 'cover' | 'contain',
) {
  const factor =
    mode === 'cover' ? Math.max(width / iw, height / ih) : Math.min(width / iw, height / ih)
  const w = iw * factor,
    h = ih * factor
  return {
    x: (width - w) / 2,
    y: (height - h) / 2,
    width: w,
    height: h,
    cropped: mode === 'cover' && (w > width + 0.01 || h > height + 0.01),
  }
}
export function zoomAnchor(
  scroll: Position,
  pointer: Position,
  before: number,
  after: number,
): Position {
  return {
    x: ((scroll.x + pointer.x) * after) / before - pointer.x,
    y: ((scroll.y + pointer.y) * after) / before - pointer.y,
  }
}
export function isRepeatedEndpoint(points: Position[], point: Position) {
  const last = points.at(-1)
  return !!last && last.x === point.x && last.y === point.y
}
