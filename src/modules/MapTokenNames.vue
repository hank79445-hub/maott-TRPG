<script setup lang="ts">
import { computed } from 'vue'
import type { MapScene } from '../core/map-types'
import { cellCenter, gridSize } from '../core/map-view'
const props = defineProps<{
  grid: MapScene['grid']
  tokens: MapScene['tokens']
  zoom: number
  selected: string
}>()
const labels = computed(() => {
  const size = gridSize(props.grid),
    zoom = Math.max(0.08, props.zoom)
  const mapWidth = props.grid.columns * Math.max(64, size),
    mapHeight = props.grid.rows * Math.max(64, size)
  return props.tokens.map((t) => {
    const characters = Array.from(t.name)
    const text = characters.length > 12 ? characters.slice(0, 11).join('') + '…' : t.name
    const width = Math.min(
      mapWidth - 4,
      (Array.from(text).reduce((n, c) => n + (c.charCodeAt(0) < 128 ? 0.6 : 1), 0) * 14 + 14) /
        zoom,
    )
    const height = 24 / zoom,
      center = cellCenter(props.grid, t)
    return {
      id: t.id,
      text,
      width,
      height,
      x: Math.max(2, Math.min(mapWidth - width - 2, center.x - width / 2)),
      y: Math.max(2, Math.min(mapHeight - height - 2, center.y + size * 0.35 + 5 / zoom)),
      fontSize: 14 / zoom,
    }
  })
})
</script>
<template>
  <g class="room-token-names" pointer-events="none">
    <g v-for="label in labels" :key="label.id">
      <rect
        :x="label.x"
        :y="label.y"
        :width="label.width"
        :height="label.height"
        :rx="4 / zoom"
        fill="#203642"
        fill-opacity=".94"
        :stroke="label.id === selected ? '#ffdc8a' : '#c7d5db'"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
      <text
        :data-token-name="label.id"
        :x="label.x + label.width / 2"
        :y="label.y + label.height / 2"
        text-anchor="middle"
        dominant-baseline="central"
        fill="#fff"
        :font-size="label.fontSize"
        >{{ label.text }}</text
      >
    </g>
  </g>
</template>
