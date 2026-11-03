import { entranceTheme } from './entrance-theme'
import {formatSystemText,type SystemMessageKey} from '../shared/localization/system-messages'
import {localeSchema,type Locale} from '../shared/localization/locale'
import {interfaceLocaleCookie,interfaceLocaleFromCookie} from '../shared/localization/interface-preference'
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { isIP } from 'node:net'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { promisify } from 'node:util'
import { RoomError } from './room-engine'
import { hostingFooter, footerStyle } from './hosting-footer'
import { accessConfigSchema, type AccessConfig, type SitePrincipal } from './access-config'
import type { ScriptLibrary } from './script-library'

const derive = promisify(scrypt)
const cookieName = '__Host-trpg-test'
const lifetime = 12 * 60 * 60
export interface RoomHostingOptions {
  lanOnly?: boolean
  lanManager?: import('./lan').LanManager
  publicOrigin?: string
  backupOrigins?: string[]
  deploymentId?: string
  access?: TestAccess
  trustLoopbackProxy?: boolean
  frameOrigins?: string[]
  version?: string
  icpRecord?: string
  scriptLibrary?: ScriptLibrary
  qqBridge?: import('./qq-bridge').QqBridge
  qqBots?: import('./qq-bots').QqBotHub
  qqStatus?: () => { status: string; lastError: string }
}

export function httpsOrigin(value: string): string {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.hostname.includes('*') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('公开入口必须是 HTTPS 源地址，不包含路径或凭据')
  return url.origin
}

export function clientAddress(req: IncomingMessage, trusted = false): string {
  const remote = req.socket.remoteAddress ?? ''
  const forwarded = req.headers['x-real-ip']
  if (
    trusted &&
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) &&
    typeof forwarded === 'string' &&
    isIP(forwarded)
  )
    return forwarded
  return remote
}

export function checkPublicRequest(req: IncomingMessage, origins: string | readonly string[]) {
  const allowed = typeof origins === 'string' ? [origins] : origins
  const origin = allowed.find(
    (value) => req.headers.host?.toLowerCase() === new URL(value).host.toLowerCase(),
  )
  if (!origin) throw new RoomError('请求主机不允许', 403)
  if (req.headers.origin && req.headers.origin !== origin)
    throw new RoomError('请求来源不允许', 403)
  if (
    req.headers['sec-fetch-site'] === 'cross-site' &&
    (req.url?.startsWith('/api/') || !['GET', 'HEAD'].includes(req.method ?? ''))
  )
    throw new RoomError('跨站请求不允许', 403)
  return origin
}

function html(res: ServerResponse, message: SystemMessageKey | '' = '', status = 200, signedIn = false, icpRecord = '', locale:Locale='zh-CN') {
  const t=(key:SystemMessageKey)=>formatSystemText(locale,key)
  const form=signedIn
    ? `<a class="button" href="/">${t('login.continue')}</a><form method="post" action="/__test/logout"><button class="quiet">${t('login.logout')}</button></form>`
    : `<form method="post" action="/__test/login?lang=${locale}"><label for="username">${t('login.username')}</label><input id="username" name="username" autocomplete="username" required maxlength="40"><label for="password">${t('login.password')}</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"><button>${t('login.enter')}</button></form>`
  const nonce = randomBytes(18).toString('base64')
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
  )
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
  const document = `<!doctype html><html lang="${locale}" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t('login.title')}</title><style nonce="${nonce}">${footerStyle}
  :root{color-scheme:dark;--bg:#131c23;--panel:#1d2a34;--text:#f1f4f6;--muted:#b3c0c9;--accent:#86d8c1;--border:#4f626d}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:100%;max-width:460px;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:32px}h1{font-size:26px;margin:0 0 12px}p{color:var(--muted)}label{display:block;margin-top:18px}input{width:100%;margin-top:6px;padding:12px;font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:8px}button,.button{display:block;width:100%;min-height:48px;margin-top:24px;padding:12px;border:0;border-radius:8px;background:var(--accent);color:#142a25;font:inherit;font-weight:650;text-align:center;text-decoration:none;cursor:pointer}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #b9ebff;outline-offset:3px}.login-languages{display:flex;gap:8px;margin-bottom:20px}.login-languages a{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;background:#344550;color:var(--text);border:1px solid var(--border);border-radius:8px;text-decoration:none}.error{color:#ffbcb6}.quiet{background:#344550;color:var(--text);border:1px solid var(--border)}small{display:block;color:var(--muted);margin-top:20px}@media(max-width:480px){body{padding:16px}main{padding:24px}}
  ${entranceTheme}</style></head><body><main><nav class="login-languages" aria-label="${t('login.language')}"><a lang="zh-CN" href="/__test/login?lang=zh-CN">简体中文</a><a lang="en" href="/__test/login?lang=en">English</a></nav><h1>${t('login.heading')}</h1><p>${t('login.help')}</p>${message ? `<p class="error" role="alert">${t(message)}</p>` : ''}${form}<small>${t('login.notice')}</small>${hostingFooter(icpRecord)}</main></body></html>`
  res.end(document)
}

