import { maximizesHealing } from './spell-restoration'
import type { Character } from './types'
import { clone, featIds, proficiencies, type Catalogue } from './engine'
import { CRAFTING_TABLE } from '../content/phb-origins'
import { applyRuntime, runtimeState, runtimeDerived, findItem, rollDie } from './runtime'
import { pbOf } from './growth-rules'
import { featAbility } from './advanced-rules'

export interface OriginCommand {
  type: 'origin'
  id:
    | 'healer'
    | 'healing-hands'
    | 'revelation'
    | 'end-revelation'
    | 'craft'
    | 'musician'
    | 'chef-meal'
    | 'inspiring-leader'
  targets: string[]
  mode: 'wings' | 'radiance' | 'shroud'
  itemId: string
  kitId: string
  confirmed: boolean
  reroll: boolean
  note: string
}
export function hasOrigin(c: Character, cat: Catalogue, id: string) {
  return featIds(c.build, cat).includes(id)
}
export function checkedOriginDie(dice: (s: number) => number, sides: number, reroll = false) {
  const get = () => {
    const n = dice(sides)
    if (!Number.isInteger(n) || n < 1 || n > sides) throw new Error('骰值不合法')
    return n
  }
  const n = get()
  return n === 1 && reroll ? get() : n
}
export function craftingOptions(c: Character, cat: Catalogue) {
  const tools = proficiencies(c.build, cat).tools
  return [
    ...new Set(
      Object.entries(CRAFTING_TABLE)
        .filter(
          ([tool]) =>
            tools.includes(tool) &&
            c.inventory.some((row) => row.itemId === tool && row.quantity > 0 && !row.containerId),
        )
        .flatMap(([, ids]) => ids),
    ),
  ]
    .map((id) => cat.items.find((i) => i.id === id)!)
    .filter(Boolean)
}
export function consumeMedicalKit(c: Character, cat: Catalogue, id: string) {
  const kit = c.inventory.find((x) => x.instanceId === id)
  if (!kit || kit.itemId !== 'healers-kit' || kit.containerId || kit.quantity < 1)
    throw new Error('请选择已取出的医疗包')
  const uses = kit.uses ?? 10
  if (uses < 1) throw new Error('医疗包已用尽')
  kit.uses = uses - 1
  if (!kit.uses) {
    if (kit.quantity > 1) {
      kit.quantity--
      kit.uses = 10
    } else c.inventory = c.inventory.filter((x) => x.instanceId !== id)
  }
}
/** Work on a cloned party. The caller saves all participants in the same transaction. */
export function applyOriginParty(
  inputs: Character[],
  sourceId: string,
  cat: Catalogue,
  cmd: OriginCommand,
  dice: (s: number) => number = rollDie,
): Character[] {
  const cs = clone(inputs),
    index = cs.findIndex((c) => c.id === sourceId),
    source = cs[index]
  if (!source || source.status !== 'complete') throw new Error('角色来源不可用')
  let r = runtimeState(source, cat)
  if (!cmd.confirmed || !cmd.note.trim())
    throw new Error('请确认触发、距离、听见／接触和规则条件，并填写依据')
  if (
    cmd.id !== 'end-revelation' &&
    (runtimeDerived(source, cat).conditions.includes('incapacitated') || r.death.dead)
  )
    throw new Error('失能或死亡不能执行此特性')
  if (r.wildShape && ['craft', 'healer', 'musician'].includes(cmd.id))
    throw new Error('融入装备的荒野形态不能使用工具、医疗包或乐器')
  if (new Set(cmd.targets).size !== cmd.targets.length) throw new Error('目标不能重复')
  const target = (id: string) => {
    const i = cs.findIndex((c) => c.id === id)
    if (i < 0 || cs[i]!.status !== 'complete') throw new Error('目标角色不存在')
    return i
  }
  const self = () => {
    if (cmd.targets.length !== 1 || cmd.targets[0] !== sourceId)
      throw new Error('此特性须以自身为目标')
  }
  let detail = ''
  if (cmd.id === 'chef-meal' || cmd.id === 'inspiring-leader') {
    const chef = cmd.id === 'chef-meal',
      feat = chef ? 'chef' : 'inspiring-leader'
    if (!hasOrigin(source, cat, feat)) throw new Error('未获得对应团队专长')
    if (
      !r.lastRest ||
      r.lastRest.endedAt !== r.hours ||
      (chef ? r.lastRest.kind !== 'short' || r.lastRest.fed : r.lastRest.led)
    )
      throw new Error('须刚完成对应休息，且同次休息尚未使用')
    if (!cmd.targets.length || cmd.targets.length > (chef ? 4 + pbOf(source.build) : 6))
      throw new Error('团队专长目标数量超限')
    if (chef && !source.inventory.some((row) => row.itemId === 'cook' && !row.containerId))
      throw new Error('餐食需要已取出的厨具与 GM 确认食材')
    const ability = featAbility(source.build, cat),
      amount = chef
        ? 0
        : Math.max(0, source.level + runtimeDerived(source, cat).mods[ability ?? 'wis'])
    for (const id of cmd.targets) {
      const ti = target(id),
        t = cs[ti]!,
        tr = runtimeState(t, cat)
      if (
        chef &&
        (!tr.lastRest?.usedHitDice ||
          tr.lastRest.kind !== 'short' ||
          tr.lastRest.endedAt !== tr.hours ||
          tr.effects.some((e) => e.key === 'chef-meal-rest' && e.note === String(tr.hours)))
      )
        throw new Error('餐食目标须刚完成消耗生命骰的短休，同一次只能吃一次')
      const n = chef ? checkedOriginDie(dice, 8) : amount
      cs[ti] = applyRuntime(
        t,
        cat,
        chef
          ? { type: 'heal', amount: Math.max(1, n), note: '大厨餐食额外 d8' }
          : { type: 'temporary', amount: n },
        dice,
      )
      if (chef)
        cs[ti]!.runtime!.effects!.push({
          id: crypto.randomUUID(),
          key: 'chef-meal-rest',
          name: '已吃短休餐食',
          sourceId: sourceId,
          page: 0,
          concentration: false,
          expiresAt: null,
          encounterId: 'outside',
          phase: 'start',
          note: String(tr.hours),
        })
    }
    const fresh = runtimeState(cs[index]!, cat)
    if (chef) fresh.lastRest!.fed = true
    else fresh.lastRest!.led = true
    cs[index]!.runtime = fresh
    detail =
      (chef
        ? '大厨餐食：各目标生命骰后的额外 d8 已结算'
        : '领袖之证：各目标临时 HP ' + amount + '（等级＋提升属性调整值，不叠加）') +
      '；' +
      cmd.targets.length +
      ' 名；GM 确认餐食／表演、盟友与三十尺范围'
  } else if (cmd.id === 'healer' || cmd.id === 'healing-hands') {
    if (cmd.targets.length !== 1) throw new Error('治疗须选择一名目标')
    const ti = target(cmd.targets[0]!),
      t = cs[ti]!,
      tr = runtimeState(t, cat)
    if (tr.death.dead || tr.effects.some((e) => e.blocksHealing))
      throw new Error('目标无法接受普通治疗')
    let amount = 0
    if (cmd.id === 'healer') {
      if (!hasOrigin(source, cat, 'healer')) throw new Error('未获得医疗师专长')
      if (tr.hitDice < 1) throw new Error('目标没有可消耗的生命骰')
      const die = cat.classes.find((cl) => cl.id === t.build.classId)!.hitDie
      consumeMedicalKit(source, cat, cmd.kitId)
      tr.hitDice--
      t.runtime = tr
      const roll = maximizesHealing(tr.effects)?die:checkedOriginDie(dice, die, cmd.reroll)
      amount = roll + pbOf(source.build)
      detail = `医疗师：目标消耗 1 枚 d${die} 生命骰，医疗包消耗 1 次；${roll}+施救者熟练 ${pbOf(source.build)}（不加目标体质）`
    } else {
      if (source.build.speciesId !== 'aasimar' || r.wildShape)
        throw new Error('当前形态不能使用阿斯莫治愈之手')
      if ((r.resources['healing-hands'] ?? 0) < 1) throw new Error('治愈之手已用尽')
      r.resources['healing-hands']!--
      source.runtime = r
      const rolls = Array.from({ length: pbOf(source.build) }, () => maximizesHealing(tr.effects)?4:checkedOriginDie(dice, 4))
      amount = rolls.reduce((n, x) => n + x, 0)
      detail = `治愈之手：[${rolls}] d4，长休资源消耗 1`
    }
    cs[ti] = applyRuntime(t, cat, { type: 'heal', amount: Math.max(1, amount), note: detail }, dice)
    if (ti === index) cs[index]!.inventory = source.inventory
  } else if (cmd.id === 'revelation') {
    self()
    if (source.build.speciesId !== 'aasimar' || source.level < 3 || r.wildShape)
      throw new Error('天启须三级阿斯莫，且保留物种特性')
    if (r.revelation || !(r.resources['aasimar-revelation'] ?? 0))
      throw new Error('天启已开启或次数不足')
    r.resources['aasimar-revelation']!--
    r.revelation = { mode: cmd.mode, endsAt: r.hours + 1 / 60 }
    source.runtime = r
    detail =
      '天启：' +
      { wings: '天堂飞翼', radiance: '内耀辉光', shroud: '死灵环绕' }[cmd.mode] +
      '，持续一分钟；附赠动作；模式的范围／高度由 GM 核对'
  } else if (cmd.id === 'end-revelation') {
    self()
    if (!r.revelation) throw new Error('当前未开启天启')
    r.revelation = null
    source.runtime = r
    detail = '主动结束天启（无需动作）'
  } else if (cmd.id === 'craft') {
    self()
    if (!hasOrigin(source, cat, 'crafter')) throw new Error('未获得巧匠专长')
    if (
      !r.lastRest ||
      r.lastRest.kind !== 'long' ||
      r.lastRest.crafted ||
      Math.abs(r.lastRest.endedAt - r.hours) > 1e-8
    )
      throw new Error('快速制作只在长休结束时一次选择一件装备')
    const item = craftingOptions(source, cat).find((i) => i.id === cmd.itemId)
    if (!item) throw new Error('缺少快速制作表对应的工具／熟练或工具尚在容器中')
    source.inventory.push({
      instanceId: crypto.randomUUID(),
      itemId: item.id,
      quantity: 1,
      source: '巧匠快速制作',
      note: '下次制作者完成长休时解体',
      equipped: false,
      craftedBy: sourceId,
      craftedAt: r.hours,
    })
    r.lastRest.crafted = true
    source.runtime = r
    detail = '快速制作 ' + item.name + '；下次制作者长休结束失效'
  } else if (cmd.id === 'musician') {
    if (!hasOrigin(source, cat, 'musician')) throw new Error('未获得音乐家专长')
    if (!r.lastRest || r.lastRest.sang || Math.abs(r.lastRest.endedAt - r.hours) > 1e-8)
      throw new Error('鼓舞之歌仅在完成短休／长休时使用一次')
    if (
      !cmd.targets.length ||
      cmd.targets.length > pbOf(source.build) ||
      cmd.targets.includes(sourceId)
    )
      throw new Error('选择至多熟练加值名听到演奏的其他盟友')
    const tools = proficiencies(source.build, cat).tools
    if (
      !source.inventory.some(
        (row) =>
          !row.containerId &&
          row.quantity > 0 &&
          tools.includes(row.itemId) &&
          findItem(source, cat, row.itemId)?.category === 'instrument',
      )
    )
      throw new Error('须持有并使用一种熟练的乐器')
    for (const id of cmd.targets) {
      const i = target(id)
      const d = runtimeDerived(cs[i]!, cat)
      if (
        d.conditions.some((c) => ['deafened', 'unconscious'].includes(c)) ||
        runtimeState(cs[i]!, cat).death.dead
      )
        throw new Error('目标无法听见演奏')
      cs[i] = applyRuntime(
        cs[i]!,
        cat,
        { type: 'inspiration', active: true, note: '音乐家鼓舞之歌；听到演奏' },
        dice,
      )
    }
    r.lastRest.sang = true
    source.runtime = r
    detail = '鼓舞之歌给予 ' + cmd.targets.length + ' 名盟友英雄激励；重复激励不叠加'
  }
  // A cross-character action cannot be undone through one character's independent journal.
  for (const c of cs.filter((c) => c.id === sourceId || cmd.targets.includes(c.id)))
    for (const event of c.journal ?? []) event.before = null
  const changed = cs[index]!
  changed.revision++
  changed.updatedAt = new Date().toISOString()
  changed.journal = [
    ...(changed.journal ?? []),
    {
      id: crypto.randomUUID(),
      at: changed.updatedAt,
      revision: changed.revision,
      kind: 'origin',
      detail: detail + '；' + cmd.note,
      before: null,
      undone: false,
    },
  ].slice(-60)
  for (const c of cs)
    if (c.runtime?.revelation && (c.runtime.hours ?? 0) >= c.runtime.revelation.endsAt)
      c.runtime.revelation = null
  return cs
}
