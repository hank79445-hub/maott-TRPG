import type { RoomView } from '../online/protocol'

/** Execution controls remain available even when no approval is waiting. */
export function npcExecutionRuns(view: RoomView) {
  if (view.self.role !== 'gm') return []
  return (view.ai.turns ?? []).filter(
    (r) =>
      r.encounterId === view.encounter?.id &&
      r.tick === view.encounter?.tick &&
      r.branchId === view.broadcast.branchId &&
      ['running', 'paused'].includes(r.state) &&
      !r.needsApproval,
  )
}

/** Every current manual prose review belongs here, including reply-only and narration. */
export function pendingRoomReviews(view: RoomView) {
const trades=view.self.role==='gm'?(view.trade?.sessions??[]).filter(t=>t.status==='awaitingGM'&&t.branchId===view.broadcast.branchId):[]
  const intents = view.self.role === 'gm' ? view.intents.filter((i) => i.status === 'pending') : []
  const turns =
    view.self.role === 'gm'
      ? (view.ai.turns ?? []).filter(
          (r) =>
            r.encounterId === view.encounter?.id &&
            r.tick === view.encounter?.tick &&
            r.branchId === view.broadcast.branchId &&
            (r.state === 'review' || r.needsApproval),
        )
      : []
  const intentIds = new Set(intents.map((i) => i.id)),
    turnJobs = new Set(turns.map((r) => r.jobId)),
    jobs =
      view.self.role === 'gm'
        ? view.ai.jobs.filter(
            (j) =>
              !j.activityTest &&
              !j.spatialPlanning &&
              !(j.kind === 'narration' && (j.modelProbe || j.skillPreview)) &&
              !j.historical &&
              !view.archivedAiReviewIds?.includes(j.id) &&
              (['draft', 'fallback', 'interrupted'].includes(j.status) ||
                (j.status === 'published' && !!j.checkSuggestion && !j.check?.adjudicated) ||
                (!!j.dialogueGroup?.primaryNpcId &&
                  j.dialogueGroup.primaryNpcId === j.npcId &&
                  !!j.check?.adjudicated &&
                  j.check.total !== null &&
                  !j.groupInfluence &&
                  !['rejected', 'canceled', 'stale'].includes(j.status)) ||
                j.status === 'waiting-gm') &&
              !intentIds.has(j.intentId ?? '') &&
              !turnJobs.has(j.id),
          )
        : []
  const questSteps = view.self.role === 'gm' ? (view.world?.adventures[0]?.quests ?? []).flatMap(q =>
    (q.stepSuggestions ?? []).filter(r => r.status === 'pending' && r.branchId === view.broadcast.branchId).flatMap(r => {
      const step = q.steps?.find(s => s.id === r.stepId)
      return step ? [{ id: r.id, questId: q.id, stepId: step.id, title: step.title, questTitle: q.title, status: r.status }] : []
    })) : []
  const spells = view.self.role === 'gm' ? (view.gmSpells ?? []).filter(r => r.status === 'pending') : []
  const spatial = view.self.role === 'gm' ? (view.world?.adventures[0]?.m3?.events??[]).filter(e=>e.status==='pending') : []
  const terrain=view.self.role==='gm'?(view.world?.adventures[0]?.sceneEffects?.hazards??[]).filter(h=>h.status==='pending'):[]
  const m5=view.self.role==='gm'?(view.world?.adventures[0]?.sceneEffects?.m5?.resolutions??[]).filter(r=>r.status==='pending'||r.status==='resolved'&&!!r.frame):[]
  const m5Moves=view.self.role==='gm'?(view.world?.adventures[0]?.sceneEffects?.m5?.outcomes??[]).filter(r=>r.status==='pending'&&r.targetId):[]
  const summons=view.self.role==='gm'?(view.world?.adventures[0]?.summons?.events??[]).filter(e=>e.status==='pending'):[],summonDrafts=view.self.role==='gm'?(view.world?.adventures[0]?.summons?.drafts??[]).filter(d=>d.status==='pending'):[]
  const reputations = view.self.role === 'gm' ? (view.world?.adventures[0]?.ai?.knowledgeState?.requests ?? []).filter(r => r.status === 'pending' || r.status === 'attribution') : []
  const npcSpatial=view.self.role==='gm'?(view.world?.adventures[0]?.ai?.spatialState?.tasks??[]).filter(t=>t.status==='review'):[]
  const practical=view.self.role==='gm'?(view.practicalReview?.tasks??[]).filter(t=>!view.archivedPracticalReviewIds?.includes(t.id)&&!(t.phase==='quest'&&questSteps.some(s=>t.sourceId===s.questId+':'+s.stepId))&&['needs-fact','needs-gm'].includes(t.status)&&!intents.some(i=>i.id===t.sourceId)&&!jobs.some(j=>j.id===t.sourceId)):[]
  return { peerSessions:view.self.role==='gm'?(view.peerSessions??[]).filter(s=>s.status==='pending'):[],questSteps,practical,intents, jobs, turns, spells, spatial, terrain,m5,m5Moves,summons,summonDrafts,reputations,npcSpatial,trades, count:(view.self.role==='gm'?(view.peerSessions??[]).filter(s=>s.status==='pending').length:0)+questSteps.length+practical.length+trades.length+npcSpatial.length+reputations.length+summons.length+summonDrafts.length+m5.length+m5Moves.length+ intents.length + jobs.length + turns.length + spells.length + spatial.length + terrain.length }
}

export function pendingBattleReview(view: RoomView) {
  if (view.self.role !== 'gm' || !view.encounter || view.encounter.phase !== 'active') return null
  const e = view.world?.encounters.find((e) => e.id === view.encounter!.id)
  const concentration = e?.actors.some((a) =>
    a.characterId
      ? view.world?.characters.find((c) => c.id === a.characterId)?.runtime?.concentration
          ?.pendingDC
      : a.npc?.concentration?.pendingDC,
  )
  return view.encounter.pending || concentration
    ? {
        encounterId: view.encounter.id,
        key: `${view.broadcast.branchId}:${view.encounter.id}:${view.encounter.tick}:${e?.pending?.id ?? 'concentration'}`,
      }
    : null
}
