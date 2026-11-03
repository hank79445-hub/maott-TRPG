import type { Ability } from './types'
import type { CombatNpc } from './combat-types'
import { clone } from './engine'
export interface NpcMonsterAbility {
  id: string
  name: string
  cost: 'action' | 'bonus' | 'reaction' | 'none'
  support: 'automatic' | 'gm' | 'unsupported'
  note: string
  resourceId?: string
  spellId?: string
  slotLevel?: number
  ability?: Ability
  reaction?: 'parry' | 'shield' | 'redirect' | 'counterspell'
}
export interface NpcResourcePool {
  id: string
  name: string
  max: number
  remaining: number
  recovery: 'day' | 'recharge' | 'manual'
  rechargeMin?: number
  lastRechargeTick?: number
  lastRechargeEncounter?: string
}
export function abilityAvailable(n: CombatNpc, id: string) {
  const a = n.abilities?.find((a) => a.id === id)
  if (!a || a.support === 'unsupported') return false
  return !a.resourceId || !!n.resources?.some((r) => r.id === a.resourceId && r.remaining > 0)
}
export function consumeNpcAbility(n: CombatNpc, id: string) {
  const a = n.abilities?.find((a) => a.id === id)
  if (!a || a.support === 'unsupported') throw Error('怪物能力不存在或暂未支持')
  if (!abilityAvailable(n, id)) throw Error('怪物能力共用次数／充能不足')
  if (a.resourceId) n.resources!.find((r) => r.id === a.resourceId)!.remaining--
  return a
}
export function refreshNpcRecharge(n: CombatNpc, tick: number, d6: () => number, encounter = '') {
  const results: string[] = []
  for (const r of n.resources ?? []) {
    if (
      r.recovery !== 'recharge' ||
      r.remaining >= r.max ||
      (r.lastRechargeTick === tick && (r.lastRechargeEncounter ?? '') === encounter)
    )
      continue
    const roll = d6()
    if (!Number.isInteger(roll) || roll < 1 || roll > 6) throw Error('充能骰结果必须为1–6')
    r.lastRechargeTick = tick
    r.lastRechargeEncounter = encounter
    if (roll >= (r.rechargeMin ?? 6)) r.remaining = r.max
    results.push(`${r.name}充能 d6=${roll}，${r.remaining ? '可用' : '未恢复'}`)
  }
  return results
}
export function restoreNpcResources(n: CombatNpc, recovery: 'day' | 'manual', resourceId?: string) {
  if(recovery==='day'&&!resourceId)n.prayerHealingSinceLongRest=false
  for (const r of n.resources ?? [])
    if (resourceId ? r.id === resourceId : r.recovery === recovery) r.remaining = r.max
}
/** Definitions and fresh copies carry initial resources, never recharge timestamps or concentration. */
export function initialNpcState(n: CombatNpc): CombatNpc {
  const next = clone(n)
  delete next.concentration
  for (const r of next.resources ?? []) {
    r.remaining = r.max
    delete r.lastRechargeTick
    delete r.lastRechargeEncounter
  }
  if (next.templateMetadata?.englishName === 'Imp') {
    next.shape = 'imp'
    next.speed = 20
  }
  return next
}
