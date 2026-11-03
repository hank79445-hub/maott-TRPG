import type { Position } from './map-types'

export interface ExplorationBudget {
  tokenId: string
  characterId: string | null
  action: boolean
  bonus: boolean
  reaction: boolean
  interaction: boolean
  movement: number
  dash: number
  ended: boolean
  deathSaved: boolean
  slotSpent: boolean
  jumpUsed: boolean
  wind: boolean
  surgeAction: boolean
  surgeUsed: boolean
  endProcessed: boolean
  trail: Position[]
  flags: string[]
}
export interface ExplorationTrigger {
  id: string
  tokenId: string
  sourceId: string
  phase: 'enter' | 'start' | 'end'
  resolved: boolean
  note: string
  encounterId: string
  targetId: string
  turnTokenId: string
}
export interface ExplorationState {
  id: string
  sceneId: string
  status: 'active' | 'paused' | 'closed'
  round: number
  roundId: string
  acted: boolean
  members: ExplorationBudget[]
  retired: ExplorationBudget[]
  clocks: Record<string, number>
  triggers: ExplorationTrigger[]
  effectEndProcessed?: string[]
}
export type ExplorationAction =
  | 'surge'
  | 'dash'
  | 'dodge'
  | 'disengage'
  | 'stand'
  | 'utilize'
  | 'search'
  | 'study'
  | 'influence'
  | 'hide'
  | 'help'
  | 'ready'
  | 'reaction'
  | 'wind'
  | 'wind-focus'
  | 'cunning-dash'
  | 'cunning-disengage'
  | 'cunning-hide'
export type ExplorationCommand =
  | {operation:'control-ruling';wakerTokenId?:string;tokenId:string;effectId:string;kind:'end'|'wake'|'command-complete'|'fear-context'|'illusion-study'|'end-damage'|'illusion-damage'|'truth-presence'|'maintain-crown'|'crown-no-target';sourceVisible:boolean;inside:boolean;confirmed:boolean;note:string}
  | { operation: 'toggle'; enabled: boolean; tokenIds?: string[] }
  | { operation: 'finish'; close: boolean }
  | { operation: 'roster'; tokenIds: string[] }
  | { operation: 'end'; tokenId: string; roundId: string }
  | {
      operation: 'action'
      tokenId: string
      action: ExplorationAction
      note: string
      confirmed: boolean
    }
  | { operation: 'trigger'; triggerId: string; note: string }
  | { operation: 'zone-roll'; triggerId: string; note: string }
  | { operation: 'zone-resolve'; encounterId: string }
  | {
      operation: 'zone-move'
      tokenId: string
      zoneId: string
      to: Position
      note: string
      confirmed: boolean
    }
  | { operation: 'concentration'; tokenId: string }
  | {
      operation: 'spell-cast'
      gmChoice?:import('../persistence/gm-spell-choice-schema').GmSpellChoice
      m3Choice?: import('./m3-spells').M3CastChoice
      dispelZoneId?:string
      dispelDistance?:number
      hitDice?: number
      supportChoice?: string
  controlChoices?:Record<string,string>
  controlTargets?:string[]
  controlText?:string
      willing?: boolean
      template?: import('./map-types').MapTemplate
      tokenId: string
      key: string
      mode: string
      targets: string[]
      confirmed: boolean
      note: string
    }
  | {
      operation: 'jump'
      runup?: boolean
      tokenId: string
      to: Position
      mode: 'normal' | 'magic'
      confirmed: boolean
      note: string
    }
  | {
      operation: 'jump-cast'
      tokenId: string
      key: string
      mode: string
      targets: string[]
      confirmed: boolean
    }
