<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import type { NpcProfile } from '../core/ai-types'
const npc = defineModel<NpcProfile>({ required: true })
defineProps<{ characters: { id: string; name: string }[]; busy: boolean }>()
function add() {
  npc.value.initialMemories ??= []
  if (npc.value.initialMemories.length < 30)
    npc.value.initialMemories.push({
      id: crypto.randomUUID(),
      text: '',
      visibility: 'public',
      characterId: null,
    })
}
function relation(id: string) {
  npc.value.initialRelations ??= []
  if (id && !npc.value.initialRelations.some((r) => r.characterId === id))
    npc.value.initialRelations.push({ characterId: id, score: 0, note: '' })
}
</script>
<template>
  <details class="memory-editor ai-wide">
    <summary>{{ controlText('configuration.initialMemoriesAndOptionalAffinity') }}</summary>
    <p class="muted">
      {{ controlText('adjudication.editTheAuthorSInitialConfigurationForCopying') }}
    </p>
    <fieldset v-for="(m, i) in npc.initialMemories ?? []" :key="m.id">
      <legend>{{ controlText('liveSummary.fixedInitialMemory', {p0:(i + 1)}) }}</legend>
      <label>{{ controlText('configurationField.memoryContent') }}<textarea v-model="m.text" rows="2" maxlength="2000" /></label>
      <div class="memory-grid">
        <label
          >{{ controlText('configurationField.knowledgeScope') }}<select v-model="m.visibility">
            <option value="public">{{ controlText('configuration.availableForPublicConversation') }}</option>
            <option value="personal">{{ controlText('configuration.privateConversationWithTheSpecifiedPlayerOnly') }}</option>
            <option value="private">{{ controlText('configuration.npcPrivateKnowledgeReviewRequired') }}</option>
          </select></label
        ><label
          >{{ controlText('configurationField.linkedPlayerCharacter') }}<select v-model="m.characterId">
            <option :value="null">{{ controlText('configuration.unlinkedPrivateConversationScopeMustBeSpecified') }}</option>
            <option v-for="c in characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
          </select></label
        >
      </div>
      <button
        type="button"
        class="subtle"
        :disabled="busy"
        @click="npc.initialMemories?.splice(i, 1)"
      >
        {{ controlText('configuration.deleteInitialMemory') }}
      </button>
    </fieldset>
    <button type="button" :disabled="busy || (npc.initialMemories?.length ?? 0) >= 30" @click="add">
      {{ controlText('configuration.addFixedInitialMemory') }}
    </button>
    <p class="muted">{{ controlText('workspace.privateKnowledgeDoesNotAutomaticallyEnterPublicQq') }}</p>
    <label class="check"
      ><input v-model="npc.affinityEnabled" type="checkbox" />{{ controlText('configurationField.enablePersonalAffinityOffByDefault') }}</label
    >
    <template v-if="npc.affinityEnabled">
      <p class="muted">
        {{ controlText('configuration.message100To100SupportsRoleplayOnlyDoesNot') }}
      </p>
      <label
        >{{ controlText('configurationField.addInitialRelationship') }}<select
          value=""
          @change="relation(($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ controlText('configuration.choosePlayerCharacter') }}</option>
          <option v-for="c in characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
        </select></label
      >
      <fieldset v-for="(r, i) in npc.initialRelations ?? []" :key="r.characterId">
        <legend>{{ localizedEntryName(characters.find((c) => c.id === r.characterId)) ?? r.characterId }}</legend>
        <label
          >{{ controlText('configurationField.initialAffinity') }}<input v-model.number="r.score" type="number" min="-100" max="100" /></label
        ><label>{{ controlText('configurationField.initialRelationshipNotes') }}<textarea v-model="r.note" rows="2" maxlength="2000" /></label
        ><button
          type="button"
          class="subtle"
          :disabled="busy"
          @click="npc.initialRelations?.splice(i, 1)"
        >
          {{ controlText('configuration.deleteInitialRelationship') }}
        </button>
      </fieldset>
    </template>
  </details>
</template>
<style scoped>
.memory-editor {
  min-width: 0;
}
.memory-editor label {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}
.memory-editor input,
.memory-editor select,
.memory-editor textarea {
  width: 100%;
  box-sizing: border-box;
}
.memory-editor fieldset {
  min-width: 0;
  margin: 12px 0;
}
.memory-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.memory-editor .check {
  display: flex;
  align-items: center;
}
.memory-editor .check input {
  width: auto;
}
summary {
  cursor: pointer;
}
@media (max-width: 540px) {
  .memory-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
