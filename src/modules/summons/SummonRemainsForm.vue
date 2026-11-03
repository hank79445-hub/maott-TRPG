<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import {computed,ref} from 'vue'
import type {RoomView} from '../../online/protocol'
import type {SummonAction} from '../../persistence/summon-action-schema'
const props=defineProps<{view:RoomView;busy:boolean}>(),emit=defineEmits<{action:[SummonAction]}>()
const corpseId=ref(''),form=ref<'skeleton'|'zombie'>('zombie'),objectId=ref(''),itemId=ref('shortsword'),note=ref(''),corpses=computed(()=>props.view.world?.adventures[0]?.m1Utility?.corpses.filter(c=>c.dead&&c.bodyViable)??[])
function submit(){emit('action',{operation:'remains',corpseId:corpseId.value,form:form.value,equipment:objectId.value?[{objectId:objectId.value,itemId:itemId.value}]:[],receipt:crypto.randomUUID(),note:note.value})}
</script>
<template><details v-if="view.self.role==='gm'" class="s-remains"><summary>{{ controlText('resourceFlow.gmRegistersBonesCorpseAndExistingEquipment') }}</summary><label>{{ controlText('remainingField.actualRemains') }}<MapFieldPicker kind="entity"><select v-model="corpseId"><option value="">{{ controlText('resourceFlow.chooseOriginalRemainsRecord') }}</option><option v-for="c in corpses" :key="c.id" :value="c.id">{{localizedEntryName(view.world?.characters.find(p=>p.id===c.entityId)?.build)??localizedEntryName(view.world?.adventures[0]?.ai?.npcs.find(n=>n.id===c.entityId))??c.entityId}}</option></select></MapFieldPicker></label><label>{{ controlText('remainingField.actualForm') }}<select v-model="form"><option value="zombie">{{ controlText('resourceFlow.corpseZombie') }}</option><option value="skeleton">{{ controlText('resourceFlow.bonesSkeleton') }}</option></select></label><label>{{ controlText('remainingField.actualWeaponObjectOptional') }}<MapFieldPicker kind="surface"><select v-model="objectId"><option value="">{{ controlText('resourceFlow.doNotRegisterAWeapon') }}</option><option v-for="o in view.world?.adventures[0]?.m3?.entities.filter(o=>o.enabled&&o.loose&&!o.boundCharacterId)" :key="o.id" :value="o.id">{{localizedEntryName(o)}}</option></select></MapFieldPicker></label><label v-if="objectId">{{ controlText('remainingField.weaponRulesReference') }}<select v-model="itemId"><option value="shortsword">{{ controlText('resourceFlow.shortsword') }}</option><option value="shortbow">{{ controlText('resourceFlow.shortbow') }}</option></select></label><label>{{ controlText('remainingField.factualBasis') }}<input v-model="note" maxlength="1000" /></label><p class="muted">{{ controlText('resourceFlow.noWeaponsAreGrantedTheServerRechecksExisting') }}</p><button type="button" :disabled="busy||!corpseId||!note.trim()" @click="submit">{{ controlText('resourceFlow.saveActualRemainsRegistration') }}</button></details></template>
<style scoped>.s-remains label{display:grid;gap:.25rem;margin:.5rem 0;min-width:0}.s-remains input,.s-remains select{width:100%;min-width:0}.s-remains p{font-size:.85rem}</style>
