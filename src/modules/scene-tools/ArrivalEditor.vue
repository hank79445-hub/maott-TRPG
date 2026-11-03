<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { computed } from 'vue'
import type { MapScene, MapCommand } from '../../core/map-types'
import type { NpcProfile } from '../../core/ai-types'
const scene = defineModel<MapScene>({ required: true }),
  props = defineProps<{ npcs: NpcProfile[]; busy: boolean; runtime: boolean }>(),
  emit = defineEmits<{ command: [MapCommand] }>()
const available = computed(() =>
  props.npcs.filter((n) => n.sceneId === scene.value.id && n.initiallyAbsent),
)
function add() {
  scene.value.arrivalGroups ??= []
  scene.value.arrivalGroups.push({
    id: crypto.randomUUID(),
    name: '新的出场组',
    npcIds: [],
    battleMode: 'none',
    intro: '',
  })
}
</script>
<template>
  <details class="room-card">
    <summary>{{ controlText('authoringFlow.triggeredNpcAppearanceConfiguration') }}</summary>
    <p class="muted">
      {{ controlText('authoringFlow.enableInitiallyAwaitingAppearanceAndSetFixedPositions') }}
    </p>
    <fieldset v-for="g in scene.arrivalGroups ?? []" :key="g.id">
      <legend>{{ localizedEntryName(g) }} · {{ g.status ?? 'waiting' }}</legend>
      <label>{{ controlText('interactionField.appearanceGroupName') }}<input v-model="g.name" maxlength="2000" /></label
      ><label
        >{{ controlText('interactionField.combatModeAfterAppearance') }}<select v-model="g.battleMode">
          <option value="none">{{ controlText('authoringFlow.appearOnly') }}</option>
          <option value="start">{{ controlText('authoringFlow.requestCombatStart') }}</option>
          <option value="reinforce">{{ controlText('authoringFlow.requestJoiningCurrentCombat') }}</option>
        </select></label
      ><label v-for="n in available" :key="n.id" class="check"
        ><input
          v-model="g.npcIds"
          type="checkbox"
          :value="n.id"
          :disabled="
            busy ||
            g.status === 'spawned' ||
            (scene.arrivalGroups?.some(
              (other) => other.id !== g.id && other.npcIds.includes(n.id),
            ) ??
              false)
          "
        />{{ localizedEntryName(n) }} · ({{ n.position.x }},{{ n.position.y }})</label
      ><label>{{ controlText('interactionField.fixedAppearanceBroadcast') }}<textarea v-model="g.intro" rows="2" maxlength="2000" /></label>
      <label>{{ controlText('interactionField.manualAppearanceNotesGmOnly') }}<textarea v-model="g.manualReason" maxlength="2000" rows="2" :disabled="busy" /></label>
      <p v-if="g.reason" role="status">{{ controlText('progressSummary.pending', {p0:(g.reason)}) }}</p>
      <div class="room-row">
        <button
          v-if="runtime"
          :disabled="busy || !g.npcIds.length || g.status === 'spawned'"
          @click="emit('command', { type: 'arrival-trigger', sceneId: scene.id, groupId: g.id })"
        >
          {{ g.status === 'pending' ? controlText('expressionFour.retryThisGroupSAppearance') : controlText('expressionFour.makeThisGroupAppear') }}</button
        ><button
          class="subtle"
          :disabled="
            busy ||
            g.status === 'spawned' ||
            scene.points.some((p) => p.arrivalGroupIds?.includes(g.id)||p.failureArrivalGroupIds?.includes(g.id)) || scene.pointLinks?.some(l=>l.arrivalGroupIds?.includes(g.id))
          "
          @click="scene.arrivalGroups = scene.arrivalGroups?.filter((x) => x.id !== g.id)"
        >
          {{ controlText('authoringFlow.deleteUnusedAppearanceGroup') }}
        </button>
      </div>
    </fieldset>
    <button :disabled="busy || (scene.arrivalGroups?.length ?? 0) >= 50" @click="add">
      {{ controlText('authoringFlow.addAppearanceGroup') }}
    </button>
  </details>
</template>
<style scoped>
label {
  display: grid;
  gap: 6px;
  margin: 8px 0;
}
.check {
  display: flex;
  align-items: center;
}
input,
select,
textarea {
  box-sizing: border-box;
  width: 100%;
}
.check input {
  width: auto;
}
fieldset {
  min-width: 0;
  margin: 10px 0;
}
summary {
  cursor: pointer;
}
</style>
