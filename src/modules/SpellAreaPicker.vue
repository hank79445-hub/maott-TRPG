<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {useMapSelection} from './map-selection/selection'
import type { Spell } from '../core/types'
import type { MapTemplate, Position } from '../core/map-types'
import { spellAreaSpec, templateOrigin, TEMPLATE_NAMES } from '../core/map-area'
import {
  aimedSpellTemplate,
  spellAreaPreview,
  previewScene,
  type AreaPreviewScene,
} from '../core/spell-area-preview'
import AreaOverlay from './AreaOverlay.vue'
const props = defineProps<{
  scene: AreaPreviewScene
  casterId: string
  spell: Spell
  busy?: boolean
  background?: string
  backgroundBlob?: Blob
  gm?: boolean
  revision?: number
  allowedIds?: string[]
}>()
const emit = defineEmits<{ apply: [template: MapTemplate, ids: string[]]; clear: [] }>()
const mapSelection=useMapSelection(),aimLocked=ref(false)
let inlineId:number|undefined
const blobUrl = ref('')
watch(
  () => props.backgroundBlob,
  (blob) => {
    if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
    blobUrl.value = blob ? URL.createObjectURL(blob) : ''
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
})
const mapBackground = computed(() => props.background || blobUrl.value)
const dialog = ref<HTMLDialogElement | null>(null),
  opened = ref(false),
  applied = ref(false)
const angle = ref(0),
  aim = ref<Position>({ x: 0, y: 0 }),
  selected = ref<string[]>([]),
  zoom = ref(1)
