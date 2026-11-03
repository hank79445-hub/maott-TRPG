import {systemMessage} from '../shared/localization/system-messages'
import {gRequestContext} from './gm-spell-requests'
import {combatPushChoices} from './combat-push'
import {summonPhase} from './summon-phase'
import {steedLifeBond} from './summon-steed'
import {commitSummonInPlace,attachSummon} from './summon-transactions'
import {S_SPELL_IDS} from './summon-rules'
import {validateGWorld} from './gm-spell-world'
import {spellWorkflowPolicy} from './spell-workflow-policies'
import {m5aAreaCommand} from './m5a-map-selection'
import {sceneCreatureType,windMovementCost,magicCrossing,magicDistance,soundBetween,hearsSound} from './scene-magic'
import {m1Entity} from './m1-utility'
import {refreshM5AttackEnvironment,queueM5Outcomes} from './m5-world-outcomes'
import {castSlotLevel} from './runtime'
import {triggerDevice} from './scene-magic-actions'
import {geometryContains,volumeRay} from './scene-effect-geometry'
import {magicalCreatureType} from './m3-magic-perception'
import {prepareTerrainRoute, terrainMultiplier, terrainPhase, terrainEntityId, pendingTerrain, clearTerrainTurn, rebaseTerrainBranch} from './scene-terrain'
import {tokenPoint,reconcileSceneEffects} from './scene-effects'
import {sceneEffectCast} from './scene-effect-actions'
import {m3GroundAt} from './m3-ground'
import {rememberM3Sight} from './m3-sight-memory'
import {reconcileM3World} from './m3-world-lifecycle'
import { m3WorldCast } from './m3-world-cast'
import { tokenPerception } from './m3-map-perception'
import {spatialState} from './m3-spatial'
import { pointInteractor } from './point-interactor'
import { pointItemPlan } from './point-items'
import { recordFog,validateFog } from './fog'
import { doorInteractionPosition } from './door-surface'
import {assertDoorClear} from './wide-door'
import { newExplorationPolicy, enclosedMode } from './enclosed-exploration'
import { withInventoryClocks } from './inventory-clock'
import { validatePortals, pairPortals, planPortalArrival } from './map-portals'
import { validatePointLinks, processPointLinks, retryPointLink } from './point-links'
import { firstDiscoveryOnRoute, queueCurrentDiscoveries, resolveDiscovery } from './point-discovery'
import { collectQuestSuggestions } from './quest-steps'
import { applyConfigImport } from './npc-config'
import { reconcileWorld } from './combat-lifecycle'
import { worldBondBodies, reconcileWorldBonds } from './world-warding-bond'
import { connectWardingBond } from './warding-bond'
import {
  applyExploration,
  explorationMove,
  explorationMember,
  explorationSpend,
  assertExplorationReady,
  finishExploration,
  collectExplorationTriggers,
  collectExplorationMovementTriggers,
} from './exploration'
import { assertOpeningCommand, validateOpening } from './battle-opening'
import {
  applyBattleCommand,
  isBattleCommand,
  battleState,
  playBattleIntro,
  mergeBattleHistory,
  assertBattleHistoryCapacity,
  assertBattleSettled,
} from './battle'
import { transferCompanions } from './companion-transfer'
import { isZoneSpell } from './ongoing-spells'
import { clone, type Catalogue } from './engine'
import {
  movementWalls,
  sightLine,
  validateWalls,
  wallState,
  blockerNames,
  coverBetween,
  strongerCover,
  COVER_NAMES,
} from './map-spatial'
import {
  shapeContains,
  areaTargets,
  validateTemplate,
  areaEnvironment,
  spellAreaSpec,
  type AreaSpec,
} from './map-area'
import { applyCombat, newEncounter, validateEncounter } from './combat'
import {
  applyRuntime,
  rollDie,
  runtimeSpells,
  validateInventory,
  validateRuntimeArchive,
  runtimeDerived,
  runtimeState,
  resources,
} from './runtime'
import { attackOptions, combatStats, spellEffect,defaultEnvironment } from './combat-rules'
import { reconcileMapGrapples } from './grapples'
import { handlingPreview } from './weapon-handling'
import type { AttackSpec, CombatCommand, Environment } from './combat-types'
import type { Character } from './types'
import type {
  Adventure,
  AdventureSnapshot,
  AdventureState,
  MapCommand,
  MapPoint,
  MapScene,
  MapToken,
  MapWorld,
  Position,
  MapTemplate,
  MapCombatOptions,
} from './map-types'

export const key = (p: Position) => `${p.x},${p.y}`
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => sameValue(v, b[i]))
    )
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.entries(x).every(([k, v]) => Object.hasOwn(y, k) && sameValue(v, y[k]))
  )
}
export const position = (cell: string): Position => {
  const [x, y] = cell.split(',').map(Number)
  return { x: x!, y: y! }
}
export function newScene(name = '新的场景',exploration?:'enclosed'): MapScene {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || '新的场景',
    ...(exploration?{fog:newExplorationPolicy()}:{}),
    note: '',
    grid: {
      columns: 20,
      rows: 16,
      feet: 5,
      cellPixels: 64,
      originX: 0,
      originY: 0,
      offsetX: 0,
      offsetY: 0,
      strokeWidth: 1,
      locked: false,
      color: '#8b9da4',
      opacity: 0.35,
      show: true,
    },
    background: null,
    regions: [],
    tokens: [],
    points: [],
    annotations: [],
    walls: [],
    encounterId: null,
    template: null,
    highGround: { enabled: true, weapon: true, thrown: true, spell: true },
  }
}
export function newAdventure(name = '新的冒险',exploration?:'enclosed'): Adventure {
  return {
    id: crypto.randomUUID(),
    version: 1,
    name: name.trim() || '新的冒险',
    revision: 0,
    party: [],
    activeSceneId: null,
    scenes: [newScene('起始场景',exploration)],
    log: [],
    checkpoints: [],
  }
}
export function newPoint(kind: MapPoint['kind'], p: Position): MapPoint {
  return {
    id: crypto.randomUUID(),
    editorColor: '#ad6243',
    ...p,
    kind,
    name: { door: '门', chest: '宝箱', trap: '机关', clue: '线索', exit: '场景入口' }[kind],
    note: '',
    revealed: '',
    hidden: false,
    enabled: true,
    state: kind === 'door' ? 'closed' : 'ready',
    range: 5,
    check: null,
    loot: [],
    coins: 0,
    consume: null,
    resource: null,
    targetSceneId: null,
    landing: { x: 1, y: 1 },
    cost: 'free',
  }
}
export function tokenFor(c: Character, p: Position): MapToken {
  return {
    id: crypto.randomUUID(),
    characterId: c.id,
    actorId: null,
    name: c.build.name || '冒险者',
    ...p,
    span: 1,
    hidden: false,
    color: '#398e86',
    facing: 0,
  }
}
export function occupied(t: Pick<MapToken, 'x' | 'y' | 'span'>): Position[] {
  return Array.from({ length: t.span * t.span }, (_, i) => ({
    x: t.x + (i % t.span),
    y: t.y + Math.floor(i / t.span),
  }))
}
export const inside = (s: MapScene, p: Position) =>
  Number.isInteger(p.x) &&
  Number.isInteger(p.y) &&
  p.x >= 0 &&
  p.y >= 0 &&
  p.x < s.grid.columns &&
  p.y < s.grid.rows
export const regionsAt = (s: MapScene, p: Position) =>
  s.regions.filter((r) => r.cells.includes(key(p)))
export const tagsAt = (s: MapScene, p: Position) => [
  ...new Set(regionsAt(s, p).flatMap((r) => r.tags)),
]
export const blocked = (s: MapScene, p: Position) =>
  tagsAt(s, p).includes('blocked') ||
  s.points.some(
    (q) =>
      q.enabled &&
      q.kind === 'door' &&
      !(s.walls ?? []).some((w) => w.pointId === q.id) &&
      ['closed', 'locked'].includes(q.state) &&
      q.x === p.x &&
      q.y === p.y,
  )
export function distance(
  s: MapScene,
  a: Position & { span?: number; spatial?:import('./m3-spatial').SpatialState },
  b: Position & { span?: number; spatial?:import('./m3-spatial').SpatialState },
) {
  const gap = (x: number, n: number, y: number, m: number) =>
    Math.max(0, y - (x + n - 1), x - (y + m - 1))
  return (
    Math.max(Math.max(gap(a.x, a.span ?? 1, b.x, b.span ?? 1), gap(a.y, a.span ?? 1, b.y, b.span ?? 1)) * s.grid.feet,Math.abs(spatialState(a.spatial).height-spatialState(b.spatial).height))
  )
}
export function directPath(a: Position, b: Position): Position[] {
  const result: Position[] = []
  let { x, y } = a
  while (x !== b.x || y !== b.y) {
    x += Math.sign(b.x - x)
    y += Math.sign(b.y - y)
    result.push({ x, y })
    if (result.length > 160) throw new Error('路线过长，请分段移动')
  }
  return result
}
export type PassRule = (other: MapToken) => { allowed: boolean; difficult: boolean }
const occupants = (s: MapScene, t: MapToken, p: Position) =>
  s.tokens.filter(
    (other) =>
      other.id !== t.id &&
      occupied(other).some((cell) => occupied({ ...t, ...p }).some((q) => key(q) === key(cell))),
  )
export function occupancyRules(
  s: MapScene,
  t: MapToken,
  world: MapWorld,
  cat: Catalogue,
): PassRule {
  const e = world.encounters.find((e) => e.id === s.encounterId),
    actor = (token: MapToken) => e?.actors.find((a) => a.id === token.actorId),
    side = (token: MapToken) => actor(token)?.side ?? (token.characterId ? 'party' : 'enemy')
  const size = (token: MapToken) => {
    if (token.span > 1) return token.span + 1
    const c = world.characters.find((c) => c.id === token.characterId),
      base =
        c?.build.choices.size?.[0] ?? cat.species.find((s) => s.id === c?.build.speciesId)?.sizes[0]
    return base === 'small' ? 1 : 2
  }
  return (other) => {
    const ally = side(t) !== 'neutral' && side(t) === side(other),
      a = actor(other),
      incapacitated = a
        ? combatStats(a, world.characters, cat).conditions.includes('incapacitated')
        : false
    return {
      allowed: ally || incapacitated || Math.abs(size(t) - size(other)) >= 2,
      difficult: !ally,
    }
  }
}
export const stepDifficult = (s: MapScene, t: MapToken, p: Position, pass?: PassRule) =>
  occupied({ ...t, ...p }).some((cell) => tagsAt(s, cell).includes('difficult')) ||
  occupants(s, t, p).some((other) => pass?.(other).difficult)
function projectedTerrainCost(s:MapScene,t:MapToken,p:Position){
  const overlays=(s as MapScene&{sceneEffects?:import('./scene-effect-view').SceneMapEffects}).sceneEffects?.regions??[]
  return Math.max(1,...overlays.filter(e=>(!e.groundOnly||(t.spatial?.height??0)===(e.groundHeight??0))&&(e.cellsByObserver?.[t.id]??e.cells).some(cell=>occupied({...t,...p}).some(c=>`${c.x},${c.y}`===cell))).map(e=>e.movementMultiplier??1))
}
export function pathCost(
  s: MapScene,
  t: MapToken,
  path: Position[],
  gm = false,
  crawling = false,
  pass?: PassRule,
  terrain?: {world:MapWorld;adventure:Adventure},
) {
  let previous: Position = t,
    cost = 0
  if (!path.length || path.length > 160) throw new Error('请选择有效移动路线')
  for (const [i, p] of path.entries()) {
    const step = Math.max(Math.abs(p.x - previous.x), Math.abs(p.y - previous.y))
    const footprint = occupied({ ...t, ...p })
    if (!footprint.every((cell) => inside(s, cell))) throw new Error('棋子超出地图边界')
    if (!gm) {
      if (step !== 1) throw new Error('路线必须逐格相邻，请用路径工具或分段移动')
      if (movementWalls(s, t, previous, p).length)
        throw new Error('路线被墙体或关闭的门段阻挡；请绕行或由 GM 调整')
      if (footprint.some((cell) => blocked(s, cell))) throw new Error('路线被墙体或关闭的门阻挡')
      if (p.x !== previous.x && p.y !== previous.y) {
        if (
          occupied({ ...t, x: p.x, y: previous.y }).some((cell) => blocked(s, cell)) ||
          occupied({ ...t, x: previous.x, y: p.y }).some((cell) => blocked(s, cell))
        )
          throw new Error('不能斜穿障碍拐角')
      }
      if (occupants(s, t, p).some((other) => i === path.length - 1 || !pass?.(other).allowed))
        throw new Error(
          i === path.length - 1
            ? '落点已被占据；特殊占位请由 GM 调整'
            : '穿越生物占位需要 GM 确认，请分段或使用 GM 调整',
        )
    }
    cost += step * s.grid.feet * (Math.max(stepDifficult(s,t,p,pass)?2:1, terrain?terrainMultiplier(terrain.world,terrain.adventure,s,{...t,...p}):projectedTerrainCost(s,t,p))+(crawling?1:0)+(terrain?windMovementCost(terrain.world,terrain.adventure,s,t,{...previous,x:previous.x+t.span/2,y:previous.y+t.span/2,height:t.spatial?.height??0},{...p,x:p.x+t.span/2,y:p.y+t.span/2,height:t.spatial?.height??0}):0))
    previous = p
  }
  return cost
}
export function templateContains(s: Pick<MapScene, 'grid'>, template: MapTemplate, p: Position) {
  return shapeContains(s.grid, template, p)
}
export const templateCandidates = (
  s: Pick<MapScene, 'grid' | 'template' | 'tokens'> &
    Partial<Pick<MapScene, 'walls'>> & {
      points?: Pick<MapPoint, 'id' | 'state'>[]
      areaCandidates?: { tokenId: string; eligible: boolean }[]
    },
) =>
  s.areaCandidates
    ? s.tokens.filter((t) => s.areaCandidates!.some((r) => r.tokenId === t.id && r.eligible))
    : areaTargets({ ...s, points: s.points ?? [], walls: s.walls ?? [] } as MapScene)
        .filter((r) => r.eligible)
        .map((r) => r.token)
