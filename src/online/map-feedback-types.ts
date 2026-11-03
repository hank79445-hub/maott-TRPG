/** Presentation-only, server-projected confirmed facts; never a rule command or model input. */
export type MapFeedbackKind =
  | 'hit'
  | 'miss'
  | 'damage'
  | 'heal'
  | 'health'
  | 'shield'
  | 'condition'
  | 'interaction'
  | 'arrival'
  | 'appearance'
  | 'departure'
  | 'death'
  | 'move'
  | 'region'
export interface FeedbackPoint {
  x: number
  y: number
}
export interface MapFeedback {
  id: string
  roomId: string
  branchId: string
  sceneId: string
  sequence: number
  at: string
  kind: MapFeedbackKind
  anchor: FeedbackPoint
  source?: FeedbackPoint
  title: string
  amount?: number
  critical?: boolean
  tokenId?: string
  own: boolean
}
export interface MapFeedbackFeed {
  roomId: string
  branchId: string
  head: number
  earliest: number
  events: MapFeedback[]
  invalidated?: string[]
}
export interface RoomMapFeedback {
  branchId: string
  nextSequence: number
  events: (MapFeedback & { memberId: string; gmOnly: boolean })[]
}
