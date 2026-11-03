<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import {computed} from 'vue'
import type {RoomView} from '../../online/protocol'
import type {GmSpellRequest} from '../../core/spell-workflow-types'
import {m3MagicEvidence} from '../../core/m3-magic-evidence'
import {m1Entity} from '../../core/m1-utility'
import {distance} from '../../core/map'
const props=defineProps<{view:RoomView;request:GmSpellRequest}>()
const readings=computed(()=>{
 const w=props.view.world,a=w?.adventures[0],s=a?.scenes.find(s=>s.id===props.request.sceneId),source=w&&a?m1Entity(w,a,props.request.characterId)?.token:undefined
 if(!w||!a||!s||!source||!['detect-magic','identify','detect-evil-and-good','clairvoyance','locate-object'].includes(props.request.spellId))return []
 const sensor=props.request.spellId==='clairvoyance',self=['detect-magic','detect-evil-and-good'].includes(props.request.spellId),ids=self?[...s.tokens.filter(t=>distance(s,source,t)<=30).map(t=>t.characterId??t.npcId??t.actorId??t.id),...(a.m3?.entities.filter(e=>e.sceneId===s.id&&e.enabled&&distance(s,source,{...e,spatial:{height:e.height,layer:'material'}})<=30).map(e=>e.id)??[])]:sensor?props.request.targetIds.filter(id=>id!==props.request.characterId):props.request.targetIds
 return ids.flatMap(id=>{try{const result=m3MagicEvidence(w,a,id,sensor?'scrying-sensor':self?'self-divination-sense':'divination-target',props.request.spellId==='detect-magic'?'aura':undefined);return [{id,name:a.m3?.entities.find(e=>e.id===id)?.name??s.tokens.find(t=>[t.id,t.npcId,t.actorId,t.characterId].includes(id))?.name??'实际目标',text:result.blocked?'受保护，不能通过此法术／传感器获取信息':'aura'in result?(result.aura.magical?'显示魔法灵光'+(result.aura.school?' · '+result.aura.school:''):'显示为非魔法'):('魔法识别类型：'+(result.creatureType??'未确认'))}]}catch{return []}})
})
</script>
<template><details v-if="view.self.role==='gm'&&(readings.length||request.spellId==='clairvoyance')"><summary>{{ controlText('configuration.gmBasisForMagicalIdentificationAppearance') }}</summary><p v-if="request.spellId==='clairvoyance'" class="muted">{{ controlText('workspace.theGmConfirmsTheScryingLocationProtectedSubjects') }}</p><p class="muted">{{ controlText('adjudication.generatedFromActualAurasDisguisedTypesAndDetection') }}</p><p v-for="r in readings" :key="r.id">{{localizedEntryName(r)}}：{{r.text}}</p></details></template>
