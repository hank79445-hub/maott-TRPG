<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import type { roomClient } from '../online/client'
import type { RoomCommand, RoomView } from '../online/protocol'
import AiJobCard from './AiJobCard.vue'
import NpcPeerPanel from './NpcPeerPanel.vue'
import QuestStepReview from './review/QuestStepReview.vue'
import { useReviewSound, reviewSoundNotice, reviewSoundEnabled, reviewChime } from './useReviewSound'
import NpcKnowledgePanel from './NpcKnowledgePanel.vue'
import NpcSpatialPanel from './NpcSpatialPanel.vue'
import TradeReviewCard from './trade/TradeReviewCard.vue'
import SummonReviewCard from './summons/SummonReviewCard.vue'
import M5ReviewCard from './scene-effects/M5ReviewCard.vue'
import SceneTerrainReviewCard from './scene-effects/SceneTerrainReviewCard.vue'
import M3EventReviewCard from './m3/M3EventReviewCard.vue'
import GmSpellTools from './GmSpellTools.vue'
import GmSpellReviewCard from './GmSpellReviewCard.vue'
import RoomDicePanel from './dice/RoomDicePanel.vue'
import RoomConnectionPanel from './RoomConnectionPanel.vue'
import NpcTurnPanel from './NpcTurnPanel.vue'
import RoomIntentCard from './RoomIntentCard.vue'
import ReviewSettings from './ReviewSettings.vue'
import BattleResolution from './BattleResolution.vue'
import { pendingBattleReview, pendingRoomReviews } from './room-review-queue'
import { useRoomReviewLayout } from './useRoomReviewLayout'
import { focusDock } from './dock-focus'

const props = withDefaults(
  defineProps<{
    view: RoomView
    workshop: ReturnType<typeof roomClient>['workshop']
    busy: boolean
    extraCount?: number
    feedback?: string
    error?: boolean
  }>(),
  { extraCount: 0, feedback: '', error: false },
)
useReviewSound(() => props.view)
const emit = defineEmits<{ command: [command: RoomCommand]; battle: []; opened: [] }>()
defineSlots<{ extra(): unknown }>()
const gm = computed(() => props.view.self.role === 'gm'),
  queue = computed(() => pendingRoomReviews(props.view)),
  battle = computed(() => pendingBattleReview(props.view)),
  count = computed(
    () =>
      queue.value.count +
      (battle.value ? 1 : 0) +
      (props.view.dice?.pending.length ?? 0) +
      (props.view.lanRequests?.filter((r) => r.status === 'pending').length ?? 0) +
      Math.max(0, props.extraCount),
  ),
  isOpen = shallowRef(false),
  panel = useTemplateRef<HTMLElement>('panel'),
  dot = useTemplateRef<HTMLButtonElement>('dot'),
  panelId = useId(),
  titleId = useId(),
  { layout, mobile, dragging, reset, resize, keyAdjust, startGesture, shouldOpenFromClick } =
    useRoomReviewLayout()
const dotStyle = computed(() =>
    mobile.value ? undefined : { left: `${layout.value.dot.x}px`, top: `${layout.value.dot.y}px` },
  ),
  panelStyle = computed(() =>
    mobile.value
      ? undefined
      : {
          left: `${layout.value.panel.x}px`,
          top: `${layout.value.panel.y}px`,
          width: `${layout.value.panel.width}px`,
          height: `${layout.value.panel.height}px`,
        },
  )
let returnFocus: HTMLElement | null = null,
  originalOverflow: string | null = null

