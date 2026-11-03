<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {choiceOptionPresentation,ruleLabel} from '../rule-presentation'
import {catalogue} from '../../core/engine'
const builtinCatalogue=catalogue()
import type {Catalogue} from '../../core/engine'
import { computed } from 'vue'
import type { Choice } from '../../core/types'
import ChoiceField from '../ChoiceField.vue'
const props = defineProps<{ content?:Catalogue; node:Choice; modelValue:string[]; before:string[]; replacements:number; timing:string }>()
const emit = defineEmits<{ 'update:modelValue':[string[]]; info:[string] }>()
const removed = computed(()=>props.before.filter(id=>!props.modelValue.includes(id)))
const retained = computed(()=>props.before.filter(id=>props.modelValue.includes(id)))
const added = computed(()=>props.modelValue.filter(id=>!props.before.includes(id)))
const addNode = computed<Choice>(()=>({...props.node,id:props.node.id+'-new',label:'本次新选',count:Math.max(0,props.node.count-retained.value.length),options:props.node.options.filter(o=>!props.before.includes(o.id))}))
const name = (id:string)=>{const option=props.node.options.find(o=>o.id===id);return option?choiceOptionPresentation(props.node,option,props.content??builtinCatalogue).name:id}
function selectReplacement(event:Event) {
  const oldId=(event.target as HTMLSelectElement).value
  emit('update:modelValue',[...props.before.filter(id=>id!==oldId),...added.value])
}
</script>
<template>
  <section class="growth-spell-choice">
    <h4>{{ruleLabel(node.label)}}</h4><p class="muted">{{ruleLabel(timing)}}</p>
    <p>{{ controlText('room.keep') }} {{retained.length}} {{ controlText('room.newSelection') }} {{added.length}}／{{addNode.count}} {{ controlText('room.replacement') }} {{removed.length}}／{{replacements}}</p>
    <label v-if="before.length && (replacements || removed.length)">{{ controlText('room.oldReplaceable') }}<select :value="removed[0]??''" @change="selectReplacement"><option value="">{{ controlText('room.keepAll') }}</option><option v-for="id in before" :key="id" :value="id" :disabled="!replacements && !removed.includes(id)">{{name(id)}}</option></select></label>
    <button v-if="removed.length" type="button" @click="emit('update:modelValue',[...before,...added])">{{ controlText('room.restoreChoices') }}</button>
    <details v-if="before.length"><summary>{{ controlText('room.retainedSpells') }}</summary><ul><li v-for="id in before" :key="id">{{name(id)}} · {{removed.includes(id)?controlText('rules.replaced'):controlText('room.keep')}}</li></ul></details>
    <p v-if="removed.length>replacements || added.length>addNode.count" class="error" role="alert">{{ controlText('room.overReplacementLimit') }}</p>
    <ChoiceField :content="content" v-if="addNode.count || added.length" :node="addNode" :model-value="added" @update:model-value="emit('update:modelValue',[...retained,...$event])" @info="emit('info',$event)" />
    <p v-else class="muted">{{ controlText('room.noAdditionalChoices') }}</p>
  </section>
</template>
<style scoped>.growth-spell-choice{padding:12px;border:1px solid var(--line);border-radius:10px;margin:10px 0;min-width:0}.growth-spell-choice h4{margin:0}.growth-spell-choice label{display:grid;gap:6px}.growth-spell-choice select{min-width:0;max-width:100%}.growth-spell-choice p{margin:8px 0;overflow-wrap:anywhere}</style>
