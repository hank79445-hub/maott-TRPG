import type { DialogueSegment } from '../core/dialogue-segments'
export interface RoomMessage {
  contentLocale?:import('../shared/localization/locale').Locale
  translationFallback?:boolean
  dialogueGroup?: {
    id: string
    mode: 'group' | 'shout'
    recipients: { id: string; name: string }[]
  }
  queueAhead?: number
  id: string
  conversationId: string
  npcId: string
  characterId: string
  at: string
  order: number
  kind: 'player' | 'npc'
  name: string
  portrait?: string | null
  text: string
  segments: DialogueSegment[]
  status: string
  personal: boolean
}
export interface RoomMessages {
  permittedConversationIds: string[]
  directoryStamp: string
  branchId: string
  items: RoomMessage[]
  older: string | null
  gap: boolean
  delivery: 'web' | 'both'
}
export interface MessageNpc {
  groupCharacters?: string[]
  id: string
  name: string
  npcType: 'ordinary' | 'important'
  portrait?: string | null
  illustration?: string | null
  characters: string[]
}
