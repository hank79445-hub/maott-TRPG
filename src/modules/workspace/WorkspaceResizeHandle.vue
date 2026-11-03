<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
const props = defineProps<{
  width: number
  min: number
  max: number
  direction: 1 | -1
  label: string
}>()
const emit = defineEmits<{ resize: [width: number]; reset: [] }>()
let drag: { id: number; x: number; width: number; element: HTMLElement } | null = null
function update(value: number) {
  emit('resize', Math.max(props.min, Math.min(props.max, Math.round(value))))
}
function start(event: PointerEvent) {
  if (event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  drag = { id: event.pointerId, x: event.clientX, width: props.width, element }
  element.setPointerCapture(event.pointerId)
  element.focus()
  document.body.classList.add('rail-resizing')
  event.preventDefault()
}
function move(event: PointerEvent) {
  if (drag?.id === event.pointerId) update(drag.width + (event.clientX - drag.x) * props.direction)
}
function end() {
  const previous = drag
  drag = null
  if (previous?.element.hasPointerCapture(previous.id))
    previous.element.releasePointerCapture(previous.id)
  document.body.classList.remove('rail-resizing')
}
onBeforeUnmount(end)
</script>
<template>
  <button
    class="workspace-resize"
    type="button"
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    :title="label"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="width"
    @pointerdown="start"
    @pointermove="move"
    @pointerup="end"
    @pointercancel="end"
    @lostpointercapture="end"
    @dblclick="emit('reset')"
    @keydown.home.prevent="emit('reset')"
    @keydown.left.prevent="update(width - 16)"
    @keydown.right.prevent="update(width + 16)"
  />
</template>
<style scoped>
.workspace-resize {
  position: fixed;
  top: 86px;
  bottom: 80px;
  width: 12px;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  z-index: 34;
  cursor: col-resize;
  touch-action: none;
}
.workspace-resize::before {
  content: '';
  position: absolute;
  width: 3px;
  height: 46px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--line);
  border-radius: 3px;
}
.workspace-resize:hover::before,
.workspace-resize:focus-visible::before {
  background: var(--accent);
}
.workspace-resize:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
