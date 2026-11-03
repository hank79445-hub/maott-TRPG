<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import {computed,ref,watch} from 'vue'
import type {RoomView,RoomCommand} from '../../online/protocol'
const props=defineProps<{view:RoomView;busy:boolean;preferredTarget?:string}>(),emit=defineEmits<{command:[RoomCommand]}>()
const sourceId=ref(''),key=ref(''),mode=ref(''),targetId=ref(''),materialId=ref(''),confirmed=ref(false)
const sources=computed(()=>props.view.practicalM1??[]),source=computed(()=>sources.value.find(s=>s.sourceId===sourceId.value)),grant=computed(()=>source.value?.grants.find(g=>g.key===key.value))
watch(sources,rows=>{if(!rows.some(s=>s.sourceId===sourceId.value))sourceId.value=rows[0]?.sourceId??''},{immediate:true})
watch(()=>source.value?.sourceId,()=>{key.value=source.value?.grants[0]?.key??'';targetId.value='';materialId.value='';confirmed.value=false},{immediate:true})
watch(()=>grant.value?.key,()=>{mode.value=grant.value?.modes[0]??'';confirmed.value=false},{immediate:true})
watch([sourceId,key,mode,targetId,materialId],()=>confirmed.value=false)
watch([()=>props.preferredTarget,()=>source.value?.targets],([id])=>{if(id&&source.value?.targets.some(t=>t.id===id))targetId.value=id},{immediate:true})
function submit(){if(!source.value||!grant.value||!targetId.value||!mode.value||!confirmed.value)return;emit('command',{kind:'intent-submit',source:'player',summary:grant.value.name+'：实际目标施法申请',baseWorldRevision:props.view.worldRevision,action:{kind:'m1',action:{operation:'cast',characterId:sourceId.value,key:key.value,mode:mode.value,targetId:targetId.value,materialId:materialId.value||undefined,confirmed:true,note:'本人申请实际来源与目标；自愿、材料与遗体资格由独立记录核验'}}})}
</script>
<template><details :open="!!preferredTarget" v-if="sources.length" class="m1-request"><summary>{{ controlText('adjudication.dedicatedCastingRemainsObjectsAndProtection') }}</summary><p class="muted">{{ controlText('adjudication.registerActualMaterialsAndRemainsFactsFirstObtain') }}</p><label>{{ controlText('domain.caster') }}<MapFieldPicker kind="entity"><select v-model="sourceId"><option v-for="s in sources" :key="s.sourceId" :value="s.sourceId">{{localizedEntryName(s)}}</option></select></MapFieldPicker></label><label>{{ controlText('interactionField.dedicatedSpells') }}<select v-model="key"><option v-for="g in source?.grants??[]" :key="g.key" :value="g.key">{{localizedEntryName(g)}}</option></select></label><label>{{ controlText('domain.castMethod') }}<select v-model="mode"><option v-for="m in grant?.modes??[]" :key="m" :value="m">{{m}}</option></select></label><label>{{ controlText('game.actualTarget') }}<MapFieldPicker kind="entity" :locations="source?.targets.flatMap(t=>t.position?[{id:t.id,name:t.name,kind:'entity' as const,...t.position}]:[])??[]"><select :aria-label="controlText('game.actualTarget')" v-model="targetId"><option value="">{{ controlText('game.choose') }}</option><option v-for="t in source?.targets??[]" :key="t.id" :value="t.id">{{localizedEntryName(t)}}</option></select></MapFieldPicker></label><label>{{ controlText('interactionField.registeredMaterials') }}<select v-model="materialId"><option value="">{{ controlText('adjudication.notRequiredAwaitingGmRegistration') }}</option><option v-for="m in source?.materials??[]" :key="m.id" :value="m.id">{{localizedEntryName(m)}}</option></select></label><label><input v-model="confirmed" type="checkbox">{{ controlText('interactionField.iConfirmTheseCastingChoices') }}</label><button :disabled="busy||!confirmed||!targetId" @click="submit">{{ controlText('adjudication.requestCasting') }}</button></details></template>
<style scoped>label{display:grid;gap:4px;margin:8px 0}select{max-width:100%;min-width:0}button{background:var(--button-bg);color:var(--ink);border:1px solid var(--button-border);min-height:40px}.m1-request{padding:8px;border:1px solid var(--line);border-radius:8px}</style>
