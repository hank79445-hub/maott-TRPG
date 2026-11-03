<script setup lang="ts">
import {uiLabel} from './ui-label'
import {displayFeedback} from './feedback-presentation'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { onMounted, onBeforeUnmount, ref } from 'vue'
import { notifications as notices, type NoticeKind } from '../app/notifications'
const historyOpen = ref(false)
const labels: Record<NoticeKind, string> = {
  success: '完成',
  info: '提示',
  review: '待审核',
  warning: '注意',
  error: '未完成',
  progress: '处理中',
}
let timer: ReturnType<typeof setInterval>
function blur(event: FocusEvent, id: number) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
    notices.pause(id, false)
}
onMounted(() => {
  timer = setInterval(() => notices.tick(250), 250)
})
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <Teleport to="body">
    <div class="notification-host" data-ui-notifications :aria-label="controlText('configurationField.operationHint')">
      <section
        v-for="n in notices.visible"
        :key="n.id"
        :class="['notification-card', n.kind]"
        role="status"
        aria-live="polite"
        @mouseenter="notices.pause(n.id, true)"
        @mouseleave="notices.pause(n.id, false)"
        @focusin="notices.pause(n.id, true)"
        @focusout="blur($event, n.id)"
      >
        <div>
          <strong>{{ uiLabel(labels[n.kind]) }}</strong
          ><span>{{ displayFeedback(n.text,n.kind) }}</span
          ><small v-if="n.count > 1">×{{ n.count }}</small>
        </div>
        <button
          class="notification-dismiss"
          :aria-label="controlText('expressionTwo.closeNotification') + displayFeedback(n.text,n.kind)"
          @click="notices.dismiss(n.id)"
        >
          ×
        </button>
        <details v-if="n.details">
          <summary>{{ controlText('domain.technicalDetails') }}</summary>
          <pre>{{ n.details }}</pre>
        </details>
      </section>
      <details
        v-if="notices.history.length"
        class="notification-history"
        :open="historyOpen"
        @toggle="historyOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary>{{ controlText('quantity.recentNotices', {p0:(notices.history.length)}) }}</summary>
        <div class="notification-history-list">
          <p v-for="n in notices.history" :key="n.id">
            <strong>{{ uiLabel(labels[n.kind]) }}</strong> {{ displayFeedback(n.text,n.kind)
            }}<small v-if="n.count > 1"> ×{{ n.count }}</small>
          </p>
          <button @click="notices.history.splice(0)">{{ controlText('configuration.clearCurrentNotice') }}</button>
        </div>
      </details>
    </div>
  </Teleport>
</template>
<style>
.notification-host {
  position: fixed;
  z-index: 10000;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  width: min(520px, calc(100vw - 24px));
  pointer-events: none;
  display: grid;
  gap: 8px;
}
.notification-card {
  position: relative;
  background: var(--panel);
  color: var(--ink);
  box-shadow: 0 5px 22px #0003;
  border: 1px solid var(--line);
  border-left: 5px solid var(--accent);
  border-radius: 10px;
  padding: 12px 44px 12px 14px;
  pointer-events: auto;
  font-size: 14px;
  max-height: 35vh;
  overflow: auto;
}
.notification-card > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.notification-card span {
  overflow-wrap: anywhere;
}
.notification-card.success {
  border-left-color: var(--good);
}
.notification-card.error {
  border-left-color: var(--danger);
}
.notification-card.warning {
  border-left-color: var(--warning);
}
.notification-card.review {
  border-left-color: var(--review);
}
.notification-dismiss {
  position: absolute;
  right: 4px;
  top: 3px;
  min-width: 36px;
  min-height: 36px;
  padding: 0 !important;
  background: var(--button-bg, #e1e8ec);
  color: var(--ink, #283947);
}
.notification-card pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
}
.notification-history {
  pointer-events: auto;
  justify-self: center;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 12px;
  color: var(--ink);
  max-width: 100%;
  max-height: 40vh;
  overflow: auto;
}
.notification-history summary {
  cursor: pointer;
  padding: 6px 12px;
}
.notification-history-list {
  padding: 0 12px 12px;
}
.notification-history-list p {
  overflow-wrap: anywhere;
  margin: 8px 0;
}
@media (max-width: 700px) {
  .notification-host {
    top: max(8px, env(safe-area-inset-top));
  }
  .notification-card {
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .notification-card > div {
    flex-wrap: wrap;
  }
  .notification-dismiss {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>
