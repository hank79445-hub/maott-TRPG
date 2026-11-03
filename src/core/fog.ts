import type { Adventure, MapWorld, MapScene, MapToken } from './map-types'
import type { Catalogue } from './engine'
import { catalogue } from './engine'
import { srd } from '../content/srd'
import { distance } from './map'
import { tokenM3State } from './m3-map-perception'
import { tokenSceneVision } from './scene-lighting'
import { spatialPerception } from './m3-spatial'
import { sceneQueryCache } from './scene-query-cache'
import { combatStats, freshTurn } from './combat-rules'
import { gCurrentHours } from './gm-spell-world'
import { enclosedMode, recordEnclosed, publishedCells, validateExploration } from './enclosed-exploration'

export function encodeFog(cells: Iterable<string>, columns: number, rows: number) {
  const bytes = new Uint8Array(Math.ceil((columns * rows) / 8))
  for (const cell of cells) {
    const [x, y] = cell.split(',').map(Number)
    if (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x! >= 0 &&
      y! >= 0 &&
      x! < columns &&
      y! < rows
    ) {
      const i = y! * columns + x!
      bytes[i >> 3]! |= 1 << (i & 7)
    }
  }
  return btoa(String.fromCharCode(...bytes))
}
export function decodeFog(bits: string, columns: number, rows: number) {
  let binary = ''
  try {
    binary = atob(bits)
  } catch {
    return new Set<string>()
  }
  const cells = new Set<string>()
  for (let i = 0; i < columns * rows; i++)
    if ((binary.charCodeAt(i >> 3) || 0) & (1 << (i & 7)))
      cells.add((i % columns) + ',' + Math.floor(i / columns))
  return cells
}
export const fogSpace = (t?: MapToken) =>
  `${t?.spatial?.layer ?? 'material'}:${t?.spatial?.anchorId ?? ''}:${t?.spatial?.height ?? 0}`
