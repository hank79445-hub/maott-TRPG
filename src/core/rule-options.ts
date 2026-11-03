import type { Build, Feat, Pack, Subclass } from './types'
import { ABILITIES } from './types'
import { levelOf, abilityGrowth, SUBCLASSES } from './growth-rules'
import { SRD_SOURCE } from './types'
import { partialCaster, advancedFeats } from './advanced-rules'

export const SRD_SUBCLASSES: Subclass[] = Object.entries(SUBCLASSES).map(([classId, s]) => ({
  ...s,
  classId,
  english: s.name.split(' / ')[1]!,
  summary: 'SRD 5.2.1 已支持分支',
  minLevel: 3,
  source: { ...SRD_SOURCE, page: s.page, edition: '2024', chapter: '角色职业' },
  features: [],
}))
export function prerequisiteIssues(
  b: Build,
  feat: Feat,
  packs: Pick<Pack, 'classes'>[] = [],
): string[] {
  const p = feat.prerequisite,
    level = levelOf(b),
    issues: string[] = []
  if (level < feat.minLevel) issues.push(`须等级 ${feat.minLevel}+`)
  if (!p) return issues
  const scores = Object.fromEntries(
    ABILITIES.map((a) => [
      a,
      b.scores[a] +
        b.boosts[a] +
        abilityGrowth(b, a) +
        b.adjustments.filter((x) => x.field === a).reduce((n, x) => n + x.amount, 0),
    ]),
  )
  for (const [a, n] of Object.entries(p.abilities ?? {}))
    if ((scores[a] ?? 0) < n) issues.push(`${a} 须 ${n}+`)
  if (
    p.anyAbility &&
    !p.anyAbility.abilities.some((a) => (scores[a] ?? 0) >= p.anyAbility!.minimum)
  )
    issues.push(`须 ${p.anyAbility.abilities.join('／')} 至少 ${p.anyAbility.minimum}`)
  if (p.classes && !p.classes.includes(b.classId)) issues.push('职业不符合前提')
  if (
    p.feature === 'fighting-style' &&
    !(b.classId === 'fighter' || (['paladin', 'ranger'].includes(b.classId) && level >= 2))
  )
    issues.push('须拥有战斗风格特性')
  const cl = packs.flatMap((x) => x.classes).find((x) => x.id === b.classId)
  if (p.feature === 'spellcasting' && !cl?.spellAbility && !partialCaster(b))
    issues.push('须拥有施法特性')
  const armor = [
    ...(cl?.armor ?? []),
    ...(b.classId === 'cleric' && b.choices.order?.[0] === 'protector' ? ['heavy'] : []),
    ...(b.classId === 'druid' && b.choices.order?.[0] === 'warden' ? ['medium'] : []),
  ]
  for (const feat of advancedFeats(b))
    armor.push(
      ...({
        'lightly-armored': ['light', 'shield'],
        'moderately-armored': ['medium'],
        'heavily-armored': ['heavy'],
      }[feat] ?? []),
    )
  if (p.armor?.some((a) => !armor.includes(a))) issues.push('护甲受训不符合前提')
  return issues
}
