import {systemMessage} from '../shared/localization/system-messages'
import { npcAbsent } from './scene-arrivals'
import { clone, type Catalogue } from './engine'
import { applyCombat, newEncounter, rebaseTurnExpiries } from './combat'
import { combatStats } from './combat-rules'
import { transferCompanions } from './companion-transfer'
import { npcBody, isNpcCharacter } from './npc-map'
import { adventureSnapshot } from './map'
import { appendBroadcast, gmAudience, publicAudience, newBroadcastSettings } from './broadcast'
import { defaultAdventureAi } from './ai'
import { validateOpening, openingCommand } from './battle-opening'
import { defaultEnvironment } from './combat-rules'
import type { Adventure, AdventureState, MapWorld, MapScene, MapToken } from './map-types'
import {attachSummon} from './summon-transactions'
import type { Encounter, Combatant, CombatCommand } from './combat-types'
import type {
  BattleState,
  BattleMapCommand,
  BattleParticipant,
  BattleHistory,
} from './battle-types'

export function battleState(a: Adventure): BattleState {
  return (a.battles ??= { presets: [], requests: [], history: [] })
}
export const battleHistoryKey = (h: BattleHistory) => h.id + ':' + (h.branchId ?? 'legacy')
export function mergeBattleHistory(...groups: BattleHistory[][]) {
  const result = [...new Map(groups.flat().map((h) => [battleHistoryKey(h), h])).values()]
  if (result.length > 1000) throw Error('战斗历史已达存储上限，请导出归档')
  return result
}
export function assertBattleHistoryCapacity(
  a: AdventureState,
  encounters: Encounter[],
  extra = 0,
  historyCount = a.battles?.history.length ?? 0,
) {
  const unfinished = encounters.filter(
    (e) =>
      e.phase !== 'ended' &&
      (e.session?.adventureId === a.id || a.scenes.some((s) => s.encounterId === e.id)),
  ).length
  if (historyCount + unfinished + extra > 1000)
    throw Error('历史已达存储上限，无法预留战斗完成名额；请取消闲置准备或导出归档')
}
export function isBattleCommand(c: { type: string }): c is BattleMapCommand {
  return c.type.startsWith('battle-')
}
export function playBattleIntro(a: Adventure, e: Encounter, actionId: string) {
  if (!e.session?.intro?.trim() || e.session.introPlayed) return
  appendBroadcast(a, actionId, {message:systemMessage('battle.intro'),
    category: 'preset',
    type: 'battle.intro',
    title: '战斗开场',
    text: e.session.intro,
    audience: publicAudience(),
    narration: 'direct',
    facts: { encounterId: e.id },
  })
  e.session.introPlayed = true
}
function validatePreset(a: Adventure, world: MapWorld, p: import('./battle-types').BattlePreset) {
  const scene = a.scenes.find((s) => s.id === p.sceneId)
  if (!scene) throw Error('预设场景不存在')
  if (new Set(p.participants.map((t) => t.kind + ':' + t.id)).size !== p.participants.length)
    throw Error('预设参战者重复')
  if(new Set(p.practical?.entry?.map(v=>v.npcId)).size!==(p.practical?.entry?.length??0))throw Error('预设NPC参战策略重复')
  for(const choice of p.practical?.entry??[]){const n=a.ai?.npcs.find(n=>n.id===choice.npcId&&n.sceneId===p.sceneId);if(!n||choice.mode==='judge'&&n.npcType!=='important'||!choice.allowedSides.length)throw Error('NPC参战策略来源或允许阵营无效')}
  for (const t of p.participants) {
    if (
      t.kind === 'npc' &&
      !a.ai?.npcs.some((n) => n.id === t.id && n.sceneId === scene.id && n.enabled)
    )
      throw Error('预设 NPC 已删除、停用或换场景，请更新名单')
    if (
      t.kind === 'character' &&
      !world.characters.some((c) => c.id === t.id && !isNpcCharacter(world, c.id))
    )
      throw Error('预设角色已不存在')
    if (
      t.kind === 'token' &&
      !scene.tokens.some(
        (token) =>
          token.id === t.id &&
          (token.npcBody || token.actorId) &&
          !token.npcId &&
          !token.characterId &&
          !token.companionKey,
      )
    )
      throw Error('预设 NPC 标记已不存在')
  }
}
export function assertBattleSettled(world: MapWorld) {
  if (world.encounters.some((e) => e.phase === 'active' && e.pending))
    throw Error('请先完成待结算伤害与反应')
  if (world.characters.some((c) => c.runtime?.concentration?.pendingDC))
    throw Error('请先处理待定专注豁免')
  if(world.encounters.some(e=>e.actors.some(actor=>actor.npc?.concentration?.pendingDC)||e.reactionParents?.length))throw Error('请先处理NPC专注豁免或嵌套反应')
  if(world.adventures.some(a=>a.m3?.events.some(e=>e.status==='pending')||a.sceneEffects?.hazards.some(h=>h.status==='pending')||a.sceneEffects?.m5?.resolutions.some(r=>r.status==='pending'||!!r.frame)||a.sceneEffects?.m5?.outcomes.some(r=>r.status==='pending')||a.summons?.events?.some(e=>e.status==='pending')||a.summons?.drafts.some(d=>d.status==='pending'&&!!d.battle)))throw Error('请先结算已发生的空间、区域、法术或召唤后果')
}
function companionKey(e: Encounter, t: Combatant) {
  if(t.companion?.instanceId)return 'summon-instance:'+t.companion.instanceId
  return t.companion
    ? `${e.actors.find((a) => a.id === t.companion!.ownerId)?.characterId}:${t.companion.source}:${t.companion.surgeId ?? ''}`
    : undefined
}
/** Preserve scene entities while removing only the current combat binding. */
export function detachBattle(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  e: Encounter,
  removing = false,
) {
  for (const n of a.ai?.npcs.filter((n) => n.sceneId === s.id) ?? []) {
    const body = npcBody(world, n)
    if (body && !n.characterId) {
      n.body = clone(body)
      n.revision++
    }
    if (removing && e.actors.some((t) => t.id === n.actorId)) {
      n.actorId = null
      n.revision++
    }
  }
  for (const t of s.tokens) {
    const actor = e.actors.find((a) => a.id === t.actorId)
    if (actor?.npc && !t.npcId) {
      t.npcBody = clone(actor.npc)
      t.npcSourceActorId = removing ? undefined : actor.id
      t.companionKey = companionKey(e, actor)
    }
    t.actorId = null
  }
  s.encounterId = null
  for (const r of a.battles?.requests ?? [])
    if (r.encounterId === e.id && r.openingStatus === 'waiting') {
      r.openingStatus = 'canceled'
      r.reviewReason += '；本次战斗已结束或取消，未执行主动行动失效'
    }
}
export function freezeBattle(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  e: Encounter,
  reason: string,
  legacy = false,
) {
  const state = battleState(a)
  if (e.session?.canceled) return
  if (state.history.some((h) => h.id === e.id && h.branchId === a.broadcastLog?.branchId)) return
  if (state.history.length >= 1000) throw Error('战斗历史已达 1000 条，请先导出归档并另建冒险')
  const encounter = clone(e),
    characters = clone(world.characters.filter((c) => e.actors.some((t) => t.characterId === c.id)))
  encounter.log.forEach((event) => (event.before = null))
  characters.forEach((c) => c.journal?.forEach((event) => (event.before = null)))
  e.session ??= {
    adventureId: a.id,
    sceneId: s.id,
    preparedAt: e.log[0]?.at ?? new Date().toISOString(),
    startedAt: null,
  }
  encounter.session = clone(e.session)
  state.history.push({
    branchId: a.broadcastLog?.branchId,
    id: e.id,
    sceneId: s.id,
    name: e.name,
    preparedAt: e.session.preparedAt,
    endedAt: new Date().toISOString(),
    reason,
    legacy,
    encounter,
    characters,
  })
}
function command(world: MapWorld, e: Encounter, cat: Catalogue, c: CombatCommand) {
  const next = applyCombat(e, world.characters, cat, c)
  world.characters = next.characters
  world.encounters[world.encounters.findIndex((t) => t.id === e.id)] = next.encounter
  return next.encounter
}
function participantActor(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  e: Encounter,
  p: BattleParticipant,
  cat: Catalogue,
) {
  let next = e
  if (p.kind === 'character') {
    if (
      !a.party.includes(p.id) ||
      isNpcCharacter(world, p.id) ||
      !s.tokens.some((t) => t.characterId === p.id)
    )
      throw Error('请选择本场景在场的玩家角色')
    next = command(world, e, cat, { type: 'add-character', characterId: p.id, side: p.side })
  } else if (p.kind === 'npc') {
    const n = a.ai?.npcs.find(
      (n) => n.id === p.id && n.sceneId === s.id && n.enabled && !npcAbsent(n),
    )
    if (!n) throw Error('NPC 不在当前场景或已停用')
    const body = npcBody(world, n)
    if (!n.characterId && !body) throw Error('NPC 尚未配置战斗数据')
    next = command(
      world,
      e,
      cat,
      n.characterId
        ? { type: 'add-character', characterId: n.characterId, side: p.side }
        : { type: 'add-npc', npc: clone(body!), side: p.side },
    )
    const actor = next.actors.at(-1)!
    actor.npcId=n.id
    n.actorId = actor.id
    n.revision++
    const marker = s.tokens.find(
      (t) => t.npcId === n.id || (n.characterId && t.characterId === n.characterId),
    )
    if (!marker) throw Error('NPC 缺少场景标记，请先保存 NPC 配置')
    marker.npcId = n.id
    marker.actorId = actor.id
    marker.characterId = n.characterId
  } else {
    const marker = s.tokens.find(
        (t) => t.id === p.id && !t.characterId && !t.npcId && !t.companionKey,
      ),
      body =
        world.encounters
          .flatMap((e) => e.actors)
          .find((t) => t.id === (marker?.actorId ?? marker?.npcSourceActorId))?.npc ??
        marker?.npcBody
    if (!marker || !body) throw Error('请选择场景中独立的 NPC 标记')
    next = command(world, e, cat, { type: 'add-npc', npc: clone(body), side: p.side })
    marker.actorId = next.actors.at(-1)!.id
  }
  const actor = next.actors.at(-1)!
  if (combatStats(actor, world.characters, cat).dead)
    throw Error('已死亡人物不能重新参战；如需复活请由 GM 明确裁定')
  if (p.initiative !== undefined)
    next = command(world, next, cat, {
      type: 'initiative',
      actorId: actor.id,
      value: p.initiative,
      surprised: false,
    })
  return next
}
export function addBattleParticipants(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  e: Encounter,
  participants: BattleParticipant[],
  cat: Catalogue,
) {
  if (!participants.length || participants.length > 100) throw Error('请选择 1–100 名参战者')
  const keys = participants.map((p) => p.kind + ':' + p.id)
  if (new Set(keys).size !== keys.length) throw Error('参战者重复')
  for (const p of participants) e = participantActor(world, a, s, e, p, cat)
  return e
}
function syncBattleMarkers(world: MapWorld, s: MapScene, e: Encounter) {
  for (const actor of e.actors) {
    if(actor.companion?.instanceId&&actor.companion.dismissed)continue
    const key = companionKey(e, actor)
    let token = s.tokens.find(
      (t) =>
        t.actorId === actor.id ||
        (actor.characterId && t.characterId === actor.characterId) ||
        (key && t.companionKey === key),
    )
    if (!token) {
      const position = Array.from({ length: s.grid.columns * s.grid.rows }, (_, i) => ({
        x: i % s.grid.columns,
        y: Math.floor(i / s.grid.columns),
      })).find(
        (p) =>
          !s.tokens.some(
            (t) => p.x >= t.x && p.x < t.x + t.span && p.y >= t.y && p.y < t.y + t.span,
          ) &&
          !s.regions.some((r) => r.tags.includes('blocked') && r.cells.includes(`${p.x},${p.y}`)),
      )
      if (!position) throw Error('场景没有可用标记落点')
      token = {
        id: crypto.randomUUID(),
        ...position,
        actorId: actor.id,
        characterId: actor.characterId,
        name:
          actor.npc?.name ?? world.characters.find((c) => c.id === actor.characterId)!.build.name,
        span: 1,
        hidden: false,
        color: '#a86c42',
        facing: 0,
      }
      s.tokens.push(token)
    }
    token.actorId = actor.id
    token.companionKey = key
  }
}
export function applyBattleCommand(
  world: MapWorld,
  a: Adventure,
  c: BattleMapCommand,
  cat: Catalogue,
  actionId: string = crypto.randomUUID(),
): string {
  const state = battleState(a),
    s = 'sceneId' in c ? a.scenes.find((s) => s.id === c.sceneId) : undefined
  const current = () => world.encounters.find((e) => e.id === s?.encounterId)
  if (
    ['battle-prepare', 'battle-finish', 'battle-cancel', 'battle-reinforce'].includes(c.type) &&
    (!s || a.activeSceneId !== s.id)
  )
    throw Error('请先进入本次战斗所在场景')
  if (c.type === 'battle-prepare') {
    assertBattleSettled(world)
    if (world.encounters.some((e) => e.phase === 'active'))
      throw Error('当前房间已有进行中的战斗；同场景请使用增援')
    const prior = current()
    if (prior?.phase === 'setup') throw Error('当前已有战斗准备，请开始或取消准备')
    if (prior) {
      freezeBattle(world, a, s!, prior, '旧版战斗迁移', !prior.session)
      detachBattle(world, a, s!, prior)
    }
    if (world.encounters.filter((e) => e.phase !== 'ended').length >= 20)
      throw Error('准备/运行战斗已达 20 个，请取消闲置草稿')
    if (state.history.length >= 1000 || world.encounters.length >= 1020)
      throw Error('战斗历史已达存储上限，请导出归档并另建冒险')
    assertBattleHistoryCapacity(a, world.encounters, 1)
    const snapshot = adventureSnapshot(a, world)
    snapshot.characters = clone(world.characters)
    const e = newEncounter(c.name.trim() || s!.name + '战斗'),
      at = new Date().toISOString()
    a.testBattle = {
      id: crypto.randomUUID(),
      battleId: e.id,
      sceneId: s!.id,
      name: e.name,
      at,
      snapshot,
      checkpoints: clone(a.checkpoints),
    }
    e.session = { adventureId: a.id, sceneId: s!.id, preparedAt: at, startedAt: null }
    if (c.presetId) {
      const preset = state.presets.find((p) => p.id === c.presetId)
      if (!preset || preset.sceneId !== s!.id) throw Error('预设不存在或不属于当前场景')
      validatePreset(a, world, preset)
      e.session.intro = preset.intro
    }
    world.encounters.push(e)
    s!.encounterId = e.id
    // Inactive NPC sources become scene state before a selected live actor replaces them.
    for (const n of a.ai?.npcs.filter((n) => n.sceneId === s!.id) ?? []) {
      const body = npcBody(world, n)
      if (body && !n.characterId) n.body = clone(body)
    }
    s!.tokens.forEach((t) => (t.actorId = null))
    const next = addBattleParticipants(world, a, s!, e, c.participants, cat)
    transferCompanions(next, world.encounters, world.characters,a.summons?.instances)
    for(const i of a.summons?.instances??[])if(i.position?.sceneId===s!.id&&i.state==='present'&&i.body)attachSummon(world,a,i,s!)
    syncBattleMarkers(world, s!, next)
    appendBroadcast(a, actionId, {
    message: systemMessage('battle.prepared',{name:e.name}),
      category: 'combat',
      type: 'battle.prepared',
      title: '战斗准备',
      text: 'GM 已准备战斗：' + e.name,
      audience: gmAudience(),
      narration: 'direct',
      facts: { encounterId: e.id },
    })
    return '准备战斗：' + e.name
  }
  if (c.type === 'battle-finish') {
    assertBattleSettled(world)
    let e = current()
    if (!e) throw Error('当前场景没有战斗')
    const legacy = !e.session
    if (e.phase === 'setup') throw Error('尚未开始，请使用取消准备')
    if (e.phase === 'active') e = command(world, e, cat, { type: 'end' })
    freezeBattle(world, a, s!, e, c.reason, legacy)
    detachBattle(world, a, s!, e)
    appendBroadcast(a, actionId, {
    message: systemMessage('battle.finished',{name:e.name}),
      category: 'combat',
      type: 'encounter.ended',
      title: '战斗结束',
      text: `${e.name}已结束，返回场景探索。`,
      audience: publicAudience(),
      facts: {
        encounterId: e.id,
        round: e.round,
        phase: 'ended',
        closedTurnId: `${e.id}:${e.tick}`,
        turnId: `${e.id}:${e.tick}`,
      },
    })
    return '结束并归档战斗：' + e.name + '；' + c.reason
  }
  if (c.type === 'battle-cancel') {
    assertBattleSettled(world)
    const e = current()
    if (!e || e.phase !== 'setup') throw Error('只能取消尚未开始的战斗准备')
    const preserveEntities = e.actors.some((t) => t.npc)
    if (preserveEntities) {
      // Keep the live entity source, without creating a completed battle-history entry.
      e.phase = 'ended'
      e.session ??= {
        adventureId: a.id,
        sceneId: s!.id,
        preparedAt: new Date().toISOString(),
        startedAt: null,
      }
      e.session.canceled = true
      e.log.forEach((l) => {
        l.before = null
      })
    }
    detachBattle(world, a, s!, e, !preserveEntities)
    if (!preserveEntities) world.encounters = world.encounters.filter((t) => t.id !== e.id)
    if (a.testBattle?.battleId === e.id) delete a.testBattle
    return '取消准备；保留人物与资源：' + c.reason
  }
  if (c.type === 'battle-reinforce') {
    assertBattleSettled(world)
    let e = current()
    if (!e || e.phase !== 'active') throw Error('增援需要当前正在进行的战斗')
    if (c.participants.some((p) => p.initiative === undefined))
      throw Error('请为每位新增参战者填写先攻')
    for (const p of c.participants) {
      const actorId =
        p.kind === 'character'
          ? p.id
          : p.kind === 'npc'
            ? a.ai?.npcs.find((n) => n.id === p.id)?.actorId
            : s!.tokens.find((t) => t.id === p.id)?.actorId
      if (e.actors.some((t) => t.id === actorId)) throw Error('该人物已在当前战斗中')
    }
    const oldIds = e.actors.map((t) => t.id),
      currentId = e.actors[e.current]!.id,
      round = e.round,
      tick = e.tick
    e.phase = 'setup'
    e = addBattleParticipants(world, a, s!, e, c.participants, cat)
    transferCompanions(e, world.encounters, world.characters,a.summons?.instances)
    const old = oldIds.map((id) => e!.actors.find((t) => t.id === id)!),
      added = e.actors.filter((t) => !oldIds.includes(t.id))
    for (const actor of added) {
      if (actor.companion && actor.initiative === null)
        actor.initiative = e.actors.find((t) => t.id === actor.companion!.ownerId)?.initiative ?? 0
      const index = old.findIndex((t) => (t.initiative ?? 0) < (actor.initiative ?? 0))
      old.splice(index < 0 ? old.length : index, 0, actor)
    }
    e.actors = old
    e.current = old.findIndex((t) => t.id === currentId)
    e.phase = 'active'
    e.round = round
    e.tick = tick
    rebaseTurnExpiries(e, oldIds, currentId, world.characters)
    syncBattleMarkers(world, s!, e)
    const publicAdded = added.filter((actor) =>
      s!.tokens.some(
        (t) =>
          !t.hidden &&
          (t.actorId === actor.id || (!!actor.characterId && t.characterId === actor.characterId)),
      ),
    )
    appendBroadcast(a, actionId, {
    message: systemMessage('battle.reinforced'),
      category: 'combat',
      type: 'battle.reinforced',
      title: '增援已加入',
      text: 'GM 已确认新的参战者加入当前战斗，原回合进度保持。',
      audience: publicAdded.length ? publicAudience() : gmAudience(),
      facts: {
        encounterId: e.id,
        round: e.round,
        turnId: `${e.id}:${e.tick}`,
        count: publicAdded.length,
      },
    })
    return '增援加入当前战斗：' + c.reason
  }
  if (c.type === 'battle-reset') {
    if (!c.confirmed || !c.reason.trim()) throw Error('请明确确认整份冒险恢复范围并填写原因')
    const point = a.testBattle
    if (!point) throw Error('没有本次战斗的测试恢复点，请先准备战斗')
    if (
      world.adventures.some(
        (other) =>
          other.id !== a.id &&
          other.activeSceneId &&
          other.party.some((id) => point.snapshot.characters.some((c) => c.id === id)),
      )
    )
      throw Error('其他活动冒险共享角色，不能整体回退')
    const ours = new Set([
      ...a.scenes.flatMap((s) => (s.encounterId ? [s.encounterId] : [])),
      ...world.encounters.filter((e) => e.session?.adventureId === a.id).map((e) => e.id),
    ])
    if (world.encounters.some((e) => e.phase === 'active' && !ours.has(e.id)))
      throw Error('存在其他活动战斗，不能覆盖其世界状态')
    const saved = clone(point.snapshot),
      history = clone(state.history),
      revision = a.revision
    assertBattleHistoryCapacity(
      saved.adventure,
      saved.encounters,
      0,
      mergeBattleHistory(saved.adventure.battles?.history ?? [], history).length,
    )
    for (const pack of saved.packs) {
      const installed = world.packs.find((p) => p.id === pack.id)
      if (installed && JSON.stringify(installed) !== JSON.stringify(pack))
        throw Error('恢复点规则包版本冲突')
      if (!installed) world.packs.push(clone(pack))
    }
    world.characters = saved.characters.map((c) => ({
      ...c,
      revision: (world.characters.find((t) => t.id === c.id)?.revision ?? c.revision) + 1,
      updatedAt: new Date().toISOString(),
    }))
    world.encounters = world.encounters.filter(
      (e) => !ours.has(e.id) && !saved.encounters.some((t) => t.id === e.id),
    )
    world.encounters.push(...saved.encounters)
    Object.assign(a, saved.adventure, {
      revision,
      ai: saved.adventure.ai ?? defaultAdventureAi(),
      broadcast: saved.adventure.broadcast ?? newBroadcastSettings(),
      battles: saved.adventure.battles ?? { presets: [], requests: [], history: [] },
    })
    const restored = battleState(a)
    restored.history = mergeBattleHistory(restored.history, history)
    a.checkpoints = clone(
      point.checkpoints ??
        a.checkpoints.filter(
          (cp) => cp.at <= point.at && a.scenes.some((s) => s.id === cp.sceneId),
        ),
    )
    restored.requests
      .filter((r) => r.status === 'pending')
      .forEach((r) => {
        r.status = 'rejected'
        r.reviewReason = '整体测试重置后旧请求失效，请重新提交'
      })
    delete a.testBattle
    a.log.forEach((event) => (event.before = null))
    world.characters.forEach((c) => c.journal?.forEach((event) => (event.before = null)))
    world.encounters.forEach((e) => e.log.forEach((event) => (event.before = null)))
    return '整体恢复战斗准备前的冒险：' + point.name + '；' + c.reason
  }
  if (c.type === 'battle-preset') {
    validatePreset(a, world, c.preset)
    const index = state.presets.findIndex((p) => p.id === c.preset.id)
    if (index < 0) {
      if (state.presets.length >= 100) throw Error('最多保存 100 个战斗预设')
      state.presets.push(clone(c.preset))
    } else state.presets[index] = clone(c.preset)
    return '保存战斗预设：' + c.preset.name
  }
  if (c.type === 'battle-preset-delete') {
    state.presets = state.presets.filter((p) => p.id !== c.presetId)
    a.scenes.forEach((s) =>
      s.points.forEach((p) => {
        if (p.battlePresetId === c.presetId) p.battlePresetId = null
      }),
    )
    state.requests
      .filter((r) => r.status === 'pending' && r.presetId === c.presetId)
      .forEach((r) => {
        r.status = 'rejected'
        r.reviewReason = '预设已删除'
      })
    return '删除战斗预设；人物和历史保留'
  }
  if (c.type === 'battle-request') {
    if (!s || a.activeSceneId !== s.id) throw Error('战斗请求必须在当前场景')
    if (c.opening) validateOpening(world, s, c.characterId, c.opening, cat)
    if (c.presetId) {
      const p = state.presets.find((p) => p.id === c.presetId)
      if (!p || p.sceneId !== s.id) throw Error('请求预设不存在或不属于当前场景')
    }
    if (
      state.requests.some(
        (r) =>
          r.status === 'pending' &&
          r.sceneId === s.id &&
          r.source === c.source &&
          r.sourceId === c.sourceId &&
          r.characterId === c.characterId &&
          r.presetId === (c.presetId ?? null),
      )
    )
      return '该来源已有待确认请求'
    while (state.requests.length >= 500) {
      const index = state.requests.findIndex((r) => r.status !== 'pending')
      if (index < 0) throw Error('待确认战斗请求已满')
      state.requests.splice(index, 1)
    }
    const id = crypto.randomUUID()
    state.requests.push({
      id,
      sceneId: s.id,
      at: new Date().toISOString(),
      name: c.name,
      reason: c.reason,
      source: c.source,
      sourceId: c.sourceId,
      characterId: c.characterId,
      presetId: c.presetId ?? null,
      status: 'pending',
      reviewReason: '',
      ...(c.opening ? { opening: clone(c.opening), openingStatus: 'waiting' as const } : {}),
    })
    appendBroadcast(a, actionId, {
    message: systemMessage('battle.requested',{name:c.name,reason:c.reason}),
      category: 'interaction',
      type: 'battle.requested',
      title: '待确认战斗请求',
      text: c.name + '：' + c.reason,
      audience: gmAudience(),
      narration: 'direct',
      facts: { requestId: id, source: c.source },
    })
    return '战斗/增援请求已提交，等待 GM 确认名单与先攻'
  }
  if (c.type === 'battle-request-review') {
    const r = state.requests.find((r) => r.id === c.requestId)
    if (!r || r.status !== 'pending') throw Error('请求不存在或已处理')
    if (!c.approve) {
      r.status = 'rejected'
      r.reviewReason = c.reason
      return 'GM 拒绝战斗请求：' + c.reason
    }
    const target = a.scenes.find((s) => s.id === r.sceneId),
      active = world.encounters.find((e) => e.id === target?.encounterId)
    if (!target || target.id !== a.activeSceneId)
      throw Error('请求场景已变化，请拒绝旧请求后重新发起')
    if (r.opening) validateOpening(world, target, r.characterId, r.opening, cat)
    if (r.presetId) {
      const preset = state.presets.find((p) => p.id === r.presetId)
      if (!preset) throw Error('请求预设已不存在')
      validatePreset(a, world, preset)
    }
    if (
      r.source === 'npc' &&
      !a.ai?.npcs.some((n) => n.id === r.sourceId && n.enabled && n.sceneId === target.id)
    )
      throw Error('提出请求的 NPC 已失效')
    if (
      r.source === 'point' &&
      !target.points.some((p) => p.id === r.sourceId && p.enabled) &&
      !target.arrivalGroups?.some((g) => g.id === r.sourceId && g.status === 'spawned')
    )
      throw Error('触发互动点已删除或停用')
    const arrival = target.arrivalGroups?.find((g) => g.id === r.sourceId)
    if (arrival?.battleMode === 'start' && active?.phase === 'active')
      throw Error('已有进行中战斗，请拒绝此开战申请并明确选择增援')
    if (arrival?.battleMode === 'reinforce' && active?.phase !== 'active')
      throw Error('没有进行中战斗，不能加入增援；请拒绝并重新准备战斗')
    if (active?.phase === 'active') {
      if (c.participants.length)
        applyBattleCommand(
          world,
          a,
          {
            type: 'battle-reinforce',
            sceneId: target.id,
            participants: c.participants,
            reason: c.reason,
          },
          cat,
          actionId,
        )
      else if (!r.opening) throw Error('请选择需要加入的增援')
    } else {
      if (active?.phase === 'setup')
        applyBattleCommand(
          world,
          a,
          { type: 'battle-cancel', sceneId: target.id, reason: 'GM 重新确认参战名单' },
          cat,
          actionId,
        )
      applyBattleCommand(
        world,
        a,
        {
          type: 'battle-prepare',
          sceneId: target.id,
          name:
            c.name ??
            (r.source === 'npc' &&
            (a.ai?.npcs.find((n) => n.id === r.sourceId)?.hidden ||
              target.tokens.some((t) => t.npcId === r.sourceId && t.hidden))
              ? target.name + '战斗'
              : r.name),
          participants: c.participants,
          ...(r.presetId ? { presetId: r.presetId } : {}),
        },
        cat,
        actionId,
      )
    }
    r.status = 'accepted'
    r.reviewReason = c.reason
    if (r.opening) {
      r.encounterId = target.encounterId ?? undefined
      openingCommand(
        r,
        target,
        world.encounters.find((e) => e.id === target.encounterId)!,
        defaultEnvironment(),
      )
    }
    return 'GM 已确认请求：' + c.reason
  }
  throw Error('未知战斗操作')
}
