<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
import type { NpcTurnRun } from '../core/ai-types'
import { npcExecutionRuns } from './room-review-queue'
const props = defineProps<{
    view: RoomView
    busy: boolean
    run?: NpcTurnRun
    executionOnly?: boolean
  }>(),
  emit = defineEmits<{ command: [command: RoomCommand] }>()
const reason = ref('GM 已检查当前条件与剩余计划')
const runs = computed(() =>
  props.run
    ? [props.run]
    : props.executionOnly
      ? npcExecutionRuns(props.view)
      : (props.view.ai.turns ?? [])
          .filter(
            (r) =>
              r.encounterId === props.view.encounter?.id && r.tick === props.view.encounter?.tick,
          )
          .slice(-4),
)
const names: Record<string, string> = {
  running: '执行中',
  paused: '已暂停',
  review: '等待 GM 裁定',
  completed: '回合完成',
  canceled: '已接管／取消',
}
function control(
  runId: string,
  action: Extract<RoomCommand, { kind: 'npc-turn-control' }>['action'],
) {
  emit('command', { kind: 'npc-turn-control', runId, action, reason: reason.value })
}
</script>
<template>
  <section v-if="runs.length" class="room-card npc-turn-panel" :aria-label="controlText('configurationField.npcTurnExecution')">
    <h2>{{ run ? controlText('expressionTwo.npcTurnRuling') : controlText('configurationField.npcTurnExecution') }}</h2>
    <label>{{ controlText('game.basis') }}<input v-model="reason" maxlength="2000" /></label>
    <article v-for="r in runs" :key="r.id">
      <h3>
        {{ localizedEntryName(view.ai.npcs.find((n) => n.id === r.npcId)) ?? 'NPC' }} · {{ uiLabel(names[r.state]) }}
      </h3>
      <p role="status">{{ r.reason }}</p>
      <p v-if="r.waitingStep?.destination">{{ controlText('liveSummary.pending', {p0:(r.waitingStep.kind === 'flee' ? controlText('expressionTwo.retreat') : controlText('controls.move')),p1:(r.waitingStep.destination.x),p2:(r.waitingStep.destination.y)}) }}</p>
      <small
        >{{ r.mode === 'automatic' ? controlText('ai.fixedStrategy') : controlText('expressionTwo.entirePlan') }} {{ controlText('configurationField.executed') }} {{ r.executed }} {{ controlText('configurationField.steps') }}<span
          v-if="r.mode === 'plan'"
        >{{ controlText('liveSummary.plan', {p0:(r.nextStep),p1:(r.steps.length)}) }}</span
        ></small
      >
      <div v-if="!['completed', 'canceled'].includes(r.state) || r.needsApproval" class="room-row">
        <button
          v-if="r.state === 'running'"
          class="secondary"
          :disabled="busy || !reason.trim()"
          @click="control(r.id, 'pause')"
        >{{ controlText('workspace.pauseAutomaticAdvancement') }}</button>
        <button
          v-if="r.state === 'paused' && !r.needsApproval"
          :disabled="busy || !reason.trim()"
          @click="control(r.id, 'resume')"
        >{{ controlText('workspace.resumeExecution') }}</button>
        <button
          v-if="
            (r.state === 'review' && !r.rider && !r.reason.includes('隐藏') && !r.needsApproval) ||
            (r.needsApproval && r.mode === 'automatic')
          "
          :disabled="busy || !reason.trim() || !!view.encounter?.pending"
          @click="control(r.id, 'approve')"
        >{{ controlText('workspace.reapproveRemainingPlan') }}</button>
        <button
          v-if="r.state === 'review' && r.reason.includes('隐藏')"
          :disabled="busy || !reason.trim()"
          @click="control(r.id, 'reveal')"
        >{{ controlText('workspace.revealNpcAndContinue') }}</button>
        <button
          v-if="
            r.state === 'review' &&
            (r.reason.includes('借机') ||
              r.reason.includes('危险') ||
              r.reason.includes('施放条件'))
          "
          :disabled="busy || !reason.trim() || !!view.encounter?.pending"
          @click="control(r.id, 'conditions')"
        >{{ controlText('workspace.triggerCastingConditionsHandledContinueThisStep') }}</button>
        <button
          v-if="r.state === 'review' && r.rider"
          :disabled="busy || !reason.trim() || !!view.encounter?.pending"
          @click="control(r.id, 'rider')"
        >{{ controlText('workspace.additionalEffectAdjudicatedNotApplicableContinue') }}</button>
        <button class="subtle" :disabled="busy || !reason.trim()" @click="control(r.id, 'manual')">{{ controlText('workspace.takeOverThisTurn') }}</button>
      </div>
    </article>
    <p class="muted">{{ controlText('workspace.pausingAndTakeoverRetainCompletedOutcomesResolveReactions') }}</p>
  </section>
</template>
<style scoped>
.npc-turn-panel article {
  border-top: 1px solid var(--line);
  padding: 12px 0;
}
.npc-turn-panel input {
  width: 100%;
  box-sizing: border-box;
}
.npc-turn-panel .room-row {
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.npc-turn-panel button {
  min-height: 44px;
  white-space: normal;
}
</style>
