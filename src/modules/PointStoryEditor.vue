<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import type { MapPoint } from '../core/map-types'
const stories = defineModel<NonNullable<MapPoint['storyResults']>>({ required: true })
defineProps<{ npcs: { id: string; name: string }[]; busy: boolean }>()
function add() {
  if (stories.value.length < 10)
    stories.value = [
      ...stories.value,
      {
        id: crypto.randomUUID(),
        type: 'rescued',
        npcId: '',
        outcome: 'success',
        text: '',
        requiresGM: true,
      },
    ]
}
</script>
<template>
  <details class="story-editor">
    <summary>{{ controlText('liveSummary.storyResultsAndNpcResponseLinks', {p0:(stories.length)}) }}</summary>
    <p class="muted">
      {{ controlText('adjudication.successTriggersOnlyAfterTheFirstOpeningSolution') }}
    </p>
    <fieldset v-for="(s, i) in stories" :key="s.id">
      <legend>{{ controlText('liveSummary.storyResult', {p0:(i + 1)}) }}</legend>
      <label
        >{{ controlText('game.event') }}<select v-model="s.type">
          <option value="rescued">{{ controlText('workspace.rescue') }}</option>
          <option value="aided">{{ controlText('workspace.aid') }}</option>
          <option value="danger">{{ controlText('state.danger') }}</option>
          <option value="goal">{{ controlText('workspace.completeGoal') }}</option>
        </select></label
      >
      <label
        >{{ controlText('configurationField.linkedNpc') }}<select v-model="s.npcId">
          <option value="">{{ controlText('workspace.chooseAnNpcInTheSameScene') }}</option>
          <option v-for="n in npcs" :key="n.id" :value="n.id">{{ localizedEntryName(n) }}</option>
        </select></label
      >
      <label
        >{{ controlText('configurationField.interactionResult') }}<select v-model="s.outcome">
          <option value="success">{{ controlText('controls.success') }}</option>
          <option value="failure">{{ controlText('controls.failed') }}</option>
        </select></label
      >
      <label
        >{{ controlText('configurationField.confirmedFacts') }}<textarea
          v-model="s.text"
          rows="2"
          maxlength="2000"
          :placeholder="controlText('configurationField.theHatchOpensFreeingShadowheart')"
        />
      </label>
      <label class="check"
        ><input v-model="s.requiresGM" type="checkbox" />{{ controlText('configurationField.waitForGmFactConfirmationRecommended') }}</label
      >
      <p class="muted">{{ controlText('workspace.theActingParticipantIsUsedAutomaticallyUnconfirmedResults') }}</p>
      <button
        type="button"
        class="subtle"
        :disabled="busy"
        @click="stories = stories.filter((_, index) => index !== i)"
      >{{ controlText('workspace.deleteLink') }}</button>
    </fieldset>
    <button type="button" :disabled="busy || stories.length >= 10" @click="add">{{ controlText('workspace.addStoryResultLink') }}</button>
  </details>
</template>
<style scoped>
.story-editor label {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}
.story-editor fieldset {
  min-width: 0;
  margin: 12px 0;
}
.story-editor textarea,
.story-editor select {
  width: 100%;
  box-sizing: border-box;
}
.story-editor .check {
  display: flex;
  align-items: center;
}
.story-editor .check input {
  width: auto;
}
.story-editor summary {
  cursor: pointer;
}
</style>
