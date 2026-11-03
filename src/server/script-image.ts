import { open } from 'node:fs/promises'
import { RoomError } from './room-engine'
import { MAP_IMAGE_EDGE, MAP_IMAGE_PIXELS } from '../core/map-limits'
import { crc32 } from 'node:zlib'

/** Read geometry without allocating the full image or decoding a 64M-pixel bitmap. */
export async function imageGeometry(file: string, mime: string, bytes: number) {
  const handle = await open(file, 'r')
  try {
    const read = async (offset: number, size: number) => {
      if (offset < 0 || size < 1 || offset + size > bytes) throw new RoomError('图片文件不完整')
      const buffer = Buffer.alloc(size)
      if ((await handle.read(buffer, 0, size, offset)).bytesRead !== size)
        throw new RoomError('图片文件不完整')
      return buffer
    }
    const head = await read(0, Math.min(bytes, 30))
    let width = 0,
      height = 0
    if (mime === 'image/png') {
      if (
        head.length < 24 ||
        !head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        head.toString('ascii', 12, 16) !== 'IHDR' ||
        head.readUInt32BE(8) !== 13
      )
        throw new RoomError('图片不是有效 PNG')
      width = head.readUInt32BE(16)
      height = head.readUInt32BE(20)
      let offset = 8,
        ended = false,
        imageData = false
      for (let count = 0; count < 100000 && offset + 12 <= bytes; count++) {
        const header = await read(offset, 8),
          size = header.readUInt32BE(0),
          kind = header.toString('ascii', 4, 8)
        if (offset + size + 12 > bytes || !/^[A-Za-z]{4}$/.test(kind))
          throw new RoomError('PNG 数据块损坏')
        let crc = crc32(header.subarray(4))
        for (let i = 0; i < size; i += 65536)
          crc = crc32(await read(offset + 8 + i, Math.min(65536, size - i)), crc)
        if (crc !== (await read(offset + 8 + size, 4)).readUInt32BE(0))
          throw new RoomError('PNG 数据块校验失败')
        imageData ||= kind === 'IDAT' && size > 0
        offset += size + 12
        if (kind === 'IEND') {
          ended = size === 0 && offset === bytes
          break
        }
      }
      if (!ended || !imageData) throw new RoomError('PNG 文件不完整或包含尾随数据')
    } else if (mime === 'image/jpeg') {
      if (head[0] !== 255 || head[1] !== 216) throw new RoomError('图片不是有效 JPEG')
      if (!(await read(bytes - 2, 2)).equals(Buffer.from([255, 217])))
        throw new RoomError('JPEG 文件不完整')
      let offset = 2
      for (let count = 0; count < 4096 && offset + 4 <= bytes; count++) {
        let marker = await read(offset++, 1)
        if (marker[0] !== 255) throw new RoomError('JPEG 标记损坏')
        do {
          marker = await read(offset++, 1)
        } while (marker[0] === 255)
        const code = marker[0]!
        if (code === 217 || code === 218) break
        if (code === 1 || (code >= 208 && code <= 215)) continue
        const size = (await read(offset, 2)).readUInt16BE(0)
        if (size < 2 || offset + size > bytes) throw new RoomError('JPEG 文件不完整')
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(code)) {
          if (size < 8) throw new RoomError('JPEG 尺寸记录损坏')
          const data = await read(offset + 2, 5)
          height = data.readUInt16BE(1)
          width = data.readUInt16BE(3)
          break
        }
        offset += size
      }
    } else if (mime === 'image/webp') {
      if (
        head.length < 20 ||
        head.toString('ascii', 0, 4) !== 'RIFF' ||
        head.toString('ascii', 8, 12) !== 'WEBP' ||
        head.readUInt32LE(4) + 8 !== bytes
      )
        throw new RoomError('图片不是有效 WebP')
      const kind = head.toString('ascii', 12, 16)
      if (kind === 'VP8X' && head.length >= 30) {
        width = head.readUIntLE(24, 3) + 1
        height = head.readUIntLE(27, 3) + 1
      } else if (kind === 'VP8L' && head.length >= 25 && head[20] === 47) {
        const bits = head.readUInt32LE(21)
        width = (bits & 16383) + 1
        height = ((bits >>> 14) & 16383) + 1
      } else if (
        kind === 'VP8 ' &&
        head.length >= 30 &&
        head.subarray(23, 26).equals(Buffer.from([157, 1, 42]))
      ) {
        width = head.readUInt16LE(26) & 16383
        height = head.readUInt16LE(28) & 16383
      }
    } else throw new RoomError('只支持 PNG/JPEG/WebP', 415)
    if (
      !width ||
      !height ||
      width > MAP_IMAGE_EDGE ||
      height > MAP_IMAGE_EDGE ||
      width * height > MAP_IMAGE_PIXELS
    )
      throw new RoomError('图片尺寸无效或超过 16000 像素长边／6400 万像素限制')
    return { width, height }
  } finally {
    await handle.close()
  }
}