const from = computed(() => props.scene.tokens.find((t) => t.id === props.casterId))
const spec = computed(() => spellAreaSpec(props.spell))
const template = computed(() =>
  from.value && spec.value
    ? aimedSpellTemplate(props.scene, from.value, spec.value, aim.value, angle.value)
    : null,
)
const report = computed(() =>
  from.value && spec.value && template.value
    ? spellAreaPreview(props.scene, from.value, spec.value, template.value, props.gm)
    : null,
)
const visibleWalls = computed(() => previewScene(props.scene, props.gm).walls ?? [])
const candidates = computed(
  () =>
    report.value?.candidates.filter(
      (r) => !props.allowedIds || props.allowedIds.includes(r.token.id),
    ) ?? [],
)
const origin = computed(() =>
  template.value ? templateOrigin(props.scene.grid, template.value) : { x: 0, y: 0 },
)
const center = computed(() =>
  from.value
    ? { x: from.value.x + from.value.span / 2, y: from.value.y + from.value.span / 2 }
    : { x: 0, y: 0 },
)
const range = computed(() => (spec.value ? spec.value.range / props.scene.grid.feet : 0))
const guideTicks = computed(() =>
  [10, 20, 30, 60, 90, 120, 150].flatMap((feet) => {
    const x = center.value.x + feet / props.scene.grid.feet
    return feet <= (spec.value?.self ? spec.value.size : (spec.value?.range ?? 0)) &&
      x < props.scene.grid.columns
      ? [{ feet, x }]
      : []
  }),
)
const instructions = computed(() =>
  spec.value?.shape === 'emanation'
    ? '范围固定于施法者占格；核对名单后带入。'
    : spec.value?.self && ['cone', 'line'].includes(spec.value.shape)
      ? '点击网格确定方向；起点保持在施法者处。'
      : spec.value?.self
        ? '使用方向按钮调整施法者前方的范围。'
        : spec.value?.shape === 'cube' && spec.value.originRule !== 'center'
          ? '点击网格指定立方面原点，再选择展开方向。'
          : '点击网格指定范围中心。',
)
function chooseCandidates() {
  selected.value = candidates.value.filter((r) => r.eligible).map((r) => r.token.id)
}
watch(template, chooseCandidates)
async function open() {
  if (!from.value || !spec.value) return
  if(mapSelection?.current.value)return
  aim.value = { x: from.value.x, y: from.value.y }
  angle.value = 0
  zoom.value = 1
  opened.value = true
  await nextTick()
  chooseCandidates()
  aimLocked.value=false
  if(mapSelection?.start({kind:'area',label:from.value.name+' · '+props.spell.name+' · '+TEMPLATE_NAMES[spec.value.shape]+' '+spec.value.size+'尺',sceneId:props.scene.id,
    template:()=>template.value,selected:()=>selected.value,
    candidates:()=>candidates.value.filter(r=>r.eligible).map(r=>({id:r.token.id,name:r.token.name,x:r.token.x,y:r.token.y,span:r.token.span,kind:'entity' as const})),
    onPoint:p=>{aim.value=p;aimLocked.value=true},onHover:p=>{if(!aimLocked.value)aim.value=p},
    onEntity:id=>{if(!aimLocked.value){const t=props.scene.tokens.find(t=>t.id===id);if(t){aim.value={x:t.x,y:t.y};aimLocked.value=true}}else selected.value=selected.value.includes(id)?selected.value.filter(v=>v!==id):[...selected.value,id]},
    canConfirm:()=>!props.busy&&!!selected.value.length&&!report.value?.error,error:()=>report.value?.error??'',
    panel:()=>h('div',[h('p',instructions.value+'覆盖不等于最终生效，提交仍由原规则结算。'),h('p',`已选${selected.value.length}个目标；范围可能包含同伴或自身，请核对名单。`),h('label',['方向',h('select',{value:angle.value,onChange:(e:Event)=>angle.value=Number((e.target as HTMLSelectElement).value)},[0,90,180,270].map(a=>h('option',{value:a},a+'°')))]),h('button',{type:'button',onClick:()=>aimLocked.value=false},'重新瞄准'),h('button',{type:'button',onClick:chooseCandidates},'选择全部可达候选')]),
    onConfirm:apply,onCancel:()=>{inlineId=undefined;opened.value=false}})) {inlineId=mapSelection.current.value!.id;return}
  dialog.value?.showModal()
}
function close() {
  mapSelection?.cancelSession(inlineId)
  inlineId=undefined
  dialog.value?.close()
  opened.value = false
}
function clear() {
  applied.value = false
  emit('clear')
}
function apply() {
  if (!template.value || report.value?.error || props.busy || !selected.value.length) return
  const ids = candidates.value
    .filter((r) => r.eligible && selected.value.includes(r.token.id))
    .map((r) => r.token.id)
  if (!ids.length) return
  emit('apply', structuredClone(JSON.parse(JSON.stringify(template.value))), ids)
  applied.value = true
  close()
}
function click(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement,
    matrix = svg.getScreenCTM()
  if (!matrix) return
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  const x = Math.floor(p.x / 32),
    y = Math.floor(p.y / 32)
  if (x >= 0 && y >= 0 && x < props.scene.grid.columns && y < props.scene.grid.rows)
    aim.value = { x, y }
}
watch(
  () =>
    JSON.stringify([
      props.scene.id,
      props.casterId,
      props.spell.id,
      props.scene.grid,
      props.scene.tokens.map((t) => [t.id,t.x,t.y,t.span,t.hidden,t.spatial,t.npcBody?.dead,'statuses' in t?t.statuses:undefined]),
      props.scene.walls,
      props.scene.points,
      props.allowedIds,
    ]),
  () => {
    close()
    clear()
  },
)
onBeforeUnmount(()=>{if(inlineId===mapSelection?.current.value?.id)mapSelection?.cancel()})
</script>
<template>
  <div v-if="spec && from" class="spell-area-launch">
    <button type="button" class="secondary" :disabled="busy" @click="open">{{ controlText('resourceFlow.areaPreviewAndSelection') }}</button>
    <button v-if="applied" type="button" class="secondary" @click="clear">{{ controlText('resourceFlow.cancelThisAreaSelection') }}</button>
    <small v-if="applied">{{ controlText('resourceFlow.areaAndTargetsAppliedRulesMustStillBe') }}</small>
    <dialog
      ref="dialog"
      class="spell-area-dialog"
      :aria-label="controlText('remainingField.spellAreaSelector')"
      @close="opened = false"
      @cancel="opened = false"
    >
      <template v-if="opened && template">
        <header>
          <strong>{{ localizedEntryName(spell) }} · {{ uiLabel(TEMPLATE_NAMES[spec.shape]) }} {{ spec.size }} {{ controlText('game.feet') }}</strong
          ><button type="button" @click="close">{{ controlText('controls.cancel') }}</button>
        </header>
        <p>{{ controlText('scriptSummary.previewSpendsNoResources', {p0:(instructions)}) }}</p>
        <div class="area-toolbar">
          <span>{{ spec.self ? controlText('expressionFour.selfOrigin') : controlText('inlineSummary.spellRangeFtDashedOutline',{p0:(spec.range)}) }}</span>
          <label v-if="spec.shape === 'cube' && spec.originRule !== 'center'"
            >{{ controlText('remainingField.direction') }}<select v-model.number="angle" :aria-label="controlText('remainingField.areaDirection')">
              <option :value="0">{{ controlText('resourceFlow.right') }}</option>
              <option :value="90">{{ controlText('resourceFlow.down') }}</option>
              <option :value="180">{{ controlText('resourceFlow.left') }}</option>
              <option :value="270">{{ controlText('resourceFlow.up') }}</option>
            </select></label
          >
          <label
            >{{ controlText('remainingField.zoom') }}<select v-model.number="zoom" :aria-label="controlText('remainingField.areaPreviewZoom')">
              <option :value="0.75">75%</option>
              <option :value="1">100%</option>
              <option :value="1.5">150%</option>
            </select></label
          >
          <button type="button" @click="chooseCandidates">{{ controlText('resourceFlow.selectAllReachableCandidates') }}</button>
        </div>
        <div class="spell-area-canvas">
          <svg
            :viewBox="`0 0 ${scene.grid.columns * 32} ${scene.grid.rows * 32}`"
            :style="{ width: Math.max(600, scene.grid.columns * 32) * zoom + 'px' }"
            :aria-label="controlText('remainingField.clickMapToSelectSpellArea')"
            @click="click"
          >
            <rect :width="scene.grid.columns * 32" :height="scene.grid.rows * 32" fill="#263238" />
            <image
              v-if="mapBackground && scene.background"
              :href="mapBackground"
              :x="(scene.background.x - scene.grid.originX) * 32"
              :y="(scene.background.y - scene.grid.originY) * 32"
              :width="scene.background.width * 32"
              :height="scene.background.height * 32"
              preserveAspectRatio="none"
              :transform="`rotate(${scene.background.rotation} ${(scene.background.x + scene.background.width / 2 - scene.grid.originX) * 32} ${(scene.background.y + scene.background.height / 2 - scene.grid.originY) * 32})`"
            />
            <g stroke="#c6d4d9" stroke-opacity=".23" pointer-events="none">
              <line
                v-for="x in scene.grid.columns"
                :key="'x' + x"
                :x1="x * 32"
                :x2="x * 32"
                y1="0"
                :y2="scene.grid.rows * 32"
              />
              <line
                v-for="y in scene.grid.rows"
                :key="'y' + y"
                x1="0"
                :x2="scene.grid.columns * 32"
                :y1="y * 32"
                :y2="y * 32"
              />
            </g>
            <g
              fill="none"
              stroke="#ffdd83"
              stroke-width="1.5"
              stroke-dasharray="6 5"
              pointer-events="none"
            >
              <rect
                v-if="!spec.self"
                :x="(from.x - range) * 32"
                :y="(from.y - range) * 32"
                :width="(from.span + range * 2) * 32"
                :height="(from.span + range * 2) * 32"
              />
              <line x1="0" :x2="scene.grid.columns * 32" :y1="center.y * 32" :y2="center.y * 32" />
              <line :x1="center.x * 32" :x2="center.x * 32" y1="0" :y2="scene.grid.rows * 32" />
              <line
                :x1="center.x * 32"
                :y1="center.y * 32"
                :x2="origin.x * 32"
                :y2="origin.y * 32"
              />
            </g>
            <g
              v-for="tick in guideTicks"
              :key="tick.feet"
              pointer-events="none"
              fill="#ffdd83"
              stroke="#182a33"
              paint-order="stroke"
            >
              <text
                :x="tick.x * 32"
                :y="center.y * 32 - 8"
                text-anchor="middle"
                font-size="11"
                stroke-width="2"
              >
                {{ tick.feet }}{{ controlText('game.feet') }}
              </text>
            </g>
            <AreaOverlay :grid="scene.grid" :template="template" :size="32" />
            <g v-for="w in visibleWalls" :key="w.id" pointer-events="none">
              <line
                :x1="w.a.x * 32"
                :y1="w.a.y * 32"
                :x2="w.b.x * 32"
                :y2="w.b.y * 32"
                :stroke="w.state === 'open' ? '#8cd8c2' : '#e8ddd0'"
                stroke-width="3"
              />
            </g>
            <g
              v-for="t in scene.tokens.filter((t) => gm || !t.hidden)"
              :key="t.id"
              pointer-events="none"
            >
              <rect
                v-if="candidates.some((r) => r.token.id === t.id)"
                :x="t.x * 32 + 1"
                :y="t.y * 32 + 1"
                :width="t.span * 32 - 2"
                :height="t.span * 32 - 2"
                fill="none"
                :stroke="
                  candidates.find((r) => r.token.id === t.id)?.blocked ? '#ff9b8f' : '#70d6b0'
                "
                stroke-width="3"
              />
              <circle
                :cx="(t.x + t.span / 2) * 32"
                :cy="(t.y + t.span / 2) * 32"
                r="12"
                :fill="t.color"
                :stroke="t.id === casterId ? '#ffdd83' : '#fff'"
                :stroke-width="t.id === casterId ? 3 : 1"
              />
              <text
                :x="(t.x + t.span / 2) * 32"
                :y="(t.y + t.span / 2) * 32 + 23"
                text-anchor="middle"
                fill="white"
                stroke="#16242b"
                stroke-width="3"
                paint-order="stroke"
                font-size="11"
              >
                {{ localizedEntryName(t).slice(0, 12) }}
              </text>
            </g>
          </svg>
        </div>
        <p v-if="report?.error" role="alert" class="error">{{ displayFeedback(report.error,'error') }}</p>
        <fieldset>
          <legend>{{ controlText('scriptSummary.targetsGreenReachableRedBlockedAlliesMay', {p0:(selected.length)}) }}</legend>
          <label v-for="r in candidates" :key="r.token.id" class="check"
            ><input
              v-model="selected"
              type="checkbox"
              :value="r.token.id"
              :disabled="r.blocked"
            />{{ localizedEntryName(r.token) }}{{ r.blocked ? controlText('expressionFour.completelyBlocked') : '' }}</label
          >
          <span v-if="!candidates.length">{{ controlText('resourceFlow.noVisibleCandidatesInThisArea') }}</span>
        </fieldset>
        <footer>
          <small>{{ controlText('resourceFlow.planarCellPreviewTheGmVerifiesHeightExclusions') }}</small
          ><button
            type="button"
            :disabled="busy || !!report?.error || !selected.length"
            @click="apply"
          >
            {{ controlText('resourceFlow.applyAreaAndSelectedTargets') }}
          </button>
        </footer>
      </template>
    </dialog>
  </div>
