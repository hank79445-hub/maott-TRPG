import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import { newKnowledgeState, resolveNpcRelationship } from '../core/npc-relationships'
import { memoryLedger, memoryState } from './npc-memory-ledger'
import type { AiView } from '../core/ai-types'
import type { BroadcastEvent } from '../core/broadcast-types'
import { RoomError, adventure } from './room-engine'
import { defaultAdventureAi } from '../core/ai'
import { eventAttributedToParty } from './practical-attribution'
import { practicalEnabled } from './practical-review-state'
const reports = new WeakMap<Room, Map<string, NonNullable<AiView['knowledgeReport']>>>()
export const knowledgeReport = (room: Room, memberId: string) => reports.get(room)?.get(memberId)
export function inheritKnowledgeReports(from: Room, to: Room) {
  const rows = reports.get(from)
  if (rows) reports.set(to, new Map(rows))
}
/** Detection proposes consequences; damage alone never proves criminal intent or attribution. */
export function proposeFactionIncidents(room: Room, events: BroadcastEvent[]) {
  const a = adventure(room),
    ai = a.ai
  if (!ai?.knowledgeDesign?.factions.length) return
  const actors = room.world.encounters.flatMap((e) => e.actors)
  for (const e of events) {
    if (
      e.branchId !== a.broadcastLog?.branchId ||
      e.phase !== 'confirmed' ||
      e.type !== 'point.result' ||
      typeof e.facts.success !== 'boolean'
    )
      continue
    for (const faction of ai.knowledgeDesign.factions)
      for (const policy of faction.policies ?? []) {
        if (
          policy.sceneId !== e.sceneId ||
          policy.pointId !== e.facts.pointId ||
          (policy.outcome === 'success') !== e.facts.success
        )
          continue
        const s = memoryState(room)!,
          group = 'policy:' + policy.id
        const attributed=eventAttributedToParty(room,e,policy)
        const automatic=policy.automatic&&(!room.gmReview?.settings.practical?.enabled||practicalEnabled(room,'knowledge'))
        if (
          s.requests.some(
            (r) =>
              r.factionId === faction.id &&
              (r.eventGroupId === group || r.sourceIds.includes(e.id)),
          )
        )
          continue
        if (s.requests.length >= 2000) {
          s.status = '声望事件容量已满，未自动结算'
          continue
        }
        const request = {
          id: crypto.randomUUID(),
          factionId: faction.id,
          eventGroupId: group,
          sourceIds: [e.id],
          actorId: typeof e.facts.characterId === 'string' ? e.facts.characterId : null,
          reason: policy.reason,
          suggested: policy.contribution,
          applied: automatic && attributed ? policy.contribution : 0,
          status: !attributed?('attribution' as const):automatic ? ('applied' as const) : ('pending' as const),
          attributed,
          revision: 0,
        }
        s.requests.push(request)
        if (automatic && attributed) {
          s.reputations[faction.id] = Math.max(
            -100,
            Math.min(
              100,
              faction.initialScore +
                s.requests
                  .filter((r) => r.factionId === faction.id)
                  .reduce((sum, r) => sum + r.applied, 0),
            ),
          )
          for (const n of ai.npcs)
            if (
              n.knowledgeProfile?.enabled &&
              n.knowledgeProfile.factionId === faction.id &&
              n.knowledgeProfile.membership === 'direct'
            )
              n.revision++
        }
      }
  }
  for (const e of events) {
    if (
      e.branchId !== a.broadcastLog?.branchId ||
      e.phase !== 'confirmed' ||
      e.type !== 'target.resolved' ||
      !(e.facts.kind === 'attack' || (typeof e.facts.damage === 'number' && e.facts.damage > 0))
    )
      continue
    const source = actors.find((x) => x.id === e.facts.sourceId),
      character = source?.characterId,
      target = ai.npcs.find(
        (n) =>
          n.actorId === e.facts.actorId ||
          (!!n.characterId && n.characterId === e.facts.characterId),
      ),
      p = target?.knowledgeProfile
    if (
      !character ||
      !a.party.includes(character) ||
      room.world.characters.find((c) => c.id === character)?.npcOwnerId ||
      !p?.factionId ||
      p.membership !== 'direct' ||
      !ai.knowledgeDesign.factions.some((f) => f.id === p.factionId)
    )
      continue
    const s = memoryState(room)!,
      encounter = room.world.encounters.find((enc) => enc.actors.some((x) => x.id === source.id)),
      group = encounter?.id ?? e.actionId,
      old = s.requests.find((r) => r.factionId === p.factionId && r.eventGroupId === group)
    if (old?.sourceIds.includes(e.id)) continue
    const severe =
        target?.body?.dead ||
        actors.find(actor=>actor.id===target?.actorId)?.npc?.dead ||
        room.world.characters.find((c) => c.id === target?.characterId)?.runtime?.death?.dead,
      contribution = severe ? -40 : -10
    if (old) {
      if (old.sourceIds.length < 100) old.sourceIds.push(e.id)
      old.suggested = Math.min(old.suggested, contribution)
      if (old.suggested !== old.applied) {
        old.status = old.attributed ? 'pending' : 'attribution'
        old.revision++
      }
    } else if (s.requests.length < 2000)
      s.requests.push({
        id: crypto.randomUUID(),
        factionId: p.factionId,
        eventGroupId: group,
        sourceIds: [e.id],
        actorId: character,
        reason:
          '已确认对组织直系成员的攻击／伤害；请核对自卫、决斗、控制、误伤及队伍归因，建议分值为项目默认而非规则书数值。',
        suggested: contribution,
        applied: 0,
        status: 'attribution',
        attributed: false,
        revision: 0,
      })
    else s.status = '声望事件容量已满，未自动结算，请GM归档'
  }
}
export function executeKnowledgeCommand(room: Room, member: RoomMember, c: RoomCommand) {
  if (c.kind !== 'npc-knowledge') return false
  if (member.role !== 'gm' || member.revoked)
    throw new RoomError('NPC知识与阵营管理仅GM可操作', 403)
  const ai = (adventure(room).ai ??= defaultAdventureAi())
  const op = c.operation,
    s = memoryState(room) ?? newKnowledgeState()
  if (op.type === 'configure') {
    if (
      op.config.provider === 'mem0' &&
      !room.modelProfiles?.some((p) => p.name === op.config.embeddingModelRef)
    )
      throw new RoomError('请先登记独立Embedding模型配置')
    if (
      op.config.extractorModelRef &&
      !room.modelProfiles?.some((p) => p.name === op.config.extractorModelRef)
    )
      throw new RoomError('记忆提取模型引用无效')
    const current = room.modelProfiles?.find(
      (p) => p.name === op.config.embeddingModelRef,
    )?.configuration
    if (
      op.config.enabled &&
      op.config.provider === 'mem0' &&
      (!s.providerVerified ||
        s.providerVerified.ref !== op.config.embeddingModelRef ||
        s.providerVerified.dimension !== op.config.dimension ||
        s.providerVerified.revision !== current?.revision)
    )
      throw new RoomError('请先关闭启用开关保存Mem0配置，完成Embedding验证后再启用')
    ai.memoryConfig = op.config
    s.status = op.config.provider === 'mem0' ? 'Mem0索引待验证，暂用本地检索' : '使用本地检索'
  } else if (op.type === 'design') {
    const ids = op.design.factions.map((f) => f.id),
      templates = op.design.templates.map((t) => t.id)
    if (new Set(ids).size !== ids.length || new Set(templates).size !== templates.length)
      throw new RoomError('组织／模板ID重复')
    for (const faction of op.design.factions)
      if (
        new Set(faction.policies?.map((p) => p.id)).size !== (faction.policies?.length ?? 0) ||
        (faction.policies ?? []).some(
          (p) =>
            !adventure(room).scenes.some(
              (s) => s.id === p.sceneId && s.points.some((point) => point.id === p.pointId),
            ),
        )
      )
        throw new RoomError('声望策略编号重复或场景／互动点引用不存在')
    if (
      ai.npcs.some(
        (n) =>
          (n.knowledgeProfile?.factionId && !ids.includes(n.knowledgeProfile.factionId)) ||
          n.knowledgeProfile?.templateIds.some((id) => !templates.includes(id)),
      ) ||
      s.requests.some((r) => !ids.includes(r.factionId))
    )
      throw new RoomError('请先解除NPC归属／模板或保留已有声望组织')
    ai.knowledgeDesign = op.design
    for (const n of ai.npcs) if (n.knowledgeProfile?.enabled) n.revision++
  } else if (op.type === 'profile') {
    const n = ai.npcs.find((n) => n.id === op.npcId)
    if (!n) throw new RoomError('NPC不存在')
    if (
      (op.profile.factionId &&
        !ai.knowledgeDesign?.factions.some((f) => f.id === op.profile.factionId)) ||
      op.profile.templateIds.some((id) => !ai.knowledgeDesign?.templates.some((t) => t.id === id))
    )
      throw new RoomError('归属／知识模板引用不存在')
    if (op.profile.lockedAttitude && !op.profile.lockReason.trim())
      throw new RoomError('锁定态度须填写理由')
    n.knowledgeProfile = op.profile
    n.revision++
  } else if (op.type === 'propose') {
    if (!ai.knowledgeDesign?.factions.some((f) => f.id === op.factionId))
      throw new RoomError('阵营不存在')
    const events = adventure(room).broadcastLog?.events ?? []
    if (
      new Set(op.sourceIds).size !== op.sourceIds.length ||
      op.sourceIds.some(
        (id) =>
          !events.some(
            (e) =>
              e.id === id &&
              e.branchId === adventure(room).broadcastLog?.branchId &&
              e.phase === 'confirmed' &&
              !e.type.startsWith('ai.') &&
              !e.type.endsWith('.audit'),
          ),
      )
    )
      throw new RoomError('声望必须引用当前分支已确认的实际事件')
    const old = s.requests.find(
      (r) => r.factionId === op.factionId && r.eventGroupId === op.eventGroupId,
    )
    if (
      s.requests.some(
        (r) =>
          r !== old &&
          r.factionId === op.factionId &&
          op.sourceIds.some((id) => r.sourceIds.includes(id)),
      )
    )
      throw new RoomError('同一来源已关联本阵营的其他事件组，请合并原申请，不能重复扣分')
    if (old) {
      if (
        op.sourceIds.every((id) => old.sourceIds.includes(id)) &&
        old.suggested === op.contribution &&
        old.attributed === op.attributed &&
        old.reason === op.reason
      )
        return true
      old.sourceIds = [...new Set([...old.sourceIds, ...op.sourceIds])]
      old.suggested = op.contribution
      old.status = op.attributed ? 'pending' : 'attribution'
      old.attributed = op.attributed
      old.reason = op.reason
      old.revision++
    } else {
      if (s.requests.length >= 2000) throw new RoomError('声望事件容量已满，请归档')
      s.requests.push({
        id: crypto.randomUUID(),
        factionId: op.factionId,
        eventGroupId: op.eventGroupId,
        sourceIds: op.sourceIds,
        actorId: null,
        reason: op.reason,
        suggested: op.contribution,
        applied: 0,
        status: op.attributed ? 'pending' : 'attribution',
        attributed: op.attributed,
        revision: 0,
      })
    }
  } else if (op.type === 'reputation') {
    const r = s.requests.find((r) => r.id === op.requestId)
    if (!r || r.revision !== op.revision || !['pending', 'attribution'].includes(r.status))
      throw new RoomError('声望申请已变化或已处理', 409)
    if (op.approve && !op.attributed) throw new RoomError('尚未确认队伍归因，不能扣除声望')
    if (op.approve) {
      const f = ai.knowledgeDesign!.factions.find((f) => f.id === r.factionId)!
      r.applied = op.contribution
      s.reputations[r.factionId] = Math.max(
        -100,
        Math.min(
          100,
          f.initialScore +
            s.requests
              .filter((other) => other.factionId === r.factionId)
              .reduce((sum, other) => sum + other.applied, 0),
        ),
      )
      for (const n of ai.npcs)
        if (
          n.knowledgeProfile?.factionId === r.factionId &&
          n.knowledgeProfile.membership === 'direct' &&
          n.knowledgeProfile.enabled
        )
          n.revision++
    }
    r.status = op.approve ? 'applied' : 'rejected'
    r.attributed = op.attributed
    r.reason = op.reason
    r.revision++
  } else if (op.type === 'inspect') {
    const n = ai.npcs.find((n) => n.id === op.npcId)
    if (!n) throw new RoomError('NPC不存在')
    const records = memoryLedger(room)?.records(room, n.id) ?? []
    const views = reports.get(room) ?? new Map()
    views.set(member.id, {
      npcId: n.id,
      characterId: op.characterId,
      page: op.page,
      total: records.length,
      records: records.slice(op.page * 20, op.page * 20 + 20),
      relationship: op.characterId ? resolveNpcRelationship(ai, n, op.characterId) : null,
      status: s.status,
    })
    reports.set(room, views)
    return true
  } else if (op.type === 'forget') {
    const records = memoryLedger(room)?.records(room, op.npcId) ?? []
    if (op.ids.some((id) => !records.some((r) => r.id === id))) throw new RoomError('记忆不存在')
    s.removedIds.push(...op.ids)
    const n = ai.npcs.find((n) => n.id === op.npcId)
    if (n) {
      const removed = records.filter((r) => op.ids.includes(r.id))
      n.experiences = n.experiences?.filter((e) => !removed.some((r) => r.sourceId === e.sourceId))
      n.memory = n.memory.filter((m) => !removed.some((r) => r.sourceId === m.id))
      n.revision++
    }
  } else if (op.type === 'reindex') {
    s.indexGeneration = crypto.randomUUID()
    s.status = '索引已切换代次，将在下次NPC请求时分批重建'
    delete s.consolidationRun
  } else if (op.type === 'probe') {
    if (ai.memoryConfig?.provider !== 'mem0') throw new RoomError('请先保存Mem0与Embedding模型引用')
    s.probeRequested = true
    s.status = 'Embedding验证待处理'
  }
  ai.knowledgeState = s
  s.revision++
  room.worldRevision++
  return true
}
