<script setup lang="ts">
import {uiDate} from './locale-format'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
import qrcode from 'qrcode-generator'
import type { RoomView, RoomCommand } from '../online/protocol'
interface LanStatus {
  enabled: boolean
  addresses: string[]
  adminUrl: string
  candidates: string[]
  port: number
}
const props = defineProps<{
  view: RoomView
  invite?: string
  busy: boolean
  requestsOnly?: boolean
  loadStatus?: () => Promise<LanStatus | null>
}>()
const emit = defineEmits<{ command: [RoomCommand]; rotate: [hours: number] }>()
const lan = ref<LanStatus | null>(null),
  origin = ref(''),
  message = ref(''),
  hours = ref(24)
const currentOrigin = location.origin
const requests = computed(() => props.view.lanRequests?.filter((r) => r.status === 'pending') ?? [])
const link = computed(() => {
  if (!props.invite) return ''
  const base = origin.value || location.origin,
    local = lan.value?.addresses.includes(base)
  return (
    base +
    (local ? '/lan' : '/?page=room') +
    (local ? '?' : '&') +
    new URLSearchParams({ code: props.view.shortCode ?? props.view.id, invite: props.invite })
  )
})
const qr = computed(() => {
  if (!link.value) return ''
  const q = qrcode(0, 'M')
  q.addData(link.value)
  q.make()
  return (
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(q.createSvgTag({ cellSize: 4, margin: 16, scalable: true }))
  )
})
async function refresh() {
  try {
    lan.value = (await props.loadStatus?.()) ?? null
    if (!origin.value && lan.value?.addresses.length) origin.value = lan.value.addresses[0]!
  } catch (e) {
    message.value = e instanceof Error ? e.message : '无法获取入口状态'
  }
}
async function copy() {
  try {
    if (!navigator.clipboard) throw Error()
    await navigator.clipboard.writeText(link.value)
    message.value = '已复制玩家加入链接'
  } catch {
    message.value = '此浏览器不能自动复制，请选中下方链接手动复制。'
  }
}
</script>
<template>
  <section v-if="view.self.role === 'gm'" class="room-connect" :aria-label="controlText('interactionField.roomInvitationsAndLan')">
    <template v-if="!requestsOnly">
      <details @toggle="($event.target as HTMLDetailsElement).open && refresh()">
        <summary>{{ controlText('progressSummary.invitationsAndLanConnectionRoom', {p0:(view.shortCode ?? view.id)}) }}</summary>
        <p>
          {{ controlText('room.invite') }}{{ invite || controlText('expressionThree.plaintextNotRetainedResetToGenerateANew') }} ·
          {{
            view.invitation?.enabled === false
              ? controlText('controls.disabled')
              : view.invitation?.expiresAt
                ? controlText('expressionThree.expires') + uiDate(view.invitation.expiresAt,'datetime')
                : controlText('expressionThree.legacyInvitationResetEnablesExpiry')
          }}
        </p>
        <div class="room-row">
          <label
            >{{ controlText('interactionField.invitationDuration') }}<select v-model.number="hours">
              <option :value="1">{{ controlText('adjudication.message1Hour') }}</option>
              <option :value="24">{{ controlText('adjudication.message24Hours') }}</option>
              <option :value="72">{{ controlText('adjudication.message3Days') }}</option>
              <option :value="168">{{ controlText('adjudication.message7Days') }}</option>
            </select></label
          ><button :disabled="busy" @click="emit('rotate', hours)">{{ controlText('adjudication.generateResetInvitationCode') }}</button
          ><button
            :disabled="busy"
            @click="emit('command', { kind: 'invite-policy', enabled: true, hours })"
          >
            {{ controlText('adjudication.extendEnable') }}</button
          ><button
            class="subtle"
            :disabled="busy"
            @click="emit('command', { kind: 'invite-policy', enabled: false })"
          >
            {{ controlText('adjudication.disableNewInvitations') }}
          </button>
        </div>
        <p>
          <a href="http://127.0.0.1:8797/" target="_blank" rel="noopener"
            >{{ controlText('adjudication.enableDisableLanEntryOnTheGmHost') }}</a
          >
          · <button class="subtle" @click="refresh">{{ controlText('adjudication.refreshEntryAddresses') }}</button>
        </p>
        <p class="muted">{{ controlText('adjudication.openTheLocalAdministrationPageOnTheGm') }}</p>
        <label v-if="lan?.addresses.length"
          >{{ controlText('interactionField.shareEntry') }}<select v-model="origin">
            <option v-for="a in lan.addresses" :key="a" :value="a">{{ controlText('progressSummary.lan', {p0:(a)}) }}</option>
            <option :value="currentOrigin">{{ controlText('progressSummary.currentSite', {p0:(currentOrigin)}) }}</option>
          </select></label
        >
        <div v-if="link" class="invite-share">
          <img :src="qr" :alt="controlText('interactionField.playerRoomJoinQrCode')" width="176" height="176" />
          <div>
            <label
              >{{ controlText('interactionField.playerJoinLink') }}<input
                :value="link"
                readonly
                @focus="($event.target as HTMLInputElement).select()" /></label
            ><button :disabled="busy" @click="copy">{{ controlText('adjudication.copyJoinLink') }}</button>
            <p class="muted">{{ controlText('adjudication.shareWithParticipantsItContainsNoGmOr') }}</p>
          </div>
        </div>
        <p v-if="message" role="status">{{ message }}</p>
      </details>
    </template>
    <article v-for="r in requests" :key="r.id" class="join-request">
      <strong>{{ controlText('progressSummary.requestsLanEntry', {p0:(r.nickname)}) }}</strong
      ><small>{{ uiDate(r.at,'datetime') }}</small>
      <div class="room-row">
        <button
          :disabled="busy"
          @click="emit('command', { kind: 'lan-review', id: r.id, approve: true })"
        >
          {{ controlText('adjudication.approveAsPlayer') }}</button
        ><button
          class="subtle"
          :disabled="busy"
          @click="emit('command', { kind: 'lan-review', id: r.id, approve: false })"
        >
          {{ controlText('controls.reject') }}
        </button>
      </div>
    </article>
  </section>
</template>
<style scoped>
.room-connect {
  margin-block: 8px;
}
.room-connect summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  font-weight: 700;
}
.room-connect p {
  line-height: 1.5;
}
.invite-share {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.invite-share > div {
  flex: 1;
  min-width: 200px;
}
.invite-share img {
  background: white;
  border-radius: 8px;
}
.invite-share input {
  width: 100%;
  box-sizing: border-box;
}
.join-request {
  display: grid;
  gap: 8px;
  padding: 12px;
  margin-top: 8px;
  border: 1px solid var(--line, #cdd6d4);
  border-radius: 10px;
}
.room-connect button,
.room-connect select {
  min-height: 44px;
}
</style>
