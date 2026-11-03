import {npcWeaponSpec} from './spell-weapon-riders'
import { spatialCapabilities } from './m3-spatial'
import { beast, beastNpc } from './beasts'
import {protectionBlocks} from './protection-evil'
import {slowed,enfeebled} from './m2-control'
import { prepareDice, recordDiceOutcome, diceTraceCount, sourcedDie } from './dice-source'
import { martialArtsEligible } from './weapon-rules'
import { inventoryName } from './special-weapons'
import { PHB_SPELL_EFFECTS } from './phb-spell-rules'
import { hpSpellBonus } from './spell-restoration'
import { ABILITIES, type Ability, type Character, type ActiveEffect } from './types'
import { derived, one, featIds, modifier, weaponProficient, type Catalogue } from './engine'
import {
  runtimeSpells,
  checkDetail,
  runtimeState,
  runtimeDerived,
  findItem,
  effectiveConditions,
} from './runtime'
import {
  equippedInventory,
  equipmentLayout,
  assignedSlot,
  SLOT_NAMES,
  freeHandSlots,
} from './equipment'
import { appliedEffects } from './effects'
import { hasInvocation, hasStyle, pbOf, levelOf, hasSubclass } from './growth-rules'
import { hasFeat } from './advanced-rules'
import { DAMAGE_TYPES } from './combat-types'
import type {
  AttackSpec,
  Combatant,
  CombatNpc,
  D20Result,
  DamageRoll,
  DamageType,
  Encounter,
  Environment,
  PendingAction,
  PendingTarget,
} from './combat-types'
export function defenseOptions(
  a: Combatant,
  p: PendingAction,
  entry: PendingTarget,
  cs: Character[],
  cat: Catalogue,
): ('uncanny' | 'deflect' | 'stone')[] {
  const c = combatCharacter(a, cs),
    s = combatStats(a, cs, cat)
  if (
    !c ||
    !a.turn.reaction ||
    entry.defense ||
    s.dead ||
    s.conditions.includes('incapacitated') ||
    s.effects.some((x) => x.noReaction)
  )
    return []
  const options: ('uncanny' | 'deflect' | 'stone')[] = []
  if (p.kind === 'attack' && entry.hit) {
    if (c.build.classId === 'rogue' && c.level >= 5 && entry.env.targetSees) options.push('uncanny')
    if (
      c.build.classId === 'monk' &&
      c.level >= 3 &&
      [p.attack?.type, ...p.damage.map((x) => x.type)].some((x) =>
        ['bludgeoning', 'piercing', 'slashing'].includes(x ?? ''),
      )
    )
      options.push('deflect')
  }
  if (
    !c.runtime?.wildShape &&
    c.build.speciesId === 'goliath' &&
    one(c.build, 'ancestry') === 'stone' &&
    (runtimeState(c, cat).resources['giant-ancestry'] ?? 0) > 0 &&
    !p.metamagic?.protectedIds.includes(a.id) &&
    !['heal', 'temporary', 'buff'].includes(p.mode) &&
    (p.kind !== 'attack' || entry.hit) &&
    (p.kind !== 'save' || entry.hit || p.half) &&
    (p.attack || p.damage.some((x) => x.roll.total > 0))
  )
    options.push('stone')
  return options
}

