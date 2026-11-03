import type { ActiveEffect } from './types'
import {protectionBlocks} from './protection-evil'

// SRD 5.2.1 p.106: retain each casting's duration and source, but apply only
// the most potent (or, on a tie, most recent) casting of the same spell.
export function appliedEffects(effects: ActiveEffect[]): ActiveEffect[] {
  const chosen = new Map<string, ActiveEffect>()
  const potency = (e: ActiveEffect) =>
    Math.max(
      e.key==='sleep'&&e.sleepStage==='asleep'?100:0,
      Math.abs(e.acBonus ?? 0),
      e.acBase ?? 0,
      e.speedBonus ?? 0,
      e.speedPenalty ?? 0,
      Math.abs(e.attackDie ?? 0),
      Math.abs(e.saveDie ?? 0),
      e.hpBonus ?? 0,
      e.acFloor ?? 0,
      e.weapon?.bonus ?? 0,
      e.key === 'heroism' ? Number(e.note) || 0 : 0,
    )
  for (const effect of effects) {
    if(effect.key==='pass-without-trace'&&effect.m3?.withinAura===false)continue
    // These benefits affect a specific caster's attacks against the target.
    const key = effect.weapon
      ? `${effect.key}:${effect.weapon.instanceId}`
      : ['hex', 'hunter-s-mark', 'vex'].includes(effect.key)
        ? `${effect.key}:${effect.sourceId}`
        : effect.key
    const old = chosen.get(key)
    if (!old || potency(effect) >= potency(old)) chosen.set(key, effect)
  }
  const active=[...chosen.values()]
  // Hypnotic Pattern incapacitates only while charmed. Suppression keeps the
  // casting saved, but must suppress its dependent restrictions as well.
  const protectedEffects=active.filter(f=>!([f.condition,...f.conditions??[]].some(c=>['charmed','frightened','possessed'].includes(c??''))&&protectionBlocks(active,f.sourceCreatureType,f.sourceId)))
  return active.some(f=>f.conditionImmunities?.includes('charmed'))?protectedEffects.filter(f=>f.key!=='hypnotic-pattern'):protectedEffects
}
