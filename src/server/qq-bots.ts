import { mkdir, readFile } from 'node:fs/promises'
import { writeFileSync, renameSync } from 'node:fs'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { z } from 'zod'
import { QqProbe } from './qq-probe'
import { QqBridge } from './qq-bridge'
import { RoomError } from './room-engine'
import type { RoomStore } from './room-store'
import {
  botKeySchema,
  qqRouteSchema,
  targetBot,
  outputIdentity,
  type QqRoutes,
  type QqTaskRoute,
  type QqRoutingEvent,
} from './qq-routing'
import type { BroadcastEvent } from '../core/broadcast-types'
const botDefinition = z
  .object({ key: botKeySchema, name: z.string().min(1).max(60), enabled: z.boolean() })
  .strict()
const registrySchema = z
  .object({
    version: z.literal(1),
    bots: z.array(botDefinition).max(20),
    routes: z.record(z.string().uuid(), qqRouteSchema),
    selections: z
      .record(
        z.string(),
        z
          .object({ npc: z.string(), scene: z.string(), branch: z.string(), binding: z.string() })
          .strict(),
      )
      .default({}),
    decisions: z
      .record(
        z.string(),
        z.object({ bot: botKeySchema, revision: z.number().int().nonnegative() }).strict(),
      )
      .default({}),
  })
  .strict()
