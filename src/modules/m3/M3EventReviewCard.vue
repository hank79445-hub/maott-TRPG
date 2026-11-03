<script setup lang="ts">
import {uiLabel} from '../ui-label'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import FeatherFallReaction from './FeatherFallReaction.vue'
import {computed,ref} from 'vue'
import type {RoomView,RoomCommand} from '../../online/protocol'
import type {M3WorldState} from '../../persistence/m3-world-schema'
const props=defineProps<{event:M3WorldState['events'][number];view:RoomView;busy:boolean}>(),emit=defineEmits<{command:[RoomCommand]}>()
const a=computed(()=>props.view.world?.adventures[0]),scene=computed(()=>a.value?.scenes.find(s=>s.id===props.event.sceneId))
const name=computed(()=>scene.value?.tokens.find(t=>[t.id,t.characterId,t.actorId,t.npcId].includes(props.event.entityId))?.name??a.value?.m3?.entities.find(e=>e.id===props.event.entityId)?.name??'实际目标')
const labels={fall:'坠落／羽落',return:'闪现回返',eject:'空间排出',descend:'浮空结束：轻柔下降','stone-damage':'石体受损'}
const x=ref(props.event.from.x),y=ref(props.event.from.y),height=ref(['return','eject','stone-damage'].includes(props.event.type)?props.event.from.height:a.value?.m3?.environments.find(e=>e.sceneId===props.event.sceneId)?.floorHeight??0)
const stoneDamage=ref<'minor'|'partial'|'destroyed'>('partial'),note=ref('GM核实实际落点与空间后果')
function submit(){emit('command',{kind:'m3-spatial',action:{operation:'event',eventId:props.event.id,to:{x:x.value,y:y.value,height:height.value},stoneDamage:props.event.type==='stone-damage'?stoneDamage.value:undefined,note:note.value}})}
</script>
<template><article class="m3-event-card"><strong>{{name}} · {{uiLabel(labels[event.type])}}</strong><p class="muted">{{event.note}}</p><p class="muted">{{ controlText('quantity.originalPosition', {p0:(event.from.x),p1:(event.from.y),p2:(event.from.height)}) }}</p><FeatherFallReaction v-if="event.type==='fall'" :view="view" :entity-id="event.entityId" :busy="busy" @command="emit('command',$event)" /><div class="m3-event-grid"><label>{{ controlText('game.landingX') }}<input v-model.number="x" type="number" min="0" :max="(scene?.grid.columns??80)-1" /></label><label>{{ controlText('game.landingY') }}<input v-model.number="y" type="number" min="0" :max="(scene?.grid.rows??80)-1" /></label><label>{{ controlText('game.actualHeight') }}<input v-model.number="height" type="number" /></label></div><label v-if="event.type==='stone-damage'">{{ controlText('configurationField.destructionLevel') }}<select v-model="stoneDamage"><option value="minor">{{ controlText('configuration.minorNoExpulsion') }}</option><option value="partial">{{ controlText('configuration.partialNoLongerFits6d6Force') }}</option><option value="destroyed">{{ controlText('configuration.destroyedTransformed50Force') }}</option></select></label><label>{{ controlText('game.basis') }}<input v-model="note" maxlength="2000" /></label><button type="button" :disabled="busy||!note.trim()" @click="submit">{{ controlText('configuration.confirmSpatialConsequence') }}</button></article></template>
<style scoped>.m3-event-card{display:grid;gap:.55rem;padding:.75rem;border:1px solid var(--border);border-radius:var(--radius-sm,8px)}.m3-event-card p{margin:0;font-size:.85rem}.m3-event-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem}.m3-event-card label{display:grid;gap:.25rem;min-width:0}.m3-event-card input,.m3-event-card select{width:100%;min-width:0}@media(max-width:500px){.m3-event-grid{grid-template-columns:1fr 1fr}}</style>
