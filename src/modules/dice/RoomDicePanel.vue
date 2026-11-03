<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import type { RoomCommand, RoomView } from '../../online/protocol'
const props = defineProps<{ view: RoomView; busy: boolean; settings?: boolean }>()
const emit = defineEmits<{ command: [RoomCommand] }>()
const gm = computed(() => props.view.self.role === 'gm'),
  pending = computed(() => props.view.dice?.pending ?? [])
const faces = ref<Record<string, (number | string)[]>>({}),
  reason = ref('')
watch(
  () => pending.value.map((p) => p.id + ':' + p.step).join('|'),
  () => {
    faces.value = Object.fromEntries(
      pending.value.map((p) => [p.id, p.draft.length ? [...p.draft] : p.sides.map(() => '')]),
    )
  },
  { immediate: true },
)
const valid = (id: string, sides: number[]) =>
  sides.every(
    (s, i) =>
      Number.isInteger(Number(faces.value[id]?.[i])) &&
      Number(faces.value[id]?.[i]) >= 1 &&
      Number(faces.value[id]?.[i]) <= s,
  )
function draft(id: string) {
  const values: number[] = []
  for (const f of faces.value[id] ?? []) {
    if (f === '') break
    values.push(Number(f))
  }
  emit('command', { kind: 'dice-draft', id, faces: values })
}
</script>
<template>
  <section class="dice-panel" :aria-label="controlText('domain.physicalDice')">
    <details v-if="settings && gm">
      <summary>{{ controlText('quantity.diceSource', {p0:(view.dice?.mode === 'manual' ? controlText('operations.gmPhysicalDiceInput') : controlText('domain.autoDice'))}) }}</summary>
      <label
        >{{ controlText('field.roomDiceSource') }}<select
          :value="view.dice?.mode ?? 'automatic'"
          :disabled="busy"
          @change="
            emit('command', {
              kind: 'dice-config',
              mode: ($event.target as HTMLSelectElement).value as 'automatic' | 'manual',
            })
          "
        >
          <option value="automatic">{{ controlText('domain.autoDice') }}</option>
          <option value="manual">{{ controlText('operations.gmPhysicalDiceInput') }}</option>
        </select></label
      >
      <p class="muted">{{ controlText('operations.switchingAffectsNewRequestsStartedDiceGroupsRetain') }}</p>
    </details>
    <article v-for="p in pending" :key="p.id" class="dice-request">
      <strong>{{ p.label }} <small v-if="p.npc">{{ controlText('operations.npcTurn') }}</small></strong>
      <p class="muted">
        {{ controlText('quantity.waitingDice', {p0:(localizedEntryName(view.characters.find((c) => c.id === p.characterId)) ?? controlText('expressionOne.roomAction')),p1:(p.sides.map((s) => 'd' + s).join(' + '))}) }}</p>
      <p
        v-if="
          p.stale ||
          p.worldRevision !== view.worldRevision ||
          p.branchId !== view.broadcast.branchId
        "
        class="error"
      >
        {{ controlText('operations.worldPermissionsEnvironmentOrSavedStateChangedCancel') }}
      </p>
      <template v-if="gm">
        <div class="dice-face-inputs">
          <label v-for="(s, i) in p.sides" :key="i"
            >{{ i + 1 }} · d{{ s
            }}<input
              v-model.number="faces[p.id]![i]"
              type="number"
              :min="1"
              :max="s"
              step="1"
              inputmode="numeric"
              :aria-label="controlText('inlineSummary.dieDRawValue',{p0:(i + 1),p1:(s)})"
          /></label>
        </div>
        <div class="room-row">
          <button
            :disabled="
              busy || p.stale || !valid(p.id, p.sides) || p.worldRevision !== view.worldRevision
            "
            @click="
              emit('command', { kind: 'dice-input', id: p.id, faces: faces[p.id]!.map(Number) })
            "
          >
            {{ controlText('operations.confirmDieFacesAndContinue') }}</button
          ><button class="subtle" :disabled="busy" @click="draft(p.id)">{{ controlText('operations.saveInput') }}</button>
        </div>
        <details>
          <summary>{{ controlText('operations.singleRequestExceptionCancel') }}</summary>
          <label>{{ controlText('field.operationReason') }}<input v-model="reason" maxlength="2000" /></label>
          <div class="room-row">
            <button
              :disabled="busy || !reason.trim()"
              @click="emit('command', { kind: 'dice-auto', id: p.id, reason })"
            >
              {{ controlText('operations.useAutomaticDiceForThisRequest') }}</button
            ><button
              class="subtle"
              :disabled="busy || !reason.trim()"
              @click="emit('command', { kind: 'dice-cancel', id: p.id, reason })"
            >
              {{ controlText('operations.cancelUnexecutedRequest') }}
            </button>
          </div>
          <small>{{ controlText('operations.previouslyConfirmedActionsAreNotAutomaticallyUndone') }}</small>
        </details>
      </template>
    </article>
  </section>
</template>
<style scoped>
.dice-panel {
  display: grid;
  gap: 12px;
}
.dice-request {
  border: 1px solid var(--line, #ccd5d4);
  border-radius: 10px;
  padding: 12px;
  display: grid;
  gap: 8px;
}
.dice-request p {
  margin: 0;
}
.dice-face-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dice-face-inputs label {
  width: 88px;
  display: grid;
  gap: 4px;
}
.dice-face-inputs input {
  font-size: 22px;
  text-align: center;
  min-height: 44px;
}
.dice-panel select,
.dice-panel button {
  min-height: 44px;
}
.dice-panel details {
  margin-top: 4px;
}
</style>
