import {itemSpellGrants,itemCastFailed,spellUsesSlot,itemSpellBusy} from './item-spells'
import { restSpellSelectionIssues } from './rest-spell-choices'
import { withEvaluation } from './evaluation'
import { rememberEndedHaste } from './m3-lifecycle'
import {completedCasting} from './completed-casting'
import { spatialCapabilities } from './m3-spatial'
import { maximizesHealing } from './spell-restoration'
import {slowed,enfeebled} from './m2-control'
import { inventorySourceHour } from './inventory-clock'
import { createGoodberries } from './spell-consumables'
import { applyOriginParty, checkedOriginDie, type OriginCommand } from './origins'
import { beast, DEFAULT_BEASTS } from './beasts'
import { sourcedDie as rollDie, prepareDice, recordDiceOutcome } from './dice-source'
import { requiresTwoHands } from './weapon-rules'
import { validateSpecialWeapon } from './special-weapons'
import { DAMAGE_NAMES } from './combat-types'
import { advancedResources, rulePowers } from './phb-powers'
import { featSpellGifts, hasFeat, partialCaster, featAbility } from './advanced-rules'
import { useAdvanced } from './advanced-runtime'
import { wildMagic } from './wild-magic'
import { PHB_SPELL_EFFECTS } from './phb-spell-rules'
import type {
  Ability,
  Character,
  InventoryItem,
  Item,
  Runtime,
  RuntimeSnapshot,
  Spell,
  EquipmentSlot,
  Grip,
} from './types'
import { ABILITY_NAMES, SKILLS } from './types'
import { isSafePortrait } from './portraits'
import {
  catalogue,
  featIds,
  clone,
  derived,
  getChoices,
  one,
  racialSpells,
  purchasePrice,
  signed,
  type Catalogue,
} from './engine'
import { CONDITIONS } from '../content/conditions'
import { appliedEffects } from './effects'
import { hpSpellBonus } from './spell-restoration'
import { guidanceBonus, resistanceReduction } from './support-spells'
import { rememberEndedCharms } from './social-effects'
import { applyLevelUp, validateGrowthArchive } from './growth'
import {
  levelOf,
  pbOf,
  slotLevels,
  slotResource,
  hasInvocation,
  hasSubclass,
  hasStyle,
  alwaysPrepared,
} from './growth-rules'
import type { GrowthRequest } from './types'
import {
  assignedSlot,
  canUseTwoHands,
  clearEquipment,
  compatibleSlots,
  equipmentLayout,
  equippedInventory,
  materializeEquipment,
  gripOf,
  handSlot,
  SLOT_NAMES,
  validateEquipment,
} from './equipment'

