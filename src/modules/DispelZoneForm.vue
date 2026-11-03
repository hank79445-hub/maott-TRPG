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
import {combatStats,defaultEnvironment} from '../core/combat-rules'
const props=defineProps<{encounter:Encounter;characters:Character[];cat:Catalogue;busy:boolean}>()
const emit=defineEmits<{command:[command:CombatCommand]}>()
const zone=ref(''),key=ref(''),mode=ref(''),distance=ref(60),confirmed=ref(false)
const actor=computed(()=>props.encounter.actors[props.encounter.current])
const grants=computed(()=>{
 const c=props.characters.find(c=>c.id===actor.value?.characterId)
 return c?runtimeSpells(c,props.cat).filter(g=>g.spell.id==='dispel-magic'):[]
})
const grant=computed(()=>grants.value.find(g=>g.key===key.value))
watch(grants,rows=>{if(!rows.some(g=>g.key===key.value))key.value=rows[0]?.key??''},{immediate:true})
watch(grant,g=>{mode.value=g?.modes[0]??''},{immediate:true})
watch(()=>props.encounter.zones,rows=>{if(!rows?.some(z=>z.id===zone.value))zone.value=rows?.[0]?.id??''},{immediate:true})
function submit(){
 if(!actor.value||!grant.value||!confirmed.value)return
 emit('command',{type:'cast',actorId:actor.value.id,key:key.value,mode:mode.value,targets:[actor.value.id],dispelZoneId:zone.value,
  requirementsConfirmed:true,damageType:'force',env:{...defaultEnvironment(),distance:distance.value,targetLocationConfirmed:true,note:'GM已确认实际魔法区域、距离和无完全遮挡'}})
 confirmed.value=false
}
</script>
<template>
 <details v-if="!encounter.pending&&encounter.phase==='active'&&encounter.zones?.length&&grants.length" class="battle-card m2-control-form">
  <summary>{{ controlText('operations.dispelMagicSelectOngoingArea') }}</summary>
  <p>{{ controlText('quantity.castingCost', {p0:(actor?localizedEntryName(combatStats(actor,characters,cat)):'')}) }}</p>
  <label>{{ controlText('domain.spellSource') }}<select v-model="key"><option v-for="g in grants" :key="g.key" :value="g.key">{{g.source}}</option></select></label>
  <label>{{ controlText('domain.castMethod') }}<select v-model="mode"><option v-for="m in grant?.modes??[]" :key="m" :value="m">{{uiLabel(MODE_NAMES[m])??m}}</option></select></label>
  <label>{{ controlText('domain.actualArea') }}<select v-model="zone"><option v-for="z in encounter.zones" :key="z.id" :value="z.id">{{localizedEntryName(z)}}</option></select></label>
  <label>{{ controlText('field.distanceToTargetPointInsideAreaFt') }}<input v-model.number="distance" type="number" min="0" max="120" /></label>
  <label><input v-model="confirmed" type="checkbox" />{{ controlText('field.gmVerifiedAreaTargetPointWithinFtAnd') }}</label>
  <button :disabled="busy||!zone||!key||!mode||!confirmed" @click="submit">{{ controlText('operations.submitAreaDispel') }}</button>
  <p class="muted">{{ controlText('operations.onlyExistingAreasWithSavedSourceAndSpell') }}</p>
 </details>
</template>