export class TestAccess {
  private cached?: { stamp: string; config: AccessConfig; revision: string }
  private attempts = new Map<string, { at: number; count: number }>()
  private verifying = 0
  constructor(
    private file: string,
    private origin: string,
    private trusted = false,
    private icpRecord = '',
  ) {}

  private async settings() {
    try {
      const info = await stat(this.file)
      if (!info.isFile() || info.size > 64 * 1024) throw new Error()
      const stamp = `${info.mtimeMs}:${info.ctimeMs}:${info.size}`
      if (this.cached?.stamp === stamp) return this.cached
      const data = await readFile(this.file, 'utf8')
      const config = accessConfigSchema.parse(JSON.parse(data))
      this.cached = { stamp, config, revision: createHash('sha256').update(data).digest('hex') }
      return this.cached
    } catch {
      this.cached = undefined
      throw new RoomError('测试入口配置不可用，请联系管理员', 503)
    }
  }

  async ready() {
    await this.settings()
  }
  async deploymentId() {
    const { config } = await this.settings()
    return createHash('sha256')
      .update('trpg-deployment-v1:')
      .update(config.signingKey)
      .digest('hex')
  }

  private signature(payload: string, config: AccessConfig) {
    return createHmac('sha256', Buffer.from(config.signingKey, 'base64url'))
      .update(payload)
      .digest('base64url')
  }

  private async sessionAccount(req: IncomingMessage) {
    const settings = await this.settings()
    const values = (req.headers.cookie ?? '')
      .split(';')
      .map((v) => v.trim())
      .filter((v) => v.startsWith(cookieName + '='))
    if (values.length !== 1) return null
    const raw = values[0]!.slice(cookieName.length + 1)
    if (raw.length > 1024) return null
    const [payload, signature, extra] = raw.split('.')
    if (!payload || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(payload + signature))
      return null
    const expected = this.signature(payload, settings.config)
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return null
    try {
      const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
      const account = settings.config.accounts.find(
        (a) => a.enabled && a.username === session.username,
      )
      const valid =
        session.revision === settings.revision &&
        Number.isSafeInteger(session.expires) &&
        session.expires > Date.now() / 1000 &&
        session.expires <= Date.now() / 1000 + lifetime &&
        !!account &&
        (!('accountId' in account) || session.accountId === account.accountId)
      return valid ? account! : null
    } catch {
      return null
    }
  }

  private async authenticated(req: IncomingMessage) {
    return !!(await this.sessionAccount(req))
  }

  async principal(req: IncomingMessage): Promise<SitePrincipal> {
    const account = await this.sessionAccount(req)
    if (!account) throw new RoomError('请先登录个人账号', 401)
    if (!('accountId' in account))
      throw new RoomError('管理员需先迁移永久账号 ID，现有房间仍可使用', 503)
    return { accountId: account.accountId as string, username: account.username }
  }

