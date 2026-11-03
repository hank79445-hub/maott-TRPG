import {systemMessage} from '../shared/localization/system-messages'
import { randomUUID } from 'node:crypto'
import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import type { NpcProfile, NpcDirective, NpcConversation, AiModelRequest } from '../core/ai-types'
import type { NpcSpatialTask, SpatialProposal } from '../persistence/npc-spatial-schema'
import { defaultSpatialPolicy, npcSpatialPolicySchema } from '../persistence/npc-spatial-schema'
import {
  npcSpatialObservation,
  spatialSource,
  spatialHash,
  captureNpcSpatial,
  npcCanSeeCell,
} from './npc-spatial-observation'
import { reachableNpcCells, npcCapabilities } from '../core/npc-strategy'
import { applyMap, distance, blocked, occupied, inside, pathCost } from '../core/map'
import { movementWalls } from '../core/map-spatial'
import { catalogue, clone } from '../core/engine'
import { srd } from '../content/srd'
import { RoomError, adventure, executeAction } from './room-engine'
import { newNpcTask } from './room-ai'
import { gmAudience, appendBroadcast } from '../core/broadcast'
import { selectNpcMemories } from './npc-memory'
import { heldNpc } from './gm-control'
import { executeRoomDice } from './room-dice'
import { assertDuelRoute, assertFrightenedRoute } from '../core/control-movement'
import { pointInteractor } from '../core/point-interactor'
import { pointItemPlan } from '../core/point-items'
import { explorationMember, assertExplorationReady, explorationSpend } from '../core/exploration'
import { rollDie } from '../core/runtime'
import { npcKnowledgeEntries } from '../core/npc-relationships'
import { m3Landing } from '../core/m3-world-cast'
import { reconcileSceneEffects, tokenPoint } from '../core/scene-effects'
import { regionContains } from '../core/scene-propagation'
import { practicalSpatialAllowed } from './practical-spatial'
import { practicalEnabled,practicalTask,practicalTransition } from './practical-review-state'

