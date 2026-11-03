import {systemMessage} from '../shared/localization/system-messages'
import type { Adventure, MapWorld, MapScene } from './map-types'
import type { NpcProfile } from './ai-types'
import { assertPlacement, npcSpan } from './scene-tools'
import { syncNpcTokens } from './npc-map'
import { applyBattleCommand } from './battle'
import { appendBroadcast, gmAudience, publicAudience } from './broadcast'
import type { Catalogue } from './engine'
import { validateSpecialWeapon } from './special-weapons'
import { clone } from './engine'
export const npcAbsent = (n: Pick<NpcProfile, 'initiallyAbsent' | 'appeared'>) =>
  !!n.initiallyAbsent && !n.appeared
export function triggerArrivals(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  ids: string[],
  cat: Catalogue,
  actionId: string,
  sourceEventId?: string,
) {
  for (const id of new Set(ids)) {
    const g = s.arrivalGroups?.find((g) => g.id === id)
    if (!g) throw Error('出场组引用不存在')
    if (g.status === 'spawned') continue
    const members = g.npcIds.map((id) => a.ai?.npcs.find((n) => n.id === id && n.sceneId === s.id))
    const provisional = { ...s, tokens: [...s.tokens] }
    try {
      for (const n of members) {
        if (!n || !n.enabled || !npcAbsent(n)) throw Error('成员缺失、停用或已经出场')
        assertPlacement(provisional, n.position, npcSpan(n.body?.size))
        provisional.tokens.push({
          id: n.id,
          characterId: n.characterId,
          actorId: null,
          name: n.name,
          ...n.position,
          span: npcSpan(n.body?.size),
          hidden: n.hidden,
          color: '#a86c42',
          facing: 0,
        })
      }
    } catch (e) {
      g.status = 'pending'
      g.reason = e instanceof Error ? e.message : '落点冲突'
      g.sourceEventId ??= sourceEventId
      continue
    }
    for (const n of members) {
      n!.arrivalOrigin ??= { sceneId: s.id, ...n!.position }
      n!.appeared = true
      n!.revision++
    }
    syncNpcTokens(a, world)
    g.status = 'spawned'
    g.reason = ''
    g.sourceEventId ??= sourceEventId
    const visible = members.filter((n) => !n!.hidden)
    const groupPublic = visible.length === members.length && a.activeSceneId === s.id
    if (visible.length)
      appendBroadcast(a, actionId, {
    message: systemMessage('npc.arrived',{actors:visible.map(n=>n!.name)}),
        category: 'progress',
        type: 'npc.arrived',
        title: 'NPC出场',
        narration: g.intro.trim() ? 'context' : 'generate',
        text: `${visible.map((n) => n!.name).join('、')}出现在场景中。`,
        sceneId: s.id,
        audience: a.activeSceneId === s.id ? publicAudience() : gmAudience(),
        facts: { count: visible.length, groupId: g.id },
      })
    if (g.intro.trim())
      appendBroadcast(a, actionId, {message:systemMessage('arrival.intro'),
        category: 'preset',
        type: 'arrival.intro',
        title: '出场文案',
        text: g.intro,
        sceneId: s.id,
        audience: groupPublic ? publicAudience() : gmAudience(),
        narration: 'direct',
        facts: {},
      })
    if (g.battleMode !== 'none') {
      const presetId = crypto.randomUUID()
      a.battles ??= { presets: [], requests: [], history: [] }
      a.battles.presets.push({
        id: presetId,
        name: g.name,
        sceneId: s.id,
        intro: '',
        participants: [
          ...members.map((n) => ({ kind: 'npc' as const, id: n!.id, side: n!.side })),
          ...(g.battleMode === 'start'
            ? a.party
                .filter((id) => s.tokens.some((t) => t.characterId === id))
                .map((id) => ({ kind: 'character' as const, id, side: 'party' as const }))
            : []),
        ],
      })
      applyBattleCommand(
        world,
        a,
        {
          type: 'battle-request',
          sceneId: s.id,
          name: g.name,
          reason: (g.battleMode === 'reinforce' ? '出场后申请增援：' : '出场后申请开战：') + g.name,
          source: 'point',
          sourceId: g.id,
          characterId: null,
          presetId,
        },
        cat,
        actionId,
      )
      g.requestId = a.battles.requests.at(-1)?.id
    }
  }
}
export function validateSceneExtras(
  a: import('./map-types').AdventureState,
  world: MapWorld,
  cat: Catalogue,
) {
  const assigned = new Set<string>()
  for (const s of a.scenes) {
    for (const rows of [s.arrivalGroups ?? [], s.groundItems ?? []])
      if (new Set(rows.map((r) => r.id)).size !== rows.length) throw Error('出场组或物品ID重复')
    for (const g of s.arrivalGroups ?? []) {
      if (!g.npcIds.length || new Set(g.npcIds).size !== g.npcIds.length)
        throw Error('出场组成员为空或重复')
      for (const id of g.npcIds) {
        if (
          assigned.has(id) ||
          !a.ai?.npcs.some(
            (n) =>
              n.id === id && (n.sceneId === s.id || g.status === 'spawned') && n.initiallyAbsent,
          )
        )
          throw Error('出场组NPC引用无效或已属于其他组')
        assigned.add(id)
      }
    }
    for (const p of s.points)
      if ([...(p.arrivalGroupIds??[]),...(p.failureArrivalGroupIds??[])].some((id) => !s.arrivalGroups?.some((g) => g.id === id)))
        throw Error('互动点出场组引用断裂')
    for (const g of s.groundItems ?? []) {
      if (g.specialWeapon) {
        validateSpecialWeapon(g.specialWeapon)
        const base =
          cat.items.find((i) => i.id === g.itemId) ??
          g.customItem ??
          world.characters.flatMap((c) => c.build.customItems).find((i) => i.id === g.itemId)
        if (base?.kind !== 'weapon' || g.initialQuantity !== 1)
          throw Error('地面特殊武器必须为单件基础武器')
      }
      if (
        !insideItem(s, g) ||
        g.quantity > g.initialQuantity ||
        (!cat.items.some((i) => i.id === g.itemId && i.kind !== 'pack') &&
          !(g.customItem?.id === g.itemId && g.customItem.kind !== 'pack') &&
          !world.characters.some((c) => c.build.customItems.some((i) => i.id === g.itemId)))
      )
        throw Error('地面物品引用、数量或位置无效')
    }
  }
}
const insideItem = (s: MapScene, g: { x: number; y: number }) =>
  Number.isInteger(g.x) &&
  Number.isInteger(g.y) &&
  g.x >= 0 &&
  g.y >= 0 &&
  g.x < s.grid.columns &&
  g.y < s.grid.rows

