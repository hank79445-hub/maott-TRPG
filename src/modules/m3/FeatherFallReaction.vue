<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import {computed,ref,watch} from 'vue'
import type {RoomView,RoomCommand} from '../../online/protocol'
import {useM3View} from './useM3View'
import {runtimeSpells,runtimeState,castSlotLevel,runtimeDerived,MODE_NAMES} from '../../core/runtime'
import {combatStats,freshTurn} from '../../core/combat-rules'
import {abilityAvailable} from '../../core/npc-abilities'
import {distance} from '../../core/map'
import {tokenPerception} from '../../core/m3-map-perception'
import {m3RoundKey} from '../../core/m3-space-events'
const props=defineProps<{view:RoomView;entityId:string;busy:boolean}>(),emit=defineEmits<{command:[RoomCommand]}>()
const {world,adventure,scene,people,cat,state}=useM3View(()=>props.view)
const selected=ref(''),targets=ref<string[]>([props.entityId])
const falling=computed(()=>people.value.filter(p=>state.value?.events.some(e=>e.entityId===p.id&&e.type==='fall'&&e.status==='pending')))
const sources=computed(()=>people.value.flatMap(p=>{
 const w=world.value,a=adventure.value,s=scene.value;if(!w||!a||!s)return []
 const stats=p.entity.c?runtimeDerived(p.entity.c,cat.value):combatStats(p.entity.actor??{id:p.id,characterId:null,npc:p.entity.body!,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},w.characters,cat.value)
 if(p.entity.state.hp<=0||stats.conditions.includes('incapacitated')||(p.entity.state.effects??[]).some(f=>f.key==='gaseous-form'))return []
 const battle=w.encounters.find(e=>e.id===s.encounterId&&e.phase==='active'),actor=battle?.actors.find(t=>t.id===p.entity.actor?.id||!!p.entity.c&&t.characterId===p.entity.c.id),budget=a.exploration?.status==='active'?a.exploration.members.find(m=>m.tokenId===p.token.id):undefined
 if(battle&&(!actor?.turn.reaction||battle.pending)||budget&&!budget.reaction||!battle&&!budget&&state.value?.reactions?.some(r=>r.sourceId===p.id&&r.round===m3RoundKey(w,a,s)))return []
 const visible=falling.value.some(target=>distance(s,p.token,target.token)<=60&&tokenPerception(w,a,s,p.token,target.token,cat.value).canSee)
 if(!visible)return []
 if(p.entity.c){const r=runtimeState(p.entity.c,cat.value);return runtimeSpells(p.entity.c,cat.value).filter(g=>g.spell.id==='feather-fall').flatMap(g=>g.modes.filter(m=>{const slot=castSlotLevel(m);return slot?(r.resources[slot===1?'slots':'slots-'+slot]??0)>0:m==='at-will'||m==='free'&&!!g.resource&&(r.resources[g.resource]??0)>0}).map(mode=>({id:p.id+'|'+g.key+'|'+mode,casterId:p.id,key:g.key,mode,label:p.name+' · '+(MODE_NAMES[mode]??mode)})))}
 return p.entity.body?.abilities?.filter(b=>b.spellId==='feather-fall'&&abilityAvailable(p.entity.body!,b.id)).map(b=>({id:p.id+'|'+b.id,casterId:p.id,key:b.id,mode:'npc',label:p.name+' · '+b.name}))??[]
}))
watch(sources,rows=>{if(!rows.some(r=>r.id===selected.value))selected.value=rows[0]?.id??''},{immediate:true})
function submit(){const source=sources.value.find(s=>s.id===selected.value);if(!source)return;emit('command',{kind:'m3-spatial',action:{operation:'cast',casterId:source.casterId,key:source.key,mode:source.mode,targets:targets.value,willing:true,confirmed:true,note:'GM核实实际坠落、60尺内可见、反应与施法成分'}})}
</script>
<template><details v-if="view.self.role==='gm'&&sources.length"><summary>{{ controlText('quantity.featherSources', {p0:(sources.length)}) }}</summary><label>{{ controlText('configurationField.actualReactionSource') }}<select v-model="selected"><option v-for="s in sources" :key="s.id" :value="s.id">{{s.label}}</option></select></label><label>{{ controlText('configurationField.actualFallingTargetsMaximum') }}<MapFieldPicker kind="entity"><select v-model="targets" multiple size="3"><option v-for="p in falling" :key="p.id" :value="p.id">{{localizedEntryName(p)}}</option></select></MapFieldPicker></label><button type="button" :disabled="busy||!selected||!targets.length||targets.length>5" @click="submit">{{ controlText('configuration.castFeatherFallUsingAnAvailableReaction') }}</button></details></template>
