<script setup lang="ts">
import {spellUsesSlot} from '../../core/item-spells'
import {itemCastLabel} from '../item-spell-presentation'
import {displayFeedback} from '../feedback-presentation'
import {uiLabel} from '../ui-label'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { excludesAutomaticOpening, EXPLORATION_OPENING_HELP } from "../../core/opening-spell-policy"
import MapTargetsButton from "../map-selection/MapTargetsButton.vue"
import {M5_WORLD_SPELLS} from '../../core/m5-spell-rules'
import {M4_SCENE_SPELLS} from '../../core/scene-effects'
import SceneEffectTools from '../SceneEffectTools.vue'
import M3PlayerActions from '../M3PlayerActions.vue'
import SpatialStatus from '../SpatialStatus.vue'
import {controlSelectionForActors} from '../../core/m2-social-controls'
import type {ControlSelection} from '../../core/m2-social-controls'
import SupportSpellFields from '../SupportSpellFields.vue'
import {M1_UTILITY_SPELLS} from '../../core/m1-utility'
import {spellRangeFeet} from '../../core/spell-range'

import { mayWakeMovement } from '../../core/map-move-intent'
import AttackMethodPicker from '../AttackMethodPicker.vue'
import SpellResourceSummary from './SpellResourceSummary.vue'
import DiscoveryStatus from './DiscoveryStatus.vue'
import UnarmedOptions from '../UnarmedOptions.vue'
import WeaponHandlingPicker from '../WeaponHandlingPicker.vue'
import { handlingPreview } from '../../core/weapon-handling'
import type { WeaponHandling } from '../../core/combat-types'
import { unarmedCommand } from '../../core/weapon-rules'
import type { AttackCost } from '../../core/attack-methods'
import { computed, ref, watch, shallowRef, defineAsyncComponent, nextTick } from 'vue'
import QuickActionSections from './QuickActionSections.vue'
import QuickFavoritesManager from './QuickFavoritesManager.vue'
import { quickBoards, quickText, type QuickActionRow } from './quick-action-labels'
import { useMapSelection } from '../map-selection/selection'
import type { QuickActionBoard } from '../../persistence/quick-actions-schema'
const QuickDetailsDialog = defineAsyncComponent(() => import('./QuickDetailsDialog.vue'))
import type { RoomView, RoomAction, RoomCommand } from '../../online/protocol'
import type { Catalogue } from '../../core/engine'
import type { Position } from '../../core/map-types'
import type { ExplorationCommand, ExplorationAction } from '../../core/exploration-types'
import type { CombatCommand } from '../../core/combat-types'
import { DAMAGE_NAMES } from '../../core/combat-types'
import type { BattleOpening } from '../../core/battle-types'
import {
  runtimeDerived,
  runtimeState,
  runtimeSpells,
  findItem,
  MODE_NAMES,
  castSlotLevel,
} from '../../core/runtime'
import { explorationAttacks } from '../../core/battle-opening'
import { spellEffect, defaultEnvironment } from '../../core/combat-rules'
import { spellTargets, spellDamageOptions } from '../../online/combat-controls'
import { publicMovementPreview, publicJumpRange } from './public-preview'
import { useQuickActions } from './useQuickActions'
import QuickAbilityPanel from './QuickAbilityPanel.vue'
import { quickAbilities } from './quick-abilities'
import PlayerCombatPanel from '../PlayerCombatPanel.vue'
import ExplorationActionPanel from '../ExplorationActionPanel.vue'
import type { QuickAction } from '../../persistence/quick-actions-schema'
import type { QuickPreset } from './quick-preset'
import SpellAreaPicker from '../SpellAreaPicker.vue'
import type { MapTemplate } from '../../core/map-types'

const handling = ref<WeaponHandling>({ before: [], after: [] })
const vigorDice = ref(1)
const controlSelection = ref<ControlSelection>({}), supportChoice = ref(''),
  willing = ref(false)
const props = defineProps<{
  view: RoomView
  content: Catalogue
  tokenId: string
  busy: boolean
  background?: string
  submitOpening?: (opening: BattleOpening, reason: string) => Promise<boolean>
  secondaryTarget?: string
}>()
const characterId = defineModel<string>('characterId', { required: true }),
  targetId = defineModel<string>('targetId', { required: true })
const mapMode = defineModel<'move' | 'jump' | 'attack' | 'spell' | 'item'>('mode', {
    required: true,
  }),
  waypoints = defineModel<Position[]>('waypoints', { required: true })
const emit = defineEmits<{
  command: [command: RoomCommand]
  request: [action: RoomAction, review: boolean, summary: string]
  combat: [
    command: CombatCommand,
    review: boolean,
    summary: string,
    openingRequestId?: string,
    template?: MapTemplate,
  ]
  opening: [opening: BattleOpening, reason: string]
  inspect: []
  picking: [enabled: boolean]
  preview: [path: Position[], mode: 'move' | 'jump', valid: boolean]
  jumpRange: [cells: Position[]]
}>()
const detailsOpen = shallowRef(false)
const detailMapSelection = useMapSelection()
const pickingDetailTargets = computed(() => detailsOpen.value && !!detailMapSelection?.current.value)
const favoriteBoard = shallowRef<QuickActionBoard>('magic')
const repeatConfirm = ref(true)
const runup = ref(false)
try {
  repeatConfirm.value = localStorage.getItem('trpg-repeat-move-confirm') !== 'false'
} catch {
  /* local preference unavailable */
}
watch(repeatConfirm, (value) => {
  try {
    localStorage.setItem('trpg-repeat-move-confirm', String(value))
  } catch {
    /* quota */
  }
})
function wakeMovement() {
  if (
    !mayWakeMovement({
      controlled: !!character.value,
      ownTurn: ownTurn.value,
      busy: props.busy,
      incapacitated: incapacitated.value,
      details: details.value,
      mode: mapMode.value,
      action: !!selectedAction.value || !!selectedAbility.value,
    })
  )
    return false
  mapMode.value = 'move'
  active.value = true
  details.value = true
  selectedAction.value = null
  selectedAbility.value = ''
  emit('picking', true)
  return true
}
async function focusSpell(key:string){choose('spell',{kind:'spell',key},false);await nextTick();detailsOpen.value=true}
defineExpose({ confirmMovement, repeatConfirm, wakeMovement, focusSpell })
const active = defineModel<boolean>('active', { default: false })
const incapacitated = computed(
  () =>
    !!state.value?.death.dead ||
    !!stats.value?.conditions.some((c) =>
      ['incapacitated', 'stunned', 'paralyzed', 'unconscious', 'petrified'].includes(c),
    ),
)
const budgetLocked = computed(() => !ownTurn.value || !!budget.value?.ended || incapacitated.value)
const budgetEntries = computed(() => [
  {
    name: '动作',
    available: !!(inBattle.value ? actor.value?.turn?.action : budget.value?.action),
    locked: budgetLocked.value,
  },
  {
    name: '附赠',
    available: !!(inBattle.value ? actor.value?.turn?.bonus : budget.value?.bonus),
    locked: budgetLocked.value,
  },
  {
    name: '反应',
    available: !!(inBattle.value ? actor.value?.turn?.reaction : budget.value?.reaction),
    locked: incapacitated.value,
  },
])
const abilityKey = ref(''),
  selectedAbility = ref('')
const abilities = computed(() =>
  character.value ? quickAbilities(character.value, props.content) : [],
)
const magic = ref(false),
  reviewMove = ref(false),
  more = ref(false),
  details = ref(false),
  attackId = ref(''),
  spellKey = ref(''),
  itemId = ref(''),
  castMode = ref(''),
  note = ref(''),
  hostile = ref(false),
  message = ref('')
const selectedTargets = ref<string[]>([])
const areaTemplate = ref<MapTemplate>()
function applySpellArea(template: MapTemplate, ids: string[]) {
  areaTemplate.value = template
  selectedTargets.value = ids
}
const selectedAction = ref<ExplorationAction | null>(null)
const ACTION_NAMES: Record<ExplorationAction, string> = {
  surge: '动作如潮',
  dash: '疾走',
  disengage: '撤离',
  dodge: '闪避',
  stand: '起身',
  utilize: '利用',
  search: '搜索',
  study: '研究',
  influence: '影响',
  hide: '躲藏',
  help: '帮助',
  ready: '准备',
  reaction: '反应',
  wind: '疾步',
  'wind-focus': '增强疾步',
  'cunning-dash': '灵巧疾走',
  'cunning-disengage': '灵巧撤离',
  'cunning-hide': '灵巧躲藏',
}
const character = computed(() => props.view.ownCharacters.find((c) => c.id === characterId.value)),
  token = computed(() => props.view.scene?.tokens.find((t) => t.id === props.tokenId)),
  target = computed(() => props.view.scene?.tokens.find((t) => t.id === targetId.value))
