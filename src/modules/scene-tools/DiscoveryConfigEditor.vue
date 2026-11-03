<script setup lang="ts">
import {skillDisplayName} from '../rule-presentation'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import type { MapPoint, MapCommand } from '../../core/map-types'
import type { DiscoveryAttempt } from '../../persistence/point-discovery-schema'
import { SKILLS } from '../../core/types'
const point = defineModel<MapPoint>({ required: true })
defineProps<{ sceneId: string; attempts?: DiscoveryAttempt[]; busy: boolean; runtime: boolean }>()
const emit = defineEmits<{ command: [MapCommand] }>()
</script>
<template>
  <details>
    <summary>{{ controlText('authoringFlow.hiddenInteractionDiscoveryMethod') }}</summary>
    <p>{{ controlText('authoringFlow.discoveryAndUseChecksAreSeparateLegacyHidden') }}</p>
    <button
      v-if="!point.discovery"
      :disabled="busy"
      @click="point.discovery = { method: 'gm', range: 20, skill: 'perception', dc: 10 }"
    >
      {{ controlText('authoringFlow.configureDiscoveryMethod') }}</button
    ><template v-else
      ><label
        >{{ controlText('domain.method') }}<select v-model="point.discovery.method">
          <option value="gm">{{ controlText('authoringFlow.gmRevelation') }}</option>
          <option value="proximity">{{ controlText('authoringFlow.proximityDiscoveryCheck') }}</option>
          <option value="linked">{{ controlText('authoringFlow.revealedByLinkedMechanism') }}</option>
        </select></label
      ><template v-if="point.discovery.method === 'proximity'"
        ><label
          >{{ controlText('interactionField.rangeFt') }}<input
            v-model.number="point.discovery.range"
            type="number"
            min="0"
            max="300" /></label
        ><label
          >{{ controlText('interactionField.discoverySkill') }}<select v-model="point.discovery.skill">
            <option v-for="(s, k) in SKILLS" :key="k" :value="k">{{ skillDisplayName(k) }}</option>
          </select></label
        ><label
          >{{ controlText('interactionField.discoveryDc') }}<input
            v-model.number="point.discovery.dc"
            type="number"
            min="1"
            max="100" /></label></template></template
    ><template v-if="runtime"
      ><p>{{ controlText('progressSummary.recordedAttemptsTheGmMayExplicitlyReset', {p0:(attempts?.filter((x) => x.pointId === point.id).length ?? 0)}) }}</p>
      <button
        :disabled="busy"
        @click="emit('command', { type: 'discovery-reset', sceneId, pointId: point.id })"
      >
        {{ controlText('authoringFlow.gmResetsDiscoveryAttemptsForThisPoint') }}
      </button></template
    >
  </details>
</template>
