<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { shallowRef } from 'vue'
import type { AiView } from '../core/ai-types'
import type { RoomCommand } from '../online/protocol'
const props = defineProps<{ job: AiView['jobs'][number]; busy: boolean }>()
const emit = defineEmits<{ command: [command: RoomCommand] }>()
const check = shallowRef<'none' | 'roll'>('none'),
  skill = shallowRef('persuasion'),
  dc = shallowRef(15),
  cost = shallowRef<'action' | 'none'>('action'),
  reason = shallowRef('GM已核对影响条件；不以检定强迫NPC接受要求')
function adjudicate() {
  emit('command', {
    kind: 'npc-talk-review',
    jobId: props.job.id,
    approve: true,
    check: check.value,
    skill: skill.value,
    dc: dc.value,
    cost: cost.value,
    cooldownHours: 24,
    ignoreCooldown: false,
    reason: reason.value,
    constraints: '',
  })
}
</script>
<template>
  <section class="room-card" :aria-label="controlText('configurationField.npcProposedNegotiationRuling')">
    <strong>{{ controlText('configuration.dialogueIsPublicConfirmNegotiationConditionsBeforeExecuting') }}</strong>
    <p>{{ controlText('liveSummary.modelSuggestionOnlyNoDiceRolled', {p0:(job.checkSuggestion?.reason)}) }}</p>
    <label
      >{{ controlText('configurationField.checkRequired') }}<select v-model="check">
        <option value="none">{{ controlText('configuration.noCheckNeeded') }}</option>
        <option value="roll">{{ controlText('configuration.makeAnInfluenceCheck') }}</option>
      </select></label
    >
    <label
      >{{ controlText('game.combatCost') }}<select v-model="cost">
        <option value="action">{{ controlText('game.influenceAction') }}</option>
        <option value="none">{{ controlText('configuration.gmExplicitlyWaivesActionCost') }}</option>
      </select></label
    >
    <template v-if="check === 'roll'">
      <label
        >{{ controlText('game.skill') }}<select v-model="skill">
          <option value="persuasion">{{ controlText('game.persuasion') }}</option>
          <option value="deception">{{ controlText('game.deception') }}</option>
          <option value="intimidation">{{ controlText('game.intimidation') }}</option>
          <option value="performance">{{ controlText('game.performance') }}</option>
          <option value="animal-handling">{{ controlText('domain.animalHandling') }}</option>
        </select></label
      >
      <label>DC<input v-model.number="dc" type="number" min="1" max="100" /></label>
    </template>
    <label>{{ controlText('game.basis') }}<input v-model="reason" maxlength="2000" /></label>
    <button :disabled="busy || !reason.trim()" @click="adjudicate">{{ controlText('configuration.confirmConditionsWithoutRegeneratingDialogue') }}</button>
    <p class="muted">{{ controlText('configuration.freeExplorationSpendsNoCombatActionACheck') }}</p>
  </section>
</template>