function open() {
  if (!gm.value || isOpen.value) return
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  isOpen.value = true
  if (mobile.value) emit('opened')
  void nextTick(() => {
    focusDock(panel.value)
    panel.value?.focus({ preventScroll: true })
  })
}
function close() {
  if (!isOpen.value) return
  isOpen.value = false
  const destination = returnFocus?.isConnected ? returnFocus : dot.value
  destination?.focus({ preventScroll: true })
}
function toggle(event: MouseEvent) {
  if (!shouldOpenFromClick(event)) return
  if (isOpen.value) close()
  else open()
}
function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close()
  } else if (event.key === 'Tab' && mobile.value && panel.value) {
    const controls = [
      ...panel.value.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]',
      ),
    ].filter((el) => el.getClientRects().length > 0)
    const first = controls[0],
      last = controls.at(-1),
      active = document.activeElement
    if (
      event.shiftKey &&
      (active === first || active === panel.value || !panel.value.contains(active))
    ) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && (active === last || !panel.value.contains(active))) {
      event.preventDefault()
      first?.focus()
    }
  }
}
function releaseScroll() {
  if (originalOverflow === null) return
  document.body.style.overflow = originalOverflow
  originalOverflow = null
}
watch(
  () => isOpen.value && mobile.value && gm.value,
  (locked) => {
    if (locked) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    } else releaseScroll()
  },
)
watch(() => props.view.id, close)
watch(gm, (isGm) => {
  if (!isGm) close()
})
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  releaseScroll()
})
defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <template v-if="gm">
      <button
        ref="dot"
        type="button"
        class="review-dot"
        :class="{ 'is-dragging': dragging === 'dot', 'has-pending': count > 0 }"
        :style="dotStyle"
        :aria-label="controlText('inlineSummary.quickReviewPending',{p0:(count)})"
        :aria-expanded="isOpen"
        :aria-controls="panelId"
        :title="controlText('review.dockHint')"
        @pointerdown="startGesture($event, 'dot')"
        @keydown="keyAdjust($event, 'dot')"
        @click="toggle"
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 13l3 3 5-6" />
        </svg>
        <span class="review-dot-label">{{ controlText('review.review') }}</span>
        <span class="review-dot-count" aria-hidden="true">{{ count > 99 ? '99+' : count }}</span>
      </button>
      <div v-show="isOpen && mobile" class="review-backdrop" aria-hidden="true" @click="close" />
      <section
        v-show="isOpen"
        :id="panelId"
        ref="panel"
        class="review-window"
        data-trpg-dock="review"
        @pointerdown="focusDock(panel)"
        :class="{ 'is-dragging': dragging === 'panel' }"
        :style="panelStyle"
        role="dialog"
        :aria-modal="mobile || undefined"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <header class="review-header">
          <button
            v-if="!mobile"
            type="button"
            class="review-move"
            :aria-label="controlText('review.moveHint')"
            :title="controlText('review.dragHint')"
            @pointerdown="startGesture($event, 'panel')"
            @keydown="keyAdjust($event, 'panel')"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
            </svg>
          </button>
          <h2 :id="titleId" class="review-title">
            {{ controlText('review.quickReview') }} <span class="review-total">{{ count }}</span>
          </h2>
          <button type="button" class="secondary review-close" @click="close">{{ controlText('controls.close') }}</button>
        </header>
        <div v-if="!mobile" class="review-layout-bar" :aria-label="controlText('review.position')">
          <button type="button" class="subtle" @click="reset">{{ controlText('review.resetPosition') }}</button>
          <button type="button" class="subtle" @click="resize(-80, -60)">{{ controlText('domain.shrink') }}</button>
          <button type="button" class="subtle" @click="resize(80, 60)">{{ controlText('domain.enlarge') }}</button>
          <small class="muted">{{ controlText('review.resizeHint') }}</small>
        </div>
        <div v-if="reviewSoundEnabled && reviewSoundNotice" class="review-feedback" role="status">
          <p>{{ reviewSoundNotice }}</p><button type="button" @click="reviewChime().catch(() => {})">{{ controlText('domain.enableSound') }}</button>
        </div>
        <div v-if="busy || feedback" class="review-feedback">
          <p v-if="busy" class="review-status muted" role="status">{{ controlText('review.saving') }}</p>
          <p
            v-if="feedback"
            class="review-status"
            :class="error ? 'danger-text' : 'muted'"
            :role="error ? 'alert' : 'status'"
          >
            {{ feedback }}
          </p>
        </div>
        <div class="review-scroll">
          <NpcPeerPanel v-if="view.peerSessions?.some(s=>s.status!=='stopped')" :view="view" :busy="busy" @command="emit('command',$event)" />
          <div class="room-row"><button :disabled="busy || !view.expiredReviewCount" @click="emit('command', { kind: 'review-archive-expired' })">{{ controlText('review.clearExpired') }} {{ view.expiredReviewCount ?? 0 }}</button><small class="muted">{{ controlText('review.archiveHint') }}</small></div>
          <section v-if="queue.trades.length" class="review-group" :aria-label="controlText('review.tradePending')"><h3>{{ controlText('review.tradeQuotes') }} {{queue.trades.length}}</h3><TradeReviewCard v-for="t in queue.trades" :key="t.id" :view="view" :session="t" :busy="busy" @command="emit('command',$event)" /></section>
          <section v-if="queue.reputations.length" class="review-group" :aria-label="controlText('review.factionPending')">
            <NpcKnowledgePanel :view="view" :busy="busy" quick-review @command="emit('command', $event)" />
          </section>
          <section v-if="view.world?.adventures[0]?.ai?.spatialState?.tasks.some(t=>!['completed','canceled'].includes(t.status))" class="review-group" :aria-label="controlText('review.npcSpatial')"><NpcSpatialPanel :view="view" :busy="busy" quick-review @command="emit('command',$event)" /></section>
          <section v-if="queue.m5.length||queue.m5Moves.length" class="review-group" :aria-label="controlText('review.spellPending')"><h3>{{ controlText('review.spellMovement') }} {{queue.m5.length+queue.m5Moves.length}}</h3><M5ReviewCard :view="view" :busy="busy" @command="emit('command',$event)" /></section>
          <section v-if="queue.terrain.length" class="review-group" :aria-label="controlText('review.areaPending')"><h3>{{ controlText('review.areaConsequences') }} {{queue.terrain.length}}</h3><SceneTerrainReviewCard v-for="event in queue.terrain" :key="event.id" :event="event" :view="view" :busy="busy" @command="emit('command',$event)" /></section>
          <section v-if="queue.summons.length||queue.summonDrafts.length" class="review-group" :aria-label="controlText('review.summonPending')"><h3>{{ controlText('review.summons') }} {{queue.summons.length+queue.summonDrafts.length}}</h3><SummonReviewCard :view="view" :busy="busy" @command="emit('command',$event)" /></section>
          <section v-if="queue.spatial.length" class="review-group" :aria-label="controlText('review.spatialPending')"><h3>{{ controlText('review.spatialConsequences') }} {{queue.spatial.length}}</h3><M3EventReviewCard v-for="event in queue.spatial" :key="event.id" :event="event" :view="view" :busy="busy" @command="emit('command',$event)" /></section>
          <section v-if="queue.spells.length" class="review-group" :aria-label="controlText('review.spellResultPending')">
            <h3>{{ controlText('review.spellResults') }} {{ queue.spells.length }}</h3>
            <GmSpellReviewCard v-for="request in queue.spells" :key="request.id"
              :request="request" :view="view" :busy="busy" @command="emit('command', $event)" />
          </section>
          <section v-if="battle && workshop && !queue.spells.some(r => r.pendingId && r.encounterId === view.encounter?.id)" class="review-group" :aria-label="controlText('review.battleResultPending')">
            <h3>{{ controlText('review.battleResults') }} {{ localizedEntryName(view.encounter) }}</h3>
            <p class="muted">{{ controlText('review.battleHelp') }}</p>
            <BattleResolution
              :key="battle.key"
              :encounter-id="battle.encounterId"
              :workshop="workshop"
              :busy="busy || !!view.dice?.pending.length"
              :scope="view.broadcast.branchId"
              @command="
                (c, guard) =>
                  emit('command', {
                    kind: 'map',
                    command: {
                      type: 'combat',
                      sceneId: view.scene!.id,
                      command: c,
                      resolutionGuard: guard,
                    },
                  })
              "
            />
            <button class="text-button" @click="emit('battle')">{{ controlText('review.openBattle') }}</button>
          </section>
          <RoomDicePanel
            v-if="view.dice?.pending.length"
            :view="view"
            :busy="busy"
            @command="emit('command', $event)"
          />
          <RoomConnectionPanel
            v-if="view.lanRequests?.some((r) => r.status === 'pending')"
            :view="view"
            :busy="busy"
            requests-only
            @command="emit('command', $event)"
          />
          <GmSpellTools :view="view" :busy="busy" @command="emit('command',$event)" />
          <ReviewSettings :view="view" :busy="busy" compact @command="emit('command', $event)" />
          <QuestStepReview :view="view" :busy="busy" @command="emit('command', $event)" />
          <section v-if="queue.practical.length" class="review-group" :aria-label="controlText('review.automationPending')"><h3>{{ controlText('review.factsRequired') }} {{queue.practical.length}}</h3><article v-for="task in queue.practical" :key="task.id"><strong>{{task.label}}</strong><p>{{task.reason}}</p><p class="muted">{{ controlText('review.factsHelp') }}</p><button :disabled="busy" @click="emit('command',{kind:'practical-takeover',taskId:task.id})">{{ controlText('domain.manualTakeover') }}</button></article></section>
          <section v-if="queue.intents.length" class="review-group" :aria-label="controlText('review.intentPending')">
            <h3 class="review-group-title">{{ controlText('review.intents') }} {{ queue.intents.length }}</h3>
            <RoomIntentCard
              v-for="intent in queue.intents"
              :key="intent.id"
              :view="view"
              :intent="intent"
              :busy="busy"
              @review="emit('command', $event)"
            />
          </section>
          <section
            v-if="queue.jobs.length"
            class="review-group"
            :aria-label="controlText('review.dialogueReview')"
          >
            <h3 class="review-group-title">{{ controlText('review.dialogueCount') }} {{ queue.jobs.length }}</h3>
            <AiJobCard
              v-for="job in queue.jobs"
              :key="job.id"
              :job="job"
              :view="view"
              :busy="busy"
              @command="emit('command', $event)"
            />
          </section>
          <section v-if="queue.turns.length" class="review-group" :aria-label="controlText('review.npcTurns')">
            <h3 class="review-group-title">{{ controlText('review.npcTurnCount') }} {{ queue.turns.length }}</h3>
            <NpcTurnPanel
              v-for="run in queue.turns"
              :key="run.id"
              :view="view"
              :run="run"
              :busy="busy"
              @command="emit('command', $event)"
            />
          </section>
          <section v-if="$slots.extra" class="review-group" :aria-label="controlText('review.characterRequests')">
            <slot name="extra" />
          </section>
          <p v-if="!count" class="review-empty muted">{{ controlText('review.noPending') }}</p>
        </div>
        <footer class="review-footer">
          <small class="muted">{{ controlText('review.closeHelp') }}</small>
          <button
            v-if="!mobile"
            type="button"
            class="review-resize"
            :aria-label="controlText('review.resizeAria')"
            :title="controlText('review.resizeDetails')"
            @pointerdown="startGesture($event, 'resize')"
            @keydown="keyAdjust($event, 'resize')"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path d="M5 19L19 5M12 19l7-7M18 19l1-1" />
            </svg>
          </button>
        </footer>
      </section>
    </template>
  </Teleport>
