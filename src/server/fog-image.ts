import { imageSlot, fogSource } from './fog-image-cache'
import sharp from 'sharp'
import type { MapAsset, MapScene, MapImage } from '../core/map-types'
import type { FogView } from '../persistence/fog-schema'
import { decodeFog } from '../core/fog'
const cache = new Map<string, Promise<MapImage>>()
let cachedBytes = 0
const sizes = new Map<string, number>()
const sourceIds = new WeakMap<Blob, number>()
let nextSourceId = 0
export function fogImageSize(s: MapScene) {
  const width = s.grid.columns * Math.max(64, s.grid.cellPixels ?? 64),
    height = s.grid.rows * Math.max(64, s.grid.cellPixels ?? 64),
    scale = Math.min(1, 2048 / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    rawWidth: width,
    rawHeight: height,
  }
}
/** Output is an actual raster, never an SVG/data URI carrying the original image. */
export async function renderFogImage(
  roomId: string,
  s: MapScene,
  fog: FogView,
  asset: MapAsset,
  options?: { isCurrent?: () => boolean },
): Promise<MapImage> {
  let sourceId=sourceIds.get(asset.blob)
  if(!sourceId){sourceId=++nextSourceId;sourceIds.set(asset.blob,sourceId)}
  const key = roomId + ':' + sourceId + ':' + fog.assetId,
    old = cache.get(key)
  if (old) return old

  const work = imageSlot(async () => {
      if(options?.isCurrent && !options.isCurrent()) throw Error('探索底图版本已变化')
      const size = fogImageSize(s),
        source = await fogSource(roomId,asset),
        b = s.background!,
        cells = decodeFog(fog.explored, fog.columns, fog.rows),
        cell = s.grid.cellPixels ?? 64
      const rects = [...cells]
        .map((c) => {
          const [x, y] = c.split(',').map(Number)
          return `<rect x="${x! * cell + (s.grid.offsetX ?? 0)}" y="${y! * cell + (s.grid.offsetY ?? 0)}" width="${cell}" height="${cell}"/>`
        })
        .join('')
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.rawWidth} ${size.rawHeight}"><defs><clipPath id="known">${rects}</clipPath></defs><rect width="100%" height="100%" fill="#151b20"/><g clip-path="url(#known)"><image href="data:image/png;base64,${source.toString('base64')}" x="${(b.x - s.grid.originX) * 64}" y="${(b.y - s.grid.originY) * 64}" width="${b.width * 64}" height="${b.height * 64}" preserveAspectRatio="none" transform="rotate(${b.rotation} ${(b.x + b.width / 2 - s.grid.originX) * 64} ${(b.y + b.height / 2 - s.grid.originY) * 64})"/></g></svg>`
      const png = await sharp(Buffer.from(svg), { limitInputPixels: 4_194_304 }).png().toBuffer()
      return {
        mime: 'image/png' as const,
        width: size.width,
        height: size.height,
        blob: new Blob([new Uint8Array(png)], { type: 'image/png' }),
      }
  })
  if (cache.size >= 32) { const first=cache.keys().next().value!;cache.delete(first);cachedBytes-=sizes.get(first)??0;sizes.delete(first) }
  cache.set(key, work)
  try {
    const image = await work
    if(cache.get(key)===work&&!sizes.has(key)){sizes.set(key,image.blob.size);cachedBytes+=image.blob.size}
    while(cachedBytes>32*1024*1024){const first=cache.keys().next().value;if(!first)break;cache.delete(first);cachedBytes-=sizes.get(first)??0;sizes.delete(first)}
    return image
  } catch (e) {
    if(cache.get(key)===work){cache.delete(key);cachedBytes-=sizes.get(key)??0;sizes.delete(key)}
    throw e
  }
}
