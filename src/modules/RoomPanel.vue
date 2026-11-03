<script setup lang="ts">
import {containerAccessLabel} from './item-spell-presentation'
import OpeningControl from './opening/OpeningControl.vue'
import OpeningReader from './opening/OpeningReader.vue'

import {isDeliveryCommand} from '../online/delivery-command'
import {uiLabel} from './ui-label'
import {localizedEvent} from '../shared/localization/system-messages'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import SummonPanel from './SummonPanel.vue'
import SummonActions from './summons/SummonActions.vue'
import type {SummonAction} from '../persistence/summon-action-schema'
import SceneEffectTools from './SceneEffectTools.vue'
import '../app/m2-controls.css'
import RoomTopNav from './workspace/RoomTopNav.vue'
import RoomSettings from './workspace/RoomSettings.vue'
import ContainerInventoryDialog from './scene-tools/ContainerInventoryDialog.vue'
import SceneLightingControl from './scene-tools/SceneLightingControl.vue'
import type { ContainerAction } from '../persistence/point-container-schema'
import WorkspaceResizeHandle from './workspace/WorkspaceResizeHandle.vue'
import { useRoomWorkspaceLayout, TOOL_MIN, MESSAGE_MIN } from './workspace/useRoomWorkspaceLayout'
import { workspaceText } from './workspace/workspace-labels'
import CharacterQuickList from './workspace/CharacterQuickList.vue'
import '../app/gm-workspace.css'
import '../app/character.css'
import '../app/scene-theme.css'
import '../app/ai-theme.css'
import '../app/room-workspace.css'
import StoryItemsPanel from './StoryItemsPanel.vue'
import ExplorationControlTools from './ExplorationControlTools.vue'
import ExplorationDispelZoneForm from './ExplorationDispelZoneForm.vue'
import M3GmTools from './M3GmTools.vue'
import M1SpellTools from './M1SpellTools.vue'
import CorpsePanel from './CorpsePanel.vue'
import PointItemPicker from './scene-tools/PointItemPicker.vue'
import GmControlPanel from './GmControlPanel.vue'
import { useOperationFeedback } from '../app/useOperationFeedback'
import metadata from '../../package.json'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useWorkshop } from '../app/store'
import { api, roomClient, type Credentials } from '../online/client'
import type { RoomAction, RoomCommand, RoomView, RoomMember } from '../online/protocol'
import { actionSchema } from '../online/protocol'
import { directPath } from '../core/map'
import { defaultEnvironment } from '../core/combat-rules'
import type { CombatCommand } from '../core/combat-types'
import { runtimeDerived } from '../core/runtime'
import type { MapScene, MapTemplate, Position } from '../core/map-types'
import GroundPickup from './scene-tools/GroundPickup.vue'
import MapPanel from './MapPanel.vue'
import { useLoadedMapBackground } from './useLoadedMapBackground'
import { gmSightRow } from './gm-sight-row'
import FogTools from './FogTools.vue'
import BroadcastPanel from './BroadcastPanel.vue'
import AiPanel from './AiPanel.vue'
import NpcPeerPanel from './NpcPeerPanel.vue'
import '../app/broadcast.css'
import BattlePanel from './BattlePanel.vue'
import RuntimePanel from './RuntimePanel.vue'
import RuntimeInventory from './RuntimeInventory.vue'
import type { RuntimeCommand } from '../core/runtime'
import RoomScene from './RoomScene.vue'
import {provideMapSelection} from './map-selection/selection'
import {provideMapFeedback} from './map-selection/useMapFeedback'
import RoomSceneHeader from './RoomSceneHeader.vue'
import CharacterAvatar from './CharacterAvatar.vue'
import RequestDisclosure from './RequestDisclosure.vue'
import { useRequestDisclosure } from './useRequestDisclosure'
import RoomCharacterRequests from './RoomCharacterRequests.vue'
import RoomReviewDock from './RoomReviewDock.vue'
import PlayerSpellRequests from './PlayerSpellRequests.vue'
import { COVER_NAMES } from '../core/map-spatial'
import SealChatPanel from './SealChatPanel.vue'
import QqPanel from './QqPanel.vue'
import QqDialogueReviewSettings from './QqDialogueReviewSettings.vue'
import QqMemberPanel from './QqMemberPanel.vue'
import PlayerCombatPanel from './PlayerCombatPanel.vue'
import ExplorationActionPanel from './ExplorationActionPanel.vue'
import { notifications } from '../app/notifications'
import { isRepeatedEndpoint } from '../core/map-experience'
import MapQuickActions from './exploration/MapQuickActions.vue'
import QuestPanel from './QuestPanel.vue'
import ExplorationGmPanel from './exploration/ExplorationGmPanel.vue'
import type { BattleOpening } from '../core/battle-types'
import RoomIntentCard from './RoomIntentCard.vue'
import ReviewSettings from './ReviewSettings.vue'
import PracticalPlayerWindows from './review/PracticalPlayerWindows.vue'
import PracticalM1Request from './review/PracticalM1Request.vue'
import NpcTurnPanel from './NpcTurnPanel.vue'
import RoomOnboarding from './RoomOnboarding.vue'
import RoomRunStatus from './RoomRunStatus.vue'
import RoomMessageDock from './messages/RoomMessageDock.vue'
import { useRoomExternalStatus } from './useRoomExternalStatus'
import RoomIdentityPanel from './RoomIdentityPanel.vue'
import RoomDicePanel from './dice/RoomDicePanel.vue'
import DiceResults from './dice/DiceResults.vue'
import RoomConnectionPanel from './RoomConnectionPanel.vue'
import { defaultPlayerImport, characterPurpose } from '../core/character-purpose'
const props = defineProps<{ active?: boolean
  createdRoom?: { roomId: string; token: string; invite: string; view: RoomView } | null
}>()
const local = useWorkshop(),
  client = roomClient(),
  { view, status, busy, workshop, broadcastEvents, broadcastGap, diceBaseline } = client
const externalStatus = useRoomExternalStatus(view, client.integration)
const mapSelection=provideMapSelection(()=>`${view.value?.id??''}:${view.value?.broadcast.branchId??''}:${view.value?.self.id??''}:${view.value?.self.role??''}:${view.value?.self.characterIds.join(',')??''}:${view.value?.self.actorIds.join(',')??''}`)
provideMapFeedback(()=>({feed:view.value?.mapFeedback,epoch:diceBaseline.value,live:props.active!==false&&status.value.includes('已同步')}))
const emit = defineEmits<{ workshop: [] }>()
const reviewDock = ref<InstanceType<typeof RoomReviewDock> | null>(null)
const messageDock = ref<InstanceType<typeof RoomMessageDock> | null>(null)
watch(()=>props.active,active=>{if(active===false)mapSelection.cancelAll()})
watch(()=>[...(view.value?.practicalEffectInputs??[]),...(view.value?.practicalWindows??[])].map(p=>p.id).join(','),(next,old)=>{if(mapSelection.current.value&&next&&next!==old){mapSelection.showOriginal(false);mapSelection.notice.value='有新的待回应／必要落点；原选取草稿保留，请先处理原表单'}})
const identityEpoch = ref(0)
const characterRequestCount = computed(
  () => (view.value?.characterRequests ?? []).filter((r) => r.status === 'pending').length,
)
const sightTarget = ref('')
const corpseId = ref('')
const containerPointId = ref(''), pendingContainerId = ref('')
const corpseSpellTarget = ref('')
function openCorpseSpell() { corpseSpellTarget.value = view.value?.scene?.corpses?.find(c => c.id === corpseId.value)?.entityId ?? ''; if (!gm.value) tab.value = 'intents' }
const interactionItems=ref<string[]>([]), interactionCosts=ref(false),interactionLimits=ref<Record<string,number>>({})
const controlHeld=computed(()=>!gm.value&&view.value?.gmControls?.some(h=>h.targetKind==='character'&&h.targetId===characterId.value))
const mapNames = ref(true),
  publicMap = ref<InstanceType<typeof RoomScene> | null>(null)
const quickActions = ref<InstanceType<typeof MapQuickActions> | null>(null)
const quickMode = ref<'move' | 'jump' | 'attack' | 'spell' | 'item'>('move'),
  waypoints = ref<Position[]>([]),
  previewPath = ref<Position[]>([]),
  jumpRange = ref<Position[]>([]),
  previewMode = ref<'move' | 'jump'>('move'),
  previewValid = ref(true)
function quickRequest(action: RoomAction, review: boolean, summary: string) {
  if (review && !gm.value) intent(action, summary)
  else send(action, summary)
}
async function navigate(tabName: string) {
  if (tabName === 'quick-review') { reviewDock.value?.open();return }
  if(gm.value&&tab.value==='map'&&tabName!=='map'&&mapPanel.value&&!(await mapPanel.value.flush()))return
  tab.value=tabName
}
function messageHistory() {
  tab.value = 'ai'
  messageDock.value?.close()
}
const name = ref('旅团的冒险'),
  nickname = ref('主持人'),
  adventureId = ref(''),
  roomId = ref(''),
  invite = ref(''),
  createdInvite = ref('')
const feedback = ref(''),
  failed = ref(false),
  working = ref(false),
  tab = ref('map'),
  characterId = ref(''),
  battleId = ref(''),
  tokenId = ref(''),
  groundId = ref(''),
  pointId = ref(''),
  movementReview = ref(false),
  quickActive = ref(false),
  quickPicking = ref(false),
  mapSidebar = ref(true),
  mapFocus = ref(false),
  inventoryCost = ref<'free' | 'action' | 'bonus'>('free')
const createCharacterIds = ref<string[]>([]),
  importCharacterIds = ref<string[]>([]),
  includeNpcCopies = ref(false),
  localCharacters = computed(() => local.characters.filter((c) => c.status === 'complete')),
  localAdventure = computed(() => local.adventures.find((a) => a.id === adventureId.value)),
  importableCharacters = computed(() =>
    localCharacters.value.filter((c) => !(view.value?.importedCharacterIds ?? []).includes(c.id)),
  )
const seenCreate = new Set<string>(),
  seenImport = new Set<string>()