export const fogObserverId = (t: MapToken) => t.characterId ?? t.actorId ?? t.id
export function validFogObserver(world: MapWorld, a: Adventure, t: MapToken, cat: Catalogue) {
  try {
    const n = a.ai?.npcs.find((n) => n.id === t.npcId),
      actor = world.encounters
        .flatMap((e) => e.actors)
        .find((v) => v.id === (t.actorId ?? n?.actorId))
    const stats = combatStats(
      actor ?? {
        id: t.id,
        characterId: t.characterId ?? n?.characterId ?? null,
        npc: n?.body ?? t.npcBody ?? null,
        side: 'neutral',
        initiative: null,
        surprised: false,
        turn: freshTurn(),
      },
      world.characters,
      cat,
    )
    return stats.hp > 0 && !stats.dead && !stats.conditions.includes('unconscious')
  } catch {
    return false
  }
}
export function fogVisualSource(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  cat: Catalogue,
) {
  const link = a.summons?.instances.find(
      (i) =>
        i.spellId === 'find-familiar' &&
        i.state === 'present' &&
        i.senses &&
        [t.characterId, t.npcId, t.actorId, t.id].includes(i.senses.sourceId) &&
        i.senses.endsAt > gCurrentHours(world, a),
    ),
    f = link && s.tokens.find((v) => v.id === link.id),
    battle = link && world.encounters.find((e) => e.id === link.senses?.encounterId)
  return f &&
    distance(s, t, f) <= 100 &&
    (!battle || battle.tick < (link!.senses!.expiresTick ?? 0)) &&
    validFogObserver(world, a, f, cat)
    ? f
    : t
}
const visionCache = new WeakMap<MapWorld, Map<string, Set<string>>>()
/** A room transaction may clone the world without changing any visibility input. */
export function inheritFogCache(before:MapWorld|undefined,after:MapWorld){
  const cache=before&&visionCache.get(before)
  if(cache&&!visionCache.has(after))visionCache.set(after,new Map(cache))
}
export function fogSignature(world: MapWorld, a: Adventure, s: MapScene) {
  return JSON.stringify([
    s.grid,
    s.fog,
    s.walls,
    s.points.map((p) => [p.id, p.state]),
    s.tokens,
    world.characters.map((c) => [c.id, c.build, c.runtime]),
    world.encounters.map((e) => [e.id, e.tick, e.phase, e.actors]),
    a.m3,
    a.sceneEffects,
    a.summons,
    a.ai?.npcs.map((n) => [n.id, n.body, n.characterId]),
    a.gmSpellClock,
    world.packs,
  ])
}
export function fogVision(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  observer: MapToken,
  cat: Catalogue,
  signature = fogSignature(world, a, s),
) {
  const key = s.id + '|' + observer.id + '|' + signature
  let cache = visionCache.get(world)
  if (!cache) {
    cache = new Map()
    visionCache.set(world, cache)
  }
  const old = cache.get(key)
  if (old) { cache.delete(key); cache.set(key,old); return old }
  const cells = new Set<string>()
  if (!validFogObserver(world, a, observer, cat)) return cells
  const from = fogVisualSource(world, a, s, observer, cat),
    state = { ...tokenM3State(world, a, from, cat), blindsight: 0 },
    query = sceneQueryCache()
  const radius = s.fog?.rangeFeet == null ? Infinity : s.fog.rangeFeet / s.grid.feet + 1
  const minX=Math.max(0,Math.floor(from.x-radius)), maxX=Math.min(s.grid.columns-1,Math.ceil(from.x+from.span+radius))
  const minY=Math.max(0,Math.floor(from.y-radius)), maxY=Math.min(s.grid.rows-1,Math.ceil(from.y+from.span+radius))
  if (!state.blinded)
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const target: MapToken = {
            id: `fog:${x},${y}`,
            name: '',
            x,
            y,
            span: 1,
            hidden: false,
            color: '#000000',
            facing: 0,
            characterId: null,
            actorId: null,
            spatial: {
              layer: from.spatial?.layer ?? 'material',
              height: from.spatial?.height ?? 0,
              anchorId: from.spatial?.anchorId,
            },
          },
          d = distance(s, from, target)
        if (s.fog?.rangeFeet != null && d > s.fog.rangeFeet) continue
        const vision = tokenSceneVision(world, a, s, from, target, state, query)
        if (
          spatialPerception({
            observer: state,
            target: { spatial: target.spatial, effects: [] },
            distance: d,
            lineOfSight: vision.ray.clear,
            illuminated: vision.illuminated,
            magicalDarkness: vision.magicalDarkness,
            locationKnown: false,
          }).canSee
        )
          cells.add(x + ',' + y)
      }
  if (cache.size >= 40) cache.delete(cache.keys().next().value!)
  cache.set(key, cells)
  return cells
}
/** Transaction-only history; immutable snapshot rendering never discovers terrain. */
export function recordFog(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  extraIds: readonly string[] = [],
  options:{entry?:boolean;entryIds?:readonly string[];sourceEventId?:string}={entry:true},
) {
  if (!s.fog?.enabled) return
  if(enclosedMode(s)){const cat=catalogue([srd,...world.packs]);recordEnclosed(world,a,s,s.tokens.filter(t=>((!!t.characterId&&!t.npcId&&!world.characters.find(c=>c.id===t.characterId)?.npcOwnerId)||extraIds.includes(fogObserverId(t)))&&validFogObserver(world,a,t,cat)),options);return}
  const cat = catalogue([srd, ...world.packs]),
    signature = fogSignature(world, a, s),
    state = (a.fogState ??= { records: [], manual: [] })
  for (const t of s.tokens.filter(
    (t) =>
      (!!t.characterId && !world.characters.find((c) => c.id === t.characterId)?.npcOwnerId) ||
      extraIds.includes(fogObserverId(t)),
  )) {
    const observerId = fogObserverId(t),
      space = fogSpace(fogVisualSource(world, a, s, t, cat)),
      cells = fogVision(world, a, s, t, cat, signature)
    if (!cells.size) continue
    let row = state.records.find(
      (r) => r.sceneId === s.id && r.observerId === observerId && r.space === space,
    )
    if (!row) {
      if (state.records.length >= 1000) throw Error('探图记录达到上限，请GM清理不再使用的角色记录')
      row = {
        sceneId: s.id,
        observerId,
        space,
        columns: s.grid.columns,
        rows: s.grid.rows,
        explored: '',
      }
      state.records.push(row)
    }
    const seen = decodeFog(row.explored, row.columns, row.rows)
    for (const c of cells) seen.add(c)
    row.explored = encodeFog(seen, s.grid.columns, s.grid.rows)
    row.columns = s.grid.columns
    row.rows = s.grid.rows
  }
}
export function fogLayers(world: MapWorld, a: Adventure, s: MapScene, ids: readonly string[]) {
  if(enclosedMode(s)){const published=publishedCells(a,s,ids);return {visible:published,explored:published}}
  const visible = new Set<string>(),
    explored = new Set<string>(),
    cat = catalogue([srd, ...world.packs]),
    signature = fogSignature(world, a, s)
  const observers = s.tokens.filter((t) => ids.includes(fogObserverId(t))),
    spaces = new Set(observers.map((t) => fogSpace(fogVisualSource(world, a, s, t, cat))))
  if (!spaces.size) spaces.add('material::0')
  for (const t of observers) {
    for (const c of fogVision(world, a, s, t, cat, signature)) visible.add(c)
    for (const row of a.fogState?.records.filter(
      (r) =>
        r.sceneId === s.id &&
        r.observerId === fogObserverId(t) &&
        r.space === fogSpace(fogVisualSource(world, a, s, t, cat)),
    ) ?? [])
      for (const c of decodeFog(row.explored, row.columns, row.rows)) explored.add(c)
  }
  if (spaces.has('material::0')) for (const c of s.fog?.initial ?? []) explored.add(c)
  const rows = (a.fogState?.manual ?? []).filter(
    (r) =>
      r.sceneId === s.id &&
      (r.observerId === '*' || ids.includes(r.observerId)) &&
      spaces.has(r.space),
  )
  for (const row of rows)
    for (const c of decodeFog(row.revealed, row.columns, row.rows)) explored.add(c)
  for (const c of visible) explored.add(c)
  for (const row of rows)
    for (const c of decodeFog(row.concealed, row.columns, row.rows)) {
      explored.delete(c)
      visible.delete(c)
    }
  return { visible, explored }
}
export function validateFog(a: Adventure) {
  for(const s of a.scenes)validateExploration(s)
  for (const s of a.scenes)
    for (const cell of s.fog?.initial ?? []) {
      const [x, y] = cell.split(',').map(Number)
      if (x! >= s.grid.columns || y! >= s.grid.rows) throw Error('迷雾初始揭示格超出场景')
    }
  for (const row of [...(a.fogState?.records ?? []), ...(a.fogState?.manual ?? [])])
    for (const bits of 'explored' in row ? [row.explored] : [row.revealed, row.concealed]) {
      if (!bits) continue
      let length = 0
      try {
        length = atob(bits).length
      } catch {
        throw Error('迷雾位图格式无效')
      }
      if (length !== Math.ceil((row.columns * row.rows) / 8))
        throw Error('迷雾位图尺寸与记录不一致')
    }
}
