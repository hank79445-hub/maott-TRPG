<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import {ref,watch} from 'vue'
import MapPositionPicker from '../map-selection/MapPositionPicker.vue'
import type {RoomView,RoomCommand} from '../../online/protocol'
import type {M3Entity} from '../../persistence/m3-world-schema'
import {useM3View} from './useM3View'
const props=defineProps<{view:RoomView;busy:boolean}>(),emit=defineEmits<{command:[RoomCommand]}>()
const {scene,state}=useM3View(()=>props.view)
const light=ref<'bright'|'dim'|'dark'|'magical-darkness'>('bright')
const openSky=ref(true),floor=ref(0),ceiling=ref(10)
watch(()=>state.value?.environments.find(e=>e.sceneId===scene.value?.id),f=>{light.value=f?.light??'bright';openSky.value=f?.openSky??true;floor.value=f?.floorHeight??0;ceiling.value=f?.ceilingHeight??10},{immediate:true})
const editing=ref('')
const name=ref(''),kind=ref<'object'|'rope'|'stone'|'surface'|'liquid'|'plants'>('object'),x=ref(1),y=ref(1),height=ref(0),width=ref(5),depth=ref(5),heightFeet=ref(5),weight=ref(0),standing=ref(false),hidden=ref(false),loose=ref(true)
function register(){
  if(!scene.value)return
  const entity:M3Entity={id:editing.value||crypto.randomUUID(),sceneId:scene.value.id,name:name.value.trim(),kind:kind.value,x:x.value,y:y.value,height:height.value,width:width.value,depth:depth.value,heightFeet:heightFeet.value,weight:weight.value,supportsStanding:standing.value,hidden:hidden.value,loose:loose.value,enabled:true}
  const current=state.value?.entities.find(e=>e.id===editing.value)
  emit('command',{kind:'m3-spatial',action:{operation:'entity',entity:{...current,...entity}}})
}
</script>
<template>
 <details><summary>{{ controlText('configuration.environmentAndExistingObjects') }}</summary>
  <p class="muted">{{ controlText('workspace.heightIsMeasuredInFeetLegacyMapsDefault') }}</p>
  <div class="m3-form-grid"><label>{{ controlText('configurationField.actualLighting') }}<select v-model="light"><option value="bright">{{ controlText('configuration.bright') }}</option><option value="dim">{{ controlText('domain.dimLight') }}</option><option value="dark">{{ controlText('domain.darkness') }}</option><option value="magical-darkness">{{ controlText('configuration.magicalDarknessVerifiedByGm') }}</option></select></label><label>{{ controlText('configurationField.groundHeight') }}<input v-model.number="floor" type="number" /></label><label><input v-model="openSky" type="checkbox" /> {{ controlText('configurationField.outdoorOpenSky') }}</label><label v-if="!openSky">{{ controlText('configurationField.ceilingHeight') }}<input v-model.number="ceiling" type="number" /></label></div>
  <button :disabled="busy||!scene" @click="emit('command',{kind:'m3-spatial',action:{operation:'environment',facts:{sceneId:scene!.id,floorHeight:floor,light,openSky,ceilingHeight:openSky?undefined:ceiling}}})">{{ controlText('configuration.saveSpatialEnvironment') }}</button>
  <label>{{ controlText('configurationField.editActualObject') }}<MapFieldPicker kind="surface"><select v-model="editing" @change="()=>{const e=state?.entities.find(e=>e.id===editing);if(e){name=e.name;kind=e.kind as typeof kind;x=e.x;y=e.y;height=e.height;width=e.width;depth=e.depth;heightFeet=e.heightFeet;weight=e.weight;standing=e.supportsStanding??false;hidden=e.hidden;loose=e.loose}}"><option value="">{{ controlText('domain.newObject') }}</option><option v-for="e in state?.entities.filter(e=>!e.castId&&!e.effects?.length&&e.sceneId===scene?.id)??[]" :key="e.id" :value="e.id">{{localizedEntryName(e)}}</option></select></MapFieldPicker></label><div class="m3-form-grid"><label>{{ controlText('domain.objectName') }}<input v-model="name" maxlength="200" /></label><label>{{ controlText('configurationField.type') }}<select v-model="kind"><option value="object">{{ controlText('configuration.independentObject') }}</option><option value="rope">{{ controlText('configuration.existingRope') }}</option><option value="stone">{{ controlText('configuration.stoneLargeEnoughToContainTheCreature') }}</option><option value="surface">{{ controlText('configuration.climbableSurface') }}</option><option value="liquid">{{ controlText('configuration.liquid') }}</option><option value="plants">{{ controlText('configuration.existingOrdinaryPlantArea') }}</option></select></label><label>{{ controlText('game.x') }}<input v-model.number="x" type="number" min="0" max="79" /></label><label>{{ controlText('game.y') }}<input v-model.number="y" type="number" min="0" max="79" /></label><label>{{ controlText('configurationField.bottomHeightLiquidSurface') }}<input v-model.number="height" type="number" /></label><label>{{ controlText('configurationField.widthFt') }}<input v-model.number="width" type="number" min="0" /></label><label>{{ controlText('configurationField.heightRopeLengthFt') }}<input v-model.number="heightFeet" type="number" min="0" /></label><label>{{ controlText('configurationField.depthLiquidDepthFt') }}<input v-model.number="depth" type="number" min="0" /></label><label>{{ controlText('configurationField.actualTotalWeightLb') }}<input v-model.number="weight" type="number" min="0" /></label><label v-if="kind==='surface'"><input v-model="standing" type="checkbox" /> {{ controlText('configurationField.levelPlatformVerifiedAsStandable') }}</label><label><input v-model="loose" type="checkbox" /> {{ controlText('configurationField.neitherWornNorCarried') }}</label><label><input v-model="hidden" type="checkbox" /> {{ controlText('game.gmHidden') }}</label></div>
  <button :disabled="busy||!name.trim()||!scene" @click="register">{{editing?controlText('expressionTwo.saveActualObject'):controlText('expressionTwo.registerActualObject')}}</button><button :disabled="busy||!scene" @click="emit('command',{kind:'m3-spatial',action:{operation:'initial-config',sceneId:scene!.id,note:'GM明确将已核实环境和非魔法物件设为剧本初始配置'}})">{{ controlText('configuration.saveAsInitialScriptSpatialConfiguration') }}</button>
  <ul class="m3-object-list"><li v-for="e in state?.entities.filter(e=>e.sceneId===scene?.id)??[]" :key="e.id">{{ controlText('quantity.positionHeight', {p0:(localizedEntryName(e)),p1:(e.kind),p2:(e.x),p3:(e.y),p4:(e.height),p5:(e.enabled?controlText('expressionTwo.active'):controlText('expressionOne.ended'))}) }}</li></ul>
 </details>
<MapPositionPicker :x="x" :y="y" :height="height" :scene-id="scene?.id" :disabled="busy" :label="controlText('finalField.selectAnObjectSLocationOnTheMap')" @select="p=>{x=p.x;y=p.y;height=p.height}" /></template>
