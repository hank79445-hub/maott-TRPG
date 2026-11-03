<script setup lang="ts">
import { computed } from 'vue'
import type { MapScene, MapTemplate } from '../core/map-types'
import { templateCenter, templateOrigin } from '../core/map-area'
const props = defineProps<{ grid: MapScene['grid']; template: MapTemplate; size: number }>()
const o = computed(() => templateOrigin(props.grid, props.template)),
  c = computed(() =>
    ['cube', 'square'].includes(props.template.shape) ? templateCenter(props.template) : o.value,
  ),
  length = computed(() => (props.template.size / props.grid.feet) * props.size)
const polygon = computed(() => {
  const t = props.template,
    angle = (t.angle * Math.PI) / 180,
    start = ['cube', 'square'].includes(t.shape) ? c.value : o.value,
    vertex = (a: number, b: number) =>
      `${start.x * props.size + a * Math.cos(angle) - b * Math.sin(angle)},${start.y * props.size + a * Math.sin(angle) + b * Math.cos(angle)}`,
    n = length.value,
    width = (t.width / props.grid.feet) * props.size
  if (['cube', 'square'].includes(t.shape))
    return [
      vertex(-n / 2, -n / 2),
      vertex(n / 2, -n / 2),
      vertex(n / 2, n / 2),
      vertex(-n / 2, n / 2),
    ].join(' ')
  return t.shape === 'cone'
    ? [vertex(0, 0), vertex(n, n / 2), vertex(n, -n / 2)].join(' ')
    : [
        vertex(0, width / 2),
        vertex(n, width / 2),
        vertex(n, -width / 2),
        vertex(0, -width / 2),
      ].join(' ')
})
</script>
<template>
  <g class="map-template" pointer-events="none">
    <rect
      v-if="template.shape === 'emanation'"
      :x="template.x * size - length"
      :y="template.y * size - length"
      :width="(template.originSpan ?? 1) * size + length * 2"
      :height="(template.originSpan ?? 1) * size + length * 2"
      :rx="length"
    />
    <circle
      v-else-if="['circle', 'sphere', 'cylinder'].includes(template.shape)"
      :cx="c.x * size"
      :cy="c.y * size"
      :r="length"
    />
    <polygon v-else :points="polygon" />
    <circle
      class="map-area-origin"
      :cx="o.x * size"
      :cy="o.y * size"
      r="5"
      fill="#ffdc8a"
      stroke="#304957"
      vector-effect="non-scaling-stroke"
    />
  </g>
</template>
