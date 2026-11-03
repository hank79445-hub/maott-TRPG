import type { SceneArtDocument } from './scene-art-projection'
import { rgbPng } from './authoring-map-image'
/** Only whitelist geometry enters here. No editor DOM, gameplay points or tokens. */
export function renderSceneArt(doc: SceneArtDocument, grid = false) {
  const { pixelWidth: width, pixelHeight: height, columns, rows } = doc.canvas
  const cell = width / columns,
    raw = new Uint8Array((width * 3 + 1) * height)
  const natural = doc.environment === 'outdoor' || doc.environment === 'mixed'
  const floor = new Set(doc.geometry.floor),
    high = new Set(doc.geometry.terrain.flatMap((r) => (r.tags.includes('high') ? r.cells : [])))
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`
      const color =
        grid && (x % cell === 0 || y % cell === 0)
          ? [127, 142, 146]
          : floor.has(k)
            ? high.has(k)
              ? [187, 179, 150]
              : natural
                ? [150, 158, 119]
                : [221, 219, 209]
            : natural
              ? [105, 119, 88]
              : [49, 59, 64]
      raw.set(color, y * (width * 3 + 1) + 1 + x * 3)
    }
  for (const w of doc.geometry.walls) {
    if (!grid && w.kind === 'door' && (doc.policy.doorArtwork ?? 'hidden') === 'hidden') continue
    if (w.open) continue
    const ax = w.a.x * cell,
      ay = w.a.y * cell,
      bx = w.b.x * cell,
      by = w.b.y * cell
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))))
    for (let i = 0; i <= steps; i++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = Math.round(ax + ((bx - ax) * i) / steps) + dx,
            y = Math.round(ay + ((by - ay) * i) / steps) + dy
          if (x >= 0 && x < width && y >= 0 && y < height)
            raw.set(
              w.kind === 'door'
                ? !grid && doc.policy.doorArtwork === 'subtle'
                  ? [181, 174, 155]
                  : [155, 100, 66]
                : [40, 49, 55],
              y * (width * 3 + 1) + 1 + x * 3,
            )
        }
  }
  // Muted blocks are explicit visual-object footprints, never inferred from gameplay kinds.
  for (const [index, object] of doc.geometry.objects.entries()) {
    if (
      !grid &&
      doc.doorObjectIndexes?.includes(index) &&
      (doc.policy.doorArtwork ?? 'hidden') !== 'full'
    )
      continue
    const left = object.x * cell,
      top = object.y * cell
    for (let y = Math.max(0, top); y < Math.min(height, top + object.height * cell); y++)
      for (let x = Math.max(0, left); x < Math.min(width, left + object.width * cell); x++) {
        const border =
          x - left < 2 ||
          y - top < 2 ||
          left + object.width * cell - x <= 2 ||
          top + object.height * cell - y <= 2
        raw.set(border ? [106, 74, 43] : [188, 155, 104], y * (width * 3 + 1) + 1 + x * 3)
      }
  }
  if (rows * cell !== height) throw Error('参考图比例无效')
  return rgbPng(width, height, raw)
}
