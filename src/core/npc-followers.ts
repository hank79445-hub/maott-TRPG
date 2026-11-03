import { clone, type Catalogue } from './engine'
import type { Adventure, MapWorld, MapScene, Position, MapToken } from './map-types'
import { blocked, occupied, inside } from './map'
import { npcBody } from './npc-map'
import { combatStats } from './combat-rules'
import { runtimeDerived } from './runtime'

/** applyMap operates on a clone: a rejected landing rolls back party and NPCs together. */
export function migrateNpcFollowers(
  world: MapWorld,
  a: Adventure,
  to: MapScene,
  landing: Position,
  cat: Catalogue,
  placements?: Record<string, Position>,
  facing?: number,
) {
  for (const n of a.ai?.npcs.filter(
    (n) =>
      n.npcType === 'important' &&
      n.followParty &&
      !(n.initiallyAbsent && !n.appeared) &&
      n.enabled &&
      n.sceneId === a.activeSceneId,
  ) ?? []) {
    const actor = world.encounters.flatMap((e) => e.actors).find((actor) => actor.id === n.actorId)
    if (
      actor &&
      world.encounters.some(
        (e) => e.phase === 'active' && e.actors.some((actor) => actor.id === n.actorId),
      )
    )
      throw Error(n.name + '仍在战斗中，不能跨场景跟随')
    const character = world.characters.find((c) => c.id === n.characterId),
      body = npcBody(world, n)
    const stats = actor
      ? combatStats(actor, world.characters, cat)
      : character
        ? runtimeDerived(character, cat)
        : body
    if (
      stats &&
      (('dead' in stats && stats.dead) ||
        stats.hp <= 0 ||
        stats.conditions.some((c) =>
          ['incapacitated', 'unconscious', 'paralyzed', 'stunned'].includes(c),
        ))
    )
      throw Error(n.name + '当前无法自行跟随；GM 可关闭随队后另行安排携带')
    const old = a.scenes.flatMap((s) => s.tokens).find((t) => t.npcId === n.id),
      span = old?.span ?? 1
    const candidates = Array.from({ length: to.grid.columns * to.grid.rows }, (_, i) => ({
      x: i % to.grid.columns,
      y: Math.floor(i / to.grid.columns),
    })).sort(
      (p, q) =>
        Math.max(Math.abs(p.x - landing.x), Math.abs(p.y - landing.y)) -
        Math.max(Math.abs(q.x - landing.x), Math.abs(q.y - landing.y)),
    )
    const position =
      placements?.[n.id] ??
      candidates.find((p) =>
        occupied({ ...p, span } as MapToken).every(
          (p) =>
            inside(to, p) &&
            !blocked(to, p) &&
            !to.tokens.some((t) => occupied(t).some((o) => o.x === p.x && o.y === p.y)),
        ),
      )
    if (!position) throw Error(n.name + '没有可用跟随落点；GM 可调整场景或关闭该 NPC 随队')
    if (body && !character) n.body = clone(body)
    for (const s of a.scenes) s.tokens = s.tokens.filter((t) => t.npcId !== n.id)
    n.sceneId = to.id
    n.position = position
    n.actorId = null
    n.revision++
    const token: MapToken = old
      ? { ...old, ...position, actorId: null, hidden: n.hidden }
      : {
          id: crypto.randomUUID(),
          npcId: n.id,
          characterId: n.characterId,
          actorId: null,
          name: n.name,
          ...position,
          span,
          hidden: n.hidden,
          color: '#75609e',
          facing: 0,
        }
    to.tokens.push(token)
    if (facing !== undefined) token.facing = facing
  }
}
