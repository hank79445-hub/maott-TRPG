import type { RoomView } from '../../online/protocol'
import type { Catalogue } from '../../core/engine'
import { clone } from '../../core/engine'
import {
  newAdventure,
  newScene,
  newPoint,
  directPath,
  pathCost,
  occupancyRules,
} from '../../core/map'
import { newEncounter } from '../../core/combat'
import { freshTurn } from '../../core/combat-rules'
import { runtimeDerived } from '../../core/runtime'
import { jumpPreview } from '../../core/exploration'
import type { MapWorld, Position } from '../../core/map-types'

/** Intentionally reconstructs only the public projection, including for the GM map preview. */
export function publicPreviewWorld(view: RoomView): MapWorld {
  const scene = newScene(view.scene?.name ?? '公开地图'),
    a = newAdventure('预览')
  if (view.scene)
    Object.assign(scene, clone(view.scene), {
      points: view.scene.points.map((p) => ({ ...newPoint(p.kind, p), ...clone(p) })),
    })
  a.scenes = [scene]
  a.party = view.ownCharacters.map((c) => c.id)
  a.activeSceneId = scene.id
  a.exploration = view.exploration ? clone(view.exploration) : undefined
  const encounters = []
  if (view.encounter) {
    const e = newEncounter()
    e.id = view.encounter.id
    e.phase = view.encounter.phase as 'setup' | 'active' | 'ended'
    e.current = view.encounter.actors.findIndex((a) => a.id === view.encounter!.currentId)
    e.tick = view.encounter.tick
    e.actors = view.encounter.actors
      .filter((a) => view.ownCharacters.some((c) => c.id === a.characterId))
      .map((a) => ({
        id: a.id,
        characterId: a.characterId,
        npc: null,
        side: 'party',
        initiative: a.initiative,
        surprised: false,
        turn: clone(a.turn ?? freshTurn()),
      }))
    encounters.push(e)
  }
  return {
    adventures: [a],
    characters: clone(view.ownCharacters),
    encounters,
    packs: clone(view.packs),
  }
}
export function publicMovementPreview(
  view: RoomView,
  tokenId: string,
  waypoints: Position[],
  cat: Catalogue,
  mode: 'move' | 'jump',
  magic = false,
  runup = false,
) {
  const world = publicPreviewWorld(view),
    a = world.adventures[0]!,
    scene = a.scenes[0]!,
    t = scene.tokens.find((t) => t.id === tokenId)
  if (!t || !waypoints.length)
    return {
      path: [] as Position[],
      cost: 0,
      segments: [] as number[],
      errors: [] as string[],
      details: '请选择落点',
      review: false,
    }
  if (mode === 'jump') {
    const p = jumpPreview(
      world,
      a,
      scene,
      t,
      waypoints.at(-1)!,
      magic ? 'magic' : 'normal',
      cat,
      runup,
    )
    return {
      path: p.path,
      cost: p.cost,
      segments: [p.cost],
      errors: p.errors,
      details: `跳远 ${p.feet} 尺／理论上限 ${p.max} 尺（网格落点最多 ${Math.floor(p.max / scene.grid.feet) * scene.grid.feet} 尺）；${p.run >= p.required ? '助跑' : '立定'}，已助跑 ${p.run} 尺（需要 ${p.required} 尺）；规则跳高 ${p.high} 尺，高度由 GM 核对`,
      review: p.requiresReview,
    }
  }
  const path: Position[] = [],
    segments: number[] = [],
    errors: string[] = []
  let from = { x: t.x, y: t.y },
    total = 0
  const c = world.characters.find((c) => c.id === t.characterId),
    stats = c ? runtimeDerived(c, cat) : undefined
  for (const point of waypoints) {
    const segment = directPath(from, point)
    try {
      const cost = pathCost(
        scene,
        { ...t, ...from },
        segment,
        false,
        stats?.conditions.includes('prone'),
        occupancyRules(scene, t, world, cat),
      )
      total += cost
      segments.push(cost)
    } catch (e) {
      errors.push((e as Error).message)
    }
    path.push(...segment)
    from = point
  }
  const m =
      view.exploration && view.exploration.status !== 'closed'
        ? view.exploration.members.find((m) => m.tokenId === t.id)
        : undefined,
    actor =
      view.encounter?.phase === 'active'
        ? view.encounter.actors.find((a) => a.id === t.actorId)
        : undefined
  const remaining = m
    ? (stats?.speed ?? 0) + m.dash - m.movement
    : actor?.turn
      ? (stats?.speed ?? 0) + actor.turn.dash - actor.turn.movement
      : undefined
  if (remaining !== undefined && total > remaining) errors.push('超过当前剩余移动力')
  if (m?.ended) errors.push('本角色已结束本轮')
  if (stats?.speed === 0) errors.push('当前速度为零')
  return {
    path,
    cost: total,
    segments,
    errors,
    details: `路线 ${path.length} 格；${segments.map((n) => n + ' 尺').join(' → ')}`,
    review: false,
  }
}

export function publicJumpRange(
  view: RoomView,
  tokenId: string,
  cat: Catalogue,
  magic = false,
  runup = false,
) {
  const world = publicPreviewWorld(view),
    a = world.adventures[0]!,
    s = a.scenes[0]!,
    t = s.tokens.find((t) => t.id === tokenId)
  if (!t) return []
  const capacity = jumpPreview(world, a, s, t, t, magic ? 'magic' : 'normal', cat, runup),
    radius = Math.min(80, Math.floor(capacity.max / s.grid.feet)),
    cells: Position[] = []
  for (let x = Math.max(0, t.x - radius); x < Math.min(s.grid.columns, t.x + radius + 1); x++)
    for (let y = Math.max(0, t.y - radius); y < Math.min(s.grid.rows, t.y + radius + 1); y++)
      if (
        !jumpPreview(world, a, s, t, { x, y }, magic ? 'magic' : 'normal', cat, runup).errors.length
      )
        cells.push({ x, y })
  return cells
}
