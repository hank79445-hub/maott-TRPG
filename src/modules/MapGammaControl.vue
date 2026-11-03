<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

const value = defineModel<number>({ required: true })
</script>
<template>
  <span class="map-gamma-control">
    <label>{{ controlText('mapExperience.gamma') }} <input v-model.number="value" type="range" min="0.4" max="2.4" step="0.05" :aria-label="controlText('mapExperience.gammaAria')" /></label>
    <output>{{ value.toFixed(2) }}</output>
    <button class="secondary" type="button" @click="value = 1">{{ controlText('domain.reset') }}</button>
    <small>{{ controlText('mapExperience.gammaHint') }}</small>
  </span>
</template>
<style scoped>
.map-gamma-control,.map-gamma-control label{display:inline-flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.map-gamma-control input{width:8rem;min-width:0}
.map-gamma-control output{font-variant-numeric:tabular-nums;min-width:3ch}
.map-gamma-control small{color:var(--muted)}
</style>
