<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { computed, ref, watch } from 'vue'
import type { Character } from '../core/types'
import type { RoomCommand, RoomView } from '../online/protocol'
import RequestDisclosure from './RequestDisclosure.vue'
import { useRequestDisclosure } from './useRequestDisclosure'
import RoomCharacterRequestCard from './RoomCharacterRequestCard.vue'
const props = withDefaults(
  defineProps<{
    view: RoomView
    busy: boolean
    localCharacters?: Character[]
    exportArchive?: (c: Character) => string
    reviewOnly?: boolean
    submitCommand?: (command: RoomCommand) => Promise<boolean>
  }>(),
  { localCharacters: () => [], reviewOnly: false },
)
const emit = defineEmits<{ command: [RoomCommand]; workshop: [] }>()
const selected = ref(''),
  error = ref('')
const eligible = computed(() =>
  props.localCharacters.filter(
    (c) => c.status === 'complete' && c.purpose !== 'npc' && !c.npcOwnerId,
  ),
)
const requests = computed(() =>
  (props.view.characterRequests ?? [])
    .filter((r) => !props.reviewOnly || r.status === 'pending')
    .slice()
    .reverse(),
)
watch(
  eligible,
  (list) => {
    if (!list.some((c) => c.id === selected.value)) selected.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
async function submit() {
  error.value = ''
  const c = eligible.value.find((c) => c.id === selected.value)
  if (!c || !props.exportArchive) return
  try {
    const archive = JSON.parse(props.exportArchive(c))
    if (new TextEncoder().encode(JSON.stringify(archive)).byteLength > 4 * 1024 * 1024)
      throw new Error('角色档案超过 4 MiB，请精简扩展规则包后提交')
    const ticket = disclosure.ticket()
    if (props.submitCommand)
      disclosure.acknowledge(
        await props.submitCommand({ kind: 'character-submit', archive }),
        ticket,
      )
    else emit('command', { kind: 'character-submit', archive })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
const duplicate = computed(() =>
  (props.view.characterRequests ?? []).some(
    (r) =>
      r.sessionId === props.view.self.id &&
      r.sourceId === selected.value &&
      (r.status === 'pending' ||
        (r.status === 'approved' && props.view.ownCharacters.some((c) => c.id === r.characterId))),
  ),
)
const disclosure = useRequestDisclosure(
  () => `${props.view.id}:${props.view.self.id}`,
  () => requests.value.length > 0,
)
const summary = computed(() => {
  const r = requests.value[0]
  return r
    ? `${r.summary.name} · ${{ pending: '待 GM 审核', approved: '已批准', rejected: '已拒绝', withdrawn: '已撤回' }[r.status]} · ${r.id}`
    : ''
})
</script>
<template>
  <section class="character-requests" :aria-label="controlText('interactionField.characterSubmissionAndReview')">
    <template v-if="!reviewOnly && view.self.role === 'player'">
      <div class="room-card">
        <RequestDisclosure
          v-model="disclosure.open.value"
          :title="controlText('interactionField.submitMyCharacter')"
          :summary="summary"
          :busy="busy"
        >
          <p>
            {{ controlText('adjudication.chooseACompletedCharacterFromThisBrowserS') }}
          </p>
          <label
            >{{ controlText('interactionField.localWorkshopCharacter') }}<select v-model="selected" :disabled="busy || !eligible.length">
              <option v-if="!eligible.length" value="">{{ controlText('adjudication.noCompletedPlayerCharactersYet') }}</option>
              <option v-for="c in eligible" :key="c.id" :value="c.id">
                {{ controlText('quantity.level', {p0:(localizedEntryName(c.build) || controlText('expressionThree.unnamedCharacter')),p1:(c.level)}) }}</option>
            </select></label
          >
          <div class="room-row">
            <button class="primary" :disabled="busy || !selected || duplicate" @click="submit">
              {{ controlText('adjudication.submitCharacterToGm') }}</button
            ><button class="secondary" @click="emit('workshop')">{{ controlText('adjudication.openCharacterWorkshop') }}</button>
          </div>
          <p v-if="duplicate" class="muted">
            {{ controlText('adjudication.thisCharacterIsPendingReviewOrAlreadyIn') }}
          </p>
          <p v-if="error" class="error" role="alert">{{ displayFeedback(error,'error') }}</p>
        </RequestDisclosure>
      </div>
    </template>
    <h3 v-if="requests.length">
      {{ view.self.role === 'gm' ? controlText('expressionThree.playerCharacterRequest') : controlText('expressionThree.myCharacterRequest') }} · {{ requests.length }}
    </h3>
    <RoomCharacterRequestCard
      v-for="request in requests"
      :key="request.id"
      :request="request"
      :view="view"
      :busy="busy"
      @command="emit('command', $event)"
    />
    <p v-if="!requests.length && !reviewOnly" class="muted">{{ controlText('adjudication.noCharacterRequestsYet') }}</p>
  </section>
</template>
<style scoped>
.character-requests {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.character-requests > h3 {
  margin: 8px 0;
}
</style>
