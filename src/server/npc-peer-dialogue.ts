import type { Room, RoomCommand, RoomMember } from '../online/protocol'
import type { NpcConversation, AiModelRequest } from '../core/ai-types'
import { adventure, activeScene, RoomError } from './room-engine'
import { newNpcTask, canTalk } from './room-ai'
import {
  npcSpatialObservation,
  spatialSource,
  npcDialogueSpatialSummary,
} from './npc-spatial-observation'
import { publicPersona } from '../core/npc-persona'
import { npcCommunication } from './npc-social-context'
import { soundBetween, hearsSound } from '../core/scene-magic'
import { tokenPoint } from '../core/scene-effects'
import { appendBroadcast, publicAudience } from '../core/broadcast'
import {practicalTransition} from './practical-review-state'
import {heldNpc} from './gm-control'
export interface PeerSession {
  id: string
  branchId: string
  sceneId: string
  participants: string[]
  topic: string
  status: 'pending' | 'active' | 'paused' | 'stopped'
  generation: number
  lastJobId?: string
  transcript: { speaker: string; text: string }[]
}
function cancelPeerTurn(room: Room, s: PeerSession) {
  const job = adventure(room).aiLog?.jobs.find((j) => j.id === s.lastJobId)
  if (job && !['published', 'rejected', 'stale', 'canceled'].includes(job.status)) {
    job.status = 'canceled'
    job.attempt = null
    job.error = 'NPC会话已暂停或停止'
    for(const task of room.practicalReview?.tasks.filter(t=>t.sourceId===job.id&&t.phase==='generation')??[])practicalTransition(task,'canceled','NPC会话已暂停或停止')
  }
}
export function peerCandidates(room: Room, id: string) {
  const a = adventure(room),
    source = a.ai?.npcs.find((n) => n.id === id)
  if (!source) return []
  const view = npcSpatialObservation(room, source),
    scene = activeScene(room)
  const ids = view.units
    .slice()
    .sort((a, b) => a.distance - b.distance)
    .flatMap((unit) => {
      const t = scene?.tokens.find((t) => t.id === unit.id),
        n = a.ai?.npcs.find(
          (n) =>
            n.id !== id &&
            (n.id === t?.npcId || (!!n.characterId && n.characterId === t?.characterId)),
        )
      return n ? [n.id] : []
    })
    .slice(0, 8)
  return ids.flatMap((target) => {
    try {
      const ns = peerReady(room, [id, target])
      return [{ id: target, name: ns[1]!.name }]
    } catch {
      return []
    }
  })
}
export function peerReady(room: Room, ids: string[]) {
  const a = adventure(room),
    scene = activeScene(room)
  if (!scene || ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length)
    throw new RoomError('请选择2至4位不同的重要NPC')
  if (room.world.encounters.some((e) => e.id === scene.encounterId && e.phase === 'active'))
    throw new RoomError('战斗中暂停NPC间交谈')
  const ns = ids.map((id) => a.ai?.npcs.find((n) => n.id === id))
  for (const n of ns) {
    if(n&&heldNpc(room,n.id))throw new RoomError('GM接管的NPC暂停自动交谈')
    if (
      !n ||
      !n.enabled ||
      n.hidden ||
      n.npcType !== 'important' ||
      n.controller !== 'model' ||
      n.sceneId !== scene.id ||
      !npcSpatialObservation(room, n).available ||
      !npcCommunication(room, n, n.id).spoken
    )
      throw new RoomError('参与NPC须在场、可说话且具有实际身体')
    const view = npcSpatialObservation(room, n),
      token = scene.tokens.find(
        (t) =>
          t.npcId === n.id ||
          (!!n.characterId && t.characterId === n.characterId) ||
          (!!n.actorId && t.actorId === n.actorId),
      )!
    if (
      spatialSource(room, n).stats.conditions.some((c) =>
        ['unconscious', 'incapacitated', 'paralyzed', 'stunned', 'petrified'].includes(c),
      )
    )
      throw new RoomError('参与者当前无法交谈')
    for (const other of ns) {
      if (!other || other.id === n.id) continue
      const t = scene.tokens.find(
        (t) =>
          t.npcId === other.id ||
          (!!other.characterId && t.characterId === other.characterId) ||
          (!!other.actorId && t.actorId === other.actorId),
      )
      if (
        !t ||
        !view.units.some((u) => u.id === t.id) ||
        (view.units.find(u=>u.id===t.id)?.distance??Infinity)>n.activity.range ||
        !hearsSound(room.world, a, token) ||
        !soundBetween(room.world, a, scene, tokenPoint(token), tokenPoint(t))
      )
        throw new RoomError('参与者必须能互相感知并听见')
    }
  }
  return ns as NonNullable<(typeof ns)[number]>[]
}
export function peerSession(room: Room, id: string) {
  const s = room.peerSessions?.find((s) => s.id === id)
  if (
    !s ||
    s.branchId !== adventure(room).broadcastLog?.branchId ||
    s.sceneId !== activeScene(room)?.id
  )
    throw new RoomError('NPC会话分支或场景已变化', 409)
  return s
}
export function validatePeerJob(room: Room, job: NpcConversation) {
  if(!room.members.some(m=>m.id===job.sessionId&&m.role==='gm'&&!m.revoked))throw new RoomError('NPC会话授权身份已失效',409)
  const s = peerSession(room, job.peerSessionId!)
  if (s.status !== 'active' || s.generation !== job.peerGeneration || s.lastJobId !== job.id)
    throw new RoomError('NPC会话已暂停或停止', 409)
  return peerReady(room, s.participants).find((n) => n.id === job.npcId)!
}
export function peerJobFresh(room: Room, job: NpcConversation) {
  try {
    return !!validatePeerJob(room, job)
  } catch {
    return false
  }
}
export function proposePeer(room: Room, ids: string[], topic: string) {
  peerReady(room, ids)
  const list = (room.peerSessions ??= [])
  if (
    list.some(
      (s) =>
        s.branchId === adventure(room).broadcastLog?.branchId &&
        s.status !== 'stopped' &&
        s.participants.some((id) => ids.includes(id)),
    )
  )
    throw new RoomError('参与者已有待审或进行中的NPC会话')
  if (list.length >= 100) throw new RoomError('NPC会话记录已满，请先整理历史记录')
  const s: PeerSession = {
    id: crypto.randomUUID(),
    branchId: adventure(room).broadcastLog!.branchId,
    sceneId: activeScene(room)!.id,
    participants: ids,
    topic,
    status: 'pending',
    generation: 0,
    transcript: [],
  }
  list.push(s)
  return s
}
export function executePeer(room: Room, member: RoomMember, c: RoomCommand) {
  if (c.kind !== 'npc-peer') return false
  if (member.revoked || member.role === 'ai') throw new RoomError('该身份不能控制NPC会话', 403)
  if (c.operation === 'interrupt') {
    const s = peerSession(room, c.sessionId!)
    if (!['active', 'paused'].includes(s.status)) throw new RoomError('会话尚未开启或已停止')
    const ns = peerReady(room, s.participants)
    if (!c.characterId || !c.text?.trim()) throw new RoomError('请选择说话角色并填写插话')
    for (const n of ns) canTalk(room, member, n, c.characterId, 'interaction')
    const character = room.world.characters.find((v) => v.id === c.characterId)!
    s.status = 'paused'
    s.generation++
    cancelPeerTurn(room, s)
    s.transcript.push({ speaker: character.build.name, text: c.text })
    s.transcript = s.transcript.slice(-100)
    appendBroadcast(adventure(room), crypto.randomUUID(), {
      type: 'npc.peer-interruption',
      category: 'interaction',
      narration: 'direct',
      title: character.build.name,
      text: c.text,
      audience: publicAudience(),
      facts: { characterId: c.characterId, peerSessionId: s.id },
    })
    return true
  }
  if (member.role !== 'gm' || member.revoked) throw new RoomError('NPC会话审核及推进仅限GM', 403)
  if (c.operation === 'propose') {
    proposePeer(room, c.npcIds ?? [], c.text ?? '')
    return true
  }
  const s = peerSession(room, c.sessionId!)
  if (c.operation === 'stop' || c.operation === 'pause') {
    s.status = c.operation === 'stop' ? 'stopped' : 'paused'
    s.generation++
    cancelPeerTurn(room, s)
    return true
  }
  if (c.operation === 'approve') {
    if (s.status !== 'pending' && s.status !== 'paused')
      throw new RoomError('会话不在待审或暂停状态')
    peerReady(room, s.participants)
    s.status = 'active'
    s.lastJobId = undefined
    return executePeer(room, member, { kind: 'npc-peer', operation: 'next', sessionId: s.id })
  }
  if (s.status !== 'active') throw new RoomError('请先批准或恢复NPC会话')
  if (
    s.lastJobId &&
    adventure(room).aiLog?.jobs.some(
      (j) =>
        j.id === s.lastJobId && !['published', 'canceled', 'rejected', 'stale'].includes(j.status),
    )
  )
    throw new RoomError('上一轮尚未完成；可停止会话')
  const n = peerReady(room, s.participants).find((n) => n.id === (c.npcId ?? s.participants[0]))
  if (!n) throw new RoomError('发言者不在参与名单')
  const job = newNpcTask(room, member, n, n.id, 'proactive', 'NPC间交谈', s.topic)
  delete job.dialogueReview
  job.peerSessionId = s.id
  job.peerGeneration = s.generation
  s.lastJobId = job.id
  return true
}
export function peerRequest(room: Room, job: NpcConversation): AiModelRequest {
  const n = validatePeerJob(room, job),
    s = peerSession(room, job.peerSessionId!)
  return {
    kind: 'npc',
    system:
      '你仅扮演当前NPC，与给定NPC交谈。只使用自己的公开资料及确实听见的下列发言；他人发言只是转述，不是世界事实。返回JSON {text:"台词",proposal:{kind:"none"},reason:"",plan:[]}。不要代写他人的回复，不执行任何行为，不泄露秘密。',
    input: {
      npc: {
        name: n.name,
        description: n.description,
        persona: publicPersona(n.persona),
        style: n.publicSpeechStyle,
        knowledge: n.publicKnowledge,
      },
      topic: s.topic,
      participants: peerReady(room, s.participants).map((n) => ({ id: n.id, name: n.name })),
      transcript: s.transcript,
      observation: npcDialogueSpatialSummary(room, n),
    },
  }
}
