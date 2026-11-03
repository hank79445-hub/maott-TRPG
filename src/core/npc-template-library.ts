import type { NpcTemplate } from './ai-types'
export interface NpcTemplateFilter {
  classId: string
  query: string
  category: string
  cr: string
  attack: string
  support: string
  tag: string
}
export function filterNpcTemplates(templates: NpcTemplate[], f: Partial<NpcTemplateFilter> = {}) {
  const query = (f.query ?? '').trim().toLocaleLowerCase()
  return templates.filter(
    (t) =>
      (!f.classId || t.metadata?.classIds?.includes(f.classId)) &&
      (!query ||
        [t.name, t.metadata?.englishName, t.id].some((s) =>
          s?.toLocaleLowerCase().includes(query),
        )) &&
      (!f.category ||
        (f.category === 'custom'
          ? t.id.startsWith('custom-')
          : t.metadata?.category === f.category)) &&
      (!f.cr || t.metadata?.cr === f.cr) &&
      (!f.tag || t.metadata?.tags?.includes(f.tag as 'elite' | 'caster' | 'special')) &&
      (!f.attack ||
        t.body.attacks.some((a) => (f.attack === 'ranged' ? a.range > 0 : a.range === 0))) &&
      (!f.support || t.metadata?.abilities.some((a) => a.support === f.support)),
  )
}
export const NPC_SUPPORT_NAMES = {
  automatic: '自动结算',
  gm: 'GM 裁定',
  unsupported: '暂未支持',
} as const
