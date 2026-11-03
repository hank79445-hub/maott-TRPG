import { PORTRAIT_MAX_LENGTH } from '../core/types'
import { isSafePortrait } from '../core/portraits'

export async function preparePortrait(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)
    throw new Error('请选择不超过 5 MB 的 JPG、PNG 或 WebP 图片')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理这张头像图片')
    context.fillStyle = '#fffefa'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    let data = canvas.toDataURL('image/jpeg', 0.85)
    if (data.length > PORTRAIT_MAX_LENGTH) data = canvas.toDataURL('image/jpeg', 0.6)
    if (!isSafePortrait(data)) throw new Error('头像压缩后仍过大，请选择较小的图片')
    return data
  } finally {
    bitmap.close()
  }
}
