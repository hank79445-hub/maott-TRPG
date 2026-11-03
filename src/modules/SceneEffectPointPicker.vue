<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import MapPositionPicker from './map-selection/MapPositionPicker.vue'
import type {PreviewGeometry} from './map-selection/geometry-preview'
import {geometryPreviewCells} from './map-selection/geometry-preview'
import type {SceneGeometry} from '../persistence/scene-effects-schema'
import type { PublicScene } from '../online/protocol'
const props = defineProps<{
  preview?: SceneGeometry | (Omit<SceneGeometry,'shape'>&{shape:'cone'})
  disabled?: boolean
  previewAt?:(index:number,point:{x:number;y:number;height:number})=>PreviewGeometry|undefined
  color?: string
  scene: PublicScene
  points: { x: number; y: number; height: number }[]
}>()
const emit = defineEmits<{
  select: [index: number, point: { x: number; y: number; height: number }]
}>()
const selected = ref(0)
const previewCells=computed(()=>props.preview?geometryPreviewCells(props.preview,props.scene.grid):[])
watch(
  () => props.points.length,
  (n) => {
    if (selected.value >= n) selected.value = 0
  },
)
const point = computed(() => props.points[selected.value] ?? props.points[0]!)
function choose(x: number, y: number) {
  emit('select', selected.value, {
    x: Math.max(0, Math.min(props.scene.grid.columns - 1, x)),
    y: Math.max(0, Math.min(props.scene.grid.rows - 1, y)),
    height: point.value.height,
  })
}
function click(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement,
    matrix = svg.getScreenCTM()
  if (!matrix) return
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  if (p.x >= 0 && p.y >= 0 && p.x < props.scene.grid.columns && p.y < props.scene.grid.rows)
    choose(Math.floor(p.x), Math.floor(p.y))
}
function keyboard(event: KeyboardEvent) {
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const d = delta[event.key]
  if (!d) return
  event.preventDefault()
  choose(point.value.x + d[0], point.value.y + d[1])
}
</script>
<template>
<div class="effect-map-chooser"><label v-if="points.length>1">{{ controlText('remainingField.controlPoint') }}<select v-model.number="selected"><option v-for="(_,i) in points" :key="i" :value="i">{{ controlText('progressSummary.point', {p0:(i+1)}) }}</option></select></label>
    <MapPositionPicker v-if="point" :scene-id="scene.id" :x="point.x" :y="point.y" :height="point.height" :preview="preview" :preview-at="previewAt?p=>previewAt!(selected,p):undefined" :color="color" :disabled="disabled" @select="p=>emit('select',selected,p)" />
</div>
  <details class="effect-point-picker">
    <summary>{{ controlText('authoringFlow.pickAPointInTheMapDiagram') }}</summary>

    <label v-if="points.length > 1"
      >{{ controlText('remainingField.currentLightPoint') }}<select v-model.number="selected">
        <option v-for="(_, i) in points" :key="i" :value="i">{{ controlText('progressSummary.lightPoint', {p0:(i + 1)}) }}</option>
      </select></label
    >
    <svg
      :viewBox="`0 0 ${scene.grid.columns} ${scene.grid.rows}`"
      tabindex="0"
      role="application"
      :aria-label="controlText('remainingField.areaDestinationSelectionMap')"
      aria-describedby="effect-picker-help"
      @click="click"
      @keydown="keyboard"
    >
      <rect width="100%" height="100%" fill="var(--surface)" />
      <polyline v-if="preview?.shape==='wall'" :aria-label="controlText('remainingField.continuousWindWallPreview')" :points="preview.points?.map(p=>`${p.x},${p.y}`).join(' ')" :stroke="color??'#638e9b'" :stroke-width="Math.max(.12,preview.width/scene.grid.feet)" fill="none" pointer-events="none" />
      <rect v-for="p in previewCells" :key="`preview-${p.x}-${p.y}`" :x="p.x" :y="p.y" width="1" height="1" :fill="color??'#98683e'" fill-opacity=".3" stroke="currentColor" stroke-width=".025" pointer-events="none" />
      <line
        v-for="w in scene.walls ?? []"
        :key="w.id"
        :x1="w.a.x"
        :y1="w.a.y"
        :x2="w.b.x"
        :y2="w.b.y"
        stroke="currentColor"
        :stroke-width="0.12"
        :stroke-dasharray="w.state === 'open' ? '.25 .25' : undefined"
      />
      <g v-for="t in scene.tokens" :key="t.id">
        <circle :cx="t.x + t.span / 2" :cy="t.y + t.span / 2" r=".3" fill="currentColor">
          <title>{{ localizedEntryName(t) }}</title>
        </circle>
      </g>
      <g v-for="(p, i) in points" :key="i">
        <circle
          :cx="p.x + 0.5"
          :cy="p.y + 0.5"
          r=".5"
          fill="var(--accent)"
          :fill-opacity="i === selected ? 1 : 0.45"
          stroke="currentColor"
          :stroke-width="0.1"
        />
        <text
          :x="p.x + 0.5"
          :y="p.y + 0.7"
          text-anchor="middle"
          fill="var(--surface)"
          font-size=".65"
        >
          {{ i + 1 }}
        </text>
      </g>
    </svg>
    <p id="effect-picker-help" class="muted">
      {{ controlText('authoringFlow.clickToSelectAPointArrowKeysMove') }}
    </p>
    <output aria-live="polite"
      >{{ controlText('progressSummary.currentPointHeight', {p0:(selected + 1),p1:(point.x),p2:(point.y),p3:(point.height),p4:(controlText('game.feet'))}) }}</output
    >
  </details>
</template>
<style scoped>
.effect-point-picker {
  min-width: 0;
  margin: 0.5rem 0;
}
.effect-point-picker svg {
  display: block;
  width: 100%;
  height: 180px;
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: crosshair;
  touch-action: manipulation;
}
.effect-point-picker svg:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.effect-point-picker p,
.effect-point-picker output {
  font-size: 12px;
  line-height: 1.5;
}
</style>
