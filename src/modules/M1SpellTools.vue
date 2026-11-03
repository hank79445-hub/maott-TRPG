<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapPositionPicker from './map-selection/MapPositionPicker.vue'
import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import {computed,ref,watch} from 'vue'
import type {RoomView,RoomCommand} from '../online/protocol'
import {catalogue} from '../core/engine'
import {srd} from '../content/srd'
import {runtimeSpells} from '../core/runtime'
import {M1_UTILITY_SPELLS} from '../core/m1-utility'
const props=defineProps<{view:RoomView;busy:boolean;preferredTarget?:string}>(),emit=defineEmits<{command:[c:RoomCommand]}>()
const world=computed(()=>props.view.world),a=computed(()=>world.value?.adventures[0])
const cat=computed(()=>catalogue([srd,...world.value?.packs??[]]))
const caster=ref(''),key=ref(''),mode=ref(''),target=ref(''),material=ref(''),note=ref('GM已核对实际目标、成分、距离、自愿及适用时序'),window=ref(0)
const inBattle=computed(()=>world.value?.encounters.some(e=>e.phase==='active'&&e.id===a.value?.scenes.find(s=>s.id===a.value?.activeSceneId)?.encounterId))
const characters=computed(()=>world.value?.characters.filter(c=>c.status==='complete')??[])
watch(characters,cs=>{if(!cs.some(c=>c.id===caster.value))caster.value=cs[0]?.id??''},{immediate:true})
const c=computed(()=>characters.value.find(c=>c.id===caster.value)),grants=computed(()=>c.value?runtimeSpells(c.value,cat.value).filter(g=>M1_UTILITY_SPELLS.includes(g.spell.id)):[])
const grant=computed(()=>grants.value.find(g=>g.key===key.value))
watch(grants,gs=>{if(!gs.some(g=>g.key===key.value))key.value=gs[0]?.key??''},{immediate:true})
watch(grant,g=>{mode.value=g?.modes[0]??''},{immediate:true})
const state=computed(()=>a.value?.m1Utility),materials=computed(()=>state.value?.materials.filter(m=>m.characterId===caster.value&&c.value?.inventory.some(r=>r.instanceId===m.instanceId&&r.quantity>0))??[])
const inventory=computed(()=>c.value?.inventory??[]),row=ref(''),kind=ref<'diamond'|'copper'|'holy-water'|'silver-powder'|'diamond-dust'>('diamond'),value=ref(300)
watch(()=>props.preferredTarget,id=>{if(id)target.value=id},{immediate:true})
const corpseEntity=ref(''),age=ref(0),oldAge=ref(false),viable=ref(true)
const people=computed(()=>[
 ...characters.value.map(c=>({id:c.id,name:c.build.name,dead:!!c.runtime?.death?.dead})),
 ...(a.value?.ai?.npcs.filter(n=>!n.characterId).map(n=>({id:n.id,name:n.name,
 dead:!!(world.value?.encounters.flatMap(e=>e.actors).find(t=>t.id===n.actorId)?.npc??n.body)?.dead}))??[])])
const objectId=ref(''),objectName=ref('食粮'),x=ref(1),y=ref(1),food=ref(true),magical=ref(false),poisoned=ref(false),rotten=ref(false),cursed=ref(false),bound=ref(''),objectRow=ref('')
function registerObject(){const scene=a.value?.activeSceneId;if(!scene)return
 emit('command',{kind:'m1-utility',action:{operation:'object',object:{id:objectId.value||crypto.randomUUID(),sceneId:scene,
 name:objectName.value,x:x.value,y:y.value,food:food.value,magical:magical.value,poisoned:poisoned.value,rotten:rotten.value,cursed:cursed.value,
 boundCharacterId:bound.value||undefined,inventoryInstanceId:objectRow.value||undefined}}})}
function loadObject(id:string){const o=state.value?.objects.find(o=>o.id===id);if(!o){objectId.value='';return}
 objectId.value=o.id;objectName.value=o.name;x.value=o.x;y.value=o.y;food.value=o.food;magical.value=o.magical;poisoned.value=o.poisoned;rotten.value=o.rotten;cursed.value=o.cursed;bound.value=o.boundCharacterId??'';objectRow.value=o.inventoryInstanceId??''}
