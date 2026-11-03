<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,ref,watch} from 'vue'
import type {Encounter,CombatCommand} from '../core/combat-types'
import type {Character} from '../core/types'
import type {Catalogue} from '../core/engine'
import {runtimeSpells,MODE_NAMES} from '../core/runtime'
import {defaultEnvironment,combatStats} from '../core/combat-rules'
const props=defineProps<{encounter:Encounter;characters:Character[];cat:Catalogue;busy:boolean}>()
const emit=defineEmits<{command:[command:CombatCommand]}>()
const selected=ref(''),mode=ref(''),distance=ref(60),confirmed=ref(false)
const sources=computed(()=>props.encounter.actors.flatMap(actor=>{
 const c=props.characters.find(c=>c.id===actor.characterId)
 return !c||actor.id===props.encounter.pending?.actorId?[]:runtimeSpells(c,props.cat).filter(g=>g.spell.id==='counterspell').map(g=>({id:actor.id+'|'+g.key,actor,g}))
}))
const source=computed(()=>sources.value.find(s=>s.id===selected.value))
watch(sources,rows=>{if(!rows.some(r=>r.id===selected.value))selected.value=rows[0]?.id??''},{immediate:true})
watch(source,s=>{mode.value=s?.g.modes[0]??''},{immediate:true})
watch(()=>props.encounter.pending?.id,()=>{confirmed.value=false})
function use(){const s=source.value,p=props.encounter.pending;if(!s||!p)return
 emit('command',{type:'reaction-counterspell',actorId:s.actor.id,targetId:p.actorId,key:s.g.key,mode:mode.value,requirementsConfirmed:confirmed.value,
 env:{...defaultEnvironment(),distance:distance.value,attackerSees:true,targetLocationConfirmed:true}})
}
</script>
<template>
 <details v-if="encounter.pending?.spellId && !encounter.pending.damageRolled && sources.length" class="battle-card">
  <summary>{{ controlText('operations.counterspell2024ConstitutionSave') }}</summary>
  <label>{{ controlText('field.counterspellCasterAndSource') }}<select v-model="selected"><option v-for="s in sources" :key="s.id" :value="s.id">{{localizedEntryName(combatStats(s.actor,characters,cat))}} · {{s.g.source}}</option></select></label>
  <label>{{ controlText('domain.castMethod') }}<select v-model="mode"><option v-for="m in source?.g.modes" :key="m" :value="m">{{uiLabel(MODE_NAMES[m])??m}}</option></select></label>
  <label>{{ controlText('field.distanceToOriginalCasterFt') }}<input v-model.number="distance" type="number" min="0" max="60" /></label>
  <label><input v-model="confirmed" type="checkbox" />{{ controlText('field.gmVerifiedActiveCastingVisibilityWithinFtNo') }}</label>
  <button :disabled="busy||!source||!confirmed" @click="use">{{ controlText('operations.resolveCounterspell') }}</button>
  <p class="muted">{{ controlText('operations.interruptOnlyIfTheTargetFailsTheConstitution') }}</p>
 </details>
</template>
