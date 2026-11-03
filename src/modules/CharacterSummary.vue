<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import type { Build, InventoryItem } from '../core/types'
import type { Catalogue } from '../core/engine'
import { derived, signed } from '../core/engine'
const props = defineProps<{
  build: Build
  content: Catalogue
  inventory?: InventoryItem[]
  issueCount: number
}>()
const d = computed(() => derived(props.build, props.content, props.inventory))
const cl = computed(() => props.content.classes.find((x) => x.id === props.build.classId))
const sp = computed(() => props.content.species.find((x) => x.id === props.build.speciesId))
</script>
<template>
  <aside class="character-summary">
    <div class="summary-sigil">{{ localizedEntryName(cl)?.slice(0, 1) || '✦' }}</div>
    <h3>{{ localizedEntryName(build) || controlText('expressionOne.unnamedAdventurer') }}</h3>
    <p class="muted small">{{ controlText('quantity.levelOne', {p0:(localizedEntryName(sp) || controlText('expressionOne.speciesPending')),p1:(localizedEntryName(cl) || controlText('expressionOne.classPending'))}) }}</p>
    <span class="tag">SRD 5.2.1</span>
    <div class="stat-grid">
      <div :title="controlText('field.hitPointMaximum')">
        <span>{{ controlText('controls.hp') }}</span><b>{{ cl ? d.hp : '—' }}</b>
      </div>
      <div :title="d.acSource">
        <span>{{ controlText('controls.armor') }}</span><b>{{ d.ac }}</b>
      </div>
      <div><span>{{ controlText('operations.proficiencyBonus') }}</span><b>+2</b></div>
      <div>
        <span>{{ controlText('controls.initiative') }}</span><b>{{ signed(d.initiative) }}</b>
      </div>
    </div>
    <div class="summary-line">
      <span>{{ controlText('controls.speed') }}</span><b>{{ sp ? d.speed + controlText('expressionOne.ft') : '—' }}</b>
    </div>
    <div class="summary-line">
      <span>{{ controlText('domain.passivePerception') }}</span><b>{{ d.passivePerception }}</b>
    </div>
    <div v-if="cl?.spellAbility" class="summary-line">
      <span>{{ controlText('operations.classSpellSaveDc') }}</span><b>{{ 10 + d.mods[cl.spellAbility] }}</b>
    </div>
    <div class="summary-status" :class="{ valid: issueCount === 0 }">
      <span>{{ issueCount === 0 ? '✓' : '○' }}</span
      >{{ issueCount === 0 ? controlText('expressionOne.rulesChecksPassed') : controlText('inlineSummary.itemsRemaining',{p0:(issueCount)}) }}
    </div>
    <details class="small sources">
      <summary>{{ controlText('operations.viewStatisticsSources') }}</summary>
      <p>{{ d.hpSource }}</p>
      <p>{{ d.acSource }}</p>
      <p>{{ controlText('quantity.initiative', {p0:(signed(d.mods.dex)),p1:(d.initiative !== d.mods.dex ? controlText('expressionOne.alert') : '')}) }}</p>
    </details>
    <p v-if="build.adjustments.length || build.customItems.length" class="notice small">
      {{ controlText('operations.includesCustomContentOrGmAdjustments') }}
    </p>
  </aside>
</template>
