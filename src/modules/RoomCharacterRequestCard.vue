<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
import type { CharacterRequest } from '../core/character-request-types'
import type { RoomCommand, RoomView } from '../online/protocol'
import { catalogue } from '../core/engine'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import CharacterSheet from './CharacterSheet.vue'
import CharacterAvatar from './CharacterAvatar.vue'
const props = defineProps<{ request: CharacterRequest; view: RoomView; busy: boolean }>()
const emit = defineEmits<{ command: [RoomCommand] }>()
const reason = ref('GM 已核对建角、规则包及运行状态'),
  resetRuntime = ref(false)
const content = computed(() =>
  catalogue([
    ...BUILTIN_PACKS,
    ...props.view.packs,
    ...(props.request.archive?.packs ?? []).filter(
      (p) => !props.view.packs.some((x) => x.id === p.id),
    ),
  ]),
)
const player = computed(() => props.view.members.find((m) => m.id === props.request.sessionId))
function review(approve: boolean) {
  emit('command', {
    kind: 'character-review',
    requestId: props.request.id,
    approve,
    resetRuntime: resetRuntime.value,
    reason: reason.value.trim(),
  })
}
</script>
<template>
  <article class="room-character-request room-card" :data-request="request.id">
    <div class="room-row">
      <CharacterAvatar
        :name="request.summary.name"
        :portrait="request.archive?.character.portrait"
        :size="44"
      />
      <div>
        <h3>{{ controlText('quantity.level', {p0:(localizedEntryName(request.summary)),p1:(request.summary.level)}) }}</h3>
        <small
          >{{ player?.nickname ?? controlText('expressionThree.submitter') }} ·
          {{
            localizedEntryName(content.classes.find((c) => c.id === request.summary.classId)) ??
            request.summary.classId
          }}
          ·
          {{
            localizedEntryName(content.species.find((c) => c.id === request.summary.speciesId)) ??
            request.summary.speciesId
          }}</small
        >
      </div>
    </div>
    <p>
      {{ controlText('progressSummary.inventoryEntries', {p0:(controlText('domain.hp')),p1:(request.summary.hp ?? controlText('expressionThree.notInitialized')),p2:(request.summary.inventoryCount),p3:(request.summary.conditions.length
          ? controlText('expressionThree.state') + request.summary.conditions.join('、')
          : controlText('expressionThree.noAdditionalConditions'))}) }}
    </p>
    <p v-if="request.summary.custom" class="muted">
      {{ controlText('adjudication.containsCustomItemsGmAdjustmentsOrExpandedRule') }}
    </p>
    <details>
      <summary>{{ controlText('adjudication.rulePacksAndSubmissionSnapshot') }}</summary>
      <p>
        {{ request.summary.packs.map((p) => p.id + ' @ ' + p.version).join('；') || controlText('expressionThree.builtInRules') }}
      </p>
      <CharacterSheet
        v-if="request.archive"
        :character="request.archive.character"
        :content="content"
        playing
      />
    </details>
    <template v-if="request.status === 'pending' && view.self.role === 'gm'">
      <label class="check"
        ><input
          v-model="resetRuntime"
          type="checkbox"
          :disabled="busy"
        />{{ controlText('interactionField.initializeHpResourcesAndConditionsOnApproval') }}</label
      >
      <p class="muted">
        {{ controlText('adjudication.keepsSubmittedHpResourcesConditionsAndInventoryBy') }}
      </p>
      <label>{{ controlText('interactionField.characterRequestRulingNotes') }}<input v-model="reason" maxlength="3000" :disabled="busy" /></label>
      <div class="room-row">
        <button
          class="primary"
          :disabled="busy || !reason.trim() || !!player?.revoked || !player"
          @click="review(true)"
        >
          {{ controlText('adjudication.approveCharacterEntry') }}</button
        ><button class="secondary" :disabled="busy || !reason.trim()" @click="review(false)">
          {{ controlText('adjudication.rejectCharacterRequest') }}
        </button>
      </div>
      <p v-if="!player || player.revoked" class="error">{{ controlText('adjudication.theSubmitterSPermissionWasRevokedThisRequest') }}</p>
    </template>
    <template v-else
      ><p>{{ controlText('progressSummary.state', {p0:({ pending: controlText('finalField.awaitingGmReview'), approved: controlText('finalField.approved'), rejected: controlText('domain.rejected'), withdrawn: controlText('expressionThree.withdrawn') }[
            request.status
          ]),p1:(request.reason)}) }}
      </p>
      <button
        v-if="request.status === 'pending' && request.sessionId === view.self.id"
        class="secondary"
        :disabled="busy"
        @click="emit('command', { kind: 'character-withdraw', requestId: request.id })"
      >
        {{ controlText('adjudication.withdrawCharacterRequest') }}
      </button>
    </template>
  </article>
</template>
<style scoped>
.room-character-request {
  padding: 16px;
  min-width: 0;
}
.room-character-request h3 {
  margin: 0 0 4px;
}
.room-character-request small,
.room-character-request p {
  overflow-wrap: anywhere;
}
.room-character-request details {
  margin: 12px 0;
}
.room-character-request .check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
}
.room-character-request .check input {
  width: auto;
}
.room-character-request summary {
  cursor: pointer;
  padding: 8px 0;
}
</style>