const stats = computed(() =>
    character.value ? runtimeDerived(character.value, props.content) : null,
  ),
  state = computed(() => (character.value ? runtimeState(character.value, props.content) : null))
const exploration = computed(() => props.view.exploration),
  budget = computed(() =>
    exploration.value?.status === 'active'
      ? exploration.value.members.find((m) => m.tokenId === props.tokenId)
      : undefined,
  )
const battle = computed(() => props.view.encounter),
  inBattle = computed(() => battle.value?.phase === 'active'),
  actor = computed(() => battle.value?.actors.find((a) => a.characterId === characterId.value))
const canControl = computed(
    () => !!token.value && props.view.self.characterIds.includes(token.value.characterId ?? ''),
  ),
  ownTurn = computed(() => !inBattle.value || actor.value?.id === battle.value?.currentId)
const movementLeft = computed(() =>
  Math.max(
    0,
    (stats.value?.speed ?? 0) +
      (inBattle.value ? (actor.value?.turn?.dash ?? 0) : (budget.value?.dash ?? 0)) -
      (inBattle.value ? (actor.value?.turn?.movement ?? 0) : (budget.value?.movement ?? 0)),
  ),
)
const pending = computed(() =>
  props.view.intents.some(
    (i) =>
      i.status === 'pending' &&
      ((i.action.kind === 'runtime' && i.action.characterId === characterId.value) ||
        (i.action.kind === 'map' &&
          (('tokenId' in i.action.command && i.action.command.tokenId === props.tokenId) ||
            (i.action.command.type === 'explore' &&
              'tokenId' in i.action.command.command &&
              i.action.command.command.tokenId === props.tokenId)))),
  ),
)
const block = computed(() =>
  !canControl.value
    ? '请选择场景中由你操控的角色'
    : state.value?.death.dead || stats.value?.conditions.includes('incapacitated')
      ? '死亡或失能时不能自行行动'
      : pending.value
        ? '等待 GM 处理已提交的行动'
        : inBattle.value && (battle.value?.pending || battle.value?.endTurnBlocked)
          ? '等待当前行动与反应结算'
          : props.busy
            ? '正在同步'
            : budget.value?.ended
              ? '已结束本轮'
              : !ownTurn.value
                ? '等待当前行动者'
                : state.value?.concentration?.pendingDC
                  ? '请先完成专注豁免'
                  : state.value &&
                      !state.value.hp &&
                      !state.value.death.stable &&
                      !state.value.death.dead &&
                      !(budget.value?.deathSaved || actor.value?.turn?.deathSaveDone)
                    ? '请先完成死亡豁免'
                    : exploration.value?.triggers.some(
                          (t) => !t.resolved && t.tokenId === props.tokenId,
                        )
                      ? '等待 GM 裁定持续区域'
                      : '',
)
const grants = computed(() =>
    character.value ? runtimeSpells(character.value, props.content).filter(g=>!g.retired) : [],
  ),
  attacks = computed(() =>
    inBattle.value
      ? character.value && handling.value.before.length
        ? explorationAttacks(
            handlingPreview(character.value, props.content, handling.value),
            props.content,
          )
        : (actor.value?.attacks ?? [])
      : character.value
        ? explorationAttacks(character.value, props.content)
        : [],
  )
const grant = computed(() => grants.value.find((g) => g.key === spellKey.value)),
  attack = computed(() => attacks.value.find((a) => a.id === attackId.value)),
  inventory = computed(
    () =>
      character.value?.inventory.filter(
        (r) =>
          r.quantity > 0 &&
          !['weapon', 'armor', 'shield'].includes(
            findItem(character.value!, props.content, r.itemId)?.kind ?? '',
          ),
      ) ?? [],
  )
const item = computed(() => inventory.value.find((r) => r.instanceId === itemId.value)),
  itemName = (id: string) =>
    character.value ? (findItem(character.value, props.content, id)?.name ?? id) : id
const attackCost = ref<AttackCost>('action'),
  attackAllowed = ref(false)
const unarmedKind = ref<'damage' | 'grapple' | 'prone' | 'push'>('damage'),
  unarmedSave = ref<'str' | 'dex'>('str'),
  grappleHand = ref<'main-hand' | 'off-hand'>('main-hand'),
  escapeSkill = ref<'athletics' | 'acrobatics'>('athletics')
