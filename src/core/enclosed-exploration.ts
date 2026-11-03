import type { Adventure, MapScene, MapToken, MapWorld, Position } from './map-types'
import type { FogPolicy } from '../persistence/fog-schema'
import { doorSurfaces, visibleDoorSurface } from './door-surface'
import { catalogue } from './engine'
import { srd } from '../content/srd'
import { sceneQueryCache } from './scene-query-cache'
import { sceneVision } from './scene-lighting'
import { tokenM3State } from './m3-map-perception'
import { tokenPoint } from './scene-effects'
import { distance } from './map'

export type ExplorationArea = NonNullable<FogPolicy['areas']>[number]
export const enclosedMode = (s: MapScene) => s.fog?.mode === 'enclosed'
export const newExplorationPolicy = (): FogPolicy => ({
  mode: 'enclosed',
  enabled: true,
  shared: true,
  rangeFeet: 60,
  initial: [],
  areas: [],
  shading: { level1: 0.35, level2: 0.75 },
})
const cell = (p: Position) => Math.floor(p.x) + ',' + Math.floor(p.y)
function latestAreaRecord(a: Adventure, s: MapScene, areaId: string, ids: readonly string[]) {
  const rows = a.fogState?.areaRecords ?? []
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]!
    if (
      r.sceneId === s.id &&
      r.areaId === areaId &&
      (r.observerId === '*' || ids.includes(r.observerId))
    )
      return r
  }
}
export function validateExploration(s: Pick<MapScene, 'fog' | 'grid' | 'points' | 'walls'>) {
  const ids = new Set<string>(),
    occupied = new Set<string>()
  for (const area of s.fog?.areas ?? []) {
    if (ids.has(area.id)) throw Error('封闭区域ID重复')
    ids.add(area.id)
    for (const value of area.cells) {
      const [x, y] = value.split(',').map(Number)
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x! < 0 ||
        y! < 0 ||
        x! >= s.grid.columns ||
        y! >= s.grid.rows
      )
        throw Error('封闭区域超出网格')
      if (occupied.has(value)) throw Error('封闭区域不能重叠或重复格')
      occupied.add(value)
    }
    if (
      new Set(area.doorIds).size !== area.doorIds.length ||
      area.doorIds.some(
        (id) => !s.points.some((p) => p.id === id && p.kind === 'door' && p.enabled),
      )
    )
      throw Error('封闭区域须引用本场景有效门互动点')
    for (const id of area.doorIds) {
      const point = s.points.find((p) => p.id === id)!,
        walls = s.walls?.filter((w) => w.kind === 'door' && w.pointId === id) ?? []
      const near = area.cells.some((c) => {
        const [x, y] = c.split(',').map(Number)
        if (!walls.length) return Math.max(Math.abs(x! - point.x), Math.abs(y! - point.y)) <= 1
        return walls.some((w) => {
          const dx = w.b.x - w.a.x,
            dy = w.b.y - w.a.y,
            l2 = dx * dx + dy * dy,
            t = l2
              ? Math.max(0, Math.min(1, ((x! + 0.5 - w.a.x) * dx + (y! + 0.5 - w.a.y) * dy) / l2))
              : 0
          return (
            Math.hypot(x! + 0.5 - w.a.x - t * dx, y! + 0.5 - w.a.y - t * dy) <=
            Math.SQRT1_2 + 0.00001
          )
        })
      })
      if (!near) throw Error('封闭区域的关联门必须紧邻该区域')
    }
  }
}
export function areaKnown(
  a: Adventure,
  s: MapScene,
  area: ExplorationArea,
  ids: readonly string[],
) {
  const record = latestAreaRecord(a, s, area.id, ids)
  return !s.fog?.enabled || (record ? record.revealed !== false : area.initiallyRevealed)
}
/** Independent of current illumination, LOS and the legacy explored-cell ledger. */
export function publishedCells(a: Adventure, s: MapScene, ids: readonly string[]) {
  const unknown = new Set(
      (s.fog?.areas ?? []).filter((r) => !areaKnown(a, s, r, ids)).flatMap((r) => r.cells),
    ),
    out = new Set<string>()
  for (let y = 0; y < s.grid.rows; y++)
    for (let x = 0; x < s.grid.columns; x++) {
      const k = x + ',' + y
      if (!unknown.has(k)) out.add(k)
    }
  return out
}
export function setAreaRevealed(
  a: Adventure,
  s: MapScene,
  areaId: string,
  observerId: string,
  revealed: boolean,
  reason: 'enter' | 'door' | 'manual',
  source?: { sourceEventId?: string; sourceTokenId?: string; doorId?: string },
) {
  if (!s.fog?.areas?.some((r) => r.id === areaId)) throw Error('封闭区域不存在')
  const state = (a.fogState ??= { records: [], manual: [] })
  state.areaRecords ??= []
  const old = latestAreaRecord(a, s, areaId, [observerId])
  if (old && (old.revealed !== false) === revealed) return
  state.areaRecords = state.areaRecords.filter(
    (r) => r.sceneId !== s.id || r.areaId !== areaId || r.observerId !== observerId,
  )
  if (state.areaRecords.length >= 10000) throw Error('封闭探索记录达到上限')
  state.areaRecords.push({
    sceneId: s.id,
    areaId,
    observerId,
    revealed,
    reason,
    at: new Date().toISOString(),
    branchId: a.broadcastLog?.branchId,
    ...source,
  })
}
/** Only an accepted position or directly adjacent opened doorway grants exploration. */
export function recordEnclosed(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  observers: MapToken[],
  options: { entry?: boolean; entryIds?: readonly string[]; sourceEventId?: string } = {
    entry: true,
  },
) {
  if (!s.fog?.enabled) return
  const cat = catalogue([srd, ...world.packs])
  const regionAt = new Map(
    (s.fog.areas ?? []).flatMap((r) => r.cells.map((c) => [c, r.id] as const)),
  )
  for (const from of observers) {
    if (from.spatial && from.spatial.layer !== 'material') continue
    const id = s.fog.shared ? '*' : (from.characterId ?? from.actorId ?? from.id),
      ids = [id],
      before = publishedCells(a, s, ids)
    const home = s.fog.areas?.find((r) => r.cells.includes(cell(from)))
    for (const area of s.fog.areas ?? []) {
      if (areaKnown(a, s, area, ids) || area.manualOnly) continue
      if (latestAreaRecord(a, s, area.id, ids)?.revealed === false) continue
      if (area.cells.includes(cell(from))) {
        if (options.entry && (!options.entryIds || options.entryIds.includes(from.id)))
          setAreaRevealed(a, s, area.id, id, true, 'enter', {
            sourceEventId: options.sourceEventId,
            sourceTokenId: from.id,
          })
        continue
      }
      if (!area.revealOnOpen) continue
      for (const doorId of area.doorIds) {
        const p = s.points.find(
          (p) => p.id === doorId && !p.hidden && p.enabled && p.state === 'open',
        )
        if (!p) continue
        const candidates = doorSurfaces(s, p, from)
        const near = candidates.find(
          (r) =>
            before.has(cell(r.probe)) &&
            (s.fog?.areas?.find((v) => v.cells.includes(cell(r.probe)))?.id ?? null) ===
              (home?.id ?? null),
        )
        if (!near) continue
        const eye = { x: from.x + from.span / 2, y: from.y + from.span / 2 },
          steps = Math.max(
            1,
            Math.ceil(Math.max(Math.abs(near.probe.x - eye.x), Math.abs(near.probe.y - eye.y)) * 4),
          )
        let crossesRoom = false
        for (let i = 1; i < steps; i++) {
          const r = regionAt.get(
            cell({
              x: eye.x + ((near.probe.x - eye.x) * i) / steps,
              y: eye.y + ((near.probe.y - eye.y) * i) / steps,
            }),
          )
          if (r && r !== home?.id) {
            crossesRoom = true
            break
          }
        }
        if (crossesRoom) continue
        if (visibleDoorSurface(world, a, s, p, from, cat, (c) => before.has(cell(c)))) {
          setAreaRevealed(a, s, area.id, id, true, 'door', {
            sourceEventId: options.sourceEventId ?? a.log.at(-1)?.id,
            sourceTokenId: from.id,
            doorId: p.id,
          })
          break
        }
      }
    }
  }
}
export function explorationShading(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  observers: MapToken[],
  published: Set<string>,
) {
  const from = observers[0],
    cat = catalogue([srd, ...world.packs]),
    sense = from ? { ...tokenM3State(world, a, from, cat), blindsight: 0 } : undefined,
    query = sceneQueryCache(),
    radius = s.fog?.rangeFeet ?? 60
  const runs: { x: number; y: number; length: number; level: 1 | 2; blend?: number }[] = []
  const reasons: Record<string, number> = {},
    heavy = new Set(
      a.sceneEffects?.regions
        .filter((e) => e.status === 'active' && e.obscurity === 'heavy')
        .map((e) => e.id),
    )
  for (let y = 0; y < s.grid.rows; y++)
    for (let x = 0; x < s.grid.columns; x++) {
      if (!published.has(x + ',' + y)) continue
      let level: 0 | 1 | 2 = 0
      let reason = ''
      let blend: number | undefined
      if (!from || sense!.blinded) {
        level = 2
        reason = '失明或无有效观察源'
      } else if (distance(s, from, { x, y }) >= radius * 2) {
        level = 2
        reason = '超出两倍显示半径'
      } else {
        const to = { ...tokenPoint(from), x: x + 0.5, y: y + 0.5 },
          vision = sceneVision(world, a, s, tokenPoint(from), to, sense!, query)
        if (!vision.ray.clear || vision.magicalDarkness) {
          level = 2
          reason = vision.ray.blockerIds.some((id) => heavy.has(id))
            ? '重度遮蔽'
            : vision.magicalDarkness
              ? '魔法黑暗'
              : '墙体或空间阻隔'

        } else if (distance(s, from, { x, y }) > radius && !(vision.light.sourceIds.length && vision.light.level === 'bright')) {
          const d = distance(s, from, { x, y })
          // Bounded buckets merge adjacent cells without per-frame rule queries.
          blend = Math.round(Math.max(0, (d - radius * 1.5) / (radius * .5)) * 16) / 16
          if (vision.light.sourceIds.length && vision.light.level === 'dim') blend = 0
          level = blend === 1 ? 2 : 1
          reason = '距离遮罩'
        } else if (vision.light.level !== 'bright' || vision.lightlyObscured) {
          level = 1
          reason = vision.lightlyObscured
            ? '轻度遮蔽'
            : vision.light.level === 'dark'
              ? '普通黑暗'
              : '昏暗'
        }
      }
      if (!level) continue
      reasons[reason] = (reasons[reason] ?? 0) + 1
      const last = runs.at(-1)
      if (last?.y === y && last.level === level && last.blend === blend && last.x + last.length === x) last.length++
      else runs.push({ x, y, length: 1, level, ...(blend !== undefined ? { blend } : {}) })
    }
  return {
    level1: s.fog?.shading?.level1 ?? 0.35,
    level2: s.fog?.shading?.level2 ?? 0.75,
    runs,
    reasons,
  }
}
