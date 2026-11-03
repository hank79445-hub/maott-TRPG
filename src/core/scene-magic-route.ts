import type { Adventure, MapScene, MapWorld } from './map-types'
import type { ScenePoint } from './scene-effect-geometry'
import { m3GroundAt } from './m3-ground'
import { physicalPropagation } from './scene-propagation'
import { magicCrossing } from './scene-magic'

/** Sample actual registered ground, not the player's proposed flying height.
 * Fine samples locate ledge edges; a gap must finish on real ground. */
export function flamingSphereRoute(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  from: ScenePoint,
  to: ScenePoint,
  sourceId: string,
) {
  const length = Math.hypot((to.x - from.x) * s.grid.feet, (to.y - from.y) * s.grid.feet)
  const count = Math.max(1, Math.ceil(length / 0.25)),
    route: ScenePoint[] = []
  let previous = from,
    gap = 0,
    onGap = false
  for (let i = 1; i <= count; i++) {
    const p = {
      x: from.x + ((to.x - from.x) * i) / count,
      y: from.y + ((to.y - from.y) * i) / count,
      height: previous.height,
    }
    const ground = m3GroundAt(a, s, p),
      distance = length / count
    if (ground < previous.height - 5) {
      onGap = true
      gap += distance
      if (gap > 10 + 1e-7) throw Error('火球只能跨越不宽于10尺的实际陷坑')
    } else {
      if (ground > previous.height + 5) throw Error('火球只能越过不高于5尺的实际障碍')
      p.height = ground
      gap = 0
      onGap = false
    }
    const blocked = physicalPropagation(a, s, previous, p, 'movement')
    if (!blocked.clear) {
      const floor = a.m3?.environments.find((e) => e.sceneId === s.id)?.floorHeight ?? 0
      if (
        blocked.blockerIds.some((id) => {
          const wall = s.walls?.find((w) => w.id === id)
          return (
            !wall || wall.heightFeet === undefined || floor + wall.heightFeet - previous.height > 5
          )
        })
      )
        throw Error('火球路线被超过5尺或高度未核实的实际墙门阻断')
    }
    magicCrossing(w, a, s, previous, p, sourceId, { spellLevel: 2 })
    route.push(p)
    previous = p
  }
  if (onGap || Math.abs(previous.height - to.height) > 0.001)
    throw Error('火球须停在真实地面，不能停在陷坑上方或飞行')
  return route
}
