import type { AdventureAi, AiJournal, AiMapCommand } from './ai-types'
import type { BattleState, BattleTestPoint, BattleMapCommand } from './battle-types'
import type { CombatNpc } from './combat-types'
import type { BroadcastSettings, BroadcastJournal, BroadcastCommand } from './broadcast-types'
import type { Character, Pack } from './types'
import type { CombatCommand, Encounter, Environment } from './combat-types'

export const TERRAIN = ['high', 'difficult', 'blocked', 'danger', 'entry'] as const
export type Terrain = (typeof TERRAIN)[number]
export const TERRAIN_NAMES: Record<Terrain, string> = {
  high: '高点',
  difficult: '困难地形',
  blocked: '禁止通行',
  danger: '危险区域',
  entry: '入口',
}
export interface Position {
  x: number
  y: number
}
/** Endpoints use grid vertices (not pixel coordinates or cell centers). */
export interface MapWall {
  heightFeet?:number
  gapFeet?:number
  id: string
  name: string
  a: Position
  b: Position
  kind: 'wall' | 'door'
  state: 'closed' | 'open' | 'locked'
  pointId: string | null
  blocksMovement: boolean
  blocksSight: boolean
  blocksLight?: boolean
  blocksSound?: boolean
  blocksTargeting: boolean
  cover?: 'none' | 'half' | 'three-quarters' | 'total'
  hidden: boolean
  color: string
}
export interface MapRegion {
  jumpable?: boolean
  id: string
  name: string
  cells: string[]
  tags: Terrain[]
  color: string
  height: number | null
  hidden: boolean
  note: string
}
export interface MapToken extends Position {
  baseSpan?:number
  effectiveSize?:import('./m3-spatial').CreatureSize
  initialSpatialHeight?:number
  initialSupportId?:string
  spatial?: import('./m3-spatial').SpatialState
  groundTrail?: Position[]
  npcBody?: CombatNpc
  npcSourceActorId?: string
  riderTokenId?:string
  companionKey?: string
  npcId?: string
  id: string
  characterId: string | null
  actorId: string | null
  name: string
  span: number
  hidden: boolean
  color: string
  facing: number
}
export interface MapPoint extends Position {
  repeatAccess?: boolean
  containerInventory?: import('./types').InventoryItem[]
  itemUse?: import('../persistence/point-items-schema').PointItems
  discovery?: import('zod').infer<
    typeof import('../persistence/point-discovery-schema').pointDiscoverySchema
  >
  containerDesign?: { emptyReason?: string; gmNote?: string }
  assistedReview?: import('../persistence/gm-review-schema').PointReview

