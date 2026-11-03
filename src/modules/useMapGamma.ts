import { ref, watch } from 'vue'
export function useMapGamma(scene: () => string) {
  const gamma = ref(1)
  const clamp = (v: number) => Number.isFinite(v) ? Math.max(.4, Math.min(2.4, v)) : 1
  watch(scene, id => {
    try { const saved = localStorage.getItem('trpg-map-gamma:' + id); gamma.value = saved === null ? 1 : clamp(Number(saved)) }
    catch { gamma.value = 1 }
  }, { immediate: true, flush: 'sync' })
  watch(gamma, value => {
    gamma.value = clamp(value)
    if (scene()) try { localStorage.setItem('trpg-map-gamma:' + scene(), String(gamma.value)) } catch { /* optional local preference */ }
  }, { flush: 'sync' })
  return gamma
}
