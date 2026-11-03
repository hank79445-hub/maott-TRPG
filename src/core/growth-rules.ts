import type { Build, Subclass, Source } from './types'
import featureData from '../content/growth-features.json'
import { PHB_SUBCLASSES, SUBCLASS_PARENTS } from '../content/phb-subclasses'
export const levelOf = (b: Build) => 1 + (b.growth?.length ?? 0)
export const pbOf = (b: Build) => (levelOf(b) >= 5 ? 3 : 2)
export const choicesOf = (b: Build) => b.choices
export const effectiveBuild = (b: Build): Build => b
export const hasInvocation = (b: Build, id: string) => (choicesOf(b).invocation ?? []).includes(id)
export const hasStyle = (b: Build, id: string, content?: { feats: import('./types').Feat[] }) =>
  [...(choicesOf(b).style ?? []), ...(choicesOf(b)['growth-feat'] ?? [])].some(
    (value) => value === id || content?.feats.find((f) => f.id === value)?.mechanic === id,
  )
export const subclassOf = (b: Build) => choicesOf(b).subclass?.[0] ?? ''
export const hasSubclass = (b: Build, id: string) =>
  levelOf(b) >= 3 &&
  (SUBCLASSES[b.classId]?.id === id || SUBCLASS_PARENTS[id] === b.classId) &&
  subclassOf(b) === id
export const abilityGrowth = (b: Build, id: string) =>
  (b.growth ?? []).reduce(
    (n, g) => n + (g.abilityIncreases[id as keyof typeof g.abilityIncreases] ?? 0),
    0,
  )
