import type { MapWorld } from './map-types'
import type { NpcProfile } from './ai-types'
import { catalogue } from './engine'
import { srd } from '../content/srd'
import { combatStats } from './combat-rules'
export function assertNpcAttackTarget(world: MapWorld, n: NpcProfile, targetId: string) {
  const scene = world.adventures.flatMap((a) => a.scenes).find((s) => s.id === n.sceneId)
  const e = world.encounters.find((e) => e.id === scene?.encounterId && e.phase === 'active')
  const actor = e?.actors.find((a) => a.id === n.actorId),
    target = e?.actors.find((a) => a.id === targetId)
  if (
    !actor ||
    !target ||
    target.id === actor.id ||
    !scene?.tokens.some((t) => t.actorId === targetId && !t.hidden)
  )
    throw Error('攻击目标不存在、已离场或不可见')
  const stats = combatStats(target, world.characters, catalogue([srd, ...world.packs]))
  if (stats.dead || stats.hp <= 0) throw Error('攻击目标已经死亡或倒地，请重新规划')
  if (target.side === actor.side || target.side === 'neutral' || actor.side === 'neutral')
    throw Error('没有已确认的敌对攻击目标，请由GM先确认阵营')
  return target
}
