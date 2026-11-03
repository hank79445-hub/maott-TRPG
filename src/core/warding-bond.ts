import type { ActiveEffect } from './types'
import { DAMAGE_TYPES } from './combat-types'

export interface BondBody {
  id: string
  aliases: string[]
  hp: number
  effects: ActiveEffect[]
}
export const bondIdentity = (body: BondBody, id: string) => body.id === id || body.aliases.includes(id)
/** Recasting on either endpoint ends the old connection, including a reversed connection. */
export function connectWardingBond(bodies: BondBody[], casterId: string, targetId: string, effect: ActiveEffect) {
  const caster = bodies.find(b => bondIdentity(b, casterId))
  const target = bodies.find(b => bondIdentity(b, targetId))
  if (!caster || !target || caster.id === target.id || caster.hp <= 0 || target.hp <= 0)
    throw Error('守护之链需要另一名存活且自愿的受术者')
  for (const body of bodies) {
    const retained = body.effects.filter(e => !e.wardingBond || ![e.sourceId, e.wardingBond.targetId].some(id =>
      bondIdentity(caster, id) || bondIdentity(target, id)))
    body.effects.splice(0, body.effects.length, ...retained)
  }
  target.effects.push({ ...effect, key: 'warding-bond', sourceId: caster.id,
    wardingBond: { targetId: target.id }, acBonus: 1, flatSaveBonus: 1,
    damageResistances: [...DAMAGE_TYPES] })
}
/** Missing coordinates in a standalone battle are GM adjudicated, never guessed. */
export function reconcileWardingBonds(bodies: BondBody[], distance?: (caster: BondBody, target: BondBody) => number | undefined, preserveMissingSource = false) {
  for (const target of bodies) {
    const retained = target.effects.filter(e => {
      if (!e.wardingBond) return true
      const caster = bodies.find(b => bondIdentity(b, e.sourceId))
      if (!caster) return preserveMissingSource
      return !!caster && caster.hp > 0 && bondIdentity(target, e.wardingBond.targetId) &&
        (distance?.(caster, target) ?? 0) <= 60
    })
    target.effects.splice(0, target.effects.length, ...retained)
  }
}
