<script setup lang="ts">
import {uiLabel} from './ui-label'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
const props = defineProps<{ view: RoomView; intentId: string; busy: boolean }>()
const emit = defineEmits<{ command: [value: RoomCommand] }>()
const job = computed(() =>
  [...(props.view.gmReview?.jobs ?? [])].reverse().find((j) => j.intentId === props.intentId),
)
const status = computed(
  () =>
    [...(props.view.gmReview?.statuses ?? [])].reverse().find((j) => j.intentId === props.intentId)
      ?.status,
)
const pending = computed(() =>
  props.view.intents.some((i) => i.id === props.intentId && i.status === 'pending'),
)
const names: Record<string, string> = {
  queued: '等待辅助审核',
  running: '辅助审核中',
  suggested: '影子建议，等待GM',
  escalated: '等待GM审核',
  executed: '已按规则执行',
  'waiting-dice': '等待GM输入实体骰',
  stale: '条件已变化，等待GM',
}
</script>
<template>
  <div class="review-evidence">
    <p v-if="status" role="status">{{ uiLabel(names[status]) }}</p>
    <template v-if="view.self.role === 'gm'">
      <details v-if="job">
        <summary>{{ controlText('adjudication.assistedReviewBasis') }}</summary>
        <p>{{ job.reason }}</p>
        <p v-if="job.output">{{ controlText('progressSummary.suggestion', {p0:(job.output.decision),p1:(job.output.reason)}) }}</p>
        <p v-if="job.output">{{ controlText('progressSummary.basisMissing', {p0:(job.output.evidenceIds.join('、')),p1:(job.output.missingFacts.join('、') || controlText('controls.none'))}) }}
        </p>
        <small
          >{{ controlText('domain.policyVersion') }}{{ job.policyRevision }} · {{ job.model ?? controlText('expressionThree.noCallYet') }} ·
          {{ job.durationMs ?? 0 }}ms · token {{ job.tokens ?? controlText('dialogueReview.notReported') }}</small
        >
      </details>
      <div v-if="pending">
        <button
          v-if="job && ['queued', 'running', 'suggested'].includes(job.status)"
          :disabled="busy"
          @click="
            emit('command', {
              kind: 'gm-review-control',
              intentId,
              jobId: job.id,
              operation: 'takeover',
            })
          "
        >
          {{ controlText('adjudication.gmTakeover') }}
        </button>
        <button
          v-else
          :disabled="
            busy ||
            view.gmReview?.mode === 'human' ||
            view.gmReview?.paused ||
            !view.gmReview?.settings?.fixedInteractions ||
            status === 'waiting-dice'
          "
          @click="emit('command', { kind: 'gm-review-control', intentId, operation: 'send' })"
        >
          {{ controlText('adjudication.sendForAssistedReview') }}
        </button>
      </div>
    </template>
  </div>
</template>
<style scoped>
.review-evidence {
  padding: 8px 0;
}
.review-evidence button {
  min-height: 42px;
}
.review-evidence p {
  margin: 6px 0;
  overflow-wrap: anywhere;
}
</style>
