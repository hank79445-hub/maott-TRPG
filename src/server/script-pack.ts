import { assertCalibrationReady } from '../core/scene-art-state'
import { openAsBlob, createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, statfs } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { crc32 } from 'node:zlib'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import * as yauzl from 'yauzl'
import * as yazl from 'yazl'
import { inspectScript } from '../core/script'
import { SCRIPT_DOCUMENT_BYTES, type ScriptDefinition } from '../persistence/script-schema'
import { MAP_IMAGE_BYTES, MAP_PREVIEW_BYTES, MAP_TOTAL_IMAGE_BYTES } from '../core/map-limits'
import type { MapAsset } from '../core/map-types'
import type { SitePrincipal } from './access-config'
import { RoomError } from './room-engine'
import { imageGeometry } from './script-image'

export const SCRIPT_ZIP_BYTES = SCRIPT_DOCUMENT_BYTES + MAP_TOTAL_IMAGE_BYTES + 1024 * 1024
const lifetime = 30 * 60 * 1000
const assetPath = (index: number, preview = false) =>
  `assets/${index}${preview ? '-preview' : ''}.bin`

/** Names are positional: author supplied IDs and labels never become filesystem paths. */
export function exportScriptPack(definition: ScriptDefinition, assets: MapAsset[]) {
  assertCalibrationReady(definition.scenes)
  const zip = new yazl.ZipFile()
  zip.addBuffer(Buffer.from(JSON.stringify(definition)), 'manifest.json', { compress: true })
  for (const [index, meta] of definition.assets.entries()) {
    const asset = assets.find((a) => a.id === meta.id)
    if (!asset) throw new RoomError('缺少导出图片')
    zip.addReadStreamLazy(assetPath(index), { compress: false, size: meta.bytes }, (cb) =>
      cb(null, Readable.fromWeb(asset.blob.stream() as import('node:stream/web').ReadableStream)),
    )
    if (asset.preview && meta.preview)
      zip.addReadStreamLazy(
        assetPath(index, true),
        { compress: false, size: meta.preview.bytes },
        (cb) =>
          cb(
            null,
            Readable.fromWeb(
              asset.preview!.blob.stream() as import('node:stream/web').ReadableStream,
            ),
          ),
      )
  }
  zip.on('error', (error) => (zip.outputStream as Readable).destroy(error))
  zip.end()
  return zip.outputStream as Readable
}

export async function readScriptPack(filename: string, directory: string) {
  const zip = await yauzl.openPromise(filename, {
    lazyEntries: true,
    autoClose: false,
    strictFileNames: true,
    validateEntrySizes: true,
  })
  const files = new Map<string, string>()
  let expanded = 0
  try {
    if (zip.entryCount > 201) throw new RoomError('剧本包文件数量超限', 413)
    for await (const entry of zip.eachEntry()) {
      const name = entry.fileName
      if (
        !/^(manifest\.json|assets\/\d{1,3}(?:-preview)?\.bin)$/.test(name) ||
        files.has(name) ||
        entry.isEncrypted() ||
        ![0, 8].includes(entry.compressionMethod) ||
        ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000
      )
        throw new RoomError('剧本包路径、文件类型或重复条目不合法')
      const limit =
        name === 'manifest.json'
          ? SCRIPT_DOCUMENT_BYTES
          : name.includes('-preview')
            ? MAP_PREVIEW_BYTES
            : MAP_IMAGE_BYTES
      expanded += entry.uncompressedSize
      if (
        !Number.isSafeInteger(entry.uncompressedSize) ||
        entry.uncompressedSize < 1 ||
        entry.uncompressedSize > limit ||
        expanded > SCRIPT_DOCUMENT_BYTES + MAP_TOTAL_IMAGE_BYTES
      )
        throw new RoomError('剧本包解压资源超过限制', 413)
      const target = path.join(directory, randomUUID() + '.bin')
      let bytes = 0,
        crc = 0
      await pipeline(
        await zip.openReadStreamPromise(entry),
        new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length
            if (bytes > limit || bytes > entry.uncompressedSize)
              return callback(new RoomError('剧本包解压大小不一致', 413))
            crc = crc32(chunk, crc)
            callback(null, chunk)
          },
        }),
        createWriteStream(target, { flags: 'wx', mode: 0o600 }),
      )
      if (bytes !== entry.uncompressedSize || crc !== entry.crc32)
        throw new RoomError('剧本包文件校验失败')
      files.set(name, target)
    }
    const manifest = files.get('manifest.json')
    if (!manifest) throw new RoomError('剧本包缺少清单')
    const parsed = inspectScript(JSON.parse(await readFile(manifest, 'utf8')))
    const expected = new Set(['manifest.json'])
    const assets: MapAsset[] = []
    for (const [index, meta] of parsed.definition.assets.entries()) {
      async function image(preview = false) {
        const name = assetPath(index, preview),
          file = files.get(name)
        expected.add(name)
        if (!file) throw new RoomError('剧本包缺少引用图片')
        const m = preview ? meta.preview! : meta
        const blob = await openAsBlob(file, { type: m.mime })
        if (blob.size !== m.bytes) throw new RoomError('图片大小与清单不一致')
        const geometry = await imageGeometry(file, m.mime, m.bytes)
        if (geometry.width !== m.width || geometry.height !== m.height)
          throw new RoomError('图片尺寸与清单不一致')
        return { mime: m.mime, width: m.width, height: m.height, blob }
      }
      assets.push({
        id: meta.id,
        name: meta.name,
        ...(await image()),
        ...(meta.preview ? { preview: await image(true) } : {}),
      })
    }
    if (files.size !== expected.size || [...files.keys()].some((n) => !expected.has(n)))
      throw new RoomError('剧本包包含未声明文件')
    return { ...parsed, assets }
  } finally {
    zip.close()
  }
}

