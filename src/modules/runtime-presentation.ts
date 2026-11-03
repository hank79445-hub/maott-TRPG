import {i18n} from '../app/i18n'
import type {Locale} from '../shared/localization/locale'
import type { Resource, SpellGrant } from '../core/runtime'
import type { Spell } from '../core/types'
import localized from '../content/spell-details-zh.json'
const collators={en:new Intl.Collator('en'),'zh-CN':new Intl.Collator('zh-CN')}
const compare=(a:string,b:string)=>collators[i18n.global.locale.value].compare(a,b)
const speciesResources = new Set([
  'breath',
  'stonecunning',
  'giant-ancestry',
  'forest-magic',
  'adrenaline',
  'relentless',
  'large-form',
  'draconic-flight',
  'healing-hands',
  'aasimar-revelation',
])
function resourceCategory(id: string) {
  if (id === 'slots' || /^slots-\d+$/.test(id)) return 'slots'
  if (speciesResources.has(id) || id.startsWith('species-')) return 'species'
  if (
    id === 'lucky' ||
    id === 'mage-slayer' ||
    id.startsWith('feat-') ||
    (id.startsWith('mi-') && !id.startsWith('mi-lesson-'))
  )
    return 'feat'
  return 'class'
}
export function groupResources(defs: Resource[]) {
  return (
    [
      ['slots', '法术位'],
      ['class', '职业资源'],
      ['species', '物种资源'],
      ['feat', '专长资源'],
    ] as const
  )
    .map(([id, name]) => ({
      id,
      name: i18n.global.locale.value === 'en' ? ({slots:'Spell slots',class:'Class resources',species:'Species resources',feat:'Feat resources'} as Record<string,string>)[id]! : name,
      items: defs
        .filter((d) => resourceCategory(d.id) === id)
        .sort((a, b) =>
          id === 'slots'
            ? (a.id === 'slots' ? 1 : Number(a.id.split('-')[1])) -
              (b.id === 'slots' ? 1 : Number(b.id.split('-')[1]))
            : compare(a.name, b.name),
        ),
    }))
    .filter((g) => g.items.length)
}
export function groupSpellGrants(grants: SpellGrant[]) {
  const levels = [...new Set(grants.map((g) => g.spell.level))].sort((a, b) => a - b)
  return levels.map((level) => ({
    level,
    name: i18n.global.locale.value === 'en' ? (level === 0 ? 'Cantrips' : spellLevelName(level)+' spells') : (level === 0 ? '戏法' : spellLevelName(level) + '法术'),
    items: grants
      .filter((g) => g.spell.level === level)
      .sort(
        (a, b) =>
          compare(entryDisplayName(a.spell), entryDisplayName(b.spell)) ||
          compare(a.source, b.source) ||
          a.key.localeCompare(b.key),
      ),
  }))
}
export const spellLevelName = (level: number) =>
  i18n.global.locale.value === 'en' ? (level===0?'Cantrip':({1:'1st',2:'2nd',3:'3rd'} as Record<number,string>)[level]??level+'th') :
  ['戏法', '一环', '二环', '三环', '四环', '五环', '六环', '七环', '八环', '九环'][level] ??
  level + '环'
const schools: Record<string, string> = {
  Abjuration: '防护',
  Conjuration: '咒法',
  Divination: '预言',
  Enchantment: '惑控',
  Evocation: '塑能',
  Illusion: '幻术',
  Necromancy: '死灵',
  Transmutation: '变化',
}
function hash(s: string) {
  let n = 2166136261
  for (const c of s) {
    n ^= c.charCodeAt(0)
    n = Math.imul(n, 16777619)
  }
  return n >>> 0
}
const references = localized as Record<
  string,
  {
    description: string
    castingTime: string
    range: string
    components: string
    baseCastingTime: string
    baseRange: string
    baseComponents: string
    sourceName: string
    baseLength: number
    baseHash: number
  }
>
function chineseTime(s: string) {
  return s
    .replace(/Until dispelled or triggered/gi, '直到被解消或触发')
    .replace(/Until dispelled/gi, '直到被解消')
    .replace(/\bSpecial\b/gi, '特殊（详见描述）')
    .replace(/Concentration,?\s*/gi, '专注，')
    .replace(/up to\s*/gi, '至多')
    .replace(/Instantaneous/gi, '瞬间')
    .replace(/Bonus Action/gi, '附赠动作')
    .replace(/Reaction/gi, '反应')
    .replace(/Action/gi, '动作')
    .replace(/\s*rounds?\b/gi, '回合')
    .replace(/\s*minutes?\b/gi, '分钟')
    .replace(/\s*seconds?\b/gi, '秒')
    .replace(/\s*hours?\b/gi, '小时')
    .replace(/\s*days?\b/gi, '天')
}
export function spellPresentation(spell: Spell, locale: Locale = i18n.global.locale.value) {
  const builtin =
    (spell.source.pack === 'srd-5.2.1' && spell.source.version === '5.2.1') ||
    (spell.source.pack === 'phb-2024-spells' && spell.source.version === '1.0.0')
  const r = builtin ? references[spell.id] : undefined
  const translated = r && hash(spell.description.slice(0, r.baseLength)) === r.baseHash
  const duration = chineseTime(spell.duration),
    m = spell.duration.match(/(\d+)\s*(round|minute|second)s?\b/i)
  const rounds = m
    ? m[2]!.toLowerCase() === 'round'
      ? Number(m[1])
      : m[2]!.toLowerCase() === 'minute'
        ? Number(m[1]) * 10
        : Number(m[1]) % 6 === 0
          ? Number(m[1]) / 6
          : null
    : null
  if (locale === 'en') {
    const description=spell.description || spell.summary
    const missing=/\p{Script=Han}/u.test(description)
    return { school: spell.school, castingTime: spell.castingTime, duration: spell.duration, rounds, range: spell.range, components: spell.components || 'None', description: (missing?'[Original text · English version unavailable]\n':'')+description, reference: spell.source.pack + ' · ' + spell.source.version, translationMissing:missing }
  }
  return {
    school: schools[spell.school] ?? spell.school,
    castingTime:
      translated && spell.castingTime === r.baseCastingTime
        ? r.castingTime
        : chineseTime(spell.castingTime),
    duration,
    rounds,
    range:
      translated && spell.range === r.baseRange
        ? r.range
        : spell.range
            .replace(/\s+(feet|foot)\b/gi, '尺')
            .replace(/\bSelf\b/g, '自身')
            .replace(/\bTouch\b/g, '触及'),
    components:
      translated && spell.components === r.baseComponents
        ? r.components
        : !spell.components || spell.components === '—'
          ? '无'
          : spell.components,
    description: translated
      ? r.description +
        (spell.description.length > r.baseLength
          ? '\n' + spell.description.slice(r.baseLength).trim()
          : '')
      : spell.description || spell.summary,
    reference: translated
      ? '玩家手册2024 · 第七章法术 · 法术详述 · ' + r.sourceName
      : spell.source.pack + ' · ' + spell.source.version,
  }
}

export function entryDisplayName(entry:{name:string;english?:string},locale?:Locale):string
export function entryDisplayName(entry:{name?:string;english?:string}|null|undefined,locale?:Locale):string|undefined
export function entryDisplayName(entry: {name?:string;english?:string}|null|undefined, locale:Locale=i18n.global.locale.value){return locale==='en'&&entry?.english?entry.english:entry?.name}
