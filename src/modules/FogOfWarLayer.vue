<script setup lang="ts">
import { computed } from 'vue'
import { decodeFog } from '../core/fog'
import type { FogView } from '../persistence/fog-schema'
const props = defineProps<{
  fog: FogView
  size: number
  offset?: { x: number; y: number }
  observerId?: string
  shading?: boolean
}>()
const shade = computed(
  () => props.fog.shadingViews?.find((v) => v.observerId === props.observerId) ?? props.fog.shading,
)
const shadePaths = computed(() => {
  const paths = new Map<number, string>()
  for (const r of shade.value?.runs ?? []) {
    const one = shade.value?.level1 ?? 0.35,
      two = shade.value?.level2 ?? 0.75
    const alpha = r.blend !== undefined ? one + (two - one) * r.blend : r.level === 1 ? one : two
    const p = `M${r.x * props.size},${r.y * props.size}h${r.length * props.size}v${props.size}h-${r.length * props.size}z`
    paths.set(alpha, (paths.get(alpha) ?? '') + p)
  }
  return [...paths].map(([alpha, path]) => ({ alpha, path }))
})
const paths = computed(() => {
  const seen = decodeFog(props.fog.explored, props.fog.columns, props.fog.rows),
    visible = decodeFog(props.fog.visible, props.fog.columns, props.fog.rows)
  let unknown = '',
    history = ''
  for (let y = 0; y < props.fog.rows; y++)
    for (let x = 0; x < props.fog.columns; x++) {
      const path = `M${x * props.size},${y * props.size}h${props.size}v${props.size}h-${props.size}z`
      if (!seen.has(x + ',' + y)) unknown += path
      else if (props.fog.mode !== 'enclosed' && !visible.has(x + ',' + y)) history += path
    }
  return { unknown, history }
})
</script>
<template>
  <g
    class="fog-layer"
    :transform="`translate(${offset?.x ?? 0},${offset?.y ?? 0})`"
    pointer-events="none"
    aria-hidden="true"
    ><template v-if="fog.mode === 'enclosed' && shading !== false"
      ><path
        v-for="p in shadePaths"
        :key="p.alpha"
        :d="p.path"
        fill="#000"
        :fill-opacity="p.alpha" /></template
    ><path :d="paths.unknown" fill="#151b20" :fill-opacity="fog.preview ? 0.75 : 1" /><path
      :d="paths.history"
      fill="#151b20"
      fill-opacity=".64"
  /></g>
</template>
