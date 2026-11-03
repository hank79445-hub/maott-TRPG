import {openingPresentationSchema} from '../persistence/opening-reading-schema'
import { errorEnvelope } from '../shared/localization/errors'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { pipeline } from 'node:stream/promises'
import { z, ZodError } from 'zod'
import { RoomError } from './room-engine'
import type { RoomStore } from './room-store'
import type { RoomHostingOptions } from './test-access'
import { newScript } from '../core/script'
import { SCRIPT_DOCUMENT_BYTES } from '../persistence/script-schema'
import { MAP_IMAGE_BYTES, MAP_PREVIEW_BYTES } from '../core/map-limits'
import { instantiateScript } from '../core/script'
import { prepareScriptParty } from '../core/script-party'
import { characterSchema } from '../persistence/schema'
import { ScriptImportStages, SCRIPT_ZIP_BYTES, exportScriptPack } from './script-pack'
import type { ScriptLibrary } from './script-library'
import path from 'node:path'
import { QuickActionsStore } from './quick-actions'
import { sceneArtRecordsSchema } from '../persistence/scene-art-schema'
const preferences = new WeakMap<ScriptLibrary, QuickActionsStore>()

const stages = new WeakMap<ScriptLibrary, Promise<ScriptImportStages>>()
function imports(library: ScriptLibrary) {
  let pending = stages.get(library)
  if (!pending) {
    pending = (async () => {
      const manager = new ScriptImportStages(
        path.join(library.directory, 'imports'),
        library.limits.minimumFreeBytes,
      )
      await manager.init()
      return manager
    })()
    stages.set(library, pending)
  }
  return pending
}

async function jsonBody(req: IncomingMessage, limit = SCRIPT_DOCUMENT_BYTES) {
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new RoomError('需要 JSON 请求', 415)
  let bytes = 0
  const parts: Buffer[] = []
  for await (const part of req) {
    bytes += part.length
    if (bytes > limit) throw new RoomError('请求超过大小限制', 413)
    parts.push(part)
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8'))
  } catch {
    throw new RoomError('JSON 格式不正确')
  }
}
const revision = z.number().int().nonnegative()
const updateSchema = z
  .object({
    expectedRevision: revision,
    definition: z.unknown(),
    art: sceneArtRecordsSchema.optional(),
  })
  .strict()
const revisionSchema = z.object({ expectedRevision: revision }).strict()
const removeSchema = revisionSchema.extend({ confirmed: z.literal(true) }).strict()

