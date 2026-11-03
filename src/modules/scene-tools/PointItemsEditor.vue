<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import type { MapPoint } from '../../core/map-types'
import type { Item } from '../../core/types'
const props = defineProps<{ point: MapPoint; items: Item[] }>()
function toggle(on: boolean) {
  if (on) {
    props.point.consume = null
    props.point.itemUse = {
      match: 'all',
      effect: 'open',
      fallback: 'none',
      requirements: [{ itemId: props.items[0]?.id ?? '', quantity: 1, mode: 'use' }],
    }
  } else delete props.point.itemUse
}
</script>
<template>
  <details>
    <summary>{{ controlText('authoringFlow.itemConditionsKeys') }}</summary>
    <label class="check"
      ><input
        type="checkbox"
        :checked="!!point.itemUse"
        @change="toggle(($event.target as HTMLInputElement).checked)"
      />{{ controlText('remainingField.useNewItemConditionsReplacesLegacyConsumptionWhen') }}</label
    ><template v-if="point.itemUse"
      ><label
        >{{ controlText('domain.match') }}<select v-model="point.itemUse.match">
          <option value="all">{{ controlText('authoringFlow.requireAll') }}</option>
          <option value="any">{{ controlText('authoringFlow.requireAnyOne') }}</option>
        </select></label
      ><label
        >{{ controlText('controls.effect') }}<select v-model="point.itemUse.effect">
          <option value="open">{{ controlText('authoringFlow.openDoorContainerDirectly') }}</option>
          <option value="prerequisite">{{ controlText('authoringFlow.prerequisiteOnlyCheckStillRequired') }}</option>
        </select></label
      ><label
        >{{ controlText('remainingField.whenUnmatched') }}<select v-model="point.itemUse.fallback">
          <option value="none">{{ controlText('authoringFlow.blockInteraction') }}</option>
          <option value="check">{{ controlText('authoringFlow.allowConfiguredAlternativeCheck') }}</option>
          <option value="gm">{{ controlText('authoringFlow.requestGmRuling') }}</option>
        </select></label
      >
      <div v-for="(r, i) in point.itemUse.requirements" :key="i" class="requirement">
        <select v-model="r.itemId" :aria-label="controlText('remainingField.requiredItem')">
          <option
            v-for="item in items.filter((i) => i.kind !== 'pack')"
            :key="item.id"
            :value="item.id"
          >
            {{ localizedEntryName(item) }}
          </option></select
        ><input
          v-model.number="r.quantity"
          type="number"
          min="1"
          max="10000"
          :aria-label="controlText('controls.quantity')"
        /><select v-model="r.mode" :aria-label="controlText('remainingField.useMethod')">
          <option value="possess">{{ controlText('authoringFlow.possessionOnly') }}</option>
          <option value="use">{{ controlText('authoringFlow.explicitUseWithoutConsumption') }}</option>
          <option value="attempt">{{ controlText('authoringFlow.consumeOnAttempt') }}</option>
          <option value="success">{{ controlText('authoringFlow.consumeOnSuccess') }}</option></select
        ><button @click="point.itemUse.requirements.splice(i, 1)">{{ controlText('authoringFlow.removeCondition') }}</button>
      </div>
      <button
        :disabled="point.itemUse.requirements.length >= 20"
        @click="
          point.itemUse.requirements.push({ itemId: items[0]?.id ?? '', quantity: 1, mode: 'use' })
        "
      >
        {{ controlText('authoringFlow.addCondition') }}
      </button>
      <p class="muted">
        {{ controlText('authoringFlow.usesStableItemIdsRenamingDoesNotChange') }}
      </p></template
    >
  </details>
</template>
<style scoped>
.requirement {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.4rem 0;
}
.requirement select {
  width: auto;
  max-width: 100%;
}
.requirement input {
  width: 5rem;
}
</style>
