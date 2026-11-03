<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global

import { onBeforeUnmount, shallowRef, useId, useTemplateRef } from 'vue'
import CharacterAvatar from './CharacterAvatar.vue'
import { preparePortrait } from './portrait-images'

const props = defineProps<{ portrait?: string | null; name: string; disabled?: boolean }>()
const emit = defineEmits<{ change: [image: string | null] }>()
const input = useTemplateRef<HTMLInputElement>('input')
const busy = shallowRef(false)
const error = shallowRef('')
const helpId = useId()
const errorId = useId()
let mounted = true
onBeforeUnmount(() => {
  mounted = false
})
async function upload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || busy.value || props.disabled) return
  busy.value = true
  error.value = ''
  const originalName = props.name
  const originalPortrait = props.portrait
  try {
    const image = await preparePortrait(file)
    if (
      mounted &&
      !props.disabled &&
      props.name === originalName &&
      props.portrait === originalPortrait
    )
      emit('change', image)
  } catch (cause) {
    error.value =
      cause instanceof DOMException
        ? '无法读取这张图片，请尝试其他 JPG、PNG 或 WebP 文件'
        : cause instanceof Error
          ? cause.message
          : '无法读取头像图片'
  } finally {
    target.value = ''
    busy.value = false
  }
}
function clear() {
  error.value = ''
  emit('change', null)
}
</script>

<template>
  <div class="portrait-picker">
    <slot name="preview"
      ><CharacterAvatar class="portrait-art" :name="name" :portrait="portrait" :size="84"
    /></slot>
    <div class="portrait-actions">
      <input
        ref="input"
        class="portrait-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :aria-label="controlText('controls.upload') + (name || controlText('controls.character')) + controlText('expressionTwo.portraitFile')"
        :aria-describedby="error ? helpId + ' ' + errorId : helpId"
        :disabled="disabled || busy"
        @change="upload"
      />
      <button
        type="button"
        class="portrait-upload subtle"
        :aria-describedby="error ? helpId + ' ' + errorId : helpId"
        :disabled="disabled || busy"
        @click="input?.click()"
      >
        {{ busy ? controlText('expressionTwo.processingPortrait') : portrait ? controlText('expressionTwo.changePortrait') : controlText('expressionTwo.uploadPortrait') }}
      </button>
      <button
        v-if="portrait"
        type="button"
        class="portrait-reset subtle"
        :disabled="disabled || busy"
        @click="clear"
      >{{ controlText('workspace.restoreDefaultPortrait') }}</button>
    </div>
    <p :id="helpId" class="portrait-help muted small">{{ controlText('workspace.jpgPngOrWebpMaximum5Mb') }}</p>
    <p v-if="error" :id="errorId" class="portrait-error error small" role="alert">{{ displayFeedback(error,'error') }}</p>
  </div>
</template>

<style scoped>
.portrait-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.portrait-file {
  display: none;
}
.portrait-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.portrait-upload,
.portrait-reset {
  min-height: 44px;
  padding: 8px 12px;
  font-size: 12px;
}
.portrait-help,
.portrait-error {
  margin: 0;
  max-width: 100%;
  text-align: center;
  overflow-wrap: anywhere;
}
</style>
