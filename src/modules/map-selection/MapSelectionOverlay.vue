<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, h } from 'vue'
import AreaOverlay from '../AreaOverlay.vue'
import { useMapSelection } from './selection'
import type { MapScene } from '../../core/map-types'
const props = defineProps<{
    mapId: string
    grid: MapScene['grid']
    size: number
    zoom?: number
    offset: { x: number; y: number }
  }>(),
  selection = useMapSelection()
const current = computed(() =>
  selection?.current.value?.mapId === props.mapId ? selection.current.value : null,
)
const Extra = () => current.value?.overlay?.() ?? h('g')
</script>
<template>
  <g
    v-if="current"
    pointer-events="none"
    class="selection-overlay"
    :transform="`translate(${offset.x},${offset.y})`"
    ><Extra /><polyline
      v-if="current.path?.().length"
      :points="
        current
          .path()
          .map(
            (p) =>
              `${(p.x + (current?.pathVertices ? 0 : 0.5)) * size},${(p.y + (current?.pathVertices ? 0 : 0.5)) * size}`,
          )
          .join(' ')
      "
      fill="none"
      stroke="#e8bb53"
      stroke-dasharray="6 4"
      stroke-width="3"
      vector-effect="non-scaling-stroke"
    /><rect
      v-if="selection?.cursor.value"
      :x="selection.cursor.value.x * size"
      :y="selection.cursor.value.y * size"
      :width="size"
      :height="size"
      fill="none"
      stroke="#9acfe8"
      stroke-dasharray="3 3"
      vector-effect="non-scaling-stroke"
    /><AreaOverlay
      v-if="current.template?.()"
      :template="current.template()!"
      :grid="grid"
      :size="size"
    /><g v-for="p in current.candidates?.() ?? []" :key="p.id"
      ><rect
        v-if="!p.cells"
        :x="p.x * size + 2"
        :y="p.y * size + 2"
        :width="(p.span ?? 1) * size - 4"
        :height="(p.span ?? 1) * size - 4"
        fill="none"
        :stroke="current.selected?.().includes(p.id) ? '#e8bb53' : '#70b6ce'"
        :stroke-width="current.selected?.().includes(p.id) ? 4 : 2"
        stroke-dasharray="5 3"
        vector-effect="non-scaling-stroke" /><rect
        v-for="cell in p.cells ?? []"
        :key="cell"
        :x="Number(cell.split(',')[0]) * size"
        :y="Number(cell.split(',')[1]) * size"
        :width="size"
        :height="size"
        fill="none"
        :stroke="current.selected?.().includes(p.id) ? '#e8bb53' : '#70b6ce'"
        stroke-width="2"
        vector-effect="non-scaling-stroke" /></g
    ><g v-if="current.point?.()"
      ><rect
        :x="current.point()!.x * size"
        :y="current.point()!.y * size"
        :width="size * (current.pointSpan ?? 1)"
        :height="size * (current.pointSpan ?? 1)"
        fill="#d7b14a44"
        stroke="#e8bb53"
        stroke-width="3"
        vector-effect="non-scaling-stroke"
      /><text
        :x="(current.point()!.x + 0.5) * size"
        :y="current.point()!.y * size - 4 / (zoom ?? 1)"
        text-anchor="middle"
        fill="#fff"
        stroke="#172632"
        paint-order="stroke"
        :stroke-width="3 / (zoom ?? 1)"
        :font-size="14 / (zoom ?? 1)"
        >{{ controlText('configuration.destinationAwaitingConfirmation') }}</text
      ></g
    ></g
  >
</template>
