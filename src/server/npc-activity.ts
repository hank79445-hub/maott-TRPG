import { resolveModel } from './model-routing'
import { recordNpcExperiences } from './npc-memory'
import type { Room } from '../online/protocol'
import type { NpcProfile, NpcConversation } from '../core/ai-types'
import type { BroadcastEvent } from '../core/broadcast-types'
import { activityMatch } from '../core/npc-activity'
import { distance } from '../core/map'
import { sightLine } from '../core/map-spatial'
import { isNpcCharacter } from '../core/npc-map'
import { adventure, activeScene } from './room-engine'
import { journal, npcPosition, npcKnowsEvent, assertNpcReady, canTalk, newNpcTask } from './room-ai'

export function activityScope(room: Room, n: NpcProfile) {
  return (n.activity.scope === 'party' ? adventure(room).party : n.activity.characterIds).filter(
    (id) => !isNpcCharacter(room.world, id),
  )
}
export function eventStillRelevant(room: Room, ev: BroadcastEvent) {
  const s = activeScene(room)
  if (!s || ev.sceneId !== s.id || ev.branchId !== adventure(room).broadcastLog?.branchId)
    return false
  if (typeof ev.facts.hpAfter === 'number') {
    const actor = room.world.encounters
      .flatMap((e) => e.actors)
      .find((a) => a.id === ev.facts.actorId)
    const characterId =
      typeof ev.facts.characterId === 'string' ? ev.facts.characterId : actor?.characterId
    const c = room.world.characters.find((c) => c.id === characterId)
    if ((c?.runtime?.hp ?? actor?.npc?.hp) !== ev.facts.hpAfter) return false
    if (c?.runtime?.death?.dead || actor?.npc?.dead) return false
  }
  if (ev.type === 'point.story') {
    const n = adventure(room).ai?.npcs.find((n) => n.id === ev.facts.npcId)
    if (!n || !n.enabled || n.sceneId !== s.id || n.hidden) return false
  }
  return true
}
export function proactiveStillRelevant(room: Room, job: NpcConversation) {
  if (!job.activityEventIds) return true
  const n = adventure(room).ai?.npcs.find((n) => n.id === job.npcId)
  if (!n?.activity.enabled || n.hidden || !activityScope(room, n).includes(job.characterId))
    return false
  const s = activeScene(room),
    marker = s?.tokens.find((t) => t.npcId === n.id),
    target = s?.tokens.find((t) => t.characterId === job.characterId && !t.hidden)
  const encounter = room.world.encounters.find((e) => e.id === s?.encounterId)
  if (
    !s ||
    !marker ||
    marker.hidden ||
    !target ||
    (encounter?.phase === 'active' && !n.activity.allowDuringCombat) ||
    distance(s, npcPosition(room, n), target) > n.activity.range ||
    !sightLine(s, npcPosition(room, n), target).clear
  )
    return false
  return job.activityEventIds.every((id) => {
    const ev = adventure(room).broadcastLog?.events.find((e) => e.id === id)
    return !!ev && eventStillRelevant(room, ev) && npcKnowsEvent(room, n, ev, n.activity.range)
  })
}
export function activityTrace(
  room: Room,
  actionId: string,
  n: NpcProfile,
  eventIds: string[],
  status: 'blocked' | 'eligible' | 'waiting' | 'queued' | 'skipped',
  reason: string,
  characterId: string | null = null,
  templateId: string | null = null,
  jobId?: string,
) {
  const j = journal(room),
    scene = activeScene(room)
  if (!scene) return
  j.activityDiagnostics ??= []
  const old = j.activityDiagnostics.find(
    (d) => d.branchId === j.branchId && d.actionId === actionId && d.npcId === n.id,
  )
  const data = {
    id: old?.id ?? crypto.randomUUID(),
    branchId: j.branchId,
    actionId,
    npcId: n.id,
    sceneId: scene.id,
    eventIds,
    at: new Date().toISOString(),
    status,
    reason,
    characterId,
    templateId,
    ...(jobId ? { jobId } : {}),
  }
  if (old) Object.assign(old, data)
  else j.activityDiagnostics.push(data)
  j.activityDiagnostics = j.activityDiagnostics.slice(-200)
}
/** Persist small action groups. Reply generation never mutates combat budgets or the original event. */
export function scheduleResponses(room: Room, incoming: BroadcastEvent[]) {
  const a = adventure(room),
    s = activeScene(room),
    j = journal(room)
  const m = room.members.find((m) => m.role === 'gm' && !m.revoked)
  if (!s || !m) return
  recordNpcExperiences(room, incoming)
  const encounter = room.world.encounters.find((e) => e.id === s.encounterId)
  const now = Date.now()
  j.activityQueue ??= []
  j.activations ??= []
  for (const ev of incoming) {
    if (
      ev.phase !== 'confirmed' ||
      ev.audience.kind !== 'public' ||
      ev.sceneId !== s.id ||
      !a.ai?.npcs.some((n) => activityMatch(n, ev))
    )
      continue
    let g = j.activityQueue.find((g) => g.actionId === ev.actionId && g.branchId === j.branchId)
    if (!g) {
      g = {
        actionId: ev.actionId,
        sceneId: s.id,
        branchId: j.branchId,
        eventIds: [],
        createdAt: ev.at,
        respondedNpcIds: [],
        limit: a.ai?.settings.activitySpeakers ?? 1,
      }
      j.activityQueue.push(g)
    }
    if (!g.eventIds.includes(ev.id) && g.eventIds.length < 50) g.eventIds.push(ev.id)
  }
  j.activityQueue = j.activityQueue
    .filter(
      (g) =>
        g.branchId === j.branchId && g.sceneId === s.id && now - Date.parse(g.createdAt) < 300000,
    )
    .slice(-50)
  if (encounter?.pending) return
  for (const g of j.activityQueue) {
    if (g.respondedNpcIds.length >= g.limit) continue
    const candidates = []
    for (const n of a.ai?.npcs ?? []) {
      const trace = (
        status: 'blocked' | 'eligible' | 'waiting' | 'queued' | 'skipped',
        reason: string,
      ) => activityTrace(room, g.actionId, n, g.eventIds, status, reason)
      if (
        n.npcType !== 'important' ||
        !n.enabled ||
        n.hidden ||
        n.sceneId !== s.id ||
        !n.activity.enabled ||
        g.respondedNpcIds.includes(n.id) ||
        (encounter?.phase === 'active' && !n.activity.allowDuringCombat)
      ) {
        trace(
          'blocked',
          n.npcType !== 'important'
            ? '普通 NPC 不使用模型回应'
            : !n.enabled
              ? 'NPC 已停用'
              : n.hidden
                ? 'NPC 隐藏'
                : n.sceneId !== s.id
                  ? 'NPC 不在当前场景'
                  : !n.activity.enabled
                    ? '主动回应未启用'
                    : g.respondedNpcIds.includes(n.id)
                      ? '本组已回应'
                      : '战斗中未允许交谈',
        )
        continue
      }
      const marker = s.tokens.find((t) => t.npcId === n.id)
      if (!marker || marker.hidden) {
        trace('blocked', 'NPC 标记缺失或隐藏')
        continue
      }
      try {
        assertNpcReady(room, n)
      } catch {
        trace('blocked', 'NPC 死亡或无法交谈')
        continue
      }
      const scope = activityScope(room, n)
      const matches = g.eventIds
        .flatMap((id) => {
          const ev = a.broadcastLog?.events.find((e) => e.id === id)
          if (!ev || !eventStillRelevant(room, ev) || !npcKnowsEvent(room, n, ev, n.activity.range))
            return []
          // Concern concerns eligible player companions, never a random enemy or NPC-owned card.
          const affected = ev.facts.characterId
          if (
            typeof ev.facts.hpAfter === 'number' &&
            (typeof affected !== 'string' || !scope.includes(affected))
          )
            return []
          const match = activityMatch(n, ev)
          return match ? [{ ev, match }] : []
        })
        .sort(
          (a, b) =>
            b.match.priority +
            (b.ev.facts.npcId === n.id ? 100 : 0) -
            (a.match.priority + (a.ev.facts.npcId === n.id ? 100 : 0)),
        )
      const chosen = matches[0]
      if (!chosen) {
        trace(
          'blocked',
          !g.eventIds.some((id) => {
            const ev = a.broadcastLog?.events.find((e) => e.id === id)
            return !!ev && eventStillRelevant(room, ev)
          })
            ? '事件已失效'
            : !g.eventIds.some((id) => {
                  const ev = a.broadcastLog?.events.find((e) => e.id === id)
                  return !!ev && npcKnowsEvent(room, n, ev, n.activity.range)
                })
              ? '未感知事件／超出感知距离'
              : '模板未匹配或受影响角色不在允许范围',
        )
        continue
      }
      const history = j.activations.filter(
        (t) =>
          t.npcId === n.id &&
          t.branchId === j.branchId &&
          t.sceneId === s.id &&
          !a.broadcastLog?.events.find((e) => e.id === t.eventId)?.type.startsWith('turn.') &&
          a.broadcastLog?.events.find((e) => e.id === t.eventId)?.type !== 'encounter.active',
      )
      if (history.some((t) => g.eventIds.includes(t.eventId))) {
        trace('skipped', '同一事件已触发')
        continue
      }
      if (
        !chosen.match.critical &&
        history.filter((t) => !t.critical).length >= n.activity.maxPerScene
      ) {
        trace('blocked', '普通回应场景次数已达上限')
        continue
      }
      if (
        history.some(
          (t) =>
            (t.activityKey ?? 'legacy') === chosen.match.key &&
            now - Date.parse(t.at) < chosen.match.cooldownSeconds * 1000,
        )
      ) {
        trace('waiting', '该模板仍在独立冷却')
        continue
      }
      const person =
        typeof chosen.ev.facts.characterId === 'string' ? chosen.ev.facts.characterId : null
      const targets = s.tokens
        .filter(
          (t) =>
            !!t.characterId &&
            scope.includes(t.characterId!) &&
            !t.hidden &&
            distance(s, npcPosition(room, n), t) <= n.activity.range &&
            sightLine(s, npcPosition(room, n), t).clear,
        )
        .filter((t) => {
          try {
            canTalk(room, m, n, t.characterId!)
            return true
          } catch {
            return false
          }
        })
        .sort(
          (a, b) =>
            Number(b.characterId === person) - Number(a.characterId === person) ||
            a.id.localeCompare(b.id),
        )
      const to = targets[0]
      if (!to?.characterId) {
        trace('blocked', '没有满足角色范围、距离、视线及可交谈状态的对象')
        continue
      }
      activityTrace(
        room,
        g.actionId,
        n,
        g.eventIds,
        'eligible',
        '条件满足',
        to.characterId,
        chosen.match.key,
      )
      candidates.push({
        n,
        to: to.characterId,
        ...chosen,
        score: chosen.match.priority + (chosen.ev.facts.npcId === n.id ? 100 : 0),
      })
    }
    candidates.sort((a, b) => b.score - a.score || a.n.id.localeCompare(b.n.id))
    for (const c of candidates) {
      if (g.respondedNpcIds.length >= g.limit) break
      // A higher-priority NPC waits for its existing review; lower priority does not steal this event.
      if (
        j.jobs.some(
          (job) =>
            job.kind === 'npc' &&
            !job.activityTest &&
            job.npcId === c.n.id &&
            job.branchId === j.branchId &&
            (!['published', 'canceled', 'rejected', 'stale', 'interrupted'].includes(job.status) ||
              room.intents.some((i) => i.id === job.intentId && i.status === 'pending')),
        )
      ) {
        activityTrace(
          room,
          g.actionId,
          c.n,
          g.eventIds,
          'waiting',
          '已有生成、待审对话或待审行为提议',
          c.to,
          c.match.key,
        )
        break
      }
      try {
        canTalk(room, m, c.n, c.to)
        const job = newNpcTask(
          room,
          m,
          c.n,
          c.to,
          'proactive',
          'NPC 观察到已确认事件：' + c.ev.text + '\n回应倾向：' + c.match.tendency,
          c.n.goals,
          'public',
          [c.ev.id],
        )
        activityTrace(
          room,
          g.actionId,
          c.n,
          g.eventIds,
          'queued',
          resolveModel(room, 'npc', c.n).config
            ? '已入队等待模型／审稿'
            : '模型未配置，保留固定回复供 GM 审稿',
          c.to,
          c.match.key,
          job.id,
        )
        job.activityKey = c.match.key
        job.activityEventIds = [c.ev.id]
        g.respondedNpcIds.push(c.n.id)
        j.activations.push({
          npcId: c.n.id,
          sceneId: s.id,
          branchId: j.branchId,
          eventId: c.ev.id,
          at: new Date().toISOString(),
          activityKey: c.match.key,
          critical: c.match.critical,
        })
      } catch {
        activityTrace(
          room,
          g.actionId,
          c.n,
          g.eventIds,
          'blocked',
          '权限、可交谈条件或任务队列已变化',
          c.to,
          c.match.key,
        )
        /* Permission or queue limits cannot undo game facts. */
      }
    }
  }
  for (const d of j.activityDiagnostics ?? [])
    if (
      d.status === 'eligible' &&
      j.activityQueue.some((g) => g.actionId === d.actionId && g.respondedNpcIds.length >= g.limit)
    ) {
      d.status = 'skipped'
      d.reason = '本组回应名额已由更优先的 NPC 使用'
    }
  // Retain completed groups until expiry to prevent a repeat wake from the same action.
  j.activations = j.activations.slice(-1000)
}
