<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {gEntity} from '../core/gm-spell-world'
import {G_RULES} from '../core/gm-spell-rules'
import M3MagicEvidence from './m3/M3MagicEvidence.vue'
import CounterspellReaction from './CounterspellReaction.vue'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { resolutionIdentity } from './battle-resolution-identity'
import { computed, shallowRef } from 'vue'
import type { GmSpellRequest } from '../core/spell-workflow-types'
import type { CombatCommand } from '../core/combat-types'
import type { RoomCommand, RoomView } from '../online/protocol'
import { spellWorkflowPolicy } from '../core/spell-workflow-policies'
const props = defineProps<{ request: GmSpellRequest; view: RoomView; busy: boolean }>()
const emit = defineEmits<{ command: [command: RoomCommand] }>()
const ruleChecks=shallowRef<string[]>([])
const checks=computed(()=>G_RULES[props.request.spellId]?.checks??[])
const result = shallowRef(''), privateNote = shallowRef('')
const audience = shallowRef<'personal'|'public'|'gm'>('personal')
const recipients=computed(()=>{const w=props.view.world,a=w?.adventures[0];if(!w||!a)return props.view.characters;const rows=a.scenes.flatMap(s=>[...s.tokens,...s.defeatedTokens??[]]).flatMap(t=>{const e=gEntity(w,a,t.characterId??t.npcId??t.actorId??t.id).entity;return e?[{id:e.id,name:e.name}]:[]});return [...props.view.characters,...rows].filter((c,i,rows)=>rows.findIndex(r=>r.id===c.id)===i)})
const recipient = shallowRef(props.request.characterId), noResult = shallowRef(props.request.noResult??false)
const encounter=computed(()=>props.view.world?.encounters.find(e=>e.id===props.request.encounterId))
const reactionWaiting=computed(()=>!!encounter.value?.pending?.reactionFrame&&[...encounter.value.reactionParents??[],...encounter.value.attackParents??[]].some(p=>p.id===props.request.pendingId))
const cat=computed(()=>catalogue([srd,...(props.view.world?.packs??[])]))
const instruction = computed(() => spellWorkflowPolicy(props.request.spellId)?.instruction)
function react(command:CombatCommand){
  const world=props.view.world,e=encounter.value
  if(!world||!e||e.pending?.id!==props.request.pendingId&&!reactionWaiting.value)return
  const identity=resolutionIdentity(world,e.id,props.view.broadcast.branchId)
  if(identity)emit('command',{kind:'map',command:{type:'combat',sceneId:props.request.sceneId,command,resolutionGuard:identity.guard}})
}
function publish() {
  emit('command', {kind:'spell-gm-resolve', requestId:props.request.id,
    ruleChecks:ruleChecks.value,text:result.value, privateNote:privateNote.value, noResult:noResult.value,
    audience:{kind:audience.value, characterIds:audience.value === 'personal' ? [recipient.value] : []}})
}
</script>
<template>
  <article class="room-card" :aria-label="controlText('field.spellGmRuling')">
    <CounterspellReaction v-if="encounter?.pending && view.world" :encounter="encounter" :characters="view.world.characters" :cat="cat" :busy="busy"
      @command="react" />
    <p v-if="reactionWaiting" class="muted">{{ controlText('operations.theOriginalCastingIsSavedFinishTheCurrent') }}</p>
    <button v-if="reactionWaiting" :disabled="busy" @click="react({type:'resolve',nonlethal:false,savage:false,stone:false,relentless:false,pushConfirmed:false})">{{ controlText('operations.confirmCurrentReactionCasting') }}</button>
    <h4>{{ controlText('quantity.round', {p0:(localizedEntryName(request)),p1:(request.questionIndex),p2:(controlText('domain.ask'))}) }}</h4>
    <p>{{ request.question }}</p><M3MagicEvidence :view="view" :request="request" />
    <p class="muted">{{ controlText('quantity.costRecorded', {p0:(instruction)}) }}</p>
    <p v-if="request.uncertaintyChance" class="muted">{{ controlText('quantity.noGainChance', {p0:(request.uncertaintyChance),p1:(request.uncertaintyRoll),p2:(request.noResult?controlText('expressionOne.noInformationMayBeGainedThisTime'):controlText('expressionOne.normalAdjudication'))}) }}</p>
    <p v-if="request.choice" class="muted">{{ controlText('quantity.operationTarget', {p0:(request.choice.operation),p1:(request.choice.subjectId??request.targetIds.join('、')),p2:(request.choice.description)}) }}</p>
    <label v-for="check in checks" :key="check"><input v-model="ruleChecks" type="checkbox" :value="check" />{{check}}</label>
    <button :disabled="busy||reactionWaiting" @click="emit('command',{kind:'spell-gm-refresh',requestId:request.id,note:'GM重新核对实际来源、目标、位置及施法条件'})">{{ controlText('operations.recheckChangedRelevantConditions') }}</button>
    <label>{{ controlText('field.spellResult') }}<textarea v-model="result" maxlength="6000" /></label>
    <label>{{ controlText('field.privateGmNotes') }}<textarea v-model="privateNote" maxlength="4000" /></label>
    <div class="inline">
      <label>{{ controlText('field.resultRecipients') }}<select v-model="audience">
        <option value="personal">{{ controlText('domain.specifiedCharacter') }}</option><option value="public">{{ controlText('controls.public') }}</option><option value="gm">{{ controlText('game.gmOnly') }}</option>
      </select></label>
      <label v-if="audience === 'personal'">{{ controlText('game.recipients') }}<select v-model="recipient">
        <option v-if="!recipients.some(c=>c.id===request.characterId)" :value="request.characterId">{{ controlText('operations.originalNpcCaster') }}</option><option v-for="c in recipients" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
      </select></label>
      <label><input v-model="noResult" type="checkbox" />{{ controlText('field.noInformationGainedThisTime') }}</label>
    </div>
    <button :disabled="busy || reactionWaiting || !result.trim()" @click="publish">{{ controlText('operations.confirmAndPublishSpellResult') }}</button>
    <button :disabled="busy || reactionWaiting" class="subtle" @click="emit('command', {kind:'spell-gm-cancel', requestId:request.id, reason:'GM结束本次结果裁定，不退还已合法施法资源'})">{{ controlText('operations.closeAdjudication') }}</button>
  </article>
</template>
