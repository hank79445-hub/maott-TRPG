import { NPC_LIMIT } from '../core/configuration-limits'
import { randomUUID, createHash } from 'node:crypto'
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  unlink,
  stat,
  statfs,
  open,
} from 'node:fs/promises'
import { createReadStream, createWriteStream, openAsBlob } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { z, ZodError } from 'zod'
import { accountIdSchema, type SitePrincipal } from './access-config'
import { RoomError } from './room-engine'
import { inspectScript, newScript, scriptAssetMeta } from '../core/script'
import {
  scriptAssetSchema,
  SCRIPT_DOCUMENT_BYTES,
  type ScriptDefinition,
  type ScriptAsset,
} from '../persistence/script-schema'
import type { MapAsset } from '../core/map-types'
import {
  MAP_IMAGE_BYTES,
  MAP_PREVIEW_BYTES,
  MAP_TOTAL_IMAGE_BYTES,
  MAP_IMAGE_MIMES,
} from '../core/map-limits'
import { imageGeometry } from './script-image'
import { sceneArtRecordsSchema, type SceneArtRecords } from '../persistence/scene-art-schema'
import { assertArtReady } from '../core/scene-art-state'
function checkedArt(art: unknown, definition: ScriptDefinition) {
  const result = sceneArtRecordsSchema.parse(art ?? {})
  if (Object.keys(result).some((id) => !definition.scenes.some((s) => s.id === id)))
    throw new RoomError('生图场景引用不存在')
  return result
}

const digest = z.string().regex(/^[a-f0-9]{64}$/),
  timestamp = z.string().datetime()
const documentSchema = z
  .object({
    file: z.string().uuid(),
    bytes: z.number().int().positive().max(SCRIPT_DOCUMENT_BYTES),
  })
  .strict()
const assetRecordSchema = z
  .object({ metadata: scriptAssetSchema, hash: digest, previewHash: digest.optional() })
  .strict()
  .refine((a) => !!a.metadata.preview === !!a.previewHash)
const versionSchema = z
  .object({
    id: z.string().uuid(),
    authorVersion: z.string().min(1).max(80),
    createdAt: timestamp,
    document: documentSchema,
  })
  .strict()
const entrySchema = z
  .object({
    id: z.string().uuid(),
    ownerId: accountIdSchema,
    revision: z.number().int().nonnegative(),
    name: z.string().min(1).max(120),
    authorVersion: z.string().min(1).max(80),
    sceneCount: z.number().int().min(1).max(30),
    npcCount: z.number().int().min(0).max(NPC_LIMIT),
    createdAt: timestamp,
    updatedAt: timestamp,
    trashedAt: timestamp.nullable(),
    draft: documentSchema,
    versions: z.array(versionSchema).max(500),
    assets: z.array(assetRecordSchema).max(100),
  })
  .strict()
const indexSchema = z
  .object({ version: z.literal(1), entries: z.array(entrySchema).max(1000) })
  .strict()
type Index = z.infer<typeof indexSchema>
type Entry = z.infer<typeof entrySchema>
type Document = z.infer<typeof documentSchema>
type AssetRecord = z.infer<typeof assetRecordSchema>
export interface ScriptLimits {
  accountBytes: number
  totalBytes: number
  minimumFreeBytes: number
  scriptsPerAccount: number
}
export const defaultScriptLimits: ScriptLimits = {
  accountBytes: 2 * 1024 ** 3,
  totalBytes: 10 * 1024 ** 3,
  minimumFreeBytes: 512 * 1024 ** 2,
  scriptsPerAccount: 100,
}
const trashLifetime = 30 * 24 * 60 * 60 * 1000
function checked(input: unknown) {
  try {
    return inspectScript(input)
  } catch (error) {
    if (error instanceof ZodError || error instanceof RoomError) throw error
    throw new RoomError(error instanceof Error ? error.message : '剧本校验失败')
  }
}

