<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,ref} from 'vue'
import type {Encounter,CombatCommand} from '../core/combat-types'
import type {Character} from '../core/types'
import type {Catalogue} from '../core/engine'
import {combatStats} from '../core/combat-rules'
const props=defineProps<{encounter:Encounter;characters:Character[];cat:Catalogue;busy:boolean}>()
const emit=defineEmits<{command:[command:CombatCommand]}>()
const note=ref('已核对最短直接接近／最快可行撤离路线，实际移动与费用已由地图记录'),confirmed=ref(false)
const current=computed(()=>props.encounter.actors[props.encounter.current])
const effects=computed(()=>{
 const a=current.value;if(!a)return[]
 return combatStats(a,props.characters,props.cat).effects.filter(f=>f.key==='command'&&f.maintainedTick===props.encounter.tick&&['approach','flee'].includes(f.supportChoice??''))
})
</script>
<template>
 <fieldset v-if="current&&effects.length" class="battle-card m2-control-form">
  <legend>{{ controlText('operations.commandGmVerifiesActualExecution') }}</legend>
  <p>{{ controlText('workspace.approachByTheShortestDirectRouteStoppingWithin') }}</p>
  <label>{{ controlText('field.outcomeBasis') }}<textarea v-model="note" rows="2" /></label>
  <label><input v-model="confirmed" type="checkbox" />{{ controlText('field.gmVerifiedMapRouteActualCostsAndExecution') }}</label>
  <button v-for="f in effects" :key="f.id" :disabled="busy||!confirmed||!note||f.directiveComplete" @click="emit('command',{type:'command-complete',actorId:current.id,effectId:f.id,confirmed,note})">{{ controlText('quantity.finishedExecution', {p0:(controlText('controls.confirm')),p1:(f.supportChoice==='approach'?controlText('expressionOne.approach'):controlText('state.flee'))}) }}</button>
 </fieldset>
</template>
