<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { shallowRef, watch, onBeforeUnmount } from 'vue'
import type { SceneArtDocument } from '../../core/scene-art-projection'
import type { SceneArtPolicy } from '../../persistence/scene-art-schema'
import {
  beautificationMaterial,
  beautificationPrompt,
  renderBeautificationBase,
} from '../../core/scene-beautification'
const props = defineProps<{ document: SceneArtDocument; disabled?: boolean }>()
const emit = defineEmits<{ policy: [value: SceneArtPolicy] }>()
const showing = shallowRef(false),
  image = shallowRef('')
const policy = (patch: Partial<SceneArtPolicy>) =>
  emit('policy', { ...props.document.policy, ...patch, purpose: 'beautify' })
watch([() => props.document, showing], () => {
  if (image.value) URL.revokeObjectURL(image.value)
  image.value = ''
  if (showing.value)
    image.value = URL.createObjectURL(renderBeautificationBase(props.document).blob)
})
onBeforeUnmount(() => {
  if (image.value) URL.revokeObjectURL(image.value)
})
</script>
<template>
  <section class="beautification-controls" :aria-label="controlText('remainingField.baseMapBeautificationSettings')">
    <p>{{ controlText('authoringFlow.imageWorkflowProceduralBaseModelBeautificationReturnedImage') }}</p>
    <label
      >{{ controlText('remainingField.baseMapDoorMarkers') }}<select
        :aria-label="controlText('remainingField.baseMapDoorMarkers')"
        :value="document.policy.doorArtwork ?? 'hidden'"
        :disabled="disabled"
        @change="
          policy({
            doorArtwork: ($event.target as HTMLSelectElement)
              .value as SceneArtPolicy['doorArtwork'],
          })
        "
      >
        <option value="hidden">{{ controlText('authoringFlow.hiddenPassageGapOnly') }}</option>
        <option value="subtle">{{ controlText('authoringFlow.subtleThreshold') }}</option>
        <option value="full">{{ controlText('authoringFlow.fullDoorMarker') }}</option>
      </select></label
    >
    <small>{{ controlText('authoringFlow.affectsTheArtBaseOnlyCalibrationMapsAnd') }}</small>
      <p>
        {{ controlText('authoringFlow.theBeautificationPackageIncludesABaseOfThe') }}
      </p>
      <div class="beautification-options">
        <label
          >{{ controlText('remainingField.beautificationStrength') }}<select
            :aria-label="controlText('remainingField.beautificationStrength')"
            :value="document.policy.beautifyStrength ?? 'conservative'"
            :disabled="disabled"
            @change="
              policy({
                beautifyStrength: ($event.target as HTMLSelectElement)
                  .value as SceneArtPolicy['beautifyStrength'],
              })
            "
          >
            <option value="conservative">{{ controlText('authoringFlow.conservativeBeautification') }}</option>
            <option value="enriched">{{ controlText('authoringFlow.moderateDetail') }}</option>
          </select></label
        >
        <label
          >{{ controlText('remainingField.baseMapRandomSeed') }}<input
            :aria-label="controlText('remainingField.baseMapRandomSeed')"
            type="number"
            min="0"
            max="2147483647"
            step="1"
            :disabled="disabled"
            :value="document.policy.seed ?? 1"
            @change="
              policy({
                seed: Math.max(
                  0,
                  Math.min(
                    2147483647,
                    Math.floor(Number(($event.target as HTMLInputElement).value) || 0),
                  ),
                ),
              })
            "
        /></label>
      </div>
      <details @toggle="showing = ($event.target as HTMLDetailsElement).open">
        <summary>{{ controlText('authoringFlow.viewActualBeautificationBaseAndPrompt') }}</summary>
        <img v-if="image" :src="image" :alt="controlText('remainingField.beautificationBaseWithoutGridOrMarkers')" />
        <pre>{{ beautificationPrompt(document) }}</pre>
        <pre>{{ JSON.stringify(beautificationMaterial(document), null, 2) }}</pre>
      </details>
  </section>
</template>
<style scoped>
.beautification-controls {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 12px;
}
.beautification-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.beautification-controls select,
.beautification-controls input {
  min-height: 44px;
  max-width: 100%;
}
.beautification-controls img {
  max-width: 100%;
  height: auto;
}
.beautification-controls pre {
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
