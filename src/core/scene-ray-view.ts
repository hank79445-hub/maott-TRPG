import type { Adventure, MapScene, MapWorld } from './map-types'
import type { ScenePoint } from './scene-effect-geometry'
import { queryPropagation, type PropagationChannel } from './scene-propagation'
import { sceneVision } from './scene-lighting'
export interface SceneRayView {
  end: ScenePoint
  clear: boolean
  reason: string
}
/** Only the first obstruction point and generic reason leave the server.
 * Neither blocker IDs nor hidden wall names belong in a public diagnostic. */
export function sceneRayView(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  from: ScenePoint,
  to: ScenePoint,
  channel: PropagationChannel,
  senses: Parameters<typeof sceneVision>[5] = {},
): SceneRayView {
  const at = (t: number) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    height: from.height + (to.height - from.height) * t,
    layer: to.layer,
    anchorId: to.anchorId,
  })
  const check = (p: ScenePoint) =>
    channel === 'visual'
      ? sceneVision(world, a, s, from, p, senses).ray
      : queryPropagation(world, a, s, from, p, channel)
  const result = check(to)
  if (result.clear)
    return {
      end: to,
      clear: true,
      reason: channel === 'visual' ? '视线路径畅通；目标照明另判' : '传播路径畅通',
    }
  let low = 0,
    high = 1
  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2
    if (check(at(mid)).clear) low = mid
    else high = mid
  }
  return {
    end: at(high),
    clear: false,
    reason: result.uncertain
      ? '阻隔高度待GM核实'
      : result.reasons.some((r) => r.includes('浓雾'))
        ? '浓雾遮蔽'
        : result.reasons.some((r) => r.includes('黑暗'))
          ? '黑暗遮蔽'
          : '实体阻隔',
  }
}
