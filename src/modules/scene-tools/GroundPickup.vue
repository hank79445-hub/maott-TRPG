<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, shallowRef, watch } from 'vue'
import { inventoryName } from '../../core/special-weapons'
import type { Catalogue } from '../../core/engine'
import type { RoomView, RoomCommand } from '../../online/protocol'
const props = defineProps<{
    view: RoomView
    characterId: string
    selected: string
    busy: boolean
    content?: Catalogue
  }>(),
  emit = defineEmits<{ command: [RoomCommand]; select: [string] }>()
const id = shallowRef(''),
  quantity = shallowRef(1),
  cost = shallowRef<'free' | 'action'>('free')
const items = computed(() => props.view.scene?.groundItems ?? []),
  item = computed(() => items.value.find((g) => g.id === id.value))
watch(
  () => props.selected,
  (v) => {
    if (v) id.value = v
  },
  { immediate: true },
)
watch(
  () => items.value.map((g) => g.id).join(','),
  () => {
    if (!items.value.some((g) => g.id === id.value)) id.value = items.value[0]?.id ?? ''
  },
  { immediate: true },
)
watch(id, () => {
  quantity.value = 1
  cost.value = 'free'
  emit('select', id.value)
})
const budget = computed(() =>
  props.view.encounter?.phase === 'active'
    ? props.view.encounter.actors.find((a) => a.characterId === props.characterId)?.turn
        ?.objectInteraction
    : props.view.exploration?.status === 'active'
      ? props.view.exploration.members.find((m) => m.characterId === props.characterId)?.interaction
      : true,
)
const dropId = shallowRef('')
const grapples = computed(
  () => props.view.ownCharacters.find((c) => c.id === props.characterId)?.runtime?.grapples ?? [],
)
const carried = computed(
  () =>
    props.view.ownCharacters
      .find((c) => c.id === props.characterId)
      ?.inventory.filter((r) => !r.equipped && !r.containerId && r.quantity === 1) ?? [],
)
const carriedName = (row: import('../../core/types').InventoryItem) =>
  inventoryName(
    row,
    [
      ...(props.content?.items ?? []),
      ...(props.view.ownCharacters.find((c) => c.id === props.characterId)?.build.customItems ??
        []),
    ].find((i) => i.id === row.itemId)?.name ?? row.itemId,
  )
function drop() {
  if (!props.view.scene || !dropId.value) return
  emit('command', {
    kind: 'map',
    command: {
      type: 'ground-drop',
      sceneId: props.view.scene.id,
      characterId: props.characterId,
      instanceId: dropId.value,
      cost: cost.value,
    },
  })
}
function pick() {
  const s = props.view.scene,
    g = item.value
  if (!s || !g) return
  const action = {
    kind: 'map' as const,
    command: {
      type: 'ground-pickup' as const,
      sceneId: s.id,
      itemId: g.id,
      characterId: props.characterId,
      quantity: quantity.value,
      cost: g.cost === 'action' ? ('action' as const) : cost.value,
    },
  }
  emit(
    'command',
    g.requiresGM && props.view.self.role !== 'gm'
      ? {
          kind: 'intent-submit',
          action,
          summary: `拾取${g.name} ×${quantity.value}`,
          source: 'player',
          baseWorldRevision: props.view.worldRevision,
        }
      : action,
  )
}
</script>
<template>
  <details class="room-card">
    <summary>{{ controlText('controls.nearItems') }}</summary>
    <p v-if="!items.length" class="muted">{{ controlText('authoringFlow.noPublicGroundItemsInThisScene') }}</p>
    <template v-else
      ><label
        >{{ controlText('remainingField.chooseGroundItem') }}<select v-model="id">
          <option v-for="g in items" :key="g.id" :value="g.id">
            {{ localizedEntryName(g) }} ×{{ g.quantity }}
          </option>
        </select></label
      ><template v-if="item"
        ><p>{{ controlText('progressSummary.pickupRangeFtApproachFirstItemsCannot', {p0:(item.range),p1:(item.requiresGM ? controlText('expressionFour.requiresGmReview') : controlText('expressionFour.ordinaryPickupExemptFromReview'))}) }}</p>
        <label
          >{{ controlText('remainingField.pickupQuantity') }}<input
            v-model.number="quantity"
            type="number"
            min="1"
            :max="item.quantity" /></label
        ><label
          >{{ controlText('remainingField.pickupCostAlias7') }}<select v-model="cost" :disabled="item.cost === 'action'">
            <option value="free">{{ controlText('authoringFlow.useThisRoundSTurnSFreeItem') }}</option>
            <option value="action">{{ controlText('authoringFlow.explicitlyUseTheUtilizeAction') }}</option>
          </select></label
        >
        <p v-if="item.cost === 'action'">{{ controlText('authoringFlow.thisItemRequiresAnAction') }}</p>
        <p v-else-if="budget === false" role="status">
          {{ controlText('authoringFlow.theFreeItemInteractionHasBeenUsedExplicitly') }}
        </p>
        <button
          :disabled="
            busy ||
            !characterId ||
            quantity < 1 ||
            quantity > item.quantity ||
            (item.cost === 'free' && !budget && cost === 'free')
          "
          @click="pick"
        >
          {{ item.requiresGM ? controlText('expressionFour.submitPickupRequest') : controlText('expressionFour.pickUpSelectedItems') }}
        </button></template
      ></template
    >
    <details v-if="grapples.length">
      <summary>{{ controlText('authoringFlow.currentGrappleReleaseAtAnyTime') }}</summary>
      <button
        v-for="g in grapples"
        :key="g.encounterId + g.targetId"
        type="button"
        :disabled="busy"
        @click="
          emit('command', {
            kind: 'map',
            command: {
              type: 'grapple-release',
              sceneId: view.scene!.id,
              characterId,
              encounterId: g.encounterId,
              targetId: g.targetId,
            },
          })
        "
      >{{ controlText('progressSummary.releasePreviousGrappleNoActionRequired', {p0:(g.hand === 'main-hand' ? controlText('state.mainHand') : controlText('state.otherHand'))}) }}</button>
    </details>
    <details v-if="carried.length">
      <summary>{{ controlText('authoringFlow.dropCarriedItem') }}</summary>
      <label
        >{{ controlText('remainingField.chooseOneItem') }}<select v-model="dropId">
          <option value="">{{ controlText('authoringFlow.unequipFirstThenDropTheWholeItem') }}</option>
          <option v-for="r in carried" :key="r.instanceId" :value="r.instanceId">
            {{ carriedName(r) }}
          </option>
        </select></label
      >
      <label
        >{{ controlText('remainingField.dropCost') }}<select v-model="cost">
          <option value="free">{{ controlText('game.freeInteraction') }}</option>
          <option value="action">{{ controlText('authoringFlow.explicitlyUseAnAction') }}</option>
        </select></label
      >
      <button
        type="button"
        :disabled="busy || !dropId || (!budget && cost === 'free')"
        @click="drop"
      >
        {{ controlText('authoringFlow.placeAtCharacterSFeetPreserveItemConfiguration') }}
      </button>
    </details>
  </details>
</template>
<style scoped>
label {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}
input,
select {
  width: 100%;
  box-sizing: border-box;
}
summary {
  cursor: pointer;
}
</style>
