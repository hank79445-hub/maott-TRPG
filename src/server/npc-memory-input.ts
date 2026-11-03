import path from 'node:path'
import { createHash } from 'node:crypto'
import type { Room } from '../online/protocol'
import type { AiJob, AiModelRequest } from '../core/ai-types'
import { recallNative } from './npc-memory-ledger'
import { recallMem0, estimateMem0Work } from './npc-mem0-adapter'
import { modelEndpoint } from './ai-provider'
import {taskLocale} from '../core/output-language'
function memoryOptions(room: Room, job: AiJob, directory: string) {
  const ai = room.world.adventures[0]?.ai,
    cfg = ai?.memoryConfig,
    s = ai?.knowledgeState
  if (job.kind !== 'npc' || !cfg?.enabled || cfg.provider !== 'mem0' || !s) return null
  const model = room.modelProfiles?.find((p) => p.name === cfg.embeddingModelRef)?.configuration,
    n = ai?.npcs.find((n) => n.id === job.npcId)
  if (
    !model ||
    !n ||
    !s.providerVerified ||
    s.providerVerified.ref !== cfg.embeddingModelRef ||
    s.providerVerified.revision !== model.revision ||
    s.providerVerified.dimension !== cfg.dimension
  )
    return null
  modelEndpoint(model.baseUrl)
  const rows = recallNative(room, n, job).filter(
    (r) => !job.dialogueReview?.publicInput || r.visibility === 'public',
  )
  const lineage = createHash('sha256')
    .update(JSON.stringify([s.ancestors, s.removedIds, s.indexGeneration]))
    .digest('hex')
  return {
    rows,
    stamp: JSON.stringify([cfg, model.revision, s.epoch, s.removedIds, s.indexGeneration]),
    options: {
      directory: path.join(directory, 'npc-memory', 'mem0'),
      scope: {
        roomId: room.id,
        adventureId: room.world.adventures[0]!.id,
        npcId: job.npcId,
        epoch: s.epoch + ':' + lineage,
        audience: job.dialogueReview?.publicInput
          ? 'public'
          : job.visibility === 'personal'
            ? 'personal:' + job.characterId
            : 'npc-private',
      },
      query: job.message || (taskLocale(job)==='en'?'Important experiences relevant to the current scene':'当前场景相关的重要经历'),
      records: rows.map((r) => ({
        id: r.id,
        text:
          r.kind === 'statement'
            ? '曾听到的陈述（未证实）：' +
              r.text +
              (r.reply ? '；当时的已发布回复：' + r.reply : '')
            : r.text,
      })),
      embedding: {
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        model: model.model,
        dimension: cfg.dimension,
      },
      timeoutMs: Math.min(10000, model.timeoutSeconds * 1000),
    },
  }
}
export function memoryEnrichmentEstimate(room: Room, job: AiJob, directory: string) {
  const data = memoryOptions(room, job, directory)
  return data?.rows.length
    ? {
        ...estimateMem0Work(data.options),
        model: 'embedding:' + data.options.embedding.model,
        stamp: data.stamp,
      }
    : null
}

/** Runs outside the room transaction lock. Only the server selects the ledger scope. */
export async function enrichMemoryInput(
  room: Room,
  job: AiJob,
  request: AiModelRequest,
  directory: string,
  signal: AbortSignal,
) {
  const data = memoryOptions(room, job, directory)
  if (!data) return { request, status: '' }
  const { rows, options } = data
  if (!rows.length) return { request, status: 'Mem0已就绪，暂无可检索的已确认记忆' }
  try {
    const result = await recallMem0({ ...options, signal })
    const recalled = result.ids.flatMap((id) => {
      const r = rows.find((r) => r.id === id)
      return r
        ? [
            {
              id: 'archive:' + r.id,
              sourceId: r.sourceId,
              text: r.kind === 'statement' ? '听闻／陈述，非已确认事实：' + r.text : r.text,
              importance: r.importance,
            },
          ]
        : []
    })
    const experiences = (request.input.experiences ?? []) as { id: string }[]
    return {
      request: {
        ...request,
        input: {
          ...request.input,
          experiences: [
            ...experiences,
            ...recalled.filter((r) => !experiences.some((e) => e.id === r.id)),
          ],
        },
      },
      calls: result.indexed + 1,
      status:
        'Mem0限量召回完成；本地关键事实保底；本次新增索引' + result.indexed + '条（每批最多16条）',
    }
  } catch {
    return { request, status: 'Mem0暂不可用／超时，使用本地检索；索引待补' }
  }
}
