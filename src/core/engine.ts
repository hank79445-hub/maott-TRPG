import { withEvaluation, memoEvaluation, evaluationIdentity, copyEvaluationValue } from './evaluation'
import {choiceFeedback} from './choice-feedback'
import { ABILITIES, SKILLS, ABILITY_NAMES } from './types'
import { initialEquipment, requiresTwoHands } from './weapon-rules'
import type {
  Ability,
  Build,
  Character,
  Choice,
  ChoiceOption,
  InventoryItem,
  Issue,
  Pack,
  Spell,
} from './types'
import { CRAFTING_TABLE } from '../content/phb-origins'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { SRD_SUBCLASSES, prerequisiteIssues } from './rule-options'
import {
  partialCaster,
  spellListClass,
  classCastingAbility,
  hasFeat,
  featAbility,
  featSpellGifts,
  beforeFeatBoost,
} from './advanced-rules'
import { MANEUVERS } from './phb-powers'
import { srd, LANGUAGES, STANDARD_LANGUAGES, DRAGON_ANCESTRY } from '../content/srd'
import {
  levelOf,
  pbOf,
  effectiveBuild,
  choicesOf,
  abilityGrowth,
  spellCounts,
  maximumSpellLevel,
  hasInvocation,
  hasStyle,
  hasSubclass,
  alwaysPrepared,
} from './growth-rules'
export const ARRAY = [15, 14, 13, 12, 10, 8]
export const POINT_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}
export const signed = (n: number) => (n >= 0 ? '+' : '') + n
export const modifier = (n: number) => Math.floor((n - 10) / 2)
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))
export function catalogue(packs: Pack[] = [srd]) {
  return memoEvaluation('catalogue', () => JSON.stringify(packs.map(p => p === srd || BUILTIN_PACKS.includes(p) ? [p.id, p.version] : p)), () => catalogueUncached(packs))
}
function catalogueUncached(packs: Pack[]) {
  if (packs.some((p) => p.id === srd.id))
    packs = [
      ...packs,
      ...BUILTIN_PACKS.filter((p) => !packs.some((existing) => existing.id === p.id)),
    ]
  return {
    subclasses: [...SRD_SUBCLASSES, ...packs.flatMap((p) => p.subclasses ?? [])],
    classes: packs.flatMap((p) => p.classes),
    backgrounds: packs.flatMap((p) => p.backgrounds),
    species: packs.flatMap((p) => p.species),
    feats: packs.flatMap((p) => p.feats),
    spells: packs.flatMap((p) => p.spells),
    items: packs.flatMap((p) => p.items),
  }
}
export type Catalogue = ReturnType<typeof catalogue>
export function newCharacter(): Character {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    level: 1,
    id: crypto.randomUUID(),
    revision: 0,
    status: 'draft',
    purpose: 'player',
    packs: BUILTIN_PACKS.map((p) => ({ id: p.id, version: p.version })),
    createdAt: now,
    updatedAt: now,
    inventory: [],
    coins: 0,
    runtime: null,
    build: {
      classId: '',
      backgroundId: '',
      speciesId: '',
      method: 'array',
      scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      boosts: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      rolls: null,
      choices: {},
      classEquipment: 0,
      backgroundEquipment: 0,
      equipmentChoices: {},
      purchases: [],
      equipped: [],
      name: '',
      alignment: '中立',
      appearance: '',
      story: '',
      adjustments: [],
      customItems: [],
    },
  }
}
const opts = (map: Record<string, string>): ChoiceOption[] =>
  Object.entries(map).map(([id, name]) => ({ id, name }))
export const selected = (b: Build, key: string) => choicesOf(b)[key] || []
export const one = (b: Build, key: string) => selected(b, key)[0] || ''
const skillOptions = () =>
  opts(Object.fromEntries(Object.entries(SKILLS).map(([k, v]) => [k, v.name])))
export const acquiredFeatIds = (b: Build, c: Catalogue): string[] =>
  [
    c.backgrounds.find((x) => x.id === b.backgroundId)?.feat || '',
    ...(b.speciesId === 'human' ? selected(b, 'human-feat') : []),
    ...(levelOf(b) >= 4 ? selected(b, 'growth-feat') : []),
    ...selected(b, 'invocation')
      .filter((i) => i.startsWith('lessons:'))
      .map((i) => i.slice(8)),
  ].filter(Boolean)
export const featIds = (b: Build, c: Catalogue): string[] =>
  acquiredFeatIds(b, c).map((id) => c.feats.find((f) => f.id === id)?.mechanic ?? id)
