<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
const props = defineProps<{
  label: string
  options: { id: string; name: string; disabled?: boolean }[]
  modelValue: string[]
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [ids: string[]] }>()
const search = ref('')
const visible = computed(() =>
  props.options.filter((n) =>
    n.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()),
  ),
)
function toggle(id: string, checked: boolean) {
  emit(
    'update:modelValue',
    checked ? [...props.modelValue, id] : props.modelValue.filter((v) => v !== id),
  )
}
</script>
<template>
  <details class="npc-route-select" :class="{ disabled }">
    <summary
      :aria-label="label"
      :aria-disabled="disabled"
      @click="disabled && $event.preventDefault()"
    >
      {{ controlText('liveSummary.selected', {p0:(label),p1:(modelValue.length)}) }}
    </summary>
    <div class="route-options" v-if="!disabled">
      <label class="route-search"
        >{{ controlText('configurationField.searchNpcs') }}<input
          v-model="search"
          type="search"
          :aria-label="label + controlText('controls.search')"
          :placeholder="controlText('domain.enterName')"
      /></label>
      <div class="route-option-list">
        <label v-for="n in visible" :key="n.id" :class="{ unavailable: n.disabled }">
          <input
            type="checkbox"
            :checked="modelValue.includes(n.id)"
            :disabled="n.disabled"
            @change="toggle(n.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ localizedEntryName(n) }}<small v-if="n.disabled">{{ controlText('workspace.assignedToAnotherBot') }}</small>
        </label>
        <p v-if="!visible.length">{{ controlText('workspace.noMatchingNpcs') }}</p>
      </div>
      <button type="button" :disabled="!modelValue.length" @click="emit('update:modelValue', [])">{{ controlText('workspace.clearThisCategory') }}</button>
    </div>
  </details>
</template>
<style scoped>
.npc-route-select {
  position: relative;
  min-width: 0;
}
.npc-route-select > summary {
  min-height: 44px;
  padding: 10px;
  border: 1px solid var(--line, #ccd5d4);
  border-radius: 8px;
  cursor: pointer;
  overflow-wrap: anywhere;
  background: var(--surface, #fff);
}
.disabled {
  opacity: 0.55;
}
.disabled > summary {
  cursor: not-allowed;
}
.route-options {
  margin-top: 6px;
  padding: 10px;
  border: 1px solid var(--line, #ccd5d4);
  border-radius: 8px;
  background: var(--surface, #fff);
}
.route-search {
  display: block;
}
.route-search input {
  width: 100%;
  min-height: 44px;
}
.route-option-list {
  max-height: 240px;
  overflow: auto;
  margin: 8px 0;
}
.route-option-list > label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  overflow-wrap: anywhere;
}
.route-option-list input {
  flex: 0 0 auto;
}
.unavailable {
  opacity: 0.65;
}
.route-option-list small {
  font-size: 0.8em;
}
.route-options button {
  min-height: 44px;
}
</style>
