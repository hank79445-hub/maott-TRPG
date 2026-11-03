<script setup lang="ts">
import {uiLabel} from './ui-label'
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global

import { computed, ref, watch } from 'vue'
import type { NpcDirective, AiView } from '../core/ai-types'
import type { RoomCommand, RoomView } from '../online/protocol'
import NpcDirectiveFields from './NpcDirectiveFields.vue'
const props = defineProps<{
    modelValue: NpcDirective
    job: AiView['jobs'][number]
    view: RoomView
    busy: boolean
  }>(),
  emit = defineEmits<{
    'update:modelValue': [value: NpcDirective]
    command: [command: RoomCommand]
    navigate: [tab: string]
  }>()
const pending = computed(() => props.view.intents.find((i) => i.id === props.job.intentId)),
  reason = ref('GM 已核对行为、目标与当前条件'),
  confirmed = ref(false),
  editing = ref(false)
watch(
  () => props.job.intentId,
  () => {
    editing.value = false
    confirmed.value = false
  },
)
const editable = computed(
  () => !props.job.historical && ['draft', 'fallback', 'interrupted'].includes(props.job.status),
)
const wholePlan = computed(
  () =>
    props.view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === props.job.npcId)?.turnMode ===
      'plan' || props.view.ai.turns?.some((r) => r.jobId === props.job.id),
)
function update(value: NpcDirective) {
  emit('update:modelValue', value)
  confirmed.value = false
}
const names: Record<string, string> = {
  none: '无行为提议，仅对话',
  hostile: '转为敌对',
  'start-combat': '发起战斗',
  attack: '攻击',
  move: '移动',
  flee: '尝试逃跑',
  surrender: '声明投降',
  alert: '发出警报',
  promise: '作出承诺',
  trade: '交易',
  reveal: '公开线索',
  action: '使用动作',
  ability: '使用已配置能力',
}
function describe(d: NpcDirective) {
  const actor = (id: string | undefined) =>
    props.view.encounter?.actors.find((a) => a.id === id)?.name ?? '未指定目标'
  const npc = props.view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === props.job.npcId)
  if (d.kind === 'attack')
    return (
      (props.view.encounter?.actors
        .find((a) => a.id === npc?.actorId)
        ?.attacks.find((a) => a.id === d.attackId)?.name ?? '未指定攻击') +
      ' → ' +
      actor(d.targetId)
    )
  if (d.kind === 'move' || d.kind === 'flee')
    return d.destination ? `目的地 (${d.destination.x}, ${d.destination.y})` : '未指定目的地'
  if (d.kind === 'ability')
    return (
      (npc?.abilities.find((a) => a.id === d.abilityId)?.name ?? '未指定能力') +
      ' → ' +
      (d.targets?.map((id) => actor(id)).join('、') || '自身')
    )
  if (d.kind === 'trade')
    return `${d.itemId ?? '未指定物品'} ×${d.quantity ?? 0}，单价 ${d.priceGP ?? 0} GP`
  if (d.kind === 'action')
    return {
      dash: '疾走',
      disengage: '撤离',
      dodge: '回避',
      help: '协助',
      ready: '预备',
      utilize: '使用物品',
      hide: '躲藏',
    }[d.action ?? 'dodge']
  return d.detail ?? ''
}
</script>
<template>
  <section class="npc-proposal-card" :aria-label="controlText('configurationField.npcProposalDetails')">
    <h4>
      {{ controlText('configurationField.npcActionProposal') }}
      <small>{{
        pending?.status === 'pending'
          ? controlText('expressionTwo.awaitingGmReview')
          : pending?.status === 'approved'
            ? controlText('expressionTwo.submittedToExistingRulesExecution')
            : pending?.status === 'rejected'
              ? controlText('domain.rejected')
              : ['queued', 'running', 'waiting-gm'].includes(job.status) && !job.text
                ? controlText('expressionTwo.notGeneratedDecidedYet')
                : modelValue.kind === 'none'
                  ? controlText('expressionTwo.noActionThisTime')
                  : controlText('expressionTwo.notSubmittedForExecution')
      }}</small>
    </h4>
    <p>
      {{
        ['queued', 'running', 'waiting-gm'].includes(job.status) && !job.text
          ? controlText('expressionTwo.waitingForGenerationAndJudgment')
          : uiLabel(names[modelValue.kind])
      }}
    </p>
    <p v-if="describe(modelValue)">{{ describe(modelValue) }}</p>
    <p v-if="job.reason" class="muted">{{ controlText('liveSummary.sourceAndRationale', {p0:(job.reason)}) }}</p>
    <p v-if="job.check">{{ controlText('liveSummary.negotiationResult', {p0:(job.check.success === null ? controlText('dialogueReview.noCheck') : job.check.success ? controlText('controls.success') : controlText('controls.failed'))}) }}
    </p>
    <NpcDirectiveFields
      v-if="editable || editing"
      :model-value="modelValue"
      :view="view"
      :npc-id="job.npcId!"
      @update:model-value="update"
    />
    <p class="muted">{{ controlText('workspace.publicSafeDialogueRepliesFirstTheGmReviews') }}</p>
    <button
      v-if="job.intentId"
      class="subtle"
      :disabled="busy"
      @click="emit('navigate', 'intents')"
    >{{ controlText('workspace.openCorrespondingIntentReview') }}</button
    ><template
      v-if="
        job.status === 'published' &&
        !job.historical &&
        !wholePlan &&
        !pending?.status.includes('pending')
      "
      ><button class="subtle" :disabled="busy" @click="editing = !editing">
        {{ editing ? controlText('expressionTwo.collapseActionEditor') : controlText('expressionTwo.addGmActionProposal') }}
      </button>
      <div v-if="editing">
        <label>{{ controlText('configurationField.actionSubmissionBasis') }}<input v-model="reason" maxlength="2000" /></label
        ><label class="check"
          ><input v-model="confirmed" type="checkbox" />{{ controlText('configurationField.thisActionAndItsTargetsHaveBeenChecked') }}</label
        ><button
          :disabled="busy || !confirmed || modelValue.kind === 'none'"
          @click="
            emit('command', { kind: 'npc-proposal', jobId: job.id, directive: modelValue, reason })
          "
        >{{ controlText('workspace.submitActionForGmReview') }}</button>
      </div></template
    >
    <div v-if="job.purpose === 'combat' && job.plan?.length">
      <h4>{{ controlText('liveSummary.turnPlan', {p0:(wholePlan ? controlText('expressionTwo.revalidateEachStepAfterFullApproval') : controlText('expressionTwo.reviewEachStep'))}) }}</h4>
      <ol>
        <li v-for="(step, i) in job.plan" :key="i">
          {{ uiLabel(names[step.kind]) }} · {{ describe(step) }}
          <span v-if="i < (job.nextStep ?? 0)">{{ controlText('workspace.submitted') }}</span>
        </li>
      </ol>
      <button
        v-if="!wholePlan && job.status === 'published' && (job.nextStep ?? 0) < job.plan.length"
        :disabled="busy || view.encounter?.pending || pending?.status === 'pending'"
        @click="
          emit('command', {
            kind: 'npc-plan-step',
            jobId: job.id,
            step: job.nextStep ?? 0,
            reason: 'GM 已读取前一步实际结果并核对下一步',
          })
        "
      >{{ controlText('workspace.submitNextStepUsingCurrentState') }}</button>
      <p class="muted">
        {{
          wholePlan
            ? controlText('expressionTwo.viewAutomaticExecutionAtTheCombatTableReactions')
            : controlText('expressionTwo.submitEachStepForReviewUsingCurrentState')
        }}
      </p>
    </div>
  </section>
</template>
<style>
.npc-proposal-card {
  border: 1px solid var(--line, #d4d9d6);
  border-left: 4px solid #917145;
  border-radius: 8px;
  padding: 14px;
  margin: 14px 0;
  min-width: 0;
}
.npc-proposal-card h4 {
  margin: 0 0 10px;
}
.npc-proposal-card small {
  font-weight: 400;
  font-size: 12px;
}
.npc-proposal-card ol {
  padding-left: 22px;
}
.npc-proposal-card label {
  display: grid;
  gap: 6px;
}
</style>
