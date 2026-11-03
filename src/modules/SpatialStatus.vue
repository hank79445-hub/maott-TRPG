<script setup lang="ts">
import {uiLabel} from './ui-label'
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import type {SpatialState,SpatialCapabilities} from '../core/m3-spatial'
defineProps<{space?:SpatialState;capabilities?:SpatialCapabilities;effects?:import('../core/types').ActiveEffect[]}>()
const sizes={tiny:'微型',small:'小型',medium:'中型',large:'大型',huge:'巨型',gargantuan:'超巨型'}
const layers={material:'常规位面',ethereal:'以太位面',pocket:'绳索空间',stone:'石体内部'}
</script>
<template>
  <details v-if="space||capabilities" class="spatial-status"><summary>{{ controlText('remainingField.spaceAndMovement') }}<span v-if="space">{{ controlText('scriptSummary.height', {p0:(uiLabel(layers[space.layer])),p1:(space.height),p2:(controlText('game.feet'))}) }}</span></summary>
    <div v-if="capabilities" class="spatial-badges" :aria-label="controlText('remainingField.currentEffectiveMovementAndPerception')">
      <span>{{ controlText('game.walk') }} {{capabilities.walk}}{{ controlText('game.feet') }}</span><span v-if="capabilities.climb">{{ controlText('game.climb') }} {{capabilities.climb}}{{ controlText('game.feet') }}</span><span v-if="capabilities.swim">{{ controlText('game.swim') }} {{capabilities.swim}}{{ controlText('game.feet') }}</span><span v-if="capabilities.fly">{{ controlText('game.fly') }} {{capabilities.fly}}{{ controlText('game.feet') }}{{capabilities.hover?controlText('expressionFour.hover'):''}}</span><span>{{ controlText('domain.size') }} {{uiLabel(sizes[capabilities.size])}}</span><span v-if="capabilities.levitate">{{ controlText('scriptSummary.levitationAdjustmentSharedBudgetFt', {p0:(capabilities.levitate)}) }}</span>
      <span v-if="capabilities.darkvision">{{ controlText('scriptSummary.darkvision', {p0:(capabilities.darkvision),p1:(controlText('game.feet'))}) }}</span><span v-if="capabilities.seeInvisible">{{ controlText('resourceFlow.seeInvisibility') }}</span><span v-if="capabilities.waterBreathing">{{ controlText('resourceFlow.waterBreathing') }}</span><span v-if="capabilities.noTracks">{{ controlText('resourceFlow.passWithoutTraceStealth10') }}</span><span v-if="capabilities.waterWalk">{{ controlText('resourceFlow.waterWalk') }}</span><span v-if="capabilities.cannotSpeak">{{ controlText('resourceFlow.cannotSpeakManipulateObjects') }}</span>
    </div><p v-for="effect in effects?.filter(e=>e.key==='alter-self')??[]" :key="effect.id">{{ controlText('scriptSummary.currentTransformation', {p0:(effect.m3?.option==='aquatic'?controlText('domain.aquaticAdaptation'):effect.m3?.option==='weapons'?controlText('expressionFour.naturalWeaponDUsesSpellcastingAbility'):controlText('expressionFour.appearance')+(effect.m3?.description??controlText('expressionFour.notFilled')))}) }}</p>
  </details>
</template>
<style scoped>.spatial-status{margin:.4rem 0;font-size:.85rem}.spatial-badges{display:flex;gap:.35rem;flex-wrap:wrap;padding:.4rem 0}.spatial-badges span{background:var(--surface-muted,var(--panel));border:1px solid var(--border);border-radius:.35rem;padding:.2rem .4rem}</style>
