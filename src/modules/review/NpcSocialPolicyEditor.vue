<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import type { NpcProfile } from '../../core/ai-types'
type Policy=NonNullable<NpcProfile['practicalSocial']>
const props=defineProps<{modelValue?:Policy; secrets:{id:string;text:string}[];points?:{id:string;name:string}[];presets?:{id:string;name:string}[];stock?:{itemId:string;quantity:number}[]}>()
const emit=defineEmits<{'update:modelValue':[value:Policy]}>()
function update(change:(p:Policy)=>void){const p:Policy=JSON.parse(JSON.stringify(props.modelValue??{enabled:false,rules:[]}));change(p);emit('update:modelValue',p)}
function add(){update(p=>p.rules.push({id:crypto.randomUUID(),goal:'',willingness:'judge',skill:'persuasion',cost:'none',success:{text:'',revealIds:[],promise:''},failure:{text:'',revealIds:[],promise:''}}))}
type Op=NonNullable<Policy['rules'][number]['success']['operations']>[number]
function operation(i:number,side:'success'|'failure',kind:Op['kind']){update(p=>{const row=p.rules[i]![side];row.operations??=[];if(row.operations.some(op=>op.kind===kind))return;row.operations.push(kind==='follow'?{kind,join:true}:kind==='interaction'?{kind,pointId:props.points?.[0]?.id??'',operation:'use'}:kind==='battle-support'?{kind,presetId:props.presets?.[0]?.id??''}:{kind,itemId:props.stock?.[0]?.itemId??'',quantity:1})})}
function change(i:number,side:'success'|'failure',at:number,patch:Record<string,unknown>){update(p=>Object.assign(p.rules[i]![side].operations![at]!,patch))}
</script>
<template>
  <fieldset class="social-policy"><legend>{{ controlText('workspace.practicalReviewNegotiationResultAuthorization') }}</legend>
    <label><input type="checkbox" :checked="modelValue?.enabled" @change="update(p=>p.enabled=($event.target as HTMLInputElement).checked)">{{ controlText('interactionField.enableThisNpcSLimitedNegotiationRules') }}</label>
    <p class="muted">{{ controlText('adjudication.writeAchievableSuccessAndFailureConsequencesFirstAuthorization') }}</p>
    <details v-for="(r,i) in modelValue?.rules??[]" :key="r.id"><summary>{{r.goal||controlText('expressionThree.newNegotiationRule')}}</summary>
      <label>{{ controlText('interactionField.requestGoal') }}<input :value="r.goal" maxlength="500" @input="update(p=>p.rules[i]!.goal=($event.target as HTMLInputElement).value)"></label>
      <div class="social-fields">
        <label>{{ controlText('interactionField.willingness') }}<select :aria-label="controlText('interactionField.negotiationWillingness')" :value="r.willingness" @change="update(p=>p.rules[i]!.willingness=($event.target as HTMLSelectElement).value as typeof r.willingness)"><option value="judge">{{ controlText('workspace.aiJudgesFromTheSituation') }}</option><option value="willing">{{ controlText('game.willing') }}</option><option value="unwilling">{{ controlText('game.unwilling') }}</option><option value="hesitant">{{ controlText('workspace.hesitantCheckRequired') }}</option></select></label>
        <label>{{ controlText('game.skill') }}<select :value="r.skill" @change="update(p=>p.rules[i]!.skill=($event.target as HTMLSelectElement).value as typeof r.skill)"><option value="persuasion">{{ controlText('game.persuasion') }}</option><option value="deception">{{ controlText('game.deception') }}</option><option value="intimidation">{{ controlText('game.intimidation') }}</option><option value="performance">{{ controlText('game.performance') }}</option><option value="animal-handling">{{ controlText('domain.animalHandling') }}</option></select></label>
        <label>{{ controlText('interactionField.fixedDcBlankUsesRulesSituation') }}<input type="number" min="1" max="100" :value="r.dc??''" @input="update(p=>p.rules[i]!.dc=($event.target as HTMLInputElement).value?Number(($event.target as HTMLInputElement).value):undefined)"></label>
        <label>{{ controlText('interactionField.cost') }}<select :value="r.cost" @change="update(p=>p.rules[i]!.cost=($event.target as HTMLSelectElement).value as typeof r.cost)"><option value="none">{{ controlText('workspace.noActionCost') }}</option><option value="action">{{ controlText('controls.action') }}</option></select></label>
      </div>
      <section v-for="side in (['success','failure'] as const)" :key="side">
        <label>{{side==='success'?controlText('expressionThree.successWilling'):controlText('expressionThree.failureUnwilling')}}{{ controlText('interactionField.consequences') }}<textarea :value="r[side].text" maxlength="1200" @input="update(p=>p.rules[i]![side].text=($event.target as HTMLTextAreaElement).value)" /></label>
        <label>{{ controlText('interactionField.revealSpecifiedClue') }}<select multiple :value="r[side].revealIds" @change="update(p=>p.rules[i]![side].revealIds=Array.from(($event.target as HTMLSelectElement).selectedOptions,o=>o.value))"><option v-for="s in secrets" :key="s.id" :value="s.id">{{s.text}}</option></select></label>
        <label>{{ controlText('interactionField.explicitCommitmentRequiresPromisePermission') }}<input :value="r[side].promise" maxlength="500" @input="update(p=>p.rules[i]![side].promise=($event.target as HTMLInputElement).value)"></label>
        <p class="muted">{{ controlText('workspace.structuredConsequencesMustSatisfyExistingPermissionsSpecificTargets') }}</p>
        <div v-for="(op,at) in r[side].operations??[]" :key="op.kind">
          <label v-if="op.kind==='follow'"><input type="checkbox" :checked="op.join" @change="change(i,side,at,{join:($event.target as HTMLInputElement).checked})">{{op.join?controlText('expressionThree.joinParty'):controlText('expressionThree.leaveCompanionRoster')}}{{ controlText('interactionField.mustBeACompanionEligibleImportantNpc') }}</label>
          <template v-else-if="op.kind==='interaction'"><label>{{ controlText('interactionField.specificInteractionPoint') }}<MapFieldPicker kind="point"><select :value="op.pointId" @change="change(i,side,at,{pointId:($event.target as HTMLSelectElement).value})"><option v-for="p in points??[]" :key="p.id" :value="p.id">{{localizedEntryName(p)}}</option></select></MapFieldPicker></label><label>{{ controlText('interactionField.originalInteractionOperation') }}<select :value="op.operation" @change="change(i,side,at,{operation:($event.target as HTMLSelectElement).value})"><option value="use">{{ controlText('controls.use') }}</option><option value="toggle">{{ controlText('controls.toggle') }}</option><option value="check">{{ controlText('controls.check') }}</option><option value="claim">{{ controlText('controls.claim') }}</option></select></label></template>
          <label v-else-if="op.kind==='battle-support'">{{ controlText('interactionField.agreedCombatPreset') }}<select :value="op.presetId" @change="change(i,side,at,{presetId:($event.target as HTMLSelectElement).value})"><option v-for="p in presets??[]" :key="p.id" :value="p.id">{{localizedEntryName(p)}}</option></select></label>
          <template v-else><label>{{ controlText('interactionField.actualTradeItem') }}<select :value="op.itemId" @change="change(i,side,at,{itemId:($event.target as HTMLSelectElement).value})"><option v-for="s in stock??[]" :key="s.itemId" :value="s.itemId">{{s.itemId}} ×{{s.quantity}}</option></select></label><label>{{ controlText('interactionField.offerQuantity') }}<input type="number" min="1" max="1000" :value="op.quantity" @input="change(i,side,at,{quantity:Number(($event.target as HTMLInputElement).value)})"></label></template>
          <button type="button" @click="update(p=>p.rules[i]![side].operations!.splice(at,1))">{{ controlText('workspace.removeThisConsequence') }}</button>
        </div>
        <div class="social-fields"><button type="button" @click="operation(i,side,'follow')">{{ controlText('workspace.companionCondition') }}</button><button type="button" :disabled="!points?.length" @click="operation(i,side,'interaction')">{{ controlText('workspace.specificInteraction') }}</button><button type="button" :disabled="!presets?.length" @click="operation(i,side,'battle-support')">{{ controlText('workspace.combatSupport') }}</button><button type="button" :disabled="!stock?.length" @click="operation(i,side,'trade-offer')">{{ controlText('workspace.tradeOffer') }}</button></div>
      </section>
      <button type="button" @click="update(p=>p.rules.splice(i,1))">{{ controlText('workspace.removeThisRule') }}</button>
    </details>
    <button type="button" :disabled="(modelValue?.rules.length??0)>=30" @click="add">{{ controlText('workspace.addNegotiationRule') }}</button>
  </fieldset>
</template>
<style scoped>.social-fields{display:flex;flex-wrap:wrap;gap:8px}label{display:grid;gap:4px;margin:6px 0}input,select,textarea{max-width:100%;min-height:36px}button{background:var(--button-bg);border:1px solid var(--button-border);color:var(--ink);border-radius:6px;padding:6px 12px;min-height:36px}.social-policy details{padding:8px;border-bottom:1px solid var(--line)}</style>
