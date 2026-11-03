<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {catalogue,type Catalogue} from '../core/engine'
import {choiceOptionPresentation,abilityDisplayName,ruleLabel,choiceSource} from './rule-presentation'
const builtinCatalogue=catalogue()
import { computed, ref } from 'vue'
import type { Choice } from '../core/types'
const props = defineProps<{ node: Choice; modelValue: string[]; content?: Catalogue }>()
const emit = defineEmits<{ 'update:modelValue': [string[]]; info: [string] }>()
const search = ref('')
const presentedOptions = computed(() => props.node.options.map(x=>choiceOptionPresentation(props.node,x,props.content??builtinCatalogue)))
const optionName = (id:string) => presentedOptions.value.find(x=>x.id===id)?.name??id
const options = computed(() =>
  presentedOptions.value.filter((x) =>
    (x.name + ' ' + (x.detail || '') + ' ' + (props.node.options.find(o=>o.id===x.id)?.name??'')).toLowerCase().includes(search.value.toLowerCase()),
  ),
)
function toggle(id: string) {
  const old = props.modelValue
  emit(
    'update:modelValue',
    old.includes(id) ? old.filter((x) => x !== id) : props.node.count === 1 ? [id] : [...old, id],
  )
}
</script>
<template>
  <fieldset class="choice-field" :id="'choice-' + node.id">
    <legend>
      {{ ruleLabel(node.label) }}
      <span :class="['count', modelValue.length === node.count ? 'good' : '']"
        >{{ modelValue.length }} / {{ node.count }}</span
      >
    </legend>
    <p class="muted small">
      {{ choiceSource(node,content??builtinCatalogue)
      }}<span v-if="node.ability">
        · {{ controlText('domain.castingAbility') }}
        {{ abilityDisplayName(node.ability) }}</span
      >
    </p>
    <p v-if="node.usage" class="small">{{ ruleLabel(node.usage) }}</p>
    <div v-if="modelValue.length" class="selected-tags">
      <button
        v-for="id in modelValue"
        :key="id"
        class="tag removable"
        type="button"
        @click="toggle(id)"
        :aria-label="controlText('common.cancel') + ': ' + optionName(id)"
      >
        {{ optionName(id) }} <span>×</span>
      </button>
    </div>
    <input
      v-if="node.options.length > 10"
      v-model="search"
      type="search"
      :aria-label="controlText('domain.search') + ': ' + node.label"
      :placeholder="controlText('domain.searchNames')"
      class="choice-search"
    />
    <div class="choice-options" :class="{ 'many-options': node.options.length > 10 }">
      <div
        v-for="option in options"
        :key="option.id"
        :class="['option', { chosen: modelValue.includes(option.id) }]"
      >
        <label
          ><input
            :type="node.count === 1 ? 'radio' : 'checkbox'"
            :name="node.id"
            :value="option.id"
            :checked="modelValue.includes(option.id)"
            :disabled="
              node.count > 1 && !modelValue.includes(option.id) && modelValue.length >= node.count
            "
            @change="toggle(option.id)"
          /><span
            ><strong>{{ option.name }}</strong
            ><small v-if="option.detail">{{ option.detail }}</small></span
          ></label
        >
        <button
          v-if="node.kind === 'spell'"
          class="icon-button"
          type="button"
          :aria-label="controlText('controls.details') + ': ' + option.name"
          @click="emit('info', option.id)"
        >
          ↗
        </button>
      </div>
      <p v-if="!options.length" class="muted small">
        {{ search ? controlText('domain.noMatch') : controlText('domain.completeUpstream') }}
      </p>
    </div>
  </fieldset>
</template>
