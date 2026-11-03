<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
import {
  defaultTextStyle,
  sanitizeStyleText,
  styleRules,
  type TextStyleSettings,
} from '../core/model-text-style'
const props = defineProps<{ modelValue?: TextStyleSettings; busy: boolean }>(),
  emit = defineEmits<{ 'update:modelValue': [TextStyleSettings]; save: [] }>()
const value = computed(() => props.modelValue ?? defaultTextStyle(false)),
  preview = computed(() => {
    try {
      return styleRules(value.value)
    } catch (e) {
      return e instanceof Error ? e.message : '规则无效'
    }
  }),
  notice = ref(''),
  error = ref('')
function set<K extends keyof TextStyleSettings>(key: K, v: TextStyleSettings[K]) {
  emit('update:modelValue', { ...value.value, [key]: v })
}
async function upload(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  error.value = ''
  try {
    if (file.size > 65536) throw Error('文件超过64KiB，请先精简')
    const result = sanitizeStyleText(await file.text())
    set('customRules', result.text)
    notice.value = `已作为静态写作资料导入；移除${result.removedLines}行工具／越权内容，保存后仅作用于新任务。`
  } catch (e) {
    error.value = e instanceof Error ? e.message : '导入失败'
  } finally {
    input.value = ''
  }
}
function reset(){
  emit('update:modelValue',{...defaultTextStyle(),revision:value.value.revision})
  notice.value='已恢复内置默认值，保存后生效'
}
</script>
<template>
  <details class="room-card text-style-settings">
    <summary>{{ controlText('resourceFlow.sharedModelWritingRules') }}</summary>
    <p v-if="!modelValue" class="muted">{{ controlText('resourceFlow.thisLegacyRoomHasNotEnabledTheNew') }}</p>
    <p class="muted">
      {{ controlText('resourceFlow.selfCheckWithinOneGenerationDoesNotRewrite') }}
    </p>
    <div class="style-checks">
      <label
        ><input
          type="checkbox"
          :checked="value.enabled"
          @change="set('enabled', ($event.target as HTMLInputElement).checked)"
        />{{ controlText('remainingField.enableSharedRules') }}</label
      ><label
        ><input
          type="checkbox"
          :checked="value.npc"
          @change="set('npc', ($event.target as HTMLInputElement).checked)"
        />{{ controlText('remainingField.npcDialogue') }}</label
      ><label
        ><input
          type="checkbox"
          :checked="value.narration"
          @change="set('narration', ($event.target as HTMLInputElement).checked)"
        />{{ controlText('controls.narration') }}</label
      ><label
        ><input
          type="checkbox"
          :checked="value.selfCheck"
          @change="set('selfCheck', ($event.target as HTMLInputElement).checked)"
        />{{ controlText('remainingField.conciseSelfCheckWithinGeneration') }}</label
      >
    </div>
    <label
      >{{ controlText('remainingField.actionDescriptions') }}<select
        :value="value.actionDensity"
        @change="
          set(
            'actionDensity',
            ($event.target as HTMLSelectElement).value as TextStyleSettings['actionDensity'],
          )
        "
      >
        <option value="sparse">{{ controlText('resourceFlow.sparinglyWhenNeeded') }}</option>
        <option value="none">{{ controlText('resourceFlow.noActionDescriptions') }}</option>
      </select></label
    ><label
      >{{ controlText('remainingField.additionalGmWritingRules') }}<textarea
        :value="value.customRules"
        rows="4"
        maxlength="4000"
        @input="set('customRules', ($event.target as HTMLTextAreaElement).value)"
      /></label
    ><label
      >{{ controlText('remainingField.importMarkdownText') }}<input
        type="file"
        accept=".md,.txt,text/markdown,text/plain"
        :disabled="busy"
        @change="upload"
    /></label>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" role="alert">{{ displayFeedback(error,'error') }}</p>
    <details>
      <summary>{{ controlText('scriptSummary.effectiveRulesPreviewVRevision', {p0:(value.revision)}) }}</summary>
      <pre>{{ preview }}</pre>
    </details>
    <div class="style-buttons">
      <button
        :disabled="busy"
        type="button"
        @click="reset"
      >
        {{ controlText('resourceFlow.restoreBuiltInRules') }}</button
      ><button :disabled="busy" type="button" @click="emit('save')">{{ controlText('resourceFlow.saveSharedWritingRules') }}</button>
    </div>
  </details>
</template>
<style scoped>
.text-style-settings {
  min-width: 0;
}
.text-style-settings > label {
  display: grid;
  gap: 0.35rem;
  margin: 0.7rem 0;
}
.style-checks,
.style-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}
.style-checks label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.text-style-settings textarea,
.text-style-settings select,
.text-style-settings input[type='file'] {
  max-width: 100%;
  min-width: 0;
}
.text-style-settings pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  font-size: 0.85rem;
}
.style-buttons {
  margin-top: 0.8rem;
}
@media (max-width: 600px) {
  .style-buttons button {
    min-height: 44px;
    flex: 1;
  }
  .style-checks {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
