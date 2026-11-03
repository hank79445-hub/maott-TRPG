<script setup lang="ts">
import {skillDisplayName} from './rule-presentation'
import {displayFeedback} from './feedback-presentation'
import {uiDate} from './locale-format'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {abilityDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {useSceneLightDebug} from './useSceneLightDebug'
import MapGammaControl from './MapGammaControl.vue'
import MapGammaFilter from './MapGammaFilter.vue'
import { useMapGamma } from './useMapGamma'
import {sceneRayView} from '../core/scene-ray-view'
import {tokenPoint} from '../core/scene-effects'
import {tokenM3State} from '../core/m3-map-perception'
import SceneEffectOverlay from './SceneEffectOverlay.vue'
import {addWideDoor,wideDoorGeometry,type DoorPreset} from '../core/wide-door'
const doorPreset=ref<DoorPreset>(),doorHover=ref<Position>()
const doorGhost=computed(()=>{if(!draft.value||!doorPreset.value||!doorHover.value||tool.value!=='door')return;try{return wideDoorGeometry(draft.value,doorHover.value,doorPreset.value)}catch{return undefined}})
import FogOfWarLayer from './FogOfWarLayer.vue'
import {projectSceneEffects} from '../core/scene-effect-view'
import PointItemsEditor from './scene-tools/PointItemsEditor.vue'
import PointItemPicker from './scene-tools/PointItemPicker.vue'
import PortalEditor from './PortalEditor.vue'
import PointLinkEditor from './scene-tools/PointLinkEditor.vue'
import DiscoveryConfigEditor from './scene-tools/DiscoveryConfigEditor.vue'
import PointLinkOverlay from './scene-tools/PointLinkOverlay.vue'
import { sceneWithoutPoint } from '../core/map-point-references'
import { useOperationFeedback } from '../app/useOperationFeedback'
import MapViewportControls from './MapViewportControls.vue'
import { useMapViewport } from './useMapViewport'
import {provideMapSelection,mapSurfaceId} from './map-selection/selection'
import {gmMapMarkers} from './map-selection/gmMapMarkers'
import {useSelectionSurface} from './map-selection/useSelectionSurface'
import MapSelectionBar from './map-selection/MapSelectionBar.vue'
import MapSelectionOverlay from './map-selection/MapSelectionOverlay.vue'
import MapFeedbackOverlay from './map-selection/MapFeedbackOverlay.vue'
import MapFeedbackControls from './map-selection/MapFeedbackControls.vue'
import { fitImage } from '../core/map-experience'
import { notifications } from '../app/notifications'
import MapEditorToolbar from './MapEditorToolbar.vue'
import { EDITOR_TOOL_NAMES, type MapPanelTool } from './map-editor-tools'
import SceneGmTools from './scene-tools/SceneGmTools.vue'
import ArrivalEditor from './scene-tools/ArrivalEditor.vue'
import GroundItemEditor from './scene-tools/GroundItemEditor.vue'
import SceneMarkers from './scene-tools/SceneMarkers.vue'
import CorpseMarkers from './CorpseMarkers.vue'
import { decodeFog } from '../core/fog'
import PointStoryEditor from './PointStoryEditor.vue'
import { computed, inject, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import MapResizeHandle from './workspace/MapResizeHandle.vue'
import WallEditor from './WallEditor.vue'
import CharacterAvatar from './CharacterAvatar.vue'
import { tokenPortrait } from '../core/portraits'
import BattleSessionsPanel from './BattleSessionsPanel.vue'
import BroadcastPanel from './BroadcastPanel.vue'
import NpcConfigTools from './config-imports/NpcConfigTools.vue'
import { ApiError } from '../online/client'
import '../app/broadcast.css'
import TemplateEditor from './TemplateEditor.vue'
import AreaOverlay from './AreaOverlay.vue'
import { areaTargets } from '../core/map-area'
import { newWall, wallState, sightLine, blockerNames } from '../core/map-spatial'
import { prepareMapImage, previewFits } from './map-images'
import { cellAtPixel, gridOffset, gridSize } from '../core/map-view'
import { MAP_ARCHIVE_BYTES, MAP_TOTAL_IMAGE_BYTES } from '../core/map-limits'
import { layoutMapNames, nameTextColor, type MapName } from '../core/map-labels'
import { useWorkshop } from '../app/store'
import PointReviewSettings from './PointReviewSettings.vue'
import { srd } from '../content/srd'
import { clone, catalogue } from '../core/engine'
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../core/types'
import { runtimeDerived, runtimeState, resources } from '../core/runtime'
import { combatStats, customNpc } from '../core/combat-rules'
import { CONDITIONS } from '../content/conditions'
import {
  key,
  position,
  regionsAt,
  tagsAt,
  distance,
  directPath,
  pathCost,
  occupancyRules,
  newPoint,
} from '../core/map'
import {
  TERRAIN,
  TERRAIN_NAMES,
  type MapCommand,
  type MapScene,
  type MapPoint,
  type Position,
  type Terrain,
  type MapAsset,
  type MapAnnotation,
} from '../core/map-types'
const props = defineProps<{
  fogPreview?: import('../persistence/fog-schema').FogView
  initialAdventureId?: string
  initialSceneId?: string
  workshop?: ReturnType<typeof useWorkshop>
  online?: boolean
  canUndo?: boolean
  designOnly?: boolean
  compactRail?: boolean
  corpses?: import("../server/room-corpses").CorpseView[]
  inspectorTarget?: string
}>()
const visibleCorpses = computed(() => {
  const rows = props.corpses ?? []
  if (mode.value !== 'preview' || !props.fogPreview) return rows
  const known = decodeFog(props.fogPreview.visible, props.fogPreview.columns, props.fogPreview.rows)
  return rows.filter(c => known.has(Math.floor(c.x) + ',' + Math.floor(c.y)))
})
const sceneTools = ref<InstanceType<typeof SceneGmTools> | null>(null)
const store = props.workshop ?? useWorkshop(),
  emit = defineEmits<{
    view: [id: string]
    battle: [id: string]
    selection: [adventureId: string, sceneId: string]
    importCharacters: []
    inspector: []
    corpse: [string]
  }>()
const adventureId = ref(props.initialAdventureId ?? ''),
  sceneId = ref(props.initialSceneId ?? ''),
  adventureName = ref('新的冒险'),
  sceneName = ref('新的场景'),
  feedback = ref(''),
  failed = ref(false),
  busy = ref(false)
const adventure = computed(() => store.adventures.find((a) => a.id === adventureId.value)),
  scene = computed(() => adventure.value?.scenes.find((s) => s.id === sceneId.value)),
  encounter = computed(() => store.encounters.find((e) => e.id === scene.value?.encounterId))
const showEffectRegions=ref(true),showEffectLighting=ref(true)
const mapGamma = useMapGamma(() => adventureId.value + ':' + sceneId.value)
const gammaFilterId = mapSurfaceId('map-gamma')
const mapEffects=computed(()=>adventure.value&&scene.value?projectSceneEffects(configWorld.value,adventure.value,scene.value,catalogue([srd,...store.packs]),true,[]):undefined)
const configWorld = computed(() => ({
  adventures: store.adventures,
  characters: store.characters,
  encounters: store.encounters,
  packs: store.packs,
}))
const lightDebug=useSceneLightDebug(()=>configWorld.value,()=>adventure.value,()=>viewScene.value)
const sceneItems = computed(() => [
  ...new Map(
    [
      ...catalogue([srd, ...store.packs]).items.filter((i) => i.kind !== 'pack'),
      ...store.characters.flatMap((c) => c.build.customItems),
    ].map((i) => [i.id, i]),
  ).values(),
])
const mode = ref<'edit' | 'run' | 'preview'>('edit'),
  tab = ref<
    'scene' | 'terrain' | 'point' | 'token' | 'annotation' | 'wall' | 'area' | 'save' | 'setup'
  >('scene'),
  tool = ref<
    | 'select'
    | 'move'
    | 'path'
    | 'brush'
    | 'rect'
    | 'point'
    | 'annotation'
    | 'measure'
    | 'grid'
    | 'wall'
    | 'door'
    | 'sight'
  >('select')
const sidebarOpen = ref(
    !props.compactRail && (typeof window === 'undefined' || window.innerWidth > 650),
  ),
  inspectorOpen = ref(
    !props.compactRail && (typeof window === 'undefined' || window.innerWidth > 650),
  ),
  focused = ref(false),
  sceneSearch = ref('')
const inspectorMinimized = ref(false),
  quickSceneMode = ref('')
const filteredScenes = computed(
  () =>
    adventure.value?.scenes.filter((s) =>
      s.name.toLocaleLowerCase().includes(sceneSearch.value.trim().toLocaleLowerCase()),
    ) ?? [],
)
function showInspector(next: typeof tab.value) {
  if(props.inspectorTarget)emit('inspector')
  inspectorOpen.value = true
  inspectorMinimized.value = false
  tab.value = next
}
function stopTools() {
  sceneTools.value?.cancel()
  quickSceneMode.value = ''
  tool.value = 'select'
  wallStart.value = null
}
function chooseEditorTool(id: MapPanelTool) {
  sceneTools.value?.cancel()
  if (id === 'wall' || id === 'door') drawWall(id)
  else if (id === 'sight') startSight()
  else if (id === 'grid') alignGrid()
  else if (id === 'annotation') addAnnotation()
  else {
    tool.value = id
    if (id === 'point') showInspector('point')
    else if (id === 'rect' || id === 'brush') showInspector('terrain')
    else if (id === 'move' || id === 'path') showInspector('token')
  }
  if (!['select', 'measure', 'sight'].includes(id)) inspectorOpen.value = true
}
async function openSetup(kind: 'place' | 'relocate' | 'config') {
  if(props.inspectorTarget)emit('inspector')
  stopTools()
  inspectorOpen.value = true
  tab.value = 'setup'
  await nextTick()
  if (kind !== 'config') sceneTools.value?.openMode(kind)
}
watch(inspectorOpen, (open) => {
  inspectorMinimized.value = false
  if (!open) stopTools()
})
watch(tab, (value, old) => {
  if (old === 'setup' && value !== 'setup') sceneTools.value?.cancel()
  inspectorOpen.value = true
})
watch(mode, () => stopTools())

const baseline = ref<MapScene | null>(null),
  savingScene = ref(false),
  saveFailed = ref(false)
const draft = ref<MapScene | null>(null),
  party = ref<string[]>([]),
  tokenId = ref(''),
  pointId = ref(''),
  annotationId = ref(''),
  regionId = ref(''),
  wallId = ref(''),
  wallStart = ref<Position | null>(null),
  selectedCells = ref<string[]>([]),
  cursor = ref<Position>(
    store.adventures.find((a) => a.id === props.initialAdventureId)?.sourceScript?.landing ?? {
      x: 1,
      y: 1,
    },
  )

watch([tokenId, pointId, wallId, annotationId, regionId], (ids, old) => {

  if (old.some(Boolean) && ids.some((id, i) => id && id !== old[i])) inspectorOpen.value = true
})
const baselineJson = computed(() => JSON.stringify(baseline.value))
const dirty = computed(() => JSON.stringify(draft.value) !== baselineJson.value)
const saveStatus = computed(() =>
  savingScene.value
    ? '正在保存'
    : busy.value
      ? '正在处理'
      : dirty.value
        ? saveFailed.value
          ? '保存失败，修改已保留'
          : '有未保存修改'
        : '已保存',
)
const viewScene = computed(() => (mode.value === 'edit' && draft.value ? draft.value : scene.value))
const token = computed(() =>
    scene.value?.tokens.find(
      (t) => t.id === tokenId.value && (mode.value !== 'preview' || !t.hidden),
    ),
  ),
  point = computed(() =>
    viewScene.value?.points.find(
      (p) => p.id === pointId.value && (mode.value !== 'preview' || (!p.hidden && p.enabled)),
    ),
  )
const annotation = computed(() =>
  ((mode.value === 'preview' ? scene.value?.annotations : draft.value?.annotations) ?? []).find(
    (a) => a.id === annotationId.value && (mode.value !== 'preview' || !a.hidden),
  ),
)
const pointDirty = computed(
  () =>
    !point.value ||
    JSON.stringify(point.value) !==
      JSON.stringify(scene.value?.points.find((p) => p.id === pointId.value)),
)
const tokenDraft = ref<typeof token.value>(),
  recipient = ref(''),
  interactionItems = ref<string[]>([]),
  interactionCosts = ref(false),
  interactionLimits=ref<Record<string,number>>({}),
  bypassItemConditions=ref(false),
  gm = ref(false),
  reason = ref(''),
  reactionsConfirmed = ref(false),
  waypoints = ref<Position[]>([]),
  measures = ref<Position[]>([])
const regionName = ref('高点区域'),
  regionTags = ref<Terrain[]>(['high']),
  regionColor = ref('#d2a855'),
  regionHeight = ref<number | null>(null),
  regionJumpable = ref(false),
  regionHidden = ref(false),
  regionNote = ref('')
const pointKind = ref<MapPoint['kind']>('chest'),
  lootItem = ref('torch'),
  lootQuantity = ref(1),
  cpId = ref(''),
  cpName = ref(''),
  cpPinned = ref(false),
  existingEncounterId = ref(''),
  npc = ref(customNpc())
const ask = (message: string) => window.confirm(message),
  terrainLabel = (tags: Terrain[]) => tags.map((t) => uiLabel(TERRAIN_NAMES[t])).join('／')
const checkpointSceneName = computed(
  () =>
    checkpoint.value?.snapshot.adventure.scenes.find((s) => s.id === checkpoint.value?.sceneId)
      ?.name,
)
const checkpoint = computed(() => adventure.value?.checkpoints.find((c) => c.id === cpId.value)),
  allItems = computed(() =>
    [
      ...store.content.items,
      ...(adventure.value?.party.flatMap(
        (id) => store.characters.find((c) => c.id === id)?.build.customItems ?? [],
      ) ?? []),
    ].filter((i) => i.kind !== 'pack'),
  )
const svg = ref<SVGSVGElement | null>(null),
  viewport = ref<HTMLDivElement | null>(null),
  zoom = ref(0.5),
  pendingImage = ref<MapAsset | null>(null),
  pendingUrl = ref(''),
  imageUrls = ref<Record<string, string>>({}),
  previewUrls = ref<Record<string, string>>({}),
  pendingPreviewUrl = ref(''),
  importMode = ref<'original' | 'optimized'>('original'),
  imageQuality = ref<'auto' | 'preview' | 'original'>('auto'),
  imageProgress = ref(''),
  importingName = ref(''),
  hoveredName = ref('')
const showNames = ref(localStorage.getItem('map-show-names') !== 'false')
watch(showNames, (value) => localStorage.setItem('map-show-names', String(value)))
const imageBytes = computed(() =>
  store.assets.reduce((sum, a) => sum + a.blob.size + (a.preview?.blob.size ?? 0), 0),
)
const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + ' MB'
const calibration = ref({ pixels: 64, feet: 5, anchorX: 0, anchorY: 0 })
const shownTokens = computed(
    () => scene.value?.tokens.filter((t) => mode.value !== 'preview' || !t.hidden) ?? [],
  ),
  shownPoints = computed(
    () =>
      viewScene.value?.points.filter(
        (p) => mode.value === 'edit' || (p.enabled && (mode.value !== 'preview' || !p.hidden)),
      ) ?? [],
  ),
  shownRegions = computed(
    () => viewScene.value?.regions.filter((r) => mode.value !== 'preview' || !r.hidden) ?? [],
  )
const shownAnnotations = computed(() =>
  (viewScene.value?.annotations ?? []).filter((a) => mode.value !== 'preview' || !a.hidden),
)
const shownWalls = computed(() =>
  (viewScene.value?.walls ?? []).filter((w) => mode.value !== 'preview' || !w.hidden),
)
const sightPreview = computed(() => {
  if (!viewScene.value || measures.value.length !== 2) return null
  const [a, b] = measures.value,
    fromToken=viewScene.value.tokens.find((t)=>t.x===a!.x&&t.y===a!.y),toToken=viewScene.value.tokens.find((t)=>t.x===b!.x&&t.y===b!.y),
    from=fromToken??a!,to=toToken??b!
  return {
    dynamic:adventure.value?sceneRayView(configWorld.value,adventure.value,viewScene.value,fromToken?tokenPoint(fromToken):{x:from.x+.5,y:from.y+.5,height:0},toToken?tokenPoint(toToken):{x:to.x+.5,y:to.y+.5,height:0},'visual',fromToken?tokenM3State(configWorld.value,adventure.value,fromToken,catalogue([srd,...store.packs])):{}):undefined,
    sight: sightLine(viewScene.value, from, to),
    targeting: sightLine(viewScene.value, from, to, 'blocksTargeting'),
  }
})
function drawWall(kind: 'wall' | 'door',preset?:DoorPreset) {
  doorPreset.value=preset;doorHover.value=undefined
  tool.value = kind
  showInspector('wall')
  wallStart.value = null
}
function selectWall(id = wallId.value) {
  wallId.value = id
  showInspector('wall')
  tool.value = 'select'
  wallStart.value = null
}
function startSight() {
  tool.value = 'sight'
  measures.value = []
}
const visibleMapNames=computed(()=>{
  const names: MapName[] = [
    ...shownTokens.value.map((t) => ({
      key: 'token:' + t.id,
      kind: 'token' as const,
      id: t.id,
      name: t.name,
      x: ((t.x + t.span / 2) * gridPixels.value + offset.value.x) * zoom.value,
      y: ((t.y + t.span / 2) * gridPixels.value + offset.value.y) * zoom.value,
      color: '#304957',
      fontSize: 14,
    })),
    ...shownPoints.value.map((p) => ({
      key: 'point:' + p.id,
      kind: 'point' as const,
      id: p.id,
      name: p.name,
      x: ((p.x + 0.5) * gridPixels.value + offset.value.x) * zoom.value,
      y: ((p.y + 0.5) * gridPixels.value + offset.value.y) * zoom.value,
      color: '#59452d',
      fontSize: 14,
    })),
    ...shownAnnotations.value.map((a) => ({
      ...a,
      key: 'annotation:' + a.id,
      kind: 'annotation' as const,
      x: ((a.x + 0.5) * gridPixels.value + offset.value.x) * zoom.value,
      y: ((a.y + 0.5) * gridPixels.value + offset.value.y) * zoom.value,
    })),
  ]
  return names
})
let namesGeometry=''
const namesCache=new Map<string,ReturnType<typeof layoutMapNames>>()
const nameLayout=computed(()=>{
  if(!scene.value||!showNames.value)return {placed:[],omitted:[]}
  const selected =
    hoveredName.value ||
    (tab.value === 'point'
      ? 'point:' + pointId.value
      : tab.value === 'annotation'
        ? 'annotation:' + annotationId.value
        : tab.value === 'token'
          ? 'token:' + tokenId.value
          : '')
  const names=visibleMapNames.value,geometry=JSON.stringify(names)
  if(geometry!==namesGeometry){namesGeometry=geometry;namesCache.clear()}
  const key=selected+':'+canvasWidth.value*zoom.value+':'+canvasHeight.value*zoom.value
  let value=namesCache.get(key)
  if(!value){value=layoutMapNames(names.map(n=>({...n,selected:n.key===selected})),canvasWidth.value*zoom.value,canvasHeight.value*zoom.value);namesCache.set(key,value);if(namesCache.size>8)namesCache.delete(namesCache.keys().next().value!)}
  return value
})
function selectName(kind: MapName['kind'], id: string) {
  if (kind === 'token') {
    tokenId.value = id
    if (sceneTools.value?.isActive()) {
      inspectorOpen.value = true
      return
    }
    showInspector('token')
  } else if (kind === 'point') {
    pointId.value = id
    showInspector('point')
  } else {
    annotationId.value = id
    showInspector('annotation')
  }
}
const viewGrid = computed(() => viewScene.value!.grid)
const gridPixels = computed(() => gridSize(viewGrid.value))
const canvasWidth = computed(() => viewGrid.value.columns * Math.max(64, gridPixels.value))
const canvasHeight = computed(() => viewGrid.value.rows * Math.max(64, gridPixels.value))
const mapHeights = inject<{ gm: Ref<number>; player: Ref<number> } | null>('trpg-map-heights', null)
const mapH = mapHeights?.gm
function applyMapHeight(value: number) {
  if (mapH) mapH.value = value
}
const mapViewportStyle = computed(() => (mapH ? { height: mapH.value + 'px' } : undefined))
const mapViewport = useMapViewport(
  viewport,
  () => `gm:${adventureId.value}:${sceneId.value}:${mode.value}`,
  () => ({
    width: viewScene.value ? canvasWidth.value : 0,
    height: viewScene.value ? canvasHeight.value : 0,
  }),
  zoom,
  () => stopPointer(),
)
const offset = computed(() => gridOffset(viewGrid.value))
const selectionMapId=mapSurfaceId('gm-map')
const mapSelection=provideMapSelection(()=>`${adventureId.value}:${sceneId.value}`)
useSelectionSurface(svg,{id:selectionMapId,gm:true,scene:()=>viewScene.value?{...viewScene.value,corpses:props.corpses,registeredMarkers:gmMapMarkers(viewScene.value,adventure.value),sceneEffects:mapEffects.value,spatialObjects:adventure.value?.m3?.entities.filter(e=>e.enabled&&e.sceneId===viewScene.value!.id)}:undefined,activate:()=>{if(!mapViewport.active.value)mapViewport.toggle()},focus:()=>{viewport.value?.scrollIntoView({block:'center'});svg.value?.setAttribute('tabindex','0');svg.value?.focus({preventScroll:true})}},mapSelection)
const cells = computed(() => {
  if (!viewScene.value) return []
  const { columns, rows } = viewGrid.value
  if (
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 1 ||
    rows < 1 ||
    columns > 100 ||
    rows > 100
  )
    return []
  return Array.from({ length: columns * rows }, (_, i) => ({
    x: i % columns,
    y: Math.floor(i / columns),
  }))
})
const background = computed(() => viewScene.value?.background)
const currentImage = computed(() =>
  pendingImage.value?.id === background.value?.assetId
    ? pendingImage.value
    : store.assets.find((a) => a.id === background.value?.assetId),
)
const usingPreview = computed(() => {
  const a = currentImage.value,
    bg = background.value
  if (!a?.preview || !bg || imageQuality.value === 'original') return false
  return (
    imageQuality.value === 'preview' ||
    previewFits(
      a,
      bg.width * 64 * zoom.value * window.devicePixelRatio,
      bg.height * 64 * zoom.value * window.devicePixelRatio,
    )
  )
})
const imageUrl = computed(() =>
  pendingImage.value?.id === background.value?.assetId
    ? usingPreview.value
      ? pendingPreviewUrl.value
      : pendingUrl.value
    : ((usingPreview.value ? previewUrls.value : imageUrls.value)[
        background.value?.assetId ?? ''
      ] ?? ''),
)
const imageError = ref('')
watch(imageUrl, () => {
  imageError.value = ''
})
const backgroundError = computed(() =>
  background.value && !currentImage.value
    ? '背景图片资源缺失；请重新导入图片或恢复有效归档。'
    : imageError.value,
)
function imageLoadError(event: Event) {
  if ((event.target as SVGImageElement).getAttribute('href') === imageUrl.value)
    imageError.value = '背景图片无法显示；请重新导入图片或切换背景清晰度后重试。'
}
const actor = computed(() => encounter.value?.actors.find((a) => a.id === token.value?.actorId)),
  character = computed(() => store.characters.find((c) => c.id === token.value?.characterId))
const tokenPortraits = computed(
  () =>
    new Map(
      shownTokens.value.map((t) => [
        t.id,
        adventure.value
          ? tokenPortrait(
              {
                adventures: store.adventures,
                characters: store.characters,
                encounters: store.encounters,
                packs: store.packs,
              },
              adventure.value,
              t,
            )
          : null,
      ]),
    ),
)
const stats = computed(() => {
  if (actor.value) return combatStats(actor.value, store.characters, store.content)
  if (character.value) {
    const d = runtimeDerived(character.value, store.content),
      r = runtimeState(character.value, store.content)
    return {
      ...d,
      name: character.value.build.name,
      maxHp: d.hp,
      hp: r.hp,
      temporaryHp: r.temporaryHp,
    }
  }
  return null
})
const route = computed(() => {
  if (!token.value) return []
  let from: Position = token.value
  const result: Position[] = []
  for (const waypoint of waypoints.value) {
    result.push(...directPath(from, waypoint))
    from = waypoint
  }
  return result
})
const movePreview = computed(() => {
  if (!scene.value || !token.value || !route.value.length) return { cost: 0, error: '' }
  try {
    if (!gm.value && stats.value?.speed === 0)
      throw new Error('当前速度为零；强制位移请使用 GM 调整')
    return {
      cost: pathCost(
        scene.value,
        token.value,
        route.value,
        gm.value,
        !gm.value && !!stats.value?.conditions.includes('prone'),
        occupancyRules(
          scene.value,
          token.value,
          {
            adventures: store.adventures,
            characters: store.characters,
            encounters: store.encounters,
            packs: store.packs,
          },
          store.content,
        ),
        {world:{adventures:store.adventures,characters:store.characters,encounters:store.encounters,packs:store.packs},adventure:adventure.value!},
      ),
      error: '',
    }
  } catch (e) {
    return { cost: 0, error: String((e as Error).message) }
  }
})
const areaReport = computed(() =>
  viewScene.value
    ? areaTargets(viewScene.value).filter((r) => mode.value !== 'preview' || !r.token.hidden)
    : [],
)
const candidates = computed(() => areaReport.value.filter((r) => r.eligible).map((r) => r.token))
const itemName = (id: string) => allItems.value.find((i) => i.id === id)?.name ?? id
watch(
  () => store.adventures.map((a) => a.id),
  (ids) => {
    if (!ids.includes(adventureId.value)) adventureId.value = ids.at(-1) ?? ''
  },
  { immediate: true },
)
watch(
  adventureId,
  () => {
    sceneId.value = adventure.value?.scenes.some((s) => s.id === props.initialSceneId)
      ? props.initialSceneId!
      : (adventure.value?.activeSceneId ??
        adventure.value?.sourceScript?.startSceneId ??
        adventure.value?.scenes[0]?.id ??
        '')
    party.value = [...(adventure.value?.party ?? [])]
    cpId.value = ''
    tokenId.value = ''
    pointId.value = ''
    annotationId.value = ''
    clearImage()
  },
  { immediate: true },
)
watch(
  () => scene.value,
  () => {
    if (savingScene.value && draft.value?.id === scene.value?.id) return
    if (!dirty.value || draft.value?.id !== scene.value?.id) {
      draft.value = scene.value ? clone(scene.value) : null
      saveFailed.value = false
    } else if (draft.value && scene.value) {
      draft.value.tokens = clone(scene.value.tokens)
      draft.value.encounterId = scene.value.encounterId
    }
    baseline.value = scene.value ? clone(scene.value) : null
    if (!scene.value?.tokens.some((t) => t.id === tokenId.value))
      tokenId.value = scene.value?.tokens[0]?.id ?? ''
    if (!draft.value?.points.some((p) => p.id === pointId.value)) pointId.value = ''
    if (!draft.value?.annotations?.some((a) => a.id === annotationId.value)) annotationId.value = ''
    waypoints.value = []
    selectedCells.value = []
    regionId.value = ''
  },
  { immediate: true },
)
watch(
  sceneId,
  async () => {
    wallStart.value = null
    wallId.value = ''
    clearImage()
    measures.value = []
    await nextTick()
  },
  { immediate: true },
)
watch(
  token,
  () => {
    tokenDraft.value = token.value ? clone(token.value) : undefined
    waypoints.value = []
    reactionsConfirmed.value = false
    if (token.value?.characterId) recipient.value = token.value.characterId
  },
  { immediate: true },
)
watch(checkpoint, () => {
  cpName.value = checkpoint.value?.name ?? ''
  cpPinned.value = checkpoint.value?.pinned ?? false
})
const imageBlobs = new Map<string, Blob>()
watch(
  () => store.assets.map((a) => [a.id, a.blob] as const),
  (entries) => {
    const ids = entries.map(([id]) => id)
    const next = { ...imageUrls.value }
    for (const id of Object.keys(next))
      if (!ids.includes(id)) {
        URL.revokeObjectURL(next[id]!)
        delete next[id]
      }
    for (const a of store.assets)
      if (!next[a.id] || imageBlobs.get(a.id) !== a.blob) {
        if (next[a.id]) URL.revokeObjectURL(next[a.id]!)
        next[a.id] = URL.createObjectURL(a.blob)
        imageBlobs.set(a.id, a.blob)
      }
    imageUrls.value = next
    const previews = { ...previewUrls.value }
    for (const id of Object.keys(previews))
      if (!ids.includes(id)) {
        URL.revokeObjectURL(previews[id]!)
        delete previews[id]
      }
    for (const a of store.assets)
      if (a.preview && !previews[a.id]) previews[a.id] = URL.createObjectURL(a.preview.blob)
    previewUrls.value = previews
  },
  { immediate: true },
)
const escapeLayout = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    focused.value = false
    stopTools()
  }
}
if (typeof window !== 'undefined') window.addEventListener('keydown', escapeLayout)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', escapeLayout)
  clearImage()
  Object.values(imageUrls.value).forEach(URL.revokeObjectURL)
  Object.values(previewUrls.value).forEach(URL.revokeObjectURL)
})
watch([adventureId, sceneId], () => emit('selection', adventureId.value, sceneId.value), {
  immediate: true,
})
watch(mode, () => {
  wallStart.value = null
  tool.value = 'select'
  selectedCells.value = []
  waypoints.value = []
})
function clearImage() {
  if (pendingUrl.value) URL.revokeObjectURL(pendingUrl.value)
  if (pendingPreviewUrl.value) URL.revokeObjectURL(pendingPreviewUrl.value)
  pendingPreviewUrl.value = ''
  pendingUrl.value = ''
  pendingImage.value = null
}
async function task(fn: () => Promise<unknown>, success = '已保存') {
  if (busy.value) return false
  busy.value = true
  feedback.value = ''
  try {
    await fn()
    failed.value = false
    feedback.value = success
    return true
  } catch (e) {
    failed.value = true
    feedback.value =
      (/保存|载入|导入/.test(success) ? '保存／导入未完成：' : '') +
      (e instanceof Error ? e.message : String(e))
    return false
  } finally {
    busy.value = false
  }
}
async function ensureSceneSaved() {
  if (busy.value) return false
  return !dirty.value || (await saveScene())
}
defineExpose({ flush: ensureSceneSaved, dirty, selectScene, openInspector: () => (inspectorOpen.value = true) })
async function run(c: MapCommand) {
  if (!adventure.value || !(await ensureSceneSaved())) return false
  const id = adventure.value.id
  const ok = await task(() => store.mapOperate(id, c), '')
  if (ok) feedback.value = store.adventures.find((a) => a.id === id)?.log.at(-1)?.detail ?? '已保存'
  return ok
}
async function configCommand(c: MapCommand) {
  if (!adventure.value || !(await ensureSceneSaved()))
    throw new ApiError('请先保存场景，再刷新导入预检', 400)
  try {
    await store.mapOperate(adventure.value.id, c)
    return true
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : String(e), 400)
  }
}
async function saveScene() {
  if (!draft.value) return false
  return saveSceneCandidate(draft.value)
}
async function deleteSelectedPoint() {
  if (!draft.value || busy.value) return
  let next: typeof draft.value
  try {
    next = sceneWithoutPoint(draft.value, pointId.value)
  } catch (e) {
    await task(async () => {
      throw e
    })
    return
  }
  await saveSceneCandidate(next, true)
}
async function saveSceneCandidate(
  candidate: NonNullable<typeof draft.value>,
  preserveOnFailure = false,
) {
  if (!draft.value || !adventure.value || busy.value) return false
  const next = clone(candidate),
    image = pendingImage.value?.id === next.background?.assetId ? pendingImage.value : null,
    targetAdventure = adventureId.value,
    targetScene = sceneId.value
  savingScene.value = true
  const ok = await task(async () => {
    const spacing = next.grid.cellPixels ?? 64
    if (!Number.isFinite(spacing) || spacing < 32 || spacing > 256)
      throw new Error('叠加网格间距须为 32–256 像素')
    const width = next.grid.strokeWidth ?? 1
    if (!Number.isFinite(width) || width < 0.5 || width > 6)
      throw new Error('网格线宽须为 0.5–6 像素')
    if (
      [next.grid.offsetX ?? 0, next.grid.offsetY ?? 0].some(
        (n) => !Number.isFinite(n) || Math.abs(n) > 5000,
      )
    )
      throw new Error('网格偏移须为 −5000 至 5000 像素')
    if (image) await store.mapBackground(targetAdventure, targetScene, image, next)
    else await store.mapOperate(targetAdventure, { type: 'scene-edit', scene: next })
    await nextTick()
  }, '场景配置已保存')
  if (targetAdventure === adventureId.value && targetScene === sceneId.value) {
    await nextTick()
    baseline.value = scene.value ? clone(scene.value) : null
    draft.value = ok ? clone(scene.value!) : preserveOnFailure ? draft.value : next
    saveFailed.value = !ok
    if (ok) clearImage()
  }
  savingScene.value = false
  return ok
}
async function openCharacter() {
  const id = token.value?.characterId
  if (id && (await ensureSceneSaved())) emit('view', id)
}
async function openBattle() {
  const id = encounter.value?.id
  if (id && (await ensureSceneSaved())) emit('battle', id)
}
async function changeMode(next: typeof mode.value) {
  if (await ensureSceneSaved()) mode.value = next
}
async function selectScene(id: string) {
  if (id !== sceneId.value && (await ensureSceneSaved())) sceneId.value = id
}
async function changeAdventure(event: Event) {
  const select = event.target as HTMLSelectElement,
    id = select.value
  select.value = adventureId.value
  if (id !== adventureId.value && (await ensureSceneSaved())) adventureId.value = id
}
async function createAdventure() {
  if (!(await ensureSceneSaved())) return
  await task(async () => {
    adventureId.value = await store.createAdventure(adventureName.value)
  }, '冒险已创建，请配置队伍与场景')
}
async function addScene() {
  const ok = await run({ type: 'scene-add', name: sceneName.value })
  if (ok) sceneId.value = adventure.value!.scenes.at(-1)!.id
}
function fitView() {
  void mapViewport.fit()
}
function changeZoom(n: number) {
  void mapViewport.setZoom(zoom.value + n)
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file || !draft.value || busy.value) return
  const targetAdventure = adventureId.value,
    targetScene = sceneId.value,
    configuration = draft.value
  importingName.value = file.name + ' · ' + megabytes(file.size)
  await task(async () => {
    const image = await prepareMapImage(file, importMode.value === 'optimized', (step) => {
      imageProgress.value = step
    })
    if (
      targetAdventure !== adventureId.value ||
      targetScene !== sceneId.value ||
      draft.value !== configuration
    )
      throw new Error('场景已切换，请在目标场景重新选择背景')
    if (
      imageBytes.value + image.blob.size + (image.preview?.blob.size ?? 0) >
      MAP_TOTAL_IMAGE_BYTES
    )
      throw new Error('全部背景（含预览）最多 200 MB；请清理不用的冒险、入场点或撤销记录')
    clearImage()
    pendingImage.value = image
    pendingUrl.value = URL.createObjectURL(image.blob)
    if (image.preview) pendingPreviewUrl.value = URL.createObjectURL(image.preview.blob)
    const fitted = fitImage(
      image.width,
      image.height,
      configuration.grid.columns * Math.max(64, gridSize(configuration.grid)),
      configuration.grid.rows * Math.max(64, gridSize(configuration.grid)),
      'cover',
    )
    configuration.background = {
      assetId: image.id,
      x: configuration.grid.originX + fitted.x / 64,
      y: configuration.grid.originY + fitted.y / 64,
      width: fitted.width / 64,
      height: fitted.height / 64,
      rotation: 0,
      locked: false,
      clip: true,
    }
    if (fitted.cropped)
      notifications.push(
        '背景已等比铺满；边缘在场景外裁剪，源图保留。可选择完整显示或手动对齐',
        'warning',
        { persistent: true },
      )
  }, '图片已载入预览；调整后点击“保存场景配置”正式应用')
  imageProgress.value = ''
}
function addAnnotation() {
  tool.value = 'annotation'
  showInspector('annotation')
}
async function removeAnnotation() {
  if (!draft.value || !annotation.value) return
  draft.value.annotations = (draft.value.annotations ?? []).filter(
    (a) => a.id !== annotationId.value,
  )
  annotationId.value = ''
  await saveScene()
}
function fitBackground(fit: 'cover' | 'contain' = 'cover') {
  const scene = draft.value,
    bg = scene?.background
  if (!scene || !bg || bg.locked) return
  const image = pendingImage.value ?? store.assets.find((a) => a.id === bg.assetId)
  if (!image) return
  const fitted = fitImage(
    image.width,
    image.height,
    scene.grid.columns * Math.max(64, gridSize(scene.grid)),
    scene.grid.rows * Math.max(64, gridSize(scene.grid)),
    fit,
  )
  Object.assign(bg, {
    x: scene.grid.originX + fitted.x / 64,
    y: scene.grid.originY + fitted.y / 64,
    width: fitted.width / 64,
    height: fitted.height / 64,
    rotation: 0,
    clip: true,
  })
  notifications.push(
    fitted.cropped
      ? '已重新铺满预览：边缘裁剪，保存后生效；源图保留'
      : '已完整显示预览，保存后生效',
    fitted.cropped ? 'warning' : 'info',
  )
}
function calibrateBackground() {
  const s = draft.value,
    bg = s?.background
  if (!s || !bg || bg.locked) return
  const image = pendingImage.value ?? store.assets.find((a) => a.id === bg.assetId),
    c = calibration.value,
    pixelsPerCell = (c.pixels * s.grid.feet) / c.feet
  if (
    !image ||
    ![c.pixels, c.feet, c.anchorX, c.anchorY, pixelsPerCell].every(Number.isFinite) ||
    c.pixels <= 0 ||
    c.feet <= 0
  ) {
    feedback.value = '请填写有效的图片像素距离和对应尺数'
    failed.value = true
    return
  }
  bg.width = (image.width / pixelsPerCell) * (gridSize(s.grid) / 64)
  bg.height = (image.height / pixelsPerCell) * (gridSize(s.grid) / 64)
  bg.x =
    s.grid.originX +
    (s.grid.offsetX ?? 0) / 64 -
    (c.anchorX / pixelsPerCell) * (gridSize(s.grid) / 64)
  bg.y =
    s.grid.originY +
    (s.grid.offsetY ?? 0) / 64 -
    (c.anchorY / pixelsPerCell) * (gridSize(s.grid) / 64)
  bg.rotation = 0
  feedback.value = '校准已应用到预览；确认对齐后保存场景配置'
  failed.value = false
}
function alignGrid() {
  if (!draft.value || busy.value) return
  if (draft.value.grid.locked) return
  tool.value = 'grid'
  showInspector('scene')
}
function resetGrid() {
  if (!draft.value || busy.value || draft.value.grid.locked) return
  draft.value.grid.offsetX = draft.value.grid.offsetY = 0
}
let gridDrag: { start: Position; offset: Position } | null = null
function canvasPixel(event: PointerEvent): Position | null {
  const matrix = svg.value?.getScreenCTM()
  if (!matrix) return null
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  return { x: p.x, y: p.y }
}
let down: Position | null = null,
  dragging = false,
  draggingToken = ''
