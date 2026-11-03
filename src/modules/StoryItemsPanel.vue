<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
const props = defineProps<{ view: RoomView; busy: boolean }>(),
  emit = defineEmits<{ command: [c: RoomCommand] }>()
const freshId = () => 'story-' + props.view.world?.adventures[0]?.id + '/' + crypto.randomUUID()
const id = ref(freshId()),
  name = ref('剧情钥匙'),
  description = ref(''),
  weight = ref(0),
  cost = ref(0)
const items = computed(
  () =>
    props.view.world?.packs
      .filter((p) => p.id.startsWith('story-'))
      .flatMap((p) => p.items.filter((i) => i.kind === 'gear' && i.source.edition === 'custom')) ??
    [],
)
function select(value: string) {
  const item = items.value.find((i) => i.id === value)
  if (item) {
    id.value = item.id
    name.value = item.name
    description.value = item.summary
    weight.value = item.weight
    cost.value = item.cost
  }
}
function reset() {
  id.value = freshId()
  name.value = '新剧情物品'
  description.value = ''
}
</script>
<template>
  <details class="room-card">
    <summary>{{ controlText('mapExperience.gmStoryItems') }}</summary>
    <select :aria-label="controlText('remainingField.existingStoryItems')" @change="select(($event.target as HTMLSelectElement).value)">
      <option value="">{{ controlText('resourceFlow.chooseExistingItem') }}</option>
      <option v-for="i in items" :key="i.id" :value="i.id">{{ localizedEntryName(i) }}</option></select
    ><label>{{ controlText('remainingField.stableId') }}<input v-model="id" :disabled="items.some((i) => i.id === id)" /></label
    ><label>{{ controlText('controls.name') }}<input v-model="name" /></label
    ><label>{{ controlText('remainingField.propDescription') }}<textarea v-model="description" rows="2" /></label
    ><label>{{ controlText('controls.weight') }}<input v-model.number="weight" type="number" min="0" /></label
    ><label>{{ controlText('domain.valueGP') }}<input v-model.number="cost" type="number" min="0" /></label
    ><button
      :disabled="busy || !name.trim() || !id.trim()"
      @click="
        emit('command', { kind: 'story-item-save', itemId: id, name, description, weight, cost })
      "
    >
      {{ controlText('resourceFlow.saveDefinition') }}</button
    ><button
      :disabled="busy || !items.some((i) => i.id === id)"
      @click="
        emit('command', { kind: 'story-item-delete', itemId: id, reason: 'GM删除未引用道具' })
      "
    >
      {{ controlText('resourceFlow.deleteUnreferencedDefinition') }}</button
    ><button @click="reset">{{ controlText('game.create') }}</button
    ><small
      >{{ controlText('resourceFlow.afterSavingReferenceTheDefinitionInCharacterGrants') }}</small
    >
  </details>
</template>
