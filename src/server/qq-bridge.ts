import {errorPresentation} from '../shared/localization/errors'
import {formatSystemText, type SystemMessageKey, localizedEvent} from '../shared/localization/system-messages'
import {localeOrDefault, type Locale} from '../shared/localization/locale'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  outputIdentity,
  type QqBridgeOptions,
  type QqOutputRole,
  type QqRoutingEvent,
} from './qq-routing'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { RoomError } from './room-engine'
import type { RoomStore } from './room-store'
import type { QqIncoming, QqDelivery } from './qq-probe'
import type { BroadcastEvent } from '../core/broadcast-types'

const text = z.string().max(1800),
  id = z.string().max(128)
const messageId = z.string().min(1).max(512)
const limitsSchema = z
  .object({
    backlog: z.number().int().min(1).max(30).default(12),
    maxAgeSeconds: z.number().int().min(60).max(1800).default(300),
    sendIntervalSeconds: z.number().int().min(10).max(60).default(10),
    maxChars: z.number().int().min(300).max(1700).default(1700),
    daily: z.number().int().min(1).max(800).default(800),
  })
  .strict()
const taskSchema = z.object({
  eventId: id.optional(),
  conversationId: id.optional(),
  requiresPassive: z.boolean().optional(),
  noAutoRetry: z.boolean().optional(),
  source: z
    .object({ id: messageId, sequence: z.number().int().min(1).max(5), expires: z.number() })
    .optional(),
  eventSequence: z.number().int().positive().optional(),
  role: z.enum(['system', 'narration', 'npc']).optional(),
  group: z.string().max(200).optional(),
  routeRevision: z.number().int().nonnegative().optional(),
  id,
  branch: id,
  text,
  at: z.number(),
  attempts: z.number().int(),
  nextAt: z.number().default(0),
  status: z.enum(['queued', 'sending', 'sent', 'failed', 'unknown', 'canceled']),
  detail: z.string().max(300),
})
const bindingSchema = z.object({
  id,
  roomId: z.string().uuid(),
  groupId: id,
  label: z.string().max(60),
  branch: id,
  cursor: z.number().int().nonnegative(),
  paused: z.boolean(),
  webOnly: z.boolean().optional(),
  deliveryGeneration: z.number().int().nonnegative().optional(),
  detailed: z.boolean(),
  limits: limitsSchema.default(() => limitsSchema.parse({})),
  latest: text,
  buffer: z.array(text).max(100),
  tasks: z.array(taskSchema).max(500),
  lastSend: z.number(),
  day: z.string().max(10),
  sends: z.number().int().nonnegative(),
})
const codeSchema = z.object({
  hash: id,
  roomId: z.string().uuid(),
  owner: id,
  expires: z.number(),
  groupId: id,
  marker: z.string().max(12),
})
const stateSchema = z
  .object({
    version: z.literal(1),
    botAppId: z.string().max(32).default(''),
    bindings: z.array(bindingSchema).max(100),
    history: z.array(bindingSchema).max(100).default([]),
    queries: z
      .array(
        z.object({
          id: z.string().uuid(),
          roomId: id,
          command: z.string().max(20),
          conversationId: id.optional(),
          at: z.number(),
          status: z.enum(['sending', 'sent', 'failed', 'unknown']),
          detail: z.string().max(300),
        }),
      )
      .max(200)
      .default([]),
    codes: z.array(codeSchema).max(100),
    sources: z
      .array(z.object({ bindingId: id, conversationId: id, id: messageId, at: z.number() }))
      .max(1000)
      .default([]),
    ingress: z
      .array(z.object({ bindingId: id, source: id, id: messageId, at: z.number() }))
      .max(1000)
      .default([]),
    seen: z.array(id).max(1000),
  })
  .strict()
type State = z.infer<typeof stateSchema>
type Binding = State['bindings'][number]
type Task = Binding['tasks'][number]
type Transport = {
  deliver(
    group: string,
    content: string,
    source?: { id: string; sequence: number },
  ): Promise<QqDelivery>
}
const digest = (s: string) => createHash('sha256').update(s).digest('hex')
const cap = (s: string, max = 1700, locale:Locale='zh-CN') =>
  s.length > max ? s.slice(0, max - 40) + (locale==='en'?'\n(More details on the Web)':'\n（更多明细请查看 Web）') : s
const boundaries = new Set([
  'encounter.active',
  'encounter.roster',
  'turn.change',
  'encounter.ended',
  'scene.enter',
  'scene.leave',
  'exploration.round-ended',
])
const outputOrder = { system: 0, narration: 1, npc: 2 }

