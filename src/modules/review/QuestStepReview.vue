<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import type { RoomView, RoomCommand } from '../../online/protocol'
import { pendingRoomReviews } from '../room-review-queue'
import { computed } from 'vue'
const props = defineProps<{ view: RoomView; busy: boolean }>()
const emit = defineEmits<{ command: [RoomCommand] }>()
const suggestions = computed(() =>
  pendingRoomReviews(props.view).questSteps.map((s) => {
    const q = props.view.world?.adventures[0]?.quests?.find((q) => q.id === s.questId)
    const step = q?.steps?.find((step) => step.id === s.stepId)
    const blocked =
      !q ||
      !step ||
      (q.status ?? q.initialStatus) !== 'active' ||
      (step.status ?? step.initialStatus) !== 'active' ||
      step.afterIds.some(
        (id) => !q.steps?.some((p) => p.id === id && (p.status ?? p.initialStatus) === 'completed'),
      )
    const task = props.view.practicalReview?.tasks.find(
      (t) => t.phase === 'quest' && t.sourceId === s.questId + ':' + s.stepId,
    )
    return {
      ...s,
      blocked,
      reason: blocked
        ? '任务／小目标状态或前置条件已变化；请在任务管理中查看推进诊断。'
        : task && ['needs-gm', 'needs-fact'].includes(task.status)
          ? task.reason
          : '等待GM确认；不自动发奖或升级。',
    }
  }),
)
</script>
<template>
  <section v-if="suggestions.length" class="review-group" :aria-label="controlText('interactionField.objectiveCompletionSuggestions')">
    <h3>{{ controlText('progressSummary.objectiveCompletionSuggestion', {p0:(suggestions.length)}) }}</h3>
    <article v-for="s in suggestions" :key="s.id" class="quest-step-review">
      <strong>{{ s.title }}</strong>
      <p>{{ controlText('progressSummary.matchingConfirmedEventReceived', {p0:(s.questTitle)}) }}</p>
      <p class="muted">{{ controlText('adjudication.confirmationUpdatesTheObjectiveWithoutAutomaticallyGrantingRewards') }}</p>
      <p role="status">{{ s.reason }}</p>
      <div class="runtime-bar">
        <button
          type="button"
          :disabled="busy || s.blocked"
          @click="
            emit('command', {
              kind: 'quest-step-review',
              questId: s.questId,
              suggestionId: s.id,
              approve: true,
            })
          "
        >
          {{ controlText('adjudication.confirmCompletion') }}
        </button>
        <button
          type="button"
          :disabled="busy"
          @click="
            emit('command', {
              kind: 'quest-step-review',
              questId: s.questId,
              suggestionId: s.id,
              approve: false,
            })
          "
        >
          {{ controlText('domain.notComplete') }}
        </button>
      </div>
    </article>
  </section>
</template>
<style scoped>
.quest-step-review {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  margin-block: 8px;
  overflow-wrap: anywhere;
}
.quest-step-review button {
  min-height: 44px;
}
</style>
