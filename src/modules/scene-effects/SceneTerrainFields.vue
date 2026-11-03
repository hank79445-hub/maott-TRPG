<script setup lang="ts">
import {displayFeedback} from '../feedback-presentation'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapRoutePicker from '../map-selection/MapRoutePicker.vue'
import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import { computed, ref, watch } from 'vue'
import type { SceneEffectCast } from '../../persistence/scene-effects-schema'
type Facts = NonNullable<SceneEffectCast['terrain']>
const props = defineProps<{
  spellId: string
  objects: { id: string; name: string; kind: string }[]
}>()
const model = defineModel<Facts>({ required: true })
const emit = defineEmits<{ validity: [boolean] }>()
const channels = ref('')
const candidates = computed(() =>
  props.objects.filter((o) =>
    props.spellId === 'plant-growth'
      ? o.kind === 'plants'
      : ['surface', 'stone', 'object'].includes(o.kind),
  ),
)
watch(
  () => props.spellId,
  () => {
    channels.value = ''
    model.value = {
      plantIds: [],
      supportIds: [],
      excludedCells: [],
      enrichment: false,
      webSupport: 'unsupported',
    }
  },
)
const error = computed(() =>
  channels.value.trim() && !/^(\d+,\d+)(\s*;\s*\d+,\d+)*$/.test(channels.value.trim())
    ? '通道格式：X,Y;X,Y，例如6,4;7,4'
    : '',
)
watch(error, (value) => emit('validity', !value), { immediate: true })
watch(channels, (value) => {
  if (!error.value)
    model.value = {
      ...model.value,
      excludedCells: value.trim() ? value.split(';').map((c) => c.trim()) : [],
    }
})
</script>
<template>
  <fieldset class="terrain-facts" v-if="['web', 'plant-growth'].includes(spellId)">
    <legend>{{ controlText('authoringFlow.actualEnvironmentAndBranch') }}</legend>
    <template v-if="spellId === 'web'">
      <label
        >{{ controlText('interactionField.webSupport') }}<select v-model="model.webSupport">
          <option value="unsupported">{{ controlText('authoringFlow.unsupportedCollapsesAtTheSourceSNextTurn') }}</option>
          <option value="opposing">{{ controlText('authoringFlow.anchoredBetweenTwoSolidSurfaces') }}</option>
          <option value="surface">{{ controlText('authoringFlow.onAnActualSurface5FtDeep') }}</option>
        </select></label
      >
      <label v-if="model.webSupport !== 'unsupported'"
        >{{ controlText('interactionField.registeredSupportsMultipleSelection') }}<MapFieldPicker kind="surface"><select multiple v-model="model.supportIds" size="3">
          <option v-for="o in candidates" :key="o.id" :value="o.id">{{ localizedEntryName(o) }}</option>
        </select></MapFieldPicker></label
      >
    </template>
    <template v-else>
      <label
        >{{ controlText('domain.branch') }}<select v-model="model.enrichment">
          <option :value="false">{{ controlText('authoringFlow.overgrowthEachFootOfMovementCosts4Ft') }}</option>
          <option :value="true">{{ controlText('authoringFlow.enrichment8HourCastingDoubledYieldFor365') }}</option>
        </select></label
      >
      <label
        >{{ controlText('interactionField.actualOrdinaryPlantsMultipleSelection') }}<MapFieldPicker kind="surface"><select multiple v-model="model.plantIds" size="3">
          <option v-for="o in candidates" :key="o.id" :value="o.id">{{ localizedEntryName(o) }}</option>
        </select></MapFieldPicker></label
      >
      <MapRoutePicker v-if="!model.enrichment" cells :min="0" :max="6400" :points="model.excludedCells.map(c=>{const [x,y]=c.split(',').map(Number);return {x:x!,y:y!,height:0}})" :label="controlText('finalField.selectAReservedPassageCellOnTheMap')" @select="ps=>channels=ps.map(p=>`${p.x},${p.y}`).join(';')" />
      <label v-if="!model.enrichment"
        >{{ controlText('interactionField.excludedPassageCellsXYXY') }}<input
          v-model="channels"
          :placeholder="controlText('interactionField.forExample')"
          :aria-invalid="!!error"
      /></label>
      <p v-if="error" role="alert">{{ displayFeedback(error,'error') }}</p>
    </template>
    <p class="muted">{{ controlText('authoringFlow.ifThereAreNoCandidatesAskTheGm') }}</p>
  </fieldset>
</template>
<style scoped>
.terrain-facts {
  margin: 8px 0;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
.terrain-facts label {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.terrain-facts select,
.terrain-facts input {
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}
.terrain-facts p {
  grid-column: 1/-1;
  margin: 0;
}
</style>
