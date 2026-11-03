<script setup lang="ts">
import {displayFeedback} from '../feedback-presentation'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, shallowRef, watch } from 'vue'
import type { Authoring, AuthorScene } from '../../persistence/script-authoring-schema'
import { compileAuthoring } from '../../core/script-authoring'
const props = defineProps<{ source: Authoring; sceneKey: string; disabled?: boolean }>()
const emit = defineEmits<{ apply: [value: AuthorScene] }>()
const current = computed(() => props.source.scenes.find((s) => s.key === props.sceneKey)!)
const environment = shallowRef<NonNullable<AuthorScene['environment']>>('outdoor')
const boundary = shallowRef<NonNullable<AuthorScene['boundaryWalls']>>('explicit-only')
watch(
  current,
  (s) => {
    environment.value = s.environment ?? 'indoor'
    boundary.value =
      s.boundaryWalls ??
      (s.environment && s.environment !== 'indoor' ? 'explicit-only' : 'auto-enclose')
  },
  { immediate: true },
)
const draft = computed(() => ({
  ...current.value,
  environment: environment.value,
  boundaryWalls: boundary.value,
}))
const changed = computed(
  () =>
    current.value.environment !== environment.value ||
    current.value.boundaryWalls !== boundary.value,
)
const preview = computed(() => {
  try {
    const before = compileAuthoring(props.source).definition.scenes[
      props.source.scenes.indexOf(current.value)
    ]!
    const after = compileAuthoring({
      ...props.source,
      scenes: props.source.scenes.map((s) => (s.key === props.sceneKey ? draft.value : s)),
    }).definition.scenes[props.source.scenes.indexOf(current.value)]!
    const signature = (w: (typeof before.walls)[number]) => JSON.stringify([w.a, w.b, w.kind])
    const a = new Set(before.walls.map(signature)),
      b = new Set(after.walls.map(signature))
    return {
      added: [...b].filter((k) => !a.has(k)).length,
      removed: [...a].filter((k) => !b.has(k)).length,
      error: '',
    }
  } catch (e) {
    return { added: 0, removed: 0, error: e instanceof Error ? e.message : String(e) }
  }
})
function setEnvironment(value: string) {
  environment.value = value as typeof environment.value
  boundary.value = value === 'indoor' ? 'auto-enclose' : 'explicit-only'
}
</script>
<template>
  <details class="environment-controls">
    <summary>{{ controlText('authoringFlow.sceneTypeAndAutomaticBoundaryWalls') }}</summary>
    <p v-if="!current.environment">{{ controlText('authoringFlow.legacySceneRetainsAutomaticEnclosureNoAutomaticMigration') }}</p>
    <label
      >{{ controlText('remainingField.sceneEnvironment') }}<select
        :aria-label="controlText('remainingField.sceneEnvironment')"
        :value="environment"
        :disabled="disabled"
        @change="setEnvironment(($event.target as HTMLSelectElement).value)"
      >
        <option value="outdoor">{{ controlText('domain.outdoor') }}</option>
        <option value="indoor">{{ controlText('domain.indoor') }}</option>
        <option value="mixed">{{ controlText('domain.mixed') }}</option>
      </select></label
    >
    <label
      >{{ controlText('remainingField.boundaryWallPolicy') }}<select :aria-label="controlText('remainingField.boundaryWallPolicy')" v-model="boundary" :disabled="disabled">
        <option value="explicit-only">{{ controlText('authoringFlow.explicitWallsAndDoorsOnlyNoAutomaticEdge') }}</option>
        <option value="auto-enclose">{{ controlText('authoringFlow.automaticallyEncloseWalkableArea') }}</option>
      </select></label
    >
    <p>{{ controlText('progressSummary.previewAddWallDoorSegmentsRemoveGrid', {p0:(preview.added),p1:(preview.removed)}) }}</p>
    <p>{{ controlText('authoringFlow.recompilesTheCurrentCreationDraftOnlyWithoutChanging') }}</p>
    <p v-if="preview.error" role="alert">{{ displayFeedback(preview.error,'error') }}</p>
    <button :disabled="disabled || !changed || !!preview.error" @click="emit('apply', draft)">
      {{ controlText('authoringFlow.applySceneTypeAndWallPolicy') }}
    </button>
  </details>
</template>
<style scoped>
.environment-controls {
  padding: 12px;
  border: 1px solid var(--line);
  margin: 12px 0;
  border-radius: 8px;
}
.environment-controls label {
  display: block;
  margin: 8px 0;
}
.environment-controls select {
  max-width: 100%;
  min-height: 44px;
}
</style>
