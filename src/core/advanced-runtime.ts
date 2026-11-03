import type { Character, ActiveEffect, Runtime } from './types'
import type { Catalogue } from './engine'
import { derived } from './engine'
import { hasSubclass } from './growth-rules'
import { rulePowers } from './phb-powers'
import { hasFeat } from './advanced-rules'
export interface AdvancedUse {
  id: string
  amount: number
  confirmed: boolean
  note: string
  choice?: string
}
/** Mutates only the candidate supplied by the transaction owner. No caller supplied dice results. */
export function useAdvanced(
  c: Character,
  cat: Catalogue,
  use: AdvancedUse,
  dice: (s: number) => number,
): string {
  const power = rulePowers(c).find((p) => p.id === use.id),
    r = c.runtime as Runtime,
    d = derived(c.build, cat, c.inventory)
  if (!power) throw new Error('此角色未获得该专长或子职业能力')
  if (!use.confirmed || !use.note.trim() || use.note.length > 2000)
    throw new Error('请确认规则触发并填写 GM 裁定依据')
  if (!Number.isInteger(use.amount) || use.amount < 1 || use.amount > 10)
    throw new Error('能力数量须为 1—10 整数')
  const state = (r.advanced ??= { ward: null, portents: [], lastCheck: null })
  const roll = (s: number) => {
    const n = dice(s)
    if (!Number.isInteger(n) || n < 1 || n > s) throw new Error('能力骰结果不合法')
    return n
  }
  const spend = (id: string, n: number) => {
    if ((r.resources[id] ?? 0) < n) throw new Error('能力资源不足')
    r.resources[id]! -= n
  }
  const suffix = use.id.slice(4)
  let detail = power.name + '；' + power.detail + '；GM：' + use.note
  let count = 1
  if (['warrior-gods', 'healing-light'].includes(suffix)) count = use.amount
  if (suffix === 'healing-light' && count > Math.max(1, d.mods.cha))
    throw new Error('治愈之光一次不能超过魅力调整值（至少一）枚')
  if (suffix === 'psychic-whispers' && !(r.resources['psychic-whispers'] ?? 0)) spend('psionic', 1)
  else if (suffix !== 'psi-knack' && power.resource) spend(power.resource, count)
  if (suffix === 'durable') {
    if (!r.hitDice) throw new Error('没有剩余生命骰')
    r.hitDice!--
  }
  if (suffix === 'ward-recovery') {
    if (state.ward === null) throw new Error('须先以防护法术创建奥术守御')
    const level = use.amount
    if (level > 3 || !(r.resources[level === 1 ? 'slots' : 'slots-' + level] ?? 0))
      throw new Error('没有此环级法术位')
    spend(level === 1 ? 'slots' : 'slots-' + level, 1)
    state.ward = Math.min(Math.max(0, 2 * c.level + d.mods.int), state.ward + 2 * level)
    return detail + '；守御 HP ' + state.ward
  }
  if (suffix === 'refresh-movement' || suffix === 'refresh-beguiling') {
    const id = suffix === 'refresh-movement' ? 'telekinetic-movement' : 'beguiling-magic'
    if (r.resources[id] !== 0) throw new Error('免费次数尚未耗尽，无需重置')
    r.resources[id] = 1
    return detail
  }
  if (
    ['maneuver-ambush', 'maneuver-commanding-presence', 'maneuver-tactical-assessment'].includes(
      suffix,
    )
  ) {
    const last = state.lastCheck,
      allowed =
        suffix === 'maneuver-ambush'
          ? ['stealth', 'initiative']
          : suffix === 'maneuver-commanding-presence'
            ? ['intimidation', 'performance', 'persuasion']
            : ['investigation', 'history', 'insight']
    if (!last || last.attempted || last.autoFail || !allowed.includes(last.key))
      throw new Error('须对应技能／先攻检定，且未使用骰增幅')
    const n = roll(8)
    last.total += n
    last.attempted = true
    return detail + '；卓越骰 ' + n + '，新总值 ' + last.total + '；对应场景结果由 GM 更新'
  }
  if (suffix === 'psi-knack') {
    const last = state.lastCheck
    if (
      !last ||
      last.kind !== 'skill' ||
      !last.proficient ||
      last.dc === null ||
      last.total >= last.dc ||
      last.autoFail ||
      last.attempted
    )
      throw new Error('须一次尚未尝试增幅、未自动失败且熟练的失败检定，并有 DC')
    if (!(r.resources.psionic ?? 0)) throw new Error('灵能骰不足')
    const n = roll(c.level >= 5 ? 8 : 6)
    last.attempted = true
    last.total += n
    if (last.total >= last.dc) spend('psionic', 1)
    return (
      detail +
      '；灵能骰 ' +
      n +
      '，新总值 ' +
      last.total +
      '／DC ' +
      last.dc +
      '，' +
      (last.total >= last.dc ? '转为成功并消费一枚' : '仍失败，不消费骰')
    )
  }
  if (suffix === 'feat-mage-slayer') {
    const last = state.lastCheck
    if (
      !last ||
      last.kind !== 'save' ||
      !['int', 'wis', 'cha'].includes(last.key) ||
      last.dc === null ||
      last.total >= last.dc ||
      last.autoFail
    )
      throw new Error('须智力、感知或魅力豁免失败，不能覆盖自动失败')
    last.total = last.dc
    return detail + '；将此豁免改为成功，关联场景结果由 GM 复核'
  }
  if (suffix === 'surge-ruling') {
    const result = state.surges?.find((s) => s.id === use.choice && !s.settled)
    if (!result) throw new Error('浪涌结果不存在或已裁定')
    result.settled = true
    return detail + '；d100 ' + result.roll + ' 已按保存结果裁定，无二次随机'
  }
  if (suffix === 'chef-treats' || suffix === 'poisoner-craft') {
    const tool = suffix === 'chef-treats' ? 'cook' : 'poisoner-kit'
    if (!c.inventory.some((row) => row.itemId === tool)) throw new Error('须携带对应工具')
    const pb = c.level >= 5 ? 3 : 2
    if (suffix === 'poisoner-craft') {
      if (c.coins < 50) throw new Error('制作强效毒剂需要价值 50 GP 材料')
      c.coins -= 50
    }
    const free =
      suffix === 'chef-treats' &&
      r.lastRest?.kind === 'long' &&
      r.lastRest.endedAt === r.hours &&
      !r.effects?.some((e) => e.key === 'chef-treats-rest' && e.note === String(r.hours))
    if (!free) r.hours = (r.hours ?? 0) + 1
    else add('chef-treats-rest', String(r.hours))
    const boosted = Object.entries(
      c.build.growth?.find((g) => g.level === 4)?.abilityIncreases ?? {},
    ).find(([, n]) => n === 1)?.[0] as 'dex' | 'int' | undefined
    const dc = 8 + pb + d.mods[boosted ?? 'dex']
    c.inventory.push({
      instanceId: crypto.randomUUID(),
      itemId: suffix === 'chef-treats' ? 'chef-treat' : 'poisoner-dose',
      quantity: pb,
      source: power.name,
      equipped: false,
      note: use.note,
      containerId: null,
      consumable: {
        kind: suffix === 'chef-treats' ? 'chef-treat' : 'poisoner-dose',
        value: pb,
        ...(suffix === 'chef-treats' ? { expiresAt: r.hours + 8 } : { dc }),
      },
    })
    return (
      detail +
      '；制作 ' +
      pb +
      ' 份' +
      (suffix === 'poisoner-craft' ? '，支付 50 GP' : '，八小时后失效')
    )
  }
  if (suffix === 'chef-meal') {
    if (
      r.lastRest?.kind !== 'short' ||
      r.lastRest.endedAt !== r.hours ||
      !r.lastRest.usedHitDice ||
      !c.inventory.some((row) => row.itemId === 'cook')
    )
      throw new Error('须刚完成消耗生命骰的短休，并携带厨具')
    if (r.effects?.some((e) => e.key === 'chef-meal-rest' && e.note === String(r.hours)))
      throw new Error('同次短休只能食用一次餐食')
    const n = roll(8)
    r.hp = Math.min(d.hp, r.hp + n)
    add('chef-meal-rest', String(r.hours))
    return detail + '；自己额外恢复 d8＝' + n + '；其他用餐者请 GM 核对生命骰与人数后记录各自 d8'
  }
  if (suffix === 'poisoner-coat') {
    const weapon = c.inventory.find((row) => row.instanceId === use.choice && row.equipped),
      dose = c.inventory.find((row) => row.itemId === 'poisoner-dose' && row.consumable?.dc)
    if (!weapon || !cat.items.some((i) => i.id === weapon.itemId && i.kind === 'weapon'))
      throw new Error('请指定当前持用武器实例')
    if (!dose) throw new Error('没有强效毒剂')
    const dc = dose.consumable!.dc!
    dose.quantity--
    if (!dose.quantity)
      c.inventory = c.inventory.filter((row) => row.instanceId !== dose.instanceId)
    add('poisoner-coating', weapon.instanceId + '|' + dc, {}, 1 / 60)
    return detail + '；武器涂毒一分钟，DC ' + dc + '，命中实际伤害才消耗涂层'
  }
  if (suffix === 'war-bond') {
    const row = c.inventory.find((x) => x.instanceId === use.choice)
    if (
      !row ||
      ![...cat.items, ...c.build.customItems].some(
        (x) => x.id === row.itemId && x.kind === 'weapon',
      )
    )
      throw new Error('请指定自己库存中的武器实例')
    if (r.effects?.some((e) => e.key === 'war-bond' && e.note === row.instanceId))
      throw new Error('武器已经连结')
    if (r.effects!.filter((e) => e.key === 'war-bond').length >= 2)
      throw new Error('最多同时连结两把武器，请先解除一把')
    r.hours = (r.hours ?? 0) + 1
    add('war-bond', row.instanceId)
    return detail + '；一小时连结完成'
  }
  if (suffix === 'war-recall') {
    if (!r.effects?.some((e) => e.key === 'war-bond' && e.note === use.choice))
      throw new Error('须指定已连结武器实例')
    return detail + '；GM 确认将真实实例归还，系统不增殖物品'
  }
  if (suffix === 'portent') {
    const index = use.amount - 1,
      n = state.portents[index]
    if (n === undefined) throw new Error('该预兆骰已用完')
    if (r.effects!.some((e) => e.rollOverride !== undefined)) throw new Error('已有未消费的预兆')
    state.portents.splice(index, 1)
    add('portent-roll', use.note, { rollOverride: n })
    return detail + '；下次自己 d20 替换为 ' + n
  }
  if (suffix === 'tides-chaos') {
    add('tides-chaos-roll', use.note, { attackAdvantage: true })
    return detail
  }
  if (power.kind === 'heal') {
    if (r.death?.dead || r.effects?.some((e) => e.blocksHealing))
      throw new Error('当前不能获得普通治疗')
    const sides = Number(power.formula?.match(/d(\d+)/)?.[1] ?? 6),
      values = Array.from({ length: count }, () => roll(sides)),
      amount = Math.max(0, values.reduce((a, b) => a + b, 0) + (power.modifier ?? 0))
    r.hp = Math.min(d.hp, r.hp + amount)
    if (r.hp > 0) r.death = { successes: 0, failures: 0, stable: false, dead: false }
    return detail + '；恢复自己 HP ' + amount + '，骰 [' + values + ']'
  }
  if (suffix === 'psychic-whispers') {
    const n = roll(c.level >= 5 ? 8 : 6)
    add(suffix, use.note, {}, n)
    return detail + '；联系持续 ' + n + ' 小时'
  }
  if (suffix === 'inspiring-smite') {
    const values = [roll(8), roll(8)],
      pool = values[0]! + values[1]! + c.level
    add('inspiring-smite-pool', String(pool), {}, 1 / 600)
    return (
      detail +
      '；临时 HP 分配池 2d8 [' +
      values +
      ']＋等级＝' +
      pool +
      '；GM 记录三十尺内各目标分配，总和不得超过此池，不复制给每人'
    )
  }
  if (power.kind === 'buff' || power.duration) {
    if (suffix.startsWith('starry-'))
      r.effects = r.effects!.filter((e) => !e.key.startsWith('starry-'))
    if (suffix.startsWith('rage-')) {
      if (!r.rage) throw new Error('须刚开启狂暴后选择本次怒意')
      r.effects = r.effects!.filter((e) => !e.key.startsWith('rage-'))
    }
    add(suffix, use.note, suffix === 'maneuver-evasive' ? { acBonus: roll(8) } : {})
  }
  return detail + '；触发、位置及目标结果按此条文由 GM 结算，未写入无关 HP／AC'
  function add(
    key: string,
    note: string,
    fields: Partial<ActiveEffect> = {},
    duration = power!.duration,
  ) {
    r.effects = r.effects!.filter((e) => e.key !== key || e.sourceId !== c.id)
    r.effects.push({
      id: crypto.randomUUID(),
      key,
      name: power!.name,
      sourceId: c.id,
      page: 0,
      concentration: false,
      expiresAt: null,
      encounterId: 'outside',
      phase: 'start',
      ...(duration ? { endsAt: (r.hours ?? 0) + duration } : {}),
      note,
      ...fields,
    })
  }
}
