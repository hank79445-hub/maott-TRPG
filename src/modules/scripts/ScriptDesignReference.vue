<script setup lang="ts">
import {uiLabel} from '../ui-label'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import type { ScriptDefinition } from '../../persistence/script-schema'
defineProps<{ definition: ScriptDefinition }>()
const labels = {
  role: '剧情职责',
  motivation: '动机',
  joinConditions: '加入条件',
  leaveConditions: '离队条件',
  personalGoal: '个人目标',
  alternatives: '替代路线',
}
</script>
<template>
  <details
    v-if="
      definition.growthGuide ||
      definition.quests?.some((q) => q.gmDesign) ||
      definition.npcs.some((n) => n.gmDesign)
    "
    class="design-reference"
  >
    <summary>{{ controlText('authoringFlow.gmCharacterQuestAndAdvancementGuidanceNotAutomatic') }}</summary>
    <details v-for="n in definition.npcs.filter((n) => n.gmDesign)" :key="n.id">
      <summary>{{ controlText('progressSummary.characterDesign', {p0:(localizedEntryName(n))}) }}</summary>
      <p v-for="(label, key) in labels" :key="key">
        {{ uiLabel(label) }}：{{ n.gmDesign?.[key] || controlText('expressionFour.notFilled') }}
      </p>
    </details>
    <details v-for="q in (definition.quests ?? []).filter((q) => q.gmDesign)" :key="q.id">
      <summary>{{ controlText('progressSummary.questDesign', {p0:(q.title)}) }}</summary>
      <p>{{ controlText('progressSummary.completionCriteria', {p0:(q.gmDesign?.completion)}) }}</p>
      <p>{{ controlText('progressSummary.alternativeRoute', {p0:(q.gmDesign?.alternatives)}) }}</p>
      <p>{{ controlText('progressSummary.gmNotes', {p0:(q.gmDesign?.notes)}) }}</p>
      <p>{{ controlText('scriptSummary.linkedCharacter', {p0:(q.gmDesign?.npcIds
            .map((id) => localizedEntryName(definition.npcs.find((n) => n.id === id)) ?? id)
            .join('、'))}) }}
      </p>
    </details>
    <section v-if="definition.growthGuide">
      <h3>{{ definition.growthGuide.mode === 'xp' ? controlText('authoringFlow.experiencePointReference') : controlText('authoringFlow.milestoneReference') }}</h3>
      <p>
        {{ controlText('scriptSummary.playersLevelsEstimated', {p0:(definition.growthGuide.players),p1:(definition.growthGuide.startLevel),p2:(definition.growthGuide.endLevel),p3:(definition.growthGuide.hours),p4:(controlText('game.hours'))}) }}
      </p>
      <article v-for="(s, i) in definition.growthGuide.steps" :key="i">
        <strong>{{ s.chapter }} · {{ s.title }}</strong>
        <p>{{ s.reason }}</p>
        <p v-if="s.xp !== undefined">
          {{ s.allocation === 'team-total' ? controlText('expressionFour.partyTotalXp') : controlText('expressionFour.xpPerPlayer') }}：{{ s.xp }}
        </p>
        <p v-if="s.suggestedLevel">{{ controlText('scriptSummary.suggestedLevel', {p0:(s.suggestedLevel)}) }}</p>
        <p>{{ controlText('scriptSummary.basis', {p0:(s.sourceKind === 'gm' ? controlText('expressionFour.gmCustom') : controlText('expressionFour.rulesReferenceVerify')),p1:(s.source)}) }}</p>
      </article>
      <p>{{ controlText('authoringFlow.gmReferenceOnlyDoesNotAutomaticallyGrantXp') }}</p>
    </section>
  </details>
</template>
<style scoped>
.design-reference {
  margin: 12px 0;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
details {
  margin: 8px 0;
}
p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
article {
  border-top: 1px solid var(--line);
  padding: 8px 0;
}
</style>
