import { hpSpellBonus } from './spell-restoration'
import type { NpcProfile, NpcDirective } from './ai-types'
import type { MapWorld, Adventure } from './map-types'
import type { Catalogue } from './engine'
import { applyRuntime, rollDie } from './runtime'
import { combatStats, freshTurn, rollDamage } from './combat-rules'
import { applyCombat } from './combat'
import { explorationMember, assertExplorationReady, explorationSpend } from './exploration'

/** Explicit own inventory only; trade stock never grants permission to consume. */
export function npcExplorationItem(
  world: MapWorld,
  a: Adventure,
  n: NpcProfile,
  d: NpcDirective,
  cat: Catalogue,
  dice?: (s: number) => number,
) {
  const s = a.scenes.find((s) => s.id === a.activeSceneId),
    token = s?.tokens.find((t) => t.npcId === n.id)
  if (!s || n.sceneId !== s.id || !token || !n.enabled) throw Error('NPC缺少当前场景棋子')
  if (!d.itemId || (d.quantity !== undefined && d.quantity !== 1))
    throw Error('使用物品须指定自身物品及数量1，不能仅提交Utilize')
  if (d.targetId && ![n.id, n.characterId, token.id, n.actorId].includes(d.targetId))
    throw Error('此物品入口暂只支持自行使用；其他目标请GM手动裁定')
  const index = world.encounters.findIndex((e) => e.id === s.encounterId && e.phase === 'active'),
    e = world.encounters[index]
  const actor = e?.actors.find((t) => t.id === n.actorId)
  if (e && !actor) throw Error('NPC未加入当前战斗，不能消耗战斗行动')
  const c = world.characters.find((c) => c.id === n.characterId)
  const body = actor?.npc ?? n.body
  const stats = combatStats(
    actor ?? {
      id: n.id,
      characterId: n.characterId,
      npc: body,
      side: n.side,
      initiative: null,
      surprised: false,
      turn: freshTurn(),
    },
    world.characters,
    cat,
  )
  if (
    stats.dead ||
    stats.conditions.includes('incapacitated') ||
    stats.conditions.includes('unconscious')
  )
    throw Error('NPC当前已死亡或失能，不能自行使用物品')
  if(stats.spatialCapabilities.cannotManipulate)throw Error('气化形体不能使用或操作实际物品')
  const row = c?.inventory.find((r) => r.instanceId === d.itemId && r.quantity > 0)
  const supply = n.consumables?.find((r) => r.id === d.itemId)
  const itemId = row?.itemId ?? supply?.itemId
  if (c ? !row : !supply || supply.quantity - (n.consumablesUsed?.[supply.id] ?? 0) < 1)
    throw Error('NPC自身物品库存不足')
  if (!['healing-potion', ...(c ? ['chef-treat'] : [])].includes(itemId ?? ''))
    throw Error('此物品效果尚未自动实现，请GM手动裁定；未扣库存')
  const m = explorationMember(a, token.id)
  if (a.exploration?.status === 'active' && !m) throw Error('NPC未加入探索回合名单')
  if (m) {
    assertExplorationReady(world, a, m, cat)
    if (!m.bonus) throw Error('本轮附赠动作已用')
  }
  // Validate / roll before committing inventory, HP or action budgets.
  const next = c
    ? applyRuntime(
        c,
        cat,
        {
          type: 'item-remove',
          instanceId: row!.instanceId,
          quantity: 1,
          consume: true,
          note: 'GM批准NPC自身使用物品',
        },
        dice,
      )
    : null
  const healing = !c ? rollDamage('2d4+2', dice ?? rollDie).total : 0
  if (e && actor) {
    const result = applyCombat(e, world.characters, cat, {
      type: 'interact',
      actorId: actor.id,
      cost: 'bonus',
      note: 'NPC使用自身消耗品',
    })
    world.encounters[index] = result.encounter
  }
  if (m) explorationSpend(m, 'bonus')
  if (next) world.characters[world.characters.indexOf(c!)] = next
  else {
    n.consumablesUsed = {
      ...n.consumablesUsed,
      [supply!.id]: (n.consumablesUsed?.[supply!.id] ?? 0) + 1,
    }
    if (actor && e) {
      const target = world.encounters[index]!.actors.find((t) => t.id === actor.id)!.npc!
      target.hp = Math.min(target.maxHp + hpSpellBonus(target.effects), target.hp + healing)
      if (n.body) n.body.hp = target.hp
    } else if (n.body) n.body.hp = Math.min(n.body.maxHp + hpSpellBonus(n.body.effects), n.body.hp + healing)
  }
  return `${n.name}使用${cat.items.find((i) => i.id === itemId)?.name ?? itemId}；自身库存减少1${healing ? `，恢复${healing}HP` : ''}`
}
