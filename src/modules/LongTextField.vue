<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global

import { shallowRef } from 'vue'
const model = defineModel<string>({ default: '' })
withDefaults(defineProps<{ label: string; limit?: number; hint?: string }>(), {
  limit: 12000,
  hint: '',
})
const expanded = shallowRef(false)
function grow(e: Event) {
  const el = e.target as HTMLTextAreaElement
  if (el.closest('[data-npc-auto-height]')) return
  el.style.height = 'auto'
  el.style.height =
    Math.max(280, Math.min(el.scrollHeight, expanded.value ? window.innerHeight * 0.7 : 560)) + 'px'
}
</script>
<template>
  <div class="long-text-field">
    <div class="long-text-heading">
      <strong>{{ label }}</strong
      ><button type="button" :aria-pressed="expanded" @click="expanded = !expanded">
        {{ expanded ? controlText('dialogueReview.collapseEditor') : controlText('dialogueReview.expandEditor') }}
      </button>
    </div>
    <label
      ><span class="muted">{{ hint }}</span
      ><textarea
        v-model="model"
        rows="12"
        :aria-label="label"
        :class="{ expanded }"
        @input="grow"
      /></label
    ><small :class="{ error: model.length > limit }"
      >{{ controlText('dialogueReview.characters',{count:model.length.toLocaleString(controlI18n.global.locale.value),limit:limit.toLocaleString(controlI18n.global.locale.value)}) }}{{
        model.length > limit ? controlText('dialogueReview.overLimit') : ''
      }}</small
    >
  </div>
</template>
<style scoped>
.long-text-field {
  grid-column: 1/-1;
  min-width: 0;
  width: 100%;
  margin: 12px 0;
}
.long-text-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.long-text-heading button {
  min-height: 44px;
}
.long-text-field textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 280px;
  resize: vertical;
  line-height: 1.8;
  font-size: 15px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
}
.long-text-field textarea.expanded {
  min-height: 65vh;
}
.long-text-field label {
  display: block;
}
</style>
