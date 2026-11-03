import type { Adventure, MapToken, MapWorld } from './map-types'
import { reconcileSceneEffects } from './scene-effects'
/** Called only after the real route, movement costs and reaction checks pass.
 * This is movement, not teleportation: a carried light extinguished/dispelled
 * while crossing a boundary must not reappear at the final endpoint. */
export function reconcileSceneSegment(
  world: MapWorld,
  a: Adventure,
  token: MapToken,
  to: { x: number; y: number; height: number },
) {
  if (!a.sceneEffects?.regions.some((e) => e.status === 'active')) return
  const from = { x: token.x, y: token.y, height: token.spatial?.height ?? 0 },
    scene = a.scenes.find((s) => s.tokens.includes(token))
  if (!scene) return
  const steps = Math.max(
    1,
    Math.ceil(
      Math.max(
        Math.abs(to.x - from.x),
        Math.abs(to.y - from.y),
        Math.abs(to.height - from.height) / scene.grid.feet,
      ),
    ),
  )
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    token.x = from.x + (to.x - from.x) * t
    token.y = from.y + (to.y - from.y) * t
    token.spatial = {
      ...token.spatial,
      height: from.height + (to.height - from.height) * t,
      layer: token.spatial?.layer ?? 'material',
    }
    reconcileSceneEffects(world)
  }
}
