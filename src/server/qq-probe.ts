import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'

export const QQ_API = 'https://api.bot.qq.com'
export const GROUP_INTENT = 1 << 25
export const probeConfigSchema = z
  .object({
    appId: z
      .string()
      .trim()
      .regex(/^\d{1,32}$/, 'AppID 应为数字'),
    appSecret: z.string().trim().min(1).max(256).optional(),
    testUrl: z.string().trim().max(2048).default(''),
  })
  .strict()
export type ProbeKind = 'passive' | 'active' | 'text_url' | 'markdown_url' | 'button'
export type Check = {
  status: 'not_tested' | 'passed' | 'failed' | 'unknown'
  at?: string
  detail?: string
}
type Inbox = { id: string; groupId: string; at: number; command: string; replySeq: number }
type Sent = {
  id: string
  groupId: string
  kind: ProbeKind
  at: string
  status: 'sending' | 'sent' | 'failed' | 'unknown'
  messageId?: string
  detail?: string
  code?: number
  testUrl?: string
}
type Config = { appId: string; appSecret: string; testUrl: string }
type ProbeData = {
  version: 1
  appId: string
  selectedGroup: string
  autoReply: boolean
  checks: Record<string, Check>
  displays: Record<string, Check>
  inbox: Inbox[]
  sends: Sent[]
}
const fresh = (appId = ''): ProbeData => ({
  version: 1,
  appId,
  selectedGroup: '',
  autoReply: false,
  checks: {},
  displays: {},
  inbox: [],
  sends: [],
})
const groupMessage = z.object({
  id: z.string().min(1).max(512),
  group_openid: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  timestamp: z.string().refine((x) => Number.isFinite(Date.parse(x))),
  content: z.string().max(10000),
  author: z
    .object({
      bot: z.boolean().optional(),
      member_openid: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,128}$/)
        .optional(),
    })
    .optional(),
})
const checkSchema = z.object({
  status: z.enum(['not_tested', 'passed', 'failed', 'unknown']),
  at: z.string().max(64).optional(),
  detail: z.string().max(2048).optional(),
})
const dataSchema = z.object({
  version: z.literal(1),
  appId: z.string().max(32),
  selectedGroup: z.string().max(128),
  autoReply: z.boolean(),
  checks: z.record(z.string().max(40), checkSchema),
  displays: z.record(z.string().max(40), checkSchema),
  inbox: z
    .array(
      z.object({
        id: z.string().max(512),
        groupId: z.string().max(128),
        at: z.number().finite(),
        command: z.enum(['测试', '帮助', '其他']),
        replySeq: z.number().int().min(0).max(5),
      }),
    )
    .max(200),
  sends: z
    .array(
      z.object({
        id: z.string().max(512),
        groupId: z.string().max(128),
        kind: z.enum(['passive', 'active', 'text_url', 'markdown_url', 'button']),
        at: z.string().max(64),
        status: z.enum(['sending', 'sent', 'failed', 'unknown']),
        messageId: z.string().max(512).optional(),
        detail: z.string().max(2048).optional(),
        code: z.number().finite().optional(),
        testUrl: z.string().max(2048).optional(),
      }),
    )
    .max(100),
})

export function publicTestUrl(value: string) {
  if (!value) return ''
  let u: URL
  try {
    u = new URL(value)
  } catch {
    throw new Error('请输入完整 HTTPS 网址')
  }
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.port ||
    !u.hostname.includes('.') ||
    /^(localhost|.*\.localhost|.*\.local)$/.test(u.hostname) ||
    /^[\d.]+$/.test(u.hostname) ||
    u.hostname.includes(':')
  )
    throw new Error('使用公开 HTTPS 网址，不包含身份信息、查询参数或本机地址')
  return u.href
}

