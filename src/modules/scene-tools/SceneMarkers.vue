<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import type { GroundItem } from '../../core/scene-tools-types'
defineProps<{
  items: Omit<GroundItem, 'note' | 'initialQuantity'>[]
  ghosts: { id: string; name: string; x: number; y: number; color: string }[]
  size: number
  names: boolean
}>()
const emit = defineEmits<{ ground: [string] }>()
</script>
<template>
  <g
    ><g
      v-for="g in items"
      :key="'ground:' + g.id"
      class="ground-marker"
      role="button"
      tabindex="0"
      :aria-label="controlText('expressionFour.groundItem') + localizedEntryName(g)"
      :data-ground="g.id"
      @pointerdown.stop
      @click.stop="emit('ground', g.id)"
      @keydown.enter.prevent="emit('ground', g.id)"
      ><title>{{ localizedEntryName(g) }} ×{{ g.quantity }}{{ g.hidden ? controlText('expressionFour.gmHidden') : '' }}</title
      ><rect
        :x="(g.x + 0.5) * size - 14"
        :y="(g.y + 0.5) * size - 14"
        width="28"
        height="28"
        rx="6"
        :fill="g.color"
        :stroke-dasharray="g.hidden ? '4 3' : undefined"
        stroke="#fff"
      /><text
        :x="(g.x + 0.5) * size"
        :y="(g.y + 0.5) * size + 5"
        text-anchor="middle"
        fill="#fff"
        >{{ g.icon.slice(0, 2) }}</text
      ><text
        v-if="names"
        :x="(g.x + 0.5) * size"
        :y="(g.y + 0.5) * size + 30"
        text-anchor="middle"
        class="marker-label"
        >{{ localizedEntryName(g) }} ×{{ g.quantity }}</text
      ></g
    ><g v-for="n in ghosts" :key="'ghost:' + n.id" pointer-events="none"
      ><circle
        :cx="(n.x + 0.5) * size"
        :cy="(n.y + 0.5) * size"
        r="18"
        fill="none"
        :stroke="n.color"
        stroke-dasharray="4 3"
      /><text
        :x="(n.x + 0.5) * size"
        :y="(n.y + 0.5) * size + 32"
        text-anchor="middle"
        class="marker-label"
        >{{ controlText('progressSummary.awaitingAppearance', {p0:(localizedEntryName(n))}) }}</text
      ></g
    ></g
  >
</template>
<style scoped>
.ground-marker {
  cursor: pointer;
}
.ground-marker:focus {
  outline: none;
}
.ground-marker:focus rect {
  stroke: #ffb700;
  stroke-width: 3;
}
.marker-label {
  font-size: 12px;
  fill: #fff;
  paint-order: stroke;
  stroke: #252c31;
  stroke-width: 3px;
}
</style>
