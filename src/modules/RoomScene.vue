<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import SceneEffectOverlay from './SceneEffectOverlay.vue'
import {provideMapSelection,mapSurfaceId} from './map-selection/selection'
import {useSelectionSurface} from './map-selection/useSelectionSurface'
import MapSelectionBar from './map-selection/MapSelectionBar.vue'
import MapSelectionOverlay from './map-selection/MapSelectionOverlay.vue'
import MapFeedbackOverlay from './map-selection/MapFeedbackOverlay.vue'
import MapFeedbackControls from './map-selection/MapFeedbackControls.vue'
import FogOfWarLayer from './FogOfWarLayer.vue'
import { decodeFog } from '../core/fog'
import { computed, inject, nextTick, ref, watch, type Ref } from 'vue'
import MapViewportControls from './MapViewportControls.vue'
import MapResizeHandle from './workspace/MapResizeHandle.vue'
import { useMapViewport } from './useMapViewport'
import SceneMarkers from './scene-tools/SceneMarkers.vue'
import CorpseMarkers from './CorpseMarkers.vue'
import AreaOverlay from './AreaOverlay.vue'
import MapTokenNames from './MapTokenNames.vue'
import type { PublicScene, RoomView } from '../online/protocol'
import RoomSceneHeader from './RoomSceneHeader.vue'
import { safePortrait } from '../core/portraits'
import { cellAtPixel, cellCenter, gridSize, gridOffset } from '../core/map-view'
import type { Position } from '../core/map-types'
const props = defineProps<{
  externalHeader?: boolean
  viewKey?: string
  displayScope?: string
  quickConfirmHint?: string
  scene: PublicScene
  background: string
  selected: string
  busy: boolean
  sightTarget?: string
  exploration?: RoomView['exploration']
  encounter?: RoomView['encounter']
  hasMovementPreview?: boolean
  previewPath?: Position[]
  jumpRange?: Position[]
  previewMode?: 'move' | 'jump'
  previewValid?: boolean
}>()
const emit = defineEmits<{ cell: [Position]; token: [string]; ground: [string]; point: [string]; cancelPreview: []; corpse: [string] }>()
const names = defineModel<boolean>('names', { default: true })
const mapH = inject<{ gm: Ref<number>; player: Ref<number> } | null>('trpg-map-heights', null)?.player
function applyMapHeight(value: number) {
  if (mapH) mapH.value = value
}
const mapHeightStyle = computed(() =>
  mapH ? { height: mapH.value + 'px' } : { height: 'min(65vh, 780px)' },
)
const size = computed(() => gridSize(props.scene.grid)),
  offset = computed(() => gridOffset(props.scene.grid))
const sightCandidates = computed(() =>
  (props.scene.sightLines ?? []).filter((r) => r.fromId === props.selected),
)
const rayKind=ref<'visual'|'target'>('visual')
const sight = computed(() => sightCandidates.value.find((r) => r.toId === props.sightTarget))
const rayView=computed(()=>rayKind.value==='visual'?sight.value?.sightRay:sight.value?.targetRay)
const from = computed(() => props.scene.tokens.find((t) => t.id === props.selected))
const to = computed(() => props.scene.tokens.find((t) => t.id === props.sightTarget))
const mapElement = ref<HTMLElement | null>(null)
const selectionSvg=ref<SVGSVGElement|null>(null),selectionMapId=mapSurfaceId('public-map')
const mapSelection=provideMapSelection(()=>props.viewKey??props.scene.id)
function focusActor(id: string) {
  const actor = props.encounter?.actors.find((a) => a.id === id)
  const token = props.scene.tokens.find(
    (t) => t.actorId === id || (!!actor?.characterId && t.characterId === actor.characterId),
  )
  if (!token) return
  emit('token', token.id)
  void nextTick(() => {
    const el = [...(mapElement.value?.querySelectorAll<SVGElement>('[data-token]') ?? [])].find(
      (el) => el.dataset.token === token.id,
    )
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  })
}
const width = computed(() => props.scene.grid.columns * Math.max(64, size.value)),
  height = computed(() => props.scene.grid.rows * Math.max(64, size.value))
