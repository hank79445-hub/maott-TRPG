<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, shallowRef } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { SceneEffectAction } from '../../persistence/scene-effects-schema'
const props = defineProps<{ view: RoomView; busy: boolean; actorId: string }>(),
  emit = defineEmits<{ action: [SceneEffectAction] }>()
const objectId = shallowRef(''),
  name = shallowRef(''),
  water = shallowRef(10),
  food = shallowRef(45),
  open = shallowRef(true),
  dest = shallowRef(''),
  amount = shallowRef(1)
const state = computed(() => props.view.scene?.sceneEffects?.supplies),
  gm = computed(() => props.view.self.role === 'gm'),
  objects = computed(
    () =>
      props.view.world?.adventures[0]?.m3?.entities.filter(
        (o) => o.sceneId === props.view.scene?.id && o.enabled,
      ) ?? [],
  )
const carried = computed(() => {
    const a = props.view.world?.adventures[0],
      n = a?.ai?.npcs.find((n) => [n.id, n.characterId, n.actorId].includes(props.actorId)),
      c = props.view.world?.characters.find((c) => c.id === (n?.characterId ?? props.actorId))
    return c
      ? c.inventory
          .filter((r) => r.quantity === 1)
          .map((r) => ({ id: r.instanceId, name: r.itemId }))
      : (n?.consumables
          ?.filter((r) => r.quantity - (n.consumablesUsed?.[r.id] ?? 0) === 1)
          .map((r) => ({ id: r.id, name: r.itemId })) ?? [])
  }),
  batches = computed(() => state.value?.batches.filter((b) => b.units > 0) ?? [])
function register() {
  const inventory = objectId.value.startsWith('inventory:'),
    id = inventory ? objectId.value.slice(10) : objectId.value,
    existing = props.view.world?.adventures[0]?.sceneEffects?.supplies?.containers.find((c) =>
      inventory ? c.instanceId === id && c.ownerId === props.actorId : c.objectId === id,
    )
  emit('action', {
    operation: 'supply-container',
    container: {
      id: existing?.id ?? crypto.randomUUID(),
      name:
        name.value.trim() ||
        (inventory
          ? carried.value.find((r) => r.id === id)?.name
          : objects.value.find((o) => o.id === id)?.name) ||
        '实际容器',
      sceneId: props.view.scene!.id,
      ...(inventory ? { instanceId: id, ownerId: props.actorId } : { objectId: id }),
      open: open.value,
      waterCapacity: Math.round(water.value * 128),
      foodCapacity: Math.round(food.value * 16),
      hidden: false,
    },
    note: 'GM核实实际实体及水／食物分隔容量',
  })
}
function use(batchId: string, kind: 'water' | 'food', transfer: boolean) {
  const units = Math.round(amount.value * (kind === 'water' ? 128 : 16)),
    common = {
      batchId,
      actorId: props.actorId,
      units,
      receipt: crypto.randomUUID(),
      note: '明确按原批次取用，保留保鲜期',
    }
  emit(
    'action',
    transfer
      ? { ...common, operation: 'supply-transfer', containerId: dest.value }
      : { ...common, operation: 'supply-consume' },
  )
}
</script>
<template>
  <details class="supply-inventory">
    <summary>{{ controlText('authoringFlow.waterAndFoodContainersBatchesAndConsumption') }}</summary>
    <p>{{ controlText('authoringFlow.waterIsMeasuredInGallonsAndFoodIn') }}</p>
    <fieldset v-if="gm">
      <legend>{{ controlText('authoringFlow.gmRegistersActualContainer') }}</legend>
      <label
        >{{ controlText('domain.object') }}<select v-model="objectId">
          <option value="">{{ controlText('authoringFlow.chooseARegisteredEntityOrOneInventoryItem') }}</option>
          <option v-for="o in objects" :key="o.id" :value="o.id">{{ localizedEntryName(o) }}</option>
          <option v-for="r in carried" :key="'inventory:' + r.id" :value="'inventory:' + r.id">{{ controlText('progressSummary.carried', {p0:(localizedEntryName(r))}) }}
          </option>
        </select></label
      ><label>{{ controlText('controls.name') }}<input v-model="name" maxlength="200" /></label
      ><label>{{ controlText('interactionField.waterCapacityGallons') }}<input v-model.number="water" type="number" min="0" /></label
      ><label>{{ controlText('interactionField.foodCapacityLb') }}<input v-model.number="food" type="number" min="0" /></label
      ><label><input v-model="open" type="checkbox" />{{ controlText('interactionField.opened') }}</label
      ><button :disabled="busy || !objectId" @click="register">{{ controlText('authoringFlow.verifyContainerCapacity') }}</button>
    </fieldset>
    <template v-if="state"
      ><label
        >{{ controlText('interactionField.quantityToTake') }}<input
          v-model.number="amount"
          type="number"
          min="0.0078125"
          step="0.0625" /></label
      ><label
        >{{ controlText('spatial.receivingContainer') }}<select v-model="dest">
          <option value="">{{ controlText('authoringFlow.chooseActualContainer') }}</option>
          <option v-for="c in state.containers" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
        </select></label
      >
      <article v-for="b in batches" :key="b.id">
        <strong
          >{{ b.appearance }} ·
          {{ b.kind === 'water' ? b.units / 128 + controlText('expressionFour.gallons') : b.units / 16 + controlText('game.pounds') }}
          {{ b.rotten ? controlText('expressionFour.spoiled') : '' }}</strong
        ><button :disabled="busy || !actorId || !dest" @click="use(b.id, b.kind, true)">
          {{ controlText('authoringFlow.fillContainersInBatches') }}</button
        ><button :disabled="busy || !actorId || b.rotten" @click="use(b.id, b.kind, false)">
          {{ controlText('authoringFlow.confirmEatingDrinking') }}
        </button>
      </article></template
    >
  </details>
</template>
<style scoped>
.supply-inventory {
  margin-block: 8px;
  min-width: 0;
}
.supply-inventory fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border: 1px solid var(--line);
}
.supply-inventory label {
  display: inline-grid;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  margin: 4px;
}
.supply-inventory select,
.supply-inventory input {
  max-width: 100%;
  min-width: 0;
}
.supply-inventory article {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--line);
}
.supply-inventory button {
  background: var(--accent-soft, var(--surface));
  border: 1px solid var(--line);
  color: var(--ink);
  min-height: 36px;
  border-radius: 6px;
  padding: 6px;
}
.supply-inventory p {
  font-size: 12px;
}
</style>
