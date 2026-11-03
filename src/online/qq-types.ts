import type { RoomAction } from './protocol'

/** Private room metadata. Never put platform identities into adventure exports. */
export interface QqRoomState {
  version: 1
  activeBindingId?: string
  activeBindingIds?: string[]
  codes: {
    hash: string
    memberId: string
    bindingId: string
    expires: number
    identity: string
    marker: string
    characterId?: string
  }[]
  identities: {
    id: string
    bindingId: string
    identity: string
    memberId: string
    characterId: string
    revoked: boolean
  }[]
  receipts: { source: string; at: number; response: string; conversationId?: string }[]
  requests: {
    id: string
    identityId: string
    characterId: string
    sceneId: string
    branch: string
    turn: string
    intentId: string
    action: RoomAction
  }[]
  sessions: {
    id: string
    bindingId: string
    npcId: string
    sceneId: string
    branch: string
    participants: { memberId: string; characterId: string }[]
    closed: boolean
  }[]
  contexts: {
    id: string
    npcId: string
    sceneId: string
    branch: string
    characterId: string
    purpose: string
    text: string
  }[]
}
export interface QqMemberView {
  bots?: { key: string; name: string }[]
  enabled: boolean
  gm: boolean
  code?: string
  pending: { marker: string; expires: number }[]
  identity: { id: string; characterId: string } | null
  characters: { id: string; name: string }[]
  identities: { id: string; nickname: string; character: string }[]
  contexts: QqRoomState['contexts']
  sessions: { id: string; npcName: string }[]
  npcs: { id: string; name: string }[]
  sceneId: string
}
