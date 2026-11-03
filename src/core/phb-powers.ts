import type {Character} from './types'
export interface RulePower {
  id: string
  name: string
  detail: string
  cost: 'action' | 'bonus' | 'reaction' | 'none'
  resource?: string
  amount: number
  timing:
    | 'normal'
    | 'before-roll'
    | 'hit'
    | 'miss'
    | 'damage'
    | 'turn-start'
    | 'rest'
    | 'after-spell'
    | 'check'
  once?: boolean
  range: number
  duration: number
  kind: 'manual' | 'heal' | 'temporary' | 'save' | 'buff'
  formula?: string
  modifier?: number
  type?: string
  save?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  dc?: number
  condition?: string
  half?: boolean
  self?: boolean
}

/** Optional non-SRD features are not present in this edition. SRD features use native class handlers. */
export const MANEUVERS:{id:string;name:string;detail:string}[]=[]
export function rulePowers(_c:Character):RulePower[]{return []}
export function advancedResources(_c:Character):{id:string;name:string;max:number;short:'all'|'one'|'none';page:number;detail:string}[]{return []}
