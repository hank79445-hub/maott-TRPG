import type { Character } from '../../core/types'
import type { Catalogue } from '../../core/engine'
import { resources, runtimeState } from '../../core/runtime'
import { rulePowers } from '../../core/phb-powers'
import { manualFeatures } from '../../core/manual-growth'
import type { RuntimeCommand } from '../../core/runtime'

export const BASIC_CLASS_ABILITIES: Record<string, { cost: string; self: boolean }> = {
  'action-surge': { cost: '无需动作 · 非魔法额外动作', self: true },
  'second-wind': { cost: '附赠动作', self: true },
  rage: { cost: '附赠动作', self: true },
  'lay-on-hands': { cost: '附赠动作', self: false },
  'bardic-inspiration': { cost: '附赠动作', self: false },
  'innate-sorcery': { cost: '附赠动作', self: true },
}
type Recovery = Extract<RuntimeCommand, { type: 'recover' }>['id']
export interface QuickAbility {
  id: string
  name: string
  kind: 'basic' | 'advanced' | 'manual' | 'recovery' | 'context'
  cost: string
  detail: string
  resource?: string
  remaining?: number
  max?: number
  recovery?: Recovery
}
/** Actions backed by existing ability handlers, never bare shared-pool decrement buttons. */
export function quickAbilities(c: Character, cat: Catalogue): QuickAbility[] {
  const defs = resources(c, cat),
    state = runtimeState(c, cat)
  const result: QuickAbility[] = defs
    .filter((r) => BASIC_CLASS_ABILITIES[r.id])
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: 'basic',
      cost: BASIC_CLASS_ABILITIES[r.id]!.cost,
      detail: r.detail,
      resource: r.id,
    }))
  for (const p of rulePowers(c).filter((p) => !p.id.startsWith('phb/feat-')))
    result.push({
      id: p.id,
      name: p.name,
      kind: 'advanced',
      cost: { action: '动作', bonus: '附赠动作', reaction: '反应', none: '无需动作' }[p.cost],
      detail: p.detail,
      resource: p.resource,
    })
  for (const p of manualFeatures(c))
    if (!result.some((r) => r.id === p.id))
      result.push({
        id: p.id,
        name: p.name,
        kind: 'manual',
        cost: { action: '动作', bonus: '附赠动作', reaction: '反应', none: '无需动作' }[p.cost],
        detail: p.detail,
        resource: p.resource,
      })
  const addRecovery = (id: Recovery, name: string, cost: string) =>
    result.push({
      id: 'recover/' + id,
      name,
      kind: 'recovery',
      cost,
      detail: '填写转换环级；消耗与恢复按原有职业恢复入口复验。',
      recovery: id,
    })
  if (c.build.classId === 'warlock' && c.level >= 2)
    addRecovery('magical-cunning', '魔法妙计', '1 分钟 · 需安排时间')
  if (c.build.classId === 'sorcerer' && c.level >= 2) {
    addRecovery('font-slot', '创建法术位', '附赠动作')
    addRecovery('font-points', '法术位转术法点', '无需动作')
  }
  if (c.build.classId === 'bard' && c.level >= 5)
    addRecovery('font-inspiration', '激励之源', '无需动作')
  if (c.build.classId === 'druid' && c.level >= 5) {
    addRecovery('wild-resurgence', '荒野复兴', '每回合一次')
    addRecovery('wild-slot', '荒野形态转法术位', '无需动作 · 每长休一次')
  }
  for (const r of defs.filter((r) =>
    ['arcane-recovery', 'sorcerous-restoration', 'favored-enemy', 'faithful-steed'].includes(r.id),
  ))
    result.push({
      id: 'context/' + r.id,
      name: r.name,
      kind: 'context',
      cost: '按对应休息／施法入口',
      detail: r.detail,
      resource: r.id,
    })
  return result.map((p) => {
    const r = defs.find((d) => d.id === p.resource)
    return { ...p, ...(r ? { remaining: state.resources[r.id] ?? 0, max: r.max } : {}) }
  })
}
