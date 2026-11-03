import { manualFeatures } from '../core/manual-growth'
import { rulePowers } from '../core/phb-powers'
import { SELF_SPELLS } from '../core/phb-spell-rules'
import type { DamageType, CombatCommand } from '../core/combat-types'
import type { Character, Spell } from '../core/types'
import { one, type Catalogue } from '../core/engine'
import { resources } from '../core/runtime'
import { spellEffect } from '../core/combat-rules'

export const ATTACK_COSTS: Record<Extract<CombatCommand, { type: 'attack' }>['cost'], string> = {
  action: '攻击动作',
  haste:'加速 · 一次攻击',
  light: '轻型武器额外攻击 · 附赠动作',
  nick: 'Nick 额外攻击',
  cleave: 'Cleave 额外攻击',
  martial: '武艺 · 附赠徒手打击',
  flurry: '疾风连击 · 已消耗附赠动作及 1 点专注',
  opportunity: '借机攻击 · 反应（GM 确认触发）',
  dual: '双持客 · 附赠动作',
  pole: '长柄武器反端 · 附赠动作',
  hew: '巨武器斩击 · 附赠动作',
  'war-priest': '战争祭司 · 附赠动作＋一次资源',
  psychic: '第二心灵之刃 · 附赠动作',
  star: '星耀射手 · 附赠动作／激活首发',
  agile: '舞蹈灵巧打击 · 激励动作的一部分',
}
export const ACTION_NAMES = {
  magic:'魔法动作',
  dash: '疾走',
  disengage: '撤离',
  dodge: '回避',
  help: '协助',
  ready: '预备',
  utilize: '使用',
  extinguish: '打滚灭火 · 倒地',
  hide: '躲藏（GM 裁定）',
  search: '搜索（GM 裁定）',
  study: '研究（GM 裁定）',
  influence: '影响（GM 裁定）',
}
export function combatFeatures(c: Character, cat: Catalogue) {
  return resources(c, cat)
    .filter(
      (r) =>
        [
          'action-surge',
          'rage',
          'second-wind',
          'lay-on-hands',
          'bardic-inspiration',
          'innate-sorcery',
          'adrenaline',
          'breath',
          'stonecunning',
          'large-form',
          'draconic-flight',
        ].includes(r.id) ||
        (r.id === 'giant-ancestry' && one(c.build, 'ancestry') === 'cloud'),
    )
    .concat(
      [...manualFeatures(c), ...rulePowers(c).map((p) => ({ ...p, page: 0 }))]
        .filter((f) => !['growth/wild-shape', 'growth/companion', 'growth/stun'].includes(f.id))
        .map((f) => ({
          id: f.id,
          name: f.name,
          max: f.resource ? (resources(c, cat).find((r) => r.id === f.resource)?.max ?? 1) : 1,
          short: 'none' as const,
          page: f.page,
          detail:
            f.detail +
            '；' +
            (f.cost === 'none' ? '无需动作' : COST_NAMES[f.cost]) +
            (f.resource
              ? '，' +
                (resources(c, cat).find((r) => r.id === f.resource)?.name ?? f.resource) +
                ' ×' +
                f.amount
              : ''),
        })),
    )
}
export const featureSelf = (id: string) =>
  id.startsWith('origin/')
    ? [
        'origin/lucky-own',
        'origin/lucky-defense',
        'origin/revelation',
        'origin/end-revelation',
      ].includes(id)
    : id.startsWith('growth/')
      ? [
          'growth/reckless',
          'growth/wild-shape',
          'growth/companion',
          'growth/defense',
          'growth/wind',
          'growth/cunning',
          'growth/steady-aim',
          'growth/fast-hands',
        ].includes(id)
      : !['lay-on-hands', 'bardic-inspiration', 'breath'].includes(id)
export const spellCost = (s: Spell) =>
  /Reaction/i.test(s.castingTime)
    ? 'reaction'
    : /Bonus Action/i.test(s.castingTime)
      ? 'bonus'
      : 'action'
export const COST_NAMES = {
  action: '行动',
  bonus: '附赠动作',
  reaction: '反应',
  free: '免费物品交互',
}
export function spellTargets(s: Spell, key = '', level = 1, slot = 1) {
  const p = spellEffect(s.id, level, slot)
  return {
    self:
      [
        'false-life',
        'divine-favor',
        'shillelagh',
        'shield',
        'moonbeam',
        'spirit-guardians',
      ].includes(s.id) ||
      SELF_SPELLS.includes(s.id) ||
      key.startsWith('shadows:'),
    area: !!p.area,
    darts: ['magic-missile', 'eldritch-blast', 'scorching-ray'].includes(s.id),
    max: p.count ?? (p.area || p.kind === 'manual' ? 100 : 1),
    manual: p.kind === 'manual',
  }
}
export function spellDamageOptions(id: string): DamageType[] {
  if (id === 'elemental-weapon') return ['acid', 'cold', 'fire', 'lightning', 'thunder']
  if (id === 'chromatic-orb') return ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder']
  if (id === 'sorcerous-burst')
    return ['acid', 'cold', 'fire', 'lightning', 'poison', 'psychic', 'thunder']
  if (id === 'true-strike') return ['radiant', 'bludgeoning', 'piercing', 'slashing']
  return []
}