function stopPointer(e?: PointerEvent) {
  if (e?.type === 'pointercancel' && gridDrag && draft.value) {
    draft.value.grid.offsetX = gridDrag.offset.x
    draft.value.grid.offsetY = gridDrag.offset.y
  }
  gridDrag = null
  dragging = false
  down = null
  draggingToken = ''
  if (e && svg.value?.hasPointerCapture(e.pointerId)) svg.value.releasePointerCapture(e.pointerId)
}
function leavePointer() {
  if (!draggingToken && !gridDrag) stopPointer()
}
function tokenDown(e: PointerEvent, id: string) {
  if (busy.value) return
  selectToken(id)
  if (sceneTools.value?.isActive()) return
  if (mode.value === 'preview') return
  down = cellFrom(e)
  dragging = true
  draggingToken = id
  if (e.isTrusted) svg.value?.setPointerCapture(e.pointerId)
  e.preventDefault()
}
function cellFrom(event: PointerEvent): Position | null {
  const p = canvasPixel(event)
  return p && viewScene.value ? cellAtPixel(viewGrid.value, p) : null
}
function pickCell(p: Position) {
  cursor.value = p
  if (tool.value === 'measure' || tool.value === 'sight') {
    measures.value = measures.value.length === 1 ? [measures.value[0]!, p] : [p]
    return
  }
  if (mode.value === 'preview') return
  if (tool.value === 'move' || tool.value === 'path') {
    if (!token.value) {
      feedback.value = '请先选择角色棋子'
      return
    }
    waypoints.value = tool.value === 'path' ? [...waypoints.value, p] : [p]
    showInspector('token')
  } else if (tool.value === 'point' && mode.value === 'edit' && draft.value) {
    const point = newPoint(pointKind.value, p)
    draft.value.points.push(point)
    pointId.value = point.id
    showInspector('point')
    tool.value = 'select'
  } else if (tool.value === 'annotation' && mode.value === 'edit' && draft.value) {
    const mark: MapAnnotation = {
      ...p,
      id: crypto.randomUUID(),
      name: '名称标注',
      note: '',
      color: '#385e69',
      fontSize: 16,
      offsetX: 0,
      offsetY: 0,
      hidden: false,
    }
    ;(draft.value.annotations ??= []).push(mark)
    annotationId.value = mark.id
    showInspector('annotation')
    tool.value = 'select'
  } else if (tool.value === 'select') {
    const t = scene.value?.tokens.find((t) => t.x === p.x && t.y === p.y),
      q = shownPoints.value.find((q) => q.x === p.x && q.y === p.y)
    if (t) selectToken(t.id)
    else if (q) {
      pointId.value = q.id
      showInspector('point')
    }
  }
}
function pointerDown(e: PointerEvent) {
  if (busy.value || e.button !== 0 || !e.isPrimary) return
  const quickCell = cellFrom(e)
  if (mode.value !== 'preview' && quickCell && sceneTools.value?.cell(quickCell)) return
  if (mode.value === 'edit' && (tool.value === 'wall' || tool.value === 'door') && draft.value) {
    const pixel = canvasPixel(e)
    if (!pixel) return
    const p = {
      x: Math.round(((pixel.x - offset.value.x) / gridPixels.value) * 2) / 2,
      y: Math.round(((pixel.y - offset.value.y) / gridPixels.value) * 2) / 2,
    }
    if (p.x < 0 || p.y < 0 || p.x > viewGrid.value.columns || p.y > viewGrid.value.rows) return
    if(tool.value==='door'&&doorPreset.value){try{const result=addWideDoor(draft.value,{x:Math.round(p.x),y:Math.round(p.y)},doorPreset.value);wallId.value=result.wall.id;feedback.value='宽门及操作点已加入草稿；保存后生效'}catch(e){feedback.value=e instanceof Error?e.message:String(e)}e.preventDefault();return}
    if (!wallStart.value) wallStart.value = p
    else if (key(wallStart.value) !== key(p)) {
      const w = newWall(wallStart.value, p, tool.value)
      ;(draft.value.walls ??= []).push(w)
      wallId.value = w.id
      wallStart.value = null
      feedback.value = '墙门已加入预览；保存墙门配置后生效'
    }
    e.preventDefault()
    return
  }
  if (mode.value === 'edit' && tool.value === 'grid') {
    const p = canvasPixel(e)
    if (!p || !draft.value || draft.value.grid.locked) return
    gridDrag = { start: p, offset: gridOffset(draft.value.grid) }
    if (e.isTrusted) svg.value?.setPointerCapture(e.pointerId)
    e.preventDefault()
    return
  }
  const p = cellFrom(e)
  if (!p) return
  down = p
  dragging = true
  if (mode.value === 'edit' && tool.value === 'brush') {
    selectedCells.value = [...new Set([...selectedCells.value, key(p)])]
    showInspector('terrain')
  } else if (mode.value === 'edit' && tool.value === 'rect') {
    selectedCells.value = [key(p)]
    showInspector('terrain')
  } else pickCell(p)
}
function pointerMove(e: PointerEvent) {
  if(tool.value==='door'&&doorPreset.value){const pixel=canvasPixel(e);if(pixel)doorHover.value={x:Math.round((pixel.x-offset.value.x)/gridPixels.value),y:Math.round((pixel.y-offset.value.y)/gridPixels.value)}}
  if (gridDrag && draft.value && tool.value === 'grid' && !draft.value.grid.locked && !busy.value) {
    const p = canvasPixel(e)
    if (p) {
      const clamp = (n: number) => Math.max(-5000, Math.min(5000, Math.round(n * 10) / 10))
      draft.value.grid.offsetX = clamp(gridDrag.offset.x + p.x - gridDrag.start.x)
      draft.value.grid.offsetY = clamp(gridDrag.offset.y + p.y - gridDrag.start.y)
    }
    return
  }
  if (!dragging || !down || mode.value === 'preview') return
  const p = cellFrom(e)
  if (!p) return
  if (draggingToken) {
    if (key(p) !== key(down)) {
      waypoints.value = [p]
      cursor.value = p
    }
    return
  }
  if (mode.value !== 'edit') return
  if (tool.value === 'brush') selectedCells.value = [...new Set([...selectedCells.value, key(p)])]
  if (tool.value === 'rect') {
    const result: string[] = []
    for (let y = Math.min(down.y, p.y); y <= Math.max(down.y, p.y); y++)
      for (let x = Math.min(down.x, p.x); x <= Math.max(down.x, p.x); x++)
        result.push(key({ x, y }))
    selectedCells.value = result
  }
}
function selectToken(id: string) {
  tokenId.value = id
  if (sceneTools.value?.isActive()) {
    inspectorOpen.value = true
    return
  }
  showInspector('token')
  tool.value = 'move'
}
function selectRegion() {
  const r = draft.value?.regions.find((r) => r.id === regionId.value)
  if (!r) return
  selectedCells.value = [...r.cells]
  regionName.value = r.name
  regionTags.value = [...r.tags]
  regionColor.value = r.color
  regionHeight.value = r.height
  regionJumpable.value = !!r.jumpable
  regionHidden.value = r.hidden
  regionNote.value = r.note
}
async function paint() {
  if (!draft.value || busy.value || !selectedCells.value.length) return
  const next = draft.value,
    r = {
      id: regionId.value || crypto.randomUUID(),
      name: regionName.value,
      cells: [...selectedCells.value],
      tags: [...regionTags.value],
      color: regionColor.value,
      jumpable: regionJumpable.value,
      height:
        regionHeight.value === null || String(regionHeight.value) === ''
          ? null
          : Number(regionHeight.value),
      hidden: regionHidden.value,
      note: regionNote.value,
    }
  const index = next.regions.findIndex((r) => r.id === regionId.value)
  if (index < 0) next.regions.push(r)
  else next.regions[index] = r
  await saveScene()
}
async function removeRegion(partial = false) {
  if (!draft.value || busy.value || !regionId.value) return
  const next = draft.value
  if (partial) {
    const r = next.regions.find((r) => r.id === regionId.value)!
    r.cells = r.cells.filter((c) => !selectedCells.value.includes(c))
    if (!r.cells.length) next.regions = next.regions.filter((r) => r.id !== regionId.value)
  } else next.regions = next.regions.filter((r) => r.id !== regionId.value)
  await saveScene()
}
function addLoot() {
  if (point.value) point.value.loot.push({ itemId: lootItem.value, quantity: lootQuantity.value })
}
async function interact(operation: Extract<MapCommand, { type: 'interact' }>['operation']) {
  if (!point.value) return
  await run({
    type: 'interact',
    sceneId: sceneId.value,
    pointId: point.value.id,
    characterId: recipient.value,
    itemIds: interactionItems.value,
    confirmItemCosts: interactionCosts.value,
    itemLimits: interactionLimits.value,
    bypassItems: bypassItemConditions.value,
    operation,
    gm: gm.value,
    reason: reason.value,
  })
}
async function restore() {
  if (!checkpoint.value) return
  if (
    !confirm(
      controlText('confirmation.restoreAllOfPartyHpInventoryResourcesScene', {p0:(checkpoint.value.name)}),
    )
  )
    return
  await run({ type: 'restore', checkpointId: checkpoint.value.id })
  if (!failed.value)
    sceneId.value = adventure.value!.activeSceneId ?? adventure.value!.scenes[0]!.id
}
async function download() {
  if (!(await ensureSceneSaved())) return
  await task(async () => {
    const text = await store.exportAdventure(adventureId.value),
      url = URL.createObjectURL(new Blob([text], { type: 'application/json' })),
      a = document.createElement('a')
    a.href = url
    a.download = (adventure.value?.name ?? '冒险') + '-adventure.json'
    a.click()
    URL.revokeObjectURL(url)
  }, '冒险归档已导出，包含背景、角色、互动状态和入场点')
}
async function importFile(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file || !(await ensureSceneSaved())) return
  await task(async () => {
    if (file.size > MAP_ARCHIVE_BYTES) throw new Error('冒险归档不得超过 400 MB')
    adventureId.value = await store.importAdventure(JSON.parse(await file.text()))
  }, '冒险已独立导入；原数据保留')
}
const labels = (p: Position) =>
  regionsAt(viewScene.value!, p)
    .filter((r) => mode.value !== 'preview' || !r.hidden)
    .map((r) => r.name + ' · ' + r.tags.map((t) => uiLabel(TERRAIN_NAMES[t])).join('／'))
    .join('；')
