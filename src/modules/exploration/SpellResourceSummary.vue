<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import type { Character } from '../../core/types'
import type { Catalogue } from '../../core/engine'
import { spellResourceSummary } from '../../core/spell-resource-summary'
const props = defineProps<{ character: Character; content: Catalogue }>()
const summary = computed(() => spellResourceSummary(props.character, props.content))
</script>
<template>
  <section v-if="summary.slots.length" class="spell-resources" :aria-label="controlText('field.currentCharacterSSpellcastingResources')">
    <div class="spell-pools">
      <span
        v-for="r in summary.slots"
        :key="r.id"
        :class="{ empty: r.remaining === 0 }"
        :title="r.detail + (r.created ? controlText('expressionOne.includesTemporarilyCreatedSpellSlots') + r.created : '')"
        >{{ localizedEntryName(r) }}
        <strong
          >{{ r.remaining }}／{{ r.max }}<small v-if="r.created">+{{ r.created }}</small></strong
        ></span
      >
    </div>
    <p v-if="summary.unavailable" role="status">{{ summary.unavailable }}</p>
    <details v-if="summary.extra.length">
      <summary>{{ controlText('controls.resources') }}</summary>
      <div class="spell-pools">
        <span
          v-for="r in summary.extra"
          :key="r.id"
          :class="{ empty: r.remaining === 0 }"
          :title="r.detail"
          >{{ localizedEntryName(r) }} {{ r.remaining }}／{{ r.max }}</span
        >
      </div>
    </details>
  </section>
</template>
<style scoped>
.spell-resources {
  font-size: 0.82rem;
  padding: 0.45rem 0;
}
.spell-pools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.spell-pools > span {
  background: var(--accent-soft);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.25rem 0.4rem;
}
.spell-pools .empty {
  background: var(--button-disabled);
  color: var(--muted);
}
.spell-resources p {
  margin: 0.3rem 0;
}
.spell-resources summary {
  cursor: pointer;
  margin: 0.35rem 0;
}
</style>
