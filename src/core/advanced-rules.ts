import type { Ability, Background, Build, Feat } from './types'
import { ABILITIES } from './types'
import { PHB_GENERAL_FEATS } from '../content/phb-feats'
export type FeatContent = { feats: Feat[]; backgrounds?: Background[] }
export const buildLevel = (b: Build) => 1 + (b.growth?.length ?? 0)
export const canonicalFeat = (id: string, content?: FeatContent) =>
  content?.feats.find((f) => f.id === id)?.mechanic ?? id
export function advancedFeats(b: Build, content?: FeatContent): string[] {
  const ids = [
    content?.backgrounds?.find((bg) => bg.id === b.backgroundId)?.feat ?? '',
    ...(b.speciesId === 'human' ? (b.choices['human-feat'] ?? []) : []),
    ...(buildLevel(b) >= 4 ? (b.choices['growth-feat'] ?? []) : []),
    ...(b.choices.invocation ?? [])
      .filter((id) => id.startsWith('lessons:'))
      .map((id) => id.slice(8)),
  ]
  return ids.filter(Boolean).map((id) => canonicalFeat(id, content))
}
export const hasFeat = (b: Build, id: string, content?: FeatContent) =>
  advancedFeats(b, content).includes(id)
export function featBoost(b: Build, content?: FeatContent): Feat['abilityIncrease'] {
  const raw = b.choices['growth-feat']?.[0] ?? '',
    id = canonicalFeat(raw, content),
    entry = content?.feats.find((f) => f.id === raw)
  if (entry?.abilityIncrease) return entry.abilityIncrease
  if (id === 'ability-score-improvement')
    return { abilities: [...ABILITIES], points: 2, maximum: 20 }
  if (id === 'grappler') return { abilities: ['str', 'dex'], points: 1, maximum: 20 }
  return PHB_GENERAL_FEATS.find((f) => f.id === id)?.abilityIncrease
}
export function featAbility(b: Build, content?: FeatContent): Ability | undefined {
  const step = (b.growth ?? []).find((g) => g.level === 4),
    meta = featBoost(b, content)
  if (!step || meta?.points !== 1) return undefined
  return Object.entries(step.abilityIncreases).find(
    ([a, n]) => n === 1 && meta.abilities.includes(a as Ability),
  )?.[0] as Ability | undefined
}
export const beforeFeatBoost = (b: Build): Build => ({
  ...b,
  growth: b.growth?.map((g) => (g.level === 4 ? { ...g, abilityIncreases: {} } : g)),
})
export const partialCaster = (b: Build) =>
  buildLevel(b) >= 3 &&
  ((b.classId === 'fighter' && b.choices.subclass?.[0] === 'eldritch-knight') ||
    (b.classId === 'rogue' && b.choices.subclass?.[0] === 'arcane-trickster'))
export const spellListClass = (b: Build) => (partialCaster(b) ? 'wizard' : b.classId)
export const classCastingAbility = (b: Build, classes: { id: string; spellAbility?: Ability }[]) =>
  partialCaster(b) ? 'int' : classes.find((c) => c.id === b.classId)?.spellAbility
export function featSpellGifts(
  b: Build,
  content?: FeatContent,
): {
  id: string
  source: string
  key: string
  ability: Ability
  resource?: string
  ritualOnly?: boolean
}[] {
  const ability = featAbility(b, content),
    result: ReturnType<typeof featSpellGifts> = []
  if (!ability) return result
  const gift = (id: string, key: string, source: string, resource?: string) => {
    if (id) result.push({ id, key, source, ability, resource })
  }
  if (hasFeat(b, 'fey-touched', content)) {
    gift('misty-step', 'feat-fey-misty', '妖精触碰', 'feat-fey-misty')
    gift(b.choices['feat-fey-spell']?.[0] ?? '', 'feat-fey-choice', '妖精触碰', 'feat-fey-choice')
  }
  if (hasFeat(b, 'shadow-touched', content)) {
    gift('invisibility', 'feat-shadow-invisibility', '影界触碰', 'feat-shadow-invisibility')
    gift(
      b.choices['feat-shadow-spell']?.[0] ?? '',
      'feat-shadow-choice',
      '影界触碰',
      'feat-shadow-choice',
    )
  }
  if (hasFeat(b, 'telekinetic', content)) gift('mage-hand', 'feat-telekinetic', '念动力')
  if (hasFeat(b, 'telepathic', content))
    gift('detect-thoughts', 'feat-telepathic', '心灵感应', 'feat-telepathic')
  if (hasFeat(b, 'ritual-caster', content))
    for (const id of b.choices['feat-ritual-spells'] ?? [])
      gift(id, 'feat-ritual', '仪式施法者', 'feat-quick-ritual')
  return result
}
