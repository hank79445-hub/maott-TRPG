import {isDeliveryCommand} from './delivery-command'
import type { BroadcastEvent, BroadcastFeed } from '../core/broadcast-types'
import { errorPresentation } from '../shared/localization/errors'
import { i18n } from '../app/i18n'
import { ref, shallowRef } from 'vue'
import { createPinia } from 'pinia'
import { useWorkshop } from '../app/store'
import type { RoomCommand, RoomView } from './protocol'
import { runtimeNeedsReview, runtimeActionName } from './permissions'
import { sceneSchema } from '../persistence/map-schema'
import { encodeAsset } from '../persistence/map-archive'
import type { MapAsset } from '../core/map-types'
import { parseRoomIdentity, validateIdentityRole, type RoomIdentity } from './room-identity'

export interface Credentials {
  roomId: string
  token: string
}
export class ApiError extends Error {
  readonly originalMessage: string
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(errorPresentation(message, i18n.global.locale.value, code, status))
    this.originalMessage = message
  }
}
export async function api<T>(
  url: string,
  token = '',
  body?: unknown,
  signal?: AbortSignal,
  timing?: (value: { headersMs: number; bodyMs: number; serverTiming: string }) => void,
): Promise<T | null> {
  const started = performance.now()
  const response = await fetch('/api' + url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'X-TRPG-View': 'live',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(40000)])
      : AbortSignal.timeout(url === '/rooms' ? 120000 : 40000),
  })
  if (response.status === 204) return null
  const headersAt = performance.now()
  const data = await response.json()
  timing?.({ headersMs: headersAt - started, bodyMs: performance.now() - headersAt, serverTiming: response.headers.get('Server-Timing') ?? '' })
  if (!response.ok) throw new ApiError(data.error ?? '请求失败', response.status, data.code)
  return data as T
}
export function roomClient() {
  const view = shallowRef<RoomView | null>(null),
    status = ref('未连接'),
    busy = ref(false),
    submission = ref<'idle' | 'pending' | 'confirmed' | 'failed' | 'unknown'>('idle'),
    progress = ref(''),
    assetStatus = ref(''),
    metrics = shallowRef({ commandMs: 0, applyMs: 0, headersMs: 0, bodyMs: 0, serverTiming: '' }),
    broadcastEvents = shallowRef<BroadcastEvent[]>([]),
    broadcastGap = ref(false),
    diceBaseline = ref(0)
  const workshop = useWorkshop(createPinia())
  const assets = new Map<string, MapAsset>()
  let credentials: Credentials | null = null,
    abort: AbortController | null = null,
    generation = 0
  const originals = new Set<string>()
  const loading = new Map<string, Promise<void>>()
  let imageRetry: ReturnType<typeof setTimeout> | undefined
  let retryAsset = '', imageAttempts = 0
  function applyAssets(next: RoomView) {
    const allowed = new Set(next.assets.map(a => a.id))
    for (const id of assets.keys()) if (id.startsWith('fog-') && !allowed.has(id)) {
      assets.delete(id)
      originals.delete(id)
    }
    workshop.assets = next.assets.flatMap((m) => (assets.has(m.id) ? [assets.get(m.id)!] : []))
  }
  async function loadImage(
    meta: RoomView['assets'][number],
    captured: Credentials,
    epoch: number,
    original = false,
  ) {
    const key = `${epoch}:${meta.id}:${original}`
    const pending = loading.get(key)
    if (pending) return pending
    const task = (async () => {
      const preview = !!meta.preview && !original
      const response = await fetch(
        `/api/rooms/${captured.roomId}/assets/${meta.id}${preview ? '?preview=1' : ''}`,
        {
          headers: { Authorization: 'Bearer ' + captured.token },
          signal: abort?.signal,
        },
      )
      if (!response.ok) throw new ApiError('背景图片读取失败', response.status)
      const blob = await response.blob()
      if (epoch !== generation || !view.value?.assets.some((m) => m.id === meta.id)) return
      const { preview: previewMeta, ...base } = meta
      const existing = assets.get(meta.id)
      // A late preview must never downgrade an original already received.
      if (preview && originals.has(meta.id)) return
      assets.set(meta.id, {
        ...base,
        blob,
        ...(preview && previewMeta
          ? { preview: { ...previewMeta, blob } }
          : existing?.preview
            ? { preview: existing.preview }
            : {}),
      })
      if (!preview) originals.add(meta.id)
      applyAssets(view.value!)
    })().finally(() => loading.delete(key))
    loading.set(key, task)
    return task
  }
  async function loadImages(next: RoomView, epoch: number, allOriginals = false) {
    const captured = credentials
    if (!captured) return
    const current = next.scene?.background?.assetId
    clearTimeout(imageRetry)
    if (retryAsset !== current) { retryAsset = current ?? ''; imageAttempts = 0 }
    const metas = [...next.assets].sort(
      (a, b) => Number(b.id === current) - Number(a.id === current),
    )
    assetStatus.value = '正在加载地图图片'
    try {
      for (const meta of metas) {
        if (epoch !== generation) return
        if (!assets.has(meta.id)) await loadImage(meta, captured, epoch)
        if ((meta.id === current || allOriginals) && !originals.has(meta.id))
          await loadImage(meta, captured, epoch, true)
      }
      if (epoch === generation) assetStatus.value = ''
    } catch {
      if (epoch === generation && view.value?.scene?.background?.assetId === current) {
        assetStatus.value = '部分地图图片加载失败，可重试；已保存操作不受影响'
        if (current && !assets.has(current) && imageAttempts < 3) {
          const delay = 750 * 2 ** imageAttempts++
          imageRetry = setTimeout(() => {
            if (epoch === generation && view.value) void loadImages(view.value, epoch)
          }, delay)
        }
      }
    }
  }
  let feedQueue: Promise<unknown> = Promise.resolve()
  let acknowledged = 0
  let feedGeneration = 0
  let broadcastCursor = 0,
    permissionKey = ''
  const feedPermissionKey = (next: RoomView) =>
    JSON.stringify([
      next.self.id,
      next.self.role,
      [...next.self.characterIds].sort(),
      [...next.self.actorIds].sort(),
    ])
  async function collectFeed(next: RoomView, epoch: number) {
    const captured = credentials
    if (!captured) return
    const key = feedPermissionKey(next),
      feedEpoch = feedGeneration
    const live = () =>
      epoch === generation &&
      feedEpoch === feedGeneration &&
      !!view.value &&
      feedPermissionKey(view.value) === key
    if (permissionKey !== key) {
      permissionKey = key
      broadcastEvents.value = []
      broadcastCursor = 0
      broadcastGap.value = false
    }
    broadcastCursor = Math.min(broadcastCursor, next.broadcast.head)
    const buffer = new Map(broadcastEvents.value.map((e) => [e.id, e]))
    for (const e of next.broadcast.events) buffer.set(e.id, e)
    while (broadcastCursor < next.broadcast.head) {
      const batch = await api<BroadcastFeed>(
        `/rooms/${captured.roomId}/broadcasts?after=${broadcastCursor}`,
        captured.token,
        undefined,
        abort?.signal,
      )
      if (!live() || !batch) return
      broadcastGap.value ||= batch.gap
      for (const e of batch.events) buffer.set(e.id, e)
      if (batch.cursor <= broadcastCursor) break
      broadcastCursor = batch.cursor
    }
    if (!live()) return
    broadcastEvents.value = [...buffer.values()]
      .sort((a, b) => a.sequence - b.sequence)
      .slice(-5000)
    if (broadcastCursor > acknowledged) {
      const cursor = broadcastCursor
      await api(
        `/rooms/${captured.roomId}/broadcast-ack`,
        captured.token,
        { cursor },
        abort?.signal,
      )
        .then(() => {
          if (live()) acknowledged = Math.max(acknowledged, cursor)
        })
        .catch(() => {})
    }
  }
  let receiveQueue: Promise<void> = Promise.resolve()
  function receive(next: RoomView, epoch = generation, baseline = false) {
    const task = receiveQueue.catch(() => {}).then(() => receiveNow(next, epoch, baseline))
    receiveQueue = task
    return task
  }
  async function receiveNow(next: RoomView, epoch = generation, baseline = false) {
    const appliedAt = performance.now()
    if (
      !credentials ||
      epoch !== generation ||
      next.revision < (view.value?.revision ?? -1) ||
      (next.revision === view.value?.revision &&
        !(baseline || (!next.historyAvailable && view.value?.historyAvailable)))
    )
      return
    if (permissionKey !== feedPermissionKey(next)) {
      permissionKey = feedPermissionKey(next)
      feedGeneration++
      feedQueue = Promise.resolve()
      broadcastEvents.value = [...next.broadcast.events]
      broadcastCursor = 0
      acknowledged = 0
      broadcastGap.value = false
    }
    if (baseline) diceBaseline.value++
    view.value = next
    applyAssets(next)
    if (next.world) {
      workshop.adventures = next.world.adventures
      workshop.characters = next.world.characters
      workshop.encounters = next.world.encounters
      workshop.packs = next.world.packs
    } else {
      workshop.characters = next.ownCharacters
      workshop.packs = next.packs
      workshop.adventures = []
      workshop.encounters = []
    }
    workshop.loaded = true
    metrics.value = { ...metrics.value, applyMs: performance.now() - appliedAt }
    status.value = '已同步'
    void loadImages(next, epoch)
    feedQueue = feedQueue
      .catch(() => {})
      .then(async () => {
        if (epoch !== generation || !view.value || next.revision < view.value.revision) return
        try {
          await collectFeed(next, epoch)
        } catch {
          if (epoch === generation) status.value = '当前状态已同步；广播记录待重试'
        }
      })
  }
  async function refresh() {
    if (!credentials) throw new Error('请先连接房间')
    const next = await api<RoomView>(
      `/rooms/${credentials.roomId}/snapshot`,
      credentials.token,
      undefined,
      abort?.signal,
    )
    if (next) await receive(next)
  }
  async function poll(epoch: number) {
    let reconnecting = false
    while (credentials && epoch === generation && !abort?.signal.aborted) {
      try {
        const next = await api<RoomView>(
          `/rooms/${credentials.roomId}/snapshot${reconnecting ? '' : '?wait=1&since=' + (view.value?.revision ?? -1)}`,
          credentials.token,
          undefined,
          abort?.signal,
        )
        if (next) await receive(next, epoch, reconnecting)
        if (epoch !== generation || abort?.signal.aborted) return
        reconnecting = false
        status.value = '已同步'
      } catch (e) {
        if (epoch !== generation || abort?.signal.aborted) return
        if (e instanceof ApiError && e.status === 401) {
          status.value = '身份失效，请重新加入'
          return
        }
        status.value = '连接中断，正在重连'
        reconnecting = true
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 1500)
          abort?.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              resolve()
            },
            { once: true },
          )
        })
      }
    }
  }
  async function connect(value: Credentials, initial?: RoomView) {
    disconnect()
    credentials = { roomId: value.roomId, token: value.token }
    abort = new AbortController()
    status.value = '正在连接'
    try {
      localStorage.setItem('trpg-room-session', JSON.stringify(credentials))
    } catch {}
    if (initial) await receive(initial)
    else await refresh()
    void poll(generation)
  }
  function disconnect(forget = false) {
    clearTimeout(imageRetry)
    retryAsset = ''
    imageAttempts = 0
    submission.value = 'idle'
    busy.value = false
    generation++
    abort?.abort()
    credentials = null
    stableRequests.clear()
    status.value = '未连接'
    view.value = null
    assets.clear()
    originals.clear()
    loading.clear()
    acknowledged = 0
    progress.value = ''
    assetStatus.value = ''
    broadcastEvents.value = []
    broadcastCursor = 0
    permissionKey = ''
    feedGeneration++
    feedQueue = Promise.resolve()
    broadcastGap.value = false
    workshop.assets = []
    if (forget) localStorage.removeItem('trpg-room-session')
  }
  const stableRequests = new Map<string, { id: string; revision: number; command: RoomCommand }>()
  const deliveries=new Set<string>()
  async function send(command: RoomCommand, requestId?: string) {
    if(isDeliveryCommand(command)){
      if(!credentials||!view.value)return
      const captured=credentials,epoch=generation,key=epoch+':'+JSON.stringify(command)
      if(deliveries.has(key))return
      deliveries.add(key)
      try{
        const next=await api<RoomView>(
          '/rooms/'+captured.roomId+'/commands',captured.token,
          {id:crypto.randomUUID(),revision:view.value.revision,command},abort?.signal,
        )
        if(next&&epoch===generation)await receive(next,epoch)
      }catch{
        // Window/auth changes are reconciled by the normal snapshot poll.
      }finally{deliveries.delete(key)}
      return
    }
    if (!credentials || !view.value) throw new Error('请先连接房间')
    if (busy.value) throw new Error('上一笔操作正在提交')
    busy.value = true
    submission.value = 'pending'
    progress.value = '正在提交并保存操作…'
    const submittedAt = performance.now()
    const captured = credentials,
      request = (requestId && stableRequests.get(requestId)) || {
        id: requestId ?? crypto.randomUUID(),
        revision: view.value.revision,
        command,
      },
      epoch = generation
    if (requestId) stableRequests.set(requestId, request)
    try {
      if (JSON.stringify(request.command) !== JSON.stringify(command))
        throw new ApiError('原提交内容已锁定，请先查询其结果', 409)
      if (requestId) {
        const receipt = await api<{ committed: boolean }>(
          `/rooms/${captured.roomId}/commands/${requestId}`,
          captured.token,
          undefined,
          abort?.signal,
        )
        if (epoch !== generation) throw new ApiError('房间连接已切换，请回原房间核对本次结果', 409)
        if (receipt?.committed) {
          submission.value = 'confirmed'
          await refresh()
          stableRequests.delete(requestId)
          return
        }
      }
      let next: RoomView | null
      const recordTiming = (value: { headersMs: number; bodyMs: number; serverTiming: string }) => {
        if (epoch === generation) metrics.value = { ...metrics.value, ...value }
      }
      try {
        next = await api<RoomView>(
          `/rooms/${captured.roomId}/commands`,
          captured.token,
          request,
          abort?.signal,
          recordTiming,
        )
      } catch (e) {
        if (e instanceof ApiError) throw e
        // Reuse the same ID after a lost response, so a committed roll is not repeated.
        next = await api<RoomView>(
          `/rooms/${captured.roomId}/commands`,
          captured.token,
          request,
          abort?.signal,
          recordTiming,
        )
      }
      if (epoch !== generation) throw new ApiError('房间连接已切换，请回原房间核对本次结果', 409)
      progress.value = '已保存，正在同步当前状态…'
      submission.value = next ? 'confirmed' : 'unknown'
      if (next) await receive(next, epoch)
      if (requestId) stableRequests.delete(requestId)
    } catch (e) {
      if (epoch === generation && submission.value !== 'confirmed')
        submission.value = e instanceof ApiError ? 'failed' : 'unknown'
      if (requestId && e instanceof ApiError) stableRequests.delete(requestId)
      if (epoch === generation && e instanceof ApiError && e.status === 409) await refresh()
      throw e
    } finally {
      if (epoch === generation) {
        busy.value = false
        metrics.value = { ...metrics.value, commandMs: performance.now() - submittedAt }
        progress.value = ''
      }
    }
  }
  const unsupported = async () => {
    throw new Error('房间中的冒险由服务端管理；请导出后在本地管理副本')
  }
  workshop.save = unsupported
  workshop.createAdventure = unsupported
  workshop.removeAdventure = unsupported
  workshop.importAdventure = unsupported
  workshop.importEncounter = unsupported
  workshop.removeEncounter = unsupported
  workshop.mapOperate = async (_id, command) => {
    await send({ kind: 'map', command })
    return workshop.adventures[0]!
  }
  workshop.mapBackground = async (_id, sceneId, asset, configuration) => {
    const scene = configuration ?? workshop.adventures[0]?.scenes.find((s) => s.id === sceneId)
    if (!scene) throw new Error('场景不存在')
    await send({
      kind: 'background',
      scene: sceneSchema.parse(scene),
      asset: await encodeAsset(asset),
    })
    return workshop.adventures[0]!
  }
  workshop.combat = async (id, command, options) => {
    const scene = workshop.adventures[0]?.scenes.find((s) => s.encounterId === id)
    if (!scene) throw new Error('请在房间地图创建并关联遭遇')
    await send({
      kind: 'map',
      command:
        command.type === 'undo'
          ? { type: 'undo' }
          : command.type === 'end'
            ? { type: 'battle-finish', sceneId: scene.id, reason: 'GM 结束战斗' }
            : { type: 'combat', sceneId: scene.id, command, options },
    })
    return workshop.encounters.find((e) => e.id === id)!
  }
  workshop.createEncounter = async (name) => {
    const sceneId = view.value?.scene?.id
    if (!sceneId) throw new Error('请先在地图让队伍进入场景')
    const a = workshop.adventures[0]!,
      scene = a.scenes.find((s) => s.id === sceneId)!
    await send({
      kind: 'map',
      command: {
        type: 'battle-prepare',
        sceneId,
        name,
        participants: scene.tokens
          .filter((t) => t.characterId && a.party.includes(t.characterId))
          .map((t) => ({ kind: 'character', id: t.characterId!, side: 'party' })),
      },
    })
    return workshop.adventures[0]!.scenes.find((s) => s.id === sceneId)!.encounterId!
  }
  workshop.operate = async (characterId, command) => {
    if (view.value?.self.role === 'player' && runtimeNeedsReview(command)) {
      await send({
        kind: 'intent-submit',
        action: { kind: 'runtime', characterId, command },
        summary: runtimeActionName(command),
        source: 'player',
        baseWorldRevision: view.value.worldRevision,
      })
    } else await send({ kind: 'runtime', characterId, command })
    return workshop.characters.find((c) => c.id === characterId)!
  }
  workshop.exportAdventure = async () => {
    if (!credentials) throw new Error('尚未连接')
    const response = await fetch(`/api/rooms/${credentials.roomId}/archive`, {
      headers: { Authorization: 'Bearer ' + credentials.token },
    })
    if (!response.ok) throw new Error('导出房间失败')
    return response.text()
  }
  return {
    view,
    diceBaseline,
    request: async <T>(url: string, body?: unknown) => {
      if (!credentials) throw Error('请先连接房间')
      return api<T>(url, credentials.token, body)
    },
    status,
    submission,
    progress,
    assetStatus,
    metrics,
    loadHistory: async () => {
      if (!credentials) return
      const epoch = generation
      const next = await api<RoomView>(
        `/rooms/${credentials.roomId}/snapshot?full=1`,
        credentials.token,
      )
      if (next) await receive(next, epoch)
    },
    retryImages: () => (view.value ? loadImages(view.value, generation) : Promise.resolve()),
    loadSceneImage: async (sceneId: string) => {
      const next = view.value,
        captured = credentials,
        epoch = generation
      const assetId = next?.world?.adventures.flatMap((a) => a.scenes).find((s) => s.id === sceneId)
        ?.background?.assetId
      const meta = next?.assets.find((m) => m.id === assetId)
      if (meta && captured && !originals.has(meta.id))
        await loadImage(meta, captured, epoch, true).catch(() => {
          assetStatus.value = '原图加载失败，可重试图片'
        })
    },
    loadOriginals: () =>
      view.value ? loadImages(view.value, generation, true) : Promise.resolve(),
    busy,
    workshop,
    broadcastEvents,
    broadcastGap,
    connect,
    disconnect,
    send,
    refresh,
    npcKnowledgeReport:async()=>{if(!credentials)throw Error('请先连接房间');return api<unknown>(`/rooms/${credentials.roomId}/npc-knowledge`,credentials.token)},
    exportIdentity: async () => {
      if (!credentials || !view.value || busy.value) throw Error('请先连接房间并等待当前操作完成')
      const captured = { ...credentials }
      const health = await api<{ deploymentId?: string }>('/health')
      if (!health?.deploymentId) throw Error('当前服务器尚未提供部署标识，请使用已更新的测试入口')
      const snapshot = await api<RoomView>(`/rooms/${captured.roomId}/snapshot`, captured.token)
      if (!snapshot) throw Error('无法核验房间身份')
      return parseRoomIdentity(
        JSON.stringify({
          format: 'trpg-room-identity',
          version: 1,
          deploymentId: health.deploymentId,
          ...captured,
          role: snapshot.self.role,
          nickname: snapshot.self.nickname,
        }),
        health.deploymentId,
      )
    },
    restoreIdentity: async (text: string) => {
      if (busy.value || stableRequests.size) throw Error('先核对当前未确认操作的结果，再恢复身份')
      const health = await api<{ deploymentId?: string }>('/health')
      if (!health?.deploymentId) throw Error('当前服务器尚未提供部署标识')
      const identity: RoomIdentity = parseRoomIdentity(text, health.deploymentId)
      const snapshot = await api<RoomView>(`/rooms/${identity.roomId}/snapshot`, identity.token)
      if (!snapshot) throw Error('无法核验房间身份')
      validateIdentityRole(identity, snapshot.self.role)
      await connect({ roomId: identity.roomId, token: identity.token }, snapshot)
    },
    integration: async <T>(suffix: string, body?: unknown) => {
      if (!credentials) throw new Error('请先连接房间')
      return api<T>(`/rooms/${credentials.roomId}/${suffix}`, credentials.token, body)
    },
  }
}
