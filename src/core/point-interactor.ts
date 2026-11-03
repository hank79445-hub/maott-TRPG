import type { MapWorld, Adventure, MapScene } from './map-types'
import type { Catalogue } from './engine'
import { applyRuntime, runtimeState, resources } from './runtime'
import { combatStats, freshTurn, d20, savingRoll, defaultEnvironment } from './combat-rules'
import { SKILLS, type Ability } from './types'

/** An ordinary NPC keeps its native body and own supplies; no synthetic player card. */
export function pointInteractor(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  characterId: string,
  npcId: string | undefined,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const n = npcId
    ? a.ai?.npcs.find((n) => n.id === npcId && n.enabled && n.sceneId === s.id)
    : undefined
  if (npcId && !n) throw Error('NPC不在当前场景或已停用')
  const cid = n ? n.characterId : characterId
  const index = world.characters.findIndex((c) => c.id === cid)
  const c = world.characters[index]
  const token = s.tokens.find((t) => (n ? t.npcId === n.id : t.characterId === cid))
  if (!token || (!c && !n?.body)) throw Error('互动人物或棋子不存在')
  const e = world.encounters.find((e) => e.id === s.encounterId)
  const actor = e?.actors.find(
    (t) =>
      t.id === token.actorId ||
      (n?.actorId && t.id === n.actorId) ||
      (cid && t.characterId === cid),
  )
  const body = actor ?? {
    id: token.id,
    characterId: cid,
    npc: n?.body ?? null,
    side: n?.side ?? 'party',
    initiative: null,
    surprised: false,
    turn: freshTurn(),
  }
  const stats = combatStats(body, world.characters, cat)
  if (
    stats.dead ||
    stats.hp <= 0 ||
    stats.conditions.includes('incapacitated') ||
    stats.conditions.includes('unconscious')
  )
    throw Error('失能或死亡人物不能执行互动')
  const update = (
    command: Parameters<typeof applyRuntime>[2],
    observer?: Parameters<typeof applyRuntime>[4],
  ) => {
    if (!c) throw Error('该效果需要职业角色卡，请由GM明确裁定；未自动改变NPC')
    world.characters[index] = applyRuntime(world.characters[index]!, cat, command, dice, observer)
  }
  const quantity = (id: string) =>
    c
      ? world.characters[index]!.inventory.filter((i) => i.itemId === id).reduce(
          (v, i) => v + i.quantity,
          0,
        )
      : (n!.consumables ?? [])
          .filter((i) => i.itemId === id)
          .reduce((v, i) => v + Math.max(0, i.quantity - (n!.consumablesUsed?.[i.id] ?? 0)), 0)
  function remove(itemId: string, amount: number) {
    if (quantity(itemId) < amount) throw Error('互动所需物品数量不足')
    let left = amount
    if (c)
      for (const row of [...world.characters[index]!.inventory].filter(
        (i) => i.itemId === itemId,
      )) {
        const q = Math.min(left, row.quantity)
        if (q)
          update({ type: 'item-remove', instanceId: row.instanceId, quantity: q, note: '互动消耗' })
        left -= q
      }
    else
      for (const row of (n!.consumables ?? []).filter((i) => i.itemId === itemId)) {
        const q = Math.min(left, Math.max(0, row.quantity - (n!.consumablesUsed?.[row.id] ?? 0)))
        n!.consumablesUsed ??= {}
        n!.consumablesUsed[row.id] = (n!.consumablesUsed[row.id] ?? 0) + q
        left -= q
      }
  }
  function check(p: { kind: 'skill' | 'save'; id: string; dc: number }) {
    let total = 0,
      success = false
    if (c)
      update({ type: 'check', ...p }, (r) => {
        total = r.total
        success = r.success
      })
    else {
      const roll =
        p.kind === 'save'
          ? savingRoll(body, p.id as Ability, defaultEnvironment(), world.characters, cat, dice)
          : d20(
              (body.npc?.templateMetadata?.skills[p.id]??stats.mods[SKILLS[p.id]!.ability])-(p.id==='perception'&&stats.effects.some(e=>e.key==='enthrall')?10:0),
              [],
              stats.conditions.includes('poisoned') ? ['中毒'] : [],
              dice,
            )
      total = roll.total
      success = total >= p.dc
    }
    return { total, success }
  }
  function resource(id: string, amount: number) {
    if (c) {
      const r = resources(world.characters[index]!, cat).find((r) => r.id === id),
        current = runtimeState(world.characters[index]!, cat).resources[id]
      if (!r || current === undefined || current < amount) throw Error('互动所需资源不足')
      update({ type: 'resource-set', id, amount: current - amount, reason: '互动消耗' })
    } else {
      const current = world.encounters
        .find((e) => e.id === s.encounterId)
        ?.actors.find((t) => t.id === actor?.id)
      const pool = (current?.npc ?? n!.body)?.resources?.find((r) => r.id === id)
      if (!pool || pool.remaining < amount) throw Error('NPC互动所需资源不足')
      pool.remaining -= amount
      if (n!.body && current?.npc) n!.body.resources = structuredClone(current.npc.resources)
    }
  }
  function grant(items: { itemId: string; quantity: number }[], coins: number) {
    if (c) {
      for (const row of items)
        update({ type: 'item-add', ...row, purchase: false, note: '容器领取' })
      if (coins) update({ type: 'coins', amount: coins, reason: '容器领取' })
    } else {
      n!.consumables ??= []
      if (
        n!.consumables.length + items.length > 30 ||
        items.some((i) => i.quantity > 999) ||
        n!.coins + coins > 1000000
      )
        throw Error('NPC自身库存或金币达到上限，请GM另行分配')
      for (const row of items) n!.consumables.push({ id: crypto.randomUUID(), ...row })
      n!.coins += coins
    }
  }
  return {
    token,
    characterId: cid ?? null,
    actorId: actor?.id,
    name: c?.build.name ?? n!.name,
    quantity,
    remove,
    check,
    resource,
    grant,
  }
}
