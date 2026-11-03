<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import type {BattlePreset} from '../../core/battle-types'
type Policy=NonNullable<BattlePreset['practical']>
const props=defineProps<{modelValue?:Policy;npcs:{id:string;name:string;npcType:string;side:'party'|'enemy'|'neutral'}[]}>(),emit=defineEmits<{'update:modelValue':[value:Policy]}>()
function patch(change:(p:Policy)=>void){const p:Policy=JSON.parse(JSON.stringify(props.modelValue??{enabled:false,autoStart:false,finish:'manual',entry:[]}));change(p);emit('update:modelValue',p)}
function mode(id:string,mode:'fixed'|'judge'|'exclude'){patch(p=>{p.entry=p.entry?.filter(e=>e.npcId!==id)??[];p.entry.push({npcId:id,mode,allowedSides:[props.npcs.find(n=>n.id===id)!.side]})})}
</script>
<template><details><summary>{{ controlText('workspace.practicalReviewCombatEntryAndEndingRules') }}</summary>
 <button type="button" @click="patch(()=>{})">{{ controlText('workspace.configureThisPresetSPolicy') }}</button>
 <template v-if="modelValue">
  <label><input type="checkbox" :checked="modelValue.enabled" @change="patch(p=>p.enabled=($event.target as HTMLInputElement).checked)">{{ controlText('interactionField.authorizePracticalPolicyForThisPreset') }}</label>
  <label><input type="checkbox" :checked="modelValue.autoStart" @change="patch(p=>p.autoStart=($event.target as HTMLInputElement).checked)">{{ controlText('interactionField.startAutomaticallyAfterRosterAndInitiativeChoices') }}</label>
  <label>{{ controlText('interactionField.automaticEndingCondition') }}<select :value="modelValue.finish" @change="patch(p=>p.finish=($event.target as HTMLSelectElement).value as Policy['finish'])"><option value="manual">{{ controlText('workspace.gmEndsCombat') }}</option><option value="enemy-unconscious">{{ controlText('workspace.allEnemiesAtZeroHpOrDead') }}</option><option value="enemy-dead">{{ controlText('workspace.allEnemiesConfirmedDead') }}</option></select></label>
  <div v-for="n in npcs" :key="n.id" class="entry-row"><strong>{{localizedEntryName(n)}}</strong><label>{{ controlText('interactionField.combatEntryPolicy') }}<select :value="modelValue.entry?.find(v=>v.npcId===n.id)?.mode??'fixed'" @change="mode(n.id,($event.target as HTMLSelectElement).value as 'fixed'|'judge'|'exclude')"><option value="fixed">{{ controlText('workspace.useFixedPresetRoster') }}</option><option v-if="n.npcType==='important'" value="judge">{{ controlText('workspace.aiJudgesFromItsOwnGoals') }}</option><option value="exclude">{{ controlText('workspace.doNotJoinCombat') }}</option></select></label>
   <label v-if="modelValue.entry?.find(v=>v.npcId===n.id)?.mode==='judge'">{{ controlText('interactionField.allowedSides') }}<select multiple :value="modelValue.entry?.find(v=>v.npcId===n.id)?.allowedSides" @change="patch(p=>p.entry!.find(v=>v.npcId===n.id)!.allowedSides=Array.from(($event.target as HTMLSelectElement).selectedOptions,o=>o.value as 'party'|'enemy'|'neutral'))"><option value="party">{{ controlText('workspace.partySide') }}</option><option value="enemy">{{ controlText('adjudication.enemySide') }}</option><option value="neutral">{{ controlText('adjudication.neutralSide') }}</option></select></label>
  </div>
  <p class="muted">{{ controlText('adjudication.executesOnlyWithTheCorrespondingRoomPolicyEnabled') }}</p>
 </template>
</details></template>
<style scoped>label{display:flex;align-items:center;gap:6px;margin:6px 0;flex-wrap:wrap}.entry-row{border-top:1px solid var(--line);padding:8px 0}select{max-width:100%;min-height:36px}button{min-height:36px;background:var(--button-bg);border:1px solid var(--button-border);border-radius:6px;padding:6px 10px;color:var(--ink)}</style>
