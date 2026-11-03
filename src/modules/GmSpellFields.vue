<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,watch,useId} from 'vue'
import {G_RULES} from '../core/gm-spell-rules'
import type {GmSpellChoice} from '../persistence/gm-spell-choice-schema'
const props=defineProps<{spellId?:string;targets?:{id:string;name:string}[]}>()
const choice=defineModel<GmSpellChoice>({default:()=>({})})
const targetList=useId()
const rule=computed(()=>G_RULES[props.spellId??''])
watch(()=>props.spellId,()=>{if(rule.value)choice.value={operation:rule.value.operations[0]}},{immediate:true})
</script>
<template>
 <fieldset v-if="rule" class="g-fields"><legend>{{ controlText('operations.spellParametersAndGmVerification') }}</legend>
  <div class="g-grid"><label>{{ controlText('game.operation') }}<select v-model="choice.operation"><option v-for="(id,i) in rule.operations" :key="id" :value="id">{{rule.labels[i]}}</option></select></label>
  <label>{{ controlText('field.actualTargetRegisteredObjectRemainsIdAllowed') }}<input v-model="choice.subjectId" :list="targetList" :placeholder="controlText('field.leaveBlankToUseSelectedTarget')" /><datalist :id="targetList"><option v-for="t in targets" :key="t.id" :value="t.id">{{localizedEntryName(t)}}</option></datalist></label>
  <label v-if="rule.material">{{ controlText('field.materialRegistrationId') }}<input v-model="choice.materialId" :placeholder="localizedEntryName(rule.material)+' ≥'+rule.material.gp+controlText('expressionOne.gpRegisteredWithGmRulesFactTools')" /></label>
  <label v-if="rule.size!==undefined">{{ controlText('field.maximumDimensionFt') }}<input v-model.number="choice.size" type="number" min="0" :max="rule.size" /></label>
  <label v-if="rule.weight!==undefined">{{ controlText('field.weightLb') }}<input v-model.number="choice.weight" type="number" min="0" :max="rule.weight" /></label>
  <label v-if="rule.words">{{ controlText('field.wordCountGmVerifiesChinese') }}<input v-model.number="choice.wordCount" type="number" min="1" :max="rule.words" /></label>
  <label v-if="spellId==='clairvoyance'">{{ controlText('field.initialSense') }}<select v-model="choice.mode"><option value="sight">{{ controlText('domain.visual') }}</option><option value="hearing">{{ controlText('domain.auditory') }}</option></select></label></div>
  <label>{{ controlText('field.effectMessageQuestionDescription') }}<textarea v-model="choice.description" maxlength="2000" /></label>
  <label><input type="checkbox" :checked="!!choice.point" @change="choice={...choice,point:($event.target as HTMLInputElement).checked?{x:0,y:0,height:0}:undefined}" />{{ controlText('field.registerActualPositionGridCoordinates') }}</label>
  <div v-if="choice.point" class="g-grid"><label>X<input v-model.number="choice.point.x" type="number" min="0" max="79" /></label><label>Y<input v-model.number="choice.point.y" type="number" min="0" max="79" /></label><label>{{ controlText('game.height') }}<input v-model.number="choice.point.height" type="number" /></label></div>
  <label v-if="spellId==='sending'"><input v-model="choice.crossPlane" type="checkbox" />{{ controlText('field.crossPlaneFailure') }}</label>
  <p v-for="check in rule.checks" :key="check" class="muted">{{check}}</p>
 </fieldset>
</template>
<style scoped>.g-fields{margin-block:.5rem;min-width:0}.g-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.5rem}.g-fields input,.g-fields select,.g-fields textarea{max-width:100%;min-width:0}</style>
