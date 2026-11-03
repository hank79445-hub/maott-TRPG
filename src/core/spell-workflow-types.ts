import type { BroadcastAudience } from './broadcast-types'
export interface GmSpellRequest {
  sourceKind?:'character'|'npc'
  sourceNpcId?:string
  clockSourceId?:string
  restKey?:string
  choice?:import('../persistence/gm-spell-choice-schema').GmSpellChoice
  contextKey?:string
  dc?:number
  observations?:import('zod').infer<typeof import('../persistence/gm-spell-choice-schema').gmSpellObservationSchema>[]
  ongoing?:import('zod').infer<typeof import('../persistence/gm-spell-choice-schema').gmSpellOngoingSchema>
  ruleChecks?:string[]
  id: string
  castId: string
  spellId: string
  name: string
  sceneId: string
  characterId: string
  targetIds: string[]
  encounterId?: string
  pendingId?: string
  slotLevel: number
  question: string
  questionIndex: number
  createdAt: string
  castHour: number
  endsAt: number | null
  concentration: boolean
  status: 'pending' | 'published' | 'canceled'
  uncertaintyChance?: number
  uncertaintyRoll?: number
  noResult?: boolean
  result?: {
    text: string
    privateNote: string
    audience: BroadcastAudience
    eventId: string
  }
}
