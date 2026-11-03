<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import {computed,ref,watch} from 'vue'
import type {Encounter,CombatCommand} from '../core/combat-types'
import type {Character} from '../core/types'
import type {Catalogue} from '../core/engine'
import {combatStats} from '../core/combat-rules'
const props=defineProps<{encounter:Encounter;characters:Character[];cat:Catalogue;busy:boolean}>()
const emit=defineEmits<{command:[CombatCommand]}>()
const selected=ref(''),target=ref(''),operation=ref<Extract<CombatCommand,{type:'control-ruling'}>['operation']>('activity-complete'),inside=ref(true),confirmed=ref(false),note=ref('')
const rows=computed(()=>props.encounter.actors.flatMap(a=>combatStats(a,props.characters,props.cat).effects.filter(f=>['suggestion','calm-emotions','compelled-duel','crown-of-madness','phantasmal-force','zone-of-truth','zone-of-truth-source'].includes(f.key)&&!(f.key==='crown-of-madness'&&f.maintainedTick!==undefined)).map(f=>({actor:a,effect:f}))))
const row=computed(()=>rows.value.find(r=>r.effect.id===selected.value))
const options=computed(()=>{
 const key=row.value?.effect.key
 return key==='suggestion'?[{id:'activity-complete',name:'实际暗示活动完成'}]:key==='calm-emotions'&&row.value?.effect.supportChoice==='indifferent'?[{id:'witness-harm',name:'实际目击盟友受伤，结束冷漠'}]:key==='compelled-duel'?[{id:'duel-distance',name:'来源回合末30尺距离核对'}]:key==='crown-of-madness'?[{id:'crown-target',name:'指定本回合触及内近战目标（空＝没有合法目标）'}]:key==='phantasmal-force'?[{id:'illusion-study',name:'受术者以研究动作调查'},{id:'illusion-damage',name:'来源本回合危险幻象伤害（2d8心灵）'}]:key?.startsWith('zone-of-truth')?[{id:'truth-presence',name:'登记实际进入／离开诚实之域'}]:[]
})
watch(rows,r=>{if(!r.some(r=>r.effect.id===selected.value))selected.value=r[0]?.effect.id??''},{immediate:true})
watch(()=>row.value?.effect.id+'|'+row.value?.effect.key,()=>{operation.value=(options.value[0]?.id??'activity-complete') as typeof operation.value;confirmed.value=false;target.value='';note.value=''},{immediate:true})
function submit(){if(!row.value)return;emit('command',{type:'control-ruling',actorId:row.value.actor.id,effectId:row.value.effect.id,operation:operation.value,targetId:target.value||undefined,inside:inside.value,confirmed:confirmed.value,note:note.value})}
</script>
<template>
 <details v-if="rows.length" class="battle-card m2-control-form">
  <summary>{{ controlText('operations.ongoingControlFollowUpRulesAndGmVerification') }}</summary>
  <label>{{ controlText('field.recipientAndSource') }}<select v-model="selected"><option v-for="r in rows" :key="r.effect.id" :value="r.effect.id">{{localizedEntryName(combatStats(r.actor,characters,cat))}} · {{localizedEntryName(r.effect)}}</option></select></label>
  <p v-if="row?.effect.control?.text" class="muted">{{row.effect.control.text}}</p>
  <label>{{ controlText('domain.process') }}<select v-model="operation"><option v-for="o in options" :key="o.id" :value="o.id">{{localizedEntryName(o)}}</option></select></label>
  <label v-if="['crown-target','truth-presence'].includes(operation)">{{ controlText('controls.target') }}<MapFieldPicker kind="entity"><select v-model="target"><option value="">{{operation==='crown-target'?controlText('expressionOne.noLegalTargetGmMustVerify'):controlText('expressionOne.currentRecipient')}}</option><option v-for="a in encounter.actors" :key="a.id" :value="a.id">{{localizedEntryName(combatStats(a,characters,cat))}}</option></select></MapFieldPicker></label>
  <label v-if="['truth-presence','duel-distance'].includes(operation)"><input v-model="inside" type="checkbox" />{{operation==='duel-distance'?controlText('expressionOne.stillWithinFtOfSource'):controlText('expressionOne.currentlyInsideActualArea')}}</label>
  <p v-if="row?.effect.key.startsWith('zone-of-truth')" class="muted">{{ controlText('quantity.savePrivacy', {p0:(row.effect.control?.result===false?controlText('expressionOne.failedCannotDeliberatelyLieWithinArea'):row.effect.control?.result===true?controlText('expressionOne.succeededLaterSavesStillRequired'):controlText('expressionOne.notTriggeredYet'))}) }}</p>
  <p class="muted">{{ controlText('adjudication.theGmVerifiesRoutesIllusionHazardsAndDistances') }}</p>
  <label>{{ controlText('field.confirmedBasis') }}<textarea v-model="note" rows="2" maxlength="2000" /></label>
  <label><input v-model="confirmed" type="checkbox" />{{ controlText('field.gmVerifiedLegalConditionsAndActualResults') }}</label>
  <button :disabled="busy||!row||!options.length||!note.trim()||!confirmed" @click="submit">{{ controlText('domain.confirmFollowup') }}</button>
 </details>
</template>
