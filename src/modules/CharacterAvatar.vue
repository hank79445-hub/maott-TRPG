<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global

import { computed, shallowRef, watch } from 'vue'
import { safePortrait } from '../core/portraits'

const props = withDefaults(
  defineProps<{ name: string; portrait?: string | null; size?: number }>(),
  { size: 40 },
)
const failed = shallowRef(false)
const image = computed(() => (failed.value ? null : safePortrait(props.portrait)))
const name = computed(() => props.name.trim() || '未命名角色')
const dimensions = computed(() => {
  const size = Number.isFinite(props.size) ? Math.max(16, Math.min(384, props.size)) : 40
  return { width: `${size}px`, height: `${size}px` }
})
watch(
  () => props.portrait,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <span
    class="character-avatar"
    :style="dimensions"
    role="img"
    :aria-label="name + (image ? controlText('expressionOne.sPortrait') : controlText('expressionOne.sDefaultPortrait'))"
    :title="name"
  >
    <img v-if="image" class="avatar-image" :src="image" alt="" @error="failed = true" />
    <svg v-else class="avatar-fallback" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="29" r="13" fill="currentColor" opacity=".45" />
      <path d="M14 73c0-17 10-27 26-27s26 10 26 27" fill="currentColor" opacity=".3" />
      <circle cx="40" cy="40" r="37" stroke="currentColor" opacity=".25" />
    </svg>
  </span>
</template>

<style scoped>
.character-avatar {
  display: inline-flex;
  flex: 0 0 auto;
  overflow: hidden;
  vertical-align: middle;
  border-radius: 50%;
  background: var(--surface, #f1ece3);
  color: var(--accent, #806745);
}
.avatar-image,
.avatar-fallback {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