</template>
<style scoped>
.spell-area-launch {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}
.spell-area-dialog {
  width: min(1000px, 94vw);
  max-height: 92dvh;
  padding: 16px;
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: auto;
  background: var(--panel);
}
.spell-area-dialog::backdrop {
  background: var(--overlay);
}
.spell-area-dialog header,
.spell-area-dialog footer,
.area-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}
.spell-area-dialog p {
  margin: 8px 0;
  font-size: 0.9rem;
}
.area-toolbar label {
  display: flex;
  gap: 6px;
  align-items: center;
}
.spell-area-dialog button,
.spell-area-dialog select {
  min-height: 36px;
  padding: 6px 10px;
  font-size: 0.9rem;
  width: auto;
  background: var(--button-bg);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: pointer;
}
.spell-area-dialog button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.spell-area-canvas {
  max-height: 50dvh;
  overflow: auto;
  background: var(--map-canvas);
  margin: 10px 0;
  border-radius: 6px;
}
.spell-area-canvas svg {
  display: block;
  max-width: none;
  touch-action: pan-x pan-y;
}
.spell-area-dialog fieldset {
  display: flex;
  gap: 8px 16px;
  flex-wrap: wrap;
  margin: 10px 0;
}
.spell-area-dialog .check {
  display: flex;
  align-items: center;
  gap: 5px;
}
.spell-area-dialog input[type='checkbox'] {
  width: 18px;
  height: 18px;
}
.spell-area-dialog :deep(.map-template) {
  fill: #e3ad4540;
  stroke: #ffdc8a;
  stroke-width: 2;
}
.spell-area-dialog footer small {
  flex: 1;
}
</style>