const attackContext = computed(() => {
  const a = actor.value,
    spec = attack.value
  return a?.turn && spec
    ? {
        actor: { id: a.id, turn: a.turn },
        currentId: battle.value?.currentId,
        active: !!inBattle.value,
        pending: !!battle.value?.pending,
        character: character.value,
        cat: props.content,
        spec,
      }
    : null
})
function activateFlurry() {
  if (actor.value)
    emit(
      'combat',
      {
        type: 'feature',
        actorId: actor.value.id,
        id: 'growth/flurry',
        targetId: actor.value.id,
        amount: 1,
        env: defaultEnvironment(),
        note: '明确启用疾风：附赠动作与 1 专注，逐次结算',
      },
      true,
      '启用疾风连击',
    )
}
const ammoPreview = computed(() => {
  const a = attack.value
  if (!a || !a.properties.some((p) => p.startsWith('ammunition')))
    return a?.id.endsWith('-throw') ? '消耗所选投掷武器库存' : '无需弹药'
  const id = a.weaponId?.includes('crossbow')
    ? 'bolt'
    : a.weaponId === 'sling'
      ? 'sling-bullet'
      : ['musket', 'pistol'].includes(a.weaponId ?? '')
        ? 'firearm-bullet'
        : a.weaponId === 'blowgun'
          ? 'needle'
          : 'arrow'
  return `消耗 1 ${itemName(id)}；库存 ${character.value?.inventory.filter((r) => r.itemId === id).reduce((n, r) => n + r.quantity, 0) ?? 0}`
})
const favorites = useQuickActions(characterId)
const favoriteRows = computed<QuickActionRow[]>(() =>
  favorites.state.value.entries.map((e) => ({
    entry: e,
    name:
      e.kind === 'attack'
        ? (attacks.value.find(a => a.id === e.key)?.name ?? quickText('unavailableAttack'))
        : e.kind === 'spell'
        ? (grants.value.find((g) => g.key === e.key)?.spell.name ?? '不可用法术')
        : e.kind === 'feature'
          ? (abilities.value.find((a) => a.id === e.key)?.name ?? '不可用职业能力')
          : itemName(inventory.value.find((r) => r.instanceId === e.key)?.itemId ?? '不可用物品'),
    available:
      e.kind === 'attack'
        ? attacks.value.some(a => a.id === e.key)
        : e.kind === 'spell'
        ? grants.value.some((g) => g.key === e.key && g.modes.length)
        : e.kind === 'feature'
          ? abilities.value.some((a) => a.id === e.key)
          : inventory.value.some((r) => r.instanceId === e.key),
    selected: active.value && (e.kind === 'feature' ? selectedAbility.value === e.key : !selectedAbility.value && !selectedAction.value && mapMode.value === (e.kind === 'spell' ? 'spell' : e.kind === 'attack' ? 'attack' : 'item') && (e.kind === 'spell' ? spellKey.value : e.kind === 'attack' ? attackId.value : itemId.value) === e.key),
    detail:
      e.kind === 'attack' ? (attacks.value.some(a => a.id === e.key) ? '' : quickText('unavailableAttack')) : e.kind === 'feature'
        ? ((a) =>
            a
              ? `${a.cost}${a.remaining === undefined ? '' : ' · 剩余 ' + a.remaining + '/' + a.max}`
              : '来源不可用')(abilities.value.find((a) => a.id === e.key))
        : '',
  })),
)
const targetDistance = computed(() =>
  token.value && target.value && props.view.scene
    ? Math.max(
        0,
        Math.max(token.value.x, target.value.x) -
          Math.min(token.value.x + token.value.span - 1, target.value.x + target.value.span - 1),
        Math.max(token.value.y, target.value.y) -
          Math.min(token.value.y + token.value.span - 1, target.value.y + target.value.span - 1),
      ) * props.view.scene.grid.feet
    : null,
)
const ray = computed(() =>
  props.view.scene?.sightLines?.find(
    (r) => r.fromId === props.tokenId && r.toId === targetId.value,
  ),
)
const policy = computed(() =>
  grant.value
    ? spellTargets(
        grant.value.spell,
        grant.value.key,
        character.value?.level ?? 1,
        castSlotLevel(castMode.value) || grant.value.spell.level || 1,
      )
    : null,
)
const complex = computed(
  () =>
    !!grant.value &&
    ((policy.value?.max ?? 1) > 1 ||
      policy.value?.area ||
      [
        'shillelagh',
        'true-strike',
        'magic-weapon',
        'elemental-weapon',
        'arcane-vigor',
        'cordon-of-arrows',
      ].includes(grant.value.spell.id) ||
      grant.value.spell.id.startsWith('summon-')),
)
const actionCost = computed(() =>
  grant.value
    ? /reaction/i.test(grant.value.spell.castingTime)
      ? 'reaction'
      : /bonus/i.test(grant.value.spell.castingTime)
        ? 'bonus'
        : 'action'
    : 'action',
)
const preview = computed(() =>
  publicMovementPreview(
    props.view,
    props.tokenId,
    waypoints.value,
    props.content,
    mapMode.value === 'jump' ? 'jump' : 'move',
    magic.value,
    runup.value,
  ),
)
const jumpCells = computed(() =>
  active.value && mapMode.value === 'jump'
    ? publicJumpRange(props.view, props.tokenId, props.content, magic.value, runup.value)
    : [],
)
watch(jumpCells, (cells) => emit('jumpRange', cells), { immediate: true })
const picking = computed(
  () =>
    active.value &&
    !selectedAction.value &&
    !selectedAbility.value &&
    ['move', 'jump'].includes(mapMode.value),
)
watch(picking, (value) => emit('picking', value), { immediate: true })
watch(
  [preview, mapMode, active, picking],
  () =>
    emit(
      'preview',
      picking.value ? preview.value.path : [],
      mapMode.value === 'jump' ? 'jump' : 'move',
      !preview.value.errors.length,
    ),
  { immediate: true },
)
watch(
  () => [props.view.worldRevision, props.tokenId, props.view.scene?.id].join('|'),
  (_, old) => {
    if (old) {
      selectedAction.value = null
      active.value = false
    }
    if (old && waypoints.value.length) {
      waypoints.value = []
      message.value = '场景状态已变化，请重新选择路线／落点'
    }
  },
)
watch(characterId, () => {
  active.value = false
  selectedTargets.value = []
  selectedAction.value = null
  waypoints.value = []
  spellKey.value = ''
  itemId.value = ''
  abilityKey.value = ''
  selectedAbility.value = ''
  attackId.value = ''
  more.value = false
  details.value = false
})
watch(spellKey, () => {
  areaTemplate.value = undefined
  selectedTargets.value = []
  castMode.value = grant.value?.modes[0] ?? ''
  hostile.value = !excludesAutomaticOpening(grant.value?.spell.id ?? '') && ['attack', 'save'].includes(
    grant.value ? spellEffect(grant.value.spell.id).kind : '',
  )
  details.value = false
})
watch(
  () => props.view.scene?.tokens.map((t) => t.id).join('|'),
  () => {
    selectedTargets.value = selectedTargets.value.filter((id) =>
      props.view.scene?.tokens.some((t) => t.id === id),
    )
    if (targetId.value && !props.view.scene?.tokens.some((t) => t.id === targetId.value))
      targetId.value = ''
  },
)
const preset = computed<QuickPreset>(() => ({
  kind: mapMode.value === 'spell' ? 'cast' : mapMode.value === 'item' ? 'item' : 'attack',
  key:
    mapMode.value === 'spell'
      ? spellKey.value
      : mapMode.value === 'item'
        ? itemId.value
        : attackId.value,
  target: targetId.value,
}))
const detailContext = computed(() => [props.view.id, characterId.value, props.view.scene?.id, props.view.encounter?.id, props.view.encounter?.phase, mapMode.value, attackId.value, spellKey.value, itemId.value, selectedAbility.value].join('|'))
watch(detailContext, () => { detailsOpen.value = false })
watch(active, value => { if (!value) detailsOpen.value = false })
function choose(mode: typeof mapMode.value, entry?: QuickAction, toggle = true) {
  const same =
    !selectedAction.value &&
    !selectedAbility.value &&
    mapMode.value === mode &&
    (!entry || (entry.kind === 'spell' ? spellKey.value : entry.kind === 'attack' ? attackId.value : itemId.value) === entry.key)
  if (same) {
    active.value = toggle ? !active.value : true
    return
  }
  active.value = true
  selectedAction.value = null
  selectedAbility.value = ''
  mapMode.value = mode
  waypoints.value = []
  message.value = ''
  details.value = false
  if (mode === 'attack' && !attackId.value) attackId.value = attacks.value[0]?.id ?? ''
  if (entry?.kind === 'attack') attackId.value = entry.key
  if (entry?.kind === 'spell') spellKey.value = entry.key
  if (entry?.kind === 'item') itemId.value = entry.key
}
function chooseFavorite(entry: QuickAction) {
  if (entry.kind !== 'feature') {
    choose(entry.kind === 'spell' ? 'spell' : entry.kind === 'attack' ? 'attack' : 'item', entry)
    return
  }
  if (selectedAbility.value === entry.key) {
    active.value = !active.value
    return
  }
  active.value = true
  selectedAbility.value = entry.key
  selectedAction.value = null
  more.value = false
  waypoints.value = []
}
function chooseGeneral(value: string) {
  if (!value) {
    active.value = false
    return
  }
  if (value === 'jump') choose('jump')
  else if (value) action(value as ExplorationAction)
}
function request(command: ExplorationCommand, review = false, summary = '探索行动') {
  if (props.view.scene)
    emit(
      'request',
      { kind: 'map', command: { type: 'explore', sceneId: props.view.scene.id, command } },
      review,
      summary,
    )
}
function confirmMovement() {
  if (block.value || preview.value.errors.length || !preview.value.path.length || !props.view.scene)
    return
  if (mapMode.value === 'jump')
    request(
      {
        operation: 'jump',
        runup: runup.value,
        tokenId: props.tokenId,
        to: waypoints.value.at(-1)!,
        mode: magic.value ? 'magic' : 'normal',
        confirmed: false,
        note: note.value,
      },
      reviewMove.value || preview.value.review,
      '跳跃预览确认',
    )
  else
    emit(
      'request',
      {
        kind: 'map',
        command: {
          type: 'move',
          sceneId: props.view.scene.id,
          tokenId: props.tokenId,
          path: preview.value.path,
          gm: false,
          reason: note.value || '地图路线预览确认',
          reactionsConfirmed: false,
        },
      },
      reviewMove.value,
      '移动预览确认',
    )
}
function endTurn() {
  if (!token.value || pending.value || props.busy) return
  if (inBattle.value && actor.value && battle.value)
    emit(
      'combat',
      {
        type: 'end-turn',
        actorId: actor.value.id,
        encounterId: battle.value.id,
        expectedTick: battle.value.tick,
      },
      false,
      '结束我的回合',
    )
  else if (exploration.value)
    request(
      { operation: 'end', tokenId: props.tokenId, roundId: exploration.value.roundId },
      false,
      '结束我的探索回合',
    )
}
function quickAttack() {
  if (!attack.value || !target.value || block.value) return
  if (inBattle.value && !attackAllowed.value) return
  if (
    inBattle.value &&
    actor.value &&
    attack.value.id === 'unarmed' &&
    unarmedKind.value !== 'damage'
  ) {
    emit(
      'combat',
      unarmedCommand(
        actor.value.id,
        target.value.actorId ?? '',
        unarmedKind.value,
        unarmedSave.value,
        grappleHand.value,
        attackCost.value,
        { ...defaultEnvironment(), note: note.value || '核对目标所选豁免与推撞落点' },
        handling.value,
      ),
      true,
      '徒手擒抱／推撞',
    )
    return
  }
  const reason = note.value || `${token.value?.name}向${target.value.name}使用${attack.value.name}`
  if (inBattle.value && actor.value)
    emit(
      'combat',
      {
        type: 'attack',
        handling:
          handling.value.before.length || handling.value.after.length ? handling.value : undefined,
        actorId: actor.value.id,
        targetId: target.value.actorId ?? '',
        attackId: attack.value.id,
        cost: attackCost.value,
        sneak: false,
        mastery: true,
        env: { ...defaultEnvironment(), note: reason },
      },
      false,
      reason,
      props.view.battleRequests.find(
        (r) =>
          r.characterId === characterId.value &&
          r.encounterId === battle.value?.id &&
          r.status === 'accepted' &&
          r.openingStatus === 'waiting' &&
          r.opening?.kind === 'attack' &&
          r.opening.attackId === attack.value?.id &&
          r.opening.tokenIds.length === 1 &&
          r.opening.tokenIds[0] === targetId.value,
      )?.id,
    )
  else
    emit(
      'opening',
      {
        kind: 'attack',
        attackId: attack.value.id,
        tokenIds: [target.value.id],
        sneak: false,
        mastery: true,
      },
      reason,
    )
}
const sceneEffectForm=ref<InstanceType<typeof SceneEffectTools>|null>(null)
function openSceneSpell(){if(sceneEffectForm.value)void sceneEffectForm.value.focusSpell(spellKey.value);else message.value='请在房间栏打开“持续区域 · 光照与遮蔽”'}
function quickSpell() {
  if(grant.value&&([...M4_SCENE_SPELLS,...M5_WORLD_SPELLS] as readonly string[]).includes(grant.value.spell.id)){openSceneSpell();return}
  if (!grant.value || !castMode.value || block.value) return
  if (excludesAutomaticOpening(grant.value.spell.id)) hostile.value = false
  if (!inBattle.value && !hostile.value) {
    const ids = policy.value?.self
      ? [props.tokenId]
      : complex.value
        ? selectedTargets.value
        : targetId.value
          ? [targetId.value]
          : []
    const targets = ids.map((id) => props.view.scene?.tokens.find((t) => t.id === id))
    if (!targets.length || targets.some((t) => !t)) return
    const reason =
      note.value || `${grant.value.spell.name} → ${targets.map((t) => t!.name).join('、')}`
      request(
        {
          operation: 'spell-cast',
          hitDice: grant.value.spell.id === 'arcane-vigor' ? vigorDice.value : undefined,
          supportChoice: supportChoice.value || undefined,...controlSelection.value,
          willing: willing.value,
          tokenId: props.tokenId,
          key: grant.value.key,
          mode: castMode.value,
          targets: ids,
          confirmed: false,
          note: reason,
          ...(areaTemplate.value ? { template: areaTemplate.value } : {}),
        },
        true,
        reason,
      )
    return
  }
  if (complex.value && !areaTemplate.value) return
  const actual = policy.value?.self ? token.value : target.value
  if (!actual && !areaTemplate.value) return
  const reason =
      note.value ||
      `${grant.value.spell.name} → ${areaTemplate.value ? '范围内所选目标' : actual!.name}`,
    type = spellDamageOptions(grant.value.spell.id)[0] ?? 'fire'
  if (inBattle.value && actor.value)
    emit(
      'combat',
      {
        type: 'cast',
        actorId: actor.value.id,
        key: grant.value.key,
        mode: castMode.value,
        targets:
          areaTemplate.value && !policy.value?.self
            ? selectedTargets.value.flatMap(
                (id) => props.view.scene?.tokens.find((t) => t.id === id)?.actorId ?? [],
              )
            : [actual?.actorId ?? ''],
        env: { ...defaultEnvironment(), note: reason },
        damageType: type,
        supportChoice: supportChoice.value || undefined,...controlSelectionForActors(controlSelection.value,id=>{const token=props.view.scene?.tokens.find(t=>t.id===id);return token?.actorId??id}),
        hitDice: grant.value.spell.id === 'arcane-vigor' ? vigorDice.value : undefined,
        willing: willing.value,
        requirementsConfirmed: false,
        triggerConfirmed: false,
      },
      true,
      reason,
      props.view.battleRequests.find(
        (r) =>
          r.characterId === characterId.value &&
          r.encounterId === battle.value?.id &&
          r.status === 'accepted' &&
          r.openingStatus === 'waiting' &&
          r.opening?.kind === 'cast' &&
          r.opening.key === spellKey.value &&
          r.opening.mode === castMode.value &&
          r.opening.tokenIds.length === 1 &&
          r.opening.tokenIds[0] === actual?.id,
      )?.id,
      areaTemplate.value,
    )
  else if (hostile.value)
    emit(
      'opening',
      {
        kind: 'cast',
        supportChoice: supportChoice.value || undefined,...controlSelection.value,
        willing: willing.value,
        key: grant.value.key,
        mode: castMode.value,
        tokenIds: areaTemplate.value?selectedTargets.value:actual ? [actual.id] : [],
        damageType: type,
      },
      reason,
    )
}
function quickItem() {
  const itemGrant=grants.value.find(g=>g.item?.instanceId===item.value?.instanceId&&g.modes.length)
  if(itemGrant){focusSpell(itemGrant.key);return}
  if (!item.value || block.value) return
  if (inBattle.value || !item.value.itemId.includes('potion')) {
    detailsOpen.value = true
    return
  }
  emit(
    'request',
    {
      kind: 'runtime',
      characterId: characterId.value,
      command: {
        type: 'item-remove',
        instanceId: item.value.instanceId,
        quantity: 1,
        consume: true,
        note: note.value || '地图使用药水',
      },
    },
    false,
    '使用药水（附赠动作）',
  )
}
function action(id: ExplorationAction) {
  active.value = true
  selectedAbility.value = ''
  selectedAction.value = id
  waypoints.value = []
  more.value = false
}
function confirmAction() {
  if (!selectedAction.value || block.value) return
  const id = selectedAction.value
  if (inBattle.value && actor.value) {
    if (id === 'stand')
      emit(
        'combat',
        {
          type: 'move',
          actorId: actor.value.id,
          distance: 0,
          difficult: false,
          stand: true,
          note: note.value,
        },
        true,
        '起身',
      )
    else if (
      [
        'dash',
        'disengage',
        'dodge',
        'help',
        'ready',
        'utilize',
        'hide',
        'search',
        'study',
        'influence',
      ].includes(id)
    )
      emit(
        'combat',
        {
          type: 'action',
          actorId: actor.value.id,
          action: id as Extract<CombatCommand, { type: 'action' }>['action'],
          note: note.value,
        },
        ['help', 'ready', 'hide', 'search', 'study', 'influence'].includes(id),
        ACTION_NAMES[id],
      )
    else message.value = '请使用对应职业能力入口'
    return
  }
  if (!budget.value) {
    message.value = '请先开启探索回合制，再登记动作预算与裁定'
    return
  }
  request(
    { operation: 'action', tokenId: props.tokenId, action: id, note: note.value, confirmed: false },
    ['hide', 'help', 'ready', 'reaction', 'cunning-hide', 'search', 'study', 'influence'].includes(
      id,
    ),
    '探索行动：' + ACTION_NAMES[id],
  )
}
const primaryLabel = computed(() =>
  selectedAction.value
    ? '确认' + ACTION_NAMES[selectedAction.value]
    : mapMode.value === 'move'
      ? '确认移动'
      : mapMode.value === 'jump'
        ? '确认跳跃'
        : mapMode.value === 'attack'
          ? inBattle.value
            ? '确认攻击'
            : '提交战斗请求'
          : mapMode.value === 'spell'
            ? '提交法术审核'
            : '确认使用物品',
)
const spellUnavailable = computed(() =>
  !grant.value
    ? '法术来源不可用'
    : !grant.value.modes.includes(castMode.value)
      ? '所选施放方式或资源已不可用'
      : /minute|hour/i.test(grant.value.spell.castingTime) || castMode.value === 'ritual'
        ? '请先由 GM 收尾探索轮并安排实际施法时间'
        : budget.value && !budget.value[actionCost.value]
          ? '所需动作预算已用完'
          : budget.value?.slotSpent && spellUsesSlot(castMode.value)
            ? '本回合已消耗法术位施法'
            : '',
)
const primaryReady = computed(
  () =>
    !block.value &&
    (selectedAction.value
      ? (inBattle.value || !!budget.value) &&
        (![
          'hide',
          'help',
          'ready',
          'reaction',
          'cunning-hide',
          'search',
          'study',
          'influence',
        ].includes(selectedAction.value) ||
          !!note.value.trim())
      : ['move', 'jump'].includes(mapMode.value)
        ? !!preview.value.path.length && !preview.value.errors.length
        : mapMode.value === 'attack'
          ? !!attack.value &&
            !!target.value &&
            ray.value?.targetingClear !== false &&
            (!inBattle.value || attackAllowed.value)
          : mapMode.value === 'spell'
            ? !!grant.value &&
              !spellUnavailable.value &&
              !!castMode.value &&
              (!complex.value ||
                (!inBattle.value && !hostile.value) ||
                (inBattle.value && !!areaTemplate.value)) &&
              (policy.value?.self || complex.value
                ? !!policy.value?.self || selectedTargets.value.length > 0
                : !!target.value)
            : !!item.value),
)
function confirmPrimary() {
  if (!primaryReady.value) return
  if (selectedAction.value) confirmAction()
  else if (['move', 'jump'].includes(mapMode.value)) confirmMovement()
  else if (mapMode.value === 'attack') quickAttack()
  else if (mapMode.value === 'spell') quickSpell()
  else quickItem()
}
function clearSelection() {
  selectedAction.value = null
  selectedAbility.value = ''
  waypoints.value = []
  targetId.value = ''
  spellKey.value = ''
  itemId.value = ''
}
</script>

