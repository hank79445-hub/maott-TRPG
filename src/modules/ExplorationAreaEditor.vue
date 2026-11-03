<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, h, onBeforeUnmount } from 'vue'
import { useMapSelection } from './map-selection/selection'
import type { Position } from '../core/map-types'
import type { MapScene } from '../core/map-types'
import type { ExplorationArea } from '../core/enclosed-exploration'
const props = defineProps<{ scene: MapScene }>()
const selection = useMapSelection()
let ownSession: number | undefined
const areas = defineModel<ExplorationArea[]>({ default: () => [] })
const chosen = ref(''),
  name = ref('封闭房间'),
  x = ref(0),
  y = ref(0),
  width = ref(3),
  height = ref(3)
const current = computed(() => areas.value.find((a) => a.id === chosen.value)),
  doors = computed(() => props.scene.points.filter((p) => p.kind === 'door' && p.enabled))
const issue = computed(() =>
  !Number.isInteger(x.value) ||
  !Number.isInteger(y.value) ||
  !Number.isInteger(width.value) ||
  !Number.isInteger(height.value) ||
  x.value < 0 ||
  y.value < 0 ||
  width.value < 1 ||
  height.value < 1 ||
  x.value + width.value > props.scene.grid.columns ||
  y.value + height.value > props.scene.grid.rows
    ? '选区须为地图内的整数矩形'
    : '',
)
function cells() {
  return Array.from({ length: height.value }, (_, j) =>
    Array.from({ length: width.value }, (_, i) => `${x.value + i},${y.value + j}`),
  ).flat()
}
function add() {
  if (issue.value || areas.value.length >= 100) return
  const a: ExplorationArea = {
    id: crypto.randomUUID(),
    name: name.value,
    cells: cells(),
    doorIds: [],
    initiallyRevealed: false,
    revealOnOpen: true,
    manualOnly: false,
  }
  areas.value = [...areas.value, a]
  chosen.value = a.id
}
function removeArea(){areas.value=areas.value.filter(a=>a.id!==chosen.value);chosen.value=''}
function choose() {
  if (!current.value) return
  const points = current.value.cells.map((c) => c.split(',').map(Number))
  x.value = Math.min(...points.map((p) => p[0]!))
  y.value = Math.min(...points.map((p) => p[1]!))
  width.value = Math.max(...points.map((p) => p[0]!)) - x.value + 1
  height.value = Math.max(...points.map((p) => p[1]!)) - y.value + 1
}
const path = (a: ExplorationArea) =>
  a.cells
    .map((c) => {
      const [x, y] = c.split(',').map(Number)
      return `M${x},${y}h1v1h-1z`
    })
    .join('')
