<script setup lang="ts">
import {uiLabel} from './ui-label'
import {displayFeedback} from './feedback-presentation'
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import QqBotRoutes from './QqBotRoutes.vue'
import { notifyOperation } from '../app/notifications'
import { watch, onBeforeUnmount, onMounted, ref } from 'vue'
type Task = { id: string; status: string; text: string; detail: string }
type Limits = {
  backlog: number
  maxAgeSeconds: number
  sendIntervalSeconds: number
  maxChars: number
  daily: number
}
type Status = {
  connected: boolean
  entry: string
  error: string
  queries?: { id: string; command: string; status: string; detail: string }[]
  code?: string
  transport?: { status: string; lastError: string }
  pending: { marker: string; claimed: boolean; expires: number }[]
  binding: null | {
    label: string
    paused: boolean
    detailed: boolean
    limits: Limits
    latest: string
    tasks: Task[]
  }
}
const props = defineProps<{ request: <T>(suffix: string, body?: unknown) => Promise<T | null> }>()
const selectedBot = ref('default'),
  bots = ref<{ key: string; name: string }[]>([{ key: 'default', name: '原有主Bot' }])
const state = ref<Status | null>(null),
  code = ref(''),
  label = ref('测试跑团群'),
  busy = ref(false),
  error = ref('')
const editing = ref(false),
  limits = ref<Limits>({
    backlog: 12,
    maxAgeSeconds: 300,
    sendIntervalSeconds: 10,
    maxChars: 1700,
    daily: 800,
  })
function editLimits() {
  if (state.value?.binding) limits.value = { ...state.value.binding.limits }
  editing.value = !editing.value
}
let timer: ReturnType<typeof setInterval> | undefined,
  active = true
