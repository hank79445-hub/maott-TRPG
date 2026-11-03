/** GM-only, compact local transport metadata. No text, platform identities or credentials. */
export interface RoomQqSummary {
  enabled: boolean
  boundBots: number
  expectedBots?: number
  connectedBots: number
  pausedBots: number
  queued: number
  failed: number
  unknown: number
  players: number
  pairedPlayers: number
  fullyPairedPlayers: number
  checkedAt: string
}
export interface RoomStatusItem {
  id: string
  title: string
  detail: string
  target: string
  count: number | null
  tone: 'normal' | 'waiting' | 'error'
}
