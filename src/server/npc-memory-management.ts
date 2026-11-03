import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import { adventure, RoomError } from './room-engine'
import { profileOf, npcJob, journal } from './room-ai'
import { executeActivityProbe } from './npc-activity-probe'
import {memoryIdentity,memoryState} from './npc-memory-ledger'

export function executeMemoryCommand(room: Room, member: RoomMember, c: RoomCommand) {
  if (
    ![
      'npc-test-cancel',
      'npc-memory-pin',
      'npc-inform-event',
      'npc-memory-delete',
      'npc-affinity-set',
      'npc-affinity-review',
      'npc-activity-check',
      'npc-activity-test',
    ].includes(c.kind)
  )
    return false
  if (member.role !== 'gm' || member.revoked)
    throw new RoomError('记忆、关系及测试仅 GM 可管理', 403)
  if (c.kind === 'npc-test-cancel') {
    const job = npcJob(room, c.jobId)
    if (!job.activityTest) throw new RoomError('只能关闭测试任务')
    job.status = 'canceled'
    job.attempt = null
    return true
  }
  if (c.kind === 'npc-activity-check' || c.kind === 'npc-activity-test') {
    executeActivityProbe(room, member, c)
    return true
  }
  if (c.kind === 'npc-affinity-review') {
    const job = npcJob(room, c.jobId),
      n = profileOf(room, job.npcId),
      p = job.affinityProposal
    if (job.activityTest || job.branchId !== journal(room).branchId || !p || p.status !== 'pending')
      throw new RoomError('关系建议已处理或属于测试／旧分支')
    if (c.approve && (job.status !== 'published' || !n.affinityEnabled))
      throw new RoomError('请先发布正式对话，并启用好感度')
    if (c.approve && job.profileRevision !== n.revision)
      throw new RoomError('关系或 NPC 配置已变化，请重新评估')
    if (c.approve) {
      setRelation(
        room,
        n.id,
        p.characterId,
        Math.max(
          -100,
          Math.min(
            100,
            (n.relations?.find((r) => r.characterId === p.characterId)?.score ?? 0) + p.delta,
          ),
        ),
        c.reason,
      )
      job.profileRevision = n.revision
    }
    p.status = c.approve ? 'approved' : 'rejected'
    return true
  }
  if (c.kind === 'npc-affinity-set') {
    setRelation(room, c.npcId, c.characterId, c.score, c.reason)
    return true
  }
  if (c.kind === 'npc-inform-event') {
    const n = profileOf(room, c.npcId),
      e = adventure(room).broadcastLog?.events.find(
        (e) =>
          e.id === c.eventId &&
          e.branchId === journal(room).branchId &&
          e.phase === 'confirmed' &&
          e.audience.kind === 'public',
      )
    if (!e || n.npcType !== 'important') throw new RoomError('仅可明确告知当前分支的已确认公开事实')
    n.experiences ??= []
    if (n.experiences.some((m) => m.sourceId === e.id && m.branchId === e.branchId)) return true
    if (n.experiences.length >= 500) throw new RoomError('NPC经历容量已满，请先清理')
    n.experiences.push({
      id: crypto.randomUUID(),
      sourceId: e.id,
      branchId: e.branchId,
      sceneId: e.sceneId,
      at: new Date().toISOString(),
      text: e.text.slice(0, 2000),
      characterId: null,
      visibility: 'public',
      pinned: false,
      kind: 'event',
      importance: 'major',
      knowledgeSource: 'told',
    })
    n.revision++
    room.worldRevision++
    return true
  }
  if (c.kind === 'npc-memory-pin') {
    const n = profileOf(room, c.npcId),
      e = n.experiences?.find((e) => e.id === c.memoryId && e.branchId === journal(room).branchId)
    if (!e) throw new RoomError('经历不存在或属于旧分支')
    e.pinned = c.pinned
    n.revision++
    room.worldRevision++
    return true
  }
  if (c.kind === 'npc-memory-delete') {
    const n = profileOf(room, c.npcId),
      rows = c.source === 'experience' ? (n.experiences ?? []) : n.memory
    if (new Set(c.ids).size !== c.ids.length || c.ids.some((id) => !rows.some((r) => r.id === id)))
      throw new RoomError('记录不存在或重复')
    const state=memoryState(room)
    if(state)for(const row of rows.filter(r=>c.ids.includes(r.id))){const source='sourceId'in row?String(row.sourceId):row.id;state.removedIds.push(memoryIdentity(n.id,source,c.source==='dialogue'?'dialogue':'kind'in row&&row.kind==='relationship'?'relationship':'event'))}
    if (c.source === 'experience')
      n.experiences = rows.filter((r) => !c.ids.includes(r.id)) as NonNullable<typeof n.experiences>
    else n.memory = n.memory.filter((r) => !c.ids.includes(r.id))
    n.revision++
    room.worldRevision++
    return true
  }
  return true
}
function setRelation(
  room: Room,
  npcId: string,
  characterId: string,
  score: number,
  reason: string,
) {
  const n = profileOf(room, npcId),
    c = room.world.characters.find((c) => c.id === characterId)
  if (!n.affinityEnabled || n.npcType !== 'important' || !c || c.npcOwnerId)
    throw new RoomError('好感度未开启或目标不是玩家角色')
  n.relations ??= []
  const prior = n.relations.find((r) => r.characterId === characterId),
    before = prior?.score ?? 0
  if (prior) {
    prior.score = score
    prior.note = reason
  } else n.relations.push({ characterId, score, note: reason })
  n.experiences ??= []
  if (n.experiences.length < 500)
    n.experiences.push({
      id: crypto.randomUUID(),
      sourceId: crypto.randomUUID(),
      branchId: journal(room).branchId,
      sceneId: adventure(room).activeSceneId,
      at: new Date().toISOString(),
      text: `GM 确认对${c.build.name}的好感度 ${before} → ${score}：${reason}`,
      characterId,
      visibility: 'personal',
      pinned: false,
      kind: 'relationship',
    })
  else n.experienceOmitted = (n.experienceOmitted ?? 0) + 1
  n.revision++
  room.worldRevision++
}
