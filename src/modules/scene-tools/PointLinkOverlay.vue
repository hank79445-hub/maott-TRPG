<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import type { MapScene } from '../../core/map-types'
defineProps<{ scene: MapScene; gridPixels: number; zoom: number }>()
</script>
<template>
  <g :aria-label="controlText('remainingField.gmMechanismLinks')" pointer-events="none"
    ><g v-for="(g, i) in scene.pointLinks ?? []" :key="g.id"
      ><template v-for="e in g.effects" :key="e.pointId"
        ><line
          v-if="
            scene.points.some((p) => p.id === g.sourcePointId) &&
            scene.points.some((p) => p.id === e.pointId)
          "
          :x1="(scene.points.find((p) => p.id === g.sourcePointId)!.x + 0.5) * gridPixels"
          :y1="(scene.points.find((p) => p.id === g.sourcePointId)!.y + 0.5) * gridPixels"
          :x2="(scene.points.find((p) => p.id === e.pointId)!.x + 0.5) * gridPixels"
          :y2="(scene.points.find((p) => p.id === e.pointId)!.y + 0.5) * gridPixels"
          :stroke="g.color"
          :stroke-width="2 / zoom"
          :stroke-dasharray="8 / zoom"
          ><title>{{ i + 1 }} · {{ localizedEntryName(g) }}</title></line
        ></template
      ><g
        v-for="p in scene.points.filter(
          (p) => p.id === g.sourcePointId || g.effects.some((e) => e.pointId === p.id),
        )"
        :key="p.id"
        ><circle
          :cx="(p.x + 0.5) * gridPixels"
          :cy="(p.y + 0.5) * gridPixels"
          :r="(20 + (i % 3) * 4) / zoom"
          fill="none"
          :stroke="g.color"
          :stroke-width="3 / zoom"
        /><text
          :x="(p.x + 0.5) * gridPixels + 20 / zoom"
          :y="(p.y + 0.5) * gridPixels + ((i % 4) * 12 - 12) / zoom"
          :fill="g.color"
          :font-size="12 / zoom"
          >{{ i + 1 }} · {{ localizedEntryName(g) }}</text
        ></g
      ></g
    ></g
  >
</template>
