<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { computed,ref } from 'vue'
import type {DoorPreset} from '../core/wide-door'
import type { MapScene, MapWall } from '../core/map-types'
import { wallState, COVER_NAMES } from '../core/map-spatial'
import { newPoint } from '../core/map'
const props = defineProps<{ scene: MapScene; selected: string; editing: boolean; busy: boolean }>()
const emit = defineEmits<{
  select: [string]
  draw: [MapWall['kind'],DoorPreset?]
  save: []
  toggle: [string]
}>()
const wall = computed(() => props.scene.walls?.find((w) => w.id === props.selected))
const doors = computed(() => props.scene.points.filter((p) => p.kind === 'door' && p.enabled))
const doorLength=ref(2),doorAxis=ref<DoorPreset['axis']>('horizontal'),doorSide=ref<1|-1>(1)
function preset(length:number){emit('draw','door',{length,axis:doorAxis.value,side:doorSide.value})}
function remove() {
  props.scene.walls = props.scene.walls?.filter((w) => w.id !== props.selected)
  emit('select', '')
}
function createDoorPoint() {
  if (!wall.value) return
  const w = wall.value,
    p = newPoint('door', {
      x: Math.min(props.scene.grid.columns - 1, Math.floor((w.a.x + w.b.x) / 2)),
      y: Math.min(props.scene.grid.rows - 1, Math.floor((w.a.y + w.b.y) / 2)),
    })
  p.name = w.name
  p.state = w.state
  props.scene.points.push(p)
  w.pointId = p.id
}
function setCover(event: Event) {
  if (wall.value) wall.value.cover = (event.target as HTMLSelectElement).value as MapWall['cover']
}
</script>
<template>
  <section class="wall-editor" :inert="busy">
    <h3>{{ controlText('map.wallTitle') }}</h3>
    <p class="muted">
      {{ controlText('map.wallHelp') }}
    </p>
    <div v-if="editing" class="map-inline">
      <button @click="emit('draw', 'wall')">{{ controlText('map.addWall') }}</button>
      <button @click="emit('draw', 'door')">{{ controlText('map.addDoor') }}</button>
    </div>
    <fieldset v-if="editing" class="wide-door-presets"><legend>{{ controlText('map.wideDoor') }}</legend><label>{{ controlText('map.doorOrientation') }}<select v-model="doorAxis"><option value="horizontal">{{ controlText('map.horizontal') }}</option><option value="vertical">{{ controlText('map.vertical') }}</option></select></label><label>{{ controlText('map.operationSide') }}<select v-model="doorSide"><option :value="1">{{ controlText('map.bottomRight') }}</option><option :value="-1">{{ controlText('map.topLeft') }}</option></select></label><label>{{ controlText('map.customLength') }}<input v-model.number="doorLength" type="number" min="1" max="40"/></label><div class="map-inline"><button @click="preset(1)">{{ controlText('map.singleDoor') }}</button><button @click="preset(2)">{{ controlText('map.doubleDoor') }}</button><button :disabled="!Number.isInteger(doorLength)||doorLength<1||doorLength>40" @click="preset(doorLength)">{{ controlText('map.customDoor') }}</button></div><p class="muted">{{ controlText('map.doorPreviewHelp') }}</p></fieldset>
    <label
      >{{ controlText('map.chooseWall') }}<select
        :aria-label="controlText('map.chooseWall')"
        :value="selected"
        @change="emit('select', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ controlText('map.chooseSegment') }}</option>
        <option v-for="w in scene.walls ?? []" :key="w.id" :value="w.id">
          {{ localizedEntryName(w) }} ·
          {{
            w.kind === 'door'
              ? wallState(scene, w) === 'open'
                ? controlText('domain.open')
                : wallState(scene, w) === 'locked'
                  ? controlText('domain.locked')
                  : controlText('controls.close')
              : controlText('domain.walls')
          }}
        </option>
      </select></label
    >
    <template v-if="wall">
      <p v-if="wall.kind==='door'">{{ controlText('scriptSummary.cells', {p0:(controlText('map.doorWidth')),p1:(Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y).toFixed(1)),p2:((Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y)*scene.grid.feet).toFixed(0)),p3:(controlText('map.doorWidthHelp'))}) }}</p>
      <template v-if="editing">
        <label>{{ controlText('map.wallName') }}<input v-model="wall.name" maxlength="120" /></label>
        <div class="map-form-grid">
          <label
            >{{ controlText('map.startX') }}<input
              v-model.number="wall.a.x"
              type="number"
              min="0"
              :max="scene.grid.columns"
              step="0.5"
          /></label>
          <label
            >{{ controlText('map.startY') }}<input
              v-model.number="wall.a.y"
              type="number"
              min="0"
              :max="scene.grid.rows"
              step="0.5"
          /></label>
          <label
            >{{ controlText('map.endX') }}<input
              v-model.number="wall.b.x"
              type="number"
              min="0"
              :max="scene.grid.columns"
              step="0.5"
          /></label>
          <label
            >{{ controlText('map.endY') }}<input
              v-model.number="wall.b.y"
              type="number"
              min="0"
              :max="scene.grid.rows"
              step="0.5"
          /></label>
        </div>
        <label>{{ controlText('map.wallHeight') }}<input v-model.number="wall.heightFeet" type="number" min="0" max="10000" @change="!Number.isFinite(wall.heightFeet)&&delete wall.heightFeet" /></label>
        <label>{{ controlText('map.gapWidth') }}<input v-model.number="wall.gapFeet" type="number" min="0" max="5" step="0.01" @change="!Number.isFinite(wall.gapFeet)&&delete wall.gapFeet" /></label>
        <label class="check"><input v-model="wall.blocksMovement" type="checkbox" />{{ controlText('map.blockMove') }}</label>
        <label class="check"><input v-model="wall.blocksSight" type="checkbox" />{{ controlText('map.blockSight') }}</label>
        <label class="check"
          ><input
            v-model="wall.blocksTargeting"
            type="checkbox"
          />{{ controlText('map.blockDirect') }}</label
        >
        <label class="check"><input :checked="wall.blocksLight??wall.blocksSight" type="checkbox" @change="wall.blocksLight=($event.target as HTMLInputElement).checked" />{{ controlText('map.blockLight') }}</label>
        <label class="check"><input v-model="wall.blocksSound" type="checkbox" />{{ controlText('map.blockSound') }}</label>
        <label>{{ controlText('map.verifiedHeight') }}<input :value="wall.heightFeet??''" type="number" min="0" @change="wall.heightFeet=($event.target as HTMLInputElement).value===''?undefined:Number(($event.target as HTMLInputElement).value)" /></label>
        <label v-if="wall.blocksTargeting"
          >{{ controlText('map.coverLevel') }}<select :value="wall.cover ?? 'total'" @change="setCover">
            <option value="half">{{ controlText('map.halfCover') }}</option>
            <option value="three-quarters">{{ controlText('map.threeQuarterCover') }}</option>
            <option value="total">{{ controlText('map.fullCover') }}</option>
          </select></label
        >
        <p v-if="wall.blocksTargeting" class="muted">
          {{ controlText('map.coverHelp') }}
        </p>
        <label class="check"
          ><input v-model="wall.hidden" type="checkbox" />{{ controlText('map.hideWall') }}</label
        >
        <label>{{ controlText('map.wallColor') }}<input v-model="wall.color" type="color" /></label>
        <template v-if="wall.kind === 'door'">
          <label
            >{{ controlText('map.linkedDoor') }}<MapFieldPicker kind="point"><select v-model="wall.pointId">
              <option :value="null">{{ controlText('map.independentDoor') }}</option>
              <option v-for="p in doors" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
            </select></MapFieldPicker></label
          >
          <button v-if="!wall.pointId" class="secondary" @click="createDoorPoint">
            {{ controlText('map.createDoorPoint') }}
          </button>
          <label v-if="!wall.pointId"
            >{{ controlText('map.segmentState') }}<select v-model="wall.state">
              <option value="closed">{{ controlText('controls.close') }}</option>
              <option value="open">{{ controlText('domain.open') }}</option>
              <option value="locked">{{ controlText('domain.locked') }}</option>
            </select></label
          >
          <p v-else class="muted">{{ controlText('map.linkedDoorHelp') }}</p>
        </template>
        <div class="map-inline">
          <button @click="emit('save')">{{ controlText('map.saveWall') }}</button
          ><button class="danger" @click="remove">{{ controlText('map.deleteWall') }}</button>
        </div>
      </template>
      <template v-else>
        <p>
          {{ localizedEntryName(wall) }} · {{ wall.blocksMovement ? controlText('map.blockMove') : controlText('expressionFour.allowMovement') }} ·
          {{ wall.blocksSight ? controlText('map.blockSight') : controlText('expressionFour.allowSight') }} ·
          {{ wall.blocksTargeting ? uiLabel(COVER_NAMES[wall.cover ?? 'total']) : controlText('expressionFour.noDirectTargetObstruction') }}
        </p>
        <button
          v-if="wall.kind === 'door'"
          :disabled="wallState(scene, wall) === 'locked'"
          @click="emit('toggle', wall.id)"
        >
          {{ wallState(scene, wall) === 'open' ? controlText('expressionFour.closedDoorSegment') : controlText('expressionFour.openDoorSegment') }}
        </button>
        <p v-if="wallState(scene, wall) === 'locked'" class="muted">
          {{ controlText('map.lockedDoorHelp') }}
        </p>
      </template>
    </template>
    <p class="muted">
      {{ controlText('map.wallRulesHelp') }}
    </p>
  </section>
</template>
