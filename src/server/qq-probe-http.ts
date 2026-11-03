import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { QqProbe } from './qq-probe'
import { probePage } from './qq-probe-page'

const kind = z.enum(['passive', 'active', 'text_url', 'markdown_url', 'button'])
export function qqProbeServer(probe: QqProbe) {
  const csrf = randomBytes(32).toString('hex')
  return createServer(async (req, res) => {
    const port = req.socket.localPort
    const allowed = [`127.0.0.1:${port}`, `localhost:${port}`]
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
    const host = req.headers.host ?? ''
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
    }
    if (!local || !allowed.includes(host)) {
      json(403, { error: '验证页仅供本机访问' })
      return
    }
    const url = new URL(req.url ?? '/', `http://${host}`)
    if (req.method === 'GET' && url.pathname === '/') {
      const nonce = randomBytes(16).toString('hex')
      res.setHeader(
        'Content-Security-Policy',
        `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
      )
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(probePage(csrf, nonce))
      return
    }
    if (req.method === 'GET' && url.pathname === '/state') {
      json(200, probe.snapshot())
      return
    }
    if (req.method === 'GET' && url.pathname === '/report') {
      res.setHeader('Content-Disposition', 'attachment; filename="qq-0-report.json"')
      json(200, probe.report())
      return
    }
    if (req.method !== 'POST') {
      json(404, { error: '没有此接口' })
      return
    }
    const provided = req.headers['x-qq-probe-csrf']
    const origin = req.headers.origin
    if (
      typeof provided !== 'string' ||
      !/^[a-f0-9]{64}$/.test(provided) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(csrf)) ||
      (origin !== undefined && !allowed.map((h) => `http://${h}`).includes(origin)) ||
      !String(req.headers['content-type']).startsWith('application/json')
    ) {
      json(403, { error: '本机请求校验失败，请刷新验证页' })
      return
    }
    try {
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of req) {
        bytes += Buffer.byteLength(chunk)
        if (bytes > 8192) {
          json(413, { error: '请求过大' })
          return
        }
        chunks.push(Buffer.from(chunk))
      }
      const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      switch (url.pathname) {
        case '/config':
          await probe.saveConfig(input)
          break
        case '/connect':
          z.object({}).strict().parse(input)
          await probe.connect()
          break
        case '/disconnect':
          z.object({}).strict().parse(input)
          probe.disconnect()
          break
        case '/group':
          await probe.selectGroup(
            z
              .object({ groupId: z.string().max(128) })
              .strict()
              .parse(input).groupId,
          )
          break
        case '/auto':
          await probe.autoReply(z.object({ enabled: z.boolean() }).strict().parse(input).enabled)
          break
        case '/test': {
          const v = z
            .object({ kind, mode: z.enum(['passive', 'active']).default('passive') })
            .strict()
            .parse(input)
          json(200, { result: await probe.test(v.kind, v.mode), state: probe.snapshot() })
          return
        }
        case '/display': {
          const v = z.object({ kind, passed: z.boolean() }).strict().parse(input)
          await probe.display(v.kind, v.passed)
          break
        }
        default:
          json(404, { error: '没有此接口' })
          return
      }
      json(200, { state: probe.snapshot() })
    } catch (error) {
      if (error instanceof z.ZodError) {
        json(400, {
          error: error.issues.map((i) => `${i.path.join('.') || '字段'}：${i.message}`).join('；'),
        })
        return
      }
      const known =
        error instanceof Error &&
        /^(AppID|请输入|使用公开|请先|请重新|先保存|先选择|首次配置|没有可用|Bot 正在|先修改|先保存|先选择)/.test(
          error.message,
        )
      json(400, {
        error: known ? (error as Error).message : '操作未完成，请检查输入、Bot 配置或本机目录权限',
      })
    }
  })
}