const branch = (room: Room) => adventure(room).broadcastLog?.branchId ?? 'legacy'
export function spatialProfile(room: Room, id: string) {
  const n = adventure(room).ai?.npcs.find((n) => n.id === id)
  if (!n || n.npcType !== 'important' || !n.spatialPolicy?.enabled)
    throw new RoomError('请先启用该重要NPC的空间代理')
  return n
}
export function assertSpatialReady(room: Room, n: NpcProfile) {
  const source = spatialSource(room, n)
  if (
    !npcSpatialObservation(room, n).available ||
    source.stats.conditions.some((c) =>
      ['incapacitated', 'unconscious', 'paralyzed', 'stunned', 'petrified'].includes(c),
    )
  )
    throw new RoomError('NPC当前没有可用的空间行动来源')
  if (heldNpc(room, n.id)) throw new RoomError('NPC已被GM接管，空间任务暂停')
  if (room.world.encounters.some((e) => e.id === source.scene?.encounterId && e.phase === 'active'))
    throw new RoomError('场景正在战斗中，探索任务暂停')
  if (
    room.world.encounters.some(
      (e) =>
        e.phase === 'active' &&
        e.actors.some(
          (a) => a.id === n.actorId || (!!n.characterId && a.characterId === n.characterId),
        ),
    )
  )
    throw new RoomError('NPC正在战斗中，请使用原回合规划')
  if (
    source.token?.spatial &&
    (source.token.spatial.layer !== 'material' || source.token.spatial.height !== 0)
  )
    throw new RoomError('特殊空间／高度移动请由GM接管')
  if (
    source.a.m3?.events.some(
      (e) =>
        e.status === 'pending' &&
        [n.id, n.characterId, n.actorId, source.token?.id].includes(e.entityId),
    ) ||
    source.a.sceneEffects?.hazards.some((e) => e.status === 'pending')
  )
    throw new RoomError('存在待输入或待结算后果，空间任务暂停')
  return source
}
function state(room: Room) {
  captureNpcSpatial(room)
  return adventure(room).ai!.spatialState!
}
function task(room: Room, id: string) {
  const t = state(room).tasks.find((t) => t.id === id && t.branchId === branch(room))
  if (!t) throw new RoomError('空间任务不存在或分支已变化')
  return t
}
export function spatialRoute(
  room: Room,
  n: NpcProfile,
  destination: { x: number; y: number },
  maxFeet?: number,
) {
  const { scene, token, stats } = assertSpatialReady(room, n)
  const max = Math.min(maxFeet ?? stats.speed, stats.speed)
  const view = npcSpatialObservation(room, n)
  if (
    !npcCanSeeCell(room, n, destination) &&
    !view.lastSeen.some((p) => p.x === destination.x && p.y === destination.y)
  )
    throw new RoomError('目的地不在当前可见或最后所见范围')
  const known = clone(scene!)
  known.walls = known.walls?.filter((w) => !w.hidden)
  known.regions = known.regions.filter((r) => !r.hidden)
  const visible = new Set(view.units.map((u) => u.id))
  known.tokens = known.tokens.filter((t) => visible.has(t.id))
  const route = reachableNpcCells(known, token!, Math.max(0, max)).find(
    (p) => p.x === destination.x && p.y === destination.y,
  )
  if (!route) throw new RoomError('当前路径不可执行；请调整目的地或交GM处理')
  return { destination, cost: route.cost, path: route.path }
}
export function proposeSpatial(
  room: Room,
  n: NpcProfile,
  observation: string,
  receipt: string,
  proposal: SpatialProposal,
) {
  const s = state(room),
    fingerprint = spatialHash(proposal),
    old = s.tasks.find(
      (t) => t.npcId === n.id && t.receipt === receipt && t.branchId === branch(room),
    )
  if (old) {
    if (old.fingerprint !== fingerprint) throw new RoomError('同一请求编号不能替换行为')
    return old
  }
  const source = assertSpatialReady(room, n),
    view = npcSpatialObservation(room, n)
  if (view.version !== observation) throw new RoomError('观察已变化，请重新观测', 409)
  if (s.tasks.some((t) => t.npcId === n.id && !['completed', 'canceled'].includes(t.status)))
    throw new RoomError('该NPC已有空间任务，请先暂停并取消或完成')
  if (proposal.kind === 'move') {
    if (!proposal.destination) throw new RoomError('移动需要目的地')
    spatialRoute(room, n, proposal.destination)
  } else {
    const visible = view.points.find((p) => p.id === proposal.pointId),
      known = view.exits.some((k) => k.pointId === proposal.pointId && k.sceneId === n.sceneId)
    if (!visible && !(proposal.kind === 'travel' && known))
      throw new RoomError('目标不在NPC当前可感知或获准的范围')
    if (
      proposal.kind === 'interact' &&
      (!proposal.operation || !visible?.operations.includes(proposal.operation))
    )
      throw new RoomError('互动操作不适用于目标')
    if (proposal.kind === 'travel' && !known) throw new RoomError('NPC尚未获知该出口路线')
  }
  s.tasks = s.tasks.filter(
    (t) =>
      !['completed', 'canceled'].includes(t.status) || s.tasks.indexOf(t) > s.tasks.length - 60,
  )
  if (s.tasks.length >= 100) throw new RoomError('空间任务列表已满，请先清理已完成任务')
  const policy = n.spatialPolicy!,
    automatic = proposal.kind === 'move' && policy.autoMove || practicalSpatialAllowed(room,n,proposal)
  const created: NpcSpatialTask = {
    id: randomUUID(),
    npcId: n.id,
    branchId: branch(room),
    sceneId: n.sceneId,
    profileRevision: n.revision,
    receipt,
    fingerprint,
    observation,
    proposal: clone(proposal),
    status: automatic ? 'ready' : 'review',
    approved: automatic,
    reason: automatic ? 'GM已明确授权此范围；实际资源、路径与对象仍逐步复验' : '等待GM批准',
    origin: { x: source.token!.x, y: source.token!.y },
    current: { x: source.token!.x, y: source.token!.y },
    steps: 0,
    spentFeet: 0,
    maxFeet: Math.min(source.stats.speed, policy.maxSteps * source.scene!.grid.feet),
  }
  s.tasks.push(created)
  if(practicalEnabled(room,'exploration')){const t=practicalTask(room,{domain:'exploration',sourceId:created.id,phase:'spatial',label:'NPC探索任务',basis:'script'});if(t)practicalTransition(t,automatic?'ready':'needs-gm',created.reason)}
  return created
}
function transferNpc(room: Room, n: NpcProfile, proposal: SpatialProposal) {
  const pointId = proposal.pointId!
  const { a, scene, token, stats, actor } = assertSpatialReady(room, n),
    policy = n.spatialPolicy!
  if (!policy.independentTravel || n.importanceRole === 'resident' || n.followParty)
    throw new RoomError('居民／随队NPC不能独立旅行；请GM明确调整身份与旅行授权')
  const p = scene!.points.find((p) => p.id === pointId),
    to = a.scenes.find((s) => s.id === p?.targetSceneId),
    q = to?.points.find((q) => q.id === p?.portal?.targetPointId)
  if (
    !p ||
    !p.enabled ||
    p.hidden ||
    p.kind !== 'exit' ||
    ['closed', 'resolved', 'disarmed'].includes(p.state) ||
    !q?.portal?.arrival ||
    !q.enabled ||
    q.hidden ||
    q.kind !== 'exit' ||
    ['locked', 'closed'].includes(q.state)
  )
    throw new RoomError('出口当前不可通行或缺少合法配对')
  if (room.world.encounters.some((e) => e.id === to!.encounterId && e.phase === 'active'))
    throw new RoomError('目标场景正在战斗，请GM处理入场')
  // Party entry owns these side effects. Independent NPC travel must never skip
  // a lock/device or fire a party-level story/arrival chain as a side effect.
  if (
    p.battlePresetId ||
    p.arrivalGroupIds?.length ||
    p.failureArrivalGroupIds?.length ||
    p.storyResults?.length ||
    scene!.pointLinks?.some((g) => g.sourcePointId === p.id) ||
    a.sceneEffects?.regions.some(
      (e) =>
        e.status === 'active' &&
        e.magic &&
        ((e.sceneId === scene!.id && (e.magic.pointId === p.id || e.anchor.id === p.id)) ||
          (e.sceneId === to!.id && (e.magic.pointId === q.id || e.anchor.id === q.id))),
    )
  )
    throw new RoomError('出口附带额外规则或剧情联动，请GM通过原入口接管结算')
  if (
    !policy.knownExits.some((k) => k.sceneId === scene!.id && k.pointId === p.id) ||
    !npcSpatialObservation(room, n).points.some((v) => v.id === p.id) ||
    distance(scene!, token!, p) > p.range
  )
    throw new RoomError('请先抵达已知出口的可互动范围')
  if (movementWalls(scene!, token!, token!, p).length) throw new RoomError('当前通行路径不可执行')
  const arrival = q.portal.arrival,
    allowed = new Set(arrival.cells),
    queue = [arrival.anchor],
    visited = new Set<string>(),
    candidates: { x: number; y: number }[] = []
  while (queue.length) {
    const v = queue.shift()!,
      key = v.x + ',' + v.y
    if (visited.has(key) || !allowed.has(key) || !inside(to!, v) || blocked(to!, v)) continue
    visited.add(key)
    candidates.push(v)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: v.x + dx!, y: v.y + dy! }
      if (!movementWalls(to!, token!, v, next).length) queue.push(next)
    }
  }
  const landing = candidates.find((v) =>
    occupied({ ...token!, ...v }).every(
      (c) =>
        allowed.has(c.x + ',' + c.y) &&
        inside(to!, c) &&
        !blocked(to!, c) &&
        !to!.tokens.some((t) => occupied(t).some((o) => o.x === c.x && o.y === c.y)),
    ),
  )
  if (!landing || stats.speed <= 0) throw new RoomError('目标到达区无可用落点或NPC不能移动')
  m3Landing(to!, token!, { ...landing, height: 0 })
  const arrived = { ...token!, ...landing }
  if (
    occupied(arrived).some((c) =>
      to!.regions.some((r) => r.tags.includes('danger') && r.cells.includes(c.x + ',' + c.y)),
    ) ||
    a.m3?.environments.some((e) => e.sceneId === to!.id && e.floorHeight !== 0) ||
    a.sceneEffects?.regions.some(
      (e) =>
        e.status === 'active' &&
        (e.terrain || e.magic || e.m5) &&
        occupied(arrived).some((c) =>
          regionContains(room.world, a, to!, e, tokenPoint({ ...arrived, ...c, span: 1 })),
        ),
    )
  )
    throw new RoomError('目标到达区需要额外规则结算，请GM接管入场')
  const cat = catalogue([srd, ...room.world.packs]),
    person = pointInteractor(room.world, a, scene!, n.characterId ?? '', n.id, cat, rollDie)
  const items = pointItemPlan(p, person.quantity, proposal.itemIds, proposal.confirmItemCosts)
  if (p.state === 'locked' && !items.open && !p.check)
    throw new RoomError('出口锁定且物品条件未满足')
  if (
    p.check &&
    ['locked', 'ready'].includes(p.state) &&
    !items.open &&
    proposal.operation !== 'check'
  )
    throw new RoomError('出口需要明确申请已配置的检定')
  const budget = explorationMember(a, token!.id)
  if (a.exploration?.status === 'active' && !budget)
    throw new RoomError('NPC未加入当前探索名单，请GM先安排')
  if (budget) {
    assertExplorationReady(room.world, a, budget, cat)
    explorationSpend(
      budget,
      p.cost === 'free' ? (budget.interaction ? 'interaction' : 'action') : p.cost,
    )
    a.exploration!.acted = true
    budget.trail = []
  }
  for (const item of items.attempt) person.remove(item.itemId, item.quantity)
  if (p.consume) person.remove(p.consume.itemId, p.consume.quantity)
  if (p.resource) person.resource(p.resource.id, p.resource.amount)
  const checked =
    p.check && proposal.operation === 'check' && !items.open ? person.check(p.check) : undefined
  if (checked && !checked.success) {
    appendBroadcast(a, randomUUID(), {
    message: systemMessage('npc.travel.failed',{actor:n.name}),
      category: 'resolution',
      type: 'npc.travel.check',
      title: 'NPC出口检定已结算',
      text: n.name + '未能通过出口检定，留在原场景。',
      sceneId: scene!.id,
      audience: gmAudience(),
      facts: { npcId: n.id, pointId: p.id, success: false, adjudicated: true },
    })
    room.worldRevision++
    return { success: false, pointId: p.id, state: p.state, sceneId: scene!.id }
  }
  for (const item of items.success) person.remove(item.itemId, item.quantity)
  const old = scene!.tokens.find((t) => t.id === token!.id)!
  if (!n.characterId && actor?.npc) n.body = clone(actor.npc)
  scene!.tokens = scene!.tokens.filter((t) => t.id !== old.id)
  to!.tokens.push({
    ...old,
    ...landing,
    actorId: null,
    ...(!n.characterId && n.body ? { npcBody: clone(n.body) } : {}),
  })
  n.sceneId = to!.id
  n.position = { ...landing }
  n.actorId = null
  n.revision++
  reconcileSceneEffects(room.world)
  appendBroadcast(a, randomUUID(), {
    message: systemMessage('npc.travel',{actor:n.name}),
    category: 'progress',
    type: 'npc.travel',
    title: 'NPC独立转场',
    text: n.name + '通过已确认出口转移场景。',
    sceneId: scene!.id,
    audience: gmAudience(),
    facts: { npcId: n.id, fromSceneId: scene!.id, toSceneId: to!.id, adjudicated: true },
  })
  room.worldRevision++
  return { success: true, pointId: p.id, sceneId: to!.id }
}
export function advanceSpatial(room: Room, member: RoomMember, id: string) {
  const t = task(room, id)
  if (['completed', 'canceled'].includes(t.status)) return
  if (!t.approved || t.status !== 'ready') throw new RoomError('请先批准或恢复空间任务')
  const n = spatialProfile(room, t.npcId),
    source = assertSpatialReady(room, n)
  if (
    room.dice?.pending.some(
      (p) =>
        p.branchId === branch(room) &&
        !(
          p.command.kind === 'npc-spatial' &&
          'taskId' in p.command.command &&
          p.command.command.taskId === id
        ),
    )
  )
    throw new RoomError('请先处理待输入骰组')
  if (
    t.profileRevision !== n.revision ||
    n.sceneId !== t.sceneId ||
    t.current.x !== source.token!.x ||
    t.current.y !== source.token!.y
  )
    throw new RoomError('NPC配置或位置已变化，请重新规划')
  if (t.proposal.kind === 'move') {
    if (t.steps >= n.spatialPolicy!.maxSteps) throw new RoomError('任务步数已用完')
    const route = spatialRoute(
      room,
      n,
      t.proposal.destination!,
      Math.max(0, Math.min(t.maxFeet, source.stats.speed) - t.spentFeet),
    )
    if (!route.path.length) {
      t.status = 'completed'
      t.reason = '已抵达'
      return
    }
    const next = route.path[0]!,
      cost = pathCost(
        source.scene!,
        source.token!,
        [next],
        false,
        source.stats.conditions.includes('prone'),
        undefined,
        { world: room.world, adventure: source.a },
      )
    if (t.spentFeet + cost > t.maxFeet) throw new RoomError('当前任务移动预算不足')
    if (
      source.scene!.regions.some(
        (r) => r.cells.includes(next.x + ',' + next.y) && r.tags.includes('danger'),
      )
    )
      throw new RoomError('路线进入危险区域，请GM接管')
    const effects = source.stats.effects
    assertDuelRoute(room.world, source.scene!, source.token!, [next], effects)
    if (source.stats.conditions.includes('frightened'))
      assertFrightenedRoute(room.world, source.scene!, source.token!, [next], effects)
    const active = source.a.activeSceneId,
      world = clone(room.world),
      a = world.adventures[0]!
    a.activeSceneId = t.sceneId
    const result = applyMap(
      world,
      a.id,
      {
        type: 'move',
        sceneId: t.sceneId,
        tokenId: source.token!.id,
        path: [next],
        gm: false,
        reason: 'NPC已批准的有限探索移动',
        reactionsConfirmed: false,
      },
      source.cat,
    )
    result.adventures[0]!.activeSceneId = active
    room.world = result
    room.worldRevision++
    const updated = adventure(room).ai!.spatialState!.tasks.find((v) => v.id === id)!,
      token = adventure(room)
        .scenes.find((s) => s.id === t.sceneId)!
        .tokens.find((v) => v.id === source.token!.id)!
    updated.current = { x: token.x, y: token.y }
    if (token.x !== t.current.x || token.y !== t.current.y) {
      updated.steps++
      updated.spentFeet += cost
    } else {
      updated.status = 'paused'
      updated.reason = '移动在实际触发点暂停；请先处理发现或区域后果'
    }
    const profile = adventure(room).ai!.npcs.find((p) => p.id === n.id)!
    profile.position = { ...updated.current }
    if (token.x === t.proposal.destination!.x && token.y === t.proposal.destination!.y) {
      updated.status = 'completed'
      updated.reason = '已抵达'
    }
  } else if (t.proposal.kind === 'travel') {
    t.outcome = transferNpc(room, n, t.proposal)
    t.status = 'completed'
    t.reason = t.outcome.success ? '转场已完成' : '出口检定未通过，留在原场景'
  } else {
    const view = npcSpatialObservation(room, n)
    if (!view.points.some((p) => p.id === t.proposal.pointId))
      throw new RoomError('互动目标已不可感知')
    // The original reducer owns items, costs, checks and manual dice; no raw state patch.
    const active = source.a.activeSceneId,
      world = clone(room.world),
      a = world.adventures[0]!,
      after = source.a.broadcastLog?.nextSequence ?? 1
    a.activeSceneId = n.sceneId
    const result = applyMap(
      world,
      a.id,
      {
        type: 'interact',
        sceneId: n.sceneId,
        npcId: n.id,
        characterId: n.characterId ?? '',
        pointId: t.proposal.pointId!,
        operation: t.proposal.operation!,
        gm: false,
        itemIds: t.proposal.itemIds,
        confirmItemCosts: t.proposal.confirmItemCosts,
        reason: t.proposal.detail ?? 'NPC互动已批准',
      },
      source.cat,
    )
    result.adventures[0]!.activeSceneId = active
    room.world = result
    room.worldRevision++
    const updated = adventure(room).ai!.spatialState!.tasks.find((v) => v.id === id)!
    updated.status = 'completed'
    updated.reason = '互动已结算'
    const event = adventure(room).broadcastLog?.events.find(
      (e) =>
        e.sequence >= after &&
        e.type === 'point.result' &&
        e.facts.npcId === n.id &&
        e.facts.pointId === t.proposal.pointId,
    )
    updated.outcome = {
      pointId: t.proposal.pointId,
      state: adventure(room)
        .scenes.find((s) => s.id === n.sceneId)
        ?.points.find((p) => p.id === t.proposal.pointId)?.state,
      ...(typeof event?.facts.success === 'boolean' ? { success: event.facts.success } : {}),
    }
  }
}
export function executeSpatialCommand(room: Room, member: RoomMember, command: RoomCommand) {
  if (command.kind !== 'npc-spatial') return false
  if (member.role !== 'gm' || member.revoked) throw new RoomError('空间代理管理需要有效GM身份', 403)
  const c = command.command
  if (c.operation === 'configure') {
    const n = adventure(room).ai?.npcs.find((n) => n.id === c.npcId)
    if (!n || n.npcType !== 'important') throw new RoomError('请选择重要NPC')
    const policy = npcSpatialPolicySchema.parse(c.policy)
    for (const k of policy.knownExits)
      if (
        !adventure(room)
          .scenes.find((s) => s.id === k.sceneId)
          ?.points.some((p) => p.id === k.pointId && p.kind === 'exit')
      )
        throw new RoomError('已知出口引用不存在')
    n.spatialPolicy = policy
    n.revision++
    for (const t of adventure(room).ai?.spatialState?.tasks ?? [])
      if (t.npcId === n.id && !['completed', 'canceled'].includes(t.status)) {
        t.status = 'paused'
        t.approved = false
        t.reason = '配置已变化，请取消旧任务后重新规划'
      }
  } else if (c.operation === 'observe') {
    spatialProfile(room, c.npcId)
    captureNpcSpatial(room)
    state(room).reportNpcId = c.npcId
  } else if (c.operation === 'propose') {
    const n = spatialProfile(room, c.npcId)
    proposeSpatial(room, n, c.observation, c.receipt, c.proposal)
  } else if (c.operation === 'cancel-plan') {
    const job = adventure(room).aiLog?.jobs.find(
      (j) => j.id === c.jobId && j.kind === 'npc' && j.spatialPlanning,
    )
    if (!job) throw new RoomError('探索规划不存在')
    job.status = 'canceled'
    job.attempt = null
  } else if (c.operation === 'plan') {
    const n = spatialProfile(room, c.npcId)
    assertSpatialReady(room, n)
    if (n.controller !== 'model') throw new RoomError('请将NPC控制方式设为模型')
    if (
      adventure(room).aiLog?.jobs.some(
        (j) =>
          j.kind === 'npc' &&
          j.npcId === n.id &&
          j.spatialPlanning &&
          ['queued', 'running'].includes(j.status),
      )
    )
      throw new RoomError('该NPC已有探索规划任务')
    for (const j of adventure(room).aiLog?.jobs ?? [])
      if (
        j.kind === 'npc' &&
        j.npcId === n.id &&
        j.spatialPlanning &&
        ['draft', 'fallback', 'interrupted'].includes(j.status)
      ) {
        j.status = 'canceled'
        j.attempt = null
      }
    const job = newNpcTask(
      room,
      member,
      n,
      n.characterId ?? adventure(room).party[0] ?? n.id,
      'proactive',
      '空间探索规划',
      n.spatialPolicy!.goal || n.goals,
    )
    job.spatialPlanning = true
  } else {
    const t = task(room, c.taskId)
    if (['completed', 'canceled'].includes(t.status)) return true
    if (c.operation === 'approve') {
      const n = spatialProfile(room, t.npcId)
      assertSpatialReady(room, n)
      if (n.revision !== t.profileRevision || n.sceneId !== t.sceneId)
        throw new RoomError('任务来源已变化')
      t.approved = true
      t.status = 'ready'
      t.reason = 'GM已批准'
    } else if (c.operation === 'pause') {
      t.status = 'paused'
      t.reason = 'GM暂停'
    } else if (c.operation === 'cancel') {
      t.status = 'canceled'
      t.reason = 'GM取消；已执行费用保留'
      if (room.dice)
        room.dice.pending = room.dice.pending.filter(
          (p) =>
            !(
              p.command.kind === 'npc-spatial' &&
              'taskId' in p.command.command &&
              p.command.command.taskId === t.id
            ),
        )
    } else if (c.operation === 'resume') {
      if (!t.approved) throw new RoomError('请重新批准任务')
      t.status = 'ready'
      t.reason = 'GM恢复'
    } else advanceSpatial(room, member, t.id)
  }
  captureNpcSpatial(room)
  return true
}
export function spatialDirective(
  room: Room,
  member: RoomMember,
  n: NpcProfile,
  d: NpcDirective,
  receipt: string,
) {
  if (!['interact', 'travel'].includes(d.kind)) return false
  const view = npcSpatialObservation(room, n)
  const t = proposeSpatial(room, n, view.version, receipt, {
    kind: d.kind as 'interact' | 'travel',
    pointId: d.pointId,
    operation: d.operation,
    itemIds: d.itemIds,
    confirmItemCosts: d.confirmItemCosts,
    detail: d.detail,
  })
  if (!['completed', 'canceled'].includes(t.status)) {
    t.approved = true
    t.status = 'ready'
    advanceSpatial(room, member, t.id)
  }
  return true
}
export function spatialModelRequest(
  room: Room,
  n: NpcProfile,
  job: NpcConversation,
): AiModelRequest {
  const observation = npcSpatialObservation(room, n),
    memory = selectNpcMemories(n, job, room)
  const ownKnowledge = npcKnowledgeEntries(adventure(room).ai, n, false).filter(
    (k) => !memory.fixed.some((m) => m.id === k.id),
  )
  job.spatialObservation = observation.version
  return {
    kind: 'npc',
    system:
      '你只规划一个NPC的有限探索目标。只依据自己的知识与观察。返回JSON {text:"私有规划说明",proposal:{kind:"none"|"move"|"interact"|"travel",destination?:{x,y},pointId?:string,operation?:"use"|"toggle"|"check"|"claim",detail?:string},reason:string}。不可代替GM批准，不宣布成功；move由程序寻路，不逐格规划。看不见的目标只有lastSeen，不当作当前位置；未知出口不能选择。有出口检定时operation=check；只有自己的supplies可用，itemIds填写实际itemId，可能消耗时须confirmItemCosts:true并等待GM。不要输出公开台词。',
    input: {
      npc: {
        id: n.id,
        name: n.name,
        goals: job.goal,
        strategy: n.strategy,
        knowledge: n.knowledge,
        secrets: n.secrets,
        worldKnowledge: ownKnowledge,
        fixedMemories: memory.fixed,
      },
      observation,
      experiences: [...memory.experiences, ...memory.archived],
      olderSummary: memory.olderSummary,
      policy: n.spatialPolicy,
    },
  }
}
export function acceptSpatialPlan(room: Room, job: NpcConversation) {
  const n = spatialProfile(room, job.npcId),
    d = job.proposal
  if (job.spatialObservation !== npcSpatialObservation(room, n).version)
    throw new RoomError('探索规划依据的观察已变化，请重新规划', 409)
  if (d.kind !== 'none') {
    if (!['move', 'interact', 'travel'].includes(d.kind))
      throw new RoomError('探索规划只允许移动、互动或已知路线旅行')
    proposeSpatial(room, n, npcSpatialObservation(room, n).version, 'model:' + job.id, {
      kind: d.kind as SpatialProposal['kind'],
      destination: d.destination,
      pointId: d.pointId,
      operation: d.operation,
      itemIds: d.itemIds,
      confirmItemCosts: d.confirmItemCosts,
      detail: d.detail,
    })
  }
  job.status = 'published'
  job.reason += '；私有规划已转空间任务，不发布对白'
}
/** One bounded step per accepted room command; idle wall time never generates movement or model calls. */
export function advanceAutomaticSpatial(room: Room, member: RoomMember) {
  if(room.gmReview?.settings.practical?.enabled&&!practicalEnabled(room,'exploration'))return
  if (room.dice?.pending.some((p) => p.branchId === branch(room))) return
  const candidates =
    adventure(room).ai?.spatialState?.tasks.filter(
      (t) =>
        t.status === 'ready' &&
        t.approved &&
        !room.practicalReview?.tasks.some(v=>v.sourceId===t.id&&v.domain==='exploration'&&['needs-gm','paused','stale','canceled'].includes(v.status)) &&
        (()=>{const n=adventure(room).ai?.npcs.find((n)=>n.id===t.npcId);return !!n&&(t.proposal.kind==='move'&&n.spatialPolicy?.autoMove||practicalSpatialAllowed(room,n,t.proposal))})(),
    ) ?? []
  const t = candidates.sort((a, b) => a.steps - b.steps)[0]
  if (!t) return
  const gm = room.members.find((m) => m.role === 'gm' && !m.revoked)
  if (!gm) return
  try {
    executeRoomDice(room, gm, {
      kind: 'npc-spatial',
      command: { operation: 'advance', taskId: t.id },
    })
    const current=adventure(room).ai?.spatialState?.tasks.find(v=>v.id===t.id),ledger=room.practicalReview?.tasks.find(v=>v.sourceId===t.id&&v.domain==='exploration')
    if(current&&ledger)practicalTransition(ledger,current.status==='completed'?'committed':room.dice?.pending.length?'waiting-dice':'ready',current.reason)
  } catch (error) {
    const current = adventure(room).ai?.spatialState?.tasks.find((v) => v.id === t.id)
    if (current) {
      current.status = 'paused'
      current.reason = '执行条件已变化，请GM核对路径、来源及待结算事项'
    }
    const ledger=room.practicalReview?.tasks.find(v=>v.sourceId===t.id&&v.domain==='exploration')
    if(ledger)practicalTransition(ledger,'needs-gm',error instanceof Error?error.message:'空间操作条件已变化')
  }
}
export function scheduleSpatialPlanning(room: Room) {
  const a = adventure(room),
    gm = room.members.find((m) => m.role === 'gm' && !m.revoked)
  if (!gm || !a.ai?.settings.enabled) return
  captureNpcSpatial(room)
  const s = a.ai.spatialState
  if (!s) return
  s.decisions ??= []
  // At most one new decision per transaction and a GM-visible per-scene cap.
  for (const n of a.ai.npcs.filter(
    (n) =>
      n.enabled &&
      n.npcType === 'important' &&
      n.controller === 'model' &&
      n.spatialPolicy?.enabled &&
      n.spatialPolicy.autoPlan &&
      n.spatialPolicy.goal.trim(),
  )) {
    if (
      s.tasks.some((t) => t.npcId === n.id && !['completed', 'canceled'].includes(t.status)) ||
      a.aiLog?.jobs.some(
        (j) =>
          j.kind === 'npc' &&
          j.npcId === n.id &&
          !['published', 'canceled', 'rejected', 'stale'].includes(j.status),
      )
    )
      continue
    try {
      assertSpatialReady(room, n)
    } catch {
      continue
    }
    const observation = npcSpatialObservation(room, n),
      row = s.decisions.find((r) => r.npcId === n.id && r.sceneId === n.sceneId)
    if (row && (row.version === observation.version || row.count >= n.spatialPolicy!.plansPerScene))
      continue
    if (!row && s.decisions.length >= 500) continue
    let job: NpcConversation
    try {
      job = newNpcTask(
        room,
        gm,
        n,
        n.characterId ?? a.party[0] ?? n.id,
        'proactive',
        '事件驱动的有限探索规划',
        n.spatialPolicy!.goal,
      )
    } catch {
      continue
    }
    if (row) {
      row.version = observation.version
      row.count++
    } else
      s.decisions.push({ npcId: n.id, sceneId: n.sceneId, count: 1, version: observation.version })
    job.spatialPlanning = true
    break
  }
}
