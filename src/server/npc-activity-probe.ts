import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import type { BroadcastEvent } from '../core/broadcast-types'
import { activityTrace, scheduleResponses } from './npc-activity'
import { journal, profileOf, newNpcTask } from './room-ai'
import { adventure, activeScene, RoomError } from './room-engine'
import { resolveModel } from './model-routing'
import { appendBroadcast, publicAudience } from '../core/broadcast'
import { runtimeDerived } from '../core/runtime'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { responseNames } from '../core/npc-activity'
import { captureNpcPerception } from './npc-perception'

type ProbeCommand = Extract<RoomCommand, { kind: 'npc-activity-check' | 'npc-activity-test' }>
export function executeActivityProbe(room: Room, member: RoomMember, c: ProbeCommand) {
  const copy = structuredClone(room),
    a = adventure(copy),
    s = activeScene(copy),
    n = profileOf(copy, c.npcId)
  if (!s || n.sceneId !== s.id) throw new RoomError('请选择当前场景 NPC')
  const source = c.source
  let event: BroadcastEvent
  if (source.kind === 'event') {
    const existing = a.broadcastLog?.events.find((e) => e.id === source.eventId)
    if (
      !existing ||
      existing.phase !== 'confirmed' ||
      existing.audience.kind !== 'public' ||
      existing.branchId !== journal(copy).branchId ||
      existing.sceneId !== s.id
    )
      throw new RoomError('只能检查当前分支、当前场景的公开已确认事件')
    event = existing
  } else {
    const t = n.activity.templates?.find((t) => t.id === source.templateId && t.enabled),
      character = copy.world.characters.find((x) => x.id === source.characterId && !x.npcOwnerId)
    if (!t || !character || !character.runtime) throw new RoomError('模板或玩家角色不存在／未启用')
    const facts: BroadcastEvent['facts'] = {
      characterId: character.id,
      success: t.outcome !== 'failure',
    }
    let type = 'target.resolved',
      text = `测试假设：${character.build.name}触发${responseNames[t.type]}。`
    if (['rescued', 'aided', 'danger', 'goal'].includes(t.type)) {
      const p = s.points.find(
        (p) =>
          (!t.pointId || p.id === t.pointId) &&
          p.storyResults?.some(
            (r) =>
              r.npcId === n.id &&
              r.type === t.type &&
              (t.outcome === 'any' || r.outcome === t.outcome),
          ),
      )
      const r = p?.storyResults?.find(
        (r) =>
          r.npcId === n.id && r.type === t.type && (t.outcome === 'any' || r.outcome === t.outcome),
      )
      if (!p || !r) throw new RoomError('该模板缺少同场景互动点的对应剧情结果关联')
      if (p.hidden || n.hidden) throw new RoomError('隐藏剧情不会触发公开回应')
      type = 'point.story'
      text = '测试假设（尚未发生）：' + r.text
      Object.assign(facts, {
        pointId: p.id,
        npcId: n.id,
        storyType: r.type,
        success: r.outcome === 'success',
      })
    } else if (t.type === 'scene') type = 'scene.enter'
    else if (t.type === 'interaction') {
      const p = s.points.find((p) => (!t.pointId || p.id === t.pointId) && !p.hidden && p.enabled)
      if (!p) throw new RoomError('请配置可见且启用的互动点')
      type = 'point.result'
      facts.pointId = p.id
    } else {
      const hp = runtimeDerived(character, catalogue([srd, ...copy.world.packs])).hp
      Object.assign(facts, {
        hpBefore: t.type === 'recovered' ? 0 : hp,
        hpAfter:
          t.type === 'downed'
            ? 0
            : t.type === 'wounded'
              ? Math.max(1, Math.floor((hp * t.thresholdPercent) / 100))
              : t.type === 'recovered'
                ? hp
                : Math.max(0, hp - 1),
        maxHp: hp,
        damage: t.type === 'recovered' ? 0 : 1,
        critical: t.type === 'critical',
      })
      character.runtime.hp = Number(facts.hpAfter)
    }
    event = appendBroadcast(a, crypto.randomUUID(), {
      category: 'resolution',
      type,
      title: '测试假设',
      text,
      sceneId: s.id,
      audience: publicAudience(),
      facts,
    })
  }
  const j = journal(copy),
    before = new Set(j.jobs.map((j) => j.id))
  if (source.kind === 'template') captureNpcPerception(copy, room.world, [event])
  j.activityQueue = []
  j.activityDiagnostics = []
  scheduleResponses(copy, [event])
  const trace = j.activityDiagnostics?.find((d) => d.npcId === n.id),
    task = j.jobs.find((j) => j.kind === 'npc' && j.npcId === n.id && !before.has(j.id))
  const reason =
    (source.kind === 'template' ? '预设模拟：' : '真实事件检查：') +
    (task ? '条件满足（检查本身未生成或发布）' : (trace?.reason ?? '无匹配模板'))
  const checkId = 'check:' + crypto.randomUUID()
  activityTrace(
    room,
    checkId,
    profileOf(room, n.id),
    source.kind === 'event' ? [event.id] : [],
    task ? 'eligible' : (trace?.status ?? 'blocked'),
    reason,
    trace?.characterId ?? null,
    trace?.templateId ?? null,
  )
  if (c.kind === 'npc-activity-check') return
  if (!task || task.kind !== 'npc') throw new RoomError(reason + '；没有可生成的测试对象')
  const actual = profileOf(room, n.id)
  if (!resolveModel(room, 'npc', actual).config) throw new RoomError('请先配置该 NPC 模型')
  const job = newNpcTask(
    room,
    member,
    actual,
    task.characterId,
    'proactive',
    '仅测试，不是真实剧情：' + event.text + '\n' + task.message,
    actual.goals,
    'personal',
    [],
  )
  job.activityTest = true
  job.testEvent = event
  activityTrace(
    room,
    checkId,
    actual,
    source.kind === 'event' ? [event.id] : [],
    'queued',
    '测试草稿已入队，禁止发布／执行',
    job.characterId,
    trace?.templateId ?? null,
    job.id,
  )
}
