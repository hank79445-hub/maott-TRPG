<script setup lang="ts">
import { computed } from 'vue'
import type { PreviewGeometry } from './geometry-preview'
const props = defineProps<{
  geometry: PreviewGeometry
  size: number
  feet: number
  color?: string
}>()
const g = computed(() => props.geometry),
  center = computed(() => ({
    x: (g.value.x + g.value.originSpan / 2) * props.size,
    y: (g.value.y + g.value.originSpan / 2) * props.size,
  })),
  length = computed(() => (g.value.size / props.feet) * props.size)
const polygon = computed(() => {
  const q = g.value,
    n = length.value,
    w = (q.width / props.feet) * props.size,
    a = (q.angle * Math.PI) / 180,
    vertices =
      q.shape === 'cone'
        ? [
            [0, 0],
            [n, n / 2],
            [n, -n / 2],
          ]
        : q.shape === 'line'
          ? [
              [0, -w / 2],
              [n, -w / 2],
              [n, w / 2],
              [0, w / 2],
            ]
          : [
              [-n / 2, -n / 2],
              [n / 2, -n / 2],
              [n / 2, n / 2],
              [-n / 2, n / 2],
            ]
  return vertices
    .map(
      ([x, y]) =>
        `${center.value.x + x! * Math.cos(a) - y! * Math.sin(a)},${center.value.y + x! * Math.sin(a) + y! * Math.cos(a)}`,
    )
    .join(' ')
})
</script>
<template>
  <g
    class="geometry-outline"
    :stroke="color ?? '#e8bb53'"
    :fill="color ?? '#e8bb53'"
    fill-opacity=".16"
    stroke-width="2"
    stroke-dasharray="6 4"
    vector-effect="non-scaling-stroke"
    pointer-events="none"
    ><polyline
      v-if="g.shape === 'wall'"
      :points="g.points?.map((p) => `${p.x * size},${p.y * size}`).join(' ')"
      fill="none"
      :stroke-width="Math.max(3, (g.width / feet) * size)" /><rect
      v-else-if="g.shape === 'emanation'"
      :x="g.x * size - length"
      :y="g.y * size - length"
      :width="g.originSpan * size + length * 2"
      :height="g.originSpan * size + length * 2"
      :rx="length" /><circle
      v-else-if="['sphere', 'cylinder'].includes(g.shape)"
      :cx="center.x"
      :cy="center.y"
      :r="length" /><polygon v-else :points="polygon"
  /></g>
</template>
