<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import TransferItemCard from './TransferItemCard.vue'
defineProps<{
  title: string
  items: {
    id: string
    name: string
    quantity: number
    itemId: string
    tag?: string
    priceCP?: number | null
    reason?: string
  }[]
  selected: Record<string, number>
  busy: boolean
}>()
const emit = defineEmits<{ quantity: [id: string, value: number] }>()
</script>
<template>
  <section class="trade-items">
    <h4>{{ title }}</h4>
    <TransferItemCard
      v-for="item in items"
      :key="item.id"
      :chosen="!!selected[item.id]"
      :name="localizedEntryName(item)"
      :tag="item.tag ?? 'misc'"
    >
      <template #details><small
          >{{ controlText('scriptSummary.held', {p0:(item.quantity),p1:(item.priceCP == null ? controlText('expressionFour.pricePending') : item.priceCP / 100 + ' GP')}) }}</small
        ><small v-if="item.reason">{{ item.reason }}</small></template>
      <template #quantity>
      <input
        type="number"
        :aria-label="localizedEntryName(item) + controlText('expressionFour.tradeQuantity')"
        min="0"
        :max="item.quantity"
        :value="selected[item.id] ?? 0"
        :disabled="busy || !!item.reason"
        @input="
          emit('quantity', item.id, Math.max(0, Number(($event.target as HTMLInputElement).value)))
        "
      /></template>
    </TransferItemCard>
    <p v-if="!items.length" class="muted">{{ controlText('resourceFlow.noItemsToShow') }}</p>
  </section>
</template>
<style scoped>
.trade-items h4 {
  font-size: 12px;
  margin: 0 0 7px;
}
.trade-item {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 8px;
  border-radius: 7px;
  margin: 6px 0;
}
.trade-item.chosen {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.item-glyph {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: var(--panel);
  border-radius: 5px;
  flex: none;
}
.item-copy {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.item-copy strong {
  font-size: 12px;
}
.item-copy small {
  display: block;
  font-size: 11px;
  color: var(--muted);
}
.trade-item input {
  width: 62px;
  min-width: 0;
  min-height: 34px;
}
.trade-items p {
  font-size: 12px;
}
</style>
