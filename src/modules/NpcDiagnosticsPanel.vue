<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {uiDate} from './locale-format'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
import { responseNames } from '../core/npc-activity'
const props = defineProps<{ view: RoomView; busy: boolean }>(),
  emit = defineEmits<{ command: [RoomCommand] }>()
const npcs = computed(
  () =>
    props.view.world?.adventures[0]?.ai?.npcs.filter(
      (n) => n.npcType === 'important' && n.sceneId === props.view.scene?.id,
    ) ?? [],
)
const npcId = ref(''),
  mode = ref<'event' | 'template'>('template'),
  eventId = ref(''),
  templateId = ref(''),
  characterId = ref('')
const npc = computed(() => npcs.value.find((n) => n.id === npcId.value))
const events = computed(
  () =>
    props.view.world?.adventures[0]?.broadcastLog?.events
      .filter(
        (e) =>
          e.branchId === props.view.broadcast.branchId &&
          e.sceneId === props.view.scene?.id &&
          e.phase === 'confirmed' &&
          e.audience.kind === 'public',
      )
      .slice(-80)
      .reverse() ?? [],
)
watch(
  () => npcs.value.map((n) => n.id).join('|'),
  () => {
    if (!npcs.value.some((n) => n.id === npcId.value)) npcId.value = npcs.value[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => [npc.value?.id, ...(npc.value?.activity.templates ?? []).map((t) => t.id)],
  () => {
    if (!npc.value?.activity.templates?.some((t) => t.id === templateId.value))
      templateId.value = npc.value?.activity.templates?.[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => props.view.characters.map((c) => c.id).join('|'),
  () => {
    if (!props.view.characters.some((c) => c.id === characterId.value))
      characterId.value = props.view.characters[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => events.value.map((e) => e.id).join('|'),
  () => {
    if (!events.value.some((e) => e.id === eventId.value)) eventId.value = events.value[0]?.id ?? ''
  },
  { immediate: true },
)
const ready = computed(
  () =>
    !!npcId.value &&
    (mode.value === 'event' ? !!eventId.value : !!templateId.value && !!characterId.value),
)
function run(test: boolean) {
  emit('command', {
    kind: test ? 'npc-activity-test' : 'npc-activity-check',
    npcId: npcId.value,
    source:
      mode.value === 'event'
        ? { kind: 'event', eventId: eventId.value }
        : { kind: 'template', templateId: templateId.value, characterId: characterId.value },
  })
}
</script>
<template>
  <details class="room-card diagnostics" v-if="view.self.role === 'gm'">
    <summary>{{ controlText('configuration.gmNpcTriggerDiagnosticsAndTests') }}</summary>
    <p class="muted">
      {{ controlText('adjudication.conditionChecksDoNotCallAModelDraft') }}
    </p>
    <div class="diagnostic-grid">
      <label
        >{{ controlText('configurationField.npcToDiagnose') }}<select v-model="npcId">
          <option value="">{{ controlText('game.choose') }}</option>
          <option v-for="n in npcs" :key="n.id" :value="n.id">{{ localizedEntryName(n) }}</option>
        </select></label
      ><label
        >{{ controlText('configurationField.checkSource') }}<select v-model="mode">
          <option value="template">{{ controlText('configuration.simulatedFutureOutcomeNotYetOccurred') }}</option>
          <option value="event">{{ controlText('configuration.actualConfirmedEvent') }}</option>
        </select></label
      >
    </div>
    <label v-if="mode === 'event'"
      >{{ controlText('configurationField.sourceEvent') }}<select v-model="eventId">
        <option value="">{{ controlText('game.choose') }}</option>
        <option v-for="e in events" :key="e.id" :value="e.id">
          {{ e.title }} · {{ e.text.slice(0, 60) }}
        </option>
      </select></label
    >
    <div v-else class="diagnostic-grid">
      <label
        >{{ controlText('configurationField.responseTemplateToTest') }}<select v-model="templateId">
          <option value="">{{ controlText('game.choose') }}</option>
          <option v-for="t in npc?.activity.templates ?? []" :key="t.id" :value="t.id">
            {{ uiLabel(responseNames[t.type]) }} · {{ t.enabled ? controlText('controls.enable') : controlText('controls.disable') }}
          </option>
        </select></label
      ><label
        >{{ controlText('configurationField.simulatedParticipant') }}<select v-model="characterId">
          <option v-for="c in view.characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
        </select></label
      >
    </div>
    <p v-if="mode === 'template'" class="muted">
      {{ controlText('adjudication.buildsTestAssumptionsFromConfiguredStoryLinksOr') }}
    </p>
    <div class="room-row">
      <button :disabled="busy || !ready" @click="run(false)">{{ controlText('configuration.checkTriggerConditionsNoModelCall') }}</button
      ><button :disabled="busy || !ready" @click="run(true)">{{ controlText('configuration.generateTestDraftCallsModel') }}</button>
    </div>
    <details>
      <summary>{{ controlText('configuration.recentTriggerHistoryUpTo200') }}</summary>
      <article
        v-for="d in [...(view.ai.activityDiagnostics ?? [])]
          .filter((d) => d.npcId === npcId && d.branchId === view.broadcast.branchId)
          .slice(-20)
          .reverse()"
        :key="d.id"
        class="diagnostic-row"
      >
        <strong>{{ d.status }} · {{ d.reason }}</strong>
        <p>{{ controlText('liveSummary.subject', {p0:(localizedEntryName(view.characters.find((c) => c.id === d.characterId)) ?? controlText('expressionTwo.notSelected')),p1:(uiDate(d.at,'datetime'))}) }}
        </p>
        <p v-for="id in d.eventIds" :key="id" class="prose">
          {{
            view.world?.adventures[0]?.broadcastLog?.events.find((e) => e.id === id)?.text ??
            controlText('expressionTwo.sourceLeftRetainedBroadcastWindow')
          }}
        </p>
      </article>
    </details>
    <article
      v-for="j in view.ai.jobs.filter(
        (j) => j.activityTest && !j.historical && j.npcId === npcId && j.status !== 'canceled',
      )"
      :key="j.id"
      class="diagnostic-row"
    >
      <h3>{{ controlText('liveSummary.testDraft', {p0:(j.status)}) }}</h3>
      <p class="prose">{{ j.text || controlText('expressionTwo.waitingForModelResponse') }}</p>
      <p v-if="j.error" role="status">{{ displayFeedback(j.error,'error') }}</p>
      <details v-if="j.inputReport">
        <summary>{{ controlText('configuration.actualModelInputAndSelectionReport') }}</summary>
        <p>{{ controlText('liveSummary.estimatedIncludingOutputMemoriesIncludedExcluded', {p0:(j.inputReport.estimatedTokens),p1:(j.inputReport.budget ?? controlText('room.unlimited')),p2:(j.inputReport.outputTokens ?? controlText('expressionTwo.serviceDefault')),p3:(j.inputReport.selectedIds.length),p4:(j.inputReport.omittedIds.length)}) }}</p>
        <pre>{{ j.inputReport.preview }}</pre>
      </details>
      <button
        class="subtle"
        :disabled="busy"
        @click="emit('command', { kind: 'npc-test-cancel', jobId: j.id })"
      >
        {{ controlText('configuration.closeThisTest') }}
      </button>
    </article>
  </details>
</template>
<style scoped>
.diagnostics label {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}
.diagnostics select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.diagnostic-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.diagnostic-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--border, #ddd);
}
.diagnostics pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 420px;
  overflow: auto;
  max-width: 100%;
}
.prose {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.room-row {
  flex-wrap: wrap;
}
summary {
  cursor: pointer;
}
@media (max-width: 540px) {
  .diagnostic-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