<template>
  <section class="map-quick" :class="{ 'quick-open': active }" :aria-label="controlText('workflow.quickActions')">
    <SpellResourceSummary v-if="character" :character="character" :content="content" />
    <DiscoveryStatus
      :view="view"
      :character-id="characterId"
      :busy="busy"
      @command="emit('command', $event)"
    />
    <button
      v-if="
        view.ai.npcs.some(
          (n) =>
            n.id === view.scene?.tokens.find((t) => t.id === targetId)?.npcId &&
            n.npcType === 'ordinary',
        )
      "
      :disabled="busy || !characterId"
      @click="
        emit('command', {
          kind: 'npc-fixed-talk',
          npcId: view.scene!.tokens.find((t) => t.id === targetId)!.npcId!,
          characterId,
        })
      "
    >
      {{ controlText('workflow.talk') }} {{ localizedEntryName(view.scene?.tokens.find((t) => t.id === targetId)) }}
    </button>
    <div class="room-row">
      <strong>{{
        inBattle
          ? controlText('controls.combat')
          : exploration?.status === 'active'
            ? controlText('inlineSummary.explorationRound',{p0:(exploration.round)})
            : exploration?.status === 'paused'
              ? controlText('expressionOne.explorationPausedBudgetRetained')
              : controlText('controls.explore')
      }}</strong
      ><button
        v-if="!inBattle"
        class="subtle scene-rail-primary"
        :disabled="busy || inBattle || !token"
        @click="
          request(
            { operation: 'toggle', enabled: exploration?.status !== 'active' },
            true,
            '申请切换全队探索回合',
          )
        "
      >
        {{
          exploration?.status === 'active'
            ? controlText('expressionOne.requestExplorationPause')
            : exploration?.status === 'paused'
              ? controlText('expressionOne.requestExplorationResume')
              : controlText('domain.requestExploration')
        }}
      </button>
    </div>
    <div v-if="budget || (inBattle && actor?.turn)" class="map-budget" :aria-label="controlText('workflow.budget')">
      <span
        :class="budgetLocked ? 'budget-locked' : movementLeft > 0 ? 'budget-ready' : 'budget-spent'"
        :aria-label="controlText('expressionOne.movementRemaining') + movementLeft + controlText('game.feet') + (budgetLocked ? controlText('expressionOne.currentlyUnavailable') : '')"
        >{{ controlText('controls.move') }} {{ movementLeft }}{{ controlText('game.feet') }}</span
      >
      <span
        v-for="entry in budgetEntries"
        :key="entry.name"
        :class="entry.locked ? 'budget-locked' : entry.available ? 'budget-ready' : 'budget-spent'"
        :aria-label="localizedEntryName(entry) + (entry.locked ? controlText('expressionOne.currentlyUnavailableAlias132') : entry.available ? controlText('controls.enabledState') : controlText('controls.usedState'))"
        :title="localizedEntryName(entry) + (entry.locked ? controlText('expressionOne.currentlyUnavailableAlias132') : entry.available ? controlText('controls.enabledState') : controlText('controls.usedState'))"
        ><span aria-hidden="true">{{ entry.locked ? '—' : entry.available ? '✓' : '×' }}</span>
        {{ localizedEntryName(entry) }}</span
      ><span v-if="budget?.surgeAction">{{ controlText('workflow.extraAction') }}</span
      ><button
        :disabled="
          busy ||
          pending ||
          !!block ||
          (inBattle && (!ownTurn || battle?.endTurnBlocked || battle?.pending))
        "
        @click="endTurn"
      >
        {{ controlText('controls.turnEnd') }}
      </button>
    </div>
    <div v-if="state?.concentration?.pendingDC" class="map-quick-alert">
      {{ controlText('workflow.concentrationSave') }} {{ state.concentration.pendingDC
      }}<button
        :disabled="busy"
        @click="
          inBattle && actor
            ? emit('combat', { type: 'concentration', actorId: actor.id }, false, '专注豁免')
            : request({ operation: 'concentration', tokenId }, false, '专注豁免')
        "
      >
        {{ controlText('game.concentrationSave') }}
      </button>
    </div>
    <div
      v-if="
        state &&
        !state.hp &&
        !state.death.stable &&
        !state.death.dead &&
        !(budget?.deathSaved || actor?.turn?.deathSaveDone)
      "
      class="map-quick-alert"
    >
      {{ controlText('workflow.deathSave') }}<button
        :disabled="busy"
        @click="
          inBattle && actor
            ? emit('combat', { type: 'death-save', actorId: actor.id }, false, '死亡豁免')
            : emit(
                'request',
                { kind: 'runtime', characterId, command: { type: 'death-save', roll: 1 } },
                true,
                '本轮死亡豁免',
              )
        "
      >
        {{ controlText('domain.deathSave') }}
      </button>
    </div>
    <QuickActionSections :rows="favoriteRows" :busy="busy" @select="chooseFavorite">
      <template #action>
        <button v-for="mode in ['move','jump'] as const" :key="mode" class="secondary" :disabled="busy" :aria-pressed="active && !selectedAbility && !selectedAction && mapMode === mode" @click="choose(mode)">{{ mode === 'move' ? controlText('controls.move') : quickText('jump') }}</button>
      <label class="quick-action-select"
        >{{ quickText('moreActions') }}<select
          :aria-label="controlText('workflow.chooseAction')"
          :value="selectedAbility ? '' : (selectedAction ?? (mapMode === 'jump' ? 'jump' : ''))"
          :disabled="busy"
          @change="chooseGeneral(($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ controlText('controls.selectAction') }}</option>
          <option
            v-for="a in [
              { id: 'dash', name: '疾走' },
              { id: 'disengage', name: '撤离' },
              { id: 'dodge', name: '闪避' },
              { id: 'stand', name: '起身' },
              { id: 'help', name: '帮助' },
              { id: 'hide', name: '躲藏' },
              { id: 'search', name: '搜索' },
              { id: 'study', name: '研究' },
              { id: 'influence', name: '影响' },
              { id: 'utilize', name: '利用' },
              { id: 'ready', name: '准备' },
            ]"
            :key="a.id"
            :value="a.id"
            :disabled="!inBattle && !budget"
          >
            {{ localizedEntryName(a)
            }}{{
              ['hide', 'search', 'study', 'influence', 'help', 'ready'].includes(a.id)
                ? controlText('expressionOne.gmRuling')
                : ''
            }}
          </option>
        </select></label
      >

      </template>
      <template #attack><button class="secondary" :disabled="busy" :aria-pressed="active && !selectedAbility && !selectedAction && mapMode === 'attack'" @click="choose('attack')">{{ controlText('controls.attack') }}</button></template>
      <template #manage><button class="subtle" :aria-expanded="more" @click="more = !more">{{ quickText('manage') }}</button></template>
    </QuickActionSections>
    <div v-if="more" class="map-quick-more">
      <p class="muted">
        {{ favorites.cloud.value ? controlText('expressionOne.favoritesSavedToTheAccountAndCharacter') : controlText('expressionOne.signedOutFavoritesSavedInThisBrowserOnly') }}
        · {{ displayFeedback(favorites.message.value,'info') }}
      </p>
      <label>{{ quickText('addBoard') }}<select v-model="favoriteBoard"><option v-for="board in quickBoards" :key="board" :value="board">{{ quickText(board) }}</option></select></label>
      <button class="subtle" @click="favorites.reload">{{ controlText('workflow.refreshFavorites') }}</button>
      <label
        >{{ controlText('workflow.chooseSpellSource') }}<select v-model="spellKey" @change="choose('spell', undefined, false)">
          <option value="">{{ controlText('domain.chooseSpell') }}</option>
          <option v-for="g in grants" :key="g.key" :value="g.key">
            {{ g.spell.level ? g.spell.level + controlText('expressionOne.level') : controlText('controls.cantrips') }} · {{ localizedEntryName(g.spell) }} ·
            {{ g.source }}
          </option>
        </select></label
      ><button
        :disabled="!spellKey || !favorites.ready.value || favorites.busy.value"
        @click="favorites.toggle({ kind: 'spell', key: spellKey, board: favoriteBoard })"
      >
        {{ controlText('workflow.favoriteSpell') }}
      </button>
      <label
        >{{ controlText('workflow.chooseInventoryItem') }}<select v-model="itemId" @change="choose('item', undefined, false)">
          <option value="">{{ controlText('game.item') }}</option>
          <option v-for="r in inventory" :key="r.instanceId" :value="r.instanceId">
            {{ itemName(r.itemId) }} ×{{ r.quantity }}
          </option>
        </select></label
      ><button
        :disabled="!itemId || !favorites.ready.value || favorites.busy.value"
        @click="favorites.toggle({ kind: 'item', key: itemId, board: favoriteBoard })"
      >
        {{ controlText('workflow.favoriteItem') }}
      </button>
      <label
        >{{ controlText('workflow.chooseAbility') }}<select v-model="abilityKey" :aria-label="controlText('workflow.chooseFavoriteAbility')">
          <option value="">{{ controlText('game.feature') }}</option>
          <option v-for="a in abilities" :key="a.id" :value="a.id">
            {{ localizedEntryName(a) }} · {{ a.cost
            }}{{ a.remaining === undefined ? '' : ' · ' + a.remaining + '/' + a.max }}
          </option>
        </select></label
      >
      <button
        :disabled="!abilityKey || !favorites.ready.value || favorites.busy.value"
        @click="favorites.toggle({ kind: 'feature', key: abilityKey, board: favoriteBoard })"
      >
        {{ controlText('workflow.favoriteAbility') }}
      </button>
      <label>{{ quickText('chooseAttack') }}<select v-model="attackId" @change="choose('attack', undefined, false)"><option value="">{{ controlText('game.choose') }}</option><option v-for="a in attacks" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option></select></label>
      <button :disabled="!attackId || !favorites.ready.value || favorites.busy.value" @click="favorites.toggle({kind:'attack',key:attackId,board:favoriteBoard})">{{ quickText('favoriteAttack') }}</button>
      <QuickFavoritesManager :storage-scope="view.self.id + ':' + characterId" :rows="favoriteRows" :busy="!favorites.ready.value || favorites.busy.value" @board="favorites.setBoard" @reorder="favorites.reorder" @remove="favorites.toggle" />
      <div v-if="budget" class="map-quick-strip">
        <button
          v-if="character?.build.classId === 'fighter' && (character.level ?? 0) >= 2"
          :disabled="!!block || budget.surgeUsed"
          @click="action('surge')"
        >
          {{ controlText('workflow.actionSurge') }}
        </button>
        <button
          v-for="a in [
            { id: 'dash', name: '疾走' },
            { id: 'disengage', name: '撤离' },
            { id: 'dodge', name: '闪避' },
            { id: 'stand', name: '起身' },
            { id: 'utilize', name: '利用' },
            { id: 'hide', name: '躲藏' },
            { id: 'help', name: '帮助' },
            { id: 'ready', name: '准备' },
            { id: 'reaction', name: '反应' },
          ] as const"
          :key="a.id"
          :disabled="!!block"
          @click="action(a.id)"
        >
          {{ localizedEntryName(a) }}</button
        ><template v-if="character?.build.classId === 'monk' && (character?.level ?? 0) >= 2"
          ><button :disabled="!!block" @click="action('wind')">{{ controlText('workflow.stepWind') }}</button
          ><button :disabled="!!block" @click="action('wind-focus')">
            {{ controlText('workflow.empoweredWind') }}
          </button></template
        ><template v-if="character?.build.classId === 'rogue' && (character?.level ?? 0) >= 2"
          ><button :disabled="!!block" @click="action('cunning-dash')">{{ controlText('workflow.cunningDash') }}</button
          ><button :disabled="!!block" @click="action('cunning-disengage')">{{ controlText('workflow.cunningDisengage') }}</button
          ><button :disabled="!!block" @click="action('cunning-hide')">{{ controlText('workflow.cunningHide') }}</button></template
        >
      </div>
    </div>
    <p v-if="active && !inBattle && !budget" class="muted">
      {{ controlText('workflow.jumpHint') }}
    </p>
    <p v-if="!active && block" class="muted small" role="status">{{ displayFeedback(block,'info') }}</p>
    <div v-show="active && !pickingDetailTargets" class="map-action-preview" :aria-label="controlText('workflow.actionPreview')">
      <div class="preview-heading">
        <strong>{{ controlText('workflow.actionSettings') }}</strong
        ><button type="button" class="subtle" :aria-label="controlText('workflow.collapseActionSettings')" @click="active = false">
          {{ controlText('controls.collapse') }}
        </button>
      </div>
      <p v-if="block" role="status">{{ displayFeedback(block,'info') }}</p>
      <p v-if="message" role="status">{{ displayFeedback(message,'info') }}</p>
      <QuickAbilityPanel
        v-if="selectedAbility"
        :view="view"
        :content="content"
        :character-id="characterId"
        :ability-id="selectedAbility"
        :busy="busy"
        @request="(...args) => emit('request', ...args)"
        @combat="(...args) => emit('combat', ...args)"
        @inspect="emit('inspect')"
        @cancel="active = false"
      />
      <template v-else-if="selectedAction"
        ><strong>{{ uiLabel(ACTION_NAMES[selectedAction]) }}</strong>
        <p>
          {{
            selectedAction === 'stand'
              ? controlText('expressionOne.spendMovementRequiredToStand')
              : selectedAction === 'surge'
                ? controlText('expressionOne.spendActionSurgeUseForOneAdditionalNon')
                : selectedAction === 'reaction'
                  ? controlText('expressionOne.spendReactionGmVerifiesTrigger')
                  : selectedAction.startsWith('wind') || selectedAction.startsWith('cunning-')
                    ? controlText('expressionOne.spendBonusAction')
                    : controlText('expressionOne.spendAction')
          }}{{ selectedAction === 'wind-focus' ? controlText('expressionOne.alsoSpendFocusPoint') : '' }}
        </p>
        <p
          v-if="
            [
              'hide',
              'help',
              'ready',
              'reaction',
              'cunning-hide',
              'search',
              'study',
              'influence',
            ].includes(selectedAction)
          "
          class="muted"
        >
          {{ controlText('workflow.checkHint') }}
        </p>
        <button :disabled="!primaryReady" @click="confirmAction">{{ primaryLabel }}</button
        ><button class="subtle" @click="active = false">{{ controlText('workflow.cancelSelection') }}</button></template
      >
      <template v-else-if="mapMode === 'move' || mapMode === 'jump'">
        <p>
          {{
            mapMode === 'move'
              ? controlText('expressionOne.clickGridCellsToSetRouteWaypointsThen')
              : controlText('expressionOne.clickAGridCellForDestinationThenConfirm')
          }}
        </p>
        <label v-if="mapMode === 'move'" class="check"
          ><input v-model="repeatConfirm" type="checkbox" />{{ controlText('workflow.clickDestination') }}</label
        >
        <label v-if="mapMode === 'jump'" class="check"
          ><input v-model="magic" type="checkbox" />{{ controlText('workflow.jumpSpell') }}</label
        >
        <label v-if="mapMode === 'jump' && !magic" class="check"
          ><input v-model="runup" type="checkbox" />{{ controlText('workflow.runUp') }}</label
        >
        <p>{{ controlText('quantity.expectedCost', {p0:(preview.details),p1:(preview.cost),p2:(controlText('game.feet'))}) }}</p>
        <p v-for="error in preview.errors" :key="error" class="error">{{ displayFeedback(error,'error') }}</p>
        <p v-if="preview.review" class="muted">{{ controlText('workflow.jumpObstacle') }}</p>
        <div class="room-row">
          <button
            :disabled="!!block || !!preview.errors.length || !preview.path.length"
            @click="confirmMovement"
          >
            {{
              reviewMove || preview.review
                ? controlText('expressionOne.submitRouteForReview')
                : controlText('controls.confirm') + (mapMode === 'jump' ? controlText('expressionOne.jump') : controlText('controls.move'))
            }}</button
          ><button
            class="subtle"
            :disabled="!waypoints.length"
            @click="waypoints = waypoints.slice(0, -1)"
          >
            {{ controlText('controls.undoPoint') }}</button
          ><button class="subtle" @click="waypoints = []">{{ controlText('controls.clearPreview') }}</button>
        </div>
        <details class="quick-advanced">
          <summary>{{ controlText('workflow.advanced') }}</summary>
          <label class="check"
            ><input v-model="reviewMove" type="checkbox" />{{ controlText('workflow.reactionHeight') }}</label
          >
        </details>
      </template>
      <template v-else>
        <p v-if="target">
          {{ controlText('quantity.targetDistance', {p0:(controlText('workflow.target')),p1:(localizedEntryName(target)),p2:(targetDistance),p3:(ray?.targetingClear === false ? controlText('expressionOne.physicalObstruction') : ray ? controlText('expressionOne.publicPathReachable') : controlText('expressionOne.pathRequiresVerification')),p4:(ray?.cover && ray.cover !== 'none'
              ? ' · ' +
                { half: controlText('domain.halfCover'), 'three-quarters': controlText('state.threeQuarterCover'), total: controlText('state.totalCover') }[ray.cover]
              : '')}) }}
        </p>
        <p v-else>{{ controlText('workflow.targetHint') }}</p>
        <template v-if="mapMode === 'attack'"
          ><label
            >{{ controlText('game.attackMode') }}<select v-model="attackId" :aria-label="controlText('workflow.attackMethod')">
              <option value="">{{ controlText('workflow.currentEquipment') }}</option>
              <option v-for="a in attacks" :key="a.id" :value="a.id">
                {{ localizedEntryName(a) }} ·
                {{ a.ranged ? a.range + '/' + a.longRange + controlText('expressionOne.ft') : controlText('expressionOne.reach') + a.reach + controlText('expressionOne.ft') }}
              </option>
            </select></label
          >
          <AttackMethodPicker
            v-if="inBattle"
            v-model="attackCost"
            v-model:available="attackAllowed"
            :context="attackContext"
            :busy="busy"
            @activate-flurry="activateFlurry"
          />
          <UnarmedOptions
            v-if="inBattle && character && actor"
            v-model:kind="unarmedKind"
            v-model:save="unarmedSave"
            v-model:hand="grappleHand"
            v-model:skill="escapeSkill"
            :character="character"
            :content="content"
            :busy="busy || !!battle?.pending"
            :show-choice="attackId === 'unarmed'"
            @release="
              (targetId) =>
                emit(
                  'combat',
                  { type: 'grapple-release', actorId: actor!.id, targetId },
                  false,
                  '释放擒抱',
                )
            "
            @escape="
              (sourceId) =>
                emit(
                  'combat',
                  {
                    type: 'grapple-escape',
                    actorId: actor!.id,
                    sourceId,
                    skill: escapeSkill,
                    env: defaultEnvironment(),
                  },
                  false,
                  '挣脱擒抱',
                )
            "
          />
          <WeaponHandlingPicker
            v-if="inBattle && character"
            v-model="handling"
            :character="character"
            :content="content"
            :busy="busy || !!battle?.pending"
            :cost="attackCost"
          />
          <p v-if="attack">
            {{ attack.damage }} ·
            {{
              targetDistance !== null && attack.ranged && targetDistance > attack.range
                ? controlText('expressionOne.longRangeUsuallyDisadvantage')
                : controlText('expressionOne.serverRechecksRange')
            }}
            · {{ ammoPreview }}
          </p>
          <button
            :disabled="
              !!block ||
              !attack ||
              !target ||
              ray?.targetingClear === false ||
              (inBattle && !attackAllowed)
            "
            @click="quickAttack"
          >
            {{ inBattle ? controlText('expressionOne.confirmAttack') : controlText('expressionOne.submitProactiveAttackCombatRequest') }}
          </button></template
        >
        <template v-if="mapMode === 'spell'"
          ><p v-if="grant">
            {{ localizedEntryName(grant.spell) }} · {{ grant.source }} · {{ grant.spell.castingTime }} ·
            {{ grant.spell.id==='spare-the-dying' ? spellRangeFeet(grant.spell.id,grant.spell.range,character?.level??1)+controlText('expressionOne.ft') : grant.spell.range }} · {{ grant.spell.concentration ? controlText('controls.concentration') : controlText('expressionOne.noConcentration') }}
          </p>
          <label
            >{{ controlText('domain.castMethod') }}<select v-model="castMode">
              <option v-for="m in grant?.modes" :key="m" :value="m">
                {{ m.startsWith('item-')?itemCastLabel(m):(uiLabel(MODE_NAMES[m]) ?? m) }}
              </option>
            </select></label
          >
          <p v-if="grant">
            {{ controlText('workflow.estimate') }}{{
              actionCost === 'bonus' ? controlText('controls.bonus') : actionCost === 'reaction' ? controlText('controls.reaction') : controlText('controls.action')
            }}{{
              spellUsesSlot(castMode)
                ? controlText('expressionOne.spend') + castSlotLevel(castMode) + controlText('expressionOne.levelSpellSlot')
                : controlText('expressionOne.costsFollowSelectedSource')
            }}
          </p>
          <p v-if="spellUnavailable" class="error">{{ spellUnavailable }}</p>
          <p v-if="grant&&([...M4_SCENE_SPELLS,...M5_WORLD_SPELLS] as readonly string[]).includes(grant.spell.id)" class="muted">{{ controlText('workflow.areaSpellHint') }}<button :disabled="busy" @click="openSceneSpell">{{ controlText('workflow.openAreaForm') }}</button></p>
          <p v-if="grant&&M1_UTILITY_SPELLS.includes(grant.spell.id)&&(!inBattle||grant.spell.id!=='aura-of-vitality')" class="muted">{{view.practicalM1?.length?controlText('expressionOne.chooseAnActualSourceTargetAndRegisteredMaterials'):controlText('expressionOne.forThisSpellTheGmVerifiesMaterialsAnd')}}{{ controlText('workflow.noEmptyCast') }}</p>
          <SupportSpellFields v-model:control="controlSelection" :targets="view.scene?.tokens??[]" :selected-ids="complex?selectedTargets:target?[target.id]:[]"
            :spell-id="grant?.spell.id"
            v-model:choice="supportChoice"
            v-model:willing="willing"
          />
          <label v-if="grant?.spell.id === 'arcane-vigor'">
            {{ controlText('field.arcaneVigorHitDiceCountRemaining') }} {{ state?.hitDice ?? 0 }}）
            <input v-model.number="vigorDice" type="number" min="1"
              :max="Math.min(state?.hitDice ?? 0, castSlotLevel(castMode) || 2)" />
          </label>
          <SpellAreaPicker
            v-if="view.scene && grant"
            :scene="view.scene"
            :caster-id="tokenId"
            :spell="grant.spell"
            :background="background"
            :busy="busy"
            :revision="view.worldRevision"
            :allowed-ids="
              inBattle
                ? view.scene.tokens
                    .filter((t) => view.encounter?.actors.some((a) => a.id === t.actorId))
                    .map((t) => t.id)
                : undefined
            "
            @apply="applySpellArea"
            @clear="areaTemplate = undefined"
          />
          <p v-if="!inBattle && grant && excludesAutomaticOpening(grant.spell.id)" class="muted">{{ EXPLORATION_OPENING_HELP }}</p>
            <label v-if="!inBattle && grant && !excludesAutomaticOpening(grant.spell.id)" class="check"
            ><input v-model="hostile" type="checkbox" />{{ controlText('workflow.hostileCast') }}</label
          >
          <p v-if="!inBattle && !hostile" class="muted">
            {{ controlText('workflow.spellOptions') }}
          </p>
          <fieldset v-if="!inBattle && !hostile && complex && !policy?.self">
            <legend>{{ controlText('quantity.spellTargets', {p0:(policy?.max)}) }}</legend>
            <MapTargetsButton v-model="selectedTargets" :items="view.scene?.tokens.filter(t=>grant?.spell.id!=='jump'||!!t.characterId)??[]" :max="policy?.max" /><label
              v-for="t in view.scene?.tokens.filter(
                (t) => grant?.spell.id !== 'jump' || t.characterId,
              )"
              :key="t.id"
              class="check"
              ><input v-model="selectedTargets" :value="t.id" type="checkbox" />{{ localizedEntryName(t) }}</label
            >
          </fieldset>
          <button
            v-if="(!grant||!([...M4_SCENE_SPELLS,...M5_WORLD_SPELLS] as readonly string[]).includes(grant.spell.id))&&(!complex || (!inBattle && !hostile) || (inBattle && areaTemplate))"
            :disabled="
              !!block ||
              !!spellUnavailable ||
              (!!grant&&M1_UTILITY_SPELLS.includes(grant.spell.id)&&(!inBattle||grant.spell.id!=='aura-of-vitality')) ||
              !grant ||
              !castMode ||
              (complex ? !selectedTargets.length && !policy?.self : !target && !policy?.self)
            "
            @click="quickSpell"
          >
            {{ controlText('workflow.submitSpell') }}
          </button></template
        >
        <template v-if="mapMode === 'item'"
          ><p>
            {{ item ? itemName(item.itemId) + controlText('expressionOne.quantity') + item.quantity : controlText('expressionOne.chooseAnActualInventoryItem') }}
          </p>
          <button :disabled="!!block || !item" @click="quickItem">
            {{ !inBattle && item?.itemId.includes('potion') ? controlText('expressionOne.confirmPotionUse') : controlText('expressionOne.configureUseThrow') }}
          </button></template
        >
        <button class="subtle" aria-haspopup="dialog" :aria-expanded="detailsOpen" @click="detailsOpen = true">{{ quickText('details') }}</button>
      </template>
      <details v-if="!selectedAbility" class="quick-advanced">
        <summary>{{ controlText('workflow.actionNotes') }}</summary>
        <label
          >{{ controlText('workflow.actionConditions') }}<input
            v-model="note"
            maxlength="2000"
            :placeholder="controlText('workflow.actionPlaceholder')"
        /></label>
      </details>
    </div>
    <Teleport to="body"
      ><div
        v-if="
          active && !pickingDetailTargets &&
          canControl &&
          !selectedAbility &&
          (selectedAction ||
            waypoints.length ||
            (mapMode === 'attack' && target) ||
            (mapMode === 'spell' && grant) ||
            (mapMode === 'item' && item))
        "
        class="map-mobile-confirm"
        :aria-label="controlText('workflow.confirmMapBottom')"
      >
        <strong>{{ primaryLabel }}</strong
        ><span>{{
          selectedAction
            ? uiLabel(ACTION_NAMES[selectedAction])
            : ['move', 'jump'].includes(mapMode)
              ? controlText('inlineSummary.ft',{p0:(preview.cost),p1:(preview.details)})
              : target
                ? controlText('inlineSummary.ftAlias8',{p0:(localizedEntryName(target)),p1:(targetDistance)})
                : (localizedEntryName(grant?.spell) ?? (item ? itemName(item.itemId) : ''))
        }}</span
        ><span v-if="block" role="status">{{ displayFeedback(block,'info') }}</span
        ><button :disabled="!primaryReady" @click="confirmPrimary" :aria-label="controlText('workflow.submitMap')">
          {{ primaryLabel }}</button
        ><button class="subtle" @click="clearSelection">{{ controlText('domain.clearSelection') }}</button>
      </div></Teleport
    >
    <QuickDetailsDialog v-model="detailsOpen" :context-key="detailContext">
      <div :key="detailContext" class="map-quick-details">
          <PlayerCombatPanel
            :background="background" :lock-character="true"
            v-if="inBattle"
            v-model:character-id="characterId"
            :view="view"
            :content="content"
            :busy="busy"
            :preset="preset"
            @execute="(...args) => emit('combat', ...args)"
          /><ExplorationActionPanel
            v-else
            v-model:character-id="characterId"
            :view="view"
            :content="content"
            :busy="busy"
            :preset="preset"
            :submit-opening="submitOpening"
            @submit="(...args) => emit('opening', ...args)"
          />
      </div>
    </QuickDetailsDialog>
  </section>
  <Teleport defer :disabled="!secondaryTarget" :to="secondaryTarget || 'body'">
  <SceneEffectTools ref="sceneEffectForm" v-if="view.self.role==='player'" :view="view" :character-id="characterId" :content="content" :busy="busy" @request="(action,review,summary)=>emit('request',action,review,summary)" />
  <SpatialStatus v-if="character" :space="token?.spatial" :capabilities="runtimeDerived(character,content).spatialCapabilities" :effects="character.runtime?.effects" />
  <M3PlayerActions v-if="view.self.role==='player'" :view="view" :character-id="characterId" :content="content" :busy="busy" @request="(action,review,summary)=>emit('request',action,review,summary)" />
  </Teleport>
