import type { AiModelRequest } from '../core/ai-types'

/** UTF-8 bytes overestimates common tokenizers; the reserve includes output and protocol framing. */
export function fitModelContext(
  request: AiModelRequest,
  budget: number | null,
  output: number | null,
) {
  const fitted = structuredClone(request),
    omittedIds: string[] = []
  const estimate = () =>
    new TextEncoder().encode(JSON.stringify(fitted)).length + (output ?? 0) + 512
  const limit = budget === null ? Infinity : budget
  const input = fitted.input
  for (const key of [
    'styleSamples',
    'olderSummary',
    'experiences',
    'history',
    'contextFacts',
    'previousProse',
    'confirmedPublicFacts',
  ]) {
    const rows = input[key]
    if (Array.isArray(rows)) {
      while (estimate() > limit) {
        const index = rows.findIndex(
          (r) => !r.pinned && r.importance!=='major' && !(input.triggerIds as string[] | undefined)?.includes(r.id),
        )
        if (index < 0) break
        const [removed] = rows.splice(index, 1)
        if (typeof removed?.id === 'string') omittedIds.push(removed.id)
      }
    } else if (key === 'previousProse' && typeof rows === 'string' && estimate() > limit)
      input[key] = ''
  }
  if (estimate() > limit)
    throw Error(
      `必要上下文约需 ${estimate()} 个保守 token，超过预算 ${budget}；请缩短固定设定或提高预算，身份与权限未被裁剪`,
    )
  const npc = input.npc as { fixedMemories?: { id: string }[] } | undefined
  const selectedIds = [
    ...(npc?.fixedMemories ?? []).map((r) => r.id),
    ...['experiences', 'history', 'olderSummary', 'confirmedPublicFacts', 'contextFacts'].flatMap(
      (k) => (Array.isArray(input[k]) ? (input[k] as { id: string }[]).map((r) => r.id) : []),
    ),
  ].filter(Boolean)
  return { request: fitted, estimatedTokens: estimate(), omittedIds, selectedIds }
}
