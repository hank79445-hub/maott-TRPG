<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { computed } from 'vue'
import type { CompiledAuthoring } from '../../core/script-authoring'
import type { AuthoringRequirements } from '../../core/authoring-requirements'
import { authoringReadiness } from '../../core/authoring-readiness'
const props = defineProps<{
  compiled: CompiledAuthoring
  requirements: AuthoringRequirements
  handoff?: boolean
}>()
const report = computed(() => authoringReadiness(props.compiled, props.requirements))
</script>
<template>
  <section class="readiness" :aria-label="controlText('remainingField.newSystemConfigurationPreflightSummary')">
    <h3>{{ handoff ? controlText('expressionFour.preGameDesignHandoff') : controlText('expressionFour.newSystemConfigurationSummary') }}</h3>
    <p class="muted">{{ controlText('authoringFlow.gmAuthoringInformationDoesNotVerifyActualPlayer') }}</p>
    <ul class="module-status">
      <li v-for="m in report.modules" :key="m.id" :class="{ missing: m.status === '需求缺项' }">
        <strong>{{ m.label }}</strong
        ><span>{{ m.status }} · {{ m.count }}</span>
      </li>
    </ul>
    <details :open="report.modules.some((m) => m.status === '需求缺项')">
      <summary>{{ controlText('progressSummary.preflightNoticesAndVerificationItems', {p0:(report.warnings.length)}) }}</summary>
      <ul>
        <li v-for="w in report.warnings" :key="w">{{ w }}</li>
      </ul>
    </details>
    <template v-if="!handoff">
      <details>
        <summary>{{ controlText('authoringFlow.characterCardsShopsAndKnowledgeLayers') }}</summary>
        <article v-for="n in report.npcs" :key="n.key" class="detail-row">
          <strong>{{ localizedEntryName(n) }}</strong>
          <p>{{ controlText('progressSummary.registeredAbilities', {p0:(n.scene),p1:(n.card),p2:(n.abilities)}) }}</p>
          <p v-if="n.equipment">{{ controlText('progressSummary.classCardInventoryInitiallyPreparedSpells', {p0:(n.equipment),p1:(n.preparedSpells)}) }}
          </p>
          <p>{{ controlText('progressSummary.organizationsKnowledge', {p0:(n.faction),p1:(n.knowledge.join('、') || controlText('expressionFour.noTemplateConfigured'))}) }}</p>
          <p v-if="n.merchant">{{ controlText('progressSummary.shopWalletGpTotalStock', {p0:(n.coins),p1:(n.stock),p2:(n.stockRows.join('；') || controlText('expressionFour.noStockForSale'))}) }}
          </p>
        </article>
      </details>
      <details>
        <summary>{{ controlText('authoringFlow.containersAndKeyItems') }}</summary>
        <p v-if="!report.containers.length">{{ controlText('authoringFlow.noTreasureContainersDesigned') }}</p>
        <article v-for="c in report.containers" :key="c.key" class="detail-row">
          <strong>{{ localizedEntryName(c) }}</strong>
          <p>{{ c.content }}</p>
          <p>{{ controlText('progressSummary.openingConditionOpeningAndLootingResolveSeparately', {p0:(c.condition)}) }}</p>
        </article>
      </details>
      <details>
        <summary>{{ controlText('authoringFlow.fogLightingAndSpace') }}</summary>
        <p v-for="s in report.scenes" :key="s.key">
          {{ controlText('progressSummary.entrySpatialObjectsInitialAreasLightsSupply', {p0:(localizedEntryName(s)),p1:(s.landing),p2:(s.fog),p3:(s.light),p4:(s.objects),p5:(s.effects),p6:(s.containers)}) }}</p>
      </details>
      <details>
        <summary>{{ controlText('authoringFlow.interactionEntryConditionsSuccessFailureObjective') }}</summary>
        <article v-for="p in report.interactions" :key="p.key" class="detail-row">
          <strong>{{ localizedEntryName(p) }}</strong>
          <p>{{ controlText('progressSummary.condition', {p0:(p.condition)}) }}</p>
          <p>{{ controlText('progressSummary.success', {p0:(p.success)}) }}</p>
          <p>{{ controlText('progressSummary.failure', {p0:(p.failure)}) }}</p>
          <p v-if="p.quests">{{ controlText('workflow.target') }}{{ p.quests }}</p>
        </article>
      </details>
    </template>
    <details :open="handoff">
      <summary>{{ controlText('authoringFlow.gmGameStartChecklist') }}</summary>
      <ul>
        <li v-for="line in report.checklist" :key="line">{{ line }}</li>
      </ul>
    </details>
  </section>
</template>
<style scoped>
.readiness {
  min-width: 0;
  margin: 16px 0;
  padding: 12px;
  border: 1px solid var(--line, #ccd5d5);
  border-radius: 10px;
  background: var(--panel, #fff);
  overflow-wrap: anywhere;
}
.module-status {
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(210px, 100%), 1fr));
  gap: 8px;
}
.module-status li {
  background: var(--surface);
  color: var(--ink);
  padding: 10px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.module-status .missing {
  border-left: 3px solid var(--danger, #a52d2d);
}
.detail-row {
  border-bottom: 1px solid var(--line, #ccd5d5);
  padding: 10px 0;
}
.detail-row p {
  margin: 6px 0;
}
.readiness details {
  margin: 10px 0;
}
.readiness li {
  margin-block: 6px;
}
</style>
