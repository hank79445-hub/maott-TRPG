<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,shallowRef,watch} from 'vue'
import type {Character} from '../../core/types'
import type {Catalogue} from '../../core/engine'
import {growthBaseline} from '../../core/growth-choice-policy'
import {restSpellNodes,restSpellSelectionIssues} from '../../core/rest-spell-choices'
import GrowthSpellChoice from './GrowthSpellChoice.vue'
import ChoiceField from '../ChoiceField.vue'
const props=defineProps<{character:Character;content:Catalogue;kind:'short'|'long'}>()
const model=defineModel<Record<string,string[]>>({default:()=>({})})
const rebuild=shallowRef(false)
const baseline=computed(()=>growthBaseline(props.character))
const nodes=computed(()=>restSpellNodes(props.character,props.content,model.value))
const errors=computed(()=>Object.keys(model.value).length?restSpellSelectionIssues(props.character,props.content,model.value,props.kind):[])
watch(()=>props.character.id+':'+props.character.revision+':'+props.kind,()=>{model.value={};rebuild.value=false})
function update(id:string,values:string[]){model.value={...model.value,[id]:values}}
function toggleBook(){
  rebuild.value=!rebuild.value
  const next={...model.value}
  for(const key of ['tome-cantrips','tome-rituals']){if(rebuild.value)next[key]=[...(baseline.value[key]??[])];else delete next[key]}
  model.value=next
}
</script>
<template>
  <section v-if="nodes.some(n=>n.id!=='class-cantrips'||kind==='long')" class="rest-spell-choices">
    <h4>{{ controlText('configuration.spellChoicesAccompanyingRest') }}</h4><p class="muted">{{ controlText('configuration.takesEffectOnlyAfterThisRestIsCompleted') }}</p>
    <template v-for="n in nodes" :key="n.id">
      <GrowthSpellChoice :content="content" v-if="n.id==='class-cantrips' && kind==='long'" :node="n" :before="baseline[n.id]??[]" :model-value="model[n.id]??baseline[n.id]??[]" :replacements="1" timing="法师长休：可选替换1道职业戏法" @update:model-value="update(n.id,$event)" />
    </template>
    <template v-if="nodes.some(n=>n.id==='tome-cantrips')"><button type="button" @click="toggleBook">{{rebuild?controlText('expressionOne.cancelThisBookOfShadowsReconstruction'):controlText('expressionOne.rebuildBookOfShadowsAfterThisRest')}}</button><template v-if="rebuild"><p>{{ controlText('workspace.threeCantripsPlusTwoLevel1RitualsWithout') }}</p><ChoiceField :content="content" v-for="n in nodes.filter(n=>n.id.startsWith('tome-'))" :key="n.id" :node="n" :model-value="model[n.id]??[]" @update:model-value="update(n.id,$event)" /></template></template>
    <p v-if="errors.length" class="error" role="alert">{{errors.join('；')}}</p>
  </section>
</template>
<style scoped>.rest-spell-choices{padding:12px;border:1px solid var(--line);border-radius:10px;margin:10px 0;min-width:0}.rest-spell-choices button{min-height:44px}.rest-spell-choices p{overflow-wrap:anywhere}</style>
