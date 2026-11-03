<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import type { Adventure, MapScene, MapPoint, MapCommand, MapWorld } from '../core/map-types'
import { clone } from '../core/engine'
import { defaultArrival, planPortalArrival } from '../core/map-portals'
const props = defineProps<{
  adventure: Adventure
  scene: MapScene
  point: MapPoint
  world: MapWorld
  busy: boolean
  dirty: boolean
}>()
const emit = defineEmits<{ update: [MapPoint]; command: [MapCommand] }>()
const targetScene = ref(''),
  targetPoint = ref(''),
  both = ref(true),
  x = ref(0),
  y = ref(0),
  width = ref(3),
  height = ref(3),
  relative = ref(true),
  facing = ref(0)
watch(
  () => props.point.id,
  () => {
    targetScene.value = props.point.targetSceneId ?? ''
    targetPoint.value = props.point.portal?.targetPointId ?? ''
    both.value = props.point.portal?.bidirectional ?? true
    const area = props.point.portal?.arrival ?? defaultArrival(props.scene, props.point)
    x.value = area.anchor.x
    y.value = area.anchor.y
    relative.value = area.relative
    const cells = area.cells.map((key) => key.split(',').map(Number))
    width.value = Math.max(...cells.map((p) => p[0]!)) - Math.min(...cells.map((p) => p[0]!)) + 1
    height.value = Math.max(...cells.map((p) => p[1]!)) - Math.min(...cells.map((p) => p[1]!)) + 1
    facing.value = 'facing' in area ? Number(area.facing) : 0
  },
  { immediate: true },
)
const points = computed(
  () =>
    props.adventure.scenes
      .find((s) => s.id === targetScene.value)
      ?.points.filter((p) => p.kind === 'exit') ?? [],
)
function area() {
  const cells: string[] = []
  for (let j = 0; j < height.value; j++)
    for (let i = 0; i < width.value; i++) cells.push(x.value + i + ',' + (y.value + j))
  emit('update', {
    ...clone(props.point),
    portal: {
      ...props.point.portal,
      targetPointId: props.point.portal?.targetPointId ?? null,
      bidirectional: props.point.portal?.bidirectional ?? false,
      arrival: {
        anchor: { x: x.value, y: y.value },
        cells,
        relative: relative.value,
        facing: facing.value,
      },
    },
  })
}
function pair(clear = false) {
  emit('command', {
    type: 'portal-pair',
    sceneId: props.scene.id,
    pointId: props.point.id,
    targetSceneId: clear ? null : targetScene.value,
    targetPointId: clear ? null : targetPoint.value,
    bidirectional: both.value,
  })
}
const preview = computed(() => {
  try {
    if (!props.point.portal?.arrival) return '配置本端到达区域后保存'
    const plan = planPortalArrival(props.world, props.adventure, props.scene, props.point)
    return (
      '本端到达预检：' +
      Object.keys(plan.party).length +
      '名队员＋' +
      Object.keys(plan.npcs).length +
      '名跟随NPC；' +
      JSON.stringify(plan.party)
    )
  } catch (e) {
    return e instanceof Error ? e.message : '无法预检'
  }
})
</script>
<template>
  <details class="portal-editor ai-wide">
    <summary>{{ controlText('workspace.portalPairingAndArrivalArea') }}</summary>
    <p class="muted">{{ controlText('workspace.thisSideSArrivalAreaIsUsedWhen') }}</p>
    <fieldset :disabled="busy" class="map-field-grid">
      <label
        >{{ controlText('configurationField.pairedDestinationScene') }}<select v-model="targetScene" @change="targetPoint = ''">
          <option value="">{{ controlText('game.scene') }}</option>
          <option
            v-for="s in adventure.scenes.filter((s) => s.id !== scene.id)"
            :key="s.id"
            :value="s.id"
          >
            {{ localizedEntryName(s) }}
          </option>
        </select></label
      >
      <label
        >{{ controlText('configurationField.pairedDestinationPortal') }}<select v-model="targetPoint">
          <option value="">{{ controlText('workspace.chooseEntranceExit') }}</option>
          <option v-for="p in points" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
        </select></label
      >
      <label class="check"><input v-model="both" type="checkbox" />{{ controlText('configurationField.createTwoWayPairing') }}</label>
      <button type="button" :disabled="dirty || !targetScene || !targetPoint" @click="pair()">{{ controlText('workspace.pairPortals') }}</button
      ><button type="button" :disabled="dirty || !point.portal?.targetPointId" @click="pair(true)">{{ controlText('workspace.unpairPortals') }}</button>
      <label>{{ controlText('configurationField.arrivalAnchorX') }}<input v-model.number="x" type="number" min="0" /></label
      ><label>{{ controlText('configurationField.arrivalAnchorY') }}<input v-model.number="y" type="number" min="0" /></label
      ><label>{{ controlText('configurationField.areaWidthCells') }}<input v-model.number="width" type="number" min="1" max="15" /></label
      ><label>{{ controlText('configurationField.areaHeightCells') }}<input v-model.number="height" type="number" min="1" max="15" /></label
      ><label>{{ controlText('configurationField.arrivalFacing') }}<input v-model.number="facing" type="number" min="0" max="359" /></label
      ><label class="check"><input v-model="relative" type="checkbox" />{{ controlText('configurationField.moveAreaWithPortal') }}</label
      ><button type="button" @click="area">{{ controlText('workspace.applyThisSideSArrivalAreaDraft') }}</button>
    </fieldset>
    <p>{{ preview }}</p>
    <small>{{ controlText('workspace.anInsufficientArrivalAreaDefersTheWholeTransfer') }}</small>
  </details>
</template>
<style scoped>
.portal-editor {
  overflow-wrap: anywhere;
}
.portal-editor fieldset {
  border: 0;
  padding: 0;
}
.portal-editor summary {
  min-height: 44px;
}
.portal-editor p {
  white-space: pre-wrap;
}
</style>