export interface Resource {
  id: string
  name: string
  max: number
  short: 'all' | 'one' | 'none'
  page: number
  detail: string
}
export function resources(c: Character, cat: Catalogue, base?: ReturnType<typeof derived>): Resource[] {
  const d = base ?? derived(c.build, cat, c.inventory),
    cl = cat.classes.find((x) => x.id === c.build.classId)
  const list: Resource[] = []
  const add = (
    id: string,
    name: string,
    max: number,
    short: Resource['short'],
    page: number,
    detail: string,
  ) => list.push({ id, name, max, short, page, detail })
  slotLevels(c.build).forEach((max, i) => {
    if (max)
      add(
        slotResource(i + 1),
        (cl?.id === 'warlock' ? '契约法术位 · ' : '法术位 · ') + (i + 1) + ' 环',
        max,
        cl?.id === 'warlock' ? 'all' : 'none',
        cl!.source.page,
        '可施放不高于该环级的准备法术；契约位短休全部恢复，普通法术位长休恢复。',
      )
  })
  const level = levelOf(c.build),
    pb = pbOf(c.build)
  if (cl?.id === 'barbarian')
    add(
      'rage',
      '狂暴',
      level >= 3 ? 3 : 2,
      'one',
      28,
      '附赠动作；不能穿重甲；力量检定和力量豁免具有优势；不能施法或专注。持续与延长由 GM 判断。',
    )
  if (cl?.id === 'bard')
    add(
      'bardic-inspiration',
      level >= 5 ? '吟游激励 d8' : '吟游激励 d6',
      Math.max(1, d.mods.cha),
      level >= 5 ? 'all' : 'none',
      31,
      '附赠动作给予 60 尺内能看见或听见你的另一生物；一小时内一次失败的 d20 检定后使用。此处记录给予次数，目标另行记账。',
    )
  if (cl?.id === 'fighter')
    add('second-wind', '回气', level >= 4 ? 3 : 2, 'one', 48, '附赠动作；恢复 1d10 + 战士等级 HP。')
  if (cl?.id === 'paladin')
    add(
      'lay-on-hands',
      '圣疗治疗池',
      level * 5,
      'none',
      53,
      '附赠动作接触；每点治疗池恢复 1 HP，或消耗 5 点去除中毒（不同时治疗）。',
    )
  if (cl?.id === 'ranger')
    add(
      'favored-enemy',
      '宿敌 · 猎人印记免费施放',
      level >= 5 ? 3 : 2,
      'none',
      58,
      '始终准备；免费次数与一级法术位独立。仍需专注。',
    )
  if (cl?.id === 'sorcerer')
    add(
      'innate-sorcery',
      '天生术法',
      2,
      'none',
      65,
      '附赠动作开启一分钟；仅术士职业法术 DC +1，术士职业法术攻击具有优势。',
    )
  if (cl?.id === 'wizard')
    add(
      'arcane-recovery',
      '奥术回想',
      1,
      'none',
      78,
      '短休时恢复合计不超过 ceil(法师等级/2) 环级的已消耗法术位；每天一次。',
    )
  if (level >= 2) {
    if (cl?.id === 'fighter')
      add(
        'action-surge',
        '动作如潮',
        1,
        'all',
        48,
        '自己回合额外一个动作，不能用于魔法动作；每回合最多一次。',
      )
    if (cl?.id === 'monk')
      add(
        'focus',
        '专注点',
        level,
        'all',
        51,
        '疾风连击、坚韧防御、疾步等，按特性消耗；短休全部恢复。',
      )
    if (cl?.id === 'sorcerer')
      add(
        'sorcery-points',
        '术法点',
        level,
        'none',
        66,
        '超魔法与灵活施法，按特性消耗；长休全部恢复。',
      )
    if (cl?.id === 'cleric')
      add(
        'channel-divinity',
        '引导神力',
        2,
        'one',
        37,
        '神圣火花、驱散亡灵、生命领域保全生命；短休恢复一次。',
      )
    if (cl?.id === 'druid')
      add(
        'wild-shape',
        '荒野形态',
        2,
        'one',
        42,
        '附赠动作变形，临时 HP 等于等级；野兽模板与变形细节交由 GM 裁定。',
      )
    if (cl?.id === 'warlock')
      add(
        'magical-cunning',
        '魔法诡计',
        1,
        'none',
        72,
        '1 分钟仪式，恢复向上取整一半契约位；每日一次。',
      )
  }
  if (level >= 5 && cl?.id === 'druid')
    add(
      'wild-slot',
      '荒野复苏 · 一环位恢复',
      1,
      'none',
      43,
      '消耗一次荒野形态恢复一个已耗一环法术位，每长休一次。',
    )
  if (level >= 3 && cl?.id === 'paladin')
    add('channel-divinity', '引导神力', 2, 'one', 54, '奉献之誓圣武器；短休恢复一次。')
  if (level >= 2 && cl?.id === 'paladin')
    add(
      'paladin-smite',
      '神圣惩击免费次数',
      1,
      'none',
      54,
      'Divine Smite 每长休一次免费施放，仍需命中后附赠动作。',
    )
  if (level >= 5 && cl?.id === 'paladin')
    add('faithful-steed', '忠诚坐骑免费次数', 1, 'none', 55, 'Find Steed 每长休一次免费施放。')
  if (level >= 5 && cl?.id === 'sorcerer')
    add(
      'sorcerous-restoration',
      '术法恢复',
      1,
      'none',
      66,
      '短休可恢复向下取整等级一半的术法点，每长休一次。',
    )
  for (const src of [
    'background',
    'human',
    'growth',
    ...Object.keys(c.build.choices)
      .filter((k) => k.startsWith('mi-lesson-') && k.endsWith('-spell'))
      .map((k) => k.slice(3, -6)),
  ])
    if (c.build.choices['mi-' + src + '-spell']?.length)
      add(
        'mi-' + src,
        '魔法学徒 · ' +
          (src === 'background'
            ? '背景'
            : src === 'human'
              ? '人类'
              : src === 'growth'
                ? '四级专长'
                : '先人教诲'),
        1,
        'none',
        87,
        '所选一级法术每长休一次免法术位施放；也可使用现有法术位。',
      )
  if (c.build.speciesId === 'dragonborn')
    add(
      'breath',
      '龙裔吐息',
      pb,
      'none',
      84,
      '替代攻击动作中的一次攻击；DC = 8 + 体质调整值 + 熟练；一级伤害 1d10，成功减半。目标结算由 GM 处理。',
    )
  if (c.build.speciesId === 'dwarf')
    add(
      'stonecunning',
      '石中精觉',
      pb,
      'none',
      84,
      '附赠动作，接触石质表面时获得 60 尺震颤感知，持续十分钟。',
    )
  if (c.build.speciesId === 'goliath')
    add(
      'giant-ancestry',
      '巨人祖先',
      pb,
      'none',
      85,
      '按所选祖先的触发条件使用，目标效果由 GM 处理。',
    )
  if (c.build.speciesId === 'gnome' && one(c.build, 'lineage') === 'forest')
    add(
      'forest-magic',
      '森林侏儒 · 动物交谈',
      pb,
      'none',
      85,
      '动物交谈免法术位次数；也可使用法术位或仪式。',
    )
  if (c.build.speciesId === 'orc') {
    add(
      'adrenaline',
      '肾上腺冲刺',
      pb,
      'all',
      86,
      '附赠动作疾走，并获得 2 临时 HP；临时 HP 不叠加。',
    )
    add(
      'relentless',
      '顽强不屈',
      1,
      'none',
      86,
      '降至 0 HP 且未即死时可改为 1 HP；在记录伤害时选择使用。',
    )
  }
  for (const spell of racialSpells(c.build))
    if (cat.spells.find((s) => s.id === spell.id)?.level)
      add(
        'species-' + spell.id,
        '物种传承 · ' + (cat.spells.find((s) => s.id === spell.id)?.name ?? spell.id),
        1,
        'none',
        c.build.speciesId === 'elf' ? 84 : 86,
        '始终准备；每长休一次免费施放，也可使用法术位。',
      )
  if (hasInvocation(c.build, 'depths'))
    add(
      'depths',
      '深海馈赠 · Water Breathing',
      1,
      'none',
      73,
      '每长休一次免费施放；可水下呼吸，游泳速度等于速度。',
    )
  if (c.level >= 5 && c.build.speciesId === 'goliath')
    add(
      'large-form',
      '巨人形态',
      1,
      'none',
      86,
      '附赠动作变为大型十分钟，力量检定优势、速度 +10；空间由 GM 裁定。',
    )
  if (c.level >= 5 && c.build.speciesId === 'dragonborn')
    add(
      'draconic-flight',
      '龙族飞行',
      1,
      'none',
      84,
      '附赠动作获得等于速度的飞行速度，十分钟；每长休一次。',
    )
  if (featIds(c.build, cat).includes('lucky'))
    add(
      'lucky',
      '幸运点',
      pb,
      'none',
      0,
      'PHB 2024：自己的 d20 检定优势，或针对自己的攻击劣势；不消耗反应；长休恢复。',
    )
  if (c.build.speciesId === 'aasimar') {
    add('healing-hands', '治愈之手', 1, 'none', 0, '魔法动作接触，恢复熟练加值枚 d4。')
    if (level >= 3)
      add(
        'aasimar-revelation',
        '天启',
        1,
        'none',
        0,
        '附赠动作选择模式，一分钟；每个自己回合一次加伤，范围时机由 GM 确认。',
      )
  }
  list.push(...advancedResources(c))
  for (const gift of featSpellGifts(c.build, cat))
    if (gift.resource && !list.some((r) => r.id === gift.resource))
      add(gift.resource, gift.source + ' · 免费次数', 1, 'none', 0, '独立于法术位，每长休恢复。')
  return list
}
export function runtimeState(c: Character, cat: Catalogue): Runtime {
  return withEvaluation(() => runtimeStateUncached(c,cat))
}
function runtimeStateUncached(c: Character, cat: Catalogue): Runtime {
  const old = c.runtime,
    base = derived(c.build, cat, c.inventory),
    defs = resources(c, cat, base)
  const maximum = base.hp
  const death = clone(old?.death ?? { successes: 0, failures: 0, stable: false, dead: false })
  if (maximum <= 0 || old?.exhaustion === 6) death.dead = true
  return {
    itemCasts: clone(old?.itemCasts??[]),
    lastCastKey: old?.lastCastKey??'',
    advanced: clone(old?.advanced ?? { ward: null, portents: [], lastCheck: null }),
    mounted: old?.mounted ?? false,
    resistanceUsedTurn: old?.resistanceUsedTurn ?? null,
    grapples: clone(old?.grapples ?? []),
    revelation: clone(old?.revelation ?? null),
    lastRest: clone(old?.lastRest ?? null),
    hp: Math.max(
      0,
      Math.min(
        old?.hp ?? maximum,
        Math.max(0, maximum + hpSpellBonus(old?.effects ?? [])),
      ),
    ),
    temporaryHp: old?.temporaryHp ?? 0,
    resources: Object.fromEntries(
      defs.map((x) => [x.id, Math.max(0, Math.min(x.max, old?.resources[x.id] ?? x.max))]),
    ),
    conditions: [...new Set(old?.conditions ?? [])].filter((x) => x !== 'exhaustion'),
    createdSlots: clone(old?.createdSlots ?? {}),
    version: 2,
    exhaustion: old?.exhaustion ?? (old?.conditions.includes('exhaustion') ? 1 : 0),
    hitDice: old?.hitDice ?? levelOf(c.build),
    death,
    knownBeasts: clone(
      old?.knownBeasts ?? (c.level >= 4 ? [...DEFAULT_BEASTS, 'cat', 'panther'] : DEFAULT_BEASTS),
    ),
    wildShape: clone(old?.wildShape ?? null),
    concentration: clone(old?.concentration ?? null),
    rage: old?.rage ?? false,
    innateSorcery: old?.innateSorcery ?? false,
    heroicInspiration: old?.heroicInspiration ?? false,
    preparedSpells: clone(old?.preparedSpells ?? null),
    restSpellChoices: clone(old?.restSpellChoices ?? {}),
    hours: old?.hours ?? 0,
    prayerHealingSinceLongRest:old?.prayerHealingSinceLongRest??false,
    nourishedUntil:old?.nourishedUntil??0,
    lastLongRestEnd: old?.lastLongRestEnd ?? null,
    effectEnds: clone(old?.effectEnds ?? { rage: null, innateSorcery: null }),
    effects: clone(old?.effects ?? []),
  }
}
export function effectiveConditions(
  r: Pick<Runtime, 'conditions' | 'effects' | 'hp' | 'death' | 'exhaustion'>,
): string[] {
  const s = new Set([
    ...r.conditions,
    ...appliedEffects(r.effects).flatMap((e) => [...(e.condition ? [e.condition] : []), ...(e.conditions ?? [])]),
  ])
  if (!r.hp || r.death.dead) s.add('unconscious')
  if (r.exhaustion) s.add('exhaustion')
  if (s.has('unconscious')) s.add('prone')
  if (['unconscious', 'paralyzed', 'petrified', 'stunned'].some((x) => s.has(x)))
    s.add('incapacitated')
  if (s.has('petrified')) s.delete('poisoned')
  if (r.effects.some((effect) => effect.key === 'feign-death')) s.delete('poisoned')
  if (r.effects.some((e) => e.key === 'heroism')) s.delete('frightened')
  for (const e of appliedEffects(r.effects)) for (const condition of e.conditionImmunities ?? []) s.delete(condition)
  if (r.effects.some((e) => ['faerie-fire','starry-wisp','shining-smite'].includes(e.key)))
    s.delete('invisible')
  return [...s]
}
export function effectiveBuild(c: Character, cat: Catalogue) {
  const b = clone(c.build),
    r = runtimeState(c, cat)
  if (r.preparedSpells) b.choices['class-spells'] = r.preparedSpells
  for (const [key,values] of Object.entries(r.restSpellChoices ?? {})) b.choices[key] = [...values]
  return b
}
export function runtimeDerived(c: Character, cat: Catalogue): ReturnType<typeof runtimeDerivedUncached> {
  return withEvaluation(() => runtimeDerivedUncached(c,cat))
}
function runtimeDerivedUncached(c: Character, cat: Catalogue) {
  const actualInventory = c.runtime?.wildShape
    ? c.inventory.map((row) => ({ ...row, equipped: false }))
    : equippedInventory(c, cat)
  const d = derived(effectiveBuild(c, cat), cat, actualInventory),
    r = runtimeState(c, cat),
    cs = effectiveConditions(r),
    effects = appliedEffects(r.effects)
  const form = r.wildShape && beast(r.wildShape.formId)
  for (const attack of d.attacks) {
    const row = actualInventory.find((x) => x.instanceId === attack.instanceId)
    attack.ready = row?.grip !== 'one-handed' || !requiresTwoHands(attack.item, r.mounted)
    if (row?.specialWeapon) {
      const special = row.specialWeapon
      attack.item = { ...attack.item, name: special.name }
      attack.bonus += special.attackBonus
      attack.damage +=
        (special.damageBonus ? ' · 固定伤害 ' + signed(special.damageBonus) : '') +
        (special.extraDamage.length
          ? ' · 附伤 ' + special.extraDamage.map((d) => d.formula + DAMAGE_NAMES[d.type]).join('＋')
          : '')
    }
  }
  if (form) {
    const oldMods = { ...d.mods }
    for (const ability of ['str', 'dex', 'con'] as const) {
      d.scores[ability] = form.scores[ability]
      d.mods[ability] = Math.floor((form.scores[ability] - 10) / 2)
    }
    for (const ability of Object.keys(d.saves) as Ability[])
      d.saves[ability] = Math.max(
        d.saves[ability]! -
          oldMods[ability] +
          d.mods[ability] +
          (form.saves[ability] !== undefined &&
          !cat.classes.find((cl) => cl.id === c.build.classId)?.saves.includes(ability)
            ? pbOf(c.build)
            : 0),
        form.saves[ability] ?? -100,
      )
    for (const [key, skill] of Object.entries(SKILLS))
      d.skillValues[key] = Math.max(
        (d.skillValues[key] ?? oldMods[skill.ability]) -
          oldMods[skill.ability] +
          d.mods[skill.ability] +
          (form.skills[key] !== undefined && !d.skills.includes(key) ? pbOf(c.build) : 0),
        form.skills[key] ?? -100,
      )
    d.skills = [...new Set([...d.skills, ...Object.keys(form.skills)])]
    d.ac = hasSubclass(c.build, 'moon') ? Math.max(form.ac, 13 + d.mods.wis) : form.ac
    d.capacity =
      form.scores.str *
      15 *
      (['riding-horse', 'giant-goat'].includes(form.id)
        ? 2
        : ['rat', 'cat', 'spider', 'owl'].includes(form.id)
          ? 0.5
          : 1)
    d.speed = form.speed
    d.initiative += d.mods.dex - oldMods.dex
    d.passivePerception = 10 + d.skillValues.perception!
  }
  const zero =
    effects.some((e) => e.speedZero) ||
    ['grappled', 'restrained', 'paralyzed', 'petrified', 'unconscious'].some((x) => cs.includes(x))
  const armor = (form ? [] : actualInventory)
    .filter((x) => x.equipped)
    .map((x) => findItem(c, cat, x.itemId))
    .find((x) => x?.kind === 'armor')
  const untrainedArmor = !!armor && !d.training.armor.includes(armor.category || '')
  const moveSpeed = zero
    ? 0
    : Math.max(
        0,
        d.speed -
          5 * r.exhaustion -
          effects.reduce((n, e) => n + (e.speedPenalty ?? 0), 0) +
          effects.reduce((n, e) => n + (e.speedBonus ?? 0), 0),
      )/(slowed(effects)?2:1)/(effects.some(f=>f.key==='guardians-region')?2:1)
  const nativeDarkvision=c.build.speciesId==='elf'?(one(c.build,'lineage')==='drow'?120:60):Math.max(0,...(cat.species.find(sp=>sp.id===c.build.speciesId)?.features??[]).map(text=>Number(text.match(/(?:黑暗视觉|[Dd]arkvision)\s*(\d+)/)?.[1]??0)))
  const capabilities = spatialCapabilities({walk:moveSpeed,derivedModes:true,speedPenalty:5*r.exhaustion,darkvision:nativeDarkvision,fly:!form&&(r.revelation?.mode==='wings'||effects.some(e=>e.key==='draconic-flight'))?moveSpeed:0,climb:hasFeat(c.build,'athlete',cat)?moveSpeed:0,swim:hasInvocation(c.build,'depths')?moveSpeed:0,size:!form&&effects.some(e=>e.key==='large-form')?'large':c.build.choices.size?.[0]??cat.species.find(sp=>sp.id===c.build.speciesId)?.sizes[0]??'medium'},effects,zero)
  return {
    ...d,
    spatialCapabilities:capabilities,
    hp: d.hp + hpSpellBonus(effects),
    flyingSpeed:capabilities.fly,
    blindsight:hasStyle(c.build,'blind-fighting',cat)||hasFeat(c.build,'skulker',cat)?10:0,
    climbingSpeed:capabilities.climb, swimmingSpeed:capabilities.swim,
    devilsSight:hasInvocation(c.build,'devil-sight')?120:0,
    tremorsense:!form&&effects.some(e=>e.key==='stonecunning')?60:0,
    currentSize:capabilities.size,
    ac: Math.max(...effects.map(e=>e.acFloor??0),
      Math.max(
        d.ac,
        ...effects
          .filter((e) => e.acBase !== undefined && !armor && !form)
          .map(
            (e) =>
              e.acBase! +
              d.mods.dex +
              (actualInventory.some(
                (x) => x.equipped && findItem(c, cat, x.itemId)?.kind === 'shield',
              ) && d.training.armor.includes('shield')
                ? 2
                : 0),
          ),
      ) + effects.reduce((n, e) => n + (slowed([e])?0:e.acBonus ?? 0), 0))-(slowed(effects)?2:0),
    speed: capabilities.walk,
    untrainedArmor,
    conditions: cs,
    saves: Object.fromEntries(Object.entries(d.saves).map(([a, n]) => [a, n - 2 * r.exhaustion + effects.reduce((sum,e)=>sum+(e.flatSaveBonus??0),0)-(a==='dex'&&slowed(effects)?2:0)])),
    skillValues: Object.fromEntries(
      Object.entries(d.skillValues).map(([id, n]) => [id, n - 2 * r.exhaustion+(id==='stealth'&&effects.some(e=>e.key==='pass-without-trace')?10:0)-(id==='perception'&&effects.some(e=>e.key==='enthrall')?10:0)]),
    ),
    initiative: d.initiative - 2 * r.exhaustion,
    passivePerception: d.passivePerception - 2 * r.exhaustion - (cs.includes('poisoned') ? 5 : 0)-(effects.some(e=>e.key==='enthrall')?10:0),
    weight:
      Math.round(
        (c.inventory.reduce(
          (n, x) => n + (findItem(c, cat, x.itemId)?.weight ?? 0) * x.quantity,
          0,
        ) +
          Math.max(0, c.coins) / 50) *
          100,
      ) / 100,
  }
}
export const findItem = (c: Character, cat: Catalogue, id: string) =>
  [...cat.items, ...c.build.customItems].find((x) => x.id === id)
// Chest and barrel have volume limits, not a published pound limit in this SRD.
export const CONTAINERS: Record<string, number | null> = {
  backpack: 30,
  pouch: 6,
  sack: 30,
  basket: 40,
  chest: null,
  barrel: null,
}
export const CONTAINER_VOLUMES: Record<string, string> = {
  backpack: '1 立方尺',
  pouch: '1/5 立方尺',
  sack: '1 立方尺',
  basket: '2 立方尺',
  chest: '12 立方尺',
  barrel: '40 加仑液体或 4 立方尺干货',
}
export const isContainer = (item?: Item) =>
  !!item && (item.id in CONTAINERS || item.category === 'container')
