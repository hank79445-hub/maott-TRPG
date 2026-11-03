<script setup lang="ts">
import {uiLabel} from '../ui-label'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {computed,ref} from 'vue'
import {S_RULES,S_SPELL_IDS,type SummonSpell} from '../../core/summon-rules'
import {summonFormNames as FORM_NAMES} from './labels'
const spell=ref<SummonSpell>('find-familiar'),rule=computed(()=>S_RULES[spell.value])
const formText=computed(()=>rule.value.forms.map(f=>FORM_NAMES[f]??f).join('、'))
const names:Record<SummonSpell,string>={'summon-beast':'野兽召唤术','summon-fey':'妖精召唤术','summon-undead':'亡灵召唤术','find-familiar':'寻获魔宠','find-steed':'寻获坐骑','phantom-steed':'魅影驹','animate-dead':'操纵死尸','unseen-servant':'隐形仆役'}
</script>
<template><details class="summon-library"><summary>{{ controlText('resourceFlow.summoningTemplateLibraryRulesReference') }}</summary><label>{{ controlText('controls.spells') }}<select v-model="spell"><option v-for="id in S_SPELL_IDS" :key="id" :value="id">{{uiLabel(names[id])}}</option></select></label><p>{{ controlText('scriptSummary.legalForms', {p0:(formText)}) }}</p><p v-if="rule.material">{{ controlText('scriptSummary.materialsWorthAtLeastGp', {p0:(localizedEntryName(rule.material)),p1:(rule.material.gp),p2:(rule.material.consume?controlText('expressionFour.actuallyConsumed'):controlText('expressionFour.notConsumed'))}) }}</p><p>{{rule.concentration?controlText('expressionFour.requiresConcentration'):''}}{{rule.hours?controlText('inlineSummary.existsForUpToHours',{p0:(rule.hours)}):controlText('expressionFour.noFixedExistenceDuration')}}{{rule.controlHours?controlText('inlineSummary.controlledForHoursTheBodyRemainsAfterControl',{p0:(rule.controlHours)}):''}}。</p><p>{{ controlText('resourceFlow.readOnlyCreationRequiresYourActualSourceSpell') }}</p><p v-if="spell==='find-familiar'">{{ controlText('resourceFlow.ordinaryFamiliarsCannotAttackAnActualPactOf') }}</p><p v-if="spell==='animate-dead'">{{ controlText('resourceFlow.theGmRegistersActualHumanoidBonePilesOr') }}</p><p v-if="spell==='unseen-servant'">{{ controlText('resourceFlow.theServantIsAForceWithAc10') }}</p><small>{{ controlText('resourceFlow.sourcesPhb2024SpellTextOrdinaryAnimalForms') }}</small></details></template>
<style scoped>.summon-library{margin:.5rem 0;min-width:0}.summon-library label{display:grid;gap:.25rem}.summon-library select{min-width:0;max-width:100%}.summon-library p,.summon-library small{font-size:.85rem;overflow-wrap:anywhere}</style>