const pointStates: Record<string, string> = {
  ready: '可互动',
  locked: '已锁定',
  open: '已开启',
  closed: '已关闭',
  resolved: '已完成',
  disarmed: '已解除',
}
const pointIcon = (p: MapPoint) =>
  ({
    door: p.state === 'open' ? '▱' : '▣',
    chest: p.state === 'resolved' ? '□' : '▤',
    trap: p.state === 'disarmed' ? '◇' : '⚙',
    clue: '?',
    exit: '↗',
  })[p.kind]

useOperationFeedback(feedback, failed, busy, imageProgress)
</script>

<template>
  <main class="map-page" :class="{ 'map-compact': compactRail }">
    <p class="map-version">{{ controlText('map.spaceVersion') }}</p>
    <header v-if="!inspectorTarget" class="map-heading">
      <div>
        <p class="eyebrow">PLACES & ENCOUNTERS</p>
        <h1>{{ controlText('mapExperience.title') }}</h1>
        <p class="muted">{{ controlText('map.tagline') }}</p>
      </div>
      <div v-if="mode !== 'preview' && !designOnly" class="map-inline">
        <button class="secondary" :disabled="busy || !adventure" @click="download">{{ controlText('map.exportAdventure') }}</button
        ><label v-if="!online" class="secondary map-file"
          >{{ controlText('map.importAdventure') }}<input
            type="file"
            accept="application/json,.json"
            :aria-label="controlText('map.importFile')"
            @change="importFile"
        /></label>
      </div>
    </header>
    <div v-if="mode !== 'preview' && !online && !designOnly" class="map-adventure-bar">
      <label
        >{{ controlText('map.adventure') }}<select
          :value="adventureId"
          :disabled="busy"
          :aria-label="controlText('map.chooseAdventure')"
          @change="changeAdventure"
        >
          <option value="" disabled>{{ controlText('map.notCreated') }}</option>
          <option v-for="a in store.adventures" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
        </select></label
      ><label>{{ controlText('map.adventureName') }}<input v-model="adventureName" maxlength="120" /></label
      ><button class="primary" :disabled="busy" @click="createAdventure">{{ controlText('map.createAdventure') }}</button>
    </div>
    <div v-if="!adventure" class="map-empty">
      <span>⌘</span>
      <h2>{{ controlText('map.startScene') }}</h2>
      <p>{{ controlText('map.setupHelp') }}</p>
    </div>
    <template v-else>
      <div
        class="map-layout gm-editor-workspace"
        :class="{
          'map-player-preview': mode === 'preview',
          'gm-left-closed': !sidebarOpen || mode === 'preview',
          'gm-right-closed': !inspectorOpen||!!inspectorTarget,
          'gm-external-inspector': !!inspectorTarget,
          'gm-map-focused': focused,
        }"
      >
        <div v-if="!inspectorTarget" class="gm-layout-controls">
          <button
            v-if="mode !== 'preview'"
            :aria-expanded="sidebarOpen"
            @click="sidebarOpen = !sidebarOpen"
          >
            {{ sidebarOpen ? controlText('expressionTwo.collapseSceneSidebar') : controlText('expressionTwo.showSceneSidebar') }}</button
          ><button :aria-expanded="inspectorOpen" @click="inspectorOpen = !inspectorOpen">
            {{ inspectorOpen ? controlText('expressionTwo.collapsePropertiesSidebar') : controlText('expressionTwo.showPropertiesSidebar') }}</button
          ><button :aria-pressed="focused" @click="focused = !focused">
            {{ focused ? controlText('expressionTwo.exitMapFocus') : controlText('domain.focus') }}
          </button>
        </div>
        <aside v-if="mode !== 'preview'" v-show="sidebarOpen" class="map-sidebar">
          <details open>
            <summary>{{ controlText('domain.sceneList') }}</summary>
            <label class="gm-scene-search"
              >{{ controlText('domain.searchScene') }}<input v-model="sceneSearch" type="search" :aria-label="controlText('domain.searchScene')"
            /></label>
            <button
              v-for="s in filteredScenes"
              :key="s.id"
              class="map-scene-button"
              :class="{ selected: sceneId === s.id }"
              :disabled="busy"
              @click="
                ($event) => {
                  selectScene(s.id)
                }
              "
            >
              <span>{{ localizedEntryName(s) }}</span
              ><small>{{ adventure.activeSceneId === s.id ? controlText('expressionTwo.partyLocation') : controlText('expressionTwo.editPreview') }}</small>
            </button>
            <details class="gm-add-scene">
              <summary>{{ controlText('domain.newScene') }}</summary>
              <label>{{ controlText('map.newSceneName') }}<input v-model="sceneName" maxlength="120" /></label
              ><button class="secondary" :disabled="busy" @click="addScene">{{ controlText('map.addScene') }}</button>
            </details>
          </details>
          <details v-if="!designOnly" :open="!adventure.activeSceneId">
            <summary>{{ controlText('mapExperience.partyCount',{count:adventure.party.length}) }}</summary>
            <label
              v-for="c in store.characters.filter((c) => c.status === 'complete' && !c.npcOwnerId)"
              :key="c.id"
              class="check"
              ><input
                v-model="party"
                type="checkbox"
                :value="c.id"
                :disabled="!!adventure.activeSceneId"
              />{{ localizedEntryName(c.build) }}</label
            >
            <p v-if="!store.characters.some((c) => c.status === 'complete')" class="muted">
              {{
                online
                  ? controlText('expressionTwo.thisRoomHasNoCharactersImportCompletedWorkshop')
                  : controlText('expressionTwo.completeCharacterCreationInTheWorkshopFirst')
              }}
            </p>
            <button v-if="online" class="subtle" :disabled="busy" @click="emit('importCharacters')">
              {{ controlText('domain.importWorkshop') }}
            </button>
            <button
              class="secondary"
              :disabled="busy || !!adventure.activeSceneId"
              @click="
                ($event) => {
                  run({ type: 'party', ids: party })
                }
              "
            >
              {{ controlText('map.saveParty') }}</button
            ><button
              v-if="adventure.activeSceneId"
              class="subtle"
              :disabled="busy"
              @click="
                ($event) => {
                  run({ type: 'leave' })
                }
              "
            >
              {{ controlText('map.leaveAdventure') }}
            </button>
          </details>
          <details v-if="!online && !designOnly">
            <summary>{{ controlText('map.manageAdventure') }}</summary>
            <p class="muted">{{ controlText('map.archiveHelp') }}</p>
            <button
              class="danger-text"
              :disabled="busy || !!adventure.activeSceneId"
              @click="
                ($event) => {
                  task(async () => {
                    if (ask('移除此冒险及其入场点？角色和遭遇仍保留。'))
                      await store.removeAdventure(adventureId)
                  })
                }
              "
            >
              {{ controlText('map.removeAdventure') }}
            </button>
          </details>
        </aside>
        <section v-if="scene" class="map-center">
          <div class="gm-scene-top">
            <div class="map-scene-heading"><button v-if="inspectorTarget" class="secondary workspace-scene-toggle" :aria-expanded="sidebarOpen" @click="sidebarOpen=!sidebarOpen">{{sidebarOpen?controlText('mapExperience.collapseScenes'):controlText('domain.sceneList')}}</button><button v-if="inspectorTarget" class="secondary" :aria-pressed="focused" @click="focused=!focused">{{focused?controlText('mapExperience.exitFocus'):controlText('domain.focus')}}</button>
              <div>
                <h2>{{ localizedEntryName(scene) }}</h2>
                <span class="map-badge">{{
                  adventure.activeSceneId === scene.id ? controlText('mapExperience.partyScene') : controlText('mapExperience.scenePreview')
                }}</span
                ><span
                  v-if="
                    adventure.exploration?.sceneId === scene.id &&
                    adventure.exploration.status !== 'closed' &&
                    encounter?.phase !== 'active'
                  "
                  class="map-badge"
                  >{{ controlText('mapExperience.exploreRound',{round:adventure.exploration.round}) }}{{
                    adventure.exploration.status === 'paused' ? controlText('room.paused') : ''
                  }}</span
                ><span v-if="encounter?.phase === 'active'" class="map-badge"
                  >{{ controlText('mapExperience.combatRound',{round:encounter.round}) }}</span
                >
              </div>
              <button
                v-if="mode !== 'preview' && !designOnly"
                class="primary"
                :disabled="busy || adventure.activeSceneId === scene.id"
                @click="
                  ($event) => {
                    if (scene) run({ type: 'enter', sceneId: scene.id, landing: cursor })
                  }
                "
              >
                {{ controlText('domain.partyEnters') }}
              </button>
            </div>
            <nav class="map-modes" :aria-label="controlText('map.mode')">
              <button
                :class="{ active: mode === 'edit' }"
                :disabled="busy"
                @click="
                  ($event) => {
                    changeMode('edit')
                  }
                "
              >
                {{ controlText('domain.gmEdit') }}</button
              ><button
                v-if="!designOnly"
                :class="{ active: mode === 'run' }"
                :disabled="busy"
                @click="
                  ($event) => {
                    changeMode('run')
                  }
                "
              >
                {{ controlText('domain.runtimeScene') }}</button
              ><button
                :class="{ active: mode === 'preview' }"
                :disabled="busy"
                @click="
                  ($event) => {
                    changeMode('preview')
                  }
                "
              >
                {{ controlText('domain.playerPreview') }}
              </button>
            </nav>
            <p
              v-if="mode !== 'preview'"
              class="map-save-status"
              :class="{ dirty, error: saveFailed && dirty }"
              role="status"
            >
              {{ uiLabel(saveStatus) }}
            </p>
          </div>
          <MapEditorToolbar
            :mode="mode"
            :tool="tool"
            :busy="busy"
            :zoom="zoom"
            :grid-locked="!!draft?.grid.locked"
            :show-names="showNames"
            :design-only="designOnly"
            :quick-mode="quickSceneMode"
            @cancel="stopTools"
            @choose="chooseEditorTool"
            @setup="openSetup"
            @names="showNames = !showNames"
            @zoom="changeZoom"
            @fit="fitView"
          >
            <template #quality
              ><details v-if="currentImage?.preview" class="gm-quality-menu">
                <summary>{{ controlText('domain.showSettings') }}</summary>
                <div v-if="currentImage?.preview" class="map-image-quality">
                  <label
                    >{{ controlText('map.backgroundQuality') }}<select v-model="imageQuality">
                      <option value="auto">{{ controlText('map.autoQuality') }}</option>
                      <option value="preview">{{ controlText('domain.browsePreview') }}</option>
                      <option value="original">
                        {{ currentImage.importInfo?.optimized ? controlText('expressionTwo.optimizedCopy') : controlText('expressionTwo.originalImage') }}
                      </option>
                    </select></label
                  >
                  <small>{{
                    usingPreview
                      ? imageQuality === 'auto'
                        ? controlText('expressionTwo.showingLightweightPreviewZoomInToSwitchAutomatically')
                        : controlText('expressionTwo.showingLightweightPreview')
                      : controlText('expressionTwo.showingFullDetailImage')
                  }}</small>
                </div>
              </details></template
            ></MapEditorToolbar
          >
          <p v-if="backgroundError" class="map-feedback error" role="alert">
            {{ backgroundError }}
          </p>
          <p v-if="tool === 'wall' || tool === 'door'" class="map-feedback">
            {{
              doorPreset&&tool==='door'
                ? controlText('inlineSummary.cellDoorHoverToPreviewThenClickA',{p0:(doorPreset.length),p1:(doorPreset.axis==='horizontal'?controlText('map.horizontal'):controlText('map.vertical'))})
                :wallStart
                ? controlText('inlineSummary.startSelectedClickTheEndpointToFinishThis',{p0:(wallStart.x),p1:(wallStart.y)})
                : controlText('expressionTwo.clickAGridVertexForTheStartThen')
            }}<button class="subtle" @click="stopTools">{{ controlText('map.cancelDrawing') }}</button>
          </p>
          <p v-if="tool === 'sight'" class="map-feedback">
            {{ controlText('map.losHint') }}<template v-if="sightPreview"
              >{{
                sightPreview.dynamic?.clear??sightPreview.sight.clear
                  ? controlText('expressionTwo.clearSightThroughWallsAndDoors')
                  : controlText('expressionTwo.sightBlocked') + (sightPreview.dynamic?.reason??blockerNames(sightPreview.sight.blockers))
              }}；{{
                sightPreview.targeting.clear
                  ? controlText('expressionTwo.noPhysicalTargetObstructionDetected')
                  : controlText('expressionTwo.directTargetBlocked') + blockerNames(sightPreview.targeting.blockers)
              }}{{ controlText('map.losGmHelp') }}</template
            >
          </p>
          <slot name="control" :token-id="tokenId" :scene-id="scene.id" :dirty="dirty" />
          <MapViewportControls
            :compact="!!inspectorTarget"
            :active="mapViewport.active.value"
            :zoom="zoom"
            @toggle="mapViewport.toggle"
            @fit="mapViewport.fit"
            @reset="mapViewport.reset"
          />
          <div class="map-inline scene-effect-display"><label><input v-model="showEffectRegions" type="checkbox" /> {{ controlText('domain.ongoingAreas') }}</label><label><input v-model="showEffectLighting" type="checkbox" /> {{ controlText('domain.lightObscurement') }}</label><MapGammaControl v-model="mapGamma" /><label><input v-model="lightDebug.enabled.value" type="checkbox" /> {{ controlText('map.lightDebug') }}</label><label v-if="lightDebug.enabled.value">{{ controlText('map.selectedLight') }}<select v-model="lightDebug.selected.value"><option value="">{{ controlText('map.chooseLight') }}</option><option v-for="e in lightDebug.lights.value" :key="e.id" :value="e.id">{{localizedEntryName(e)}}</option></select></label><span class="muted">{{ controlText('map.gmMaskHelp') }}</span></div>
          <div ref="viewport" class="map-viewport" :style="mapViewportStyle">
            <svg
              ref="svg"
              class="scene-canvas"
              role="img"
              :aria-label="localizedEntryName(scene) + controlText('expressionTwo.interactiveMap')"
              :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
              :style="{
                width: canvasWidth * zoom + 'px',
                height: canvasHeight * zoom + 'px',
                overflow: background?.clip === false ? 'visible' : 'hidden',
                pointerEvents: busy ? 'none' : 'auto',
                cursor: !mapViewport.active.value
                  ? 'default'
                  : tool === 'grid'
                    ? draft?.grid.locked
                      ? 'not-allowed'
                      : 'grab'
                    : 'auto',
                touchAction: mapViewport.active.value ? 'none' : 'pan-x pan-y',
              }"
              @pointerdown="pointerDown"
              @pointermove="pointerMove"
              @pointerup="stopPointer"
              @pointercancel="stopPointer"
              @pointerleave="leavePointer"
            >
              <defs>
                <MapGammaFilter :id="gammaFilterId" :gamma="mapGamma" />
                <pattern
                  id="map-grid"
                  :width="gridPixels"
                  :height="gridPixels"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    :d="`M${gridPixels} 0H0V${gridPixels}`"
                    fill="none"
                    :stroke="viewGrid.color"
                    :stroke-width="(viewGrid.strokeWidth ?? 1) / zoom"
                  />
                </pattern>
              </defs>
              <g :filter="showEffectLighting && mapGamma !== 1 ? `url(#${gammaFilterId})` : undefined">
              <rect width="100%" height="100%" fill="#252c31" />
              <image
                v-if="background && imageUrl"
                :href="imageUrl"
                @error="imageLoadError"
                :data-quality="usingPreview ? 'preview' : 'original'"
                :x="(background.x - viewGrid.originX) * 64"
                :y="(background.y - viewGrid.originY) * 64"
                :width="background.width * 64"
                :height="background.height * 64"
                preserveAspectRatio="none"
                :transform="`rotate(${background.rotation},${(background.x + background.width / 2 - viewGrid.originX) * 64},${(background.y + background.height / 2 - viewGrid.originY) * 64})`"
              />
              <g :transform="`translate(${offset.x},${offset.y})`"><SceneEffectOverlay :data="mapEffects" :size="gridPixels" :zoom="zoom" :gm="true" :regions="false" :lighting="showEffectLighting&&fogPreview?.mode!=='enclosed'" /></g>
              </g>
              <g class="map-spatial-layer" :transform="`translate(${offset.x},${offset.y})`">
                <PointLinkOverlay
                  v-if="mode === 'edit' && draft"
                  :scene="draft"
                  :grid-pixels="gridPixels"
                  :zoom="zoom"
                />
                <g v-for="r in shownRegions" :key="r.id">
                  <rect
                    v-for="cell in r.cells"
                    :key="cell"
                    :x="position(cell).x * gridPixels"
                    :y="position(cell).y * gridPixels"
                    :width="gridPixels"
                    :height="gridPixels"
                    :fill="r.color"
                    fill-opacity=".3"
                    :stroke="r.color"
                    stroke-opacity=".6"
                    stroke-dasharray="4 4"
                  />
                  <text
                    v-for="cell in r.cells.filter((_, i) => i % 3 === 0)"
                    :key="'t' + cell"
                    :x="position(cell).x * gridPixels + 8"
                    :y="position(cell).y * gridPixels + 20"
                    font-size="14"
                    fill="var(--ink)"
                  >
                    {{
                      r.tags
                        .map(
                          (t) =>
                            ({ high: '▲', difficult: '≈', blocked: '×', danger: '!', entry: '↗' })[
                              t
                            ],
                        )
                        .join(' ')
                    }}
                  </text>
                </g>
                <rect
                  v-if="viewGrid.show"
                  :width="viewGrid.columns * gridPixels"
                  :height="viewGrid.rows * gridPixels"
                  fill="url(#map-grid)"
                  :opacity="viewGrid.opacity"
                />
                <SceneMarkers
                  :items="
                    (viewScene?.groundItems ?? []).filter(
                      (g) => mode !== 'preview' || (!g.hidden && g.enabled && g.quantity > 0),
                    )
                  "
                  :ghosts="
                    mode !== 'preview'
                      ? (adventure.ai?.npcs
                          .filter((n) => n.sceneId === sceneId && n.initiallyAbsent && !n.appeared)
                          .map((n) => ({
                            id: n.id,
                            name: n.name,
                            ...n.position,
                            color: '#75609e',
                          })) ?? [])
                      : []
                  "
                  :size="gridPixels"
                  :names="true"
                  @ground="feedback = '请在地面物品配置中编辑此物品'"
                />
                <g v-if="lightDebug.rays.value" pointer-events="none" :aria-label="controlText('map.lightDebugAria')">
                  <circle :cx="lightDebug.rays.value.center.x*gridPixels" :cy="lightDebug.rays.value.center.y*gridPixels" :r="lightDebug.rays.value.bright*gridPixels" fill="none" stroke="#ffdb78" stroke-width="2" vector-effect="non-scaling-stroke" />
                  <circle :cx="lightDebug.rays.value.center.x*gridPixels" :cy="lightDebug.rays.value.center.y*gridPixels" :r="lightDebug.rays.value.dim*gridPixels" fill="none" stroke="#ffdb78" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
                  <line v-for="(r,i) in lightDebug.rays.value.lines" :key="i" :x1="lightDebug.rays.value.center.x*gridPixels" :y1="lightDebug.rays.value.center.y*gridPixels" :x2="r.end.x*gridPixels" :y2="r.end.y*gridPixels" :stroke="r.clear?'#ffdb78':'#ef8e7d'" :stroke-dasharray="r.clear?undefined:'4 4'" vector-effect="non-scaling-stroke"><title>{{r.reason}}</title></line>
                </g>
                <SceneEffectOverlay :data="mapEffects" :size="gridPixels" :zoom="zoom" :gm="true" :regions="showEffectRegions" :lighting="false" :hide-labels="fogPreview?.mode==='enclosed'" :environment-shading="fogPreview?.mode==='enclosed'" />
                <FogOfWarLayer v-if="fogPreview?.sceneId===scene.id&&fogPreview.mode==='enclosed'" :fog="fogPreview" :size="gridPixels" :observer-id="tokenId" :shading="showEffectLighting" />
                <CorpseMarkers v-if="online && scene.id === adventure.activeSceneId" :corpses="visibleCorpses" :size="gridPixels" :names="showNames" @select="emit('corpse',$event)" />
                <SceneEffectOverlay v-if="fogPreview?.mode==='enclosed'" :data="mapEffects" :size="gridPixels" :zoom="zoom" :gm="true" :regions="showEffectRegions" :lighting="false" labels-only />
                <AreaOverlay
                  v-if="viewScene?.template"
                  :grid="viewGrid"
                  :template="viewScene.template"
                  :size="gridPixels"
                />
                <rect
                  v-for="r in areaReport.filter((r) => r.inside)"
                  :key="'area:' + r.token.id"
                  :x="r.token.x * gridPixels"
                  :y="r.token.y * gridPixels"
                  :width="r.token.span * gridPixels"
                  :height="r.token.span * gridPixels"
                  fill="none"
                  :stroke="r.blocked ? '#e67f6e' : '#3aa688'"
                  :stroke-width="2 / zoom"
                  stroke-dasharray="5 5"
                  pointer-events="none"
                />
                <g
                  v-for="w in shownWalls"
                  :key="w.id"
                  class="map-wall"
                  :data-wall="w.id"
                  :data-state="wallState(viewScene!, w)"
                  :style="{
                    pointerEvents: tool === 'select' && mode !== 'preview' ? 'auto' : 'none',
                  }"
                  @pointerdown.stop="selectWall(w.id)"
                >
                  <line
                    :x1="w.a.x * gridPixels"
                    :y1="w.a.y * gridPixels"
                    :x2="w.b.x * gridPixels"
                    :y2="w.b.y * gridPixels"
                    stroke="transparent"
                    :stroke-width="16 / zoom"
                  />
                  <line
                    :x1="w.a.x * gridPixels"
                    :y1="w.a.y * gridPixels"
                    :x2="w.b.x * gridPixels"
                    :y2="w.b.y * gridPixels"
                    :stroke="w.color"
                    :stroke-width="(wallId === w.id ? 5 : 3) / zoom"
                    :stroke-dasharray="
                      wallState(viewScene!, w) === 'open' ? '8 8' : w.hidden ? '3 3' : undefined
                    "
                    :opacity="wallState(viewScene!, w) === 'open' ? 0.55 : 1"
                  />
                  <title>
                    {{ localizedEntryName(w) }} · {{ w.kind === 'door' ? wallState(viewScene!, w) : controlText('domain.walls') }}
                  </title>
                </g>
                <g v-if="doorGhost" pointer-events="none" :aria-label="controlText('map.widePreview')"><line :x1="doorGhost.start.x*gridPixels" :y1="doorGhost.start.y*gridPixels" :x2="doorGhost.end.x*gridPixels" :y2="doorGhost.end.y*gridPixels" stroke="#d6a45f" stroke-width="5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/><rect :x="doorGhost.anchor.x*gridPixels" :y="doorGhost.anchor.y*gridPixels" :width="gridPixels" :height="gridPixels" fill="#d6a45f33" stroke="#d6a45f"/></g>
                <circle
                  v-if="wallStart"
                  :cx="wallStart.x * gridPixels"
                  :cy="wallStart.y * gridPixels"
                  :r="5 / zoom"
                  fill="#ffdc8a"
                  pointer-events="none"
                />
                <rect
                  v-for="cell in selectedCells"
                  :key="'selected' + cell"
                  :x="position(cell).x * gridPixels + 2"
                  :y="position(cell).y * gridPixels + 2"
                  :width="gridPixels - 4"
                  :height="gridPixels - 4"
                  fill="#d5b676"
                  fill-opacity=".18"
                  stroke="#d5b676"
                  stroke-width="3"
                />
                <g
                  v-for="p in shownPoints"
                  :key="p.id"
                  @pointerdown.stop="
                    ($event) => {
                      pointId = p.id
                      tab = 'point'
                      cursor = { x: p.x, y: p.y }
                    }
                  "
                  class="map-point"
                  :style="{
                    pointerEvents: [
                      'brush',
                      'rect',
                      'point',
                      'annotation',
                      'measure',
                      'wall',
                      'door',
                      'sight',
                      'grid',
                    ].includes(tool)
                      ? 'none'
                      : 'auto',
                  }"
                  :data-point="p.id"
                  :data-gm-point="mode === 'edit' ? p.id : undefined"
                  :class="{
                    'map-gm-point': mode === 'edit',
                    disabled: !p.enabled,
                    hidden: p.hidden,
                  }"
                  @pointerenter="hoveredName = 'point:' + p.id"
                  @pointerleave="hoveredName = ''"
                >
                  <rect
                    :x="(p.x + 0.5) * gridPixels - (mode === 'edit' ? 14 / zoom : 18)"
                    :y="(p.y + 0.5) * gridPixels - (mode === 'edit' ? 14 / zoom : 18)"
                    :width="mode === 'edit' ? 28 / zoom : 36"
                    :height="mode === 'edit' ? 28 / zoom : 36"
                    :rx="mode === 'edit' ? 5 / zoom : 7"
                    :style="
                      mode === 'edit'
                        ? {
                            fill: p.editorColor ?? '#ad6243',
                            stroke: p.id === pointId ? '#fff5d8' : '#20323d',
                            strokeWidth: (p.id === pointId ? 3 : 1.5) / zoom,
                            strokeDasharray:
                              p.hidden || !p.enabled ? 3 / zoom + ' ' + 2 / zoom : 'none',
                          }
                        : undefined
                    "
                    :class="{ chosen: p.id === pointId }"
                  />
                  <text
                    :x="(p.x + 0.5) * gridPixels"
                    :y="(p.y + 0.5) * gridPixels + (mode === 'edit' ? 6 / zoom : 8)"
                    text-anchor="middle"
                    :font-size="mode === 'edit' ? 18 / zoom : 26"
                    :style="
                      mode === 'edit'
                        ? { fill: nameTextColor(p.editorColor ?? '#ad6243') }
                        : undefined
                    "
                  >
                    {{ pointIcon(p) }}
                  </text>
                  <title>
                    {{ localizedEntryName(p) }} · {{ uiLabel(pointStates[p.state]) }}{{ p.hidden ? controlText('expressionTwo.hiddenFromPlayers') : ''
                    }}{{ !p.enabled ? controlText('expressionTwo.disabled') : '' }}
                  </title>
                </g>
                <g
                  v-for="t in shownTokens"
                  :key="t.id"
                  :data-token="t.id"
                  @pointerenter="hoveredName = 'token:' + t.id"
                  @pointerleave="hoveredName = ''"
                  class="map-token"
                  :style="{
                    pointerEvents: [
                      'brush',
                      'rect',
                      'point',
                      'annotation',
                      'measure',
                      'wall',
                      'door',
                      'sight',
                      'grid',
                    ].includes(tool)
                      ? 'none'
                      : 'auto',
                  }"
                  @pointerdown.stop="
                    ($event) => {
                      tokenDown($event, t.id)
                    }
                  "
                >
                  <rect
                    :x="t.x * gridPixels + 6"
                    :y="t.y * gridPixels + 6"
                    :width="t.span * gridPixels - 12"
                    :height="t.span * gridPixels - 12"
                    rx="12"
                    :fill="t.color"
                    :stroke="
                      t.id === tokenId
                        ? '#f2cd76'
                        : candidates.some((c) => c.id === t.id)
                          ? '#e99880'
                          : '#ffffff'
                    "
                    :stroke-width="t.id === tokenId ? 5 : 2"
                  />
                  <foreignObject
                    :x="t.x * gridPixels + 10"
                    :y="t.y * gridPixels + 10"
                    :width="t.span * gridPixels - 20"
                    :height="t.span * gridPixels - 20"
                  >
                    <CharacterAvatar
                      :name="t.name"
                      :portrait="tokenPortraits.get(t.id)"
                      :size="t.span * gridPixels - 20"
                    />
                  </foreignObject>
                  <title>{{ localizedEntryName(t) }} · ({{ t.x }},{{ t.y }})</title>
                  <path
                    :d="`M${(t.x + t.span / 2) * gridPixels - 7},${t.y * gridPixels + 17} l7,-9 l7,9`"
                    fill="none"
                    stroke="white"
                    stroke-width="3"
                    :transform="`rotate(${t.facing},${(t.x + t.span / 2) * gridPixels},${(t.y + t.span / 2) * gridPixels})`"
                  />
                </g>
                <rect
                  v-if="token && route.length"
                  :x="route.at(-1)!.x * gridPixels + 6"
                  :y="route.at(-1)!.y * gridPixels + 6"
                  :width="token.span * gridPixels - 12"
                  :height="token.span * gridPixels - 12"
                  rx="12"
                  :fill="token.color"
                  fill-opacity=".25"
                  stroke="#f2cd76"
                  stroke-width="3"
                  stroke-dasharray="6 4"
                  pointer-events="none"
                />
                <polyline
                  v-if="token && route.length"
                  :points="
                    [{ x: token.x, y: token.y }, ...route]
                      .map((p) => `${(p.x + 0.5) * gridPixels},${(p.y + 0.5) * gridPixels}`)
                      .join(' ')
                  "
                  class="map-route"
                />
                <g v-if="measures.length === 2">
                  <line
                    :x1="(measures[0]!.x + 0.5) * gridPixels"
                    :y1="(measures[0]!.y + 0.5) * gridPixels"
                    :x2="tool==='sight'&&sightPreview?.dynamic?sightPreview.dynamic.end.x*gridPixels:(measures[1]!.x + 0.5) * gridPixels"
                    :y2="tool==='sight'&&sightPreview?.dynamic?sightPreview.dynamic.end.y*gridPixels:(measures[1]!.y + 0.5) * gridPixels"
                    class="map-route measure"
                  />
                </g>
                <g
                  v-for="a in shownAnnotations"
                  :key="a.id"
                  class="map-annotation"
                  :data-annotation="a.id"
                  :style="{ pointerEvents: tool === 'select' ? 'auto' : 'none' }"
                  @pointerdown.stop="selectName('annotation', a.id)"
                  @pointerenter="hoveredName = 'annotation:' + a.id"
                  @pointerleave="hoveredName = ''"
                >
                  <circle
                    :cx="(a.x + 0.5) * gridPixels"
                    :cy="(a.y + 0.5) * gridPixels"
                    :r="5 / zoom"
                    :fill="a.color"
                    stroke="white"
                    :stroke-width="1.5 / zoom"
                  />
                  <title>{{ localizedEntryName(a) }}</title>
                </g>
                <rect
                  v-for="cell in cells"
                  :key="key(cell)"
                  :x="cell.x * gridPixels"
                  :y="cell.y * gridPixels"
                  :width="gridPixels"
                  :height="gridPixels"
                  fill="transparent"
                  pointer-events="none"
                >
                  <title>{{ labels(cell) }}</title>
                </rect>
              </g>
              <g
                v-for="n in nameLayout.placed"
                :key="n.key"
                class="map-name"
                :data-name="n.key"
                :style="{ pointerEvents: tool === 'select' ? 'auto' : 'none' }"
                @pointerdown.stop="selectName(n.kind, n.id)"
              >
                <line
                  :x1="n.x / zoom"
                  :y1="n.y / zoom"
                  :x2="(n.left + n.width / 2) / zoom"
                  :y2="(n.top + n.height / 2) / zoom"
                  :stroke="n.color"
                  vector-effect="non-scaling-stroke"
                  pointer-events="none"
                />
                <rect
                  :x="n.left / zoom"
                  :y="n.top / zoom"
                  :width="n.width / zoom"
                  :height="n.height / zoom"
                  :rx="5 / zoom"
                  :fill="n.color"
                  :stroke="n.selected ? '#f2cd76' : '#ffffff'"
                  vector-effect="non-scaling-stroke"
                />
                <text
                  :x="(n.left + 8) / zoom"
                  :y="(n.top + n.height / 2) / zoom"
                  dominant-baseline="central"
                  :font-size="n.fontSize / zoom"
                  :fill="nameTextColor(n.color)"
                >
                  {{ n.text }}
                </text>
                <title>{{ localizedEntryName(n) }}</title>
              </g>
              <MapFeedbackOverlay :zoom="zoom" :scene-id="scene.id" :size="gridPixels" :offset="offset" :fog="fogPreview?.sceneId===scene.id?fogPreview:undefined" />
              <MapSelectionOverlay :zoom="zoom" :map-id="selectionMapId" :grid="viewGrid" :size="gridPixels" :offset="offset" />
              <FogOfWarLayer v-if="fogPreview?.sceneId===scene.id&&fogPreview.mode!=='enclosed'" :fog="fogPreview" :size="gridPixels" :offset="offset" />
            </svg>
          </div>
          <MapSelectionBar :map-id="selectionMapId" /><MapFeedbackControls />
          <MapResizeHandle
            v-if="mapH"
            :model-value="mapH"
            :default-height="630"
            :label="controlText('expressionFour.adjustMapHeight')"
            @update:model-value="applyMapHeight"
          />
          <div class="map-hint gm-map-status" role="status">
            <strong>{{
              quickSceneMode === 'relocate'
                ? controlText('mapExperience.relocateHint')
                : quickSceneMode === 'place'
                  ? controlText('mapExperience.placeHint')
                  : uiLabel(EDITOR_TOOL_NAMES[tool])
            }}</strong>
            ·
            {{
              tool === 'grid'
                ? controlText('mapExperience.gridHint')
                : tool === 'rect'
                  ? controlText('mapExperience.rectHint')
                  : tool === 'brush'
                    ? controlText('mapExperience.brushHint')
                    : tool === 'move'
                      ? controlText('mapExperience.moveHint')
                      : tool === 'path'
                        ? controlText('mapExperience.pathHint')
                        : tool === 'point'
                          ? controlText('mapExperience.pointHint')
                          : tool === 'annotation'
                            ? controlText('mapExperience.labelHint')
                            : tool === 'measure'
                              ? controlText('mapExperience.measureHint')
                              : controlText('mapExperience.selectHint')
            }}
            · {{ controlText('mapExperience.cellStatus',{x:cursor.x,y:cursor.y,feet:viewGrid.feet}) }}
          </div>
          <p v-if="nameLayout.omitted.length" class="map-hint">
            {{ controlText('mapExperience.omittedLabels',{count:nameLayout.omitted.length}) }}
          </p>
          <div class="map-legend">
            <span v-for="r in shownRegions" :key="r.id"
              ><i :style="{ background: r.color }" />{{ localizedEntryName(r) }} · {{ terrainLabel(r.tags)
              }}<small v-if="r.height !== null"> {{ r.height }} {{ controlText('game.feet') }}</small></span
            ><strong v-if="measures.length === 2"
              >{{ controlText('controls.measure') }} {{ distance(scene, measures[0]!, measures[1]!) }} {{ controlText('game.feet') }}</strong
            >
          </div>
        </section>
        <Teleport defer :to="inspectorTarget||'body'" :disabled="!inspectorTarget"><aside
          v-if="scene"
          v-show="inspectorOpen||!!inspectorTarget"
          class="map-inspector"
          :class="{ 'gm-inspector-minimized': inspectorMinimized }"
          :inert="busy"
          :aria-label="controlText('map.propertiesPanel')"
        >
          <div v-if="!inspectorTarget" class="gm-inspector-heading">
            <strong>{{
              tab === 'setup'
                ? controlText('expressionTwo.appearanceItemQuickConfiguration')
                : point && tab === 'point'
                  ? localizedEntryName(point)
                  : token && tab === 'token'
                    ? localizedEntryName(token)
                    : controlText('domain.sceneProperties')
            }}</strong
            ><button
              :disabled="busy"
              class="subtle"
              :title="controlText('map.minimizeHint')"
              @click="inspectorMinimized = !inspectorMinimized"
            >
              {{ inspectorMinimized ? controlText('expressionTwo.expandSettings') : controlText('expressionTwo.minimize') }}</button
            ><button :disabled="busy" class="subtle" @click="inspectorOpen = false">
              {{ controlText('map.collapseProperties') }}
            </button>
          </div>
          <nav v-if="mode !== 'preview'" class="map-tabs" :aria-label="controlText('map.mapDetails')">
            <button
              v-for="(name, id) in {
                scene: '场景',
                setup: '配置',
                terrain: '地形',
                wall: '墙门',
                point: '互动',
                annotation: '标注',
                token: '棋子',
                ...(designOnly ? {} : { area: '范围', save: '存档' }),
              }"
              :key="id"
              :class="{ active: tab === id }"
              @click="
                ($event) => {
                  tab = id
                }
              "
            >
              {{ uiLabel(name) }}
            </button>
          </nav>
          <ArrivalEditor
            v-show="tab === 'setup'"
            v-if="draft && mode === 'edit'"
            v-model="draft"
            :npcs="adventure.ai?.npcs ?? []"
            :busy="busy"
            :runtime="!designOnly"
            @command="run"
          />
          <PointLinkEditor
            v-if="draft && mode === 'edit'"
            v-show="tab === 'setup'"
            v-model="draft"
            :busy="busy"
            :runtime="!designOnly"
            @save="saveScene"
            @command="run"
          />
          <GroundItemEditor
            v-show="tab === 'setup'"
            v-if="draft && mode === 'edit'"
            v-model="draft"
            :items="sceneItems"
            :cursor="cursor ?? { x: 0, y: 0 }"
            :busy="busy"
          />
          <SceneGmTools
            v-show="tab === 'setup'"
            v-if="!designOnly && mode !== 'preview' && scene"
            ref="sceneTools"
            @mode="quickSceneMode = $event"
            :world="configWorld"
            :adventure-id="adventure.id"
            :scene="scene"
            :selected="tokenId"
            :busy="busy"
            @command="run"
          />
          <WallEditor
            v-if="tab === 'wall' && viewScene && mode !== 'preview'"
            :scene="viewScene"
            :selected="wallId"
            :editing="mode === 'edit'"
            :busy="busy"
            @select="selectWall"
            @draw="drawWall"
            @save="saveScene"
            @toggle="run({ type: 'wall-toggle', sceneId, wallId: $event })"
          />
          <TemplateEditor
            v-if="tab === 'area' && draft && mode !== 'preview'"
            :scene="draft"
            :cursor="cursor"
            :busy="busy"
            @save="saveScene"
          />
          <template v-if="tab === 'scene' && draft && mode !== 'preview'">
            <h3>{{ controlText('map.sceneSettings') }}</h3>
            <details class="gm-scene-section">
              <summary>{{ controlText('map.basicInfo') }}</summary>
              <label>{{ controlText('domain.sceneName') }}<input v-model="draft.name" /></label
              ><label>{{ controlText('domain.sceneDescription') }}<textarea v-model="draft.note" rows="2" /></label>
            </details>
            <details class="gm-scene-section">
              <summary>{{ controlText('domain.gridSettings') }}</summary>
              <div class="map-field-grid">
                <label
                  >{{ controlText('domain.gridCols') }}<input
                    v-model.number="draft.grid.columns"
                    type="number"
                    min="2"
                    max="80" /></label
                ><label
                  >{{ controlText('domain.gridRows') }}<input
                    v-model.number="draft.grid.rows"
                    type="number"
                    min="2"
                    max="80" /></label
                ><label
                  >{{ controlText('domain.gridDistance') }}<input
                    v-model.number="draft.grid.feet"
                    type="number"
                    min="1"
                    max="100" /></label
                ><label
                  >{{ controlText('domain.gridOpacity') }}<input
                    v-model.number="draft.grid.opacity"
                    type="number"
                    min="0"
                    max="1"
                    step=".05" /></label
                ><label
                  >{{ controlText('domain.originX') }}<input
                    v-model.number="draft.grid.originX"
                    type="number"
                    step=".1" /></label
                ><label
                  >{{ controlText('domain.originY') }}<input v-model.number="draft.grid.originY" type="number" step=".1"
                /></label>
              </div>
              <label>{{ controlText('domain.gridColor') }}<input v-model="draft.grid.color" type="color" /></label
              ><label class="check"
                ><input v-model="draft.grid.show" type="checkbox" />{{ controlText('domain.showGrid') }}</label
              >
              <div v-if="mode === 'edit'" class="map-grid-align">
                <label
                  >{{ controlText('map.gridSpacing') }}<input
                    v-model.number="draft.grid.cellPixels"
                    type="number"
                    min="32"
                    max="256"
                    step="0.5"
                    :disabled="busy || draft.grid.locked"
                /></label>
                <label
                  >{{ controlText('map.gridLineWidth') }}<input
                    v-model.number="draft.grid.strokeWidth"
                    type="number"
                    min="0.5"
                    max="6"
                    step="0.5"
                    :disabled="busy"
                /></label>
                <div class="map-field-grid">
                  <label
                    >{{ controlText('map.gridOffsetX') }}<input
                      v-model.number="draft.grid.offsetX"
                      type="number"
                      min="-5000"
                      max="5000"
                      step="0.5"
                      :disabled="busy || draft.grid.locked" /></label
                  ><label
                    >{{ controlText('map.gridOffsetY') }}<input
                      v-model.number="draft.grid.offsetY"
                      type="number"
                      min="-5000"
                      max="5000"
                      step="0.5"
                      :disabled="busy || draft.grid.locked"
                  /></label>
                </div>
                <label class="check"
                  ><input
                    v-model="draft.grid.locked"
                    type="checkbox"
                    :disabled="busy"
                  />{{ controlText('map.lockGrid') }}</label
                >
                <div class="map-inline">
                  <button
                    class="secondary"
                    :disabled="busy || draft.grid.locked"
                    @click="alignGrid"
                  >
                    {{ controlText('map.dragGrid') }}</button
                  ><button
                    class="secondary"
                    :disabled="busy || draft.grid.locked"
                    @click="resetGrid"
                  >
                    {{ controlText('map.resetGrid') }}
                  </button>
                </div>
                <p class="muted">{{ controlText('quantity.gridPixels', {p0:(gridPixels)}) }}</p>
              </div>
            </details>
            <details class="gm-scene-section">
              <summary>{{ controlText('domain.backgroundAlignment') }}</summary>
              <label
                >{{ controlText('map.importMode') }}<select v-model="importMode" :disabled="busy">
                  <option value="original">{{ controlText('map.keepOriginal') }}</option>
                  <option value="optimized">{{ controlText('map.optimize') }}</option>
                </select></label
              >
              <label class="secondary map-file"
                >{{ controlText('domain.chooseBackground') }}<input
                  type="file"
                  :aria-label="controlText('map.uploadBackground')"
                  accept="image/png,image/jpeg,image/webp"
                  :disabled="busy"
                  @change="upload"
              /></label>
              <p class="muted">
                {{ controlText('map.imageLimits') }}
              </p>

              <p v-if="currentImage" class="map-image-info">
                {{ localizedEntryName(currentImage) }}<br />{{ currentImage.width }} × {{ currentImage.height }} ·
                {{ megabytes(currentImage.blob.size)
                }}<template v-if="currentImage.preview"
                  ><br />{{ controlText('domain.browsePreview') }} {{ currentImage.preview.width }} ×
                  {{ currentImage.preview.height }} ·
                  {{ megabytes(currentImage.preview.blob.size) }}</template
                ><template v-if="currentImage.importInfo?.optimized"
                  ><br />{{ controlText('map.sourceImage') }} {{ currentImage.importInfo.width }} ×
                  {{ currentImage.importInfo.height }} {{ controlText('map.optimized') }}</template
                >
              </p>
              <p class="muted">
                {{ controlText('map.savedImages') }} {{ megabytes(imageBytes) }} {{ controlText('map.gridImageHelp') }}
              </p>
              <template v-if="draft.background"
                ><label class="check"
                  ><input v-model="draft.background.locked" type="checkbox" />{{ controlText('domain.lockBackground') }}</label
                >
                <div class="map-field-grid">
                  <label
                    >{{ controlText('map.backgroundX') }}<input
                      v-model.number="draft.background.x"
                      type="number"
                      step=".1"
                      :disabled="draft.background.locked" /></label
                  ><label
                    >{{ controlText('map.backgroundY') }}<input
                      v-model.number="draft.background.y"
                      type="number"
                      step=".1"
                      :disabled="draft.background.locked" /></label
                  ><label
                    >{{ controlText('map.backgroundWidth') }}<input
                      v-model.number="draft.background.width"
                      type="number"
                      min=".1"
                      step=".1"
                      :disabled="draft.background.locked" /></label
                  ><label
                    >{{ controlText('map.backgroundHeight') }}<input
                      v-model.number="draft.background.height"
                      type="number"
                      min=".1"
                      step=".1"
                      :disabled="draft.background.locked" /></label
                  ><label
                    >{{ controlText('map.rotation') }}<input
                      v-model.number="draft.background.rotation"
                      type="number"
                      step="1"
                      :disabled="draft.background.locked"
                  /></label>
                </div>
                <div class="map-inline">
                  <button
                    class="subtle"
                    :disabled="draft.background.locked"
                    @click="
                      ($event) => {
                        fitBackground()
                      }
                    "
                  >
                    {{ controlText('map.coverPreview') }}</button
                  ><button
                    class="subtle"
                    :disabled="draft.background.locked"
                    @click="
                      ($event) => {
                        fitBackground('contain')
                      }
                    "
                  >
                    {{ controlText('map.containPreview') }}
                  </button>
                </div>
                <label class="check"
                  ><input
                    v-model="draft.background.clip"
                    type="checkbox"
                    :disabled="draft.background.locked"
                  />{{ controlText('map.clipBackground') }}</label
                >
                <details>
                  <summary>{{ controlText('map.calibrate') }}</summary>
                  <p class="muted">
                    {{ controlText('map.calibrationHelp') }}
                  </p>
                  <div class="map-field-grid">
                    <label
                      >{{ controlText('map.imageDistance') }}<input
                        v-model.number="calibration.pixels"
                        type="number"
                        min=".1"
                        :disabled="draft.background.locked"
                    /></label>
                    <label
                      >{{ controlText('map.actualDistance') }}<input
                        v-model.number="calibration.feet"
                        type="number"
                        min=".1"
                        :disabled="draft.background.locked"
                    /></label>
                    <label
                      >{{ controlText('map.anchorX') }}<input
                        v-model.number="calibration.anchorX"
                        type="number"
                        :disabled="draft.background.locked"
                    /></label>
                    <label
                      >{{ controlText('map.anchorY') }}<input
                        v-model.number="calibration.anchorY"
                        type="number"
                        :disabled="draft.background.locked"
                    /></label>
                  </div>
                  <button
                    class="secondary"
                    :disabled="draft.background.locked"
                    @click="calibrateBackground"
                  >
                    {{ controlText('map.applyCalibration') }}
                  </button>
                </details></template
              >
            </details>
            <details>
              <summary>{{ controlText('map.highGroundRules') }}</summary>
              <p class="muted">
                {{ controlText('map.highGroundHelp') }}
              </p>
              <label class="check"
                ><input v-model="draft.highGround.enabled" type="checkbox" />{{ controlText('map.enableHighGround') }}</label
              ><label class="check"
                ><input v-model="draft.highGround.weapon" type="checkbox" />{{ controlText('map.rangedWeapon') }}</label
              ><label class="check"
                ><input v-model="draft.highGround.thrown" type="checkbox" />{{ controlText('game.thrown') }}</label
              ><label class="check"
                ><input v-model="draft.highGround.spell" type="checkbox" />{{ controlText('map.rangedSpell') }}</label
              >
              <p class="muted">{{ controlText('map.saveExclusion') }}</p>
            </details>
            <button v-if="!inspectorTarget" class="primary" :disabled="busy" @click="saveScene">{{ controlText('domain.saveScene') }}</button>
          </template>
          <template v-if="tab === 'terrain' && mode !== 'preview'"
            ><h3>{{ controlText('map.regionLabels') }}</h3>
            <label
              >{{ controlText('map.editRegion') }}<select v-model="regionId" @change="selectRegion">
                <option value="">{{ controlText('map.newRegion') }}</option>
                <option v-for="r in draft?.regions" :key="r.id" :value="r.id">{{ localizedEntryName(r) }}</option>
              </select></label
            >
            <p class="muted">{{ controlText('quantity.reselectCells', {p0:(controlText('game.selected')),p1:(selectedCells.length)}) }}</p>
            <label>{{ controlText('map.regionName') }}<input v-model="regionName" /></label>
            <div class="map-inline">
              <label v-for="tag in TERRAIN" :key="tag" class="check"
                ><input v-model="regionTags" type="checkbox" :value="tag" />{{
                  uiLabel(TERRAIN_NAMES[tag])
                }}</label
              >
            </div>
            <label>{{ controlText('map.regionColor') }}<input v-model="regionColor" type="color" /></label
            ><label
              >{{ controlText('map.optionalHeight') }}<input
                v-model.number="regionHeight"
                type="number"
                step="1"
                :placeholder="controlText('map.gmConfigured')" /></label
            ><label class="check"
              ><input
                v-model="regionJumpable"
                type="checkbox"
              />{{ controlText('map.jumpable') }}</label
            ><label>{{ controlText('map.regionNote') }}<textarea v-model="regionNote" rows="2" /></label
            ><label class="check"
              ><input v-model="regionHidden" type="checkbox" />{{ controlText('map.hidePlayerPreview') }}</label
            ><button class="primary" :disabled="busy || !selectedCells.length" @click="paint">
              {{ controlText('map.saveRegion') }}
            </button>
            <div class="map-inline">
              <button
                class="subtle"
                @click="
                  ($event) => {
                    selectedCells = []
                  }
                "
              >
                {{ controlText('map.clearRegion') }}</button
              ><button
                class="subtle"
                :disabled="!regionId || busy"
                @click="
                  ($event) => {
                    removeRegion(true)
                  }
                "
              >
                {{ controlText('map.removeRegionCells') }}</button
              ><button
                class="danger-text"
                :disabled="!regionId || busy"
                @click="
                  ($event) => {
                    removeRegion()
                  }
                "
              >
                {{ controlText('map.deleteRegion') }}
              </button>
            </div></template
          >
          <template v-if="tab === 'point' && mode !== 'preview'"
            ><h3>{{ controlText('map.locationInteractions') }}</h3>
            <label
              >{{ controlText('map.placementType') }}<select v-model="pointKind">
                <option value="door">{{ controlText('domain.door') }}</option>
                <option value="chest">{{ controlText('map.chestPile') }}</option>
                <option value="trap">{{ controlText('map.mechanismTrap') }}</option>
                <option value="clue">{{ controlText('domain.clue') }}</option>
                <option value="exit">{{ controlText('domain.portal') }}</option>
              </select></label
            ><label
              >{{ controlText('domain.choosePoint') }}<select v-model="pointId">
                <option value="">{{ controlText('map.placeOrSelect') }}</option>
                <option v-for="p in draft?.points" :key="p.id" :value="p.id">
                  {{ localizedEntryName(p) }} · ({{ p.x }},{{ p.y }})
                </option>
              </select></label
            >
            <template v-if="point"
              ><h3>{{ localizedEntryName(point) }}</h3>
              <p v-if="pointDirty" class="muted">{{ controlText('map.saveBeforeInteract') }}</p>
              <span class="map-badge">{{ uiLabel(pointStates[point.state]) }}</span
              ><label
                >{{ controlText('map.operator') }}<select v-model="recipient">
                  <option value="" disabled>{{ controlText('map.choosePartyMember') }}</option>
                  <option v-for="id in adventure.party" :key="id" :value="id">
                    {{ localizedEntryName(store.characters.find((c) => c.id === id)?.build) }}
                  </option>
                </select></label
              >
              <PointItemsEditor :point="point" :items="sceneItems" />
              <label v-if="point.itemUse" class="check"><input v-model="bypassItemConditions" type="checkbox" />{{ controlText('map.itemRuling') }}</label>
              <PointItemPicker v-model="interactionItems" v-model:confirmed="interactionCosts" v-model:limits="interactionLimits" :items="store.characters.find(c=>c.id===recipient)?.inventory??[]" :content="store.content" />
              <p>{{ point.note }}</p>
              <p v-if="['resolved', 'disarmed', 'open'].includes(point.state)" class="map-revealed">
                {{ point.revealed }}
              </p>
              <ul v-if="point.loot.length">
                <li v-for="(drop, i) in point.loot" :key="i">
                  {{ itemName(drop.itemId) }} × {{ drop.quantity }}
                </li>
              </ul>
              <p v-if="point.coins">{{ point.coins }} GP</p>
              <div class="map-inline">
                <button
                  v-if="point.check"
                  class="secondary"
                  :disabled="busy || !recipient || pointDirty"
                  @click="
                    ($event) => {
                      interact('check')
                    }
                  "
                >
                  {{ controlText('map.executeCheck') }}</button
                ><button
                  class="primary"
                  :disabled="busy || !recipient || pointDirty"
                  @click="
                    ($event) => {
                      point &&
                        interact(
                          point.kind === 'chest'
                            ? 'claim'
                            : point.kind === 'door'
                              ? 'toggle'
                              : 'use',
                        )
                    }
                  "
                >
                  {{
                    point.kind === 'chest'
                      ? controlText('expressionTwo.collectContainerContents')
                      : point.kind === 'door'
                        ? controlText('expressionTwo.openCloseDoor')
                        : point.kind === 'exit'
                          ? controlText('expressionTwo.enterSceneThroughEntrance')
                          : controlText('expressionTwo.confirmInteraction')
                  }}
                </button>
              </div>
              <details v-if="mode === 'edit'">
                <summary>{{ controlText('map.editPoint') }}</summary>
                <DiscoveryConfigEditor
                  v-model="point"
                  :scene-id="sceneId"
                  :attempts="draft?.discoveryAttempts"
                  :busy="busy"
                  :runtime="!designOnly"
                  @command="run"
                />
                <label
                  >{{ controlText('map.gmMarkerColor') }}<input v-model="point.editorColor" type="color" :disabled="busy"
                /></label>
                <p class="muted">
                  {{ controlText('map.markerHelp') }}
                </p>
                <fieldset v-if="draft?.arrivalGroups?.length">
                  <legend>{{ controlText('map.successArrival') }}</legend>
                  <label v-for="g in draft.arrivalGroups" :key="g.id" class="check"
                    ><input
                      type="checkbox"
                      :checked="point.arrivalGroupIds?.includes(g.id)"
                      @change="
                        point.arrivalGroupIds =
                          $event.target && ($event.target as HTMLInputElement).checked
                            ? [...(point.arrivalGroupIds ?? []), g.id]
                            : (point.arrivalGroupIds ?? []).filter((id) => id !== g.id)
                      "
                    />{{ localizedEntryName(g) }}</label
                  >
                </fieldset>
                <fieldset v-if="draft?.arrivalGroups?.length">
                  <legend>{{ controlText('map.failureArrival') }}</legend>
                  <label v-for="g in draft.arrivalGroups" :key="g.id" class="check"
                    ><input
                      type="checkbox"
                      :checked="point.failureArrivalGroupIds?.includes(g.id)"
                      @change="
                        point.failureArrivalGroupIds =
                          $event.target && ($event.target as HTMLInputElement).checked
                            ? [...(point.failureArrivalGroupIds ?? []), g.id]
                            : (point.failureArrivalGroupIds ?? []).filter((id) => id !== g.id)
                      "
                    />{{ localizedEntryName(g) }}</label
                  >
                </fieldset>
                <PointStoryEditor
                  :model-value="point.storyResults ?? []"
                  :npcs="adventure?.ai?.npcs.filter((n) => n.sceneId === sceneId) ?? []"
                  :busy="busy"
                  @update:model-value="point.storyResults = $event"
                />
                <PointReviewSettings
                  :point="point"
                  :disabled="busy"
                  @update:model-value="point.assistedReview = $event"
                />
                <label>{{ controlText('domain.pointName') }}<input v-model="point.name" /></label
                ><label>{{ controlText('controls.description') }}<textarea v-model="point.note" rows="2" /></label
                ><label>{{ controlText('map.revealAfter') }}<textarea v-model="point.revealed" rows="2" /></label>
                <label
                  >{{ controlText('map.combatAfter') }}<select v-model="point.battlePresetId">
                    <option :value="null">{{ controlText('map.noTrigger') }}</option>
                    <option
                      v-for="p in adventure?.battles?.presets.filter(
                        (p) => p.sceneId === sceneId,
                      ) ?? []"
                      :key="p.id"
                      :value="p.id"
                    >
                      {{ localizedEntryName(p) }}
                    </option>
                  </select></label
                >
                <p class="muted">
                  {{ controlText('map.combatAfterHelp') }}
                </p>
                <div class="map-field-grid">
                  <label
                    >{{ controlText('game.conditions') }}<select v-model="point.state">
                      <option
                        v-for="s in ['ready', 'locked', 'open', 'closed', 'resolved', 'disarmed']"
                        :key="s"
                        :value="s"
                      >
                        {{ uiLabel(pointStates[s]) }}
                      </option>
                    </select></label
                  ><label
                    >{{ controlText('map.interactRange') }}<input v-model.number="point.range" type="number" min="0"
                  /></label>
                </div>
                <label
                  >{{ controlText('map.combatCost') }}<select v-model="point.cost">
                    <option value="free">{{ controlText('game.freeInteraction') }}</option>
                    <option value="action">{{ controlText('controls.action') }}</option>
                    <option value="bonus">{{ controlText('map.bonusGm') }}</option>
                  </select></label
                ><label class="check"><input v-model="point.hidden" type="checkbox" />{{ controlText('controls.hidden') }}</label
                ><label class="check"><input v-model="point.enabled" type="checkbox" />{{ controlText('controls.enable') }}</label
                ><label class="check"
                  ><input
                    type="checkbox"
                    :checked="!!point.check"
                    @change="
                      ($event) => {
                        point!.check = ($event.target as HTMLInputElement).checked
                          ? { kind: 'skill', id: 'perception', dc: 10 }
                          : null
                      }
                    "
                  />{{ controlText('map.needsCheck') }}</label
                ><template v-if="point.check"
                  ><label
                    >{{ controlText('map.checkType') }}<select
                      v-model="point.check.kind"
                      @change="
                        ($event) => {
                          point!.check!.id = point!.check!.kind === 'skill' ? 'perception' : 'dex'
                        }
                      "
                    >
                      <option value="skill">{{ controlText('domain.skillCheck') }}</option>
                      <option value="save">{{ controlText('domain.abilitySave') }}</option>
                    </select></label
                  ><label
                    >{{ controlText('map.skillAbility') }}<select v-model="point.check.id">
                      <template v-if="point.check.kind === 'skill'"
                        ><option v-for="(s, id) in SKILLS" :key="id" :value="id">
                          {{ skillDisplayName(id) }}
                        </option></template
                      ><template v-else
                        ><option v-for="id in ABILITIES" :key="id" :value="id">
                          {{ abilityDisplayName(id) }}
                        </option></template
                      >
                    </select></label
                  ><label
                    >{{ controlText('map.checkDC') }}<input
                      v-model.number="point.check.dc"
                      type="number"
                      min="1"
                      max="100" /></label
                ></template>
                <template v-if="point.kind === 'chest'"
                  ><label class="check-label"><input type="checkbox" :checked="point.repeatAccess !== false" @change="point.repeatAccess = ($event.target as HTMLInputElement).checked" />{{ controlI18n.global.locale.value === 'en' ? 'Allow repeated access (contents do not respawn)' : '允许重复访问（不会刷新物品）' }}</label><label
                    >{{ controlText('domain.goldPieces') }}<input
                      v-model.number="point.coins"
                      type="number"
                      min="0"
                      step=".01" /></label
                  ><label
                    >{{ controlText('domain.addItem') }}<select v-model="lootItem">
                      <option v-for="item in allItems" :key="item.id" :value="item.id">
                        {{ localizedEntryName(item) }}
                      </option>
                    </select></label
                  >
                  <div class="map-field-grid">
                    <label
                      >{{ controlText('domain.itemQuantity') }}<input v-model.number="lootQuantity" type="number" min="1" /></label
                    ><button class="secondary" @click="addLoot">{{ controlText('map.addChest') }}</button>
                  </div>
                  <div v-for="(drop, i) in point.loot" :key="i" class="map-inline">
                    <span>{{ itemName(drop.itemId) }} ×{{ drop.quantity }}</span
                    ><button
                      class="danger-text"
                      @click="
                        ($event) => {
                          point?.loot.splice(i, 1)
                        }
                      "
                    >
                      {{ controlText('game.remove') }}
                    </button>
                  </div></template
                >
                <PortalEditor
                  v-if="point.kind === 'exit' && draft"
                  :adventure="adventure"
                  :scene="draft"
                  :point="point"
                  :world="configWorld"
                  :busy="busy"
                  :dirty="dirty"
                  @update="Object.assign(point, $event)"
                  @command="run"
                />
                <template v-if="point.kind === 'exit'"
                  ><label
                    >{{ controlText('map.portalTarget') }}<select v-model="point.targetSceneId">
                      <option :value="null">{{ controlText('map.unconfigured') }}</option>
                      <option
                        v-for="s in adventure.scenes.filter((s) => s.id !== sceneId)"
                        :key="s.id"
                        :value="s.id"
                      >
                        {{ localizedEntryName(s) }}
                      </option>
                    </select></label
                  >
                  <div class="map-field-grid">
                    <label
                      >{{ controlText('map.entryX') }}<input
                        v-model.number="point.landing.x"
                        type="number"
                        min="0" /></label
                    ><label
                      >{{ controlText('map.entryY') }}<input v-model.number="point.landing.y" type="number" min="0"
                    /></label></div
                ></template>
                <details>
                  <summary>{{ controlText('map.itemResourceCost') }}</summary>
                  <label class="check"
                    ><input
                      type="checkbox"
                      :checked="!!point.consume"
                      @change="
                        ($event) => {
                          point!.consume = ($event.target as HTMLInputElement).checked
                            ? { itemId: 'torch', quantity: 1 }
                            : null
                        }
                      "
                    />{{ controlText('map.spendSpecified') }}</label
                  ><template v-if="point.consume"
                    ><label
                      >{{ controlText('map.spendItem') }}<select v-model="point.consume.itemId">
                        <option v-for="item in allItems" :key="item.id" :value="item.id">
                          {{ localizedEntryName(item) }}
                        </option>
                      </select></label
                    ><label
                      >{{ controlText('map.spendQuantity') }}<input
                        v-model.number="point.consume.quantity"
                        type="number"
                        min="1" /></label></template
                  ><label class="check"
                    ><input
                      type="checkbox"
                      :checked="!!point.resource"
                      @change="
                        ($event) => {
                          point!.resource = ($event.target as HTMLInputElement).checked
                            ? { id: 'second-wind', amount: 1 }
                            : null
                        }
                      "
                    />{{ controlText('map.spendResource') }}</label
                  ><template v-if="point.resource"
                    ><label
                      >{{ controlText('map.resourceId') }}<input v-model="point.resource.id" list="map-resource-ids" /></label
                    ><datalist id="map-resource-ids">
                      <option
                        v-for="r in character ? resources(character, store.content) : []"
                        :key="r.id"
                        :value="r.id"
                      >
                        {{ localizedEntryName(r) }}
                      </option></datalist
                    ><label
                      >{{ controlText('map.uses') }}<input
                        v-model.number="point.resource.amount"
                        type="number"
                        min="1" /></label
                  ></template>
                  <p class="muted">{{ controlText('map.costHelp') }}</p>
                </details>
                <button v-if="!inspectorTarget" class="primary" :disabled="busy" @click="saveScene">{{ controlText('map.savePoint') }}</button
                ><button class="danger-text" :disabled="busy" @click="deleteSelectedPoint">
                  {{ controlText('map.deletePoint') }}
                </button>
              </details>
            </template>
          </template>
          <template v-if="tab === 'annotation' && mode !== 'preview' && draft">
            <h3>{{ controlText('map.nameLabels') }}</h3>
            <p class="muted">
              {{ controlText('map.nameHelp') }}
            </p>
            <button class="secondary" :disabled="busy || mode !== 'edit'" @click="addAnnotation">
              {{ controlText('map.placeLabel') }}
            </button>
            <label
              >{{ controlText('map.chooseLabel') }}<select v-model="annotationId">
                <option value="">{{ controlText('game.choose') }}</option>
                <option v-for="a in draft.annotations ?? []" :key="a.id" :value="a.id">
                  {{ localizedEntryName(a) }}{{ a.hidden ? controlText('expressionTwo.hidden') : '' }}
                </option>
              </select></label
            >
            <template v-if="annotation">
              <label>{{ controlText('map.labelName') }}<input v-model="annotation.name" maxlength="120" /></label>
              <label>{{ controlText('map.labelNote') }}<textarea v-model="annotation.note" rows="3" /></label>
              <div class="map-field-grid">
                <label
                  >{{ controlText('map.labelX') }}<input
                    v-model.number="annotation.x"
                    type="number"
                    min="0"
                    :max="draft.grid.columns - 1"
                /></label>
                <label
                  >{{ controlText('map.labelY') }}<input
                    v-model.number="annotation.y"
                    type="number"
                    min="0"
                    :max="draft.grid.rows - 1"
                /></label>
                <label>{{ controlText('map.nameColor') }}<input v-model="annotation.color" type="color" /></label>
                <label
                  >{{ controlText('map.nameSize') }}<input
                    v-model.number="annotation.fontSize"
                    type="number"
                    min="12"
                    max="28"
                /></label>
                <label
                  >{{ controlText('map.textOffsetX') }}<input
                    v-model.number="annotation.offsetX"
                    type="number"
                    min="-200"
                    max="200"
                /></label>
                <label
                  >{{ controlText('map.textOffsetY') }}<input
                    v-model.number="annotation.offsetY"
                    type="number"
                    min="-200"
                    max="200"
                /></label>
              </div>
              <label class="check"
                ><input v-model="annotation.hidden" type="checkbox" />{{ controlText('map.hideLabel') }}</label
              >
              <div class="map-inline">
                <button class="primary" :disabled="busy" @click="saveScene">{{ controlText('map.saveLabel') }}</button
                ><button class="danger" :disabled="busy" @click="removeAnnotation">
                  {{ controlText('map.deleteLabel') }}
                </button>
              </div>
            </template>
          </template>
          <div v-if="mode === 'preview' && annotation" class="map-annotation-details">
            <h3>{{ localizedEntryName(annotation) }}</h3>
            <p>{{ annotation.note || controlText('expressionTwo.sceneNameLabels') }}</p>
          </div>
          <template v-if="tab === 'token' || mode === 'preview'"
            ><div v-if="mode === 'preview' && point" class="map-revealed">
              <h3>{{ localizedEntryName(point) }}</h3>
              <p>{{ point.note }}</p>
              <p v-if="['open', 'resolved', 'disarmed'].includes(point.state)">
                {{ point.revealed }}
              </p>
            </div>
            <h3>{{ controlText('map.tokensCombat') }}</h3>
            <label
              >{{ controlText('controls.chooseToken') }}<select v-model="tokenId">
                <option value="">{{ controlText('game.choose') }}</option>
                <option v-for="t in shownTokens" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
              </select></label
            ><template v-if="token"
              ><h3>
                <CharacterAvatar
                  :name="token.name"
                  :portrait="tokenPortraits.get(token.id)"
                  :size="32"
                />
                {{ localizedEntryName(token) }}
              </h3>
              <p class="muted">{{ controlText('quantity.cellDetail', {p0:(token.x),p1:(token.y),p2:(labels(token))}) }}</p>
              <div v-if="stats && (mode !== 'preview' || token.characterId)" class="map-stats">
                <strong>{{ stats.hp }} / {{ stats.maxHp }} {{ controlText('domain.hp') }}</strong><span>AC {{ stats.ac }}</span
                ><span>{{ controlText('controls.speed') }} {{ stats.speed }} {{ controlText('game.feet') }}</span
                ><small v-if="stats.temporaryHp">{{ controlText('domain.tempHP') }} {{ stats.temporaryHp }}</small
                ><span v-for="c in stats.conditions" :key="c">{{
                  localizedEntryName(CONDITIONS.find((s) => s.id === c)) ?? c
                }}</span>
              </div>
              <button
                v-if="token.characterId"
                class="secondary"
                @click="
                  ($event) => {
                    openCharacter()
                  }
                "
              >
                {{ controlText('map.characterBag') }}
              </button>
              <template v-if="mode !== 'preview'"
                ><h3>{{ controlText('map.movementPreview') }}</h3>
                <button
                  v-if="
                    actor && stats?.conditions.includes('prone') && encounter?.phase === 'active'
                  "
                  class="secondary"
                  :disabled="busy"
                  @click="
                    ($event) => {
                      run({
                        type: 'combat',
                        sceneId,
                        command: {
                          type: 'move',
                          actorId: actor!.id,
                          distance: 0,
                          difficult: false,
                          stand: true,
                          note: '地图起身',
                        },
                      })
                    }
                  "
                >
                  {{ controlText('map.standCost') }}
                </button>
                <p v-if="!route.length" class="muted">{{ controlText('map.waypointHelp') }}</p>
                <template v-else
                  ><p>{{ controlText('quantity.cellsCost', {p0:(controlText('map.route')),p1:(route.length),p2:(movePreview.cost),p3:(controlText('game.feet'))}) }}</p>
                  <p v-if="movePreview.error" class="map-error">{{ displayFeedback(movePreview.error,'error') }}</p>
                  <p v-if="actor && stats">
                    {{ controlText('map.remainingTurn') }}
                    {{ Math.max(0, stats.speed + actor.turn.dash - actor.turn.movement) }} {{ controlText('game.feet') }}
                  </p>
                  <div class="map-inline">
                    <button
                      class="subtle"
                      @click="
                        ($event) => {
                          waypoints.pop()
                        }
                      "
                    >
                      {{ controlText('map.undoSegment') }}</button
                    ><button
                      class="subtle"
                      @click="
                        ($event) => {
                          waypoints = []
                        }
                      "
                    >
                      {{ controlText('map.clearRoute') }}
                    </button>
                  </div>
                  <label class="check"
                    ><input v-model="reactionsConfirmed" type="checkbox" />{{ controlText('map.opportunityConfirmed') }}</label
                  ><button
                    class="primary"
                    :disabled="busy || !!movePreview.error"
                    @click="
                      ($event) => {
                        run({
                          type: 'move',
                          sceneId,
                          tokenId,
                          path: route,
                          gm,
                          reason,
                          reactionsConfirmed,
                        })
                      }
                    "
                  >
                    {{ controlText('map.submitMove') }}
                  </button></template
                >
                <details v-if="mode === 'edit' && tokenDraft">
                  <summary>{{ controlText('map.tokenAppearance') }}</summary>
                  <label>{{ controlText('map.tokenName') }}<input v-model="tokenDraft.name" /></label
                  ><label
                    >{{ controlText('map.tokenSpan') }}<select v-model.number="tokenDraft.span">
                      <option :value="1">1 × 1</option>
                      <option :value="2">2 × 2</option>
                      <option :value="3">3 × 3</option>
                      <option :value="4">4 × 4</option>
                    </select></label
                  ><label>{{ controlText('map.facing') }}<input v-model.number="tokenDraft.facing" type="number" /></label
                  ><label>{{ controlText('map.tokenColor') }}<input v-model="tokenDraft.color" type="color" /></label
                  ><label class="check"
                    ><input v-model="tokenDraft.hidden" type="checkbox" />{{ controlText('map.hideToken') }}</label
                  ><button
                    class="secondary"
                    :disabled="busy"
                    @click="
                      ($event) => {
                        run({ type: 'token-edit', sceneId, token: tokenDraft! })
                      }
                    "
                  >
                    {{ controlText('map.saveToken') }}
                  </button>
                </details></template
              >
            </template>
            <template v-if="mode !== 'preview' && !designOnly">
              <BattleSessionsPanel
                v-if="adventure && scene"
                :workshop="store"
                :adventure="adventure"
                :scene-id="sceneId"
                :blocked="dirty"
                @select="openBattle"
              />
              <button v-if="encounter" class="primary" @click="openBattle">{{ controlText('map.openCombat') }}</button>
              <template v-if="!online"
                ><h3>{{ controlText('map.legacyEncounter') }}</h3>
                <template v-if="encounter"
                  ><p>{{ localizedEntryName(encounter) }} · {{ encounter.phase }}</p>
                  <button
                    class="primary"
                    @click="
                      ($event) => {
                        openBattle()
                      }
                    "
                  >
                    {{ controlText('map.openLocalCombat') }}
                  </button>
                  <details v-if="encounter.phase === 'setup'">
                    <summary>{{ controlText('map.quickNpc') }}</summary>
                    <label>{{ controlText('game.npcName') }}<input v-model="npc.name" /></label>
                    <div class="map-field-grid">
                      <label
                        >{{ controlText('map.npcHP') }}<input
                          v-model.number="npc.maxHp"
                          type="number"
                          min="1" /></label
                      ><label
                        >{{ controlText('map.npcAC') }}<input v-model.number="npc.ac" type="number" min="0" /></label
                      ><label
                        >{{ controlText('map.npcRange') }}<input
                          v-model.number="npc.attacks[0]!.range"
                          type="number"
                          min="0" /></label
                      ><label
                        >{{ controlText('map.npcAttackType') }}<select v-model="npc.attacks[0]!.kind">
                          <option value="weapon">{{ controlText('domain.weapon') }}</option>
                          <option value="thrown">{{ controlText('map.thrown') }}</option>
                          <option value="spell">{{ controlText('game.spellAttack') }}</option>
                        </select></label
                      >
                    </div>
                    <button
                      class="secondary"
                      :disabled="busy"
                      @click="
                        ($event) => {
                          npc.hp = npc.maxHp
                          npc.attacks[0]!.longRange = npc.attacks[0]!.range
                          run({
                            type: 'combat',
                            sceneId,
                            command: { type: 'add-npc', npc: clone(npc), side: 'enemy' },
                          })
                        }
                      "
                    >
                      {{ controlText('map.addNpc') }}
                    </button>
                    <p class="muted">{{ controlText('map.combatConfigHelp') }}</p>
                  </details>
                  <button
                    v-if="encounter.phase !== 'active'"
                    class="subtle"
                    :disabled="busy"
                    @click="run({ type: 'encounter-unlink', sceneId })"
                  >
                    {{ controlText('map.unlinkEncounter') }}
                  </button>
                  <p v-if="encounter.phase !== 'active'" class="muted">
                    {{ controlText('map.unlinkHelp') }}
                  </p></template
                ><template v-else
                  ><button
                    class="secondary"
                    :disabled="busy"
                    @click="
                      ($event) => {
                        run({ type: 'encounter-create', sceneId, name: scene!.name + '遭遇' })
                      }
                    "
                  >
                    {{ controlText('map.newEncounter') }}</button
                  ><label
                    >{{ controlText('map.linkEncounter') }}<select v-model="existingEncounterId">
                      <option value="">{{ controlText('game.choose') }}</option>
                      <option
                        v-for="e in store.encounters.filter((e) => !e.session?.canceled)"
                        :key="e.id"
                        :value="e.id"
                      >
                        {{ localizedEntryName(e) }}
                      </option>
                    </select></label
                  ><button
                    class="subtle"
                    :disabled="busy || !existingEncounterId"
                    @click="
                      ($event) => {
                        run({ type: 'encounter-link', sceneId, encounterId: existingEncounterId })
                      }
                    "
                  >
                    {{ controlText('map.linkTokens') }}
                  </button></template
                > </template
              ><TemplateEditor
                v-if="draft"
                :scene="draft"
                :cursor="cursor"
                :busy="busy"
                @save="saveScene"
              />
            </template>
          </template>
          <template v-if="tab === 'save' && mode !== 'preview'"
            ><h3>{{ controlText('map.entrySaves') }}</h3>
            <p class="muted">
              {{ controlText('map.saveLimits') }}
            </p>
            <label
              >{{ controlText('domain.chooseSave') }}<select v-model="cpId" :aria-label="controlText('domain.chooseSave')">
                <option value="">{{ controlText('game.choose') }}</option>
                <option
                  v-for="cp in [...adventure.checkpoints].reverse()"
                  :key="cp.id"
                  :value="cp.id"
                >
                  {{ cp.pinned ? '★ ' : '' }}{{ localizedEntryName(cp) }} ·
                  {{ uiDate(cp.at,'datetime') }}
                </option>
              </select></label
            ><template v-if="checkpoint"
              ><label>{{ controlText('map.saveName') }}<input v-model="cpName" /></label
              ><label class="check"
                ><input v-model="cpPinned" type="checkbox" />{{ controlText('map.manualSave') }}</label
              ><button
                class="secondary"
                :disabled="busy"
                @click="
                  ($event) => {
                    run({
                      type: 'checkpoint-edit',
                      checkpointId: cpId,
                      name: cpName,
                      pinned: cpPinned,
                    })
                  }
                "
              >
                {{ controlText('map.saveMarker') }}
              </button>
              <div class="map-checkpoint-preview">
                <h4>{{ controlText('map.restorePreview') }}</h4>
                <p>{{ checkpointSceneName }}</p>
                <p v-for="c in checkpoint.snapshot.characters" :key="c.id">
                  {{ controlText('quantity.lootSummary', {p0:(localizedEntryName(c.build)),p1:(c.runtime?.hp),p2:(c.coins),p3:(c.inventory.length)}) }}</p>
                <small
                  >{{ controlText('quantity.restoreWorld', {p0:(checkpoint.snapshot.adventure.scenes.length),p1:(checkpoint.snapshot.encounters.length)}) }}</small
                >
              </div>
              <button class="primary" :disabled="busy" @click="restore">{{ controlText('map.restoreEntry') }}</button
              ><button
                class="danger-text"
                :disabled="busy"
                @click="
                  ($event) => {
                    ask('删除此入场存档点？') &&
                      run({ type: 'checkpoint-delete', checkpointId: cpId })
                  }
                "
              >
                {{ controlText('map.deleteSave') }}
              </button></template
            ></template
          >
          <div v-if="mode !== 'preview' && !designOnly" class="map-gm-adjust">
            <label class="check"><input v-model="gm" type="checkbox" />{{ controlText('map.gmRange') }}</label
            ><label v-if="gm"
              >{{ controlText('domain.gmReason') }}<textarea
                v-model="reason"
                rows="2"
                :placeholder="controlText('map.movementBasis')"
              /></label
            ><button
              class="subtle"
              :disabled="busy || !(canUndo || adventure.log.some((e) => e.before && !e.undone))"
              @click="
                ($event) => {
                  run({ type: 'undo' })
                }
              "
            >
              {{ controlText('map.undoMap') }}
            </button>
          </div>
          <div v-if="mode === 'edit' && draft" class="gm-save-footer">
            <span role="status">{{ uiLabel(saveStatus) }}</span
            ><button class="primary" :disabled="busy || !dirty" @click="saveScene">
              {{ controlText('domain.saveCurrentScene') }}
            </button>
          </div>
        </aside></Teleport>
      </div>
      <details v-if="mode !== 'preview' && !designOnly" class="map-journal">
        <summary>{{ controlText('mapExperience.adventureLog') }} {{ adventure.log.length }}</summary>
        <p class="muted">
          {{ controlText('map.mapHistoryHelp') }}
        </p>
        <ol>
          <li
            v-for="event in [...adventure.log].reverse()"
            :key="event.id"
            :class="{ undone: event.undone }"
          >
            <time>{{ uiDate(event.at,'time') }}</time> {{ event.detail }}
          </li>
        </ol>
      </details>
      <NpcConfigTools
        v-if="!online && adventure && mode !== 'preview' && !designOnly"
        :world="configWorld"
        :adventure="adventure"
        :busy="busy"
        :submit-command="configCommand"
      />
      <BroadcastPanel
        v-if="!online && adventure && mode !== 'preview' && !designOnly"
        :adventure="adventure"
        :world="configWorld"
        :submit-command="configCommand"
        :characters="store.characters.map((c) => ({ id: c.id, name: c.build.name }))"
        :events="adventure.broadcastLog?.events ?? []"
        :branch-id="adventure.broadcastLog?.branchId ?? 'legacy'"
        gm
        :busy="busy"
        @command="run($event)"
      />
    </template>
  </main>
</template>
