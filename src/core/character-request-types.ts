import type { z } from 'zod'
import type { archiveSchema } from '../persistence/schema'

export type CharacterArchive = z.infer<typeof archiveSchema>
export interface CharacterRequestSummary {
  name: string
  level: number
  classId: string
  speciesId: string
  purpose: string
  custom: boolean
  packs: { id: string; version: string }[]
  hp: number | null
  conditions: string[]
  inventoryCount: number
}
export interface CharacterRequest {
  id: string
  sessionId: string
  sourceId: string
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  at: string
  reason: string
  summary: CharacterRequestSummary
  archive?: CharacterArchive
  characterId?: string
  resetRuntime?: boolean
}
