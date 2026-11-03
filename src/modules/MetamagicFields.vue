<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {damageDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, watch } from 'vue'
import type { Character } from '../core/types'
import type { PendingAction } from '../core/combat-types'
import { DAMAGE_NAMES } from '../core/combat-types'
import { ELEMENTS, METAMAGIC_NAMES, metamagicCost } from '../core/metamagic'
const props = defineProps<{ character?: Character; targets: { id: string; name: string }[] }>()
const model = defineModel<PendingAction['metamagic']>()
const options = computed(() =>
  props.character?.build.classId === 'sorcerer'
    ? (props.character.build.choices.metamagic ?? []).filter(
        (id) => !['seeking', 'empowered'].includes(id),
      )
    : [],
)
const option = computed({
  get: () => model.value?.option ?? '',
  set: (option: string) => {
    model.value = option
      ? { option, protectedIds: [], heightenedId: '', damageType: 'fire' }
      : undefined
  },
})
watch(
  () => props.character?.id,
  () => {
    model.value = undefined
  },
)
</script>
<template>
  <fieldset v-if="options.length" class="metamagic-fields">
    <legend>{{ controlText('configuration.castingMetamagic') }}</legend>
    <label
      >{{ controlText('domain.metamagic') }}<select v-model="option" :aria-label="controlText('domain.metamagic')">
        <option value="">{{ controlText('configuration.doNotUse') }}</option>
        <option v-for="id in options" :key="id" :value="id">
          {{ controlText('quantity.sorceryPoints', {p0:(uiLabel(METAMAGIC_NAMES[id])),p1:(metamagicCost(id))}) }}</option>
      </select></label
    >
    <template v-if="model">
      <div v-if="option === 'careful'" class="target-checks">
        <label v-for="t in targets" :key="t.id" class="check"
          ><input v-model="model.protectedIds" type="checkbox" :value="t.id" />{{ controlText('configurationField.protection') }}
          {{ localizedEntryName(t) }}</label
        >
        <p class="muted">
          {{ controlText('configuration.protectOnlyOtherCreaturesTargetedByThisCasting') }}
        </p>
      </div>
      <label v-if="option === 'heightened'"
        >{{ controlText('domain.heightenedTarget') }}<select v-model="model.heightenedId" :aria-label="controlText('domain.heightenedTarget')">
          <option value="">{{ controlText('game.choose') }}</option>
          <option v-for="t in targets" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
        </select></label
      >
      <label v-if="option === 'transmuted'"
        >{{ controlText('domain.transmutedType') }}<select v-model="model.damageType" :aria-label="controlText('domain.transmutedType')">
          <option v-for="id in ELEMENTS" :key="id" :value="id">{{ damageDisplayName(id) }}</option>
        </select></label
      >
      <p class="muted">
        {{ controlText('configuration.theCastingActionSpellSlotAndSorceryPoints') }}
      </p>
      <p v-if="option === 'subtle'" class="muted">
        {{ controlText('configuration.omitVerbalSomaticAndOrdinaryMaterialComponentsPriced') }}
      </p>
      <p v-if="option === 'quickened'" class="muted">
        {{ controlText('configuration.changesCastingToABonusActionUnavailableAfter') }}
      </p>
    </template>
  </fieldset>
</template>
<style scoped>
.metamagic-fields {
  border: 1px solid var(--border, #ddd);
  border-radius: 12px;
  padding: 12px;
  margin: 12px 0;
  min-width: 0;
}
.target-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