export class QqBridge {
  private persisted = ''
  private state: State = {
    version: 1,
    botAppId: '',
    bindings: [],
    history: [],
    queries: [],
    codes: [],
    seen: [],
    sources: [],
    ingress: [],
  }
  private serial: Promise<unknown> = Promise.resolve()
  private timer?: ReturnType<typeof setInterval>
  private faults = new Map<string, string>()
  private attempts = new Map<string, { at: number; count: number }>()
  private lastSend = 0
  private stopped = false
  constructor(
    public directory: string,
    private rooms: RoomStore,
    private transport: Transport,
    private connected: () => boolean,
    private now = () => Date.now(),
    private entry = '',
    private appId = '',
    private backupEntry = '',
    private options: QqBridgeOptions = {},
  ) {}
  async init() {
    await mkdir(this.directory, { recursive: true })
    try {
      this.state = stateSchema.parse(
        JSON.parse(await readFile(path.join(this.directory, 'bridge.json'), 'utf8')),
      )
      this.persisted = JSON.stringify(this.state)
      if (this.state.botAppId !== this.appId && this.state.bindings.length)
        throw Error('Bot 主体改变，原关联不可用')
      this.state.botAppId = this.appId
      for (const b of this.state.bindings)
        for (const t of b.tasks)
          if (t.status === 'sending') {
            t.status = 'unknown'
            t.detail = '进程中断时结果未确认；请查看群后处理，未自动重发'
          }
      for (const q of this.state.queries)
        if (q.status === 'sending') {
          q.status = 'unknown'
          q.detail = '进程中断时回复未确认；请在群重新查询'
        }
      await this.save(this.state)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw Error('QQ 关联记录或 Bot 主体不可用，拒绝启动')
    }
    this.state.botAppId = this.appId
    for (const b of this.state.bindings)
      await this.rooms.qqBind(b.roomId, b.id, !!this.options.additional)
    await this.recoverSources()
  }
  /** Recover only committed room receipts; never replay gameplay or call a model here. */
  private async recoverSources() {
    const next = structuredClone(this.state)
    for (const r of next.ingress) {
      const b = next.bindings.find((b) => b.id === r.bindingId)
      if (!b) continue
      const receipt = this.rooms.qqInputReceipt(b.roomId, b.id, r.source)
      if (
        receipt?.conversationId &&
        !next.sources.some(
          (s) =>
            s.bindingId === b.id && s.conversationId === receipt.conversationId && s.id === r.id,
        )
      )
        next.sources.push({
          bindingId: b.id,
          conversationId: receipt.conversationId,
          id: r.id,
          at: r.at,
        })
    }
    next.sources = next.sources.filter((s) => s.at > this.now() - 86400000).slice(-1000)
    await this.save(next)
  }
  private async save(next: State) {
    stateSchema.parse(next)
    const serialized = JSON.stringify(next)
    if (serialized === this.persisted) {
      this.state = next
      return
    }
    const target = path.join(this.directory, 'bridge.json'),
      temp = target + '.' + randomUUID() + '.tmp'
    await writeFile(temp, serialized, { mode: 0o600 })
    await rename(temp, target)
    this.state = next
    this.persisted = serialized
  }
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const job = this.serial.catch(() => {}).then(fn)
    this.serial = job
    return job
  }
  start() {
    clearInterval(this.timer)
    this.stopped = false
    this.timer = setInterval(() => {
      void this.tick().catch(() => {
        this.faults.set('*', 'QQ 投递记录写入失败，请查看服务日志与磁盘')
      })
    }, 2000)
    this.timer.unref()
  }
  async close() {
    this.stopped = true
    clearInterval(this.timer)
    await this.serial.catch(() => {})
  }
  hasBinding(roomId: string) {
    return this.state.bindings.some((b) => b.roomId === roomId)
  }
  runSummary(roomId: string, token: string) {
    if (this.rooms.authenticate(roomId, token).role !== 'gm')
      throw new RoomError('运行摘要仅供GM查看', 403)
    const b = this.state.bindings.find((b) => b.roomId === roomId)
    const tasks = b?.tasks.filter((t) => t.branch === b.branch) ?? []
    return {
      bindingId: b?.id,
      boundBots: b ? 1 : 0,
      connectedBots: b && this.connected() ? 1 : 0,
      pausedBots: b?.paused ? 1 : 0,
      queued: tasks.filter((t) => ['queued', 'sending'].includes(t.status)).length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      unknown: tasks.filter((t) => t.status === 'unknown').length,
    }
  }
  pairingBinding(roomId: string) {
    return this.state.bindings.find((b) => b.roomId === roomId)?.id
  }
  async discardUnsent(reason: string) {
    await this.run(async () => {
      const next = structuredClone(this.state)
      for (const b of next.bindings) {
        this.cancel(b)
        for (const t of b.tasks) if (t.status === 'canceled') t.detail = reason
        const { feed } = this.rooms.qqPublic(b.roomId)
        b.branch = feed.branchId
        b.cursor = feed.head
      }
      await this.save(next)
    })
  }
  collectedThrough(roomId: string, branch: string, sequence: number) {
    return this.state.bindings.some(
      (b) => b.roomId === roomId && b.branch === branch && b.cursor >= sequence,
    )
  }
  pendingGroup(roomId: string, role: QqOutputRole, group: string, branch?: string) {
    return this.state.bindings.some(
      (b) =>
        b.roomId === roomId &&
        b.tasks.some(
          (t) =>
            (t.role ?? 'system') === role &&
            t.group === group &&
            (!branch || t.branch === branch) &&
            !['sent', 'canceled'].includes(t.status),
        ),
    )
  }
  private authorize(roomId: string, token: string) {
    const m = this.rooms.authenticate(roomId, token)
    if (m.role !== 'gm') throw new RoomError('QQ 关联操作需要房间 GM', 403)
    return m
  }
  status(roomId: string, token: string) {
    const m = this.authorize(roomId, token),
      b = this.state.bindings.find((b) => b.roomId === roomId)
    return {
      connected: this.connected(),
      entry: this.entry,
      error: this.faults.get(roomId) ?? this.faults.get('*') ?? '',
      queries: this.state.queries
        .filter((q) => q.roomId === roomId)
        .slice(-20)
        .reverse(),
      pending: this.state.codes
        .filter((c) => c.roomId === roomId && c.owner === m.id && c.expires > this.now())
        .map((c) => ({ marker: c.marker, expires: c.expires, claimed: !!c.groupId })),
      history: this.state.history
        .filter((x) => x.roomId === roomId)
        .map((x) => ({
          label: x.label,
          tasks: x.tasks.slice(-30).map((t) => ({ id: t.id, status: t.status, detail: t.detail })),
        })),
      binding: b
        ? {
            id: b.id,
            label: b.label,
            paused: b.paused,
            detailed: b.detailed,
            limits: b.limits,
            latest: b.latest,
            tasks: b.tasks
              .slice(-30)
              .reverse()
              .map((t) => ({
                id: t.id,
                status: t.status,
                detail: t.detail,
                text: t.text,
                eventId: t.eventId,
                role: t.role,
                routeRevision: t.routeRevision,
                at: t.at,
              })),
          }
        : null,
    }
  }
  async command(roomId: string, token: string, input: unknown) {
    const cmd = z
      .discriminatedUnion('type', [
        z.object({ type: z.literal('code') }).strict(),
        z
          .object({
            type: z.literal('confirm'),
            marker: z.string().regex(/^[A-F0-9]{8}$/),
            label: z.string().trim().min(1).max(60),
          })
          .strict(),
        z.object({ type: z.enum(['pause', 'resume', 'unbind']) }).strict(),
        z.object({ type: z.literal('detail'), detailed: z.boolean() }).strict(),
        z.object({ type: z.literal('limits'), limits: limitsSchema }).strict(),
        z
          .object({ type: z.literal('resolve'), taskId: z.string().uuid(), retry: z.boolean() })
          .strict(),
      ])
      .parse(input)
    return this.run(async () => {
      const m = this.authorize(roomId, token),
        next = structuredClone(this.state)
      next.codes = next.codes.filter((c) => c.expires > this.now())
      let code: string | undefined
      if (cmd.type === 'code') {
        if (next.codes.length >= 100) throw new RoomError('绑定请求过多，请稍后再试', 429)
        next.codes = next.codes.filter((c) => c.roomId !== roomId)
        code = randomBytes(8).toString('hex').toUpperCase()
        next.codes.push({
          hash: digest(code),
          roomId,
          owner: m.id,
          expires: this.now() + 10 * 60000,
          groupId: '',
          marker: '',
        })
      } else if (cmd.type === 'confirm') {
        const c = next.codes.find(
          (c) => c.roomId === roomId && c.owner === m.id && c.marker === cmd.marker && c.groupId,
        )
        if (!c) throw new RoomError('绑定请求不存在或已过期')
        if (next.bindings.some((b) => b.groupId === c.groupId && b.roomId !== roomId))
          throw new RoomError('该群已绑定其他房间；先在原房间解除关联', 409)
        const index = next.bindings.findIndex((b) => b.roomId === roomId)
        if (index >= 0) {
          const old = next.bindings.splice(index, 1)[0]!
          this.cancel(old)
          await this.rooms.qqUnbind(roomId, old.id)
          next.history.push(old)
        }
        if (next.bindings.length >= 100) throw new RoomError('关联数量已达上限')
        const { feed } = this.rooms.qqPublic(roomId)
        const b: Binding = {
          id: randomUUID(),
          roomId,
          groupId: c.groupId,
          label: cmd.label,
          branch: feed.branchId,
          cursor: feed.head,
          paused: false,
          detailed: false,
          limits: limitsSchema.parse({}),
          latest: this.summary(roomId),
          buffer: [],
          tasks: [],
          lastSend: 0,
          day: '',
          sends: 0,
        }
        await this.rooms.qqBind(roomId, b.id, !!this.options.additional)
        this.enqueue(b, this.message(roomId,'qq.first',{summary:b.latest}))
        next.bindings.push(b)
        next.codes = next.codes.filter((x) => x !== c)
      } else {
        const b = next.bindings.find((b) => b.roomId === roomId)
        if (!b) throw new RoomError('当前房间尚未关联 QQ 群')
        if (cmd.type === 'detail') b.detailed = cmd.detailed
        if (cmd.type === 'limits') b.limits = cmd.limits
        if (cmd.type === 'pause' || cmd.type === 'resume') {
          if (cmd.type === 'resume' && !b.paused) throw new RoomError('当前并未暂停')
          b.paused = cmd.type === 'pause'
          this.cancel(b)
          const { feed } = this.rooms.qqPublic(roomId)
          b.cursor = feed.head
          b.branch = feed.branchId
          if (!b.paused) {
            b.latest = this.summary(roomId)
            this.enqueue(b, this.message(roomId,'qq.resume',{summary:b.latest}))
          }
        }
        if (cmd.type === 'unbind') {
          await this.rooms.qqUnbind(roomId, b.id)
          this.cancel(b)
          next.history.push(b)
          next.bindings = next.bindings.filter((x) => x !== b)
        }
        if (cmd.type === 'resolve') {
          const t = b.tasks.find(
            (t) => t.id === cmd.taskId && ['failed', 'unknown'].includes(t.status),
          )
          if (!t) throw new RoomError('该投递无需处理')
          if (cmd.retry && t.branch !== b.branch) throw new RoomError('旧存档分支不能重发')
          t.status = cmd.retry ? 'queued' : 'canceled'
          t.attempts = 0
          t.nextAt = 0
          t.detail = cmd.retry ? 'GM 明确要求重发；可能产生重复消息' : 'GM 已处理'
        }
      }
      if (next.history.length > 100)
        throw new RoomError('历史关联记录已达上限，请由部署者归档；未自动删除')
      await this.save(next)
      return { ...this.status(roomId, token), ...(code ? { code } : {}) }
    })
  }
  memberStatus(roomId: string, token: string) {
    const binding = this.state.bindings.find((b) => b.roomId === roomId)
    return this.rooms.qqMemberView(roomId, token, binding?.id ?? '')
  }
  async memberCommand(roomId: string, token: string, input: unknown) {
    return this.run(async () => {
      const binding = this.state.bindings.find((b) => b.roomId === roomId)
      return this.rooms.qqMemberCommand(roomId, token, binding?.id ?? '', input)
    })
  }
  private roomLocale(roomId: string) {
    return localeOrDefault(roomId ? this.rooms.qqRoutingSnapshot(roomId).contentLocale : undefined)
  }
  private message(roomId:string,key:SystemMessageKey,args:Record<string,string|number>={}) {
    return formatSystemText(this.roomLocale(roomId),key,args)
  }
  private summary(roomId: string) {
    const {view}=this.rooms.qqPublic(roomId),e=view.encounter,current=e?.actors.find(a=>a.id===e.currentId)
    const msg=(key:SystemMessageKey,args:Record<string,string|number>={})=>this.message(roomId,key,args)
    return cap(msg('qq.summary',{room:view.name,scene:view.scene?.name??msg('qq.noScene'),note:view.scene?.note?'\n'+view.scene.note:'',combat:e?.phase==='active'?msg('qq.combat',{round:e.round,turn:current?msg('qq.turn',{actor:current.name}):msg('qq.gmOrder'),pending:e.pending?msg('qq.pendingAction'):''}):msg('qq.noCombat')}),1700,this.roomLocale(roomId))
  }
  private enqueue(b: Binding, content: string, event?: QqRoutingEvent) {
    const route = this.options.route?.(b.roomId, event)
    if (route && !route.accept) return
    // Never discard unsent records to make room silently.
    b.tasks = b.tasks.filter(
      (t, i) =>
        i >= b.tasks.length - 400 || ['queued', 'sending', 'unknown', 'failed'].includes(t.status),
    )
    if (b.tasks.length >= 499) throw Error('投递记录空间不足，请处理积压')
    const conversationId =
      typeof event?.facts.conversationId === 'string' ? event.facts.conversationId : undefined
    const origin = this.state.sources.find(
      (r) => r.bindingId === b.id && r.conversationId === conversationId,
    )
    if (
      conversationId &&
      this.state.queries.some(
        (q) =>
          q.roomId === b.roomId &&
          q.conversationId === conversationId &&
          ['sending', 'sent', 'unknown'].includes(q.status),
      )
    )
      return
    b.tasks.push({
      conversationId,
      noAutoRetry: event?.facts.fixedNpc === true,
      requiresPassive: !!origin || event?.facts.qqOrigin === true,
      ...(origin ? { source: { id: origin.id, sequence: 2, expires: origin.at + 300000 } } : {}),
      eventId: event?.id,
      eventSequence: event?.sequence,
      role: outputIdentity(event).role,
      group: route?.group,
      routeRevision: route?.revision,
      id: randomUUID(),
      branch: b.branch,
      text: cap(
        /^\[(系统|旁白|NPC·|System|Narration)/.test(content) ? content : (localeOrDefault(this.rooms.qqRoutingSnapshot(b.roomId).contentLocale)==='en'?'[System] ':'[系统] ') + content,
        b.limits.maxChars,
        this.roomLocale(b.roomId),
      ),
      at: this.now(),
      attempts: 0,
      nextAt: 0,
      status: 'queued',
      detail: '',
    })
  }
  private cancel(b: Binding) {
    for (const t of b.tasks)
      if (['queued', 'failed'].includes(t.status)) {
        t.status = 'canceled'
        t.detail = '暂停、换房或分支变化取消'
      }
    b.buffer = []
  }
  async receive(m: QqIncoming) {
    messageId.parse(m.id)
    await this.run(async () => {
      const key = digest(m.groupId + ':' + m.id)
      if (this.state.seen.includes(key) || this.now() - m.at > 300000 || m.at > this.now() + 30000)
        return
      const now = this.now(),
        rate = this.attempts.get(m.groupId)
      const entry = rate && now - rate.at < 60000 ? rate : { at: now, count: 0 }
      this.attempts.set(m.groupId, entry)
      if (
        ++entry.count > 10 ||
        [...this.attempts.values()]
          .filter((x) => now - x.at < 60000)
          .reduce((n, x) => n + x.count, 0) > 30
      )
        return
      if (this.attempts.size > 1000)
        for (const [group, old] of this.attempts)
          if (now - old.at > 60000) this.attempts.delete(group)
      const next = structuredClone(this.state)
      next.seen = [...next.seen, key].slice(-1000)
      let response = ''
      let conversationId: string | undefined
      let claiming = false
      const ingressBinding = next.bindings.find((b) => b.groupId === m.groupId)
      let queryRoom=ingressBinding?.roomId??''
      const msg=(key:SystemMessageKey,args:Record<string,string|number>={})=>this.message(queryRoom,key,args)
      if (
        ingressBinding &&
        this.rooms.messageDelivery(ingressBinding.roomId) === 'web' &&
        !/^(绑定|配对|连接|帮助|跑团入口|场景|战况|最新摘要|最新旁白|查询申请|撤回申请)(?:\s|$)/.test(
          m.text,
        )
      ) {
        response = msg('qq.webOnly')
        m = { ...m, text: '' }
      }
      if (/^连接\s/.test(m.text)) m = { ...m, text: m.text.replace(/^连接\s/, '配对 ') }
      if (m.text && ingressBinding && this.options.input && !/^绑定\s/.test(m.text)) {
        const normalized = this.options.input(ingressBinding.roomId, m.text, {
          identity: digest(this.appId + ':' + m.groupId + ':' + (m.userId ?? '')),
          bindingId: ingressBinding.id,
        })
        if (typeof normalized === 'string') m = { ...m, text: normalized }
        else {
          response = normalized.reply
          m = { ...m, text: '' }
        }
      }
      const match = m.text.match(/^绑定\s+([A-Fa-f0-9]{16})$/)
      if (match) {
        const c = next.codes.find(
          (c) => c.hash === digest(match[1]!.toUpperCase()) && c.expires > now,
        )
        queryRoom ||= c?.roomId ?? ''
        if (!c || (c.groupId && c.groupId !== m.groupId))
          response = msg('qq.codeExpired')
        else if (next.bindings.some((b) => b.groupId === m.groupId && b.roomId !== c.roomId))
          response = msg('qq.otherRoom')
        else {
          c.groupId = m.groupId
          c.marker ||= randomBytes(4).toString('hex').toUpperCase()
          response = msg('qq.confirmBinding',{marker:c.marker})
        }
      } else if (m.text === '帮助')
        response =
          msg('qq.help')
      else if (['跑团入口', '场景', '战况', '最新摘要', '最新旁白'].includes(m.text)) {
        const b = next.bindings.find((b) => b.groupId === m.groupId)
        if (!b) response = msg('qq.notBound')
        else if (m.text === '跑团入口')
          response = this.entry
            ? msg('qq.entry',{entry:this.entry,access:/^https:\/\/[^/]+\.ts\.net\/?$/.test(this.entry)?msg('qq.privateAccess'):msg('qq.tunnelAccess'),backup:this.backupEntry?msg('qq.backup',{entry:this.backupEntry}):''})
            : msg('qq.askEntry')
        else if (m.text === '最新旁白')
          response =
            this.rooms
              .qqPublic(b.roomId, Math.max(0, this.rooms.qqPublic(b.roomId).feed.head - 200))
              .feed.events.filter((e) => e.type === 'ai.narration' && e.audience.kind === 'public')
              .at(-1)?.text ?? msg('qq.noNarration')
        else if (m.text === '最新摘要') response = b.latest || this.summary(b.roomId)
        else response = this.summary(b.roomId)
      }
      const groupBinding = next.bindings.find((b) => b.groupId === m.groupId)
      if (
        /^(配对|行动|对话|直聊|领取回复|继续对话|加入对话|查询申请|撤回申请)(?:\s|$)/.test(m.text)
      ) {
        if (!groupBinding) response = msg('qq.notBound')
        else if (!m.userId)
          response = msg('qq.noIdentity')
        else {
          try {
            const source = digest(this.appId + ':' + m.groupId + ':' + m.id)
            // Write the raw reply credential before the room's independent durable commit.
            if (!next.ingress.some((r) => r.bindingId === groupBinding.id && r.source === source)) {
              next.ingress = next.ingress.filter((r) => r.at > now - 86400000).slice(-999)
              next.ingress.push({ bindingId: groupBinding.id, source, id: m.id, at: m.at })
            }
            const prepared = structuredClone(next)
            // Mark seen only after business commit and source association are both durable.
            prepared.seen = prepared.seen.filter((s) => s !== key)
            await this.save(prepared)
            const inputResult = await this.rooms.qqInputResult(
              groupBinding.roomId,
              groupBinding.id,
              digest(this.appId + ':' + m.groupId + ':' + m.userId),
              source,
              m.text,
            )
            response = inputResult.response
            conversationId = inputResult.conversationId
            claiming = m.text.startsWith('领取回复 ') && !!conversationId
            if (conversationId && !claiming) {
              next.sources = next.sources.filter((r) => r.at > now - 86400000).slice(-999)
              next.sources.push({ bindingId: groupBinding.id, conversationId, id: m.id, at: m.at })
            }
            if (claiming) {
              const prior = groupBinding.tasks.find(
                (t) =>
                  t.conversationId === conversationId &&
                  ['sent', 'unknown', 'sending'].includes(t.status),
              )
              const query = next.queries.find(
                (q) =>
                  q.roomId === groupBinding.roomId &&
                  q.conversationId === conversationId &&
                  ['sent', 'unknown', 'sending'].includes(q.status),
              )
              if (prior || query) {
                response = msg('qq.alreadyDelivered')
                conversationId = undefined
                claiming = false
              } else
                for (const t of groupBinding.tasks)
                  if (
                    t.conversationId === conversationId &&
                    ['queued', 'failed'].includes(t.status)
                  ) {
                    t.status = 'canceled'
                    t.detail = '由玩家明确领取，不再自动投递'
                  }
            }
          } catch (error) {
            if (!(error instanceof RoomError)) next.seen = next.seen.filter((s) => s !== key)
            response =
              error instanceof RoomError
                ? errorPresentation(error.message,this.roomLocale(queryRoom),undefined,error.status)
                : msg('qq.submitUnconfirmed')
          }
        }
      }
      await this.save(next)
      if (response && groupBinding) {
        const day = new Date(now).toISOString().slice(0, 10)
        if (groupBinding.day !== day) {
          groupBinding.day = day
          groupBinding.sends = 0
        }
        if (groupBinding.sends >= groupBinding.limits.daily) return
        groupBinding.sends++
        await this.save(next)
      }
      if (response) {
        if (!/^\[NPC·/.test(response)) response = (this.roomLocale(queryRoom)==='en'?'[System] ':'[系统] ') + response
        const q = {
          id: randomUUID(),
          roomId: queryRoom,
          ...(claiming ? { conversationId } : {}),
          command: match ? '绑定' : m.text.split(/\s/)[0]!.slice(0, 20),
          at: now,
          status: 'sending' as State['queries'][number]['status'],
          detail: '',
        }
        next.queries = [...next.queries, q].slice(-200)
        await this.save(next)
        let result: QqDelivery
        try {
          result = await this.transport.deliver(
            m.groupId,
            cap(response, groupBinding?.limits.maxChars,this.roomLocale(queryRoom)),
            { id: m.id, sequence: 1 },
          )
          if (m.text === '跑团入口' && result.status === 'failed' && result.code === 40054010) {
            const fallback = await this.transport.deliver(
              m.groupId,
              msg('qq.entryRejected'),
              { id: m.id, sequence: 2 },
            )
            result = { ...fallback, detail: '入口链接被平台拒绝；' + fallback.detail }
          }
        } catch {
          result = { status: 'unknown', detail: '查询回复未确认，请在群重新查询' }
        }
        const done = structuredClone(this.state),
          record = done.queries.find((x) => x.id === q.id)!
        record.status = result.status
        record.detail = result.detail.slice(0, 300)
        await this.save(done)
      }
    })
  }
  async tick() {
    return this.run(async () => {
      if (this.stopped) return
      await this.recoverSources()
      const next = structuredClone(this.state)
      for (const b of next.bindings) {
        try {
          const revision = this.options.route?.(b.roomId)?.revision
          for (const task of b.tasks)
            if (
              revision !== undefined &&
              (task.routeRevision ?? 0) !== revision &&
              ['queued', 'failed'].includes(task.status)
            ) {
              task.status = 'canceled'
              task.detail = 'Bot路由已改变，旧待发任务取消；Web记录保留'
            }
          let { feed } = this.rooms.qqPublic(b.roomId, b.cursor)
          const delivery = this.rooms.messageDeliveryStatus(b.roomId)
          if (this.rooms.messageDelivery(b.roomId) === 'web') {
            this.cancel(b)
            b.webOnly = true
            b.deliveryGeneration = delivery.generation
            b.cursor = feed.head
            b.branch = feed.branchId
            b.buffer = []
            b.latest = this.summary(b.roomId)
            continue
          }
          if (b.webOnly || (b.deliveryGeneration ?? 0) !== delivery.generation) {
            b.webOnly = false
            b.deliveryGeneration = delivery.generation
            this.cancel(b)
            b.cursor = delivery.branchId === feed.branchId ? delivery.boundary : feed.head
            b.branch = feed.branchId
            b.buffer = []
            b.latest = this.summary(b.roomId)
            if (!b.paused) this.enqueue(b, '恢复推送：\n' + b.latest)
            feed = this.rooms.qqPublic(b.roomId, b.cursor).feed
          }
          if (feed.branchId !== b.branch || feed.head < b.cursor || feed.gap) {
            this.cancel(b)
            b.branch = feed.branchId
            b.cursor = feed.head
            b.latest = this.summary(b.roomId)
            if (!b.paused)
              this.enqueue(b, '状态更正／历史窗口变化，旧待发记录已取消：\n' + b.latest)
          } else if (b.paused) {
            b.cursor = feed.head
            b.buffer = []
          } else {
            for (const e of feed.events) this.collect(b, e)
            b.cursor = feed.cursor
          }
          const queued = b.tasks.filter(
            (t) => t.status === 'queued' && !t.source && !t.requiresPassive,
          )
          if (
            queued.length > b.limits.backlog ||
            queued.some((t) => this.now() - t.at > b.limits.maxAgeSeconds * 1000)
          ) {
            for (const t of queued) {
              t.status = 'canceled'
              t.detail = '恢复时已合并为当前摘要'
            }
            b.buffer = []
            b.latest = this.summary(b.roomId)
            this.enqueue(
              b,
              `恢复摘要：${queued.length} 条待发内容未逐条补发；Web 明细保留。\n${b.latest}`,
            )
          }
          this.faults.delete(b.roomId)
        } catch {
          this.faults.set(b.roomId, '房间或公开摘要不可用；已停止此房间投递')
          continue
        }
      }
      await this.save(next)
      if (!this.connected() || this.now() - this.lastSend < 3000) return
      for (const b of this.state.bindings) {
        if (
          b.paused ||
          this.rooms.messageDelivery(b.roomId) === 'web' ||
          this.faults.has(b.roomId) ||
          this.now() - b.lastSend < b.limits.sendIntervalSeconds * 1000
        )
          continue
        const today = new Date(this.now()).toISOString().slice(0, 10)
        if (b.day !== today) {
          b.day = today
          b.sends = 0
        }
        if (b.sends >= b.limits.daily) {
          this.faults.set(b.roomId, '本地每日发送额度已用完；Web 继续可用，群回复也受额度限制')
          continue
        }
        const pending = b.tasks.filter((t) => ['queued', 'failed', 'unknown'].includes(t.status))
        const task = pending.find(
          (t, i) =>
            t.status === 'queued' &&
            t.nextAt <= this.now() &&
            !pending
              .slice(0, i)
              .some(
                (prior) =>
                  prior.branch === t.branch &&
                  (!prior.group ||
                    !t.group ||
                    (prior.group === t.group &&
                      outputOrder[prior.role ?? 'system'] <= outputOrder[t.role ?? 'system'])),
              ) &&
            (!this.options.maySend ||
              this.options.maySend(b.roomId, {
                role: t.role ?? 'system',
                group: t.group,
                routeRevision: t.routeRevision,
                eventSequence: t.eventSequence,
                branch: t.branch,
              })),
        )
        if (!task) {
          if (pending.length)
            this.faults.set(
              b.roomId,
              '有关联的先前投递待确认或尚未满足发送条件；无关消息可继续，公开查询仍可用',
            )
          continue
        }
        const attempt = structuredClone(this.state),
          target = attempt.bindings.find((x) => x.id === b.id)!,
          t = target.tasks.find((x) => x.id === task.id)!
        t.status = 'sending'
        t.attempts++
        target.lastSend = this.now()
        target.sends++
        await this.save(attempt)
        this.lastSend = this.now()
        let result: QqDelivery
        try {
          result =
            task.requiresPassive && !task.source
              ? {
                  status: 'failed',
                  detail:
                    '缺少原Bot的@消息凭据，可能已改派Bot；回复仅保留Web，请GM核对，不转为主动发送',
                }
              : task.source && this.now() >= task.source.expires
                ? {
                    status: 'failed',
                    detail:
                      '原@消息回复窗口已过期，请由原玩家@本NPCBot 最新回复领取；未改成主动发送',
                  }
                : await this.transport.deliver(
                    b.groupId,
                    task.text,
                    task.source
                      ? { id: task.source.id, sequence: task.source.sequence }
                      : undefined,
                  )
        } catch {
          result = { status: 'unknown', detail: '发送过程异常，结果未确认；请查看 QQ 群' }
        }
        const done = structuredClone(this.state),
          record = done.bindings.find((x) => x.id === b.id)!.tasks.find((x) => x.id === task.id)!
        record.status = result.status
        record.detail = result.detail.slice(0, 300)
        if (
          result.status === 'failed' &&
          result.retryable &&
          !record.noAutoRetry &&
          record.attempts < 3
        ) {
          record.status = 'queued'
          record.nextAt = this.now() + record.attempts * 30000
          record.detail += '；将有限退避重试'
        }
        // Explicit rejections may be retried; uncertain results never auto-retry.
        await this.save(done)
        break
      }
    })
  }
  private collect(b: Binding, e: BroadcastEvent) {
    // A related prose/NPC result closes the current rules summary before its dependent output.
    if (
      this.options.route &&
      ['ai.narration', 'npc.reply'].includes(e.type) &&
      e.causeId &&
      b.buffer.length
    ) {
      const source = this.rooms.qqRoutingSnapshot(b.roomId).events.find((p) => p.id === e.causeId)
      if (source && this.options.route(b.roomId, source).accept) {
        this.enqueue(b, b.buffer.slice(-12).join('\n'), source)
        b.buffer = []
      }
    }
    if (this.options.route && !this.options.route(b.roomId, e).accept) return
    if (e.fogKnowledge || e.audience.kind !== 'public' || e.phase === 'pending' || e.narration === 'context') return
    const locale=localeOrDefault(this.rooms.qqRoutingSnapshot(b.roomId).contentLocale),localized=localizedEvent(e,locale)
    const prefix =
      e.type === 'npc.reply'
        ? `[NPC·${String(e.title).replace(/的回应$/, '')}] `
        : e.type === 'ai.narration'
          ? (locale==='en'?'[Narration] ':'[旁白] ')
          : (locale==='en'?'[System] ':'[系统] ')
    const dialogue =
      e.type === 'npc.reply' && typeof e.facts.conversationId === 'string'
        ? this.rooms.qqReplyText(b.roomId, e.facts.conversationId)
        : null
    const content = cap(prefix + localized.title + '\n' + (dialogue ?? localized.text),1700,locale)
    if (
      e.phase === 'correction' ||
      e.type === 'ai.narration' ||
      e.narration === 'direct' ||
      (e.category === 'preset' && e.narration !== 'generate')
    ) {
      b.latest = content
      this.enqueue(b, content, e)
      return
    }
    if (b.detailed) {
      b.latest = content
      this.enqueue(b, content, e)
      return
    }
    if (!['token.move', 'token.moved', 'movement.completed'].includes(e.type))
      b.buffer = [...b.buffer, content].slice(-100)
    if (boundaries.has(e.type)) {
      const lines = b.buffer.slice(-12)
      if (lines.length) {
        b.latest = cap(lines.join('\n'),1700,locale)
        this.enqueue(b, b.latest, e)
      }
      b.buffer = []
    }
  }
}
