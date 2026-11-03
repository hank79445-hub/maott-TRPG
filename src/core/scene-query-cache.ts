import type { MapScene } from './map-types'
import type { SceneGeometry } from '../persistence/scene-effects-schema'
import type { Illumination } from './scene-lighting'
import type { SceneEffect } from '../persistence/scene-effects-schema'
import type { MapWall } from './map-types'
/** Caller owns one immutable evaluation pass. Never reuse after a world change. */
export const sceneQueryCache = () => ({
  geometry: new Map<
    string,
    | {
        scene: MapScene
        geometry: SceneGeometry
        layer?: import('./m3-spatial').SpaceLayer
        anchorId?: string
      }
    | undefined
  >(),
  illumination: new Map<string, Illumination>(),
  effects: new Map<string, { lights: SceneEffect[]; shadows: SceneEffect[]; huts: SceneEffect[] }>(),
  barriers: new Map<string, MapWall[]>(),
})
export type SceneQueryCache = ReturnType<typeof sceneQueryCache>
