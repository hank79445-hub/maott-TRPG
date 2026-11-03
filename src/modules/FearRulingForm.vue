<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,ref,watch} from 'vue'
import type {Encounter,CombatCommand} from '../core/combat-types'
import type {Character} from '../core/types'
import type {Catalogue} from '../core/engine'
import {combatStats} from '../core/combat-rules'
const props=defineProps<{encounter:Encounter;characters:Character[];cat:Catalogue;busy:boolean}>()
const emit=defineEmits<{command:[command:CombatCommand]}>()
const selected=ref(''),noRoute=ref(false),visible=ref(true),moved=ref(false),confirmed=ref(false),note=ref('GM已核对持有物掉落、实际安全路线与回合末视线')
const rows=computed(()=>props.encounter.actors.flatMap(a=>{
 const effects=props.characters.find(c=>c.id===a.characterId)?.runtime?.effects??a.npc?.effects??[]
 return effects.filter(f=>f.key==='fear').map(f=>({actor:a,effect:f}))
}))
watch(rows,all=>{if(!all.some(r=>r.effect.id===selected.value))selected.value=all[0]?.effect.id??''},{immediate:true})
watch([()=>props.encounter.tick,selected],()=>{noRoute.value=false;visible.value=true;moved.value=false;confirmed.value=false})
function submit(){const row=rows.value.find(r=>r.effect.id===selected.value);if(!row)return
 emit('command',{type:'fear-context',actorId:row.actor.id,effectId:row.effect.id,noSafeRoute:noRoute.value,sourceVisible:visible.value,movementResolved:moved.value,confirmed:confirmed.value,note:note.value})}
</script>
<template>
 <details v-if="rows.length" class="battle-card m2-control-form">
  <summary>{{ controlText('operations.fearGmRouteAndLineOfSightVerification') }}</summary>
  <label>{{ controlText('domain.characterSources') }}<select v-model="selected"><option v-for="r in rows" :key="r.effect.id" :value="r.effect.id">{{localizedEntryName(combatStats(r.actor,characters,cat))}} · {{localizedEntryName(r.effect)}}</option></select></label>
  <p class="muted">{{ controlText('adjudication.characterHeldObjectsActuallyDropDuringMapResolution') }}</p>
  <label><input v-model="noRoute" type="checkbox" />{{ controlText('field.noFeasibleSafeRouteCurrently') }}</label>
  <label><input v-model="moved" type="checkbox" />{{ controlText('field.movedAwayAlongTheActualSafeRoute') }}</label>
  <label><input v-model="visible" type="checkbox" />{{ controlText('field.sourceOfFearStillInSightAtTurnAlias158') }}</label>
  <label>{{ controlText('domain.sourceLabel') }}<textarea v-model="note" rows="2" /></label>
  <label><input v-model="confirmed" type="checkbox" />{{ controlText('field.gmVerifiedPossessionsRouteAndLineOfSight') }}</label>
  <button :disabled="busy||!selected||!note||!confirmed" @click="submit">{{ controlText('operations.saveThisTurnSFearRuling') }}</button>
 </details>
</template>
