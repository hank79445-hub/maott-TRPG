<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import ModelTokenField from './ModelTokenField.vue'
import { ref, watch } from 'vue'
import type { RoomCommand } from '../online/protocol'
import type { ModelProfileView, AiSettings } from '../core/ai-types'
const props = defineProps<{ profiles: ModelProfileView[]; settings: AiSettings; busy: boolean }>()
const emit = defineEmits<{ command: [RoomCommand] }>()
const name = ref(''),
  selected = ref('')
const draft = ref({
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  apiKey: '',
  clearKey: false,
  contextBudgetTokens: null as number | null,
  timeoutSeconds: 30,
  maxOutputTokens: null as number | null,
  tokenParameter: 'max_completion_tokens' as 'max_tokens' | 'max_completion_tokens',
  jsonMode: true,
})
function load() {
  const p = props.profiles.find((p) => p.name === selected.value)
  name.value = p?.name ?? ''
  draft.value = {
    baseUrl: p?.baseUrl ?? 'https://api.openai.com/v1',
    model: p?.model ?? '',
    apiKey: '',
    clearKey: false,
    contextBudgetTokens: p
      ? p.contextBudgetTokens === undefined
        ? 32768
        : p.contextBudgetTokens
      : null,
    timeoutSeconds: p?.timeoutSeconds ?? 30,
    maxOutputTokens: p ? p.maxOutputTokens : null,
    tokenParameter: p?.tokenParameter ?? 'max_completion_tokens',
    jsonMode: p?.jsonMode ?? true,
  }
}
watch(
  () => props.profiles.map((p) => p.name + ':' + p.revision).join('|'),
  () => {
    if (props.profiles.some((p) => p.name === name.value)) {
      selected.value = name.value
      draft.value.apiKey = ''
      draft.value.clearKey = false
    } else if (selected.value) {
      selected.value = ''
      load()
    }
  },
)
function route(key: 'narrationModelRef' | 'npcModelRef', value: string) {
  emit('command', {
    kind: 'map',
    command: { type: 'ai-settings', settings: { ...props.settings, [key]: value } },
  })
}
</script>
<template>
  <details class="room-card">
    <summary>{{ controlText('configuration.gmModelLibraryAndAssignment') }}</summary>
    <p class="muted">{{ controlText('configuration.assignDifferentModelsToDifferentTasksUnassignedTasks') }}</p>
    <div class="ai-form">
      <label
        >{{ controlText('configurationField.narrationModel') }}<select
          :value="settings.narrationModelRef || ''"
          :disabled="busy"
          @change="route('narrationModelRef', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ controlText('domain.legacyModel') }}</option>
          <option
            v-if="
              settings.narrationModelRef &&
              !profiles.some((p) => p.name === settings.narrationModelRef)
            "
            :value="settings.narrationModelRef"
          >
            {{ settings.narrationModelRef }}{{ controlText('game.unmapped') }}
          </option>
          <option v-for="p in profiles" :key="p.name" :value="p.name">
            {{ localizedEntryName(p) }} · {{ p.model }}
          </option>
        </select></label
      >
      <label
        >{{ controlText('configurationField.defaultImportantNpcModel') }}<select
          :value="settings.npcModelRef || ''"
          :disabled="busy"
          @change="route('npcModelRef', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ controlText('domain.legacyModel') }}</option>
          <option
            v-if="settings.npcModelRef && !profiles.some((p) => p.name === settings.npcModelRef)"
            :value="settings.npcModelRef"
          >
            {{ settings.npcModelRef }}{{ controlText('game.unmapped') }}
          </option>
          <option v-for="p in profiles" :key="p.name" :value="p.name">
            {{ localizedEntryName(p) }} · {{ p.model }}
          </option>
        </select></label
      >
      <label
        >{{ controlText('configurationField.editConfiguration') }}<select v-model="selected" @change="load">
          <option value="">{{ controlText('configuration.addConfiguration') }}</option>
          <option v-for="p in profiles" :key="p.name" :value="p.name">
            {{ localizedEntryName(p) }} · {{ p.hasKey ? controlText('expressionTwo.keySaved') : controlText('expressionTwo.noKey') }}
          </option>
        </select></label
      >
    </div>
    <form
      class="ai-form"
      @submit.prevent="
        emit('command', {
          kind: 'model-profile-save',
          name: name.trim(),
          configuration: { ...draft },
        })
      "
    >
      <label
        >{{ controlText('configurationField.purposeName') }}<input
          v-model="name"
          required
          maxlength="80"
          :readonly="!!selected"
          :placeholder="controlText('configurationField.forExampleNarrationShadowheart')"
      /></label>
      <label>{{ controlText('configurationField.apiBaseUrl') }}<input v-model="draft.baseUrl" type="url" required /></label>
      <label>{{ controlText('game.modelName') }}<input v-model="draft.model" required maxlength="120" /></label>
      <label
        >{{ controlText('configurationField.apiKey') }}<input
          v-model="draft.apiKey"
          type="password"
          autocomplete="new-password"
          maxlength="4096"
          :placeholder="controlText('configurationField.leaveBlankToRetainExistingKey')"
      /></label>
      <label class="check"><input v-model="draft.clearKey" type="checkbox" />{{ controlText('configurationField.clearExistingKey') }}</label>
      <ModelTokenField
        v-model="draft.contextBudgetTokens"
        :label="controlText('confirmation.totalContextBudgetConservativeTokens')"
        :default-value="32768"
      />
      <p class="ai-wide muted">
        {{ controlText('adjudication.theBudgetIncludesInputOutputAndWrapperOverhead') }}
      </p>
      <label
        >{{ controlText('configurationField.timeoutSeconds') }}<input v-model.number="draft.timeoutSeconds" type="number" min="5" max="120"
      /></label>
      <ModelTokenField
        v-model="draft.maxOutputTokens"
        :label="controlText('confirmation.outputTokenLimit')"
        :unlimited-label="controlText('confirmation.useProviderDefault')"
      />
      <label
        >{{ controlText('game.tokenParameter') }}<select v-model="draft.tokenParameter">
          <option>max_completion_tokens</option>
          <option>max_tokens</option>
        </select></label
      >
      <label class="check"><input v-model="draft.jsonMode" type="checkbox" />{{ controlText('game.jsonMode') }}</label>
      <p class="ai-wide muted">
        {{ controlText('adjudication.savingDoesNotCallAModelValidateSelected') }}
      </p>
      <div class="room-row ai-wide">
        <button :disabled="busy || !name.trim() || !draft.model">{{ controlText('configuration.saveNamedConfiguration') }}</button
        ><button
          type="button"
          class="subtle"
          :disabled="busy || !selected"
          @click="emit('command', { kind: 'model-profile-delete', name: selected })"
        >
          {{ controlText('configuration.deleteSelectedConfiguration') }}</button
        ><button
          type="button"
          :disabled="busy || !selected"
          @click="emit('command', { kind: 'model-profile-test', name: selected })"
        >
          {{ controlText('configuration.validateSelectedConfigurationCallsModel') }}
        </button>
      </div>
    </form>
  </details>
</template>

<style scoped>
.ai-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.ai-form label {
  display: grid;
  gap: 6px;
}
.ai-form input,
.ai-form select {
  box-sizing: border-box;
  max-width: 100%;
  width: 100%;
}
.ai-wide {
  grid-column: 1/-1;
}
.ai-form .check {
  display: flex;
  align-items: center;
}
.ai-form .check input {
  width: auto;
}
@media (max-width: 540px) {
  .ai-form {
    grid-template-columns: minmax(0, 1fr);
  }
  .room-row {
    flex-wrap: wrap;
  }
}
</style>
