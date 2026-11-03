<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { computed, ref, watch } from 'vue'
import type { Combatant, CombatCommand, PendingAction } from '../core/combat-types'
import { abilityAvailable } from '../core/npc-abilities'
const props = defineProps<{ pending: PendingAction; actors: Combatant[]; busy: boolean }>()
const emit = defineEmits<{ command: [CombatCommand] }>()
const confirmed = ref(false)
const note = ref('')
const manual = computed(() =>
  props.actors.flatMap((actor) =>
    (actor.npc?.abilities ?? [])
      .filter(
        (a) =>
          a.cost === 'reaction' &&
          a.support === 'gm' &&
          (a.reaction === 'counterspell'
            ? !!props.pending.spellId
            : props.pending.targets.some((t) => t.id === actor.id && t.hit)),
      )
      .map((ability) => ({ actor, ability })),
  ),
)
watch(
  () => props.pending,
  () => {
    confirmed.value = false
  },
)
function use(actorId: string, abilityId: string, targetIndex: number, manualOnly = false) {
  emit('command', {
    type: 'npc-reaction',
    actorId,
    abilityId,
    targetIndex,
    confirmed: confirmed.value,
    note: manualOnly ? note.value : 'GM确认持武器、命中及反应触发条件',
  })
}
</script>
<template>
  <details
    v-if="
      pending.targets.some((t) =>
        actors.find((a) => a.id === t.id)?.npc?.abilities?.some((a) => a.cost === 'reaction'),
      ) || manual.length
    "
    class="battle-card"
  >
    <summary>{{ controlText('configuration.monsterDefensiveReactions') }}</summary>
    <label class="check"><input v-model="confirmed" type="checkbox" />{{ controlText('configurationField.gmConfirmsReactionTriggerCounterspellRequiresAVisible') }}</label>
    <template v-for="(t, i) in pending.targets" :key="i">
      <template
        v-for="a in actors
          .find((a) => a.id === t.id)
          ?.npc?.abilities?.filter((a) => a.cost === 'reaction') ?? []"
        :key="a.id"
      >
        <p v-if="!['parry', 'shield'].includes(a.reaction ?? '')" class="muted">
          {{ controlText('liveSummary.complexGmReactionNotAutomatic', {p0:(localizedEntryName(a)),p1:(a.note)}) }}</p>
        <button
          v-else
          :disabled="
            busy ||
            !!pending.damageRolled ||
            !confirmed ||
            !actors.find((a) => a.id === t.id)?.turn.reaction ||
            !abilityAvailable(actors.find((a) => a.id === t.id)!.npc!, a.id)
          "
          @click="use(t.id, a.id, i)"
        >
          {{ localizedEntryName(actors.find((a) => a.id === t.id)?.npc) }} · {{ localizedEntryName(a) }}
        </button>
      </template>
    </template>
    <template v-if="manual.length">
      <label
        >{{ controlText('configurationField.complexReactionRulingNotes') }}<input
          v-model="note"
          maxlength="2000"
          :placeholder="controlText('configurationField.verifyTargetDistanceSightComponentsAndFollowUp')"
      /></label>
      <div v-for="m in manual" :key="m.actor.id + ':' + m.ability.id">
        <p>{{ localizedEntryName(m.ability) }}：{{ m.ability.note }}</p>
        <button
          :disabled="
            busy ||
            !!pending.damageRolled ||
            !confirmed ||
            !note.trim() ||
            !m.actor.turn.reaction ||
            !abilityAvailable(m.actor.npc!, m.ability.id)
          "
          @click="
            use(
              m.actor.id,
              m.ability.id,
              Math.max(
                0,
                pending.targets.findIndex((t) => t.id === m.actor.id),
              ),
              true,
            )
          "
        >{{ controlText('liveSummary.registerGmConfirmsTrigger', {p0:(localizedEntryName(m.actor.npc!)),p1:(localizedEntryName(m.ability))}) }}</button>
      </div>
      <small
        >{{ controlText('configuration.counterspellUsesThe2024ConstitutionSaveFailureInterrupts') }}</small
      >
    </template>
    <p class="muted">{{ controlText('configuration.resolveBeforeRollingDamageSharesTheReactionAnd') }}</p>
  </details>
</template>
