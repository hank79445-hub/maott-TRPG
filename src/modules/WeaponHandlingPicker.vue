<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { computed, ref, watch } from 'vue'
import type { Character } from '../core/types'
import type { Catalogue } from '../core/engine'
import type { WeaponHandling } from '../core/combat-types'
import { findItem } from '../core/runtime'
import { requiresTwoHands } from '../core/weapon-rules'
import { inventoryName } from '../core/special-weapons'
const props = defineProps<{
  character: Character
  content: Catalogue
  busy: boolean
  cost: string
}>()
const model = defineModel<WeaponHandling>({ required: true })
const before = ref(''),
  after = ref(''),
  slot = ref<'main-hand' | 'off-hand'>('main-hand')
const weapons = computed(() =>
  props.character.inventory.filter(
    (r) =>
      !r.containerId &&
      r.quantity === 1 &&
      findItem(props.character, props.content, r.itemId)?.kind === 'weapon',
  ),
)
const choices = computed(() =>
  weapons.value.map((r) => ({
    key: (r.equipped ? 'stow:' : 'draw:') + r.instanceId,
    row: r,
    name:
      (r.equipped ? '收起 ' : '拔出 ') +
      inventoryName(r, findItem(props.character, props.content, r.itemId)!.name),
  })),
)
watch(
  () => props.character.id,
  () => {
    before.value = ''
    after.value = ''
  },
)
watch(choices, (rows) => {
  if (!rows.some((c) => c.key === before.value)) before.value = ''
  if (!rows.some((c) => c.key === after.value)) after.value = ''
})
watch(
  () => [before.value, after.value, slot.value, props.cost],
  () => {
    if (!['action', 'nick'].includes(props.cost)) {
      before.value = ''
      after.value = ''
    }
    const operation = (key: string): WeaponHandling['before'] => {
      const choice = choices.value.find((c) => c.key === key)
      if (!choice) return []
      const item = findItem(props.character, props.content, choice.row.itemId)!
      return [
        {
          type: 'equip',
          instanceId: choice.row.instanceId,
          equipped: key.startsWith('draw:'),
          slot:
            choice.row.equipmentSlot === 'off-hand'
              ? 'off-hand'
              : choice.row.equipped
                ? 'main-hand'
                : slot.value,
          grip: requiresTwoHands(item, props.character.runtime?.mounted)
            ? 'two-handed'
            : 'one-handed',
        },
      ]
    }
    model.value = { before: operation(before.value), after: operation(after.value) }
  },
  { immediate: true },
)
</script>
<template>
  <details class="weapon-handling">
    <summary>{{ controlText('resourceFlow.drawStowWeaponForThisAttack') }}</summary>
    <fieldset :disabled="busy || !['action', 'nick'].includes(cost)">
      <label
        >{{ controlText('remainingField.beforeAttack') }}<select v-model="before" :aria-label="controlText('remainingField.drawStowBeforeAttack')">
          <option value="">{{ controlText('resourceFlow.noOperation') }}</option>
          <option v-for="c in choices" :key="c.key" :value="c.key">{{ localizedEntryName(c) }}</option>
        </select></label
      >
      <label
        >{{ controlText('remainingField.afterAttack') }}<select v-model="after" :aria-label="controlText('remainingField.drawStowAfterAttack')">
          <option value="">{{ controlText('resourceFlow.noOperation') }}</option>
          <option v-for="c in choices" :key="c.key" :value="c.key">{{ localizedEntryName(c) }}</option>
        </select></label
      >
      <label
        >{{ controlText('remainingField.drawIntoHandSlot') }}<select v-model="slot">
          <option value="main-hand">{{ controlText('state.mainHand') }}</option>
          <option value="off-hand">{{ controlText('state.otherHand') }}</option>
        </select></label
      >
      <small
        >{{ controlText('resourceFlow.eachAttackWithinTheAttackActionMayDraw') }}</small
      >
    </fieldset>
  </details>
</template>
<style scoped>
.weapon-handling {
  min-width: 0;
}
.weapon-handling fieldset {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.weapon-handling label {
  display: grid;
  gap: 0.2rem;
}
.weapon-handling select {
  width: 100%;
  min-width: 0;
}
.weapon-handling small {
  color: var(--muted, #596970);
}
</style>
