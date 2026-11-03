<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import { attackFeatureOptions } from '../core/combat-resolution-options'
import type { AttackSpec, TurnBudget } from '../core/combat-types'
import type { Character } from '../core/types'
const props = defineProps<{
  character?: Character
  turn?: TurnBudget | null
  attack?: AttackSpec
  busy: boolean
}>()
const sneak = defineModel<boolean>('sneak', { required: true })
const mastery = defineModel<boolean>('mastery', { required: true })
const options = computed(() => attackFeatureOptions(props.character, props.turn, props.attack))
</script>
<template>
  <div v-if="options.sneak || options.mastery" class="attack-features" :aria-label="controlText('field.optionalAbilitiesBeforeAttack')">
    <label v-if="options.sneak" class="check"
      ><input v-model="sneak" type="checkbox" :disabled="busy || !!options.sneakReason" />{{ controlText('field.requestSneakAttackOncePerTurn') }}</label
    >
    <small v-if="options.sneak && options.sneakReason">{{ options.sneakReason }}</small>
    <small v-else-if="options.sneak">{{ controlText('operations.theServerVerifiesAdvantageAndDisadvantageWithoutAdvantage') }}</small>
    <label v-if="options.mastery" class="check"
      ><input v-model="mastery" type="checkbox" :disabled="busy" />{{ controlText('field.useALearnedWeaponMastery') }}
      {{ attack?.mastery }}</label
    >
  </div>
</template>
<style scoped>
.attack-features {
  display: grid;
  gap: 0.4rem;
  padding: 0.65rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
.attack-features label {
  min-height: 44px;
}
.attack-features small {
  color: var(--muted);
}
</style>