/** One process, serialized catalog commits; immutable objects allow safe crash recovery. */
export class ScriptLibrary {
  private state: Index = { version: 1, entries: [] }
  private queue: Promise<unknown> = Promise.resolve()
  readonly directory: string
  readonly limits: ScriptLimits
  constructor(
    directory: string,
    limits: Partial<ScriptLimits> = {},
    private clock = () => Date.now(),
  ) {
    this.directory = path.resolve(directory)
    this.limits = { ...defaultScriptLimits, ...limits }
    if (
      Object.values(this.limits).some((n) => !Number.isSafeInteger(n) || n < 1) ||
      this.limits.scriptsPerAccount > 1000
    )
      throw Error('剧本库配额配置无效')
  }
  private now() {
    return new Date(this.clock()).toISOString()
  }
  private objectFile(id: string) {
    z.string().uuid().parse(id)
    return path.join(this.directory, 'objects', id + '.json')
  }
  private imageFile(hash: string) {
    digest.parse(hash)
    return path.join(this.directory, 'images', hash + '.bin')
  }
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue
      .catch(() => {})
      .then(async () => {
        await this.expireTrash()
        return fn()
      })
    this.queue = result
    return result
  }
  private entry(
    principal: SitePrincipal,
    id: string,
    includeTrash = false,
    state = this.state,
  ): Entry {
    accountIdSchema.parse(principal.accountId)
    const entry = state.entries.find((e) => e.id === id && e.ownerId === principal.accountId)
    if (
      !entry ||
      (!includeTrash && entry.trashedAt) ||
      (entry.trashedAt && this.clock() - Date.parse(entry.trashedAt) >= trashLifetime)
    )
      throw new RoomError('剧本不存在或不可访问', 404)
    return entry
  }
  private revision(entry: Entry, expected: number) {
    if (!Number.isSafeInteger(expected) || entry.revision !== expected)
      throw new RoomError('剧本已被另一设备修改，请重新加载或另存副本', 409)
  }
  private changed(entry: Entry) {
    entry.revision++
    entry.updatedAt = this.now()
  }
  private async readDocument(document: Document) {
    const file = this.objectFile(document.file),
      info = await stat(file)
    if (!info.isFile() || info.size !== document.bytes || info.size > SCRIPT_DOCUMENT_BYTES)
      throw Error('剧本内容文件大小不一致')
    const raw = JSON.parse(await readFile(file, 'utf8'))
    if (raw?.format === 'trpg-library-document') {
      const wrapped = z
        .object({
          format: z.literal('trpg-library-document'),
          version: z.literal(1),
          definition: z.unknown(),
          art: sceneArtRecordsSchema,
        })
        .strict()
        .parse(raw)
      const parsed = inspectScript(wrapped.definition)
      return { ...parsed, art: checkedArt(wrapped.art, parsed.definition) }
    }
    return { ...inspectScript(raw), art: {} as SceneArtRecords }
  }
  private async writeDocument(
    definition: ScriptDefinition,
    art: SceneArtRecords = {},
  ): Promise<Document> {
    const content = JSON.stringify(
        Object.keys(art).length
          ? { format: 'trpg-library-document', version: 1, definition, art }
          : definition,
      ),
      bytes = Buffer.byteLength(content)
    if (bytes > SCRIPT_DOCUMENT_BYTES)
      throw new RoomError('剧本配置超过 16 MB，请精简自定义内容', 413)
    await this.diskSpace(bytes)
    const file = randomUUID()
    await writeFile(this.objectFile(file), content, { mode: 0o600, flag: 'wx' })
    return { file, bytes }
  }
  private referenced(state: Index, ownerId?: string) {
    const objects = new Map<string, number>(),
      images = new Map<string, number>()
    for (const e of state.entries.filter((e) => !ownerId || e.ownerId === ownerId)) {
      for (const d of [e.draft, ...e.versions.map((v) => v.document)]) objects.set(d.file, d.bytes)
      for (const a of e.assets) {
        images.set(a.hash, a.metadata.bytes)
        if (a.previewHash) images.set(a.previewHash, a.metadata.preview!.bytes)
      }
    }
    return { objects, images }
  }
  private used(state: Index, ownerId?: string) {
    const refs = this.referenced(state, ownerId)
    return (
      [...refs.objects.values(), ...refs.images.values()].reduce((a, b) => a + b, 0) +
      Buffer.byteLength(
        JSON.stringify(state.entries.filter((e) => !ownerId || e.ownerId === ownerId)),
      )
    )
  }
  private checkQuota(state: Index) {
    for (const id of new Set(state.entries.map((e) => e.ownerId))) {
      if (
        this.used(state, id) > this.limits.accountBytes &&
        this.used(state, id) > this.used(this.state, id)
      )
        throw new RoomError('个人剧本库空间不足，请清理旧版本或回收站', 413)
      if (
        state.entries.filter((e) => e.ownerId === id).length > this.limits.scriptsPerAccount &&
        state.entries.filter((e) => e.ownerId === id).length >
          this.state.entries.filter((e) => e.ownerId === id).length
      )
        throw new RoomError('个人剧本数量已达上限，回收站也计入数量', 413)
    }
    if (this.used(state) > this.limits.totalBytes && this.used(state) > this.used(this.state))
      throw new RoomError('服务端剧本库空间不足，请联系管理员', 507)
  }
  private async diskSpace(bytes: number) {
    const info = await statfs(this.directory)
    if (info.bavail * info.bsize < this.limits.minimumFreeBytes + bytes)
      throw new RoomError('服务器磁盘可用空间不足，原版本已保留', 507)
  }
  private async cleanup() {
    const refs = this.referenced(this.state)
    for (const [folder, pattern, expected] of [
      [
        'objects',
        /^[a-f0-9-]{36}\.json$/,
        new Set([...refs.objects.keys()].map((id) => id + '.json')),
      ],
      ['images', /^[a-f0-9]{64}\.bin$/, new Set([...refs.images.keys()].map((id) => id + '.bin'))],
      ['temporary', /^[a-f0-9-]{36}\.tmp$/, new Set<string>()],
    ] as const)
      for (const file of await readdir(path.join(this.directory, folder)))
        if (pattern.test(file) && !expected.has(file))
          await unlink(path.join(this.directory, folder, file))
  }
  private async commit(next: Index) {
    indexSchema.parse(next)
    this.checkQuota(next)
    const text = JSON.stringify(next)
    if (Buffer.byteLength(text) > SCRIPT_DOCUMENT_BYTES)
      throw new RoomError('剧本库索引达到上限', 413)
    await this.diskSpace(Buffer.byteLength(text))
    const temporary = path.join(this.directory, 'index.' + randomUUID() + '.tmp')
    try {
      await writeFile(temporary, text, { mode: 0o600, flag: 'wx' })
      await rename(temporary, path.join(this.directory, 'index.json'))
    } catch (error) {
      await unlink(temporary).catch(() => {})
      throw error
    }
    this.state = next
    // A committed save must not be reported as failed just because garbage collection is delayed.
    await this.cleanup().catch(() => {})
  }
  private async expireTrash() {
    const next = structuredClone(this.state)
    next.entries = next.entries.filter(
      (e) => !e.trashedAt || this.clock() - Date.parse(e.trashedAt) < trashLifetime,
    )
    if (next.entries.length !== this.state.entries.length) await this.commit(next)
  }
  async init() {
    for (const folder of ['', 'objects', 'images', 'temporary'])
      await mkdir(path.join(this.directory, folder), { recursive: true, mode: 0o700 })
    try {
      const filename = path.join(this.directory, 'index.json'),
        info = await stat(filename)
      if (!info.isFile() || info.size > SCRIPT_DOCUMENT_BYTES) throw Error('剧本索引无效')
      this.state = indexSchema.parse(JSON.parse(await readFile(filename, 'utf8')))
      if (new Set(this.state.entries.map((e) => e.id)).size !== this.state.entries.length)
        throw Error('剧本 ID 重复')
      for (const e of this.state.entries) {
        if (
          new Set(e.versions.map((v) => v.id)).size !== e.versions.length ||
          new Set(e.assets.map((a) => a.metadata.id)).size !== e.assets.length
        )
          throw Error('剧本版本或图片 ID 重复')
        for (const document of [e.draft, ...e.versions.map((v) => v.document)]) {
          const parsed = await this.readDocument(document)
          this.checkAssets(e, parsed.definition)
        }
      }
      for (const [hash, bytes] of this.referenced(this.state).images) {
        const file = this.imageFile(hash),
          info = await stat(file)
        if (!info.isFile() || info.size !== bytes) throw Error('剧本图片文件大小不一致')
        const actual = createHash('sha256')
        for await (const chunk of createReadStream(file)) actual.update(chunk)
        if (actual.digest('hex') !== hash) throw Error('剧本图片摘要校验失败')
      }
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'ENOENT' ||
        (error as NodeJS.ErrnoException).path !== path.join(this.directory, 'index.json')
      )
        throw error
      // A lost catalog must never be mistaken for a new empty library and trigger image deletion.
      if (
        (await readdir(path.join(this.directory, 'objects'))).length ||
        (await readdir(path.join(this.directory, 'images'))).length
      )
        throw Error('剧本索引缺失但资源仍存在，请恢复索引备份；未清理任何原资源')
    }
    await this.expireTrash()
    await this.cleanup()
  }
  private checkAssets(entry: Entry, definition: ScriptDefinition) {
    for (const metadata of definition.assets) {
      const stored = entry.assets.find((a) => a.metadata.id === metadata.id)
      if (!stored || JSON.stringify(stored.metadata) !== JSON.stringify(metadata))
        throw new RoomError('缺少剧本图片或图片元数据不一致')
    }
  }
  private summary(entry: Entry) {
    const { ownerId: _owner, draft: _draft, assets: _assets, ...summary } = entry
    return {
      ...summary,
      versions: entry.versions.map(({ document: _d, ...version }) => version),
      assetCount: entry.assets.length,
    }
  }
  async list(principal: SitePrincipal, trash = false) {
    return this.run(async () => {
      const scripts = []
      for (const e of this.state.entries.filter(
        (e) => e.ownerId === principal.accountId && !!e.trashedAt === trash,
      )) {
        const checked = await this.readDocument(e.draft)
        scripts.push({
          ...this.summary(e),
          ready: checked.ready,
          missingDependencies: checked.missingDependencies,
        })
      }
      return { scripts, usage: this.usage(principal) }
    })
  }
  private usage(principal: SitePrincipal) {
    return {
      usedBytes: this.used(this.state, principal.accountId),
      limitBytes: this.limits.accountBytes,
      count: this.state.entries.filter((e) => e.ownerId === principal.accountId).length,
      countLimit: this.limits.scriptsPerAccount,
      includesTrash: true,
    }
  }
  async get(principal: SitePrincipal, id: string, versionId?: string) {
    return this.run(async () => {
      const entry = this.entry(principal, id, true),
        version = versionId ? entry.versions.find((v) => v.id === versionId) : undefined
      if (versionId && !version) throw new RoomError('剧本版本不存在', 404)
      const parsed = await this.readDocument(version?.document ?? entry.draft)
      return {
        ...this.summary(entry),
        ...parsed,
        assets: entry.assets.map((a) => a.metadata),
        usage: this.usage(principal),
      }
    })
  }
  async create(
    principal: SitePrincipal,
    input: unknown = newScript(),
    assets: MapAsset[] = [],
    art: SceneArtRecords = {},
  ) {
    return this.run(async () => {
      accountIdSchema.parse(principal.accountId)
      await this.expireTrash()
      const { definition } = checked(input),
        at = this.now()
      const entry: Entry = {
        id: randomUUID(),
        ownerId: principal.accountId,
        revision: 0,
        name: definition.metadata.name,
        authorVersion: definition.metadata.authorVersion,
        sceneCount: definition.scenes.length,
        npcCount: definition.npcs.length,
        createdAt: at,
        updatedAt: at,
        trashedAt: null,
        draft: { file: randomUUID(), bytes: 1 },
        versions: [],
        assets: [],
      }
      try {
        if (assets.length > 100) throw new RoomError('剧本图片超过 100 张', 413)
        for (const a of assets.filter((a) => definition.assets.some((m) => m.id === a.id)))
          entry.assets.push(await this.storeAsset(a))
        if (new Set(entry.assets.map((a) => a.metadata.id)).size !== entry.assets.length)
          throw new RoomError('图片 ID 重复')
        this.checkAssets(entry, definition)
        entry.draft = await this.writeDocument(definition, checkedArt(art, definition))
        const next = structuredClone(this.state)
        next.entries.push(entry)
        await this.commit(next)
      } catch (error) {
        await this.cleanup().catch(() => {})
        throw error
      }
      return this.summary(entry)
    })
  }
  async update(
    principal: SitePrincipal,
    id: string,
    expected: number,
    input: unknown,
    art?: SceneArtRecords,
  ) {
    return this.run(async () => {
      const next = structuredClone(this.state),
        entry = this.entry(principal, id, false, next)
      this.revision(entry, expected)
      const { definition } = checked(input)
      const previous = await this.readDocument(entry.draft)
      const records =
        art ??
        Object.fromEntries(
          Object.entries(previous.art).filter(([id]) => definition.scenes.some((s) => s.id === id)),
        )
      this.checkAssets(entry, definition)
      try {
        entry.draft = await this.writeDocument(definition, checkedArt(records, definition))
        entry.name = definition.metadata.name
        entry.authorVersion = definition.metadata.authorVersion
        entry.sceneCount = definition.scenes.length
        entry.npcCount = definition.npcs.length
        this.changed(entry)
        await this.commit(next)
      } catch (error) {
        await this.cleanup().catch(() => {})
        throw error
      }
      return this.summary(entry)
    })
  }
  async saveVersion(principal: SitePrincipal, id: string, expected: number) {
    return this.run(async () => {
      const next = structuredClone(this.state),
        entry = this.entry(principal, id, false, next)
      this.revision(entry, expected)
      const parsed = await this.readDocument(entry.draft)
      this.checkAssets(entry, parsed.definition)
      try {
        await assertArtReady(parsed.definition.scenes, parsed.art)
      } catch (error) {
        throw new RoomError(error instanceof Error ? error.message : '背景需要GM校准', 409)
      }
      if (!parsed.ready) throw new RoomError('规则依赖尚未补齐，不能保存可开团版本', 409)
      if (entry.versions.length >= 500)
        throw new RoomError('保存版本达到 500 个，请主动清理旧版本', 413)
      const version = {
        id: randomUUID(),
        authorVersion: entry.authorVersion,
        createdAt: this.now(),
        document: entry.draft,
      }
      entry.versions.push(version)
      this.changed(entry)
      await this.commit(next)
      return { ...this.summary(entry), savedVersionId: version.id }
    })
  }
  async copy(principal: SitePrincipal, id: string, versionId?: string) {
    return this.run(async () => {
      const source = this.entry(principal, id, true),
        version = versionId ? source.versions.find((v) => v.id === versionId) : undefined
      if (versionId && !version) throw new RoomError('剧本版本不存在', 404)
      const { definition, art } = await this.readDocument(version?.document ?? source.draft)
      definition.metadata.name = (definition.metadata.name + ' 副本').slice(0, 120)
      const at = this.now(),
        entry = {
          ...structuredClone(source),
          id: randomUUID(),
          revision: 0,
          name: definition.metadata.name,
          authorVersion: definition.metadata.authorVersion,
          sceneCount: definition.scenes.length,
          npcCount: definition.npcs.length,
          createdAt: at,
          updatedAt: at,
          trashedAt: null,
          versions: [],
          draft: await this.writeDocument(definition, art),
        }
      const next = structuredClone(this.state)
      next.entries.push(entry)
      try {
        await this.commit(next)
      } catch (error) {
        await this.cleanup().catch(() => {})
        throw error
      }
      return this.summary(entry)
    })
  }
  async trash(principal: SitePrincipal, id: string, expected: number, restore = false) {
    return this.run(async () => {
      const next = structuredClone(this.state),
        entry = this.entry(principal, id, true, next)
      this.revision(entry, expected)
      if (!!entry.trashedAt === !restore)
        throw new RoomError(restore ? '剧本不在回收站' : '剧本已在回收站', 409)
      entry.trashedAt = restore ? null : this.now()
      this.changed(entry)
      await this.commit(next)
      return this.summary(entry)
    })
  }
  async remove(
    principal: SitePrincipal,
    id: string,
    expected: number,
    confirmed: boolean,
    versionId?: string,
  ) {
    return this.run(async () => {
      if (!confirmed) throw new RoomError('永久删除需要明确确认')
      const next = structuredClone(this.state),
        entry = this.entry(principal, id, true, next)
      this.revision(entry, expected)
      if (versionId) {
        if (!entry.versions.some((v) => v.id === versionId))
          throw new RoomError('剧本版本不存在', 404)
        entry.versions = entry.versions.filter((v) => v.id !== versionId)
        this.changed(entry)
      } else {
        if (!entry.trashedAt) throw new RoomError('请先将剧本移入回收站', 409)
        next.entries = next.entries.filter((e) => e.id !== id)
      }
      await this.commit(next)
      return { removed: true, ...(versionId ? { revision: entry.revision } : {}) }
    })
  }
  private async upload(source: AsyncIterable<Uint8Array>, mime: string, limit: number) {
    if (!(MAP_IMAGE_MIMES as readonly string[]).includes(mime))
      throw new RoomError('只支持 PNG/JPEG/WebP', 415)
    await this.diskSpace(limit)
    const temporary = path.join(this.directory, 'temporary', randomUUID() + '.tmp'),
      hash = createHash('sha256')
    let bytes = 0
    try {
      await pipeline(
        Readable.from(source),
        new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length
            if (bytes > limit) return callback(new RoomError('图片上传超过大小限制', 413))
            hash.update(chunk)
            callback(null, chunk)
          },
        }),
        createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
      )
      if (!bytes) throw new RoomError('图片不能为空')
      const geometry = await imageGeometry(temporary, mime, bytes),
        value = hash.digest('hex'),
        target = this.imageFile(value)
      try {
        const current = await stat(target)
        if (current.size !== bytes) throw Error('已有图片摘要文件大小冲突')
        await unlink(temporary)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        await rename(temporary, target)
      }
      return { ...geometry, mime: mime as ScriptAsset['mime'], bytes, hash: value }
    } catch (error) {
      await unlink(temporary).catch(() => {})
      throw error
    }
  }
  private async storeAsset(a: MapAsset): Promise<AssetRecord> {
    const metadata = scriptAssetSchema.parse(scriptAssetMeta(a))
    const stored = await this.upload(
      Readable.fromWeb(a.blob.stream() as import('node:stream/web').ReadableStream),
      a.mime,
      MAP_IMAGE_BYTES,
    )
    if (stored.width !== metadata.width || stored.height !== metadata.height)
      throw new RoomError('图片实际尺寸与声明不一致')
    let previewHash: string | undefined
    if (a.preview) {
      const preview = await this.upload(
        Readable.fromWeb(a.preview.blob.stream() as import('node:stream/web').ReadableStream),
        a.preview.mime,
        MAP_PREVIEW_BYTES,
      )
      if (preview.width !== a.preview.width || preview.height !== a.preview.height)
        throw new RoomError('预览图实际尺寸不一致')
      previewHash = preview.hash
    }
    return { metadata, hash: stored.hash, ...(previewHash ? { previewHash } : {}) }
  }
  async uploadAsset(
    principal: SitePrincipal,
    id: string,
    expected: number,
    name: string,
    mime: string,
    source: AsyncIterable<Uint8Array>,
    previewFor?: string,
  ) {
    return this.run(async () => {
      const next = structuredClone(this.state),
        entry = this.entry(principal, id, false, next)
      this.revision(entry, expected)
      z.string().min(1).max(2000).parse(name)
      const original = previewFor
        ? entry.assets.find((a) => a.metadata.id === previewFor)
        : undefined
      if (previewFor && !original) throw new RoomError('原图片不存在', 404)
      if (!previewFor && entry.assets.length >= 100) throw new RoomError('剧本最多 100 张图片', 413)
      // Preview replacement would change immutable version resources. Add a new image instead.
      if (original?.previewHash)
        throw new RoomError('预览图已存在，请新建图片替换，不覆盖已保存版本', 409)
      try {
        const uploaded = await this.upload(
          source,
          mime,
          previewFor ? MAP_PREVIEW_BYTES : MAP_IMAGE_BYTES,
        )
        const { hash, ...geometry } = uploaded
        let asset: AssetRecord
        if (original) {
          original.metadata = scriptAssetSchema.parse({ ...original.metadata, preview: geometry })
          original.previewHash = hash
          asset = original
          for (const v of entry.versions) {
            const saved = await this.readDocument(v.document)
            if (saved.definition.assets.some((a) => a.id === original.metadata.id))
              throw new RoomError('已保存版本使用此图片；请新建图片添加预览', 409)
          }
          const draft = await this.readDocument(entry.draft)
          if (draft.definition.assets.some((a) => a.id === original.metadata.id))
            throw new RoomError('请先在未引用的新图片上添加预览，再保存草稿', 409)
        } else {
          asset = {
            metadata: scriptAssetSchema.parse({ id: randomUUID(), name, ...geometry }),
            hash,
          }
          entry.assets.push(asset)
        }
        if (
          entry.assets.reduce(
            (n, a) => n + a.metadata.bytes + (a.metadata.preview?.bytes ?? 0),
            0,
          ) > MAP_TOTAL_IMAGE_BYTES
        )
          throw new RoomError('本剧本原图与预览总量超过 200 MB', 413)
        this.changed(entry)
        await this.commit(next)
        return { revision: entry.revision, asset: asset.metadata, usage: this.usage(principal) }
      } catch (error) {
        await this.cleanup().catch(() => {})
        throw error
      }
    })
  }
  async deleteAsset(principal: SitePrincipal, id: string, assetId: string, expected: number) {
    return this.run(async () => {
      const next = structuredClone(this.state),
        entry = this.entry(principal, id, false, next)
      this.revision(entry, expected)
      if (!entry.assets.some((a) => a.metadata.id === assetId))
        throw new RoomError('图片不存在', 404)
      for (const document of [entry.draft, ...entry.versions.map((v) => v.document)])
        if ((await this.readDocument(document)).definition.assets.some((a) => a.id === assetId))
          throw new RoomError('图片仍被草稿或保存版本引用，请先清理引用', 409)
      entry.assets = entry.assets.filter((a) => a.metadata.id !== assetId)
      this.changed(entry)
      await this.commit(next)
      return { revision: entry.revision, removed: true }
    })
  }
  async asset(principal: SitePrincipal, id: string, assetId: string, preview = false) {
    return this.run(async () => {
      const entry = this.entry(principal, id, true),
        asset = entry.assets.find((a) => a.metadata.id === assetId)
      if (!asset) throw new RoomError('图片不存在或不可访问', 404)
      const metadata = preview && asset.metadata.preview ? asset.metadata.preview : asset.metadata
      const handle = await open(
        this.imageFile(preview && asset.previewHash ? asset.previewHash : asset.hash),
        'r',
      )
      return {
        mime: metadata.mime,
        bytes: metadata.bytes,
        stream: handle.createReadStream({ autoClose: true }),
      }
    })
  }
  async bundle(principal: SitePrincipal, id: string, versionId: string) {
    return this.run(async () => {
      const entry = this.entry(principal, id),
        version = entry.versions.find((v) => v.id === versionId)
      if (!version) throw new RoomError('请选择一个保存版本', 404)
      const parsed = await this.readDocument(version.document)
      try {
        await assertArtReady(parsed.definition.scenes, parsed.art)
      } catch (error) {
        throw new RoomError(error instanceof Error ? error.message : '背景需要GM校准', 409)
      }
      const assets: MapAsset[] = []
      for (const metadata of parsed.definition.assets) {
        const record = entry.assets.find((a) => a.metadata.id === metadata.id)!
        const { bytes: _bytes, preview, ...meta } = metadata
        assets.push({
          ...meta,
          blob: await openAsBlob(this.imageFile(record.hash), { type: meta.mime }),
          ...(preview
            ? {
                preview: {
                  mime: preview.mime,
                  width: preview.width,
                  height: preview.height,
                  blob: await openAsBlob(this.imageFile(record.previewHash!), {
                    type: preview.mime,
                  }),
                },
              }
            : {}),
        })
      }
      return { ...parsed, assets }
    })
  }
}
