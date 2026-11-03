<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, h } from 'vue'
import { useMapSelection } from './selection'
const props = defineProps<{ mapId?: string }>(),
  selection = useMapSelection()
const current = computed(() =>
  selection?.current.value && (!props.mapId || selection.current.value.mapId === props.mapId)
    ? selection.current.value
    : null,
)
const Panel = () => current.value?.panel?.() ?? h('span')
</script>
<template>
  <section
    v-if="current"
    class="map-selection-bar"
    data-map-controls
    role="region"
    :aria-label="controlText('configurationField.interactiveMapSelection')"
  >
    <strong>{{ current.label }}</strong>
    <span v-if="current.selected" class="selection-count"
      >{{ controlText('game.selected') }} {{ current.selected().length }}</span
    >
    <p class="muted">
      {{ controlText('configuration.leftClickToSelectRightDragOrScroll') }}
    </p>
    <Panel />
    <p
      v-if="current.error?.() || selection?.pointError.value || selection?.notice.value"
      role="status"
    >
      {{ current.error?.() || selection?.pointError.value || selection?.notice.value }}
    </p>
    <div v-if="current.candidates?.().length" class="selection-options">
      <button
        v-for="c in current.candidates()"
        :key="c.id"
        type="button"
        :aria-pressed="current.selected?.().includes(c.id) ?? false"
        @click="current.onEntity?.(c.id)"
      >
        {{ localizedEntryName(c) }}
      </button>
    </div>
    <div class="selection-buttons">
      <button v-if="selection?.surfaceFocused.value" @click="selection.showOriginal()">
        {{ controlText('configuration.showOriginalFormRetainDraft') }}</button
      ><button v-else @click="selection?.focusMap">{{ controlText('configuration.continueMapSelection') }}</button
      ><button
        :disabled="
          current.canConfirm?.() === false || !!current.error?.() || !!selection?.pointError.value
        "
        @click="selection?.confirm"
      >
        {{ controlText('configuration.confirmSelection') }}</button
      ><button @click="selection?.cancel">{{ controlText('configuration.cancelSelection') }}</button>
    </div>
  </section>
</template>
<style scoped>
.map-selection-bar {
  position: sticky;
  bottom: 8px;
  z-index: 22;
  padding: 10px;
  background: var(--surface);
  color: var(--ink);
  border: 2px solid var(--accent);
  border-radius: 10px;
  box-shadow: var(--shadow);
  max-height: 42dvh;
  overflow: auto;
  min-width: 0;
}
.selection-buttons,
.selection-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.selection-options {
  max-height: 120px;
  overflow: auto;
  margin: 6px 0;
}
p {
  font-size: 12px;
  margin: 5px 0;
}
button {
  min-height: 36px;
}
button[aria-pressed='true'] {
  outline: 2px solid var(--accent);
}
@media (pointer: coarse) {
  button {
    min-height: 44px;
  }
}
</style>

<style>
body[data-map-selecting] [data-trpg-dock],
body[data-map-selecting] .review-backdrop,
body[data-map-selecting] .message-trade-dock {
  visibility: hidden;
  pointer-events: none;
}
</style>
