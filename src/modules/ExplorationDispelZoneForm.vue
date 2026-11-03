<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import {computed,ref,watch} from 'vue'
import type {RoomView,RoomCommand} from '../online/protocol'
import type {Catalogue} from '../core/engine'
import {runtimeSpells,MODE_NAMES} from '../core/runtime'
import {zoneAlive} from '../core/ongoing-spells'
const props=defineProps<{view:RoomView;cat:Catalogue;busy:boolean}>(),emit=defineEmits<{command:[RoomCommand]}>()
const caster=ref(''),key=ref(''),mode=ref(''),zoneId=ref(''),distance=ref(60),confirmed=ref(false),note=ref('')
const world=computed(()=>props.view.world),scene=computed(()=>world.value?.adventures.flatMap(a=>a.scenes).find(s=>s.id===props.view.scene?.id))
const casters=computed(()=>scene.value?.tokens.flatMap(t=>{const c=world.value?.characters.find(c=>c.id===t.characterId);return c&&runtimeSpells(c,props.cat).some(g=>g.spell.id==='dispel-magic')?[{token:t,c}]:[]})??[])
watch(casters,rows=>{if(!rows.some(r=>r.token.id===caster.value))caster.value=rows[0]?.token.id??''},{immediate:true})
const grants=computed(()=>{const c=casters.value.find(r=>r.token.id===caster.value)?.c;return c?runtimeSpells(c,props.cat).filter(g=>g.spell.id==='dispel-magic'):[]})
watch(grants,rows=>{if(!rows.some(g=>g.key===key.value))key.value=rows[0]?.key??''},{immediate:true})
const grant=computed(()=>grants.value.find(g=>g.key===key.value))
watch(grant,g=>{mode.value=g?.modes[0]??''},{immediate:true})
const zones=computed(()=>world.value?.encounters.filter(e=>e.session?.sceneId===scene.value?.id||e.id===scene.value?.encounterId).flatMap(e=>(e.zones??[]).filter(z=>zoneAlive(z,world.value?.characters.find(c=>c.id===(e.actors.find(a=>a.id===z.sourceId)?.characterId??z.sourceId)))))??[])
watch(zones,rows=>{if(!rows.some(z=>z.id===zoneId.value))zoneId.value=rows[0]?.id??''},{immediate:true})
function submit(){if(!scene.value||!confirmed.value)return;emit('command',{kind:'map',command:{type:'explore',sceneId:scene.value.id,command:{operation:'spell-cast',tokenId:caster.value,key:key.value,mode:mode.value,targets:[caster.value],dispelZoneId:zoneId.value,dispelDistance:distance.value,confirmed:true,note:note.value}}});confirmed.value=false}
</script>
<template>
 <details v-if="!view.encounter||view.encounter.phase!=='active'" v-show="zones.length&&casters.length" class="rail-card m2-control-form">
  <summary>{{ controlText('operations.dispelMagicOutsideCombatOngoingArea') }}</summary>
  <label>{{ controlText('field.caster') }}<MapFieldPicker kind="entity"><select v-model="caster"><option v-for="r in casters" :key="r.token.id" :value="r.token.id">{{localizedEntryName(r.token)}}</option></select></MapFieldPicker></label>
  <label>{{ controlText('domain.spellSource') }}<select v-model="key"><option v-for="g in grants" :key="g.key" :value="g.key">{{g.source}}</option></select></label>
  <label>{{ controlText('domain.castMethod') }}<select v-model="mode"><option v-for="m in grant?.modes??[]" :key="m" :value="m">{{uiLabel(MODE_NAMES[m])??m}}</option></select></label>
  <label>{{ controlText('domain.actualArea') }}<select v-model="zoneId"><option v-for="z in zones" :key="z.id" :value="z.id">{{localizedEntryName(z)}}</option></select></label>
  <label>{{ controlText('field.distanceToTargetPointInsideAreaFtAlias153') }}<input v-model.number="distance" type="number" min="0" max="120" /></label>
  <label>{{ controlText('field.actualDistanceUnobstructedPathAndCastingBasis') }}<textarea v-model="note" rows="2" maxlength="2000" /></label>
  <label><input v-model="confirmed" type="checkbox" />{{ controlText('field.gmConfirmsThisIsOutsideCombatWithNo') }}</label>
  <button :disabled="busy||!zoneId||!mode||!confirmed||!note.trim()" @click="submit">{{ controlText('operations.castAndDispelExistingArea') }}</button>
 </details>
</template>
