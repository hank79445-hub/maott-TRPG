<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { computed, shallowRef, watch } from 'vue'
import type { Choice } from '../../core/types'
import type { Catalogue } from '../../core/engine'
import ChoiceField from '../ChoiceField.vue'
const props=defineProps<{node:Choice;modelValue:string[];before:string[];school:string;awardCount:number;maxLevel:number;content:Catalogue}>()
const emit=defineEmits<{'update:modelValue':[string[]];info:[string]}>()
const marked=shallowRef<string[]>([])
const added=computed(()=>props.modelValue.filter(id=>!props.before.includes(id)))
const awarded=computed(()=>added.value.filter(id=>marked.value.includes(id)))
const ordinary=computed(()=>added.value.filter(id=>!marked.value.includes(id)))
const isAward=(id:string)=>props.content.spells.some(s=>s.id===id&&s.school===props.school&&s.level>=1&&s.level<=props.maxLevel&&s.lists.includes('wizard'))
watch(()=>props.school+':'+props.awardCount,()=>{marked.value=added.value.filter(isAward).slice(0,props.awardCount)},{immediate:true})
const ordinaryNode=computed<Choice>(()=>({...props.node,id:'spellbook-ordinary',label:'普通升级入书 · 2道',count:2,options:props.node.options.filter(o=>!props.before.includes(o.id)&&!awarded.value.includes(o.id))}))
const awardNode=computed<Choice>(()=>({...props.node,id:'spellbook-school',label:'学派学者 · 免费额外入书',count:props.awardCount,options:props.node.options.filter(o=>!props.before.includes(o.id)&&!ordinary.value.includes(o.id)&&isAward(o.id))}))
function updateAward(ids:string[]){const keep=[...ordinary.value];marked.value=ids;emit('update:modelValue',[...props.before,...keep,...ids])}
</script>
<template>
  <section class="growth-book">
    <h4>{{ controlText('operations.spellbookAdvancement') }}</h4><p>{{ controlText('field.existingSpellbook') }} {{before.length}}{{ controlText('field.retainedNormallyAdd') }}<span v-if="awardCount">{{ controlText('quantity.schoolBonus', {p0:(awardCount),p1:(maxLevel)}) }}</span>{{ controlText('field.addingToTheBookDoesNotPrepareSpells') }}</p>
    <details><summary>{{ controlText('operations.retainedSpellbook') }}</summary><p>{{before.map(id=>localizedEntryName(content.spells.find(s=>s.id===id))??id).join('、')}}</p></details>
    <ChoiceField :content="content" :node="ordinaryNode" :model-value="ordinary" @update:model-value="emit('update:modelValue',[...before,...$event,...awarded])" @info="emit('info',$event)" />
    <ChoiceField :content="content" v-if="awardCount" :node="awardNode" :model-value="awarded" @update:model-value="updateAward" @info="emit('info',$event)" />
    <p v-if="awardCount" class="muted">{{ controlText('quantity.schoolBonusCount', {p0:(awarded.length),p1:(awardCount)}) }}</p>
  </section>
</template>
<style scoped>.growth-book{padding:12px;border:1px solid var(--line);border-radius:10px;margin:10px 0;min-width:0}.growth-book h4{margin:0}.growth-book p{overflow-wrap:anywhere}</style>
