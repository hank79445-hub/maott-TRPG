<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, shallowRef, watch } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
const props = defineProps<{ view: RoomView; busy: boolean; characterId: string }>()
const emit = defineEmits<{ command: [RoomCommand]; spell: [] }>()
const selected = defineModel<string>({ default: '' }),
  quantity = shallowRef(1)
const corpse = computed(() => props.view.scene?.corpses?.find((c) => c.id === selected.value))
watch(
  () => props.view.scene?.id,
  () => {
    selected.value = ''
  },
)
watch(selected, () => {
  quantity.value = 1
})
</script>
<template>
  <details v-if="view.scene?.corpses?.length" :open="!!corpse" class="corpse-panel">
    <summary>{{ controlText('quantity.body', {p0:(view.scene.corpses.length)}) }}</summary>
    <label
      >{{ controlText('field.viewRemains') }}<select v-model="selected">
        <option value="">{{ controlText('operations.selectOrClickRemainsOnTheMap') }}</option>
        <option v-for="c in view.scene.corpses" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
      </select></label
    >
    <template v-if="corpse"
      ><p>{{ controlText('quantity.cell', {p0:(localizedEntryName(corpse)),p1:(corpse.x + 1),p2:(corpse.y + 1)}) }}</p>
      <button @click="emit('spell')">{{ controlText('operations.castingOnRemainsEligibilityVerification') }}</button>
      <p class="muted">{{ controlText('workspace.castingFollowsTheExistingSpellRequestFlowAnd') }}</p>
      <label v-if="corpse.loot.length"
        >{{ controlText('field.quantityToCollect') }}<input v-model.number="quantity" type="number" min="1" max="1000000"
      /></label>
      <ul>
        <li v-for="r in corpse.loot" :key="r.source + ':' + r.id">
          <span>{{ localizedEntryName(r) }} ×{{ r.quantity }}</span
          ><button
            :disabled="
              busy ||
              !characterId ||
              !!r.blocked ||
              !Number.isFinite(quantity) ||
              quantity <= 0 ||
              quantity > r.quantity
            "
            @click="
              emit('command', {
                kind: 'corpse-loot',
                corpseId: corpse.id,
                characterId,
                source: r.source,
                itemId: r.id,
                quantity,
              })
            "
          >
            {{ controlText('controls.claim') }}</button
          ><small v-if="r.blocked">{{ r.blocked }}</small>
        </li>
      </ul>
      <p v-if="!corpse.inspectable" class="muted">{{ controlText('operations.approachTheRemainsToViewRegisteredPossessions') }}</p>
      <p v-else-if="!corpse.loot.length" class="muted">
        {{ controlText('operations.noRegisteredPossessionsAreAvailableToClaimTemplates') }}
      </p>
    </template>
  </details>
</template>
<style scoped>
.corpse-panel {
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.corpse-panel label {
  display: grid;
  gap: 4px;
  margin: 8px 0;
}
.corpse-panel select,
.corpse-panel input {
  min-width: 0;
  max-width: 100%;
}
.corpse-panel li {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 6px 0;
}
.corpse-panel small {
  width: 100%;
}
.corpse-panel button {
  min-height: 44px;
}
</style>
