import type { ActiveEffect } from './types'
import { CONDITIONS } from '../content/conditions'
export interface StatusSummary {
  id: string
  name: string
  source?: string
  duration?: string
  concentration?: boolean
  visibility?: ActiveEffect['visibility']
}
const observable = new Set(['prone', 'grappled', 'restrained', 'petrified', 'unconscious'])
export function summarizeStatuses(
  conditions: string[],
  effects: ActiveEffect[],
  full: boolean,
  hours = 0,
  sourceName: (id: string) => string = () => '未公开来源',
  allowGm = false,
  clockOf: (id:string)=>number|undefined = ()=>undefined,
): StatusSummary[] {
  const names = new Map(CONDITIONS.map((c) => [c.id, c.name]))
  const result: StatusSummary[] = conditions
    .filter((c) => full || observable.has(c))
    .map((c) => ({ id: 'condition:' + c, name: names.get(c) ?? c }))
  for (const e of effects) {
    if (e.visibility === 'gm' && !allowGm) continue
    if (!full && e.visibility !== 'public') continue
    result.push({
      id: e.id,
      name: e.name,
      ...(full
        ? {
            source: sourceName(e.sourceId),
            duration:
              e.endsAt !== undefined
                ? '剩余约' + Math.max(0, (e.endsAt - (e.clockSourceId?clockOf(e.clockSourceId)??hours:hours)) * 60).toFixed(1) + '分钟'
                : e.expiresAt !== null
                  ? '按回合时序结算'
                  : '依来源结束条件解除',
            concentration: e.concentration,
            ...(allowGm ? { visibility: e.visibility ?? 'owner' } : {}),
          }
        : {}),
    })
  }
  return result
}
