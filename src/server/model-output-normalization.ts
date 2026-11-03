export interface ModelContractReport {
  version: 1
  purpose: 'npc' | 'narration'
  repairs: { path: string; operation: 'alias' | 'move' | 'ignore' }[]
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
/** Model boundary only. Persistence and command schemas stay strict and authoritative. */
export function normalizeModelOutput(purpose: 'npc' | 'narration', input: unknown) {
  const report: ModelContractReport = { version: 1, purpose, repairs: [] }
  if (!object(input)) return { value: input, report }
  const value = structuredClone(input),
    same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const aliases: Record<string, string> =
    purpose === 'npc'
      ? {
          reply: 'text',
          response: 'text',
          rationale: 'reason',
          intent: 'proposal',
          actions: 'plan',
        }
      : { narration: 'text', event_ids: 'eventIds' }
  for (const [from, to] of Object.entries(aliases)) {
    if (!Object.hasOwn(value, from)) continue
    if (Object.hasOwn(value, to) && !same(value[from], value[to]))
      throw Error('模型契约同义字段冲突：' + to)
    value[to] = value[from]
    delete value[from]
    report.repairs.push({ path: from + '→' + to, operation: 'alias' })
  }
  if (purpose === 'npc' && object(value.proposal))
    for (const field of ['reason', 'reviewRequired'] as const) {
      if (!Object.hasOwn(value.proposal, field)) continue
      if (Object.hasOwn(value, field) && !same(value[field], value.proposal[field]))
        throw Error('模型契约根字段与proposal字段冲突：' + field)
      value[field] = value.proposal[field]
      delete value.proposal[field]
      report.repairs.push({ path: 'proposal.' + field + '→' + field, operation: 'move' })
    }
  // Explicit, bounded annotations only. Arbitrary extra keys and action fields still reach strict validation.
  for (const key of ['explanation', 'notes', 'analysis'] as const)
    if (typeof value[key] === 'string' && value[key].length <= 2000) {
      delete value[key]
      report.repairs.push({ path: key, operation: 'ignore' })
    }
  if (
    typeof value.confidence === 'number' &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1
  ) {
    delete value.confidence
    report.repairs.push({ path: 'confidence', operation: 'ignore' })
  }
  return { value, report }
}
