<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import type { RoomView, RoomCommand } from '../online/protocol'
import { fogObserverId } from '../core/fog'
import { clone } from '../core/engine'
import { validateExploration, areaKnown, type ExplorationArea } from '../core/enclosed-exploration'
import ExplorationAreaEditor from './ExplorationAreaEditor.vue'
const props = defineProps<{ view: RoomView; busy: boolean; sceneId?: string }>(),
  emit = defineEmits<{ command: [RoomCommand] }>()
const selected = ref(''),
  observer = ref('*'),
  enabled = ref(false),
  shared = ref(false),
  range = ref<number | null>(null),
  confirmed = ref(false),
  x = ref(0),
  y = ref(0),
  width = ref(1),
  height = ref(1)
const mode = ref<'legacy' | 'enclosed'>('legacy'),
  areas = ref<ExplorationArea[]>([]),
  level1 = ref(0.35),
  level2 = ref(0.75),
  migrationConfirmed = ref(false)
const scenes = computed(() => props.view.world?.adventures[0]?.scenes ?? []),
  scene = computed(() => scenes.value.find((s) => s.id === selected.value))
watch(
  () => props.sceneId,
  (id) => {
    if (id) selected.value = id
  },
  { immediate: true },
)
watch(
  scenes,
  (rows) => {
    if (!rows.some((s) => s.id === selected.value)) selected.value = rows[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => scene.value?.id + '|' + JSON.stringify(scene.value?.fog),
  () => {
    enabled.value = scene.value?.fog?.enabled ?? false
    shared.value = scene.value?.fog?.shared ?? false
    range.value = scene.value?.fog?.rangeFeet ?? null
    confirmed.value = false
    observer.value = '*'
    mode.value = scene.value?.fog?.mode ?? 'legacy'
    areas.value = clone(scene.value?.fog?.areas ?? [])
    level1.value = scene.value?.fog?.shading?.level1 ?? 0.35
    level2.value = scene.value?.fog?.shading?.level2 ?? 0.75
    migrationConfirmed.value = false
  },
  { immediate: true },
)
const observers = computed(
  () =>
    scene.value?.tokens
      .filter((t) => t.characterId || t.actorId)
      .map((t) => ({ id: fogObserverId(t), name: t.name })) ?? [],
)
const migrating = computed(() => mode.value === 'enclosed' && scene.value?.fog?.mode !== 'enclosed')
const draftIssue = computed(() => {
  if (!scene.value || mode.value !== 'enclosed') return ''
  if (!(level1.value > 0 && level1.value < level2.value && level2.value < 1))
    return '不透明度必须满足 0＜1级＜2级＜1'
  try {
    validateExploration({
      ...scene.value,
      fog: {
        mode: 'enclosed',
        enabled: enabled.value,
        shared: shared.value,
        rangeFeet: range.value || 60,
        initial: [],
        areas: areas.value,
      },
    })
    return ''
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
})
function save() {
  if (scene.value && !draftIssue.value && (!migrating.value || migrationConfirmed.value))
    emit('command', {
      kind: 'fog',
      command: {
        operation: 'configure',
        sceneId: scene.value.id,
        confirmMigration: migrating.value ? true : undefined,
        policy: {
          mode: mode.value,
          areas: clone(areas.value),
          shading: { level1: level1.value, level2: level2.value },
          enabled: enabled.value,
          shared: shared.value,
          rangeFeet: range.value || (mode.value === 'enclosed' ? 60 : null),
          initial: scene.value.fog?.initial ?? [],
        },
      },
    })
}
function areaState(areaId: string, revealed: boolean) {
  if (!scene.value || !confirmed.value) return
  emit('command', {
    kind: 'fog',
    command: {
      operation: 'area',
      sceneId: scene.value.id,
      areaId,
      observerId: observer.value,
      revealed,
      confirmed: true,
    },
  })
  confirmed.value = false
}
function known(area: ExplorationArea) {
  const a = props.view.world?.adventures[0]
  return a && scene.value && areaKnown(a, scene.value, area, [observer.value])
}
const shadeReport = computed(() => {
  const f = props.view.fogPreview
  if (f?.sceneId !== scene.value?.id) return ''
  const id = scene.value?.tokens.find((t) => fogObserverId(t) === observer.value)?.id
  return Object.entries(
    (f?.shadingViews?.find((v) => v.observerId === id) ?? f?.shading)?.reasons ?? {},
  )
    .map(([reason, count]) => `${reason}${count}格`)
    .join('；')
})
function manual(operation: 'reveal' | 'hide' | 'reset') {
  if (!scene.value || !confirmed.value) return
  const cells: string[] = []
  for (let j = y.value; j < Math.min(scene.value.grid.rows, y.value + height.value); j++)
    for (let i = x.value; i < Math.min(scene.value.grid.columns, x.value + width.value); i++)
      cells.push(i + ',' + j)
  emit('command', {
    kind: 'fog',
    command: {
      operation,
      sceneId: scene.value.id,
      observerId: observer.value,
      cells,
      confirmed: true,
    },
  })
  confirmed.value = false
}
</script>
<template>
  <details v-if="view.self.role === 'gm'" class="rail-card fog-tools">
    <summary>{{ controlText('mapExperience.fogTools') }}</summary>
    <fieldset :disabled="busy">
      <label
        >{{ controlText('controls.scene') }}<select v-model="selected">
          <option v-for="s in scenes" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
        </select></label
      ><label
        >{{ controlText('mapExperience.exploreMode') }}<select v-model="mode">
          <option value="legacy">{{ controlText('mapExperience.legacyFog') }}</option>
          <option value="enclosed">{{ controlText('mapExperience.roomFog') }}</option>
        </select></label
      ><label class="check"
        ><input v-model="enabled" type="checkbox" />{{
          mode === 'enclosed'
            ? controlText('expressionOne.protectUnknownEnclosedAreasDisableToMakeAll')
            : controlText('expressionOne.enableAuthoritativeFogOriginalBackgroundIsGmOnly')
        }}</label
      ><label class="check"
        ><input v-model="shared" type="checkbox" />{{
          mode === 'enclosed' ? controlText('expressionOne.partySharedRoomExploration') : controlText('expressionOne.partySharedVision')
        }}</label
      ><label
        >{{
          mode === 'enclosed'
            ? controlText('expressionOne.displayRadiusRFtBlankDoesNotChange')
            : controlText('expressionOne.optionalDistanceCapFtBlankUsesRules')
        }}<input v-model.number="range" type="number" min="1" max="10000" /></label
      ><template v-if="mode === 'enclosed'"
        ><label
          >{{ controlText('mapExperience.levelOne') }} {{ level1.toFixed(2)
          }}<input v-model.number="level1" type="range" min=".05" max=".8" step=".05" /></label
        ><label
          >{{ controlText('mapExperience.levelTwo') }} {{ level2.toFixed(2)
          }}<input v-model.number="level2" type="range" min=".1" max=".95" step=".05" /></label
        ><p class="muted">{{ controlText('mapExperience.maskRanges') }}</p><ExplorationAreaEditor v-if="scene" v-model="areas" :scene="scene" />
        <p v-if="!areas.length">
          {{ controlText('mapExperience.noRooms') }}
        </p>
        <label v-if="migrating" class="check"
          ><input
            v-model="migrationConfirmed"
            type="checkbox"
          />{{ controlText('mapExperience.confirmRooms') }}</label
        ></template
      >
      <p v-if="draftIssue" role="alert">{{ draftIssue }}</p>
      <button :disabled="!!draftIssue || (migrating && !migrationConfirmed)" @click="save">
        {{ controlText('mapExperience.saveFog') }}</button
      ><label
        >{{ controlText('mapExperience.observer') }}<select v-model="observer">
          <option value="*">{{ controlText('mapExperience.publicTerrain') }}</option>
          <option v-for="o in observers" :key="o.id" :value="o.id">{{ localizedEntryName(o) }}</option>
        </select></label
      >
      <div class="fog-row">
        <button
          :disabled="observer === '*'"
          @click="
            emit('command', {
              kind: 'fog',
              command: { operation: 'preview', sceneId: selected, observerId: observer },
            })
          "
        >
          {{ controlText('mapExperience.previewCharacter') }}</button
        ><button
          @click="
            emit('command', {
              kind: 'fog',
              command: { operation: 'preview', sceneId: selected, observerId: null },
            })
          "
        >
          {{ controlText('mapExperience.exitPreview') }}
        </button>
      </div>
      <p v-if="mode === 'legacy'" class="muted">
        {{ controlText('mapExperience.legacyPreview') }}
      </p>
      <p v-else class="muted">
        {{ controlText('mapExperience.roomPreview') }}
      </p>
      <p v-if="shadeReport" class="muted">{{ controlText('mapExperience.currentMask') }}{{ shadeReport }}</p>
      <div v-if="mode === 'legacy'" class="fog-row">
        <label>X<input v-model.number="x" type="number" min="0" max="79" /></label
        ><label>Y<input v-model.number="y" type="number" min="0" max="79" /></label
        ><label>{{ controlText('domain.width') }}<input v-model.number="width" type="number" min="1" max="80" /></label
        ><label>{{ controlText('domain.height') }}<input v-model.number="height" type="number" min="1" max="80" /></label>
      </div>
      <label class="check"
        ><input v-model="confirmed" type="checkbox" />{{ controlText('mapExperience.confirmExplore') }}</label
      >
      <div v-if="mode === 'legacy'" class="fog-row">
        <button :disabled="!confirmed" @click="manual('reveal')">{{ controlText('mapExperience.revealTerrain') }}</button
        ><button :disabled="!confirmed" @click="manual('hide')">{{ controlText('domain.concealAgain') }}</button
        ><button :disabled="!confirmed" @click="manual('reset')">{{ controlText('mapExperience.resetExplore') }}</button>
      </div>
      <div v-else class="area-status">
        <div v-for="a in scene?.fog?.areas ?? []" :key="a.id">
          <span>{{ localizedEntryName(a) }} · {{ known(a) ? controlText('ai.alreadyPublic') : controlText('domain.unknown') }}{{ controlText('mapExperience.currentObservation') }}</span
          ><button :disabled="!confirmed" @click="areaState(a.id, true)">{{ controlText('domain.reveal') }}</button
          ><button :disabled="!confirmed" @click="areaState(a.id, false)">{{ controlText('domain.concealAgain') }}</button>
        </div>
        <button :disabled="!confirmed" @click="manual('reset')">{{ controlText('mapExperience.resetRooms') }}</button>
      </div>
    </fieldset>
  </details>
</template>
<style scoped>
.fog-tools fieldset {
  display: grid;
  gap: 10px;
  border: 0;
  margin: 0;
  padding: 10px 0;
}
.fog-tools label {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.fog-tools .check {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fog-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.fog-row label {
  flex: 1 1 50px;
}
.fog-tools input,
.fog-tools select {
  max-width: 100%;
  width: 100%;
  min-width: 0;
}
.fog-tools input[type='checkbox'] {
  width: auto;
}
.fog-tools button {
  min-height: 40px;
  background: var(--button-bg);
  border: 1px solid var(--button-border);
}
.fog-tools p {
  font-size: 12px;
  margin: 0;
}
.area-status,
.area-status > div {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.area-status {
  flex-direction: column;
}
.area-status span {
  flex: 1;
  min-width: 60px;
}
@media (pointer: coarse) {
  .fog-tools button {
    min-height: 44px;
  }
}
</style>
