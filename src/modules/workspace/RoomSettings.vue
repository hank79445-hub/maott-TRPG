<script setup lang="ts">
import {uiDate} from '../locale-format'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import LanguageSelect from '../LanguageSelect.vue'
import { workspaceText } from './workspace-labels'
import { computed, ref } from 'vue'
import { reviewSoundEnabled, reviewSoundNotice, setReviewSound, reviewChime } from '../useReviewSound'
import type { RoomView } from '../../online/protocol'

const props = withDefaults(defineProps<{
  view: RoomView
  gm: boolean
  busy: boolean
  railWidth: number
  railMax?: number
  messageWidth?: number
  messageMax?: number
  mapHeight: number
}>(), { railMax: 520, messageWidth: 380, messageMax: 600 })
const emit = defineEmits<{
  resetRail: []
  resetMessage: []
  setRail: [width: number]
  setMessage: [width: number]
  resetMap: []
  navigate: [id: string]
}>()
const dockEnabled = defineModel<boolean>('messageDock', { default: true })

const q = ref('')
const limit = ref(20)
const copied = ref('')
const roomCode = computed(() => props.view.shortCode ?? props.view.id)

const events = computed(() => [...props.view.events].reverse())
const filtered = computed(() => {
  const key = q.value.trim().toLowerCase()
  return key
    ? events.value.filter(
        (e) => e.detail.toLowerCase().includes(key) || e.at.toLowerCase().includes(key),
      )
    : events.value
})
const shown = computed(() => filtered.value.slice(0, limit.value))
const hasMore = computed(() => filtered.value.length > limit.value)

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = label
    setTimeout(() => (copied.value = ''), 1500)
  } catch {
    copied.value = ''
  }
}
</script>
<template>
  <LanguageSelect />
  <section class="settings-stack" :aria-label="controlText('domain.roomSettings')">
    <article class="settings-card">
      <header>
        <h2>{{ controlText('room.records') }}</h2>
        <p>{{ controlText('room.recordsHelp') }}</p>
      </header>
      <label class="settings-switch">
        <input v-model="dockEnabled" type="checkbox" />
        <span
          ><b>{{ controlText('room.useMessageWindow') }}</b
          ><small>{{ controlText('room.hideMessageHelp') }}</small></span
        >
      </label>
      <div v-if="gm" class="settings-row"><label class="settings-switch"><input type="checkbox" :checked="reviewSoundEnabled" @change="setReviewSound(($event.target as HTMLInputElement).checked)" /><span><b>{{ controlText('domain.reviewSound') }}</b><small>{{ controlText('room.soundHelp') }}</small></span></label><button type="button" @click="reviewChime().catch(() => {})">{{ controlText('domain.enableSound') }}</button></div>
      <p v-if="gm && reviewSoundNotice" role="status" class="runtime-feedback">{{ controlText('scriptSummary.pendingNewReviewNotificationsAreRetainedClick', {p0:(reviewSoundNotice)}) }}</p>
      <details class="settings-log">
        <summary>
          {{ controlText('room.roomHistory') }}
          <span>{{ filtered.length }} / {{ events.length }}</span>
        </summary>
        <div class="settings-log-tools">
          <input v-model="q" :placeholder="controlText('room.searchHistory')" :aria-label="controlText('room.searchHistoryAria')" />
          <button v-if="q" class="secondary" @click="q = ''">{{ controlText('room.clear') }}</button>
        </div>
        <ol v-if="shown.length">
          <li v-for="event in shown" :key="event.id">
            <time>{{ uiDate(event.at,'time') }}</time>
            <span>{{ event.detail }}</span>
          </li>
        </ol>
        <p v-else class="muted">{{ controlText('room.noHistory') }}</p>
        <button v-if="hasMore" class="secondary" @click="limit += 50">{{ controlText('scriptSummary.loadMoreRemaining', {p0:(filtered.length - shown.length)}) }}</button>
      </details>
    </article>

    <article class="settings-card">
      <header>
        <h2>{{ controlText('room.interfaceNav') }}</h2>
        <p>{{ controlText('room.navHelp') }}</p>
      </header>
      <div class="settings-row">
        <div><b>{{ workspaceText('toolsWidth') }}</b><small>{{ workspaceText('toolsHelp') }}</small>
          <input type="range" :aria-label="workspaceText('toolsWidth')" :value="railWidth" min="320" :max="railMax" @input="emit('setRail', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <input class="sidebar-width-number" type="number" :aria-label="workspaceText('toolNumber')" :value="railWidth" min="320" :max="railMax" @change="emit('setRail', Number(($event.target as HTMLInputElement).value))" />
        <button class="secondary" @click="emit('resetRail')">{{ controlText('room.resetDefault') }}</button>
      </div>
      <div v-if="!gm" class="settings-row">
        <div><b>{{ workspaceText('messagesWidth') }}</b><small>{{ workspaceText('messagesHelp') }}</small>
          <input type="range" :aria-label="workspaceText('messagesWidth')" :value="messageWidth" min="320" :max="messageMax" @input="emit('setMessage', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <input class="sidebar-width-number" type="number" :aria-label="workspaceText('messageNumber')" :value="messageWidth" min="320" :max="messageMax" @change="emit('setMessage', Number(($event.target as HTMLInputElement).value))" />
        <button class="secondary" @click="emit('resetMessage')">{{ controlText('room.resetDefault') }}</button>
      </div>
      <div class="settings-row">
        <div><b>{{ controlText('room.mapHeight') }}</b><small>{{ controlText('room.mapHeightHelp') }}</small></div>
        <span class="settings-value">{{ mapHeight }}px</span>
        <button class="secondary" @click="emit('resetMap')">{{ controlText('room.resetDefault') }}</button>
      </div>
    </article>

    <article class="settings-card">
      <header>
        <h2>{{ controlText('room.roomAccess') }}</h2>
        <p>{{ controlText('room.roomAccessHelp') }}</p>
      </header>
      <div class="settings-row">
        <div><b>{{ controlText('controls.room') }}</b><small>{{ localizedEntryName(view) }}</small></div>
        <span class="settings-value">{{ controlText('scriptSummary.people', {p0:(view.members.length)}) }}</span>
      </div>
      <div class="settings-row">
        <div><b>{{ controlText('domain.roomId') }}</b><small class="mono">{{ roomCode }}</small></div>
        <button class="secondary" @click="copy(roomCode, 'id')">
          {{ copied === 'id' ? controlText('expressionFour.copied') : controlText('controls.copy') }}
        </button>
      </div>
      <div class="settings-row">
        <div>
          <b>{{ controlText('room.currentIdentity') }}</b><small>{{ gm ? controlText('domain.gm') : view.self.role === 'ai' ? 'AI' : controlText('controls.player') }}</small>
        </div>
        <span class="settings-value">{{ view.self.nickname }}</span>
      </div>
    </article>

    <article v-if="gm" class="settings-card">
      <header>
        <h2>{{ controlText('room.rulesAiConnections') }}</h2>
        <p>{{ controlText('room.settingsLinksHelp') }}</p>
      </header>
      <div class="settings-links">
        <button class="secondary" :disabled="busy" @click="emit('navigate', 'intents')">
          {{ controlText('room.reviewSettings') }}
        </button>
        <button class="secondary" :disabled="busy" @click="emit('navigate', 'ai')">
          {{ controlText('game.aiPanel') }}
        </button>
        <button class="secondary" :disabled="busy" @click="emit('navigate', 'integration')">
          {{ controlText('room.externalQq') }}
        </button>
      </div>
    </article>
  </section>