export function containerWeight(
  c: Character,
  cat: Catalogue,
  id: string,
  visited = new Set<string>(),
): number {
  if (visited.has(id)) throw new Error('容器存在循环')
  visited.add(id)
  return c.inventory
    .filter((x) => x.containerId === id)
    .reduce(
      (n, x) =>
        n +
        (findItem(c, cat, x.itemId)?.weight ?? 0) * x.quantity +
        containerWeight(c, cat, x.instanceId, new Set(visited)),
      0,
    )
}
export function validateInventory(c: Character, cat: Catalogue) {
  const ids = new Set<string>()
  if (c.inventory.length > 5000) throw new Error('物品条目超过 5000')
  for (const row of c.inventory) {
    if (row.specialWeapon) {
      validateSpecialWeapon(row.specialWeapon)
      if (row.quantity !== 1 || findItem(c, cat, row.itemId)?.kind !== 'weapon')
        throw Error('特殊武器必须绑定单件基础武器实例')
    }
    if (
      ['chef-treat', 'poisoner-dose','goodberry'].includes(row.itemId) &&
      (!row.consumable ||
        row.consumable.kind !== row.itemId ||
        (['chef-treat','goodberry'].includes(row.itemId) && row.consumable.expiresAt === undefined) ||
        (row.itemId === 'poisoner-dose' && row.consumable.dc === undefined))
    )
      throw new Error('专长制作物品须有真实强度与期限／DC 来源')
    if (
      row.uses !== undefined &&
      (!Number.isInteger(row.uses) || (findItem(c,cat,row.itemId)?.spellUse?.charges ? row.uses<0||row.uses>findItem(c,cat,row.itemId)!.spellUse!.charges! : row.itemId !== 'healers-kit'||row.uses < 1 || row.uses > 10))
    )
      throw new Error('医疗包次数或施法物品充能不合法')
    if ((row.craftedBy === undefined) !== (row.craftedAt === undefined))
      throw new Error('快速制作来源与时刻不完整')
    if (ids.has(row.instanceId) || !findItem(c, cat, row.itemId))
      throw new Error('物品 ID 重复或物品来源缺失')
    ids.add(row.instanceId)
    if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 10000)
      throw new Error('物品数量须为 1 至 10000 的整数')
    if (row.containerId) {
      const parent = c.inventory.find((x) => x.instanceId === row.containerId)
      if (!parent || parent.quantity !== 1 || !isContainer(findItem(c, cat, parent.itemId)))
        throw new Error('请选择一个有效、数量为 1 的容器')
      if (row.equipped) throw new Error('容器内物品需先取出才能穿戴或持用')
      let next: InventoryItem | undefined = row,
        depth = 0
      const seen = new Set<string>()
      while (next) {
        if (seen.has(next.instanceId)) throw new Error('不能把容器放入自身或其子容器')
        if (++depth > 6) throw new Error('容器嵌套最多 5 层')
        seen.add(next.instanceId)
        next = c.inventory.find((x) => x.instanceId === next?.containerId)
      }
    }
  }
  for (const row of c.inventory)
    if (isContainer(findItem(c, cat, row.itemId))) {
      const max = CONTAINERS[row.itemId]
      if (max && containerWeight(c, cat, row.instanceId) > max)
        throw new Error(`${findItem(c, cat, row.itemId)!.name}容量超过 ${max} 磅`)
    }
  validateEquipment(c, cat)
}
export function validateRuntimeArchive(c: Character, cat: Catalogue) {
  validateGrowthArchive(c, cat)
  if (!c.runtime || c.runtime.version !== 2) return
  const r = c.runtime,
    defs = resources(c, cat),
    normalized = runtimeState(c, cat)
  if (
    r.advanced?.ward !== null &&
    r.advanced?.ward !== undefined &&
    (!hasSubclass(c.build, 'abjurer') ||
      r.advanced.ward > Math.max(0, 2 * c.level + derived(c.build, cat, c.inventory).mods.int))
  )
    throw new Error('奥术守御来源或上限不合法')
  if (r.advanced?.portents?.length && !hasSubclass(c.build, 'diviner'))
    throw new Error('预兆骰来源不合法')
  if (r.advanced?.surges?.length && !hasSubclass(c.build, 'wild-magic'))
    throw new Error('浪涌来源不合法')
  if (
    r.knownBeasts &&
    (new Set(r.knownBeasts).size !== r.knownBeasts.length ||
      r.knownBeasts.length > (c.level >= 4 ? 6 : 4) ||
      r.knownBeasts.some((id) => {
        const b = beast(id)
        return (
          !b ||
          b.fly ||
          b.cr >
            (hasSubclass(c.build, 'moon') ? Math.floor(c.level / 3) : c.level >= 4 ? 0.5 : 0.25)
        )
      }))
  )
    throw new Error('已知兽形不符合等级限制')
  if (
    r.wildShape &&
    (c.build.classId !== 'druid' ||
      c.level < 2 ||
      !beast(r.wildShape.formId) ||
      !normalized.knownBeasts.includes(r.wildShape.formId))
  )
    throw new Error('荒野形态来源或已知形态不合法')
  if (
    r.revelation &&
    (c.build.speciesId !== 'aasimar' ||
      c.level < 3 ||
      r.wildShape ||
      r.revelation.endsAt < (r.hours ?? 0))
  )
    throw new Error('天启来源或期限不合法')
  if (r.lastRest && r.lastRest.endedAt > (r.hours ?? 0)) throw new Error('休息触发记录不合法')
  if (r.hp < 0 || r.hp > Math.max(0, derived(c.build, cat, c.inventory).hp))
    throw new Error('运行时 HP 超出合法范围')
  if (
    Object.entries(r.resources).some(
      ([id, n]) => !defs.some((x) => x.id === id && n >= 0 && n <= x.max),
    )
  )
    throw new Error('运行时资源来源或数值不合法')
  if (
    Object.entries(r.createdSlots ?? {}).some(
      ([key, n]) =>
        c.build.classId !== 'sorcerer' ||
        !defs.some((d) => d.id === key && key.startsWith('slots')) ||
        !Number.isInteger(n) ||
        n < 0 ||
        n > 20,
    )
  )
    throw new Error('临时创建法术位不合法')
  if ((r.hitDice ?? c.level) > c.level) throw new Error('剩余生命骰超过角色等级')
  if (r.conditions.some((id) => !CONDITIONS.some((x) => x.id === id)))
    throw new Error('运行时包含未知状态')
  if (normalized.lastLongRestEnd !== null && normalized.lastLongRestEnd > normalized.hours)
    throw new Error('休息时间记录不合法')
  if (r.restSpellChoices && Object.keys(r.restSpellChoices).length) { const errors=restSpellSelectionIssues(c,cat,r.restSpellChoices); if(errors.length) throw Error('运行时休息法术无效：'+errors.join('；')) }
  if (r.preparedSpells) {
    const p = preparation(c, cat)
    if (
      r.preparedSpells.length !== p.count ||
      new Set(r.preparedSpells).size !== p.count ||
      r.preparedSpells.some((id) => !p.options.some((x) => x.id === id))
    )
      throw new Error('运行时准备法术不合法')
  }
  if (
    r.concentration &&
    !r.itemCasts?.some(i=>i.success&&i.spellId===r.concentration!.spellId&&i.source===r.concentration!.source&&i.castId===r.concentration!.castId) &&
    !runtimeSpells(c, cat).some(
      (x) =>
        (x.spell.concentration||r.concentration!.castingKey===x.key&&x.modes.includes(r.concentration!.castingMode??'')&&(/\d+\s*(minute|hour)/i.test(x.spell.castingTime)||r.concentration!.castingMode==='ritual')) &&
        x.spell.id === r.concentration!.spellId &&
        x.source === r.concentration!.source,
    )
  )
    throw new Error('专注法术来源不合法')
}
export interface SpellGrant {
  retired?: boolean
  item?: {instanceId:string;itemId:string;definition:import('../persistence/item-spell-schema').ItemSpellDefinition;maxLevel:number;dc:number;attackBonus:number;casterLevel:number;abilityModifier:number}
  key: string
  spell: Spell
  source: string
  ability: Ability
  modes: string[]
  resource?: string
  ritualOnly?: boolean
  sorcerer: boolean
}
export function runtimeSpells(c: Character, cat: Catalogue): SpellGrant[] {
  const b = effectiveBuild(c, cat),
    result: SpellGrant[] = []
  const add = (
    id: string,
    key: string,
    source: string,
    ability: Ability | undefined,
    resource?: string,
    atWill = false,
    ritualOnly = false,
    sorcerer = false,
  ) => {
    const original = cat.spells.find((x) => x.id === id)
    if (!original || !ability) return
    const spell = clone(original)
    if (
      c.runtime?.effects?.some((e) => e.key === 'wild-quick-casting') &&
      /^(Action|1 Action)$/i.test(spell.castingTime)
    )
      spell.castingTime = 'Bonus Action'
    if (['class-cantrips', 'tome-cantrips'].includes(key) && hasInvocation(b, 'spear:' + id)) {
      const n = spell.range.match(/(\d+) feet/)
      if (n) spell.range = Number(n[1]) + 30 * c.level + ' feet'
    }
    const numeric = Number(spell.range.match(/^(\d+) feet/)?.[1] ?? 0)
    if (numeric >= 10 && hasSubclass(b, 'illusionist') && spell.school === 'Illusion')
      spell.range = numeric + 60 + ' feet'
    if (hasSubclass(b, 'illusionist') && spell.school === 'Illusion')
      spell.components = spell.components.replace(/^V,?\s*/, '')
    if (
      ((hasSubclass(b, 'illusionist') || hasSubclass(b, 'arcane-trickster')) &&
        id === 'minor-illusion' &&
        hasSubclass(b, 'illusionist')) ||
      (hasSubclass(b, 'arcane-trickster') && id === 'mage-hand')
    )
      spell.castingTime = 'Bonus Action'
    if (
      hasFeat(b, 'spell-sniper', cat) &&
      (PHB_SPELL_EFFECTS[id]?.kind === 'attack' ||
        /attack/i.test(spell.description + ' ' + spell.english)) &&
      numeric >= 10
    )
      spell.range = Number(spell.range.match(/^(\d+)/)?.[1] ?? numeric) + 60 + ' feet'
    if (key === 'feat-telekinetic') {
      spell.range = '60 feet'
      spell.components = '—'
      spell.description += ' 念动力：最大离开施法者距离也增加 30 尺，可隐形。'
    }
    if (key === 'shadow-arts') spell.components = '—'
    if (key === 'feat-telepathic') spell.description += ' 心灵感应：使用免费次数时不需任何成分。'
    if (
      hasSubclass(b, 'great-old-one') &&
      ['class-cantrips', 'class-spells', 'subclass', 'tome-cantrips', 'tome-rituals'].includes(
        key,
      ) &&
      ['Enchantment', 'Illusion'].includes(spell.school)
    )
      spell.components =
        spell.components.replace(/(?:^|,\s*)[VS](?=,|$)/g, '').replace(/^,\s*/, '') || '—'
    const modes =
      spell.level === 0
        ? ['cantrip']
        : ritualOnly
          ? ['ritual']
          : [
              ...(atWill ? ['at-will'] : []),
              ...(resource ? ['free'] : []),
              ...slotLevels(b).flatMap((n, i) =>
                n && i + 1 >= spell.level ? [i === 0 ? 'slot' : 'slot-' + (i + 1)] : [],
              ),
              ...(spell.ritual ? ['ritual'] : []),
            ]
    result.push({
      key: key + ':' + id,
      spell,
      source,
      ability,
      resource,
      modes,
      ritualOnly,
      sorcerer,
    })
  }
  for (const node of getChoices(b, cat).filter(
    (x) => x.kind === 'spell' && x.id !== 'spellbook' && !x.id.startsWith('feat-'),
  )) {
    for (const id of b.choices[node.id] ?? [])
      add(
        id,
        node.id,
        node.source,
        node.ability,
        node.id === 'mi-background-spell'
          ? 'mi-background'
          : node.id === 'mi-human-spell'
            ? 'mi-human'
            : node.id.startsWith('mi-') && node.id.endsWith('-spell')
              ? node.id.slice(0, -6)
              : undefined,
        false,
        false,
        b.classId === 'sorcerer' && node.id.startsWith('class-'),
      )
  }
  for (const grant of racialSpells(b))
    add(
      grant.id,
      'species',
      '物种传承',
      b.speciesId === 'aasimar' ? 'cha' : (one(b, 'species-ability') as Ability),
      grant.id === 'speak-with-animals'
        ? 'forest-magic'
        : cat.spells.find((s) => s.id === grant.id)?.level
          ? 'species-' + grant.id
          : undefined,
    )
  for (const grant of alwaysPrepared(b, cat.subclasses))
    add(
      grant.id,
      'subclass',
      grant.source,
      grant.ability,
      grant.resource,
      false,
      false,
      b.classId === 'sorcerer',
    )
  for (const gift of featSpellGifts(b, cat))
    add(gift.id, gift.key, gift.source, gift.ability, gift.resource)
  if (hasSubclass(b, 'wild-heart'))
    for (const id of ['beast-sense', 'speak-with-animals'])
      add(id, 'animal-speaker', '动物低语', 'wis', undefined, false, true)
  if (hasSubclass(b, 'shadow')) add('darkness', 'shadow-arts', '暗影技艺 · 无成分', 'wis', 'focus')
  if (hasSubclass(b, 'illusionist') && !b.choices['class-cantrips']?.includes('minor-illusion'))
    add('minor-illusion', 'improved-illusion', '强化幻术', 'int')
  if (
    hasSubclass(b, 'stars') &&
    c.inventory.some(
      (row) => row.itemId === 'star-map' && row.equipped && handSlot(assignedSlot(c, cat, row)),
    )
  ) {
    add('guidance', 'star-map', '星图', 'wis')
    add('guiding-bolt', 'star-map', '星图', 'wis', 'star-guiding')
  }
  if (hasSubclass(b, 'archfey')) add('misty-step', 'steps-fey', '妖精步伐', 'cha', 'fey-step')
  if (b.classId === 'druid') add('speak-with-animals', 'druidic', '德鲁伊语', 'wis')
  if (b.classId === 'ranger') add('hunter-s-mark', 'favored-enemy', '宿敌', 'wis', 'favored-enemy')
  if (b.classId === 'warlock' && hasInvocation(b, 'shadows'))
    add('mage-armor', 'shadows', '幽影护甲 · 对自身', 'cha', undefined, true)
  if (b.classId === 'warlock' && hasInvocation(b, 'chain'))
    add('find-familiar', 'chain', '链之契约 · 魔法动作', 'cha', undefined, true)
  for (const [inv, id] of [
    ['vigor', 'false-life'],
    ['mask', 'disguise-self'],
    ['visions', 'silent-image'],
    ['leap', 'jump'],
    ['forms', 'alter-self'],
    ['one_shadows', 'invisibility'],
    ['ascendant-step', 'levitate'],
  ])
    if (hasInvocation(b, inv!)) add(id!, inv!, '魔能祈唤 · ' + inv, 'cha', undefined, true)
  if (hasInvocation(b, 'depths')) add('water-breathing', 'depths', '深海馈赠', 'cha', 'depths')
  if (b.classId === 'wizard')
    for (const id of b.choices.spellbook ?? [])
      if (
        !(b.choices['class-spells'] ?? []).includes(id) &&
        cat.spells.find((x) => x.id === id)?.ritual
      )
        add(id, 'spellbook', '仪式专家 · 法术书', 'int', undefined, false, true)
  result.push(...itemSpellGrants(c,b,cat,result))
  return result
}
export const availableSlots = (c: Character, cat: Catalogue, level: number) => {
  const r = runtimeState(c, cat)
  return (r.resources[slotResource(level)] ?? 0) + (r.createdSlots[slotResource(level)] ?? 0)
}
export const castSlotLevel = (mode: string) =>
  mode === 'slot' ? 1 : /^(slot|item)-[0-9]$/.test(mode) ? Number(mode.split('-')[1]) : 0
