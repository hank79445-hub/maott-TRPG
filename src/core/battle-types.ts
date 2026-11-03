import type { Character } from './types'
import type { Encounter, Combatant, DamageType } from './combat-types'
import type { AdventureSnapshot, Checkpoint } from './map-types'

export interface BattleParticipant {
  kind: 'character' | 'npc' | 'token'
  id: string
  side: Combatant['side']
  initiative?: number
}
export interface BattlePreset {
  practical?: {enabled:boolean;autoStart:boolean;finish:'manual'|'enemy-unconscious'|'enemy-dead';entry?:{npcId:string;mode:'fixed'|'judge'|'exclude';allowedSides:Combatant['side'][]}[]}
  id: string
  sceneId: string
  name: string
  participants: BattleParticipant[]
  intro: string
}
export type BattleOpening =
  | { kind: 'attack'; attackId: string; tokenIds: string[]; sneak: boolean; mastery: boolean }
  | {
      kind: 'cast'
      supportChoice?: string
  controlChoices?:Record<string,string>
  controlTargets?:string[]
  controlText?:string
      willing?: boolean
      key: string
      mode: string
      tokenIds: string[]
      damageType: DamageType
      weaponId?: string
      hitDice?: number
      summonForm?: string
      ammunition?: { instanceId: string; count: number }
    }
  | { kind: 'item'; instanceId: string; tokenIds: string[]; note: string }
export interface BattleRequest {
  opening?: BattleOpening
  openingStatus?: 'waiting' | 'executed' | 'canceled'
  encounterId?: string
  id: string
  sceneId: string
  at: string
  name: string
  reason: string
  source: 'gm' | 'player' | 'npc' | 'point'
  sourceId: string
  characterId: string | null
  presetId: string | null
  status: 'pending' | 'accepted' | 'rejected'
  reviewReason: string
}
export interface BattleHistory {
  branchId?: string
  id: string
  sceneId: string
  name: string
  preparedAt: string
  endedAt: string
  reason: string
  legacy: boolean
  encounter: Encounter
  characters: Character[]
}
export interface BattleState {
  presets: BattlePreset[]
  requests: BattleRequest[]
  history: BattleHistory[]
}
export interface BattleTestPoint {
  id: string
  battleId: string
  sceneId: string
  name: string
  at: string
  snapshot: AdventureSnapshot
  checkpoints?: Checkpoint[]
}
export type BattleMapCommand =
  | {
      type: 'battle-prepare'
      sceneId: string
      name: string
      participants: BattleParticipant[]
      presetId?: string
    }
  | { type: 'battle-finish'; sceneId: string; reason: string }
  | { type: 'battle-cancel'; sceneId: string; reason: string }
  | {
      type: 'battle-reinforce'
      sceneId: string
      participants: BattleParticipant[]
      reason: string
      requestId?: string
    }
  | { type: 'battle-reset'; confirmed: boolean; reason: string }
  | { type: 'battle-preset'; preset: BattlePreset }
  | { type: 'battle-preset-delete'; presetId: string }
  | {
      type: 'battle-request'
      sceneId: string
      name: string
      reason: string
      source: BattleRequest['source']
      sourceId: string
      characterId: string | null
      presetId?: string
      opening?: BattleOpening
    }
  | {
      type: 'battle-request-review'
      requestId: string
      name?: string
      approve: boolean
      reason: string
      participants: BattleParticipant[]
    }
