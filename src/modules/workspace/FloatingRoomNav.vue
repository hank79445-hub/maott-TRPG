<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{ items: { id: string; label: string }[]; active: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const open = defineModel<boolean>('open', { default: false })
const root = ref<HTMLElement | null>(null),
  trigger = ref<HTMLButtonElement | null>(null)
const position = ref({ x: 12, y: 104 }),
  ready = ref(false)
const current = computed(() => props.items.find((i) => i.id === props.active)?.label ?? '房间导航')
const key = 'trpg-floating-room-nav-v1'
let drag: { id: number; x: number; y: number; left: number; top: number } | null = null
function clamp() {
  if (typeof window === 'undefined') return
  const width = open.value ? 204 : 64,
    height = open.value ? Math.min(516, window.innerHeight - 24) : 80
  position.value = {
    x: Math.max(8, Math.min(position.value.x, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(position.value.y, window.innerHeight - height - 8)),
  }
}
function save() {
  if (!ready.value) return
  try {
    localStorage.setItem(key, JSON.stringify({ open: open.value, ...position.value }))
  } catch {
    /* Layout preferences never block navigation. */
  }
}
function close() {
  open.value = false
  nextTick(() => trigger.value?.focus())
}
function select(id: string) {
  emit('select', id)
  close()
}
function pointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  drag = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    left: position.value.x,
    top: position.value.y,
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}
function pointerMove(e: PointerEvent) {
  if (!drag || drag.id !== e.pointerId) return
  position.value = { x: drag.left + e.clientX - drag.x, y: drag.top + e.clientY - drag.y }
  clamp()
}
function pointerEnd() {
  drag = null
  save()
}
function moveByKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 40 : 10
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  if (e.key === 'Home') {
    e.preventDefault()
    position.value = { x: 12, y: 104 }
  } else if (delta[e.key]) {
    e.preventDefault()
    position.value = {
      x: position.value.x + delta[e.key]![0],
      y: position.value.y + delta[e.key]![1],
    }
  } else return
  clamp()
  save()
}
function outside(e: PointerEvent) {
  if (open.value && !drag && e.target instanceof Node && !root.value?.contains(e.target))
    open.value = false
}
function escape(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    close()
  }
}
watch(open, () => {
  clamp()
  save()
})
onMounted(() => {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (s && typeof s.open === 'boolean' && Number.isFinite(s.x) && Number.isFinite(s.y)) {
      position.value = { x: s.x, y: s.y }
      open.value = s.open
    }
  } catch {}
  ready.value = true
  clamp()
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
  window.addEventListener('resize', clamp)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
  window.removeEventListener('resize', clamp)
})
</script>
<template>
  <Teleport to="body"
    ><nav
      ref="root"
      class="floating-room-nav"
      :class="{ 'is-open': open }"
      :style="{ left: position.x + 'px', top: position.y + 'px' }"
      :aria-label="controlText('remainingField.floatingRoomNavigation')"
    >
      <button
        v-if="!open"
        ref="trigger"
        class="floating-nav-trigger"
        :aria-label="controlText('expressionFour.expandRoomNavigationCurrent') + current + '）'"
        :aria-expanded="open"
        @click="open = true"
      >
        <span aria-hidden="true">☰</span><span>{{ controlText('resourceFlow.navigation') }}</span>
      </button>
      <template v-else
        ><header>
          <strong>{{ controlText('ai.roomNav') }}</strong
          ><button
            :aria-label="controlText('remainingField.dragNavigationArrowKeysMoveHomeResets')"
            :title="controlText('remainingField.dragNavigationArrowKeysMoveHomeResetsAlias191')"
            class="nav-drag"
            @pointerdown="pointerDown"
            @pointermove="pointerMove"
            @pointerup="pointerEnd"
            @pointercancel="pointerEnd"
            @keydown="moveByKey"
          >
            ⠿</button
          ><button :aria-label="controlText('remainingField.collapseRoomNavigation')" @click="close">‹</button>
        </header>
        <div class="floating-nav-items">
          <button
            v-for="item in items"
            :key="item.id"
            :class="{ active: active === item.id }"
            :aria-current="active === item.id ? 'page' : undefined"
            @click="select(item.id)"
          >
            {{ item.label }}
          </button>
        </div></template
      >
    </nav></Teleport
  >
</template>
<style scoped>
.floating-room-nav {
  position: fixed;
  z-index: 180;
  max-height: calc(100dvh - 16px);
  width: 64px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  color: var(--ink);
  box-shadow: var(--shadow, 0 5px 20px #0002);
  padding: 5px;
}
.floating-room-nav.is-open {
  width: 204px;
  padding: 8px;
}
.floating-room-nav header {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-bottom: 6px;
}
.floating-room-nav strong {
  font-size: 14px;
  flex: 1;
}
.floating-room-nav button {
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  font-size: 14px;
}
.floating-room-nav header button {
  min-width: 32px;
  padding: 4px;
}
.floating-nav-trigger {
  display: flex;
  flex-direction: column;
  width: 100%;
  align-items: center;
  gap: 2px;
}
.floating-nav-trigger span:last-child {
  font-size: 12px;
}
.floating-nav-items {
  display: grid;
  gap: 5px;
}
.floating-nav-items button {
  text-align: left;
  width: 100%;
  min-height: 40px;
}
.floating-nav-items .active {
  background: #2d5748;
  color: #fff;
  border-color: transparent;
}
.nav-drag {
  touch-action: none;
  cursor: grab;
}
.floating-room-nav button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (pointer: coarse) {
  .floating-room-nav button {
    min-height: 44px;
  }
}
@media (prefers-reduced-motion: no-preference) {
  .floating-room-nav button {
    transition: background 0.12s;
  }
}
</style>
