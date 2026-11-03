<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import { clone, catalogue, derived } from '../core/engine'
import { srd } from '../content/srd'
import { combatStats } from '../core/combat-rules'
import type { AiView, NpcDirective } from '../core/ai-types'
import type { RoomView, RoomCommand } from '../online/protocol'
import NpcProposalCard from './NpcProposalCard.vue'
import NpcCheckReview from './NpcCheckReview.vue'
import { DIALOGUE_CATEGORY_LABELS, type DialogueCategory } from '../core/ai-types'
const props = defineProps<{ job: AiView['jobs'][number]; view: RoomView; busy: boolean }>()
const emit = defineEmits<{ command: [command: RoomCommand]; navigate: [tab: string] }>()
const gm = computed(() => props.view.self.role === 'gm')
const text = ref(props.job.text),
  proposal = ref<NpcDirective>(clone(props.job.proposal ?? { kind: 'none' })),
  reason = ref('GM 已核对事实、交涉结果与权限'),
  confirmed = ref(false),
  check = ref<'none' | 'roll' | 'willing' | 'unwilling'>(
    props.job.checkSuggestion ? 'roll' : 'none',
  ),
  skill = ref(props.job.checkSuggestion?.skill ?? 'persuasion'),
  dc = ref(15),
  cost = ref<'action' | 'none'>('action'),
  constraints = ref(''),
  cooldownHours = ref(24),
  ignoreCooldown = ref(false)
