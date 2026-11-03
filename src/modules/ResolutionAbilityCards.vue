<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import type { ResolutionAbility } from '../core/combat-resolution-options'
const props = defineProps<{ options: ResolutionAbility[]; selected: string[]; busy: boolean }>()
const emit = defineEmits<{ select: [ResolutionAbility]; activate: [ResolutionAbility] }>()
const diceChoices = ref<Record<string, number[]>>({})
watch(
  () => props.options,
  (options) => {
    for (const option of options)
      if (option.dice && !diceChoices.value[option.key]) diceChoices.value[option.key] = []
  },
  { immediate: true },
)
function activate(option: ResolutionAbility) {
  if (option.command?.type === 'spell-reroll' && option.dice) {
    emit('activate', {
      ...option,
      command: { ...option.command, diceIndices: diceChoices.value[option.key] ?? [] },
    })
  } else emit('activate', option)
}
const groups = computed(() => {
  const map = new Map<string, ResolutionAbility[]>()
  for (const option of props.options)
    map.set(option.group, [...(map.get(option.group) ?? []), option])
  return [...map].map(([name, options]) => ({ name, options }))
})
</script>
<template>
  <section class="ability-panel" :aria-label="controlText('domain.resolutionAbilities')">
    <h4>{{ controlText('domain.resolutionAbilities') }}</h4>
    <p class="ability-help">{{ controlText('workspace.listsOnlyRelevantAbilitiesYouPossessSelectionSpends') }}</p>
    <p v-if="!groups.length" class="ability-help">{{ controlText('workspace.noOptionalAbilitiesForThisWindowTheRules') }}</p>
    <fieldset v-for="group in groups" :key="group.name" class="ability-group">
      <legend>{{ localizedEntryName(group) }}</legend>
      <div class="ability-grid">
        <article
          v-for="option in group.options"
          :key="option.key"
          class="ability-card"
          :class="{
            unavailable: !!option.reason,
            selected: selected.includes(option.key) || option.committed,
          }"
        >
          <strong>{{ localizedEntryName(option) }}</strong>
          <small v-if="option.targetName"
            >{{ controlText('liveSummary.entryEntry99', {p0:(controlText('workflow.target')),p1:(option.targetName),p2:(option.targetIndex + 1)}) }}</small
          >
          <small>{{ option.stage }}</small>
          <span>{{ option.cost }}</span>
          <span v-if="option.reason" class="ability-reason">{{ option.reason }}</span>
          <fieldset v-if="option.dice && !option.reason">
            <legend>{{ controlText('progressSummary.chooseDiceToRerollLimit', {p0:(option.maxDice)}) }}</legend>
            <label v-for="(value, index) in option.dice" :key="index" class="dice-choice"
              ><input
                v-model="diceChoices[option.key]"
                type="checkbox"
                :value="index"
                :disabled="busy"
              />{{ controlText('configurationField.entry') }}{{ index + 1 }}{{ controlText('interactionField.dice') }}{{ value }}</label
            >
          </fieldset>
          <button
            v-if="option.choice"
            type="button"
            :disabled="busy || !!option.reason || option.committed"
            :aria-pressed="selected.includes(option.key) || !!option.committed"
            :aria-label="controlText('inlineSummary.target',{p0:(localizedEntryName(option)),p1:(localizedEntryName(group)),p2:(option.targetIndex + 1)})"
            @click="emit('select', option)"
          >
            {{
              option.committed
                ? controlText('expressionThree.submittedCannotUseTwice')
                : selected.includes(option.key)
                  ? controlText('expressionThree.selectedClickAgainToCancel')
                  : controlText('expressionThree.chooseThisAbility')
            }}
          </button>
          <button
            v-else-if="option.command"
            type="button"
            :disabled="
              busy ||
              !!option.reason ||
              option.committed ||
              (!!option.dice &&
                (!diceChoices[option.key]?.length ||
                  (diceChoices[option.key]?.length ?? 0) > (option.maxDice ?? 0)))
            "
            :aria-label="controlText('inlineSummary.useTarget',{p0:(localizedEntryName(option)),p1:(localizedEntryName(group)),p2:(option.targetIndex + 1)})"
            @click="activate(option)"
          >
            {{ option.committed ? controlText('expressionThree.submitted') : controlText('controls.use') }}{{ localizedEntryName(option) }}
          </button>
        </article>
      </div>
    </fieldset>
  </section>
</template>
<style scoped>
.ability-panel {
  margin-block: 1rem;
}
.ability-panel h4 {
  margin: 0 0 0.35rem;
}
.ability-help,
.ability-card small {
  color: var(--muted);
}
.ability-help {
  font-size: 0.9rem;
}
.ability-group {
  min-width: 0;
  margin-block: 0.7rem;
  padding: 0.6rem;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.ability-group legend {
  font-weight: 700;
  padding-inline: 0.4rem;
}
.ability-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  gap: 0.6rem;
}
.ability-card {
  display: grid;
  align-content: start;
  gap: 0.35rem;
  padding: 0.7rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel, var(--surface, #f1f4f3));
  overflow-wrap: anywhere;
}
.ability-card.selected {
  border-color: var(--accent, #315768);
  box-shadow: inset 0 0 0 1px var(--accent, #315768);
}
.ability-card button {
  min-height: 44px;
  margin-top: 0.2rem;
}
.ability-reason {
  font-size: 0.9rem;
}
.ability-card.unavailable {
  border-style: dashed;
}
.dice-choice {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
}
</style>