watch(
  localCharacters,
  (list) => {
    createCharacterIds.value = createCharacterIds.value.filter((id) =>
      list.some((c) => c.id === id && c.purpose !== 'npc' && !c.npcOwnerId),
    )
    for (const c of list) {
      if (!seenCreate.has(c.id) && defaultPlayerImport(c)) createCharacterIds.value.push(c.id)
      seenCreate.add(c.id)
    }
  },
  {
    immediate: true,
  },
)
watch(
  importableCharacters,
  (list) => {
    importCharacterIds.value = importCharacterIds.value.filter((id) =>
      list.some((c) => c.id === id),
    )
    for (const c of list) {
      if (!seenImport.has(c.id) && defaultPlayerImport(c)) importCharacterIds.value.push(c.id)
      seenImport.add(c.id)
    }
  },
  {
    immediate: true,
  },
)
const fromItem = ref(''),
  giveTarget = ref(''),
  quantity = ref(1)
const runtimeSection = ref('status'),
  runtimeSectionRequest = ref(0)
function inspectQuickAbility() {
  runtimeSection.value = 'spells'
  runtimeSectionRequest.value++
  tab.value = 'character'
}
const env = ref(defaultEnvironment())
const battleRequestReason = ref('')
async function requestBattle() {
  if (!view.value?.scene || !characterId.value) return
  const ticket = battleDisclosure.ticket()
  const success = await send({
    kind: 'map',
    command: {
      type: 'battle-request',
      sceneId: view.value.scene.id,
      name: '玩家请求战斗或增援',
      reason: battleRequestReason.value,
      source: 'player',
      sourceId: view.value.self.id,
      characterId: characterId.value,
    },
  })
  if (success) {
    battleRequestReason.value = ''
    battleDisclosure.acknowledge(true, ticket)
  }
}
const currentBattleRequests = computed(() =>
  (view.value?.battleRequests ?? []).filter(
    (r) =>
      r.characterId === characterId.value && (!r.sceneId || r.sceneId === view.value?.scene?.id),
  ),
)
const battleDisclosure = useRequestDisclosure(
  () => `${view.value?.id}:${view.value?.scene?.id}:${characterId.value}`,
  () => currentBattleRequests.value.length > 0,
)
const battleSummary = computed(() => {
  const r = currentBattleRequests.value.at(-1)
  return r
    ? `${r.reason.slice(0, 100)} · ${r.status === 'pending' ? '等待 GM 确认' : r.status === 'accepted' ? '已确认' : '已拒绝'} · ${r.id}`
    : ''
})
const aiName = ref('外部意图助手'),
  aiCharacter = ref(''),
  aiActor = ref(''),
  aiSecret = ref(''),
  actionText = ref(''),
  intentSummary = ref('请求执行角色行动')
const gm = computed(() => view.value?.self.role === 'gm'),
  scene = computed(() => view.value?.scene),
  character = computed(() => view.value?.ownCharacters.find((c) => c.id === characterId.value))
const summonSelection=ref(''),summonPoint=ref<{x:number;y:number;height:number}>()
const mapSummons=computed(()=>view.value?.summons?.filter(i=>i.controlled&&i.kind!=='force'&&i.state==='present'&&i.sceneId===scene.value?.id)??[]),selectedSummon=computed(()=>mapSummons.value.find(i=>i.id===summonSelection.value)),summonGroups=computed(()=>[...new Set(mapSummons.value.map(i=>i.sourceName??'实际来源'))].map(name=>({name,instances:mapSummons.value.filter(i=>(i.sourceName??'实际来源')===name)})))
watch(mapSummons,list=>{if(!list.some(i=>i.id===summonSelection.value))summonSelection.value=''})
watch(summonSelection,id=>{if(id){tokenId.value=id;waypoints.value=[];previewPath.value=[]}else if(characterId.value)tokenId.value=scene.value?.tokens.find(t=>t.characterId===characterId.value)?.id??'';summonPoint.value=undefined})
function summonRequest(action:SummonAction){if(!view.value)return;send(gm.value?{kind:'summon-action',action}:{kind:'intent-submit',action:{kind:'summon',action},summary:action.note,source:'player',baseWorldRevision:view.value.worldRevision})}
const selectedToken = computed(() => scene.value?.tokens.find((t) => t.id === tokenId.value)),
  point = computed(() => scene.value?.points.find((p) => p.id === pointId.value))
