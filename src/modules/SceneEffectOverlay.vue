<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { computed } from 'vue'
import type { SceneMapEffects, SceneEffectView } from '../core/scene-effect-view'
const props = defineProps<{
  data?: SceneMapEffects
  size: number
  observerId?: string
  gm?: boolean
  zoom?: number
  regions?: boolean
  lighting?: boolean
  labelsOnly?:boolean
  hideLabels?:boolean
  environmentShading?:boolean
}>()
const cells = (e: SceneEffectView) => e.cellsByObserver?.[props.observerId ?? ''] ?? e.cells
const strokes = (e:SceneEffectView)=>e.strokesByObserver?.[props.observerId??'']??e.strokes??[]
const labelAt = (e: SceneEffectView) => {
  if (e.pattern === 'rays') return e.labelPosition
  const cell = cells(e)[0]?.split(',').map(Number)
  return cell ? { x: cell[0]!, y: cell[1]! } : undefined
}
const labelWidth = (e: SceneEffectView) => Math.max(60, e.name.length * 13 + 22)
const layer = computed(
  () =>
    props.data?.lighting.find((l) => l.observerId === props.observerId) ?? props.data?.lighting[0],
)
</script>
<template>
  <g class="scene-effect-overlay" pointer-events="none" :aria-label="controlText('remainingField.persistentSpellAreasAndLighting')">
    <g v-if="lighting" class="scene-effect-light-layer">
      <rect
        v-for="(r, i) in layer?.runs ?? []"
        :key="i"
        :x="r.x * size"
        :y="r.y * size"
        :width="r.length * size"
        :height="size"
        :fill="
          r.kind === 'dark'
            ? '#090c15'
            : r.kind === 'dim'
              ? '#514d57'
              : r.kind === 'sunlight'
                ? '#ffe8a1'
                : '#f3ce6b'
        "
        :fill-opacity="r.kind === 'dark' ? (gm ? 0.55 : 0.8) : r.kind === 'dim' ? 0.18 : 0.07"
      />
    </g>
    <g v-if="regions">
      <g
        v-for="e in data?.regions ?? []"
        :key="e.id"
        :aria-label="localizedEntryName(e) + (e.covered ? controlText('expressionFour.covered') : '')"
      >
        <template v-if="!labelsOnly"><line v-for="(p,i) in strokes(e)" :key="`stroke-${i}`" :x1="p.a.x*size" :y1="p.a.y*size" :x2="p.b.x*size" :y2="p.b.y*size" :stroke="e.color" :stroke-width="Math.max(2,p.width*size)" stroke-opacity=".8" />
        <rect
          v-for="cell in cells(e)"
          :key="cell"
          :x="Number(cell.split(',')[0]) * size"
          :y="Number(cell.split(',')[1]) * size"
          :width="size"
          :height="size"
          :fill="e.color"
          :fill-opacity="environmentShading&&['dark','fog'].includes(e.pattern)?0:e.pattern === 'dark' ? 0.2 : e.pattern === 'fog' ? 0.22 : 0.055"
          :stroke="e.color"
          :stroke-opacity="0.4"
          :stroke-width="e.pattern === 'rays' ? 1 : 2"
          :stroke-dasharray="
            e.pattern === 'fog' ? '3 7' : e.pattern === 'hazard' ? '7 3' : undefined
          "
        /></template>
        <g
          v-if="!hideLabels&&labelAt(e)"
          :transform="`translate(${labelAt(e)!.x * size},${labelAt(e)!.y * size}) scale(${1 / (zoom ?? 1)})`"
        >
          <rect
            :x="e.pattern === 'rays' ? -labelWidth(e) / 2 : 0"
            :y="e.pattern === 'rays' ? -31 : 1"
            :width="labelWidth(e)"
            height="23"
            rx="5"
            fill="#172632"
            fill-opacity=".9"
          />
          <text :x="e.pattern === 'rays' ? 0 : 7" :y="e.pattern === 'rays' ? -15 : 17" :text-anchor="e.pattern === 'rays' ? 'middle' : 'start'" fill="#fff" font-size="12"
            >{{
              e.pattern === 'fog'
                ? controlText('expressionFour.fog')
                : e.pattern === 'dark'
                  ? controlText('expressionFour.dark')
                  : e.pattern === 'rays'
                    ? controlText('expressionFour.light')
                    : controlText('expressionFour.areaAlias29')
            }}
            · {{ localizedEntryName(e) }}</text
          >
        </g>
      </g>
    </g>
  </g>
</template>
