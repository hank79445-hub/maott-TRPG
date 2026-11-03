<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import type {Encounter} from '../core/combat-types'
defineProps<{encounter:Encounter}>()
</script>
<template>
  <aside v-if="encounter.reactionParents?.length" class="m3-reaction-frames" role="status">
    <strong>{{ controlText('quantity.reactionDepth', {p0:(encounter.reactionParents.length)}) }}</strong>
    <ol><li v-for="(parent,index) in encounter.reactionParents" :key="parent.id??index">{{localizedEntryName(parent)}}<small v-if="parent.targets.some(t=>t.roll)"> {{ controlText('configuration.originalRollsSaved') }}</small></li><li>{{ controlText('quantity.currentlyHandling', {p0:(localizedEntryName(encounter.pending))}) }}</li></ol>
    <p>{{ controlText('configuration.confirmingThisLayerReturnsToThePreviousLayer') }}</p>
  </aside>
</template>
<style scoped>.m3-reaction-frames{padding:.6rem;background:var(--surface-muted,var(--panel));border:1px solid var(--border);border-radius:.5rem;font-size:.85rem}.m3-reaction-frames ol{margin:.35rem 0;padding-left:1.5rem}.m3-reaction-frames p{margin:.25rem 0}</style>
