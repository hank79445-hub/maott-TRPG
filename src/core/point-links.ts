import {systemMessage} from '../shared/localization/system-messages'
import {assertDoorClear} from './wide-door'
import type { MapScene, MapWorld, Adventure } from './map-types'
import type { PointLink, PointLinkRun } from '../persistence/point-link-schema'
import { pointLinkSchema } from '../persistence/point-link-schema'
import { clone, type Catalogue } from './engine'
import { assertPlacement, npcSpan } from './scene-tools'
import { triggerArrivals, npcAbsent } from './scene-arrivals'
import { appendBroadcast, gmAudience } from './broadcast'
export function validatePointLinks(s: MapScene) {
  if (new Set(s.pointLinks?.map((g) => g.id)).size !== (s.pointLinks?.length ?? 0))
    throw Error('关联组ID重复')
  for (const g of s.pointLinks ?? []) {
    pointLinkSchema.parse(g)
    if (!s.points.some((p) => p.id === g.sourcePointId))
      throw Error('关联来源互动点不存在：' + g.name)
    if (new Set(g.effects.map((e) => e.pointId)).size !== g.effects.length)
      throw Error('同组效果目标重复或矛盾，请合并为一个最终状态')
    for (const e of g.effects) {
      const p = s.points.find((p) => p.id === e.pointId)
      if (!p || p.id === g.sourcePointId) throw Error('关联目标无效：' + g.name)
      if (['open', 'close', 'unlock'].includes(e.operation) && p.kind !== 'door')
        throw Error('开关／解锁效果只能指向门')
    }
    if (g.arrivalGroupIds?.some((id) => !s.arrivalGroups?.some((a) => a.id === id)))
      throw Error('关联出场组不存在')
  }
}
export function applyPointLinkEffects(scene: MapScene, g: PointLink) {
  validatePointLinks({ ...scene, pointLinks: [g] })
  const next = clone(scene)
  for (const e of g.effects) {
    const p = next.points.find((p) => p.id === e.pointId)!
    if(e.operation==='close')assertDoorClear(next,p.id)
    if (e.operation === 'open') p.state = 'open'
    if (e.operation === 'close') p.state = 'closed'
    if (e.operation === 'unlock' && p.state === 'locked') p.state = 'closed'
    if (e.operation === 'reveal') p.hidden = false
    if (e.operation === 'enable') p.enabled = true
    for (const w of (next.walls ?? []).filter((w) => w.pointId === p.id))
      if (['open', 'closed', 'locked'].includes(p.state))
        w.state = p.state as 'open' | 'closed' | 'locked'
  }
  return next
}
function attempt(world: MapWorld, a: Adventure, s: MapScene, run: PointLinkRun, cat: Catalogue) {
  const g = s.pointLinks?.find((g) => g.id === run.groupId)
  try {
    if (!g) throw Error('关联组已删除')
    const transaction = clone(world),
      candidate = transaction.adventures.find((v) => v.id === a.id)!,
      targetScene = candidate.scenes.find((v) => v.id === s.id)!,
      next = applyPointLinkEffects(targetScene, g),
      provisional = { ...next, tokens: [...next.tokens] }
    for (const id of g.arrivalGroupIds ?? []) {
      const group = s.arrivalGroups?.find((g) => g.id === id)
      if (!group) throw Error('出场组不存在')
      if (group.status === 'spawned') continue
      for (const npcId of group.npcIds) {
        const n = a.ai?.npcs.find((n) => n.id === npcId && n.sceneId === s.id)
        if (!n || !n.enabled || !npcAbsent(n)) throw Error('待出场NPC无效')
        const span = npcSpan(n.body?.size)
        assertPlacement(provisional, n.position, span)
        provisional.tokens.push({
          id: n.id,
          npcId: n.id,
          characterId: n.characterId,
          actorId: null,
          ...n.position,
          span,
          name: n.name,
          hidden: n.hidden,
          color: g.color,
          facing: 0,
        })
      }
    }
    targetScene.points = next.points
    targetScene.walls = next.walls
    if (g.arrivalGroupIds?.length)
      triggerArrivals(
        transaction,
        candidate,
        targetScene,
        g.arrivalGroupIds,
        cat,
        run.id,
        run.sourceEventId,
      )
    if (
      g.arrivalGroupIds?.some(
        (id) => targetScene.arrivalGroups?.find((v) => v.id === id)?.status !== 'spawned',
      )
    )
      throw Error('关联出场尚未整组完成')
    run.status = 'completed'
    run.reason = '已整组应用'
    Object.assign(
      candidate.scenes.find((v) => v.id === s.id)!.linkRuns!.find((v) => v.id === run.id)!,
      run,
    )
    // Commit only after all effects, arrivals and battle requests have succeeded.
    Object.assign(a, candidate)
    world.characters = transaction.characters
    world.encounters = transaction.encounters
  } catch (err) {
    run.status = 'pending'
    run.reason = err instanceof Error ? err.message : '关联失败'
  }
  appendBroadcast(a, run.id + ':' + run.status, {message:systemMessage('audit.link'),
    category: 'interaction',
    type: 'point.link',
    title: '机关关联结果',
    text: (g?.name ?? '关联组') + '：' + run.reason,
    audience: gmAudience(),
    facts: { groupId: run.groupId, status: run.status },
  })
}
export function processPointLinks(world: MapWorld, a: Adventure, actionId: string, cat: Catalogue) {
  const events = (a.broadcastLog?.events ?? []).filter(
    (e) => e.actionId === actionId && e.type === 'point.result' && e.phase === 'confirmed' && typeof e.facts.success === 'boolean' && e.branchId === a.broadcastLog?.branchId,
  )
  for (const e of events) {
    const groupIds = a.scenes.find((s) => s.id === e.sceneId)?.pointLinks?.map((g) => g.id) ?? []
    for (const groupId of groupIds) {
      const s = a.scenes.find((s) => s.id === e.sceneId)!,
        g = s.pointLinks!.find((g) => g.id === groupId)!
      if (
        g.sourcePointId !== e.facts.pointId ||
        (g.outcome === 'success') !== (e.facts.success === true)
      )
        continue
      s.linkRuns ??= []
      if (s.linkRuns.some((r) => r.groupId === g.id && r.branchId === e.branchId)) continue
      const run: PointLinkRun = {
        id: crypto.randomUUID(),
        groupId: g.id,
        sourceEventId: e.id,
        branchId: e.branchId,
        status: 'pending',
        reason: '',
      }
      s.linkRuns.push(run)
      attempt(world, a, s, run, cat)
    }
  }
}
export function retryPointLink(
  world: MapWorld,
  a: Adventure,
  sceneId: string,
  runId: string,
  cat: Catalogue,
) {
  const s = a.scenes.find((s) => s.id === sceneId),
    run = s?.linkRuns?.find(
      (r) => r.id === runId && r.branchId === a.broadcastLog?.branchId && r.status === 'pending',
    )
  if (!s || !run) throw Error('待处理关联不存在或已完成')
  attempt(world, a, s, run, cat)
}
