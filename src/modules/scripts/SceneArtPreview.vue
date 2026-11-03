<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { SceneArtDocument } from '../../core/scene-art-projection'
import type { MapAsset } from '../../core/map-types'
import type { ArtTransform } from '../../persistence/scene-art-schema'
const props = defineProps<{
  document: SceneArtDocument
  asset?: MapAsset
  transform?: ArtTransform
}>()
const url = ref(''),
  zoom = ref(100),
  opacity = ref(0.65),
  pure = ref(false),
  objectsLayer = ref(true),
  wallsLayer = ref(true),
  pane = ref<HTMLElement | null>(null)
watch(
  () => props.asset?.blob,
  (blob) => {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = blob ? URL.createObjectURL(blob) : ''
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value)
})
const outline = computed(() => {
  const floor = new Set(props.document.geometry.floor),
    paths: string[] = []
  for (const k of floor) {
    const [x, y] = k.split(',').map(Number)
    if (!floor.has(`${x! - 1},${y}`)) paths.push(`M${x},${y}v1`)
    if (!floor.has(`${x! + 1},${y}`)) paths.push(`M${x! + 1},${y}v1`)
    if (!floor.has(`${x},${y! - 1}`)) paths.push(`M${x},${y}h1`)
    if (!floor.has(`${x},${y! + 1}`)) paths.push(`M${x},${y! + 1}h1`)
  }
  return paths.join(' ')
})
const rotation = computed(() =>
  props.transform
    ? `rotate(${props.transform.rotation} ${props.transform.x + props.transform.width / 2} ${props.transform.y + props.transform.height / 2})`
    : '',
)
let drag: { x: number; y: number; left: number; top: number } | null = null
function down(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !pane.value) return
  drag = { x: e.clientX, y: e.clientY, left: pane.value.scrollLeft, top: pane.value.scrollTop }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (drag && pane.value) {
    pane.value.scrollLeft = drag.left - (e.clientX - drag.x)
    pane.value.scrollTop = drag.top - (e.clientY - drag.y)
  }
}
</script>
<template>
  <div class="art-view-controls">
    <label><input v-model="pure" type="checkbox" />{{ controlText('remainingField.viewBackgroundOnly') }}</label>
    <label v-if="!pure"><input v-model="objectsLayer" type="checkbox" />{{ controlText('remainingField.objectFootprint') }}</label>
    <label v-if="!pure"><input v-model="wallsLayer" type="checkbox" />{{ controlText('remainingField.wallsDoorsAndStructure') }}</label>
    <label>{{ controlText('remainingField.previewZoom') }}<input v-model.number="zoom" type="range" min="50" max="250" />{{ zoom }}%</label
    ><label
      >{{ controlText('remainingField.structuralLineOpacity') }}<input
        v-model.number="opacity"
        type="range"
        min="0"
        max="1"
        step="0.05" /></label
    ><button class="secondary" @click="zoom = 100">{{ controlText('authoringFlow.resetView') }}</button>
  </div>
  <div
    ref="pane"
    class="art-viewport"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="drag = null"
    @pointercancel="drag = null"
  >
    <svg
      role="img"
      :aria-label="controlText('remainingField.sceneStructureOverlayPreview')"
      :viewBox="`0 0 ${document.canvas.columns} ${document.canvas.rows}`"
      :style="{ width: zoom + '%' }"
    >
      <rect
        x="0"
        y="0"
        :width="document.canvas.columns"
        :height="document.canvas.rows"
        fill="#283137"
      />
      <image
        v-if="url && transform"
        :href="url"
        :x="transform.x"
        :y="transform.y"
        :width="transform.width"
        :height="transform.height"
        preserveAspectRatio="none"
        :transform="rotation"
      />
      <g
        v-if="!pure && objectsLayer"
        :opacity="opacity"
        fill="#c49b63"
        fill-opacity="0.25"
        stroke="#e5ba79"
        stroke-width="0.06"
      >
        <g v-for="(object, i) in document.geometry.objects" :key="i">
          <title>{{ object.label }}：{{ object.description }}</title>
          <rect :x="object.x" :y="object.y" :width="object.width" :height="object.height" />
          <line
            :x1="object.x + object.width / 2"
            :y1="object.y + object.height / 2"
            :x2="object.x + object.width / 2 + Math.sin((object.rotation * Math.PI) / 180) * 0.4"
            :y2="object.y + object.height / 2 - Math.cos((object.rotation * Math.PI) / 180) * 0.4"
          />
        </g>
      </g>
      <g
        v-if="!pure && wallsLayer"
        :opacity="opacity"
        fill="none"
        stroke="#55dbb5"
        stroke-width="0.08"
      >
        <path :d="outline" />
        <line
          v-for="(w, i) in document.geometry.walls"
          :key="i"
          :x1="w.a.x"
          :y1="w.a.y"
          :x2="w.b.x"
          :y2="w.b.y"
          :stroke="w.kind === 'door' ? '#ffb45f' : '#55dbb5'"
          :stroke-dasharray="w.open ? '0.2 0.15' : undefined"
        />
      </g>
    </svg>
  </div>
</template>
<style scoped>
.art-view-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
.art-view-controls label {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  min-height: 44px;
}
.art-view-controls input[type='range'] {
  width: 100px;
}
.art-viewport {
  max-height: 460px;
  overflow: auto;
  background: #283137;
  border-radius: 10px;
  margin: 12px 0;
  cursor: grab;
}
.art-viewport svg {
  display: block;
  min-width: 200px;
  max-width: none;
  user-select: none;
  touch-action: pan-x pan-y;
}
</style>
