<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { AUTHORING_MODULES, type AuthoringModuleId } from '../../core/authoring-modules'
import type { AuthoringRequirements } from '../../core/authoring-requirements'
const model = defineModel<AuthoringRequirements>({ required: true })
defineProps<{ disabled: boolean }>()
function update(id: AuthoringModuleId, event: Event) {
  const value = (event.target as HTMLSelectElement)
    .value as AuthoringRequirements['modules'][AuthoringModuleId]
  model.value = { ...model.value, modules: { ...model.value.modules, [id]: value } }
}
</script>
<template>
  <details class="module-preferences">
    <summary>{{ controlText('authoringFlow.newSystemDesignModulesOptional') }}</summary>
    <p class="muted">{{ controlText('authoringFlow.chooseCreationPreferencesDoesNotChangeExistingJson') }}</p>
    <fieldset :disabled="disabled" class="module-grid">
      <label v-for="m in AUTHORING_MODULES" :key="m.id">
        {{ m.label }}
        <select :value="model.modules[m.id]" @change="update(m.id, $event)">
          <option value="suggest">{{ controlText('authoringFlow.letModelSuggest') }}</option>
          <option value="required">{{ controlText('authoringFlow.designRequired') }}</option>
          <option value="skip">{{ controlText('authoringFlow.noAdditionalDesign') }}</option>
        </select>
      </label>
    </fieldset>
    <p class="muted">
      {{ controlText('authoringFlow.fullClassCardsSupportLevels15Existing') }}
    </p>
  </details>
</template>
<style scoped>
.module-preferences {
  margin: 12px 0;
}
.module-grid {
  border: 0;
  padding: 12px 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(210px, 100%), 1fr));
  gap: 12px;
  min-width: 0;
}
.module-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.module-grid select {
  min-height: 44px;
  width: 100%;
}
</style>
