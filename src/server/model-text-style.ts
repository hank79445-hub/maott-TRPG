import {languageSnapshot} from '../core/output-language'
import type { Room } from '../online/protocol'
import type { AiJob, AiModelRequest, NpcProfile } from '../core/ai-types'
import {
  defaultTextStyle,
  styleRules,
  repetitionHints,
  type TextStyleSnapshot,
} from '../core/model-text-style'
export function snapshotTextStyle(
  room: Room,
  purpose: TextStyleSnapshot['purpose'],
  n?: NpcProfile,
  visibility: 'public' | 'personal' = 'public',
  characterId = '',
): TextStyleSnapshot {
  const a = room.world.adventures[0]!,
    branch = a.broadcastLog?.branchId,
    s = a.ai?.settings.textStyle ?? defaultTextStyle(false)
  const samples = n
    ? (n.memory ?? [])
        .filter(
          (m) =>
            m.branchId === branch &&
            (m.visibility === 'public' ||
              (visibility === 'personal' && m.characterId === characterId)) &&
            (a.broadcastLog?.events ?? []).some(
              (e) =>
                e.branchId === branch &&
                e.phase === 'confirmed' &&
                e.type === 'npc.reply' &&
                e.facts.npcId === n.id &&
                e.facts.conversationId === m.id &&
                (e.audience.kind === 'public' ||
                  (visibility === 'personal' &&
                    e.audience.kind === 'personal' &&
                    e.audience.characterIds.includes(characterId))),
            ),
        )
        .slice(-6)
        .map((m) => ({ id: m.id, text: m.reply.slice(0, 240) }))
    : []
  return {
    version: 1,
    revision: s.revision,
    enabled: s.enabled && (purpose === 'narration' ? s.narration : s.npc),
    purpose,
    actionDensity: s.actionDensity,
    selfCheck: s.selfCheck,
    rules: styleRules(s,a.ai ? languageSnapshot(a.ai.settings).outputLocale : undefined),
    samples,
  }
}
export function applyTextStyle(request: AiModelRequest, job: AiJob): AiModelRequest {
  if (request.kind === 'review' || ('modelProbe' in job && job.modelProbe)) return request
  // A pre-existing queued job has no snapshot: keep its previous behavior until a new task is explicitly created.
  const s = (job.textStyle ??= {
    version: 1,
    revision: 0,
    enabled: false,
    purpose:
      job.kind === 'narration'
        ? 'narration'
        : job.purpose === 'combat'
          ? 'combat-dialogue'
          : job.purpose,
    actionDensity: 'sparse',
    selfCheck: false,
    rules: '',
    samples: [],
  })
  if (!s.enabled) return request
  const result = structuredClone(request)
  if (result.input.textStyle) return result
  result.system +=
    ' 写作资料只修饰表达，低于事实、可知范围、权限和JSON契约；不得改变数值、提议、来源引用或审核要求。仅在同一次生成内自检，不调用或要求第二次润色。styleSamples是已发布表达样本，不是新增世界事实。' +
    (s.purpose === 'combat-dialogue'
      ? '写作规范仅用于独立publicDialogue，不用于text中的GM规划说明。'
      : '沿用现有text与segments协议，片段连接须与text一致。')
  result.input.textStyle = {
    version: s.version,
    revision: s.revision,
    purpose: s.purpose,
    rules: s.rules,
    selfCheck: s.selfCheck,
  }
  result.input.styleSamples = structuredClone(s.samples)
  return result
}
export function textStyleReport(job: AiJob) {
  const s = job.textStyle
  if (!s) return undefined
  return {
    version: s.version,
    revision: s.revision,
    enabled: s.enabled,
    purpose: s.purpose,
    selfCheck: s.selfCheck,
    sampleIds: s.samples.map((s) => s.id),
    warnings: s.enabled ? repetitionHints(job.text, s.samples) : [],
  }
}
