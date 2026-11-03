/** Synchronous, bounded rule evaluation scope. Never retain it over an await. */
export interface EvaluationStats { calls: Record<string, number>; hits: Record<string, number>; misses: Record<string, number> }
type Scope = { enabled: boolean; values: Map<string, unknown>; identities: WeakMap<object, number>; nextId: number; stats: EvaluationStats }
let scope: Scope | undefined
let observer: ((stats: EvaluationStats) => void) | undefined
/** Diagnostic hook: counters only, no rule inputs or private state. */
export function observeEvaluations(fn?: (stats: EvaluationStats) => void) { const old = observer; observer = fn; return () => { observer = old } }
/** Copy data without structuredClone's rejection of Vue reactive proxies. */
export function copyEvaluationValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyEvaluationValue) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,copyEvaluationValue(v)])) as T
  return value
}
export function withEvaluation<T>(fn: () => T, options?: { enabled?: boolean; complete?: (stats: EvaluationStats) => void }): T {
  if (scope && !options) return fn()
  const previous = scope
  scope = { enabled: options?.enabled !== false, values: new Map(), identities: new WeakMap(), nextId: 1, stats: { calls: {}, hits: {}, misses: {} } }
  try { return fn() } finally { const stats = scope.stats; scope = previous; options?.complete?.(stats); observer?.(stats) }
}
export function evaluationIdentity(value: object | undefined): number {
  if (!scope || !value) return 0
  let id = scope.identities.get(value)
  if (!id) { id = scope.nextId++; scope.identities.set(value, id) }
  return id
}
export function memoEvaluation<T>(kind: string, key: () => string, compute: () => T, copy?: (value: T) => T): T {
  if (!scope?.enabled) return compute()
  const s = scope, count = (table: Record<string, number>) => { table[kind] = (table[kind] ?? 0) + 1 }
  count(s.stats.calls)
  const id = kind + ':' + key()
  if (s.values.has(id)) { count(s.stats.hits); const v = s.values.get(id) as T; return copy ? copy(v) : v }
  count(s.stats.misses)
  const value = compute()
  // Values with cyclic evaluation are inserted only once their computation completes.
  if (s.values.size >= 512) s.values.delete(s.values.keys().next().value!)
  s.values.set(id, value)
  return copy ? copy(value) : value
}
