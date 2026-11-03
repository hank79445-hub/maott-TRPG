<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {uiLabel} from './ui-label'
import { computed } from 'vue'
import type { MapScene, MapTemplate, Position } from '../core/map-types'
import { areaTargets, TEMPLATE_NAMES, templateOrigin } from '../core/map-area'
import { COVER_NAMES } from '../core/map-spatial'
const props = defineProps<{ scene: MapScene; cursor: Position; busy: boolean; saveText?: string }>()
const emit = defineEmits<{ save: [] }>()
const t = computed(() => props.scene.template),
  report = computed(() => areaTargets(props.scene))
const candidateText = computed(
  () =>
    report.value
      .filter((r) => r.eligible)
      .map((r) => r.token.name + '（' + COVER_NAMES[r.cover] + '）')
      .join('、') || '暂无',
)
const blockedText = computed(
  () =>
    report.value
      .filter((r) => r.blocked)
      .map((r) => r.token.name)
      .join('、') || '暂无',
)
function create() {
  props.scene.template = {
    ...props.cursor,
    shape: 'sphere',
    size: 15,
    width: 5,
    angle: 0,
    propagation: 'straight',
    includeOrigin: true,
    note: '',
  }
}
function changeShape(event: Event) {
  if (!t.value) return
  t.value.shape = (event.target as HTMLSelectElement).value as MapTemplate['shape']
  delete t.value.origin
  t.value.includeOrigin = ['circle', 'square', 'sphere', 'cylinder'].includes(t.value.shape)
}
function customOrigin(event: Event) {
  if (!t.value) return
  if ((event.target as HTMLInputElement).checked)
    t.value.origin = { ...templateOrigin(props.scene.grid, t.value) }
  else delete t.value.origin
}
function clear() {
  props.scene.template = null
  emit('save')
}
</script>
<template>
  <section class="template-editor" :inert="busy">
    <h3>{{ controlText('resourceFlow.areaOriginAndPropagation') }}</h3>
    <button @click="create">{{ controlText('resourceFlow.createAreaTemplateAtSelectedCell') }}</button>
    <template v-if="t">
      <label
        >{{ controlText('remainingField.templateShape') }}<select :value="t.shape" @change="changeShape">
          <option v-for="(name, key) in TEMPLATE_NAMES" :key="key" :value="key">{{ uiLabel(name) }}</option>
        </select></label
      >
      <div class="map-field-grid">
        <label
          >{{ controlText('remainingField.areaSizeFt') }}<input v-model.number="t.size" type="number" min="1" max="1000"
        /></label>
        <label>{{ controlText('remainingField.directionAngle') }}<input v-model.number="t.angle" type="number" min="-360" max="360" /></label>
        <label v-if="t.shape === 'line'"
          >{{ controlText('remainingField.lineWidthFt') }}<input v-model.number="t.width" type="number" min="1" max="1000"
        /></label>
        <label
          >{{ controlText('remainingField.templatePositionXCells') }}<input
            v-model.number="t.x"
            type="number"
            min="0"
            :max="scene.grid.columns - 1"
        /></label>
        <label
          >{{ controlText('remainingField.templatePositionYCells') }}<input
            v-model.number="t.y"
            type="number"
            min="0"
            :max="scene.grid.rows - 1"
        /></label>
        <label v-if="t.shape === 'emanation'"
          >{{ controlText('remainingField.sourceFootprintSideLength') }}<input v-model.number="t.originSpan" type="number" min="1" max="4"
        /></label>
      </div>
      <p class="muted">
        {{ controlText('resourceFlow.sphereAndCylinderSizesAreRadiiCubesAnd') }}
      </p>
      <label class="check"
        ><input :checked="!!t.origin" type="checkbox" @change="customOrigin" />{{ controlText('remainingField.customAreaOrigin') }}</label
      >
      <div v-if="t.origin" class="map-field-grid">
        <label
          >{{ controlText('remainingField.areaOriginX') }}<input
            v-model.number="t.origin.x"
            type="number"
            min="0"
            :max="scene.grid.columns"
            step="0.5"
        /></label>
        <label
          >{{ controlText('remainingField.areaOriginY') }}<input
            v-model.number="t.origin.y"
            type="number"
            min="0"
            :max="scene.grid.rows"
            step="0.5"
        /></label>
      </div>
      <p>
        {{ controlText('remainingField.currentOrigin') }}{{ templateOrigin(scene.grid, t).x }},
        {{ templateOrigin(scene.grid, t).y }})<span v-if="t.shape === 'cube'">
          {{ controlText('resourceFlow.mustLieOnAFaceOfTheCube') }}</span
        >
      </p>
      <label class="check"
        ><input v-model="t.includeOrigin" type="checkbox" />{{ controlText('remainingField.includeOriginSourceItself') }}</label
      >
      <label
        >{{ controlText('remainingField.propagationMethod') }}<select v-model="t.propagation">
          <option :value="undefined">{{ controlText('resourceFlow.legacyTemplateGmConfirmation') }}</option>
          <option value="straight">{{ controlText('resourceFlow.straightPropagationTotalCoverBlocks') }}</option>
          <option value="manual">{{ controlText('resourceFlow.specialPropagationGmManualConfirmation') }}</option>
        </select></label
      >
      <label
        >{{ controlText('remainingField.areaNotesSpecialPropagationBasis') }}<textarea
          v-model="t.note"
          rows="2"
          maxlength="2000"
          :placeholder="controlText('remainingField.forExampleSourceTextPermitsTurningCornersManual')"
        />
      </label>
      <p class="template-candidates">{{ controlText('scriptSummary.reachableCandidates', {p0:(candidateText)}) }}</p>
      <p class="template-blocked">{{ controlText('scriptSummary.blockedByTotalCover', {p0:(blockedText)}) }}</p>
      <p class="muted">
        {{ controlText('resourceFlow.candidatesSampleOccupiedCellCentersWithoutDeclaringFinal') }}
      </p>
      <div class="map-inline">
        <button @click="emit('save')">{{ saveText ?? controlText('expressionFour.saveAreaTemplate') }}</button
        ><button class="secondary" @click="clear">{{ controlText('resourceFlow.clearTemplate') }}</button>
      </div>
    </template>
  </section>
</template>
