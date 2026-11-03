<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {uiLabel} from './ui-label'
import LongTextField from './LongTextField.vue'
import { npcDesignSchema } from '../persistence/script-design-schema'
type Design = import('zod').infer<typeof npcDesignSchema>
const model = defineModel<Design | undefined>()
const labels = {
  role: '剧情职责',
  motivation: '私密动机',
  joinConditions: '加入条件',
  leaveConditions: '离队条件',
  personalGoal: '个人目标',
  alternatives: '替代路线',
}
</script>
<template>
  <details class="npc-design">
    <summary>{{ controlText('configuration.gmCharacterDesignNotSentToModel') }}</summary>
    <template v-if="model"
      ><LongTextField v-for="(label,key) in labels" :key="key" v-model="model[key]" :label="uiLabel(label)" :limit="2000" />
    ></template>
    <button v-else @click="model = npcDesignSchema.parse({})">{{ controlText('configuration.addCharacterDesign') }}</button>
  </details>
</template>
<style scoped>
.npc-design {
  grid-column: 1/-1;
}
label {
  display: block;
  margin: 8px 0;
}
</style>