export function attackCategory(
  spec: AttackSpec | undefined,
  npc = false,
): 'weapon' | 'thrown' | 'spell' | null {
  if (!spec?.ranged) return null
  if (spec.properties.some((p) => p.startsWith('thrown') || p === 'npc-thrown')) return 'thrown'
  if (spec.properties.includes('npc-spell')) return 'spell'
  return spec.weaponId || npc ? 'weapon' : 'spell'
}
export function mapEnvironment(
  s: MapScene,
  from: MapToken,
  to: MapToken,
  base: Environment,
  category: 'weapon' | 'thrown' | 'spell' | null,
  options: MapCombatOptions = { distance: true, highGround: true, reason: '' },
): Environment {
  if (
    (!options.distance ||
      !options.highGround ||
      options.obstacles === false ||
      options.cover === false ||
      options.area === false) &&
    !options.reason.trim()
  )
    throw new Error('覆盖地图条件时请填写 GM 原因')
  const high =
    s.highGround.enabled && category && s.highGround[category] && options.highGround
      ? s.regions.filter(
          (r) => r.tags.includes('high') && occupied(from).some((p) => r.cells.includes(key(p))),
        )
      : []
  const env = clone(base)
  env.distance = options.distance ? distance(s, from, to) : base.distance
  env.attackAdvantages = high.map((r) => `高点：${r.name}（GM 场景规则）`)
  const sight = sightLine(s, from, to),
    targeting = sightLine(s, from, to, 'blocksTargeting'),
    cover = coverBetween(s, from, to)
  if (options.obstacles !== false) {
    if (!sight.clear) {
      env.attackerSees = false
      env.targetSees = false
    }
    if (!targeting.clear) env.cover = 'total'
    else if (options.cover !== false) env.cover = strongerCover(env.cover, cover.degree)
  }
  env.spatial = `${s.name}：${from.name}(${from.x},${from.y}) → ${to.name}(${to.x},${to.y})；${options.distance ? '地图格距' : 'GM 距离'} ${env.distance} 尺${options.reason ? '；GM 覆盖：' + options.reason : ''}`
  env.spatial +=
    options.obstacles === false
      ? '；墙门阻挡由 GM 覆盖'
      : `；${sight.clear ? '墙门视线畅通（其他可见性仍由 GM 确认）' : '视线受阻：' + blockerNames(sight.blockers)}；${targeting.clear ? '未检测到直接目标阻挡' : '实体阻挡／完全掩护：' + blockerNames(targeting.blockers)}`
  if (options.reason) env.note = [env.note, options.reason].filter(Boolean).join('；')
  if (options.obstacles !== false && options.cover !== false && cover.degree !== 'none')
    env.spatial += `；地图${COVER_NAMES[cover.degree]}（取最强，不叠加）`
  return env
}
function state(a: Adventure): AdventureState {
  const {
    log,
    checkpoints,
    broadcastLog: _broadcastLog,
    aiLog: _aiLog,
    testBattle: _testBattle,
    designNotebook: _designNotebook,
    ...rest
  } = a
  return clone(rest)
}
function encounterIds(a: AdventureState, world: MapWorld) {
  return new Set([
    ...(a.summons?.instances.flatMap(i=>i.actorRefs.map(r=>r.encounterId))??[]),
    ...a.scenes.flatMap((s) => (s.encounterId ? [s.encounterId] : [])),
    ...world.encounters.filter((e) => e.session?.adventureId === a.id).map((e) => e.id),
    ...(a.battles?.history.map((h) => h.id) ?? []),
    ...world.encounters
      .filter((e) => a.ai?.npcs.some((n) => e.actors.some((t) => t.id === n.actorId)))
      .map((e) => e.id),
    ...world.encounters
      .filter(
        (e) =>
          e.phase === 'ended' &&
          e.actors.some(
            (actor) =>
              actor.companion &&
              e.actors.some(
                (owner) =>
                  owner.id === actor.companion!.ownerId &&
                  owner.characterId &&
                  a.party.includes(owner.characterId),
              ),
          ),
      )
      .map((e) => e.id),
  ])
}
function relatedIds(a: AdventureState, world: MapWorld) {
  return new Set([
    ...a.party,
    ...(a.summons?.instances.flatMap(i=>[i.sourceEntityId,...i.controllerId?[i.controllerId]:[]])??[]),
    ...(a.summons?.drafts.flatMap(d=>[d.sourceEntityId,d.clockSourceId])??[]),
    ...(a.sceneEffects?.regions.flatMap(e=>[e.sourceId,e.clockSourceId,...e.anchor.ownerId?[e.anchor.ownerId]:[]])??[]),
    ...(a.sceneEffects?.casts.flatMap(e=>[e.sourceId,e.clockSourceId])??[]),
    ...(a.ai?.npcs.flatMap((n) => (n.characterId ? [n.characterId] : [])) ?? []),
    ...world.encounters
      .filter((e) => encounterIds(a, world).has(e.id))
      .flatMap((e) => e.actors.flatMap((t) => (t.characterId ? [t.characterId] : []))),
  ])
}
function stripUndo(world: MapWorld, a: AdventureState) {
  for (const c of world.characters.filter((c) => relatedIds(a, world).has(c.id)))
    c.journal?.forEach((e) => (e.before = null))
  for (const e of world.encounters.filter((e) => encounterIds(a, world).has(e.id)))
    e.log.forEach((event) => (event.before = null))
}
export function adventureSnapshot(a: Adventure, world: MapWorld): AdventureSnapshot {
  const characterIds = relatedIds(a,world), battleIds = encounterIds(a,world)
  const result = {
    adventure: state(a),
    characters: clone(world.characters.filter((c) => characterIds.has(c.id)).map(c => ({...c,journal:c.journal?.map(e=>({...e,before:null}))}))),
    encounters: clone(world.encounters.filter((e) => battleIds.has(e.id)).map(e=>({...e,log:e.log.map(row=>({...row,before:null}))}))),
    packs: clone(world.packs),
  }
  result.characters.forEach((c) => c.journal?.forEach((e) => (e.before = null)))
  result.encounters.forEach((e) => e.log.forEach((x) => (x.before = null)))
  return result
}
export function adventureStamp(a: Adventure, world: MapWorld, extra?: AdventureSnapshot) {
  const chars = new Set([...relatedIds(a, world), ...(extra?.characters.map((c) => c.id) ?? [])]),
    encounters = new Set([...encounterIds(a, world), ...(extra?.encounters.map((e) => e.id) ?? [])])
  return JSON.stringify({
    revision: a.revision,
    characters: world.characters.filter((c) => chars.has(c.id)).map((c) => [c.id, c.revision]),
    encounters: world.encounters
      .filter((e) => encounters.has(e.id))
      .map((e) => [e.id, e.phase, e.log.at(-1)?.id, e.tick]),
    packs: world.packs.map((p) => [p.id, p.version]),
  })
}
function requireReason(value: string) {
  if (!value.trim() || value.length > 2000) throw new Error('请填写 GM 调整原因（最多 2000 字）')
}
function restoreSnapshot(world: MapWorld, a: Adventure, snapshot: AdventureSnapshot) {
  const npcHolds = new Map(
    a.ai?.npcs.filter((n) => n.turnHold).map((n) => [n.id, clone(n.turnHold)]) ?? [],
  )
  const history = clone(a.battles?.history ?? [])
  const ids = new Set([...relatedIds(a, world), ...snapshot.characters.map((c) => c.id)])
  if (
    world.adventures.some(
      (other) =>
        other.id !== a.id &&
        other.activeSceneId &&
        [...relatedIds(other, world)].some((id) => ids.has(id)),
    )
  )
    throw new Error('角色被其他活动冒险引用，请先退出该冒险再恢复')
  if (
    world.encounters.some(
      (e) =>
        e.phase === 'active' &&
        !encounterIds(a, world).has(e.id) &&
        e.actors.some((t) => t.characterId && ids.has(t.characterId)),
    )
  )
    throw new Error('角色正在其他遭遇中，请先结束该遭遇')
  for (const pack of snapshot.packs) {
    const present = world.packs.find((p) => p.id === pack.id)
    if(present && JSON.stringify(present)!==JSON.stringify(pack) &&
      [present,pack].every(p=>p.id.startsWith('story-')&&!p.classes.length&&!p.backgrounds.length&&!p.species.length&&!p.feats.length&&!p.spells.length&&!(p.subclasses?.length)&&p.items.every(i=>i.kind==='gear'&&i.source.edition==='custom'))){
      const itemIds=new Set([...present.items,...pack.items].map(i=>i.id))
      const outsideInventory=world.characters.some(c=>!ids.has(c.id)&&c.inventory.some(i=>itemIds.has(i.itemId)))
      const outsideScene=world.adventures.some(other=>other.id!==a.id&&other.scenes.some(s=>s.points.some(p=>p.loot.some(i=>itemIds.has(i.itemId))||p.containerInventory?.some(i=>itemIds.has(i.itemId))||p.consume&&itemIds.has(p.consume.itemId)||p.itemUse?.requirements.some(r=>itemIds.has(r.itemId)))||s.groundItems?.some(i=>itemIds.has(i.itemId))))
      const outsideNpc=world.adventures.some(other=>other.id!==a.id&&other.ai?.npcs.some(n=>n.stock.some(i=>itemIds.has(i.itemId))||n.consumables?.some(i=>itemIds.has(i.itemId))))
      const outsidePack=world.packs.some(p=>p.id!==pack.id&&p.items.some(i=>i.contents?.some(r=>itemIds.has(r.itemId))))
      if(outsideInventory||outsideScene||outsideNpc||outsidePack)throw Error('剧情物品定义被本冒险之外的角色或场景引用，请先处理跨团引用再恢复')
      world.packs[world.packs.indexOf(present)]=clone(pack)
      continue
    }
    if (present && JSON.stringify(present) !== JSON.stringify(pack))
      throw new Error('存档规则包与当前内容冲突：' + pack.id)
    if (!present) world.packs.push(clone(pack))
  }
  const oldRevision = a.revision,
    saved = clone(snapshot)
  const mergedHistory = mergeBattleHistory(saved.adventure.battles?.history ?? [], history)
  assertBattleHistoryCapacity(saved.adventure, saved.encounters, 0, mergedHistory.length)
  for (const c of saved.characters) {
    c.revision = (world.characters.find((x) => x.id === c.id)?.revision ?? c.revision) + 1
    c.updatedAt = new Date().toISOString()
    const index = world.characters.findIndex((x) => x.id === c.id)
    if (index < 0) world.characters.push(c)
    else world.characters[index] = c
  }
  const replacing = new Set([...encounterIds(a, world), ...saved.encounters.map((e) => e.id)])
  world.encounters = world.encounters.filter((e) => !replacing.has(e.id))
  world.encounters.push(...saved.encounters)
  if(!Object.hasOwn(saved.adventure,'m3'))delete a.m3
  if(!Object.hasOwn(saved.adventure,'sceneEffects'))delete a.sceneEffects
  Object.assign(a, saved.adventure, {
    revision: oldRevision,
    ai: saved.adventure.ai ?? defaultAdventureAi(),
    broadcast: saved.adventure.broadcast ?? newBroadcastSettings(),
    broadcastCursor: saved.adventure.broadcastCursor ?? 0,
    battles: saved.adventure.battles ?? { presets: [], requests: [], history: [] },
  })
  delete a.testBattle
  for (const n of a.ai?.npcs ?? []) if (npcHolds.has(n.id)) n.turnHold = npcHolds.get(n.id)
  battleState(a).history = mergedHistory
  stripUndo(world, a)
}
function syncTokens(s: MapScene, world: MapWorld) {
  const e = world.encounters.find((e) => e.id === s.encounterId)
  if (!e) return
  s.tokens = s.tokens.filter(
    (t) => t.npcId || !t.actorId || e.actors.some((a) => a.id === t.actorId),
  )
  for (const actor of e.actors) {
    if(actor.companion?.instanceId&&actor.companion.dismissed)continue
    const key=actor.companion?.instanceId?'summon-instance:'+actor.companion.instanceId:undefined
    let token = s.tokens.find((t) =>
      actor.characterId ? t.characterId === actor.characterId : t.actorId === actor.id||!!key&&t.companionKey===key,
    )
    if (!token) {
      const free = freePosition(s, { x: 1, y: 1 })
      token = actor.characterId
        ? tokenFor(
            world.characters.find((c) => c.id === actor.characterId)!,
            free,
          )
        : {
            id: crypto.randomUUID(),
            ...free,
            characterId: null,
            actorId: actor.id,
            name: actor.npc!.name,
            span: 1,
            hidden: false,
            color: '#b45b58',
            facing: 0,
          }
      s.tokens.push(token)
    }
    token.actorId = actor.id
    if(key)token.companionKey=key
  }
}
function freePosition(s: MapScene, start: Position, span = 1): Position {
  if (!inside(s, start)) throw new Error('入口落点超出地图')
  const order = [
    start,
    ...Array.from({ length: s.grid.rows * s.grid.columns }, (_, i) => ({
      x: i % s.grid.columns,
      y: Math.floor(i / s.grid.columns),
    })),
  ]
  const free = order.find((p) => {
    const cells = Array.from({ length: span * span }, (_, i) => ({
      x: p.x + (i % span),
      y: p.y + Math.floor(i / span),
    }))
    return cells.every(
      (cell) =>
        inside(s, cell) &&
        !blocked(s, cell) &&
        !s.tokens.some((t) => occupied(t).some((other) => key(other) === key(cell))),
    )
  })
  if (!free) throw new Error('地图没有可用队伍落点')
  return free
}
export function validateAdventure(a: AdventureState, world: MapWorld, cat: Catalogue) {
  validateFog(a as Adventure)
  validatePortals(a)
  if (a.exploration && a.exploration.status !== 'closed') {
    const x = a.exploration,
      s = a.scenes.find((s) => s.id === x.sceneId),
      ids = [...x.members, ...x.retired].map((m) => m.tokenId)
    if (
      !s ||
      new Set(ids).size !== ids.length ||
      (x.status !== 'closed' && a.activeSceneId !== x.sceneId) ||
      x.members.some(
        (m) => !s.tokens.some((t) => t.id === m.tokenId && t.characterId === m.characterId),
      )
    )
      throw Error('探索回合名单或场景引用无效')
  }
  validateSceneExtras(a, world, cat)
  validateQuests(
    a,
    world.characters.map((c) => c.id),
    (a.ai?.npcs ?? []).map((n) => n.id),
  )
  validateGrowthGuide(
    a.growthGuide,
    a.scenes.map((s) => s.id),
    (a.quests ?? []).map((q) => q.id),
  )
  assertBattleHistoryCapacity(a, world.encounters)
  validateAdventureAi(a, world, cat)
  if (a.party.some((id) => isNpcCharacter(world, id))) throw Error('NPC 角色卡不能加入玩家冒险队伍')
  if (
    new Set(a.party).size !== a.party.length ||
    a.party.some((id) => world.characters.find((c) => c.id === id)?.status !== 'complete')
  )
    throw new Error('队伍包含重复、缺失或未完成角色')
  if (
    new Set(a.scenes.map((s) => s.id)).size !== a.scenes.length ||
    (a.activeSceneId && !a.scenes.some((s) => s.id === a.activeSceneId))
  )
    throw new Error('场景引用不完整或重复')
  const encounters = a.scenes.flatMap((s) => (s.encounterId ? [s.encounterId] : []))
  if (new Set(encounters).size !== encounters.length) throw new Error('同一遭遇不能关联多个场景')
  for (const s of a.scenes) {
    validateWalls(s)
    validatePointLinks(s)
    validateTemplate(s)
    const e = world.encounters.find((e) => e.id === s.encounterId)
    if (s.encounterId && !e) throw new Error('场景遭遇不存在')
    if (e?.phase === 'active' && a.activeSceneId !== s.id)
      throw new Error('运行中的遭遇必须位于队伍当前场景')
    if (
      new Set(s.tokens.map((t) => t.id)).size !== s.tokens.length ||
      new Set(s.tokens.filter((t) => t.characterId).map((t) => t.characterId)).size !==
        s.tokens.filter((t) => t.characterId).length
    )
      throw new Error('场景棋子重复')
    for (const t of s.tokens) {
      if (!occupied(t).every((p) => inside(s, p))) throw new Error('棋子占格超出地图')
      if (
        t.characterId &&
        !a.party.includes(t.characterId) &&
        !a.ai?.npcs.some((n) => n.sceneId === s.id && n.characterId === t.characterId)
      )
        throw new Error('棋子角色不在队伍中')
      if (!t.characterId && !t.actorId && !t.npcId && !t.npcBody)
        throw new Error('棋子必须关联角色或 NPC')
      if (t.npcId && !a.ai?.npcs.some((n) => n.id === t.npcId && n.sceneId === s.id))
        throw Error('NPC 标记引用不存在')
      if (
        t.actorId &&
        !e?.actors.some((actor) => actor.id === t.actorId && actor.characterId === t.characterId)
      )
        throw new Error('棋子与遭遇参与者引用不一致')
    }
    for (const r of s.regions)
      if (
        new Set(r.cells).size !== r.cells.length ||
        r.cells.some((cell) => !/^\d+,\d+$/.test(cell) || !inside(s, position(cell)))
      )
        throw new Error('区域包含无效或重复格坐标')
    for (const p of s.points) {
      if(p.itemUse){
        if(p.consume) throw Error('新版物品条件与旧消耗条件不能同时配置')
        if(p.itemUse.effect==='open' && !['door','chest'].includes(p.kind)) throw Error('直接打开只适用门／容器')
        if(p.itemUse.fallback==='check' && !p.check) throw Error('备用检定必须配置检定')
        for(const row of p.itemUse.requirements) if(!cat.items.some(i=>i.id===row.itemId&&i.kind!=='pack')) throw Error('互动条件引用未知物品：'+row.itemId)
      }
      if (
        new Set((p.storyResults ?? []).map((r) => r.id)).size !== (p.storyResults ?? []).length ||
        p.storyResults?.some((r) => !a.ai?.npcs.some((n) => n.id === r.npcId))
      )
        throw Error('剧情结果的 NPC 引用缺失或结果编号重复')
      if (!inside(s, p)) throw new Error('互动点超出地图')
      if (p.targetSceneId && !a.scenes.some((t) => t.id === p.targetSceneId))
        throw new Error('入口目标场景不存在')
      for (const drop of p.loot)
        if (
          !cat.items.some((item) => item.id === drop.itemId && item.kind !== 'pack') &&
          !world.characters.some((c) => c.build.customItems.some((item) => item.id === drop.itemId))
        )
          throw new Error('宝箱包含未知物品')
      if (
        p.check &&
        !(p.check.kind === 'skill'
          ? catSkill(p.check.id)
          : ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(p.check.id))
      )
        throw new Error('互动判定引用未知技能或属性')
    }
    if (new Set((s.annotations ?? []).map((a) => a.id)).size !== (s.annotations ?? []).length)
      throw new Error('名称标注 ID 重复')
    if ((s.annotations ?? []).some((a) => !inside(s, a))) throw new Error('名称标注超出地图')
    for (const cell of new Set(s.regions.flatMap((r) => r.cells)))
      if (
        new Set(regionsAt(s, position(cell)).flatMap((r) => (r.height === null ? [] : [r.height])))
          .size > 1
      )
        throw new Error('重叠区域高度冲突，请统一该格高度')
    if (e) validateEncounter(e, world.characters, cat)
  }
}
import { processPointArrivals, validateSceneExtras } from './scene-arrivals'
import { isSceneToolCommand, applySceneTools } from './scene-tools'
import { applyAiMap, validateAdventureAi, defaultAdventureAi } from './ai'
import { attachSceneNpcs, syncNpcTokens, isNpcCharacter } from './npc-map'
import { syncNpcLifeTokens } from './npc-life-state'
import {recordM1Deaths,applyM1Action} from './m1-utility'
import {appendBroadcast,gmAudience} from './broadcast'
import {refreshTruthZones} from './truth-zone'
import {assertDuelRoute} from './control-movement'
import {assertFrightenedRoute,dropFearHeldItems} from './control-movement'
import { migrateNpcFollowers } from './npc-followers'
import { SKILLS } from './types'
import {
  collectMapBroadcasts,
  applyBroadcastCommand,
  validateBroadcasts,
  newBroadcastSettings,
} from './broadcast'
const catSkill = (id: string) => Object.hasOwn(SKILLS, id)
export function applyMap(...args:Parameters<typeof applyMapInternal>):MapWorld {
  const [input,id,command,cat,dice]=args
  if(command.type==='combat'&&'actorId'in command.command&&!['reaction-shield','reaction-counterspell','npc-reaction','concentration','death-save'].includes(command.command.type)){
    const a=input.adventures.find(a=>a.id===id),s=a?.scenes.find(s=>s.id===command.sceneId),actorId=command.command.actorId,t=s?.tokens.find(t=>t.actorId===actorId||t.characterId===actorId||t.npcId===actorId)
    if(t&&a?.summons?.events?.some(event=>event.status==='pending'&&[t.id,t.actorId,t.characterId,t.npcId].includes(event.targetId??event.instanceId)))throw Error('请先在快速审核处理当前人物的召唤物后果')
    if(t&&a?.m3?.events.some(e=>e.status==='pending'&&[t.id,t.actorId,t.characterId,t.npcId].includes(e.entityId)))throw Error('请先处理该人物待结算空间后果')
  }
  if(command.type==='combat'&&command.command.type==='resolve'){
    const a=input.adventures.find(a=>a.id===id),scene=a?.scenes.find(s=>s.id===command.sceneId),e=input.encounters.find(e=>e.id===scene?.encounterId)
    const delivery=a?.summons?.deliveries?.find(d=>d.pendingId===e?.pending?.id&&d.encounterId===e.id)
    if(delivery){
      const next=clone(input),ad=next.adventures.find(a=>a.id===id)!,s=ad.scenes.find(s=>s.id===delivery.origin.sceneId)!,caster=s.tokens.find(t=>t.id===delivery.sourceTokenId),familiar=s.tokens.find(t=>t.id===delivery.instanceId),instance=ad.summons!.instances.find(i=>i.id===delivery.instanceId)
      if(!caster||!familiar||instance?.state!=='present'||familiar.x!==delivery.origin.x||familiar.y!==delivery.origin.y)throw Error('原魔宠触碰起点已改变，请GM复核原施法，不能远程补结算')
      const original={x:caster.x,y:caster.y,spatial:caster.spatial?clone(caster.spatial):undefined};caster.x=delivery.origin.x;caster.y=delivery.origin.y;caster.spatial=clone(delivery.origin.spatial);ad.summons!.deliveries=ad.summons!.deliveries!.filter(d=>d!==ad.summons!.deliveries!.find(x=>x.pendingId===delivery.pendingId))
      const result=applyMap(next,id,command,cat,dice),restored=result.adventures.find(a=>a.id===id)!.scenes.flatMap(s=>s.tokens).find(t=>t.id===delivery.sourceTokenId);if(restored)Object.assign(restored,original)
      for(const r of result.adventures.find(a=>a.id===id)!.gmSpellRequests??[])if(r.pendingId===delivery.pendingId&&r.status==='pending')r.contextKey=gRequestContext(result,result.adventures.find(a=>a.id===id)!,r)
      return result
    }
    const m4Cast=a?.sceneEffects?.casts.find(c=>c.id===e?.pending?.sceneEffectCastId&&!c.settled&&!c.canceled)
    if(m4Cast&&(m4Cast.action.operation==='cast'||m4Cast.action.operation==='dispel')){
      const next=clone(input),adventure=next.adventures.find(a=>a.id===id)!,detail=sceneEffectCast(next,adventure,m4Cast.action,cat,dice,true)
      appendBroadcast(adventure,crypto.randomUUID(),{message:systemMessage('audit.sceneEffect'),category:'resolution',type:'spell.scene-effect',title:'场景效果已结算',text:detail,narration:'context',audience:gmAudience(),sceneId:scene!.id})
      reconcileWorld(next);reconcileM3World(next,cat,dice);reconcileSceneEffects(next);return next
    }
    const m3Cast=a?.m3?.casts.find(c=>c.id===e?.pending?.m3WorldId&&!c.settled)
    if(m3Cast){
      const next=clone(input),adventure=next.adventures.find(a=>a.id===id)!,detail=m3WorldCast(next,adventure,m3Cast.action,cat,dice,true)
      appendBroadcast(adventure,crypto.randomUUID(),{message:systemMessage('audit.spatial'),category:'resolution',type:'spell.m3-result',title:'空间法术已结算',text:detail,narration:'context',audience:gmAudience(),sceneId:scene!.id})
      reconcileWorld(next)
      reconcileM3World(next,cat,dice)
      return next
    }
    const stored=a?.m1Utility?.casts?.find(c=>c.id===e?.pending?.utilityId&&c.encounterId===e.id)
    if(stored){
      const result=applyM1Action(input,id,stored.action,cat,dice,'settle'),next=result.world.adventures.find(a=>a.id===id)!
      appendBroadcast(next,crypto.randomUUID(),{message:systemMessage('audit.utility'),category:'resolution',type:'spell.m1-result',title:'专用法术已结算',text:result.detail,narration:'context',audience:gmAudience(),sceneId:scene!.id})
      return result.world
    }
  }
  return withInventoryClocks(args[0].characters,()=>applyMapInternal(...args))
}
function applyMapInternal(
  input: MapWorld,
  id: string,
  inputCommand: MapCommand,
  cat: Catalogue,
  dice: (n: number) => number = rollDie,
): MapWorld {
  const world = clone(input),
    a = world.adventures.find((a) => a.id === id)
  if (!a) throw new Error('冒险不存在')
  const before = adventureSnapshot(a, world)
  rememberM3Sight(world,cat)
  const scene = (id: string) => {
    const s = a.scenes.find((s) => s.id === id)
    if (!s) throw new Error('场景不存在')
    return s
  }
  const command: MapCommand = (() => {
    if (inputCommand.type !== 'discovery-continue') return clone(inputCommand)
    const s = scene(inputCommand.sceneId),
      r = s.pausedRoutes?.find(
        (r) => r.id === inputCommand.routeId && r.branchId === a.broadcastLog?.branchId,
      ),
      t = s.tokens.find((t) => t.id === r?.tokenId)
    if (!r || !t || a.activeSceneId !== s.id || t.x !== r.start.x || t.y !== r.start.y)
      throw Error('暂停路线已失效，请重新预览移动')
    if (s.discoveryAttempts?.some((x) => x.characterId === r.characterId && x.status === 'pending'))
      throw Error('请先完成发现检定')
    s.pausedRoutes = s.pausedRoutes?.filter((x) => x.id !== r.id)
    return {
      type: 'move',
      sceneId: s.id,
      tokenId: r.tokenId,
      path: r.path,
      gm: false,
      reason: '继续暂停路线',
      reactionsConfirmed: r.reactionsConfirmed,
    }
  })()
  const pending = () =>
    a.scenes.some((s) => world.encounters.find((e) => e.id === s.encounterId)?.pending)||a.sceneEffects?.m5?.resolutions.some(r=>r.status==='pending'&&!!r.frame)
  const noPending = () => {
    if (pending()) throw new Error('请先完成待结算行动；需要取消时可撤销该提交')
  }
  const live = (s: MapScene) => {
    if (a.activeSceneId !== s.id) throw new Error('请先正式进入该场景')
    noPending()
  }
  const combat = (s: MapScene, command: CombatCommand) => {
    if(command.type==='cast'||command.type==='npc-ability'){const original=command;const e=world.encounters.find(e=>e.id===s.encounterId),actor=e?.actors.find(v=>v.id===original.actorId),pc=world.characters.find(c=>c.id===actor?.characterId),id=command.type==='cast'?pc&&runtimeSpells(pc,cat).find(g=>g.key===(original.type==='cast'?original.key:'') )?.spell.id:actor?.npc?.abilities?.find(b=>b.id===(original.type==='npc-ability'?original.abilityId:''))?.spellId;if(id&&spellWorkflowPolicy(id)){const spell=cat.spells.find(sp=>sp.id===id)!;if(/(minute|hour)/i.test(spell.castingTime)&&e?.phase==='active')throw Error('长时间施法不能作为一个战斗动作完成；请GM接管连续施法时序，或在合法探索阶段施放');validateGWorld(world,a,cat,id,actor!.characterId??actor!.npcId??actor!.id,command.type==='cast'?command.targets:command.targetIds,command.gmChoice??{});command={...command,gmChoice:command.gmChoice??{}}}}
    if(command.type==='cast'||command.type==='npc-ability'){
      const original=command,e=world.encounters.find(e=>e.id===s.encounterId),actor=e?.actors.find(t=>t.id===original.actorId),pc=world.characters.find(c=>c.id===actor?.characterId),id=original.type==='cast'?pc&&runtimeSpells(pc,cat).find(g=>g.key===original.key)?.spell.id:actor?.npc?.abilities?.find(b=>b.id===original.abilityId)?.spellId
      if((S_SPELL_IDS as readonly string[]).includes(id??'')&&!command.summonDraftId)throw Error('召唤法术请使用召唤与伙伴入口登记真实材料、形态与落点')
    }
    const actual=world.encounters.find(e=>e.id===s.encounterId);if(actual)command=m5aAreaCommand(world,a,s,actual,command,cat)
    if(command.type==='end'){assertBattleSettled(world);if(pendingTerrain(a).length)throw Error('请先结算已经发生的区域后果，再结束战斗')}
    const index = world.encounters.findIndex((e) => e.id === s.encounterId)
    if (index < 0) throw new Error('请先关联遭遇')
    if (command.type === 'start') {
      if (a.exploration && a.exploration.status !== 'closed')
        throw Error('请先由 GM 收尾探索轮再开始战斗')
      live(s)
      assertBattleHistoryCapacity(a, world.encounters)
      if (world.encounters.some((e) => e.id !== s.encounterId && e.phase === 'active'))
        throw new Error('请先结束其他遭遇')
    }
    const trigger =
      command.type === 'zone-trigger' &&
      a.exploration?.status === 'active' &&
      world.encounters[index]!.phase !== 'active'
        ? a.exploration.triggers.find(
            (t) =>
              !t.resolved &&
              t.encounterId === s.encounterId &&
              t.sourceId === command.zoneId &&
              t.targetId === command.targetId &&
              t.phase === (command.phase ?? 'enter'),
          )
        : undefined
    if (
      command.type === 'zone-trigger' &&
      a.exploration?.status === 'active' &&
      world.encounters[index]!.phase !== 'active' &&
      !trigger
    )
      throw Error('请先登记对应探索触发候选')
    const prior=world.encounters[index]!,ending=prior.actors[prior.current],endingToken=s.tokens.find(t=>t.actorId===ending?.id)
    if(command.type==='next'||command.type==='end-turn'){
      if(pendingTerrain(a).length)throw Error('请先处理待结算区域事件，再推进回合')
      if(endingToken){if(summonPhase(world,a,s,endingToken,'end',cat))return;terrainPhase(world,a,s,endingToken,'end',cat);if(pendingTerrain(a,terrainEntityId(endingToken)).length)return}
    }else if('actorId'in command&&endingToken&&command.actorId===ending?.id&&pendingTerrain(a,terrainEntityId(endingToken)).length&&!['move','concentration','reaction-shield','reaction-counterspell'].includes(command.type))throw Error('请先处理当前人物的区域后果')
    if(command.type==='resolve')refreshM5AttackEnvironment(world,a,s,prior,cat)
    const previousBondIds = new Set(worldBondBodies(world).flatMap(b=>b.effects.filter(f=>f.wardingBond).map(f=>f.id)))
    const previousFearIds=new Set(world.characters.flatMap(c=>(c.runtime?.effects??[]).filter(f=>f.key==='fear').map(f=>f.id)))
    const priorDrops=new Set(world.characters.flatMap(c=>(c.runtime?.effects??[]).filter(f=>f.key==='command'&&f.supportChoice==='drop'&&f.maintainedTick!==undefined).map(f=>f.id)))
    const next = applyCombat(
      world.encounters[index]!,
      world.characters,
      cat,
      command,
      dice,
      trigger ? { key: trigger.id, targetId: trigger.targetId, phase: trigger.phase } : undefined,
    )
    world.encounters[index] = next.encounter
    world.characters = next.characters
    if(command.type==='resolve'&&prior.pending?.summonDraftId&&!next.encounter.pending?.summonDraftId)commitSummonInPlace(world,a.id,prior.pending.summonDraftId,cat)
    if(next.encounter.pending&&['burning-hands','fireball','thunderwave'].includes(next.encounter.pending.spellId??'')&&s.template&&!next.encounter.pending.m5Area)next.encounter.pending.m5Area=structuredClone(s.template)
    if(command.type==='resolve')queueM5Outcomes(world,a,s,prior,next.encounter,cat)
    for(const c of world.characters)if(c.runtime?.effects?.some(f=>f.key==='fear'&&!previousFearIds.has(f.id)))dropFearHeldItems(world,s,c.id,cat)
    for(const c of world.characters)if(c.runtime?.effects?.some(f=>f.key==='command'&&f.supportChoice==='drop'&&f.maintainedTick!==undefined&&!priorDrops.has(f.id)))dropFearHeldItems(world,s,c.id,cat)
    for (const body of worldBondBodies(world)) for (const effect of [...body.effects])
      if (effect.wardingBond && !previousBondIds.has(effect.id))
        connectWardingBond(worldBondBodies(world),effect.sourceId,effect.wardingBond.targetId,effect)
    if (trigger) {
      trigger.resolved = true
      trigger.note = '已使用原区域豁免／伤害结算；待 GM 完成伤害确认'
    }
    if (command.type === 'start' && next.encounter.session) {
      next.encounter.session.startedAt = new Date().toISOString()
      playBattleIntro(a, next.encounter, broadcastActionId)
    }
    syncTokens(s, world)
    if(command.type==='next'||command.type==='end-turn'||command.type==='start'||command.type==='end'){
      if(endingToken&&command.type!=='start')clearTerrainTurn(world,a,endingToken)
      const current=next.encounter.actors[next.encounter.current],token=s.tokens.find(t=>t.actorId===current?.id)
      if(token&&command.type!=='end'){terrainPhase(world,a,s,token,'start',cat);summonPhase(world,a,s,token,'start',cat)}
    }
  }
  const broadcastActionId = crypto.randomUUID()
  let interactionCheck:{total:number;success:boolean}|undefined
  let detail = '',
    checkpoint = false,
    noUndo = false
  const enter = (s: MapScene, landing: Position, portalPoint?: MapPoint) => {
    if(pendingTerrain(a).length)throw Error('请先结算已经发生的区域后果，再切换场景')
    if(a.m3?.events.some(e=>e.status==='pending'))throw Error('请先处理待结算空间后果再转换场景')
    if(a.scenes.some(s=>s.tokens.some(t=>a.party.includes(t.characterId??'')&&t.spatial&&t.spatial.layer!=='material')))throw Error('队伍成员须先合法退出异空间／石体再转换场景')
    if (a.exploration && a.exploration.status !== 'closed')
      throw Error('请先由 GM 收尾探索轮，再切换场景')
    noPending()
    if (!a.party.length) throw new Error('请先配置至少一名队伍角色')
    if (a.activeSceneId === s.id) throw new Error('队伍已在此场景；预览或刷新不会重复建入场点')
    if (
      world.encounters.some(
        (e) =>
          e.phase === 'active' &&
          e.actors.some((t) => t.characterId && a.party.includes(t.characterId)),
      )
    )
      throw new Error('请先结束队伍当前运行的遭遇再切换场景')
    if (
      world.adventures.some(
        (other) =>
          other.id !== a.id &&
          other.activeSceneId &&
          other.party.some((id) => a.party.includes(id)),
      )
    )
      throw new Error('队伍角色已在其他活动冒险，请先退出该冒险')
    const portalPlan = portalPoint ? planPortalArrival(world, a, s, portalPoint) : undefined
    const sourceTokens = a.scenes.find((from) => from.id === a.activeSceneId)?.tokens ?? []
    const previousTokens = s.tokens.filter((t) => t.characterId && a.party.includes(t.characterId))
    s.tokens = s.tokens.filter((t) => !t.characterId || !a.party.includes(t.characterId))
    for (const id of a.party) {
      const c = world.characters.find((c) => c.id === id)!,
        previous = previousTokens.find((t) => t.characterId === id),
        origin=sourceTokens.find(t=>t.characterId===id),span=origin?.span??previous?.span??1,
        p = portalPlan?.party[id] ?? freePosition(s, landing, span)
      const token = previous ? { ...previous, ...p } : tokenFor(c, p)
      token.span=span
      token.spatial={height:m3GroundAt(a,s,p),layer:'material'}
      if(origin?.baseSpan!==undefined)token.baseSpan=origin.baseSpan;else delete token.baseSpan
      if (portalPlan?.facing !== undefined) token.facing = portalPlan.facing
      s.tokens.push(token)
    }
    syncTokens(s, world)
    migrateNpcFollowers(world, a, s, landing, cat, portalPlan?.npcs, portalPlan?.facing)
    for (const token of s.tokens) token.groundTrail = []
    a.activeSceneId = s.id
    checkpoint = true
    detail = '队伍进入 ' + s.name + '；创建入场存档点'
  }
  if (isSceneToolCommand(command)) {
    detail = applySceneTools(world, a, command, cat, dice, broadcastActionId)
  } else if (command.type === 'explore') {
    detail = applyExploration(world, a, scene(command.sceneId), command.command, cat, dice)
  } else if (isBattleCommand(command)) {
    if (
      (command.type === 'battle-prepare' ||
        (command.type === 'battle-request-review' && command.approve)) &&
      a.exploration?.status !== 'closed' &&
      a.exploration
    )
      throw Error('请先由 GM 收尾探索轮再准备战斗')
    detail = applyBattleCommand(world, a, command, cat, broadcastActionId)
    if (command.type === 'battle-reset') noUndo = true
  } else
    switch (command.type) {
      case 'discovery-check':
        resolveDiscovery(world, a, scene(command.sceneId), command.attemptId, cat, dice)
        detail = '环境感知已处理'
        break
      case 'discovery-reset': {
        const s = scene(command.sceneId)
        s.discoveryAttempts = s.discoveryAttempts?.filter(
          (x) =>
            x.pointId !== command.pointId ||
            (command.characterId && x.characterId !== command.characterId),
        )
        detail = 'GM重置发现尝试'
        break
      }
      case 'discovery-cancel-route': {
        const s = scene(command.sceneId)
        s.pausedRoutes = s.pausedRoutes?.filter((x) => x.id !== command.routeId)
        detail = '已取消未走路线，不恢复已用移动'
        break
      }
      case 'point-link-retry':
        retryPointLink(world, a, command.sceneId, command.runId, cat)
        detail = '重试机关关联'
        break
      case 'npc-config-import':
      case 'broadcast-text-import':
        applyConfigImport(world, a, command)
        detail = command.type === 'npc-config-import' ? '已追加NPC配置' : '已追加固定文案（GM手动）'
        break
      case 'ai-settings':
      case 'npc-template':
      case 'npc-template-delete':
      case 'npc-party-scope':
      case 'npc-profile':
      case 'npc-delete':
        applyAiMap(a, world, cat, command)
        detail = '保存旁白／NPC 配置'
        break
      case 'broadcast-template':
      case 'broadcast-delete':
      case 'broadcast-reset':
      case 'broadcast-play':
      case 'broadcast-start':
      case 'broadcast-mark':
        applyBroadcastCommand(a, world, command, broadcastActionId)
        detail =
          command.type === 'broadcast-template'
            ? '保存广播模板 ' + command.template.title
            : '广播配置与播放已保存'
        break
      case 'scene-add':
        noPending()
        if (a.scenes.length >= 30) throw new Error('单个冒险最多 30 个场景')
        a.scenes.push(newScene(command.name,'enclosed'))
        detail = '新增场景 ' + a.scenes.at(-1)!.name
        break
      case 'leave':
        if(pendingTerrain(a).length)throw Error('请先结算已经发生的区域后果，再离开场景')
        noPending()
        if (world.encounters.some((e) => encounterIds(a, world).has(e.id) && e.phase === 'active'))
          throw new Error('请先结束场景遭遇')
        a.activeSceneId = null
        detail = '队伍退出冒险；保留场景进度'
        break
      case 'party':
        noPending()
        if (a.activeSceneId) throw new Error('请在进入场景前配置队伍；需要更换时先退出冒险')
        a.party = [...command.ids]
        for (const s of a.scenes)
          s.tokens = s.tokens.filter(
            (t) => t.npcId || !t.characterId || a.party.includes(t.characterId),
          )
        detail = '配置队伍'
        break
      case 'scene-edit': {
        noPending()
        const current = scene(command.scene.id)
        if (
          // Schema parsing may reorder primitive token keys; compare values, while still forbidding token edits here.
          current.tokens.length !== command.scene.tokens.length ||
          current.tokens.some((token, i) => {
            const incoming = command.scene.tokens[i]!
            return (
              Object.keys(token).length !== Object.keys(incoming).length ||
              Object.entries(token).some(
                ([key, value]) =>
                  !sameValue(value, (incoming as unknown as Record<string, unknown>)[key]),
              )
            )
          }) ||
          current.encounterId !== command.scene.encounterId
        )
          throw new Error('请通过棋子或遭遇操作修改引用与位置')
        const config = clone(command.scene)
        if(a.sceneEffects?.regions.some(e=>e.status==='active'&&e.sceneId===current.id&&e.magic?.pointId&&!config.points.some(p=>p.id===e.magic!.pointId&&p.enabled)))
          throw Error('互动点仍被有效的门锁／警戒／刻纹来源引用；请先结束对应法术，再删除或停用互动点')
        if (current.linkRuns) config.linkRuns = clone(current.linkRuns)
        else delete config.linkRuns
        if (current.discoveryAttempts) config.discoveryAttempts = clone(current.discoveryAttempts)
        else delete config.discoveryAttempts
        if (current.pausedRoutes) config.pausedRoutes = clone(current.pausedRoutes)
        else delete config.pausedRoutes
        if (current.defeatedTokens) config.defeatedTokens = clone(current.defeatedTokens)
        else delete config.defeatedTokens
        for (const p of config.points) {
          const old = current.points.find((q) => q.id === p.id),
            area = p.portal?.arrival
          if (
            old &&
            area?.relative &&
            sameValue(area, old.portal?.arrival) &&
            (old.x !== p.x || old.y !== p.y)
          ) {
            const dx = p.x - old.x,
              dy = p.y - old.y
            area.anchor = { x: area.anchor.x + dx, y: area.anchor.y + dy }
            area.cells = area.cells.map((k) => {
              const [x, y] = k.split(',').map(Number)
              return x! + dx + ',' + (y! + dy)
            })
          }
        }

        config.arrivalGroups = config.arrivalGroups?.map((g) => {
          const prior = current.arrivalGroups?.find((x) => x.id === g.id)
          return {
            ...g,
            status: prior?.status ?? 'waiting',
            reason: prior?.reason,
            requestId: prior?.requestId,
            sourceEventId: prior?.sourceEventId,
          }
        })
        config.groundItems = config.groundItems?.map((g) => ({
          ...g,
          customItem: cat.items.some((i) => i.id === g.itemId)
            ? undefined
            : g.customItem?.id === g.itemId
              ? g.customItem
              : world.characters.flatMap((c) => c.build.customItems).find((i) => i.id === g.itemId),
          quantity: Math.min(
            g.initialQuantity,
            current.groundItems?.find((x) => x.id === g.id)?.quantity ?? g.initialQuantity,
          ),
        }))
        Object.assign(current, config)
        detail = '编辑场景 ' + current.name
        break
      }
      case 'wall-toggle': {
        const s = scene(command.sceneId)
        noPending()
        const wall = s.walls?.find((w) => w.id === command.wallId)
        if (!wall || wall.kind !== 'door') throw new Error('门段不存在')
        if (wallState(s, wall) === 'locked')
          throw new Error('门已锁定，请先通过互动检定或 GM 编辑解锁')
        const next = wallState(s, wall) === 'open' ? 'closed' : 'open'
        if(next==='closed')assertDoorClear(s,wall.pointId,wall.id)
        if (wall.pointId) s.points.find((p) => p.id === wall.pointId)!.state = next
        else wall.state = next
        detail = `GM ${next === 'open' ? '打开' : '关闭'}门段 ${wall.name}`
        break
      }
      case 'portal-pair':
        noPending()
        pairPortals(a, command)
        detail = 'GM更新通行口配对'
        break
      case 'enter':
        enter(scene(command.sceneId), command.landing)
        break
      case 'token-add': {
        noPending()
        const s = scene(command.sceneId),
          c = world.characters.find((c) => c.id === command.characterId)
        if (!c || !a.party.includes(c.id)) throw new Error('请先将角色加入队伍')
        s.tokens.push(tokenFor(c, command.position))
        syncTokens(s, world)
        detail = '放置角色棋子'
        break
      }
      case 'token-edit': {
        noPending()
        const s = scene(command.sceneId),
          t = s.tokens.find((t) => t.id === command.token.id)
        if (
          !t ||
          t.actorId !== command.token.actorId ||
          t.characterId !== command.token.characterId ||
          t.x !== command.token.x ||
          t.y !== command.token.y
        )
          throw new Error('位置与引用须通过移动操作修改')
        Object.assign(t, clone(command.token))
        const npc = a.ai?.npcs.find((n) => n.id === t.npcId)
        if (npc && npc.hidden !== t.hidden) {
          npc.hidden = t.hidden
          npc.revision++
        }
        detail = '编辑棋子 ' + t.name
        break
      }
      case 'move': {
        let path = command.path
        const requestedPath=command.path.map(p=>({...p}))
        const s = scene(command.sceneId)
        live(s)
        const t = s.tokens.find((t) => t.id === command.tokenId)
        if (!t) throw new Error('棋子不存在')
        if(!command.gm&&(t.spatial&&(t.spatial.layer!=='material'||t.spatial.height!==0)||a.m3?.events.some(e=>e.status==='pending'&&[t.id,t.characterId,t.npcId,t.actorId].includes(e.entityId))))throw Error('请先处理空间后果；立体／异空间移动请使用空间移动入口')
        if (!command.gm) {
          if (
            s.discoveryAttempts?.some(
              (x) =>
                x.characterId === t.characterId &&
                x.status === 'pending' &&
                x.branchId === a.broadcastLog?.branchId,
            )
          )
            throw Error('请先完成发现检定')
          if (
            s.pausedRoutes?.some(
              (r) => r.tokenId === t.id && r.branchId === a.broadcastLog?.branchId,
            )
          )
            throw Error('请先继续或取消已暂停路线')
          if (!path.length || path.length > 160) throw Error('请选择有效移动路线')
          const stop = firstDiscoveryOnRoute(world, a, s, t, path, cat)
          if (stop) {
            const remaining = path.slice(stop.index),
              prefix = path.slice(0, stop.index)
            if (remaining.length) {
              s.pausedRoutes ??= []
              s.pausedRoutes.push({
                id: crypto.randomUUID(),
                tokenId: t.id,
                characterId: t.characterId!,
                branchId: a.broadcastLog?.branchId ?? 'legacy',
                path: remaining,
                start: prefix.at(-1) ?? { x: t.x, y: t.y },
                reactionsConfirmed: command.reactionsConfirmed,
              })
            }
            path = prefix
            command.path = prefix
            if (!prefix.length) {
              queueCurrentDiscoveries(world, a, s, cat)
              detail = '移动暂停，等待环境感知'
              break
            }
          }
        }
        if(!command.gm)path=prepareTerrainRoute(world,a,s,t,path.map(p=>({...p,height:t.spatial?.height??0})),'map',command.reactionsConfirmed).map(({x,y})=>({x,y}))
        if(!command.gm&&pendingTerrain(a,terrainEntityId(t)).length&&path.length<requestedPath.length){
          // Discovery and terrain share the actual first stopping point. A later
          // discovery must not retain a second route starting in the future.
          s.pausedRoutes=s.pausedRoutes?.filter(r=>r.tokenId!==t.id)
          const state=a.sceneEffects!,id=terrainEntityId(t),remaining=requestedPath.slice(path.length).map(p=>({...p,height:t.spatial?.height??0})),start={...path.at(-1)!,height:t.spatial?.height??0}
          let route=state.routes.find(r=>r.entityId===id&&r.status==='paused')
          if(route){route.path=remaining;route.start=start}
          else state.routes.push({id:crypto.randomUUID(),entityId:id,tokenId:t.id,sceneId:s.id,branchId:a.broadcastLog?.branchId??'legacy',start,path:remaining,mode:'map',reactionsConfirmed:command.reactionsConfirmed,status:'paused'})
        }
        if (command.gm) requireReason(command.reason)
        const e = world.encounters.find((e) => e.id === s.encounterId),
          actor = e?.actors.find((a) => a.id === t.actorId),
          c = world.characters.find((c) => c.id === t.characterId)
        const statistics = actor
          ? combatStats(actor, world.characters, cat)
          : c
            ? runtimeDerived(c, cat)
            : null
        if(!command.gm)assertDuelRoute(world,s,t,path,actor?combatStats(actor,world.characters,cat).effects:c?runtimeState(c,cat).effects:[])
        if(!command.gm&&statistics?.conditions.includes('frightened'))assertFrightenedRoute(world,s,t,path,actor?combatStats(actor,world.characters,cat).effects:c?runtimeState(c,cat).effects:[])
        if (
          !command.gm &&
          (statistics?.speed === 0 ||
            (actor
              ? combatStats(actor, world.characters, cat).dead
              : c && runtimeState(c, cat).death.dead))
        )
          throw new Error('该棋子不能自行移动；强制位移请使用 GM 调整并填写原因')
        const crawling =
          !command.gm &&
          (actor
            ? combatStats(actor, world.characters, cat).conditions
            : c
              ? runtimeDerived(c, cat).conditions
              : []
          ).includes('prone')
        const pass = occupancyRules(s, t, world, cat),
          cost = pathCost(s, t, path, command.gm, crawling, pass, command.gm?undefined:{world,adventure:a})
        explorationMove(world, a, t, path, cost, cat, command.gm)
        if (e?.phase === 'active' && !actor) throw new Error('该棋子未加入运行中的遭遇')
        if (e?.phase === 'active' && !command.gm) {
          const enemies = e.actors.filter(
            (other) =>
              other.side !== actor!.side &&
              other.side !== 'neutral' &&
              other.turn.reaction &&
              !combatStats(other, world.characters, cat).conditions.includes('incapacitated'),
          )
          let previous = { x: t.x, y: t.y }
          const candidates = new Set<string>()
          for (const p of path) {
            for (const other of enemies) {
              const token = s.tokens.find((t) => t.actorId === other.id)
              if (!token) continue
              const reach = Math.max(
                5,
                ...attackOptions(other, world.characters, cat)
                  .filter((a) => !a.ranged)
                  .map((a) => a.reach),
              )
              if (
                distance(s, { ...t, ...previous }, token) <= reach &&
                distance(s, { ...t, ...p }, token) > reach
              )
                candidates.add(token.name)
            }
            previous = p
          }
          if (
            candidates.size &&
            !command.reactionsConfirmed &&
            !combatStats(actor!, world.characters, cat).effects.some(
              (effect) => effect.key === 'disengage',
            )
          )
            throw new Error(
              '可能触发借机攻击：' +
                [...candidates].join('、') +
                '；请由 GM 处理或确认不触发后再移动',
            )
          for (let i = 0; i < path.length; i++) {
            const p = path[i]!,
              difficult = false,
              multiplier=Math.max(stepDifficult(s,t,p,pass)?2:1,terrainMultiplier(world,a,s,{...t,...p}))
            combat(s, {
              type: 'move',
              actorId: actor!.id,
              distance: s.grid.feet,
              difficult,
              extraCost: s.grid.feet*((crawling?1:0)+multiplier-1+windMovementCost(world,a,s,t,{...tokenPoint(t),x:(path[i-1]?.x??t.x)+t.span/2,y:(path[i-1]?.y??t.y)+t.span/2},{...tokenPoint(t),x:p.x+t.span/2,y:p.y+t.span/2})),
              stand: false,
              note: '地图逐格移动；GM 已确认路线与借机触发',
            })
          }
        } else if (!command.gm && t.characterId) {
          const c = world.characters.find((c) => c.id === t.characterId)!,
            stats = runtimeDerived(c, cat)
          if (stats.speed === 0) throw new Error('当前速度为零，无法普通移动')
          if (
            world.encounters.some(
              (e) => e.phase === 'active' && e.actors.some((a) => a.characterId === t.characterId),
            )
          )
            throw new Error('角色正在其他遭遇中')
        }
        const originalPosition = { x: t.x, y: t.y }
        if (!command.gm) for (const step of path) {
          Object.assign(t, step)
          reconcileWorldBonds(world)
          reconcileSceneEffects(world)
          recordFog(world, a, s,[],{entry:!command.gm,entryIds:[t.id],sourceEventId:broadcastActionId})
        }
        Object.assign(t, path.at(-1))
        t.groundTrail =
          command.gm || crawling
            ? []
            : [...(t.groundTrail?.length ? t.groundTrail : [originalPosition]), ...path].slice(-200)
        if (e?.phase === 'active' && actor) {
          const turn = world.encounters
            .find((b) => b.id === e.id)!
            .actors.find((b) => b.id === actor.id)!.turn
          turn.groundTrail =
            command.gm || crawling
              ? []
              : [
                  ...(actor.turn.groundTrail?.length ? actor.turn.groundTrail : [originalPosition]),
                  ...path,
                ].slice(-200)
        }
        refreshTruthZones(world,a,s,t,[originalPosition,...path],cat,dice)
        collectExplorationMovementTriggers(world, a, s, t, path)
        detail = `${t.name}移动至 (${t.x},${t.y})；路线成本 ${cost} 尺${command.gm ? '；GM 调整，不扣普通移动：' + command.reason : ''}`
        break
      }
      case 'encounter-create': {
        noPending()
        const s = scene(command.sceneId)
        if (s.encounterId) throw new Error('场景已关联遭遇')
        if (world.encounters.filter((e) => e.phase !== 'ended').length >= 20)
          throw new Error('最多 20 个准备/运行遭遇')
        const e = newEncounter(command.name)
        world.encounters.push(e)
        s.encounterId = e.id
        for (const id of a.party)
          combat(s, { type: 'add-character', characterId: id, side: 'party' })
        transferCompanions(
          world.encounters.find((entry) => entry.id === e.id)!,
          world.encounters,
          world.characters,
          a.summons?.instances,
        )
        syncTokens(s, world)
        detail = '创建并关联场景遭遇'
        attachSceneNpcs(a, world, s, cat)
        for(const i of a.summons?.instances??[])if(i.position?.sceneId===s.id&&i.state==='present'&&i.body)attachSummon(world,a,i,s,dice)
        syncNpcTokens(a, world)
        syncTokens(s, world)
        break
      }
      case 'encounter-link': {
        noPending()
        const s = scene(command.sceneId)
        if (s.encounterId && s.encounterId !== command.encounterId)
          throw new Error('请保留当前场景遭遇；其他遭遇可关联新场景')
        if (
          world.adventures.some((a) =>
            a.scenes.some((s) => s.encounterId === command.encounterId && s.id !== command.sceneId),
          )
        )
          throw new Error('遭遇已关联其他场景')
        const e = world.encounters.find((e) => e.id === command.encounterId)
        if (!e) throw new Error('遭遇不存在')
        if (e.session?.canceled)
          throw new Error('已取消的准备只作为人物状态来源，请确认新的参战名单')
        for (const actor of e.actors)
          if (
            actor.characterId &&
            !a.party.includes(actor.characterId) &&
            !a.ai?.npcs.some((n) => n.characterId === actor.characterId && n.sceneId === s.id)
          )
            throw new Error('请先将遭遇角色加入该冒险队伍')
        s.encounterId = e.id
        syncTokens(s, world)
        detail = '关联遭遇 ' + e.name
        break
      }
      case 'encounter-unlink': {
        noPending()
        const s = scene(command.sceneId),
          e = world.encounters.find((e) => e.id === s.encounterId)
        if (!e) throw new Error('场景没有关联遭遇')
        if (e.phase === 'active') throw new Error('请先结束遭遇再解除关联')
        s.encounterId = null
        s.tokens = s.tokens.filter((t) => t.characterId || t.npcId)
        s.tokens.forEach((t) => (t.actorId = null))
        detail = '解除场景遭遇关联；原遭遇保留在战斗桌：' + e.name
        break
      }
      case 'combat': {
        const s = scene(command.sceneId),
          c = clone(command.command),
          e = world.encounters.find((e) => e.id === s.encounterId)
        if (!e) throw new Error('场景遭遇不存在')
        if (
          command.resolutionGuard &&
          (command.resolutionGuard.encounterId !== e.id ||
            command.resolutionGuard.pendingId !== (e.pending?.id ?? '') ||
            command.resolutionGuard.tick !== e.tick ||
            command.resolutionGuard.branch !== a.broadcastLog?.branchId)
        )
          throw new Error('待结算行动或存档分支已变化，请刷新后核对；未执行旧结算')
        const openingRequest = command.openingRequestId
          ? a.battles?.requests.find((r) => r.id === command.openingRequestId)
          : undefined
        if (command.openingRequestId) {
          if (!openingRequest || openingRequest.sceneId !== s.id || !openingRequest.opening)
            throw Error('主动行动请求不存在')
          assertOpeningCommand(openingRequest, s, e, c)
          validateOpening(world, s, openingRequest.characterId, openingRequest.opening, cat)
        }
        if (command.options?.template) {
          validateTemplate({ ...s, template: command.options.template })
          s.template = clone(command.options.template)
        }
        if (c.type === 'undo') throw new Error('地图关联遭遇请使用地图整笔撤销')
        if (c.type === 'move' && !(c.stand && c.distance === 0 && !c.extraCost))
          throw new Error('该遭遇已关联地图，请在地图提交移动；单独起身时距离填 0')
        if (e.phase === 'active' && a.activeSceneId !== s.id)
          throw new Error('请进入遭遇所在场景再提交')
        if (
          c.type === 'attack' ||
          c.type === 'unarmed' ||
          c.type === 'cast' ||
          c.type === 'npc-ability' ||
          c.type === 'feature' ||
          c.type === 'item-use' || c.type==='wake'
        ) {
          const from = s.tokens.find((t) => t.actorId === c.actorId)
          if (!from) throw new Error('行动者缺少地图棋子')
          let category: 'weapon' | 'thrown' | 'spell' | null = null
          let areaSpec: AreaSpec | null = null,
            areaEffect = false
          const actor = e.actors.find((a) => a.id === c.actorId)!
          if (c.type === 'attack')
            category = attackCategory(
              attackOptions(
                actor,
                world.characters.map((p) =>
                  p.id === actor.characterId && c.handling
                    ? handlingPreview(p, cat, c.handling)
                    : p,
                ),
                cat,
              ).find((a) => a.id === c.attackId),
              !!actor.npc,
            )
          if (c.type === 'cast') {
            const char = world.characters.find((c) => c.id === actor.characterId),
              grant = char ? runtimeSpells(char, cat).find((g) => g.key === c.key) : undefined
            if (grant) {
              areaEffect = !!spellEffect(grant.spell.id).area
              areaSpec = spellAreaSpec(grant.spell)
              if (areaSpec && c.metamagic?.option === 'distant') areaSpec.range *= 2
            }
            if (grant?.spell.id === 'true-strike')
              category = attackCategory(
                attackOptions(actor, world.characters, cat).find((a) => a.id === c.weaponId),
              )
            else if (
              grant &&
              spellEffect(grant.spell.id).kind === 'attack' &&
              grant.spell.range !== 'Touch'
            )
              category = 'spell'
          }
          if (c.type === 'npc-ability') {
            const power = actor.npc?.abilities?.find((a) => a.id === c.abilityId),
              spell = cat.spells.find((s) => s.id === power?.spellId)
            if (spell) {
              areaEffect = !!spellEffect(spell.id).area
              areaSpec = spellAreaSpec(spell)
              if (spellEffect(spell.id).kind === 'attack') category = 'spell'
            }
          }
          const ids =
            c.type === 'npc-ability'
              ? c.targetIds
              : c.type === 'cast'
                ? c.targets
                : c.type === 'feature' && c.targets?.length
                  ? c.targets
                  : [c.targetId]
          const envs: Record<string, Environment> = {}
          if (c.type === 'feature' && c.id === 'breath') {
            areaEffect = true
            areaSpec = {
              shape: s.template?.shape === 'line' ? 'line' : 'cone',
              size: s.template?.shape === 'line' ? 30 : 15,
              width: s.template?.shape === 'line' ? 5 : undefined,
              self: true,
              range: 0,
            }
          }
          for (const id of ids) {
            const to = s.tokens.find((t) => t.actorId === id)
            if (!to) throw new Error('目标缺少地图棋子')
            const original =
              c.type === 'attack' || c.type === 'unarmed' || c.type === 'item-use' || c.type==='wake'
                ? c.env
                : (c.targetEnvironments?.[id] ?? c.env)
            envs[id] = mapEnvironment(s, from, to, original, category, command.options)
            if(c.type==='attack'){
              const spec=attackOptions(actor,world.characters,cat).find(v=>v.id===c.attackId)
              const crossing=!!a.sceneEffects?.regions.some(r=>r.status==='active'&&r.spellId==='wind-wall'&&r.geometry&&volumeRay(r.geometry,tokenPoint(from),tokenPoint(to),s.grid.feet))
              if(crossing&&spec?.ranged&&!spec.projectile&&!spec.properties.includes('npc-spell'))throw Error('穿越风墙前请在NPC数据卡核实射弹类别，不能猜测巨石或能量')
              envs[id]!.windWallMiss=!!(spec?.ranged&&spec.projectile==='ordinary'&&a.sceneEffects?.regions.some(r=>r.status==='active'&&r.spellId==='wind-wall'&&r.geometry&&volumeRay(r.geometry,tokenPoint(from),tokenPoint(to),s.grid.feet)))
            }
            const sourceEntity=m1Entity(world,a,from.characterId??from.npcId??from.actorId??from.id),sourceType=sceneCreatureType(world,a,sourceEntity?.id??actor.id)
            if(a.sceneEffects?.regions.some(r=>r.status==='active'&&r.spellId==='magic-circle'&&r.magic?.types.includes(sourceType as typeof r.magic.types[number])&&r.geometry&&(r.magic.reverse?geometryContains(r.geometry,tokenPoint(from),s.grid.feet)&&!geometryContains(r.geometry,tokenPoint(to),s.grid.feet):geometryContains(r.geometry,tokenPoint(to),s.grid.feet))))envs[id]!.disadvantage=true
            if(c.type==='cast'||c.type==='npc-ability'){
              const bodySpell=c.type==='cast'?sourceEntity?.c&&runtimeSpells(sourceEntity.c,cat).find(g=>g.key===c.key)?.spell:cat.spells.find(sp=>sp.id===actor.npc?.abilities?.find(b=>b.id===c.abilityId)?.spellId)
              if(bodySpell){magicCrossing(world,a,s,tokenPoint(from),tokenPoint(to),sourceEntity?.id??actor.id,{spellLevel:c.type==='cast'?castSlotLevel(c.mode)||bodySpell.level:bodySpell.level});if(sourceEntity?.state.effects?.some(f=>f.key==='silence-region')&&/(^|[,\s])V([,\s(]|$)/.test(bodySpell.components)&&!(c.type==='cast'&&c.metamagic?.option==='subtle'))throw Error('沉默区域中不能使用言语成分施法')}
            }
            const perceived=tokenPerception(world,a,s,from,to,cat),reverse=tokenPerception(world,a,s,to,from,cat)
            envs[id]!.attackerHears=hearsSound(world,a,from)&&soundBetween(world,a,s,tokenPoint(to),tokenPoint(from))
            if(perceived.reasons.includes('不可见目标')&&!perceived.locationKnown&&!perceived.canSee)throw Error('目标当前位置未知，不能靠旧棋子ID追踪隐形移动；请GM核实猜测落点')
            envs[id]!.attackerSees=perceived.canSee
            envs[id]!.targetSees=reverse.canSee
            if(!perceived.sameInteractionSpace)throw Error('目标与来源不在同一可互动空间')
            if (
              c.type === 'attack' &&
              actor.npc?.packTactics &&
              actor.side !== 'neutral' &&
              e.actors.some((ally) => {
                const state = combatStats(ally, world.characters, cat),
                  allyToken = s.tokens.find((t) => t.actorId === ally.id)
                return (
                  ally.id !== actor.id &&
                  ally.id !== id &&
                  ally.side === actor.side &&
                  !!allyToken &&
                  !state.dead &&
                  state.hp > 0 &&
                  !state.conditions.includes('incapacitated') &&
                  distance(s, allyToken, to) <= 5
                )
              })
            )
              envs[id]!.attackAdvantages = [
                ...(envs[id]!.attackAdvantages ?? []),
                '集群战术：目标5尺内有未失能盟友',
              ]
            if (command.options?.distance !== false)
              envs[id]!.crusaderActive = e.actors.some((source) => {
                const sourceCharacter = world.characters.find((c) => c.id === source.characterId),
                  token = s.tokens.find((t) => t.actorId === source.id)
                return (
                  source.side === actor.side &&
                  !!token &&
                  distance(s, token, from) <= 30 &&
                  (sourceCharacter?.runtime?.concentration ?? source.npc?.concentration)?.spellId === 'crusaders-mantle' &&
                  (sourceCharacter?.runtime?.effects ?? source.npc?.effects)?.some((f) => f.key === 'crusaders-mantle') && !combatStats(source,world.characters,cat).dead && combatStats(source,world.characters,cat).hp>0
                )
              })
            const targetActor = e.actors.find((a) => a.id === id),
              targetCharacter = world.characters.find((c) => c.id === targetActor?.characterId)
            const targetEffects =
              targetCharacter?.runtime?.effects ?? targetActor?.npc?.effects ?? []
            if (command.options?.distance !== false)
              envs[id]!.protectionActive = targetEffects
                .filter((effect) => effect.key === 'protection')
                .some((effect) => {
                  const protector = s.tokens.find((t) => t.actorId === effect.sourceId)
                  return !!protector && distance(s, protector, to) <= 5
                })
            if (
              c.type === 'feature' &&
              ['origin/interception', 'origin/protection'].includes(c.id)
            ) {
              const triggerId =
                c.id === 'origin/interception'
                  ? e.pending?.actorId
                  : (c.triggerActorId ?? e.actors[e.current]?.id)
              const trigger = s.tokens.find((t) => t.actorId === triggerId)
              if (!trigger) throw new Error('请为触发攻击者配置地图棋子')
              if (command.options?.obstacles !== false)
                envs[id]!.attackerSees =
                  original.attackerSees && sightLine(s, from, trigger, 'blocksSight').clear
            }
            if (areaEffect) {
              const spellId =
                c.type === 'cast' &&
                runtimeSpells(
                  world.characters.find((char) => char.id === actor.characterId)!,
                  cat,
                ).find((g) => g.key === c.key)?.spell.id
              if (spellId && isZoneSpell(spellId) && s.template) {
                const anchor = {
                  ...to,
                  id: 'zone-origin-preview',
                  x: s.template.x,
                  y: s.template.y,
                  span: 1,
                }
                if (
                  spellId === 'cloud-of-daggers' &&
                  s.template.includeOrigin === false &&
                  command.options?.area !== false
                )
                  throw new Error('匕首之云必须覆盖中心原点；请开启包含原点')
                const template = { ...s.template, includeOrigin: true }
                envs[id] = areaEnvironment(
                  { ...s, template, tokens: [...s.tokens, anchor] },
                  from,
                  anchor,
                  envs[id]!,
                  { distance: true, highGround: true, reason: '', ...command.options, template },
                  areaSpec,
                  original,
                )
              } else
                envs[id] = areaEnvironment(
                  s,
                  from,
                  to,
                  envs[id]!,
                  command.options,
                  areaSpec,
                  original,
                )
            }
          }
          if (ids.length) c.env = envs[ids[0]!]!
          if (c.type === 'cast' || c.type === 'feature' || c.type === 'npc-ability')
            c.targetEnvironments = envs
        }
        if (c.type === 'surge-npc') {
          const from = s.tokens.find((t) => t.actorId === c.actorId),
            p = c.destination
          if (!from || !p) throw new Error('请为浪涌生物指定随机确定的落点')
          const footprint = { ...from, ...p, span: 1, id: 'surge-placement-preview' }
          if (
            !inside(s, p) ||
            blocked(s, p) ||
            s.tokens.some((t) => occupied(t).some((cell) => cell.x === p.x && cell.y === p.y))
          )
            throw new Error('浪涌生物须置于合法未占据空间')
          if (distance(s, from, footprint) > 60) throw new Error('浪涌生物落点须在施法者六十尺内')
        }
        if (c.type === 'companion-power') {
          const from = s.tokens.find((t) => t.actorId === c.actorId),
            to = s.tokens.find((t) => t.actorId === c.targetId)
          if (!from || !to) throw new Error('灵魄或目标缺少地图棋子')
          if (c.kind === 'fey-step') {
            if (!c.destination) throw new Error('请选择妖精步伐的传送落点')
            if (
              !occupied({ ...from, ...c.destination }).every(
                (p) => inside(s, p) && !blocked(s, p),
              ) ||
              occupants(s, from, c.destination).length
            )
              throw new Error('妖精步伐须选择合法未占据空间')
            const destination = { ...from, ...c.destination }
            if (distance(s, from, destination) > 30) throw new Error('妖精步伐传送不能超过三十尺')
            if (
              command.options?.obstacles !== false &&
              !sightLine(s, from, destination, 'blocksSight').clear
            )
              throw new Error('妖精步伐落点必须可见')
            Object.assign(from, c.destination)
          }
          c.env = mapEnvironment(s, from, to, c.env, null, command.options)
        }
        if(c.type==='reaction-counterspell'||c.type==='npc-reaction'&&e.actors.find(a=>a.id===c.actorId)?.npc?.abilities?.find(a=>a.id===c.abilityId)?.reaction==='counterspell'){
          const from=s.tokens.find(t=>t.actorId===c.actorId),to=s.tokens.find(t=>t.actorId===e.pending?.actorId)
          if(!from||!to)throw Error('反制来源或正在施法者缺少实际地图位置')
          const sensed=tokenPerception(world,a,s,from,to,cat,true)
          c.env=mapEnvironment(s,from,to,c.env??defaultEnvironment(),null)
          c.env.attackerSees=sensed.canSee
          if(!sensed.sameInteractionSpace||!sensed.canSee||c.env.distance>60)throw Error('反制必须在同一可互动空间、60尺内实际看见正在施法者')
        }
        if (c.type === 'zone-trigger') {
          const zone = e.zones?.find((z) => z.id === c.zoneId),
            from = s.tokens.find((t) => t.actorId === c.actorId),
            to = s.tokens.find((t) => t.actorId === c.targetId)
          if (zone?.template && from && to && command.options?.area !== false) {
            const template = clone(zone.template)
            if (zone.spellId === 'spirit-guardians') {
              template.x = from.x
              template.y = from.y
              template.originSpan = from.span
              delete template.origin
            }
            const recipe = spellAreaSpec(cat.spells.find((spell) => spell.id === zone.spellId)!)
            c.env = areaEnvironment(
              { ...s, template },
              from,
              to,
              c.env,
              { distance: true, highGround: true, reason: '', ...command.options, template },
              recipe && { ...recipe, self: zone.spellId === 'spirit-guardians', range: 10000 },
              c.env,
            )
          }
        }
        if (c.type === 'zone-move') {
          const z = e.zones?.find((z) => z.id === c.zoneId)
          if (z?.template && s.template && command.options?.area !== false) {
            if (
              s.template.shape !== 'cube' ||
              s.template.size !== 5 ||
              s.template.originRule !== 'center'
            )
              throw new Error('匕首之云移动须使用五尺中心立方模板')
            const oldOrigin = z.template.origin ?? { x: z.template.x + 0.5, y: z.template.y + 0.5 },
              newOrigin = s.template.origin ?? { x: s.template.x + 0.5, y: s.template.y + 0.5 },
              feet =
                Math.max(Math.abs(oldOrigin.x - newOrigin.x), Math.abs(oldOrigin.y - newOrigin.y)) *
                s.grid.feet
            if (feet > 30) throw new Error('匕首之云实际移动超过三十尺')
            c.distance = feet
          }
        }
        if (c.type === 'unarmed' && c.kind === 'push') {
          const from = s.tokens.find((t) => t.actorId === c.actorId),
            to = s.tokens.find((t) => t.actorId === c.targetId)
          if (!from || !to) throw Error('推撞需要双方地图棋子')
          const step = 5 / s.grid.feet
          if (!Number.isInteger(step))
            throw Error('当前网格无法表达精确推离 5 尺，请由 GM 调整网格或裁定')
          c.pushTo ??= {
            x: to.x + Math.sign(to.x - from.x) * step,
            y: to.y + Math.sign(to.y - from.y) * step,
          }
          const dest = { ...to, ...c.pushTo }
          if (
            distance(s, to, dest) !== 5 ||
            distance(s, from, dest) <= distance(s, from, to) ||
            occupied(dest).some((p) => !inside(s, p) || blocked(s, p)) ||
            movementWalls(s, to, to, dest).length ||
            s.tokens.some(
              (t) =>
                t.id !== to.id &&
                occupied(t).some((p) => occupied(dest).some((q) => p.x === q.x && p.y === q.y)),
            )
          )
            throw Error('推离落点越界、受阻、被占据或并未远离来源，请改选倒地或让 GM 明确裁定')
        }
        const attackPushes=c.type==='resolve'?(c.pushDestinations??[]):[]
        const pushWasTavern=!!attackPushes.length&&combatPushChoices(world,s,e,cat).some(v=>v.kind==='tavern')
        const pushSourceId=e.pending?.actorId
        if(attackPushes.length){
          const choices=combatPushChoices(world,s,e,cat)
          if(c.type!=='resolve'||!c.pushConfirmed||new Set(attackPushes.map(p=>p.targetId)).size!==attackPushes.length||attackPushes.some(p=>!choices.some(v=>v.targetId===p.targetId&&v.destinations.some(d=>d.x===p.x&&d.y===p.y)))||choices.some(v=>v.kind==='tavern')&&attackPushes.length>1)throw Error('推移资格或落点已经改变；未消费额外资源')
        }
        const pushed =
          c.type === 'resolve' && e.pending?.unarmed?.kind === 'push' && e.pending.targets[0]?.hit
            ? { targetId: e.pending.targets[0].id, to: e.pending.unarmed.pushTo }
            : null
        if (pushed?.to) {
          const from = s.tokens.find((t) => t.actorId === e.pending!.actorId),
            to = s.tokens.find((t) => t.actorId === pushed.targetId)
          if (!from || !to) throw Error('推撞结算时棋子已变化，请重新核对')
          const dest = { ...to, ...pushed.to }
          if (
            distance(s, to, dest) !== 5 ||
            distance(s, from, dest) <= distance(s, from, to) ||
            occupied(dest).some((p) => !inside(s, p) || blocked(s, p)) ||
            movementWalls(s, to, to, dest).length ||
            s.tokens.some(
              (t) =>
                t.id !== to.id &&
                occupied(t).some((p) => occupied(dest).some((q) => p.x === q.x && p.y === q.y)),
            )
          )
            throw Error('推撞结算时落点已变化、受阻或被占据，请 GM 重新核对')
        }
        if(c.type==='next'){
          const source=e.actors[e.current],sourceToken=s.tokens.find(t=>t.actorId===source?.id)
          for(const victim of e.actors){const character=world.characters.find(v=>v.id===victim.characterId),r=character?runtimeState(character,cat):null;if(character)character.runtime=r!;const list=r?.effects??victim.npc?.effects??[],token=s.tokens.find(t=>t.actorId===victim.id)
            for(const f of [...list].filter(f=>f.key==='compelled-duel'&&source&&[source.id,source.characterId,source.npcId].includes(f.sourceId))){if(sourceToken&&token){if(distance(s,sourceToken,token)>30){const retained=list.filter(e=>e.id!==f.id);if(character)character.runtime!.effects=retained;else victim.npc!.effects=retained}else if(f.control)f.control.turnKey=e.id+':'+e.tick}}
          }
        }
        combat(s, c)
        const pushOccurred=!pushWasTavern||world.encounters.find(e=>e.id===s.encounterId)?.actors.find(a=>a.id===pushSourceId)?.turn.manualUsed?.includes('tavern-push')
        if(pushOccurred)for(const pushed of attackPushes){const token=s.tokens.find(t=>t.actorId===pushed.targetId);if(token){
          const path=directPath(token,pushed).map(p=>({...p,height:token.spatial?.height??0}))
          magicCrossing(world,a,s,tokenPoint(token),{...tokenPoint(token),x:pushed.x+token.span/2,y:pushed.y+token.span/2},terrainEntityId(token),{forced:true})
          prepareTerrainRoute(world,a,s,token,path,'map',true,undefined,true)
          token.x=pushed.x;token.y=pushed.y;token.groundTrail=[];const budget=explorationMember(a,token.id);if(budget)budget.trail=[];const actor=world.encounters.find(e=>e.id===s.encounterId)?.actors.find(a=>a.id===pushed.targetId);if(actor)actor.turn.groundTrail=[]}}
        if (pushed?.to) {
          const token = s.tokens.find((t) => t.actorId === pushed.targetId)
          if (token) {
            token.x = pushed.to.x
            token.y = pushed.to.y
            token.groundTrail = []
            const budget = explorationMember(a, token.id)
            if (budget) budget.trail = []
            const movedActor = world.encounters
              .find((e) => e.id === s.encounterId)
              ?.actors.find((a) => a.id === pushed.targetId)
            if (movedActor) movedActor.turn.groundTrail = []
          }
        }
        const updated = world.encounters.find((e) => e.id === s.encounterId)!
        if((c.type==='cast'||c.type==='npc-ability')&&updated.pending?.spellId==='zone-of-truth'&&s.template&&command.options?.area!==false){if(!['sphere','circle','cylinder'].includes(s.template.shape)||s.template.size!==15)throw Error('诚实之域须使用半径15尺球形范围');updated.pending.controlRegion={sceneId:s.id,template:clone(s.template)}}
        if(c.type==='next'){const token=s.tokens.find(t=>t.actorId===updated.actors[updated.current]?.id);if(token)refreshTruthZones(world,a,s,token,[token],cat,dice,true)}

        if (c.type === 'surge-npc' && c.destination) {
          const spawned = updated.actors.find(
              (actor) =>
                actor.companion?.ownerId === c.actorId && actor.companion.surgeId === c.surgeId,
            ),
            token = s.tokens.find((t) => t.actorId === spawned?.id)
          if (token) {
            Object.assign(token, c.destination)
            token.groundTrail = []
          }
        }
        if (c.type === 'cast' && s.template && command.options?.area !== false) {
          const spellId = runtimeSpells(
            world.characters.find((char) => char.id === c.actorId)!,
            cat,
          ).find((g) => g.key === c.key)?.spell.id
          if (spellId && isZoneSpell(spellId)) {
            const z = updated.zones
              ?.slice()
              .reverse()
              .find((z) => z.sourceId === c.actorId && z.spellId === spellId)
            if (z) z.template = clone(s.template)
            if(updated.pending?.zoneCreation)updated.pending.zoneCreation.template=clone(s.template)
          }
        }
        if (c.type === 'zone-move' && s.template) {
          const z = updated.zones?.find((z) => z.id === c.zoneId)
          if (z) {
            if (command.options?.area === false) delete z.template
            else z.template = clone(s.template)
            z.note += '；移动裁定：' + c.note
          }
        }
        detail =
          world.encounters.find((e) => e.id === s.encounterId)!.log.at(-1)?.detail ?? '战斗操作'
        if (openingRequest) openingRequest.openingStatus = 'executed'
        break
      }
      case 'interact': {
        if(command.requestItemRuling&&!command.bypassItems)throw Error('此操作须先提交GM物品裁定，不能直接执行')
        const s = scene(command.sceneId)
        live(s)
        const p = s.points.find((p) => p.id === command.pointId)
        if (!p?.enabled) throw Error('互动点不存在／未启用')
        const revisitingContainer = p.kind === 'chest' && ['open','resolved'].includes(p.state)
        const person=pointInteractor(world,a,s,command.characterId,command.npcId,cat,dice), token=person.token
        const activeMagicLock=a.sceneEffects?.regions.find(e=>e.status==='active'&&e.spellId==='arcane-lock'&&e.magic?.pointId===p.id&&(e.magic.suppressedUntil??0)<=(world.characters.find(c=>c.id===e.clockSourceId)?.runtime?.hours??e.createdHour))
        if(activeMagicLock&&!activeMagicLock.magic!.allowedIds.includes(person.characterId??command.npcId??'')&&activeMagicLock.sourceId!==(person.characterId??command.npcId))throw Error('秘法锁仍有效，普通钥匙／开锁检定不能绕过；须获准、说出口令、敲击术或解除魔法')
        const itemPlan=pointItemPlan(revisitingContainer ? {...p,itemUse:undefined,consume:null,resource:null,check:null} : p,person.quantity,command.itemIds,command.confirmItemCosts,command.bypassItems,command.itemLimits)
        if(command.bypassItems && !command.reason.trim()) throw Error('覆盖物品条件必须填写GM裁定理由')
        if (p.kind==='door' && p.state==='locked' && !itemPlan.open && (!p.check || command.operation!=='check')) throw Error('门已锁定，请使用匹配物品或执行已配置解锁检定')
        if (command.gm) requireReason(command.reason)
        const interactionPosition=p.kind==='door'?doorInteractionPosition(s,p,token):p
        if (!command.gm && distance(s, token, interactionPosition) > p.range)
          throw new Error('距离超过互动范围，请先靠近')
        if (
          !command.gm &&
          !sightLine(
            { ...s, walls: (s.walls ?? []).filter((w) => w.pointId !== p.id) },
            token,
            interactionPosition,
            'blocksTargeting',
          ).clear
        )
          throw new Error('互动路线被实体墙门阻挡；请绕行或由 GM 调整')
        if (p.kind !== 'door' && ['resolved', 'disarmed'].includes(p.state) && !(p.kind==='chest' && p.state==='resolved' && p.repeatAccess!==false))
          throw new Error('此互动点已完成，GM 可在编辑中明确重置')
        if(revisitingContainer && command.operation==='use') { detail=person.name+'查看容器 '+p.name; break }
        const e = world.encounters.find((e) => e.id === s.encounterId)
        if(world.encounters.some(other=>other.phase==='active' && other.id!==e?.id && other.actors.some(t=>t.characterId && t.characterId===person.characterId))) throw Error('人物正在其他遭遇中')
        if (e?.phase === 'active') {
          const actor = e.actors.find((t) => t.id === person.actorId)
          if (!actor) throw new Error('人物未加入遭遇')
          combat(s, { type: 'interact', actorId: actor.id, cost: p.cost, note: p.name })
        } else if (!command.gm) {
          const budget = explorationMember(a, token.id)
          if (a.exploration?.status === 'active' && !budget)
            throw Error('该角色未加入探索名单，请 GM 更新名单或收尾')
          if (budget) {
            assertExplorationReady(world, a, budget, cat)
            if (p.cost !== 'free') explorationSpend(budget, p.cost)
            else explorationSpend(budget, budget.interaction ? 'interaction' : 'action')
            a.exploration!.acted = true
            budget.trail = []
          }
        }
        for(const row of itemPlan.attempt) person.remove(row.itemId,row.quantity)
        if(p.consume && !revisitingContainer) person.remove(p.consume.itemId,p.consume.quantity)
        if(p.resource && !revisitingContainer) person.resource(p.resource.id,p.resource.amount)
        let success = true,
          checkNote = ''
        if (command.operation === 'check' && !itemPlan.open) {
          if (!p.check) throw new Error('尚未配置检定')
          const result=person.check(p.check)
          interactionCheck=result
          success=result.success
          checkNote=`；判定总值 ${result.total} / DC ${p.check.dc}，${success?'成功':'失败'}`
        } else if (p.check && ['locked','ready'].includes(p.state) && !itemPlan.open) throw Error('请先执行配置的判定；GM可明确编辑已处理状态')
        if (p.assistedReview?.enabled && p.kind === 'clue')
          p.revealed = success ? p.assistedReview.successText : p.assistedReview.failureText
        if (success) {
          for(const row of itemPlan.success) person.remove(row.itemId,row.quantity)
          if (p.kind === 'exit') {
            if (!p.targetSceneId) throw new Error('请先配置目标场景')
            enter(
              scene(p.targetSceneId),
              p.landing,
              p.portal?.targetPointId
                ? scene(p.targetSceneId).points.find((q) => q.id === p.portal!.targetPointId)
                : undefined,
            )
          } else if (command.operation === 'claim') {
            if (p.kind !== 'chest') throw new Error('只有宝箱可以领取')
            if (!p.loot.length && !p.coins && !p.containerInventory?.length) throw new Error('宝箱已无可领取内容')
            if(p.state!=='open' && !(p.state==='resolved' && p.repeatAccess!==false)) throw Error('请先打开容器，再单独领取')
            if (p.containerInventory?.length && !world.characters.some(c => c.id === person.characterId)) throw Error('含实例物品的容器须由角色领取')
            person.grant(p.loot,p.coins)
            if (p.containerInventory?.length) {
              const receiver = world.characters.find(c => c.id === person.characterId)!
              receiver.inventory.push(...clone(p.containerInventory).map(row => ({ ...row, equipped: false, containerId: null, equipmentSlot: null, grip: null })))
              validateInventory(receiver, cat)
              receiver.revision++
              receiver.updatedAt = new Date().toISOString()
              p.containerInventory = []
            }
            p.loot = []
            p.coins = 0
            p.state = p.repeatAccess===false ? 'resolved' : 'open'
          } else if (p.kind === 'door'){
            const next=command.operation === 'toggle' && p.state === 'open' ? 'closed' : 'open'
            if(next==='closed')assertDoorClear(s,p.id)
            p.state=next
          }
          else if (p.kind === 'chest') p.state = 'open'
          else p.state = p.kind === 'trap' ? 'disarmed' : 'resolved'
          if(!revisitingContainer && command.operation!=='claim')for(const device of a.sceneEffects?.regions??[])if(device.magic?.pointId===p.id||device.anchor.id===p.id)triggerDevice(world,a,s,device,token,'open',crypto.randomUUID(),cat,dice)
          p.hidden = false
          if (
            p.battlePresetId &&
            command.operation !== 'claim' &&
            ['open', 'resolved', 'disarmed'].includes(p.state) &&
            before.adventure.scenes
              .find((old) => old.id === s.id)
              ?.points.find((old) => old.id === p.id)?.state !== p.state
          ) {
            const preset = battleState(a).presets.find((preset) => preset.id === p.battlePresetId)
            if (!preset || preset.sceneId !== s.id)
              throw Error('互动点绑定的战斗预设不存在，请由 GM 更新')
            applyBattleCommand(
              world,
              a,
              {
                type: 'battle-request',
                sceneId: s.id,
                name: preset.name,
                reason: '互动成功：' + p.name,
                source: 'point',
                sourceId: p.id,
                characterId: person.characterId,
                presetId: preset.id,
              },
              cat,
              broadcastActionId,
            )
          }
        }
        detail = `${person.name}与 ${p.name}互动${checkNote}${command.gm ? '；GM 距离覆盖：' + command.reason : ''}${command.bypassItems ? '；GM物品条件覆盖：'+command.reason : ''}${checkpoint ? '；进入场景并建立存档' : ''}`
        break
      }
      case 'undo': {
        const event = [...a.log].reverse().find((e) => e.before && !e.undone)
        if (!event?.before) throw new Error('没有可撤销的地图操作')
        if (adventureStamp(a, world, event.before) !== event.stamp)
          throw new Error('相关角色、遭遇或规则包已在地图外改变，不能覆盖新状态')
        restoreSnapshot(world, a, event.before)
        event.undone = true
        detail = '撤销整笔：' + event.detail
        noUndo = true
        break
      }
      case 'restore': {
        if (pending()) throw new Error('请先处理待结算行动')
        const cp = a.checkpoints.find((c) => c.id === command.checkpointId)
        if (!cp) throw new Error('存档点不存在')
        restoreSnapshot(world, a, cp.snapshot)
        a.log.forEach((e) => (e.before = null))
        detail = '整体恢复入场存档：' + cp.name
        noUndo = true
        break
      }
      case 'checkpoint-edit': {
        const cp = a.checkpoints.find((c) => c.id === command.checkpointId)
        if (!cp) throw new Error('存档点不存在')
        if (command.pinned && !cp.pinned && a.checkpoints.filter((c) => c.pinned).length >= 10)
          throw new Error('最多手动保留 10 个点，请取消旧点保留或导出')
        cp.name = command.name.trim() || cp.name
        cp.pinned = command.pinned
        detail = '修改存档点保留与名称'
        noUndo = true
        break
      }
      case 'checkpoint-delete':
        a.checkpoints = a.checkpoints.filter((c) => c.id !== command.checkpointId)
        detail = '删除指定存档点'
        noUndo = true
        break
    }
  // Protection requires staying nearby. Leaving ends that source's ongoing protection.
  for (const scene of a.scenes) {
    const encounter = world.encounters.find((e) => e.id === scene.encounterId)
    if (encounter?.phase !== 'active') continue
    for (const actor of encounter.actors) {
      const target = scene.tokens.find((t) => t.actorId === actor.id),
        character = world.characters.find((c) => c.id === actor.characterId),
        list = character?.runtime?.effects ?? actor.npc?.effects
      if (!target || !list) continue
      const keep = list.filter((effect) => {
        if (effect.key !== 'protection' || effect.encounterId !== encounter.id) return true
        const from = scene.tokens.find((t) => t.actorId === effect.sourceId)
        return !from || distance(scene, from, target) <= 5
      })
      if (character?.runtime) character.runtime.effects = keep
      else if (actor.npc) actor.npc.effects = keep
    }
  }
  reconcileWorld(world)
  reconcileM3World(world,cat,dice)
  reconcileSceneEffects(world)
  a.revision++
  if (
    [
      'npc-profile',
      'npc-delete',
      'enter',
      'encounter-create',
      'encounter-link',
      'encounter-unlink',
    ].includes(command.type)
  )
    syncNpcTokens(a, world, command.type === 'npc-profile' ? command.profile.id : undefined)
  collectMapBroadcasts(input, world, a, command, broadcastActionId, interactionCheck)
  recordM1Deaths(world,input)
  syncNpcLifeTokens(world)
  reconcileMapGrapples(world, cat)
  processPointLinks(world, a, broadcastActionId, cat)
  processPointArrivals(world, a, broadcastActionId, cat)
  if (command.type !== 'restore' && command.type !== 'undo') {
    const oldIds = new Set(
      input.adventures.find((old) => old.id === a.id)?.broadcastLog?.events.map((e) => e.id) ?? [],
    )
    collectQuestSuggestions(
      a,
      (a.broadcastLog?.events ?? []).filter((e) => !oldIds.has(e.id)),
    )
  }
  const branchChanged =
    a.broadcastLog?.branchId !==
    input.adventures.find((old) => old.id === a.id)?.broadcastLog?.branchId
  if(branchChanged)rebaseTerrainBranch(a,a.broadcastLog?.branchId??'legacy')
  if (branchChanged)
    for (const q of a.quests ?? [])
      for (const r of q.stepSuggestions ?? []) r.branchId = a.broadcastLog?.branchId ?? 'legacy'
  if (branchChanged)
    for (const s of a.scenes)
      for (const record of [
        ...(s.discoveryAttempts ?? []),
        ...(s.pausedRoutes ?? []),
        ...(s.linkRuns ?? []),
      ])
        record.branchId = a.broadcastLog?.branchId ?? 'legacy'
  if (
    command.type !== 'gm-relocate' &&
    !(command.type === 'move' && command.gm) &&
    !['restore', 'undo', 'discovery-reset'].includes(command.type)
  ) {
    const active = a.scenes.find((s) => s.id === a.activeSceneId)
    if (active) queueCurrentDiscoveries(world, a, active, cat)
  }
  validateBroadcasts(a, world)
  validateAdventureAi(a, world, cat)
  stripUndo(world, a)
  if (world.encounters.filter((e) => e.phase === 'active').length > 1)
    throw new Error('本地同时只能运行一个遭遇')
  validateAdventure(a, world, cat)
  for (const c of world.characters.filter((c) => relatedIds(a, world).has(c.id))) {
    validateInventory(c, cat)
    validateRuntimeArchive(c, cat)
  }
  if (checkpoint) {
    a.checkpoints.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      name: scene(a.activeSceneId!).name + ' · 入场',
      sceneId: a.activeSceneId!,
      pinned: false,
      snapshot: adventureSnapshot(a, world),
    })
    const auto = a.checkpoints
      .filter((c) => !c.pinned)
      .slice(-5)
      .map((c) => c.id)
    a.checkpoints = a.checkpoints.filter((c) => c.pinned || auto.includes(c.id))
  }
  if (command.type === 'checkpoint-edit') {
    const auto = a.checkpoints
      .filter((c) => !c.pinned)
      .slice(-5)
      .map((c) => c.id)
    a.checkpoints = a.checkpoints.filter((c) => c.pinned || auto.includes(c.id))
  }
  if (noUndo && command.type !== 'restore') {
    const previous = [...a.log].reverse().find((e) => e.before && !e.undone)
    if (previous) previous.stamp = adventureStamp(a, world, previous.before!)
  }
  if(['enter','interact','explore','combat'].includes(command.type))for(const s of a.scenes)if(enclosedMode(s)){
    const entryIds=s.tokens.filter(t=>{const old=before.adventure.scenes.find(scene=>scene.id===s.id)?.tokens.find(old=>old.id===t.id);return !old||old.x!==t.x||old.y!==t.y}).map(t=>t.id)
    recordFog(world,a,s,[],{entry:true,entryIds,sourceEventId:broadcastActionId})
  }
  a.log.push({
    id: broadcastActionId,
    at: new Date().toISOString(),
    detail,
    before: noUndo ? null : before,
    stamp: adventureStamp(a, world, noUndo ? undefined : before),
    undone: false,
  })
  a.log = a.log.slice(-50)
  const retained = a.log.filter((e) => e.before)
  while (retained.length > 12 || JSON.stringify(a.log).length > 6 * 1024 * 1024) {
    const first = retained.shift()
    if (!first) break
    first.before = null
  }
  if (JSON.stringify(a.checkpoints).length > 24 * 1024 * 1024)
    throw new Error('存档点总量超过 24 MB，请导出并删除部分点后重试')
  steedLifeBond(world,a,input,inputCommand,cat)
  return world
}
import { validateQuests } from './quests'
import { validateGrowthGuide } from './script-design'
