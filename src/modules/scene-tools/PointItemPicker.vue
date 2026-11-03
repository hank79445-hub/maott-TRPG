<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { computed } from 'vue'
import type { InventoryItem } from '../../core/types'
import type { Catalogue } from '../../core/engine'
const props = defineProps<{
  items: InventoryItem[]
  content: Catalogue
  supplies?: { id: string; itemId: string; quantity: number }[]
  used?: Record<string, number>
}>()
const model = defineModel<string[]>({ required: true }),
  confirmed = defineModel<boolean>('confirmed', { required: true }),
  limits = defineModel<Record<string, number>>('limits', { default: () => ({}) })
function select(id: string) {
  confirmed.value = false
  if (model.value.includes(id) && !limits.value[id]) limits.value = { ...limits.value, [id]: 1 }
}
function setLimit(id: string, event: Event) {
  limits.value = { ...limits.value, [id]: Number((event.target as HTMLInputElement).value) }
  confirmed.value = false
}
const rows = computed(() => {
  const quantities = new Map<string, number>()
  for (const i of props.items)
    quantities.set(i.itemId, (quantities.get(i.itemId) ?? 0) + i.quantity)
  for (const i of props.supplies ?? [])
    quantities.set(
      i.itemId,
      (quantities.get(i.itemId) ?? 0) + Math.max(0, i.quantity - (props.used?.[i.id] ?? 0)),
    )
  return [...quantities]
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({
      id,
      quantity: q,
      name: props.content.items.find((i) => i.id === id)?.name ?? id,
    }))
})
</script>
<template>
  <fieldset class="point-item-picker">
    <legend>{{ controlText('authoringFlow.tryHeldItemsMultipleSelection') }}</legend>
    <label v-for="r in rows" :key="r.id" class="check"
      ><input v-model="model" type="checkbox" :value="r.id" @change="select(r.id)" />{{
        localizedEntryName(r)
      }}
      ×{{ r.quantity
      }}<input
        v-if="model.includes(r.id)"
        type="number"
        min="1"
        :max="r.quantity"
        :value="limits[r.id] ?? 1"
        :aria-label="localizedEntryName(r) + controlText('expressionFour.maximumConsumptionQuantity')"
        @input="setLimit(r.id, $event)" /></label
    ><small v-if="!rows.length">{{ controlText('authoringFlow.noHeldItems') }}</small
    ><label class="check"
      ><input
        v-model="confirmed"
        type="checkbox"
      />{{ controlText('remainingField.confirmConsumptionUpToTheEnteredQuantitiesDeduct') }}</label
    >
  </fieldset>
</template>
<style scoped>
.point-item-picker {
  padding: 0.4rem;
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.point-item-picker input[type='number'] {
  width: 4.5rem;
}
.point-item-picker label {
  max-width: 100%;
  overflow-wrap: anywhere;
}
.point-item-picker legend {
  font-size: 0.85rem;
}
.point-item-picker .check:last-child {
  flex-basis: 100%;
}
</style>
