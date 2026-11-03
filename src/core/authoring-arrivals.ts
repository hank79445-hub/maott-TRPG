import type { Authoring } from '../persistence/script-authoring-schema'

/** Design warnings do not turn intentionally manual arrivals into invalid scripts. */
export function authoringArrivalWarnings(source: Authoring): string[] {
  const warnings: string[] = []
  for (const group of source.arrivals) {
    const scene = source.scenes.find((s) => s.key === group.scene)
    const direct = scene?.points.some(
      (p) => p.arrivalGroup === group.key || p.failureArrivalGroup === group.key,
    )
    const linked = scene?.links?.some((l) => l.arrivalGroups?.includes(group.key))
    if (!direct && !linked && !group.manualReason?.trim())
      warnings.push(group.name + '待出场组缺少自动触发入口；如为GM手动出场，请填写manualReason')
  }
  for (const scene of source.scenes) {
    for (const point of scene.points) {
      if (point.failureArrivalGroup && !point.check)
        warnings.push(
          scene.name + '/' + point.name + '失败出场缺少检定入口，请配置check或明确GM裁定流程。',
        )
      for (const outcome of ['success', 'failure'] as const) {
        const direct = outcome === 'success' ? point.arrivalGroup : point.failureArrivalGroup
        const refs = [
          ...(direct ? [direct] : []),
          ...(scene.links ?? [])
            .filter((l) => l.source === point.key && l.outcome === outcome)
            .flatMap((l) => l.arrivalGroups ?? []),
        ]
        if (new Set(refs).size !== refs.length)
          warnings.push(
            scene.name +
              '/' +
              point.name +
              '的' +
              outcome +
              '结果重复引用出场组；运行时只触发一次，建议合并配置。',
          )
      }
    }
  }
  return warnings
}
