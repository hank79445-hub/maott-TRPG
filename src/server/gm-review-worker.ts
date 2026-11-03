import { randomUUID } from 'node:crypto'
import type { Room, RoomCommand } from '../online/protocol'
import type { AiProvider } from '../core/ai-types'
import { clone } from '../core/engine'
import {
  reviewState,
  reviewModel,
  reviewEligibility,
  reviewStamp,
  parseReviewOutput,
  reviewRequest,
  branchOf,
  REVIEW_POLICY,
} from './gm-review'
import { executeRoomDice } from './room-dice'
import { finalizeRoomBroadcast } from './room-broadcast'
import { aggregateAi } from './room-ai'
export interface ReviewHost {
  update<T>(fn: (room: Room) => T | undefined): Promise<T | undefined>
  provider: AiProvider
  calls: Map<string, AbortController>
  closed: () => boolean
  after: () => void
}
/** Network waits happen outside the room transaction. No model output is an executable command. */
export async function runReviewQueue(host: ReviewHost) {
  const one = async () => {
    const work = await host.update((r) => {
      if (host.closed()) return
      const st = reviewState(r),
        j = st.jobs.find((j) => j.status === 'queued')
      if (!j) return
      const i = r.intents.find((i) => i.id === j.intentId)
      if (
        st.settings.paused ||
        st.settings.mode !== j.mode ||
        j.policyRevision !== st.settings.revision ||
        j.branchId !== branchOf(r)
      ) {
        j.status = 'stale'
        j.reason = '审核模式或分支已变化'
        return { skip: true as const }
      }
      if (
        !i ||
        (j.mode !== 'shadow' &&
          (i.status !== 'pending' ||
            j.stamp !== reviewStamp(r, i) ||
            !reviewEligibility(r, i).eligible))
      ) {
        j.status = 'stale'
        j.reason = '申请条件已变化'
        return { skip: true as const }
      }
      const config = reviewModel(r)
      if (j.method === 'model' && !config) {
        j.status = 'escalated'
        j.reason = '审核模型未配置，交GM'
        return { skip: true as const }
      }
      j.status = 'running'
      j.attempt = randomUUID()
      j.model = config?.model ?? '程序预检'
      j.modelRevision = config?.revision
      return {
        skip: false as const,
        job: clone(j),
        config: config ? clone(config) : undefined,
        timeout: st.settings.timeoutSeconds,
      }
    })
    if (!work) return false
    if (work.skip) return true
    const start = performance.now(),
      controller = new AbortController(),
      key = work.job.id
    host.calls.set(key, controller)
    let output: unknown,
      tokens: number | null = null,
      error = '',
      timer: ReturnType<typeof setTimeout> | undefined
    try {
      if (work.job.method === 'program')
        output = {
          decision: 'pass',
          policyId: REVIEW_POLICY,
          evidenceIds: work.job.evidenceIds,
          reason: '程序已核对固定互动全部白名单条件',
          missingFacts: [],
        }
      else {
        const result = await Promise.race([
          host.provider.generate(reviewRequest(work.job), work.config!, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => {
                controller.abort()
                reject(Error('审核超时，交GM'))
              },
              Math.min(work.timeout, work.config!.timeoutSeconds) * 1000,
            )
            controller.signal.addEventListener('abort', () => reject(Error('审核中断，交GM')), {
              once: true,
            })
          }),
        ])
        output = result.output
        tokens = result.tokens
      }
    } catch {
      error = controller.signal.aborted ? '审核超时或中断，交GM' : '模型服务或输出异常，交GM'
    } finally {
      if (timer) clearTimeout(timer)
      host.calls.delete(key)
    }
    if (host.closed()) return false
    await host.update((r) => {
      const st = reviewState(r),
        j = st.jobs.find((j) => j.id === key)
      if (!j) return
      j.durationMs = Math.round(performance.now() - start)
      j.tokens = tokens
      // Late results retain cost/audit only, even after takeover or branch changes.
      if (j.status !== 'running' || j.attempt !== work.job.attempt) return true
      delete j.attempt
      const i = r.intents.find((i) => i.id === j.intentId)
      if (
        j.branchId !== branchOf(r) ||
        j.policyRevision !== st.settings.revision ||
        st.settings.paused ||
        st.settings.mode !== j.mode
      ) {
        j.status = 'stale'
        j.reason = '配置、暂停或分支已变化；未执行'
        return true
      }
      if (
        j.method === 'model' &&
        (!reviewModel(r) || reviewModel(r)!.revision !== work.config?.revision)
      ) {
        j.status = 'escalated'
        j.reason = '模型配置已变化，交GM'
        return true
      }
      try {
        if (error) throw Error(error)
        j.output = parseReviewOutput(output, j.evidenceIds)
      } catch {
        j.status = 'escalated'
        j.reason = error || '模型输出字段或依据不符合约定，交GM'
        return true
      }
      if (j.mode === 'shadow') {
        j.status = 'suggested'
        j.reason = '影子建议，仅供GM参考；未自动执行'
        if (i && i.status !== 'pending') j.gmDecision = i.status + ': ' + i.reason
        return true
      }
      if (j.output.decision !== 'pass') {
        j.status = 'escalated'
        j.reason = '模型建议转GM，未自动拒绝玩家'
        return true
      }
      if (
        !i ||
        i.status !== 'pending' ||
        j.stamp !== reviewStamp(r, i) ||
        !reviewEligibility(r, i).eligible
      ) {
        j.status = 'stale'
        j.reason = '提交前相关条件已变化；未执行'
        return true
      }
      const gm = r.members.find((m) => m.role === 'gm' && !m.revoked)
      if (!gm) {
        j.status = 'escalated'
        j.reason = '无有效GM，未执行'
        return true
      }
      const before = r.world,
        command: RoomCommand = {
          kind: 'intent-review',
          intentId: i.id,
          approve: true,
          reason: '辅助审核通过：仅执行已授权固定互动',
        }
      const original = clone(r)
      const oldRevision = i.baseWorldRevision
      try {
        // Relevant-object stamp was revalidated. Unrelated world changes must not force a stale global revision.
        i.baseWorldRevision = r.worldRevision
        executeRoomDice(r, gm, command)
        const saved = reviewState(r).jobs.find((j) => j.id === key)!
        saved.status =
          r.intents.find((x) => x.id === i.id)?.status === 'approved' ? 'executed' : 'waiting-dice'
        saved.reason = saved.status === 'executed' ? '已按原规则执行' : '等待GM实体骰录入；尚未结算'
        finalizeRoomBroadcast(r, before, command, key)
        aggregateAi(r, before, command)
      } catch {
        Object.assign(r, original)
        const current = r.intents.find((x) => x.id === i.id)
        if (current) current.baseWorldRevision = oldRevision
        const saved = reviewState(r).jobs.find((j) => j.id === key)!
        saved.status = 'escalated'
        saved.reason = '原规则执行未通过，交GM；未自动完成'
      }
      return true
    })
    host.after()
    return true
  }
  // The host serializes commits; concurrency is only for model waits.
  let width = 1
  await host.update((r) => {
    width = reviewState(r).settings.maxConcurrent
    return undefined
  })
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (!host.closed() && (await one())) {}
    }),
  )
}
