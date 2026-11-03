import type { RoomCommand } from './protocol'
import type { DieFace, DiceOutcome } from '../core/dice-source'
export interface DiceRecord {
  sourcePendingId?: string
  id: string
  at: string
  sessionId: string
  characterId?: string
  mode: 'automatic' | 'manual' | 'mixed'
  audience: 'public' | 'gm' | 'character'
  label: string
  rolls: DieFace[]
  detail: string
  outcomes?: DiceOutcome[]
}
export interface DicePending {
  id: string
  sessionId: string
  command: RoomCommand
  worldRevision: number
  branchId: string
  rolls: DieFace[]
  sides: number[]
  label: string
  draft: number[]
  at: string
  characterId?: string
  audience: DiceRecord['audience']
  npc?: boolean
  step: number
  contextHash: string
  practicalBasis?: string
  initiatorSessionId?: string
  stale?: boolean
}
export interface RoomDiceState {
  mode: 'automatic' | 'manual'
  pending: DicePending[]
  records: DiceRecord[]
}
export interface RoomDiceView {
  mode: RoomDiceState['mode']
  pending: Omit<DicePending, 'command' | 'rolls' | 'contextHash'|'practicalBasis'>[]
  records: DiceRecord[]
}
