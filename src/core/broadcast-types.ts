export const BROADCAST_CATEGORIES = [
  'preset',
  'trigger',
  'resolution',
  'interaction',
  'combat',
  'progress',
] as const
export type BroadcastCategory = (typeof BROADCAST_CATEGORIES)[number]
export type NarrationPolicy = 'direct' | 'generate' | 'context'
export interface BroadcastAudience {
  kind: 'public' | 'party' | 'personal' | 'gm'
  characterIds: string[]
}
export interface BroadcastTemplate {
  narration?: NarrationPolicy
  id: string
  title: string
  text: string
  enabled: boolean
  trigger: 'manual' | 'story' | 'scene' | 'point' | 'region' | 'wall' | 'event'
  eventType?: string
  result?: 'any' | 'success' | 'failure'
  sceneId: string | null
  targetId: string | null
  policy: 'manual' | 'once' | 'always' | 'cooldown'
  cooldownSeconds: number
  audience: BroadcastAudience
}
export interface BroadcastSettings {
  templates: BroadcastTemplate[]
  played: { templateId: string; count: number; lastAt: string }[]
  storyStarted: boolean
}
export interface BroadcastEvent {
  message?: import('../shared/localization/system-messages').LocalizedMessage
  fogKnowledge?: { witnesses:string[]; names:{name:string;aliases:string[];knownTo:string[]}[] }
  /** Private transaction-time evidence; never projected to players or external bots. */
  npcWitnesses?: { npcId: string; entityIds: string[] }[]
  perceivedBy?: string[]
  narration?: NarrationPolicy
  version: 1
  id: string
  roomId: string | null
  branchId: string
  sequence: number
  actionId: string
  causeId: string | null
  worldRevision: number
  at: string
  category: BroadcastCategory
  type: string
  phase: 'confirmed' | 'pending' | 'correction'
  sceneId: string | null
  title: string
  text: string
  facts: Record<string, string | number | boolean | null>
  audience: BroadcastAudience
  supersedes: string[]
}
export interface BroadcastJournal {
  version: 1
  branchId: string
  nextSequence: number
  events: BroadcastEvent[]
}
export type BroadcastCommand =
  | { type: 'broadcast-template'; template: BroadcastTemplate }
  | { type: 'broadcast-delete'; templateId: string }
  | { type: 'broadcast-reset'; templateId: string }
  | { type: 'broadcast-play'; templateId: string; replay: boolean }
  | { type: 'broadcast-start' }
  | { type: 'broadcast-mark'; title: string; text: string; audience: BroadcastAudience }
export interface BroadcastFeed {
  branchId: string
  head: number
  earliest: number
  cursor: number
  gap: boolean
  events: BroadcastEvent[]
}
