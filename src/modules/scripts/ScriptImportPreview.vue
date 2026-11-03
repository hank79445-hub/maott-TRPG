<script setup lang="ts">
import {uiDate} from '../locale-format'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import type { ImportPreview } from '../../online/script-client'
defineProps<{ preview: ImportPreview; busy: boolean }>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>
<template>
  <section class="script-card script-banner" :aria-label="controlText('remainingField.scriptImportPreview')">
    <h2>{{ controlText('authoringFlow.fullScriptPackagePreview') }}</h2>
    <p>
      <strong>{{ localizedEntryName(preview.definition.metadata) }}</strong> ·
      {{ preview.definition.metadata.authorVersion }} ·
      {{ preview.definition.metadata.author || controlText('expressionFour.authorNotSupplied') }}
    </p>
    <p>
      {{ controlText('scriptSummary.scenesNpcsImages', {p0:(preview.definition.scenes.length),p1:(preview.definition.npcs.length),p2:(preview.definition.assets.length)}) }}</p>
    <p>{{ preview.definition.metadata.description }}</p>
    <p>
      {{
        preview.ready
          ? controlText('expressionFour.contentAndDependencyPreflightPassed')
          : preview.missingDependencies.length
            ? controlText('expressionFour.ruleDependenciesMissingSaveAsDraftWithGame')
            : controlText('expressionFour.backgroundAwaitsGmCalibrationImportAsAuthorDraft')
      }}
    </p>
    <ul v-if="preview.missingDependencies.length">
      <li v-for="d in preview.missingDependencies" :key="d.id">{{ controlText('scriptSummary.missing', {p0:(d.id),p1:(d.version)}) }}
      </li>
    </ul>
    <details>
      <summary>{{ controlText('authoringFlow.ruleDependenciesAndGameStartCharacterSlots') }}</summary>
      <ul>
        <li v-for="d in preview.definition.dependencies" :key="d.id">
          {{ d.id }} · {{ d.version }}
        </li>
      </ul>
      <ul>
        <li v-for="r in preview.definition.roles" :key="r.id">
          {{ localizedEntryName(r) }} · {{ r.required ? controlText('workflow.requiredSlot') : controlText('controls.optional') }}
        </li>
      </ul>
    </details>
    <p class="muted">{{ controlText('scriptSummary.thisFileContainsPrivateGmConfigurationConfirmation', {p0:(uiDate(preview.expiresAt,'time'))}) }}</p>
    <div class="script-actions">
      <button class="primary" :disabled="busy" @click="$emit('confirm')">{{ controlText('authoringFlow.confirmImportAsNewCopy') }}</button
      ><button class="secondary" :disabled="busy" @click="$emit('cancel')">{{ controlText('authoringFlow.cancelImport') }}</button>
    </div>
  </section>
</template>
