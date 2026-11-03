import {hitSpellCandidates} from './spell-attack-windows'
import { featIds, one, type Catalogue } from './engine'
import { hasOrigin } from './origins'
import {
  availableSlots,
  castSlotLevel,
  findItem,
  runtimeDerived,
  runtimeSpells,
  runtimeState,
} from './runtime'
import { combatCharacter, combatStats, defenseOptions, defenses } from './combat-rules'
import { hasStyle } from './growth-rules'
import type { Character } from './types'
import type { CombatCommand, Combatant, Encounter, AttackSpec, TurnBudget } from './combat-types'
import { DAMAGE_NAMES } from './combat-types'

export type ResolutionChoice =
  'savage' | 'tavernReroll' | 'healerReroll' | 'revelation' | 'nonlethal' | 'relentless' | 'push'
export function attackFeatureOptions(
  c: Character | undefined,
  turn: TurnBudget | null | undefined,
  attack: AttackSpec | undefined,
) {
  const sneak = c?.build.classId === 'rogue'
  return {
    sneak,
    sneakReason: !sneak
      ? '没有偷袭能力'
      : turn?.sneakUsed
        ? '本回合已使用偷袭'
        : !attack || !(attack.properties.includes('finesse') || (attack.ranged && attack.weaponId))
          ? '须使用灵巧或远程武器'
          : '',
    mastery: !!attack?.mastery,
  }
}
export interface ResolutionAbility {
  key: string
  id: string
  actorId: string
  targetIndex: number
  group: string
  targetName?: string
  name: string
  stage: string
  cost: string
  reason: string
  committed?: boolean
  choice?: ResolutionChoice
  command?: CombatCommand
  dice?: number[]
  maxDice?: number
}