export const SUBCLASSES: Record<string, { id: string; name: string; page: number }> = {
  barbarian: { id: 'berserker', name: '狂战士道途 / Path of the Berserker', page: 30 },
  bard: { id: 'lore', name: '逸闻学院 / College of Lore', page: 35 },
  cleric: { id: 'life', name: '生命领域 / Life Domain', page: 40 },
  druid: { id: 'land', name: '大地结社 / Circle of the Land', page: 46 },
  fighter: { id: 'champion', name: '勇士 / Champion', page: 49 },
  monk: { id: 'open-hand', name: '散打宗师 / Warrior of the Open Hand', page: 52 },
  paladin: { id: 'devotion', name: '奉献之誓 / Oath of Devotion', page: 56 },
  ranger: { id: 'hunter', name: '猎人 / Hunter', page: 61 },
  rogue: { id: 'thief', name: '盗贼 / Thief', page: 64 },
  sorcerer: { id: 'draconic', name: '龙族术法 / Draconic Sorcery', page: 69 },
  warlock: { id: 'fiend', name: '邪魔宗主 / Fiend Patron', page: 76 },
  wizard: { id: 'evoker', name: '塑能师 / Evoker', page: 82 },
}
const fullSlots = [
  [2, 0, 0],
  [3, 0, 0],
  [4, 2, 0],
  [4, 3, 0],
  [4, 3, 2],
]
const halfSlots = [
  [2, 0, 0],
  [2, 0, 0],
  [3, 0, 0],
  [3, 0, 0],
  [4, 2, 0],
]
export function slotLevels(b: Build): number[] {
  const l = levelOf(b)
  if (b.classId === 'warlock')
    return l >= 5 ? [0, 0, 2] : l >= 3 ? [0, 2, 0] : [l === 1 ? 1 : 2, 0, 0]
  if (['paladin', 'ranger'].includes(b.classId)) return halfSlots[l - 1] ?? [0, 0, 0]
  if (['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(b.classId))
    return fullSlots[l - 1] ?? [0, 0, 0]
  if (hasSubclass(b, 'eldritch-knight') || hasSubclass(b, 'arcane-trickster'))
    return [l === 3 ? 2 : 3, 0, 0]
  return [0, 0, 0]
}
export const slotResource = (level: number) => (level === 1 ? 'slots' : 'slots-' + level)
export const maximumSpellLevel = (b: Build) => slotLevels(b).reduce((n, x, i) => (x ? i + 1 : n), 0)
export function spellCounts(b: Build) {
  const l = levelOf(b),
    i = l - 1,
    id = b.classId
  const prepared =
    id === 'sorcerer'
      ? [2, 4, 6, 7, 9][i]
      : id === 'warlock'
        ? [2, 3, 4, 5, 6][i]
        : ['paladin', 'ranger'].includes(id)
          ? [2, 3, 4, 5, 6][i]
          : [4, 5, 6, 7, 9][i]
  const base =
    { bard: 2, cleric: 3, druid: 2, sorcerer: 4, warlock: 2, wizard: 3 }[id as 'bard'] ?? 0
  const extra =
    (id === 'cleric' && choicesOf(b).order?.[0] === 'thaumaturge') ||
    (id === 'druid' && choicesOf(b).order?.[0] === 'magician')
      ? 1
      : 0
  const partial = hasSubclass(b, 'eldritch-knight') || hasSubclass(b, 'arcane-trickster')
  return {
    prepared: partial ? (l === 3 ? 3 : 4) : maximumSpellLevel(b) ? (prepared ?? 0) : 0,
    cantrips: partial ? 2 : base + (base && l >= 4 ? 1 : 0) + extra,
    book:
      id === 'wizard'
        ? 6 + (l - 1) * 2 + (savantSchool(b) ? 2 : 0) + (savantSchool(b) && l >= 5 ? 1 : 0)
        : 0,
    mastery:
      id === 'fighter'
        ? l >= 4
          ? 4
          : 3
        : id === 'barbarian'
          ? l >= 4
            ? 3
            : 2
          : ['paladin', 'ranger', 'rogue'].includes(id)
            ? 2
            : 0,
    invocations: id === 'warlock' ? (l >= 5 ? 5 : l >= 2 ? 3 : 1) : 0,
  }
}
export const savantSchool = (b: Build) =>
  levelOf(b) >= 3
    ? ({
        evoker: 'Evocation',
        abjurer: 'Abjuration',
        diviner: 'Divination',
        illusionist: 'Illusion',
      }[subclassOf(b) as 'evoker'] ?? '')
    : ''
export const growthFeatures = (
  b: Build,
): {
  classId: string
  subclass: boolean
  subclassId: string
  level: number
  name: string
  description: string
  page: number
  source?: Source
}[] =>
  [
    ...featureData,
    ...PHB_SUBCLASSES.flatMap((s) =>
      s.features.map((f) => ({
        classId: s.classId,
        subclass: true,
        subclassId: s.id,
        level: f.level,
        name: f.name,
        description: f.summary,
        page: 0,
        source: s.source,
      })),
    ),
  ].filter(
    (f) =>
      f.classId === b.classId &&
      f.level <= levelOf(b) &&
      (!f.subclass || (f.subclassId === subclassOf(b) && hasSubclass(b, f.subclassId))),
  )
export function currentFeatureText(b: Build, text: string): string {
  const level = levelOf(b),
    counts = spellCounts(b)
  if (text.startsWith('狂暴：'))
    return `狂暴：${level >= 3 ? 3 : 2} 次；附赠动作开启，力量武器／徒手攻击伤害 +2，钝击、穿刺、挥砍抗性。`
  if (text.startsWith('吟游激励：'))
    return `吟游激励：d${level >= 5 ? 8 : 6}，次数为魅力调整值（至少 1）；${level >= 5 ? '短休或长休' : '长休'}恢复。`
  if (text.startsWith('回气：'))
    return `回气：${level >= 4 ? 3 : 2} 次，以附赠动作恢复 1d10 + ${level} HP；短休恢复 1 次，长休恢复全部。`
  if (text.startsWith('武器精通：'))
    return `武器精通：选择 ${counts.mastery} 种符合职业要求的武器。`
  if (text.startsWith('武艺：')) return text.replace('d6', level >= 5 ? 'd8' : 'd6')
  if (text.startsWith('圣疗：')) return text.replace('5 HP', level * 5 + ' HP')
  if (text.startsWith('宿敌：')) return text.replace('2 次', level >= 5 ? '3 次' : '2 次')
  if (text.startsWith('偷袭：')) return text.replace('1d6', Math.ceil(level / 2) + 'd6')
  if (text.startsWith('奥术回想：'))
    return `奥术回想：每天一次，短休恢复合计不超过 ${Math.ceil(level / 2)} 环级的已消耗法术位。`
  if (text.startsWith('魔能祈唤：'))
    return `魔能祈唤：${counts.invocations} 项，逐项满足等级及契约／戏法前提。`
  if (text.startsWith('施法：') || text.startsWith('契约魔法：'))
    return `${text.split('：')[0]}：${counts.cantrips ? '职业戏法 ' + counts.cantrips + ' 个，' : ''}职业准备 ${counts.prepared} 个${counts.book ? '，法术书 ' + counts.book + ' 个' : ''}；法术位 ${slotLevels(
      b,
    )
      .map((n, i) => (n ? `${i + 1} 环 ×${n}` : ''))
      .filter(Boolean)
      .join('、')}。始终准备的来源另计。`
  if (text.startsWith('吐息：')) return text.replace('1d10', level >= 5 ? '2d10' : '1d10')
  return text
}
export function alwaysPrepared(
  b: Build,
  subclasses: Subclass[] = [],
): { id: string; source: string; resource?: string; ability: 'int' | 'wis' | 'cha' }[] {
  const l = levelOf(b),
    result: { id: string; source: string; resource?: string; ability: 'int' | 'wis' | 'cha' }[] = []
  const add = (ids: string[], source: string, ability: 'int' | 'wis' | 'cha') =>
    ids.forEach((id) => result.push({ id, source, ability }))
  if (b.classId === 'paladin' && l >= 2)
    result.push({
      id: 'divine-smite',
      source: '圣武士惩击',
      resource: 'paladin-smite',
      ability: 'cha',
    })
  if (b.classId === 'paladin' && l >= 5)
    result.push({
      id: 'find-steed',
      source: '忠诚坐骑',
      resource: 'faithful-steed',
      ability: 'cha',
    })
  if (l < 3) return result
  const extra = subclasses.find((s) => s.classId === b.classId && s.id === subclassOf(b))
  for (const grant of extra?.spellGrants ?? [])
    if (grant.level <= l) add(grant.ids, extra!.name, grant.ability)
  if (hasSubclass(b, 'life'))
    add(
      [
        'aid',
        'bless',
        'cure-wounds',
        'lesser-restoration',
        ...(l >= 5 ? ['mass-healing-word', 'revivify'] : []),
      ],
      '生命领域',
      'wis',
    )
  if (hasSubclass(b, 'devotion'))
    add(
      [
        'protection-from-evil-and-good',
        'shield-of-faith',
        ...(l >= 5 ? ['aid', 'zone-of-truth'] : []),
      ],
      '奉献之誓',
      'cha',
    )
  if (hasSubclass(b, 'draconic'))
    add(
      [
        'alter-self',
        'chromatic-orb',
        'command',
        'dragon-s-breath',
        ...(l >= 5 ? ['fear', 'fly'] : []),
      ],
      '龙族术法',
      'cha',
    )
  if (hasSubclass(b, 'fiend'))
    add(
      [
        'burning-hands',
        'command',
        'scorching-ray',
        'suggestion',
        ...(l >= 5 ? ['fireball', 'stinking-cloud'] : []),
      ],
      '邪魔宗主',
      'cha',
    )
  if (hasSubclass(b, 'land')) {
    const land = choicesOf(b).land?.[0] ?? 'arid',
      sets: Record<string, string[]> = {
        arid: ['blur', 'burning-hands', 'fire-bolt'],
        polar: ['fog-cloud', 'hold-person', 'ray-of-frost'],
        temperate: ['misty-step', 'shocking-grasp', 'sleep'],
        tropical: ['acid-splash', 'ray-of-sickness', 'web'],
      }
    add(
      [
        ...(sets[land] ?? []),
        ...(l >= 5
          ? ({
              arid: ['fireball'],
              polar: ['sleet-storm'],
              temperate: ['lightning-bolt'],
              tropical: ['stinking-cloud'],
            }[land as 'arid'] ?? [])
          : []),
      ],
      '大地结社 · ' + land,
      'wis',
    )
  }
  return result
}
