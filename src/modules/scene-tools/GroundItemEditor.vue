<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import type { MapScene, Position } from '../../core/map-types'
import { newGroundItem } from '../../core/ground-items'
const scene = defineModel<MapScene>({ required: true }),
  props = defineProps<{ items: { id: string; name: string }[]; cursor: Position; busy: boolean }>()
function add() {
  scene.value.groundItems ??= []
  const item = props.items[0]
  if (item) scene.value.groundItems.push(newGroundItem(props.cursor, item.id, item.name))
}
</script>
<template>
  <details class="room-card">
    <summary>{{ controlText('authoringFlow.groundItemConfiguration') }}</summary>
    <p class="muted">
      {{ controlText('authoringFlow.configurationDoesNotAutomaticallyEquipOrUseItems') }}
    </p>
    <fieldset v-for="g in scene.groundItems ?? []" :key="g.id">
      <legend>{{ controlText('progressSummary.currentlyRemaining', {p0:(localizedEntryName(g)),p1:(g.quantity)}) }}</legend>
      <div class="fields">
        <label
          >{{ controlText('interactionField.rulesItem') }}<select v-model="g.itemId">
            <option v-for="i in items" :key="i.id" :value="i.id">{{ localizedEntryName(i) }}</option>
          </select></label
        ><label>{{ controlText('interactionField.mapDisplayName') }}<input v-model="g.name" maxlength="2000" /></label
        ><label>{{ controlText('interactionField.iconText') }}<input v-model="g.icon" maxlength="16" /></label
        ><label>{{ controlText('interactionField.markerColor') }}<input v-model="g.color" type="color" /></label
        ><label
          >{{ controlText('interactionField.itemX') }}<input
            v-model.number="g.x"
            type="number"
            min="0"
            :max="scene.grid.columns - 1" /></label
        ><label
          >{{ controlText('interactionField.itemY') }}<input
            v-model.number="g.y"
            type="number"
            min="0"
            :max="scene.grid.rows - 1" /></label
        ><label
          >{{ controlText('interactionField.initialQuantity') }}<input
            v-model.number="g.initialQuantity"
            type="number"
            min="1"
            max="9999" /></label
        ><label
          >{{ controlText('remainingField.pickupRangeFt') }}<input v-model.number="g.range" type="number" min="0" max="1000" /></label
        ><label
          >{{ controlText('remainingField.pickupCost') }}<select v-model="g.cost">
            <option value="free">{{ controlText('authoringFlow.ordinaryItemInteraction') }}</option>
            <option value="action">{{ controlText('authoringFlow.actionRequired') }}</option>
          </select></label
        >
      </div>
      <div class="room-row">
        <label class="check"><input v-model="g.enabled" type="checkbox" />{{ controlText('remainingField.enableItem') }}</label
        ><label class="check"><input v-model="g.hidden" type="checkbox" />{{ controlText('game.gmHidden') }}</label
        ><label class="check"><input v-model="g.requiresGM" type="checkbox" />{{ controlText('remainingField.pickupRequiresGmReview') }}</label>
      </div>
      <label>{{ controlText('remainingField.gmItemNotes') }}<textarea v-model="g.note" rows="2" maxlength="2000" /></label
      ><button
        class="subtle"
        :disabled="busy"
        @click="scene.groundItems = scene.groundItems?.filter((x) => x.id !== g.id)"
      >
        {{ controlText('authoringFlow.deleteGroundItem') }}
      </button>
    </fieldset>
    <button :disabled="busy || (scene.groundItems?.length ?? 0) >= 100" @click="add">
      {{ controlText('authoringFlow.addGroundItemAtSelectedCell') }}
    </button>
  </details>
</template>
<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
label {
  display: grid;
  gap: 6px;
  margin: 8px 0;
}
.check {
  display: flex;
  align-items: center;
}
.check input {
  width: auto;
}
input,
select,
textarea {
  box-sizing: border-box;
  width: 100%;
}
fieldset {
  min-width: 0;
  margin: 10px 0;
}
summary {
  cursor: pointer;
}
@media (max-width: 540px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