/** Read-only candidates. Commands still validate against authoritative state when submitted. */
export function resolutionAbilities(
  e: Encounter,
  cs: Character[],
  cat: Catalogue,
): ResolutionAbility[] {
  const p = e.pending
  if (!p) return []
  const source = e.actors.find((a) => a.id === p.actorId)
  if (!source) return []
  const c = combatCharacter(source, cs),
    r = c ? runtimeState(c, cat) : null
  const result: ResolutionAbility[] = []
  const add = (
    a: Combatant,
    index: number,
    id: string,
    name: string,
    stage: string,
    cost: string,
    reason = '',
    choice?: ResolutionChoice,
    command?: CombatCommand,
    attacker = false,
  ) => {
    const target = e.actors.find((actor) => actor.id === p.targets[index]?.id)
    result.push({
      key: `${id}:${a.id}:${index}`,
      id,
      actorId: a.id,
      targetIndex: index,
      group: `${attacker ? '攻击方' : '防御方'} · ${combatStats(a, cs, cat).name}`,
      name,
      stage,
      cost,
      reason,
      choice,
      command,
      targetName: target ? combatStats(target, cs, cat).name : undefined,
    })
  }
  const hits = p.targets.some((t) => t.hit)
  const beforeDamage = p.damageRolled ? '伤害已掷出，不能更改此前的骰值' : ''
  if (p.kind === 'attack' && c) {
    if (featIds(c.build, cat).includes('savage-attacker') && p.attack?.weaponId)
      add(
        source,
        -1,
        'savage',
        '凶蛮打手',
        '命中后 · 掷伤害前',
        '每回合一次',
        beforeDamage || (source.turn.savageUsed ? '本回合已使用' : !hits ? '本次未命中' : ''),
        'savage',
        undefined,
        true,
      )
    if (p.attack?.id === 'unarmed' && hasOrigin(c, cat, 'tavern-brawler'))
      add(
        source,
        -1,
        'tavern',
        '酒馆斗殴者',
        '掷伤害时',
        '伤害骰1重掷一次',
        beforeDamage || (!hits ? '本次未命中' : ''),
        'tavernReroll',
        undefined,
        true,
      )
    if (
      (p.attack?.id === 'unarmed' &&
        hasOrigin(c, cat, 'tavern-brawler') &&
        p.triggered?.includes('attack-action')) ||
      (p.mastery && p.attack?.mastery === 'Push')
    )
      add(
        source,
        -1,
        'push',
        'GM确认推移',
        '命中后',
        '核对落点；不自动移动棋子',
        !hits ? '本次未命中' : '',
        'push',
        undefined,
        true,
      )
  }
  if (c && p.mode === 'heal' && hasOrigin(c, cat, 'healer'))
    add(
      source,
      -1,
      'healer',
      '医疗师',
      '治疗结算',
      '治疗骰1重掷一次',
      p.triggered?.includes('healer-rerolled') ? '已处理本次重掷' : '',
      'healerReroll',
      undefined,
      true,
    )

  p.targets.forEach((entry, index) => {
    const target = e.actors.find((a) => a.id === entry.id)
    if (!target) return
    const defender = combatCharacter(target, cs),
      state = defender ? runtimeState(defender, cat) : null
    if (c && r && p.kind === 'attack' && c.build.classId === 'monk' && c.level >= 5 && !p.spellId) {
      const item = p.attack?.weaponId ? findItem(c, cat, p.attack.weaponId) : null
      const weapon =
        p.attack?.id === 'unarmed' ||
        (item &&
          (item.category === 'simple-melee' ||
            (item.category === 'martial-melee' && item.properties?.includes('light'))))
      add(
        source,
        index,
        'stun',
        '震慑打击',
        '近战命中后',
        `专注点 ×1；剩余 ${r.resources.focus ?? 0}`,
        !entry.hit || !weapon || p.attack?.ranged
          ? '本次不是合法的武僧近战命中'
          : e.actors[e.current]?.id !== source.id
            ? '须在自己的回合'
            : source.turn.manualUsed?.includes('stun')
              ? '本回合已使用'
              : !r.resources.focus
                ? '专注点不足'
                : '',
        undefined,
        {
          type: 'trigger-feature',
          actorId: source.id,
          targetIndex: index,
          id: 'stun',
          note: 'GM在结算能力区确认震慑打击的命中与目标',
        },
        true,
      )
    }
    if (c?.build.choices.metamagic?.includes('seeking') && p.spellId && p.kind === 'attack')
      add(
        source,
        index,
        'seeking',
        '追踪法术重掷',
        '未命中后 · 伤害前',
        `术法点 ×1；剩余 ${r?.resources['sorcery-points'] ?? 0}`,
        beforeDamage ||
          (entry.hit
            ? '本次已命中'
            : p.triggered?.includes('seeking:' + index)
              ? '该次攻击已使用'
              : !r?.resources['sorcery-points']
                ? '术法点不足'
                : ''),
        undefined,
        {
          type: 'spell-reroll',
          actorId: source.id,
          targetIndex: index,
          kind: 'seeking',
          diceIndices: [],
        },
        true,
      )
    if (entry.roll) {
      const roller = p.kind === 'attack' ? source : target
      const rc = combatCharacter(roller, cs),
        rr = rc ? runtimeState(rc, cat) : null
      if (rr?.heroicInspiration)
        add(
          roller,
          index,
          'heroic',
          '英雄激励重掷',
          'D20结果后 · 伤害前',
          '英雄激励 ×1',
          beforeDamage || (entry.roll.autoFail ? '状态导致自动失败，不能重掷' : ''),
          undefined,
          { type: 'inspiration', actorId: roller.id, targetIndex: index, kind: 'heroic' },
          p.kind === 'attack',
        )
      if (combatStats(roller, cs, cat).effects.some((f) => f.key === 'bardic-inspiration'))
        add(
          roller,
          index,
          'bardic',
          '吟游激励',
          'D20失败后 · 伤害前',
          '消耗当前吟游激励',
          beforeDamage ||
            (entry.roll.autoFail
              ? '状态导致自动失败'
              : (p.kind === 'attack' ? entry.hit : !entry.hit)
                ? '本次检定未失败'
                : ''),
          undefined,
          { type: 'inspiration', actorId: roller.id, targetIndex: index, kind: 'bardic' },
          p.kind === 'attack',
        )
    }
    if (p.kind === 'attack' && p.attack && !p.attack.ranged)
      add(
        source,
        index,
        'nonlethal',
        '近战击倒',
        '该目标降至0HP时',
        '仅本目标；1HP并昏迷',
        !entry.hit ? '本次未命中' : '',
        'nonlethal',
        undefined,
        true,
      )
    if (
      r?.revelation &&
      (p.kind === 'attack' || p.spellId) &&
      !['heal', 'temporary', 'buff'].includes(p.mode)
    )
      add(
        source,
        index,
        'revelation',
        '天启加伤',
        '造成伤害时',
        '自己回合一次；选择一名目标',
        e.actors[e.current]?.id !== source.id
          ? '不在自己的回合'
          : source.turn.manualUsed?.includes('revelation-damage')
            ? '本回合已使用'
            : p.kind === 'attack' && !entry.hit
              ? '本次未命中'
              : '',
        'revelation',
        undefined,
        true,
      )
    if (defender && state) {
      const eligible = defenseOptions(target, p, entry, cs, cat)
      const reactionReason = !target.turn.reaction
        ? '反应已用'
        : entry.defense
          ? '本次命中已提交防御反应'
          : combatStats(target, cs, cat).conditions.some((s) =>
                ['incapacitated', 'stunned', 'paralyzed', 'unconscious', 'petrified'].includes(s),
              )
            ? '当前状态不能使用反应'
            : ''
      const damageReason =
        p.kind === 'attack' && !p.damageRolled ? '先掷攻击伤害，再选择减伤反应' : ''
      const defs: ['uncanny' | 'deflect' | 'stone', boolean, string, string][] = [
        [
          'uncanny',
          defender.build.classId === 'rogue' && defender.level >= 5,
          '诡异闪避',
          '反应 ×1；伤害减半',
        ],
        [
          'deflect',
          defender.build.classId === 'monk' && defender.level >= 3,
          '偏转攻击',
          '反应 ×1；减少1d10＋敏捷＋等级',
        ],
        [
          'stone',
          !state.wildShape &&
            defender.build.speciesId === 'goliath' &&
            one(defender.build, 'ancestry') === 'stone',
          '石之坚韧',
          `反应 ×1；剩余 ${state.resources['giant-ancestry'] ?? 0} 次`,
        ],
      ]
      for (const [id, owned, name, cost] of defs)
        if (owned)
          add(
            target,
            index,
            id,
            name,
            '伤害已掷 · 扣血前',
            cost,
            reactionReason ||
              (id === 'stone' && !state.resources['giant-ancestry'] ? '能力次数已耗尽' : '') ||
              damageReason ||
              (!eligible.includes(id) ? '本次伤害、视线或目标条件不满足' : ''),
            undefined,
            { type: 'reaction-defense', actorId: target.id, targetIndex: index, kind: id },
          )
      if (!state.wildShape && defender.build.speciesId === 'orc')
        add(
          target,
          index,
          'relentless',
          '顽强不屈',
          '伤害已掷 · 致命伤判定时',
          `剩余 ${state.resources.relentless ?? 0} 次；未即死时保留1HP`,
          !state.resources.relentless
            ? '能力次数已耗尽'
            : state.hp <= 0
              ? '须从正HP降至0HP'
              : damageReason ||
                (p.kind === 'attack' && !entry.hit ? '本次未命中' : '') ||
                (['heal', 'temporary', 'buff'].includes(p.mode) ? '本次不是伤害' : ''),
          'relentless',
        )
    }
  })
  const damageParts =
    p.kind === 'attack' && p.damageRolled
      ? p.targets.flatMap((entry) => entry.damageOverride ?? [])
      : p.damage
  if (
    c?.build.choices.metamagic?.includes('empowered') &&
    p.spellId &&
    damageParts.some((part) => part.roll.dice.length) &&
    !['heal', 'temporary', 'buff'].includes(p.mode)
  ) {
    add(
      source,
      -1,
      'empowered',
      '强效法术重掷',
      '伤害骰已生成 · 扣血前',
      `术法点 ×1；剩余 ${r?.resources['sorcery-points'] ?? 0}`,
      p.triggered?.includes('empowered:damage')
        ? '本次伤害已使用'
        : !r?.resources['sorcery-points']
          ? '术法点不足'
          : '',
      undefined,
      {
        type: 'spell-reroll',
        actorId: source.id,
        targetIndex: 0,
        kind: 'empowered',
        diceIndices: [],
      },
      true,
    )
    result.at(-1)!.dice = damageParts.flatMap((part) => part.roll.dice)
    result.at(-1)!.maxDice = Math.max(1, combatStats(source, cs, cat).mods.cha)
  }
  for (const option of result) {
    option.committed =
      (option.id === 'savage' && !!p.damageChoices?.savage) ||
      (option.id === 'tavern' && !!p.damageChoices?.tavernReroll) ||
      (['uncanny', 'deflect', 'stone'].includes(option.id) &&
        p.targets[option.targetIndex]?.defense?.kind === option.id)
  }
  for(const item of hitSpellCandidates(e,cs,cat)){
   const t=p.targets[item.targetIndex];result.push({key:'hit-spell:'+item.command.key+':'+item.command.mode+':'+item.command.targetId,id:'hit-spell',actorId:source.id,targetIndex:item.targetIndex,group:'攻击方 · 命中后法术',targetName:t?combatStats(e.actors.find(a=>a.id===t.id)!,cs,cat).name:undefined,name:item.name+' · '+item.command.mode,stage:'命中后 · 掷伤害前',cost:'附赠动作＋实际法术来源',reason:item.reason,command:item.command})
  }
  return p.concentrationSave?result.filter(o=>['heroic','bardic'].includes(o.id)):result
}

