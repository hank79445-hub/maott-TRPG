import type { Room } from '../online/protocol'
import type { NpcProfile, NpcExperience } from '../core/ai-types'
import type { BroadcastEvent } from '../core/broadcast-types'
const adventure = (r: Room) => r.world.adventures[0]!
export function narrationSources(room: Room, event: BroadcastEvent) {
  const a = adventure(room),
    j = a.aiLog?.jobs.find(
      (j) =>
        j.kind === 'narration' && (j.id === event.facts.jobId || j.publishedEventId === event.id),
    )
  return j?.kind === 'narration' ? j.eventIds : []
}
export function npcHasKnownEvent(room: Room, n: NpcProfile, e: BroadcastEvent): boolean {
  if (
    e.branchId !== adventure(room).broadcastLog?.branchId ||
    e.phase !== 'confirmed' ||
    e.audience.kind !== 'public' ||
    e.type.endsWith('.audit') ||
    e.type === 'npc.plan'
  )
    return false
  if (e.type === 'ai.narration')
    return narrationSources(room, e).some((id) => {
      const source = adventure(room).broadcastLog?.events.find((s) => s.id === id)
      return source && source.type !== 'ai.narration' && npcHasKnownEvent(room, n, source)
    })
  const memories = (n.experiences ?? []).filter(
    (m) => m.sourceId === e.id && m.branchId === e.branchId && m.visibility === 'public',
  )
  return (
    e.perceivedBy?.includes(n.id) === true || memories.some((m) => m.knowledgeSource === 'told')
  )
}
const backendOnly =
  /(?:^dice\.|^resource\.|^inventory\.|^concentration\.|\.audit$|^npc\.plan|\.pending$|^initiative\.|^attack\.rolled|^save\.rolled)/
