<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global

const open = defineModel<boolean>({ required: true })
defineProps<{ title: string; summary?: string; busy?: boolean }>()
</script>
<template>
  <div class="request-disclosure">
    <div class="room-row">
      <h3>{{ title }}</h3>
      <button class="subtle" :disabled="busy" :aria-expanded="open" @click="open = !open">
        {{ open ? controlText('expressionThree.collapseRequestForm') : controlText('expressionThree.expandRequestForm') }}
      </button>
    </div>
    <p v-if="summary" class="request-summary" role="status">{{ summary }}</p>
    <div v-show="open"><slot /></div>
  </div>
</template>
<style scoped>
.request-summary {
  overflow-wrap: anywhere;
}
.request-disclosure button {
  min-height: 44px;
}
</style>