export function proficiencies(b: Build, c: Catalogue) {
  const bg = c.backgrounds.find((x) => x.id === b.backgroundId)
  const skills = new Set(bg?.skills || [])
  for (const key of [
    'class-skills',
    'human-skill',
    'elf-skill',
    'skilled-background',
    'skilled-human',
    'skilled-growth',
    'primal-skill',
    'lore-skills',
    'battle-skill',
    'fey-skill',
    'feat-skill',
  ])
    for (const id of selected(b, key)) if (SKILLS[id]) skills.add(id)
  const tools = new Set<string>()
  if (bg?.tool && !['gaming', 'artisan', 'instrument'].includes(bg.tool)) tools.add(bg.tool)
  for (const key of [
    'background-tool',
    'gaming-tool',
    'bard-tools',
    'monk-tool',
    'battle-tool',
    'skilled-background',
    'skilled-human',
    'skilled-growth',
  ])
    for (const id of selected(b, key))
      if (c.items.some((i) => i.id === id && i.kind === 'tool')) tools.add(id)
  if (b.classId === 'druid') tools.add('herbalism-kit')
  if (b.classId === 'rogue') tools.add('thieves-tools')
  for (const [key, ids] of Object.entries(b.choices))
    if (
      key.startsWith('skilled-lesson-') ||
      key.startsWith('crafter-') ||
      key.startsWith('musician-')
    )
      for (const id of ids) {
        if (SKILLS[id]) skills.add(id)
        else if (c.items.some((i) => i.id === id && i.kind === 'tool')) tools.add(id)
      }
  if (hasSubclass(b, 'mercy')) {
    skills.add('insight')
    skills.add('medicine')
    tools.add('herbalism-kit')
  }
  if (hasSubclass(b, 'assassin')) {
    tools.add('disguise-kit')
    tools.add('poisoner-kit')
  }
  if (hasFeat(b, 'chef', c)) tools.add('cook')
  if (hasFeat(b, 'poisoner', c)) tools.add('poisoner-kit')
  const expertise = new Set([
    ...selected(b, 'expertise'),
    ...selected(b, 'growth-expertise'),
    ...selected(b, 'feat-expertise'),
  ])
  for (const key of ['feat-keen', 'feat-observant'])
    for (const id of selected(b, key)) {
      if (skills.has(id)) expertise.add(id)
      else skills.add(id)
    }
  return {
    skills: [...skills],
    tools: [...tools],
    expertise: [...expertise],
  }
}
export function trainings(b: Build, c: Catalogue) {
  return memoEvaluation('trainings', () => evaluationIdentity(c) + ':' + JSON.stringify(b), () => trainingsUncached(b,c), v => ({armor:[...v.armor],weapons:[...v.weapons]}))
}
function trainingsUncached(b: Build, c: Catalogue) {
  const cl = c.classes.find((x) => x.id === b.classId)
  const armor = [...(cl?.armor || [])],
    weapons = [...(cl?.weapons || [])]
  if (b.classId === 'cleric' && one(b, 'order') === 'protector') {
    armor.push('heavy')
    weapons.push('martial')
  }
  if (b.classId === 'druid' && one(b, 'order') === 'warden') {
    armor.push('medium')
    weapons.push('martial')
  }
  if (hasSubclass(b, 'valor')) {
    armor.push('medium', 'shield')
    weapons.push('martial')
  }
  if (hasFeat(b, 'lightly-armored', c)) armor.push('light', 'shield')
  if (hasFeat(b, 'moderately-armored', c)) armor.push('medium')
  if (hasFeat(b, 'heavily-armored', c)) armor.push('heavy')
  if (hasFeat(b, 'martial-weapon-training', c)) weapons.push('martial')
  if (featIds(b, c).includes('tavern-brawler')) weapons.push('improvised')
  return { armor: [...new Set(armor)], weapons: [...new Set(weapons)] }
}
export function weaponProficient(b: Build, c: Catalogue, itemId: string) {
  const item = [...c.items, ...b.customItems].find((x) => x.id === itemId)
  if (item?.kind !== 'weapon') return false
  const { weapons } = trainings(b, c)
  return (
    (featIds(b, c).includes('tavern-brawler') &&
      (item.category?.startsWith('improvised') || item.properties?.includes('improvised'))) ||
    weapons.some((w) => item.category?.startsWith(w)) ||
    (weapons.includes('martial-light') && item.properties?.includes('light')) ||
    (weapons.includes('martial-finesse-light') &&
      item.properties?.some((x) => x === 'light' || x === 'finesse')) ||
    (hasInvocation(b, 'blade') && one(b, 'pact-weapon') === itemId)
  )
}
export function getChoices(b: Build, c: Catalogue): Choice[] {
  return memoEvaluation('getChoices', () => evaluationIdentity(c) + ':' + JSON.stringify(b), () => getChoicesUncached(b,c), copyEvaluationValue)
}
function getChoicesUncached(b: Build, c: Catalogue): Choice[] {
  b = effectiveBuild(b)
  const l = levelOf(b),
    counts = spellCounts(b),
    cap = maximumSpellLevel(b)
  const cl = c.classes.find((x) => x.id === b.classId),
    bg = c.backgrounds.find((x) => x.id === b.backgroundId),
    sp = c.species.find((x) => x.id === b.speciesId)
  const result: Choice[] = []
  const add = (
    id: string,
    label: string,
    count: number,
    options: ChoiceOption[],
    source: string,
    step = 3,
    extra: Partial<Choice> = {},
  ) => result.push({ id, label, count, options, source, step, ...extra })
  const namedItems = (ids: string[]) =>
    c.items
      .filter((x) => ids.includes(x.id))
      .map((x) => ({ id: x.id, name: x.name, detail: x.english }))
  const spellOptions = (level: number, list?: string, exclude: string[] = []) =>
    c.spells
      .filter(
        (x) =>
          (level < 0 ? x.level > 0 && x.level <= -level : x.level === level) &&
          (!list || x.lists.includes(list)) &&
          !exclude.includes(x.id),
      )
      .map((x) => ({
        id: x.id,
        name: x.name,
        detail:
          x.english +
          ' · ' +
          x.school +
          (x.ritual ? ' · 仪式' : '') +
          (x.concentration ? ' · 专注' : ''),
      }))
  const spellChoice = (
    id: string,
    label: string,
    count: number,
    level: number,
    list: string | undefined,
    source: string,
    ability: Ability | undefined,
    usage: string,
    exclude: string[] = [],
  ) =>
    add(id, label, count, spellOptions(level, list, exclude), source, 3, {
      kind: 'spell',
      ability,
      usage,
    })
  if (sp) {
    if (sp.sizes.length > 1)
      add(
        'size',
        '体型',
        1,
        opts(Object.fromEntries(sp.sizes.map((s) => [s, s === 'small' ? '小型' : '中型']))),
        sp.name,
        1,
      )
    if (sp.id === 'dragonborn') add('ancestry', '龙族祖先', 1, opts(DRAGON_ANCESTRY), sp.name, 1)
    if (sp.id === 'elf')
      add(
        'lineage',
        '精灵传承',
        1,
        opts({
          drow: '卓尔 · 舞光术／120尺黑暗视觉',
          high: '高等 · 可选法师戏法／60尺黑暗视觉',
          wood: '木精灵 · 德鲁伊伎俩／35尺速度',
        }),
        sp.name,
        1,
      )
    if (sp.id === 'gnome')
      add(
        'lineage',
        '侏儒传承',
        1,
        opts({ forest: '森林 · 次级幻影与动物交谈', rock: '岩侏儒 · 修复术与魔法伎俩' }),
        sp.name,
        1,
      )
    if (sp.id === 'tiefling')
      add(
        'lineage',
        '邪魔遗产',
        1,
        opts({
          abyssal: '深渊 · 毒素抗性／毒气喷溅',
          chthonic: '冥界 · 黯蚀抗性／寒冷之触',
          infernal: '炼狱 · 火焰抗性／火焰箭',
        }),
        sp.name,
        1,
      )
    if (sp.id === 'goliath')
      add(
        'ancestry',
        '巨人祖先',
        1,
        opts({
          cloud: '云巨人 · 附赠动作传送30尺',
          fire: '火巨人 · 命中额外1d10火焰',
          frost: '霜巨人 · 命中额外1d6寒冷／减速10尺',
          hill: '丘巨人 · 命中大型或更小目标时击倒',
          stone: '石巨人 · 反应减伤1d12+体质',
          storm: '风暴巨人 · 反应对60尺内攻击者造成1d8闪电',
        }),
        sp.name,
        1,
      )
    if (['elf', 'gnome', 'tiefling'].includes(sp.id))
      add(
        'species-ability',
        '传承施法属性',
        1,
        opts({ int: '智力', wis: '感知', cha: '魅力' }),
        sp.name,
        1,
      )
  }
  add(
    'languages',
    '额外标准语言',
    2,
    opts(Object.fromEntries(STANDARD_LANGUAGES.map((l) => [l, LANGUAGES[l]!]))),
    '角色出身 · 通用语已获得',
    1,
  )
  if (cl?.id === 'rogue')
    add(
      'rogue-language',
      '额外语言',
      1,
      opts(
        Object.fromEntries(
          Object.entries(LANGUAGES).filter(
            ([id]) =>
              id !== 'common' && id !== 'thievesCant' && !selected(b, 'languages').includes(id),
          ),
        ),
      ),
      '盗贼黑话',
      1,
    )
  if (cl && bg)
    add(
      'class-skills',
      '职业技能熟练',
      cl.skillCount,
      skillOptions().filter((x) => cl.skills.includes(x.id) && !bg.skills.includes(x.id)),
      cl.name,
    )
  const known = new Set(bg?.skills || [])
  selected(b, 'class-skills').forEach((s) => known.add(s))
  if (sp?.id === 'elf') {
    add(
      'elf-skill',
      '敏锐感官',
      1,
      skillOptions().filter(
        (x) => ['insight', 'perception', 'survival'].includes(x.id) && !known.has(x.id),
      ),
      sp.name,
    )
    selected(b, 'elf-skill').forEach((s) => known.add(s))
  }
  if (sp?.id === 'human') {
    add(
      'human-skill',
      '人类额外技能',
      1,
      skillOptions().filter((x) => !known.has(x.id)),
      sp.name,
    )
    selected(b, 'human-skill').forEach((s) => known.add(s))
    const fs = featIds(b, c)
    const options = c.feats
      .filter(
        (f) =>
          f.category === 'origin' &&
          f.minLevel <= 1 &&
          !prerequisiteIssues(b, f, [{ classes: c.classes }]).length &&
          (f.repeatable || !fs.slice(0, 1).includes(f.mechanic ?? f.id)),
      )
      .map((f) => ({ id: f.id, name: f.name, detail: f.summary }))
    add('human-feat', '人类起源专长', 1, options, sp.name)
  }
  if (bg && ['artisan', 'instrument'].includes(bg.tool))
    add(
      'background-tool',
      '背景工具熟练',
      1,
      namedItems(c.items.filter((i) => i.category === bg.tool).map((i) => i.id)),
      bg.name,
    )
  if (bg?.tool === 'gaming')
    add(
      'gaming-tool',
      '背景游戏套组熟练',
      1,
      namedItems(c.items.filter((x) => x.category === 'gaming').map((x) => x.id)),
      bg.name,
    )
  if (cl?.id === 'bard')
    add(
      'bard-tools',
      '乐器熟练',
      3,
      namedItems(c.items.filter((x) => x.category === 'instrument').map((x) => x.id)),
      cl.name,
    )
  if (cl?.id === 'monk')
    add(
      'monk-tool',
      '工具熟练',
      1,
      namedItems(
        c.items
          .filter((x) => ['artisan', 'instrument'].includes(x.category || ''))
          .map((x) => x.id),
      ),
      cl.name,
    )
  for (const key of ['primal-skill', 'lore-skills']) selected(b, key).forEach((id) => known.add(id))
  const knownTools = new Set(
    proficiencies(
      {
        ...b,
        choices: Object.fromEntries(
          Object.entries(b.choices).map(([key, v]) => [key, key.startsWith('skilled-') ? [] : v]),
        ),
      },
      c,
    ).tools,
  )
  for (const [source, feat] of [
    ['background', bg?.feat],
    ['human', sp?.id === 'human' ? one(b, 'human-feat') : ''],
    ['growth', l >= 4 ? one(b, 'growth-feat') : ''],
    ...selected(b, 'invocation')
      .filter((i) => i.startsWith('lessons:'))
      .map((i) => ['lesson-' + i.slice(8), i.slice(8)]),
  ]) {
    if ((c.feats.find((f) => f.id === feat)?.mechanic ?? feat) === 'skilled') {
      const options = [
        ...skillOptions(),
        ...namedItems(c.items.filter((x) => x.kind === 'tool').map((x) => x.id)),
      ].filter((x) => !known.has(x.id) && !knownTools.has(x.id))
      add(
        'skilled-' + source,
        '熟习 · 3 项技能或工具',
        3,
        options,
        source === 'background' ? bg!.name : '起源专长 · ' + source,
      )
      selected(b, 'skilled-' + source).forEach((id) =>
        SKILLS[id] ? known.add(id) : knownTools.add(id),
      )
    }
  }
  if (cl?.id === 'rogue')
    add(
      'expertise',
      '技能专精',
      2,
      skillOptions().filter((x) => known.has(x.id)),
      cl.name,
    )
  if (cl?.id === 'cleric')
    add(
      'order',
      '神圣职责',
      1,
      opts({
        protector: '守护者 · 军用武器与重甲',
        thaumaturge: '奇术师 · 额外戏法／知识检定加值',
      }),
      cl.name,
    )
  if (cl?.id === 'druid')
    add(
      'order',
      '原初职责',
      1,
      opts({ warden: '守望者 · 军用武器与中甲', magician: '术者 · 额外戏法／知识检定加值' }),
      cl.name,
    )
  const featSources: [string, string][] = [
    ['background', bg?.feat ?? ''],
    ['human', one(b, 'human-feat')],
    ['growth', one(b, 'growth-feat')],
    ...selected(b, 'invocation')
      .filter((i) => i.startsWith('lessons:'))
      .map((i) => ['lesson-' + i.slice(8), i.slice(8)] as [string, string]),
  ]
  for (const [src, id] of featSources) {
    const mechanic = c.feats.find((f) => f.id === id)?.mechanic ?? id
    if (mechanic === 'crafter')
      add(
        'crafter-' + src,
        '巧匠 · 3 种快速制作工具',
        3,
        namedItems(
          Object.keys(CRAFTING_TABLE).filter(
            (id) =>
              !proficiencies(
                {
                  ...b,
                  choices: Object.fromEntries(
                    Object.entries(b.choices).map(([k, v]) => [
                      k,
                      k.startsWith('crafter-') || k.startsWith('musician-') ? [] : v,
                    ]),
                  ),
                },
                c,
              ).tools.includes(id),
          ),
        ),
        src === 'background' ? bg!.name : '巧匠',
      )
    if (mechanic === 'musician')
      add(
        'musician-' + src,
        '音乐家 · 3 种乐器',
        3,
        namedItems(
          c.items
            .filter((i) => i.category === 'instrument')
            .map((i) => i.id)
            .filter(
              (id) =>
                !proficiencies(
                  {
                    ...b,
                    choices: Object.fromEntries(
                      Object.entries(b.choices).map(([k, v]) => [
                        k,
                        k.startsWith('crafter-') || k.startsWith('musician-') ? [] : v,
                      ]),
                    ),
                  },
                  c,
                ).tools.includes(id),
            ),
        ),
        src === 'background' ? bg!.name : '音乐家',
      )
  }
  if (cl?.id === 'fighter' || (l >= 2 && ['paladin', 'ranger'].includes(cl?.id ?? '')))
    add(
      'style',
      '战斗风格',
      1,
      [
        ...c.feats
          .filter(
            (f) =>
              f.category === 'style' &&
              !prerequisiteIssues(beforeFeatBoost(b), f, [{ classes: c.classes }]).length,
          )
          .map((f) => ({ id: f.id, name: f.name, detail: f.summary })),
        ...(cl?.id === 'paladin'
          ? [{ id: 'blessed-warrior', name: '祝福勇士 · 两个牧师戏法' }]
          : cl?.id === 'ranger'
            ? [{ id: 'druidic-warrior', name: '德鲁伊勇士 · 两个德鲁伊戏法' }]
            : []),
      ],
      cl!.name,
    )
  if (one(b, 'style') === 'blessed-warrior' || one(b, 'style') === 'druidic-warrior')
    spellChoice(
      'warrior-cantrips',
      '勇士戏法',
      2,
      0,
      cl!.id === 'paladin' ? 'cleric' : 'druid',
      cl!.name,
      cl!.id === 'paladin' ? 'cha' : 'wis',
      '随意施放',
    )
  if (cl?.masteryCount)
    add(
      'mastery',
      '武器精通',
      counts.mastery,
      c.items
        .filter(
          (i) =>
            i.kind === 'weapon' &&
            weaponProficient(b, c, i.id) &&
            (cl.id !== 'rogue' || i.properties?.some((p) => p === 'light' || p === 'finesse')) &&
            !['arcane-staff', 'druid-staff'].includes(i.id),
        )
        .map((x) => ({ id: x.id, name: x.name, detail: x.mastery })),
      cl.name,
    )
  if (cl?.id === 'warlock') {
    add(
      'invocation',
      '魔能祈唤',
      counts.invocations,
      opts({
        shadows: '幽影护甲 · 对自身随意施放法师护甲',
        mind: '魔能心智 · 维持专注的体质豁免具有优势',
        blade: '刃之契约 · 契约近战武器可用魅力',
        chain: '链之契约 · 寻获魔宠／特殊形态',
        tome: '书之契约 · 3 戏法与 2 一级仪式法术',
      })
        .concat(
          l >= 2
            ? opts({
                'devil-sight': '魔鬼视界 · 120 尺魔法与非魔法黑暗视觉',
                vigor: '邪魔活力 · False Life 满骰',
                mask: '千面假象 · Disguise Self',
                visions: '迷幻幻象 · Silent Image',
                leap: '异界跳跃 · Jump',
              })
            : [],
        )
        .concat(
          l >= 5
            ? opts({
                'ascendant-step': '星移步法 · 随意对自己施放浮空术',
                gaze: '双心凝视',
                depths: '深海馈赠 · Water Breathing',
                forms: '万形之主 · Alter Self',
                one_shadows: '融于幽影 · Invisibility',
                ...(hasInvocation(b, 'chain') ? { investment: '链主投资' } : {}),
                ...(hasInvocation(b, 'blade')
                  ? { thirsting: '渴饮之刃', eldritch_smite: '魔能惩击' }
                  : {}),
              })
            : [],
        )
        .concat(
          l >= 2
            ? [
                ...new Set([
                  ...selected(b, 'class-cantrips'),
                  ...(hasInvocation(b, 'tome') ? selected(b, 'tome-cantrips') : []),
                ]),
              ]
                .filter((id) =>
                  [
                    'acid-splash',
                    'chill-touch',
                    'eldritch-blast',
                    'fire-bolt',
                    'poison-spray',
                    'produce-flame',
                    'ray-of-frost',
                    'sacred-flame',
                    'shocking-grasp',
                    'sorcerous-burst',
                    'starry-wisp',
                    'thorn-whip',
                    'thunderclap',
                    'true-strike',
                    'vicious-mockery',
                    'word-of-radiance',
                  ].includes(id),
                )
                .flatMap((id) => [
                  {
                    id: 'agonizing:' + id,
                    name: '痛苦魔能 · ' + (c.spells.find((s) => s.id === id)?.name ?? id),
                  },
                  ...(Number(
                    c.spells.find((s) => s.id === id)?.range.match(/^(\d+) feet/)?.[1] ?? 0,
                  ) >= 10
                    ? [{ id: 'spear:' + id, name: '魔能之矛 · ' + id }]
                    : []),
                  ...([
                    'chill-touch',
                    'eldritch-blast',
                    'poison-spray',
                    'fire-bolt',
                    'produce-flame',
                    'ray-of-frost',
                    'shocking-grasp',
                    'sorcerous-burst',
                    'starry-wisp',
                    'thorn-whip',
                    'true-strike',
                  ].includes(id)
                    ? [{ id: 'repelling:' + id, name: '斥力魔能 · ' + id }]
                    : []),
                ])
            : [],
        )
        .concat(
          l >= 2
            ? [
                ...c.feats
                  .filter((f) => f.category === 'origin' && f.id !== 'magic-initiate')
                  .map((f) => ({ id: 'lessons:' + f.id, name: '先人教诲 · ' + f.name })),
                ...['cleric', 'druid', 'wizard'].map((id) => ({
                  id: 'lessons:magic-initiate-' + id,
                  name: '先人教诲 · 魔法学徒 ' + id,
                })),
              ]
            : [],
        ),
      cl.name,
    )
    if (hasInvocation(b, 'blade'))
      add(
        'pact-weapon',
        '契约武器形式',
        1,
        c.items
          .filter(
            (x) =>
              x.kind === 'weapon' &&
              x.category?.endsWith('melee') &&
              !['arcane-staff', 'druid-staff'].includes(x.id),
          )
          .map((x) => ({ id: x.id, name: x.name, detail: x.damage + ' ' + x.damageType })),
        '刃之契约',
      )
  }
  const bonus = one(b, 'order') === 'thaumaturge' || one(b, 'order') === 'magician' ? 1 : 0
  if (cl?.cantrips || partialCaster(b))
    spellChoice(
      'class-cantrips',
      '职业戏法',
      counts.cantrips,
      0,
      spellListClass(b),
      cl!.name,
      classCastingAbility(b, c.classes),
      '随意施放',
    )
  if (cl?.spellbook)
    spellChoice(
      'spellbook',
      l === 1 ? '法术书 · 一级法术' : '法术书记录',
      counts.book,
      -cap,
      cl.id,
      cl.name,
      cl.spellAbility,
      '法术书记录；仪式法术可不准备施放',
    )
  if (cl && (cl.prepared || partialCaster(b))) {
    const excluded =
      cl.id === 'ranger' ? ['hunter-s-mark'] : cl.id === 'druid' ? ['speak-with-animals'] : []
    const options = spellOptions(-cap, spellListClass(b), [
      ...excluded,
      ...alwaysPrepared(b, c.subclasses).map((s) => s.id),
    ]).filter((x) => !cl.spellbook || selected(b, 'spellbook').includes(x.id))
    add('class-spells', '职业准备法术', counts.prepared, options, cl.name, 3, {
      kind: 'spell',
      ability: classCastingAbility(b, c.classes),
      usage: cl.id === 'warlock' ? '消耗契约法术位' : '消耗法术位',
    })
  }
  for (const [src, feat] of [
    ['background', bg?.feat],
    ['human', sp?.id === 'human' ? one(b, 'human-feat') : ''],
    ['growth', l >= 4 ? one(b, 'growth-feat') : ''],
    ...selected(b, 'invocation')
      .filter((i) => i.startsWith('lessons:'))
      .map((i) => ['lesson-' + i.slice(8), i.slice(8)]),
  ]) {
    const mechanic = c.feats.find((f) => f.id === feat)?.mechanic ?? feat
    if (!mechanic?.startsWith('magic-initiate')) continue
    let list =
      mechanic === 'magic-initiate'
        ? one(b, 'mi-' + src + '-list')
        : mechanic.replace('magic-initiate-', '')
    if (mechanic === 'magic-initiate')
      add(
        'mi-' + src + '-list',
        '魔法学徒 · 法术列表',
        1,
        opts(
          Object.fromEntries(
            ['cleric', 'druid', 'wizard']
              .filter((x) => !bg?.feat.endsWith('-' + x))
              .map((x) => [x, c.classes.find((c) => c.id === x)!.name]),
          ),
        ),
        '人类 · 魔法学徒',
      )
    add(
      'mi-' + src + '-ability',
      '魔法学徒 · 施法属性',
      1,
      opts({ int: '智力', wis: '感知', cha: '魅力' }),
      src === 'background' ? bg!.name : '魔法学徒 · ' + src,
    )
    if (list) {
      spellChoice(
        'mi-' + src + '-cantrips',
        '魔法学徒 · 戏法',
        2,
        0,
        list,
        src === 'background' ? bg!.name : '魔法学徒 · ' + src,
        (one(b, 'mi-' + src + '-ability') as Ability) || undefined,
        '随意施放',
      )
      spellChoice(
        'mi-' + src + '-spell',
        '魔法学徒 · 一级法术',
        1,
        1,
        list,
        src === 'background' ? bg!.name : '魔法学徒 · ' + src,
        (one(b, 'mi-' + src + '-ability') as Ability) || undefined,
        '始终准备；1 次免法术位／长休，也可用法术位',
      )
    }
  }
  if (sp?.id === 'elf' && one(b, 'lineage') === 'high')
    spellChoice(
      'high-cantrip',
      '高等精灵 · 法师戏法',
      1,
      0,
      'wizard',
      '精灵传承',
      (one(b, 'species-ability') as Ability) || undefined,
      '随意施放；长休可更换',
    )
  if (cl?.id === 'warlock' && hasInvocation(b, 'tome')) {
    const prepared = [
      ...selected(b, 'class-cantrips'),
      ...selected(b, 'class-spells'),
      ...selected(b, 'mi-background-cantrips'),
      ...selected(b, 'mi-background-spell'),
      ...selected(b, 'mi-human-cantrips'),
      ...selected(b, 'mi-human-spell'),
      ...selected(b, 'high-cantrip'),
      ...racialSpells(b).map((x) => x.id),
    ]
    spellChoice(
      'tome-cantrips',
      '影之书 · 戏法',
      3,
      0,
      undefined,
      '书之契约',
      'cha',
      '书在身上时可用',
      prepared,
    )
    add(
      'tome-rituals',
      '影之书 · 一级仪式法术',
      2,
      spellOptions(1, undefined, prepared).filter(
        (o) => c.spells.find((s) => s.id === o.id)?.ritual,
      ),
      '书之契约',
      3,
      { kind: 'spell', ability: 'cha', usage: '书在身上时准备；可仪式施放或消耗契约法术位' },
    )
  }
  if (l >= 3 && cl)
    add(
      'subclass',
      '子职业',
      1,
      c.subclasses
        .filter((s) => s.classId === cl.id && s.minLevel <= l)
        .map((s) => ({
          id: s.id,
          name: s.name,
          detail:
            s.source.pack +
            ' · ' +
            s.source.page +
            (s.source.pack !== 'srd-5.2.1' ? ' · 自定义特性由 GM 裁定' : ''),
        })),
      cl.name,
    )
  if (l >= 2 && ['bard', 'ranger', 'wizard'].includes(cl?.id ?? ''))
    add(
      'growth-expertise',
      '成长专精',
      cl!.id === 'bard' ? 2 : 1,
      skillOptions().filter(
        (s) =>
          proficiencies(
            { ...b, growth: [], choices: { ...b.choices, 'growth-expertise': [] } },
            c,
          ).skills.includes(s.id) &&
          (cl!.id !== 'wizard' ||
            ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'].includes(
              s.id,
            )),
      ),
      cl!.name,
    )
  if (l >= 2 && cl?.id === 'ranger')
    add(
      'deft-languages',
      '熟练探索者 · 额外语言',
      2,
      opts(LANGUAGES).filter(
        (x) => !['common', 'thievesCant', 'druidic', ...selected(b, 'languages')].includes(x.id),
      ),
      cl.name,
    )
  if (l >= 3 && cl?.id === 'barbarian')
    add(
      'primal-skill',
      '原初知识 · 技能',
      1,
      skillOptions().filter(
        (x) =>
          cl.skills.includes(x.id) &&
          !proficiencies(
            { ...b, growth: [], choices: { ...b.choices, 'primal-skill': [] } },
            c,
          ).skills.includes(x.id),
      ),
      cl.name,
    )
  if (hasSubclass(b, 'lore'))
    add(
      'lore-skills',
      '逸闻学院 · 技能',
      3,
      skillOptions().filter(
        (x) =>
          !proficiencies(
            { ...b, growth: [], choices: { ...b.choices, 'lore-skills': [] } },
            c,
          ).skills.includes(x.id),
      ),
      cl!.name,
    )
  if (hasSubclass(b, 'land'))
    add(
      'land',
      '大地结社 · 土地',
      1,
      opts({ arid: '干旱', polar: '极地', temperate: '温带', tropical: '热带' }),
      cl!.name,
    )
  if (l >= 2 && cl?.id === 'sorcerer')
    add(
      'metamagic',
      '超魔法',
      2,
      opts({
        careful: '谨慎法术',
        distant: '远距法术',
        empowered: '强效法术',
        extended: '延时法术',
        heightened: '升阶法术',
        quickened: '瞬发法术',
        seeking: '追踪法术',
        subtle: '精妙法术',
        transmuted: '转化法术',
        twinned: '孪生法术',
      }),
      cl.name,
    )
  if (hasSubclass(b, 'hunter'))
    add(
      'hunter-choice',
      '猎人猎物',
      1,
      opts({ colossus: '巨像杀手', horde: '群敌破坏者' }),
      cl!.name,
    )
  if (l >= 4 && cl)
    add(
      'growth-feat',
      '四级专长',
      1,
      [
        { id: 'ability-score-improvement', name: '属性提升 · 共 2 点，最高 20' },
        { id: 'grappler', name: '擒抱者 · 力量或敏捷 +1（须力量或敏捷 13）' },
        ...c.feats
          .filter(
            (f) =>
              f.category === 'general' &&
              !['ability-score-improvement', 'grappler'].includes(f.id) &&
              !prerequisiteIssues(b, f, [{ classes: c.classes }]).length,
          )
          .map((f) => ({
            id: f.id,
            name: f.name,
            detail: f.summary + ' · ' + f.source.pack,
          })),
        ...c.feats
          .filter(
            (f) =>
              f.category === 'origin' &&
              f.id !== 'magic-initiate' &&
              !prerequisiteIssues(b, f, [{ classes: c.classes }]).length &&
              (f.repeatable ||
                !featIds({ ...b, choices: { ...b.choices, 'growth-feat': [] } }, c).includes(
                  f.mechanic ?? f.id,
                )),
          )
          .map((f) => ({ id: f.id, name: f.name, detail: f.summary })),
        { id: 'magic-initiate', name: '魔法学徒 · 不同列表可重复' },
        ...(['fighter', 'paladin', 'ranger'].includes(cl.id)
          ? c.feats
              .filter(
                (f) =>
                  f.category === 'style' &&
                  !prerequisiteIssues(b, f, [{ classes: c.classes }]).length &&
                  f.id !== one(b, 'style'),
              )
              .map((f) => ({ id: f.id, name: f.name, detail: f.summary }))
          : []),
      ],
      cl.name,
    )
  const featOptions = (ids: string[]) => skillOptions().filter((s) => ids.includes(s.id))
  const baseSkills = (keys: string[]) =>
    proficiencies(
      { ...b, choices: { ...b.choices, ...Object.fromEntries(keys.map((k) => [k, []])) } },
      c,
    )
  if (hasSubclass(b, 'battle-master')) {
    add(
      'maneuvers',
      '战斗大师 · 三项战技',
      3,
      MANEUVERS.map((m) => ({ id: m.id, name: m.name, detail: m.detail })),
      '战斗大师',
    )
    add('maneuver-ability', '战技豁免属性', 1, opts({ str: '力量', dex: '敏捷' }), '战斗大师')
    add(
      'battle-tool',
      '战争学徒 · 工匠工具',
      1,
      c.items
        .filter((i) => i.kind === 'tool' && i.category === 'artisan')
        .map((i) => ({ id: i.id, name: i.name })),
      '战斗大师',
    )
    add(
      'battle-skill',
      '战争学徒 · 技能',
      1,
      skillOptions().filter(
        (s) => cl!.skills.includes(s.id) && !baseSkills(['battle-skill']).skills.includes(s.id),
      ),
      '战斗大师',
    )
  }
  if (hasSubclass(b, 'fey-wanderer'))
    add(
      'fey-skill',
      '妖冶娴都 · 技能',
      1,
      featOptions(['deception', 'performance', 'persuasion']).filter(
        (s) => !baseSkills(['fey-skill']).skills.includes(s.id),
      ),
      '妖精漫游者',
    )
  if (
    hasSubclass(b, 'illusionist') &&
    (b.growth?.find((g) => g.level === 3)?.choices['class-cantrips']?.includes('minor-illusion') ??
      selected(b, 'class-cantrips').includes('minor-illusion'))
  )
    spellChoice(
      'illusion-cantrip',
      '强化幻术 · 补充戏法',
      1,
      0,
      'wizard',
      '幻术师',
      'int',
      '随意施放',
      [...selected(b, 'class-cantrips'), 'minor-illusion'],
    )
  if (hasFeat(b, 'elemental-adept', c))
    add(
      'feat-element',
      '元素掌控 · 类型',
      1,
      opts({ acid: '强酸', cold: '寒冷', fire: '火焰', lightning: '闪电', thunder: '雷鸣' }),
      '元素掌控',
    )
  for (const [id, school] of [
    ['fey', ['Divination', 'Enchantment']],
    ['shadow', ['Illusion', 'Necromancy']],
  ] as const)
    if (hasFeat(b, id + '-touched', c)) {
      const options = spellOptions(1).filter((o) =>
        school.includes(c.spells.find((s) => s.id === o.id)!.school as never),
      )
      add('feat-' + id + '-spell', '触碰专长 · 一环法术', 1, options, id + '-touched', 3, {
        kind: 'spell',
        ability: featAbility(b, c),
        usage: '始终准备；每长休一次免费，也可用法术位',
      })
    }
  if (hasFeat(b, 'ritual-caster', c))
    add(
      'feat-ritual-spells',
      '仪式施法者 · 一环仪式',
      pbOf(b),
      spellOptions(1).filter((o) => c.spells.find((s) => s.id === o.id)!.ritual),
      '仪式施法者',
      3,
      { kind: 'spell', ability: featAbility(b, c), usage: '仪式；法术位；每长休一次快速仪式' },
    )
  if (hasFeat(b, 'keen-mind', c))
    add(
      'feat-keen',
      '敏锐心灵 · 技能',
      1,
      featOptions(['arcana', 'history', 'investigation', 'nature', 'religion']),
      '敏锐心灵',
    )
  if (hasFeat(b, 'observant', c))
    add(
      'feat-observant',
      '观察力 · 技能',
      1,
      featOptions(['insight', 'investigation', 'perception']),
      '观察力',
    )
  if (hasFeat(b, 'skill-expert', c)) {
    add(
      'feat-skill',
      '技艺专家 · 技能熟练',
      1,
      skillOptions().filter(
        (s) => !baseSkills(['feat-skill', 'feat-expertise']).skills.includes(s.id),
      ),
      '技艺专家',
    )
    const prof = baseSkills(['feat-expertise'])
    add(
      'feat-expertise',
      '技艺专家 · 专精',
      1,
      skillOptions().filter((s) => prof.skills.includes(s.id) && !prof.expertise.includes(s.id)),
      '技艺专家',
    )
  }
  if (hasFeat(b, 'weapon-master', c))
    add(
      'feat-mastery',
      '武器大师 · 精通武器',
      1,
      c.items
        .filter((i) => i.kind === 'weapon' && i.mastery && weaponProficient(b, c, i.id))
        .map((i) => ({ id: i.id, name: i.name })),
      '武器大师',
    )
  return result
}
export function reconcile(b: Build, c: Catalogue) {
  const removed: string[] = []
  for (let pass = 0; pass < 4; pass++) {
    const nodes = getChoices(b, c),
      ids = new Set(nodes.map((x) => x.id))
    for (const key of Object.keys(b.choices))
      if (!ids.has(key)) {
        removed.push(key)
        delete b.choices[key]
      }
    for (const node of nodes) {
      const allowed = new Set(node.options.map((x) => x.id)),
        old = selected(b, node.id)
      const valid = [...new Set(old)].filter((x) => allowed.has(x)).slice(0, node.count)
      if (JSON.stringify(old) !== JSON.stringify(valid)) {
        removed.push(node.label)
        b.choices[node.id] = valid
      }
    }
  }
  const bg = c.backgrounds.find((x) => x.id === b.backgroundId)
  for (const a of ABILITIES)
    if (!bg?.abilities.includes(a) && b.boosts[a]) {
      b.boosts[a] = 0
      removed.push(ABILITY_NAMES[a] + '背景提升')
    }
  if (
    selected(b, 'background-tool').length === 1 &&
    bg?.equipment[b.backgroundEquipment]?.choices?.some((n) => n.id === 'background-tool')
  )
    b.equipmentChoices['background-background-tool'] = [...selected(b, 'background-tool')]
  const eqNodes = equipmentChoices(b, c)
  for (const key of Object.keys(b.equipmentChoices)) {
    const node = eqNodes.find((n) => n.id === key)
    const old = b.equipmentChoices[key]!
    const next = node
      ? old.filter((x) => node.options.some((o) => o.id === x)).slice(0, node.count)
      : []
    if (JSON.stringify(old) !== JSON.stringify(next)) {
      removed.push('装备选择')
      if (node) b.equipmentChoices[key] = next
      else delete b.equipmentChoices[key]
    }
  }
  const inventory = startingInventory(b, c).inventory
  b.equipped = b.equipped.filter((k) => inventory.some((i) => i.instanceId === k))
  return [...new Set(removed)]
}
export function equipmentChoices(b: Build, c: Catalogue): Choice[] {
  const cl = c.classes.find((x) => x.id === b.classId),
    bg = c.backgrounds.find((x) => x.id === b.backgroundId)
  return (
    [
      [cl?.equipment[b.classEquipment], 'class', cl?.name],
      [bg?.equipment[b.backgroundEquipment], 'background', bg?.name],
    ] as const
  ).flatMap(([opt, source, name]) =>
    (opt?.choices || []).map((n) => ({
      id: source + '-' + n.id,
      label: n.label,
      source: name || '',
      step: 4,
      count: n.count,
      options: c.items
        .filter(
          (x) =>
            n.options.includes(x.id) &&
            (n.id !== 'background-tool' ||
              source !== 'background' ||
              selected(b, 'background-tool').includes(x.id)),
        )
        .map((x) => ({ id: x.id, name: x.name, detail: x.english })),
    })),
  )
}
export function purchasePrice(b: Build, c: Catalogue, item: import('./types').Item | undefined) {
  return (
    Math.round(
      (item?.cost ?? 0) *
        (featIds(b, c).includes('crafter') &&
        item?.id !== 'healing-potion' &&
        !item?.category?.startsWith('magic') &&
        !item?.id.startsWith('custom/')
          ? 0.8
          : 1) *
        100,
    ) / 100
  )
}
export function startingInventory(b: Build, c: Catalogue, checkInitialHands = true) {
  const inventory: InventoryItem[] = []
  const items = [...c.items, ...b.customItems]
  const errors: string[] = []
  let expansions = 0
  let funds = 0
  const add = (itemId: string, quantity: number, source: string, path: string, depth = 0) => {
    if (
      ++expansions > 10000 ||
      inventory.length >= 5000 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 10000
    ) {
      if (!errors.length) errors.push('初始物品展开超过存档容量限制，请减少数量或修改规则包')
      return
    }
    const item = items.find((x) => x.id === itemId)
    if (!item || depth > 5) {
      if (!errors.length) errors.push('物品引用缺失或装备包嵌套超过 5 层')
      return
    }
    if (item.contents) {
      item.contents.forEach((x, i) =>
        add(x.itemId, x.quantity * quantity, source + ' · ' + item.name, path + '-' + i, depth + 1),
      )
      return
    }
    const count = ['weapon', 'armor', 'shield'].includes(item.kind) ? quantity : 1
    if (inventory.length + count > 5000) {
      if (!errors.length) errors.push('初始物品实例超过 5000 项限制')
      return
    }
    for (let j = 0; j < count; j++) {
      const instanceId = path + '-' + itemId + '-' + j
      inventory.push({
        instanceId,
        itemId,
        quantity: count === 1 ? quantity : 1,
        source,
        equipped: b.equipped.includes(instanceId),
        note: '',
      })
    }
  }
  const cl = c.classes.find((x) => x.id === b.classId),
    bg = c.backgrounds.find((x) => x.id === b.backgroundId)
  for (const [opt, source, name] of [
    [cl?.equipment[b.classEquipment], 'class', cl?.name],
    [bg?.equipment[b.backgroundEquipment], 'background', bg?.name],
  ] as const) {
    if (!opt) continue
    funds += opt.gp
    opt.items.forEach((x, i) => add(x.itemId, x.quantity, name || source, source + '-' + i))
    for (const node of opt.choices || [])
      for (const [i, id] of (node.id === 'background-tool' && source === 'background'
        ? selected(b, 'background-tool')
        : b.equipmentChoices[source + '-' + node.id] || []
      ).entries())
        add(id, 1, name || source, source + '-' + node.id + '-' + i)
  }
  b.purchases.forEach((x, i) => add(x.itemId, x.quantity, '购置', 'purchase-' + i))
  b.customItems.forEach((x, i) => add(x.id, 1, '自定义物品', 'custom-' + i))
  initialEquipment(inventory, items, checkInitialHands ? errors : [])
  const spent = b.purchases.reduce(
    (n, x) =>
      n +
      purchasePrice(
        b,
        c,
        items.find((i) => i.id === x.itemId),
      ) *
        x.quantity,
    0,
  )
  return {
    inventory,
    funds,
    spent,
    errors,
    coins: Math.round((funds - spent) * 100) / 100,
    weight: inventory.reduce(
      (n, x) => n + (items.find((i) => i.id === x.itemId)?.weight || 0) * x.quantity,
      0,
    ),
  }
}
export function racialSpells(b: Build): { id: string; usage: string }[] {
  const ids: string[] = [],
    l = levelOf(b)
  const lineage = one(b, 'lineage')
  if (b.speciesId === 'aasimar') ids.push('light')
  if (b.speciesId === 'elf') {
    if (l >= 3)
      ids.push(
        (
          { drow: 'faerie-fire', high: 'detect-magic', wood: 'longstrider' } as Record<
            string,
            string
          >
        )[lineage]!,
      )
    if (l >= 5)
      ids.push(
        (
          { drow: 'darkness', high: 'misty-step', wood: 'pass-without-trace' } as Record<
            string,
            string
          >
        )[lineage]!,
      )
  }
  if (b.speciesId === 'tiefling') {
    if (l >= 3)
      ids.push(
        (
          {
            abyssal: 'ray-of-sickness',
            chthonic: 'false-life',
            infernal: 'hellish-rebuke',
          } as Record<string, string>
        )[lineage]!,
      )
    if (l >= 5)
      ids.push(
        (
          {
            abyssal: 'hold-person',
            chthonic: 'ray-of-enfeeblement',
            infernal: 'darkness',
          } as Record<string, string>
        )[lineage]!,
      )
  }
  if (b.speciesId === 'elf') {
    if (one(b, 'lineage') === 'drow') ids.push('dancing-lights')
    if (one(b, 'lineage') === 'wood') ids.push('druidcraft')
  }
  if (b.speciesId === 'gnome') {
    if (one(b, 'lineage') === 'forest') ids.push('minor-illusion', 'speak-with-animals')
    if (one(b, 'lineage') === 'rock') ids.push('mending', 'prestidigitation')
  }
  if (b.speciesId === 'tiefling') {
    ids.push('thaumaturgy')
    const spell: Record<string, string> = {
      abyssal: 'poison-spray',
      chthonic: 'chill-touch',
      infernal: 'fire-bolt',
    }
    if (spell[one(b, 'lineage')]) ids.push(spell[one(b, 'lineage')]!)
  }
  return ids.filter(Boolean).map((id) => ({
    id,
    usage:
      id === 'speak-with-animals'
        ? '始终准备；熟练加值次数免法术位／长休，也可用法术位'
        : [
              'light',
              'dancing-lights',
              'druidcraft',
              'minor-illusion',
              'mending',
              'prestidigitation',
              'thaumaturgy',
              'poison-spray',
              'chill-touch',
              'fire-bolt',
            ].includes(id)
          ? '随意施放'
          : '始终准备；1 次免法术位／长休，也可用法术位',
  }))
}
export function spellGrants(b: Build, c: Catalogue) {
  const grants: { spell: Spell; source: string; ability?: Ability; usage: string }[] = []
  const grant = (id: string, source: string, ability: Ability | undefined, usage: string) => {
    const spell = c.spells.find((s) => s.id === id)
    if (spell) grants.push({ spell, source, ability, usage })
  }
  for (const node of getChoices(b, c).filter((n) => n.kind === 'spell' && n.id !== 'spellbook'))
    for (const id of selected(b, node.id)) grant(id, node.source, node.ability, node.usage || '')
  for (const r of racialSpells(b))
    grant(r.id, '物种传承', (one(b, 'species-ability') as Ability) || undefined, r.usage)
  for (const s of alwaysPrepared(b, c.subclasses))
    grant(
      s.id,
      s.source,
      s.ability,
      '始终准备；' + (s.resource ? '每长休一次免费，也可消耗法术位' : '消耗法术位'),
    )
  for (const g of featSpellGifts(b, c))
    grant(g.id, g.source, g.ability, '始终准备；独立次数／现有法术位／仪式')
  if (b.classId === 'druid')
    grant('speak-with-animals', '德鲁伊语', 'wis', '始终准备；消耗法术位或仪式')
  if (b.classId === 'ranger')
    grant(
      'hunter-s-mark',
      '宿敌',
      'wis',
      '始终准备；' + (levelOf(b) >= 5 ? 3 : 2) + ' 次免法术位／长休，也可用法术位',
    )
  if (b.classId === 'warlock' && hasInvocation(b, 'chain'))
    grant('find-familiar', '链之契约', 'cha', '魔法动作免法术位施放；魔宠管理后续开放')
  if (b.classId === 'warlock' && hasInvocation(b, 'shadows'))
    grant('mage-armor', '幽影护甲', 'cha', '对自身随意施放；未计入当前 AC')
  return grants
}
export function derived(b: Build, c: Catalogue, inventory?: InventoryItem[]): ReturnType<typeof derivedUncached> {
  return withEvaluation(() => memoEvaluation('derived', () => evaluationIdentity(c) + ':' + JSON.stringify([b,inventory]), () => derivedUncached(b,c,inventory), copyEvaluationValue))
}
function derivedUncached(
  b: Build,
  c: Catalogue,
  inventory: InventoryItem[] = startingInventory(b, c).inventory,
) {
  b = effectiveBuild(b)
  const l = levelOf(b),
    pb = pbOf(b)
  const cl = c.classes.find((x) => x.id === b.classId),
    sp = c.species.find((x) => x.id === b.speciesId)
  const adjust = (field: string) =>
    b.adjustments.filter((x) => x.field === field).reduce((n, x) => n + x.amount, 0)
  const scores = Object.fromEntries(
    ABILITIES.map((a) => [a, b.scores[a] + b.boosts[a] + abilityGrowth(b, a) + adjust(a)]),
  ) as Record<Ability, number>
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, modifier(scores[a])])) as Record<
    Ability,
    number
  >
  const { skills, tools, expertise } = proficiencies(b, c),
    training = trainings(b, c)
  const equipped = inventory
    .filter((i) => i.equipped)
    .map((i) => [...c.items, ...b.customItems].find((x) => x.id === i.itemId))
    .filter((x) => !!x)
  const armor = equipped.find((x) => x.kind === 'armor'),
    shield = equipped.some((x) => x.kind === 'shield') && training.armor.includes('shield')
  let ac = 10 + mods.dex,
    acSource = '基础 10 + 敏捷 ' + signed(mods.dex)
  if (armor) {
    ac =
      (armor.ac || 10) +
      (armor.dexCap === 0
        ? 0
        : Math.min(
            mods.dex,
            armor.category === 'medium' && scores.dex >= 16 && hasFeat(b, 'medium-armor-master', c)
              ? 3
              : (armor.dexCap ?? 99),
          ))
    acSource =
      armor.name +
      ' ' +
      armor.ac +
      ' + 敏捷 ' +
      (armor.dexCap === 0 ? '0' : signed(Math.min(mods.dex, armor.dexCap ?? 99)))
  } else {
    if (cl?.id === 'barbarian' && 10 + mods.dex + mods.con > ac) {
      ac = 10 + mods.dex + mods.con
      acSource = '无甲防御 10 + 敏捷 ' + signed(mods.dex) + ' + 体质 ' + signed(mods.con)
    }
    if (
      cl?.id === 'monk' &&
      !equipped.some((x) => x.kind === 'shield') &&
      10 + mods.dex + mods.wis > ac
    ) {
      ac = 10 + mods.dex + mods.wis
      acSource = '无甲防御 10 + 敏捷 ' + signed(mods.dex) + ' + 感知 ' + signed(mods.wis)
    }
  }
  if (
    (hasSubclass(b, 'draconic') || (hasSubclass(b, 'dance') && !shield)) &&
    !armor &&
    10 + mods.dex + mods.cha > ac
  ) {
    ac = 10 + mods.dex + mods.cha
    acSource = hasSubclass(b, 'dance') ? '耀目步法 10 + 敏捷 + 魅力' : '龙族韧性 10 + 敏捷 + 魅力'
  }
  if (shield) {
    ac += 2
    acSource += ' + 盾牌 2'
  }
  if (armor && training.armor.includes(armor.category || '') && hasStyle(b, 'defense', c)) {
    ac++
    acSource += ' + 防御风格 1'
  }
  ac += adjust('ac')
  if (adjust('ac')) acSource += ' + GM ' + signed(adjust('ac'))
  const hp =
    Math.max(1, (cl?.hitDie || 0) + mods.con) +
    (b.growth ?? []).reduce((n, g) => n + Math.max(1, g.hp + mods.con), 0) +
    (sp?.id === 'dwarf' ? l : 0) +
    (featIds(b, c).includes('tough') ? 2 * l : 0) +
    (hasSubclass(b, 'draconic') ? l : 0) +
    adjust('hp')
  const speed =
    (sp?.id === 'elf' && one(b, 'lineage') === 'wood' ? 35 : sp?.speed || 0) -
    (armor?.strength && scores.str < armor.strength ? 10 : 0) +
    (cl?.id === 'barbarian' && l >= 5 && armor?.category !== 'heavy' ? 10 : 0) +
    (cl?.id === 'monk' && l >= 2 && !armor && !equipped.some((x) => x.kind === 'shield') ? 10 : 0) +
    (hasFeat(b, 'speedy', c) ? 10 : 0)
  const skillValues = Object.fromEntries(
    Object.entries(SKILLS).map(([id, s]) => {
      let value =
        mods[s.ability] +
        (skills.includes(id)
          ? expertise.includes(id)
            ? 2 * pb
            : pb
          : cl?.id === 'bard' && l >= 2
            ? Math.floor(pb / 2)
            : 0)
      if (
        b.classId === 'cleric' &&
        one(b, 'order') === 'thaumaturge' &&
        ['arcana', 'religion'].includes(id)
      )
        value += Math.max(1, mods.wis)
      if (
        b.classId === 'druid' &&
        one(b, 'order') === 'magician' &&
        ['arcana', 'nature'].includes(id)
      )
        value += Math.max(1, mods.wis)
      if (hasSubclass(b, 'fey-wanderer') && s.ability === 'cha') value += Math.max(1, mods.wis)
      return [id, value]
    }),
  ) as Record<string, number>
  const attacks = inventory
    .filter(
      (row) =>
        row.equipped &&
        [...c.items, ...b.customItems].find((x) => x.id === row.itemId)?.kind === 'weapon',
    )
    .map((row) => {
      const w = [...c.items, ...b.customItems].find((x) => x.id === row.itemId)!
      let mod = mods.str
      if (w.category?.endsWith('ranged') && !w.properties?.some((p) => p.startsWith('thrown')))
        mod = mods.dex
      if (w.properties?.includes('finesse')) mod = Math.max(mods.str, mods.dex)
      if (
        cl?.id === 'monk' &&
        !armor &&
        !equipped.some((x) => x.kind === 'shield') &&
        (w.category?.startsWith('simple') || w.properties?.includes('light'))
      )
        mod = Math.max(mod, mods.dex)
      if (cl?.id === 'warlock' && hasInvocation(b, 'blade') && one(b, 'pact-weapon') === w.id)
        mod = mods.cha
      return {
        item: w,
        instanceId: row.instanceId,
        ready: !(row.grip === 'one-handed' && requiresTwoHands(w)),
        bonus:
          mod +
          (weaponProficient(b, c, w.id) ? pb : 0) +
          (hasStyle(b, 'archery', c) && w.category?.endsWith('ranged') ? 2 : 0),
        damage:
          (row.grip === 'two-handed'
            ? w.properties?.find((p) => p.startsWith('versatile'))?.slice('versatile'.length) ||
              w.damage
            : w.damage) +
          ' ' +
          signed(mod),
      }
    })
  return {
    scores,
    mods,
    hp,
    ac,
    acSource,
    hpSource: `${l} 级：首级生命骰 ${cl?.hitDie || 0} + 体质 ${signed(mods.con)}；升级生命骰 [${(b.growth ?? []).map((g) => g.hp).join(', ')}] 各加当前体质 ${signed(mods.con)}（每级最少 1）${sp?.id === 'dwarf' ? ' + 矮人坚韧 ' + l : ''}${featIds(b, c).includes('tough') ? ' + 健壮 ' + 2 * l : ''}${hasSubclass(b, 'draconic') ? ' + 龙族韧性 ' + l : ''}${adjust('hp') ? ' + GM ' + signed(adjust('hp')) : ''}`,
    speed,
    initiative:
      mods.dex +
      (featIds(b, c).includes('alert') ? pb : 0) +
      (hasSubclass(b, 'gloom-stalker') ? mods.wis : 0),
    pb,
    skills,
    tools,
    expertise,
    skillValues,
    saves: Object.fromEntries(
      ABILITIES.map((a) => [
        a,
        mods[a] +
          (cl?.saves.includes(a) || (hasFeat(b, 'resilient', c) && featAbility(b, c) === a)
            ? pb
            : 0),
      ]),
    ),
    languages: [
      'common',
      ...selected(b, 'languages'),
      ...selected(b, 'deft-languages'),
      ...(cl?.id === 'rogue' ? ['thievesCant', ...selected(b, 'rogue-language')] : []),
      ...(cl?.id === 'druid' ? ['druidic'] : []),
    ],
    passivePerception: 10 + skillValues.perception!,
    capacity: scores.str * 15 * (sp?.id === 'goliath' ? 2 : 1),
    training,
    attacks,
    spells: spellGrants(b, c),
  }
}
export function validate(
  b: Build,
  c: Catalogue,
  options: { existingCharacter?: boolean } = {},
): Issue[] {
  b = effectiveBuild(b)
  const issues: Issue[] = []
  const issue = (step: number, key: string, message: string) => issues.push({ step, key, message })
  const cl = c.classes.find((x) => x.id === b.classId),
    bg = c.backgrounds.find((x) => x.id === b.backgroundId),
    sp = c.species.find((x) => x.id === b.speciesId)
  if (!cl) issue(0, 'class', '请选择职业')
  if (!bg) issue(1, 'background', '请选择背景')
  if (!sp) issue(1, 'species', '请选择物种')
  for (const node of [...getChoices(b, c), ...equipmentChoices(b, c)]) {
    const chosen = node.step === 4 ? b.equipmentChoices[node.id] || [] : selected(b, node.id)
    const feedback=choiceFeedback(node,chosen)
    if (feedback.messages.length)
      issue(
        node.step,
        node.id,
        `${node.label}：${feedback.messages.join('；')}`,
      )
  }
  const acquiredFeats = [
    bg?.feat,
    ...selected(b, 'human-feat'),
    ...selected(b, 'style'),
    ...selected(b, 'growth-feat'),
    ...selected(b, 'invocation')
      .filter((id) => id.startsWith('lessons:'))
      .map((id) => id.slice(8)),
  ].filter(Boolean) as string[]
  const seenFeats = new Set<string>()
  for (const id of acquiredFeats) {
    const f = c.feats.find((f) => f.id === id),
      mechanic = f?.mechanic ?? id
    if (f)
      for (const message of prerequisiteIssues(
        id === one(b, 'growth-feat') ? beforeFeatBoost(b) : b,
        f,
        [{ classes: c.classes }],
      ))
        issue(3, 'feat-' + id, f.name + '：' + message)
    if (seenFeats.has(mechanic) && !f?.repeatable && !mechanic.startsWith('magic-initiate-'))
      issue(3, 'feat-' + id, (f?.name ?? id) + '：不能重复获得')
    seenFeats.add(mechanic)
  }
  const values = ABILITIES.map((a) => b.scores[a])
  const sorted = (v: number[]) => [...v].sort((a, b) => a - b).join(',')
  if (b.method === 'array' && sorted(values) !== sorted(ARRAY))
    issue(2, 'array', '标准数组需各使用一次 15、14、13、12、10、8')
  if (b.method === 'point') {
    if (values.some((v) => !Number.isInteger(v) || POINT_COST[v] === undefined))
      issue(2, 'point-range', '购点属性必须为 8–15 的整数')
    else if (values.reduce((n, v) => n + POINT_COST[v]!, 0) > 27)
      issue(2, 'point-cost', '购点消耗超过 27 点')
  }
  if (b.method === 'roll') {
    const r = b.rolls
    if (
      !r ||
      r.dice.length !== 6 ||
      r.dice.some((d) => d.length !== 4 || d.some((n) => !Number.isInteger(n) || n < 1 || n > 6)) ||
      sorted(r.totals) !==
        sorted(
          r.dice.map((d) =>
            [...d]
              .sort((a, b) => b - a)
              .slice(0, 3)
              .reduce((s, n) => s + n, 0),
          ),
        ) ||
      sorted(values) !== sorted(r.totals)
    )
      issue(2, 'roll', '掷骰需有完整 4d6 去最低记录，并将六个结果各分配一次')
  }
  const boosts = ABILITIES.map((a) => b.boosts[a])
    .filter((n) => n > 0)
    .sort()
    .join(',')
  if (
    !['1,2', '1,1,1'].includes(boosts) ||
    ABILITIES.some(
      (a) =>
        !Number.isInteger(b.boosts[a]) ||
        b.boosts[a] < 0 ||
        b.boosts[a] > 2 ||
        (!bg?.abilities.includes(a) && b.boosts[a] !== 0) ||
        b.scores[a] + b.boosts[a] > 20,
    )
  )
    issue(2, 'boosts', '背景提升需在许可属性中分配 +2／+1，或三项各 +1；最高 20；许可属性：'+(bg?.abilities.join('、')??'未选择背景')+'；实际分配：'+JSON.stringify(b.boosts))
  if (cl && !cl.equipment[b.classEquipment]) issue(4, 'class-equipment', '职业装备方案无效')
  if (bg && !bg.equipment[b.backgroundEquipment])
    issue(4, 'background-equipment', '背景装备方案无效')
  if (
    b.purchases.some(
      (x) =>
        !c.items.some((i) => i.id === x.itemId) ||
        !Number.isInteger(x.quantity) ||
        x.quantity < 1 ||
        x.quantity > 1000,
    )
  )
    issue(4, 'purchase', '购置物品或数量无效')
  // Completed characters retain their original build flags; their actual inventory
  // is validated separately. New builders must resolve the new hand conflicts.
  const inv = startingInventory(b, c, !options.existingCharacter)
  inv.errors.forEach((message, i) => issue(4, 'inventory-capacity-' + i, message))
  if (inv.coins < 0) issue(4, 'budget', '购置超出初始金币预算')
  const equipped = inv.inventory
    .filter((i) => i.equipped)
    .map((i) => [...c.items, ...b.customItems].find((x) => x.id === i.itemId))
  if (equipped.filter((x) => x?.kind === 'armor').length > 1)
    issue(4, 'armor', '初始穿戴只能有一套护甲')
  if (equipped.filter((x) => x?.kind === 'shield').length > 1)
    issue(4, 'shield', '初始穿戴只能使用一面盾牌')
  if (b.equipped.some((id) => !inv.inventory.some((i) => i.instanceId === id)))
    issue(4, 'equipment-instance', '穿戴配置包含已不存在的物品')
  if (!b.name.trim()) issue(5, 'name', '为角色填写姓名')
  if (b.adjustments.some((a) => !a.reason.trim() || !Number.isInteger(a.amount)))
    issue(6, 'adjustment', 'GM 调整需要整数数值与原因')
  return issues
}
export function warnings(b: Build, c: Catalogue) {
  const d = derived(b, c),
    inv = startingInventory(b, c),
    items = [...c.items, ...b.customItems],
    messages: string[] = []
  for (const row of inv.inventory.filter((i) => i.equipped)) {
    const i = items.find((x) => x.id === row.itemId)
    if (
      i &&
      (i.kind === 'armor' || i.kind === 'shield') &&
      !d.training.armor.includes(i.category || i.kind)
    )
      messages.push(i.name + '：未获得训练；护甲影响力量／敏捷检定且不能施法，盾牌不提供 AC 加值。')
    if (i?.strength && d.scores.str < i.strength)
      messages.push(i.name + '：力量不足，速度降低 10 尺。')
    if (i?.stealthDisadvantage) messages.push(i.name + '：隐匿检定具有劣势。')
  }
  if (inv.weight > d.capacity)
    messages.push('初始物品重量超过负重上限；请减少携带物品或与 GM 协商运输。')
  if (b.classId === 'warlock' && hasInvocation(b, 'blade'))
    messages.push('契约武器形式已记录；召唤或绑定动作留到运行时阶段，未自动发放额外实体武器。')
  return messages
}
export function rollAbilityScores(
  random: () => number = () => {
    const buffer = new Uint32Array(1)
    let x: number
    do {
      crypto.getRandomValues(buffer)
      x = buffer[0]!
    } while (x >= 4294967292)
    return (x % 6) + 1
  },
) {
  const dice = Array.from({ length: 6 }, () => Array.from({ length: 4 }, random))
  return {
    dice,
    totals: dice.map((d) =>
      [...d]
        .sort((a, b) => b - a)
        .slice(0, 3)
        .reduce((n, v) => n + v, 0),
    ),
    at: new Date().toISOString(),
  }
}
export const RECOMMENDED: Record<string, number[]> = {
  barbarian: [15, 13, 14, 10, 12, 8],
  bard: [8, 14, 12, 13, 10, 15],
  cleric: [14, 8, 13, 10, 15, 12],
  druid: [8, 12, 14, 13, 15, 10],
  fighter: [15, 14, 13, 8, 10, 12],
  monk: [12, 15, 13, 10, 14, 8],
  paladin: [15, 10, 13, 8, 12, 14],
  ranger: [12, 15, 13, 8, 14, 10],
  rogue: [12, 15, 13, 14, 10, 8],
  sorcerer: [10, 13, 14, 8, 12, 15],
  warlock: [8, 14, 13, 12, 10, 15],
  wizard: [8, 12, 13, 15, 14, 10],
}
export function assignRecommended(b: Build) {
  const values = b.method === 'roll' ? b.rolls?.totals : ARRAY
  if (!values) return
  const order = RECOMMENDED[b.classId] || ARRAY
  const sorted = [...values].sort((a, b) => b - a)
  ABILITIES.forEach(
    (a, i) => (b.scores[a] = sorted[[...order].sort((a, b) => b - a).indexOf(order[i]!)]!),
  )
}