export const defaultEnvironment = (): Environment => ({
  distance: 5,
  cover: 'none',
  attackerSees: true,
  targetSees: true,
  nearbyEnemy: false,
  advantage: false,
  disadvantage: false,
  fearVisible: false,
  targetLocationConfirmed: true,
  areaConfirmed: false,
  note: '',
})
export const freshTurn = () => ({
  deathSaveDone: false,
  objectInteraction: true,
  action: true,
  attacksLeft: 0,
  manualUsed: [] as string[],
  surgeUsed: false,
  surgeAction: false,
  bonus: true,
  reaction: true,
  movement: 0,
  dash: 0,
  lightWeapon: null,
  lightWeapons: [] as string[],
  lightUsed: false,
  nickUsed: false,
  cleaveUsed: false,
  sneakUsed: false,
  savageUsed: false,
  loading: [] as string[],
})
export function combatCharacter(a: Combatant, cs: Character[]) {
  const c = cs.find((c) => c.id === a.characterId)
  if (a.characterId && !c) throw new Error('遭遇引用的角色不存在')
  return c
}
export function senseBypassesImages(a: Combatant, cs: Character[], cat: Catalogue, distance: number) {
  const c = combatCharacter(a,cs)
  if(c) return runtimeDerived(c,cat).blindsight > 0 && runtimeDerived(c,cat).blindsight >= distance
  return (a.npc?.templateMetadata?.senses ?? []).some(s=>{
    if(!/blindsight|truesight|盲视|真实视觉/i.test(s))return false
    const feet=Number(s.match(/\d+/)?.[0]??0)
    return feet>0&&feet>=distance
  })
}
export function combatStats(a: Combatant, cs: Character[], cat: Catalogue) {
  const c = combatCharacter(a, cs)
  if (c) {
    const r = runtimeState(c, cat),
      d = runtimeDerived(c, cat)
    return {
      name: c.build.name || '未命名角色',
      ac: d.ac,
      hp: r.hp,
      maxHp: d.hp,
      temporaryHp: r.temporaryHp,
      speed: d.speed,
      spatialCapabilities:d.spatialCapabilities,
      scores: d.scores,
      mods: d.mods,
      saves: d.saves,
      conditions: d.conditions,
      passivePerception:d.passivePerception,
      effects: appliedEffects(r.effects),
      dead: r.death.dead,
      exhaustion: r.exhaustion,
    }
  }
  const n = a.npc
  if (!n) throw new Error('参与者缺少角色或 NPC 数据')
  const effects = appliedEffects(n.effects)
  const conditions = [
    ...new Set([
      ...n.conditions,
      ...effects.flatMap((e) =>
        [...(e.condition ? [e.condition] : []), ...(e.conditions ?? [])].filter(
          (c) => !(n.conditionImmunities ?? []).includes(c),
        ),
      ),
      ...(!n.hp ? ['unconscious', 'prone'] : []),
    ]),
  ]
  if (conditions.includes('unconscious') && !conditions.includes('prone')) conditions.push('prone')
  for (const effect of effects) for (const immune of effect.conditionImmunities ?? []) {
    const index = conditions.indexOf(immune); if (index >= 0) conditions.splice(index,1)
  }
  if (n.effects.some((e) => e.key === 'heroism')) {
    const i = conditions.indexOf('frightened')
    if (i >= 0) conditions.splice(i, 1)
  }
  if (n.effects.some((e) => ['faerie-fire','starry-wisp','shining-smite'].includes(e.key))) {
    const i = conditions.indexOf('invisible')
    if (i >= 0) conditions.splice(i, 1)
  }
  if (conditions.includes('petrified') || n.effects.some((e) => e.key === 'feign-death')) {
    const i = conditions.indexOf('poisoned')
    if (i >= 0) conditions.splice(i, 1)
  }
  if (conditions.some((x) => ['unconscious', 'paralyzed', 'petrified', 'stunned'].includes(x)))
    conditions.push('incapacitated')
  const mods = Object.fromEntries(ABILITIES.map((x) => [x, modifier(n.scores[x])])) as Record<
    Ability,
    number
  >
  return {
    name: n.name,
    passivePerception:(n.templateMetadata?.passivePerception??10+mods.wis)-(effects.some(e=>e.key==='enthrall')?10:0),
    ac: Math.max(...effects.map(e=>e.acFloor??0),
      Math.max(
        n.ac,
        ...effects.filter((e) => e.acBase !== undefined).map((e) => e.acBase! + mods.dex),
      ) + effects.reduce((s, e) => s + (slowed([e])?0:e.acBonus ?? 0), 0))-(slowed(effects)?2:0),
    hp: n.hp,
    maxHp: n.maxHp + hpSpellBonus(effects),
    temporaryHp: n.temporaryHp,
    speed: spatialCapabilities({walk:Math.max(0,n.speed-effects.reduce((v,e)=>v+(e.speedPenalty??0),0)+effects.reduce((v,e)=>v+(e.speedBonus??0),0))/(slowed(effects)?2:1)/(effects.some(f=>f.key==='guardians-region')?2:1)},effects,effects.some(e=>e.speedZero)||conditions.some(x=>['grappled','restrained','paralyzed','petrified','unconscious'].includes(x))).walk,
    spatialCapabilities:spatialCapabilities({walk:Math.max(0,n.speed-effects.reduce((v,e)=>v+(e.speedPenalty??0),0)+effects.reduce((v,e)=>v+(e.speedBonus??0),0))/(slowed(effects)?2:1)/(effects.some(f=>f.key==='guardians-region')?2:1),fly:n.templateMetadata?.movement.find(m=>m.kind==='fly')?.feet,climb:n.templateMetadata?.movement.find(m=>m.kind==='climb')?.feet,swim:n.templateMetadata?.movement.find(m=>m.kind==='swim')?.feet,size:n.size,waterBreathing:n.templateMetadata?.abilities.some(a=>['water-breathing','amphibious'].includes(a.id)),handsFreeClimb:n.templateMetadata?.abilities.some(a=>a.id==='spider-climb'),hover:n.templateMetadata?.abilities.some(a=>a.id==='hover')},effects,effects.some(e=>e.speedZero)||conditions.some(x=>['grappled','restrained','paralyzed','petrified','unconscious'].includes(x))),
    scores: n.scores,
    mods,
    saves: Object.fromEntries(Object.entries(n.saves).map(([a,n])=>[a,n+effects.reduce((sum,e)=>sum+(e.flatSaveBonus??0),0)-(a==='dex'&&slowed(effects)?2:0)])) as Record<Ability,number>,
    conditions,
    effects,
    dead: n.dead,
    exhaustion: 0,
  }
}
export function damageType(value: string): DamageType {
  const map: Record<string, DamageType> = {
    钝击: 'bludgeoning',
    穿刺: 'piercing',
    挥砍: 'slashing',
    强酸: 'acid',
    寒冷: 'cold',
    火焰: 'fire',
    力场: 'force',
    闪电: 'lightning',
    黯蚀: 'necrotic',
    坏死: 'necrotic',
    毒素: 'poison',
    心灵: 'psychic',
    光耀: 'radiant',
    雷鸣: 'thunder',
  }
  return map[value] ?? (value.toLowerCase() as DamageType)
}
export function attackOptions(a: Combatant, cs: Character[], cat: Catalogue): AttackSpec[] {
  const c = combatCharacter(a, cs)
  if (a.companion?.source === 'wild-companion' || a.companion?.dismissed) return []
  if (c?.runtime?.wildShape) {
    const form = beast(c.runtime.wildShape.formId)!
    return attackOptions({ ...a, characterId: null, npc: beastNpc(form.id) }, [], cat).map((w) => ({
      ...w,
      page: form.page,
      bonus: w.bonus - runtimeState(c, cat).exhaustion * 2,
    }))
  }
  if (!c){
    const natural=a.npc!.effects.find(f=>f.key==='alter-self'&&f.m3?.option==='weapons')
    const ordinary:AttackSpec[]= a.npc!.attacks.filter(w=>!a.companion?.worldManaged||!a.npc?.equipment?.some(g=>g.attackIds.includes(w.id)&&!g.held)).map((w) => npcWeaponSpec(a,w,{
      id: w.id,
      name: w.name,
      bonus: w.bonus,
      damage: w.damage,
      extraDamage: w.extraDamage,
      proneMaxSize: w.proneMaxSize,
      proneRequiresCharge: w.proneRequiresCharge,
      advantageWhileGrappling: w.advantageWhileGrappling,
      effectNote: w.effectNote,
      reach: w.reach,
      range: w.range,
      longRange: w.longRange,
      projectile:w.projectile,
      ability: w.ability??'str',abilityKnown:w.ability!==undefined,
      modifier: 0,
      type: w.damageType,
      ranged: w.range > 0,
      weaponId: null,
      instanceId: null,
      properties: [
        ...(w.unarmed?['unarmed']:[]),
        ...(w.kind === 'thrown' ? ['npc-thrown'] : w.kind === 'spell' ? ['npc-spell'] : []),
        ...(w.manualOnly ? ['gm-adjudication'] : []),
      ],
      mastery: null,
      page: 0,
    }))
    if(natural){const ability=natural.ability??a.npc!.spellcasting?.ability??'wis',mod=modifier(a.npc!.scores[ability]);ordinary.push({id:'unarmed',name:'变身术天生武器',bonus:mod+(a.npc!.templateMetadata?.proficiencyBonus??2),ability,modifier:mod,damage:'1d6',type:natural.m3?.naturalDamageType??'slashing',ranged:false,reach:5,range:0,longRange:0,weaponId:null,instanceId:null,properties:[],mastery:null,page:natural.page})}
    return ordinary
  }
  const d = runtimeDerived(c, cat),
    r = runtimeState(c, cat),
    equipped = equippedInventory(c, cat),
    monk = martialArtsEligible(c, equipped, [...cat.items, ...c.build.customItems])
  const attacks = d.attacks
    .filter((x) => x.ready)
    .flatMap((x) => {
      const w = x.item,
        variants =
          w.properties?.some((p) => p.startsWith('thrown')) && w.category?.endsWith('melee')
            ? [false, true]
            : [!!w.category?.endsWith('ranged')]
      return variants.map((thrown) => {
        const row = c.inventory.find((r) => r.instanceId === x.instanceId)!,
          special = row.specialWeapon
        let ability: Ability = thrown && w.category?.endsWith('ranged') ? 'dex' : 'str'
        if (w.properties?.includes('finesse') && d.mods.dex > d.mods.str) ability = 'dex'
        if (
          monk &&
          (w.category === 'simple-melee' ||
            (w.category === 'martial-melee' && w.properties?.includes('light'))) &&
          d.mods.dex > d.mods[ability]
        )
          ability = 'dex'
        if (
          c.build.classId === 'warlock' &&
          hasInvocation(c.build, 'blade') &&
          one(c.build, 'pact-weapon') === w.id
        )
          ability = 'cha'
        let formula = thrown && w.category?.endsWith('melee') ? w.damage! : x.damage.split(' ')[0]!
        if (
          monk &&
          (w.category === 'simple-melee' ||
            (w.category === 'martial-melee' && w.properties?.includes('light'))) &&
          /^1d[46]$/.test(formula)
        )
          formula = c.level >= 5 ? '1d8' : '1d6'
        const shillelagh = r.effects.find((e) => e.key === 'shillelagh' && e.note === x.instanceId)
        if (shillelagh && !thrown) {
          ability = shillelagh.ability!
          formula = c.level >= 5 ? '1d10' : '1d8'
        }
        const enchantment = appliedEffects(r.effects).filter(
            (f) => f.weapon?.instanceId === x.instanceId,
          ),
          enchantmentBonus = Math.max(0, ...enchantment.map((f) => f.weapon!.bonus))
        const range = w.properties
          ?.find((p) =>
            p.startsWith(
              w.properties?.some((p) => p.startsWith('thrown')) ? 'thrown' : 'ammunition',
            ),
          )
          ?.match(/(\d+)\/(\d+)/)
        return {
          id: x.instanceId + (thrown ? ':ranged' : ''),
          name:
            inventoryName(row, w.name) +
            (thrown ? ' · 远程' : '') +
            (assignedSlot(c, cat, row) ? ' · ' + SLOT_NAMES[assignedSlot(c, cat, row)!] : ''),
          bonus:
            d.mods[ability] +
            (weaponProficient(c.build, cat, w.id) ? pbOf(c.build) : 0) +
            (hasStyle(c.build, 'archery', cat) && w.category?.endsWith('ranged') ? 2 : 0) -
            r.exhaustion * 2 +
            enchantmentBonus +
            (special?.attackBonus ?? 0),
          ability,
          modifier: d.mods[ability],
          ...(special
            ? {
                damageBonus: special.damageBonus,
                extraDamage: special.extraDamage.map((d) => ({ ...d })),
              }
            : {}),
          damage: formula,
          type: shillelagh&&!thrown&&shillelagh.supportChoice==='force'?'force':damageType(w.damageType ?? '钝击'),
          ranged: thrown,
          reach: w.properties?.includes('reach') ? 10 : 5,
          range: range ? Number(range[1]) : 0,
          longRange: range ? Number(range[2]) : 0,
          projectile:thrown||w.properties?.some(p=>p.startsWith('ammunition'))?'ordinary':undefined,
          weaponId: w.id,
          instanceId: x.instanceId,
          properties: [
            ...(w.properties ?? []),
            ...(w.category?.endsWith('ranged') ? ['ranged-weapon'] : []),
          ],
          mastery: [
            ...(c.build.choices.mastery ?? []),
            ...(c.build.choices['feat-mastery'] ?? []),
          ].includes(w.id)
            ? (w.mastery ?? null)
            : null,
          page: w.source.page,
        } as AttackSpec
      })
    })
  const dance =
    hasSubclass(c.build, 'dance') &&
    !equipped.some((row) => ['armor', 'shield'].includes(findItem(c, cat, row.itemId)?.kind ?? ''))
  const ability: Ability = (monk || dance) && d.mods.dex > d.mods.str ? 'dex' : 'str'
  attacks.push({
    id: 'unarmed',
    name: '徒手打击',
    bonus: d.mods[ability] + pbOf(c.build) - r.exhaustion * 2,
    ability,
    modifier: d.mods[ability],
    damage:
      hasSubclass(c.build, 'dance') &&
      !equipped.some((row) =>
        ['armor', 'shield'].includes(findItem(c, cat, row.itemId)?.kind ?? ''),
      )
        ? c.level >= 5
          ? '1d8'
          : '1d6'
        : monk
          ? c.level >= 5
            ? '1d8'
            : hasStyle(c.build, 'unarmed-fighting', cat) &&
                !equipped.some((row) =>
                  ['weapon', 'shield'].includes(findItem(c, cat, row.itemId)?.kind ?? ''),
                )
              ? '1d8'
              : '1d6'
          : hasStyle(c.build, 'unarmed-fighting', cat)
            ? equipped.some((row) =>
                ['weapon', 'shield'].includes(findItem(c, cat, row.itemId)?.kind ?? ''),
              )
              ? '1d6'
              : '1d8'
            : featIds(c.build, cat).includes('tavern-brawler')
              ? '1d4'
              : '1',
    type: 'bludgeoning',
    ranged: false,
    reach: 5 + (r.effects.some((e) => e.key === 'elemental-attunement') ? 10 : 0),
    range: 0,
    longRange: 0,
    weaponId: null,
    instanceId: null,
    properties: [],
    mastery: null,
    page: 191,
  })
  const layout = equipmentLayout(c, cat),
    held = [...(layout.slots['main-hand'] ?? []), ...(layout.slots['off-hand'] ?? [])],
    free = freeHandSlots(c, cat).length
  if (hasSubclass(c.build, 'soulknife') && free > 0) {
    const ability = d.mods.dex >= d.mods.str ? 'dex' : 'str'
    for (const ranged of [false, true])
      attacks.push({
        id: ranged ? 'psychic-blade-thrown' : 'psychic-blade',
        name: ranged ? '心灵之刃 · 投掷' : '心灵之刃',
        bonus: d.mods[ability] + pbOf(c.build) - r.exhaustion * 2,
        ability,
        modifier: d.mods[ability],
        damage: '1d6',
        type: 'psychic',
        ranged,
        reach: 5,
        range: ranged ? 60 : 0,
        longRange: ranged ? 120 : 0,
        weaponId: 'psychic-blade',
        instanceId: null,
        properties: ['finesse', 'psychic-blade', ...(ranged ? ['thrown60/120'] : [])],
        mastery: 'Vex',
        page: 0,
      })
  }
  if (hasSubclass(c.build, 'stars') && r.effects.some((e) => e.key === 'starry-archer'))
    attacks.push({
      id: 'star-arrow',
      name: '星耀光箭',
      bonus: d.mods.wis + pbOf(c.build) - r.exhaustion * 2,
      ability: 'wis',
      modifier: d.mods.wis,
      damage: '1d8',
      type: 'radiant',
      ranged: true,
      reach: 0,
      range: 60,
      longRange: 60,
      weaponId: null,
      instanceId: null,
      properties: ['spell-attack'],
      mastery: null,
      page: 0,
    })
  const natural=appliedEffects(r.effects).find(f=>f.key==='alter-self'&&f.m3?.option==='weapons')
  if(natural){const ability=natural.ability??'wis',strike=attacks.find(a=>a.id==='unarmed');if(strike)Object.assign(strike,{name:'变身术天生武器',ability,bonus:d.mods[ability]+pbOf(c.build),modifier:d.mods[ability],damage:'1d6',type:natural.m3?.naturalDamageType??'slashing'})}
  return attacks
}
export function checkedDie(dice: (n: number) => number, sides: number) {
  const n = dice(sides)
  if (!Number.isInteger(n) || n < 1 || n > sides) throw new Error('骰值不合法')
  return n
}
export function rollDamage(
  formula: string,
  dice: (n: number) => number,
  critical = false,
  minimum = 1,
): DamageRoll {
  const traceStart = diceTraceCount()
  const compact = formula.replace(/\s/g, ''),
    m = /^(?:(\d{1,2})d(\d{1,3})|(-?\d{1,5}))([+-]\d{1,5})?$/.exec(compact)
  if (!m) throw new Error('伤害公式须为 NdM±数值或固定整数')
  const count = m[1] ? Number(m[1]) * (critical ? 2 : 1) : 0,
    sides = Number(m[2] ?? 0)
  if (count > 100 || (count && ![4, 6, 8, 10, 12, 20, 100].includes(sides)))
    throw new Error('伤害骰规格不支持')
  prepareDice(count, sides, `伤害／治疗 ${formula}${critical ? ' · 暴击' : ''}`, dice)
  const rolls = Array.from({ length: count }, () => Math.max(minimum, checkedDie(dice, sides)))
  const flat = Number(m[3] ?? 0) + Number(m[4] ?? 0)
  const result = {
    formula,
    dice: rolls,
    flat,
    total: Math.max(0, rolls.reduce((s, n) => s + n, 0) + flat),
  }
  if (count)
    recordDiceOutcome(
      { label: '伤害／治疗 ' + formula, dice: rolls, total: result.total, bonus: flat },
      diceTraceCount() > traceStart ? sourcedDie : dice,
    )
  return result
}
export function d20(
  bonus: number,
  adv: string[],
  dis: string[],
  dice: (n: number) => number,
  halfling = false,
  bonusSides: number[] = [],
  autoFail = false,
  override?: number,
  floor = 1,
  balanced = false,
  baseRolls?: number[],
): D20Result {
  if (autoFail)
    return {
      dice: [],
      chosen: 0,
      bonus,
      bonusDice: [],
      total: bonus,
      mode: 'normal',
      reasons: ['按状态规则自动失败，无需掷骰'],
      autoFail: true,
    }
  const mode =
    override !== undefined || balanced || (adv.length && dis.length)
      ? 'normal'
      : adv.length
        ? 'advantage'
        : dis.length
          ? 'disadvantage'
          : 'normal'
  const reasons = [...adv.map((s) => '优势：' + s), ...dis.map((s) => '劣势：' + s)]
  let rerolled = false
  if (override === undefined && !baseRolls)
    prepareDice(
      mode === 'normal' ? 1 : 2,
      20,
      mode === 'normal'
        ? 'd20检定'
        : mode === 'advantage'
          ? 'd20优势（含可能的后续重掷）'
          : 'd20劣势（含可能的后续重掷）',
      dice,
    )
  const rolls = Array.from({ length: mode === 'normal' ? 1 : 2 }, (_, i) => {
    let n = override === undefined ? (baseRolls?.[i] ?? checkedDie(dice, 20)) : override
    if (n === 1 && halfling && !rerolled && override === undefined) {
      rerolled = true
      n = checkedDie(dice, 20)
      reasons.push('半身人幸运重掷 1')
    }
    return override === undefined ? Math.max(floor, n) : n
  })
  const chosen = mode === 'advantage' ? Math.max(...rolls) : Math.min(...rolls),
    bonusDice = bonusSides.map((n) => Math.sign(n) * checkedDie(dice, Math.abs(n)))
  if (override !== undefined) reasons.push('预兆：检定前替换 d20 为 ' + override)
  if (floor > 1) reasons.push('星耀巨龙：d20 最低 ' + floor)
  if (balanced) reasons.push('归复平衡取消优势与劣势')
  recordDiceOutcome(
    {
      label: 'd20检定',
      dice: rolls,
      chosen,
      bonus: bonus + bonusDice.reduce((s, n) => s + n, 0),
      total: chosen + bonus + bonusDice.reduce((s, n) => s + n, 0),
      mode,
      reasons,
    },
    dice,
  )
  return {
    dice: rolls,
    chosen,
    bonus,
    bonusDice,
    total: chosen + bonus + bonusDice.reduce((s, n) => s + n, 0),
    mode,
    reasons,
    autoFail,
  }
}
export function attackRoll(
  attacker: Combatant,
  target: Combatant,
  spec: AttackSpec,
  env: Environment,
  cs: Character[],
  cat: Catalogue,
  dice: (n: number) => number,
): D20Result {
  const a = combatStats(attacker, cs, cat),
    t = combatStats(target, cs, cat),
    c = combatCharacter(attacker, cs),
    adv: string[] = [],
    dis: string[] = []
  if (protectionBlocks(t.effects,attacker.npc?.creatureType,attacker.id)) dis.push('防护善恶：对应生物类型攻击劣势')
  if (a.effects.some((e) => e.key === 'reckless') && spec.ability === 'str') adv.push('鲁莽攻击')
  if (t.effects.some((e) => e.key === 'reckless')) adv.push('目标鲁莽攻击')
  if (
    c &&
    featIds(c.build, cat).includes('grappler') &&
    t.effects.some((e) => e.condition === 'grappled' && e.sourceId === attacker.id)
  )
    adv.push('擒抱者')
  if (a.effects.some((e) => e.key === 'maneuver-feint' && e.note === target.id)) adv.push('佯攻')
  if (a.effects.some((e) => e.key === 'maneuver-goading' && e.sourceId !== target.id))
    dis.push('挑衅攻击：攻击其他人')
  if (t.effects.some((e) => e.key === 'maneuver-distracting' && e.sourceId !== attacker.id))
    adv.push('分心攻击')
  if (t.effects.some((e) => e.key === 'crusher-critical')) adv.push('碾压者重击')
  if (a.effects.some((e) => e.key === 'slasher-critical')) dis.push('挥砍者重击')
  if (env.advantage) adv.push('GM 情境')
  if(enfeebled(a.effects)&&spec.abilityKnown===false)throw Error('衰弱射线：NPC攻击缺少实际属性，请GM在怪物配置中核对力量／敏捷／施法属性')
  if(spec.ability==='str'&&enfeebled(a.effects))dis.push('衰弱射线：力量攻击劣势')
  adv.push(...(env.attackAdvantages ?? []))
  if (env.disadvantage) dis.push('GM 情境')
  if (!env.attackerSees || a.conditions.includes('blinded')) dis.push('看不见目标')
  if (!env.targetSees || t.conditions.includes('blinded')) adv.push('目标看不见攻击者')
  if (a.conditions.includes('invisible') && !env.targetSees) adv.push('隐形')
  if (t.conditions.includes('invisible') && !env.attackerSees) dis.push('隐形目标')
  if (a.conditions.some((x) => ['poisoned', 'prone', 'restrained'].includes(x)))
    dis.push('自身状态')
  if (a.effects.some((f) => f.grapple && f.sourceId !== target.id))
    dis.push('擒抱：攻击擒抱者以外目标')
  if (a.conditions.includes('frightened') && env.fearVisible) dis.push('恐惧来源可见')
  if (
    t.conditions.some((x) =>
      ['paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious'].includes(x),
    )
  )
    adv.push('目标状态')
  if (t.conditions.includes('prone')) (env.distance <= 5 ? adv : dis).push('目标倒地')
  const sharpshooter =
      !!c && hasFeat(c.build, 'sharpshooter', cat) && spec.properties.includes('ranged-weapon'),
    crossbow =
      !!c && hasFeat(c.build, 'crossbow-expert', cat) && !!spec.weaponId?.includes('crossbow'),
    sniper = !!c && hasFeat(c.build, 'spell-sniper', cat) && !spec.weaponId && spec.id !== 'unarmed'
  if (spec.ranged && env.distance > spec.range && !sharpshooter) dis.push('远射程')
  if (spec.ranged && env.nearbyEnemy && !sharpshooter && !crossbow && !sniper)
    dis.push('五尺内有能看见你的非失能敌人')
  if (spec.properties.includes('heavy') && a.scores[spec.ranged ? 'dex' : 'str'] < 13)
    dis.push('重型武器属性不足 13')
  if (c && runtimeDerived(c, cat).untrainedArmor) dis.push('未受训护甲')
  if (
    c &&
    c.build.classId === 'sorcerer' &&
    runtimeState(c, cat).innateSorcery &&
    !spec.weaponId &&
    runtimeSpells(c, cat).find((g) => g.key === spec.id)?.sorcerer
  )
    adv.push('天生术法：术士法术')
  for (const e of a.effects) {
    if (e.attackAdvantage) adv.push(e.name)
    if (e.attackDisadvantage) dis.push(e.name)
    const matches=[target.id,target.characterId,target.npcId].includes(e.sourceId)
    if((e.key==='compelled-duel'&&!matches)||(e.key==='bestow-curse'&&e.supportChoice==='attacks'&&matches))dis.push(e.name)
  }
  if (
    t.effects.some((e) => e.key === 'dodge') &&
    env.targetSees &&
    !t.conditions.includes('incapacitated') &&
    t.speed > 0
  )
    dis.push('目标闪避')
  if(t.effects.some(e=>e.key==='blur')&&!senseBypassesImages(attacker,cs,cat,env.distance)) dis.push('朦胧术')
  if(t.effects.some(e=>e.key==='summon-help'&&e.control?.targets.some(id=>[attacker.id,attacker.characterId,attacker.npcId].includes(id))&&e.supportChoice!==attacker.id&&e.supportChoice!==attacker.companion?.instanceId))adv.push('魔宠帮助：本次对该敌人攻击优势')
  if (t.effects.some((e) => e.key === 'lucky-defense')) dis.push('目标幸运点')
  if (env.protectionActive && t.effects.some((e) => e.key === 'protection'))
    dis.push('守护（保护者仍在 5 尺内）')
  if (t.effects.some((e) => e.key === 'faerie-fire') && env.attackerSees) adv.push('妖火')
  if (t.effects.some((e) => e.key === 'vex' && e.sourceId === attacker.id)) adv.push('Vex')
  if (t.effects.some((e) => e.key === 'stun-opening')) adv.push('震慑打击：下一次攻击')
  if (t.effects.some((e) => ['guiding-bolt','shining-smite'].includes(e.key))) adv.push('曳光弹')
  if (t.effects.some((e) => e.key === 'vow-enmity' && e.sourceId === attacker.id))
    adv.push('仇敌誓言')
  return d20(
    spec.bonus,
    adv,
    dis,
    dice,
    c?.build.speciesId === 'halfling' && !c.runtime?.wildShape,
    [
      ...a.effects.filter((e) => e.attackDie).map((e) => e.attackDie!),
      ...(t.effects.some((e) => e.key === 'blade-ward') ? [-4] : []),
    ],
    false,
    a.effects.find((e) => e.rollOverride !== undefined)?.rollOverride,
    1,
    a.effects.some((e) => e.key === 'restore-balance-roll'),
  )
}
export function savingRoll(
  a: Combatant,
  ability: Ability,
  env: Environment,
  cs: Character[],
  cat: Catalogue,
  dice: (n: number) => number,
  purpose: 'normal' | 'concentration' | 'poison' | 'charm' | 'fear' = 'normal',
  ignoreCover = false,
) {
  const c = combatCharacter(a, cs),
    s = combatStats(a, cs, cat),
    detail = c
      ? checkDetail(c, cat, 'save', ability, {
          advantage: env.advantage,
          disadvantage: env.disadvantage,
          purpose,
        })
      : null
  const adv = detail?.adv ?? (env.advantage ? ['GM 情境'] : []),
    dis = detail?.dis ?? (env.disadvantage ? ['GM 情境'] : [])
  if (!c) for (const effect of s.effects)
    if (effect.saveAdvantage?.includes(ability) || effect.savePurposeAdvantage?.includes(purpose)) adv.push(effect.name)
  if(!c&&ability==='str'&&s.effects.some(f=>f.key==='enlarge-reduce'&&f.m3?.option==='reduce'))dis.push('缩小：力量豁免劣势')
  if(!c&&s.effects.some(f=>f.key==='bestow-curse'&&f.supportChoice===ability))dis.push('降咒：所选属性豁免劣势')
  if (!c && s.conditions.includes('restrained') && ability === 'dex') dis.push('束缚')
  if (
    ability === 'dex' &&
    s.effects.some((e) => e.key === 'dodge') &&
    !s.conditions.includes('incapacitated') &&
    s.speed > 0
  )
    adv.push('闪避')
  const cover =
    ability === 'dex' && !ignoreCover
      ? env.cover === 'half'
        ? 2
        : env.cover === 'three-quarters'
          ? 5
          : 0
      : 0
  const result = d20(
    (detail?.bonus ?? s.saves[ability]!) + cover,
    adv,
    dis,
    dice,
    c?.build.speciesId === 'halfling' && !c.runtime?.wildShape,
    s.effects.filter((e) => e.saveDie).map((e) => e.saveDie!),
    detail?.autoFail ??
      (['str', 'dex'].includes(ability) &&
        s.conditions.some((x) => ['paralyzed', 'petrified', 'stunned', 'unconscious'].includes(x))),
    s.effects.find((e) => e.rollOverride !== undefined)?.rollOverride,
    purpose === 'concentration' && s.effects.some((e) => e.key === 'starry-dragon') ? 10 : 1,
    s.effects.some((e) => e.key === 'restore-balance-roll'),
  )
  result.reasons.unshift(...(detail?.reasons ?? ['GM 配置的豁免总加值 ' + s.saves[ability]]))
  if (cover) result.reasons.push('遮蔽 +' + cover)
  const live=c?.runtime?.effects??a.npc?.effects
  if(live)for(let i=live.length-1;i>=0;i--)if(['lucky-own-roll','mind-sliver','portent-roll','restore-balance-roll','tides-chaos-roll'].includes(live[i]!.key))live.splice(i,1)
  return result
}
export function defenses(a: Combatant, cs: Character[], cat: Catalogue) {
  const spellImmunities = combatStats(a,cs,cat).effects.flatMap(e=>e.damageImmunities??[])
  const spellResistances = combatStats(a,cs,cat).effects.flatMap(e=>e.damageResistances??[])
  const c = combatCharacter(a, cs)
  const feign = combatStats(a, cs, cat).effects.some((effect) => effect.key === 'feign-death')
  if (!c)
    return {
      resistances: feign
        ? [...DAMAGE_TYPES].filter((t) => t !== 'psychic')
        : combatStats(a, cs, cat).conditions.includes('petrified')
          ? [...DAMAGE_TYPES]
          : [...a.npc!.resistances,...spellResistances],
      vulnerabilities: a.npc!.vulnerabilities,
      immunities: [...a.npc!.immunities,...spellImmunities],
    }
  const r = runtimeState(c, cat),
    resistances: DamageType[] = [...spellResistances]
  if (r.effects.some((e) => e.key === 'wild-resistance')) resistances.push(...DAMAGE_TYPES)
  if (feign) resistances.push(...DAMAGE_TYPES.filter((t) => t !== 'psychic'))
  if (r.rage && hasSubclass(c.build, 'wild-heart') && r.effects.some((e) => e.key === 'rage-bear'))
    resistances.push(
      ...DAMAGE_TYPES.filter((t) => !['force', 'necrotic', 'psychic', 'radiant'].includes(t)),
    )
  if (r.rage || effectiveConditions(r).includes('petrified'))
    resistances.push(
      ...(effectiveConditions(r).includes('petrified')
        ? ([
            'acid',
            'bludgeoning',
            'cold',
            'fire',
            'force',
            'lightning',
            'necrotic',
            'piercing',
            'poison',
            'psychic',
            'radiant',
            'slashing',
            'thunder',
          ] as DamageType[])
        : (['bludgeoning', 'piercing', 'slashing'] as DamageType[])),
    )
  if (!r.wildShape && c.build.speciesId === 'aasimar') resistances.push('radiant', 'necrotic')
  if (!r.wildShape && c.build.speciesId === 'dwarf') resistances.push('poison')
  const ancestry = one(c.build, 'ancestry'),
    lineage = one(c.build, 'lineage')
  if (!r.wildShape && c.build.speciesId === 'dragonborn') {
    const map: Record<string, DamageType> = {
      black: 'acid',
      blue: 'lightning',
      brass: 'fire',
      bronze: 'lightning',
      copper: 'acid',
      gold: 'fire',
      green: 'poison',
      red: 'fire',
      silver: 'cold',
      white: 'cold',
    }
    if (map[ancestry]) resistances.push(map[ancestry]!)
  }
  if (!r.wildShape && c.build.speciesId === 'tiefling')
    resistances.push(
      lineage === 'abyssal' ? 'poison' : lineage === 'chthonic' ? 'necrotic' : 'fire',
    )
  return {
    resistances,
    vulnerabilities: r.effects.some((e) => e.key === 'wild-potted')
      ? [...DAMAGE_TYPES]
      : r.effects.some((e) => e.key === 'wild-piercing-vulnerability')
        ? (['piercing'] as DamageType[])
        : [],
    immunities: spellImmunities,
  }
}
export function adjustDamage(
  amount: number,
  type: DamageType,
  def: { resistances: DamageType[]; vulnerabilities: DamageType[]; immunities: DamageType[] },
  half = false,
  reduction = 0,
) {
  let n = Math.max(0, half ? Math.floor(amount / 2) : amount)
  n = Math.max(0, n - reduction)
  if (def.immunities.includes(type)) return 0
  if (def.resistances.includes(type)) n = Math.floor(n / 2)
  if (def.vulnerabilities.includes(type)) n *= 2
  return n
}
export function customNpc(): CombatNpc {
  return {
    name: '自定义敌人',
    ac: 12,
    maxHp: 10,
    hp: 10,
    temporaryHp: 0,
    speed: 30,
    scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    initiativeBonus: 0,
    attacks: [
      {
        id: 'npc-attack',
        name: 'GM 配置攻击',
        bonus: 3,
        damage: '1d6+1',
        damageType: 'slashing',
        reach: 5,
        range: 0,
        longRange: 0,
      },
    ],
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    conditionImmunities: [],
    conditions: [],
    effects: [],
    dead: false,
    source: 'GM 自定义；请按使用的生物数据填写',
  }
}
export interface SpellEffect {
  kind: 'attack' | 'save' | 'heal' | 'temporary' | 'buff' | 'automatic' | 'manual'
  dice?: string
  type?: DamageType
  save?: Ability
  half?: boolean
  area?: boolean
  count?: number
  effect?: string
  note?: string
}
export const SPELL_EFFECTS: Record<string, SpellEffect> = {
  'searing-smite': {
    kind: 'automatic',
    dice: '1d6',
    type: 'fire',
    effect: 'searing-smite',
    count: 1,
    note: '立即跟随近战武器／徒手命中；回合开始先受火焰伤害，再体质豁免，成功结束。',
  },
  'hold-person': {
    kind: 'save',
    save: 'wis',
    effect: 'hold-person',
    count: 1,
    note: '仅可见类人；失败麻痹，目标每回合末重投感知豁免，成功结束该目标效果。',
  },
  'blindness-deafness': {
    kind: 'save',
    save: 'con',
    effect: 'blindness-deafness',
    count: 1,
    note: '选择目盲或耳聋；失败施加选定状态，目标每回合末体质重投，成功结束。',
  },
  'magic-weapon': {
    kind: 'buff',
    effect: 'magic-weapon',
    count: 1,
    note: '绑定实际非魔法武器；二环攻击和伤害＋1，三环＋2；非专注一小时，再施放结束先前效应。',
  },
  'acid-splash': { kind: 'save', dice: '1d6', type: 'acid', save: 'dex', area: true },
  'chill-touch': { kind: 'attack', dice: '1d10', type: 'necrotic', effect: 'chill-touch' },
  'eldritch-blast': { kind: 'attack', dice: '1d10', type: 'force' },
  'fire-bolt': { kind: 'attack', dice: '1d10', type: 'fire' },
  'poison-spray': { kind: 'attack', dice: '1d12', type: 'poison' },
  'ray-of-frost': { kind: 'attack', dice: '1d8', type: 'cold', effect: 'ray-of-frost' },
  'shocking-grasp': { kind: 'attack', dice: '1d8', type: 'lightning', effect: 'shocking-grasp' },
  'starry-wisp': { kind: 'attack', dice: '1d8', type: 'radiant', effect: 'starry-wisp' },
  'sorcerous-burst': {
    kind: 'attack',
    dice: '1d8',
    type: 'fire',
    note: 'd8 掷出 8 时追加 d8，额外数量至多为施法属性调整值',
  },
  'sacred-flame': { kind: 'save', dice: '1d8', type: 'radiant', save: 'dex', note: '豁免忽略遮蔽' },
  'vicious-mockery': {
    kind: 'save',
    dice: '1d6',
    type: 'psychic',
    save: 'wis',
    effect: 'vicious-mockery',
  },
  'burning-hands': { kind: 'save', dice: '3d6', type: 'fire', save: 'dex', half: true, area: true },
  thunderwave: {
    kind: 'save',
    dice: '2d8',
    type: 'thunder',
    save: 'con',
    half: true,
    area: true,
    effect: 'thunderwave',
  },
  'chromatic-orb': {
    kind: 'attack',
    dice: '3d8',
    type: 'fire',
    note: '需价值至少 50 GP 的钻石；至少两个 d8 相同时，一级可弹跳一次。初次攻击自动结算，后续攻击由 GM 裁定且不重复扣资源',
  },
  'guiding-bolt': { kind: 'attack', dice: '4d6', type: 'radiant', effect: 'guiding-bolt' },
  'ray-of-sickness': { kind: 'attack', dice: '2d8', type: 'poison', effect: 'ray-of-sickness' },
  'dissonant-whispers': {
    kind: 'save',
    dice: '3d6',
    type: 'psychic',
    save: 'wis',
    half: true,
    effect: 'dissonant-whispers',
  },
  'inflict-wounds': { kind: 'save', dice: '2d10', type: 'necrotic', save: 'con', half: true },
  'hellish-rebuke': { kind: 'save', dice: '2d10', type: 'fire', save: 'dex', half: true },
  'cure-wounds': { kind: 'heal', dice: '2d8' },
  'healing-word': { kind: 'heal', dice: '2d4' },
  'false-life': { kind: 'temporary', dice: '2d4+4' },
  'magic-missile': {
    kind: 'automatic',
    dice: '1d4+1',
    type: 'force',
    count: 3,
    note: '三个飞弹分别选目标；Shield 阻止针对该生物的飞弹',
  },
  bane: { kind: 'save', save: 'cha', count: 3, effect: 'bane' },
  bless: { kind: 'buff', count: 3, effect: 'bless' },
  'shield-of-faith': { kind: 'buff', effect: 'shield-of-faith' },
  'mage-armor': { kind: 'buff', effect: 'mage-armor' },
  longstrider: { kind: 'buff', effect: 'longstrider' },
  'divine-favor': { kind: 'buff', effect: 'divine-favor' },
  heroism: { kind: 'buff', effect: 'heroism' },
  hex: { kind: 'buff', effect: 'hex' },
  'hunter-s-mark': { kind: 'buff', effect: 'hunter-s-mark' },
  'faerie-fire': { kind: 'save', save: 'dex', area: true, effect: 'faerie-fire' },
  entangle: { kind: 'save', save: 'str', area: true, effect: 'entangle' },
  'color-spray': { kind: 'save', save: 'con', area: true, effect: 'color-spray' },
  'spare-the-dying': { kind: 'buff', effect: 'spare-the-dying' },
  shillelagh: { kind: 'buff', effect: 'shillelagh' },
  'true-strike': { kind: 'attack', effect: 'true-strike' },
  shield: { kind: 'manual', note: '请在攻击或魔法飞弹待结算窗口中使用 Shield 反应按钮' },
  sleep: {
    kind: 'save',
    save: 'wis',
    effect: 'sleep',
    area: true,
    count: 100,
    note: '2024两阶段感知豁免；先失能，回合末失败转昏迷；伤害或他人动作唤醒。GM核对无需睡眠特征。',
  },
  'ice-knife': {
    kind: 'manual',
    area: true,
    count: 100,
    note: '先进行远程法术攻击，再对目标及五尺内生物进行敏捷豁免；两段分别结算',
  },
  guidance: { kind: 'buff', effect: 'guidance' },
  resistance: { kind: 'buff', effect: 'resistance' },
  'lesser-restoration': { kind: 'buff', effect: 'lesser-restoration' },
  'produce-flame': {
    kind: 'manual',
    note: '附赠动作生成火焰，后续魔法动作进行 60 尺远程攻击；不能在生成时直接攻击',
  },
}
export function spellEffect(id: string, level = 1, slot = 1): SpellEffect {
  const higher: Record<string, SpellEffect> = {
    'divine-smite':{kind:'automatic',dice:(slot+1)+'d8',type:'radiant',count:1},
    'ice-knife':{kind:'attack',dice:'1d10',type:'piercing',count:1},
    'acid-arrow':{kind:'attack',dice:(slot+2)+'d4',type:'acid',effect:'acid-arrow',count:1},
    jump: {
      kind: 'buff',effect:'jump',
      count: Math.max(1, slot),
      note: '2024 跳跃术：自愿目标，速度至少 10 尺；实际效果与一分钟期限登记，每回合一次以 10 尺移动跳至多 30 尺',
    },
    fireball: {
      kind: 'save',
      dice: 8 + Math.max(0, slot - 3) + 'd6',
      type: 'fire',
      save: 'dex',
      half: true,
      area: true,
    },
    'lightning-bolt': {
      kind: 'save',
      dice: 8 + Math.max(0, slot - 3) + 'd6',
      type: 'lightning',
      save: 'dex',
      half: true,
      area: true,
    },
    shatter: {
      kind: 'save',
      dice: 3 + Math.max(0, slot - 2) + 'd8',
      type: 'thunder',
      save: 'con',
      half: true,
      area: true,
      note: '物件伤害另由 GM 裁定',
    },
    'scorching-ray': {
      kind: 'attack',
      dice: '2d6',
      type: 'fire',
      count: 3 + Math.max(0, slot - 2),
    },
    'prayer-of-healing':{kind:'heal',dice:(2+Math.max(0,slot-2))+'d8',count:5},
    'mass-healing-word': { kind: 'heal', dice: (2+Math.max(0,slot-3))+'d4', count: 6 },
    'mass-cure-wounds': { kind: 'heal', dice: '5d8', count: 6 },
  }
  const profile = {
    ...(higher[id] ??
      SPELL_EFFECTS[id] ??
      PHB_SPELL_EFFECTS[id] ?? {
        kind: 'manual',
        count: 100,
        note: '按正文由 GM 裁定目标及效果；系统记录资源、行动与明确提交的结果',
      }),
  } as SpellEffect
  const up = Math.max(0, slot - 1),
    increments: Record<string, number> = {
      'burning-hands': 1,
      thunderwave: 1,
      'chromatic-orb': 1,
      'guiding-bolt': 1,
      'ray-of-sickness': 1,
      'dissonant-whispers': 1,
      'inflict-wounds': 1,
      'hellish-rebuke': 1,
      'cure-wounds': 2,
      'healing-word': 2,
      'arms-of-hadar': 1,
      'witch-bolt': 1,
      'hail-of-thorns': 1,
      'thunderous-smite': 1,
      'wrathful-smite': 1,
      'searing-smite': 1,
    }
  if (profile.dice && increments[id] && up)
    profile.dice = profile.dice.replace(/^(\d+)d/, (_, n) => Number(n) + up * increments[id]! + 'd')
  if (['magic-missile', 'bane', 'bless'].includes(id)) profile.count = 3 + up
  const additionalTargets: Record<string, number> = {
    'hideous-laughter': 1,
    'animal-friendship': 1,
    'charm-person': 1,
    command: 1,
    'enhance-ability': 2,
    'hold-person': 2,
    'blindness-deafness': 2,
    invisibility: 2,
    jump: 1,
    'spider-climb':2,
    longstrider: 1,
    fly: 3,
    heroism: 1,
  }
  if (additionalTargets[id]) profile.count = 1 + Math.max(0, slot - additionalTargets[id]!)
  if(id==='shining-smite')profile.dice=(2+Math.max(0,slot-2))+'d6'
  if(id==='blinding-smite')profile.dice=(3+Math.max(0,slot-3))+'d8'
  if (id === 'false-life' && up) profile.dice = '2d4+' + (4 + 5 * up)
  if (id === 'armor-of-agathys') profile.dice = String(5 * slot)
  if (id === 'conjure-barrage') profile.dice = 5 + Math.max(0, slot - 3) + 'd8'
  if (id === 'eldritch-blast') profile.count = level >= 5 ? 2 : 1
  else if (
    level >= 5 &&
    [
      'acid-splash',
      'chill-touch',
      'fire-bolt',
      'poison-spray',
      'ray-of-frost',
      'shocking-grasp',
      'starry-wisp',
      'sorcerous-burst',
      'sacred-flame',
      'vicious-mockery',
      'mind-sliver',
      'thorn-whip',
      'thunderclap',
      'toll-the-dead',
      'word-of-radiance',
    ].includes(id) &&
    profile.dice
  )
    profile.dice = profile.dice.replace(/^1d/, '2d')
  return profile
}
