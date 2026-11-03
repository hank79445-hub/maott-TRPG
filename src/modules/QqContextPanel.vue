<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { ref } from 'vue'
import type { QqMemberView } from '../online/qq-types'
defineProps<{ state: QqMemberView; characters: { id: string; name: string }[]; busy: boolean }>()
const emit = defineEmits<{ command: [body: unknown] }>()
const npcId = ref(''),
  characterId = ref(''),
  purpose = ref('公开对话背景'),
  text = ref('')
</script>
<template>
  <details>
    <summary>{{ controlText('workspace.includeInNpcPublicContext') }}</summary>
    <div v-for="s in state.sessions" :key="s.id" class="qq-context-record">
      <p>{{ controlText('liveSummary.publicConversation', {p0:(s.id),p1:(s.npcName)}) }}</p>
      <button :disabled="busy" @click="emit('command', { type: 'close-session', sessionId: s.id })">{{ controlText('workspace.closeConversationUnpublishedRepliesBecomeInvalid') }}</button>
    </div>
    <p class="muted">{{ controlText('workspace.enterOnlyGameInformationExplicitlyAuthorizedForThis') }}</p>
    <form
      class="qq-context"
      @submit.prevent="emit('command', { type: 'context', npcId, characterId, purpose, text })"
    >
      <label
        >{{ controlText('configurationField.applicableNpcs') }}<select v-model="npcId" required>
          <option value="" disabled>{{ controlText('game.npc') }}</option>
          <option v-for="n in state.npcs" :key="n.id" :value="n.id">{{ localizedEntryName(n) }}</option>
        </select></label
      >
      <label
        >{{ controlText('game.speaker') }}<select v-model="characterId" required>
          <option value="" disabled>{{ controlText('game.character') }}</option>
          <option v-for="c in characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
        </select></label
      >
      <label>{{ controlText('configurationField.purpose') }}<input v-model="purpose" required maxlength="2000" /></label>
      <label>{{ controlText('configurationField.publicContent') }}<textarea v-model="text" required maxlength="2000" rows="3" /></label>
      <button :disabled="busy || !state.sceneId">{{ controlText('workspace.saveContextForCurrentSceneAndBranch') }}</button>
    </form>
    <article v-for="c in state.contexts" :key="c.id" class="qq-context-record">
      <p>{{ c.purpose }} · {{ localizedEntryName(state.npcs.find((n) => n.id === c.npcId)) ?? controlText('expressionTwo.legacyNpc') }}</p>
      <p>{{ c.text }}</p>
      <button
        :disabled="busy"
        @click="emit('command', { type: 'context-remove', contextId: c.id })"
      >{{ controlText('workspace.removeThisContext') }}</button>
    </article>
  </details>
</template>
<style scoped>
.qq-context {
  display: grid;
  gap: 0.8rem;
  max-width: 42rem;
}
.qq-context label {
  display: grid;
  gap: 0.3rem;
}
.qq-context button,
.qq-context-record button,
.qq-context select {
  min-height: 44px;
}
.qq-context textarea {
  width: 100%;
  box-sizing: border-box;
}
.qq-context-record {
  overflow-wrap: anywhere;
  border-block-end: 1px solid var(--border, #76664b);
  padding-block: 0.7rem;
}
summary {
  cursor: pointer;
  padding-block: 0.7rem;
}
</style>
