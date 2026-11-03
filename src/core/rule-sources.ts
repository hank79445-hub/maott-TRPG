import type { Character, Source } from './types'
import type { Catalogue } from './engine'
export const sourceCaption = (source: Source) =>
  source.chapter ?? `${source.pack}${source.page ? ' · p.' + source.page : ''}`
/** Pin newly used content at commit; never rewrite an existing source version. */
export function pinRuleSources(c: Character, cat: Catalogue) {
  const ids = new Set([
    c.build.classId,
    c.build.backgroundId,
    c.build.speciesId,
    ...Object.values(c.build.choices)
      .flat()
      .map((id) => (id.startsWith('lessons:') ? id.slice(8) : id)),
    ...c.inventory.map((row) => row.itemId),
  ])
  const entries = [
    ...cat.classes,
    ...cat.backgrounds,
    ...cat.species,
    ...cat.feats,
    ...cat.spells,
    ...cat.items,
    ...cat.subclasses,
  ]
  for (const e of entries.filter((e) => ids.has(e.id))) {
    const current = c.packs.find((p) => p.id === e.source.pack)
    if (current && current.version !== e.source.version)
      throw new Error('内容来源版本不一致：' + e.source.pack)
    if (!current) c.packs.push({ id: e.source.pack, version: e.source.version })
  }
}
