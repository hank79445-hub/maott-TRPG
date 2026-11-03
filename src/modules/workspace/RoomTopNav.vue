<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {uiLabel} from '../ui-label'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{ items: { id: string; label: string }[]; active: string }>()
defineEmits<{ select: [id: string] }>()
const root = ref<HTMLElement | null>(null)
const stuck = ref(false)
let raf = 0

function sync() {
  const el = root.value
  if (!el) return
  stuck.value = window.scrollY > 8 && el.getBoundingClientRect().top <= 0.5
}
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    sync()
  })
}
function reveal() {
  root.value
    ?.querySelector<HTMLElement>('button[aria-current="page"]')
    ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
}
onMounted(() => {
  sync()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', sync)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', sync)
})
watch(
  () => props.active,
  () => nextTick(reveal),
)
</script>
<template>
  <nav ref="root" class="room-top-nav" :data-stuck="stuck" :aria-label="controlText('ai.roomNav')">
    <button
      v-for="item in items"
      :key="item.id"
      :aria-current="active === item.id ? 'page' : undefined"
      :class="{ active: active === item.id }"
      @click="$emit('select', item.id)"
    >
      {{ uiLabel(item.label) }}
    </button>
  </nav>
</template>
<style scoped>
.room-top-nav {
  position: sticky;
  top: 0;
  z-index: 25;
  display: flex;
  gap: 7px;
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
  padding: 4px 0;
  flex: none;
  scrollbar-width: none;
  background: transparent;
  transition:
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    padding 0.18s ease;
}
.room-top-nav::-webkit-scrollbar {
  display: none;
}
.room-top-nav[data-stuck='true'] {
  padding-block: 6px;
  background: color-mix(in srgb, #eef2f1 94%, transparent);
  box-shadow:
    0 1px 0 #d3dddc,
    0 6px 16px rgb(38 54 64 / 6%);
  backdrop-filter: blur(10px);
}
.room-top-nav button {
  flex: none;
  white-space: nowrap;
  min-height: 40px;
  padding: 7px 14px;
  font-size: 15px;
  line-height: 1.2;
  border-radius: 9px;
  background: #fff;
  border: 1px solid #d3dddc;
  color: #1c2628;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}
.room-top-nav button:hover:not(:disabled) {
  border-color: #2c6b66;
  color: #2c6b66;
}
.room-top-nav button.active {
  background: #dcecea;
  border-color: #2c6b66;
  color: #2c6b66;
  font-weight: 600;
}
.room-top-nav button:focus-visible {
  outline: 2px solid #2c6b66;
  outline-offset: -2px;
}
@media (max-width: 1279px) {
  .room-top-nav {
    mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 26px), transparent 100%);
  }
}
@media (pointer: coarse) {
  .room-top-nav button {
    min-height: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .room-top-nav,
  .room-top-nav button {
    transition: none;
  }
}
</style>
