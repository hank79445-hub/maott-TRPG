import { healingRollTotal } from './spell-restoration'
import type { Catalogue } from './engine'
import type { ActiveEffect, Character } from './types'
import type { Combatant, CombatCommand, Encounter, DamageType } from './combat-types'
import {
  combatStats,
  combatCharacter,
  rollDamage,
  adjustDamage,
  defenses,
  checkedDie,
  savingRoll,
} from './combat-rules'
import { rulePowers } from './phb-powers'
import { runtimeState, applyRuntime } from './runtime'
import { useAdvanced } from './advanced-runtime'
type PowerCommand = Extract<CombatCommand, { type: 'feature' }>
export interface PowerApi {
  spend: (a: Combatant, cost: 'action' | 'bonus' | 'reaction') => void
  own: (a: Combatant) => void
  damage: (a: Combatant, n: number) => void
  heal: (a: Combatant, n: number) => void
  temp: (a: Combatant, n: number) => void
  concentration: (a: Combatant) => void
  addEffect: (
    a: Combatant,
    key: string,
    name: string,
    source: Combatant,
    page: number,
    fields?: Partial<ActiveEffect>,
  ) => ActiveEffect
}
/** Rule costs and dice are authoritative; narrative/space predicates require the GM's recorded confirmation. */
export function advancedCombat(
  e: Encounter,
  cs: Character[],
  cat: Catalogue,
  command: PowerCommand,
  dice: (n: number) => number,
  api: PowerApi,
): string {
  if (e.phase !== 'active') throw new Error('须在运行中的遭遇使用')
  const actor = (id: string) => {
    const a = e.actors.find((a) => a.id === id)
    if (!a) throw new Error('能力目标不存在')
    return a
  }
  const a = actor(command.actorId),
    c = combatCharacter(a, cs),
    t = actor(command.targetId || a.id)
  if (!c) throw new Error('子职业与专长能力须角色使用')
  const power = rulePowers(c).find((p) => p.id === command.id)
  if (!power) throw new Error('尚未获得该能力')
  if (!command.note.trim() || command.note.length > 2000)
    throw new Error('请记录 GM 触发／场景裁定依据')
  if (command.id === 'phb/surge-ruling') {
    c.runtime = runtimeState(c, cat)
    return useAdvanced(
      c,
      cat,
      {
        id: command.id,
        amount: 1,
        choice: command.rule?.choice,
        confirmed: true,
        note: command.note,
      },
      dice,
    )
  }
  if (combatStats(a, cs, cat).dead || combatStats(a, cs, cat).conditions.includes('incapacitated'))
    throw new Error('失能或死亡不能使用该能力')
  const env = command.targetEnvironments?.[t.id] ?? command.env
  if (
    !Number.isFinite(env.distance) ||
    env.distance < 0 ||
    env.distance > power.range ||
    env.cover === 'total' ||
    !env.targetLocationConfirmed
  )
    throw new Error('能力目标超出范围、全遮蔽或位置未确认')
  const p = e.pending,
    entry = p?.targets[command.rule?.entry ?? 0],
    id = power.id.slice(4)
  const r = runtimeState(c, cat)
  c.runtime = r
  const index = cs.findIndex((x) => x.id === c.id)
  const spendResource = (rid: string, n = 1) => {
    if ((c.runtime!.resources[rid] ?? 0) < n) throw new Error('能力资源不足')
    c.runtime!.resources[rid]! -= n
  }
  const onceKey = power.id + (id === 'dreadful-strikes' ? ':' + t.id : '') + ':' + e.tick
  if (power.once && a.turn.manualUsed?.includes(onceKey)) throw new Error('本回合已使用此能力')
  if (
    id === 'witch-followup' &&
    !combatStats(t, cs, cat).effects.some((f) => f.key === 'witch-bolt' && f.sourceId === a.id)
  )
    throw new Error('目标没有自己的巫术箭链接')
  if (id === 'vitality-heal') {
    api.own(a)
    if (!a.turn.manualUsed?.includes('vitality-ready'))
      throw new Error('仅创造光环或回合开始可治疗一次')
    a.turn.manualUsed = a.turn.manualUsed.filter((f) => f !== 'vitality-ready')
  }
  if (power.timing === 'rest') throw new Error('此能力请在战斗外完成休息／仪式后使用')
  if (power.timing === 'before-roll' && p)
    throw new Error('必须在 d20 检定开始前使用，不能看到结果后补用')
  if (
    power.timing === 'turn-start' &&
    (e.actors[e.current]?.id !== a.id ||
      !a.turn.action ||
      (!a.turn.bonus && !id.startsWith('rage-')) ||
      a.turn.movement > 0)
  )
    throw new Error('须在自己回合开始、行动与移动前使用')
  if (power.timing === 'after-spell') {
    const last = a.turn.lastSpell
    if (!last) throw new Error('须刚完成符合条件的施法')
    if (['refreshing-step', 'taunting-step'].includes(id) && last.id !== 'misty-step')
      throw new Error('须刚施放迷踪步')
    if (id === 'inspiring-smite' && last.id !== 'divine-smite') throw new Error('须刚施放至圣斩')
    if (
      id === 'beguiling-magic' &&
      (!last.slot || !['Enchantment', 'Illusion'].includes(last.school))
    )
      throw new Error('须刚花位施放惑控或幻术')
    if (
      id === 'star-chalice' &&
      (!last.slot ||
        ![
          'cure-wounds',
          'healing-word',
          'mass-healing-word',
          'prayer-of-healing',
          'aura-of-vitality',
        ].includes(last.id))
    )
      throw new Error('须刚花位施放治疗法术')
    const key = id + ':' + last.token
    if (a.turn.manualUsed?.includes(key)) throw new Error('此次施法已结算此增益')
    a.turn.manualUsed = [...(a.turn.manualUsed ?? []), key]
  }
  if (id === 'valor-offense') {
    if (
      !p ||
      p.kind !== 'attack' ||
      p.actorId !== a.id ||
      !entry?.hit ||
      t.id !== entry.id ||
      !p.damageRolled
    )
      throw new Error('须自己的已掷伤害命中窗口')
    const inspiration = r.effects.find(
      (f) => f.key === 'bardic-inspiration' && f.variant === 'valor',
    )
    if (!inspiration) throw new Error('没有勇气学院激励')
    const roll = rollDamage(
      '1d' + (Number(inspiration.name.match(/d([68])/)?.[1]) || 6),
      dice,
      entry.critical,
    )
    r.effects = r.effects.filter((f) => f.id !== inspiration.id)
    entry.damageOverride = [...(entry.damageOverride ?? []), { type: p.attack!.type, roll }]
    return '战斗激励加伤 ' + roll.total + ' 已加入同次攻击，尚未扣血'
  }
  if (
    [
      'guided-strike',
      'maneuver-precision',
      'protective-field',
      'maneuver-parry',
      'feat-defensive-duelist',
      'valor-defense',
      'valor-offense',
    ].includes(id)
  ) {
    if (!p || !entry || (id !== 'protective-field' && (p.kind !== 'attack' || !entry.roll)))
      throw new Error('须绑定仍未结算的具体伤害／攻击窗口')
    const rolling = actor(p.actorId),
      defender = actor(entry.id)
    if (['guided-strike', 'maneuver-precision'].includes(id)) {
      if (p.damageRolled) throw new Error('伤害已掷，不能再改命中 d20')
      if (entry.hit || rolling.id !== t.id) throw new Error('须选择正在失手的攻击者')
      if (id === 'maneuver-precision' && rolling.id !== a.id)
        throw new Error('精准攻击只能作用自己的攻击')
      if (p.triggered?.includes('maneuver')) throw new Error('同一次攻击只能使用一种战技')
      if (id === 'guided-strike' && a.id !== rolling.id) api.spend(a, 'reaction')
      if (power.resource) spendResource(power.resource)
      const n = id === 'guided-strike' ? 10 : checkedDie(dice, 8)
      entry.roll!.total += n
      entry.roll!.bonusDice.push(n)
      entry.hit =
        entry.roll!.chosen !== 1 && (entry.roll!.chosen === 20 || entry.roll!.total >= entry.ac)
      if (id === 'maneuver-precision') p.triggered = [...(p.triggered ?? []), 'maneuver']
      return (
        power.name +
        '：攻击总值＋' +
        n +
        '，' +
        (entry.hit ? '改为命中' : '仍失手') +
        '；' +
        command.note
      )
    }
    if ((id !== 'protective-field' && !entry.hit) || defender.id !== t.id)
      throw new Error('须选择被命中的具体目标')
    if (id === 'protective-field' && !(entry.damageOverride ?? p.damage).length && !p.attack)
      throw new Error('此窗口没有伤害')
    if (
      ['maneuver-parry', 'feat-defensive-duelist', 'valor-defense'].includes(id) &&
      defender.id !== a.id
    )
      throw new Error('此反应只能保护自己')
    if (['maneuver-parry', 'feat-defensive-duelist'].includes(id) && p.attack?.ranged)
      throw new Error('须近战攻击')
    if (
      id === 'feat-defensive-duelist' &&
      !cat.items.some(
        (w) =>
          w.kind === 'weapon' &&
          w.properties?.includes('finesse') &&
          c.inventory.some((row) => row.itemId === w.id && row.equipped),
      )
    )
      throw new Error('须持用灵巧武器')
    api.spend(a, 'reaction')
    if (power.resource) spendResource(power.resource)
    if (id === 'feat-defensive-duelist') {
      const n = c.level >= 5 ? 3 : 2
      api.addEffect(a, 'defensive-duelist', power.name, a, 0, {
        note: String(n),
        expiresAt:
          e.tick +
          ((e.actors.findIndex((x) => x.id === a.id) - e.current + e.actors.length) %
            e.actors.length || e.actors.length),
      })
      entry.ac += n
      entry.hit = entry.roll!.chosen !== 1 && (entry.critical || entry.roll!.total >= entry.ac)
      return power.name + '：近战 AC＋' + n + ' 至下回合开始'
    }
    if (id.startsWith('valor-')) {
      const inspiration = c.runtime!.effects!.find(
        (f) => f.key === 'bardic-inspiration' && f.variant === 'valor',
      )
      if (!inspiration) throw new Error('没有来自勇气学院的激励骰')
      const n = checkedDie(dice, Number(inspiration.name.match(/d([68])/)?.[1] ?? 6))
      c.runtime!.effects = c.runtime!.effects!.filter((f) => f.id !== inspiration.id)
      entry.acBonus = (entry.acBonus ?? 0) + n
      entry.ac += n
      entry.hit = entry.critical || (entry.roll!.chosen !== 1 && entry.roll!.total >= entry.ac)
      return power.name + '：消耗激励骰 ' + n
    }
    const sides = id === 'protective-field' ? (c.level >= 5 ? 8 : 6) : 8,
      flat =
        id === 'protective-field'
          ? combatStats(a, cs, cat).mods.int
          : combatStats(a, cs, cat).mods[
              (c.build.choices['maneuver-ability']?.[0] ?? 'str') as 'str'
            ],
      n = Math.max(1, checkedDie(dice, sides) + flat)
    entry.interceptions = [
      ...(entry.interceptions ?? []),
      { sourceId: a.id, reduction: n, kind: id },
    ]
    return power.name + '：已登记减伤 ' + n + '；' + command.note
  }
  if (id === 'feat-piercer') {
    if (
      !p ||
      p.kind !== 'attack' ||
      !p.damageRolled ||
      p.actorId !== a.id ||
      !entry?.hit ||
      entry.id !== t.id
    )
      throw new Error('须自己已掷伤害的命中窗口')
    const diceSlots = (entry.damageOverride ?? [])
        .filter((part) => part.type === 'piercing')
        .flatMap((part) => part.roll.dice.map((value, index) => ({ part, index, value }))),
      selected = diceSlots[(command.rule?.count ?? command.amount) - 1]
    if (!selected) throw new Error('请选择此攻击中一枚穿刺伤害骰的序号')
    const sides = Number(selected.part.roll.formula.match(/d(\d+)/)?.[1])
    if (!sides) throw new Error('伤害骰规格不明确')
    const n = checkedDie(dice, sides)
    selected.part.roll.dice[selected.index] = n
    selected.part.roll.total += n - selected.value
    a.turn.manualUsed = [...(a.turn.manualUsed ?? []), onceKey]
    return (
      '穿刺者重掷第 ' +
      (command.rule?.count ?? command.amount) +
      ' 枚：' +
      selected.value +
      ' → ' +
      n +
      '，必须使用新值'
    )
  }
  if (['feat-crusher', 'feat-shield-master'].includes(id)) {
    if (
      !p ||
      p.kind !== 'attack' ||
      p.actorId !== a.id ||
      !entry?.hit ||
      entry.id !== t.id ||
      !p.attack
    )
      throw new Error('须自己的命中攻击窗口')
    if (id === 'feat-crusher' && p.attack.type !== 'bludgeoning') throw new Error('须钝击命中')
    if (id === 'feat-shield-master') {
      if (
        !p.attack.weaponId ||
        !p.triggered?.includes('attack-action') ||
        !c.inventory.some(
          (row) =>
            row.equipped && cat.items.some((w) => w.id === row.itemId && w.kind === 'shield'),
        )
      )
        throw new Error('盾击须持盾、攻击动作中武器命中')
      const dc = 8 + (c.level >= 5 ? 3 : 2) + combatStats(a, cs, cat).mods.str,
        save = savingRoll(t, 'str', env, cs, cat, dice)
      if (save.autoFail || save.total < dc) {
        if (command.rule?.choice !== 'push')
          api.addEffect(t, id, '盾击倒地', a, 0, { condition: 'prone' })
        else
          api.addEffect(t, id, '盾击推离', a, 0, { note: '推离五尺，GM 更新位置：' + command.note })
      }
      a.turn.manualUsed = [...(a.turn.manualUsed ?? []), onceKey]
      return (
        '盾击力量豁免 ' +
        save.total +
        ' / ' +
        dc +
        '，' +
        (save.autoFail || save.total < dc ? '失败' : '成功')
      )
    }
    api.addEffect(t, id, '粉碎者移动', a, 0, {
      note: '体型至多大一级，移动五尺到空位；GM：' + command.note,
    })
    a.turn.manualUsed = [...(a.turn.manualUsed ?? []), onceKey]
    return '本回合粉碎者移动已登记，GM 按确认落点更新地图'
  }
  if (id === 'maneuver-sweeping') {
    if (
      !p ||
      p.kind !== 'attack' ||
      p.actorId !== a.id ||
      !entry?.hit ||
      !p.attack ||
      p.attack.ranged ||
      entry.id === t.id ||
      !entry.roll ||
      entry.roll.total < combatStats(t, cs, cat).ac ||
      env.distance > p.attack.reach
    )
      throw new Error('须已命中近战窗口，另一个触及内、距原目标五尺内且原总值达其 AC 的目标')
    if (p.triggered?.includes('maneuver')) throw new Error('同次攻击只能一种战技')
    spendResource('superiority')
    const roll = rollDamage('1d8', dice)
    p.triggered = [...(p.triggered ?? []), 'maneuver']
    api.damage(t, adjustDamage(roll.total, p.attack.type, defenses(t, cs, cat)))
    api.concentration(t)
    return '横扫攻击 d8＝' + roll.total + '；GM 确認兩目标相邻：' + command.note
  }
  if (p && p.kind === 'attack' && p.damageRolled && power.timing === 'hit' && power.formula) {
    if (p.actorId !== a.id || !entry?.hit || entry.id !== t.id || !p.attack)
      throw new Error('须自己的已命中攻击伤害窗口')
    api.own(a)
    if (id === 'feat-charger') {
      if (p.attack.ranged || !p.triggered?.includes('attack-action') || a.turn.movement < 10)
        throw new Error('冲锋须攻击动作近战命中，且此前至少十尺直线移向目标，GM 核对路径')
      if (command.rule?.choice === 'push') {
        a.turn.manualUsed = [...(a.turn.manualUsed ?? []), onceKey]
        api.addEffect(t, id, '冲锋推离', a, 0, { note: '体型符合，推离十尺；GM：' + command.note })
        return '冲锋选择推离十尺，本次不增加 d8'
      }
    }
    const base = (entry.damageOverride ?? []).reduce(
        (sum, part) => sum + adjustDamage(part.roll.total, part.type, defenses(t, cs, cat)),
        0,
      ),
      ward = combatCharacter(t, cs)?.runtime?.advanced?.ward ?? 0
    if (['psionic-strike', 'hand-harm'].includes(id) && base <= ward)
      throw new Error('须基础命中实际造成生物伤害，完全被守御／抗性／免疫吸收时不能使用')
    if (id === 'psionic-strike' && !p.attack.weaponId) throw new Error('须武器命中')
    if (id === 'hand-harm' && p.attack.id !== 'unarmed') throw new Error('须徒手命中')
    if (id.startsWith('maneuver-') && p.triggered?.includes('maneuver'))
      throw new Error('同一次攻击只能使用一种战技')
    if (power.resource) spendResource(power.resource)
    const extra = rollDamage(
      power.formula + (power.modifier ? (power.modifier > 0 ? '+' : '') + power.modifier : ''),
      dice,
      entry.critical,
    )
    entry.damageOverride = [
      ...(entry.damageOverride ?? []),
      { type: (power.type ?? p.attack.type) as DamageType, roll: extra },
    ]
    if (id.startsWith('maneuver-')) p.triggered = [...(p.triggered ?? []), 'maneuver']
    let consequence = ''
    if (power.save) {
      const roll = savingRoll(t, power.save, env, cs, cat, dice),
        failed = roll.autoFail || roll.total < power.dc!
      consequence = '；豁免 ' + roll.total + ' / DC ' + power.dc + '：' + (failed ? '失败' : '成功')
      if (failed)
        api.addEffect(t, id, power.name, a, 0, {
          ...(power.condition ? { condition: power.condition } : {}),
          note: power.detail + '；GM：' + command.note,
          ...(id === 'maneuver-goading' || id === 'maneuver-menacing'
            ? { expiresAt: e.tick + e.actors.length, phase: 'end' as const }
            : {}),
        })
    }
    if (id === 'maneuver-distracting')
      api.addEffect(t, id, power.name, a, 0, {
        expiresAt: e.tick + e.actors.length,
        note: command.note,
      })
    if (power.once) a.turn.manualUsed = [...(a.turn.manualUsed ?? []), onceKey]
    return (
      power.name +
      '：' +
      extra.formula +
      ' [' +
      extra.dice +
      ']＝' +
      extra.total +
      ' 已加入同次攻击，尚未扣血' +
      consequence +
      '；GM：' +
      command.note
    )
  }
  if (id === 'maneuver-riposte') {
    const last = t.turn.lastAttack
    if (
      p ||
      !last ||
      last.targetId !== a.id ||
      last.hit ||
      last.ranged ||
      last.tick !== e.tick ||
      e.log.at(-1)?.kind !== 'resolve'
    )
      throw new Error('须刚被所选攻击者近战失手；先关闭原攻击窗口')
    api.spend(a, 'reaction')
    spendResource('superiority')
    api.addEffect(a, 'maneuver-commanded', '还击 · 已支付反应', a, 0, {
      endsAt: (r.hours ?? 0) + 1 / 600,
      note: t.id,
    })
    return '已消费反应与卓越骰；从反击入口立即近战攻击，命中加入 d8'
  }
  if (id === 'maneuver-commanders-strike') {
    if (p) throw new Error('先完成待结算攻击')
    api.own(a)
    if (t.id === a.id) throw new Error('须另一名盟友')
    if ((a.turn.attacksLeft ?? 0) > 0) a.turn.attacksLeft!--
    else {
      api.spend(a, 'action')
      a.turn.attacksLeft = c.level >= 5 ? 1 : 0
    }
    api.spend(t, 'reaction')
    spendResource('superiority')
    api.addEffect(t, 'maneuver-commanded', '指挥官打击', a, 0, {
      note: command.note,
      endsAt: (r.hours ?? 0) + 1 / 600,
    })
    return '已交换一次攻击、消费卓越骰和盟友反应；盟友立即从反击入口攻击，命中自动加入 d8'
  }
  if (id === 'maneuver-bait-switch') {
    if (p) throw new Error('先完成待结算')
    api.own(a)
    if (
      t.id === a.id ||
      env.distance > 5 ||
      combatStats(t, cs, cat).conditions.includes('incapacitated')
    )
      throw new Error('须五尺内自愿且未失能盟友')
    if (a.turn.movement + 5 > combatStats(a, cs, cat).speed + a.turn.dash)
      throw new Error('移动不足')
    a.turn.movement += 5
    spendResource('superiority')
    const n = checkedDie(dice, 8)
    api.addEffect(
      command.rule?.choice === 'self' ? a : t,
      'maneuver-bait-switch',
      power.name,
      a,
      0,
      { acBonus: n, expiresAt: e.tick + e.actors.length },
    )
    return '花五尺移动，AC＋' + n + '；GM 已确认换位：' + command.note
  }
  if (['maneuver-feint', 'maneuver-lunging'].includes(id)) {
    if (p) throw new Error('先完成待结算')
    api.own(a)
    api.spend(a, 'bonus')
    spendResource('superiority')
    if (id === 'maneuver-feint' && env.distance > 5) throw new Error('佯攻目标须五尺内')
    if (id === 'maneuver-lunging') a.turn.dash += combatStats(a, cs, cat).speed
    api.addEffect(a, id, power.name, a, 0, { note: t.id, expiresAt: e.tick, phase: 'end' })
    return power.name + '：下次合资格命中加入 d8；移动和直线条件由 GM 核对：' + command.note
  }
  if (e.pending) throw new Error('请先完成当前待结算行动')
  if (id === 'vow-enmity') {
    api.own(a)
    if (t.id === a.id || (!a.turn.action && !(a.turn.attacksLeft ?? 0)))
      throw new Error('仇敌誓言须开始／继续攻击动作，选择另一目标')
    const previous = e.actors.find((x) =>
      combatStats(x, cs, cat).effects.some((f) => f.key === 'vow-enmity' && f.sourceId === a.id),
    )
    const free = previous && combatStats(previous, cs, cat).hp === 0
    if (previous && !free) throw new Error('旧誓言仍生效，目标未归零不能免费转移')
    if (!free) spendResource('channel-divinity')
    const oldEffect =
      previous &&
      combatStats(previous, cs, cat).effects.find(
        (f) => f.key === 'vow-enmity' && f.sourceId === a.id,
      )
    if (previous) {
      const pc = combatCharacter(previous, cs)
      if (pc) pc.runtime!.effects = pc.runtime!.effects!.filter((f) => f.id !== oldEffect!.id)
      else previous.npc!.effects = previous.npc!.effects.filter((f) => f.id !== oldEffect!.id)
    }
    api.addEffect(t, id, power.name, a, 0, {
      expiresAt: oldEffect?.expiresAt ?? e.tick + 10 * e.actors.length,
      note: command.note,
    })
    return '仇敌誓言已绑定此目标，攻击优势；' + (free ? '沿用原期限，不另扣次数' : '引导神力一次')
  }
  if (power.timing === 'hit' || power.timing === 'miss' || power.timing === 'damage') {
    if (
      ['psionic-strike', 'hand-harm', 'dreadful-strike'].includes(id) ||
      id.startsWith('maneuver-')
    )
      throw new Error('此伤害须在最终扣血前使用：先掷攻击伤害，再提交特性，最后合并结算')
    const last = a.turn.lastAttack
    if (
      power.timing === 'hit' &&
      (!last || !last.hit || last.targetId !== t.id || last.tick !== e.tick)
    )
      throw new Error('须自己本回合刚结算的命中')
    if (['psionic-strike', 'hand-harm'].includes(id) && !last?.damaged)
      throw new Error('须该次命中实际造成伤害')
    if (id === 'psionic-strike' && !last?.weaponId) throw new Error('须武器攻击')
    if (id === 'hand-harm' && !last?.unarmed) throw new Error('須徒手打击')
    if (id === 'divine-fury' && !r.rage) throw new Error('须狂暴中使用')
  }
  const firstWave = id === 'sea-wave' && a.turn.manualUsed?.includes('sea-ready')
  if (firstWave) a.turn.manualUsed = a.turn.manualUsed!.filter((k) => k !== 'sea-ready')
  if (power.cost !== 'none' && !firstWave) api.spend(a, power.cost)
  else if (power.timing !== 'damage') api.own(a)
  if (id === 'flurry-healing') {
    if (!(a.turn.flurryLeft ?? 0)) throw new Error('须剩余疾风连击攻击')
    a.turn.flurryLeft!--
  }
  if (id === 'sea-wave' && !c.runtime!.effects!.some((f) => f.key === 'wrath-sea'))
    throw new Error('须先开启瀚海之怒')
  if (id === 'star-chalice' && !c.runtime!.effects!.some((f) => f.key === 'starry-chalice'))
    throw new Error('须圣杯形态')
  if (id === 'tree-vitality' && (!r.rage || t.id === a.id)) throw new Error('须狂暴中给另一生物')
  if (
    [
      'star-arrow',
      'agile-strike',
      'companion-command',
      'companion-restore',
      'primal-companion',
    ].includes(id)
  )
    throw new Error('请使用本能力的攻击／伙伴专用入口')
  let count = command.rule?.count ?? command.amount ?? 1
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('消耗数量不合法')
  if (!['healing-light', 'warrior-gods'].includes(id)) count = 1
  if (id === 'healing-light' && count > Math.max(1, combatStats(a, cs, cat).mods.cha))
    throw new Error('治愈之光一次至多魅力调整值（至少一）枚')
  if (
    power.kind === 'heal' ||
    power.kind === 'temporary' ||
    power.kind === 'save' ||
    (power.timing === 'hit' && power.formula)
  ) {
    if (power.resource) spendResource(power.resource, count)
    if (id === 'durable') {
      if (!r.hitDice) throw new Error('没有剩余生命骰')
      r.hitDice--
    }
    const damage = power.formula
      ? rollDamage(
          power.formula.replace(/^1d/, count + 'd') +
            (power.modifier ? (power.modifier >= 0 ? '+' : '') + power.modifier : ''),
          dice,
          power.timing === 'hit' && !!a.turn.lastAttack?.critical,
        )
      : null
    const ids = command.targets?.length ? command.targets : [t.id]
    if (new Set(ids).size !== ids.length) throw new Error('目标不能重复')
    if (
      [
        'healing-light',
        'warrior-gods',
        'hand-healing',
        'flurry-healing',
        'star-chalice',
        'durable',
        'tree-vitality',
        'refreshing-step',
      ].includes(id) &&
      ids.length !== 1
    )
      throw new Error('此能力每次只能选一个目标')
    if (power.self && t.id !== a.id) throw new Error('此能力仅能作用自己')
    if (
      id === 'mantle-inspiration' &&
      (ids.includes(a.id) || ids.length > Math.max(1, combatStats(a, cs, cat).mods.cha))
    )
      throw new Error('灵感织衣仅能选择至多魅力调整值（至少一）名其他生物')
    for (const tid of ids) {
      const target = actor(tid),
        ev = command.targetEnvironments?.[tid] ?? command.env
      if (ev.distance > power.range || ev.cover === 'total' || !ev.targetLocationConfirmed)
        throw new Error('能力范围／遮蔽不满足')
      if (power.kind === 'heal') api.heal(target, healingRollTotal(combatStats(target, cs, cat).effects, damage!))
      else if (power.kind === 'temporary') {
        const amount = damage!.total * (id === 'mantle-inspiration' ? 2 : 1),
          old = combatStats(target, cs, cat).temporaryHp
        api.temp(target, amount)
        if (id === 'tree-vitality' && amount > old)
          api.addEffect(target, 'tree-thp', power.name, a, 0, { note: String(amount) })
      } else {
        const save = power.save ? savingRoll(target, power.save, ev, cs, cat, dice) : null,
          failed = !save || save.autoFail || save.total < power.dc!
        if (damage && (failed || power.half)) {
          api.damage(
            target,
            adjustDamage(
              damage.total,
              (power.type ?? 'force') as DamageType,
              defenses(target, cs, cat),
              !failed,
            ),
          )
          api.concentration(target)
        }
        if (failed && power.condition)
          api.addEffect(target, id, power.name, a, 0, {
            condition: power.condition,
            note: power.detail,
            expiresAt: e.tick + Math.ceil(power.duration * 600) * e.actors.length,
            endsAt: (r.hours ?? 0) + power.duration,
          })
      }
    }
    if (power.once) a.turn.manualUsed = [...(a.turn.manualUsed ?? []), onceKey]
    return (
      power.name +
      '：规则骰 ' +
      (damage?.total ?? '—') +
      '，目标 ' +
      ids.length +
      '；' +
      power.detail +
      '；GM：' +
      command.note
    )
  }
  if (power.timing === 'before-roll') {
    if (power.resource) spendResource(power.resource)
    const fields: Partial<ActiveEffect> = {
      endsAt: (r.hours ?? 0) + 1 / 600,
      expiresAt: null,
      note: command.note,
    }
    if (id === 'portent') {
      const pi = (command.rule?.count ?? command.amount) - 1,
        n = r.advanced.portents[pi]
      if (n === undefined) throw new Error('预兆骰不可用')
      r.advanced.portents.splice(pi, 1)
      fields.rollOverride = n
    }
    if (id === 'warding-flare') fields.attackDisadvantage = true
    if (id === 'tides-chaos') {
      if (t.id !== a.id) throw new Error('混乱之潮只作用自己的检定')
      fields.attackAdvantage = true
    }
    api.addEffect(
      t,
      id === 'restore-balance'
        ? 'restore-balance-roll'
        : id === 'warding-flare'
          ? 'warding-flare-roll'
          : id === 'tides-chaos'
            ? 'tides-chaos-roll'
            : 'portent-roll',
      power.name,
      a,
      0,
      fields,
    )
    if (power.once) a.turn.manualUsed = [...(a.turn.manualUsed ?? []), onceKey]
    return power.name + '：已在检定前登记，消费一次；下一次对应 d20 结算后移除；' + command.note
  }
  const detail = useAdvanced(
    c,
    cat,
    {
      id: command.id,
      amount: command.rule?.count ?? command.amount,
      choice: command.rule?.choice,
      confirmed: true,
      note: command.note,
    },
    dice,
  )
  if (power.once) a.turn.manualUsed = [...(a.turn.manualUsed ?? []), onceKey]
  cs[index] = c
  if (id === 'starry-archer') a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'star-ready']
  if (id === 'wrath-sea') a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'sea-ready']
  if (id === 'eagle-step') {
    if (!r.rage || !r.effects.some((f) => f.key === 'rage-eagle')) throw new Error('须鹰怒意狂暴')
    a.turn.dash += combatStats(a, cs, cat).speed
    api.addEffect(a, 'disengage', '鹰之撤离', a, 0, { expiresAt: e.tick, phase: 'end' })
  }
  if (id === 'maneuver-evasive')
    api.addEffect(a, 'disengage', '撤离', a, 0, { expiresAt: e.tick, phase: 'end' })
  return detail
}
