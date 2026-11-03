<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { ref } from 'vue'
import type { NpcProfile, NpcResponseType } from '../core/ai-types'
import type { MapScene } from '../core/map-types'
import { responseNames, newActivityTemplate } from '../core/npc-activity'
const activity = defineModel<NpcProfile['activity']>({ required: true })
defineProps<{ scenes: MapScene[]; characters: { id: string; name: string }[]; busy: boolean }>()
const type = ref<NpcResponseType>('rescued')
function add() {
  activity.value.templates ??= []
  if (activity.value.templates.length < 30)
    activity.value.templates.push(newActivityTemplate(type.value))
}
</script>
<template>
  <details class="activity-editor" open>
    <summary>{{ controlText('configuration.eventResponseTemplatesAndConversationScope') }}</summary>
    <label
      >{{ controlText('configurationField.allowedConversationScope') }}<select v-model="activity.scope">
        <option value="party">{{ controlText('configuration.dynamicWholePartyPlayerCharacters') }}</option>
        <option value="selected">{{ controlText('configuration.specifiedCharacterList') }}</option>
      </select></label
    >
    <p v-if="activity.scope === 'party'" class="muted">
      {{ controlText('configuration.newPlayerCharactersAreIncludedAutomaticallyActualConversation') }}
    </p>
    <div v-else>
      <label v-for="c in characters" :key="c.id" class="check"
        ><input v-model="activity.characterIds" type="checkbox" :value="c.id" />{{ localizedEntryName(c) }}</label
      >
    </div>
    <label
      >{{ controlText('configurationField.proactiveResponsePublicationMode') }}<select v-model="activity.publishMode">
        <option :value="undefined">{{ controlText('configuration.retainLegacyConfiguration') }}</option>
        <option value="review">{{ controlText('configuration.reviewEveryReplyRecommended') }}</option>
        <option value="ordinary">{{ controlText('configuration.automaticallyPublishOrdinaryDialogue') }}</option>
      </select></label
    >
    <p class="muted">{{ controlText('configuration.sensitiveDialogueAndActualActionsStillRequireReview') }}</p>
    <div class="room-row">
      <label
        >{{ controlText('configurationField.addTemplate') }}<select v-model="type">
          <option v-for="(name, key) in responseNames" :key="key" :value="key">{{ uiLabel(name) }}</option>
        </select></label
      ><button
        type="button"
        :disabled="busy || (activity.templates?.length ?? 0) >= 30"
        @click="add"
      >
        {{ controlText('configuration.addResponseTemplate') }}
      </button>
    </div>
    <details v-for="(t, i) in activity.templates ?? []" :key="t.id" class="template-card">
      <summary>
        {{ controlText('quantity.priority', {p0:(uiLabel(responseNames[t.type])),p1:(t.enabled ? controlText('controls.enable') : controlText('controls.disable')),p2:(t.priority)}) }}
      </summary>
      <div class="template-form">
        <label class="check"><input v-model="t.enabled" type="checkbox" />{{ controlText('game.templateEnabled') }}</label>
        <label
          >{{ controlText('configurationField.restrictScene') }}<select v-model="t.sceneId">
            <option :value="null">{{ controlText('configuration.npcSCurrentScene') }}</option>
            <option v-for="s in scenes" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
          </select></label
        >
        <label
          >{{ controlText('configurationField.restrictInteractionPoint') }}<MapFieldPicker kind="point"><select v-model="t.pointId">
            <option :value="null">{{ controlText('configuration.unrestricted') }}</option>
            <optgroup v-for="s in scenes" :key="s.id" :label="localizedEntryName(s)">
              <option v-for="p in s.points" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
            </optgroup>
          </select></MapFieldPicker></label
        >
        <label v-if="['rescued', 'aided', 'danger', 'goal', 'interaction'].includes(t.type)"
          >{{ controlText('configurationField.outcomeCondition') }}<select v-model="t.outcome">
            <option value="any">{{ controlText('configuration.anyConfirmedResult') }}</option>
            <option value="success">{{ controlText('controls.success') }}</option>
            <option value="failure">{{ controlText('controls.failed') }}</option>
          </select></label
        >
        <label v-if="t.type === 'wounded'"
          >{{ controlText('configurationField.severeInjuryThresholdOfMaximumHp') }}<input
            v-model.number="t.thresholdPercent"
            type="number"
            min="1"
            max="100"
        /></label>
        <label>{{ controlText('configurationField.priority') }}<input v-model.number="t.priority" type="number" min="0" max="100" /></label>
        <label
          >{{ controlText('configurationField.separateCooldownSeconds') }}<input
            v-model.number="t.cooldownSeconds"
            type="number"
            min="0"
            max="86400"
        /></label>
        <label class="wide"
          >{{ controlText('configurationField.responseTendency') }}<textarea
            v-model="t.tendency"
            rows="2"
            maxlength="2000"
            :placeholder="controlText('configurationField.forExampleGrudginglyThankTheRescuerWhileConcealing')"
          />
        </label>
      </div>
      <button
        type="button"
        class="subtle"
        :disabled="busy"
        @click="activity.templates?.splice(i, 1)"
      >
        {{ controlText('configuration.deleteThisTemplate') }}
      </button>
    </details>
    <p class="muted">{{ controlText('workspace.theSevereInjuryThresholdSupportsInteractionsOnlyAnd') }}</p>
  </details>
</template>
<style scoped>
.activity-editor {
  grid-column: 1/-1;
  min-width: 0;
}
.activity-editor summary {
  cursor: pointer;
  margin: 10px 0;
}
.activity-editor label {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}
.activity-editor input,
.activity-editor select,
.activity-editor textarea {
  box-sizing: border-box;
  max-width: 100%;
  width: 100%;
}
.activity-editor .check {
  display: inline-flex;
  align-items: center;
  margin-right: 12px;
}
.activity-editor .check input {
  width: auto;
}
.template-card {
  border: 1px solid var(--border, #d8cab4);
  border-radius: 10px;
  padding: 10px;
  margin-top: 10px;
}
.template-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.wide {
  grid-column: 1/-1;
}
@media (max-width: 540px) {
  .template-form {
    grid-template-columns: minmax(0, 1fr);
  }
  .room-row {
    flex-wrap: wrap;
  }
}
</style>
