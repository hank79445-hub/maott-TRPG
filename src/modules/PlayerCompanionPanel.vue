<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { computed, ref } from 'vue'
import type { RoomView } from '../online/protocol'
import type { CombatCommand } from '../core/combat-types'
import { defaultEnvironment } from '../core/combat-rules'
const props = defineProps<{ view: RoomView; ownerId: string; busy: boolean }>()
const emit = defineEmits<{ execute: [command: CombatCommand] }>()
const companions = computed(
  () =>
    props.view.encounter?.actors.filter(
      (a) =>
        a.companion?.ownerId === props.ownerId &&
        !a.companion.dismissed &&
        ['spell-summon', 'primal-companion'].includes(a.companion.source),
    ) ?? [],
)
const target = ref(''),
  destination = ref({ x: 1, y: 1 }),
  attack = ref<Record<string, string>>({})
const allowed = computed(
  () => !props.busy && props.view.encounter?.phase === 'active' && !props.view.encounter?.pending,
)
function strike(id: string) {
  emit('execute', {
    type: 'attack',
    actorId: id,
    targetId: target.value,
    attackId: attack.value[id] || companions.value.find((a) => a.id === id)?.attacks[0]?.id || '',
    cost: 'action',
    env: defaultEnvironment(),
    sneak: false,
    mastery: false,
  })
}
</script>
<template>
  <section v-if="companions.length" class="room-combat-block" :aria-label="controlText('configurationField.companionOperations')">
    <h3>{{ controlText('workspace.companionsAndSpirits') }}</h3>
    <p class="muted">{{ controlText('workspace.primalCompanionsActOnTheirControllerSCommand') }}</p>
    <label
      >{{ controlText('domain.companionTarget') }}<MapFieldPicker kind="entity"><select v-model="target" :aria-label="controlText('domain.companionTarget')">
        <option value="">{{ controlText('game.choose') }}</option>
        <option v-for="a in view.encounter?.actors" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
      </select></MapFieldPicker></label
    >
    <article v-for="a in companions" :key="a.id">
      <b>{{ localizedEntryName(a) }} · HP {{ a.companion?.hp }} / {{ a.companion?.maxHp }}</b>
      <template v-if="a.companion?.spellId === 'summon-fey'"
        ><label
          >{{ controlText('game.feyStepX') }}<input
            v-model.number="destination.x"
            type="number"
            min="0"
            max="79"
            :aria-label="controlText('game.feyStepX')" /></label
        ><label
          >{{ controlText('game.landingYShort') }}<input
            v-model.number="destination.y"
            type="number"
            min="0"
            max="79"
            :aria-label="controlText('field.feyStepDestinationY')" /></label
        ><button
          :disabled="!allowed || !a.turn?.bonus || (a.companion.form === 'mirthful' && !target)"
          @click="
            emit('execute', {
              type: 'companion-power',
              actorId: a.id,
              targetId: a.companion!.form === 'mirthful' ? target : a.id,
              kind: 'fey-step',
              destination,
              env: defaultEnvironment(),
              note: '申请妖精步伐；请 GM 核对落点与形态效果',
            })
          "
        >{{ controlText('workspace.requestFeyStep') }}</button></template
      >
      <select v-model="attack[a.id]" :aria-label="localizedEntryName(a) + controlText('controls.attack')">
        <option value="">{{ controlText('workspace.defaultAttack') }}</option>
        <option v-for="w in a.attacks" :key="w.id" :value="w.id">
          {{ localizedEntryName(w) }} · {{ w.damage }}
        </option>
      </select>
      <button
        :disabled="
          !allowed || !target || !a.attacks.length || (!a.turn?.action && !a.turn?.attacksLeft)
        "
        @click="strike(a.id)"
      >{{ controlText('workspace.requestCompanionAttack') }}</button>
      <button
        :disabled="!allowed || !a.turn?.action"
        @click="
          emit('execute', { type: 'action', actorId: a.id, action: 'dodge', note: '伙伴回避' })
        "
      >{{ controlText('workspace.requestDodge') }}</button>
    </article>
  </section>
</template>