</script>
<template>
 <details :open="!!preferredTarget" v-if="world&&a" class="rail-card m1-tools">
  <summary>{{ controlText('configuration.m1RemainsObjectsAndAuraResolution') }}</summary>
  <p class="muted">{{ controlText('workspace.highImpactSpellsExecuteAfterGmVerificationItems') }}</p>
  <label>{{ controlText('domain.caster') }}<MapFieldPicker kind="entity"><select v-model="caster"><option v-for="c in characters" :key="c.id" :value="c.id">{{localizedEntryName(c.build)}}</option></select></MapFieldPicker></label>
  <details><summary>{{ controlText('configuration.verifyExistingMaterials') }}</summary>
   <label>{{ controlText('field.ownInventoryEntry') }}<select v-model="row"><option value="">{{ controlText('game.choose') }}</option><option v-for="r in inventory" :key="r.instanceId" :value="r.instanceId">{{localizedEntryName(cat.items.find(i=>i.id===r.itemId))??r.itemId}} ×{{r.quantity}}</option></select></label>
   <label>{{ controlText('domain.materialType') }}<select v-model="kind"><option value="diamond">{{ controlText('configuration.singleDiamond') }}</option><option value="copper">{{ controlText('configuration.copperPiece') }}</option><option value="holy-water">{{ controlText('configuration.holyWater') }}</option><option value="diamond-dust">{{ controlText('configuration.diamondDustConsumed') }}</option></select></label>
   <label>{{ controlText('field.gmVerifiedValuePerItemGp') }}<input v-model.number="value" type="number" min="0" step="0.01" /></label>
   <button :disabled="busy||!row" @click="emit('command',{kind:'m1-utility',action:{operation:'material',characterId:caster,instanceId:row,kind,valueGP:value}})">{{ controlText('configuration.confirmMaterialFlags') }}</button>
  </details>
  <details><summary>{{ controlText('configuration.remainsTimingAndEligibility') }}</summary>
   <p class="muted">{{ controlText('adjudication.newDeathsAutomaticallyRecordGameTimeTheGm') }}</p>
   <label>{{ controlText('field.deadCharacter') }}<MapFieldPicker kind="entity"><select v-model="corpseEntity"><option value="">{{ controlText('game.choose') }}</option><option v-for="p in people.filter(p=>p.dead)" :key="p.id" :value="p.id">{{localizedEntryName(p)}}</option></select></MapFieldPicker></label>
   <label>{{ controlText('field.actualSecondsSinceDeath') }}<input v-model.number="age" type="number" min="0" /></label>
   <label><input v-model="oldAge" type="checkbox" />{{ controlText('field.diedOfOldAge') }}</label><label><input v-model="viable" type="checkbox" />{{ controlText('field.bodyCanSurviveAtHpDoesNotRepair') }}</label>
   <button :disabled="busy||!corpseEntity" @click="emit('command',{kind:'m1-utility',action:{operation:'corpse',entityId:corpseEntity,ageSeconds:age,oldAge,bodyViable:viable}})">{{ controlText('configuration.confirmFactsAboutRemains') }}</button>
  </details>
  <details><summary>{{ controlText('configuration.foodAndCursedObjects') }}</summary>
   <MapFieldPicker kind="surface"><select :aria-label="controlText('field.registerObject')" :value="objectId" @change="loadObject(($event.target as HTMLSelectElement).value)"><option value="">{{ controlText('domain.newObject') }}</option><option v-for="o in state?.objects??[]" :key="o.id" :value="o.id">{{localizedEntryName(o)}}</option></select></MapFieldPicker>
   <MapPositionPicker :x="x" :y="y" :scene-id="a?.activeSceneId??undefined" :disabled="busy" @select="p=>{x=p.x;y=p.y}" /><label>{{ controlText('domain.objectName') }}<input v-model="objectName" /></label><label>{{ controlText('game.x') }}<input v-model.number="x" type="number" min="0" /></label><label>{{ controlText('game.y') }}<input v-model.number="y" type="number" min="0" /></label>
   <label><input v-model="food" type="checkbox" />{{ controlText('field.foodDrink') }}</label><label><input v-model="magical" type="checkbox" />{{ controlText('field.magicItem') }}</label><label><input v-model="poisoned" type="checkbox" />{{ controlText('field.poisonedSubstance') }}</label><label><input v-model="rotten" type="checkbox" />{{ controlText('field.spoiled') }}</label><label><input v-model="cursed" type="checkbox" />{{ controlText('field.curse') }}</label>
   <label>{{ controlText('field.cursedItemHolder') }}<select v-model="bound"><option value="">{{ controlText('configuration.noBinding') }}</option><option v-for="p in characters" :key="p.id" :value="p.id">{{localizedEntryName(p.build)}}</option></select></label>
   <label>{{ controlText('field.actualItemEntry') }}<select v-model="objectRow"><option value="">{{ controlText('configuration.sceneObject') }}</option><option v-for="r in characters.find(c=>c.id===bound)?.inventory??[]" :key="r.instanceId" :value="r.instanceId">{{localizedEntryName(cat.items.find(i=>i.id===r.itemId))??r.itemId}} ×{{r.quantity}}</option></select></label>
   <button :disabled="busy||!objectName" @click="registerObject">{{ controlText('configuration.saveObjectFacts') }}</button>
  </details>
  <label>{{ controlText('domain.actualSpellSource') }}<select v-model="key"><option v-for="g in grants" :key="g.key" :value="g.key">{{localizedEntryName(g.spell)}} · {{g.source}}</option></select></label>
  <label>{{ controlText('domain.castMethod') }}<select v-model="mode"><option v-for="m in grant?.modes??[]" :key="m" :value="m">{{m}}</option></select></label>
  <label>{{ controlText('field.actualCreatureRemainsObject') }}<MapFieldPicker kind="entity"><select v-model="target"><option value="">{{ controlText('game.choose') }}</option>
   <optgroup :label="controlText('finalField.character')"><option v-for="p in people" :key="p.id" :value="p.id">{{localizedEntryName(p)}}{{p.dead?controlText('expressionTwo.dead'):''}}</option></optgroup>
   <optgroup :label="controlText('finalField.stableCorpseRecord')"><option v-for="q in state?.corpses.filter(c=>c.dead)??[]" :key="q.id" :value="q.id">{{localizedEntryName(people.find(p=>p.id===q.entityId))??q.entityId}} · {{q.deathHour===null?controlText('expressionTwo.timeRequiresVerification'):controlText('expressionTwo.timeRecorded')}}</option></optgroup>
   <optgroup :label="controlText('configuration.sceneObject')"><option v-for="o in state?.objects??[]" :key="o.id" :value="o.id">{{localizedEntryName(o)}}</option></optgroup>
  </select></MapFieldPicker></label>
  <label>{{ controlText('configurationField.actualConsumablesForThisOperation') }}<select v-model="material"><option value="">{{ controlText('configuration.noneNotRequired') }}</option><option v-for="m in materials" :key="m.instanceId" :value="m.instanceId">{{ controlText('quantity.unitPrice', {p0:(m.kind),p1:(m.valueGP)}) }}</option></select></label>
  <label>{{ controlText('configurationField.gmVerificationBasis') }}<textarea v-model="note" rows="2" /></label>
  <p v-if="inBattle" class="muted">{{ controlText('configuration.combatCastingRecordsCostsAndEntersTheCounterspell') }}</p>
  <button :disabled="busy||!key||!mode||!target||!note" @click="emit('command',{kind:'m1-utility',action:{operation:'cast',characterId:caster,key,mode,targetId:target,materialId:material||undefined,confirmed:true,note}})">{{inBattle?controlText('expressionTwo.submitCastingAndAwaitCounterspell'):controlText('expressionTwo.confirmCastingAndResolve')}}</button>
  <label>{{ controlText('configurationField.auraOfVitalityFollowUpWindowOnCreation') }}<input v-model.number="window" type="number" min="0" max="9" /></label>
  <button :disabled="busy||!target||!note" @click="emit('command',{kind:'m1-utility',action:{operation:'pulse',characterId:caster,targetId:target,window,confirmed:true,note}})">{{ controlText('configuration.confirmStartOfTurnHealing') }}</button>
 </details>
</template>
<style scoped>.m1-tools label{display:block;margin:.5rem 0}.m1-tools select,.m1-tools textarea{max-width:100%;width:100%}.m1-tools details{margin:.5rem 0}.m1-tools button{margin:.3rem 0}</style>
