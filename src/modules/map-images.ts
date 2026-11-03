import type { MapAsset, MapImage } from '../core/map-types'
import {
  MAP_IMAGE_BYTES,
  MAP_SOURCE_BYTES,
  MAP_IMAGE_PIXELS,
  MAP_IMAGE_EDGE,
  MAP_PREVIEW_BYTES,
  MAP_PREVIEW_EDGE,
  MAP_OPTIMIZED_EDGE,
  MAP_IMAGE_MIMES,
} from '../core/map-limits'

export const fitImage = (width: number, height: number, edge: number) => {
  const scale = Math.min(1, edge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
async function render(
  bitmap: ImageBitmap,
  edge: number,
  quality: number,
  maxBytes: number,
): Promise<MapImage> {
  for (let limit = edge; limit >= Math.min(256, edge); limit = Math.floor(limit / 2)) {
    const size = fitImage(bitmap.width, bitmap.height, limit)
    let blob: Blob
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(size.width, size.height),
        context = canvas.getContext('2d')
      if (!context) throw new Error('浏览器无法生成地图预览')
      context.drawImage(bitmap, 0, 0, size.width, size.height)
      blob = await canvas.convertToBlob({ type: 'image/webp', quality })
      canvas.width = canvas.height = 1
    } else {
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('浏览器无法生成地图预览')
      context.drawImage(bitmap, 0, 0, size.width, size.height)
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('地图图片编码失败'))),
          'image/webp',
          quality,
        ),
      )
      canvas.width = canvas.height = 1
    }
    if (blob.size <= maxBytes && MAP_IMAGE_MIMES.includes(blob.type as MapImage['mime']))
      return { ...size, mime: blob.type as MapImage['mime'], blob }
  }
  throw new Error('图片优化后仍超出容量，请降低原图尺寸后重试')
}
export async function prepareMapImage(
  file: File,
  optimized = false,
  progress: (step: string) => void = () => {},
): Promise<MapAsset> {
  if (!MAP_IMAGE_MIMES.includes(file.type as MapImage['mime']))
    throw new Error('请选择 PNG/JPEG/WebP 图片')
  if (!file.size || file.size > (optimized ? MAP_SOURCE_BYTES : MAP_IMAGE_BYTES))
    throw new Error(
      optimized
        ? '优化导入的源文件最多 100 MB'
        : '保留原图最多 50 MB；更大的文件可选择优化导入（最多 100 MB）',
    )
  progress('读取图片与尺寸')
  await nextFrame()
  // Check common large PNG dimensions before asking the decoder to allocate pixels.
  const header = new Uint8Array(await file.slice(0, 24).arrayBuffer())
  if (
    file.type === 'image/png' &&
    header.length === 24 &&
    Array.from(header.slice(0, 8)).join(',') === '137,80,78,71,13,10,26,10'
  ) {
    const view = new DataView(header.buffer),
      w = view.getUint32(16),
      h = view.getUint32(20)
    if (!w || !h || w * h > MAP_IMAGE_PIXELS || w > MAP_IMAGE_EDGE || h > MAP_IMAGE_EDGE)
      throw new Error('源图片最多 6400 万像素、长边 16000；请分割更大的地图')
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('图片无法解码，请选择有效的地图文件')
  }
  try {
    if (
      bitmap.width * bitmap.height > MAP_IMAGE_PIXELS ||
      bitmap.width > MAP_IMAGE_EDGE ||
      bitmap.height > MAP_IMAGE_EDGE
    )
      throw new Error('源图片最多 6400 万像素、长边 16000；请分割更大的地图')
    let image: MapImage = {
      width: bitmap.width,
      height: bitmap.height,
      mime: file.type as MapImage['mime'],
      blob: file,
    }
    if (optimized) {
      progress('生成优化副本')
      await nextFrame()
      image = await render(bitmap, MAP_OPTIMIZED_EDGE, 0.94, MAP_IMAGE_BYTES)
    }
    let preview: MapImage | undefined
    if (
      Math.max(image.width, image.height) > MAP_PREVIEW_EDGE ||
      image.blob.size > 2 * 1024 * 1024
    ) {
      progress('生成浏览预览')
      await nextFrame()
      preview = await render(
        bitmap,
        Math.min(MAP_PREVIEW_EDGE, Math.max(image.width, image.height)),
        0.9,
        MAP_PREVIEW_BYTES,
      )
    }
    progress('图片处理完成')
    return {
      ...image,
      id: crypto.randomUUID(),
      name: file.name,
      importInfo: {
        sourceName: file.name,
        width: bitmap.width,
        height: bitmap.height,
        bytes: file.size,
        optimized,
      },
      ...(preview ? { preview } : {}),
    }
  } finally {
    bitmap.close()
  }
}
export function previewFits(
  asset: MapAsset | undefined,
  displayWidth: number,
  displayHeight: number,
) {
  return (
    !!asset?.preview &&
    displayWidth <= asset.preview.width * 1.1 &&
    displayHeight <= asset.preview.height * 1.1
  )
}