export const MODE_NAMES: Record<string, string> = {
  ...Object.fromEntries(Array.from({length:10},(_,level)=>['item-'+level,'物品施法（'+level+'环）'])),
  slot: '一环法术位',
  'slot-2': '二环法术位',
  'slot-3': '三环法术位',
  free: '特性免费次数',
  ritual: '仪式',
  cantrip: '戏法',
  'at-will': '特性随意施放',
}
export function preparation(c: Character, cat: Catalogue) {
  const cl = cat.classes.find((x) => x.id === c.build.classId)
  const change = ['cleric', 'druid', 'wizard'].includes(cl?.id || '')
    ? 'any'
    : ['paladin', 'ranger'].includes(cl?.id || '')
      ? 'one'
      : 'none'
  const node = getChoices(c.build, cat).find((x) => x.id === 'class-spells')
  return {
    change,
    count: node?.count ?? 0,
    options: node?.options ?? [],
    current: runtimeState(c, cat).preparedSpells ?? c.build.choices['class-spells'] ?? [],
  }
}
export interface RollContext {
  advantage?: boolean
  disadvantage?: boolean
  purpose?:
    'normal' | 'poison' | 'charm' | 'fear' | 'concentration' | 'sight' | 'hearing' | 'grapple'
  fearVisible?: boolean
  lucky?: boolean
}
export function checkDetail(
  c: Character,
  cat: Catalogue,
  kind: 'skill' | 'save' | 'initiative' | 'ability',
  id: string,
  ctx: RollContext = {},
) {
  const r = runtimeState(c, cat),
    d = runtimeDerived(c, cat),
    base = derived(
      c.build,
      cat,
      r.wildShape
        ? c.inventory.map((row) => ({ ...row, equipped: false }))
        : equippedInventory(c, cat),
    )
  const ability = kind === 'skill' ? SKILLS[id]?.ability : kind === 'save' || kind === 'ability' ? (id as Ability) : 'dex'
  if (!ability || !(ability in ABILITY_NAMES)) throw new Error('未知检定')
  if (ctx.purpose === 'concentration' && (kind !== 'save' || ability !== 'con'))
    throw new Error('维持专注必须使用体质豁免')
  const reasons: string[] = [],
    adv: string[] = [],
    dis: string[] = []
  const cs = d.conditions
  if(appliedEffects(r.effects).some(f=>f.key==='bestow-curse'&&f.supportChoice===ability))dis.push('降咒：所选属性检定／豁免劣势')
  if(ability==='str'&&appliedEffects(r.effects).some(f=>f.key==='enlarge-reduce'&&f.m3?.option==='reduce'))dis.push('缩小：力量检定／豁免劣势')
  if(ability==='str'&&enfeebled(appliedEffects(r.effects)))dis.push('衰弱射线：力量D20检定劣势')
  for (const effect of appliedEffects(r.effects)) {
    if((kind==='skill'||kind==='ability')&&effect.key==='heat-metal-disadvantage')dis.push('灼热金属：未丢弃实际物件')
    if((kind==='skill'||kind==='ability')&&effect.key==='hex'&&effect.supportChoice===ability)dis.push('脆弱诅咒：所选属性检定劣势')
    if ((kind === 'skill'||kind === 'ability') && effect.checkAdvantage === ability) adv.push(effect.name)
    if (kind === 'save' && (effect.saveAdvantage?.includes(ability) || effect.savePurposeAdvantage?.includes(ctx.purpose ?? 'normal'))) adv.push(effect.name)
  }
  if (
    hasSubclass(c.build, 'champion') &&
    (kind === 'initiative' || (kind === 'skill' && id === 'athletics'))
  )
    adv.push('勇士 · 非凡运动员')
  if (
    c.build.classId === 'barbarian' &&
    c.level >= 2 &&
    kind === 'save' &&
    id === 'dex' &&
    !cs.includes('incapacitated')
  )
    adv.push('危险感知')
  let autoFail = false
  if (r.effects.some((e) => e.key === 'lucky-own-roll')) adv.push('已登记幸运点')
  if (r.effects.some((e) => e.key === 'tides-chaos-roll')) adv.push('混乱之潮')
  if (kind === 'initiative' && hasSubclass(c.build, 'assassin')) adv.push('刺客 · 刺杀')
  if (kind === 'save' && ctx.purpose === 'concentration' && hasFeat(c.build, 'war-caster', cat))
    adv.push('战地施法者')
  if (
    kind === 'skill' &&
    ['athletics', 'acrobatics'].includes(id) &&
    r.effects.some((e) => e.key === 'peerless-athlete')
  )
    adv.push('绝伦健将')
  if (kind === 'skill' && id === 'perception' && r.effects.some((e) => e.key === 'wild-cosmetic-6'))
    adv.push('狂野魔法第三眼')
  if (kind === 'skill' && id === 'stealth' && r.effects.some((e) => e.key === 'blessing-trickster'))
    adv.push('诡术祝福')
  if (
    !r.wildShape &&
    c.build.speciesId === 'goliath' &&
    kind === 'skill' &&
    ctx.purpose === 'grapple' &&
    cs.includes('grappled')
  )
    adv.push('强大体格：结束受擒检定')
  if (ctx.lucky && featIds(c.build, cat).includes('lucky')) adv.push('幸运点')
  if (ctx.advantage) adv.push('情境优势')
  if (ctx.disadvantage) dis.push('情境劣势')
  if (kind === 'save') {
    if (
      ['str', 'dex'].includes(ability) &&
      ['paralyzed', 'petrified', 'stunned', 'unconscious'].some((x) => cs.includes(x))
    )
      autoFail = true
    if (!r.wildShape && c.build.speciesId === 'gnome' && ['int', 'wis', 'cha'].includes(ability))
      adv.push('侏儒机敏')
    if (!r.wildShape && c.build.speciesId === 'dwarf' && ctx.purpose === 'poison')
      adv.push('矮人抗性：避免或结束中毒')
    if (!r.wildShape && c.build.speciesId === 'elf' && ctx.purpose === 'charm')
      adv.push('妖精血统：避免或结束魅惑')
    if (!r.wildShape && c.build.speciesId === 'halfling' && ctx.purpose === 'fear')
      adv.push('勇敢：避免或结束恐惧')
    if (ctx.purpose === 'concentration' && r.concentration?.extended) adv.push('延时法术')
    if (r.rage && ability === 'str') adv.push('狂暴')
    if (!r.wildShape && ability === 'str' && r.effects.some((e) => e.key === 'large-form'))
      adv.push('巨人形态')
    if (cs.includes('restrained') && ability === 'dex') dis.push('束缚')
    if (
      ctx.purpose === 'concentration' &&
      c.build.classId === 'warlock' &&
      hasInvocation(c.build, 'mind')
    )
      adv.push('魔能心智')
  } else if (kind === 'skill' || kind === 'ability') {
    if (cs.includes('poisoned')) dis.push('中毒')
    if (cs.includes('frightened') && ctx.fearVisible) dis.push('恐惧来源在视线内')
    if (cs.includes('blinded') && ctx.purpose === 'sight') autoFail = true
    if (cs.includes('deafened') && ctx.purpose === 'hearing') autoFail = true
    if (cs.includes('unconscious')) autoFail = true
    if (r.rage && ability === 'str') adv.push('狂暴')
    if (
      id === 'stealth' &&
      !r.wildShape &&
      equippedInventory(c, cat).some(
        (x) => x.equipped && findItem(c, cat, x.itemId)?.stealthDisadvantage,
      )
    )
      dis.push('护甲隐匿劣势')
  } else {
    if (cs.includes('invisible')) adv.push('隐形')
    if (cs.includes('incapacitated')) dis.push('失能')
  }
  if (d.untrainedArmor && ['str', 'dex'].includes(ability)) dis.push('缺少护甲训练')
  const trained =
    kind === 'skill'
      ? base.skills.includes(id)
      : kind === 'save'
        ? cat.classes.find((x) => x.id === c.build.classId)?.saves.includes(ability) ||
          (hasFeat(c.build, 'resilient', cat) && featAbility(c.build, cat) === ability)
        : false
  const bonus =
    kind === 'skill' ? d.skillValues[id]! : kind === 'save' ? d.saves[id]! : kind === 'ability' ? d.mods[ability]-r.exhaustion*2 : d.initiative
  reasons.push(`${ABILITY_NAMES[ability]} ${signed(base.mods[ability])}`)
  if (trained)
    reasons.push(
      `熟练 ${signed(kind === 'skill' && base.expertise.includes(id) ? 2 * d.pb : d.pb)}`,
    )
  const special =
    bonus -
    base.mods[ability] -
    (trained ? (kind === 'skill' && base.expertise.includes(id) ? 2 * d.pb : d.pb) : 0) +
    r.exhaustion * 2
  if (special) reasons.push(`特性 ${signed(special)}`)
  if (r.exhaustion) reasons.push(`力竭 −${r.exhaustion * 2}`)
  return {
    ability,
    bonus,
    reasons,
    adv,
    dis,
    autoFail,
    mode:
      adv.length && dis.length
        ? 'normal'
        : adv.length
          ? 'advantage'
          : dis.length
            ? 'disadvantage'
            : 'normal',
  }
}
export { sourcedDie as rollDie } from './dice-source'
export type RuntimeCommand =
  | {
      type: 'special-weapon'
      instanceId: string
      definition: import('./types').SpecialWeapon | null
      reason: string
    }
  | { type: 'mounted'; active: boolean; reason: string }
  | {
      type: 'advanced'
      id: string
      amount: number
      confirmed: boolean
      note: string
      choice?: string
    }
  | OriginCommand
  | ({ type: 'level-up' } & GrowthRequest)
  | {
      type: 'recover'
      id:
        | 'magical-cunning'
        | 'font-slot'
        | 'font-points'
        | 'font-inspiration'
        | 'wild-resurgence'
        | 'wild-slot'
      slotLevel: number
    }
  | {
      type: 'damage'
      damageType?: import('./combat-types').DamageType
      amount: number
      critical?: boolean
      relentless?: boolean
      note?: string
    }
  | { type: 'heal'; amount: number; note?: string }
  | { type: 'temporary'; amount: number; replace?: boolean }
  | { type: 'condition'; id: string; active: boolean }
  | { type: 'effect-remove'; effectId: string; reason: string }
  | { type: 'exhaustion'; level: number }
  | {
      type: 'death-save'
      roll: number
      bonus?: number
      lucky?: boolean
      advantageHandled?: boolean
    }
  | { type: 'stabilize' }
  | {
      type: 'resource'
      id: string
      amount: number
      roll?: number
      target?: 'self' | 'other' | 'purify'
      note?: string
    }
  | { type: 'resource-set'; id: string; amount: number; reason: string }
  | { type: 'end-effect'; effect: 'rage' | 'innateSorcery' | 'concentration' }
  | { type: 'inspiration'; active: boolean; note?: string }
  | {
      type: 'cast'
      key: string
      mode: string
      requirementsConfirmed: boolean
      hitDice?: number
      wildCheck?: boolean
      deferEffects?: boolean
    }
  | { type: 'concentration-result'; success: boolean }
  | {
      type: 'rest'
      kind: 'short' | 'long'
      confirmed: boolean
      hitDieRoll?: number
      useHitDie?: boolean
      arcaneRecovery?: boolean
      recoverySlots?: number[]
      sorcerousRestoration?: boolean
      prepared?: string[]
      spellChoices?: Record<string,string[]>
      recoverExhaustion?: boolean
    }
  | { type: 'time'; hours: number }
  | {
      type: 'equip'
      instanceId: string
      equipped: boolean
      slot?: EquipmentSlot
      grip?: Grip
      takeOut?: boolean
    }
  | { type: 'item-add'; itemId: string; quantity: number; purchase: boolean; note?: string }
  | {
      type: 'item-remove'
      instanceId: string
      quantity: number
      consume?: boolean
      note?: string
      potionRolls?: number[]
    }
  | { type: 'item-move'; instanceId: string; containerId: string | null }
  | { type: 'item-note'; instanceId: string; note: string }
  | { type: 'item-split'; instanceId: string; quantity: number }
  | { type: 'portrait-set'; image: string | null }
  | { type: 'coins'; amount: number; reason: string }
  | {
      type: 'check'
      kind: 'skill' | 'save' | 'initiative' | 'ability'
      id: string
      context?: RollContext
      dc?: number
    }
  | { type: 'undo' }