/** Preview is private, bounded, short lived and does not write a library entry. */
export class ScriptImportStages {
  private stages = new Map<
    string,
    {
      owner: string
      expires: number
      directory: string
      data?: Awaited<ReturnType<typeof readScriptPack>>
    }
  >()
  constructor(
    private root: string,
    private minimumFreeBytes = 512 * 1024 ** 2,
  ) {}
  async init() {
    await mkdir(this.root, { recursive: true })
    // A fresh process cannot authorize old tokens. Only this dedicated staging tree is removed.
    const { readdir } = await import('node:fs/promises')
    for (const name of await readdir(this.root))
      if (/^import-[A-Za-z0-9]+$/.test(name)) await this.clear(path.join(this.root, name))
    const cleanup = setInterval(() => {
      void this.expire().catch(() => {})
    }, 60000)
    cleanup.unref()
  }
  private async clear(directory: string) {
    if (
      path.dirname(path.resolve(directory)) !== path.resolve(this.root) ||
      !path.basename(directory).startsWith('import-')
    )
      throw Error('导入临时路径不合法')
    await rm(directory, { recursive: true, force: true })
  }
  private async expire() {
    for (const [token, stage] of this.stages)
      if (stage.expires < Date.now()) {
        this.stages.delete(token)
        await this.clear(stage.directory)
      }
  }
  async preview(principal: SitePrincipal, source: AsyncIterable<Uint8Array>) {
    await this.expire()
    if (
      this.stages.size >= 4 ||
      [...this.stages.values()].filter((s) => s.owner === principal.accountId).length >= 2
    )
      throw new RoomError('同时导入的剧本过多，请关闭旧预览或稍后再试', 429)
    const disk = await statfs(this.root)
    if (Number(disk.bavail) * Number(disk.bsize) < this.minimumFreeBytes + SCRIPT_ZIP_BYTES * 2)
      throw new RoomError('导入临时空间不足', 413)
    const token = randomUUID(),
      directory = await mkdtemp(path.join(this.root, 'import-'))
    const stage = {
      owner: principal.accountId,
      directory,
      expires: Date.now() + lifetime,
      data: undefined as Awaited<ReturnType<typeof readScriptPack>> | undefined,
    }
    this.stages.set(token, stage)
    try {
      let bytes = 0
      const filename = path.join(directory, 'package.zip')
      await pipeline(
        Readable.from(source),
        new Transform({
          transform(chunk: Buffer, _e, cb) {
            bytes += chunk.length
            cb(bytes > SCRIPT_ZIP_BYTES ? new RoomError('剧本 ZIP 超过大小限制', 413) : null, chunk)
          },
        }),
        createWriteStream(filename, { flags: 'wx', mode: 0o600 }),
      )
      stage.data = await readScriptPack(filename, directory)
      return {
        token,
        expiresAt: new Date(stage.expires).toISOString(),
        definition: stage.data.definition,
        ready: stage.data.ready,
        missingDependencies: stage.data.missingDependencies,
      }
    } catch (error) {
      await this.cancel(principal, token)
      throw new RoomError(error instanceof Error ? error.message : '剧本 ZIP 无法读取')
    }
  }
  async take(principal: SitePrincipal, token: string) {
    await this.expire()
    const stage = this.stages.get(token)
    if (!stage?.data || stage.owner !== principal.accountId)
      throw new RoomError('导入预览不存在或已过期', 404)
    // Consume once, including on a failed commit; caller cleans up after awaiting persistence.
    this.stages.delete(token)
    return { ...stage.data, cleanup: () => this.clear(stage.directory) }
  }
  async cancel(principal: SitePrincipal, token: string) {
    const stage = this.stages.get(token)
    if (!stage || stage.owner !== principal.accountId) throw new RoomError('导入预览不存在', 404)
    this.stages.delete(token)
    await this.clear(stage.directory)
  }
}