function pickRectangle() {
  if (!selection) return
  const a = ref<Position>(),
    b = ref<Position>()
  const bounds = () =>
    a.value && b.value
      ? {
          x: Math.min(a.value.x, b.value.x),
          y: Math.min(a.value.y, b.value.y),
          w: Math.abs(a.value.x - b.value.x) + 1,
          h: Math.abs(a.value.y - b.value.y) + 1,
        }
      : undefined
  if (
    selection.start({
      kind: 'position',
      sceneId: props.scene.id,
      label: '封闭区域：在地图点击两个对角格',
      point: () => b.value ?? a.value,
      onPoint: (p) => {
        if (!a.value || b.value) {
          a.value = p
          b.value = undefined
        } else b.value = p
      },
      canConfirm: () => !!bounds(),
      panel: () =>
        h(
          'p',
          a.value
            ? '再选对角格；第三次点击可重新开始。仅填写草稿，不移动角色。'
            : '选择首角格，再选对角格；确认后仍需保存区域草稿。',
        ),
      overlay: () => {
        const r = bounds(),
          size = selection.activeMap.value?.scene()?.grid.cellPixels ?? 64
        return r
          ? h('rect', {
              x: r.x * size,
              y: r.y * size,
              width: r.w * size,
              height: r.h * size,
              fill: '#56a88655',
              stroke: '#388267',
              'stroke-width': 2,
            })
          : undefined
      },
      onConfirm: () => {
        const r = bounds()
        if (r) {
          x.value = r.x
          y.value = r.y
          width.value = r.w
          height.value = r.h
        }
        ownSession = undefined
      },
      onCancel: () => {
        ownSession = undefined
      },
    })
  )
    ownSession = selection.current.value?.id
}
onBeforeUnmount(() => selection?.cancelSession(ownSession))
</script>
<template>
  <section class="area-editor">
    <h4>{{ controlText('quantity.roomAreas', {p0:(areas.length)}) }}</h4>
    <p>{{ controlText('workspace.outdoorTerrainIsPublicByDefaultMarkOnly') }}</p>
    <svg
      class="area-preview"
      :viewBox="`0 0 ${scene.grid.columns} ${scene.grid.rows}`"
      role="img"
      :aria-label="controlText('field.enclosedAreaDiagramPreview')"
    >
      <rect width="100%" height="100%" fill="var(--surface, #e8eeeb)" />
      <path
        v-for="a in areas"
        :key="a.id"
        :d="path(a)"
        :fill="a.initiallyRevealed ? '#7abca3' : '#455b6b'"
        :stroke="a.id === chosen ? '#de9e32' : '#abb8bc'"
        stroke-width=".08"
      >
        <title>{{ controlText('quantity.cellCount', {p0:(localizedEntryName(a)),p1:(a.cells.length)}) }}</title>
      </path>
      <g fill="#cf9954">
        <rect v-for="p in doors" :key="p.id" :x="p.x + 0.15" :y="p.y + 0.15" width=".7" height=".7">
          <title>{{ localizedEntryName(p) }}</title>
        </rect>
      </g>
    </svg>
    <label
      >{{ controlText('field.chooseArea') }}<select v-model="chosen" @change="choose">
        <option value="">{{ controlText('operations.addArea') }}</option>
        <option v-for="a in areas" :key="a.id" :value="a.id">
          {{ controlText('quantity.cellCount', {p0:(localizedEntryName(a)),p1:(a.cells.length)}) }}</option>
      </select></label
    >
    <button
      v-if="selection?.maps.value.some((m) => m.scene()?.id === scene.id)"
      data-map-controls
      :disabled="!!selection.current.value"
      @click="pickRectangle"
    >
      {{ controlText('operations.selectTwoCornersOnTheMap') }}
    </button>
    <div class="area-coordinates">
      <label
        >X<input v-model.number="x" type="number" min="0" :max="scene.grid.columns - 1" /></label
      ><label>Y<input v-model.number="y" type="number" min="0" :max="scene.grid.rows - 1" /></label
      ><label
        >{{ controlText('domain.width') }}<input v-model.number="width" type="number" min="1" :max="scene.grid.columns" /></label
      ><label
        >{{ controlText('domain.height') }}<input v-model.number="height" type="number" min="1" :max="scene.grid.rows"
      /></label>
    </div>
    <p v-if="issue" role="alert">{{ issue }}</p>
    <template v-if="current">
      <label>{{ controlText('field.internalGmName') }}<input v-model="current.name" maxlength="120" /></label>
      <div class="area-actions">
        <button :disabled="!!issue" @click="current.cells = cells()">{{ controlText('operations.replaceAreaWithSelection') }}</button
        ><button
          @click="removeArea"
        >
          {{ controlText('operations.removeDraftArea') }}
        </button>
      </div>
      <label
        >{{ controlText('field.boundaryDoorsMultipleSelection') }}<select v-model="current.doorIds" multiple size="3">
          <option v-for="p in doors" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
        </select></label
      >
      <label class="check"
        ><input v-model="current.initiallyRevealed" type="checkbox" />{{ controlText('field.initiallyPublic') }}</label
      >
      <label class="check"
        ><input
          v-model="current.revealOnOpen"
          type="checkbox"
        />{{ controlText('field.revealWhenAnOpeningDoorIsSeenFrom') }}</label
      >
      <label class="check"
        ><input
          v-model="current.manualOnly"
          type="checkbox"
        />{{ controlText('field.gmRevelationOnlyDisablesAutomaticEntryDoorOpening') }}</label
      >
      <p v-if="!current.doorIds.length && !current.initiallyRevealed">
        {{ controlText('operations.noBoundaryDoorLinkedEnterThroughAValid') }}
      </p>
    </template>
    <template v-else
      ><label>{{ controlText('field.newAreaName') }}<input v-model="name" maxlength="120" /></label
      ><button :disabled="!!issue || areas.length >= 100" @click="add">
        {{ controlText('operations.addRectangularAreaToDraft') }}
      </button></template
    >
    <p>{{ controlText('operations.theDraftIsSavedWithSaveExplorationAnd') }}</p>
  </section>
</template>
<style scoped>
.area-editor {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.area-editor h4,
.area-editor p {
  margin: 0;
}
.area-editor p {
  font-size: 12px;
  line-height: 1.5;
}
.area-editor label {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.area-editor .check {
  display: flex;
  align-items: center;
  gap: 6px;
}
.area-preview {
  width: 100%;
  max-height: 180px;
  border: 1px solid var(--button-border);
  border-radius: 6px;
}
.area-coordinates {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}
.area-editor input,
.area-editor select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.area-editor input[type='checkbox'] {
  width: auto;
}
.area-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.area-editor button {
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  min-height: 36px;
}
@media (pointer: coarse) {
  .area-editor button {
    min-height: 44px;
  }
}
</style>