  appearance?: import('../persistence/scene-art-schema').PointAppearance
  failureArrivalGroupIds?: string[]
  arrivalGroupIds?: string[]
  storyResults?: {
    id: string
    type: 'rescued' | 'aided' | 'danger' | 'goal'
    npcId: string
    outcome: 'success' | 'failure'
    text: string
    requiresGM: boolean
  }[]
  battlePresetId?: string | null
  id: string
  editorColor?: string
  kind: 'door' | 'chest' | 'trap' | 'clue' | 'exit'
  name: string
  note: string
  revealed: string
  hidden: boolean
  enabled: boolean
  state: 'ready' | 'locked' | 'open' | 'closed' | 'resolved' | 'disarmed'
  range: number
  check: { kind: 'skill' | 'save'; id: string; dc: number } | null
  loot: { itemId: string; quantity: number }[]
  coins: number
  consume: { itemId: string; quantity: number } | null
  resource: { id: string; amount: number } | null
  targetSceneId: string | null
  portal?: {
    targetPointId: string | null
    bidirectional: boolean
    arrival?: { anchor: Position; cells: string[]; relative: boolean; facing?: number }
  }
  landing: Position
  cost: 'free' | 'action' | 'bonus'
}
export interface MapTemplate extends Position {
  originRule?: 'face' | 'center'
  shape: 'circle' | 'cone' | 'line' | 'square' | 'sphere' | 'cube' | 'cylinder' | 'emanation'
  size: number
  angle: number
  width: number
  origin?: Position
  originSpan?: number
  includeOrigin?: boolean
  propagation?: 'straight' | 'manual'
  note?: string
}
export interface MapAnnotation extends Position {
  id: string
  name: string
  note: string
  color: string
  fontSize: number
  offsetX: number
  offsetY: number
  hidden: boolean
}
export interface MapScene {
  fog?: import('../persistence/fog-schema').FogPolicy
  effectSetup?:import('../persistence/scene-initial-schema').InitialSceneEffects
  spatialSetup?:import('../persistence/m3-initial-schema').InitialSpatial
  discoveryAttempts?: import('../persistence/point-discovery-schema').DiscoveryAttempt[]
  pausedRoutes?: import('../persistence/point-discovery-schema').PausedRoute[]
  pointLinks?: import('../persistence/point-link-schema').PointLink[]
  linkRuns?: import('../persistence/point-link-schema').PointLinkRun[]
  defeatedTokens?: MapToken[]
  environment?: 'outdoor' | 'indoor' | 'mixed'
  boundaryWalls?: 'explicit-only' | 'auto-enclose'
  artCalibration?: { status: 'pending'; mode: 'approximate' | 'free' }
  art?: import('../persistence/scene-art-schema').SceneArtBrief
  arrivalGroups?: import('./scene-tools-types').ArrivalGroup[]
  groundItems?: import('./scene-tools-types').GroundItem[]
  id: string
  name: string
  note: string
  grid: {
    columns: number
    rows: number
    feet: number
    cellPixels?: number
    originX: number
    originY: number
    offsetX?: number
    offsetY?: number
    strokeWidth?: number
    locked?: boolean
    color: string
    opacity: number
    show: boolean
  }
  background: {
    assetId: string
    x: number
    y: number
    width: number
    height: number
    rotation: number
    locked: boolean
    clip: boolean
  } | null
  regions: MapRegion[]
  tokens: MapToken[]
  points: MapPoint[]
  annotations?: MapAnnotation[]
  walls?: MapWall[]
  encounterId: string | null
  template: MapTemplate | null
  highGround: { enabled: boolean; weapon: boolean; thrown: boolean; spell: boolean }
}
export interface AdventureState {
  openingPresentation?: import('../persistence/opening-reading-schema').OpeningPresentation
  trades?: import('../persistence/trade-schema').TradeState
  fogState?: import('../persistence/fog-schema').FogState
  summons?:import('../persistence/summon-schema').SummonState
  gmSpellClock?:{hours:number;samples:Record<string,number>}
  gmSpellFacts?:import('../persistence/gm-spell-choice-schema').GmSpellFact[]
  sceneEffects?:import('../persistence/scene-effects-schema').SceneEffects
  m3?:import('../persistence/m3-world-schema').M3WorldState
  m1Utility?: import('./m1-utility-types').M1UtilityState
  gmControls?: import('./gm-control-types').GmControl[]
  gmSpellRequests?: import('./spell-workflow-types').GmSpellRequest[]
  growthGuide?: import('../persistence/script-design-schema').GrowthGuide
  quests?: import('../persistence/quest-schema').Quest[]
  exploration?: import('./exploration-types').ExplorationState
  sourceScript?: {
    scriptId: string
    versionId: string
    authorVersion: string
    startSceneId?: string
    landing?: Position
  }
  battles?: BattleState
  ai?: AdventureAi
  broadcast?: BroadcastSettings
  broadcastCursor?: number
  id: string
  version: 1
  name: string
  revision: number
  party: string[]
  activeSceneId: string | null
  scenes: MapScene[]
}
export interface AdventureSnapshot {
  adventure: AdventureState
  characters: Character[]
  encounters: Encounter[]
  packs: Pack[]
}
export interface MapEvent {
  id: string
  at: string
  detail: string
  before: AdventureSnapshot | null
  stamp: string
  undone: boolean
}
export interface Checkpoint {
  id: string
  at: string
  name: string
  sceneId: string
  pinned: boolean
  snapshot: AdventureSnapshot
}
export interface Adventure extends AdventureState {
  contentLocale?: import('../shared/localization/locale').Locale
  designNotebook?: import('zod').infer<typeof import('../persistence/authoring-stage-schema').authoringNotebookSchema>
  testBattle?: BattleTestPoint
  aiLog?: AiJournal
  broadcastLog?: BroadcastJournal
  log: MapEvent[]
  checkpoints: Checkpoint[]
}
export interface MapImage {
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
  blob: Blob
}
export interface MapAsset extends MapImage {
  id: string
  name: string
  preview?: MapImage
  importInfo?: {
    sourceName: string
    width: number
    height: number
    bytes: number
    optimized: boolean
  }
}
export interface MapWorld {
  adventures: Adventure[]
  characters: Character[]
  encounters: Encounter[]
  packs: Pack[]
}
export interface MapCombatOptions {
  distance: boolean
  highGround: boolean
  obstacles?: boolean
  cover?: boolean
  area?: boolean
  template?: MapTemplate
  reason: string
}
export type MapCommand =
  | { type: 'discovery-check'; sceneId: string; attemptId: string }
  | { type: 'discovery-continue' | 'discovery-cancel-route'; sceneId: string; routeId: string }
  | { type: 'discovery-reset'; sceneId: string; pointId: string; characterId?: string }
  | { type: 'point-link-retry'; sceneId: string; runId: string }
  | import('./scene-tools-types').SceneToolCommand
  | import('../persistence/npc-config-schema').ConfigImportCommand
  | { type: 'explore'; sceneId: string; command: import('./exploration-types').ExplorationCommand }
  | BattleMapCommand
  | AiMapCommand
  | BroadcastCommand
  | { type: 'scene-add'; name: string }
  | { type: 'party'; ids: string[] }
  | { type: 'leave' }
  | { type: 'scene-edit'; scene: MapScene }
  | { type: 'wall-toggle'; sceneId: string; wallId: string }
  | { type: 'enter'; sceneId: string; landing: Position }
  | {
      type: 'portal-pair'
      sceneId: string
      pointId: string
      targetSceneId: string | null
      targetPointId: string | null
      bidirectional: boolean
    }
  | { type: 'token-add'; sceneId: string; characterId: string; position: Position }
  | { type: 'token-edit'; sceneId: string; token: MapToken }
  | {
      type: 'move'
      sceneId: string
      tokenId: string
      path: Position[]
      gm: boolean
      reason: string
      reactionsConfirmed: boolean
    }
  | {
      type: 'interact'
      npcId?: string
      itemIds?: string[]
      confirmItemCosts?: boolean
      itemLimits?: Record<string,number>
      bypassItems?: boolean
      requestItemRuling?: boolean
      sceneId: string
      pointId: string
      characterId: string
      operation: 'use' | 'toggle' | 'claim' | 'check'
      gm: boolean
      reason: string
    }
  | { type: 'encounter-create'; sceneId: string; name: string }
  | { type: 'encounter-link'; sceneId: string; encounterId: string }
  | { type: 'encounter-unlink'; sceneId: string }
  | {
      type: 'combat'
      sceneId: string
      command: CombatCommand
      options?: MapCombatOptions
      resolutionGuard?: { encounterId: string; pendingId: string; branch: string; tick: number }
      openingRequestId?: string
    }
  | { type: 'undo' }
  | { type: 'restore'; checkpointId: string }
  | { type: 'checkpoint-edit'; checkpointId: string; name: string; pinned: boolean }
  | { type: 'checkpoint-delete'; checkpointId: string }
export type TargetEnvironments = Record<string, Environment>
