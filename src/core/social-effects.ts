import type { ActiveEffect } from './types'

/** The target learns of these charms when they end, including outside an encounter. */
export function rememberEndedCharms(before: readonly ActiveEffect[], after: ActiveEffect[]) {
  const result = [...after]
  for (const effect of before) {
    if (!['friends', 'charm-person'].includes(effect.key) || after.some((e) => e.id === effect.id))
      continue
    const key = 'awareness:' + effect.key + ':' + effect.sourceId
    if (result.some((e) => e.key === key)) continue
    result.push({
      id: crypto.randomUUID(),
      key,
      name: '已知：曾受' + effect.name + '影响',
      sourceId: effect.sourceId,
      page: effect.page,
      concentration: false,
      encounterId: 'outside',
      expiresAt: null,
      phase: 'start',
      visibility: 'owner',
      note: '法术已结束，目标按2024规则知情；不是仍处于魅惑',
    })
  }
  return result
}