export function shieldModes(a: Combatant, cs: Character[], cat: Catalogue) {
  const c = combatCharacter(a, cs)
  if (!c) return []
  const r = runtimeState(c, cat)
  return runtimeSpells(c, cat)
    .filter((g) => g.spell.id === 'shield')
    .map((g) => ({
      ...g,
      modes: g.modes.filter((mode) => {
        const level = castSlotLevel(mode)
        return level
          ? availableSlots(c, cat, level) > 0
          : mode === 'at-will' ||
              (mode === 'free' && !!g.resource && (r.resources[g.resource] ?? 0) > 0)
      }),
    }))
}

export function resolutionPassiveSources(e: Encounter, cs: Character[], cat: Catalogue) {
  const p = e.pending
  if (!p) return []
  const source = e.actors.find((a) => a.id === p.actorId)
  const c = source ? combatCharacter(source, cs) : null
  const names = new Set<string>()
  if (p.sneak) names.add('攻击方 · 偷袭已选择；按命中与每回合次数结算')
  if (p.mastery && p.attack?.mastery) names.add('攻击方 · 武器精通 ' + p.attack.mastery)
  if (c && p.attack?.weaponId) {
    if (hasStyle(c.build, 'great-weapon-fighting', cat))
      names.add('攻击方 · 巨武器战斗；按持用与武器条件修正伤害骰')
    for (const id of [
      'great-weapon-master',
      'crusher',
      'slasher',
      'piercer',
      'elemental-adept',
      'poisoner',
    ])
      if (featIds(c.build, cat).includes(id))
        names.add(
          '攻击方 · ' + (cat.feats.find((f) => f.id === id)?.name ?? id) + '（按本次触发条件处理）',
        )
  }
  for (const a of e.actors.filter(
    (a) => a.id === p.actorId || p.targets.some((t) => t.id === a.id),
  )) {
    const s = combatStats(a, cs, cat),
      d = defenses(a, cs, cat)
    for (const f of s.effects) names.add(s.name + ' · ' + f.name)
    if (d.resistances.length)
      names.add(s.name + ' · 抗性：' + d.resistances.map((type) => DAMAGE_NAMES[type]).join('、'))
    if (d.immunities.length)
      names.add(s.name + ' · 免疫：' + d.immunities.map((type) => DAMAGE_NAMES[type]).join('、'))
    if (d.vulnerabilities.length)
      names.add(
        s.name + ' · 易伤：' + d.vulnerabilities.map((type) => DAMAGE_NAMES[type]).join('、'),
      )
    const card = combatCharacter(a, cs)
    if (card && featIds(card.build, cat).includes('heavy-armor-master'))
      names.add(s.name + ' · 重甲大师（穿着重甲且伤害类型满足时自动处理）')
  }
  return [...names]
}