type Registry = z.infer<typeof registrySchema>
type Endpoint = { definition: z.infer<typeof botDefinition>; transport: QqProbe; bridge: QqBridge }
/** One backend, isolated per-AppID transports. Old default credentials and bridge stay at their original paths. */
export class QqBotHub {
  private state: Registry = {
    version: 1,
    bots: [{ key: 'default', name: '原有主Bot', enabled: true }],
    routes: {},
    selections: {},
    decisions: {},
  }
  private endpoints = new Map<string, Endpoint>()
  private serial: Promise<unknown> = Promise.resolve()
  private lastSend = new Map<string, number>()
  constructor(
    public directory: string,
    private rooms: RoomStore,
    private entry = '',
    private backup = '',
    private factory = (directory: string) =>
      new QqProbe(
        directory,
        fetch,
        (url) => new WebSocket(url),
        () => Date.now(),
        path.resolve(process.env.TRPG_QQ_LOCK_DATA ?? '.local/qq-locks'),
      ),
  ) {}
  private save() {
    const file = path.join(this.directory, 'bots.json'),
      temp = file + '.' + randomUUID() + '.tmp'
    registrySchema.parse(this.state)
    writeFileSync(temp, JSON.stringify(this.state), { mode: 0o600 })
    renameSync(temp, file)
  }
  async init() {
    await mkdir(this.directory, { recursive: true })
    try {
      this.state = registrySchema.parse(
        JSON.parse(await readFile(path.join(this.directory, 'bots.json'), 'utf8')),
      )
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        throw Error('多Bot配置不可用，拒绝覆盖原配置')
    }
    if (!this.state.bots.some((b) => b.key === 'default')) throw Error('主Bot记录缺失')
    for (const definition of [...this.state.bots].sort(
      (a, b) => Number(b.key === 'default') - Number(a.key === 'default'),
    ))
      await this.load(definition)
  }
  private async load(definition: z.infer<typeof botDefinition>) {
    const root =
        definition.key === 'default'
          ? this.directory
          : path.join(this.directory, 'bots', definition.key),
      transport = this.factory(path.join(root, 'transport'))
    await transport.init()
    const bridge = new QqBridge(
      root,
      this.rooms,
      transport,
      () => definition.enabled && transport.snapshot().status === 'connected',
      () => Date.now(),
      this.entry,
      transport.snapshot().config.appId,
      this.backup,
      {
        additional: definition.key !== 'default',
        route: (room, e) => this.route(definition.key, room, e),
        maySend: (room, task) => this.permit(room, task),
        input: (room, text, source) => this.normalizeInput(definition.key, room, text, source),
      },
    )
    await bridge.init()
    this.endpoints.set(definition.key, { definition, transport, bridge })
    transport.onCommand((m) => bridge.receive(m))
    if (definition.enabled) {
      bridge.start()
      if (transport.snapshot().config.secretConfigured) void transport.connect().catch(() => {})
    }
  }
  bridge(key = 'default') {
    const e = this.endpoints.get(botKeySchema.parse(key))
    if (!e) throw new RoomError('QQ Bot连接不存在', 404)
    return e.bridge
  }
  transportStatus(key = 'default') {
    const e = this.endpoints.get(key),
      s = e?.transport.snapshot()
    return { status: s?.status ?? 'unconfigured', lastError: s?.lastError ?? '' }
  }
  private routes(room: string) {
    return this.state.routes[room] ?? qqRouteSchema.parse({})
  }
  private group(
    room: string,
    e?: Pick<BroadcastEvent, 'id' | 'type' | 'causeId' | 'facts' | 'actionId'>,
  ) {
    if (!e) return 'state'
    if (e.type === 'npc.reply' && !e.causeId) return 'npc:' + String(e.facts.conversationId ?? e.id)
    const cause = e.causeId
      ? this.rooms.qqRoutingSnapshot(room).events.find((p) => p.id === e.causeId)
      : undefined
    const source = cause ?? e
    return String(source.facts.closedTurnId ?? source.facts.turnId ?? source.actionId).slice(0, 200)
  }
  private route(key: string, room: string, e?: QqRoutingEvent) {
    const r = this.routes(room)
    const decision = e
      ? createHash('sha256')
          .update(room + ':' + e.branchId + ':' + e.id)
          .digest('hex')
      : null
    const sourceBinding =
      e?.type === 'npc.reply' &&
      e.facts.qqOrigin === true &&
      typeof e.facts.qqBindingId === 'string'
        ? e.facts.qqBindingId
        : undefined
    const originalBot = sourceBinding
      ? [...this.endpoints].find(
          ([, endpoint]) => endpoint.bridge.pairingBinding(room) === sourceBinding,
        )?.[0]
      : undefined
    let selected =
      (decision && this.state.decisions[decision]?.bot) ||
      (sourceBinding ? (originalBot ?? '__missing_origin__') : targetBot(r, e))
    const endpoint = this.endpoints.get(selected)
    if (
      (!decision || !this.state.decisions[decision]) &&
      r.fallbackToCompatibility &&
      outputIdentity(e).role !== 'npc' &&
      selected !== r.compatibility &&
      endpoint &&
      endpoint.transport.snapshot().status !== 'connected'
    )
      selected = r.compatibility
    if (decision && !this.state.decisions[decision]) {
      if (Object.keys(this.state.decisions).length >= 50000)
        throw Error('Bot路由记录空间不足，请部署者归档；未删除未确认记录')
      this.state.decisions[decision] = { bot: selected, revision: r.revision }
      try {
        this.save()
      } catch (error) {
        delete this.state.decisions[decision]
        throw error
      }
    }
    return {
      accept:
        selected === key && (!decision || this.state.decisions[decision]?.revision === r.revision),
      revision: r.revision,
      group: this.group(room, e),
    }
  }
  private permit(room: string, task: QqTaskRoute) {
    if (task.role !== 'system' && task.group && task.eventSequence && task.branch) {
      const snapshot = this.rooms.qqRoutingSnapshot(room)
      for (const predecessor of snapshot.events) {
        if (predecessor.branchId !== task.branch) continue
        const role = outputIdentity(predecessor).role
        if (
          role === 'npc' ||
          (role === 'narration' && task.role !== 'npc') ||
          this.group(room, predecessor) !== task.group
        )
          continue
        if (role === 'system' && predecessor.sequence > task.eventSequence) continue
        const endpoint = [...this.endpoints].find(
          ([key]) => this.route(key, room, predecessor).accept,
        )?.[1]
        if (
          !endpoint ||
          !endpoint.bridge.collectedThrough(
            room,
            task.branch,
            Math.max(predecessor.sequence, task.eventSequence),
          ) ||
          endpoint.bridge.pendingGroup(room, role, task.group, task.branch)
        )
          return false
      }
      if (
        task.role === 'npc' &&
        snapshot.narrationPending.some((j) =>
          j.eventIds.some((id) => {
            const source = snapshot.events.find((e) => e.id === id)
            return source && this.group(room, source) === task.group
          }),
        )
      )
        return false
    }
    if (
      task.role !== 'system' &&
      task.group &&
      [...this.endpoints.values()].some((e) =>
        e.bridge.pendingGroup(room, 'system', task.group!, task.branch),
      )
    )
      return false
    const now = Date.now()
    if (now - (this.lastSend.get(room) ?? 0) < 10000) return false
    this.lastSend.set(room, now)
    return true
  }
  private normalizeInput(
    key: string,
    room: string,
    text: string,
    source: { identity: string; bindingId: string },
  ): string | { reply: string } {
    const r = this.routes(room),
      npc = Object.entries(r.npcBots).find(([, bot]) => bot === key)?.[0]
    if (/^(配对|连接|绑定|帮助)(?:\s|$)/.test(text)) return text
    const shared = r.sharedBots?.[key]
    if (shared) {
      const snapshot = this.rooms.qqRoutingSnapshot(room)
      const allowed = snapshot.npcs.filter(
        (n) =>
          shared.includes(n.id) &&
          n.sceneId === snapshot.activeSceneId &&
          n.enabled &&
          !n.hidden &&
          !n.absent &&
          !n.dead,
      )
      const slot = room + ':' + key + ':' + source.identity
      if (text === '人物' || text === '切换人物') {
        delete this.state.selections[slot]
        this.save()
        return {
          reply:
            '当前可交谈：' +
            allowed.map((n) => n.name + ' [' + n.id.slice(0, 6) + ']').join('、') +
            '。输入“交谈 人物名：台词”选择。',
        }
      }
      const explicit = text.match(/^(?:交谈|切换人物)\s+(.+?)(?:[:：](.*))?$/)
      const prior = this.state.selections[slot]
      const matches = explicit
        ? allowed.filter(
            (n) =>
              n.name === explicit[1] ||
              n.id === explicit[1] ||
              (explicit[1]!.length >= 6 && n.id.startsWith(explicit[1]!)),
          )
        : []
      const selected = explicit
        ? matches.length === 1
          ? matches[0]
          : undefined
        : prior?.scene === snapshot.activeSceneId &&
            prior?.branch === (snapshot.branchId ?? '') &&
            prior.binding === source.bindingId
          ? allowed.find((n) => n.id === prior.npc)
          : allowed.length === 1
            ? allowed[0]
            : undefined
      if (!selected)
        return {
          reply: allowed.length
            ? '请先选择交谈人物：' +
              allowed.map((n) => n.name + ' [' + n.id.slice(0, 6) + ']').join('、') +
              '；输入“交谈 人物名：台词”。'
            : '当前场景没有可交谈的共享NPC。',
        }
      if (Object.keys(this.state.selections).length >= 1000 && !this.state.selections[slot])
        return { reply: '交谈选择记录已满，请使用Web交谈。' }
      this.state.selections[slot] = {
        npc: selected.id,
        scene: snapshot.activeSceneId!,
        branch: snapshot.branchId ?? '',
        binding: source.bindingId,
      }
      this.save()
      return text === '最新回复'
        ? '领取回复 ' + selected.id
        : '直聊 ' + selected.id + '：' + (explicit ? (explicit[2] ?? '') : text)
    }
    if (npc) {
      if (/^(行动|对话|继续对话|加入对话|查询申请|撤回申请)(?:\s|$)/.test(text))
        return { reply: '此Bot仅负责指定NPC交谈。行动申请请@系统Bot；与本NPC交谈直接输入台词。' }
      return text === '最新回复' ? '领取回复 ' + npc : '直聊 ' + npc + '：' + text
    }
    if (key === r.narration && key !== r.system) {
      if (['最新旁白', '最新摘要', '旁白'].includes(text)) return '最新旁白'
      return { reply: '此Bot负责已发布旁白，请@我输入“最新旁白”；行动请使用系统Bot。' }
    }
    return text
  }
  private authorize(room: string, token: string) {
    const m = this.rooms.authenticate(room, token)
    if (m.role !== 'gm') throw new RoomError('QQ分工需要GM', 403)
  }
  status(room: string, token: string) {
    this.authorize(room, token)
    return {
      routes: structuredClone(this.routes(room)),
      bots: [...this.endpoints].map(([key, e]) => ({
        key,
        name: e.definition.name,
        enabled: e.definition.enabled,
        bound: e.bridge.hasBinding(room),
        ...this.transportStatus(key),
      })),
      npcs: this.rooms.qqRoutingSnapshot(room).npcs,
    }
  }
  runSummary(room: string, token: string) {
    this.authorize(room, token)
    const r = this.routes(room)
    const required = new Set([
      r.system,
      r.narration,
      r.compatibility,
      ...Object.values(r.npcBots),
      ...Object.keys(r.sharedBots ?? {}),
    ])
    const totals = {
      boundBots: 0,
      connectedBots: 0,
      pausedBots: 0,
      queued: 0,
      failed: 0,
      unknown: 0,
    }
    const bindings: string[] = []
    for (const [key, endpoint] of this.endpoints) {
      if (!endpoint.definition.enabled || !required.has(key)) continue
      const s = endpoint.bridge.runSummary(room, token)
      if (s.bindingId) bindings.push(s.bindingId)
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += s[k]
    }
    const pairing = this.rooms.qqPairingCounts(room, token, bindings)
    return {
      enabled: true,
      expectedBots: required.size,
      ...totals,
      ...pairing,
      fullyPairedPlayers: bindings.length === required.size ? pairing.fullyPairedPlayers : 0,
      checkedAt: new Date().toISOString(),
    }
  }
  memberBots(room: string, token: string) {
    const m = this.rooms.authenticate(room, token),
      r = this.routes(room),
      allowed = new Set(this.rooms.qqPublic(room).view.ai.npcs.map((n) => n.id))
    return [...this.endpoints]
      .filter(
        ([key, e]) =>
          e.bridge.hasBinding(room) &&
          (m.role === 'gm' ||
            [r.system, r.narration, r.compatibility].includes(key) ||
            Object.entries(r.npcBots).some(([id, k]) => k === key && allowed.has(id)) ||
            (r.sharedBots?.[key]?.some((id) => allowed.has(id)) ?? false)),
      )
      .map(([key, e]) => ({ key, name: e.definition.name }))
  }
  async pairing(room: string, token: string, input?: unknown) {
    this.rooms.authenticate(room, token)
    const allowed = this.memberBots(room, token)
    const bindings = allowed.flatMap((b) => {
      const id = this.bridge(b.key).pairingBinding(room)
      return id ? [{ ...b, id }] : []
    })
    return this.rooms.qqBatchPairing(room, token, bindings, input)
  }
  async command(room: string, token: string, input: unknown) {
    this.authorize(room, token)
    const r = qqRouteSchema.parse(input),
      previous = this.routes(room),
      npcs = this.rooms.qqRoutingSnapshot(room).npcs
    for (const key of [
      r.system,
      r.narration,
      r.compatibility,
      ...Object.values(r.npcBots),
      ...Object.keys(r.sharedBots ?? {}),
    ])
      if (!this.endpoints.get(key)?.definition.enabled || !this.bridge(key).hasBinding(room))
        throw new RoomError('所有分配的Bot须已启用并分别绑定本房间')
    if (
      [...Object.keys(r.npcBots), ...Object.values(r.sharedBots ?? {}).flat()].some(
        (id) => !npcs.some((n) => n.id === id),
      )
    )
      throw new RoomError('NPC绑定引用缺失')
    const old = this.state.routes[room]
    this.state.routes[room] = { ...r, revision: previous.revision + 1 }
    try {
      await this.save()
    } catch (e) {
      if (old) this.state.routes[room] = old
      else delete this.state.routes[room]
      throw e
    }
    return this.status(room, token)
  }
  adminStatus() {
    return {
      bots: [...this.endpoints].map(([key, e]) => ({
        key,
        name: e.definition.name,
        enabled: e.definition.enabled,
        status: e.transport.snapshot().status,
        appId: e.transport.snapshot().config.appId,
        hasKey: e.transport.snapshot().config.secretConfigured,
        lastError: e.transport.snapshot().lastError,
        checks: e.transport.snapshot().checks,
      })),
      scope: '凭据仅本机部署者配置；真实权限须逐Bot联调',
    }
  }
  async admin(input: unknown) {
    const c = z
      .object({
        action: z.enum(['save', 'connect', 'disconnect', 'disable', 'enable']),
        key: botKeySchema,
        name: z.string().min(1).max(60).optional(),
        appId: z
          .string()
          .regex(/^\d{1,32}$/)
          .optional(),
        appSecret: z.string().min(1).max(256).optional(),
      })
      .strict()
      .parse(input)
    const work = this.serial
      .catch(() => {})
      .then(async () => {
        let e = this.endpoints.get(c.key)
        if (c.action === 'save') {
          if (!c.appId || !c.name) throw Error('填写名称与AppID')
          if (
            [...this.endpoints].some(
              ([key, e]) => key !== c.key && e.transport.snapshot().config.appId === c.appId,
            )
          )
            throw Error('相同AppID不能登记两份连接')
          if (
            e &&
            e.transport.snapshot().config.appId &&
            e.transport.snapshot().config.appId !== c.appId
          )
            throw Error('更换AppID请新增连接，原绑定不能换主体')
          if (!e) {
            if (this.state.bots.length >= 20) throw Error('最多20个Bot连接')
            const definition = { key: c.key, name: c.name, enabled: false },
              seed = this.factory(path.join(this.directory, 'bots', c.key, 'transport'))
            await seed.init()
            await seed.saveConfig({
              appId: c.appId,
              ...(c.appSecret ? { appSecret: c.appSecret } : {}),
              testUrl: '',
            })
            await this.load(definition)
            this.state.bots.push(definition)
            e = this.endpoints.get(c.key)!
          } else {
            await e.transport.saveConfig({
              appId: c.appId,
              ...(c.appSecret ? { appSecret: c.appSecret } : {}),
              testUrl: '',
            })
            await e.bridge.close()
            await this.load(e.definition)
            e = this.endpoints.get(c.key)!
          }
          e.definition.name = c.name
        } else {
          if (!e) throw Error('Bot不存在')
          if (c.action === 'disconnect' || c.action === 'disable') e.transport.disconnect()
          if (c.action === 'disable') {
            e.definition.enabled = false
            await e.bridge.discardUnsent('部署者停用此Bot，旧未发消息取消；unknown保留待GM核对')
            await e.bridge.close()
          }
          if (c.action === 'enable') {
            if (!e.definition.enabled)
              await e.bridge.discardUnsent('停用期间消息仅保留Web记录；重新启用不补播')
            e.definition.enabled = true
            e.bridge.start()
          }
          if (c.action === 'connect') {
            if (!e.definition.enabled) throw Error('请先启用此Bot')
            await e.transport.connect()
          }
        }
        await this.save()
        return this.adminStatus()
      })
    this.serial = work
    return work
  }
  async close() {
    for (const e of this.endpoints.values()) {
      e.transport.disconnect()
      await e.bridge.close()
    }
  }
}
