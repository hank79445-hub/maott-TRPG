<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MapFeedback } from '../../online/map-feedback-types'
import type { FogView } from '../../persistence/fog-schema'
import { decodeFog } from '../../core/fog'
import { FeedbackCursor, feedbackRayVisible } from './feedback'
import {
  useMapFeedback,
  feedbackPreferences as prefs,
  loadFeedbackPreferences,
} from './useMapFeedback'
const props = defineProps<{
    sceneId: string
    size: number
    zoom?: number
    offset: { x: number; y: number }
    fog?: FogView
  }>(),
  source = useMapFeedback(),
  cursor = new FeedbackCursor(),
  active = ref<(MapFeedback & { expires: number })[]>([])
let queue: (MapFeedback & { queuedAt: number })[] = [],
  timer: ReturnType<typeof setTimeout> | undefined,
  stop: ReturnType<typeof watch> | undefined
const visible = computed(() =>
  props.fog ? decodeFog(props.fog.visible, props.fog.columns, props.fog.rows) : undefined,
)
function clear() {
  clearTimeout(timer)
  timer = undefined
  queue = []
  active.value = []
}
function allowed(e: MapFeedback) {
  return !visible.value || visible.value.has(Math.floor(e.anchor.x) + ',' + Math.floor(e.anchor.y))
}
const items = computed(() => {
  const slots = new Map<string, number>()
  return active.value.filter(allowed).map((e) => {
    const key = e.anchor.x + ',' + e.anchor.y,
      slot = slots.get(key) ?? 0
    slots.set(key, slot + 1)
    return {
      ...e,
      labelSlot: slot,
      source:
        e.source &&
        feedbackRayVisible(
          e.source,
          e.anchor,
          visible.value ? (x, y) => visible.value!.has(x + ',' + y) : undefined,
        )
          ? e.source
          : undefined,
    }
  })
})
function pump() {
  clearTimeout(timer)
  const now = performance.now()
  active.value = active.value.filter((e) => e.expires > now)
  const budget = matchMedia('(max-width:700px)').matches ? 8 : 16
  while (queue.length && active.value.length < budget) {
    const e = queue.shift()!
    if (now - e.queuedAt <= 1200 && allowed(e)) active.value.push({ ...e, expires: now + 850 })
  }
  if (active.value.length || queue.length) timer = setTimeout(pump, 100)
}
function visibility() {
  if (document.hidden) {
    clear()
    cursor.reset()
  }
}
onMounted(() => {
  loadFeedbackPreferences()
  document.addEventListener('visibilitychange', visibility)
  stop = watch(
    () => [source?.(), props.sceneId] as const,
    ([state, scene], old) => {
      if (!state?.feed) return
      const prior = old?.[0],
        changed =
          !!prior &&
          (prior.epoch !== state.epoch ||
            prior.live !== state.live ||
            old?.[1] !== scene ||
            prior.feed?.roomId !== state.feed.roomId ||
            prior.feed?.branchId !== state.feed.branchId ||
            state.feed.head < (prior.feed?.head ?? 0) ||
            state.feed.earliest > (prior.feed?.head ?? 0) + 1)
      if (changed) {
        clear()
        cursor.reset()
      }
      const invalidated = new Set(state.feed.invalidated ?? [])
      active.value = active.value.filter((e) => !invalidated.has(e.id))
      queue = queue.filter((e) => !invalidated.has(e.id))
      const batch = cursor.consume(state.feed, scene, state.live && !document.hidden)
      if (!state.live || document.hidden || prefs.value.mode === 'off') {
        clear()
        return
      }
      queue = [
        ...queue,
        ...batch
          .filter((e) => prefs.value.audience !== 'self' || e.own)
          .map((e) => ({ ...e, queuedAt: performance.now() })),
      ].slice(-32)
      pump()
    },
    { immediate: true },
  )
})
watch(
  () => [prefs.value.mode, prefs.value.audience],
  () => clear(),
)
onBeforeUnmount(() => {
  stop?.()
  clear()
  document.removeEventListener('visibilitychange', visibility)
})
const color = (e: MapFeedback) =>
  e.kind === 'heal' || (e.kind === 'health' && (e.amount ?? 0) > 0)
    ? '#81d09c'
    : e.kind === 'damage' || e.kind === 'death'
      ? '#f4a08e'
      : e.kind === 'shield'
        ? '#91c8f4'
        : '#e9cd84'
</script>
<template>
  <g
    class="map-feedback"
    :class="{ 'feedback-static': prefs.mode === 'reduced' }"
    pointer-events="none"
    aria-hidden="true"
    :transform="`translate(${offset.x},${offset.y})`"
    ><g
      v-for="e in items"
      :key="e.id"
      class="feedback-item"
      :data-map-feedback="e.kind"
      :style="{ '--feedback-color': color(e) }"
      ><line
        v-if="e.source"
        class="feedback-ray"
        :x1="e.source.x * size"
        :y1="e.source.y * size"
        :x2="e.anchor.x * size"
        :y2="e.anchor.y * size"
        :stroke="color(e)"
        stroke-width="3"
        stroke-dasharray="8 5"
        vector-effect="non-scaling-stroke"
      /><g :transform="`translate(${e.anchor.x * size},${e.anchor.y * size})`"
        ><circle
          class="feedback-ring"
          :r="size * 0.45"
          fill="none"
          :stroke="color(e)"
          :stroke-width="e.critical ? 5 : 3"
          vector-effect="non-scaling-stroke"
        /><text
          v-if="e.labelSlot < 4"
          class="feedback-label"
          :y="
            (e.anchor.y * size * (zoom ?? 1) < 50
              ? 18 + e.labelSlot * 18
              : -18 - e.labelSlot * 18) / (zoom ?? 1)
          "
          text-anchor="middle"
          fill="white"
          stroke="#172632"
          :stroke-width="3 / (zoom ?? 1)"
          paint-order="stroke"
          :font-size="16 / (zoom ?? 1)"
          >{{ e.title
          }}{{
            e.amount !== undefined
              ? ' ' +
                (e.kind === 'heal' ||
                (e.kind === 'health' && (e.amount ?? 0) > 0) ||
                (e.kind === 'shield' && (e.amount ?? 0) > 0)
                  ? '+'
                  : '') +
                e.amount
              : ''
          }}</text
        ></g
      ></g
    ></g
  >
</template>
<style scoped>
.map-feedback {
  pointer-events: none;
}
.feedback-item {
  animation: feedback-fade 0.85s ease-out both;
}
.feedback-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: feedback-ring 0.65s ease-out both;
}
.feedback-ray {
  animation: feedback-fade 0.5s ease-out both;
}
.feedback-label {
  font-weight: 700;
}
.feedback-static .feedback-item,
.feedback-static .feedback-ring,
.feedback-static .feedback-ray {
  animation: none;
}
@keyframes feedback-fade {
  0% {
    opacity: 1;
  }
  65% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
@keyframes feedback-ring {
  from {
    transform: scale(0.75);
    opacity: 1;
  }
  to {
    transform: scale(1.15);
    opacity: 0.2;
  }
}
@media (prefers-reduced-motion: reduce) {
  .feedback-item,
  .feedback-ring,
  .feedback-ray {
    animation: none;
  }
}
</style>
