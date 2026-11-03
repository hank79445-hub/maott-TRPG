import type { NpcProfile, NpcConversation, NpcExperience } from '../core/ai-types'
import type { BroadcastEvent } from '../core/broadcast-types'
import type { Room } from '../online/protocol'
import { adventure, activeScene } from './room-engine'
import { npcKnowsEvent, assertNpcReady } from './room-ai'
import { importantNpcFacts } from './npc-perception'
import {npcObservableEvent,projectNpcExperience} from './npc-event-knowledge'
import {recallNative,forkMemoryTimeline,memoryLedger} from './npc-memory-ledger'
import {npcKnowledgeEntries} from '../core/npc-relationships'

export function selectNpcMemories(n: NpcProfile, job: NpcConversation, room?:Room) {
  const fixed = [...(n.initialMemories ?? []),...npcKnowledgeEntries(room?.world.adventures[0]?.ai,n,job.visibility==='public'||!!job.qqSessionId).map(t=>({...t,characterId:null}))].filter(
    (m) =>
      m.visibility === 'public' ||
      (!job.qqSessionId &&
        (m.visibility === 'private' ||
          (job.visibility === 'personal' && m.characterId === job.characterId))),
  )
  const all = (n.experiences ?? []).flatMap(m=>{const projected=room?projectNpcExperience(room,n,m):m;return projected?[projected]:[]}).filter(
    (e) =>
      e.branchId === job.branchId &&
      (e.visibility === 'public' ||
        (job.visibility === 'personal' && e.characterId === job.characterId)),
  )
  const pinned = [
    ...all.filter((e) => e.pinned),
    ...importantNpcFacts(n, job,room).filter((e) => !all.some((m) => m.id === e.id && m.pinned)),
  ]
  const related = all
    .filter((e) => !pinned.some((m) => m.id === e.id))
    .sort(
      (a, b) =>
        Number(a.characterId === job.characterId) - Number(b.characterId === job.characterId) ||
        a.at.localeCompare(b.at),
    )
  const experiences = related.slice(-12)
  const olderSummary = related
    .slice(0, -12)
    .slice(-6)
    .map((e) => ({ id: e.id, sourceId: e.sourceId, text: e.text.slice(0, 160), excerpt: true }))
  const history = n.memory
    .filter(
      (m) =>
        (!m.branchId || m.branchId === job.branchId) &&
        (job.qqSessionId
          ? m.qqSessionId === job.qqSessionId && m.visibility === 'public'
          : m.visibility === 'public' ||
            (job.visibility === 'personal' && m.characterId === job.characterId)),
    )
    .slice(-20)
  const selected = new Set(
    [...fixed, ...pinned, ...experiences, ...olderSummary, ...history].map((m) => m.id),
  )
  const archived=room?recallNative(room,n,job):[]
  const archiveFacts=archived.filter(r=>r.sourceKind==='dialogue'?!history.some(m=>m.id===r.sourceId):!all.some(e=>e.sourceId===r.sourceId)).slice(0,18).map(r=>({id:'archive:'+r.id,sourceId:r.sourceId,text:r.kind==='statement'?'听闻／陈述（非已确认事实）：'+r.text+(r.reply?'；当时已发布回复：'+r.reply:''):r.text,importance:r.importance,pinned:r.importance==='major',visibility:r.visibility,characterId:r.characterId,branchId:job.branchId}))
  return {
    fixed: [...fixed, ...pinned],
    experiences,
    olderSummary,
    history,
    archived:archiveFacts,
    notSelectedIds: [...(n.initialMemories ?? []), ...all, ...n.memory]
      .filter((m) => !selected.has(m.id))
      .map((m) => m.id),
  }
}
export function recordNpcExperiences(room: Room, events: BroadcastEvent[]) {
  const a = adventure(room),
    s = activeScene(room)
  if (!s) return
  for (const n of a.ai?.npcs ?? []) {
    if (!n.enabled || n.npcType !== 'important' || n.sceneId !== s.id) continue
    try {
      assertNpcReady(room, n)
    } catch {
      continue
    }
    n.experiences ??= []
    for (const ev of events) {
      if (
        ev.branchId !== a.broadcastLog?.branchId ||
        ev.phase !== 'confirmed' ||
        ev.audience.kind !== 'public' ||
        ev.sceneId !== s.id ||
        !['resolution', 'interaction', 'progress'].includes(ev.category) ||
        ev.type.startsWith('npc.') ||
        ev.type.startsWith('ai.') ||
        ev.type.endsWith('.audit') ||
        !npcKnowsEvent(room, n, ev, n.activity.range) ||
        n.experiences.some((e) => e.sourceId === ev.id && e.branchId === ev.branchId)
      )
        continue
      const observable=npcObservableEvent(room,n,ev)
      if(!observable)continue
      memoryLedger(room)?.append(room,n.id,ev.id,'event',{kind:'fact',text:observable.text.slice(0,2000),visibility:'public',characterId:typeof ev.facts.characterId==='string'?ev.facts.characterId:null,at:ev.at,importance:['life.state','point.story'].includes(ev.type)?'major':'routine',basis:'witness',dependencies:[ev.id]})
      if (n.experiences.length >= 500) {
        n.experienceOmitted = (n.experienceOmitted ?? 0) + 1
        // Preserve witnessed major facts before expendable, unpinned routine history.
        const replace = ['life.state', 'point.story'].includes(ev.type)
          ? n.experiences.findIndex((m) => !m.pinned && m.importance !== 'major')
          : -1
        if (replace < 0) continue
        n.experiences.splice(replace, 1)
      }
      const row: NpcExperience = {
        id: crypto.randomUUID(),
        sourceId: ev.id,
        branchId: ev.branchId,
        sceneId: ev.sceneId,
        at: ev.at,
        text: observable.text.slice(0, 2000),
        characterId: typeof ev.facts.characterId === 'string' ? ev.facts.characterId : null,
        visibility: 'public',
        pinned: false,
        ...(['life.state', 'point.story'].includes(ev.type)
          ? { importance: 'major' as const }
          : {}),
        knowledgeSource: 'witness',
        kind: 'event',
      }
      n.experiences.push(row)
    }
  }
}
export function rebaseNpcMemory(room: Room, branchId: string) {
  forkMemoryTimeline(room)
  for (const n of adventure(room).ai?.npcs ?? []) {
    for (const e of n.experiences ?? []) e.branchId = branchId
    for (const m of n.memory) m.branchId = branchId
  }
}
