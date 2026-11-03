import type { Room, RoomMember } from '../online/protocol'
import { npcLifeState } from '../core/npc-life-state'

/** Only explicit terminal invalidation is safe to archive. Published prose may still owe an action. */
export function expiredReviews(room: Room, includeArchived = false) {
  const rows: { key: string; label: string }[] = []
  const add = (kind: string, entries: { id: string; status: string }[]) => {
    for (const e of entries)
      if (e.status === 'stale') rows.push({ key: `${kind}:${e.id}:stale`, label: kind })
  }
  add('intent', room.intents)
  add('ai', room.world.adventures[0]?.aiLog?.jobs ?? [])
  const a = room.world.adventures[0]
  for (const job of a?.aiLog?.jobs ?? []) {
    if (
      job.kind !== 'npc' ||
      job.status !== 'published' ||
      !job.checkSuggestion ||
      job.check?.adjudicated
    )
      continue
    const npc = a?.ai?.npcs.find((n) => n.id === job.npcId)
    const member = room.members.find((m) => m.id === job.sessionId && !m.revoked)
    // Hard invalidation only. Lack of current action resources is not expiry.
    if (
      !npc?.enabled ||
      npc.sceneId !== a?.activeSceneId ||
      npc.revision !== job.profileRevision ||
      npcLifeState(room.world, npc).dead ||
      job.branchId !== (a?.broadcastLog?.branchId ?? 'legacy') ||
      !member ||
      (member.role !== 'gm' && !member.characterIds.includes(job.characterId))
    )
      rows.push({ key: `ai:${job.id}:stale`, label: 'ai' })
  }
  add('review', room.gmReview?.jobs ?? [])
  add('practical', room.practicalReview?.tasks ?? [])
  const invalidAi = new Set(rows.filter(r => r.label === 'ai').map(r => r.key.slice(3, -6)))
  for (const task of room.practicalReview?.tasks ?? []) {
    if (['needs-fact', 'needs-gm'].includes(task.status) && invalidAi.has(task.sourceId))
      rows.push({key:`practical:${task.id}:stale`,label:'practical'})
  }
  add('trade', a?.trades?.sessions ?? [])
  return rows.filter((r) => includeArchived || !room.reviewArchive?.includes(r.key))
}
export function archiveExpiredReviews(room: Room, member: RoomMember) {
  if (member.role !== 'gm' || member.revoked) throw Error('仅GM可归档失效审核')
  const rows = expiredReviews(room)
  if ((room.reviewArchive?.length ?? 0) + rows.length > 10000)
    throw Error('审核归档记录达到上限，请先导出归档')
  room.reviewArchive = [...(room.reviewArchive ?? []), ...rows.map((r) => r.key)]
  return rows.length
}