const groupTargets = ref<{ npcId: string; dc: number; attitude: string; consequence: string }[]>([])
const groupCandidates = computed(() =>
  (props.job.dialogueGroup?.npcIds ?? []).filter((id) => id !== props.job.npcId),
)
function toggleGroupTarget(id: string, selected: boolean) {
  groupTargets.value = groupTargets.value.filter((t) => t.npcId !== id)
  if (selected) groupTargets.value.push({ npcId: id, dc: 15, attitude: '', consequence: '' })
}
function authorizeGroup() {
  emit('command', {
    kind: 'npc-group-influence-review',
    jobId: props.job.id,
    targets: clone(groupTargets.value),
  })
}
const finishTurn = ref(true)
const abilityConditions = ref(false)
const reuseDraft = computed(
  () =>
    !!props.job.dialogueReview?.publicInput &&
    !!props.job.text &&
    check.value === 'none' &&
    cost.value === 'none' &&
    !constraints.value.trim(),
)
const npc = computed(() =>
  props.view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === props.job.npcId),
)
watch(
  () => [props.job.status, props.job.intentId, JSON.stringify(props.job.proposal)],
  () => {
    text.value = props.job.text
    proposal.value = clone(props.job.proposal ?? { kind: 'none' })
    confirmed.value = false
  },
)
watch(
  () => npc.value?.revision,
  () => {
    const actor = props.view.world?.encounters
      .flatMap((e) => e.actors)
      .find((a) => a.id === npc.value?.actorId)
    const cat = catalogue([srd, ...props.view.packs]),
      character = props.view.world?.characters.find((c) => c.id === npc.value?.characterId)
    dc.value = Math.max(
      15,
      actor && props.view.world
        ? combatStats(actor, props.view.world.characters, cat).scores.int
        : character
          ? derived(character.build, cat, character.inventory).scores.int
          : (npc.value?.body?.scores.int ?? 15),
    )
  },
  { immediate: true },
)
const labels: Record<string, string> = {
  queued: '等待生成',
  running: '模型生成中',
  draft: '待 GM 审稿',
  fallback: '固定文案／降级',
  published: 'Web 已发布',
  skipped: '已跳过',
  canceled: '已取消',
  interrupted: '调用中断',
  'waiting-gm': '等待 GM 交涉裁定',
  rejected: '已拒绝',
  stale: '状态已过期',
}
const auditLabels = {
  queued: '等待AI审稿',
  running: 'AI审稿中',
  passed: 'AI审稿通过',
  escalated: '转GM审稿',
  suggested: '影子建议，待GM确认',
}
function narration(operation: 'publish' | 'skip' | 'retry' | 'fallback' | 'cancel') {
  emit('command', {
    kind: 'narration-review',
    jobId: props.job.id,
    operation,
    ...(operation === 'publish' ? { text: text.value } : {}),
  })
}
function adjudicate(approve: boolean) {
  emit('command', {
    kind: 'npc-talk-review',
    jobId: props.job.id,
    approve,
    skill: skill.value,
    dc: dc.value,
    check: check.value,
    cost: cost.value,
    cooldownHours: cooldownHours.value,
    ignoreCooldown: ignoreCooldown.value,
    reason: reason.value,
    constraints: constraints.value,
  })
}
function reply(approve: boolean) {
  emit('command', {
    kind: 'npc-reply-review',
    jobId: props.job.id,
    approve,
    text: text.value,
    proposal: clone(proposal.value),
    finishTurn: props.job.purpose === 'combat' ? finishTurn.value : undefined,
    conditionsConfirmed: props.job.purpose === 'combat' ? abilityConditions.value : undefined,
    reason: reason.value,
  })
}
</script>
<template>
  <article class="room-card ai-job" :data-job-id="job.id">
    <details v-if="gm && job.inputReport">
      <summary>{{ controlText('domain.modelContext') }}</summary>
      <p>{{ controlText('dialogueReview.contextCounts',{tokens:job.inputReport.estimatedTokens,budget:job.inputReport.budget??controlText('room.unlimited'),selected:job.inputReport.selectedIds.length,omitted:job.inputReport.omittedIds.length}) }}</p>
      <p class="muted">{{ controlText('dialogueReview.memoryRetained') }}</p>
      <p>{{ controlText('dialogueReview.selectedRecords') }}{{ job.inputReport.selectedIds.join('、') || controlText('controls.none') }}</p>
      <details v-if="job.inputReport.sections?.length"><summary>{{ controlText('dialogueReview.inputSizes') }}</summary><p v-for="s in job.inputReport.sections" :key="s.key">{{s.key}}：{{s.bytes}} {{ controlText('dialogueReview.bytes') }}</p></details>
      <p>{{ controlText('dialogueReview.excludedRecords') }}{{ job.inputReport.omittedIds.join('、') || controlText('controls.none') }}</p>
      <details v-if="job.inputReport.eventSelections?.length">
        <summary>{{ controlText('dialogueReview.eventReasons') }}</summary>
        <p v-for="e in job.inputReport.eventSelections" :key="e.id">
          {{ e.text }} · {{ e.reason }}
        </p>
      </details>
      <pre class="input-preview">{{ job.inputReport.preview }}</pre>
    </details>
    <details v-if="gm&&job.textStyle"><summary>{{ controlText('dialogueReview.textRules',{version:job.textStyle.version,revision:job.textStyle.revision}) }}</summary><p>{{job.textStyle.enabled?controlText('dialogueReview.assembled'):controlText('dialogueReview.legacyTask')}} · {{job.textStyle.purpose}} · {{job.textStyle.selfCheck?controlText('dialogueReview.selfCheck'):controlText('dialogueReview.noSelfCheck')}} · {{ controlText('dialogueReview.samples',{count:job.textStyle.sampleIds.length}) }}</p><p v-for="warning in job.textStyle.warnings" :key="warning" class="muted">{{ controlText('dialogueReview.styleWarning',{warning}) }}</p></details>
    <p v-if="job.outputLocale" class="muted small">{{ controlText('language.queued', {language:job.outputLocale==='en'?'English':controlText('domain.chinese')}) }}</p>
    <h3>
      #{{ job.sequence }} {{ job.title }} <small>{{ uiLabel(labels[job.status]) || job.status }}</small>
    </h3>
    <details v-if="gm&&job.modelContract?.repairs.length"><summary>{{ controlText('dialogueReview.contractHistory') }} {{job.modelContract.repairs.length}}</summary><p v-for="(r,index) in job.modelContract.repairs" :key="index">{{r.path}} · {{r.operation}}</p><p class="muted">{{ controlText('dialogueReview.contractHint') }}</p></details><p v-if="gm&&job.planningParentId" class="muted">{{ controlText('dialogueReview.planningDialogue') }}</p><p v-if="gm&&job.planningSpeechJobId" class="muted">{{ controlText('dialogueReview.planningQueued') }}</p><div v-if="gm&&job.planningSpeechError"><p role="status">{{job.planningSpeechError}}</p><button :disabled="busy||job.historical" @click="emit('command',{kind:'npc-planning-speech-retry',jobId:job.id})">{{ controlText('dialogueReview.retryPlanning') }}</button></div>
    <p v-if="job.historical" class="muted">{{ controlText('dialogueReview.historical') }}</p>
    <NpcCheckReview
      v-if="
        gm &&
        !job.historical &&
        job.status === 'published' &&
        job.checkSuggestion &&
        !job.check?.adjudicated
      "
      :job="job"
      :busy="busy"
      @command="emit('command', $event)"
    />
    <section
      v-if="gm && job.kind === 'npc' && job.dialogueReview"
      class="room-card"
      :aria-label="controlText('dialogueReview.dialogueState')"
    >
      <p>
        {{ controlText('dialogueReview.dialogueLabel') }}{{
          job.status === 'published'
            ? controlText('ai.alreadyPublic')
            : ['queued', 'running'].includes(job.status)
              ? controlText('domain.working')
              : controlText('dialogueReview.awaitingDraft')
        }}
        {{ controlText('dialogueReview.actionLabel') }}{{
          job.intentId ? controlText('dialogueReview.independentIntent') : job.text ? controlText('dialogueReview.notSubmitted') : controlText('dialogueReview.undetermined')
        }}
      </p>
      <p>
        QQ：{{
          job.status === 'published'
            ? controlText('dialogueReview.deliveryStatus')
            : controlText('dialogueReview.notPublished')
        }}
      </p>
      <p>{{ job.dialogueReview.reason }}</p>
      <small>{{ controlText('game.generate') }} {{ job.dialogueReview.generationDurationMs ?? '—' }} ms</small>
      <p v-if="job.dialogueReview.audit">
        {{ controlText('quantity.auditUsage', {p0:(controlText('dialogueReview.aiAudit')),p1:(uiLabel(auditLabels[job.dialogueReview.audit.status])??job.dialogueReview.audit.status),p2:(job.dialogueReview.audit.reason),p3:(job.dialogueReview.audit.calls),p4:(job.dialogueReview.audit.durationMs ?? '—'),p5:(job.dialogueReview.audit.tokens ?? controlText('dialogueReview.notReported'))}) }}
      </p>
    </section>
    <p v-if="job.status === 'published'" class="muted">
      {{ controlText('dialogueReview.deliveryHint') }}
    </p>
    <p v-if="gm && job.narrationAudit" class="muted">
      {{ uiLabel(auditLabels[job.narrationAudit.status]) }}：{{ job.narrationAudit.reason
      }}<span v-if="job.narrationAudit.durationMs"> · {{ job.narrationAudit.durationMs }} ms</span>
    </p>
    <p v-if="gm && job.narrationSkill" class="muted">
      {{ controlText('dialogueReview.generatedSkill') }}{{ localizedEntryName(job.narrationSkill) }} · v{{ job.narrationSkill.version }}
    </p>
    <p v-if="job.kind === 'narration'" class="muted">
      {{ job.eventIds.length }} {{ controlText('field.sourceBroadcasts') }}
      {{
        job.audience.kind === 'public' ? controlText('controls.public') : job.audience.kind === 'gm' ? controlText('broadcast.gmOnly') : controlText('expressionOne.restrictedCharacter')
      }}
      <details v-if="gm">
        <summary>{{ controlText('dialogueReview.sourceFacts') }}</summary>
        {{ job.eventIds.join('、') }}
      </details>
    </p>
    <template v-else
      ><p>
        {{
          job.purpose === 'combat'
            ? controlText('dialogueReview.turnPlan')
            : job.purpose === 'proactive'
              ? controlText('dialogueReview.proactiveTask')
              : controlText('controls.player')
        }}：{{ job.message }}
      </p>
      <p v-if="job.goal">{{ controlText('dialogueReview.goal') }}{{ job.goal }}</p>
      <p v-if="job.check">
        {{ job.check.skill === 'gm' ? controlText('state.gmRuling') : controlText('expressionOne.check') + job.check.total }} ·
        {{ job.check.success === null ? controlText('dialogueReview.noCheck') : job.check.success ? controlText('controls.success') : controlText('controls.failed') }}
      </p></template
    >
    <div v-if="gm && job.dialogueGroup?.primaryNpcId === job.npcId" class="room-card">
      <strong>{{ controlText('dialogueReview.groupAuthorization') }}</strong>
      <p class="muted">
        {{ controlText('dialogueReview.groupHint') }}
      </p>
      <template v-if="!job.groupInfluence">
        <label v-for="id in groupCandidates" :key="id"
          ><input
            type="checkbox"
            :checked="groupTargets.some((t) => t.npcId === id)"
            @change="toggleGroupTarget(id, ($event.target as HTMLInputElement).checked)"
          />{{ localizedEntryName(view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === id)) ?? id }}</label
        >
        <div v-for="target in groupTargets" :key="target.npcId">
          <label>{{ controlText('dialogueReview.independentDc') }}<input v-model.number="target.dc" type="number" min="1" max="100" /></label>
          <label>{{ controlText('dialogueReview.attitudeBasis') }}<input v-model="target.attitude" maxlength="2000" /></label>
          <label>{{ controlText('dialogueReview.consequence') }}<textarea v-model="target.consequence" maxlength="2000" /></label>
        </div>
        <button
          :disabled="
            busy ||
            !job.check?.adjudicated ||
            job.check.total === null ||
            !groupTargets.length ||
            groupTargets.some((t) => !t.attitude.trim() || !t.consequence.trim())
          "
          @click="authorizeGroup"
        >
          {{ controlText('dialogueReview.reuseRoll') }}
        </button>
        <button
          :disabled="busy || !job.check?.adjudicated || job.check.total === null"
          @click="
            emit('command', { kind: 'npc-group-influence-review', jobId: job.id, targets: [] })
          "
        >
          {{ controlText('dialogueReview.unaffected') }}
        </button>
      </template>
      <p v-for="target in job.groupInfluence" :key="target.npcId">
        {{
          localizedEntryName(view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === target.npcId)) ??
          target.npcId
        }}
        · {{ target.attitude }} · {{ target.total }} / DC {{ target.dc }} ·
        {{ target.success ? controlText('controls.success') : controlText('controls.failed') }}：{{ target.consequence }}
      </p>
    </div>
    <p v-if="job.error" class="muted">{{ displayFeedback(job.error,'error') }}</p>
    <div v-if="gm && job.dialogueReview" class="room-card">
      <strong>{{
        job.dialogueReview.stage === 'automatic'
          ? controlText('dialogueReview.autoClassification')
          : job.dialogueReview.stage === 'manual'
            ? controlText('dialogueReview.manualGm')
            : controlText('dialogueReview.publicCandidate')
      }}</strong>
      <p>
        {{ controlText('dialogueReview.category') }}{{
          uiLabel(DIALOGUE_CATEGORY_LABELS[job.dialogueReview.category as DialogueCategory]) ??
          job.dialogueReview.category ??
          controlText('dialogueReview.unknown')
        }}
        · {{ job.dialogueReview.reason }}
      </p>
      <p class="muted small">
        {{ controlText('quantity.cited', {p0:(job.dialogueReview.publicInput ? controlText('dialogueReview.publicContext') : controlText('dialogueReview.authorizedContext')),p1:(job.dialogueReview.citedIds.length)}) }}</p>
      <p v-if="job.status === 'waiting-gm' && job.text" class="ai-prose">
        {{ controlText('dialogueReview.candidate') }}{{ job.text }}
      </p>
    </div>
    <NpcProposalCard
      v-if="gm && job.kind === 'npc'"
      v-model="proposal"
      :job="job"
      :view="view"
      :busy="busy"
      @command="emit('command', $event)"
      @navigate="emit('navigate', $event)"
    />
    <template v-if="gm && !job.historical && job.kind === 'npc' && job.status === 'waiting-gm'">
      <div class="ai-form">
        <label
          >{{ controlText('dialogueReview.negotiationRuling') }}<select v-model="check">
            <option value="none">{{ controlText('dialogueReview.ordinaryTalk') }}</option>
            <option value="willing">{{ controlText('game.willing') }}</option>
            <option value="unwilling">{{ controlText('game.unwilling') }}</option>
            <option value="roll">{{ controlText('dialogueReview.hesitant') }}</option>
          </select></label
        ><label
          >{{ controlText('game.combatCost') }}<select v-model="cost">
            <option value="action">{{ controlText('game.influenceAction') }}</option>
            <option value="none">{{ controlText('dialogueReview.noCostGm') }}</option>
          </select></label
        ><template v-if="check === 'roll'"
          ><label
            >{{ controlText('dialogueReview.influenceSkill') }}<select v-model="skill">
              <option value="persuasion">{{ controlText('game.persuasion') }}</option>
              <option value="deception">{{ controlText('game.deception') }}</option>
              <option value="intimidation">{{ controlText('game.intimidation') }}</option>
              <option value="performance">{{ controlText('game.performance') }}</option>
              <option value="animal-handling">{{ controlText('dialogueReview.animalHandling') }}</option>
            </select></label
          ><label
            >{{ controlText('dialogueReview.defaultDc') }}<input
              v-model.number="dc"
              type="number"
              min="1"
              max="100" /></label
          ><label
            >{{ controlText('dialogueReview.failureHours') }}<input
              v-model.number="cooldownHours"
              type="number"
              min="0"
              max="8760" /></label
          ><label class="check"
            ><input v-model="ignoreCooldown" type="checkbox" />{{ controlText('dialogueReview.overrideWait') }}</label
          ></template
        ><label>{{ controlText('dialogueReview.negotiationBounds') }}<textarea v-model="constraints" maxlength="2000" /></label
        ><label>{{ controlText('game.basis') }}<textarea v-model="reason" maxlength="2000" /></label>
      </div>
      <p class="muted">
        {{ controlText('dialogueReview.attitudeHint') }}
      </p>
      <div class="room-row">
        <button :disabled="busy || !reason.trim()" @click="adjudicate(true)">
          {{ reuseDraft ? controlText('expressionOne.confirmNoCheckReviewExistingPublicDraft') : controlText('expressionOne.confirmNegotiationAndGenerateReply') }}</button
        ><button class="subtle" :disabled="busy || !reason.trim()" @click="adjudicate(false)">
          {{ controlText('dialogueReview.rejectNegotiation') }}
        </button>
      </div>
    </template>
    <template
      v-else-if="gm && !job.historical && ['draft', 'fallback', 'interrupted'].includes(job.status)"
    >
      <label
        >{{
          job.kind === 'narration'
            ? controlText('expressionOne.narrationReview')
            : job.purpose === 'combat'
              ? controlText('expressionOne.npcCombatPlanReview')
              : controlText('expressionOne.npcReplyReview')
        }}<textarea v-model="text" :maxlength="job.kind === 'narration' ? 6000 : 2000" rows="5" />
      </label>
      <template v-if="job.kind === 'npc'">
        <p v-if="job.reason">{{ controlText('dialogueReview.proposalReason') }}{{ job.reason }}</p>
        <p class="muted">{{ controlText('dialogueReview.safeDialogueHint') }}</p>
        <label>{{ controlText('dialogueReview.reviewReason') }}<textarea v-model="reason" maxlength="2000" /></label
      ></template>
      <label class="check"
        ><input v-model="confirmed" type="checkbox" />{{ controlText('dialogueReview.verifiedFacts') }}</label
      >
      <label v-if="job.purpose === 'combat' && npc?.turnMode === 'plan'" class="check"
        ><input v-model="finishTurn" type="checkbox" />{{ controlText('dialogueReview.endTurnPlan') }}</label
      >
      <label
        v-if="
          job.purpose === 'combat' &&
          npc?.turnMode === 'plan' &&
          job.plan?.some((d) => d.kind === 'ability')
        "
        class="check"
        ><input
          v-model="abilityConditions"
          type="checkbox"
        />{{ controlText('dialogueReview.verifiedSpell') }}</label
      >
      <div class="room-row">
        <button
          :disabled="busy || !confirmed || !text.trim()"
          @click="job.kind === 'narration' ? narration('publish') : reply(true)"
        >
          {{
            job.kind === 'narration'
              ? controlText('expressionOne.publishNarration')
              : job.purpose === 'combat'
                ? npc?.turnMode === 'plan'
                  ? controlText('expressionOne.approveFullPlanAndStartExecution')
                  : controlText('expressionOne.confirmPlanAndSubmitFirstStepForReview')
                : controlText('expressionOne.publishReplyAndHandleActionProposal')
          }}</button
        ><button
          class="subtle"
          :disabled="busy"
          @click="job.kind === 'narration' ? narration('skip') : reply(false)"
        >
          {{ job.kind === 'narration' ? controlText('controls.skip') : controlText('dialogueReview.refuseReply') }}</button
        ><button
          class="subtle"
          :disabled="busy"
          @click="
            job.kind === 'narration'
              ? narration('retry')
              : emit('command', { kind: 'npc-reevaluate', jobId: job.id })
          "
        >
          {{job.planningParentId?controlText('dialogueReview.retryReview'):controlText('domain.retryGeneration')}}
        </button>
      </div>
    </template>
    <template v-else
      ><p v-if="job.text" class="ai-prose">{{ job.text }}</p>
      <p v-else class="muted">
        {{
          job.kind === 'npc' && ['fallback', 'interrupted'].includes(job.status)
            ? controlText('dialogueReview.failedGeneration')
            : gm
              ? controlText('dialogueReview.working')
              : controlText('dialogueReview.waitingHost')
        }}
      </p></template
    >
    <div
      v-if="
        gm &&
        !job.historical &&
        job.kind === 'narration' &&
        ['queued', 'running'].includes(job.status)
      "
      class="room-row"
    >
      <button class="subtle" :disabled="busy" @click="narration('fallback')">{{ controlText('dialogueReview.fixedResult') }}</button
      ><button class="subtle" :disabled="busy" @click="narration('cancel')">{{ controlText('dialogueReview.cancelGeneration') }}</button>
    </div>
    <button
      v-if="
        gm &&
        job.kind === 'npc' &&
        (['stale', 'canceled', 'interrupted'].includes(job.status) ||
          (job.status === 'published' &&
            view.intents.some((i) => i.id === job.intentId && i.status === 'pending')))
      "
      class="subtle"
      :disabled="busy"
      @click="emit('command', { kind: 'npc-reevaluate', jobId: job.id })"
    >
      {{job.planningParentId?controlText('expressionOne.readPublicEvidenceAndRetryIndependentReview'):controlText('expressionOne.reevaluateCurrentState')}}
    </button>
    <button
      v-if="gm && !job.historical && job.kind === 'npc' && job.status === 'stale'"
      class="subtle"
      :disabled="busy"
      @click="reply(false)"
    >
      {{ controlText('dialogueReview.endExpired') }}
    </button>
    <p v-if="job.intentId">
      {{
        view.intents.find((i) => i.id === job.intentId)?.status === 'approved'
          ? controlText('expressionOne.theGmApprovedTheActionIntentAndSubmitted')
          : view.intents.find((i) => i.id === job.intentId)?.status === 'rejected'
            ? controlText('expressionOne.theActionIntentWasRejectedTheOriginalProposal')
            : controlText('expressionOne.actionSubmittedForIntentReviewExecutionRequiresApproval')
      }}
    </p>
  </article>
</template>

<style scoped>
.input-preview {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 420px;
  overflow: auto;
  max-width: 100%;
}
</style>
