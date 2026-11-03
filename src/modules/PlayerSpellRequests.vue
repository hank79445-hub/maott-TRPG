<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, reactive } from 'vue'
import type { RoomCommand, RoomView } from '../online/protocol'
import { spellWorkflowPolicy } from '../core/spell-workflow-policies'
const props = defineProps<{ view:RoomView; busy:boolean }>()
const emit = defineEmits<{ command:[command:RoomCommand] }>()
const questions = reactive<Record<string,string>>({})
const requests = computed(() => (props.view.gmSpells??[]).filter(r=>
  !(props.view.gmSpells??[]).some(q=>q.castId===r.castId&&q.questionIndex>r.questionIndex)).slice(-10).reverse())
function ask(id:string) {
  const question=questions[id]?.trim()
  if(question)emit('command',{kind:'spell-gm-question',requestId:id,question})
}
</script>
<template>
  <section v-if="requests.length" :aria-label="controlText('configurationField.mySpellRulings')" class="room-card">
    <h3>{{ controlText('workspace.spellAdjudication') }}</h3>
    <article v-for="r in requests" :key="r.id">
      <strong>{{ controlText('quantity.round', {p0:(localizedEntryName(r)),p1:(r.questionIndex),p2:(controlText('domain.ask'))}) }}</strong>
      <p>{{ r.status==='pending'?controlText('ai.gmRuling'):r.status==='canceled'?controlText('expressionTwo.rulingEnded'):r.result?.text??controlText('expressionTwo.resultPublishedAccordingToRecipientPermissions') }}</p>
      <template v-if="r.status==='published' && r.questionIndex < (spellWorkflowPolicy(r.spellId)?.maxQuestions??1)">
        <label>{{ controlText('configurationField.nextQuestionNoAdditionalSpellResourceCost') }}<input v-model="questions[r.id]" maxlength="2000" /></label>
        <button :disabled="busy || !questions[r.id]?.trim()" @click="ask(r.id)">{{ controlText('workspace.submitNextQuestion') }}</button>
      </template>
    </article>
  </section>
</template>
