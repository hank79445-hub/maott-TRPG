<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import { computed, ref, shallowRef, watch } from 'vue'
import { NPC_TEMPLATES } from '../../content/npc-templates'
import NpcTemplatePicker from '../NpcTemplatePicker.vue'
import type { MapWorld, MapScene, MapCommand, Position } from '../../core/map-types'
const props = defineProps<{
    world: MapWorld
    adventureId: string
    scene: MapScene
    selected: string
    busy: boolean
  }>(),
  emit = defineEmits<{ command: [MapCommand]; mode: [value: string] }>()
const mode = shallowRef(''),
  source = shallowRef('srd-guard'),
  count = shallowRef(1),
  reason = shallowRef('GM调整棋子位置'),
  points = ref<Position[]>([])
watch(mode, (value) => emit('mode', value), { immediate: true })
const a = computed(() => props.world.adventures.find((a) => a.id === props.adventureId)),
  templates = computed(() => [...NPC_TEMPLATES, ...(a.value?.ai?.templates ?? [])]),
  npcs = computed(() => a.value?.ai?.npcs.filter((n) => n.npcType === 'ordinary' && n.body) ?? [])
const npcSources = computed(() => npcs.value.map((n) => ({ id: 'npc:' + n.id, name: n.name })))
watch(source, () => {
  points.value = []
})
watch(
  () => props.scene.id,
  () => {
    mode.value = ''
    points.value = []
  },
)
function cell(p: Position) {
  if (!mode.value || props.busy) return false
  if (mode.value === 'relocate') {
    if (props.selected)
      emit('command', {
        type: 'gm-relocate',
        sceneId: props.scene.id,
        tokenId: props.selected,
        position: p,
        reason: reason.value,
      })
    return true
  }
  if (points.value.length < count.value && !points.value.some((q) => q.x === p.x && q.y === p.y))
    points.value.push(p)
  return true
}
function place() {
  emit('command', {
    type: 'gm-place-npcs',
    sceneId: props.scene.id,
    ...(source.value.startsWith('npc:')
      ? { sourceNpcId: source.value.slice(4) }
      : { templateId: source.value }),
    positions: [...points.value],
  })
  points.value = []
  mode.value = ''
}
function cancel() {
  points.value = []
  mode.value = ''
}
const disclosure = ref<HTMLDetailsElement | null>(null)
function openMode(value: 'place' | 'relocate') {
  cancel()
  mode.value = value
  if (disclosure.value) disclosure.value.open = true
}
function disclosureChanged() {
  if (!disclosure.value?.open) cancel()
}
defineExpose({ cell, cancel, openMode, isActive: () => !!mode.value })
</script>
<template>
  <details ref="disclosure" class="room-card scene-tools" @toggle="disclosureChanged">
    <summary>{{ controlText('authoringFlow.gmQuickPlacementAndForcedRelocation') }}</summary>
    <div class="tool-grid">
      <label
        >{{ controlText('remainingField.mapOperation') }}<select v-model="mode">
          <option value="">{{ controlText('authoringFlow.normalMapOperations') }}</option>
          <option value="place">{{ controlText('authoringFlow.clickToPlaceOrdinaryNpc') }}</option>
          <option value="relocate">{{ controlText('authoringFlow.clickForForcedRelocation') }}</option>
        </select></label
      ><template v-if="mode === 'place'"
        ><NpcTemplatePicker
          class="tool-wide"
          v-model="source"
          :templates="templates"
          :extra-sources="npcSources"
          :label="controlText('finalField.npcSource')"
          :disabled="busy" />
        <label
          >{{ controlText('remainingField.placementQuantity') }}<input v-model.number="count" type="number" min="1" max="20" /></label></template
      ><label v-if="mode === 'relocate'">{{ controlText('remainingField.relocationReason') }}<input v-model="reason" maxlength="2000" /></label>
    </div>
    <p v-if="mode === 'place'">{{ controlText('progressSummary.clickMapPositionsInOrderSelectedDoes', {p0:(count),p1:(points.map((p) => `(${p.x},${p.y})`).join('、') || controlText('controls.none'))}) }}</p>
    <p v-if="mode === 'relocate'">{{ controlText('progressSummary.selectATokenThenItsDestinationDoes', {p0:(localizedEntryName(scene.tokens.find((t) => t.id === selected)) ?? controlText('controls.none'))}) }}
    </p>
    <div class="room-row">
      <button
        v-if="mode === 'place'"
        :disabled="busy || !source || points.length !== count"
        @click="place"
      >
        {{ controlText('authoringFlow.confirmNpcPlacement') }}</button
      ><button class="subtle" :disabled="busy" @click="cancel">{{ controlText('authoringFlow.exitQuickMode') }}</button>
    </div>
  </details>
</template>
<style scoped>
.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.tool-wide {
  grid-column: 1 / -1;
}
.scene-tools label {
  display: grid;
  gap: 6px;
}
.scene-tools input,
.scene-tools select {
  width: 100%;
  box-sizing: border-box;
}
summary {
  cursor: pointer;
}
@media (max-width: 540px) {
  .tool-grid {
    grid-template-columns: 1fr;
  }
}
</style>