async function load() {
  if (busy.value) return
  try {
    const result = await props.request<Status>('qq?bot=' + encodeURIComponent(selectedBot.value))
    if (active) {
      state.value = result
      error.value = ''
    }
  } catch (e) {
    if (active) error.value = (e as Error).message
  }
}
async function send(body: unknown) {
  busy.value = true
  error.value = ''
  try {
    const result = await props.request<Status>(
      'qq?bot=' + encodeURIComponent(selectedBot.value),
      body,
    )
    if (active) {
      state.value = result
      code.value = result?.code ?? ''
    }
  } catch (e) {
    if (active) error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
function unbind() {
  if (confirm(controlText('confirmation.unlinkingStopsDeliveryButKeepsRecordsExistingQq')))
    void send({ type: 'unbind' })
}
function retry(id: string) {
  if (confirm(controlText('confirmation.checkTheActualQqGroupFirstRetryingCan')))
    void send({ type: 'resolve', taskId: id, retry: true })
}
onMounted(() => {
  void load()
  timer = setInterval(() => {
    void load()
  }, 4000)
})
onBeforeUnmount(() => {
  active = false
  clearInterval(timer)
})
watch(
  error,
  (value) => {
    if (value) notifyOperation(value, true)
  },
  { flush: 'post' },
)
function changeBot() {
  code.value = ''
  void load()
}
</script>

<template>
  <section class="qq-panel" aria-labelledby="qq-title">
    <h2 id="qq-title">{{ controlText('workspace.qqGroupsAndRooms') }}</h2>
    <label
      >{{ controlText('interactionField.currentBotEndpoint') }}<select v-model="selectedBot" :disabled="busy" @change="changeBot">
        <option v-for="b in bots" :key="b.key" :value="b.key">{{ b.key==='default'?uiLabel(localizedEntryName(b)):localizedEntryName(b) }}</option>
      </select></label
    >
    <QqBotRoutes :request="request" @bots="bots = $event" />
    <p>{{ controlText('workspace.qqProvidesPublicQueriesAndSummariesOperateCharacters') }}</p>

    <template v-if="state">
      <p role="status">
        {{ state.connected ? controlText('expressionTwo.botConnected') : controlText('expressionTwo.botDisconnected') }} · {{ state.transport?.status }}
        {{ state.transport?.lastError }}
      </p>
      <p v-if="state.error" role="alert" class="error">{{ displayFeedback(state.error,'error') }}</p>
      <details v-if="state.queries?.length">
        <summary>{{ controlText('workspace.recentGroupQueryResults') }}</summary>
        <p v-for="q in state.queries" :key="q.id">
          {{ q.command }}：{{ q.status }} · {{ q.detail }}
        </p>
      </details>
      <p v-if="state.entry">{{ controlText('liveSummary.entryPrivateAddressesRequireAnAuthorizedNetwork', {p0:(state.entry)}) }}</p>
      <div v-if="!state.binding">
        <button :disabled="busy" @click="send({ type: 'code' })">{{ controlText('workspace.generateOneTimeBindingCode') }}</button>
        <p v-if="code">
          {{ controlText('interactionField.mentionBotInTheTargetGroupAndEnter') }}<code>绑定 {{ code }}</code
          >{{ controlText('interactionField.validForMinutesCompareMarkersAfterSubmissionThen') }}
        </p>
      </div>
      <div v-for="p in state.pending" :key="p.expires">
        <p>{{ p.claimed ? controlText('inlineSummary.groupMarkerAwaitingConfirmation',{p0:(p.marker)}) : controlText('expressionTwo.waitingForTargetGroupToSubmitBindingCode') }}</p>
        <template v-if="p.claimed"
          ><label>{{ controlText('interactionField.groupDisplayName') }}<input v-model="label" maxlength="60" /></label>
          <button
            :disabled="busy || !label.trim()"
            @click="send({ type: 'confirm', marker: p.marker, label })"
          >{{ controlText('workspace.confirmThisGroupSLinkToTheCurrent') }}</button></template
        >
      </div>
      <template v-if="state.binding">
        <h3>{{ state.binding.label }} · {{ state.binding.paused ? controlText('expressionTwo.pushPaused') : controlText('expressionTwo.pushEnabled') }}</h3>
        <div class="controls">
          <button
            :disabled="busy"
            @click="send({ type: state.binding.paused ? 'resume' : 'pause' })"
          >
            {{ state.binding.paused ? controlText('expressionTwo.resumeCurrentSummaryNewEvents') : controlText('expressionTwo.pauseGroupPush') }}
          </button>
          <button
            :disabled="busy"
            @click="send({ type: 'detail', detailed: !state.binding.detailed })"
          >
            {{ state.binding.detailed ? controlText('expressionThree.switchToRoundSummary') : controlText('expressionThree.switchToDetailedEvents') }}
          </button>
          <button :disabled="busy" @click="unbind">{{ controlText('workspace.unlink') }}</button>
          <button :disabled="busy" @click="editLimits">{{ controlText('workspace.adjustDeliverySettings') }}</button>
        </div>
        <form v-if="editing" class="limits" @submit.prevent="send({ type: 'limits', limits })">
          <label
            >{{ controlText('interactionField.backlogMergeThresholdMessages') }}<input
              v-model.number="limits.backlog"
              type="number"
              min="1"
              max="30"
              required
          /></label>
          <label
            >{{ controlText('interactionField.pendingMergeWindowSeconds') }}<input
              v-model.number="limits.maxAgeSeconds"
              type="number"
              min="60"
              max="1800"
              required
          /></label>
          <label
            >{{ controlText('interactionField.proactiveMessageIntervalPerGroupSeconds') }}<input
              v-model.number="limits.sendIntervalSeconds"
              type="number"
              min="10"
              max="60"
              required
          /></label>
          <label
            >{{ controlText('interactionField.newMessageCharacterLimit') }}<input
              v-model.number="limits.maxChars"
              type="number"
              min="300"
              max="1700"
              required
          /></label>
          <label
            >{{ controlText('interactionField.dailyLocalSendLimit') }}<input
              v-model.number="limits.daily"
              type="number"
              min="1"
              max="800"
              required
          /></label>
          <button :disabled="busy">{{ controlText('workspace.saveDeliverySettings') }}</button>
          <p>{{ controlText('workspace.textLimitsAffectNewTasksOnlyPlatformPermissions') }}</p>
        </form>
        <p>{{ controlText('workspace.mentionBotWithHelpWebEntrySceneCombat') }}</p>
        <details>
          <summary>{{ controlText('workspace.latestSummaryAndRecentDeliveries') }}</summary>
          <p class="content">{{ state.binding.latest }}</p>
          <article v-for="t in state.binding.tasks" :key="t.id">
            <strong>{{ t.status }}</strong> · {{ t.detail }}
            <p class="content">{{ t.text }}</p>
            <div v-if="['unknown', 'failed'].includes(t.status)" class="controls">
              <button :disabled="busy" @click="retry(t.id)">{{ controlText('workspace.verifyGroupAndExplicitlyResend') }}</button>
              <button
                :disabled="busy"
                @click="send({ type: 'resolve', taskId: t.id, retry: false })"
              >{{ controlText('workspace.markHandledWithoutResending') }}</button>
            </div>
          </article>
        </details>
      </template>
    </template>
  </section>
</template>

<style scoped>
.qq-panel {
  margin-bottom: 24px;
  overflow-wrap: anywhere;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.limits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 16px 0;
}
button,
input {
  min-height: 44px;
}
label {
  display: grid;
  gap: 8px;
  margin: 12px 0;
}
.content {
  white-space: pre-wrap;
}
article {
  border-top: 1px solid var(--border, var(--muted));
  padding: 12px 0;
}
.error {
  color: #ffbcb6;
}
summary {
  cursor: pointer;
  padding: 12px 0;
}
</style>