/** What an NPC can perceive is distinct from the numeric rules broadcast shown to players. */
export function npcObservableEvent(
  room: Room,
  n: NpcProfile,
  e: BroadcastEvent,
): { id: string; type: string; text: string; facts: BroadcastEvent['facts'] } | null {
  if (
    !npcHasKnownEvent(room, n, e) ||
    backendOnly.test(e.type) ||
    e.type.startsWith('ai.') ||
    e.type.startsWith('npc.')
  )
    return null
  const f = e.facts ?? {},
    witness = e.npcWitnesses?.find((w) => w.npcId === n.id),
    targetId =
      typeof f.targetId === 'string'
        ? f.targetId
        : typeof f.actorId === 'string'
          ? f.actorId
          : typeof f.characterId === 'string'
            ? f.characterId
            : typeof f.npcId === 'string'
              ? f.npcId
              : undefined,
    target = targetId
      ? room.world.encounters
          .flatMap((e) => e.actors)
          .find((t) => t.id === targetId || t.characterId === targetId || t.npcId === targetId)
      : undefined
  const knownTarget = !!targetId && !!witness?.entityIds.includes(targetId),
    name = knownTarget
      ? (target?.npc?.name ??
        room.world.characters.find((c) => c.id === (target?.characterId ?? targetId))?.build.name ??
        '目击的人物')
      : '目击的目标'
  if (e.type === 'target.resolved') {
    if (!knownTarget) return null
    return {
      id: e.id,
      type: e.type,
      text:
        name +
        (typeof f.damage === 'number' && f.damage > 0
          ? '受到伤害。'
          : typeof f.hpChange === 'number' && f.hpChange > 0
            ? '恢复了生命。'
            : f.hit === false
              ? '没有被这次作用击中。'
              : '身上的作用结果已经显现。'),
      facts: {
        ...(typeof f.hit === 'boolean' ? { hit: f.hit } : {}),
        ...(typeof f.damage === 'number' ? { injured: f.damage > 0 } : {}),
      },
    }
  }
  if (e.type === 'life.state') {
    if (witness && targetId && !knownTarget) return null
    return {
      id: e.id,
      type: e.type,
      text: knownTarget
        ? name +
          (f.dead === true
            ? '死亡。'
            : f.stable === true
              ? '已经稳定。'
              : /已恢复生命状态/.test(e.text)
                ? '恢复了生命状态。'
                : '生命状态发生变化。')
        : e.text,
      facts: {
        ...(typeof f.dead === 'boolean' ? { dead: f.dead } : {}),
        ...(typeof f.stable === 'boolean' ? { stable: f.stable } : {}),
      },
    }
  }
  if (/combat\.(?:start|began)/.test(e.type))
    return { id: e.id, type: e.type, text: '本场景的战斗已经开始。', facts: {} }
  if (/combat\.(?:end|finish)/.test(e.type))
    return { id: e.id, type: e.type, text: '本场景的战斗已经结束。', facts: {} }
  if (e.type === 'token.moved')
    return { id: e.id, type: e.type, text: name + '移动了位置。', facts: {} }
  // Deliberately authored public prose is kept; engine roll/resource fields are not forwarded as facts.
  if (
    [
      'gm.mark',
      'scene.enter',
      'point.story',
      'point.result',
      'broadcast.played',
      'story.started',
    ].includes(e.type) ||
    e.category === 'preset' ||
    e.category === 'progress'
  )
    return { id: e.id, type: e.type, text: e.text, facts: {} }
  return null
}
export function projectNpcExperience(room: Room, n: NpcProfile, m: NpcExperience) {
  const e = adventure(room).broadcastLog?.events.find(
    (e) => e.id === m.sourceId && e.branchId === m.branchId,
  )
  if (!e) return { ...m }
  const fact = npcObservableEvent(room, n, e)
  return fact ? { ...m, text: fact.text } : null
}
/** On-demand GM export, over the full retained journal (at most 5000 events). No per-SSE work. */
export function npcBroadcastKnowledgeReport(room: Room, npcId?: string) {
  const a = adventure(room),
    events = a.broadcastLog?.events ?? [],
    npcs = (a.ai?.npcs ?? []).filter((n) => !npcId || n.id === npcId),
    included = new Map<string, string[]>()
  for (const j of a.aiLog?.jobs ?? [])
    if (j.kind === 'npc')
      for (const e of j.inputReport?.eventSelections ?? [])
        if (e.status === 'included') {
          const key = JSON.stringify([j.npcId, j.branchId, e.id])
          included.set(key, [...new Set([...(included.get(key) ?? []), j.id])])
        }
  return {
    branchId: a.broadcastLog?.branchId ?? '',
    scope:
      'full-retained-journal; saved perception and confirmed sources; historical inclusion is evidence, not new authorization',
    eventCount: events.length,
    inputReportCoverage: {
      npcJobs: (a.aiLog?.jobs ?? []).filter((j) => j.kind === 'npc').length,
      jobsWithEventReport: (a.aiLog?.jobs ?? []).filter(
        (j) => j.kind === 'npc' && j.inputReport?.eventSelections !== undefined,
      ).length,
    },
    rows: events.map((e) => ({
      eventId: e.id,
      branchId: e.branchId,
      type: e.type,
      text: e.text.slice(0, 400),
      phase: e.phase,
      audience: e.audience.kind,
      canonicalSourceIds: e.type === 'ai.narration' ? narrationSources(room, e) : [e.id],
      npcs: npcs.map((n) => {
        const fact = npcObservableEvent(room, n, e),
          known = npcHasKnownEvent(room, n, e),
          includedJobIds = included.get(JSON.stringify([n.id, e.branchId, e.id])) ?? []
        return {
          npcId: n.id,
          name: n.name,
          known,
          knowledgeBasis:
            e.type === 'ai.narration'
              ? 'confirmed-sources'
              : e.perceivedBy?.includes(n.id)
                ? 'witness'
                : (n.experiences ?? []).some(
                      (m) =>
                        m.sourceId === e.id &&
                        m.branchId === e.branchId &&
                        m.knowledgeSource === 'told',
                    )
                  ? 'GM-told'
                  : 'no-saved-evidence',
          knownSourceIds:
            e.type === 'ai.narration'
              ? narrationSources(room, e).filter((id) => {
                  const source = events.find((s) => s.id === id)
                  return !!source && npcHasKnownEvent(room, n, source)
                })
              : known
                ? [e.id]
                : [],
          observableText: fact?.text ?? '',
          includedJobIds,
          reason:
            e.type === 'ai.narration'
              ? '旁白仅追溯已确认来源；不把修辞存为第二份事实'
              : !known
                ? '未确认、非公开、旧分支或没有当时感知／告知证据'
                : fact
                  ? '按感知提供事实摘要，后台数字不提供'
                  : '只有后台结算／未获感知的细节，不作为NPC事实',
        }
      }),
    })),
  }
}
