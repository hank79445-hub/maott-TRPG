import type { Room } from '../online/protocol'
import type { MapWorld } from '../core/map-types'
import type { BroadcastEvent } from '../core/broadcast-types'
import type { NpcProfile, NpcConversation, AiModelRequest } from '../core/ai-types'
import { adventure } from './room-engine'
import { npcKnowsEvent, assertNpcReady } from './room-ai'
import { npcHasKnownEvent,npcObservableEvent,projectNpcExperience } from './npc-event-knowledge'

/** Only new transaction events receive evidence. Never infer witnesses for old logs. */
export function captureNpcPerception(room: Room, before: MapWorld, events: BroadcastEvent[]) {
  const priorIds=new Set(before.adventures.flatMap(a=>a.broadcastLog?.events.map(e=>e.id)??[]))
  for (const e of events) {
    if (
      e.perceivedBy ||
      e.phase !== 'confirmed' ||
      e.audience.kind !== 'public' ||
      priorIds.has(e.id)
    )
      continue
    e.perceivedBy = []
    e.npcWitnesses = []
    const current = room.world.adventures.flatMap((a) => a.scenes).find((s) => s.id === e.sceneId)
    const old = before.adventures.flatMap((a) => a.scenes).find((s) => s.id === e.sceneId)
    if (!current) continue
    // Perception is read-only; isolate only the array receiving removed markers.
    // Keep the live world, histories and resources out of a redundant deep clone.
    const scene={...current,tokens:[...current.tokens]},snapshot={...room,world:{...room.world,adventures:room.world.adventures.map(a=>({...a,scenes:a.scenes.map(s=>s.id===scene.id?scene:s)}))}}
    // Removed markers remain usable only inside this transaction's perception snapshot.
    for (const t of old?.tokens ?? [])
      if (!scene.tokens.some((x) => x.id === t.id)) scene.tokens.push(t)
    for (const n of adventure(room).ai?.npcs ?? []) {
      if (!n.enabled || n.npcType !== 'important' || n.sceneId !== e.sceneId) continue
      try {
        assertNpcReady(room, n)
      } catch {
        continue
      }
      // Clear the field while doing the original geometry check.
      const probe = { ...e, perceivedBy: undefined }
      if (npcKnowsEvent(snapshot, n, probe, n.activity.range, true)) {
        e.perceivedBy.push(n.id)
        const refs=new Set(['tokenId','actorId','sourceId','characterId','pointId','npcId','targetId','targetNpcId'].flatMap(k=>typeof e.facts[k]==='string'?[e.facts[k] as string]:[]))
        const entityIds=[...new Set([...scene.tokens,...scene.points].flatMap(p=>{
          const aliases=[p.id,...('span' in p?[p.actorId,p.characterId,p.npcId].filter((x):x is string=>!!x):[])]
          return !p.hidden&&aliases.some(id=>refs.has(id))&&npcKnowsEvent(snapshot,n,{...probe,facts:{tokenId:p.id}},n.activity.range,true)?aliases:[]
        }))].slice(0,40)
        if(entityIds.length)e.npcWitnesses.push({npcId:n.id,entityIds})
      }
    }
  }
}
export function importantNpcFacts(
  n: NpcProfile,
  job: Pick<NpcConversation, 'branchId' | 'message'>,
  room?: Room,
) {
  const all = (n.experiences ?? []).flatMap(m=>{const projected=room?projectNpcExperience(room,n,m):m;return projected?[projected]:[]}).filter(
    (e) =>
      e.branchId === job.branchId &&
      e.visibility === 'public' &&
      (e.importance === 'major' || e.pinned),
  )
  const latest = new Set(all.slice(-8).map((e) => e.id))
  return all
    .filter(
      (e) =>
        e.pinned ||
        latest.has(e.id) ||
        (job.message ?? '').includes(e.text.split(/[：:]/)[0]!.slice(0, 80)),
    )
    .map((e) => ({ ...e, pinned: true }))
}
export function npcEventInputReport(
  room: Room,
  n: NpcProfile,
  job: NpcConversation,
  request: AiModelRequest,
) {
  const selected = new Set<string>()
  const collect = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(collect)
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if ((k === 'id' || k === 'sourceId') && typeof x === 'string') selected.add(x)
        else if (x && typeof x === 'object') collect(x)
      }
  }
  collect(request.input)
  return (adventure(room).broadcastLog?.events ?? [])
    .filter((e) => e.branchId === job.branchId && e.phase === 'confirmed')
    .slice(-80)
    .map((e) => {
      const experience = n.experiences?.find(
        (m) => m.branchId === job.branchId && m.sourceId === e.id,
      )
      const known = npcHasKnownEvent(room,n,e)
      const observable = npcObservableEvent(room,n,e)
      const included =
        selected.has(e.id) ||
        selected.has('event:' + e.id) ||
        (!!experience &&
          (selected.has(experience.id) || selected.has('experience:' + experience.id)))
      return {
        id: e.id,
        text: e.text.slice(0, 400),
        status: included ? 'included' : known ? 'known-omitted' : 'unknown',
        reason: included
          ? '本次已送入'
          : known
            ? observable?'已知但本次预算／相关性未选入':'已知事件；后台数值不转交，旁白只追溯其已确认来源'
            : '无当时感知或明确告知记录',
      }
    })
}
