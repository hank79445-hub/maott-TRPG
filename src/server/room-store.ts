import {openingReadingsSchema} from '../persistence/opening-reading-schema'
import { pointContainerView } from './point-container'
import {isDeliveryCommand} from '../online/delivery-command'
import {peerSessionsSchema} from '../persistence/npc-peer-schema'
import {DeliveryRevisions,deliverySemantics} from './delivery-revisions'
import {executePracticalResponse} from './practical-combat'
import {executePracticalInitiative} from './practical-initiative'
import {executePracticalEffectInput} from './practical-effect-inputs'
import { withEvaluation } from '../core/evaluation'
import { ProjectionCache } from './projection-cache'
import {textStyleReport} from './model-text-style'
import {MemoryLedger} from './npc-memory-ledger'
import {proposeFactionIncidents} from './npc-knowledge'
import {enrichMemoryInput,memoryEnrichmentEstimate} from './npc-memory-input'
import {consolidationTask,applyConsolidation} from './npc-memory-consolidation'
import {recallMem0} from './npc-mem0-adapter'
import {npcBroadcastKnowledgeReport} from './npc-event-knowledge'
import { runReviewQueue } from './gm-review-worker'
import { syncGmSpellRequests } from './room-spells'
import { syncNpcLifeTokens } from '../core/npc-life-state'
import {recordM1Deaths} from '../core/m1-utility'
import { dialogueAuditRequest, acceptDialogueAudit } from './npc-dialogue-audit'
import { localizeModelRequest } from '../core/output-language'
import {
  narrationAuditRequest,
  acceptNarrationAudit,
  validateNarrationAuditContext,
  narrationSourceProblem,
} from './narration-audit'
import { reviewModel } from './gm-review'
import { batchPairing } from './qq-pairing'
import { repairScriptRoomNpcTokens } from '../core/npc-token-repair'
import { reconcileReviews, reviewState } from './gm-review'
import { captureNpcSpatial } from './npc-spatial-observation'
import { captureFog } from './fog'
import { inheritFogCache } from '../core/fog'
import { refreshTrades } from './trade-engine'
import { captureFogBroadcasts } from './fog-broadcast'
import {collectMapFeedback} from './map-feedback'
import { fogProjection } from './fog'
import { renderFogImage } from './fog-image'
import { FogImageQueueError } from './fog-image-cache'
import { advanceAutomaticSpatial, scheduleSpatialPlanning } from './npc-spatial'
import { runNpcSpatialTool, spatialToolRequestSchema } from './npc-spatial-tools'
import { reviewSettingsSchema } from '../persistence/gm-review-schema'
import { practicalStateSchema } from '../persistence/practical-review-schema'
import { reconcilePracticalState } from './practical-review-state'
import { preparePracticalText, dispatchPracticalText, practicalJobAvailable, recordTextUsage, repairPracticalText, finishPracticalText,resumePracticalDrafts } from './practical-text'
import { advancePracticalSocial,socialTask,repairPracticalSocial,finishPracticalSocial } from './practical-social'
import { advancePracticalCombat } from './practical-combat'
import { schedulePracticalNpc,dispatchPracticalPlanning,repairPracticalPlan,npcPlanningTask,finishPracticalPlanning } from './practical-planning'
import { advancePracticalQuests } from './practical-quests'
import { collectQuestSuggestions } from '../core/quest-steps'
import { advancePracticalTrades } from './practical-trade'
import { advancePracticalIntents } from './practical-intents'
import { advancePracticalBattles } from './practical-battles'
import { hasPracticalDecision,runPracticalDecisions,queuePracticalReputation } from './practical-decisions'
import { advancePracticalFlow } from './practical-flow'
import { qqRoomSchema, qqWeb, qqView, qqReceive, reconcileQq, qqState } from './qq-room'
import { broadcastFeed, finalizeRoomBroadcast } from './room-broadcast'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { clone, catalogue } from '../core/engine'
import { defaultEnvironment } from '../core/combat-rules'
import { srd } from '../content/srd'
import { assetReferences, decodeAsset, importMap, exportMap } from '../persistence/map-archive'
import { validateMapWorld, parseAdventure } from '../persistence/map-schema'
import { characterSchema, packSchema } from '../persistence/schema'
import { parseEncounter } from '../persistence/combat-schema'
import { applyMap } from '../core/map'
import type { MapAsset, MapWorld } from '../core/map-types'
import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import { createRoomSchema, joinRoomSchema, requestSchema } from '../online/protocol'
import { adventure, activeScene, executeCommand, hash, projectRoom, RoomError } from './room-engine'
import { importRoomCharacters, validateRoomCharacter } from './room-characters'
import { validateCharacterRequests } from './room-character-requests'
import { MAP_ARCHIVE_BYTES } from '../core/map-limits'
import { extractScript } from '../core/script'
import { advanceNpcTurns } from './room-npc-execution'
import { executeRoomDice, advanceNpcDice } from './room-dice'
import { newInvite, shortRoomCode, validateInvite } from './room-invitations'
import type { AiProvider } from '../core/ai-types'
import { httpAiProvider, modelEndpoint } from './ai-provider'
import { modelOutputError } from './model-output-contract'
import { fitModelContext } from './ai-context-budget'
import { npcEventInputReport } from './npc-perception'
import { advanceDiscoveryDice } from './room-dice'
import { publicDialogueSourceIds, notifyDialogueReview } from './npc-dialogue-review'
import { selectNpcMemories } from './npc-memory'
import { resolveJobModel } from './model-routing'
import { scheduleResponses } from './npc-activity'
import { nextDialogueJob } from './dialogue-lifecycle'
import { dialogueSegments } from '../core/dialogue-segments'
import { roomMessages, messageNpcs } from './room-messages'
import {
  queueModelProbe,
  aggregateAi,
  journal,
  fallbackText,
  modelRequest,
  acceptModelOutput,
  autoPublish,
  prepareScriptedNpc,
  liveConversation,
} from './room-ai'

