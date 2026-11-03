<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

defineProps<{ active: boolean; zoom: number; compact?: boolean }>()
defineEmits<{ toggle: []; fit: []; reset: [] }>()
</script>
<template>
  <div class="map-interaction-controls" data-map-controls>
    <button :aria-pressed="active" class="secondary" @click="$emit('toggle')">
      {{ active ? controlText('controls.mapExit') : controlText('controls.mapEnter') }}
    </button>
    <span :class="{ active }">{{ active ? controlText('mapExperience.mapActive') : controlText('mapExperience.mapBrowse') }}</span>
    <span v-if="!compact">{{ Math.round(zoom * 100) }}%</span>
    <button v-if="!compact" class="subtle" @click="$emit('fit')">{{ controlText('controls.fit') }}</button
    ><button class="subtle" @click="$emit('reset')">{{ controlText('controls.viewReset') }}</button>
  </div>
</template>
<style>
.map-interaction-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
  border-block: 1px solid var(--line);
}
.map-interaction-controls button {
  padding: 6px 10px;
  min-height: 36px;
  margin: 0;
}
.map-interaction-controls .active {
  color: var(--good);
  font-weight: 700;
}
.map-viewport,
.room-map-scroll {
  background: #252c31 !important;
}
.scene-canvas {
  background: #252c31 !important;
}
@media (max-width: 700px) {
  .map-interaction-controls button {
    min-height: 44px;
  }
  .map-interaction-controls {
    gap: 4px;
  }
  .map-interaction-controls > span:nth-child(2) {
    flex: 1;
    font-size: 11px;
  }
}
</style>
