import { computed, ref } from 'vue'
import type { Adventure, MapScene, MapWorld } from '../core/map-types'
import { anchoredGeometry } from '../core/scene-effects'
import { sceneCenter } from '../core/scene-effect-geometry'
import { sceneRayView } from '../core/scene-ray-view'
export function useSceneLightDebug(
  world: () => MapWorld,
  adventure: () => Adventure | undefined,
  scene: () => MapScene | undefined,
) {
  const enabled = ref(false),
    selected = ref('')
  const lights = computed(
    () =>
      adventure()?.sceneEffects?.regions.filter(
        (e) => e.status === 'active' && !!e.light && e.sceneId === scene()?.id,
      ) ?? [],
  )
  const rays = computed(() => {
    const a = adventure(),
      s = scene(),
      e = lights.value.find((e) => e.id === selected.value),
      current = a && e && anchoredGeometry(world(), a, e)
    if (!enabled.value || !a || !s || !e?.light || !current || e.covered) return
    const center = {
        ...sceneCenter(current.geometry),
        layer: current.layer,
        anchorId: current.anchorId,
      },
      radius = (e.light.bright + e.light.dimExtra) / s.grid.feet
    return {
      center,
      bright: e.light.bright / s.grid.feet,
      dim: radius,
      lines: Array.from({ length: 12 }, (_, i) => {
        const angle = (i * Math.PI) / 6,
          p = {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
            height: center.height,
            layer: center.layer,
            anchorId: center.anchorId,
          }
        return sceneRayView(world(), a, s, center, p, 'light')
      }),
    }
  })
  return { enabled, selected, lights, rays }
}
