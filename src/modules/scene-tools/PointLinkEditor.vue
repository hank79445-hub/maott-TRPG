<script setup lang="ts">
import {uiLabel} from '../ui-label'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import type { MapScene, MapCommand } from '../../core/map-types'
const scene = defineModel<MapScene>({ required: true })
defineProps<{ busy: boolean; runtime: boolean }>()
const emit = defineEmits<{ command: [MapCommand]; save: [] }>()
const operations = {
  open: '打开门',
  close: '关闭门',
  unlock: '解锁门',
  reveal: '揭示互动点',
  enable: '启用互动点',
}
function add() {
  if (!scene.value.points.length) return
  scene.value.pointLinks ??= []
  scene.value.pointLinks.push({
    id: crypto.randomUUID(),
    name: '关联组 ' + (scene.value.pointLinks.length + 1),
    color: '#417d9b',
    sourcePointId: scene.value.points[0]!.id,
    outcome: 'success',
    effects: [],
  })
}
</script>
<template>
  <details class="gm-scene-section">
    <summary>{{ controlText('authoringFlow.mechanismLinkGroupsAndColors') }}</summary>
    <p>{{ controlText('authoringFlow.sameSceneLinksValidateAsAGroupAnd') }}</p>
    <fieldset v-for="(g, i) in scene.pointLinks ?? []" :key="g.id">
      <legend>{{ i + 1 }} · {{ localizedEntryName(g) }}</legend>
      <label>{{ controlText('remainingField.groupName') }}<input v-model="g.name" maxlength="120" :disabled="busy" /></label
      ><label>{{ controlText('remainingField.groupColor') }}<input v-model="g.color" type="color" :disabled="busy" /></label>
      <label
        >{{ controlText('remainingField.sourceInteraction') }}<MapFieldPicker kind="point"><select v-model="g.sourcePointId">
          <option v-for="p in scene.points" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
        </select></MapFieldPicker></label
      ><label
        >{{ controlText('remainingField.triggerResult') }}<select v-model="g.outcome">
          <option value="success">{{ controlText('authoringFlow.confirmSuccess') }}</option>
          <option value="failure">{{ controlText('authoringFlow.confirmFailure') }}</option>
        </select></label
      >
      <div v-for="(e, j) in g.effects" :key="j">
        <label
          >{{ controlText('controls.target') }}<MapFieldPicker kind="point"><select v-model="e.pointId">
            <option
              v-for="p in scene.points.filter((p) => p.id !== g.sourcePointId)"
              :key="p.id"
              :value="p.id"
            >
              {{ localizedEntryName(p) }}
            </option>
          </select></MapFieldPicker></label
        ><label
          >{{ controlText('controls.effect') }}<select v-model="e.operation">
            <option v-for="(name, key) in operations" :key="key" :value="key">{{ uiLabel(name) }}</option>
          </select></label
        ><button :disabled="busy" @click="g.effects.splice(j, 1)">
          {{ controlText('authoringFlow.removeThisEffect') }}
        </button>
      </div>
      <button
        :disabled="busy || g.effects.length >= 50"
        @click="g.effects.push({ pointId: '', operation: 'reveal' })"
      >
        {{ controlText('authoringFlow.addEffect') }}
      </button>
      <fieldset v-if="scene.arrivalGroups?.length">
        <legend>{{ controlText('authoringFlow.alsoTriggerAppearanceGroup') }}</legend>
        <label v-for="a in scene.arrivalGroups" :key="a.id"
          ><input
            type="checkbox"
            :checked="g.arrivalGroupIds?.includes(a.id)"
            @change="
              g.arrivalGroupIds = ($event.target as HTMLInputElement).checked
                ? [...(g.arrivalGroupIds ?? []), a.id]
                : (g.arrivalGroupIds ?? []).filter((id) => id !== a.id)
            "
          />{{ localizedEntryName(a) }}</label
        >
      </fieldset>
      <button :disabled="busy" @click="scene.pointLinks?.splice(i, 1)">{{ controlText('authoringFlow.deleteLinkGroup') }}</button>
    </fieldset>
    <button
      :disabled="busy || !scene.points.length || (scene.pointLinks?.length ?? 0) >= 100"
      @click="add"
    >
      {{ controlText('authoringFlow.addLinkGroup') }}</button
    ><button :disabled="busy" @click="emit('save')">{{ controlText('authoringFlow.saveLinkConfiguration') }}</button>
    <template v-if="runtime"
      ><div v-for="r in scene.linkRuns ?? []" :key="r.id">
        <p>
          {{ localizedEntryName(scene.pointLinks?.find((g) => g.id === r.groupId)) ?? controlText('expressionFour.linkGroupDeleted') }} ·
          {{ r.reason }}
        </p>
        <button
          v-if="r.status === 'pending'"
          :disabled="busy"
          @click="emit('command', { type: 'point-link-retry', sceneId: scene.id, runId: r.id })"
        >
          {{ controlText('authoringFlow.retryThisLinkDoNotRerunMechanism') }}
        </button>
      </div></template
    >
  </details>
</template>