const tips: Record<number, string> = {
  40034105: '群主动发言未获授权，请在 QQ 群中检查机器人权限',
  40054010: 'QQ 不允许发送此网址；请核对链接权限与域名配置',
  40034127: 'Markdown 权限未获准，请核对当前账号能力',
  40054002: '机器人被禁言，请检查测试群权限',
  40054003: '机器人尚未加入该群',
  40034101: '机器人尚未加入该群',
  40034100: '发送频率或配额已超限，请稍后手动测试',
  40034128: '被动回复窗口或次数已用完，请重新 @Bot',
  40034005: '被动消息已过期，请重新 @Bot',
  304103: '被动消息已过期，请重新 @Bot',
  40054005: 'QQ 已去重该请求；核对发送结果，避免重复发送',
}
class QqError extends Error {
  constructor(
    public code: number,
    public uncertain = false,
  ) {
    super(
      tips[code] ??
        (code === 401 || code === 403
          ? 'QQ 鉴权或接口权限失败，请核对凭证与账号配置'
          : uncertain
            ? '发送结果未能确认，请先查看 QQ 群；不会自动重发'
            : `QQ 接口未通过（错误码 ${code}），请核对官方文档`),
    )
  }
}

type SocketLike = Pick<WebSocket, 'send' | 'close' | 'addEventListener' | 'readyState'>
export type QqIncoming = { id: string; groupId: string; at: number; text: string; userId?: string }
export type QqDelivery = {
  status: 'sent' | 'failed' | 'unknown'
  detail: string
  messageId?: string
  retryable?: boolean
  code?: number
}
export class QqProbe {
  private lease = ''
  private handler?: (message: QqIncoming) => Promise<void>
  onCommand(handler: (message: QqIncoming) => Promise<void>) {
    this.handler = handler
  }
  /** Production text delivery; credentials and access tokens remain inside the transport. */
  deliver(
    groupId: string,
    text: string,
    source?: { id: string; sequence: number },
  ): Promise<QqDelivery> {
    return this.serialize(async () => {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(groupId) || !text || text.length > 1800)
        throw Error('群消息格式不合法')
      if (this.status !== 'connected') return { status: 'failed', detail: 'Bot 尚未连接' }
      let submitted = false
      try {
        const token = await this.accessToken()
        submitted = true
        const body = await this.jsonRequest(
          `${QQ_API}/v2/groups/${encodeURIComponent(groupId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
            body: JSON.stringify({
              msg_type: 0,
              content: text,
              ...(source ? { msg_id: source.id, msg_seq: source.sequence } : {}),
            }),
          },
        )
        if (typeof body.id !== 'string' || !body.id) throw new QqError(0, true)
        return { status: 'sent', detail: 'QQ API 已确认；真实群显示另行核对', messageId: body.id }
      } catch (error) {
        return {
          status: submitted && error instanceof QqError && error.uncertain ? 'unknown' : 'failed',
          detail: error instanceof QqError ? error.message : '发送未完成，请核对连接',
          ...(error instanceof QqError ? { code: error.code } : {}),
          retryable:
            error instanceof QqError &&
            ((!submitted && error.uncertain) || error.code === 429 || error.code === 40034100),
        }
      }
    })
  }
  private config: Config = { appId: '', appSecret: '', testUrl: '' }
  private data = fresh()
  private writes: Promise<void> = Promise.resolve()
  private actions: Promise<unknown> = Promise.resolve()
  private token = ''
  private tokenUntil = 0
  private socket?: SocketLike
  private session = ''
  private seq: number | null = null
  private gateway = ''
  private epoch = 0
  private wanted = false
  private retries = 0
  private heartbeat?: ReturnType<typeof setInterval>
  private reconnect?: ReturnType<typeof setTimeout>
  private handshake?: ReturnType<typeof setTimeout>
  private awaitingAck = false
  private status = 'unconfigured'
  private lastError = ''
  private lastHeartbeat = ''
  constructor(
    private directory: string,
    private fetcher: typeof fetch = fetch,
    private socketFactory: (url: string) => SocketLike = (url) => new WebSocket(url),
    private now = () => Date.now(),
    private lockDirectory?: string,
  ) {}

  async init() {
    await mkdir(this.directory, { recursive: true })
    try {
      const config: unknown = JSON.parse(
        await readFile(path.join(this.directory, 'credentials.json'), 'utf8'),
      )
      const parsed = probeConfigSchema.parse(config)
      this.config = {
        appId: parsed.appId,
        appSecret: parsed.appSecret ?? '',
        testUrl: publicTestUrl(parsed.testUrl),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        this.lastError = '本机凭证配置无法读取，请重新填写保存'
    }
    try {
      const saved = dataSchema.parse(
        JSON.parse(await readFile(path.join(this.directory, 'results.json'), 'utf8')),
      )
      if (
        saved.version === 1 &&
        saved.appId === this.config.appId &&
        Array.isArray(saved.inbox) &&
        Array.isArray(saved.sends)
      ) {
        this.data = saved
        this.data.inbox = saved.inbox.slice(-200)
        this.data.sends = saved.sends
          .slice(-100)
          .map((s) =>
            s.status === 'sending'
              ? { ...s, status: 'unknown', detail: '上次进程结束时尚未确认，请查看测试群后处理' }
              : s,
          )
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        this.lastError = '本机验证记录无法读取，将使用新的验证记录'
    }
    if (this.data.appId !== this.config.appId) this.data = fresh(this.config.appId)
    this.status = this.config.appId && this.config.appSecret ? 'disconnected' : 'unconfigured'
  }
  private async atomic(file: string, value: unknown) {
    const target = path.join(this.directory, file),
      tmp = `${target}.${randomUUID()}.tmp`
    await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
    await rename(tmp, target)
  }
  private update(edit: (next: ProbeData) => void) {
    const job = this.writes.then(async () => {
      const next = structuredClone(this.data)
      edit(next)
      await this.atomic('results.json', next)
      this.data = next
    })
    this.writes = job.catch(() => {})
    return job
  }
  private serialize<T>(run: () => Promise<T>): Promise<T> {
    const job = this.actions.then(run)
    this.actions = job.catch(() => {})
    return job
  }
  snapshot() {
    return {
      protocol: 'qq-probe-1',
      status: this.status,
      lastError: this.lastError,
      lastHeartbeat: this.lastHeartbeat,
      config: {
        appId: this.config.appId,
        secretConfigured: Boolean(this.config.appSecret),
        testUrl: this.config.testUrl,
      },
      ...structuredClone(this.data),
      inbox: this.data.inbox.slice(-20).reverse(),
      sends: this.data.sends.slice(-30).reverse(),
      groups: [...new Set(this.data.inbox.map((x) => x.groupId))],
      realConnection: this.status === 'connected',
    }
  }
  report() {
    return {
      ...this.snapshot(),
      reportAt: new Date(this.now()).toISOString(),
      scope: 'QQ-0 本机接入验证；未接角色、正式房间或模型',
      evidence: '接口结果与人工显示确认分别记录；未测试项不等于通过',
    }
  }
  async saveConfig(input: unknown) {
    return this.serialize(async () => {
      if (this.wanted) throw new Error('请先断开 Bot 连接，再修改凭证或网址')
      const v = probeConfigSchema.parse(input)
      const secret = v.appSecret ?? (v.appId === this.config.appId ? this.config.appSecret : '')
      if (!secret) throw new Error('首次配置或更换 AppID 时需要填写 AppSecret')
      const next = { appId: v.appId, appSecret: secret, testUrl: publicTestUrl(v.testUrl) }
      await this.atomic('credentials.json', next)
      if (next.appId !== this.config.appId || next.appSecret !== this.config.appSecret) {
        await this.update((d) => Object.assign(d, fresh(next.appId)))
        this.gateway = ''
        this.session = ''
        this.seq = null
      } else if (next.testUrl !== this.config.testUrl) {
        await this.update((d) => {
          for (const key of ['text_url', 'markdown_url', 'button']) {
            delete d.checks[key]
            delete d.displays[key]
          }
        })
      }
      this.config = next
      this.token = ''
      this.tokenUntil = 0
      this.status = 'disconnected'
      this.lastError = ''
    })
  }
  async selectGroup(groupId: string) {
    return this.serialize(async () => {
      if (!this.data.inbox.some((x) => x.groupId === groupId))
        throw new Error('请先在测试群 @Bot，再从已收到事件的群中选择')
      await this.update((d) => {
        if (d.selectedGroup !== groupId) {
          for (const kind of ['receive', 'passive', 'active', 'text_url', 'markdown_url', 'button'])
            delete d.checks[kind]
          d.displays = {}
          d.autoReply = false
        }
        d.selectedGroup = groupId
        d.checks.receive = {
          status: 'passed',
          at: new Date(this.now()).toISOString(),
          detail: '已收到该群的真实 @ 事件',
        }
      })
    })
  }
  async autoReply(enabled: boolean) {
    if (enabled && !this.data.selectedGroup) throw new Error('先选择测试群')
    await this.update((d) => {
      d.autoReply = enabled
    })
  }
  async display(kind: ProbeKind, passed: boolean) {
    if (this.data.checks[kind]?.status !== 'passed') throw new Error('请先完成对应 API 发送测试')
    await this.update((d) => {
      d.displays[kind] = {
        status: passed ? 'passed' : 'failed',
        at: new Date(this.now()).toISOString(),
        detail: '操作者在 QQ 客户端确认显示／跳转结果',
      }
    })
  }
  private async jsonRequest(url: string, init: RequestInit = {}) {
    let response: Response
    try {
      response = await this.fetcher(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      })
    } catch {
      throw new QqError(0, true)
    }
    let body: Record<string, unknown>
    try {
      body = (await response.json()) as Record<string, unknown>
    } catch {
      throw new QqError(response.status, response.status >= 500 || response.ok)
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new QqError(response.status, response.ok || response.status >= 500)
    const code = Number(body.code ?? 0)
    if (!response.ok || code)
      throw new QqError(
        Number.isFinite(code) && code ? code : response.status,
        response.status >= 500,
      )
    return body
  }
  private async accessToken() {
    if (this.token && this.tokenUntil > this.now() + 60000) return this.token
    const body = await this.jsonRequest(`${QQ_API}/app/getAppAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: this.config.appId, clientSecret: this.config.appSecret }),
    })
    if (
      typeof body.access_token !== 'string' ||
      !body.access_token ||
      !Number.isFinite(Number(body.expires_in)) ||
      Number(body.expires_in) <= 0
    )
      throw new QqError(401)
    this.token = body.access_token
    this.tokenUntil = this.now() + Number(body.expires_in) * 1000
    return this.token
  }
  private async api(route: string, init: RequestInit = {}) {
    const token = await this.accessToken()
    return this.jsonRequest(`${QQ_API}${route}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `QQBot ${token}`,
        ...init.headers,
      },
    })
  }
  connect() {
    return this.serialize(async () => {
      if (this.wanted) throw new Error('Bot 正在连接或已连接')
      if (!this.config.appId || !this.config.appSecret) throw new Error('先保存 AppID 与 AppSecret')
      if (this.lockDirectory && !this.lease) {
        mkdirSync(this.lockDirectory, { recursive: true })
        const file = path.join(this.lockDirectory, this.config.appId + '.lock')
        try {
          writeFileSync(file, String(process.pid), { flag: 'wx', mode: 0o600 })
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          const pid = Number(readFileSync(file, 'utf8'))
          if (!Number.isInteger(pid) || pid < 1) throw Error('Bot 锁文件不可用；请由部署者检查')
          let alive = true
          try {
            process.kill(pid, 0)
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ESRCH') alive = false
          }
          if (alive) throw Error('同一 Bot 已被另一实例或 QQ-0 探针占用；请先停止旧连接')
          unlinkSync(file)
          writeFileSync(file, String(process.pid), { flag: 'wx', mode: 0o600 })
        }
        this.lease = file
      }
      this.wanted = true
      this.retries = 0
      this.lastError = ''
      this.epoch++
      await this.open(this.epoch)
    })
  }
  disconnect() {
    if (this.lease) {
      try {
        if (readFileSync(this.lease, 'utf8') === String(process.pid)) unlinkSync(this.lease)
      } catch {
        /* Missing lease is already released. */
      }
      this.lease = ''
    }
    this.wanted = false
    this.epoch++
    this.clearTimers()
    this.socket?.close(1000, 'local stop')
    this.socket = undefined
    this.token = ''
    this.tokenUntil = 0
    this.status = this.config.appId ? 'disconnected' : 'unconfigured'
  }
  private clearTimers() {
    clearInterval(this.heartbeat)
    clearTimeout(this.handshake)
    clearTimeout(this.reconnect)
    this.heartbeat = undefined
    this.handshake = undefined
    this.reconnect = undefined
    this.awaitingAck = false
  }
  private async open(epoch: number) {
    this.status = 'connecting'
    try {
      await this.accessToken()
      if (!this.wanted || epoch !== this.epoch) return
      await this.update((d) => {
        d.checks.auth = {
          status: 'passed',
          at: new Date(this.now()).toISOString(),
          detail: 'QQ 返回有效访问凭证',
        }
      })
      if (!this.gateway) {
        const body = await this.api('/gateway')
        if (typeof body.url !== 'string') throw new QqError(502)
        const u = new URL(body.url)
        if (u.protocol !== 'wss:' || !u.hostname.endsWith('.qq.com') || u.username || u.password)
          throw new Error('QQ 网关地址未通过验证')
        this.gateway = u.href
      }
      if (!this.wanted || epoch !== this.epoch) return
      await this.update((d) => {
        d.checks.gateway = {
          status: 'passed',
          at: new Date(this.now()).toISOString(),
          detail: '已获得官方 WSS 网关',
        }
      })
      const socket = this.socketFactory(this.gateway)
      this.socket = socket
      let inbound: Promise<void> = Promise.resolve()
      socket.addEventListener('message', (event) => {
        if (!this.wanted || this.socket !== socket || epoch !== this.epoch) return
        // Heartbeat ACKs must not wait behind a slow passive reply request.
        try {
          const raw = String((event as MessageEvent).data)
          if (raw.length <= 1024 * 1024 && JSON.parse(raw)?.op === 11) {
            this.awaitingAck = false
            this.lastHeartbeat = new Date(this.now()).toISOString()
            return
          }
        } catch {
          /* The ordered handler below handles malformed frames. */
        }
        inbound = inbound
          .then(async () => {
            if (!this.wanted || this.socket !== socket || epoch !== this.epoch) return
            const raw = String((event as MessageEvent).data)
            if (raw.length > 1024 * 1024) throw new Error('QQ 网关消息超出本机验证限制')
            await this.frame(JSON.parse(raw), socket)
          })
          .catch(() => {
            this.lastError = '网关事件无法安全处理或记录，请检查本机目录后重连'
            socket.close(4000, 'local event failure')
          })
      })
      socket.addEventListener('error', () => {
        if (this.socket === socket) this.lastError = 'QQ 网关连接异常，请检查网络与 WebSocket 设置'
      })
      socket.addEventListener('close', (event) => {
        if (this.socket !== socket || epoch !== this.epoch) return
        this.socket = undefined
        this.clearTimers()
        const code = (event as CloseEvent).code
        if ([4001, 4002, 4010, 4011, 4012, 4013, 4014, 4914, 4915].includes(code)) {
          this.wanted = false
          this.status = 'error'
          this.lastError = `QQ 网关拒绝连接（${code}），请核对账号权限、环境与事件设置`
          return
        }
        if ([4006, 4007].includes(code) || (code >= 4900 && code <= 4913)) {
          this.session = ''
          this.seq = null
        }
        this.schedule(epoch)
      })
      this.handshake = setTimeout(() => {
        if (this.status !== 'connected' && this.socket === socket)
          socket.close(4000, 'ready timeout')
      }, 20000)
      this.handshake.unref()
    } catch (error) {
      if (!this.wanted || epoch !== this.epoch) return
      this.lastError =
        error instanceof QqError ? error.message : '连接失败，请核对凭证、QQ 设置及本机网络'
      this.wanted = false
      this.status = 'error'
      await this.update((d) => {
        d.checks.connection = {
          status: 'failed',
          at: new Date(this.now()).toISOString(),
          detail: this.lastError,
        }
      })
    }
  }
  private schedule(epoch: number) {
    if (!this.wanted) return
    this.status = 'reconnecting'
    const delay = Math.min(60000, 2000 * 2 ** Math.min(this.retries++, 5))
    this.reconnect = setTimeout(() => {
      void this.open(epoch).catch(() => {
        this.wanted = false
        this.status = 'error'
        this.lastError = '本机验证记录无法保存，请检查目录后重连'
      })
    }, delay)
    this.reconnect.unref()
  }
  private async frame(v: unknown, socket: SocketLike) {
    if (!v || typeof v !== 'object') return
    const f = v as { op?: number; d?: unknown; s?: number; t?: string }
    if (f.op === 10) {
      const interval = Number((f.d as { heartbeat_interval?: number })?.heartbeat_interval)
      if (!Number.isFinite(interval) || interval < 1000 || interval > 180000)
        throw new Error('Invalid heartbeat')
      socket.send(
        JSON.stringify(
          this.session && this.seq !== null
            ? {
                op: 6,
                d: { token: `QQBot ${this.token}`, session_id: this.session, seq: this.seq },
              }
            : {
                op: 2,
                d: {
                  token: `QQBot ${this.token}`,
                  intents: GROUP_INTENT,
                  shard: [0, 1],
                  properties: { $os: process.platform, $browser: 'trpg-qq0', $device: 'trpg-qq0' },
                },
              },
        ),
      )
      clearInterval(this.heartbeat)
      this.heartbeat = setInterval(() => {
        if (socket.readyState !== 1) return
        if (this.awaitingAck) {
          socket.close(4000, 'heartbeat timeout')
          return
        }
        this.awaitingAck = true
        socket.send(JSON.stringify({ op: 1, d: this.seq }))
      }, interval)
      this.heartbeat.unref()
      return
    }
    if (f.op === 11) {
      this.awaitingAck = false
      this.lastHeartbeat = new Date(this.now()).toISOString()
      return
    }
    if (f.op === 1) {
      socket.send(JSON.stringify({ op: 1, d: this.seq }))
      return
    }
    if (f.op === 7) {
      socket.close(4000, 'server reconnect')
      return
    }
    if (f.op === 9) {
      this.session = ''
      this.seq = null
      socket.close(4000, 'invalid session')
      return
    }
    if (f.op !== 0) return
    if (f.t === 'READY') {
      const session = (f.d as { session_id?: unknown })?.session_id
      if (typeof session !== 'string' || !session) throw new Error('Invalid session')
      this.session = session
    }
    if (f.t === 'READY' || f.t === 'RESUMED') {
      this.status = 'connected'
      this.retries = 0
      this.lastError = ''
      clearTimeout(this.handshake)
      await this.update((d) => {
        d.checks.ready = {
          status: 'passed',
          at: new Date(this.now()).toISOString(),
          detail: '官方网关已确认事件连接',
        }
      })
    }
    if (f.t === 'GROUP_AT_MESSAGE_CREATE') await this.receive(f.d)
    if (Number.isInteger(f.s) && f.s! >= 0) this.seq = f.s!
  }
  private async receive(input: unknown) {
    const parsed = groupMessage.safeParse(input)
    if (!parsed.success || parsed.data.author?.bot) return
    const m = parsed.data,
      at = Date.parse(m.timestamp)
    if (
      at > this.now() + 30000 ||
      this.data.inbox.some((x) => x.id === m.id && x.groupId === m.group_openid)
    )
      return
    const text = m.content.trim().replace(/^\//, '').trim()
    const command = /^(测试|ping)$/i.test(text) ? '测试' : text === '帮助' ? '帮助' : '其他'
    await this.update((d) => {
      d.inbox.push({ id: m.id, groupId: m.group_openid, at, command, replySeq: 0 })
      d.inbox = d.inbox.slice(-200)
      if (d.selectedGroup === m.group_openid)
        d.checks.receive = {
          status: 'passed',
          at: new Date(this.now()).toISOString(),
          detail: '已收到所选测试群 @ 事件',
        }
    })
    if (this.handler && this.now() - at < 300000) {
      await this.handler({
        id: m.id,
        groupId: m.group_openid,
        at,
        text,
        userId: m.author?.member_openid,
      })
      return
    }
    if (
      this.data.autoReply &&
      this.data.selectedGroup === m.group_openid &&
      command !== '其他' &&
      this.now() - at < 300000
    )
      await this.test('passive')
  }
  test(kind: ProbeKind, mode: 'passive' | 'active' = 'passive') {
    return this.serialize(async () => {
      if (this.status !== 'connected') throw new Error('请先连接 Bot 并等待事件连接成功')
      const groupId = this.data.selectedGroup
      if (!groupId) throw new Error('请先选择已收到 @ 事件的测试群')
      const passive = kind === 'passive' || (kind !== 'active' && mode === 'passive')
      const source = [...this.data.inbox]
        .reverse()
        .find((x) => x.groupId === groupId && this.now() - x.at < 300000 && x.replySeq < 5)
      if (passive && !source) throw new Error('没有可用的 5 分钟回复窗口，请在测试群重新 @Bot')
      const url = publicTestUrl(this.config.testUrl)
      if (['text_url', 'markdown_url', 'button'].includes(kind) && !url)
        throw new Error('请先保存公开 HTTPS 测试网址；正式域名可留到 QQ-1 后测')
      const id = randomUUID(),
        marker = id.slice(0, 8)
      let msgSeq = 0
      await this.update((d) => {
        if (passive) {
          const item = d.inbox.find((x) => x.id === source!.id && x.groupId === groupId)!
          msgSeq = ++item.replySeq
        }
        d.sends.push({
          id,
          groupId,
          kind,
          ...(['text_url', 'markdown_url', 'button'].includes(kind) ? { testUrl: url } : {}),
          at: new Date(this.now()).toISOString(),
          status: 'sending',
        })
        d.sends = d.sends.slice(-100)
      })
      const text =
        kind === 'active'
          ? `QQ-0 主动测试广播：本机连接验证。编号 ${marker}`
          : `QQ-0 已收到 @ 指令，本机回复验证。编号 ${marker}`
      const body: Record<string, unknown> =
        kind === 'text_url'
          ? { msg_type: 0, content: `QQ-0 文本链接测试 ${marker}\n${url}` }
          : kind === 'markdown_url'
            ? {
                msg_type: 2,
                markdown: { content: `QQ-0 Markdown 链接测试 ${marker}\n[打开测试页面](${url})` },
              }
            : kind === 'button'
              ? {
                  msg_type: 2,
                  markdown: { content: `QQ-0 跳转按钮测试 ${marker}` },
                  keyboard: {
                    content: {
                      rows: [
                        {
                          buttons: [
                            {
                              id: marker,
                              render_data: {
                                label: '打开测试页面',
                                visited_label: '已打开',
                                style: 1,
                              },
                              action: { type: 0, permission: { type: 2 }, data: url },
                            },
                          ],
                        },
                      ],
                    },
                  },
                }
              : { msg_type: 0, content: text }
      if (passive) Object.assign(body, { msg_id: source!.id, msg_seq: msgSeq })
      let result: Sent
      let submitted = false
      const sendEpoch = this.epoch
      try {
        const token = await this.accessToken()
        if (this.status !== 'connected' || sendEpoch !== this.epoch)
          throw new Error('连接已改变，发送取消')
        submitted = true
        const response = await this.jsonRequest(
          `${QQ_API}/v2/groups/${encodeURIComponent(groupId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${token}` },
            body: JSON.stringify(body),
          },
        )
        if (typeof response.id !== 'string' || !response.id || response.id.length > 512)
          throw new QqError(0, true)
        result = {
          id,
          groupId,
          kind,
          at: new Date(this.now()).toISOString(),
          status: 'sent',
          messageId: response.id,
          detail: 'QQ API 确认发送成功；请在客户端确认显示／跳转',
        }
      } catch (error) {
        result = {
          id,
          groupId,
          kind,
          at: new Date(this.now()).toISOString(),
          status: submitted && error instanceof QqError && error.uncertain ? 'unknown' : 'failed',
          detail: error instanceof QqError ? error.message : '发送未完成，请核对连接和本机记录',
          ...(error instanceof QqError ? { code: error.code } : {}),
        }
      }
      if (['text_url', 'markdown_url', 'button'].includes(kind)) result.testUrl = url
      await this.update((d) => {
        const index = d.sends.findIndex((s) => s.id === id)
        d.sends[index] = result
        d.checks[kind] = {
          status:
            result.status === 'sent'
              ? 'passed'
              : result.status === 'unknown'
                ? 'unknown'
                : 'failed',
          at: result.at,
          detail: result.detail,
        }
        delete d.displays[kind]
      })
      return result
    })
  }
}