/** Shield is deliberately separate: source/mode and components need an explicit selection. */
export function shieldCandidates(e: Encounter, cs: Character[], cat: Catalogue) {
  const p = e.pending
  if (!p || (p.kind !== 'attack' && p.spellId !== 'magic-missile')) return []
  return e.actors.flatMap((a) => {
    if (!p.targets.some((t) => t.id === a.id)) return []
    const c = combatCharacter(a, cs)
    if (!c || !runtimeSpells(c, cat).some((g) => g.spell.id === 'shield')) return []
    const s = combatStats(a, cs, cat)
    const r = runtimeState(c, cat)
    const reason = !a.turn.reaction
      ? '反应已用'
      : p.kind === 'attack' && p.damageRolled
        ? '伤害已掷出；护盾术须在伤害前使用'
        : s.dead ||
            s.conditions.some((k) =>
              ['incapacitated', 'stunned', 'paralyzed', 'unconscious', 'petrified'].includes(k),
            )
          ? '当前状态不能使用反应'
          : a.turn.quickenedCast
            ? '快捷法术限制'
            : r.rage
              ? '狂暴期间不能施法'
              : r.wildShape
                ? '本入口不支持该荒野形态施法'
                : runtimeDerived(c, cat).untrainedArmor
                  ? '穿着未受训护甲'
                  : !shieldModes(a, cs, cat).some((g) => g.modes.length)
                    ? '可用法术位／免费次数已耗尽'
                    : !p.targets.some(
                          (t) => t.id === a.id && (p.spellId === 'magic-missile' || t.hit),
                        )
                      ? '本次攻击未命中该目标'
                      : ''
    return [{ actor: a, reason }]
  })
}