/** Confirmed outcomes are the sole entry for direct success/failure arrival bindings.
 * A matching link owns shared groups so direct bindings never bypass its atomic effects. */
export function processPointArrivals(
  world: MapWorld,
  a: Adventure,
  actionId: string,
  cat: Catalogue,
) {
  for (const e of (a.broadcastLog?.events ?? []).filter(
    (e) =>
      e.actionId === actionId &&
      e.type === 'point.result' &&
      e.phase === 'confirmed' &&
      e.branchId === a.broadcastLog?.branchId &&
      typeof e.facts.success === 'boolean',
  )) {
    const s = a.scenes.find((s) => s.id === e.sceneId),
      p = s?.points.find((p) => p.id === e.facts.pointId)
    if (!s || !p) continue
    const ids = e.facts.success ? p.arrivalGroupIds : p.failureArrivalGroupIds
    const linked = new Set(
      s.pointLinks
        ?.filter((g) => g.sourcePointId === p.id && (g.outcome === 'success') === e.facts.success)
        .flatMap((g) => g.arrivalGroupIds ?? []),
    )
    const direct = [...new Set(ids ?? [])].filter(
      (id) => !linked.has(id) && s.arrivalGroups?.find((g) => g.id === id)?.status !== 'pending',
    )
    for (const id of direct) {
      const transaction = clone(world),
        candidate = transaction.adventures.find((v) => v.id === a.id)!,
        target = candidate.scenes.find((v) => v.id === s.id)!
      try {
        triggerArrivals(transaction, candidate, target, [id], cat, actionId, e.id)
        Object.assign(a, candidate)
        world.characters = transaction.characters
        world.encounters = transaction.encounters
      } catch (error) {
        const group = a.scenes.find((v) => v.id === s.id)?.arrivalGroups?.find((g) => g.id === id)
        if (!group) throw error
        group.status = 'pending'
        group.reason = error instanceof Error ? error.message : '出场暂缓'
        group.sourceEventId ??= e.id
        appendBroadcast(a, actionId, {message:systemMessage('audit.arrival'),
          category: 'progress',
          type: 'arrival.pending',
          title: '出场暂缓',
          text: group.name + '：' + group.reason,
          sceneId: s.id,
          audience: gmAudience(),
          facts: { groupId: id },
        })
      }
    }
  }
}