const integer = (n: number, min = 0, max = 100000) => {
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`请输入 ${min} 至 ${max} 的整数`)
  return n
}
const reason = (s?: string) => {
  if (!s?.trim() || s.length > 2000) throw new Error('请填写操作原因或物品来源（最多 2000 字）')
  return s.trim()
}
const snapshot = (c: Character): RuntimeSnapshot =>
  clone({ runtime: c.runtime, inventory: c.inventory, coins: c.coins })
const heal = (r: Runtime, amount: number, max: number) => {
  if (r.effects.some((e) => e.blocksHealing)) throw new Error('当前效果禁止恢复生命值')
  if (amount > 0 && r.hp < max) r.effects = r.effects.filter((e) => e.key !== 'knockout')
  if (r.death.dead) throw new Error('角色已死亡，普通治疗不能复活')
  r.hp = Math.min(max, r.hp + amount)
  if (r.hp > 0) r.death = { successes: 0, failures: 0, stable: false, dead: false }
}
export function applyRuntime(
  c: Character,
  cat: Catalogue = catalogue(),
  command: RuntimeCommand,
  dice: (s: number) => number = rollDie,
  onCheck?: (result: { total: number; success: boolean; autoFail: boolean }) => void,
  internal?: {shortRestSpell?:'prayer-of-healing';alreadyElapsed?:boolean;subtle?:boolean},
  onDamage?: (amount: number) => void,
): Character {
  if (command.type === 'origin') {
    if (command.targets.some((id) => id !== c.id)) throw new Error('多人目标请通过队伍事务执行')
    return applyOriginParty([c], c.id, cat, command, dice)[0]!
  }
  if (command.type === 'level-up') return applyLevelUp(c, cat, command, dice)
  if (c.status !== 'complete') throw new Error('请先完成角色创建')
  const next = clone(c),
    before = snapshot(c),
    r = runtimeState(c, cat),
    d = runtimeDerived(c, cat)
  next.runtime = r
  if(d.spatialCapabilities.cannotManipulate&&['cast','equip','item-use','consume','give','drop','item-add','item-remove','item-move','item-split'].includes(command.type))throw Error('气化形体不能施法或操作物品')
  if (command.type !== 'undo') materializeEquipment(next, cat)
  if('instanceId'in command && ['item-remove','item-move','item-split','equip'].includes(command.type)){const row=c.inventory.find(i=>i.instanceId===command.instanceId);if(row&&itemSpellBusy(c,row))throw Error('物品用于连续施法中，请先取消原施法') }
  next.journal = next.journal ?? []
  let detail = '',
    noUndo = false
  const itemRow = (id: string) => {
    const row = next.inventory.find((x) => x.instanceId === id)
    if (!row) throw new Error('物品已不存在')
    return row
  }
  const spend = (id: string, n: number) => {
    integer(n, 1)
    if (!(id in r.resources) || r.resources[id]! < n) throw new Error('资源不足或资源不存在')
    r.resources[id]! -= n
  }
  const spendSlot = (level: number) => {
    const key = slotResource(level)
    if ((r.createdSlots[key] ?? 0) > 0) r.createdSlots[key]!--
    else spend(key, 1)
  }
  const canAct = () => {
    if (d.conditions.includes('incapacitated') || r.death.dead)
      throw new Error('失能或死亡时不能执行此动作')
  }
  const currentMax = Math.max(0, d.hp)
  if (r.wildShape && ['equip', 'item-remove', 'item-move', 'item-split'].includes(command.type))
    throw new Error('本批荒野形态的装备已融入，请先恢复原形再使用或整理背包')
  switch (command.type) {
    case 'special-weapon': {
      const row = itemRow(command.instanceId)
      if (row.quantity !== 1 || findItem(c, cat, row.itemId)?.kind !== 'weapon')
        throw Error('请选择单件基础武器')
      if (command.definition) {
        validateSpecialWeapon(command.definition)
        if (r.effects.some((f) => f.weapon?.instanceId === row.instanceId))
          throw Error('请先结束该实例的临时武器附魔，再配置永久特殊武器')
        row.specialWeapon = clone(command.definition)
      } else delete row.specialWeapon
      detail = `GM ${command.definition ? '配置特殊武器 ' + command.definition.name : '恢复基础武器'}：${reason(command.reason)}`
      break
    }
    case 'mounted':
      r.mounted = command.active
      detail = `${command.active ? '确认骑乘' : '结束骑乘'}：${reason(command.reason)}`
      break
    case 'advanced':
      if (command.id !== 'phb/surge-ruling') canAct()
      detail = useAdvanced(next, cat, command, dice)
      break
    case 'damage': {
      if (r.concentration?.pendingDC)
        throw new Error('请先结算上一笔伤害触发的专注豁免，再记录新的伤害')
      const rawIncoming = command.damageType && r.effects.some(f=>f.damageImmunities?.includes(command.damageType!)) ? 0 : integer(command.amount, 1)
      const reduction = command.damageType
        ? resistanceReduction(
            r.effects,
            command.damageType,
            rawIncoming,
            'outside:' + Math.floor(r.hours * 600 + 1e-7),
            dice,
            r,
          )
        : 0
      const incoming = rawIncoming - reduction,
        ward = r.advanced.ward === null ? 0 : Math.min(incoming, r.advanced.ward)
      if (r.advanced.ward !== null) r.advanced.ward -= ward
      const amount = incoming - ward,
        absorbed = Math.min(r.temporaryHp, amount),
        hpDamage = amount - absorbed,
        previous = r.hp
      r.temporaryHp -= absorbed
      if (!r.temporaryHp) r.effects = r.effects.filter((e) => e.key !== 'tree-thp')
      r.hp = Math.max(0, r.hp - hpDamage)
      if (amount && r.concentration)
        r.concentration.pendingDC = Math.max(
          r.concentration.pendingDC ?? 0,
          Math.min(30, Math.max(10, Math.floor(amount / 2))),
        )
      if (amount && previous === 0) {
        r.death.stable = false
        r.death.failures = Math.min(3, r.death.failures + (command.critical ? 2 : 1))
      }
      if (hpDamage && r.hp === 0 && hpDamage - previous >= currentMax) r.death.dead = true
      if (r.death.failures >= 3) r.death.dead = true
      if (command.relentless && r.wildShape) throw new Error('荒野形态未保留物种顽强不屈特性')
      if (command.relentless) {
        if (!previous || r.hp !== 0 || r.death.dead)
          throw new Error('顽强不屈仅能在降至 0 HP 且未即死时使用')
        spend('relentless', 1)
        heal(r, 1, currentMax)
      }
      detail = `记录已结算伤害 ${incoming}${reduction ? `（抵抗术减伤${reduction}）` : ''}：${ward ? '奥术守御吸收 ' + ward + '，' : ''}临时 HP 吸收 ${absorbed}，HP ${previous} → ${r.hp}${command.critical ? '（重击）' : ''}${command.relentless ? '；使用顽强不屈' : ''}${command.note ? '；' + command.note : ''}`
      if (amount > 0) {
        r.effects = r.effects.filter((e) => !['friends','sleep','hypnotic-pattern'].includes(e.key)&&!(e.key==='calm-emotions'&&e.supportChoice==='indifferent'))
        for (const effect of r.effects.filter(
          (e) => e.key === 'hideous-laughter' && e.repeatSave,
        )) {
          const checked = applyRuntime(
            next,
            cat,
            {
              type: 'check',
              kind: 'save',
              id: 'wis',
              dc: effect.repeatSave!.dc,
              context: { advantage: true },
            },
            dice,
          )
          Object.assign(r, checked.runtime)
          const roll = r.advanced.lastCheck!
          detail += `；狂笑术受伤优势豁免 ${roll.total}/DC ${effect.repeatSave!.dc}`
          if (!roll.autoFail && roll.total >= effect.repeatSave!.dc)
            r.effects = r.effects.filter((e) => e.id !== effect.id)
        }
      }
      onDamage?.(amount)
      break
    }
    case 'heal': {
      const previous = r.hp
      heal(r, integer(command.amount, 1), currentMax)
      detail = `治疗 ${command.amount}：HP ${previous} → ${r.hp}${command.note ? '；' + command.note : ''}`
      break
    }
    case 'temporary': {
      integer(command.amount)
      if (command.replace || command.amount > r.temporaryHp)
        r.effects = r.effects.filter((e) => e.key !== 'tree-thp')
      if (command.replace) r.temporaryHp = command.amount
      else r.temporaryHp = Math.max(r.temporaryHp, command.amount)
      detail = `临时 HP ${c.runtime?.temporaryHp ?? 0} → ${r.temporaryHp}（${command.replace ? '选择新值' : '保留较高值'}，不叠加）`
      break
    }
    case 'condition': {
      if (!CONDITIONS.some((x) => x.id === command.id) || command.id === 'exhaustion')
        throw new Error('未知状态或请使用力竭等级')
      if(command.active&&appliedEffects(r.effects).some(e=>e.conditionImmunities?.includes(command.id)))throw Error('当前来源效果免疫此状态')
      if (command.active && command.id === 'poisoned' && d.conditions.includes('petrified'))
        throw new Error('石化时免疫中毒状态')
      r.conditions = r.conditions.filter((x) => x !== command.id)
      if (command.active) r.conditions.push(command.id)
      detail = `${command.active ? '添加' : '移除'}状态：${CONDITIONS.find((x) => x.id === command.id)!.name}`
      break
    }
    case 'effect-remove': {
      const effect = r.effects.find((e) => e.id === command.effectId)
      if (!effect) throw new Error('效果已不存在')
      r.effects = r.effects.filter((e) => e.id !== command.effectId)
      detail = `GM 结束效果 ${effect.name}：${reason(command.reason)}`
      break
    }
    case 'exhaustion':
      r.exhaustion = integer(command.level, 0, 6)
      if (r.exhaustion === 6) r.death.dead = true
      detail = `力竭等级 ${r.exhaustion}${r.exhaustion === 6 ? '：死亡' : ''}`
      break
    case 'death-save': {
      if (r.hp || r.death.stable || r.death.dead)
        throw new Error('仅 0 HP、未稳定且未死亡时进行死亡豁免')
      let natural = integer(command.roll, 1, 20)
      if (command.lucky) {
        if (!featIds(c.build, cat).includes('lucky')) throw new Error('未获得幸运专长')
        spend('lucky', 1)
      }
      if (!command.advantageHandled && (command.lucky || hasFeat(c.build, 'durable', cat) || r.effects.some(e=>e.deathSaveAdvantage)))
        natural = Math.max(natural, integer(dice(20), 1, 20))
      const roll = natural,
        total = roll - r.exhaustion * 2 + integer(command.bonus ?? 0, -100, 100)
      if (roll === 20) heal(r, 1, currentMax)
      else if (roll === 1) r.death.failures = Math.min(3, r.death.failures + 2)
      else if (total >= 10) r.death.successes++
      else r.death.failures++
      if (r.death.failures >= 3) r.death.dead = true
      if (r.death.successes >= 3) r.death = { successes: 0, failures: 0, stable: true, dead: false }
      detail = `死亡豁免 d20=${roll}${r.exhaustion ? '，力竭后 ' + total : ''}；${r.hp ? '恢复 1 HP' : r.death.dead ? '死亡' : r.death.stable ? '稳定' : `成功 ${r.death.successes} / 失败 ${r.death.failures}`}`
      break
    }
    case 'stabilize':
      if (r.hp || r.death.dead) throw new Error('仅未死亡的 0 HP 角色可被稳定')
      r.death = { successes: 0, failures: 0, stable: true, dead: false }
      detail = '记录已完成的稳定救治；仍为 0 HP、昏迷，未自动恢复生命值'
      break
    case 'recover': {
      canAct()
      const level = integer(command.slotLevel, 1, 3),
        key = slotResource(level),
        cl = c.build.classId
      const max = resources(c, cat).find((d) => d.id === key)?.max ?? 0
      if (command.id === 'magical-cunning') {
        if (cl !== 'warlock' || c.level < 2) throw new Error('尚未获得魔法诡计')
        spend('magical-cunning', 1)
        const pact = resources(c, cat).find((d) => d.id.startsWith('slots'))!
        r.resources[pact.id] = Math.min(pact.max, r.resources[pact.id]! + Math.ceil(pact.max / 2))
        r.hours += 1 / 60
      } else if (command.id === 'font-slot') {
        if (cl !== 'sorcerer' || c.level < 2 || !max || c.level < level * 2 - 1)
          throw new Error('尚不能创建此环法术位')
        spend('sorcery-points', [0, 2, 3, 5][level]!)
        r.createdSlots[key] = (r.createdSlots[key] ?? 0) + 1
        if (r.createdSlots[key]! > 20) throw new Error('临时法术位过多')
      } else if (command.id === 'font-points') {
        if (cl !== 'sorcerer' || c.level < 2) throw new Error('尚未获得灵活施法')
        if (r.resources['sorcery-points']! + level > c.level)
          throw new Error('术法点不能超过等级上限')
        spendSlot(level)
        r.resources['sorcery-points']! += level
      } else if (command.id === 'font-inspiration') {
        const limit = resources(c, cat).find((d) => d.id === 'bardic-inspiration')?.max ?? 0
        if (cl !== 'bard' || c.level < 5) throw new Error('尚未获得激励之源')
        if (r.resources['bardic-inspiration']! >= limit) throw new Error('吟游激励没有已消耗次数')
        spendSlot(level)
        r.resources['bardic-inspiration']!++
      } else if (command.id === 'wild-resurgence') {
        if (cl !== 'druid' || c.level < 5 || r.resources['wild-shape'])
          throw new Error('荒野复苏须五级且没有荒野形态使用次数')
        spendSlot(level)
        r.resources['wild-shape'] = 1
      } else {
        if (cl !== 'druid' || c.level < 5 || level !== 1) throw new Error('荒野复苏只能恢复一环位')
        if ((r.resources.slots ?? 0) >= max) throw new Error('没有已耗一环法术位')
        spend('wild-slot', 1)
        spend('wild-shape', 1)
        r.resources.slots!++
      }
      detail = '恢复与转换 ' + command.id + '（' + level + ' 环）；按规则消耗并保存，创建位长休消失'
      break
    }
    case 'resource': {
      if (advancedResources(c).some((x) => x.id === command.id) || command.id.startsWith('feat-'))
        throw new Error('此资源请通过相应专长／子职业能力或施法入口使用')
      if (
        r.wildShape &&
        ['adrenaline', 'breath', 'giant-ancestry', 'stonecunning', 'relentless'].includes(
          command.id,
        )
      )
        throw new Error('荒野形态未保留此物种特性')
      if (command.id !== 'lucky') canAct()
      else if (r.death.dead) throw new Error('角色已死亡，不能使用幸运点')
      const n = integer(command.amount, 1),
        def = resources(c, cat).find((x) => x.id === command.id)
      if (!def) throw new Error('资源不存在')
      if (
        [
          'slots',
          'arcane-recovery',
          'relentless',
          'favored-enemy',
          'forest-magic',
          'mi-background',
          'mi-human',
        ].includes(def.id)
      )
        throw new Error('请通过施法、休息或伤害入口使用此资源')
      if (
        def.id === 'wild-slot' ||
        def.id.startsWith('slots') ||
        def.id.startsWith('species-') ||
        [
          'mi-growth',
          'paladin-smite',
          'faithful-steed',
          'magical-cunning',
          'sorcerous-restoration',
        ].includes(def.id)
      )
        throw new Error('请通过施法或恢复入口使用此资源')
      if (!['lay-on-hands', 'focus', 'sorcery-points'].includes(def.id) && n !== 1)
        throw new Error('此能力一次消耗 1 次')
      if (
        def.id === 'rage' &&
        equippedInventory(c, cat).some(
          (x) => x.equipped && findItem(c, cat, x.itemId)?.category === 'heavy',
        )
      )
        throw new Error('穿着重甲不能开启狂暴')
      spend(def.id, n)
      detail = `使用${def.name}，消耗 ${n}`
      if (def.id === 'second-wind') {
        const roll = integer(command.roll ?? dice(10), 1, 10)
        heal(r, roll + c.level, currentMax)
        detail += `；d10=${roll}，恢复 ${roll + c.level} HP`
      }
      if (def.id === 'lay-on-hands') {
        if (command.target === 'purify') {
          if (n !== 5) throw new Error('移除中毒须消耗 5 点')
          r.conditions = r.conditions.filter((x) => x !== 'poisoned')
          detail += '；移除自身中毒，不恢复 HP'
        } else if (command.target === 'other')
          detail += '；接触治疗另一生物 ' + n + ' HP：' + reason(command.note)
        else {
          heal(r, n, currentMax)
          detail += '；治疗自身 ' + n + ' HP'
        }
      }
      if (def.id === 'rage') {
        if (r.rage) throw new Error('狂暴已经开启')
        r.rage = true
        r.concentration = null
        r.effectEnds.rage = r.hours + 1 / 6
        if (hasSubclass(c.build, 'world-tree') && c.level > r.temporaryHp) {
          r.temporaryHp = c.level
          r.effects = r.effects.filter((e) => e.key !== 'tree-thp')
          r.effects.push({
            id: crypto.randomUUID(),
            key: 'tree-thp',
            name: '世界树生命力',
            sourceId: c.id,
            page: 0,
            concentration: false,
            expiresAt: null,
            encounterId: 'outside',
            phase: 'start',
            note: String(c.level),
          })
        }
      }
      if (def.id === 'innate-sorcery') {
        if (r.innateSorcery) throw new Error('天生术法已经开启')
        r.innateSorcery = true
        r.effectEnds.innateSorcery = r.hours + 1 / 60
      }
      if (['large-form', 'draconic-flight', 'stonecunning'].includes(def.id)) {
        if (r.wildShape) throw new Error('荒野形态不保留此物种特性')
        if (r.effects.some((e) => e.key === def.id)) throw new Error('此能力已经开启')
        r.effects.push({
          id: crypto.randomUUID(),
          key: def.id,
          name: def.name,
          sourceId: c.id,
          page: def.page,
          concentration: false,
          expiresAt: null,
          encounterId: 'runtime',
          phase: 'end',
          endsAt: r.hours + 1 / 6,
          ...(def.id === 'large-form' ? { speedBonus: 10 } : {}),
          note: command.note ?? '高度／空间和感官条件由 GM 核对',
        })
      }
      if (def.id === 'adrenaline') r.temporaryHp = Math.max(r.temporaryHp, pbOf(c.build))
      break
    }
    case 'resource-set': {
      const def = resources(c, cat).find((x) => x.id === command.id)
      if (!def) throw new Error('资源不存在')
      r.resources[def.id] = integer(command.amount, 0, def.max)
      detail = `GM 调整${def.name}为 ${command.amount}：${reason(command.reason)}`
      break
    }
    case 'end-effect':
      if (command.effect === 'concentration') r.concentration = null
      else r[command.effect] = false
      detail =
        '结束 ' + { rage: '狂暴', innateSorcery: '天生术法', concentration: '专注' }[command.effect]
      break
    case 'inspiration':
      r.heroicInspiration = command.active
      detail = `${command.active ? '获得' : '消耗'}英雄激励${command.note ? '：' + command.note : ''}`
      break
    case 'cast': {
      const vocal=runtimeSpells(next,cat).find(g=>g.key===command.key)?.spell.components
      if(!internal?.subtle&&r.effects.some(f=>f.key==='silence-region')&&/(^|[,\s])V([,\s(]|$)/.test(vocal??''))throw Error('沉默区域中不能使用言语成分施法')
      canAct()
      if (
        r.wildShape &&
        !(
          hasSubclass(c.build, 'moon') &&
          alwaysPrepared(c.build, cat.subclasses).some(
            (g) =>
              g.id === command.key.split(':').at(-1) &&
              g.source === cat.subclasses.find((s) => s.id === 'moon')?.name,
          )
        )
      )
        throw new Error('此荒野形态不能施放该来源的法术；月亮结社仅允许结社法术')
      if (r.rage) throw new Error('狂暴期间不能施法')
      if (d.untrainedArmor) throw new Error('穿着未受训护甲时不能施法')
      if (!command.requirementsConfirmed)
        throw new Error('请确认动作、目标、射程、法术成分及材料要求已满足')
      const grant = runtimeSpells(c, cat).find((x) => x.key === command.key)
      if (!grant || !grant.modes.includes(command.mode)) throw new Error('法术来源或施放方式不可用')
      if (command.hitDice !== undefined && grant.spell.id !== 'arcane-vigor')
        throw new Error('只有复苏秘法可在施放时消耗生命骰')
      if (
        !grant.item && hasSubclass(c.build, 'abjurer') &&
        grant.spell.school === 'Abjuration' &&
        castSlotLevel(command.mode)
      ) {
        const max = Math.max(0, 2 * c.level + d.mods.int)
        r.advanced.ward =
          r.advanced.ward === null
            ? max
            : Math.min(max, r.advanced.ward + 2 * castSlotLevel(command.mode))
      }
      if (spellUsesSlot(command.mode)) spendSlot(castSlotLevel(command.mode))
      r.lastCastKey=grant.key
      if(grant.item){
        let success=true,checkDC:number|undefined,checkTotal:number|undefined
        if(!grant.item.definition.charges&&grant.item.definition.requiresSpellList!==false&&grant.item.definition.level>grant.item.maxLevel){
          checkDC=10+grant.item.definition.level
          const checked=applyRuntime(next,cat,{type:'check',kind:'ability',id:grant.ability,dc:checkDC},dice,result=>{success=result.success&&!result.autoFail;checkTotal=result.total})
          Object.assign(next,checked);Object.assign(r,checked.runtime);next.runtime=r
        }
        const row=next.inventory.find(i=>i.instanceId===grant.item!.instanceId&&i.quantity>0)
        if(!row)throw Error('施法物品库存已变化')
        if(grant.item.definition.charges){if(row.quantity!==1)throw Error('充能物品请先拆分为独立实例');row.uses=(row.uses??grant.item.definition.charges)-(grant.item.definition.chargeCost??1);if(row.uses<0)throw Error('物品充能不足')}else{row.quantity--;next.inventory=next.inventory.filter(i=>i.quantity>0)}
        r.itemCasts=[...(r.itemCasts??[]).filter(i=>i.castId&&i.castId===r.concentration?.castId),...(r.itemCasts??[]).filter(i=>!i.castId||i.castId!==r.concentration?.castId).slice(-58),{id:crypto.randomUUID(),key:grant.key,itemId:grant.item.itemId,instanceId:grant.item.instanceId,spellId:grant.spell.id,source:grant.source,ability:grant.ability,level:grant.item.definition.level,dc:grant.item.dc,attackBonus:grant.item.attackBonus,success,...(checkDC!==undefined?{checkDC,checkTotal}: {})}]
        if(!success){const time=grant.spell.castingTime.match(/(\d+)\s+(minute|hour)/i);if(time){const hours=Number(time[1])*(time[2]!.toLowerCase()==='hour'?1:1/60);if(completedCasting(c.id,grant.key)+1e-9<hours)r.hours+=hours;r.concentration=null}detail='卷轴超环施法检定失败（'+checkTotal+' / DC '+checkDC+'），消耗卷轴，未产生法术效果';break}
      }
      if (command.mode === 'free') spend(grant.resource!, 1)
      r.effects=r.effects.filter(f=>f.key!=='sanctuary'&&f.key!=='invisibility')
      const casting = grant.spell.castingTime.match(/(\d+)\s+(minute|hour)/i)
      const chainAction = grant.key.startsWith('chain:') && command.mode === 'at-will'
      const castingHours = chainAction
        ? 0
        : (casting ? Number(casting[1]) * (casting[2]!.toLowerCase() === 'hour' ? 1 : 1 / 60) : 0) +
          (command.mode === 'ritual' ? 1 / 6 : 0)
      // Casting for a minute or longer requires concentration even when the
      // completed spell has an instantaneous / non-concentration duration.
      if (castingHours > 0) {
        r.concentration = null
        if(completedCasting(c.id,grant.key)+1e-9<castingHours)r.hours += castingHours
      }
      if (grant.spell.concentration) {
        const match = grant.spell.duration.match(/(\d+)\s+(minute|hour)/i)
        r.concentration = {
          castId: crypto.randomUUID(),
          spellId: grant.spell.id,
          source: grant.source,
          pendingDC: null,
          endsAt: match
            ? r.hours + Number(match[1]) * (match[2]!.toLowerCase() === 'hour' ? 1 : 1 / 60)
            : null,
        }
      }
      if(grant.item&&r.concentration?.spellId===grant.spell.id)r.itemCasts!.at(-1)!.castId=r.concentration.castId
      if(r.concentration&&['hex','hunter-s-mark'].includes(grant.spell.id)){const slot=castSlotLevel(command.mode);r.concentration.endsAt=r.hours+(slot>=3?8:grant.spell.id==='hex'&&slot===2?4:1)}
      detail = `完成施放 ${grant.spell.name} / ${grant.spell.english}（${grant.source}，${MODE_NAMES[command.mode]}）${command.mode === 'ritual' ? '；施法时间额外 +10 分钟' : ''}${castingHours ? '；冒险时间推进 ' + Number((castingHours * 60).toFixed(2)) + ' 分钟，长时间施法结束先前专注' : ''}；目标效果由 GM 结算`
      if (grant.sorcerer && castSlotLevel(command.mode)) {
        detail += wildMagic(next, r, dice, !!command.wildCheck)
        r.hp = Math.min(currentMax, r.hp)
      }
      if (
        !command.deferEffects &&
        ['blade-ward', 'armor-of-agathys', 'speak-with-animals'].includes(grant.spell.id)
      ) {
        const id = grant.spell.id,
          level = castSlotLevel(command.mode) || 1
        if (id === 'armor-of-agathys') r.temporaryHp = Math.max(r.temporaryHp, 5 * level)
        r.effects = r.effects.filter((e) => e.key !== id)
        r.effects.push({
          id: crypto.randomUUID(),
          key: id,
          name: grant.spell.name,
          sourceId: c.id,
          page: 0,
          concentration: id === 'blade-ward',
          expiresAt: null,
          encounterId: 'outside',
          phase: 'start',
          endsAt:
            r.hours + (id === 'blade-ward' ? 1 / 60 : id === 'speak-with-animals' ? 1 / 6 : 1),
          note: id === 'armor-of-agathys' ? String(5 * level) : '',
        })
      }
      if(grant.spell.id==='goodberry'&&!command.deferEffects)createGoodberries(next,cat,crypto.randomUUID())
      if (grant.spell.id === 'arcane-vigor' && !command.deferEffects) {
        const count = integer(
          command.hitDice ?? Math.min(2, r.hitDice),
          1,
          castSlotLevel(command.mode) || 2,
        )
        if (count > r.hitDice) throw new Error('复苏秘法：生命骰不足')
        const sides = cat.classes.find((cl) => cl.id === c.build.classId)!.hitDie,
          maximum = maximizesHealing(r.effects)
        if (!maximum) prepareDice(count, sides, '复苏秘法生命骰', dice)
        const rolls = Array.from({ length: count }, () =>
            maximizesHealing(r.effects)?sides:checkedOriginDie(dice, sides, featIds(c.build, cat).includes('healer')),
          )
        r.hitDice -= count
        const amount = Math.max(0, rolls.reduce((n, x) => n + x, 0) + d.mods[grant.ability])
        heal(r, amount, currentMax)
        recordDiceOutcome({label:'复苏秘法治疗',dice:rolls,total:amount,bonus:d.mods[grant.ability]},dice)
        detail +=
          '；消耗 ' +
          count +
          ' 枚生命骰 [' +
          rolls +
          ']＋施法属性 ' +
          signed(d.mods[grant.ability]) +
          '，恢复 ' +
          amount +
          ' HP，不加体质'
      }
      break
    }
    case 'concentration-result':
      if (!r.concentration?.pendingDC) throw new Error('当前没有待确认的专注豁免')
      detail = `专注豁免 DC ${r.concentration.pendingDC}：${command.success ? '成功，维持专注' : '失败，专注结束'}`
      if (command.success) r.concentration.pendingDC = null
      else r.concentration = null
      break
    case 'rest': {
      if (command.spellChoices) {
        const planned = clone(next)
        if (command.kind === 'long' && command.prepared && planned.runtime)
          planned.runtime.preparedSpells = [...command.prepared]
        const errors=restSpellSelectionIssues(planned,cat,command.spellChoices,command.kind)
        if(errors.length) throw Error(errors.join('；'))
      }
      if (!command.confirmed) throw new Error('请确认本次休息已满足时长、活动与中断规则')
      if (r.hp < 1 || r.death.dead) throw new Error('开始短休或长休时必须至少有 1 HP，且未死亡')
      if (command.kind === 'long' && r.lastLongRestEnd !== null && r.hours - r.lastLongRestEnd < 16)
        throw new Error('上次长休结束后须经过至少 16 小时才能开始下一次长休；请先推进冒险时间')
      for (const def of resources(c, cat)) {
        if (command.kind === 'long' || def.short === 'all') r.resources[def.id] = def.max
        else if (def.short === 'one')
          r.resources[def.id] = Math.min(def.max, r.resources[def.id]! + 1)
      }
      detail = `完成${command.kind === 'long' ? '长休' : '短休'}`
      if (command.kind === 'short') {
        r.hours += internal ? internal.alreadyElapsed ? 0 : 1/6 : 1
        if (command.hitDieRoll !== undefined || command.useHitDie) {
          if (!r.hitDice) throw new Error('没有剩余生命骰')
          const sides = cat.classes.find((x) => x.id === c.build.classId)!.hitDie,
            roll = integer(command.hitDieRoll ?? dice(sides), 1, sides),
            n = Math.max(1, roll + d.mods.con)
          r.hitDice--
          heal(r, n, currentMax)
          detail += `；生命骰 d${sides}=${roll} ${signed(d.mods.con)}，恢复 ${n} HP`
        }
        if (command.arcaneRecovery) {
          const levels = command.recoverySlots ?? [1]
          if (
            !levels.length ||
            levels.some((l) => !Number.isInteger(l) || l < 1 || l > 3) ||
            levels.reduce((a, b) => a + b, 0) > Math.ceil(c.level / 2)
          )
            throw new Error('奥术回想恢复环级合计超过限额')
          spend('arcane-recovery', 1)
          for (const l of levels) {
            const key = slotResource(l),
              max = resources(c, cat).find((d) => d.id === key)?.max ?? 0
            if ((r.resources[key] ?? 0) >= max) throw new Error('没有已消耗的此环法术位')
            r.resources[key]!++
          }
          detail += '；奥术回想恢复环级 [' + levels + ']'
        }
        if (command.sorcerousRestoration) {
          if (c.level < 5 || c.build.classId !== 'sorcerer') throw new Error('尚未获得术法恢复')
          spend('sorcerous-restoration', 1)
          r.resources['sorcery-points'] = Math.min(
            c.level,
            r.resources['sorcery-points']! + Math.floor(c.level / 2),
          )
          detail += '；术法恢复'
        }
        if (command.prepared) {
          const p = preparation(c, cat)
          if (
            c.build.classId !== 'wizard' ||
            c.level < 5 ||
            command.prepared.length !== p.count ||
            new Set(command.prepared).size !== p.count ||
            command.prepared.some((id) => !p.options.some((o) => o.id === id)) ||
            command.prepared.filter((id) => !p.current.includes(id)).length > 1
          )
            throw new Error('记忆法术只能在五级法师短休时替换一个准备法术')
          r.preparedSpells = command.prepared
        }
      } else {
        r.createdSlots = {}
        r.advanced = {
          surges: r.advanced.surges,
          ward: null,
          portents: hasSubclass(c.build, 'diviner')
            ? [integer(dice(20), 1, 20), integer(dice(20), 1, 20)]
            : [],
          lastCheck: null,
        }
        r.hours += c.build.speciesId === 'elf' ? 4 : 8
        r.lastLongRestEnd = r.hours
        heal(r, currentMax, currentMax)
        r.temporaryHp = 0
        r.hitDice = c.level
        r.rage = false
        r.innateSorcery = false
        r.concentration = null
        if (command.recoverExhaustion) r.exhaustion = Math.max(0, r.exhaustion - 1)
        if (c.build.speciesId === 'human') r.heroicInspiration = true
        if (command.prepared) {
          const p = preparation(c, cat),
            nextSpells = command.prepared
          if (
            p.change === 'none' &&
            JSON.stringify([...nextSpells].sort()) !== JSON.stringify([...p.current].sort())
          )
            throw new Error('此职业准备法术仅能在升级时更换')
          if (
            new Set(nextSpells).size !== p.count ||
            nextSpells.length !== p.count ||
            nextSpells.some((x) => !p.options.some((y) => y.id === x))
          )
            throw new Error('准备法术数量或列表不合法')
          if (p.change === 'one' && nextSpells.filter((x) => !p.current.includes(x)).length > 1)
            throw new Error('本职业每次长休只能更换一个准备法术')
          r.preparedSpells = [...nextSpells]
          detail += '；更新职业准备法术'
        }
        detail += `；恢复 HP、生命骰与长休资源；临时 HP 清零${command.recoverExhaustion ? '，力竭降低一级' : '，保留力竭等级'}`
      }
      if (command.spellChoices) {
        r.restSpellChoices = {...r.restSpellChoices,...clone(command.spellChoices)}
        const errors=restSpellSelectionIssues(next,cat,r.restSpellChoices); if(errors.length) throw Error(errors.join('；'))
        detail += '; 已保存本次休息法术选择'
      }
      r.lastRest = {
        kind: command.kind,
        endedAt: r.hours,
        crafted: false,
        sang: false,
        usedHitDice:
          command.kind === 'short' && !!(command.useHitDie || command.hitDieRoll !== undefined),
      }
      r.revelation = null
      if(command.kind==='long')r.prayerHealingSinceLongRest=false
      if (command.kind === 'long')
        next.inventory = next.inventory.filter((row) => row.craftedBy !== c.id)
      // Even a short rest exceeds one minute / ten minutes; do not clear unrelated conditions.
      r.rage = false
      r.innateSorcery = false
      break
    }
    case 'time':
      if (!Number.isFinite(command.hours) || command.hours <= 0 || command.hours > 10000)
        throw new Error('推进时间须大于 0 且不超过 10000 小时')
      r.hours += command.hours
      detail = `冒险时间推进 ${command.hours} 小时；累计 ${r.hours} 小时`
      break
    case 'equip': {
      canAct()
      const row = itemRow(command.instanceId),
        item = findItem(c, cat, row.itemId)!
      if (!command.equipped) {
        clearEquipment(row)
        detail = `卸下／收起 ${item.name}`
        break
      }
      if (row.containerId && !command.takeOut) throw new Error('请先从容器取出物品')
      const layout = equipmentLayout(next, cat),
        options = compatibleSlots(item)
      const preferred = item.kind === 'shield' ? (['off-hand', 'main-hand'] as const) : options
      const slot =
        command.slot ??
        assignedSlot(next, cat, row) ??
        preferred.find((x) => !layout.slots[x]?.length) ??
        preferred[0]
      if (!slot || !options.includes(slot)) throw new Error('该物品不能放入所选装备槽')
      if(r.effects.some(f=>f.key==='flame-blade-held'&&(f.supportChoice===slot||(command.grip==='two-handed'))))throw Error('此手被火焰刀效应占用，请先放下火焰刀')
      if (r.grapples.some((g) => g.hand === slot)) throw Error('此手正被擒抱占用，请先释放目标')
      const other = slot === 'main-hand' ? 'off-hand' : 'main-hand'
      const grip = handSlot(slot)
        ? (command.grip ??
          (requiresTwoHands(item, r.mounted) && !layout.slots[other]?.length
            ? 'two-handed'
            : 'one-handed'))
        : null
      if(grip==='two-handed'&&r.effects.some(f=>f.key==='flame-blade-held'))throw Error('火焰刀占用一手，无法双手持握')
      if (grip === 'two-handed' && !canUseTwoHands(item))
        throw new Error('该物品没有双手或两用武器属性')
      if (grip === 'two-handed' && r.grapples.length) throw Error('擒抱占用手部，当前不能双手持用')
      if (
        grip === 'two-handed' &&
        layout.slots[other]?.some((x) => x.instanceId !== row.instanceId)
      )
        throw new Error('双手持用需要另一只手空闲；请先收起另一只手的物品，或选择单手持握')
      if (
        handSlot(slot) &&
        layout.slots[other]?.some(
          (x) => x.instanceId !== row.instanceId && gripOf(next, cat, x) === 'two-handed',
        )
      )
        throw new Error('另一件武器正在双手持用；请先改为单手持握或收起')
      const previous = (slot === 'accessories' ? [] : (layout.slots[slot] ?? [])).filter(
        (x) => x.instanceId !== row.instanceId,
      )
      for (const old of previous) clearEquipment(old)
      // Old archives may mark multiple suits or shields. Explicit replacement resolves them together.
      if (item.kind === 'armor' || item.kind === 'shield')
        next.inventory
          .filter(
            (x) =>
              x.instanceId !== row.instanceId && findItem(c, cat, x.itemId)?.kind === item.kind,
          )
          .forEach(clearEquipment)
      if (row.quantity > 1) {
        next.inventory.push({
          ...clone(row),
          instanceId: crypto.randomUUID(),
          quantity: row.quantity - 1,
          equipped: false,
          equipmentSlot: null,
          grip: null,
        })
        row.quantity = 1
      }
      const wasStored = !!row.containerId
      row.containerId = null
      row.equipped = true
      row.equipmentSlot = slot
      row.grip = grip
      detail = `${wasStored ? '从容器取出并' : ''}穿戴／持用 ${item.name} · ${SLOT_NAMES[slot]}${grip ? (grip === 'two-handed' ? '（双手持用）' : '（单手持握）') : ''}${previous.length ? '；收起 ' + previous.map((x) => findItem(c, cat, x.itemId)!.name).join('、') : ''}`
      break
    }
    case 'item-add': {
      const item = findItem(c, cat, command.itemId)
      if (!item || item.kind === 'pack') throw new Error('请选择具体物品；套组请逐件添加')
      if (['chef-treat', 'poisoner-dose'].includes(item.id))
        throw new Error('此物品请使用专长制作入口，保存强度与期限／DC')
      const quantity = integer(command.quantity, 1, 10000),
        cost = Math.round(purchasePrice(c.build, cat, item) * quantity * 100) / 100
      if (command.purchase) {
        if (next.coins < cost) throw new Error('金币不足')
        next.coins = Math.round((next.coins - cost) * 100) / 100
      }
      const note = command.purchase ? '购买' : reason(command.note)
      next.inventory.push({
        instanceId: crypto.randomUUID(),
        itemId: item.id,
        quantity,
        source: '跑团 · ' + note,
        equipped: false,
        note,
        containerId: null,
      })
      detail = `${command.purchase ? '购买' : '获得'} ${item.name} ×${quantity}${command.purchase ? '，支付 ' + cost + ' GP' : '：' + note}`
      break
    }
    case 'item-remove': {
      const row = itemRow(command.instanceId),
        n = integer(command.quantity, 1, row.quantity),
        item = findItem(c, cat, row.itemId)!
      if (next.inventory.some((x) => x.containerId === row.instanceId) && row.quantity === n)
        throw new Error('请先取出容器内物品')
      if (command.consume) canAct()
      if(command.consume&&item.id==='goodberry'){
        const hour=inventorySourceHour(row,next,r.hours)
        if(n!==1||!row.consumable||row.consumable.value!==1||hour===undefined||row.consumable.expiresAt!<=hour)
          throw Error('神莓须一次食用1颗，来源时钟可核对且未过期；跨角色请在房间或地图入口使用')
        heal(r,1,currentMax)
        r.nourishedUntil=Math.max(r.nourishedUntil??0,r.hours+24)
        detail='附赠动作食用神莓：恢复1HP并获得一天营养；不是治疗药水，不额外掷骰'
      } else if (command.consume && item.id === 'chef-treat') {
        if (n !== 1 || !row.consumable || row.consumable.expiresAt! <= r.hours)
          throw new Error('请一次使用一份未过期的零嘴')
        if (row.consumable.value > r.temporaryHp)
          r.effects = r.effects.filter((e) => e.key !== 'tree-thp')
        r.temporaryHp = Math.max(r.temporaryHp, row.consumable.value)
        detail = '附赠动作食用零嘴：制作者熟练值 ' + row.consumable.value + ' 临时 HP，不叠加'
      } else if (command.consume && item.id === 'healing-potion') {
        if (n !== 1) throw new Error('治疗药水请一次使用一瓶')
        if(maximizesHealing(r.effects)&&command.potionRolls?.some(n=>n!==4))throw Error('希望信标使治疗药水骰取最大值，无需掷骰')
        const rolls = maximizesHealing(r.effects)?[4,4]:command.potionRolls ?? [dice(4), dice(4)]
        if (rolls.length !== 2) throw new Error('治疗药水需要两个 d4')
        rolls.forEach((x) => integer(x, 1, 4))
        heal(r, rolls[0]! + rolls[1]! + 2, currentMax)
        detail = `附赠动作饮用治疗药水：2d4(${rolls.join(',')}) + 2 HP`
      } else
        detail = `${command.consume ? '消耗' : '移除'} ${item.name} ×${n}：${reason(command.note)}`
      if (n === row.quantity)
        next.inventory = next.inventory.filter((x) => x.instanceId !== row.instanceId)
      else row.quantity -= n
      break
    }
    case 'item-move': {
      canAct()
      const row = itemRow(command.instanceId)
      row.containerId = command.containerId
      if (command.containerId) clearEquipment(row)
      detail = `移动 ${findItem(c, cat, row.itemId)!.name} 至 ${command.containerId ? findItem(c, cat, itemRow(command.containerId).itemId)!.name : '随身物品'}`
      break
    }
    case 'item-note': {
      const row = itemRow(command.instanceId)
      if (command.note.length > 2000) throw new Error('备注最多 2000 字')
      row.note = command.note
      detail = `修改 ${findItem(c, cat, row.itemId)!.name} 备注`
      break
    }
    case 'item-split': {
      const row = itemRow(command.instanceId),
        n = integer(command.quantity, 1, row.quantity - 1)
      if (row.equipped || next.inventory.some((x) => x.containerId === row.instanceId))
        throw new Error('请先收起装备或取出容器内容再拆分')
      row.quantity -= n
      const split = { ...clone(row), instanceId: crypto.randomUUID(), quantity: n }
      if(row.uses!==undefined&&findItem(c,cat,row.itemId)?.spellUse?.charges)throw Error('已记录充能的物品须保持单件实例，不能复制剩余充能')
      if (row.uses !== undefined) row.uses = 10
      next.inventory.push(split)
      detail = `拆分 ${findItem(c, cat, row.itemId)!.name} ×${n}；来源、备注与存放位置保留`
      break
    }
    case 'portrait-set': {
      if (command.image !== null && !isSafePortrait(command.image))
        throw new Error('头像需要使用工具上传生成的本地 JPEG 缩略图')
      next.portrait = command.image
      noUndo = true
      detail = command.image ? '更新角色头像（仅展示）' : '恢复默认角色剪影'
      break
    }
    case 'coins': {
      if (
        !Number.isFinite(command.amount) ||
        Math.abs(command.amount) > 1000000 ||
        Math.abs(Math.round(command.amount * 100) - command.amount * 100) > 1e-8
      )
        throw new Error('金币变化最多保留两位小数')
      const coins = Math.round((next.coins + command.amount) * 100) / 100
      if (coins < 0) throw new Error('金币不足')
      next.coins = coins
      detail = `金币 ${signed(command.amount)} GP：${reason(command.reason)}`
      break
    }
    case 'check': {
      if (command.context?.lucky) {
        if (!featIds(c.build, cat).includes('lucky')) throw new Error('未获得幸运专长')
        spend('lucky', 1)
      }
      const info = checkDetail(c, cat, command.kind, command.id, command.context),
        override = r.effects.find((e) => e.rollOverride !== undefined)?.rollOverride,
        needed = info.autoFail || override !== undefined ? 0 : info.mode === 'normal' ? 1 : 2
      prepareDice(needed, 20, '属性／技能／豁免检定', dice)
      const rolls = info.autoFail ? [] : [override ?? integer(dice(20), 1, 20)]
      if (r.effects.some((e) => e.key === 'restore-balance-roll') || override !== undefined)
        info.mode = 'normal'
      if (!info.autoFail && info.mode !== 'normal') rolls.push(dice(20))
      let rerollNote = ''
      if (
        override === undefined &&
        !r.wildShape &&
        c.build.speciesId === 'halfling' &&
        rolls.includes(1)
      ) {
        const i = rolls.indexOf(1)
        rolls[i] = dice(20)
        rerollNote = `；半身人幸运重掷一个自然 1 → ${rolls[i]}`
      }
      let natural = info.autoFail
        ? 0
        : info.mode === 'advantage'
          ? Math.max(...rolls)
          : info.mode === 'disadvantage'
            ? Math.min(...rolls)
            : rolls[0]!
      if (
        override === undefined &&
        r.effects.some((e) => e.key === 'starry-dragon') &&
        ((['skill','ability'].includes(command.kind) && ['int', 'wis'].includes(info.ability)) ||
          (command.kind === 'save' && command.context?.purpose === 'concentration'))
      )
        natural = Math.max(10, natural)
      const effectDice =
          !info.autoFail && command.kind === 'save'
            ? appliedEffects(r.effects)
                .filter((e) => e.saveDie)
                .map((e) => Math.sign(e.saveDie!) * dice(Math.abs(e.saveDie!)))
            : !info.autoFail && command.kind === 'skill'
              ? [guidanceBonus(r.effects, command.id, dice)].filter(Boolean)
              : [],
        total = natural + info.bonus + effectDice.reduce((s, n) => s + n, 0)
      if (command.dc !== undefined) integer(command.dc, 1, 100)
      if (!info.autoFail)
        recordDiceOutcome(
          {
            label: command.kind === 'save' ? '豁免' : '属性／技能检定',
            dice: rolls,
            chosen: natural,
            bonus: info.bonus + effectDice.reduce((s, n) => s + n, 0),
            total,
            mode: info.mode,
            reasons: [...info.reasons, ...(rerollNote ? [rerollNote] : [])],
          },
          dice,
        )
      onCheck?.({
        total,
        success: !info.autoFail && (command.dc === undefined || total >= command.dc),
        autoFail: info.autoFail,
      })
      r.advanced.lastCheck = {
        id: crypto.randomUUID(),
        kind: command.kind,
        key: command.id,
        total,
        dc: command.dc ?? null,
        proficient: command.kind === 'skill' && d.skills.includes(command.id),
        attempted: false,
        autoFail: info.autoFail,
      }
      detail = `${command.kind === 'skill' ? SKILLS[command.id]!.name : command.kind === 'save' ? ABILITY_NAMES[info.ability] + '豁免' : command.kind === 'ability' ? ABILITY_NAMES[info.ability] + '检定' : '先攻'}：${info.autoFail ? '依状态规则自动失败' : `d20(${rolls.join(',')}) ${signed(info.bonus)} = ${total}${command.dc ? '，DC ' + command.dc + '：' + (total >= command.dc ? '成功' : '失败') : ''}`}；${info.reasons.join(' + ')}${info.adv.length ? '；优势：' + info.adv.join('、') : ''}${info.dis.length ? '；劣势：' + info.dis.join('、') : ''}${info.adv.length && info.dis.length ? '；优势与劣势抵消' : ''}${effectDice.length ? '；效果骰 [' + effectDice.join(',') + ']' : ''}${rerollNote}；属性检定与豁免没有通用的自然 1 自动失败／20 自动成功规则`
      if (command.kind === 'save')
        r.effects = r.effects.filter((effect) => effect.key !== 'mind-sliver')
      r.effects = r.effects.filter(
        (effect) =>
          !['portent-roll', 'restore-balance-roll', 'tides-chaos-roll'].includes(effect.key),
      )
      break
    }
    case 'undo': {
      const event = [...next.journal].reverse().find((x) => x.before && !x.undone)
      if (!event?.before) throw new Error('没有可以撤销的运行时操作')
      next.runtime = clone(event.before.runtime)
      next.inventory = clone(event.before.inventory)
      next.coins = event.before.coins
      if (event.before.level !== undefined) {
        next.level = event.before.level
        next.build.growth = clone(event.before.growth ?? [])
        next.build.choices = clone(event.before.choices!)
      }
      event.undone = true
      detail = '撤销：' + event.detail
      noUndo = true
      break
    }
  }
  if (command.type !== 'undo') {
    next.inventory = next.inventory.filter(
      (row) => row.consumable?.expiresAt === undefined || inventorySourceHour(row,next,r.hours)===undefined || row.consumable.expiresAt > inventorySourceHour(row,next,r.hours)!,
    )
    if (r.wildShape) r.revelation = null
    if (r.revelation && r.hours >= r.revelation.endsAt - 1e-9) r.revelation = null
    r.effects = rememberEndedCharms(
      r.effects,
      r.effects.filter(
        (e) =>
          e.endsAt === undefined ||
          (!!e.clockSourceId && e.clockSourceId !== c.id) ||
          e.endsAt > r.hours,
      ),
    )
    if (!r.temporaryHp) r.effects = r.effects.filter((effect) => effect.key !== 'armor-of-agathys')
    if (
      r.concentration?.endsAt !== undefined &&
      r.concentration.endsAt !== null &&
      r.hours >= r.concentration.endsAt
    )
      r.concentration = null
    if (r.effectEnds.rage !== null && r.hours >= r.effectEnds.rage) r.rage = false
    if (r.effectEnds.innateSorcery !== null && r.hours >= r.effectEnds.innateSorcery)
      r.innateSorcery = false
    const cs = effectiveConditions(r)
    if (
      r.wildShape &&
      (r.hours >= r.wildShape.endsAt || cs.includes('incapacitated') || r.death.dead)
    )
      r.wildShape = null
    if (cs.includes('incapacitated') || r.death.dead) {
      r.effects = r.effects.filter(
        (e) =>
          ![
            'elemental-attunement',
            'wrath-sea',
            'starry-archer',
            'starry-chalice',
            'starry-dragon',
            'invoke-duplicity',
          ].includes(e.key),
      )
      r.concentration = null
      r.rage = false
    }
    if (cs.includes('unconscious')) {
      if (!r.conditions.includes('prone')) r.conditions.push('prone')
      next.inventory.forEach((x) => {
        if (!x.equipped) return
        const slot = assignedSlot(next, cat, x)
        if (handSlot(slot)) clearEquipment(x)
      })
    }
    if (
      equippedInventory(next, cat).some(
        (x) => x.equipped && findItem(c, cat, x.itemId)?.category === 'heavy',
      )
    )
      r.rage = false
  }
  if (!r.rage) {
    r.effects = r.effects.filter((e) => !e.key.startsWith('rage-'))
    if (r.effects.some((e) => e.key === 'tree-thp' && e.sourceId === c.id)) {
      r.temporaryHp = 0
      r.effects = r.effects.filter((e) => !(e.key === 'tree-thp' && e.sourceId === c.id))
    }
  }
  if (command.type !== 'undo') r.effects = rememberEndedHaste(c.runtime?.effects??[],rememberEndedCharms(c.runtime?.effects ?? [], r.effects),{hours:r.hours})
  validateInventory(next, cat)
  next.revision++
  next.updatedAt = new Date().toISOString()
  next.journal.push({
    id: crypto.randomUUID(),
    at: next.updatedAt,
    revision: next.revision,
    kind: command.type,
    detail,
    before: noUndo ? null : before,
    undone: false,
  })
  next.journal = next.journal.slice(-60)
  // Keep audit records, but discard the oldest undo snapshots above 2 MiB.
  const encoder = new TextEncoder()
  while (encoder.encode(JSON.stringify(next.journal)).byteLength > 2 * 1024 * 1024) {
    const oldest = next.journal.find((event) => event.before !== null)
    if (!oldest) break
    oldest.before = null
  }
  return next
}