const sightCandidates = computed(() =>
  gm.value && view.value?.world && scene.value
    ? gmSightRow(view.value.world, scene.value.id, tokenId.value, workshop.content)
    : (scene.value?.sightLines ?? []).filter((r) => r.fromId === tokenId.value),
)
const sight = computed(() => sightCandidates.value.find((r) => r.toId === sightTarget.value))
const tabsOpen = ref(false)
const railOpen=ref(false),editedSceneId=ref(''),railTrigger=ref<HTMLButtonElement|null>(null)
function closeSceneRail(){if(workspace.geometry.value.desktop)workspace.toolsClosed.value=true;else railOpen.value=false;nextTick(()=>railTrigger.value?.focus())}
function toggleTools(){if(workspace.geometry.value.desktop)workspace.toolsClosed.value=!workspace.toolsClosed.value;else railOpen.value=!railOpen.value}
const editingScene=computed(()=>view.value?.world?.adventures[0]?.scenes.find(s=>s.id===editedSceneId.value)??scene.value)
const navItems=computed(()=>Object.entries(tabLabels).map(([id,label])=>({id,label:id==='map'&&!gm.value?controlText('room.publicMap'):uiLabel(label)+(id==='intents'?' · '+(view.value?.intents.filter(i=>i.status==='pending').length??0):'')})))
const tabLabels: Record<string, string> = {
  map: '场景与探索',
  character: '角色与背包',
  battle: '战斗',
  members: '成员与权限',
  intents: '意图审核',
  broadcast: '事件广播',
  ai: 'AI 旁白与 NPC',
  integration: '外部接入',
  settings: '设置',
}
const currentTabLabel = computed(() =>
  tab.value === 'map' ? (gm.value ? controlText('domain.sceneExplore') : controlText('room.publicMap')) : uiLabel(tabLabels[tab.value]),
)
const messageDockEnabled = ref(true)
const MAP_HEIGHT_DEFAULT = { gm: 630, player: 648 } as const
function readMapHeight(key: 'gm' | 'player') {
  try {
    const saved = Number(localStorage.getItem('trpg-map-height:' + key))
    if (Number.isFinite(saved) && saved >= 260) return Math.min(900, Math.round(saved))
  } catch {}
  return MAP_HEIGHT_DEFAULT[key]
}
const mapHeights = { gm: ref(readMapHeight('gm')), player: ref(readMapHeight('player')) }
provide('trpg-map-heights', mapHeights)
for (const key of ['gm', 'player'] as const) {
  watch(mapHeights[key], (value) => {
    try {
      localStorage.setItem('trpg-map-height:' + key, String(value))
    } catch {}
  })
}
const mapHeight = computed(() => (gm.value ? mapHeights.gm.value : mapHeights.player.value))
function resetMapHeight() {
  const key = gm.value ? 'gm' : 'player'
  mapHeights[key].value = MAP_HEIGHT_DEFAULT[key]
}
const railMode = ref<'room' | 'scene' | 'role'>('room')
const railUserPicked = ref(false)
function pickRail(mode: 'room' | 'scene' | 'role') {
  railMode.value = mode
  railUserPicked.value = mode === 'role'
}
watch(gm,()=>{railMode.value='scene'},{immediate:true})
watch(tab, (value) => {
  if (value === 'character') {
    railMode.value = 'role'
    return
  }
  if (railUserPicked.value) return
  railMode.value = value === 'map' ? (gm.value ? 'scene' : 'room') : 'room'
})
const narrow = ref(typeof window !== 'undefined' && window.innerWidth <= 1280)
const roleRailWide = ref(typeof window !== 'undefined' && window.innerWidth > 1024)
const roleRailTarget = computed(() => (roleRailWide.value ? '#runtime-status-rail-host' : ''))
watch(() => view.value?.encounter?.phase === 'active' ? view.value.encounter.id : '', (id, previous) => {
  if (id && id !== previous) { railMode.value = 'role'; railOpen.value = true }
}, { immediate: true })
const workspaceFocused = computed(() => !gm.value && tab.value === 'map' && mapFocus.value)
const workspace = useRoomWorkspaceLayout(gm, messageDockEnabled, workspaceFocused)
const railWidth = workspace.toolWidth
const toolsVisible = computed(() => workspace.geometry.value.desktop ? !workspace.toolsClosed.value && !workspaceFocused.value : railOpen.value)
const workspaceStyle = computed(() => ({
  '--character-rail-w': railWidth.value + 'px',
  '--tool-rail-width': railWidth.value + 'px',
  '--tool-rail-space': workspace.geometry.value.toolSpace + 'px',
  '--message-rail-width': workspace.messageWidth.value + 'px',
  '--message-rail-space': workspace.geometry.value.messageSpace + 'px',
}))
function focusQuickToken(id: string) {
  tab.value = 'map'
  nextTick(() => selectToken(id))
}
function selectQuickCharacter(id: string) {
  characterId.value = id
  navigate('character')
}
function syncNarrow() {
  narrow.value = typeof window !== 'undefined' && window.innerWidth <= 1280
  roleRailWide.value = typeof window !== 'undefined' && window.innerWidth > 1024
}
const railFloat = ref(false)
let railFloatRaf = 0
function syncRailFloat() {
  if (railFloatRaf) return
  railFloatRaf = requestAnimationFrame(() => {
    railFloatRaf = 0
    railFloat.value = window.scrollY > 8
  })
}
onMounted(() => {
  syncNarrow()
  syncRailFloat()
  window.addEventListener('resize', syncNarrow)
  window.addEventListener('scroll', syncRailFloat, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncNarrow)
  window.removeEventListener('scroll', syncRailFloat)
  document.body.classList.remove('rail-resizing')
})
const mapPanel = ref<InstanceType<typeof MapPanel> | null>(null)
function jumpTo(id: string) {
  if(gm.value&&['room-exploration','room-quests'].includes(id)){railMode.value='room';railOpen.value=true}
  const reveal = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (tab.value !== 'map') {
    tab.value = 'map'
    nextTick(reveal)
  } else reveal()
}
function openSceneInspector() {
  railMode.value='scene';railOpen.value=true
  tab.value = 'map'
  nextTick(() => {
    mapPanel.value?.openInspector()
    document.getElementById('room-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
const closeMapControls = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !event.defaultPrevented && tab.value === 'map') {
    quickActive.value = false
    mapFocus.value = false
  }
}
onMounted(() => window.addEventListener('keydown', closeMapControls))
onBeforeUnmount(() => window.removeEventListener('keydown', closeMapControls))
watch(mapSidebar, (open) => {
  if (!open) quickActive.value = false
})
watch(tab, () => {
  quickActive.value = false
  mapFocus.value = false
})
watch(sightCandidates, (list) => {
  if (!list.some((r) => r.toId === sightTarget.value)) sightTarget.value = ''
})
const actor = computed(() =>
    view.value?.encounter?.actors.find((a) => a.characterId === characterId.value),
  ),
  controlled = computed(() => view.value?.ownCharacters ?? [])
const derived = computed(() =>
  character.value ? runtimeDerived(character.value, workshop.content) : null,
)
const latestBroadcast = computed(() =>
  [...broadcastEvents.value]
    .reverse()
    .find((e) => e.branchId === view.value?.broadcast.branchId && e.audience.kind !== 'gm'),
)
const latestBroadcastPresentation = computed(() => latestBroadcast.value ? localizedEvent(latestBroadcast.value,controlI18n.global.locale.value) : null)
const { background } = useLoadedMapBackground(() => {
  const v = view.value, s = v?.scene, b = s?.background
  if (!v || !s || !b) return { scope: '' }
  const asset = workshop.assets.find(a => a.id === b.assetId)
  const assetScope = b.assetId.startsWith('fog-' + s.id + '-') ? 'fog-' + s.id : b.assetId
  return {
    scope: JSON.stringify([v.id, v.self.id, v.self.role, v.self.characterIds, v.self.actorIds, v.broadcast.branchId, s.id, s.grid, { ...b, assetId: assetScope }]),
    blob: asset?.preview?.blob ?? asset?.blob,
  }
})
watch(
  () => JSON.stringify(view.value?.environment),
  () => {
    if (view.value) env.value = { ...view.value.environment }
  },
)
watch(
  controlled,
  (list) => {
    if (!list.some((c) => c.id === characterId.value)) characterId.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
watch(characterId, (id) => {
  tokenId.value = scene.value?.tokens.find((t) => t.characterId === id)?.id ?? ''
})
watch(
  () => [scene.value?.id, ...(scene.value?.tokens.map((t) => t.id) ?? [])].join('|'),
  () => {
    if (!scene.value?.tokens.some((t) => t.id === tokenId.value))
      tokenId.value = scene.value?.tokens.find((t) => t.characterId === characterId.value)?.id ?? ''
  },
)
function selectCharacter(id: string) {
  summonSelection.value=''
  characterId.value = id
  tokenId.value = scene.value?.tokens.find((t) => t.characterId === id)?.id ?? ''
}
watch(
  () => local.adventures,
  (list) => {
    if (!adventureId.value) adventureId.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
async function run(fn: () => Promise<unknown>, message = '操作已由服务端保存') {
  if (working.value || busy.value) return false
  working.value = true
  feedback.value = ''
  failed.value = false
  try {
    await fn()
    feedback.value = message
    return true
  } catch (e) {
    feedback.value = e instanceof Error ? e.message : String(e)
    failed.value = true
    return false
  } finally {
    working.value = false
  }
}
const send = (command: RoomCommand, message?: string) => isDeliveryCommand(command)?client.send(command).then(()=>true):run(() => client.send(command), message)
async function submitConfig(command: RoomCommand, requestId?: string) {
  await client.send(command, requestId)
  return true
}
async function combatInventory(command: RuntimeCommand) {
  if (!scene.value || !actor.value) return false
  intent(
    {
      kind: 'map',
      command: {
        type: 'combat',
        sceneId: scene.value.id,
        command: {
          type: 'inventory',
          actorId: actor.value.id,
          command,
          cost: inventoryCost.value,
          requirementsConfirmed: false,
          note: '玩家请求战斗背包操作',
        },
      },
    },
    '战斗背包操作',
  )
  return true
}
function clearIdentityUi() {
  createdInvite.value = ''
  aiSecret.value = ''
  actionText.value = ''
  intentSummary.value = '请求执行角色行动'
  invite.value = ''
  roomId.value = ''
  sightTarget.value = ''
  waypoints.value = []
  previewPath.value = []
  quickMode.value = 'move'
  fromItem.value = ''
  giveTarget.value = ''
  quantity.value = 1
  battleRequestReason.value = ''
  aiCharacter.value = ''
  aiActor.value = ''
  tab.value = 'map'
  identityEpoch.value++
}
function exitRoom() {
  client.disconnect(true)
  clearIdentityUi()
}
async function createRoom() {
  await run(async () => {
    const archive = JSON.parse(await local.exportAdventure(adventureId.value))
    const included = new Set(archive.characters.map((c: { id: string }) => c.id)),
      characters = localCharacters.value
        .filter((c) => createCharacterIds.value.includes(c.id) && !included.has(c.id))
        .map((c) => JSON.parse(local.exportArchive(c)))
    const result = await api<Credentials & { invite: string; view: RoomView }>('/rooms', '', {
      name: name.value,
      nickname: nickname.value,
      archive,
      characters,
    })
    if (!result) throw new Error('创建失败')
    createdInvite.value = result.invite
    roomId.value = result.roomId
    await client.connect(result, result.view)
  }, '房间已创建；请保存房间 ID 和邀请码，再为加入的玩家分配角色')
}
async function importCharacters() {
  await send(
    {
      kind: 'character-import',
      asPlayerCopy: includeNpcCopies.value,
      archives: importableCharacters.value
        .filter(
          (c) =>
            importCharacterIds.value.includes(c.id) &&
            (includeNpcCopies.value || (c.purpose !== 'npc' && !c.npcOwnerId)),
        )
        .map((c) => JSON.parse(local.exportArchive(c))),
    },
    '角色已复制到房间，可以分配操控权；在场景与探索中勾选角色并保存冒险队伍',
  )
}
async function joinRoom() {
  await run(async () => {
    const health = await api<{ lan?: boolean }>('/health')
    if (health?.lan) {
      location.assign(
        '/lan?' +
          new URLSearchParams({
            code: roomId.value.trim(),
            invite: invite.value.trim(),
            nickname: nickname.value,
          }),
      )
      return
    }
    const result = await api<Credentials & { view: RoomView }>(
      `/rooms/${roomId.value.trim()}/join`,
      '',
      { invite: invite.value.trim(), nickname: nickname.value },
    )
    if (!result) throw new Error('加入失败')
    await client.connect(result, result.view)
  }, '已加入，等待 GM 分配角色')
}
watch(
  () => props.createdRoom,
  async (value) => {
    if (!value) return
    await run(async () => {
      await client.connect(value, value.view)
      createdInvite.value = value.invite
    }, '已从保存剧本创建房间；请明确开始故事并进入场景')
  },
  { immediate: true },
)
onMounted(async () => {
  if (props.createdRoom) return
  const params = new URLSearchParams(location.search)
  if (params.get('code')) roomId.value = params.get('code')!
  if (params.get('invite')) invite.value = params.get('invite')!
  try {
    const saved = localStorage.getItem('trpg-room-session')
    if (saved) await run(() => client.connect(JSON.parse(saved)), '已恢复房间身份')
  } catch {
    feedback.value = '房间身份读取失败，请重新加入'
    failed.value = true
  }
})
onBeforeUnmount(() => {
  client.disconnect()
})
function selectToken(id: string) {
  if(mapSummons.value.some(i=>i.id===id)){summonSelection.value=id;return}
  const chosen = scene.value?.tokens.find((t) => t.id === id)
  if (!gm.value && chosen && !controlled.value.some((c) => c.id === chosen.characterId)) {
    sightTarget.value = id
    return
  }
  tokenId.value = id
  const t = scene.value?.tokens.find((t) => t.id === id)
  if (t?.characterId && controlled.value.some((c) => c.id === t.characterId))
    characterId.value = t.characterId
}
function move(to: Position) {
  if(selectedSummon.value){summonPoint.value={x:to.x,y:to.y,height:selectedSummon.value.position?.height??0};mapSidebar.value=true;railMode.value='scene';return}
  if (!gm.value) {
    if (!quickActive.value || !mapSidebar.value || !quickPicking.value) {
      if (!quickActions.value?.wakeMovement()) return
      mapSidebar.value = true
    }
    if (!view.value?.self.characterIds.includes(selectedToken.value?.characterId ?? '')) {
      feedback.value = '请选择你操控的角色'
      failed.value = true
      return
    }
    if (quickMode.value === 'move') {
      if (busy.value || working.value) return
      if (quickActions.value?.repeatConfirm && isRepeatedEndpoint(waypoints.value, to))
        quickActions.value.confirmMovement()
      else waypoints.value = [...waypoints.value, to].slice(0, 30)
    } else if (quickMode.value === 'jump') waypoints.value = [to]
    else feedback.value = '请点击公开目标棋子，或在视线目标栏选择目标'
    return
  }
  if (!scene.value || !selectedToken.value) return
  if (!view.value?.self.characterIds.includes(selectedToken.value.characterId ?? '')) {
    feedback.value = '请选择你操控的角色'
    failed.value = true
    return
  }
  if (movementReview.value) {
    intent(
      {
        kind: 'map',
        command: {
          type: 'move',
          sceneId: scene.value.id,
          tokenId: tokenId.value,
          path: directPath(selectedToken.value, to),
          gm: false,
          reason: '玩家请求 GM 确认反应',
          reactionsConfirmed: false,
        },
      },
      '移动至 ' + to.x + ',' + to.y,
    )
    return
  }
  send(
    {
      kind: 'map',
      command: {
        type: 'move',
        sceneId: scene.value.id,
        tokenId: tokenId.value,
        path: directPath(selectedToken.value, to),
        gm: false,
        reason: '玩家移动',
        reactionsConfirmed: false,
      },
    },
    '移动已同步；遇到机会攻击候选时请提交 GM 审核',
  )
}
watch(()=>[view.value?.id,view.value?.self.id,view.value?.broadcast.branchId,view.value?.scene?.id,characterId.value,props.active].join(':'),()=>{containerPointId.value='';pendingContainerId.value=''})
watch(()=>[pendingContainerId.value,view.value?.scene?.points.find(p=>p.id===pendingContainerId.value)?.state,tab.value],()=>{
  if(pendingContainerId.value && tab.value==='map' && props.active!==false && view.value?.scene?.points.some(p=>p.id===pendingContainerId.value&&p.state==='open')){containerPointId.value=pendingContainerId.value;pendingContainerId.value=''}
})
async function openInventorySpell(key:string){tab.value='map';railMode.value='scene';railOpen.value=true;await nextTick();quickActions.value?.focusSpell(key)}
async function transferContainer(action: ContainerAction) {
  const v=view.value
  if(!v)return false
  if(v.scene?.points.find(p=>p.id===action.pointId)?.reviewRequired)
    return await send({kind:'intent-submit',action,summary:'容器取放 · '+(action.operation==='put'?'放入':'领取'),source:'player',baseWorldRevision:v.worldRevision})
  return await send(action)
}
async function interact(operation: 'use' | 'toggle' | 'claim' | 'check', requestItemRuling=false) {
  if (!scene.value || !point.value) return
  if(!gm.value && point.value.kind==='chest' && operation==='use' && ['open','resolved'].includes(point.value.state) && !requestItemRuling){containerPointId.value=point.value.id;return}
  if(!gm.value && point.value.kind==='chest' && ['use','check'].includes(operation))pendingContainerId.value=point.value.id
  const action: RoomAction = {
    kind: 'map',
    command: {
      type: 'interact',
      sceneId: scene.value.id,
      pointId: point.value.id,
      characterId: characterId.value,
      itemIds: interactionItems.value,
      confirmItemCosts: interactionCosts.value,
      itemLimits: interactionLimits.value,
      operation,
      requestItemRuling,
      gm: false,
      reason: '',
    },
  }
  if (!gm.value && (point.value.reviewRequired||requestItemRuling))
    intent(action, point.value.name + ' · ' + (operation === 'check' ? '执行配置检定' : '固定互动'))
  else if(!(await send(action))) pendingContainerId.value=''
}

function intent(action: RoomAction, summary: string) {
  if (view.value)
    send(
      {
        kind: 'intent-submit',
        action,
        summary,
        source: 'player',
        baseWorldRevision: view.value.worldRevision,
      },
      '意图已提交，将按房间审核模式处理',
    )
}
function playerCombat(
  command: CombatCommand,
  review: boolean,
  summary: string,
  openingRequestId?: string,
  template?: MapTemplate,
) {
  if (!scene.value) return
  const action: RoomAction = {
    kind: 'map',
    command: {
      type: 'combat',
      sceneId: scene.value.id,
      command,
      ...(openingRequestId ? { openingRequestId } : {}),
      ...(command.type === 'cast' && template
        ? {
            options: {
              distance: true,
              highGround: true,
              obstacles: true,
              cover: true,
              area: true,
              reason: '',
              template,
            },
          }
        : {}),
    },
  }
  if (review) intent(action, summary)
  else
    send(
      action,
      command.type === 'attack' ? '攻击已提交，等待 GM 处理反应并结算' : summary + '已执行并保存',
    )
}
function openingAction(opening: BattleOpening, reason: string) {
  if (!scene.value || !view.value) return Promise.resolve(false)
  return send(
    {
      kind: 'map',
      command: {
        type: 'battle-request',
        sceneId: scene.value.id,
        characterId: characterId.value,
        source: 'player',
        sourceId: view.value.self.id,
        name: '玩家主动行动',
        reason,
        opening,
      },
    },
    '主动行动已保存，等待 GM 确认参战名单',
  )
}
function setControl(member: Omit<RoomMember, 'tokenHash'>, id: string, checked: boolean) {
  send({
    kind: 'control',
    sessionId: member.id,
    characterIds: checked
      ? [...member.characterIds, id]
      : member.characterIds.filter((x) => x !== id),
    actorIds: member.actorIds,
    revoked: false,
  })
}
async function rotateInvite(hours = 24) {
  await run(async () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from(
      crypto.getRandomValues(new Uint8Array(8)),
      (b) => alphabet[b % alphabet.length]!,
    ).join('')
    await client.send({ kind: 'invite-rotate', invite: code, hours })
    createdInvite.value = code
  }, '已生成新邀请码，旧邀请码不再用于加入；现有身份继续有效')
}
async function createAI() {
  await run(async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32)),
      token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    await client.send({
      kind: 'ai-create',
      name: aiName.value,
      token,
      characterIds: aiCharacter.value ? [aiCharacter.value] : [],
      actorIds: aiActor.value ? [aiActor.value] : [],
    })
    aiSecret.value = token
  }, 'AI 身份已创建；请复制令牌保存，服务端只保存摘要')
}
function submitDebug() {
  run(async () => {
    const action = actionSchema.parse(JSON.parse(actionText.value))
    await client.send({
      kind: 'intent-submit',
      action,
      summary: intentSummary.value,
      source: 'external',
      baseWorldRevision: view.value!.worldRevision,
    })
  }, '调试意图已提交，等待审核')
}
function saveRoomIdentity() {
  run(async () => {
    const identity = await client.exportIdentity()
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(identity, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `trpg-room-identity-${identity.role}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, '本人房间身份已保存，请私下保管，不发到群')
}
function restoreRoomIdentity(file: File) {
  run(async () => {
    if (file.size > 16384) throw Error('身份文件超过16KiB')
    await client.restoreIdentity(await file.text())
    clearIdentityUi()
  }, '已恢复原房间身份与权限')
}
function downloadArchive() {
  run(async () => {
    const text = await workshop.exportAdventure(''),
      url = URL.createObjectURL(new Blob([text], { type: 'application/json' })),
      a = document.createElement('a')
    a.href = url
    a.download = 'room-adventure.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, '冒险归档已导出，可回到本地地图导入为独立副本')
}
function downloadNpcKnowledge(){run(async()=>{const report=await client.npcKnowledgeReport(),url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='npc-broadcast-knowledge.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},'NPC知情报告已导出，仅供GM核对，请勿向玩家公开')}

watch(status, (value) => {
  if (/中断|失效/.test(value))
    notifications.push(value + '；未确认行动不会自动重发', 'warning', {
      persistent: true,
      key: 'room-connection',
    })
  else if (value === '已同步') {
    const warning = notifications.entries.find((n) => n.key === 'room-connection')
    if (warning)
      notifications.push('房间已重新同步，请检查待审行动状态', 'info', { key: 'room-connection' })
  }
})
useOperationFeedback(feedback, failed, working, client.progress)
</script>
<template>
  <main class="room-page" :style="workspaceStyle" :class="{ 'workspace-active': !!view&&gm, 'player-workspace': !!view&&!gm, 'character-theme': tab === 'character', 'scene-theme': tab === 'map', 'ai-theme': tab === 'ai', 'tools-collapsed': workspace.toolsClosed.value, 'player-map-focus': workspaceFocused, 'player-message-docked': workspace.geometry.value.docked }">
    <header v-if="!view" class="room-heading">
      <div>
        <p class="eyebrow">PLAY TOGETHER</p>
        <h1>{{ controlText('domain.multiplayer') }}</h1>
        <p class="muted">{{ controlText('room.sharedMapHelp') }}</p>
      </div>
      <span class="map-badge" role="status">{{ uiLabel(client.progress.value || status) }}</span>
    </header>
    <RoomIdentityPanel
      v-if="!view"
      :connected="!!view"
      :busy="busy || working"
      @save="saveRoomIdentity"
      @restore="restoreRoomIdentity"
    />
    <section v-if="!view" class="room-lobby">
      <div class="room-card">
        <h2>{{ controlText('domain.createRoom') }}</h2>
        <p>{{ controlText('room.createRoomHelp') }}</p>
        <label>{{ controlText('domain.yourName') }}<input v-model="nickname" maxlength="80" /></label
        ><label>{{ controlText('room.roomName') }}<input v-model="name" maxlength="120" /></label
        ><label
          >{{ controlText('domain.localAdventure') }}<select v-model="adventureId">
            <option value="" disabled>{{ controlText('room.createAdventureFirst') }}</option>
            <option v-for="a in local.adventures" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
          </select></label
        >
        <fieldset class="room-character-selection">
          <legend>{{ controlText('room.roomCharacters') }} {{ localCharacters.length }} {{ controlText('room.completedCharacters') }}</legend>
          <p class="muted">
            {{ controlText('room.defaultPartyHelp') }}
          </p>
          <label v-for="c in localCharacters" :key="c.id" class="check">
            <input
              v-model="createCharacterIds"
              type="checkbox"
              :value="c.id"
              :disabled="
                working ||
                localAdventure?.party.includes(c.id) ||
                c.purpose === 'npc' ||
                !!c.npcOwnerId
              "
            />{{ localizedEntryName(c.build) || controlText('expressionThree.unnamedCharacter') }}
            <small v-if="localAdventure?.party.includes(c.id)">{{ controlText('room.alreadyParty') }}</small>
          </label>
          <p v-if="!localCharacters.length" class="muted">
            {{
              local.characters.length
                ? controlText('expressionThree.theCharacterWorkshopContainsDraftsOnlyCompleteCreation')
                : controlText('expressionThree.noCompletedCharactersInThisBrowserSWorkshop')
            }}
          </p>
        </fieldset>
        <button
          class="primary"
          :disabled="working || !adventureId || !name || !nickname"
          @click="createRoom"
        >
          {{ controlText('room.createGmRoom') }}
        </button>
      </div>
      <div class="room-card">
        <h2>{{ controlText('domain.join') }}</h2>
        <p>{{ controlText('room.joinRoomHelp') }}</p>
        <label>{{ controlText('domain.yourName') }}<input v-model="nickname" maxlength="80" /></label
        ><label>{{ controlText('room.shortRoomId') }}<input v-model="roomId" autocomplete="off" /></label
        ><label>{{ controlText('domain.invite') }}<input v-model="invite" autocomplete="off" /></label
        ><button
          class="primary"
          :disabled="working || !roomId || !invite || !nickname"
          @click="joinRoom"
        >
          {{ controlText('room.joinPlayer') }}
        </button>
        <p class="muted">{{ controlText('room.browserIdentityHelp') }}</p>
      </div>
    </section>
    <template v-else :key="view.id + ':' + view.self.id + ':' + identityEpoch">
      <RoomTopNav v-if="active !== false" :items="navItems" :active="tab" @select="navigate" />
      <div class="room-bar">
        <div>
          <strong>{{ localizedEntryName(view) }}</strong> · {{ view.self.nickname }} ·
          {{ gm ? controlText('domain.gm') : view.self.role === 'ai' ? 'AI' : controlText('controls.player')
          }}<small
            >{{ controlText('room.roomId') }}<span class="room-id">{{ view.id }}</span> {{ controlText('room.version') }} {{ view.revision }} {{ controlText('room.internalTest') }} {{ metadata.version }}</small
          >
        </div>
        <span class="room-sync" role="status">{{ uiLabel(client.progress.value || status) }}</span>
      </div>

      <button ref="railTrigger" class="workspace-rail-trigger secondary" :data-float="railFloat" :aria-expanded="toolsVisible" :title="view.encounter?.phase==='active'?controlText('room.railCombatTitle',{round:view.encounter.round,actor:localizedEntryName(view.encounter.actors.find(a=>a.id===view?.encounter?.currentId))??controlText('expressionThree.currentActorIsNotPublic')}):controlText('expressionThree.roomSceneCharacter')" @click="toggleTools">{{toolsVisible?controlText('room.collapseTools'):view.encounter?.phase==='active'?controlText('room.railCombatShort',{round:view.encounter.round}):controlText('room.railToolsShort')}}</button>
      <aside class="room-rail" :class="{'rail-open':railOpen}" :aria-label="controlText('room.roomTools')" @keydown.esc.stop="closeSceneRail">
        <button class="workspace-rail-close" @click="closeSceneRail">{{ controlText('room.collapseTools') }}</button>
        <div class="rail-switch" role="tablist" :aria-label="controlText('room.roomToolsCategories')">
          <button type="button" :class="{ on: railMode === 'room' }" @click="pickRail('room')">
            {{ controlText('controls.room') }}
          </button>
          <button
            type="button"
            :class="{ on: railMode === 'scene' }"
            @click="gm ? openSceneInspector() : pickRail('scene')"
          >
            {{ controlText('controls.scene') }}
          </button>
          <button
            type="button"
            :class="{ on: railMode === 'role' }"
            @click="pickRail('role')"
          >
            {{ controlText('controls.character') }}
          </button>
        </div>

        <div v-show="railMode === 'room'" class="rail-stack">
          <details v-if="gm" class="rail-card" :open="!narrow">
            <summary><span>{{ controlText('room.runtimeStatus') }}</span><small>{{ uiLabel(status) }}</small></summary>
            <RoomRunStatus
              v-if="gm"
              :view="view"
              :qq="externalStatus.state.value"
              :connection="status"
              :submission="client.submission.value"
              :progress="client.progress.value"
              :qq-loading="externalStatus.loading.value"
              :qq-error="externalStatus.error.value"
              @navigate="navigate"
              @refresh="externalStatus.refresh"
            />
          </details>

          <details class="rail-card" :open="!narrow">
            <summary><span>{{ controlText('domain.identity') }}</span><small>{{ gm ? controlText('domain.gm') : controlText('controls.player') }}</small></summary>
            <div class="rail-actions">
              <button
                v-if="gm"
                class="secondary"
                :disabled="busy || working"
                @click="downloadArchive"
              >
                {{ controlText('room.exportAdventure') }}</button
              ><button
                class="subtle"
                :disabled="busy || working"
                @click="run(() => client.refresh(), '状态已刷新')"
              >
                {{ controlText('domain.refreshRoom') }}</button
              ><button class="subtle" :disabled="busy || working" @click="exitRoom">
                {{ controlText('domain.exitIdentity') }}
              </button>
            </div>
            <p v-if="view && gm && view.historyAvailable" class="rail-note">
              {{ controlText('room.liveLoaded') }}<button
                class="text-button"
                :disabled="busy || working"
                @click="
                  client.loadHistory().catch((e) => {
                    feedback = String(e)
                    failed = true
                  })
                "
              >
                {{ controlText('room.loadFullHistory') }}
              </button>
            </p>
            <p v-if="client.assetStatus.value" class="rail-note" role="status">
              {{ client.assetStatus.value
              }}<button class="text-button" @click="client.retryImages()">{{ controlText('room.retryImages') }}</button>
            </p>
            <details v-if="client.metrics.value.commandMs" class="rail-note">
              <summary>{{ controlText('adjudication.latestSubmissionTiming') }}</summary>
              <p>{{ controlText('progressSummary.msRoundTripToResponseHeadersIncluding', {p0:(controlText('domain.total')),p1:(client.metrics.value.commandMs.toFixed(0)),p2:(client.metrics.value.headersMs.toFixed(0)),p3:(client.metrics.value.bodyMs.toFixed(0)),p4:(client.metrics.value.applyMs.toFixed(0))}) }}</p>
              <p>{{ controlText('progressSummary.doNotAddTheseStagesToThe', {p0:(controlText('room.serverTimings')),p1:(client.metrics.value.serverTiming || controlText('expressionThree.notSuppliedByCurrentRequest'))}) }}</p>
            </details>
            <RoomIdentityPanel
              :connected="!!view"
              :busy="busy || working"
              @save="saveRoomIdentity"
              @restore="restoreRoomIdentity"
            />
            <RoomConnectionPanel
              :view="view"
              :busy="busy || working"
              :invite="createdInvite"
              :load-status="() => client.request('/lan/status?roomId=' + view!.id)"
              @command="send($event)"
              @rotate="rotateInvite($event)"
            />
            <p v-if="createdInvite" class="room-invite">
              {{ controlText('room.invite') }}<strong>{{ createdInvite }}</strong
              >　{{ controlText('room.inviteHelp') }}
            </p>
          </details>

          <details class="rail-card">
            <summary><span>{{ controlText('domain.dice') }}</span><small>{{ controlText('room.sourceResults') }}</small></summary>
            <RoomDicePanel :view="view" :busy="working || busy" settings @command="send($event)" />
            <DiceResults :view="view" :baseline="diceBaseline" />
          </details>

          <SummonPanel :view="view" :busy="working||busy" @command="send($event)" />
          <details class="rail-card">
            <summary><span>{{ controlText('controls.party') }}</span><small>—</small></summary>
            <div class="rail-party"><span v-for="c in view.characters.filter(c=>view?.world?.adventures[0]?.party.includes(c.id))" :key="c.id" class="map-badge">{{localizedEntryName(c)}}</span><p v-if="!view.world?.adventures[0]?.party.length" class="rail-note">{{ controlText('room.noAssignedParty') }}</p></div>
          </details>

          <details class="rail-card"><summary>{{ controlText('domain.helpRoom') }}</summary>      <RoomOnboarding
        :view="view"
        :local-count="localCharacters.length"
        :qq="externalStatus.state.value"
        @navigate="navigate"
      />
</details>

      <details v-if="gm&&tab==='map'" class="workspace-exploration" id="room-exploration"><summary>{{view.exploration?.status==='active'?controlText('expressionThree.explorationRound')+view.exploration.round+controlText('expressionOne.roundAlias28'):view.exploration?.status==='paused'?controlText('expressionThree.explorationPaused'):controlText('controls.explore')}} <span>{{ controlText('room.expandManagement') }}</span></summary><ExplorationGmPanel
        v-if="gm && tab === 'map'"
        :view="view"
        :content="workshop.content"
        :busy="busy || working"
        @command="send({ kind: 'map', command: $event })"
      /></details>
<div v-if="gm" id="gm-room-control" />
      <ExplorationControlTools v-if="gm" :view="view" :busy="busy||working" @command="send" />
      <ExplorationDispelZoneForm v-if="gm" :view="view" :cat="workshop.content" :busy="busy||working" @command="send" />
      <Teleport defer v-if="tab === 'map'" :to="gm ? '#gm-room-control' : '#player-scene-tools'"><CorpsePanel v-model="corpseId" :view="view" :busy="busy||working" :character-id="characterId" @command="send" @spell="openCorpseSpell" /></Teleport>
      <M1SpellTools :preferred-target="corpseSpellTarget" v-if="gm" :view="view" :busy="busy||working" @command="send" />
      <SceneEffectTools v-if="gm" :view="view" :busy="busy||working" @command="send" />
      <M3GmTools v-if="gm" :view="view" :busy="busy||working" @command="send" />
      <QuestPanel
        id="room-quests"
        v-if="tab === 'map'"
        :room-view="gm ? view : undefined"
        :quests="view.quests ?? []"
        :npcs="gm ? view.ai.npcs : []"
        :gm="!!gm"
        :busy="busy || working"
        :characters="view.characters.map((c) => ({ id: c.id, name: c.name }))"
        :scenes="view.world?.adventures[0]?.scenes"
        @save="send({ kind: 'quest-save', quest: $event })"
        @step-review="
          (questId, suggestionId, approve) =>
            send({ kind: 'quest-step-review', questId, suggestionId, approve })
        "
      />
        </div>

        <div v-if="gm" v-show="railMode==='scene'" class="rail-stack scene-rail-stack">
          <OpeningControl :view="view" :busy="busy||working" :submit="send" /><SceneLightingControl :view="view" :scene-id="editedSceneId||scene?.id" :busy="busy||working" @command="send" />
          <FogTools :view="view" :scene-id="editedSceneId||scene?.id" :busy="busy||working" @command="send" />
          <section class="rail-card rail-scene-summary"><strong>{{ controlText('domain.sceneProperties') }}</strong><p class="rail-note">{{ controlText('room.editing') }}{{localizedEntryName(editingScene)??controlText('expressionThree.noSceneSelected')}}<br/>{{ controlText('room.partyLocation') }}{{localizedEntryName(scene)??controlText('expressionThree.notInSceneYet')}}</p><button v-if="tab!=='map'" class="secondary" @click="openSceneInspector">{{ controlText('room.openMapEditor') }}</button></section>
          <div id="room-scene-inspector-host" class="scene-inspector-host" />
          <details class="rail-card"><summary>{{ controlText('room.sceneSupport') }}</summary><button class="rail-link" @click="jumpTo('room-exploration')">{{ controlText('room.explorationTurns') }}</button><button class="rail-link" @click="jumpTo('room-quests')">{{ controlText('domain.taskGuide') }}</button><button class="rail-link" @click="jumpTo('room-story')">{{ controlText('room.storyItems') }}</button></details>
        </div>
        <div v-if="!gm" v-show="railMode==='scene'" id="player-scene-tools" class="rail-stack" />
        <div v-show="railMode === 'role'" class="rail-stack">              <CharacterQuickList
                :view="view"
                :gm="gm"
                :content="workshop.content"
                :current-character-id="characterId"
                @navigate="navigate"
                @focus-token="focusQuickToken"
                @select="selectQuickCharacter"
                @visibility="(tokenId,effectId,visibility)=>send({kind:'scene-effect-visibility',tokenId,effectId,visibility})"
              />
<div id="runtime-status-rail-host" /></div>
      </aside>

      <aside v-if="!gm" v-show="workspace.geometry.value.docked" id="player-message-rail" class="player-message-rail" :aria-label="workspaceText('messageRail')" />
      <WorkspaceResizeHandle v-if="workspace.geometry.value.desktop && !workspace.toolsClosed.value && !workspaceFocused"
        :width="railWidth" :min="TOOL_MIN" :max="workspace.geometry.value.toolMax" :direction="gm ? -1 : 1"
        :label="workspaceText('resizeTools')" :style="gm ? { right: railWidth + 6 + 'px' } : { left: railWidth + 6 + 'px' }"
        @resize="workspace.setTools" @reset="workspace.resetTools" />
      <WorkspaceResizeHandle v-if="workspace.geometry.value.docked"
        :width="workspace.messageWidth.value" :min="MESSAGE_MIN" :max="workspace.geometry.value.messageMax" :direction="-1"
        :label="workspaceText('resizeMessages')" :style="{ right: workspace.messageWidth.value + 6 + 'px' }"
        @resize="workspace.setMessages" @reset="workspace.resetMessages" />

      <div v-if="latestBroadcastPresentation" class="broadcast-latest" role="status">
        <strong>{{ latestBroadcastPresentation.title }}</strong> · {{ latestBroadcastPresentation.text.slice(0, 160)
        }}<button class="subtle" @click="tab = 'broadcast'">{{ controlText('room.viewBroadcast') }}</button>
      </div>

      <BroadcastPanel
        v-show="tab === 'broadcast'"
        :adventure="view.world?.adventures[0]"
        :world="view.world"
        :submit-command="(c, id) => submitConfig({ kind: 'map', command: c }, id)"
        :characters="view.characters"
        :events="broadcastEvents"
        :branch-id="view.broadcast.branchId"
        :gm="!!gm"
        :busy="busy || working"
        :gap="broadcastGap"
        @command="send({ kind: 'map', command: $event })"
      />
      <AiPanel
        v-show="tab === 'ai'"
        :view="view"
        :submit-command="submitConfig"
        :busy="busy || working"
        :quick-review="!!gm"
        @knowledge-report="downloadNpcKnowledge"
        @command="send($event)"
        @navigate="navigate"
      />

      <MapPanel
        :corpses="view.scene?.corpses"
        @corpse="corpseId = $event; railMode = 'room'; railOpen = true"
        :fog-preview="view.fogPreview"
        id="room-map"
        ref="mapPanel"
        compact-rail
        inspector-target="#room-scene-inspector-host"
        @inspector="railMode='scene';railOpen=true"
        v-if="gm && tab === 'map'"
        :workshop="workshop"
        :can-undo="view.canUndo"
        online
        @selection="(_a, s) => {editedSceneId=s;client.loadSceneImage(s)}"
        @import-characters="tab = 'members'"
        @view="
          (id) => {
            characterId = id
            tab = 'character'
          }
        "
        @battle="
          (id) => {
            battleId = id
            tab = 'battle'
          }
        "
      ><template #control="selected"><Teleport defer to="#gm-room-control"><p v-if="selected.dirty" class="muted" role="status">{{ controlText('room.unsavedMapHelp') }}</p><details class="workspace-character-controls"><summary>{{ controlText('domain.npcControl') }}</summary><GmControlPanel :view="view" :scene-id="selected.sceneId" :token-id="selected.tokenId" :content="workshop.content" :busy="busy||working||!!selected.dirty" @command="send" @view="id=>{characterId=id;tab='character'}" @battle="id=>{battleId=id;navigate('battle')}" /></details></Teleport></template></MapPanel>
      <section
        v-else-if="tab === 'map'"
        class="room-explore player-map-workspace"
        :class="{ 'map-sidebar-closed': !mapSidebar, 'map-focused': mapFocus }"
      >
        <header class="player-map-toolbar" role="group" :aria-label="controlText('room.mapCharactersTargets')">
          <div class="player-map-characters">
            <h3>{{ controlText('controls.actor') }}</h3>
            <div class="room-avatar-strip" :aria-label="controlText('controls.actor')">
              <button
                v-for="c in controlled"
                :key="c.id"
                class="room-avatar-button"
                :class="{ active: characterId === c.id }"
                :aria-pressed="characterId === c.id"
                :aria-label="controlText('expressionThree.control') + localizedEntryName(c.build)"
                :title="localizedEntryName(c.build)"
                :disabled="busy || working"
                @click="selectCharacter(c.id)"
              >
                <CharacterAvatar :name="c.build.name" :portrait="c.portrait" :size="44" /><span
                  class="room-avatar-name"
                  >{{ localizedEntryName(c.build) }}</span
                >
              </button>
            </div>
            <label v-if="mapSummons.length" class="room-summon-picker">{{ controlText('domain.companionControl') }}<select v-model="summonSelection" :aria-label="controlText('domain.companionControl')"><option value="">{{ controlText('room.controlOwn') }}</option><optgroup v-for="group in summonGroups" :key="group.name" :label="localizedEntryName(group)"><option v-for="i in group.instances" :key="i.id" :value="i.id">{{localizedEntryName(i)}}</option></optgroup></select></label>
            <p v-if="!controlled.length">{{ controlText('room.waitingControl') }}</p>
          </div>
          <div v-if="sightCandidates.length" class="room-sight">
            <label
              >{{ controlText('controls.vision') }}<select
                v-model="sightTarget"
                :aria-label="controlText('controls.vision')"
                :title="localizedEntryName(scene?.tokens.find((t) => t.id === sightTarget))"
              >
                <option value="">{{ controlText('room.choosePublicToken') }}</option>
                <option v-for="r in sightCandidates" :key="r.toId" :value="r.toId">
                  {{ localizedEntryName(scene?.tokens.find((t) => t.id === r.toId)) }}
                </option>
              </select></label
            >
            <p v-if="sight && (!sight.sightClear || !sight.targetingClear)" role="status">
              {{ controlText('room.blockedTarget') }}
            </p>
            <p v-if="sight?.cover && sight.cover !== 'none'">{{ controlText('controls.map') }}{{ uiLabel(COVER_NAMES[sight.cover]) }}</p>
          </div>

          <RoomSceneHeader
            v-if="scene"
            v-model:names="mapNames"
            :scene="scene"
            :exploration="view.exploration"
            :encounter="view.encounter"
            :busy="busy"
            in-toolbar
            @focus="publicMap?.focusActor($event)"
            @talk="messageDock?.openNpc($event)"
            :gm="gm"
            @visibility="
              (tokenId, effectId, visibility) =>
                send({ kind: 'scene-effect-visibility', tokenId, effectId, visibility })
            "
          />
          <div class="room-row map-layout-buttons">
            <button class="secondary" :aria-expanded="toolsVisible" @click="railMode='scene';toggleTools()">
              {{ toolsVisible ? controlText('mapExperience.collapseSceneTools') : controlText('mapExperience.sceneTools') }}</button
            ><button class="secondary" :aria-pressed="mapFocus" @click="mapFocus = !mapFocus">
              {{ mapFocus ? controlText('expressionThree.exitExpandedView') : controlText('domain.expandMap') }}
            </button>
          </div>
        </header>
        <Teleport defer to="#player-scene-tools"><aside class="room-card player-map-sidebar" :aria-label="controlText('room.mapControls')">
          <p v-if="controlHeld" role="status">{{ controlText('room.gmControlsCharacter') }}</p>
        <PointItemPicker v-if="point?.acceptsItems" v-model="interactionItems" v-model:confirmed="interactionCosts" v-model:limits="interactionLimits" :items="view.ownCharacters.find(c=>c.id===characterId)?.inventory??[]" :content="workshop.content" />
        <SummonActions v-if="selectedSummon" :view="view" :instance="selectedSummon" :picked="summonPoint" :busy="busy||working" @action="summonRequest" />
        <MapQuickActions v-else
            secondary-target="#player-secondary-scene-tools"
            :background="background"
            @jump-range="jumpRange = $event"
            ref="quickActions"
            v-model:active="quickActive"
            @picking="quickPicking = $event"
            v-model:character-id="characterId"
            v-model:target-id="sightTarget"
            v-model:mode="quickMode"
            v-model:waypoints="waypoints"
            :view="view"
            :content="workshop.content"
            :token-id="tokenId"
            :busy="busy || working || !!controlHeld"
            @request="quickRequest"
            @command="send"
            @inspect="inspectQuickAbility"
            @combat="playerCombat"
            @opening="openingAction"
            :submit-opening="openingAction"
            @preview="
              (path, mode, valid) => {
                previewPath = path
                previewMode = mode
                previewValid = valid
              }
            "
          />
          <label
            >{{ controlText('controls.nearPoints') }}<MapFieldPicker kind="point"><select v-model="pointId">
              <option value="">{{ controlText('controls.chooseObject') }}</option>
              <option v-for="p in scene?.points" :key="p.id" :value="p.id">
                {{ localizedEntryName(p) }} · {{ containerAccessLabel(p) }}
              </option>
            </select></MapFieldPicker></label
          >
          <div v-if="point" class="room-row">
            <button v-if="point.itemReviewAvailable" class="secondary" :disabled="busy||!characterId" @click="interact('use',true)">{{ controlText('room.requestItemRuling') }}</button>
            <button class="secondary" :disabled="busy || !characterId" @click="interact('use')">
              {{ controlText('controls.use') }}</button
            ><button class="secondary" :disabled="busy || !characterId" @click="interact('toggle')">
              {{ controlText('controls.toggle') }}</button
            ><button class="secondary" :disabled="busy || !characterId" @click="interact('check')">
              {{ controlText('controls.check') }}
            </button>
          </div>
          <p v-if="point?.revealed" class="map-revealed">{{ point.revealed }}</p>
        </aside></Teleport>
        <RoomScene
          ref="publicMap"
          :display-scope="view.id + ':' + view.self.id"
          v-model:names="mapNames"
          external-header
          :view-key="roomId + '-' + tab"
          :quick-confirm-hint="
            quickActions?.repeatConfirm && quickMode === 'move'
              ? '再次点击确认／提交审核'
              : '预览落点'
          "
          v-if="scene"
          :scene="scene"
          :background="background"
          :selected="tokenId"
          :busy="busy"
          :sight-target="sightTarget"
          :exploration="view.exploration"
          :encounter="view.encounter"
          :has-movement-preview="!!waypoints.length"
          :preview-path="previewPath"
          :jump-range="jumpRange"
          :preview-mode="previewMode"
          :preview-valid="previewValid"
          @corpse="corpseId = $event; railMode = 'scene'; railOpen = true"
          @cancel-preview="waypoints = []; previewPath = []"
          @cell="move"
          @token="selectToken"
          @ground="groundId = $event"
          @point="(id) => (pointId = id)"
        />
        <p v-else class="room-card">{{ controlText('room.waitingScene') }}</p>
        <Teleport defer to="#player-scene-tools"><GroundPickup
          v-if="scene"
          :content="workshop.content"
          :view="view"
          :character-id="characterId"
          :selected="groundId"
          :busy="busy || working"
          @select="groundId = $event"
          @command="send"
        /><div id="player-secondary-scene-tools" class="rail-stack" /></Teleport>
      </section>
      <StoryItemsPanel id="room-story" v-if="gm&&tab==='map'" :view="view" :busy="busy||working" @command="send" />
      <section v-show="tab === 'character'" class="room-character">
        <p v-if="!character" class="muted">{{ controlText('room.waitingAssignment') }}</p>
        <template v-if="character"
          ><RuntimePanel
            :review-required="!gm"
            :map-spells="!gm&&!!scene" @item-spell="openInventorySpell"
            :rail-target="roleRailTarget"
            :rail-visible="railMode === 'role'"
            :rail-full="tab === 'character'"
            @navigate="navigate"
            :initial-tab="runtimeSection"
            :section-request="runtimeSectionRequest"
            server-rolls
            :character="character"
            :people="view.characters"
            :content="workshop.content"
            :workshop="workshop"
            :battle-name="
              !gm && view.encounter?.phase === 'active' ? view.encounter.name : undefined
            "
          >
            <template #hero-extra>
              <label class="character-picker"
                >{{ controlText('room.viewCharacter') }}<select v-model="characterId">
                  <option v-for="c in controlled" :key="c.id" :value="c.id">
                    {{ localizedEntryName(c.build) }}
                  </option>
                </select></label
              >
            </template>
            <template #inventory-after>
              <div class="room-card">
                <h3>{{ controlText('room.giveItem') }}</h3>
                <p class="muted">{{ controlText('room.giveItemHelp') }}</p>
                <div class="room-row">
                  <label
                    >{{ controlText('domain.inventoryItems') }}<select v-model="fromItem">
                      <option value="">{{ controlText('game.item') }}</option>
                      <option
                        v-for="i in character.inventory.filter((i) => !i.equipped)"
                        :key="i.instanceId"
                        :value="i.instanceId"
                      >
                        {{
                          localizedEntryName(i.specialWeapon) ??
                          localizedEntryName([...workshop.content.items, ...character.build.customItems].find(
                            (x) => x.id === i.itemId,
                          )) ??
                          i.itemId
                        }}
                        ×{{ i.quantity }}
                      </option>
                    </select></label
                  ><label
                    >{{ controlText('game.recipients') }}<select v-model="giveTarget">
                      <option value="">{{ controlText('game.character') }}</option>
                      <option
                        v-for="c in view.characters.filter((c) => c.id !== characterId)"
                        :key="c.id"
                        :value="c.id"
                      >
                        {{ localizedEntryName(c) }}
                      </option>
                    </select></label
                  ><label
                    >{{ controlText('controls.quantity') }}<input
                      v-model.number="quantity"
                      type="number"
                      min="1"
                      max="10000" /></label
                  ><button
                    class="primary"
                    :disabled="busy || !fromItem || !giveTarget"
                    @click="
                      send(
                        {
                          kind: 'give',
                          fromId: characterId,
                          toId: giveTarget,
                          instanceId: fromItem,
                          quantity,
                        },
                        '物品已给予，双方背包已一起保存',
                      )
                    "
                  >
                    {{ controlText('room.confirmGive') }}
                  </button>
                </div>
              </div>
            </template>
          </RuntimePanel>
          <p v-if="!gm" class="muted">
            {{ controlText('room.runtimeHelp') }}
          </p>
        </template>
        <RoomCharacterRequests
          v-if="!gm"
          :view="view"
          :busy="busy || working"
          :local-characters="local.characters"
          :export-archive="local.exportArchive"
          :submit-command="send"
          @command="send"
          @workshop="emit('workshop')"
        />
      </section>
      <div v-if="gm && tab === 'battle'" class="room-card">
        <button class="secondary" @click="reviewDock?.open()">{{ controlText('room.openNpcReview') }}</button>
      </div>
      <NpcTurnPanel
        v-if="gm && tab === 'battle'"
        :view="view"
        :busy="busy || working"
        execution-only
        @command="send"
      />
      <BattlePanel
        v-if="gm && tab === 'battle'"
        :workshop="workshop"
        :encounter-id="battleId"
        :can-undo="view.canUndo"
        online
        @view="
          (id) => {
            characterId = id
            tab = 'character'
          }
        "
        @map="tab = 'map'"
      />
      <section v-if="!gm && tab === 'battle'" class="room-card">
        <RequestDisclosure
          v-model="battleDisclosure.open.value"
          :title="controlText('room.requestCombat')"
          :summary="battleSummary"
          :busy="busy || working"
        >
          <p>{{ controlText('room.requestCombatHelp') }}</p>
          <label
            >{{ controlText('room.requestCharacter') }}<select v-model="characterId">
              <option v-for="c in controlled" :key="c.id" :value="c.id">{{ localizedEntryName(c.build) }}</option>
            </select></label
          >
          <label>{{ controlText('room.combatRequestReason') }}<input v-model="battleRequestReason" maxlength="2000" /></label>
          <button
            class="secondary"
            :disabled="
              busy ||
              working ||
              !characterId ||
              !scene ||
              !battleRequestReason.trim() ||
              currentBattleRequests.some((r) => r.status === 'pending')
            "
            @click="requestBattle"
          >
            {{ controlText('room.submitCombatRequest') }}
          </button>
        </RequestDisclosure>
        <p v-for="r in view.battleRequests" :key="r.id">
          {{ r.reason }} ·
          <span>{{ r.status === 'pending' ? controlText('expressionThree.waitingForGmConfirmationOfCombatRoster') : r.reviewReason }}</span>
        </p>
      </section>
      <PlayerCombatPanel
        :background="background"
        v-if="!gm && tab === 'battle'"
        v-model:character-id="characterId"
        :view="view"
        :content="workshop.content"
        :busy="busy || working"
        @execute="playerCombat"
      />
      <ExplorationActionPanel
        v-if="!gm && tab === 'battle' && view.encounter?.phase !== 'active'"
        v-model:character-id="characterId"
        :view="view"
        :content="workshop.content"
        :busy="busy || working"
        :submit-opening="openingAction"
      />
      <section v-if="!gm && tab === 'battle' && actor && character" class="room-card">
        <h3>{{ controlText('room.combatInventory') }}</h3>
        <label
          >{{ controlText('room.itemInteractionCost') }}<select v-model="inventoryCost">
            <option value="free">{{ controlText('game.freeInteraction') }}</option>
            <option value="action">{{ controlText('domain.action') }}</option>
            <option value="bonus">{{ controlText('controls.bonus') }}</option>
          </select></label
        >
        <p class="muted">{{ controlText('room.itemCostHelp') }}</p>
        <RuntimeInventory
          :character="character"
          :content="workshop.content"
          :pending="busy"
          active
          :feedback="feedback"
          :failure="failed"
          :run="combatInventory"
        />
      </section>
      <section v-if="tab === 'members'" class="room-card">
        <h2>{{ controlText('room.memberControl') }}</h2>
        <QqMemberPanel :key="view.id" :view="view" :request="client.integration" />
        <div v-if="gm" class="room-environment">
          <h3>{{ controlText('domain.importWorkshop') }}</h3>
          <p v-if="view.characters.length">
            {{ controlText('room.roomRole') }}{{ view.characters.map((c) => localizedEntryName(c) || '未命名角色').join('、') }}
          </p>
          <p class="muted">{{ controlText('progressSummary.charactersAlreadyInRoomChooseCompletedCharacters', {p0:(view.characters.length)}) }}</p>
          <div class="room-row">
            <label v-for="c in importableCharacters" :key="c.id" class="check">
              <input
                v-model="importCharacterIds"
                type="checkbox"
                :value="c.id"
                :disabled="
                  busy || working || (!includeNpcCopies && (c.purpose === 'npc' || !!c.npcOwnerId))
                "
              />{{ localizedEntryName(c.build) || controlText('expressionThree.unnamedCharacter') }}
              <small v-if="c.purpose === 'npc' || c.npcOwnerId">{{ controlText('room.npcOnly') }}</small>
              <small v-else-if="characterPurpose(c) === 'shared'">{{ controlText('room.sharedTemplate') }}</small>
            </label>
          </div>
          <label class="check"
            ><input v-model="includeNpcCopies" type="checkbox" />{{ controlText('room.copyNpcToPlayer') }}</label
          >
          <p v-if="!importableCharacters.length" class="muted">
            {{
              localCharacters.length
                ? controlText('expressionThree.allCompletedCharactersInTheCurrentWorkshopAre')
                : local.characters.length
                  ? controlText('expressionThree.theCharacterWorkshopContainsDraftsOnlyCompleteCreationAlias94')
                  : controlText('expressionThree.noCompletedCharactersInThisBrowserOpenThe')
            }}
          </p>
          <button
            class="secondary"
            :disabled="busy || working || !importCharacterIds.length"
            @click="importCharacters"
          >
            {{ controlText('room.importCharacters') }}
          </button>
          <p class="muted">
            {{ controlText('room.partyImportHelp') }}
          </p>
        </div>
        <button v-if="gm" class="secondary" :disabled="busy" @click="rotateInvite()">
          {{ controlText('room.newInvite') }}
        </button>
        <p class="muted">{{ controlText('room.controlPermissionsHelp') }}</p>
        <article v-for="m in view.members" :key="m.id" class="room-member">
          <strong>{{ m.nickname }}</strong> · {{ m.role }} {{ m.revoked ? controlText('expressionThree.revoked') : '' }}
          <div v-if="gm && m.role !== 'gm'" class="room-row">
            <label v-for="c in view.characters" :key="c.id" class="check"
              ><input
                type="checkbox"
                :checked="m.characterIds.includes(c.id)"
                :disabled="busy || m.revoked"
                @change="setControl(m, c.id, ($event.target as HTMLInputElement).checked)"
              />{{ localizedEntryName(c) }}</label
            ><button
              class="danger-text"
              :disabled="busy || m.revoked"
              @click="
                send({
                  kind: 'control',
                  sessionId: m.id,
                  characterIds: [],
                  actorIds: [],
                  revoked: true,
                })
              "
            >
              {{ controlText('room.revokeIdentity') }}
            </button>
          </div>
        </article>
        <div v-if="gm" class="room-environment">
          <h3>{{ controlText('room.environment') }}</h3>
          <p class="muted">
            {{ controlText('room.environmentHelp') }}
          </p>
          <div class="room-row">
            <label
              >{{ controlText('game.cover') }}<select v-model="env.cover">
                <option value="none">{{ controlText('controls.none') }}</option>
                <option value="half">{{ controlText('domain.halfCover') }}</option>
                <option value="three-quarters">{{ controlText('room.threeQuarters') }}</option>
                <option value="total">{{ controlText('room.totalCover') }}</option>
              </select></label
            ><label class="check"
              ><input v-model="env.attackerSees" type="checkbox" />{{ controlText('domain.actorSeesTarget') }}</label
            ><label class="check"
              ><input v-model="env.targetSees" type="checkbox" />{{ controlText('domain.targetSeesActor') }}</label
            ><label class="check"
              ><input v-model="env.nearbyEnemy" type="checkbox" />{{ controlText('domain.nearbyEnemy') }}</label
            ><label class="check"><input v-model="env.advantage" type="checkbox" />{{ controlText('domain.otherAdvantage') }}</label
            ><label class="check"
              ><input v-model="env.disadvantage" type="checkbox" />{{ controlText('domain.otherDisadvantage') }}</label
            ><label class="check"
              ><input v-model="env.areaConfirmed" type="checkbox" />{{ controlText('domain.areaTargetsConfirmed') }}</label
            >
            <label class="check"
              ><input v-model="env.fearVisible" type="checkbox" />{{ controlText('game.fearVisible') }}</label
            ><label class="check"
              ><input v-model="env.targetLocationConfirmed" type="checkbox" />{{ controlText('domain.targetPositionConfirmed') }}</label
            >
            <button
              class="primary"
              :disabled="busy"
              @click="send({ kind: 'environment', environment: env })"
            >
              {{ controlText('room.saveEnvironment') }}
            </button>
          </div>
        </div>
      </section>
      <section v-if="tab === 'intents'" class="room-card">
        <h2>{{ gm ? controlText('expressionThree.gmIntentReview') : controlText('expressionThree.myIntents') }}</h2>
        <ReviewSettings
          v-if="gm"
          :view="view"
          :busy="busy || working"
          @command="send($event, '审核设置已保存')"
        />
        <p>
          {{ controlText('room.reviewPermissionsHelp') }}
        </p>
        <p v-if="!gm" class="muted">
          {{ controlText('room.currentRoom') }}{{
            view.gmReview?.mode === 'assisted'
              ? controlText('state.assistedReview')
              : view.gmReview?.mode === 'shadow'
                ? controlText('expressionThree.shadowReviewGmDecides')
                : controlText('state.humanReview')
          }}{{ view.gmReview?.paused ? controlText('expressionThree.automaticReviewPausedSubmissionRemainsAvailable') : '' }}
        </p>
        <button v-if="gm" class="primary" @click="reviewDock?.open()">{{ controlText('room.openQuickReview') }}</button>
        <RoomIntentCard
          v-for="i in [...view.intents].reverse().filter((i) => !gm || i.status !== 'pending')"
          :key="i.id"
          :view="view"
          :intent="i"
          :busy="busy || working"
          @review="send($event, '裁定已保存并同步')"
        />
        <p v-if="!view.intents.length" class="muted">{{ controlText('room.noIntents') }}</p>
      </section>
      <PlayerSpellRequests v-if="!gm" :view="view" :busy="busy || working" @command="send" />
      <PracticalM1Request :preferred-target="corpseSpellTarget" v-if="!gm" :view="view" :busy="busy||working" @command="send" />
      <PracticalPlayerWindows :view="view" :busy="busy||working" @command="send" />
      <NpcPeerPanel :view="view" :busy="busy||working" @command="send" />
      <RoomReviewDock
        v-if="gm"
        ref="reviewDock"
        @opened="messageDock?.close()"
        @battle="tab = 'battle'"
        :view="view"
        :workshop="workshop"
        :busy="busy || working"
        :extra-count="characterRequestCount"
        :feedback="feedback"
        :error="failed"
        @command="send"
      >
        <template #extra
          ><RoomCharacterRequests :view="view" :busy="busy || working" review-only @command="send"
        /></template>
      </RoomReviewDock>
      <RoomMessageDock
        v-model:enabled="messageDockEnabled"
        :key="view.id + view.self.id"
        ref="messageDock"
        :view="view"
        :events="broadcastEvents"
        :busy="busy || working"
        :request="client.integration"
        :submit="send"
        :docked="workspace.geometry.value.docked"
        dock-target="#player-message-rail"
        :dock-width="workspace.messageWidth.value"
        :active="props.active !== false && !workspaceFocused"
        @collapse="workspace.messagesClosed.value = true"
        @expand="workspace.messagesClosed.value = false"
        @opened="reviewDock?.close()"
        @history="messageHistory"
        @review="reviewDock?.open()"
      />
      <Teleport v-if="!gm" defer to="#player-scene-tools"><OpeningReader :view="view" :busy="busy||working" :active="props.active" :submit="send" /></Teleport>
      <ContainerInventoryDialog v-if="!gm" v-model="containerPointId" :view="view" :character-id="characterId" :active="props.active" :request="client.integration" :submit="transferContainer" />
      <section v-if="gm && tab === 'integration'" class="room-card">
        <p v-if="view.messageDelivery === 'web'" role="status">
          {{ controlText('room.webOnlyHelp') }}
        </p>
        <QqPanel :key="view.id" :request="client.integration" />
        <QqDialogueReviewSettings
          :settings="view.ai.settings"
          :busy="busy || working"
          @save="send({ kind: 'map', command: { type: 'ai-settings', settings: $event } })"
        />
        <h2>{{ controlText('room.externalIntents') }}</h2>
        <p>
          {{ controlText('room.externalHelp') }}
        </p>
        <div class="room-row">
          <label>{{ controlText('room.identityName') }}<input v-model="aiName" maxlength="80" /></label
          ><label
            >{{ controlText('controls.actor') }}<select v-model="aiCharacter">
              <option value="">{{ controlText('room.noCharacter') }}</option>
              <option v-for="c in view.characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
            </select></label
          ><label
            >{{ controlText('room.npcActor') }}<select v-model="aiActor">
              <option value="">{{ controlText('room.noNpc') }}</option>
              <option
                v-for="a in view.encounter?.actors.filter((a) => !a.characterId)"
                :key="a.id"
                :value="a.id"
              >
                {{ localizedEntryName(a) }}
              </option>
            </select></label
          ><button class="primary" :disabled="busy || !aiName" @click="createAI">
            {{ controlText('room.createAi') }}
          </button>
        </div>
        <label v-if="aiSecret"
          >{{ controlText('room.aiToken') }}<input :value="aiSecret" readonly autocomplete="off"
        /></label>
        <p class="muted">
          {{ controlText('room.sealChatHelp') }}
        </p>
        <SealChatPanel :room-id="view.id" />
        <details>
          <summary>{{ controlText('room.intentDebug') }}</summary>
          <label>{{ controlText('room.actionDescription') }}<input v-model="intentSummary" /></label
          ><label
            >{{ controlText('room.actionJson') }}<textarea
              v-model="actionText"
              rows="10"
              placeholder='{"kind":"map","command":{...}}'
            /></label
          ><button class="secondary" :disabled="busy || !actionText" @click="submitDebug">
            {{ controlText('room.submitDebug') }}
          </button>
        </details>
      </section>
      <section v-if="tab === 'settings'" class="room-settings-page">
        <RoomSettings
          v-model:message-dock="messageDockEnabled"
          :view="view"
          :gm="gm"
          :busy="busy || working"
          :rail-width="railWidth"
          :rail-max="workspace.geometry.value.toolMax"
          :message-width="workspace.messageWidth.value"
          :message-max="workspace.geometry.value.messageMax"
          :map-height="mapHeight"
          @set-rail="workspace.setTools"
          @set-message="workspace.setMessages"
          @reset-rail="workspace.resetTools"
          @reset-message="workspace.resetMessages"
          @reset-map="resetMapHeight"
          @navigate="navigate"
        />
      </section>
    </template>
  </main>
</template>
