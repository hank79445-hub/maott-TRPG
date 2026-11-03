import type { Character, Choice } from './types'
import { clone, getChoices, type Catalogue } from './engine'
import { alwaysPrepared, savantSchool } from './growth-rules'
import { partialCaster } from './advanced-rules'

export type GrowthBaseline = Record<string, string[]>
export function growthBaseline(c: Character): GrowthBaseline {
  const choices = clone(c.build.choices)
  for (const [key, value] of Object.entries(c.runtime?.restSpellChoices ?? {})) choices[key] = [...value]
  if (c.runtime?.preparedSpells) choices['class-spells'] = [...c.runtime.preparedSpells]
  return choices
}
export function growthSpellSnapshot(c: Character) {
  const baseline = growthBaseline(c), result: GrowthBaseline = {}
  for (const key of ['class-spells','class-cantrips','tome-cantrips','tome-rituals'])
    if (baseline[key]) result[key] = [...baseline[key]!]
  return result
}
export function growthChoicePolicy(c: Character, next: Character, node: Choice, cat: Catalogue, baseline = growthBaseline(c)) {
  let before = baseline[node.id] ?? [], replacements: number | undefined
  let timing = '按来源保留原有选择'
  if (node.id === 'class-spells') {
    const automatic = new Set(alwaysPrepared(next.build, cat.subclasses).map(s => s.id))
    before = before.filter(id => !automatic.has(id))
    replacements = ['bard','sorcerer','warlock'].includes(c.build.classId) || partialCaster(next.build) ? 1 : 0
    timing = replacements ? '每次职业升级最多替换1道旧准备法术，新增名额另计' : '升级只增加名额；重新准备须完成相应休息'
  } else if (node.id === 'class-cantrips') {
    replacements = c.build.classId === 'wizard' ? 0 : 1
    timing = replacements ? '每次职业升级最多替换1道职业戏法，新增名额另计' : '升级保留旧戏法；长休可另行更换1道'
  } else if (node.id === 'spellbook') {
    replacements = 0; timing = '旧法术书保留；普通新增与学派奖励分开选择'
  } else if (node.id === 'warrior-cantrips') {
    replacements = 1; timing = '本施法战斗风格每次职业升级最多替换1道戏法'
  } else if (node.id.startsWith('tome-')) {
    const retained = (c.build.choices.invocation ?? []).includes('tome') && (next.build.choices.invocation ?? []).includes('tome')
    replacements = 0
    if (!retained) before = []
    timing = '已保留的书册不能因升级重建；短休／长休结束时可明确重建'
  } else if (node.id === 'invocation' || node.id === 'metamagic') {
    replacements = 1; timing = '每次职业升级最多替换1项旧选择，前置依赖仍有效'
  } else if (node.id.startsWith('mi-') && (node.id.endsWith('-cantrips') || node.id.endsWith('-spell'))) {
    replacements = 1; timing = '同一魔法学徒来源的戏法与一环法术合计最多替换1道'
  }
  return { before, replacements, addedSlots: Math.max(0, node.count - before.length), timing }
}
export function schoolAward(_c: Character, next: Character) {
  const school = savantSchool(next.build)
  return { school, count: school ? next.level === 3 ? 2 : next.level === 5 ? 1 : 0 : 0, maxLevel: next.level === 3 ? 2 : 3 }
}
export function modernGrowthChoiceIssues(c: Character, next: Character, cat: Catalogue, baseline: GrowthBaseline) {
  const issues: string[] = []
  for (const node of getChoices(next.build, cat)) {
    const p = growthChoicePolicy(c, next, node, cat, baseline)
    if (p.replacements === undefined) continue
    const removed = p.before.filter(id => !next.build.choices[node.id]?.includes(id))
    if (removed.length > p.replacements)
      issues.push(`${node.label}：最多替换${p.replacements}项旧选择，当前移除${removed.length}项；${p.timing}`)
  }
  return issues
}
/** Imported modern records may only carry choices that could have changed through actual rest features. */
export function growthSnapshotIssues(c: Character, snapshot: GrowthBaseline, cat: Catalogue) {
  const build = clone(c.build)
  for (const key of ['class-spells','class-cantrips','tome-cantrips','tome-rituals'])
    if (snapshot[key]) build.choices[key] = [...snapshot[key]!]
  const errors: string[] = [], choices = getChoices(build, cat)
  const canRestPrepare = ['wizard','cleric','druid','paladin','ranger'].includes(c.build.classId)
  for (const [key, values] of Object.entries(snapshot)) {
    const node = choices.find(n => n.id === key)
    if (!node && !values.length && ['class-spells','class-cantrips','tome-cantrips','tome-rituals'].includes(key)) continue
    if (!node || !['class-spells','class-cantrips','tome-cantrips','tome-rituals'].includes(key) || values.length !== node.count || new Set(values).size !== values.length || values.some(id => !node.options.some(o => o.id === id))) {
      errors.push('成长前实际法术快照不合法：' + key); continue
    }
    const changeAllowed = key === 'class-spells' ? canRestPrepare : key === 'class-cantrips' ? c.build.classId === 'wizard' : true
    if (!changeAllowed && JSON.stringify([...values].sort()) !== JSON.stringify([...(c.build.choices[key] ?? [])].sort())) errors.push('该来源不能凭休息快照更换：' + key)
  }
  return errors
}
