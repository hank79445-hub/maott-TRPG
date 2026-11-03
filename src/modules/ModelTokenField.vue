<script setup lang="ts">
import {uiLabel} from './ui-label'
const props = withDefaults(
  defineProps<{
    modelValue: number | null | undefined
    label: string
    defaultValue?: number
    unlimitedLabel?: string
  }>(),
  { defaultValue: 1000, unlimitedLabel: '不额外设限' },
)
const emit = defineEmits<{ 'update:modelValue': [number | null] }>()
</script>
<template>
  <div class="token-field">
    <label class="check"
      ><input
        type="checkbox"
        :checked="modelValue === null"
        @change="
          emit(
            'update:modelValue',
            ($event.target as HTMLInputElement).checked ? null : props.defaultValue,
          )
        "
      />{{ uiLabel(label) }}：{{ uiLabel(unlimitedLabel) }}</label
    >
    <label v-if="modelValue !== null"
      >{{ uiLabel(label)
      }}<input
        type="number"
        min="1"
        step="1"
        :value="modelValue ?? defaultValue"
        @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    /></label>
  </div>
</template>
<style scoped>
.token-field {
  min-width: 0;
}
.token-field .check {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
}
.token-field input[type='number'] {
  width: 100%;
}
</style>
