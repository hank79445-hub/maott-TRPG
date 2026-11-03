<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import type { Character } from '../core/types'
import type { Catalogue } from '../core/engine'
import { freeHandSlots } from '../core/equipment'
const props = defineProps<{
  character: Character
  content: Catalogue
  busy: boolean
  showChoice?: boolean
}>()
const kind = defineModel<'damage' | 'grapple' | 'prone' | 'push'>('kind', { default: 'damage' })
const save = defineModel<'str' | 'dex'>('save', { default: 'str' })
const hand = defineModel<'main-hand' | 'off-hand'>('hand', { default: 'main-hand' })
const skill = defineModel<'athletics' | 'acrobatics'>('skill', { default: 'athletics' })
const emit = defineEmits<{ release: [targetId: string]; escape: [sourceId: string] }>()
const free = computed(() => freeHandSlots(props.character, props.content))
const incoming = computed(() => props.character.runtime?.effects?.filter((f) => f.grapple) ?? [])
</script>
<template>
  <div class="unarmed-options">
    <template v-if="showChoice">
      <label
        >{{ controlText('remainingField.unarmedEffect') }}<select v-model="kind" :aria-label="controlText('remainingField.unarmedEffect')" :disabled="busy">
          <option value="damage">{{ controlText('resourceFlow.dealDamageAttackRoll') }}</option>
          <option value="grapple">{{ controlText('resourceFlow.grappleTargetSave') }}</option>
          <option value="prone">{{ controlText('resourceFlow.shoveProneTargetSave') }}</option>
          <option value="push">{{ controlText('resourceFlow.push5FtAwayTargetSave') }}</option>
        </select></label
      >
      <template v-if="kind !== 'damage'"
        ><label
          >{{ controlText('remainingField.targetChoosesSaveGmVerifies') }}<select
            v-model="save"
            :aria-label="controlText('remainingField.targetChoosesSave')"
            :disabled="busy"
          >
            <option value="str">{{ controlText('resourceFlow.strengthSave') }}</option>
            <option value="dex">{{ controlText('resourceFlow.dexteritySave') }}</option>
          </select></label
        >
        <label v-if="kind === 'grapple'"
          >{{ controlText('remainingField.grapplingHand') }}<select v-model="hand" :disabled="busy">
            <option value="main-hand" :disabled="!free.includes('main-hand')">
              {{ controlText('state.mainHand') }}{{ free.includes('main-hand') ? '' : controlText('expressionFour.occupied') }}
            </option>
            <option value="off-hand" :disabled="!free.includes('off-hand')">
              {{ controlText('state.otherHand') }}{{ free.includes('off-hand') ? '' : controlText('expressionFour.occupied') }}
            </option>
          </select></label
        >
        <small
          >{{ controlText('resourceFlow.noAttackOrDamageRollTheTargetMay') }}</small
        >
      </template>
    </template>
    <details v-if="character.runtime?.grapples?.length || incoming.length">
      <summary>{{ controlText('resourceFlow.grapplingAndEscape') }}</summary>
      <button
        v-for="g in character.runtime?.grapples"
        :key="g.encounterId + g.targetId"
        type="button"
        :disabled="busy"
        @click="emit('release', g.targetId)"
      >{{ controlText('scriptSummary.releaseGrappleNoActionRequired', {p0:(g.hand === 'main-hand' ? controlText('state.mainHand') : controlText('state.otherHand'))}) }}</button>
      <template v-if="incoming.length"
        ><label
          >{{ controlText('remainingField.escapeSkill') }}<select v-model="skill">
            <option value="athletics">{{ controlText('resourceFlow.strengthAthletics') }}</option>
            <option value="acrobatics">{{ controlText('resourceFlow.dexterityAcrobatics') }}</option>
          </select></label
        ><button
          v-for="f in incoming"
          :key="f.id"
          type="button"
          :disabled="busy"
          @click="emit('escape', f.sourceId)"
        >{{ controlText('scriptSummary.escapeGrappleActionDc', {p0:(f.grapple!.dc)}) }}
        </button></template
      >
    </details>
  </div>
</template>
<style scoped>
.unarmed-options {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.unarmed-options label {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.unarmed-options select {
  width: 100%;
  min-width: 0;
}
.unarmed-options small {
  color: var(--muted, #596970);
}
.unarmed-options details button {
  margin: 0.3rem 0;
}
</style>
