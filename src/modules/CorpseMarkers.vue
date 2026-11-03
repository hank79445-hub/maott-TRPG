<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global

import {entryDisplayName as localizedEntryName} from './runtime-presentation'

defineProps<{
  corpses: { id: string; name: string; x: number; y: number }[]
  size: number
  names: boolean
}>()
const emit = defineEmits<{ select: [string] }>()
</script>
<template>
  <g
    ><g
      v-for="c in corpses"
      :key="c.id"
      :data-corpse="c.id"
      :data-token="c.id"
      role="button"
      tabindex="0"
      :aria-label="localizedEntryName(c) + controlText('expressionOne.viewRemains')"
      class="corpse-marker"
      @pointerdown.stop
      @click.stop="emit('select', c.id)"
      @keydown.enter.prevent="emit('select', c.id)"
      @keydown.space.prevent="emit('select', c.id)"
    >
      <title>{{ localizedEntryName(c) }}</title
      ><rect
        :x="(c.x + 0.5) * size - 22"
        :y="(c.y + 0.5) * size - 22"
        width="44"
        height="44"
        rx="10"
        fill="#5b6268"
        stroke="#fff"
      /><path
        :d="`M${(c.x + 0.5) * size - 8},${(c.y + 0.5) * size - 8}l16,16m0,-16l-16,16`"
        stroke="#fff"
        stroke-width="3"
      />
      <text
        v-if="names"
        :x="(c.x + 0.5) * size"
        :y="(c.y + 0.5) * size + 36"
        text-anchor="middle"
        >{{ localizedEntryName(c) }}</text
      >
    </g></g
  >
</template>
<style scoped>
.corpse-marker {
  cursor: pointer;
}
.corpse-marker:focus rect {
  stroke: #ffd36a;
  stroke-width: 3;
}
.corpse-marker text {
  fill: white;
  font-size: 12px;
  paint-order: stroke;
  stroke: #252c31;
  stroke-width: 3px;
}
</style>