  private limit(req: IncomingMessage, username: string, origin: string) {
    const ip = clientAddress(req, this.trusted),
      now = Date.now()
    for (const [key, entry] of this.attempts)
      if (now - entry.at > 15 * 60000) this.attempts.delete(key)
    for (const [key, cap] of [
      [`ip:${ip}`, 60],
      [`account:${ip}:${origin}:${username}`, 10],
    ] as const) {
      const previous = this.attempts.get(key)
      if (!previous && this.attempts.size >= 1000) throw new RoomError('登录繁忙，请稍后重试', 429)
      const entry = previous ?? { at: now, count: 0 }
      this.attempts.set(key, entry)
      if (++entry.count > cap) throw new RoomError('登录尝试过于频繁，请十五分钟后重试', 429)
    }
    if (this.verifying >= 4) throw new RoomError('登录繁忙，请稍后重试', 429)
  }

  private redirect(res: ServerResponse, target: string) {
    res.writeHead(303, { Location: target })
    res.end()
  }

  /** True means the admission route or denied request has already been answered. */
  async handle(req: IncomingMessage, res: ServerResponse, pathname: string, origin = this.origin) {
    const explicitLocale=localeSchema.safeParse(new URL(req.url??pathname,origin).searchParams.get('lang'))
    const locale=explicitLocale.success?explicitLocale.data:interfaceLocaleFromCookie(req.headers.cookie)??'zh-CN'
    if (pathname === '/__test/login' && req.method === 'GET') {
      if(explicitLocale.success)res.setHeader('Set-Cookie',interfaceLocaleCookie(locale,origin.startsWith('https:')))
      html(res, '', 200, await this.authenticated(req), this.icpRecord,locale)
      return true
    }
    if ((pathname === '/__test/login' || pathname === '/__test/logout') && req.method === 'POST') {
      if (req.headers.origin !== origin) throw new RoomError('请求来源不允许', 403)
      if (pathname.endsWith('/logout')) {
        res.setHeader(
          'Set-Cookie',
          `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
        )
        this.redirect(res, '/__test/login')
        return true
      }
      if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))
        throw new RoomError('登录请求格式不正确', 415)
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 2048) throw new RoomError('登录请求过大', 413)
        chunks.push(chunk)
      }
      const fields = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
      const username = fields.get('username') ?? '',
        password = fields.get('password') ?? ''
      this.limit(req, username.slice(0, 40), origin)
      if (
        fields.size !== 2 ||
        !/^[a-zA-Z0-9_-]{1,40}$/.test(username) ||
        !password ||
        password.length > 128
      ) {
        html(res, 'login.invalid', 401, false, this.icpRecord,locale)
        return true
      }
      const { config, revision } = await this.settings()
      const account = config.accounts.find((a) => a.username === username)
      if (this.verifying >= 4) throw new RoomError('登录繁忙，请稍后重试', 429)
      this.verifying++
      let valid = false
      try {
        const hash = (await derive(
          password,
          Buffer.from(account?.salt ?? '00'.repeat(16), 'hex'),
          32,
        )) as Buffer
        valid = !!account?.enabled && timingSafeEqual(hash, Buffer.from(account.hash, 'hex'))
      } finally {
        this.verifying--
      }
      if (!valid) {
        html(res, 'login.invalid', 401, false, this.icpRecord,locale)
        return true
      }
      this.attempts.delete(`account:${clientAddress(req, this.trusted)}:${origin}:${username}`)
      const payload = Buffer.from(
        JSON.stringify({
          username,
          ...('accountId' in account! ? { accountId: account!.accountId } : {}),
          revision,
          expires: Math.floor(Date.now() / 1000) + lifetime,
        }),
      ).toString('base64url')
      res.setHeader(
        'Set-Cookie',
        `${cookieName}=${payload}.${this.signature(payload, config)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${lifetime}`,
      )
      this.redirect(res, '/')
      return true
    }
    if (await this.authenticated(req)) return false
    if (req.method === 'GET' && !pathname.startsWith('/api/')) this.redirect(res, '/__test/login')
    else {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(
        JSON.stringify({
          error: '测试入口登录已失效，请刷新页面重新登录；房间身份仍保留在本浏览器',
          code: 'test_access_required',
        }),
      )
    }
    return true
  }
}
