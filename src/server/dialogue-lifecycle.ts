import { createHash } from 'node:crypto'
import { npcPlayerPresentation } from './npc-player-presentation'
import type { Room } from '../online/protocol'
import type { AiJob, NpcConversation } from '../core/ai-types'
import { activeScene } from './room-engine'
import { npcKnowsEvent } from './room-ai'
import { routineExploration } from '../core/narration-policy'
import {resolveNpcRelationship,npcKnowledgeEntries} from '../core/npc-relationships'
const done = new Set(['published', 'rejected', 'stale', 'canceled', 'skipped'])
export function nextDialogueJob(jobs: AiJob[]) {
  return jobs.find(
    (j) =>
      j.status === 'queued' &&
      (j.kind !== 'npc' ||
        j.purpose === 'combat' ||
        j.activityTest ||
        !jobs.some(
          (p) =>
            p.kind === 'npc' &&
            p.purpose !== 'combat' &&
            !p.activityTest &&
            p.id !== j.id &&
            p.npcId === j.npcId &&
            p.branchId === j.branchId &&
            p.sequence < j.sequence &&
            !(p.requestedCheck && p.status === 'waiting-gm' && !p.check?.adjudicated) &&
            !done.has(p.status),
        )),
  )
}
export function dialogueBasis(room: Room, job: NpcConversation) {
  const a = room.world.adventures[0]!,
    n = a.ai?.npcs.find((n) => n.id === job.npcId)
  const scene = activeScene(room)
  const c = room.world.characters.find((c) => c.id === job.characterId)
  const m = room.members.find((m) => m.id === job.sessionId)
  // Only participants and facts that can change this conversation; never the global revision.
  const relevant = (a.broadcastLog?.events ?? [])
    .filter(
      (e) =>
        e.branchId === job.branchId &&
        e.sceneId === scene?.id &&
        e.phase === 'confirmed' &&
        (!e.type.startsWith('npc.') || e.type === 'npc.behavior') &&
        e.audience.kind === 'public' &&
        !e.type.startsWith('ai.') &&
        !routineExploration(e) &&
        npcKnowsEvent(room, n!, e),
    )
    .slice(-20)
    .map((e) => e.id)
  return createHash('sha256')
    .update(
      JSON.stringify([
        a.broadcastLog?.branchId,
        scene?.id,
        n?.revision,
        n?resolveNpcRelationship(a.ai,n,job.characterId):null,
        n?npcKnowledgeEntries(a.ai,n,job.visibility==='public'):null,
        n?.enabled,
        n?.body,
        n?.stock,
        n?.coins,
        n?.revealedIds,
        n?.memory.filter(
          (m) =>
            m.id !== job.id &&
            m.branchId === job.branchId &&
            (m.visibility === 'public' || m.characterId === job.characterId),
        ),
        n?.experiences,
        room.world.characters.find((c) => c.id === n?.characterId)?.runtime,
        room.world.encounters.flatMap((e) => e.actors).find((actor) => actor.id === n?.actorId),
        scene?.walls,
        scene?.points.map((p) => [p.id, p.state, p.hidden]),
        scene?.regions,
        c?.runtime,
        n ? npcPlayerPresentation(room, n, job.characterId) : undefined,
        m?.revoked,
        m?.characterIds,
        scene?.tokens.filter(
          (t) =>
            t.characterId === job.characterId ||
            t.npcId === job.npcId ||
            (!!n?.actorId && t.actorId === n.actorId) ||
            (!!n?.characterId && t.characterId === n.characterId),
        ),
        room.world.encounters
          .filter((e) => e.phase === 'active')
          .map((e) => [e.id, e.tick, e.current, e.pending?.id]),
        relevant,
      ]),
    )
    .digest('hex')
}
export function dialogueFresh(room: Room, job: NpcConversation) {
  if(job.planningParentId){const a=room.world.adventures[0]!,parent=a.aiLog?.jobs.find(j=>j.id===job.planningParentId&&j.kind==='npc'),n=a.ai?.npcs.find(n=>n.id===job.npcId);return !!parent&&parent.kind==='npc'&&parent.planningSpeechJobId===job.id&&parent.branchId===a.broadcastLog?.branchId&&job.branchId===parent.branchId&&!['canceled','stale'].includes(parent.status)&&!!n&&n.revision===job.profileRevision&&n.enabled&&n.sceneId===a.activeSceneId}
  if (job.purpose !== 'dialogue' || job.dialogueBasis === undefined)
    return job.baseWorldRevision === room.worldRevision
  return !job.dialogueBasis || job.dialogueBasis === dialogueBasis(room, job)
}