</template>

<style scoped>
.review-dot {
  position: fixed;
  z-index: 150;
  width: 56px;
  height: 56px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--panel);
  color: var(--accent);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 0;
  touch-action: none;
  user-select: none;
}
.review-dot.has-pending {
  border-color: var(--gold);
}
.review-dot:hover,
.review-move:hover,
.review-resize:hover {
  background: var(--accent-soft);
}
.review-dot-label {
  font-size: 12px;
  font-weight: 650;
}
.review-dot-count {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 24px;
  height: 24px;
  padding: 0 5px;
  border: 2px solid var(--panel);
  border-radius: 999px;
  background: var(--accent);
  color: var(--panel);
  font-size: 12px;
  line-height: 20px;
  font-weight: 700;
}
.review-window {
  position: fixed;
  z-index: 180;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--panel);
  color: var(--ink);
  box-shadow: 0 16px 64px color-mix(in srgb, var(--ink) 20%, transparent);
}
.review-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.review-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 18px;
}
.review-total {
  margin-left: 4px;
  color: var(--muted);
  font-size: 14px;
}
.review-move,
.review-resize {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 8px;
  color: var(--muted);
  touch-action: none;
  user-select: none;
}
.review-move {
  cursor: grab;
}
.review-resize {
  cursor: nwse-resize;
}
.is-dragging {
  cursor: grabbing;
}
.review-close,
.review-layout-bar :deep(button),
.review-scroll :deep(button) {
  min-height: 44px;
}
.review-layout-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 12px 4px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.review-layout-bar .subtle {
  padding: 8px;
}
.review-layout-bar small {
  flex: 1;
}
.review-scroll {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  overscroll-behavior: contain;
}
.review-feedback {
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.review-status {
  margin: 0;
  overflow-wrap: anywhere;
}
.review-group {
  min-width: 0;
  margin-bottom: 20px;
}
.review-group-title {
  margin: 0 0 8px;
  font-size: 15px;
  color: var(--accent);
}
.review-scroll :deep(.room-card) {
  padding: 16px;
  margin-bottom: 12px;
}
.review-scroll :deep(.room-row) {
  gap: 8px;
}
.review-scroll :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.review-scroll :deep(button) {
  white-space: normal;
}
.review-empty {
  padding: 24px 0;
  text-align: center;
}
.review-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px 4px 16px;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}
.review-backdrop {
  position: fixed;
  inset: 0;
  z-index: 160;
  background: color-mix(in srgb, var(--ink) 35%, transparent);
}
@media (max-width: 760px) {
  .review-dot {
    right: max(16px, env(safe-area-inset-right));
    bottom: max(140px, calc(env(safe-area-inset-bottom) + 140px));
    touch-action: manipulation;
  }
  .review-window {
    inset: auto 0 0;
    width: 100%;
    height: 88dvh;
    max-height: calc(100dvh - env(safe-area-inset-top) - 8px);
    border-radius: 16px 16px 0 0;
  }
  .review-header {
    padding: 10px 16px;
  }
  .review-scroll {
    padding: 16px 12px;
  }
  .review-footer {
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  }
}
</style>
