import type { RoomMessage } from '../../online/message-types'
export type MessageRow = RoomMessage & { groupStates?: { npcId: string; status: string }[] }
/** Only collapse player inputs; replies and per-NPC history keep their own identity. */
export function groupMessageRows(items: RoomMessage[]): MessageRow[] {
  const rows: MessageRow[] = [],
    groups = new Map<string, MessageRow>()
  for (const message of items) {
    if (message.kind !== 'player' || !message.dialogueGroup) {
      rows.push(message)
      continue
    }
    const key = message.dialogueGroup.id + ':' + message.characterId
    const existing = groups.get(key)
    if (existing) existing.groupStates!.push({ npcId: message.npcId, status: message.status })
    else {
      const row = { ...message, groupStates: [{ npcId: message.npcId, status: message.status }] }
      groups.set(key, row)
      rows.push(row)
    }
  }
  return rows
}