const showEffectRegions=ref(true),showEffectLighting=ref(false)
const lightingKey=()=> 'trpg-player-lighting:' + (props.displayScope ?? 'browser')
watch(()=>props.displayScope,()=>{try{showEffectLighting.value=localStorage.getItem(lightingKey())==='true'}catch{showEffectLighting.value=false}},{immediate:true})
watch(showEffectLighting,value=>{try{localStorage.setItem(lightingKey(),String(value))}catch{/* Local display preference is optional. */}})
const zoom = ref(0.5)
const mapViewport = useMapViewport(
  mapElement,
  () => `player:${props.viewKey ?? ''}:${props.scene.id}`,
  () => ({ width: width.value, height: height.value }),
  zoom,
  undefined,
  () => { if (!props.busy && props.previewMode === "move" && (props.hasMovementPreview || props.previewPath?.length)) emit("cancelPreview") },
)
defineExpose({ exitInteraction: mapViewport.exit, focusActor })
useSelectionSurface(selectionSvg,{id:selectionMapId,scene:()=>props.scene,activate:()=>{if(!mapViewport.active.value)mapViewport.toggle()},focus:()=>{mapElement.value?.scrollIntoView({block:'center'});selectionSvg.value?.setAttribute('tabindex','0');selectionSvg.value?.focus({preventScroll:true})},allowPoint:p=>!props.scene.fog||exploredCells.value?.has(p.x+','+p.y)===true},mapSelection)
const exploredCells=computed(()=>props.scene.fog?decodeFog(props.scene.fog.explored,props.scene.fog.columns,props.scene.fog.rows):undefined)
const center = (p: Position & { displayPosition?: Position }) => cellCenter(props.scene.grid, p.displayPosition ?? p)
function click(event: MouseEvent) {
  if (props.busy) return
  const svg = event.currentTarget as SVGSVGElement,
    matrix = svg.getScreenCTM()
  if (!matrix) return
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()),
    cell = cellAtPixel(props.scene.grid, p)
  if (cell && (!props.scene.fog || props.scene.fog.mode==='enclosed'||exploredCells.value?.has(cell.x+','+cell.y))) emit('cell', cell)
}
</script>
<template>
  <section class="room-map">
    <RoomSceneHeader
      v-if="!externalHeader"
      v-model:names="names"
      :scene="scene"
      :encounter="encounter"
      :exploration="exploration"
      :busy="busy"
      @focus="focusActor"
    />
    <div class="map-inline scene-effect-display"><label v-if="scene.sceneEffects?.regions.length"><input v-model="showEffectRegions" type="checkbox" /> {{ controlText('domain.ongoingAreas') }}</label><label><input v-model="showEffectLighting" type="checkbox" /> {{ controlText('domain.lightObscurement') }}</label><label>{{ controlText('interactionField.targetLines') }}<select v-model="rayKind"><option value="visual">{{ controlText('adjudication.lineOfSight') }}</option><option value="target">{{ controlText('adjudication.targetPropagation') }}</option></select></label><span class="muted">{{rayView?.reason??controlText('expressionThree.displayDoesNotChangeRules')}}</span></div>
    <MapViewportControls
      :active="mapViewport.active.value"
      :zoom="zoom"
      @toggle="mapViewport.toggle"
      @fit="mapViewport.fit"
      @reset="mapViewport.reset"
    />
    <div ref="mapElement" class="room-map-scroll" :style="mapHeightStyle">
      <svg
        ref="selectionSvg"
        :viewBox="`0 0 ${width} ${height}`"
        :style="{
          width: width * zoom + 'px',
          height: height * zoom + 'px',
          maxWidth: 'none',
          touchAction: mapViewport.active.value ? 'none' : 'pan-x pan-y',
        }"
        :aria-label="controlText('interactionField.roomPublicMap')"
        @click="click"
      >
        <defs>
          <pattern
            id="room-grid"
            :x="offset.x"
            :y="offset.y"
            :width="size"
            :height="size"
            patternUnits="userSpaceOnUse"
          >
            <path
              :d="`M ${size} 0 H 0 V ${size}`"
              fill="none"
              :stroke="scene.grid.color"
              :stroke-opacity="scene.grid.opacity"
              :stroke-width="scene.grid.strokeWidth ?? 1"
              vector-effect="non-scaling-stroke"
            />
          </pattern>
        </defs>
        <rect :width="width" :height="height" fill="#252c31" />
        <image
          v-if="scene.background && background"
          :href="background"
          :x="(scene.background.x - scene.grid.originX) * 64"
          :y="(scene.background.y - scene.grid.originY) * 64"
          :width="scene.background.width * 64"
          :height="scene.background.height * 64"
          preserveAspectRatio="none"
          :transform="`rotate(${scene.background.rotation} ${(scene.background.x + scene.background.width / 2 - scene.grid.originX) * 64} ${(scene.background.y + scene.background.height / 2 - scene.grid.originY) * 64})`"
        />
        <SceneMarkers
          :items="scene.groundItems ?? []"
          :ghosts="scene.awaitingTokens ?? []"
          :size="size"
          :names="names"
          @ground="emit('ground', $event)"
        />
        <g v-for="r in scene.regions" :key="r.id">
          <rect
            v-for="cell in r.cells"
            :key="cell"
            :x="Number(cell.split(',')[0]) * size + offset.x"
            :y="Number(cell.split(',')[1]) * size + offset.y"
            :width="size"
            :height="size"
            :fill="r.color"
            fill-opacity=".2"
          />
        </g>
        <rect
          v-if="scene.grid.show"
          :x="offset.x"
          :y="offset.y"
          :width="scene.grid.columns * size"
          :height="scene.grid.rows * size"
          fill="url(#room-grid)"
        />
        <g :transform="`translate(${offset.x},${offset.y})`">
          <FogOfWarLayer v-if="scene.fog&&scene.fog.mode!=='enclosed'" :fog="scene.fog" :size="size" />
          <SceneEffectOverlay :data="scene.sceneEffects" :size="size" :zoom="zoom" :observer-id="selected" :regions="showEffectRegions" :lighting="showEffectLighting&&scene.fog?.mode!=='enclosed'" :hide-labels="scene.fog?.mode==='enclosed'" :environment-shading="scene.fog?.mode==='enclosed'" />
          <FogOfWarLayer v-if="scene.fog?.mode==='enclosed'" :fog="scene.fog" :size="size" :observer-id="selected" :shading="showEffectLighting" />
          <SceneEffectOverlay v-if="scene.fog?.mode==='enclosed'" :data="scene.sceneEffects" :size="size" :zoom="zoom" :observer-id="selected" :regions="showEffectRegions" :lighting="false" labels-only />
          <CorpseMarkers :corpses="scene.corpses ?? []" :size="size" :names="names" @select="emit('corpse',$event)" />
          <AreaOverlay
            v-if="scene.template"
            :grid="scene.grid"
            :template="scene.template"
            :size="size"
          />
          <template v-for="r in scene.areaCandidates ?? []" :key="r.tokenId">
            <rect
              v-if="r.inside && scene.tokens.some((t) => t.id === r.tokenId)"
              :x="scene.tokens.find((t) => t.id === r.tokenId)!.x * size"
              :y="scene.tokens.find((t) => t.id === r.tokenId)!.y * size"
              :width="scene.tokens.find((t) => t.id === r.tokenId)!.span * size"
              :height="scene.tokens.find((t) => t.id === r.tokenId)!.span * size"
              fill="none"
              :stroke="r.blocked ? '#ff9b8f' : '#70d6b0'"
              stroke-width="2"
              stroke-dasharray="4 4"
              vector-effect="non-scaling-stroke"
              pointer-events="none"
            />
          </template>
        </g>
        <g v-for="last in scene.lastKnownTokens??[]" :key="'last:'+last.id" pointer-events="none" opacity="0.55"><circle :cx="(last.x+.5)*size" :cy="(last.y+.5)*size" :r="size*.35" fill="var(--panel)" stroke="var(--ink)" stroke-dasharray="4 3" /><text :x="(last.x+.5)*size" :y="(last.y+1)*size" text-anchor="middle" font-size="10" fill="var(--ink)">{{ controlText('progressSummary.lastKnown', {p0:(localizedEntryName(last))}) }}</text></g>
        <g
          v-for="t in scene.tokens"
          :key="t.id"
          class="room-map-token"
          :data-token="t.id"
          @click.stop="emit('token', t.id)"
        >
          <title>{{ localizedEntryName(t) }}</title>
          <circle
            :cx="center(t).x"
            :cy="center(t).y"
            :r="size * 0.35 * (t.effectiveSize==='tiny'?.5:t.effectiveSize==='small'?.85:t.span)"
            :fill="t.color"
            :stroke="selected === t.id ? '#ffdc8a' : '#fff'"
            :stroke-width="selected === t.id ? 4 : 1"
          />
          <template v-if="safePortrait(t.portrait)">
            <defs>
              <clipPath :id="'room-avatar-' + t.id">
                <circle :cx="center(t).x" :cy="center(t).y" :r="size * 0.32 * (t.effectiveSize==='tiny'?.5:t.effectiveSize==='small'?.85:t.span)" />
              </clipPath>
            </defs>
            <image
              :href="safePortrait(t.portrait)!"
              :x="center(t).x - size * 0.32 * (t.effectiveSize==='tiny'?.5:t.effectiveSize==='small'?.85:t.span)"
              :y="center(t).y - size * 0.32 * (t.effectiveSize==='tiny'?.5:t.effectiveSize==='small'?.85:t.span)"
              :width="size * 0.64 * (t.effectiveSize==='tiny'?.5:t.effectiveSize==='small'?.85:t.span)"
              :height="size * 0.64 * (t.effectiveSize==='tiny'?.5:t.effectiveSize==='small'?.85:t.span)"
              :clip-path="`url(#room-avatar-${t.id})`"
              preserveAspectRatio="xMidYMid slice"
            >
              <title>{{ localizedEntryName(t) }}</title>
            </image>
          </template>
          <text
            v-else
            :x="center(t).x"
            :y="center(t).y + 4"
            text-anchor="middle"
            fill="white"
            font-size="12"
          >
            {{ localizedEntryName(t).slice(0, 4) }}
          </text>
        </g>
        <g
          v-for="w in scene.walls ?? []"
          :key="w.id"
          class="room-map-wall"
          :data-wall="w.id"
          :data-state="w.state"
          :style="{pointerEvents:w.kind==='door'&&scene.points.some(p=>p.id===w.pointId)?'auto':'none'}"
          :role="w.kind==='door'&&scene.points.some(p=>p.id===w.pointId)?'button':undefined"
          :tabindex="w.kind==='door'&&scene.points.some(p=>p.id===w.pointId)?0:undefined"
          :aria-label="w.kind==='door'&&scene.points.some(p=>p.id===w.pointId)?(localizedEntryName(scene.points.find(p=>p.id===w.pointId))+controlText('expressionThree.doorSegment')):undefined"
          @click.stop="w.kind==='door'&&w.pointId&&scene.points.some(p=>p.id===w.pointId)&&emit('point',w.pointId)"
          @keydown.enter.prevent="w.kind==='door'&&w.pointId&&scene.points.some(p=>p.id===w.pointId)&&emit('point',w.pointId)"
          @keydown.space.prevent="w.kind==='door'&&w.pointId&&scene.points.some(p=>p.id===w.pointId)&&emit('point',w.pointId)"
        >
          <line
            :x1="w.a.x * size + offset.x"
            :y1="w.a.y * size + offset.y"
            :x2="w.b.x * size + offset.x"
            :y2="w.b.y * size + offset.y"
            :stroke="w.color"
            :stroke-width="3"
            vector-effect="non-scaling-stroke"
            :stroke-dasharray="w.kind === 'door' && w.state === 'open' ? '8 8' : undefined"
            :opacity="w.kind === 'door' && w.state === 'open' ? 0.55 : 1"
          />
          <line v-if="w.kind==='door'&&scene.points.some(p=>p.id===w.pointId)" :x1="w.a.x*size+offset.x" :y1="w.a.y*size+offset.y" :x2="w.b.x*size+offset.x" :y2="w.b.y*size+offset.y" stroke="transparent" :stroke-width="44/zoom" />
          <title>{{ localizedEntryName(w) }}</title>
        </g>
        <line
          v-if="sight && from && to"
          :x1="center(from).x"
          :y1="center(from).y"
          :x2="rayView?(rayView.end.x*size+offset.x):center(to).x"
          :y2="rayView?(rayView.end.y*size+offset.y):center(to).y"
          :stroke="(rayView?.clear??(sight.sightClear && sight.targetingClear)) ? '#70d6b0' : '#ff9b8f'"
          stroke-width="2"
          :stroke-dasharray="rayView?.clear?undefined:'5 5'"
          vector-effect="non-scaling-stroke"
          pointer-events="none"
        />
        <g>
          <g
            v-for="p in scene.points"
            :key="p.id"
            class="room-map-point"
            role="button"
            tabindex="0"
            :aria-label="localizedEntryName(p)"
            @keydown.enter.prevent="emit('point', p.id)"
            @click.stop="emit('point', p.id)"
          >
            <title>{{ localizedEntryName(p) }}</title>
            <rect
              :x="center(p).x - 18"
              :y="center(p).y - 18"
              width="36"
              height="36"
              rx="7"
              fill="#365463"
              stroke="#fff"
              stroke-width="2"
            />
            <path
              :d="
                p.kind === 'chest'
                  ? 'M-11-5H11V9H-11ZM-11-1H11M-2-1V4H2V-1'
                  : p.kind === 'door'
                    ? 'M-8 11V-11H8V11M3 0H5'
                    : p.kind === 'exit'
                      ? 'M-11 0H11M3-8L11 0 3 8'
                      : 'M0-11L11 0 0 11-11 0ZM0-5V2M0 6V7'
              "
              :transform="`translate(${center(p).x},${center(p).y})`"
              fill="none"
              stroke="white"
              stroke-width="2"
            />
            <text
              v-if="names"
              :x="center(p).x"
              :y="center(p).y + 35"
              text-anchor="middle"
              fill="white"
              stroke="#17252b"
              stroke-width="3"
              paint-order="stroke"
              font-size="14"
            >
              {{ localizedEntryName(p) }}
            </text>
          </g>
          <text
            v-for="a in names ? scene.annotations : []"
            :key="a.id"
            :x="center(a).x + a.offsetX"
            :y="center(a).y + a.offsetY"
            :fill="a.color"
            :font-size="a.fontSize"
            stroke="#17252b"
            stroke-width="2"
            paint-order="stroke"
          >
            {{ localizedEntryName(a) }}
          </text>
        </g>
        <g v-if="jumpRange?.length" pointer-events="none" :aria-label="controlText('interactionField.reachableJumpDestinations')">
          <rect
            v-for="p in jumpRange"
            :key="`${p.x},${p.y}`"
            :x="center(p).x - size / 2 + 2"
            :y="center(p).y - size / 2 + 2"
            :width="size - 4"
            :height="size - 4"
            fill="#56a886"
            fill-opacity="0.23"
            stroke="#388267"
            stroke-dasharray="3 3"
          />
        </g>
        <g v-if="from && previewPath?.length" pointer-events="none" :aria-label="controlText('interactionField.actionRoutePreview')">
          <polyline
            :points="[from, ...previewPath].map((p) => `${center(p).x},${center(p).y}`).join(' ')"
            fill="none"
            :stroke="previewValid ? '#f4cf69' : '#f3a4a4'"
            :stroke-width="3"
            :stroke-dasharray="previewMode === 'jump' ? '10 6' : undefined"
            vector-effect="non-scaling-stroke"
          />
          <circle
            v-for="(p, i) in previewPath"
            :key="i"
            :cx="center(p).x"
            :cy="center(p).y"
            r="3"
            fill="#f4cf69"
          />
          <rect
            :x="center(previewPath.at(-1)!).x - size / 2 + 4"
            :y="center(previewPath.at(-1)!).y - size / 2 + 4"
            :width="size * (from.span ?? 1) - 8"
            :height="size * (from.span ?? 1) - 8"
            fill="#f4cf6933"
            :stroke="previewValid ? '#f4cf69' : '#f3a4a4'"
            stroke-width="3"
          />
          <text
            :x="center(previewPath.at(-1)!).x"
            :y="center(previewPath.at(-1)!).y - 12"
            fill="#fff"
            stroke="#17252b"
            stroke-width="3"
            paint-order="stroke"
          >
            {{ previewMode === 'jump' ? controlText('expressionThree.jumpDestination') : quickConfirmHint || controlText('expressionThree.previewDestination') }}
          </text>
        </g>
        <MapFeedbackOverlay :zoom="zoom" :scene-id="scene.id" :size="size" :offset="offset" :fog="scene.fog" />
        <MapSelectionOverlay :zoom="zoom" :map-id="selectionMapId" :grid="scene.grid" :size="size" :offset="offset" />
        <MapTokenNames
          v-if="names"
          :grid="scene.grid"
          :tokens="scene.tokens"
          :zoom="zoom"
          :selected="selected"
        />
      </svg>
    </div>
    <MapSelectionBar :map-id="selectionMapId" />
    <MapFeedbackControls />
    <MapResizeHandle
      v-if="mapH"
      :model-value="mapH"
      :default-height="648"
      :label="controlText('finalField.adjustPublicMapHeight')"
      @update:model-value="applyMapHeight"
    />
  </section>
</template>
<style scoped>
.room-map-wall[role='button']{cursor:pointer}.room-map-wall[role='button']:focus-visible{outline:2px solid var(--accent,#397b9a);outline-offset:3px}
.scene-effect-display{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;padding:4px 0;font-size:12px}.scene-effect-display label{display:inline-flex;align-items:center;gap:4px;width:auto;margin:0;min-height:32px}.scene-effect-display select{width:auto;max-width:140px;min-height:32px;padding:4px 8px;font:inherit}.scene-effect-display input[type=checkbox]{width:auto;margin:0}@media(pointer:coarse){.scene-effect-display label,.scene-effect-display select{min-height:44px}}
</style>
