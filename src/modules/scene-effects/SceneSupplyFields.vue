<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, watch } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { SupplyCast } from '../../persistence/scene-supply-schema'
const model = defineModel<SupplyCast>({ required: true })
const props = defineProps<{ spellId: string; view: RoomView }>()
const containers = computed(() => props.view.scene?.sceneEffects?.supplies?.containers ?? [])
watch(
  () => props.spellId,
  (id) => {
    model.value = {
      branch: id === 'create-food-and-water' ? 'food' : 'create-water',
      appearance: '朴素而营养丰富的食物',
    }
  },
  { immediate: true },
)
const gallons = computed({
  get: () => (model.value.waterUnits === undefined ? undefined : model.value.waterUnits / 128),
  set: (n: number | undefined) =>
    (model.value.waterUnits =
      n === undefined || String(n) === '' ? undefined : Math.round(n * 128)),
})
</script>
<template>
  <fieldset class="supply-fields">
    <legend>{{ controlText('authoringFlow.actualWaterAndFood') }}</legend>
    <label v-if="spellId === 'create-or-destroy-water'"
      >{{ controlText('domain.branch') }}<select v-model="model.branch">
        <option value="create-water">{{ controlText('authoringFlow.createWaterInContainer') }}</option>
        <option value="destroy-water">{{ controlText('authoringFlow.destroyWaterInContainer') }}</option>
        <option value="rain">{{ controlText('authoringFlow.rainExtinguishExposedFlames') }}</option>
        <option value="clear-fog">{{ controlText('authoringFlow.dispelLocalFog') }}</option>
      </select></label
    >
    <template v-if="!['rain', 'clear-fog'].includes(model.branch)"
      ><label
        >{{ controlText('interactionField.waterContainer') }}<select v-model="model.containerId">
          <option :value="undefined">{{ controlText('authoringFlow.createFoodOnTheSelectedGroundCreatingWater') }}</option>
          <option v-for="c in containers" :key="c.id" :value="c.id">
            {{ controlText('progressSummary.gallons', {p0:(localizedEntryName(c)),p1:(c.open ? controlText('expressionFour.open') : controlText('controls.close')),p2:(c.waterCapacity / 128)}) }}</option>
        </select></label
      >
      <label v-if="model.branch !== 'food'"
        >{{ controlText('interactionField.waterGallonsBlankUsesSlotLevelMaximum') }}<input
          v-model.number="gallons"
          type="number"
          min="0.0078125"
          step="0.0078125"
      /></label>
      <template v-else
        ><label
          >{{ controlText('interactionField.foodContainer') }}<select v-model="model.foodContainerId">
            <option :value="undefined">{{ controlText('authoringFlow.selectedGround') }}</option>
            <option v-for="c in containers" :key="c.id" :value="c.id">
              {{ localizedEntryName(c) }} · {{ c.foodCapacity / 16 }}{{ controlText('game.pounds') }}
            </option>
          </select></label
        ><label>{{ controlText('interactionField.foodAppearance') }}<input v-model="model.appearance" maxlength="200" /></label>
        <p>{{ controlText('authoringFlow.creates45LbOfFoodAnd30Gallons') }}</p></template
      ></template
    >
    <p v-else>
      {{ controlText('authoringFlow.useThePickerBelowToSetTheActual') }}
    </p>
  </fieldset>
</template>
<style scoped>
.supply-fields {
  display: grid;
  gap: 8px;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
}
.supply-fields label {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.supply-fields select,
.supply-fields input {
  min-width: 0;
  max-width: 100%;
}
.supply-fields p {
  font-size: 12px;
  margin: 0;
}
</style>
