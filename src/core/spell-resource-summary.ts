import type { Character } from './types'
import type { Catalogue } from './engine'
import { resources, runtimeState, effectiveConditions } from './runtime'
export function spellResourceSummary(c: Character, cat: Catalogue) {
  const state = runtimeState(c, cat),
    defs = resources(c, cat)
  const slots = defs
    .filter((r) => r.id === 'slots' || r.id.startsWith('slots-'))
    .map((r) => ({
      ...r,
      remaining: (state.resources[r.id] ?? 0) + (state.createdSlots[r.id] ?? 0),
      created: state.createdSlots[r.id] ?? 0,
    }))
  const extra = defs
    .filter((r) => !slots.some((s) => s.id === r.id))
    .map((r) => ({ ...r, remaining: state.resources[r.id] ?? 0 }))
  const conditions = effectiveConditions(state)
  const unavailable =
    state.death.dead || state.hp <= 0
      ? '死亡／倒地'
      : conditions.some((s) => ['incapacitated', 'stunned', 'paralyzed', 'unconscious'].includes(s))
        ? '当前无法施法'
        : state.rage
          ? '狂暴中不能施法'
          : ''
  return { slots, extra: slots.length ? extra : [], unavailable }
}
