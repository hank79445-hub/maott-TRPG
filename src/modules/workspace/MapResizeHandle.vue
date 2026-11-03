<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import { computed, onBeforeUnmount, ref } from 'vue'
const props = defineProps<{
  modelValue: number
  defaultHeight: number
  min?: number
  max?: number
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const min = computed(() => props.min ?? 260)
const max = computed(() =>
  Math.min(
    props.max ?? 900,
    Math.max(min.value + 40, (typeof window !== 'undefined' ? window.innerHeight : 900) - 200),
  ),
)
const dragging = ref(false)
let startY = 0
let startH = 0
let pointerId = -1

function clamp(value: number) {
  return Math.min(max.value, Math.max(min.value, Math.round(value)))
}
function apply(value: number) {
  emit('update:modelValue', clamp(value))
}
function down(event: PointerEvent) {
  if (event.button !== 0) return
  dragging.value = true
  startY = event.clientY
  startH = props.modelValue
  pointerId = event.pointerId
  ;(event.currentTarget as HTMLElement).setPointerCapture(pointerId)
  document.body.classList.add('map-resizing')
  event.preventDefault()
}
function move(event: PointerEvent) {
  if (!dragging.value) return
  apply(startH + (event.clientY - startY))
}
function up(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  document.body.classList.remove('map-resizing')
  const el = event.currentTarget as HTMLElement
  if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
  pointerId = -1
}
function key(event: KeyboardEvent) {
  if (event.key === 'ArrowUp') {
    apply(props.modelValue - 16)
    event.preventDefault()
  } else if (event.key === 'ArrowDown') {
    apply(props.modelValue + 16)
    event.preventDefault()
  } else if (event.key === 'Home') {
    apply(props.defaultHeight)
    event.preventDefault()
  }
}
onBeforeUnmount(() => document.body.classList.remove('map-resizing'))
</script>
<template>
  <div
    class="map-resize"
    :class="{ dragging }"
    role="separator"
    aria-orientation="horizontal"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    :aria-label="label || controlText('expressionFour.adjustMapHeight')"
    tabindex="0"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
    @keydown="key"
    @dblclick="apply(defaultHeight)"
  >
    <i aria-hidden="true"></i>
    <span>{{ modelValue }}px</span>
  </div>
</template>
<style scoped>
.map-resize {
  position: relative;
  height: 14px;
  margin-top: -7px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  touch-action: none;
  z-index: 2;
}
.map-resize i {
  width: 44px;
  height: 3px;
  border-radius: 99px;
  background: var(--line, #d3dddc);
  transition: background-color 0.15s ease;
}
.map-resize:hover i,
.map-resize.dragging i,
.map-resize:focus-visible i {
  background: var(--accent, #2c6b66);
}
.map-resize:focus-visible {
  outline: 2px solid var(--accent, #2c6b66);
  outline-offset: -2px;
  border-radius: 6px;
}
.map-resize span {
  position: absolute;
  right: 10px;
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--panel, #fff);
  border: 1px solid var(--line, #d3dddc);
  color: var(--muted, #617275);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.map-resize:hover span,
.map-resize.dragging span,
.map-resize:focus-visible span {
  opacity: 1;
}
@media (max-width: 768px) {
  .map-resize {
    display: none;
  }
}
</style>
