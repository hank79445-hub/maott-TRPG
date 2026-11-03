import { gzipSync } from 'node:zlib'
import { errorEnvelope } from '../shared/localization/errors'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { ZodError } from 'zod'
import { RoomStore } from './room-store'
import { RoomError } from './room-engine'
import { checkPublicRequest, clientAddress, type RoomHostingOptions } from './test-access'
import { hostingFooter, footerStyle } from './hosting-footer'
import { handleScriptHttp } from './script-http'
import { handleQqHttp } from './qq-http'
import { checkLanRequest, lanJoinPage } from './lan'
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
}
async function body(req: IncomingMessage, limit: number) {
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new RoomError('需要 JSON 请求', 415)
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > limit) throw new RoomError('请求超过大小限制', 413)
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RoomError('JSON 格式不正确')
  }
}
export function roomServer(
  store: RoomStore,
  staticDirectory?: string,
  hosting: RoomHostingOptions = {},
) {
  if (hosting.publicOrigin && !hosting.access) throw new Error('公开实例必须配置测试入口')
  const attempts = new Map<string, { at: number; count: number }>()
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'same-origin')
    if (hosting.publicOrigin)
      res.setHeader(
        'Content-Security-Policy',
        `frame-ancestors 'self' ${(hosting.frameOrigins ?? []).join(' ')}`,
      )
    const started = performance.now()
    const acceptsGzip = /(?:^|,)\s*gzip(?:\s*;\s*q=(?!0(?:\.0*)?(?:,|$))[0-9.]+)?\s*(?:,|$)/i.test(
      req.headers['accept-encoding'] ?? '',
    )
    const respond = (content: string | Buffer, type: string, status = 200) => {
      const encoded = Buffer.isBuffer(content) ? content : Buffer.from(content)
      const startEncoding = performance.now()
      const zip = acceptsGzip && encoded.length > 2048 && /json|javascript|text\//.test(type)
      const payload = zip ? gzipSync(encoded) : encoded
      res.writeHead(status, {
        'Content-Type': type,
        'Content-Length': payload.length,
        Vary: 'Accept-Encoding',
        ...(zip ? { 'Content-Encoding': 'gzip' } : {}),
        'Server-Timing': `request;dur=${(performance.now() - started).toFixed(1)}, encode;dur=${(performance.now() - startEncoding).toFixed(1)}${res.getHeader('Server-Timing') ? ', ' + res.getHeader('Server-Timing') : ''}`,
      })
      res.end(payload)
    }
    const json = (value: unknown, status = 200) =>
      respond(JSON.stringify(status >= 400 ? errorEnvelope(value,status) : value), 'application/json; charset=utf-8', status)
    try {
      const url = new URL(req.url ?? '/', 'http://localhost'),
        pathname = url.pathname
      const localLan = hosting.lanOnly ? checkLanRequest(req) : false
      const localHealth =
        pathname === '/api/health' &&
        req.method === 'GET' &&
        !req.headers.origin &&
        ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') &&
        /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(req.headers.host ?? '')
      const requestOrigin =
        hosting.publicOrigin && !localHealth
          ? checkPublicRequest(req, [hosting.publicOrigin, ...(hosting.backupOrigins ?? [])])
          : undefined
      if (pathname === '/api/health' && req.method === 'GET') {
        json({
          ok: true,
          protocol: 1,
          ...(hosting.version ? { version: hosting.version } : {}),
          ...(hosting.access || hosting.deploymentId
            ? { deploymentId: hosting.deploymentId ?? (await hosting.access!.deploymentId()) }
            : {}),
          ...(hosting.lanOnly ? { lan: true } : {}),
        })
        return
      }
      if (hosting.access && (await hosting.access.handle(req, res, pathname, requestOrigin))) return
      if (hosting.lanOnly && pathname === '/lan' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' })
        res.end(lanJoinPage)
        return
      }
      if (hosting.lanOnly && pathname.startsWith('/api/')) {
        const safe =
          pathname.startsWith('/api/rooms/') ||
          ['/api/lan/join', '/api/lan/poll'].includes(pathname) ||
          (localLan && ['/api/rooms', '/api/lan/status'].includes(pathname))
        if (!safe || /^\/api\/rooms\/[^/]+\/join$/.test(pathname))
          throw new RoomError('局域网入口不提供此操作，请使用申请加入或本机管理', 403)
      }
      if (
        hosting.lanOnly &&
        req.method === 'POST' &&
        ['/api/lan/join', '/api/lan/poll'].includes(pathname)
      ) {
        const ip = req.socket.remoteAddress ?? '',
          previous = attempts.get(ip),
          entry =
            previous && Date.now() - previous.at < 60000 ? previous : { at: Date.now(), count: 0 }
        attempts.set(ip, entry)
        if (++entry.count > 80) throw new RoomError('请求过于频繁，请稍后重试', 429)
        const value = await body(req, 4096)
        if (pathname.endsWith('/join')) {
          if (
            !value ||
            typeof value.code !== 'string' ||
            Object.keys(value).some((k) => !['code', 'invite', 'nickname'].includes(k))
          )
            throw new RoomError('入网申请格式无效')
          json(
            await store.requestLanJoin(value.code, {
              invite: value.invite,
              nickname: value.nickname,
            }),
            202,
          )
        } else {
          if (
            !value ||
            typeof value.roomId !== 'string' ||
            typeof value.requestId !== 'string' ||
            typeof value.ticket !== 'string' ||
            value.ticket.length > 128
          )
            throw new RoomError('申请凭据无效')
          json(store.pollLanJoin(value.roomId, value.requestId, value.ticket))
        }
        return
      }
      if (pathname === '/api/lan/status' && req.method === 'GET') {
        const token =
          req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1] ?? ''
        const member = store.authenticate(url.searchParams.get('roomId') ?? '', token)
        if (member.role !== 'gm') throw new RoomError('需要 GM', 403)
        json(
          hosting.lanManager?.status() ?? {
            enabled: false,
            addresses: [],
            candidates: [],
            port: 8795,
            adminUrl: 'http://127.0.0.1:8797/',
          },
        )
        return
      }
      if (!pathname.startsWith('/api/')) {
        if (!staticDirectory || req.method !== 'GET') throw new RoomError('页面不存在', 404)
        const relative = decodeURIComponent(pathname).replace(/^\/+/, ''),
          base = path.resolve(staticDirectory)
        let target = path.resolve(base, relative || 'index.html')
        if (target !== base && !target.startsWith(base + path.sep))
          throw new RoomError('路径不可访问', 403)
        try {
          if (!(await stat(target)).isFile()) target = path.join(base, 'index.html')
        } catch {
          target = path.join(base, 'index.html')
        }
        const content = await readFile(target)
        respond(
          hosting.icpRecord && path.extname(target) === '.html'
            ? content
                .toString('utf8')
                .replace(
                  '</body>',
                  `<style>${footerStyle}</style>${hostingFooter(hosting.icpRecord)}</body>`,
                )
            : content,
          mime[path.extname(target)] ?? 'application/octet-stream',
        )
        return
      }
      // Browser API calls are same-origin. External adapters use bearer authentication.
      const origin = req.headers.origin
      if (origin && !hosting.publicOrigin) {
        const host = new URL(origin).hostname,
          requestHost = (req.headers.host ?? '').split(':')[0]
        if (!['127.0.0.1', 'localhost', requestHost].includes(host))
          throw new RoomError('请求来源不允许', 403)
      }
      if (await handleScriptHttp(req, res, url, store, hosting)) return
      const containerMatch = pathname.match(/^\/api\/rooms\/([a-f0-9-]{36})\/container$/)
      if (containerMatch) {
        if (req.method !== 'GET') throw new RoomError('接口方法不允许', 405)
        const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1] ?? ''
        const args = ['sceneId', 'pointId', 'characterId'].map(key => url.searchParams.get(key) ?? '')
        if (args.some(v => !v || v.length > 120)) throw new RoomError('容器参数无效')
        json(store.pointContainer(containerMatch[1]!, token, args[0]!, args[1]!, args[2]!))
        return
      }
      const messagesMatch = pathname.match(
        /^\/api\/rooms\/([a-f0-9-]{36})\/(messages|message-npcs)$/,
      )
      if (messagesMatch) {
        if (req.method !== 'GET') throw new RoomError('接口方法不允许', 405)
        const token =
          req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1] ?? ''
        const before = url.searchParams.get('before') ?? ''
        if (before.length > 150) throw new RoomError('分页游标无效')
        json(
          messagesMatch[2] === 'message-npcs'
            ? store.messageNpcs(messagesMatch[1]!, token)
            : store.messages(messagesMatch[1]!, token, before),
        )
        return
      }
      const qqSummary = pathname.match(/^\/api\/rooms\/([a-f0-9-]{36})\/qq-summary$/)
      if (qqSummary) {
        if (req.method !== 'GET') throw new RoomError('接口方法不允许', 405)
        const id = qqSummary[1]!,
          token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1] ?? ''
        if (store.authenticate(id, token).role !== 'gm')
          throw new RoomError('运行摘要仅供GM查看', 403)
        if (hosting.qqBots) json(hosting.qqBots.runSummary(id, token))
        else {
          const summary = hosting.qqBridge?.runSummary(id, token)
          const { bindingId, ...counts } = summary ?? {
            bindingId: undefined,
            boundBots: 0,
            connectedBots: 0,
            pausedBots: 0,
            queued: 0,
            failed: 0,
            unknown: 0,
          }
          json({
            enabled: !!hosting.qqBridge,
            ...counts,
            ...store.qqPairingCounts(id, token, bindingId ? [bindingId] : []),
            checkedAt: new Date().toISOString(),
          })
        }
        return
      }
      if (await handleQqHttp(req, res, url, hosting)) return
      const match = pathname.match(
        /^\/api\/rooms\/([a-f0-9-]{36}|[A-Za-z0-9]{8})(?:\/(join|snapshot|commands|archive|assets|broadcasts|broadcast-ack|npc-knowledge|npc-tools)(?:\/([a-zA-Z0-9_-]+))?)?$/,
      )
      if (req.method === 'POST' && (pathname === '/api/rooms' || match?.[2] === 'join')) {
        const ip = clientAddress(req, hosting.trustLoopbackProxy),
          previous = attempts.get(ip),
          entry =
            previous && Date.now() - previous.at < 60000 ? previous : { at: Date.now(), count: 0 }
        attempts.set(ip, entry)
        if (++entry.count > 30) throw new RoomError('创建或加入过于频繁，请稍后重试', 429)
        if (attempts.size > 1000)
          for (const [key, value] of attempts)
            if (Date.now() - value.at > 60000) attempts.delete(key)
        json(
          pathname === '/api/rooms'
            ? await store.create(await body(req, 384 * 1024 * 1024))
            : await store.join(match![1]!, await body(req, 4096)),
          201,
        )
        return
      }
      if (!match) throw new RoomError('接口不存在', 404)
      const id = match[1]!,
        route = match[2],
        token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1] ?? ''
      const member = store.authenticate(id, token)
      if (hosting.lanOnly && member.role === 'gm' && !localLan)
        throw new RoomError('GM 管理请在主机本机打开', 403)
      if(req.method==='GET'&&route==='npc-knowledge'){
        json(store.npcKnowledgeReport(id,token))
      } else if(req.method==='POST'&&route==='npc-tools'){
        if(member.role!=='gm')throw new RoomError('NPC工具接口仅供GM授权连接',403)
        json(await store.npcTool(id,token,await body(req,32768)))
      } else if (req.method === 'GET' && route === 'broadcasts') {
        const after = Number(url.searchParams.get('after') ?? 0),
          limit = Number(url.searchParams.get('limit') ?? 200)
        if (
          !Number.isSafeInteger(after) ||
          after < 0 ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200
        )
          throw new RoomError('广播分页参数不合法')
        json(store.feed(id, token, after, limit))
      } else if (req.method === 'POST' && route === 'broadcast-ack') {
        const value = await body(req, 4096)
        if (
          !value ||
          typeof value !== 'object' ||
          Object.keys(value).length !== 1 ||
          !('cursor' in value)
        )
          throw new RoomError('广播确认格式不合法')
        json(await store.acknowledge(id, token, value.cursor))
      } else if (req.method === 'GET' && route === 'snapshot') {
        const since = Number(url.searchParams.get('since') ?? -1)
        if (!Number.isSafeInteger(since) || since < -1) throw new RoomError('版本参数不合法')
        const abort = new AbortController()
        res.on('close', () => abort.abort())
        if (url.searchParams.get('wait') === '1') await store.wait(id, token, since, abort.signal)
        if (abort.signal.aborted) return
        const view = store.view(
          id,
          token,
          req.headers['x-trpg-view'] === 'live' && url.searchParams.get('full') !== '1',
        )
        if (view.revision <= since) {
          res.writeHead(204)
          res.end()
        } else json(view)
      } else if (req.method === 'GET' && route === 'commands' && match[3]) {
        json(await store.commandReceipt(id, token, match[3]))
      } else if (req.method === 'POST' && route === 'commands') {
        const response = await store.command(
          id,
          token,
          await body(
            req,
            (member.role === 'gm' ? 80 : member.role === 'player' ? 5 : 1) * 1024 * 1024,
          ),
          req.headers['x-trpg-view'] === 'live',
        )
        res.setHeader('Server-Timing', store.commandTimings(id))
        json(response)
      } else if (req.method === 'GET' && route === 'archive') {
        const archive = await store.archive(id, token)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(archive)
      } else if (req.method === 'GET' && route === 'assets' && match[3]) {
        const image = await store.fogAsset(id, token, match[3]) ?? store.asset(id, token, match[3], url.searchParams.get('preview') === '1')
          res.writeHead(200, { 'Content-Type': image.mime, 'Cache-Control': 'private, no-store' })
        res.end(Buffer.from(await image.blob.arrayBuffer()))
      } else throw new RoomError('接口不存在', 404)
    } catch (e) {
      if (res.headersSent) {
        res.destroy(e instanceof Error ? e : undefined)
        return
      }
      if (e instanceof ZodError)
        json(
          {
            error:
              '请求格式不兼容：' +
              e.issues
                .slice(0, 3)
                .map((i) => i.path.join('.') + ' ' + i.message)
                .join('；'),
          },
          400,
        )
      else
        json(
          {
            error:
              e instanceof RoomError
                ? e.message
                : '服务保存或校验失败，操作没有提交；请检查服务日志',
          },
          e instanceof RoomError ? e.status : 500,
        )
      if (!(e instanceof RoomError) && !(e instanceof ZodError)) console.error(e)
    }
  })
}
