<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import {computed,ref,watch} from 'vue'
import type {Encounter,CombatCommand} from '../core/combat-types'
import type {Character} from '../core/types'
import type {Catalogue} from '../core/engine'
import {combatStats,defaultEnvironment} from '../core/combat-rules'
const props=defineProps<{encounter:Encounter;characters:Character[];cat:Catalogue;busy:boolean}>()
const emit=defineEmits<{command:[command:CombatCommand]}>()
const choice=ref<Record<number,string>>({}),distance=ref(5),confirmed=ref(false)
const blocked=computed(()=>props.encounter.pending?.targets.map((t,index)=>({target:t,index})).filter(v=>v.target.sanctuaryBlocked)??[])
const candidates=computed(()=>props.encounter.actors.filter(a=>!props.encounter.pending?.sanctuaryFailures?.includes(a.id)&&!combatStats(a,props.characters,props.cat).dead))
watch(()=>props.encounter.pending?.id,()=>{choice.value={};confirmed.value=false})
function submit(index:number){const p=props.encounter.pending,id=choice.value[index];if(!p||!id||!confirmed.value)return
 emit('command',{type:'sanctuary-retarget',actorId:p.actorId,targetIndex:index,targetId:id,env:{...defaultEnvironment(),distance:distance.value,targetLocationConfirmed:true,note:'GM已核对新目标、实际距离与视线'}})}
</script>
<template>
 <fieldset v-if="blocked.length" class="battle-card m2-control-form">
  <legend>{{ controlText('adjudication.sanctuaryWisdomSaveFailedChooseAnotherTarget') }}</legend>
  <p>{{ controlText('adjudication.spendNoAdditionalActionOrSpellSlotThe') }}</p>
  <label>{{ controlText('interactionField.newTargetDistanceFt') }}<input v-model.number="distance" type="number" min="0" max="10000" /></label>
  <label><input v-model="confirmed" type="checkbox" />{{ controlText('interactionField.gmVerifiedNewTargetDistanceAndSight') }}</label>
  <div v-for="b in blocked" :key="b.index">
   <label>{{ controlText('configurationField.entry') }}{{b.index+1}}{{ controlText('interactionField.targets') }}<MapFieldPicker kind="entity"><select v-model="choice[b.index]"><option value="">{{ controlText('adjudication.chooseAReplacementTarget') }}</option><option v-for="a in candidates" :key="a.id" :value="a.id">{{localizedEntryName(combatStats(a,characters,cat))}}</option></select></MapFieldPicker></label>
   <button :disabled="busy||!confirmed||!choice[b.index]" @click="submit(b.index)">{{ controlText('adjudication.confirmReplacementTarget') }}</button>
  </div>
 </fieldset>
</template>
