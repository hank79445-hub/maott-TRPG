import { assertCapacity } from './configuration-limits'
import { MAP_TOTAL_IMAGE_BYTES } from './map-limits'
import { SCRIPT_DOCUMENT_BYTES } from '../persistence/script-schema'
import { zlibSync } from 'fflate'
import type { CompiledAuthoring } from './script-authoring'
import { floorCells } from './script-authoring'
import { scriptAssetMeta } from './script'
import type { MapAsset } from './map-types'
import type { SceneArtRecords } from '../persistence/scene-art-schema'

const u32 = (n: number) => new Uint8Array([n >>> 24, n >>> 16, n >>> 8, n])
function crc(bytes: Uint8Array) {
  let c = 0xffffffff
  for (const b of bytes) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  return (c ^ 0xffffffff) >>> 0
}
function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0))
  let offset = 0
  for (const b of parts) {
    out.set(b, offset)
    offset += b.length
  }
  return out
}
function chunk(type: string, data: Uint8Array) {
  const body = concat([new TextEncoder().encode(type), data])
  return concat([u32(data.length), body, u32(crc(body))])
}
export function rgbPng(width: number, height: number, raw: Uint8Array) {
  const header = concat([u32(width), u32(height), new Uint8Array([8, 2, 0, 0, 0])])
  const bytes = concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlibSync(raw)),
    chunk('IEND', new Uint8Array()),
  ])
  return { width, height, blob: new Blob([bytes], { type: 'image/png' }) }
}
/** Draw only public floor geometry. NPCs, loot, points and prose never reach PNG pixels. */
export function renderFloorPng(scene: CompiledAuthoring['layouts'][number]) {
  const scale = 32,
    width = scene.width * scale,
    height = scene.height * scale,
    floor = floorCells(scene)
  const natural = scene.environment === 'outdoor' || scene.environment === 'mixed'
  const raw = new Uint8Array((width * 3 + 1) * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const walk = floor.has(`${Math.floor(x / scale)},${Math.floor(y / scale)}`)
      const seam = x % scale === 0 || y % scale === 0
      const color = natural
        ? walk
          ? [150, 158, 119]
          : [118, 131, 97]
        : walk
          ? seam
            ? [91, 106, 108]
            : [184, 177, 153]
          : [40, 49, 55]
      raw.set(color, y * (width * 3 + 1) + 1 + x * 3)
    }
  const header = concat([u32(width), u32(height), new Uint8Array([8, 2, 0, 0, 0])])
  const bytes = concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlibSync(raw)),
    chunk('IEND', new Uint8Array()),
  ])
  return { width, height, blob: new Blob([bytes], { type: 'image/png' }) }
}
export function authoringAssets(
  compiled: CompiledAuthoring,
  replacements: Record<string, MapAsset> = {},
  art: SceneArtRecords = {},
) {
  const assets: MapAsset[] = []
  compiled.layouts.forEach((layout, i) => {
    const selected = replacements[layout.key],
      generated = selected ?? renderFloorPng(layout)
    const asset: MapAsset = {
      ...generated,
      id: selected?.id ?? crypto.randomUUID(),
      name: selected?.name ?? layout.name + '·结构地图.png',
      mime: selected?.mime ?? 'image/png',
    }
    assets.push(asset)
    const scene = compiled.definition.scenes[i]!
    scene.background = {
      assetId: asset.id,
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
      rotation: 0,
      clip: true,
      locked: true,
      ...(selected && art[layout.key]?.adopted?.assetId === selected.id
        ? art[layout.key]!.adopted!.transform
        : {}),
    }
    const adopted = art[layout.key]?.adopted
    if (
      selected &&
      adopted?.assetId === selected.id &&
      adopted.calibration === 'pending' &&
      adopted.mode &&
      adopted.mode !== 'precise'
    )
      scene.artCalibration = { status: 'pending', mode: adopted.mode }
    scene.grid.cellPixels = 64
  })
  compiled.definition.assets = assets.map(scriptAssetMeta)
  const imageBytes = assets.reduce((n, a) => n + a.blob.size + (a.preview?.blob.size ?? 0), 0)
  assertCapacity('图片总量（含预览） [assets]', imageBytes, MAP_TOTAL_IMAGE_BYTES)
  const documentBytes = new TextEncoder().encode(JSON.stringify(compiled.definition)).length
  assertCapacity('正式剧本文档 [definition]', documentBytes, SCRIPT_DOCUMENT_BYTES)
  const metric = compiled.capacity.metrics.find((m) => m.path === 'definition')
  if (metric) metric.current = documentBytes
  return assets
}