type AssetRecord = Omit<MapAsset, 'blob' | 'preview'> & {
  file: string
  preview?: { mime: MapAsset['mime']; width: number; height: number; file: string }
}
export class RoomStore {
  private memoryWorkers=new Map<string,Promise<void>>()
  private memoryCalls=new Map<string,AbortController>()
  private memory?:MemoryLedger
  private ledger(){return this.memory??=new MemoryLedger(path.join(this.directory,'npc-memory'))}
  private assetRecords = new WeakMap<MapAsset, AssetRecord>()
  private rooms = new Map<string, { room: Room; assets: MapAsset[] }>()
  private queues = new Map<string, Promise<unknown>>()
  private listeners = new Map<string, Set<() => void>>()
  private workers = new Map<string, Promise<void>>()
  private calls = new Map<string, { attempt: string; controller: AbortController }>()
  private reviewWorkers = new Map<string, Promise<void>>()
  private reviewCalls = new Map<string, AbortController>()
  private closed = false
  private timings = new Map<string, string>()
  private projections = new ProjectionCache()
  private practicalTimer:ReturnType<typeof setInterval>
  commandTimings(id: string) {
    return this.timings.get(id) ?? ''
  }
  constructor(
    public directory: string,
    private provider: AiProvider = httpAiProvider,
  ) { this.practicalTimer=setInterval(()=>this.tickPractical(),1000);this.practicalTimer.unref() }
  close() {
    this.closed = true
    clearInterval(this.practicalTimer)
    for (const call of this.reviewCalls.values()) call.abort()
    for (const call of this.calls.values()) call.controller.abort()
    for(const call of this.memoryCalls.values())call.abort()
    this.memory?.close()
    return Promise.allSettled([...this.workers.values(),...this.reviewWorkers.values(),...this.memoryWorkers.values(),...this.queues.values()])
  }
  async drainAi(id: string) {
    this.kickAi(id)
    await this.workers.get(id)
  }
  private deliveryRevisions=new DeliveryRevisions()
  private practicalTicks=new Set<string>()
  private tickPractical(){
    if(this.closed)return
    for(const [id,current] of this.rooms){
      if(this.practicalTicks.has(id)||!current.room.practicalReview?.combatNeedsAdvance&&!current.room.practicalReview?.windows.some(w=>w.status==='open')&&!current.room.practicalReview?.initiatives?.some(w=>w.status==='open')&&!current.room.practicalReview?.tasks.some(t=>t.phase==='effect-summon'&&t.deadlineAt!==undefined))continue
      this.practicalTicks.add(id)
      void this.serial(id,async()=>{
        if(this.closed)return
        const live=this.get(id),room=clone(live.room),before=JSON.stringify([room.world,room.practicalReview,room.dice])
        reconcilePracticalState(room);advancePracticalBattles(room);advancePracticalFlow(room,live.room.world)
        if(JSON.stringify([room.world,room.practicalReview,room.dice])===before)return
        syncGmSpellRequests(room);reconcileQq(room);room.revision++;await this.persist(room,live.assets);this.publish(room,live.assets);this.kickAi(id)
      }).catch(()=>{}).finally(()=>{this.practicalTicks.delete(id)})
    }
  }
  async drainReview(id: string) {
    this.kickReview(id)
    await this.reviewWorkers.get(id)
  }
  async drainMemory(id: string) {
    this.kickMemory(id)
    while (this.memoryWorkers.has(id)) await this.memoryWorkers.get(id)
  }
  private kickMemory(id: string) {
    if (this.closed || this.memoryWorkers.has(id)) return
    const promise = this.runMemory(id)
      .catch(() => {})
      .finally(() => {
        this.memoryWorkers.delete(id)
        if (!this.closed && adventure(this.get(id).room).ai?.knowledgeState?.probeRequested)
          this.kickMemory(id)
      })
    this.memoryWorkers.set(id, promise)
  }
  private async runMemory(id: string) {
    if (await this.runMemoryProbe(id)) return
    const task = await this.serial(id, async () => {
      if (this.closed) return null
      const current = this.get(id),
        room = clone(current.room)
      this.ledger().attach(room)
      let next
      try {
        next = consolidationTask(room)
      } catch {
        return null
      }
      if (!next) return null
      const j = journal(room),
        cfg = adventure(room).ai!.settings,
        usage = j.usage.filter((u) => Date.parse(u.at) > Date.now() - 3600000),
        reserve =
          Buffer.byteLength(JSON.stringify(next.request)) + (next.model.maxOutputTokens ?? 0) + 512
      if (
        (cfg.requestsPerHour !== null &&
          usage.reduce((sum, u) => sum + (u.calls ?? 1), 0) >= (cfg.requestsPerHour ?? 20)) ||
        (cfg.tokensPerHour !== null &&
          usage.reduce((sum, u) => sum + Math.max(u.reservedTokens, u.reportedTokens ?? 0), 0) +
            reserve >
            (cfg.tokensPerHour ?? 100000))
      )
        return null
      adventure(room).ai!.knowledgeState!.consolidationRun = {
        id: next.id,
        epoch: next.epoch,
        status: 'running',
      }
      j.usage.push({
        at: new Date().toISOString(),
        jobId: next.id,
        reservedTokens: reserve,
        reportedTokens: null,
        model: next.model.model,
      })
      room.revision++
      await this.persist(room, current.assets)
      this.publish(room, current.assets)
      return next
    })
    if (!task || this.closed) return
    const controller = new AbortController(),
      timer = setTimeout(
        () => controller.abort(),
        Math.min(30000, task.model.timeoutSeconds * 1000),
      )
    this.memoryCalls.set(id, controller)
    try {
      const result = await this.provider.generate(task.request, task.model, controller.signal)
      await this.serial(id, async () => {
        if (this.closed) return
        const current = this.get(id),
          room = clone(current.room)
        this.ledger().attach(room)
        applyConsolidation(room, task, result.output)
        const usage = journal(room).usage.find((u) => u.jobId === task.id)
        if (usage) usage.reportedTokens = result.tokens
        room.revision++
        await this.persist(room, current.assets)
        this.publish(room, current.assets)
      })
    } catch {
      if (!this.closed)
        await this.serial(id, async () => {
          const current = this.get(id),
            room = clone(current.room),
            s = adventure(room).ai?.knowledgeState
          if (s && s.epoch === task.epoch) {
            s.status = '对话归纳未完成，原始记录保留；请GM明确重试'
            s.consolidationRun = { id: task.id, epoch: task.epoch, status: 'interrupted' }
            room.revision++
            await this.persist(room, current.assets)
            this.publish(room, current.assets)
          }
        })
    } finally {
      clearTimeout(timer)
      this.memoryCalls.delete(id)
    }
  }
  private async runMemoryProbe(id: string) {
    const task = await this.serial(id, async () => {
      const current = this.get(id),
        room = clone(current.room),
        ai = adventure(room).ai,
        s = ai?.knowledgeState,
        cfg = ai?.memoryConfig
      if (!s?.probeRequested || !cfg) return null
      const model = room.modelProfiles?.find((p) => p.name === cfg.embeddingModelRef)?.configuration
      s.probeRequested = false
      const usage = journal(room).usage.filter((u) => Date.parse(u.at) > Date.now() - 3600000),
        policy = ai!.settings
      if (
        !model ||
        (policy.requestsPerHour !== null &&
          usage.reduce((sum, u) => sum + (u.calls ?? 1), 0) + 2 > (policy.requestsPerHour ?? 20)) ||
        (policy.tokensPerHour !== null &&
          usage.reduce((sum, u) => sum + Math.max(u.reservedTokens, u.reportedTokens ?? 0), 0) +
            2048 >
            (policy.tokensPerHour ?? 100000))
      ) {
        s.status = 'Embedding验证配置无效或预算不足'
        await this.persist(room, current.assets)
        this.publish(room, current.assets)
        return null
      }
      modelEndpoint(model.baseUrl)
      journal(room).usage.push({
        at: new Date().toISOString(),
        jobId: crypto.randomUUID(),
        reservedTokens: 2048,
        reportedTokens: null,
        model: ('embedding:' + model.model).slice(0, 120),
        calls: 2,
      })
      room.revision++
      await this.persist(room, current.assets)
      this.publish(room, current.assets)
      return {
        ref: cfg.embeddingModelRef,
        dimension: cfg.dimension,
        model,
        epoch: s.epoch,
        adventureId: adventure(room).id,
      }
    })
    if (!task) return false
    const controller = new AbortController()
    this.memoryCalls.set(id, controller)
    let success = false
    try {
      await recallMem0({
        directory: path.join(this.directory, 'npc-memory', 'mem0'),
        scope: {
          roomId: id,
          adventureId: task.adventureId,
          npcId: 'configuration-probe',
          epoch: task.epoch + ':' + crypto.randomUUID(),
          audience: 'probe',
        },
        query: '独立Embedding连通性验证',
        records: [{ id: 'configuration-probe', text: '合成验证文本，不属于NPC世界知识或记忆。' }],
        embedding: {
          baseUrl: task.model.baseUrl,
          apiKey: task.model.apiKey,
          model: task.model.model,
          dimension: task.dimension,
        },
        signal: controller.signal,
        timeoutMs: Math.min(10000, task.model.timeoutSeconds * 1000),
      })
      success = true
    } catch {
      /* Provider errors are not projected verbatim. */
    } finally {
      this.memoryCalls.delete(id)
    }
    if (!this.closed)
      await this.serial(id, async () => {
        const current = this.get(id),
          room = clone(current.room),
          ai = adventure(room).ai,
          s = ai?.knowledgeState
        if (
          !s ||
          s.epoch !== task.epoch ||
          ai?.memoryConfig?.embeddingModelRef !== task.ref ||
          ai.memoryConfig.dimension !== task.dimension ||
          room.modelProfiles?.find((p) => p.name === task.ref)?.configuration.revision !==
            task.model.revision
        )
          return
        if (success)
          s.providerVerified = {
            ref: task.ref,
            revision: task.model.revision,
            dimension: task.dimension,
            at: new Date().toISOString(),
          }
        else delete s.providerVerified
        s.status = success
          ? 'Embedding验证通过，可明确启用Mem0'
          : 'Embedding验证失败，继续使用本地检索'
        room.revision++
        await this.persist(room, current.assets)
        this.publish(room, current.assets)
      })
    return true
  }
  async init() {
    await mkdir(this.directory, { recursive: true })
    for (const filename of await readdir(this.directory)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(filename)) continue
      const data = JSON.parse(await readFile(path.join(this.directory, filename), 'utf8')) as {
        room: Room
        assets: AssetRecord[]
      }
      const r = data.room
      if(r.peerSessions)r.peerSessions=peerSessionsSchema.parse(r.peerSessions)
      validateCharacterRequests(r)
      if (r.qq) r.qq = qqRoomSchema.parse(r.qq)
      if (
        r.version !== 1 ||
        filename !== r.id + '.json' ||
        !Array.isArray(r.members) ||
        !Number.isSafeInteger(r.revision) ||
        !Number.isSafeInteger(r.worldRevision)
      )
        throw new Error('房间存档格式不兼容：' + filename)
      r.world.adventures = r.world.adventures.map((a) => parseAdventure(a))
      r.world.characters = r.world.characters.map((c) => characterSchema.parse(c))
      r.world.encounters = r.world.encounters.map((e) => parseEncounter(e))
      r.world.packs = r.world.packs.map((p) => packSchema.parse(p))
      const readImage = async (a: {
        file: string
        mime: MapAsset['mime']
        width: number
        height: number
      }) => {
        if (!/^[a-f0-9]{64}\.bin$/.test(a.file)) throw new Error('房间图片路径不合法')
        const bytes = await readFile(path.join(this.directory, 'assets', a.file))
        if (hash(bytes.toString('base64')) + '.bin' !== a.file) throw new Error('房间图片校验失败')
        return {
          mime: a.mime,
          width: a.width,
          height: a.height,
          blob: new Blob([bytes], { type: a.mime }),
        }
      }
      const assets = await Promise.all(
        data.assets.map(async (a) => {
          const { file, preview, ...meta } = a
          return {
            ...meta,
            ...(await readImage(a)),
            ...(preview ? { preview: await readImage(preview) } : {}),
          }
        }),
      )
      assets.forEach((a, i) => this.assetRecords.set(a, data.assets[i]!))
      validateMapWorld(r.world, assets)
      const repairedNpcTokens = repairScriptRoomNpcTokens(r.world)
      if (repairedNpcTokens) r.worldRevision++
      let interrupted = repairedNpcTokens > 0
      const memoryState=adventure(r).ai?.knowledgeState
      if(memoryState?.probeRequested||memoryState?.consolidationRun?.status==='running'){if(memoryState.consolidationRun)memoryState.consolidationRun.status='interrupted';memoryState.probeRequested=false;memoryState.status='服务重启中断记忆验证／归纳，请GM明确重试';interrupted=true}

      if (r.gmReview) {
        r.gmReview.settings = reviewSettingsSchema.parse(r.gmReview.settings)
        for (const job of r.gmReview.jobs)
          if (['queued', 'running'].includes(job.status)) {
            job.status = 'escalated'
            job.reason = '服务重启中断；请GM明确重新送审'
            delete job.attempt
            interrupted = true
          }
      }
      delete r.mapFeedback // transient display history is never replayed after a server restart
      if(r.openingReadings)r.openingReadings=openingReadingsSchema.parse(r.openingReadings)
      if (r.practicalReview) {
        r.practicalReview = practicalStateSchema.parse(r.practicalReview); reconcilePracticalState(r)
        for(const task of r.practicalReview.tasks)if(task.context&&(task.status==='waiting-model'||task.status==='paused'&&task.resumeStatus==='waiting-model')){if(task.status==='paused'){task.resumeStatus='needs-gm';task.resumeReason='服务重启中断裁定，保留费用记录，不自动重复请求'}else{task.status='needs-gm';task.reason='服务重启中断裁定，保留费用记录，不自动重复请求'}}
        for(const w of r.practicalReview.windows)for(const response of w.responses){if(response.deadlineAt!==undefined)response.remainingMs=Math.max(0,response.deadlineAt-Math.min(Date.now(),(response.lastSeen??Date.now())+10000));delete response.deadlineAt;delete response.lastSeen}
        for(const w of r.practicalReview.initiatives)for(const response of w.responses){if(response.deadlineAt!==undefined)response.remainingMs=Math.max(0,response.deadlineAt-Math.min(Date.now(),(response.lastSeen??Date.now())+10000));delete response.deadlineAt;delete response.lastSeen}
        for(const task of r.practicalReview.tasks)if(task.phase==='effect-summon'&&task.lastSeenAt!==undefined){if(task.deadlineAt!==undefined)task.remainingMs=Math.max(0,task.deadlineAt-Math.min(Date.now(),task.lastSeenAt+10000));delete task.deadlineAt;delete task.lastSeenAt}
        interrupted = true
      }
      for (const job of r.world.adventures[0]?.aiLog?.jobs ?? [])
        if (job.status === 'running') {
          job.status = 'interrupted'
          job.attempt = null
          job.error = '服务重启中断了模型调用；请由 GM 决定是否重试'
          interrupted = true
        }
      const beforeTurns = JSON.stringify({ world: r.world, dice: r.dice })
      if (r.world.adventures[0]?.aiLog?.turns?.some((t) => t.state === 'running')) advanceNpcDice(r)
      if (interrupted || JSON.stringify({ world: r.world, dice: r.dice }) !== beforeTurns) {
        r.revision++
        await this.persist(r, assets)
      }
      this.rooms.set(r.id, { room: r, assets })
      this.ledger().attach(r)
      this.ledger().flush(r)
    }
  }
  private serial<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const task = (this.queues.get(id) ?? Promise.resolve()).catch(() => {}).then(fn)
    this.queues.set(id, task)
    task
      .finally(() => {
        if (this.queues.get(id) === task) this.queues.delete(id)
      })
      .catch(() => {})
    return task
  }
  private async persist(room: Room, assets: MapAsset[]) {
    if(room.peerSessions)room.peerSessions=peerSessionsSchema.parse(room.peerSessions)
    withEvaluation(() => {
    inheritFogCache(this.rooms.get(room.id)?.room.world,room.world)
    captureFog(room);refreshTrades(room);const fogBefore=this.rooms.get(room.id)?.room.world;if(fogBefore){captureFogBroadcasts(room,fogBefore);collectMapFeedback(room,fogBefore)}
    this.ledger().stage(room)
    const previous = this.rooms.get(room.id)?.room
    if (previous) reconcileReviews(previous, room)
    if (room.gmReview) room.gmReview.settings = reviewSettingsSchema.parse(room.gmReview.settings)
    validateCharacterRequests(room)
    if (room.qq) qqRoomSchema.parse(room.qq)
    validateMapWorld(room.world, assets)
    })
    const assetDir = path.join(this.directory, 'assets')
    await mkdir(assetDir, { recursive: true })
    const saveImage = async (a: {
      blob: Blob
      mime: MapAsset['mime']
      width: number
      height: number
    }) => {
      const bytes = Buffer.from(await a.blob.arrayBuffer()),
        file = hash(bytes.toString('base64')) + '.bin'
      const target = path.join(assetDir, file)
      await this.serial('_asset:' + file, async () => {
        try {
          const existing = await readFile(target)
          if (!existing.equals(bytes)) throw new Error('已有图片内容与摘要不一致')
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
          const temporary = target + '.' + randomUUID() + '.tmp'
          try {
            await writeFile(temporary, bytes, { flag: 'wx' })
            await rename(temporary, target)
          } catch (error) {
            await unlink(temporary).catch(() => {})
            throw error
          }
        }
      })
      return { file, mime: a.mime, width: a.width, height: a.height }
    }
    const records: AssetRecord[] = []
    // Large script backgrounds are persisted one at a time to bound conversion memory.
    for (const a of assets) {
      const cached = this.assetRecords.get(a)
      if (cached) {
        records.push(cached)
        continue
      }
      const { blob, preview, ...meta } = a
      const record = {
        ...meta,
        ...(await saveImage(a)),
        ...(preview ? { preview: await saveImage(preview) } : {}),
      }
      this.assetRecords.set(a, record)
      records.push(record)
    }
    const file = path.join(this.directory, room.id + '.json'),
      temporary = file + '.' + randomUUID() + '.tmp'
    const savedAt = new Date().toISOString()
    try {
      await writeFile(
        temporary,
        JSON.stringify({ room: { ...room, lastSavedAt: savedAt }, assets: records }),
        { flag: 'wx' },
      )
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temporary, file)
          break
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code
          if (
            process.platform !== 'win32' ||
            !['EPERM', 'EBUSY'].includes(code ?? '') ||
            attempt >= 4
          )
            throw error
          // Windows scanners or another reader may briefly hold the target; retain atomic replacement.
          await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt))
        }
      }
      room.lastSavedAt = savedAt
      // JSON has committed the recoverable outbox. A failed index write must not undo the action.
      try{this.ledger().flush(room)}catch{const state=adventure(room).ai?.knowledgeState;if(state)state.status='记忆账本待补写；原事件与待写任务已保存'}
    } catch (error) {
      await unlink(temporary).catch(() => {})
      throw error
    }
  }
  async create(input: unknown) {
    const parsed = createRoomSchema.parse(input)
    const imported = await importMap(
      parsed.archive,
      { adventures: [], characters: [], encounters: [], packs: [] },
      [],
    )
    return this.createPrepared(
      parsed.name,
      parsed.nickname,
      imported,
      parsed.characters,
      Object.fromEntries(
        parsed.archive.characters.map((c, i) => [c.id, imported.world.characters[i]!.id]),
      ),
    )
  }
  /** Script instances already have scoped fresh IDs and binary assets. No base64 round trip. */
  async createPrepared(
    name: string,
    nickname: string,
    imported: { world: MapWorld; assets: MapAsset[] },
    characters: Parameters<typeof importRoomCharacters>[1] = [],
    characterSources: Record<string, string> = {},
  ) {
    if (!name.trim() || name.length > 120) throw new RoomError('房间名称无效')
    if (!nickname.trim() || nickname.length > 60) throw new RoomError('GM 昵称无效')
    return this.serial('_create', async () => {
      if (this.rooms.size >= 20) throw new RoomError('服务最多保留 20 个房间')
      validateMapWorld(imported.world, imported.assets)
      try {
        imported.world.characters.forEach((c) => validateRoomCharacter(c, imported.world.packs))
      } catch (e) {
        throw new RoomError(e instanceof Error ? e.message : '角色校验失败')
      }
      const token = randomBytes(32).toString('base64url'),
        invite = newInvite()
      const gm: RoomMember = {
        id: randomUUID(),
        nickname,
        role: 'gm',
        tokenHash: hash(token),
        characterIds: [],
        actorIds: [],
        revoked: false,
      }
      const room: Room = {
        version: 1,
        id: randomUUID(),
        name,
        revision: 0,
        worldRevision: 0,
        world: imported.world,
        characterSources,
        inviteHash: hash(invite),
        inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        inviteEnabled: true,
        members: [gm],
        environment: defaultEnvironment(),
        intents: [],
        events: [],
        receipts: [],
      }
      // Map archives do not carry room members. Their retained holds belong to the new GM,
      // including snapshots, so a later restore cannot resurrect an inaccessible old session.
      let reboundControls=0
      for(const a of room.world.adventures){
        const snapshots=[a,...a.checkpoints.map(cp=>cp.snapshot.adventure),...a.log.flatMap(e=>e.before?[e.before.adventure]:[])]
        for(const snapshot of snapshots)for(const hold of snapshot.gmControls??[]){hold.gmId=gm.id;reboundControls++}
      }
      if(reboundControls)room.events.push({id:randomUUID(),at:new Date().toISOString(),sessionId:gm.id,detail:'从冒险存档新建房间：原接管记录归属本房间GM，资源与待结算保留'})
      while (
        [...this.rooms.values()].some(
          ({ room: other }) => shortRoomCode(other) === shortRoomCode(room),
        )
      )
        room.id = randomUUID()
      if (characters.length) {
        try {
          importRoomCharacters(room, characters)
        } catch (e) {
          throw new RoomError(e instanceof Error ? e.message : '角色导入失败')
        }
        room.worldRevision = 0
      }
      for (const event of room.world.adventures[0]?.broadcastLog?.events ?? []) {
        event.roomId = room.id
        event.facts.imported = true
      }
      await this.persist(room, imported.assets)
      this.rooms.set(room.id, { room, assets: imported.assets })
      return { roomId: room.id, token, invite, view: projectRoom(room, gm, imported.assets) }
    })
  }
  async join(roomId: string, input: unknown) {
    roomId = this.resolveRoomId(roomId)
    const parsed = joinRoomSchema.parse(input)
    return this.serial(roomId, async () => {
      const current = this.get(roomId)
      validateInvite(current.room, parsed.invite)
      if (current.room.members.filter((m) => !m.internalNpcId).length >= 30)
        throw new RoomError('房间最多 30 个成员身份')
      const room = clone(current.room),
        token = randomBytes(32).toString('base64url')
      const member: RoomMember = {
        id: randomUUID(),
        nickname: parsed.nickname,
        role: 'player',
        tokenHash: hash(token),
        characterIds: [],
        actorIds: [],
        revoked: false,
      }
      room.members.push(member)
      room.revision++
      await this.persist(room, current.assets)
      this.publish(room, current.assets)
      return { roomId, token, view: projectRoom(room, member, current.assets) }
    })
  }
  private get(id: string) {
    const current = this.rooms.get(id)
    if (!current) throw new RoomError('房间不存在', 404)
    return current
  }
  resolveRoomId(code: string) {
    if (this.rooms.has(code)) return code
    const matches = [...this.rooms.values()].filter(
      ({ room }) => shortRoomCode(room) === code.trim().toUpperCase(),
    )
    if (matches.length !== 1)
      throw new RoomError(matches.length ? '短房间号冲突，请使用完整房间 ID' : '房间不存在', 404)
    return matches[0]!.room.id
  }
  async requestLanJoin(code: string, input: unknown) {
    const parsed = joinRoomSchema.parse(input),
      id = this.resolveRoomId(code)
    return this.serial(id, async () => {
      const current = this.get(id),
        room = clone(current.room)
      validateInvite(room, parsed.invite)
      room.lanRequests ??= []
      if (room.lanRequests.filter((r) => r.status === 'pending').length >= 20)
        throw new RoomError('待加入申请已满')
      const ticket = randomBytes(32).toString('base64url'),
        requestId = randomUUID()
      room.lanRequests.push({
        id: requestId,
        nickname: parsed.nickname,
        tokenHash: hash(ticket),
        status: 'pending',
        at: new Date().toISOString(),
      })
      room.lanRequests = room.lanRequests.slice(-100)
      room.revision++
      await this.persist(room, current.assets)
      this.publish(room, current.assets)
      return { roomId: id, requestId, ticket, status: 'pending' as const }
    })
  }
  pollLanJoin(roomId: string, requestId: string, ticket: string) {
    const r = this.get(roomId).room.lanRequests?.find(
      (r) => r.id === requestId && r.tokenHash === hash(ticket),
    )
    if (!r) throw new RoomError('入网申请无效', 401)
    if (r.status === 'approved') this.authenticate(roomId, ticket)
    return { status: r.status, ...(r.status === 'approved' ? { roomId, token: ticket } : {}) }
  }
  authenticate(id: string, token: string) {
    const { room } = this.get(id),
      member = room.members.find((m) => m.tokenHash === hash(token) && !m.revoked)
    if (!member) throw new RoomError('身份失效或权限已撤销', 401)
    return member
  }
  view(id: string, token: string, live = false) {
    const member = this.authenticate(id, token),
      current = this.get(id)
    return this.projections.get(current.room, member, live, () => projectRoom(current.room, member, current.assets, live))
  }
  async commandReceipt(id: string, token: string, requestId: string) {
    if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new RoomError('提交编号不合法')
    return this.serial(id, async () => {
      const member = this.authenticate(id, token)
      const receipt = this.get(id).room.receipts.find((r) => r.id === requestId)
      if (receipt && receipt.sessionId !== member.id) throw new RoomError('提交不属于此会话', 403)
      return { committed: !!receipt, revision: receipt?.revision ?? null }
    })
  }
  async command(id: string, token: string, input: unknown, live = false) {
    const queuedAt = performance.now()
    const request = requestSchema.parse(input),
      digest = hash(JSON.stringify(request.command))
    const configurationImport =
      request.command.kind === 'map' &&
      ['npc-config-import', 'broadcast-text-import'].includes(request.command.command.type)
    const observationOnly = ['npc-activity-check', 'npc-activity-test', 'npc-test-cancel', 'review-archive-expired'].includes(
      request.command.kind,
    )
    const view = await this.serial(id, async () => {
      const enteredAt = performance.now()
      const stages: Record<string,number> = {}
      let stageAt=enteredAt
      const mark=(name:string)=>{const now=performance.now();stages[name]=now-stageAt;stageAt=now}
      const member = this.authenticate(id, token),
        current = this.get(id)
      const receipt = current.room.receipts.find((r) => r.id === request.id)
      if (receipt) {
        if (receipt.sessionId !== member.id || receipt.hash !== digest)
          throw new RoomError('命令 ID 已用于其他内容', 409)
        return this.view(id, token, live)
      }
      if(isDeliveryCommand(request.command)){
        // Delivery validates its actual window/owner instead of competing with
        // unrelated global revisions. It must not run the business pipeline.
        const room=clone(current.room),actor=room.members.find(m=>m.id===member.id)!
        this.ledger().attach(room)
        const before=deliverySemantics(room)
        if(!executePracticalResponse(room,actor,request.command)&&!executePracticalInitiative(room,actor,request.command)&&!executePracticalEffectInput(room,actor,request.command))throw new RoomError('无效送达命令')
        let timingOnly=before===deliverySemantics(room)
        room.revision++
        room.receipts.push({id:request.id,sessionId:actor.id,hash:digest,revision:room.revision});room.receipts=room.receipts.slice(-128)
        await this.persist(room,current.assets)
        timingOnly=timingOnly&&before===deliverySemantics(room)
        // Expiry or any other semantic mutation closes the compatibility range.
        this.deliveryRevisions.record(id,current.room.revision,room.revision,timingOnly)
        this.publish(room,current.assets,false)
        return this.view(id,token,live)
      }
      if (request.revision !== current.room.revision&&!this.deliveryRevisions.allows(id,request.revision,current.room.revision))
        throw new RoomError('房间已更新，请刷新后重新提交；本次没有结算', 409)
      const room = clone(current.room),
        actor = room.members.find((m) => m.id === member.id)!,
        command = request.command
      this.ledger().attach(room)
      mark('clone')
      let assets = current.assets
      if (
        [
          'model-config',
          'model-clear',
          'model-profile-save',
          'model-profile-delete',
          'model-profile-test',
        ].includes(command.kind)
      ) {
        if (actor.role !== 'gm') throw new RoomError('模型配置需要 GM', 403)
        if (command.kind === 'model-profile-test') {
          if (!room.modelProfiles?.some((p) => p.name === command.name))
            throw new RoomError('模型配置不存在')
          queueModelProbe(room, command.name)
        } else if (command.kind === 'model-profile-save') {
          modelEndpoint(command.configuration.baseUrl)
          room.modelProfiles ??= []
          const old = room.modelProfiles.find((p) => p.name === command.name)
          if (!old && room.modelProfiles.length >= 20) throw new RoomError('模型配置最多20套')
          const { clearKey, apiKey, ...cfg } = command.configuration
          const entry = {
            name: command.name,
            configuration: {
              ...cfg,
              apiKey: clearKey ? '' : apiKey || old?.configuration.apiKey || '',
              revision: (old?.configuration.revision ?? 0) + 1,
            },
          }
          const memory=adventure(room).ai
          if(memory?.memoryConfig?.embeddingModelRef===command.name&&memory.knowledgeState){delete memory.knowledgeState.providerVerified;memory.knowledgeState.status='Embedding配置已更新，请重新验证；使用本地检索'}
          if (old) room.modelProfiles[room.modelProfiles.indexOf(old)] = entry
          else room.modelProfiles.push(entry)
        } else if (command.kind === 'model-profile-delete') {
          const a = adventure(room)
          if (
            room.gmReview?.settings.modelRef === command.name ||
            a.ai?.settings.narrationModelRef === command.name ||
            a.ai?.settings.npcModelRef === command.name ||
            a.ai?.memoryConfig?.embeddingModelRef===command.name ||
            a.ai?.memoryConfig?.extractorModelRef===command.name ||
            a.ai?.npcs.some((n) => n.modelRef === command.name)
          )
            throw new RoomError('模型仍被引用，请先更改旁白／NPC／审核的分配')
          room.modelProfiles = (room.modelProfiles ?? []).filter((p) => p.name !== command.name)
        } else if (command.kind === 'model-clear') delete room.aiModel
        else if (command.kind === 'model-config') {
          modelEndpoint(command.configuration.baseUrl)
          const { clearKey, apiKey, ...cfg } = command.configuration
          room.aiModel = {
            ...cfg,
            apiKey: clearKey ? '' : apiKey || room.aiModel?.apiKey || '',
            revision: (room.aiModel?.revision ?? 0) + 1,
          }
        }
        for (const job of journal(room).jobs)
          if (job.status === 'running' && command.kind !== 'model-profile-test') {
            job.status = 'interrupted'
            job.attempt = null
            job.error = '模型配置已变化，请重新生成'
          }
      } else if (command.kind === 'background') {
        if (actor.role !== 'gm') throw new RoomError('背景编辑需要 GM', 403)
        if (current.assets.some((a) => a.id === command.asset.id))
          throw new RoomError('图片 ID 已存在，请重新导入')
        const asset = await decodeAsset(command.asset)
        if (command.scene.background?.assetId !== asset.id)
          throw new RoomError('图片与场景配置不一致')
        room.world = applyMap(
          room.world,
          adventure(room).id,
          { type: 'scene-edit', scene: command.scene },
          catalogue([srd, ...room.world.packs]),
        )
        assets = [...assets, asset]
        room.worldRevision++
      } else {
        try {
          executeRoomDice(room, actor, command)
        } catch (e) {
          if (e instanceof RoomError) throw e
          throw new RoomError(e instanceof Error ? e.message : '规则校验失败')
        }
      }
      mark('execute')
      withEvaluation(() => {
      syncGmSpellRequests(room)
      if(!configurationImport&&!observationOnly)resumePracticalDrafts(room,autoPublish)
      if(!configurationImport&&!observationOnly)advancePracticalSocial(room)
      if(!configurationImport&&!observationOnly)advancePracticalTrades(room)
      if(!configurationImport&&!observationOnly)advancePracticalIntents(room)
      if(!configurationImport&&!observationOnly)advancePracticalBattles(room)
      if(!configurationImport&&!observationOnly)advancePracticalCombat(room)
      captureFog(room)
      refreshTrades(room)
      captureNpcSpatial(room)
      if(!configurationImport&&!observationOnly&&command.kind!=='npc-spatial'&&!command.kind.startsWith('dice-'))advanceAutomaticSpatial(room,actor)
      captureNpcSpatial(room)
      mark('spatial')
      const references = assetReferences(adventure(room))
      assets = assets.filter((a) => references.has(a.id))
      finalizeRoomBroadcast(room, current.room.world, command, request.id)
      captureFogBroadcasts(room,current.room.world)
      // Some confirmed events are appended by room-level/dice routes after applyMap.
      // Consume only this transaction's new facts; never replay old history on refresh/import/restore.
      if (!configurationImport && !observationOnly && !(command.kind === 'map' && ['restore','undo'].includes(command.command.type)) && adventure(room).broadcastLog?.branchId === adventure(current.room).broadcastLog?.branchId) {
        const cursor = adventure(current.room).broadcastLog?.nextSequence ?? 1
        collectQuestSuggestions(adventure(room), (adventure(room).broadcastLog?.events ?? []).filter(e => e.sequence >= cursor))
      }
      proposeFactionIncidents(room,(adventure(room).broadcastLog?.events??[]).filter(e=>e.sequence>=(adventure(current.room).broadcastLog?.nextSequence??1)))
      if(!configurationImport&&!observationOnly)advancePracticalQuests(room)
      if(!configurationImport&&!observationOnly)queuePracticalReputation(room)
      if (!configurationImport && !observationOnly) {
        aggregateAi(room, current.room.world, command)
        advanceDiscoveryDice(room)
        aggregateAi(room, current.room.world, command)
        advanceNpcDice(room)
        advancePracticalFlow(room,current.room.world)
      }
      recordM1Deaths(room.world,current.room.world)
      reconcilePracticalState(room)
      if(!configurationImport&&!observationOnly)schedulePracticalNpc(room)
      syncNpcLifeTokens(room.world)
      reconcileQq(room)
      if(!configurationImport&&!observationOnly)scheduleSpatialPlanning(room)
      room.revision++
      room.receipts.push({
        id: request.id,
        sessionId: actor.id,
        hash: digest,
        revision: room.revision,
      })
      room.receipts = room.receipts.slice(-128)
      mark('finalize')
      })
      const rulesAt = performance.now()
      await this.persist(room, assets)
      const savedAt = performance.now()
      this.deliveryRevisions.clear(id)
      this.publish(room, assets)
      const response = this.view(id, token, live)
      this.timings.set(
        id,
        `queue;dur=${(enteredAt - queuedAt).toFixed(1)}, rules;dur=${(rulesAt - enteredAt).toFixed(1)}, persist;dur=${(savedAt - rulesAt).toFixed(1)}, projection;dur=${(performance.now() - savedAt).toFixed(1)}, ${Object.entries(stages).map(([name,ms])=>`${name};dur=${ms.toFixed(1)}`).join(', ')}`,
      )
      return response
    })
    if(isDeliveryCommand(request.command))return view
    this.cancelInvalidCall(id)
    if (!configurationImport && request.command.kind !== 'npc-activity-check') this.kickAi(id)
    return view
  }
  qqMemberView(id: string, token: string, bindingId: string) {
    return qqView(this.get(id).room, this.authenticate(id, token), bindingId)
  }
  async qqBatchPairing(
    id: string,
    token: string,
    bindings: { id: string; key: string; name: string }[],
    input?: unknown,
  ) {
    return this.serial(id, async () => {
      const current = this.get(id),
        member = this.authenticate(id, token),
        room = clone(current.room)
      const result = batchPairing(room, member, bindings, input)
      if (input) {
        room.revision++
        await this.persist(room, current.assets)
        this.publish(room, current.assets)
      }
      return result
    })
  }
  /** Server-only routing metadata; no model secrets or mutable world references. */
  qqRoutingSnapshot(id: string) {
    const room = this.get(id).room,
      a = room.world.adventures[0]
    return {
      contentLocale:a?.ai?.settings.contentLocale,
      qq: room.qq ? clone(room.qq) : undefined,
      activeSceneId: a?.activeSceneId,
      branchId: a?.broadcastLog?.branchId,
      npcs:
        a?.ai?.npcs.map((n) => ({
          id: n.id,
          name: n.name,
          npcType: n.npcType,
          sceneId: n.sceneId,
          enabled: n.enabled,
          hidden: n.hidden,
          absent: !!n.initiallyAbsent && !n.appeared,
          dead: !!n.body?.dead || (!!n.body && n.body.hp <= 0),
        })) ?? [],
      events: (a?.broadcastLog?.events ?? [])
        .filter(
          (e) => e.audience.kind === 'public' && e.phase !== 'pending' && e.narration !== 'context',
        )
        .map((e) => ({
          id: e.id,
          branchId: e.branchId,
          sequence: e.sequence,
          type: e.type,
          causeId: e.causeId,
          actionId: e.actionId,
          facts: { turnId: e.facts.turnId ?? null, closedTurnId: e.facts.closedTurnId ?? null },
        })),
      narrationPending: (a?.aiLog?.jobs ?? [])
        .filter(
          (j) =>
            j.kind === 'narration' &&
            j.branchId === a?.broadcastLog?.branchId &&
            !j.modelProbe &&
            !j.skillPreview &&
            j.audience.kind === 'public' &&
            !['published', 'skipped', 'rejected', 'canceled'].includes(j.status),
        )
        .map((j) => ({ eventIds: j.kind === 'narration' ? j.eventIds : [] })),
    }
  }
  async qqMemberCommand(id: string, token: string, bindingId: string, input: unknown) {
    return this.serial(id, async () => {
      const current = this.get(id),
        member = this.authenticate(id, token),
        room = clone(current.room)
      const result = qqWeb(room, member, bindingId, input)
      room.revision++
      await this.persist(room, current.assets)
      this.publish(room, current.assets)
      this.cancelInvalidCall(id)
      return result
    })
  }
  async qqBind(id: string, bindingId: string, additional = false) {
    return this.serial(id, async () => {
      const current = this.get(id)
      if (
        current.room.qq?.activeBindingId === bindingId ||
        (additional && current.room.qq?.activeBindingIds?.includes(bindingId))
      )
        return
      const room = clone(current.room)
      const q = qqState(room)
      if (additional) {
        if (!q.activeBindingId) throw new RoomError('请先绑定主Bot与房间')
        q.activeBindingIds = [...new Set([...(q.activeBindingIds ?? []), bindingId])]
      } else {
        q.activeBindingId = bindingId
        q.activeBindingIds = []
        for (const i of q.identities) if (i.bindingId !== bindingId) i.revoked = true
        for (const session of q.sessions) if (session.bindingId !== bindingId) session.closed = true
        q.codes = q.codes.filter((c) => c.bindingId === bindingId)
      }
      reconcileQq(room)
      room.revision++
      await this.persist(room, current.assets)
      this.publish(room, current.assets)
    })
  }
  async qqUnbind(id: string, bindingId: string) {
    return this.serial(id, async () => {
      const current = this.get(id),
        room = clone(current.room)
      if (!room.qq) return
      const primary = room.qq.activeBindingId === bindingId
      if (primary) {
        delete room.qq.activeBindingId
        room.qq.activeBindingIds = []
      } else room.qq.activeBindingIds = room.qq.activeBindingIds?.filter((id) => id !== bindingId)
      for (const i of room.qq.identities) if (primary || i.bindingId === bindingId) i.revoked = true
      room.qq.codes = room.qq.codes.filter((c) => c.bindingId !== bindingId)
      reconcileQq(room)
      room.revision++
      await this.persist(room, current.assets)
      this.publish(room, current.assets)
      this.cancelInvalidCall(id)
    })
  }
  async qqInput(id: string, bindingId: string, identity: string, source: string, text: string) {
    return (await this.qqInputResult(id, bindingId, identity, source, text)).response
  }
  /** Small GM-only pairing counts; do not clone QQ receipts, contexts or public history. */
  qqPairingCounts(id: string, token: string, bindingIds: string[]) {
    if (this.authenticate(id, token).role !== 'gm') throw new RoomError('运行摘要仅供GM查看', 403)
    const room = this.get(id).room
    const players = room.members.filter((m) => m.role === 'player' && !m.revoked)
    const bindings = [...new Set(bindingIds)]
    const active = new Set([room.qq?.activeBindingId, ...(room.qq?.activeBindingIds ?? [])])
    let pairedPlayers = 0,
      fullyPairedPlayers = 0
    for (const member of players) {
      const paired = bindings.filter(
        (binding) =>
          active.has(binding) &&
          room.qq?.identities.some(
            (i) =>
              !i.revoked &&
              i.bindingId === binding &&
              i.memberId === member.id &&
              member.characterIds.includes(i.characterId),
          ),
      )
      if (paired.length) pairedPlayers++
      if (bindings.length && paired.length === bindings.length) fullyPairedPlayers++
    }
    return { players: players.length, pairedPlayers, fullyPairedPlayers }
  }
  /** Return the conversation receipt from the same committed input, not a later mutable snapshot. */
  qqInputReceipt(id: string, bindingId: string, source: string) {
    const room = this.get(id).room
    if (room.qq?.activeBindingId !== bindingId && !room.qq?.activeBindingIds?.includes(bindingId))
      return undefined
    const receipt = room.qq?.receipts.find((r) => r.source === source)
    return receipt ? { conversationId: receipt.conversationId } : undefined
  }
  async qqInputResult(
    id: string,
    bindingId: string,
    identity: string,
    source: string,
    text: string,
  ) {
    const result = await this.serial(id, async () => {
      const current = this.get(id)
      const receipt = current.room.qq?.receipts.find((r) => r.source === source)
      if (receipt) return { response: receipt.response, conversationId: receipt.conversationId }
      const room = clone(current.room)
      if (
        room.messageDelivery === 'web' &&
        /^(对话|直聊|继续对话|加入对话|领取回复|行动)(?:\s|$)/.test(text)
      )
        throw new RoomError('本团已使用Web交流，请在网页选择NPC或提交行动', 403)
      const response = qqReceive(room, bindingId, identity, source, text)
      room.revision++
      await this.persist(room, current.assets)
      this.publish(room, current.assets)
      return {
        response,
        conversationId: room.qq?.receipts.find((r) => r.source === source)?.conversationId,
      }
    })
    this.cancelInvalidCall(id)
    this.kickAi(id)
    return result
  }
  private kickReview(id: string) {
    if (
      this.closed ||
      this.reviewWorkers.has(id) ||
      (!this.get(id).room.gmReview?.jobs.some((j) => j.status === 'queued')&&!hasPracticalDecision(this.get(id).room))
    )
      return
    let failed = false
    const host = {
      provider: this.provider,
      calls: this.reviewCalls,
      closed: () => this.closed,
      after: () => {
        this.cancelInvalidCall(id)
        this.kickAi(id)
      },
      update: <T>(fn: (r: Room) => T | undefined) =>
        this.serial(id, async () => {
          if (this.closed) return undefined
          const current = this.get(id),
            room = clone(current.room),
            result = fn(room)
          if (result === undefined) return undefined
          advancePracticalFlow(room,current.room.world)
          reconcileQq(room)
          room.revision++
          await this.persist(room, current.assets)
          this.publish(room, current.assets)
          return result
        }),
    }
    const promise = (async()=>{await runPracticalDecisions(host);await runReviewQueue(host)})()
      .catch(() => {
        failed = true
      })
      .finally(() => {
        this.reviewWorkers.delete(id)
        if (
          !failed &&
          !this.closed &&
          (this.get(id).room.gmReview?.jobs.some((j) => j.status === 'queued')||hasPracticalDecision(this.get(id).room))
        )
          this.kickReview(id)
      })
    this.reviewWorkers.set(id, promise)
  }
  private cancelInvalidCall(id: string) {
    const call = this.calls.get(id)
    if (
      call &&
      !this.get(id).room.world.adventures[0]?.aiLog?.jobs.some(
        (j) => j.status === 'running' && j.attempt === call.attempt,
      )
    )
      call.controller.abort()
  }
  private kickAi(id: string) {
    if (
      this.closed ||
      this.workers.has(id) ||
      !nextDialogueJob((this.get(id).room.world.adventures[0]?.aiLog?.jobs ?? []).filter(j => practicalJobAvailable(this.get(id).room,j)))
    )
      return
    let failed = false
    const promise = this.runAi(id)
      .catch(() => {
        failed = true
      })
      .finally(() => {
        this.workers.delete(id)
        if (
          !this.closed &&
          !failed &&
          nextDialogueJob((this.get(id).room.world.adventures[0]?.aiLog?.jobs ?? []).filter(j => practicalJobAvailable(this.get(id).room,j)))
        )
          this.kickAi(id)
      })
    this.workers.set(id, promise)
  }
  private async runAi(id: string) {
    while (!this.closed) {
      const work = await this.serial(id, async () => {
        if (!this.get(id).room.world.adventures[0]?.aiLog?.jobs.some((j) => j.status === 'queued'))
          return null
        const current = this.get(id),
          room = clone(current.room),
          j = journal(room)
        const job = nextDialogueJob(j.jobs.filter(job => practicalJobAvailable(room,job)))
        if (!job) return null
        const fallback = (error: string) => {
          if (job.kind === 'narration' && job.narrationAudit) {
            job.status = 'draft'
            job.attempt = null
            job.narrationAudit.status = 'escalated'
            job.narrationAudit.reason = error
            return
          }
          if (
            job.kind === 'npc' &&
            job.dialogueReview?.audit &&
            ['queued', 'running'].includes(job.dialogueReview.audit.status)
          ) {
            job.status = 'draft'
            job.attempt = null
            job.dialogueReview.audit.status = 'escalated'
            job.dialogueReview.audit.reason = error
            job.dialogueReview.stage = 'proofread'
            job.dialogueReview.reason = error
            return
          }
          job.status = job.kind === 'narration' && job.modelProbe ? 'skipped' : 'fallback'
          job.attempt = null
          job.error = error
          job.text = fallbackText(room, job)
          if (job.kind === 'npc' && job.dialogueReview) {
            job.dialogueReview.stage = 'failed'
            job.dialogueReview.reason = '生成失败，待 GM 接管；未自动发布备用台词'
          }
        }
        let request: ReturnType<typeof modelRequest> | null = null
        const route = resolveJobModel(room, job)
        const audit =
          job.kind === 'npc'
            ? job.dialogueReview?.audit?.status === 'queued'
            : job.narrationAudit?.status === 'queued'
        const chosen = audit ? reviewModel(room) : route.config
        const config =
          chosen && audit
            ? {
                ...chosen,
                timeoutSeconds: Math.min(
                  chosen.timeoutSeconds,
                  room.gmReview!.settings.timeoutSeconds,
                ),
              }
            : chosen
        let scripted = false
        try {
          scripted = audit || job.kind==='npc'&&job.socialDecision?.status==='queued' ? false : prepareScriptedNpc(room, job)
        } catch (e) {
          job.status = 'stale'
          job.error = e instanceof Error ? e.message : '任务状态已变化'
        }
        if (job.status === 'stale' || scripted) {
          if (scripted && job.kind === 'npc' && job.qqSessionId) autoPublish(room, job)
          /* Ordinary NPCs never incur a model request. */
        } else if (!config) fallback('尚未配置模型；可编辑固定结果后发布')
        else {
          try {
            this.ledger().attach(room)
            request = audit
              ? job.kind === 'npc'
                ? dialogueAuditRequest(room, job)
                : narrationAuditRequest(room, job)
              : modelRequest(room, job)
            if (audit) request = localizeModelRequest(request, job)
            const social=socialTask(room,job)
            if(social?.repairs)request={...request,input:{...request.input,contractCorrection:{attempt:social.repairs,validation:social.reason}}}
            if (!audit) request = preparePracticalText(room, job, request)
            const fitted = fitModelContext(
              request,
              config.contextBudgetTokens === undefined ? 32768 : config.contextBudgetTokens,
              config.maxOutputTokens,
            )
            request = fitted.request
            if (audit && job.kind === 'narration') validateNarrationAuditContext(job, request)
            if (job.kind === 'npc' && job.dialogueReview?.publicInput)
              job.dialogueReview.sourceIds = publicDialogueSourceIds(request)
            const notSelected =
              job.kind === 'npc'
                ? selectNpcMemories(
                    adventure(room).ai!.npcs.find((n) => n.id === job.npcId)!,
                    job,
                    room,
                  ).notSelectedIds
                : []
            job.inputReport = {
              sections:Object.entries(request.input).map(([key,value])=>({key,bytes:Buffer.byteLength(JSON.stringify(value)??'')})),
              textStyle:textStyleReport(job),
              ...(job.kind === 'npc'
                ? {
                    eventSelections: npcEventInputReport(
                      room,
                      adventure(room).ai!.npcs.find((n) => n.id === job.npcId)!,
                      job,
                      request,
                    ),
                  }
                : {}),
              estimatedTokens: fitted.estimatedTokens,
              budget: config.contextBudgetTokens === undefined ? 32768 : config.contextBudgetTokens,
              outputTokens: config.maxOutputTokens,
              selectedIds: [...new Set(fitted.selectedIds)],
              omittedIds: [...new Set([...notSelected, ...fitted.omittedIds])],
              preview: JSON.stringify(request.input, null, 2).slice(0, 16000),
            }
            const reserve =
              Buffer.byteLength(JSON.stringify(request)) + (config.maxOutputTokens ?? 0) + 512
            j.usage = j.usage.filter((u) => Date.parse(u.at) > Date.now() - 3600000)
            const cfg = adventure(room).ai?.settings
            if (
              (cfg?.requestsPerHour !== null && j.usage.reduce((sum,u)=>sum+(u.calls??1),0) >= (cfg?.requestsPerHour ?? 20)) ||
              (cfg?.tokensPerHour !== null &&
                j.usage.reduce((n, u) => n + Math.max(u.reservedTokens, u.reportedTokens ?? 0), 0) +
                  reserve >
                  (cfg?.tokensPerHour ?? 100000))
            )
              throw Error('本小时 AI 调用或保守 token 预算已达限额；可使用固定结果旁白')
            job.status = 'running'
            job.attempt = randomUUID()
            if (!audit) {
              job.modelRevision = config.revision
              job.modelIdentity = route.id
            } else if (job.kind === 'npc' && job.dialogueReview?.audit) {
              job.dialogueReview.audit.status = 'running'
              job.dialogueReview.audit.calls++
              job.dialogueReview.audit.model = config.model
            } else if (job.kind === 'narration' && job.narrationAudit) {
              job.narrationAudit.status = 'running'
              job.narrationAudit.calls++
              job.narrationAudit.model = config.model
            }
            j.usage.push({
              at: new Date().toISOString(),
              jobId: job.id,
              reservedTokens: reserve,
              reportedTokens: null,
              model: config.model,
            })
            if (!audit) dispatchPracticalText(room, job)
            if (!audit) dispatchPracticalPlanning(room, job)
            if (!audit && job.kind==='npc'&&job.socialDecision?.status==='queued') {
              const t=room.practicalReview?.tasks.find(t=>t.id===job.socialDecision!.taskId)
              if(t)t.calls[t.repairs?'repair':'adjudication']++
            }
          } catch (e) {
            fallback(e instanceof Error ? e.message : '模型请求准备失败')
          }
        }
        notifyDialogueReview(room, job)
        finishPracticalText(room,job);finishPracticalSocial(room,job);finishPracticalPlanning(room,job)
        for (const event of adventure(room).broadcastLog?.events ?? [])
          if (event.sequence > (adventure(current.room).broadcastLog?.nextSequence ?? 1) - 1) {
            event.roomId = room.id
            event.worldRevision = room.worldRevision
          }
        reconcileQq(room)
        room.revision++
        await this.persist(room, current.assets)
        this.publish(room, current.assets)
        return request && job.status === 'running' && config
          ? { jobId: job.id, attempt: job.attempt!, config: clone(config), request, audit,
              usageAt:[...j.usage].reverse().find(u=>u.jobId===job.id)?.at,
              taskIds:(room.practicalReview?.tasks??[]).filter(t=>t.branchId===job.branchId&&(t.sourceId===job.id||t.receipts.includes('job:'+job.id))).map(t=>t.id) }
          : { fallback: true as const }
      })
      if (!work) return
      if ('fallback' in work) continue
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), work.config.timeoutSeconds * 1000)
      this.calls.set(id, { attempt: work.attempt, controller })
      const started = performance.now()
      try {
        let result: Awaited<ReturnType<AiProvider['generate']>> | null = null,
          failure = ''
        try {
          if(!work.audit){
            const memoryWork=await this.serial(id,async()=>{
              const current=this.get(id),room=clone(current.room),job=journal(room).jobs.find(j=>j.id===work.jobId)
              if(this.closed||controller.signal.aborted||!job||job.status!=='running'||job.attempt!==work.attempt)throw Error('模型请求已失效')
              if(job.kind==='npc')liveConversation(room,job)
              this.ledger().attach(room)
              const estimate=memoryEnrichmentEstimate(room,job,this.directory);if(!estimate)return null
              const j=journal(room),cfg=adventure(room).ai!.settings,usage=j.usage.filter(u=>Date.parse(u.at)>Date.now()-3600000)
              const exceeds=(cfg.requestsPerHour!==null&&usage.reduce((sum,u)=>sum+(u.calls??1),0)+estimate.calls>(cfg.requestsPerHour??20))||(cfg.tokensPerHour!==null&&usage.reduce((sum,u)=>sum+Math.max(u.reservedTokens,u.reportedTokens??0),0)+estimate.reservedTokens>(cfg.tokensPerHour??100000))
              if(exceeds){adventure(room).ai!.knowledgeState!.status='记忆Embedding保守预算不足，使用本地检索';await this.persist(room,current.assets);this.publish(room,current.assets);return null}
              j.usage.push({at:new Date().toISOString(),jobId:job.id+':memory',reservedTokens:estimate.reservedTokens,reportedTokens:null,model:estimate.model.slice(0,120),calls:estimate.calls});room.revision++;await this.persist(room,current.assets);this.publish(room,current.assets);return {room,job,estimate}
            })
            if(memoryWork){const enriched=await enrichMemoryInput(memoryWork.room,memoryWork.job,work.request,this.directory,controller.signal)
              const fitted=fitModelContext(enriched.request,work.config.contextBudgetTokens===undefined?32768:work.config.contextBudgetTokens,work.config.maxOutputTokens)
              work.request=fitted.request
              await this.serial(id,async()=>{
                const current=this.get(id),room=clone(current.room),job=journal(room).jobs.find(j=>j.id===work.jobId)
                if(this.closed||controller.signal.aborted||!job||job.status!=='running'||job.attempt!==work.attempt)throw Error('模型请求已失效')
                if(job.kind==='npc')liveConversation(room,job)
                this.ledger().attach(room)
                if(memoryEnrichmentEstimate(room,job,this.directory)?.stamp!==memoryWork.estimate.stamp)throw Error('模型记忆范围或配置已变化，请重新生成')
                const j=journal(room),usage=j.usage.find(u=>u.jobId===job.id+':memory');if(usage&&'calls'in enriched)usage.calls=enriched.calls
                const call=[...j.usage].reverse().find(u=>u.jobId===job.id),reserve=Buffer.byteLength(JSON.stringify(work.request))+(work.config.maxOutputTokens??0)+512,cfg=adventure(room).ai!.settings
                if(cfg.tokensPerHour!==null&&j.usage.reduce((sum,u)=>sum+Math.max(u===call?reserve:u.reservedTokens,u.reportedTokens??0),0)>(cfg.tokensPerHour??100000))throw Error('模型补充记忆后保守token预算已达限额')
                if(call)call.reservedTokens=reserve
                const state=adventure(room).ai?.knowledgeState;if(state)state.status=enriched.status
                if(job.kind==='npc'&&job.dialogueReview?.publicInput)job.dialogueReview.sourceIds=publicDialogueSourceIds(work.request)
                if(job.inputReport){job.inputReport.selectedIds=fitted.selectedIds;job.inputReport.omittedIds=[...new Set([...job.inputReport.omittedIds,...fitted.omittedIds])].filter(id=>!fitted.selectedIds.includes(id));job.inputReport.estimatedTokens=fitted.estimatedTokens;job.inputReport.preview=JSON.stringify(work.request.input,null,2).slice(0,16000)}
                room.revision++;await this.persist(room,current.assets);this.publish(room,current.assets)
              })
            }
          }
          const currentJob=journal(this.get(id).room).jobs.find(j=>j.id===work.jobId)
          if(this.closed||controller.signal.aborted||!currentJob||currentJob.status!=='running'||currentJob.attempt!==work.attempt)throw Error('模型请求已取消')
          if(currentJob.kind==='npc')liveConversation(this.get(id).room,currentJob)
          result = await this.provider.generate(work.request, work.config, controller.signal)
        } catch (e) {
          failure = controller.signal.aborted
            ? '模型请求已取消或超时'
            : e instanceof Error && e.message.startsWith('模型')
              ? e.message
              : '模型调用失败，请检查后台地址与配置'
        }
        await this.serial(id, async () => {
          if(this.closed)return
          const current = this.get(id),
            room = clone(current.room),
            job = journal(room).jobs.find((x) => x.id === work.jobId)
          this.ledger().attach(room)
          if (
            !job ||
            job.status !== 'running' ||
            job.attempt !== work.attempt ||
            job.modelRevision !== resolveJobModel(room, job).config?.revision ||
            job.modelIdentity !== resolveJobModel(room, job).id
          ) {
            // A canceled or replaced request may still report provider usage. Preserve its
            // own reservation/ledger only; never apply its output to a newer task or branch.
            const usage=result&&!work.audit&&journal(room).usage.find(u=>u.jobId===work.jobId&&u.at===work.usageAt)
            if(usage&&usage.reportedTokens===null&&result?.tokens!==null&&result?.tokens!==undefined){
              usage.reportedTokens=result.tokens
              for(const task of room.practicalReview?.tasks??[])if(work.taskIds.includes(task.id))task.reportedTokens=(task.reportedTokens??0)+result.tokens
              room.revision++;await this.persist(room,current.assets);this.publish(room,current.assets)
            }
            return
          }
          let outputAccepted = false, sourceCurrent = false
          if (!work.audit && result) {
            recordTextUsage(room, job, result.tokens)
            const social=socialTask(room,job);if(social&&result.tokens!==null)social.reportedTokens=(social.reportedTokens??0)+result.tokens
            const task=npcPlanningTask(room,job);if(task&&result.tokens!==null)task.reportedTokens=(task.reportedTokens??0)+result.tokens
            const usage = [...journal(room).usage].reverse().find(u => u.jobId === job.id)
            if (usage) usage.reportedTokens = result.tokens
          }
          try {
            if (!result) throw Error(failure)
            if (!work.audit) {
              if (job.kind === 'npc') liveConversation(room, job)
              else { const problem = narrationSourceProblem(room, job, false); if (problem) throw Error(problem) }
              sourceCurrent = true
            }
            if (work.audit) {
              if (reviewModel(room)?.revision !== work.config.revision)
                throw Error('审核模型配置已变化')
              if (job.kind === 'npc') acceptDialogueAudit(room, job, result.output)
              else acceptNarrationAudit(room, job, result.output)
            } else {
              // Reject invalid output without retaining partial job/world mutations.
              const trial = clone(room), candidate = journal(trial).jobs.find(j => j.id === job.id)!
              this.ledger().attach(trial)
              acceptModelOutput(trial, candidate, result.output)
              Object.assign(job, candidate)
              journal(trial).jobs[journal(trial).jobs.findIndex(j => j.id === job.id)] = job
              Object.assign(room, trial)
              outputAccepted = true
            }
            const usage = [...journal(room).usage].reverse().find((u) => u.jobId === job.id)
            if (usage) usage.reportedTokens = result.tokens
            job.attempt = null
            if (job.kind==='npc'&&job.socialDecision?.status==='decided') advancePracticalSocial(room)
            if (practicalJobAvailable(room,job)) autoPublish(room, job)
            scheduleResponses(room, [])
          } catch (e) {
            if (work.audit && job.kind === 'narration' && job.narrationAudit) {
              job.status = 'draft'
              job.attempt = null
              job.narrationAudit.status = 'escalated'
              job.narrationAudit.reason = failure || '旁白审核输出、依据或状态不符合约定，交GM'
              job.error = job.narrationAudit.reason
            } else if (work.audit && job.kind === 'npc' && job.dialogueReview?.audit) {
              job.status = 'draft'
              job.attempt = null
              job.dialogueReview.audit.status = 'escalated'
              job.dialogueReview.audit.reason = failure || '审核输出、依据或状态不符合约定，交GM'
              job.dialogueReview.stage = 'proofread'
              job.dialogueReview.reason = job.dialogueReview.audit.reason
              job.error = job.dialogueReview.reason
            } else if (!work.audit && result && sourceCurrent && !outputAccepted && (repairPracticalText(room, job, modelOutputError(e))||repairPracticalSocial(room,job,modelOutputError(e))||repairPracticalPlan(room,job,'规划输出不符合结构契约，请按当前已提供字段修正'))) {
              // Only contract failures retry. Provider/auth/quota and stale publication do not.
            } else {
              job.status = job.kind === 'narration' && job.modelProbe ? 'skipped' : 'fallback'
              if (job.kind === 'npc') {
                job.plan = []
                job.proposal = { kind: 'none' }
              }
              job.attempt = null
              job.text = fallbackText(room, job)
              job.error = modelOutputError(e)
              if (job.kind === 'npc' && job.dialogueReview) {
                job.dialogueReview.stage = 'failed'
                job.dialogueReview.reason = '生成失败，待 GM 接管；未自动发布备用台词'
              }
            }
          }
          if (!work.audit) finishPracticalText(room, job)
          if (!work.audit) finishPracticalSocial(room,job)
          if (!work.audit) finishPracticalPlanning(room,job)
          if (job.kind === 'npc' && job.dialogueReview) {
            if (work.audit && job.dialogueReview.audit) {
              job.dialogueReview.audit.durationMs = Math.round(performance.now() - started)
              job.dialogueReview.audit.tokens = result?.tokens ?? null
            } else job.dialogueReview.generationDurationMs = Math.round(performance.now() - started)
          }
          if (work.audit && job.kind === 'narration' && job.narrationAudit) {
            job.narrationAudit.durationMs = Math.round(performance.now() - started)
            job.narrationAudit.tokens = result?.tokens ?? null
          }
          notifyDialogueReview(room, job)
          // Publication is persisted atomically with its job marker before long-poll notification.
          for (const event of adventure(room).broadcastLog?.events ?? [])
            if (event.sequence > (adventure(current.room).broadcastLog?.nextSequence ?? 1) - 1) {
              event.roomId = room.id
              event.worldRevision = room.worldRevision
            }
          aggregateAi(room, current.room.world, { kind: 'narration-request', summary: false })
          advanceNpcDice(room)
          advancePracticalFlow(room,current.room.world);schedulePracticalNpc(room)
          reconcileQq(room)
          room.revision++
          await this.persist(room, current.assets)
          this.publish(room, current.assets)
        })
      } finally {
        clearTimeout(timer)
        if (this.calls.get(id)?.attempt === work.attempt) this.calls.delete(id)
      }
    }
  }
  feed(id: string, token: string, after: number, limit = 200) {
    return broadcastFeed(this.get(id).room, this.authenticate(id, token), after, limit)
  }
  npcKnowledgeReport(id:string,token:string){
    const member=this.authenticate(id,token)
    if(member.role!=='gm')throw new RoomError('只有GM可查看NPC知情报告',403)
    return npcBroadcastKnowledgeReport(this.get(id).room)
  }
  private spatialToolHost(id:string,token:string,npcId:string,branchId:string){
    const getRoom=()=>{if(this.authenticate(id,token).role!=='gm')throw new RoomError('NPC工具连接需要GM授权',403);return this.get(id).room}
    const room=getRoom(),binding={roomId:room.id,adventureId:adventure(room).id,npcId,branchId}
    const host={getRoom,send:(command:RoomCommand)=>this.command(id,token,{id:randomUUID(),revision:getRoom().revision,command})}
    return {binding,host}
  }
  async npcTool(id:string,token:string,input:unknown){
    const request=spatialToolRequestSchema.parse(input),{binding,host}=this.spatialToolHost(id,token,request.npcId,request.branchId)
    return runNpcSpatialTool(binding,host,request.tool,request.args)
  }
  async npcMcp(id:string,token:string,npcId:string){
    const room=this.get(id).room,{binding,host}=this.spatialToolHost(id,token,npcId,adventure(room).broadcastLog?.branchId??'legacy')
    const {createNpcMcpServer}=await import('./npc-spatial-mcp')
    return createNpcMcpServer(binding,host)
  }
  messages(id: string, token: string, before = '') {
    return roomMessages(this.get(id).room, this.authenticate(id, token), before)
  }
  pointContainer(id: string, token: string, sceneId: string, pointId: string, characterId: string) {
    return pointContainerView(this.get(id).room, this.authenticate(id, token), sceneId, pointId, characterId)
  }
  messageDelivery(id: string) {
    return this.get(id).room.messageDelivery ?? 'both'
  }
  messageDeliveryStatus(id: string) {
    const r = this.get(id).room
    return {
      mode: r.messageDelivery ?? 'both',
      ...(r.messageDeliveryState ?? {
        generation: 0,
        boundary: 0,
        branchId: adventure(r).broadcastLog?.branchId ?? 'legacy',
      }),
    }
  }
  qqReplyText(id: string, conversationId: string) {
    const a = adventure(this.get(id).room),
      j = a.aiLog?.jobs.find((j) => j.id === conversationId)
    return j?.kind === 'npc' &&
      j.purpose !== 'combat' &&
      j.visibility === 'public' &&
      j.status === 'published' &&
      j.branchId === a.broadcastLog?.branchId
      ? dialogueSegments(j.text, j.segments)
          .map((s) => s.text)
          .join('\n\n')
      : null
  }
  messageNpcs(id: string, token: string) {
    return messageNpcs(this.get(id).room, this.authenticate(id, token))
  }
  /** Dedicated external projection: no player ownership and only fully public broadcasts. */
  qqPublic(id: string, after = 0) {
    const current = this.get(id)
    const spectator: RoomMember = {
      id: 'qq-public',
      nickname: 'QQ public',
      role: 'player',
      tokenHash: '',
      characterIds: [],
      actorIds: [],
      revoked: false,
    }
    const view = projectRoom(current.room, spectator, current.assets)
    const feed = broadcastFeed(current.room, spectator, after, 200)
    feed.events = feed.events.filter((event) => event.audience.kind === 'public')
    return { view, feed }
  }
  async acknowledge(id: string, token: string, cursor: number) {
    return this.serial(id, async () => {
      const member = this.authenticate(id, token),
        current = this.get(id)
      const head = (current.room.world.adventures[0]?.broadcastLog?.nextSequence ?? 1) - 1
      if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > head)
        throw new RoomError('广播游标不合法')
      if (cursor > (current.room.broadcastAcks?.[member.id] ?? 0)) {
        const room = clone(current.room)
        room.broadcastAcks ??= {}
        room.broadcastAcks[member.id] = cursor
        await this.persist(room, current.assets)
        this.rooms.set(id, { room, assets: current.assets })
      }
      return { cursor: Math.max(cursor, current.room.broadcastAcks?.[member.id] ?? 0) }
    })
  }
  private publish(room: Room, assets: MapAsset[],wakeWorkers=true) {
    this.projections.invalidate(room.id)
    this.rooms.set(room.id, { room, assets })
    for (const [key, controller] of this.reviewCalls) {
      const j = room.gmReview?.jobs.find((j) => j.id === key)
      if (j && j.status !== 'running') controller.abort()
      const t=room.practicalReview?.tasks.find(t=>t.id===key)
      if(t&&(t.status!=='waiting-model'||t.branchId!==adventure(room).broadcastLog?.branchId))controller.abort()
    }
    if(wakeWorkers)queueMicrotask(() => {
      if (!this.closed) this.kickReview(room.id)
      if(!this.closed)this.kickMemory(room.id)
    })
    for (const notify of this.listeners.get(room.id) ?? []) notify()
  }
  async wait(id: string, token: string, since: number, signal: AbortSignal) {
    this.authenticate(id, token)
    if (this.get(id).room.revision > since) return
    await new Promise<void>((resolve) => {
      const listeners = this.listeners.get(id) ?? new Set<() => void>()
      this.listeners.set(id, listeners)
      const finish = () => {
        clearTimeout(timer)
        listeners.delete(finish)
        signal.removeEventListener('abort', finish)
        resolve()
      }
      const timer = setTimeout(finish, 25000)
      listeners.add(finish)
      signal.addEventListener('abort', finish, { once: true })
      if (signal.aborted || this.view(id, token).revision > since) finish()
    })
  }
  asset(id: string, token: string, assetId: string, preview = false) {
    const view = this.view(id, token)
    if (!view.assets.some((a) => a.id === assetId)) throw new RoomError('图片不可访问', 403)
    const asset = this.get(id).assets.find((a) => a.id === assetId)!
    return preview && asset.preview ? asset.preview : asset
  }
  async fogAsset(id:string,token:string,assetId:string){
    if(!assetId.startsWith('fog-'))return null
    const member=this.authenticate(id,token),current=this.get(id),a=adventure(current.room),s=a.scenes.find(s=>s.id===a.activeSceneId),fog=s&&fogProjection(current.room,member,s.id,false,false)
    if(member.role==='gm'||!s?.background||!fog||fog.assetId!==assetId)throw new RoomError('探索底图不可访问或版本已变化',403)
    const image=current.assets.find(v=>v.id===s.background!.assetId);if(!image)throw new RoomError('地图素材不存在',404)
    const allowed = () => {
      try {
        const m=this.authenticate(id,token),r=this.get(id).room,scene=adventure(r).scenes.find(s=>s.id===adventure(r).activeSceneId)
        return m.role!=='gm'&&!!scene&&fogProjection(r,m,scene.id,false,false)?.assetId===assetId
      } catch { return false }
    }
    try {
      const result=await renderFogImage(current.room.id,s,fog,image,{isCurrent:allowed})
      if(!allowed())throw new RoomError('探索底图不可访问或版本已变化',403)
      return result
    } catch(error) {
      if(!allowed())throw new RoomError('探索底图不可访问或版本已变化',403)
      if(error instanceof FogImageQueueError)throw new RoomError(error.message,503)
      throw error
    }
  }
  scriptSource(id: string, token: string, confirmedCurrentInitialState: boolean) {
    if (this.authenticate(id, token).role !== 'gm') throw new RoomError('提取剧本需要房间 GM', 403)
    const { room, assets } = this.get(id)
    const definition = extractScript(
      room.world,
      assets,
      adventure(room).id,
      confirmedCurrentInitialState,
    )
    return {
      definition,
      assets: assets.filter((a) => definition.assets.some((m) => m.id === a.id)),
    }
  }
  async archive(id: string, token: string) {
    if (this.authenticate(id, token).role !== 'gm') throw new RoomError('冒险归档需要 GM', 403)
    const { room, assets } = this.get(id)
    const exported=clone(room.world)
    for(const a of exported.adventures){const states=[a,...a.checkpoints.map(c=>c.snapshot.adventure),...a.log.flatMap(e=>e.before?[e.before.adventure]:[]),...(a.testBattle?[a.testBattle.snapshot.adventure,...(a.testBattle.checkpoints??[]).map(c=>c.snapshot.adventure)]:[])];for(const state of states)if(state.ai?.knowledgeState){const scope={...room,world:{...room.world,adventures:[state]}} as Room,records=this.ledger().export(scope);state.ai.knowledgeState.archiveSegments=Array.from({length:Math.ceil(records.length/500)},(_,i)=>records.slice(i*500,i*500+500))}}
    const archive = JSON.parse(await exportMap(exported, assets, adventure(room).id))
    archive.characters = clone(room.world.characters)
    archive.characters.forEach((c: MapWorld['characters'][number]) =>
      c.journal?.forEach((event) => (event.before = null)),
    )
    const text = JSON.stringify(archive)
    if (Buffer.byteLength(text) > MAP_ARCHIVE_BYTES)
      throw new RoomError('房间归档超过 400 MB，请精简存档或背景后重试')
    return text
  }
}