export async function handleScriptHttp(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  rooms: RoomStore,
  hosting: RoomHostingOptions,
) {
  if (
    url.pathname !== '/api/account' &&
    url.pathname !== '/api/preferences/quick-actions' &&
    !/^\/api\/scripts(?:\/|$)/.test(url.pathname)
  )
    return false
  if (!hosting.access || !hosting.scriptLibrary)
    throw new RoomError('个人剧本库需要配置账号登录与持久目录', 503)
  const principal = await hosting.access.principal(req),
    library = hosting.scriptLibrary
  const json = (value: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(status >= 400 ? errorEnvelope(value,status) : value))
  }
  if (url.pathname === '/api/preferences/quick-actions') {
    let store = preferences.get(library)
    if (!store) {
      store = new QuickActionsStore(path.join(library.directory, 'preferences'))
      preferences.set(library, store)
    }
    const character = url.searchParams.get('characterId') ?? ''
    if (req.method === 'GET') json(await store.get(principal.accountId, character))
    else if (req.method === 'PUT')
      json(await store.set(principal.accountId, character, await jsonBody(req, 12000)))
    else throw new RoomError('请求方法不支持', 405)
    return true
  }
  if (url.pathname === '/api/account' && req.method === 'GET') {
    json(principal)
    return true
  }
  if (url.pathname === '/api/scripts' && req.method === 'GET') {
    json(await library.list(principal, url.searchParams.get('trash') === '1'))
    return true
  }
  if (url.pathname === '/api/scripts' && req.method === 'POST') {
    const body = z
      .object({ name: z.string().min(1).max(120).optional(), definition: z.unknown().optional() })
      .strict()
      .parse(await jsonBody(req))
    json(await library.create(principal, body.definition ?? newScript(body.name)), 201)
    return true
  }
  if (url.pathname === '/api/scripts/from-room' && req.method === 'POST') {
    const body = z
      .object({
        roomId: z.string().uuid(),
        roomToken: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
        confirmedCurrentInitialState: z.literal(true),
      })
      .strict()
      .parse(await jsonBody(req, 4096))
    const source = rooms.scriptSource(
      body.roomId,
      body.roomToken,
      body.confirmedCurrentInitialState,
    )
    json(await library.create(principal, source.definition, source.assets), 201)
    return true
  }
  if (url.pathname === '/api/scripts/import-preview' && req.method === 'POST') {
    if (req.headers['content-type']?.split(';')[0] !== 'application/zip')
      throw new RoomError('需要 ZIP 剧本包', 415)
    if (Number(req.headers['content-length']) > SCRIPT_ZIP_BYTES)
      throw new RoomError('剧本 ZIP 超限', 413)
    req.setTimeout(120000, () => req.destroy())
    json(await (await imports(library)).preview(principal, req))
    return true
  }
  if (url.pathname === '/api/scripts/import' && req.method === 'POST') {
    const { token, art } = z
      .object({ token: z.string().uuid(), art: sceneArtRecordsSchema.optional() })
      .strict()
      .parse(await jsonBody(req, SCRIPT_DOCUMENT_BYTES))
    const stage = await (await imports(library)).take(principal, token)
    try {
      json(await library.create(principal, stage.definition, stage.assets, art), 201)
    } finally {
      await stage.cleanup()
    }
    return true
  }
  if (
    /^\/api\/scripts\/import-preview\/[a-f0-9-]{36}$/.test(url.pathname) &&
    req.method === 'DELETE'
  ) {
    await (await imports(library)).cancel(principal, url.pathname.split('/').at(-1)!)
    json({ canceled: true })
    return true
  }
  const match = url.pathname.match(
    /^\/api\/scripts\/([a-f0-9-]{36})(?:\/(versions|assets|restore|copy|purge|export|instances)(?:\/([a-f0-9-]{36})(?:\/(preview))?)?)?$/,
  )
  if (!match) throw new RoomError('接口不存在', 404)
  const [, id, route, child, preview] = match
  if (req.method === 'GET' && route === 'export' && child) {
    const bundle = await library.bundle(principal, id!, child)
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="script-${child}.zip"`,
    })
    await pipeline(exportScriptPack(bundle.definition, bundle.assets), res)
  } else if (req.method === 'POST' && route === 'instances' && child) {
    const body = z
      .object({
        players: z.array(characterSchema).min(1).max(100),
        bindings: z.record(z.string().uuid(), z.string()).default({}),
        openingPresentation: openingPresentationSchema.optional(),
        name: z.string().min(1).max(120),
        nickname: z.string().min(1).max(60),
        confirmed: z.boolean().default(false),
        aiConfirmed: z.boolean().default(false),
      })
      .strict()
      .parse(await jsonBody(req))
    const bundle = await library.bundle(principal, id!, child)
    let party: Awaited<ReturnType<typeof prepareScriptParty>>,
      instance: ReturnType<typeof instantiateScript>
    try {
      const definition=body.openingPresentation?{...bundle.definition,openingPresentation:body.openingPresentation}:bundle.definition
      party = await prepareScriptParty(definition, body.players, body.bindings)
      instance = instantiateScript(
        definition,
        bundle.assets,
        party.players,
        party.bindings,
        {
          scriptId: id!,
          versionId: child,
          authorVersion: bundle.definition.metadata.authorVersion,
        },
      )
    } catch (error) {
      if (error instanceof ZodError) throw error
      throw new RoomError(error instanceof Error ? error.message : '开团预检失败')
    }
    const a = instance.world.adventures[0]!
    a.name = body.name
    a.sourceScript!.startSceneId = instance.startSceneId
    a.sourceScript!.landing = instance.landing
    if (preview)
      json({
        disabled: instance.disabled,
        sceneCount: a.scenes.length,
        npcCount: a.ai?.npcs.length ?? 0,
        characterCount: a.party.length,
        startSceneName: a.scenes.find((s) => s.id === instance.startSceneId)!.name,
      })
    else {
      if (!body.confirmed || !body.aiConfirmed)
        throw new RoomError('请确认停用配置清单与 AI 设置后创建')
      json(await rooms.createPrepared(body.name, body.nickname, instance, [], party.mapping), 201)
    }
  } else if (req.method === 'GET' && !route) json(await library.get(principal, id!))
  else if (req.method === 'PUT' && !route) {
    const body = updateSchema.parse(await jsonBody(req))
    json(await library.update(principal, id!, body.expectedRevision, body.definition, body.art))
  } else if (req.method === 'DELETE' && !route) {
    const body = revisionSchema.parse(await jsonBody(req, 4096))
    json(await library.trash(principal, id!, body.expectedRevision))
  } else if (req.method === 'GET' && route === 'versions' && child && !preview)
    json(await library.get(principal, id!, child))
  else if (req.method === 'POST' && route === 'versions' && !child) {
    const body = revisionSchema.parse(await jsonBody(req, 4096))
    json(await library.saveVersion(principal, id!, body.expectedRevision))
  } else if (req.method === 'DELETE' && route === 'versions' && child && !preview) {
    const body = removeSchema.parse(await jsonBody(req, 4096))
    json(await library.remove(principal, id!, body.expectedRevision, body.confirmed, child))
  } else if (req.method === 'POST' && route === 'restore' && !child) {
    const body = revisionSchema.parse(await jsonBody(req, 4096))
    json(await library.trash(principal, id!, body.expectedRevision, true))
  } else if (req.method === 'POST' && route === 'purge' && !child) {
    const body = removeSchema.parse(await jsonBody(req, 4096))
    json(await library.remove(principal, id!, body.expectedRevision, body.confirmed))
  } else if (req.method === 'POST' && route === 'copy' && !child) {
    const body = z
      .object({ versionId: z.string().uuid().optional() })
      .strict()
      .parse(await jsonBody(req, 4096))
    json(await library.copy(principal, id!, body.versionId), 201)
  } else if (req.method === 'GET' && route === 'assets' && child && !preview) {
    const image = await library.asset(
      principal,
      id!,
      child,
      url.searchParams.get('preview') === '1',
    )
    res.writeHead(200, { 'Content-Type': image.mime, 'Content-Length': image.bytes })
    await pipeline(image.stream, res)
  } else if (req.method === 'DELETE' && route === 'assets' && child && !preview) {
    const body = revisionSchema.parse(await jsonBody(req, 4096))
    json(await library.deleteAsset(principal, id!, child, body.expectedRevision))
  } else if (req.method === 'POST' && route === 'assets' && (!child || preview)) {
    const raw = req.headers['if-match']
    if (typeof raw !== 'string' || !/^\d+$/.test(raw))
      throw new RoomError('图片上传需要 If-Match 剧本修订号')
    const expected = Number(raw)
    revision.parse(expected)
    const limit = preview ? MAP_PREVIEW_BYTES : MAP_IMAGE_BYTES
    if (req.headers['content-length'] && Number(req.headers['content-length']) > limit)
      throw new RoomError('图片上传超过大小限制', 413)
    req.setTimeout(30000, () => req.destroy())
    json(
      await library.uploadAsset(
        principal,
        id!,
        expected,
        url.searchParams.get('name') ?? '背景图片',
        req.headers['content-type']?.split(';')[0]?.trim() ?? '',
        req,
        child,
      ),
      201,
    )
  } else throw new RoomError('接口不存在', 404)
  return true
}
