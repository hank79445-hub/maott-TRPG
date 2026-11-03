<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {computed} from 'vue'
import MapPositionPicker from '../map-selection/MapPositionPicker.vue'
import type {MapToken,MapWall} from '../../core/map-types'
import {spatialDistance} from '../../core/m3-spatial'
import {segmentsIntersect} from '../../core/map-spatial'
const props=defineProps<{from:MapToken;to:{x:number;y:number;height:number};feet:number;columns:number;rows:number;walls?:MapWall[];movement?:boolean;multiplier?:number;placementSpan?:number;sceneId?:string;disabled?:boolean}>()
const emit=defineEmits<{select:[point:{x:number;y:number;height:number}]}>()
const length=computed(()=>spatialDistance(props.from,{...props.to,spatial:{height:props.to.height,layer:props.from.spatial?.layer??'material'}},props.feet))
const obstacles=computed(()=>(props.walls??[]).filter(w=>w.state!=='open'&&(w.blocksMovement||w.blocksSight)&&segmentsIntersect({x:props.from.x+0.5,y:props.from.y+0.5},{x:props.to.x+0.5,y:props.to.y+0.5},w.a,w.b)))
const outside=computed(()=>props.to.x<0||props.to.y<0||props.to.x+(props.placementSpan??props.from.span)>props.columns||props.to.y+(props.placementSpan??props.from.span)>props.rows)
</script>
<template>
<MapPositionPicker :scene-id="sceneId" :span="placementSpan??from.span" :from="from" :x="to.x" :y="to.y" :height="to.height" :disabled="disabled" @select="p=>emit('select',p)" />
 <details class="m3-destination-preview"><summary>{{ controlText('configurationField.destinationAndDistancePreview') }} {{length}}{{ controlText('game.feet') }}<span v-if="movement">{{ controlText('quantity.movementCost', {p0:(length*(multiplier??1))}) }}</span></summary>

  <svg :viewBox="`0 0 ${columns} ${rows}`" role="img" :aria-label="controlText('configurationField.diagramFromCurrentPositionToRequestedDestinationIncluding')">
   <rect width="100%" height="100%" fill="var(--surface)" />
   <line v-for="w in walls??[]" :key="w.id" :x1="w.a.x" :y1="w.a.y" :x2="w.b.x" :y2="w.b.y" stroke="currentColor" :stroke-width="0.15" />
   <line :x1="from.x+0.5" :y1="from.y+0.5" :x2="to.x+0.5" :y2="to.y+0.5" stroke="var(--accent)" stroke-width="0.18" stroke-dasharray="0.4 0.2" />
   <circle :cx="from.x+0.5" :cy="from.y+0.5" r="0.35" fill="currentColor" />
   <circle :cx="to.x+0.5" :cy="to.y+0.5" r="0.45" fill="var(--accent)" />
  </svg>
  <p>{{ controlText('quantity.heightDestination', {p0:(from.spatial?.height??0),p1:(to.x),p2:(to.y),p3:(to.height)}) }}</p>
  <p v-if="outside" role="status">{{ controlText('configuration.theDestinationIsOutsideTheCurrentMapBoundaries') }}</p>
  <p v-if="obstacles.length" role="status">{{ controlText('quantity.routeWalls', {p0:(obstacles.length)}) }}</p>
  <p class="muted">{{ controlText('workspace.usesOnlyDeliveredMapInformationTheServerAnd') }}</p>
 </details>
</template>
<style scoped>
.m3-destination-preview{min-width:0}.m3-destination-preview svg{display:block;width:100%;height:120px;border:1px solid var(--line);border-radius:6px}.m3-destination-preview p{font-size:12px;line-height:1.5;margin:6px 0}
</style>
