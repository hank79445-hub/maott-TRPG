<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { onMounted } from 'vue'
import {
  useMapFeedback,
  feedbackPreferences as prefs,
  loadFeedbackPreferences,
  saveFeedbackPreferences,
} from './useMapFeedback'
const source = useMapFeedback()
onMounted(loadFeedbackPreferences)
</script>
<template>
  <details v-if="source" class="feedback-settings" data-map-controls>
    <summary>{{ controlText('configuration.mapFeedback') }}</summary>
    <label
      >{{ controlText('configurationField.presentation') }}<select v-model="prefs.mode" @change="saveFeedbackPreferences">
        <option value="light">{{ controlText('configuration.lightweightEffects') }}</option>
        <option value="reduced">{{ controlText('configuration.staticIndicators') }}</option>
        <option value="off">{{ controlText('controls.close') }}</option>
      </select></label
    ><label
      >{{ controlText('domain.ranges') }}<select v-model="prefs.audience" @change="saveFeedbackPreferences">
        <option value="all">{{ controlText('configuration.authorizedVisibleResults') }}</option>
        <option value="self">{{ controlText('configuration.onlyResultsInvolvingMe') }}</option>
      </select></label
    ><small>{{ controlText('configuration.showsResolvedResultsOnlyRespectsTheSystemS') }}</small>
  </details>
</template>
<style scoped>
.feedback-settings {
  font-size: 12px;
  display: inline-block;
  max-width: 100%;
  padding: 4px 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.feedback-settings summary {
  cursor: pointer;
  background: var(--surface-raised, var(--surface));
  min-height: 32px;
  align-content: center;
}
label {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 4px 10px 4px 0;
}
select {
  min-width: 0;
  max-width: 210px;
  padding: 4px 6px;
  min-height: 36px;
  font-size: 12px;
}
small {
  display: block;
  color: var(--muted);
}
@media (pointer: coarse) {
  summary,
  select {
    min-height: 44px;
  }
}
</style>
