<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import {computed,ref,watch} from 'vue'
import type {RoomView,RoomCommand} from '../../online/protocol'
import type {M3CastChoice} from '../../core/m3-spells'
import {runtimeSpells} from '../../core/runtime'
import {M3_WORLD_SPELLS} from '../../core/m3-world-cast'
import M3DestinationPreview from './M3DestinationPreview.vue'
import M3CastFields from '../M3CastFields.vue'
import {useM3View} from './useM3View'
const props=defineProps<{view:RoomView;busy:boolean}>(),emit=defineEmits<{command:[RoomCommand]}>()
const {people,scene,state,cat,adventure}=useM3View(()=>props.view)
const source=ref(''),key=ref(''),mode=ref(''),targets=ref<string[]>([]),object=ref(''),material=ref(''),x=ref(1),y=ref(1),height=ref(0),willing=ref(false),note=ref('GM已核对实际目标、成分、空间、可见性与反应时机')
const nativeChoice=ref<M3CastChoice>({})
const option=ref<M3CastChoice['option']>('mask'),creatureType=ref<import('../../core/m3-magic-perception').CreatureType>('humanoid'),magical=ref(true),school=ref('')
watch(people,p=>{if(!p.some(e=>e.id===source.value))source.value=p[0]?.id??''},{immediate:true})
const caster=computed(()=>people.value.find(p=>p.id===source.value))
const grants=computed(()=>{
 const entity=caster.value?.entity
 if(entity?.c)return runtimeSpells(entity.c,cat.value).filter(g=>M3_WORLD_SPELLS.includes(g.spell.id)).map(g=>({key:g.key,name:g.spell.name,spellId:g.spell.id,modes:g.modes}))
 return entity?.body?.abilities?.filter(a=>a.spellId&&M3_WORLD_SPELLS.includes(a.spellId)).map(a=>({key:a.id,name:a.name,spellId:a.spellId!,modes:['npc']}))??[]
})
const grant=computed(()=>grants.value.find(g=>g.key===key.value))
watch(grants,g=>{if(!g.some(g=>g.key===key.value))key.value=g[0]?.key??''},{immediate:true})
watch(()=>source.value+':'+grant.value?.key,()=>{const g=grant.value;mode.value=g?.modes[0]??'';targets.value=source.value?[source.value]:[];object.value='';height.value=g?.spellId==='floating-disk'?3:caster.value?.token.spatial?.height??0;x.value=caster.value?.token.x??1;y.value=caster.value?.token.y??1},{immediate:true})
const objects=computed(()=>state.value?.entities.filter(e=>e.sceneId===scene.value?.id&&e.enabled)??[])
const fixedSelf=computed(()=>['misty-step','floating-disk','rope-trick','meld-into-stone'].includes(grant.value?.spellId??'')||!!object.value)
function submit(){
 const choice=grant.value?.spellId==='arcanist-s-magic-aura'?object.value?{option:'false-aura' as const,magical:magical.value,school:school.value||undefined}:{option:'mask' as const,creatureType:creatureType.value}:nativeChoice.value
 emit('command',{kind:'m3-spatial',action:{operation:'cast',casterId:source.value,key:key.value,mode:mode.value,targets:fixedSelf.value?[source.value]:targets.value,objectId:object.value||undefined,
  to:['misty-step','floating-disk','levitate','faerie-fire'].includes(grant.value?.spellId??'')?{x:x.value,y:y.value,height:height.value}:undefined,choice,materialId:material.value||undefined,willing:willing.value,confirmed:true,note:note.value}})
}
</script>
<template>
 <details><summary>{{ controlText('domain.positionCast') }}</summary>
  <div class="m3-form-grid"><label>{{ controlText('configurationField.actualCaster') }}<MapFieldPicker kind="entity"><select v-model="source"><option v-for="p in people" :key="p.id" :value="p.id">{{localizedEntryName(p)}}</option></select></MapFieldPicker></label><label>{{ controlText('domain.actualSource') }}<select v-model="key"><option v-for="g in grants" :key="g.key" :value="g.key">{{localizedEntryName(g)}}</option></select></label><label>{{ controlText('domain.method') }}<select v-model="mode"><option v-for="m in grant?.modes??[]" :key="m">{{m}}</option></select></label><label>{{ controlText('game.actualObject') }}<MapFieldPicker kind="surface"><select v-model="object"><option value="">{{ controlText('configuration.noneCreaturePosition') }}</option><option v-for="e in objects" :key="e.id" :value="e.id">{{localizedEntryName(e)}}</option></select></MapFieldPicker></label></div>
  <label v-if="!fixedSelf">{{ controlText('configurationField.actualTargetsFeatherFallPermitsMultipleSelection') }}<MapFieldPicker kind="entity"><select v-model="targets" multiple size="3"><option v-for="p in people" :key="p.id" :value="p.id">{{localizedEntryName(p)}}</option></select></MapFieldPicker></label>
  <div v-if="['misty-step','floating-disk','levitate','faerie-fire'].includes(grant?.spellId??'')" class="m3-form-grid"><label>{{ controlText('game.landingX') }}<input v-model.number="x" type="number" min="0" max="79" /></label><label>{{ controlText('game.landingY') }}<input v-model.number="y" type="number" min="0" max="79" /></label><label>{{ controlText('configurationField.heightAboveGroundFt') }}<input v-model.number="height" type="number" /></label></div>
  <M3DestinationPreview :scene-id="scene?.id" :disabled="busy" @select="p=>{x=p.x;y=p.y;height=p.height}" v-if="caster&&scene&&['misty-step','floating-disk','levitate','faerie-fire'].includes(grant?.spellId??'')" :from="caster.token" :to="{x,y,height}" :feet="scene.grid.feet" :columns="scene.grid.columns" :rows="scene.grid.rows" :walls="scene.walls" />
  <M3CastFields v-if="grant" :spell-id="grant.spellId" v-model="nativeChoice" />
  <template v-if="grant?.spellId==='arcanist-s-magic-aura'"><label v-if="!object">{{ controlText('domain.disguiseType') }}<select v-model="creatureType"><option v-for="type in ['aberration','beast','celestial','construct','dragon','elemental','fey','fiend','giant','humanoid','monstrosity','ooze','plant','undead']" :key="type">{{type}}</option></select></label><template v-else><label><input v-model="magical" type="checkbox" /> {{ controlText('domain.magicAppearance') }}</label><label>{{ controlText('configurationField.displayedSchool') }}<input v-model="school" maxlength="80" /></label></template></template>
  <label v-if="grant?.spellId==='nondetection'&&caster?.entity.c">{{ controlText('configurationField.verifiedDiamondDustWorthGp') }}<select v-model="material"><option value="">{{ controlText('configuration.selectRegisterUnderMaterialVerificationIfNeeded') }}</option><option v-for="m in adventure?.m1Utility?.materials.filter(m=>m.kind==='diamond-dust'&&m.characterId===source)??[]" :key="m.instanceId" :value="m.instanceId">{{ controlText('quantity.diamondDust', {p0:(m.valueGP)}) }}</option></select></label>
  <template v-if="grant?.spellId==='nondetection'&&caster?.entity.n&&!caster?.entity.c"><label>{{ controlText('configurationField.npcSOwnDiamondDustEntry') }}<select v-model="material"><option value="">{{ controlText('configuration.selectAnExistingItem') }}</option><option v-for="row in caster.entity.n.consumables??[]" :key="row.id" :value="row.id">{{ controlText('quantity.portions', {p0:(row.itemId),p1:(row.quantity-(caster.entity.n.consumablesUsed?.[row.id]??0))}) }}</option></select></label><button :disabled="busy||!material" @click="emit('command',{kind:'m3-spatial',action:{operation:'material',ownerId:source,instanceId:material,valueGP:25,note:'GM已核实此实际NPC耗材每份为至少25GP钻石尘'}})">{{ controlText('configuration.verifyThisEntryAs25GpOfDiamond') }}</button></template>
  <label><input v-model="willing" type="checkbox" /> {{ controlText('configurationField.recipientCreatureIsWilling') }}</label><label>{{ controlText('configurationField.gmVerificationBasisAlias28') }}<textarea v-model="note" rows="2" maxlength="2000" /></label>
  <button :disabled="busy||!grant||!source||!mode||!note.trim()" @click="submit">{{ controlText('configuration.submitCasting') }}</button><p class="muted">{{ controlText('configuration.combatCastingRetainsTheCounterspellWindowResourcesAnd') }}</p>
 </details>
</template>
