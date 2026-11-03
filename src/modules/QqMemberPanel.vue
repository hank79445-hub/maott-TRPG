<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { QqMemberView } from '../online/qq-types'
import type { RoomView } from '../online/protocol'
import QqContextPanel from './QqContextPanel.vue'
import QqPairingWizard from './QqPairingWizard.vue'

const props = defineProps<{
  view: RoomView
  request: <T>(suffix: string, body?: unknown) => Promise<T | null>
}>()
const selectedBot = ref('default')
const state = ref<QqMemberView | null>(null),
  code = ref(''),
  busy = ref(false),
  message = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let live = true
async function reload() {
  try {
    const result = await props.request<QqMemberView>(
      'qq-member?bot=' + encodeURIComponent(selectedBot.value),
    )
    if (live && result) state.value = result
  } catch {
    if (live) message.value = 'QQ 身份入口暂不可用；Web 操作仍可使用。'
  }
}
async function run(body: unknown) {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    const result = await props.request<QqMemberView>(
      'qq-member?bot=' + encodeURIComponent(selectedBot.value),
      body,
    )
    if (!live) return
    if (!result) {
      message.value = '操作未完成，请查看房间提示后重试。'
      return
    }
    state.value = result
    if (result.code) code.value = result.code
    else code.value = ''
    message.value = '已保存。'
  } catch (e) {
    if (live) message.value = e instanceof Error ? e.message : '操作未完成'
  } finally {
    busy.value = false
  }
}
onMounted(() => {
  void reload()
  timer = setInterval(() => {
    if (!busy.value) void reload()
  }, 10000)
})
onBeforeUnmount(() => {
  live = false
  if (timer) clearInterval(timer)
})
function changeBot() {
  code.value = ''
  void reload()
}
</script>

<template>
  <section class="qq-member" aria-labelledby="qq-member-heading">
    <QqPairingWizard :view="view" :request="request" />
    <h3 id="qq-member-heading">
      {{ view.self.role === 'gm' ? controlText('expressionTwo.qqPlayerIdentityAndContext') : controlText('expressionTwo.qqPlayerIdentity') }}
    </h3>
    <p class="muted">{{ controlText('workspace.groupCommandsAndRepliesArePublicToThe') }}</p>
    <label v-if="state?.bots?.length"
      >{{ controlText('configurationField.qqPairingBot') }}<select v-model="selectedBot" :disabled="busy" @change="changeBot">
        <option v-for="b in state.bots" :key="b.key" :value="b.key">{{ localizedEntryName(b) }}</option>
      </select></label
    >
    <p v-if="state?.bots && state.bots.length > 1">{{ controlText('workspace.eachBotMustConfirmItsOwnPairingA') }}</p>
    <p v-if="!state?.enabled">{{ controlText('workspace.theGmMustFirstLinkTheQqGroup') }}</p>
    <template v-else-if="!state.gm">
      <p>{{ controlText('workspace.eachQqIdentityBindsToOneWebPlayer') }}</p>
      <div class="room-row">
        <button :disabled="busy" @click="run({ type: 'code' })">
          {{ busy ? controlText('expressionTwo.processing') : controlText('expressionTwo.generateQqPairingCode') }}
        </button>
        <button :disabled="busy" @click="reload">{{ controlText('domain.refreshPairing') }}</button>
      </div>
      <p v-if="code" class="qq-code">
        {{ controlText('configurationField.inTheTargetGroupMentionBotAndEnter') }} <code>配对 {{ code }}</code
        >{{ controlText('interactionField.validForMinutesCompareTheReplyMarkerThen') }}
      </p>
      <div v-for="p in state.pending" :key="p.marker" class="room-row">
        <span
          >{{ controlText('interactionField.groupPairingMarker') }}<strong>{{ p.marker }}</strong></span
        >
        <button :disabled="busy" @click="run({ type: 'confirm', marker: p.marker })">{{ controlText('workspace.markersMatchConfirmBinding') }}</button>
      </div>
      <div v-if="state.identity">
        <p>{{ controlText('workspace.qqPlayerIdentityIsBound') }}</p>
        <label
          >{{ controlText('interactionField.qqControlledCharacter') }}
          <select
            :value="state.identity.characterId"
            :disabled="busy"
            @change="
              run({ type: 'select', characterId: ($event.target as HTMLSelectElement).value })
            "
          >
            <option value="" disabled>{{ controlText('workspace.chooseAnAssignedCharacter') }}</option>
            <option v-for="c in state.characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
          </select>
        </label>
        <button :disabled="busy" @click="run({ type: 'revoke', identityId: state.identity.id })">{{ controlText('workspace.revokeMyQqBinding') }}</button>
      </div>
      <details>
        <summary>{{ controlText('workspace.viewGroupCommands') }}</summary>
        <p>{{ controlText('workspace.commandsNpcDialogueIdDialogueId') }}</p>
        <p>
          {{ controlText('adjudication.commandSyntaxRemainsChineseXYZeroBased') }}
        </p>
        <p>{{ controlText('workspace.queryIdWithdrawIdIfNamesOrParameters') }}</p>
      </details>
    </template>
    <template v-else>
      <p>{{ controlText('workspace.playersPairUsingTheirOwnWebMembershipGm') }}</p>
      <div v-for="i in state.identities" :key="i.id" class="room-row">
        <span>{{ i.nickname }} · {{ i.character }}</span>
        <button :disabled="busy" @click="run({ type: 'revoke', identityId: i.id })">{{ controlText('workspace.revokeQqPermission') }}</button>
      </div>
      <p v-if="!state.identities.length" class="muted">{{ controlText('workspace.noPlayerHasConfirmedAQqIdentity') }}</p>
      <QqContextPanel :state="state" :characters="view.characters" :busy="busy" @command="run" />
    </template>
    <p role="status" aria-live="polite">{{ message }}</p>
  </section>
</template>

<style scoped>
.qq-member {
  margin-block: 1rem;
  border-block-start: 1px solid var(--border, #76664b);
  padding-block-start: 1rem;
}
.qq-code {
  overflow-wrap: anywhere;
}
.qq-member button,
.qq-member select {
  min-height: 44px;
  margin: 4px;
}
.qq-member label {
  display: grid;
  gap: 0.5rem;
  max-width: 28rem;
}
.qq-member details {
  margin-block: 1rem;
}
.qq-member summary {
  cursor: pointer;
  padding: 0.7rem 0;
}
</style>