</template>
<style scoped>
.settings-stack {
  display: grid;
  gap: 12px;
  max-width: 880px;
}
.settings-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.settings-card > header {
  display: grid;
  gap: 4px;
}
.settings-card h2 {
  margin: 0;
  font-size: 17px;
}
.settings-card > header p {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.6;
}
.settings-switch {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
}
.settings-switch input {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}
.settings-switch b {
  display: block;
  font-size: 13.5px;
}
.settings-switch small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.settings-log {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
}
.settings-log > summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
.settings-log > summary span {
  margin-left: auto;
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.settings-log-tools {
  display: flex;
  gap: 8px;
  margin: 6px 0 8px;
}
.settings-log-tools input {
  flex: 1;
  min-width: 0;
}
.settings-log ol {
  max-height: 320px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}
.settings-log li {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 8px;
  padding: 6px 0;
  border-top: 1px dashed var(--line);
  font-size: 12.5px;
  line-height: 1.6;
}
.settings-log li:first-child {
  border-top: 0;
}
.settings-log time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.settings-log li span {
  overflow-wrap: anywhere;
}
.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--line);
}
.settings-row:first-of-type {
  border-top: 0;
}
.settings-row > div {
  flex: 1;
  min-width: 0;
}
.settings-row b {
  display: block;
  font-size: 13px;
}
.settings-row small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.settings-row .mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.settings-value {
  color: var(--muted);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.settings-row .sidebar-width-number { width: 86px; flex: 0 0 86px; }
.settings-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.settings-links button {
  min-height: 34px;
  font-size: 12.5px;
}
.danger-zone {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--line));
}
.danger-zone button {
  justify-self: start;
  min-height: 34px;
}
@media (max-width: 640px) {
  .settings-card {
    padding: 14px;
  }
  .settings-row {
    flex-wrap: wrap;
  }
  .settings-value {
    order: 2;
  }
}
</style>
