<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import type { RoomView } from '../../online/protocol'
import type { SceneEffectCast } from '../../persistence/scene-effects-schema'
const props = defineProps<{
  modelValue: NonNullable<SceneEffectCast['m5']>
  spellId: string
  view: RoomView
  sourceId: string
}>()
const emit = defineEmits<{ 'update:modelValue': [NonNullable<SceneEffectCast['m5']>] }>()
function update(patch: Partial<NonNullable<SceneEffectCast['m5']>>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>
<template>
  <fieldset class="m5-cast-fields">
    <legend>{{ controlText('adjudication.actualRecipientAndInitialAttack') }}</legend>
    <label
      v-if="
        [
          'dragon-s-breath',
          'mind-spike',
          'vampiric-touch',
          'witch-bolt',
          'spiritual-weapon',
        ].includes(spellId)
      "
      >{{ controlText('game.actualTarget') }}<MapFieldPicker kind="entity"><select
        :value="modelValue.targetIds[0] ?? ''"
        @change="
          update({
            targetIds: ($event.target as HTMLSelectElement).value
              ? [($event.target as HTMLSelectElement).value]
              : [],
          })
        "
      >
        <option value="">
          {{ spellId === 'spiritual-weapon' ? controlText('expressionThree.noInitialAttackIncluded') : controlText('expressionThree.chooseAnActualCharacter') }}
        </option>
        <option
          v-for="t in view.scene?.tokens ?? []"
          :key="t.id"
          :value="t.characterId ?? t.npcId ?? t.actorId ?? t.id"
        >
          {{ localizedEntryName(t) }}
        </option>
      </select></MapFieldPicker></label
    >
    <template v-if="spellId === 'dragon-s-breath'"
      ><label
        >{{ controlText('interactionField.breathDamage') }}<select
          :value="modelValue.damageType"
          @change="
            update({
              damageType: ($event.target as HTMLSelectElement)
                .value as typeof modelValue.damageType,
            })
          "
        >
          <option value="acid">{{ controlText('domain.acid') }}</option>
          <option value="cold">{{ controlText('domain.cold') }}</option>
          <option value="fire">{{ controlText('domain.fire') }}</option>
          <option value="lightning">{{ controlText('domain.lightning') }}</option>
          <option value="poison">{{ controlText('configuration.poison') }}</option>
        </select></label
      ><label
        ><input
          type="checkbox"
          :checked="modelValue.willing"
          @change="update({ willing: ($event.target as HTMLInputElement).checked })"
        />{{ controlText('interactionField.actualTargetWillinglyAcceptsRecipientUsesLaterMagic') }}</label
      ></template
    >
    <p v-if="spellId === 'flame-blade'" class="muted">
      {{ controlText('adjudication.requiresAnActualFreeHandCreationIncludesNo') }}
    </p>
    <p v-if="spellId === 'heat-metal'" class="muted">
      {{ controlText('adjudication.theGmMustFirstRegisterActualManufacturedMetal') }}
    </p>
    <p v-if="spellId === 'spiritual-weapon'" class="muted">
      {{ controlText('adjudication.chooseADestinationWithin60FtTheInitial') }}
    </p>
  </fieldset>
</template>
<style scoped>
.m5-cast-fields {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.5rem;
}
.m5-cast-fields label {
  display: grid;
  gap: 0.25rem;
  margin: 0.4rem 0;
}
.m5-cast-fields label:has(input[type='checkbox']) {
  display: flex;
  align-items: center;
}
.m5-cast-fields select {
  max-width: 100%;
  min-width: 0;
}
</style>