</template>

<style scoped>
.map-quick {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
.map-budget {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.map-budget > span {
  border: 1px solid var(--border, var(--line));
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 0.82rem;
}
.map-budget .budget-ready {
  background: var(--accent-soft);
  color: var(--good);
  border-color: var(--accent);
}
.map-budget .budget-spent {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: var(--danger);
}
.map-budget .budget-locked {
  background: var(--button-disabled);
  color: var(--muted);
  border-color: var(--line);
}
.preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.quick-advanced summary {
  cursor: pointer;
  min-height: 44px;
  padding-top: 8px;
}
.map-budget button {
  margin-left: auto;
  min-height: 44px;
}
.map-quick-strip {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: flex-end;
  padding: 2px 0;
}
.map-quick-strip button {
  flex: 0 0 auto;
  min-height: 44px;
  min-width: 52px;
  height: 44px;
  padding: 8px;
}
.quick-action-select {
  flex: 1 1 120px;
  display: grid;
  gap: 4px;
  white-space: nowrap;
}
.quick-action-select select {
  min-height: 44px;
  width: 100%;
}
.map-quick-strip button[aria-pressed='true'] {
  outline: 2px solid #d2a855;
  outline-offset: -2px;
}
.map-quick-more,
.map-action-preview {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  display: grid;
  gap: 8px;
}
.map-quick-alert {
  padding: 10px;
  border-left: 3px solid #d2a855;
  display: grid;
  gap: 8px;
}
.map-quick-details {
  min-width: 0;
}
.error {
  color: var(--danger);
}
.map-quick p {
  margin: 2px 0;
}
.map-quick .room-row {
  gap: 8px;
}
@media (max-width: 700px) {
  .map-action-preview {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 41;
    max-height: min(65vh, 600px);
    overflow-y: auto;
    background: var(--surface);
    box-shadow: 0 4px 24px #0005;
    padding-bottom: 150px;
  }
  .map-action-preview .room-row {
    position: sticky;
    bottom: 8px;
    z-index: 4;
    padding: 8px;
    background: var(--surface);
    box-shadow: 0 4px 18px #0008;
    border-radius: 10px;
    flex-wrap: wrap;
  }
  .map-action-preview button {
    min-height: 44px;
  }
}
</style>
<style>
.map-mobile-confirm {
  display: none;
}
@media (max-width: 700px) {
  .map-mobile-confirm {
    position: fixed;
    bottom: 8px;
    left: 8px;
    right: 8px;
    z-index: 42;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--muted);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: 0 5px 24px #0008;
    color: var(--ink);
  }
  .map-mobile-confirm > span {
    grid-column: 1/-1;
    font-size: 0.8rem;
    max-height: 42px;
    overflow: auto;
  }
  .map-mobile-confirm button {
    min-height: 44px;
  }
  .room-explore:has(.quick-open) {
    padding-bottom: 160px;
  }
}
</style>
