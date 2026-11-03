<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, shallowRef, watch } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
import type { ReviewSettings } from '../persistence/gm-review-schema'
import PracticalReviewSettings from './review/PracticalReviewSettings.vue'
import PracticalReviewHistory from './review/PracticalReviewHistory.vue'
const props = defineProps<{ view: RoomView; busy: boolean; compact?: boolean }>()
const emit = defineEmits<{ command: [value: RoomCommand] }>()
const fallback: ReviewSettings = {
  mode: 'human',
  paused: false,
  fixedInteractions: false,
  npcDialogue: true,
  narration: true,
  modelRef: '',
  maxConcurrent: 1,
  queueLimit: 20,
  timeoutSeconds: 45,
  revision: 0,
}
const live = computed(() => props.view.gmReview?.settings ?? fallback),
  draft = shallowRef({ ...fallback })
watch(
  () => props.view.id + ':' + live.value.revision,
  () => {
    draft.value = {
      ...live.value,
      npcDialogue: live.value.npcDialogue ?? true,
      narration: live.value.narration ?? true,
    }
  },
  { immediate: true },
)
const modelAvailable = computed(() =>
  live.value.modelRef
    ? props.view.ai.modelProfiles?.some((m) => m.name === live.value.modelRef)
    : props.view.ai.model.configured,
)
const names = { human: '真人审核', shadow: '影子审核', assisted: '辅助审核' }
function save(settings: ReviewSettings) {
  const { revision, ...value } = settings
  emit('command', { kind: 'gm-review-config', settings: value })
}
const history = computed(() =>
  (props.view.gmReview?.jobs ?? [])
    .filter((j) => !['queued', 'running'].includes(j.status))
    .slice(-30)
    .reverse(),
)
const statusNames: Record<string, string> = {
  queued: '排队',
  running: '分析中',
  suggested: '影子建议',
  escalated: '交GM',
  executed: '已执行',
  'waiting-dice': '等待实体骰',
  stale: '已失效',
}
</script>
<template>
  <section v-if="view.self.role === 'gm'" class="review-settings" :aria-label="controlText('interactionField.assistedReviewModeSettings')">
    <div class="review-mode-bar">
      <strong>{{ uiLabel(names[live.mode]) }}{{ live.paused ? controlText('expressionThree.paused') : '' }}</strong>
      <label v-if="!compact"
        >{{ controlText('domain.reviewMode') }}<select
          :aria-label="controlText('domain.reviewMode')"
          :value="live.mode"
          :disabled="busy"
          @change="
            save({
              ...draft,
              mode: ($event.target as HTMLSelectElement).value as ReviewSettings['mode'],
            })
          "
        >
          <option value="human">{{ controlText('state.humanReview') }}</option>
          <option value="shadow">{{ controlText('adjudication.shadowReviewSuggestionsOnly') }}</option>
          <option value="assisted">{{ controlText('adjudication.assistedReviewLimitedExecution') }}</option>
        </select></label
      >
      <button
        v-if="live.mode !== 'human'"
        :disabled="busy"
        @click="save({ ...live, paused: !live.paused })"
      >
        {{ live.paused ? controlText('expressionThree.resumeAutomaticReview') : controlText('expressionThree.pauseAutomaticReview') }}
      </button>
    </div>
    <template v-if="!compact">
      <PracticalReviewSettings :settings="live" :busy="busy" @save="save" />
      <PracticalReviewHistory :view="view" />
      <p v-if="live.mode !== 'human' && !modelAvailable" class="muted" role="status">
        {{ controlText('adjudication.theReviewModelIsNotReadyModelDependent') }}
      </p>
      <p v-if="!live.practical?.enabled" class="muted">
        {{ controlText('adjudication.onlyNewRequestsEnterThisChannelSendQueued') }}
      </p>
      <p class="muted">
        {{ controlText('adjudication.settingsBelongToThisRoomEnableThemSeparately') }}
      </p>
      <details>
        <summary>{{ controlText('adjudication.categoriesModelAndReviewPolicy') }}</summary>
        <details>
          <summary>{{ controlText('adjudication.individuallyAuthorizedInteractions') }}</summary>
          <ul>
            <template v-for="scene in view.world?.adventures[0]?.scenes ?? []" :key="scene.id"
              ><li v-for="p in scene.points.filter((p) => p.assistedReview?.enabled)" :key="p.id">
                {{ controlText('progressSummary.serverPreflightStillRequired', {p0:(localizedEntryName(scene)),p1:(localizedEntryName(p)),p2:(p.assistedReview?.method === 'program' ? controlText('expressionThree.program') : controlText('expressionThree.model'))}) }}</li></template
            >
          </ul>
        </details>
        <label
          ><input
            v-model="draft.fixedInteractions"
            type="checkbox"
          />{{ controlText('interactionField.allowIndividuallyAuthorizedFixedExplorationInteractions') }}</label
        >
        <label
          ><input v-model="draft.npcDialogue" type="checkbox" />{{ controlText('interactionField.independentReviewOfPublicImportantNpcSafeDialogue') }}</label
        >
        <label><input v-model="draft.narration" type="checkbox" />{{ controlText('interactionField.independentPublicNarrationReview') }}</label>
        <p class="muted">
          {{ controlText('adjudication.categoryExemptionsAndIndependentAiReviewWorkSeparately') }}
        </p>
        <p class="muted">
          {{ controlText('adjudication.checksPublicDialogueOnlyActionProposalsRemainWith') }}
        </p>
        <p class="muted">
          {{ controlText('adjudication.npcReviewRecordsTimingAndManualReferralReasons') }}
        </p>
        <label
          >{{ controlText('domain.reviewModel') }}<select v-model="draft.modelRef" :aria-label="controlText('domain.reviewModel')">
            <option value="">{{ controlText('adjudication.existingDefaultModel') }}</option>
            <option v-for="m in view.ai.modelProfiles ?? []" :key="m.name" :value="m.name">
              {{ localizedEntryName(m) }} · {{ m.model }}
            </option>
          </select></label
        >
        <p class="muted">
          {{ controlText('adjudication.manageModelsInAiConfigurationProgramOnlyPaths') }}
        </p>
        <div class="review-limits">
          <label
            >{{ controlText('interactionField.concurrentCalls') }}<input v-model.number="draft.maxConcurrent" type="number" min="1" max="3"
          /></label>
          <label
            >{{ controlText('interactionField.queueLimit') }}<input v-model.number="draft.queueLimit" type="number" min="1" max="50"
          /></label>
          <label
            >{{ controlText('interactionField.timeoutInSeconds') }}<input v-model.number="draft.timeoutSeconds" type="number" min="5" max="180"
          /></label>
        </div>
        <p>{{ controlText('progressSummary.policy', {p0:(view.gmReview?.skill?.id ?? 'conservative-exploration/1'),p1:(view.gmReview?.skill?.id==='conservative-exploration/1'?uiLabel(view.gmReview.skill.description):view.gmReview?.skill?.description)}) }}
        </p>
        <p class="muted">
          {{ controlText('adjudication.alsoAuthorizeTheMapInteractionAndFillIts') }}
        </p>
        <button :disabled="busy" @click="save({ ...draft, mode: live.mode, paused: live.paused })">
          {{ controlText('adjudication.saveAssistedReviewSettings') }}
        </button>
      </details>
      <details>
        <summary>{{ controlText('progressSummary.automaticHandlingAndShadowReviewRecords', {p0:(history.length)}) }}</summary>
        <p v-if="!history.length">{{ controlText('adjudication.noRecordsYet') }}</p>
        <article v-for="j in history" :key="j.id" class="review-history">
          <strong
            >{{ view.intents.find((i) => i.id === j.intentId)?.summary ?? controlText('expressionThree.pastRequests') }} ·
            {{ uiLabel(statusNames[j.status]) }}</strong
          >
          <p>{{ j.reason }}</p>
          <p v-if="j.output">{{ controlText('progressSummary.suggestionBasis', {p0:(j.output.decision),p1:(j.output.reason),p2:(j.output.evidenceIds.join('、'))}) }}
          </p>
          <small
            >{{ controlText('domain.policyVersion') }}{{ j.policyRevision }} · {{ j.model ?? controlText('expressionThree.noCallsYet') }} ·
            {{ j.durationMs ?? 0 }}ms · token {{ j.tokens ?? controlText('dialogueReview.notReported')
            }}{{ j.gmDecision ? ' · GM：' + j.gmDecision : '' }}</small
          >
          <p v-if="j.feedback">{{ controlText('progressSummary.marked', {p0:(j.feedback === 'wrong' ? controlText('expressionThree.incorrectSuggestion') : controlText('expressionThree.insufficientBasis'))}) }}</p>
          <div v-else>
            <button
              :disabled="busy"
              @click="
                emit('command', {
                  kind: 'gm-review-control',
                  intentId: j.intentId,
                  jobId: j.id,
                  operation: 'wrong',
                })
              "
            >
              {{ controlText('adjudication.markSuggestionIncorrect') }}</button
            ><button
              :disabled="busy"
              @click="
                emit('command', {
                  kind: 'gm-review-control',
                  intentId: j.intentId,
                  jobId: j.id,
                  operation: 'missing',
                })
              "
            >
              {{ controlText('adjudication.markInsufficientBasis') }}
            </button>
          </div>
        </article>
      </details>
    </template>
  </section>
</template>
<style scoped>
.review-settings {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
  margin: 10px 0;
}
.review-mode-bar,
.review-limits {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.review-settings select,
.review-settings input[type='number'] {
  max-width: 100%;
  min-height: 42px;
}
.review-settings details {
  margin-top: 12px;
}
.review-settings label {
  display: block;
  margin: 8px 0;
}
.review-settings button {
  min-height: 42px;
}
.review-limits input {
  width: 90px;
}
.review-history {
  border-top: 1px solid var(--line);
  padding: 10px 0;
  overflow-wrap: anywhere;
}
.review-history p {
  margin: 6px 0;
}
</style>
