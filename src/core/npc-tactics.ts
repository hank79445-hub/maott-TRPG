import type { MapWorld } from './map-types'
import type { NpcProfile } from './ai-types'
import { clone, catalogue } from './engine'
import { srd } from '../content/srd'
import { combatStats } from './combat-rules'
import { reachableNpcCells } from './npc-strategy'
import { distance } from './map'
import { sightLine } from './map-spatial'

/** Optional bounded aid; private geometry and opponent sheets never enter this block. */
export function npcTactics(world: MapWorld, n: NpcProfile) {
  const scene = world.adventures.flatMap((a) => a.scenes).find((s) => s.id === n.sceneId),
    actor = world.encounters.flatMap((e) => e.actors).find((a) => a.id === n.actorId)
  if (!scene || !actor) return null
  const own = scene.tokens.find((t) => t.npcId === n.id || t.actorId === actor.id)
  if (!own) return null
  const known = clone(scene)
  known.tokens = known.tokens.filter(
    (t) => t.id === own.id || (!t.hidden && sightLine(scene, own, t).clear),
  )
  known.walls = (known.walls ?? []).filter((w) => !w.hidden)
  known.regions = known.regions.filter((r) => !r.hidden)
  const stats = combatStats(actor, world.characters, catalogue([srd, ...world.packs])),
    remaining = Math.max(0, stats.speed + actor.turn.dash - actor.turn.movement)
  const cells = reachableNpcCells(known, own, remaining)
  return {
    grid: { columns: scene.grid.columns, rows: scene.grid.rows, feet: scene.grid.feet },
    ownPosition: { x: own.x, y: own.y, span: own.span },
    remainingMovement: remaining,
    monsterAbilities: clone(actor.npc?.abilities ?? []),
    monsterResources: clone(actor.npc?.resources ?? []),
    reachable: cells.slice(0, 256).map((p) => ({ x: p.x, y: p.y, cost: p.cost })),
    truncated: cells.length > 256,
    targets: known.tokens
      .filter((t) => t.id !== own.id)
      .map((t) => ({
        actorId: t.actorId,
        side: world.encounters.flatMap((e) => e.actors).find((a) => a.id === t.actorId)?.side,
        characterId: t.characterId,
        name: t.name,
        x: t.x,
        y: t.y,
        span: t.span,
        distance: distance(scene, own, t),
        lineOfSight: sightLine(known, own, t).clear,
      })),
    publicTerrain: known.regions.map((r) => ({ cells: r.cells, tags: r.tags, height: r.height })),
    note: '仅已知空间摘要；隐藏障碍、借机攻击、施法条件和最终命中仍由原规则入口及 GM 处理',
  }
}
