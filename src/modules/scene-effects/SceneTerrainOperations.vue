<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { computed, ref } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { SceneEffectAction } from '../../persistence/scene-effects-schema'
const props = defineProps<{
  view: RoomView
  busy: boolean
  actorId: string
  point: { x: number; y: number; height: number }
}>()
const emit = defineEmits<{ action: [SceneEffectAction] }>()
const effects = computed(
    () =>
      props.view.scene?.sceneEffects?.regions.filter((e) =>
        ['entangle', 'web', 'spike-growth', 'plant-growth'].includes(e.spellId),
      ) ?? [],
  ),
  gm = computed(() => props.view.self.role === 'gm'),
  skill = ref<'perception' | 'survival'>('perception')
const routes = computed(() => props.view.scene?.sceneEffects?.routes ?? [])
const waiting = computed(() => props.view.scene?.sceneEffects?.waiting?.includes(props.actorId))
const note = '已确认实际角色、动作及场景区域'
</script>
<template>
  <details v-if="effects.length || routes.length || waiting" :open="waiting">
    <summary>{{ controlText('authoringFlow.terrainFollowUpResumeRoute') }}</summary>
    <p v-if="waiting" role="status">{{ controlText('authoringFlow.yourAreaConsequencesAwaitGmResolutionConfirmContinued') }}</p>
    <p class="muted">
      {{ controlText('authoringFlow.escapingCostsAnActionSearchingIdentifiesTheHazard') }}
    </p>
    <label v-if="effects.some((e) => e.spellId === 'spike-growth')"
      >{{ controlText('interactionField.searchSkill') }}<select v-model="skill">
        <option value="perception">{{ controlText('authoringFlow.wisdomPerception') }}</option>
        <option value="survival">{{ controlText('authoringFlow.wisdomSurvival') }}</option>
      </select></label
    >
    <div v-for="e in effects" :key="e.id" class="terrain-operation">
      <strong>{{ localizedEntryName(e) }}</strong>
      <button
        v-if="gm && e.spellId === 'plant-growth'"
        :disabled="busy"
        @click="
          emit('action', {
            operation: 'clear-growth',
            effectId: e.id,
            note: 'GM确认实际修剪／清除繁茂植物，并保留普通地形',
          })
        "
      >
        {{ controlText('authoringFlow.verifyOvergrowthHasBeenRemoved') }}
      </button>
      <button
        v-if="['web', 'entangle'].includes(e.spellId)"
        :disabled="busy || !actorId"
        @click="emit('action', { operation: 'escape', effectId: e.id, actorId, note })"
      >
        {{ controlText('authoringFlow.actionAthleticsToEscape') }}
      </button>
      <button
        v-if="gm && e.spellId === 'spike-growth'"
        :disabled="busy || !actorId"
        @click="
          emit('action', { operation: 'search-terrain', effectId: e.id, actorId, skill, note })
        "
      >
        {{ controlText('authoringFlow.actionSearchToIdentify') }}
      </button>
      <button
        v-if="gm && e.spellId === 'web'"
        :disabled="busy"
        @click="
          emit('action', {
            operation: 'burn-web',
            effectId: e.id,
            point,
            note: 'GM已核实真实火源接触所选5尺立方蛛网',
          })
        "
      >
        {{ controlText('authoringFlow.verifyIgnitionSourceAndIgniteSelected5Ft') }}
      </button>
    </div>
    <p v-for="r in routes" :key="r.id">
      <button
        :disabled="busy || !actorId || r.entityId !== actorId"
        @click="emit('action', { operation: 'resume-route', routeId: r.id, actorId, note })"
      >{{ controlText('progressSummary.resumeSavedRouteSegmentsRemaining', {p0:(r.steps)}) }}</button>
    </p>
  </details>
</template>
<style scoped>
.terrain-operation {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
}
button {
  background: var(--accent-soft, var(--surface));
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 7px;
  color: var(--ink);
  min-height: 36px;
}
</style>
