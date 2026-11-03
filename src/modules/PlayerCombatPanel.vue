<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {damageDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { spellPresentation } from "./runtime-presentation"
import MapTargetsButton from "./map-selection/MapTargetsButton.vue"
import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import HasteActions from './HasteActions.vue'
import AttackFeatureFields from './AttackFeatureFields.vue'
import { attackFeatureOptions } from '../core/combat-resolution-options'
import type {ControlSelection} from '../core/m2-social-controls'
import SupportSpellFields from './SupportSpellFields.vue'

import { SUMMON_FORM_NAMES } from '../core/phb-companions'
import AttackMethodPicker from './AttackMethodPicker.vue'
import UnarmedOptions from './UnarmedOptions.vue'
import WeaponHandlingPicker from './WeaponHandlingPicker.vue'
import { handlingPreview } from '../core/weapon-handling'
import { explorationAttacks } from '../core/battle-opening'
import type { WeaponHandling } from '../core/combat-types'
import { unarmedCommand } from '../core/weapon-rules'
import { damageRerollCaption } from './combat-reroll-presentation'
import PlayerCompanionPanel from './PlayerCompanionPanel.vue'
import OriginCombatPanel from './OriginCombatPanel.vue'
import AdvancedPanel from './AdvancedPanel.vue'
import { sourceCaption } from '../core/rule-sources'
import MetamagicFields from './MetamagicFields.vue'
import { BEASTS, beast } from '../core/beasts'
import type { PendingAction } from '../core/combat-types'
import { manualFeatures } from '../core/manual-growth'
import { computed, ref, watch, nextTick } from 'vue'
import type { QuickPreset } from './exploration/quick-preset'
import type { RoomView } from '../online/protocol'
import type { CombatCommand, DamageType } from '../core/combat-types'
import { DAMAGE_NAMES, DEFENSE_NAMES } from '../core/combat-types'
import type { Catalogue } from '../core/engine'
import {
  castSlotLevel,
  runtimeState,
  runtimeDerived,
  runtimeSpells,
  MODE_NAMES,
} from '../core/runtime'
import { defaultEnvironment, spellEffect } from '../core/combat-rules'
import { templateCandidates } from '../core/map'
import SpellAreaPicker from './SpellAreaPicker.vue'
import type { MapTemplate } from '../core/map-types'
import { CONDITIONS } from '../content/conditions'
import { openingCommand } from '../core/battle-opening'
import { findItem } from '../core/runtime'
import {
  ATTACK_COSTS,
  ACTION_NAMES,
  COST_NAMES,
  combatFeatures,
  featureSelf,
  spellCost,
  spellDamageOptions,
  spellTargets,
} from '../online/combat-controls'
const handling = ref<WeaponHandling>({ before: [], after: [] })
const controlSelection = ref<ControlSelection>({}), supportChoice = ref(''),
  willing = ref(false)
const props = defineProps<{
  view: RoomView
  content: Catalogue
  busy: boolean
  background?: string
  preset?: QuickPreset
  lockCharacter?: boolean
}>()
const luckyDeath = ref(false)
const tavernReroll = ref(false)
const characterId = defineModel<string>('characterId', { required: true })
const emit = defineEmits<{
  execute: [
    command: CombatCommand,
    review: boolean,
    summary: string,
    openingRequestId?: string,
    template?: MapTemplate,
  ]
}>()
const areaTemplate = ref<MapTemplate>()
function applySpellArea(template: MapTemplate, ids: string[]) {
  areaTemplate.value = template
  selected.value = ids.flatMap(
    (id) => props.view.scene?.tokens.find((t) => t.id === id)?.actorId ?? [],
  )
}
const character = computed(() => props.view.ownCharacters.find((c) => c.id === characterId.value)),
  battle = computed(() => props.view.encounter),
  actor = computed(() => battle.value?.actors.find((a) => a.characterId === characterId.value)),
  state = computed(() => (character.value ? runtimeState(character.value, props.content) : null)),
  derived = computed(() =>
    character.value ? runtimeDerived(character.value, props.content) : null,
  ),
  ownTurn = computed(() => battle.value?.currentId === actor.value?.id),
  active = computed(() => battle.value?.phase === 'active'),
  canAct = computed(
    () =>
      active.value &&
      !props.view.gmControls?.some(h=>h.targetKind==='character'&&h.targetId===characterId.value) &&
      !!actor.value &&
      !state.value?.death.dead &&
      !derived.value?.conditions.includes('incapacitated'),
  ),
  canStart = computed(() => canAct.value && ownTurn.value && !battle.value?.pending && !props.busy),
  attacks = computed(() =>
    character.value && handling.value.before.length
      ? explorationAttacks(
          handlingPreview(character.value, props.content, handling.value),
          props.content,
        )
      : (actor.value?.attacks ?? []),
  ),
  grants = computed(() => (character.value ? runtimeSpells(character.value, props.content) : [])),
  features = computed(() => (character.value ? combatFeatures(character.value, props.content) : []))
const conditionNames = computed(
  () =>
    derived.value?.conditions
      .map((id) => CONDITIONS.find((c) => c.id === id)?.name ?? id)
      .join('、') || '无状态',
)
const endTurnBlock = computed(() => {
  if(props.view.gmControls?.some(h=>h.targetKind==='character'&&h.targetId===characterId.value)) return 'GM接管中，请等待归还控制权'
  if (!active.value || !actor.value || !ownTurn.value) return '等待当前行动者结束回合'
  if (battle.value?.pending) return '请先完成当前行动的伤害与反应结算'
  if (
    props.view.intents.some(
      (i) =>
        i.status === 'pending' &&
        i.action.kind === 'map' &&
        i.action.command.type === 'combat' &&
        i.action.command.sceneId === props.view.scene?.id,
    )
  )
    return '请先由 GM 处理待审核行动或反应'
  if (state.value?.concentration?.pendingDC) return '请先处理专注豁免'
  if (battle.value?.endTurnBlocked) return '等待 GM 处理待审核行动或豁免'
  if (
    state.value?.hp === 0 &&
    !state.value.death.dead &&
    !state.value.death.stable &&
    !actor.value.turn?.deathSaveDone
  )
    return '请先处理本回合死亡豁免'
  return ''
})
const target = ref(''),
  attackId = ref(''),
  cost = ref<Extract<CombatCommand, { type: 'attack' }>['cost']>('action'),
  sneak = ref(false),
  mastery = ref(true),
  spellKey = ref(''),
  vigorDice = ref(1),
  ammoId = ref(''),
  ammoCount = ref(4),
  wildCheck = ref(false),
  summonForm = ref(''),
  mode = ref(''),
  selected = ref<string[]>([]),
  darts = ref(['', '', '']),
  weaponId = ref(''),
  metamagic = ref<PendingAction['metamagic']>(),
  excludedIds = ref<string[]>([]),
  beastId = ref('wolf'),
  familiarId = ref('cat'),
  empoweredDice = ref<number[]>([]),
  damageType = ref<DamageType>('fire'),
  note = ref(''),
  featureId = ref(''),
  conversion = ref<
    'font-slot' | 'font-points' | 'font-inspiration' | 'wild-resurgence' | 'wild-slot'
  >('font-slot'),
  conversionLevel = ref(1),
  amount = ref(1),
  purify = ref(false),
  featureTargets = ref<string[]>([]),
  shieldKey = ref(''),
  shieldMode = ref('')
watch(
  () => character.value?.id,
  () => {
    conversion.value =
      character.value?.build.classId === 'druid'
        ? 'wild-resurgence'
        : character.value?.build.classId === 'bard'
          ? 'font-inspiration'
          : 'font-slot'
  },
  { immediate: true },
)
const manualFeature = computed(() =>
  character.value ? manualFeatures(character.value).find((f) => f.id === featureId.value) : null,
)
const grant = computed(() => grants.value.find((g) => g.key === spellKey.value)),
  policy = computed(() =>
    grant.value
      ? spellTargets(
          grant.value.spell,
          grant.value.key,
          character.value?.level ?? 1,
          (castSlotLevel(mode.value) || grant.value.spell.level || 1) +
            (metamagic.value?.option === 'twinned' ? 1 : 0),
        )
      : null,
  ),
  spellWeapons = computed(() => attacks.value.filter((a) => a.weaponId)),
  damageOptions = computed(() =>
    grant.value
      ? [
          ...spellDamageOptions(grant.value.spell.id),
          ...(character.value?.build.choices.subclass?.includes('great-old-one') &&
          /^(class-|subclass:|tome-)/.test(grant.value.key)
            ? ['psychic' as DamageType]
            : []),
        ]
      : [],
  ),
  castTargets = computed(() =>
    policy.value?.self
      ? [actor.value?.id ?? '']
      : policy.value?.darts
        ? darts.value
        : (policy.value?.max ?? 1) > 1
          ? selected.value
          : [target.value],
  ),
  shieldGrants = computed(() => grants.value.filter((g) => g.spell.id === 'shield')),
  shieldGrant = computed(() => shieldGrants.value.find((g) => g.key === shieldKey.value)),
  pending = computed(() => battle.value?.pendingAction),
  shieldEligible = computed(
    () =>
      canAct.value &&
      actor.value?.turn?.reaction &&
      pending.value?.targets.some((t) => t.id === actor.value?.id && t.shieldAvailable),
  ),
  ownRolls = computed(
    () =>
      pending.value?.targets.filter(
        (t) =>
          t.roll &&
          (pending.value?.kind === 'attack'
            ? pending.value?.actorId === actor.value?.id
            : t.id === actor.value?.id),
      ) ?? [],
  ),
  bardic = computed(() => state.value?.effects.some((e) => e.key === 'bardic-inspiration')),
  feature = computed(() => features.value.find((f) => f.id === featureId.value)),
  hasTargets = computed(
    () =>
      castTargets.value.length > 0 &&
      castTargets.value.every(Boolean) &&
      castTargets.value.length <= (policy.value?.max ?? 1),
  ),
  slotBlocked = computed(() => !!castSlotLevel(mode.value) && actor.value?.slotSpent),
  longCasting = computed(
    () =>
      !!grant.value &&
      (mode.value === 'ritual' ||
        (/minute|hour/i.test(grant.value.spell.castingTime) &&
          !(grant.value.key.startsWith('chain:') && mode.value === 'at-will'))),
  ),
  canCast = computed(
    () =>
      !!grant.value &&
      !state.value?.wildShape &&
      canAct.value &&
      (!battle.value?.pending || grant.value.spell.id === 'lightning-arrow') &&
      !props.busy &&
      !slotBlocked.value &&
      !longCasting.value &&
      (spellCost(grant.value.spell) === 'reaction'
        ? !!actor.value?.turn?.reaction
        : ownTurn.value &&
          !!actor.value?.turn?.[
            metamagic.value?.option === 'quickened' ? 'bonus' : spellCost(grant.value.spell)
          ]),
  )
watch(
  () =>
    [
      battle.value?.id,
      pending.value?.id ?? pending.value?.name,
      pending.value?.actorId,
      characterId.value,
    ].join(':'),
  () => {
    tavernReroll.value = false
  },
  { immediate: true },
)
watch(
  () => [attacks.value.map((a) => a.id).join('|'), spellKey.value],
  () => {
    if (!attacks.value.some((a) => a.id === attackId.value))
      attackId.value = attacks.value[0]?.id ?? ''
    const bound = ['magic-weapon', 'elemental-weapon'].includes(grant.value?.spell.id ?? ''),
      ids = spellWeapons.value.map((a) => (bound ? a.instanceId! : a.id))
    if (!ids.includes(weaponId.value)) weaponId.value = ids[0] ?? ''
  },
  { immediate: true },
)
watch(
  () => grants.value.map((g) => g.key).join('|'),
  () => {
    if (!grants.value.some((g) => g.key === spellKey.value))
      spellKey.value = grants.value[0]?.key ?? ''
    if (!shieldGrants.value.some((g) => g.key === shieldKey.value))
      shieldKey.value = shieldGrants.value[0]?.key ?? ''
  },
  { immediate: true },
)
watch(
  spellKey,
  () => {
    metamagic.value = undefined
    excludedIds.value = []
    mode.value = grant.value?.modes[0] ?? ''
    selected.value = []
    darts.value = ['', '', '']
    damageType.value = damageOptions.value.includes('fire')
      ? 'fire'
      : (damageOptions.value[0] ?? 'fire')
  },
  { immediate: true },
)
watch(
  () => [spellKey.value, mode.value, characterId.value, character.value?.level],
  () => {
    darts.value = Array.from(
      { length: policy.value?.darts ? policy.value.max : 3 },
      (_, i) => darts.value[i] ?? '',
    )
  },
  { immediate: true },
)
watch(shieldKey, () => (shieldMode.value = shieldGrant.value?.modes[0] ?? ''), { immediate: true })
watch(
  () => features.value.map((f) => f.id).join('|'),
  () => {
    if (!features.value.some((f) => f.id === featureId.value))
      featureId.value = features.value[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => battle.value?.actors.map((a) => a.id).join('|'),
  () => {
    const ids = battle.value?.actors.map((a) => a.id) ?? []
    if (!ids.includes(target.value)) target.value = ''
    selected.value = selected.value.filter((id) => ids.includes(id))
    featureTargets.value = featureTargets.value.filter((id) => ids.includes(id))
    darts.value = darts.value.map((id) => (ids.includes(id) ? id : ''))
  },
)
const run = (
  command: CombatCommand,
  review = false,
  summary = '战斗操作',
  openingRequestId?: string,
  template?: MapTemplate,
) => emit('execute', command, review, summary, openingRequestId, template)
const attackAllowed = ref(false)
const unarmedKind = ref<'damage' | 'grapple' | 'prone' | 'push'>('damage'),
  unarmedSave = ref<'str' | 'dex'>('str'),
  grappleHand = ref<'main-hand' | 'off-hand'>('main-hand'),
  escapeSkill = ref<'athletics' | 'acrobatics'>('athletics')
const attackContext = computed(() => {
  const a = actor.value,
    spec = attacks.value.find((s) => s.id === attackId.value)
  return a?.turn && spec
    ? {
        actor: { id: a.id, turn: a.turn },
        currentId: battle.value?.currentId,
        active: !!active.value,
        pending: !!battle.value?.pending,
        character: character.value,
        cat: props.content,
        spec,
      }
    : null
})
function activateFlurry() {
  if (actor.value)
    run(
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
const openings = computed(() =>
  props.view.battleRequests.filter(
    (r) =>
      r.characterId === characterId.value &&
      r.status === 'accepted' &&
      r.openingStatus === 'waiting' &&
      r.encounterId === battle.value?.id,
  ),
)
const openingError = (r: RoomView['battleRequests'][number]) => {
  if (!props.view.scene || !battle.value) return '场景或战斗不可用'
  try {
    openingCommand(r, props.view.scene, battle.value, defaultEnvironment())
    return ''
  } catch (e) {
    return (e as Error).message
  }
}
const openingPending = (id: string) =>
  props.view.intents.some(
    (i) =>
      i.status === 'pending' &&
      i.action.kind === 'map' &&
      i.action.command.type === 'combat' &&
      i.action.command.openingRequestId === id,
  )
function executeOpening(r: RoomView['battleRequests'][number]) {
  if (!props.view.scene || !battle.value) return
  const c = openingCommand(r, props.view.scene, battle.value, defaultEnvironment())
  run(c, c.type !== 'attack', '主动行动：' + r.reason, r.id)
}
const itemInstanceId = ref('')
const damageItems = computed(
  () =>
    character.value?.inventory.filter(
      (r) =>
        r.quantity > 0 &&
        !['weapon', 'armor', 'shield'].includes(
          findItem(character.value!, props.content, r.itemId)?.kind ?? '',
        ),
    ) ?? [],
)
const itemName = (id: string) =>
  character.value ? (findItem(character.value, props.content, id)?.name ?? id) : id
function attack() {
  if (!actor.value) return
  if (attackId.value === 'unarmed' && unarmedKind.value !== 'damage') {
    run(
      unarmedCommand(
        actor.value.id,
        target.value,
        unarmedKind.value,
        unarmedSave.value,
        grappleHand.value,
        cost.value,
        { ...defaultEnvironment(), note: note.value },
        handling.value,
      ),
      true,
      '徒手擒抱／推撞：核对目标所选豁免',
    )
    return
  }
  run(
    {
      type: 'attack',
      handling:
        handling.value.before.length || handling.value.after.length ? handling.value : undefined,
      actorId: actor.value.id,
      targetId: target.value,
      attackId: attackId.value,
      cost: cost.value,
      sneak: sneak.value && attackChoices.value.sneak && !attackChoices.value.sneakReason,
      mastery: mastery.value && attackChoices.value.mastery,
      env: { ...defaultEnvironment(), note: note.value },
    },
    ['opportunity', 'cleave'].includes(cost.value),
    '攻击：' + attacks.value.find((a) => a.id === attackId.value)?.name,
  )
}
watch(
  () => [characterId.value, spellKey.value],
  () => {
    areaTemplate.value = undefined
  },
)
function cast() {
  if (!actor.value || !grant.value) return
  run(
    {
      type: 'cast',
      actorId: actor.value.id,
      key: spellKey.value,
      mode: mode.value,
      targets: castTargets.value,
      env: { ...defaultEnvironment(), note: note.value },
      damageType: damageType.value,
      supportChoice: supportChoice.value || undefined,...controlSelection.value,
      willing: willing.value,
      metamagic: metamagic.value,
      excludedIds: excludedIds.value,
      weaponId: weaponId.value || undefined,
      ammunition:
        grant.value?.spell.id === 'cordon-of-arrows'
          ? { instanceId: ammoId.value, count: ammoCount.value }
          : undefined,
      requirementsConfirmed: false,
      triggerConfirmed: false,
      hitDice: grant.value.spell.id === 'arcane-vigor' ? vigorDice.value : undefined,
      wildCheck: wildCheck.value,
      summonForm: grant.value.spell.id.startsWith('summon-') ? summonForm.value : undefined,
    },
    true,
    '施法：' + grant.value.spell.name,
    undefined,
    areaTemplate.value,
  )
}
function useFeature() {
  if (!actor.value || !feature.value) return
  run(
    {
      type: 'feature',
      actorId: actor.value.id,
      id: featureId.value,
      amount: featureId.value === 'lay-on-hands' ? amount.value : 1,
      purify: featureId.value === 'lay-on-hands' && purify.value,
      targetId: featureSelf(featureId.value)
        ? actor.value.id
        : featureId.value === 'breath'
          ? (featureTargets.value[0] ?? '')
          : target.value,
      targets: featureId.value === 'breath' ? featureTargets.value : undefined,
      env: defaultEnvironment(),
      note: note.value,
    },
    true,
    '特性：' + feature.value.name,
  )
}
function areaCandidates(feature = false) {
  if (!props.view.scene) return
  const ids = templateCandidates(props.view.scene)
    .map((t) => t.actorId)
    .filter((id): id is string => !!id && !!battle.value?.actors.some((a) => a.id === id))
  if (feature) featureTargets.value = ids
  else selected.value = ids
}
watch(
  () => props.preset,
  async (p, _, cleanup) => {
    if (!p) return
    let alive = true
    cleanup(() => (alive = false))
    if (p.kind === 'feature') {
      featureId.value = p.key
      note.value = ''
    }
    if (p.kind === 'cast') spellKey.value = p.key
    else if (p.kind === 'attack' && p.key) attackId.value = p.key
    else if (p.kind === 'item') itemInstanceId.value = p.key
    await nextTick()
    if (!alive) return
    const t = props.view.scene?.tokens.find((t) => t.id === p.target)
    target.value =
      t?.actorId && battle.value?.actors.some((a) => a.id === t.actorId) ? t.actorId : ''
  },
  { immediate: true },
)
const attackChoices = computed(() =>
  attackFeatureOptions(
    character.value,
    actor.value?.turn,
    attacks.value.find((a) => a.id === attackId.value),
  ),
)
</script>

<template>
  <section class="room-card player-combat">
    <h2>{{ localizedEntryName(battle) ?? controlText('expressionTwo.noCurrentEncounter') }}</h2>
    <p v-if="battle">{{ controlText('liveSummary.round', {p0:(battle.round),p1:(active ? controlText('expressionTwo.inCombat') : battle.phase === 'setup' ? controlText('expressionTwo.preparing') : controlText('expressionOne.ended')),p2:(battle.pending ? controlText('expressionTwo.awaitingGmResolution') : controlText('expressionTwo.actionSubmissionAvailable'))}) }}
    </p>
    <label
      >{{ controlText('domain.actingCharacter') }}<select v-model="characterId" :disabled="lockCharacter" :aria-label="controlText('domain.actingCharacter')">
        <option v-for="c in view.ownCharacters" :key="c.id" :value="c.id">
          {{ localizedEntryName(c.build) }}
        </option>
      </select></label
    >
    <p v-if="!actor" class="muted">
      {{ controlText('combat.notInEncounter') }}
    </p>
    <template v-if="actor && state">
      <section
        v-for="r in openings"
        :key="r.id"
        class="room-combat-notice"
        :aria-label="controlText('combat.confirmedActive')"
      >
        <strong>{{ controlText('liveSummary.confirmedProactiveAction', {p0:(r.reason)}) }}</strong>
        <p>
          {{
            openingError(r) ||
            (openingPending(r.id)
              ? controlText('expressionTwo.waitingForGmReviewOfActionConditions')
              : ownTurn
                ? controlText('expressionTwo.yourTurnReconfirmTheOriginalAction')
                : controlText('expressionTwo.awaitingYourInitiativeTurnResourcesAreNotSpent'))
          }}
        </p>
        <button
          class="primary"
          :disabled="!canStart || !!openingError(r) || openingPending(r.id)"
          @click="executeOpening(r)"
        >
          {{ controlText('combat.executeActive') }}
        </button>
      </section>
      <div v-if="active" class="room-combat-notice" :aria-label="controlText('controls.turnEnd')">
        <strong
          >{{ controlText('liveSummary.currentActor', {p0:(localizedEntryName(battle?.actors.find((a) => a.id === battle?.currentId)) ?? controlText('expressionTwo.notPublic'))}) }}</strong
        >
        <button
          class="primary"
          :disabled="busy || !!endTurnBlock"
          @click="
            run(
              {
                type: 'end-turn',
                actorId: actor.id,
                encounterId: battle!.id,
                expectedTick: battle!.tick,
              },
              false,
              '结束我的回合',
            )
          "
        >
          {{ controlText('controls.turnEnd') }}
        </button>
        <p v-if="endTurnBlock" class="small muted">{{ displayFeedback(endTurnBlock,'info') }}</p>
        <p v-else class="small muted">{{ controlText('combat.turnHelp') }}</p>
      </div>
      <HasteActions v-if="actor" :actor-id="actor.id" :enabled="state?.effects.some(f=>f.key==='haste')??false" :used="actor.turn?.manualUsed?.includes('haste-action')??false" :disabled="!canStart" @command="cmd=>emit('execute',cmd,true,'加速动作')" />
      <div class="room-budget" :aria-label="controlText('combat.myBudget')">
        <strong>{{ ownTurn ? controlText('expressionTwo.yourTurn') : controlText('expressionTwo.waitingForYourTurnReactionsAreHandledSeparately') }}</strong>
        <span
          v-for="k in ['action', 'bonus', 'reaction'] as const"
          :key="k"
          :class="{ spent: !actor.turn?.[k] }"
          >{{ uiLabel(COST_NAMES[k]) }} {{ actor.turn?.[k] ? controlText('controls.enabledState') : controlText('controls.usedState') }}</span
        >
        <span>{{ controlText('combat.movementUsed') }} {{ actor.movement }} {{ controlText('game.feet') }}</span
        ><span v-if="actor.slotSpent">{{ controlText('combat.slotCastUsed') }}</span>
      </div>
      <p>
        {{ controlText('liveSummary.temporaryHp', {p0:(controlText('domain.hp')),p1:(state.hp),p2:(derived?.hp),p3:(state.temporaryHp),p4:(conditionNames)}) }}
      </p>
      <section
        v-if="state.hp === 0 || state.concentration"
        class="room-combat-notice"
        :aria-label="controlText('combat.woundsConcentration')"
      >
        <label v-if="state.hp === 0 && state.resources.lucky !== undefined" class="check"
          ><input
            v-model="luckyDeath"
            type="checkbox"
            :disabled="!state.resources.lucky"
          />{{ controlText('configurationField.useLuckPointForDeathSaveRemaining') }} {{ state.resources.lucky }}）</label
        >
        <p v-if="state.hp === 0">
          {{ controlText('liveSummary.successesFailures', {p0:(controlText('controls.deathSave')),p1:(state.death.successes),p2:(state.death.failures),p3:(state.death.dead ? controlText('state.dead') : state.death.stable ? controlText('expressionTwo.stable') : controlText('expressionTwo.notStable'))}) }}
        </p>
        <button
          v-if="state.hp === 0"
          class="secondary"
          :disabled="
            busy ||
            !active ||
            !ownTurn ||
            battle?.pending ||
            actor.turn?.deathSaveDone ||
            state.death.stable ||
            state.death.dead
          "
          @click="
            run({ type: 'death-save', actorId: actor.id, lucky: luckyDeath }, false, '死亡豁免')
          "
        >
          {{ controlText('domain.deathSave') }}
        </button>
        <p v-if="state.concentration">{{ controlText('liveSummary.concentration', {p0:(localizedEntryName(content.spells.find((s) => s.id === state!.concentration!.spellId)) ??
            state.concentration.spellId),p1:(state.concentration.pendingDC
              ? controlText('expressionTwo.constitutionSavePendingDc') + state.concentration.pendingDC
              : '')}) }}
        </p>
        <button
          v-if="state.concentration?.pendingDC"
          class="secondary"
          :disabled="busy || !active || battle?.pending"
          @click="run({ type: 'concentration', actorId: actor.id }, false, '专注豁免')"
        >
          {{ controlText('game.resolveConcentration') }}
        </button>
        <button
          v-if="state.concentration"
          class="subtle"
          :disabled="busy || !active"
          @click="run({ type: 'end-concentration', actorId: actor.id }, false, '自愿结束专注')"
        >
          {{ controlText('combat.endOwnConcentration') }}
        </button>
      </section>
      <section v-if="pending" class="room-combat-notice" :aria-label="controlText('combat.reactionWindow')">
        <h3>{{ controlText('liveSummary.reactionAndInspirationWindow', {p0:(localizedEntryName(pending))}) }}</h3>
        <p>{{ controlText('combat.reactionHelp') }}</p>
        <label
          v-if="
            pending.kind === 'attack' &&
            pending.actorId === actor.id &&
            !pending.damageRolled &&
            pending.tavernRerollAvailable
          "
          class="check"
          ><input v-model="tavernReroll" type="checkbox" />{{ controlText('combat.tavernReroll') }}</label
        >
        <button
          v-if="pending.kind === 'attack' && pending.actorId === actor.id && !pending.damageRolled"
          :disabled="busy"
          @click="
            run(
              {
                type: 'damage-roll',
                actorId: actor.id,
                tavernReroll: pending.tavernRerollAvailable === true && tavernReroll,
              },
              true,
              '申请掷攻击伤害并保留命中特性窗口',
            )
          "
        >
          {{ controlText('combat.requestDamage') }}
        </button>
        <p v-if="pending.damageRolled">{{ controlText('combat.damageRolledHelp') }}</p>
        <p
          v-if="pending.damageRolled && pending.actorId === actor.id && pending.damageDice?.length"
        >{{ controlText('liveSummary.damageDiceRolled', {p0:(pending.damageDice.map((die) => die.value).join(', '))}) }}</p>
        <p v-for="(reroll, index) in pending.damageRerolls ?? []" :key="index">{{ controlText('liveSummary.target', {p0:(reroll.targetIndex + 1),p1:(damageRerollCaption(reroll))}) }}
        </p>
        <div
          v-for="t in pending.targets.filter((t) => t.id === actor?.id)"
          :key="t.index"
          class="room-row"
        >
          <span v-if="t.defense"
            >{{ controlText('liveSummary.defenseApprovedDamageReduction', {p0:(t.index + 1),p1:(uiLabel(DEFENSE_NAMES[t.defense.kind])),p2:(t.defense.reduction)}) }}</span
          >
          <template v-else-if="actor.turn?.reaction"
            ><small
              v-if="pending.kind === 'attack' && !pending.damageRolled && t.defenseChoices?.length"
              >{{ controlText('combat.waitDamage') }}</small
            >
            <button
              v-if="t.defenseChoices?.includes('uncanny')"
              :disabled="busy || (pending.kind === 'attack' && !pending.damageRolled)"
              @click="
                run(
                  {
                    type: 'reaction-defense',
                    actorId: actor.id,
                    targetIndex: t.index,
                    kind: 'uncanny',
                  },
                  true,
                  '申请诡异闪避',
                )
              "
            >
              {{ controlText('combat.uncannyDodge') }}
            </button>
            <button
              v-if="t.defenseChoices?.includes('deflect')"
              :disabled="busy || (pending.kind === 'attack' && !pending.damageRolled)"
              @click="
                run(
                  {
                    type: 'reaction-defense',
                    actorId: actor.id,
                    targetIndex: t.index,
                    kind: 'deflect',
                  },
                  true,
                  '申请偏转攻击',
                )
              "
            >
              {{ controlText('combat.deflectAttack') }}
            </button>
            <button
              v-if="t.defenseChoices?.includes('stone')"
              :disabled="busy || (pending.kind === 'attack' && !pending.damageRolled)"
              @click="
                run(
                  {
                    type: 'reaction-defense',
                    actorId: actor.id,
                    targetIndex: t.index,
                    kind: 'stone',
                  },
                  true,
                  '申请石之坚韧',
                )
              "
            >
              {{ controlText('combat.stoneEndurance') }}
            </button>
          </template>
        </div>
        <div v-if="pending.actorId === actor.id" class="room-row">
          <template v-for="t in pending.targets" :key="t.index">
            <button
              v-if="
                character?.build.classId === 'monk' &&
                (character?.level ?? 0) >= 5 &&
                pending.kind === 'attack'
              "
              :disabled="busy || !note.trim()"
              @click="
                run(
                  {
                    type: 'trigger-feature',
                    actorId: actor.id,
                    targetIndex: t.index,
                    id: 'stun',
                    note,
                  },
                  true,
                  '申请震慑打击',
                )
              "
            >{{ controlText('liveSummary.stunningStrikeEntry', {p0:(t.index + 1)}) }}</button>
            <button
              v-if="character?.build.choices.metamagic?.includes('seeking') && t.failed"
              :disabled="busy"
              @click="
                run(
                  {
                    type: 'spell-reroll',
                    actorId: actor.id,
                    kind: 'seeking',
                    targetIndex: t.index,
                    diceIndices: [],
                  },
                  false,
                  '追踪法术重掷',
                )
              "
            >{{ controlText('liveSummary.seekingSpellEntry', {p0:(t.index + 1)}) }}</button>
          </template>
          <template
            v-if="
              character?.build.choices.metamagic?.includes('empowered') &&
              pending.damageDice?.length
            "
          >
            <label v-for="d in pending.damageDice" :key="d.index" class="check"
              ><input v-model="empoweredDice" type="checkbox" :value="d.index" />{{ controlText('combat.damageDice') }}
              {{ d.index + 1 }}：{{ d.value }}</label
            >
            <button
              :disabled="busy || !empoweredDice.length"
              @click="
                run(
                  {
                    type: 'spell-reroll',
                    actorId: actor.id,
                    kind: 'empowered',
                    targetIndex: 0,
                    diceIndices: empoweredDice,
                  },
                  false,
                  '强效法术重掷',
                )
              "
            >
              {{ controlText('combat.empoweredReroll') }}
            </button>
          </template>
        </div>
        <div v-if="shieldEligible && shieldGrants.length" class="room-row">
          <label
            >{{ controlText('domain.shieldSource') }}<select v-model="shieldKey" :aria-label="controlText('domain.shieldSource')">
              <option v-for="g in shieldGrants" :key="g.key" :value="g.key">
                {{ localizedEntryName(g.spell) }} · {{ g.source }}
              </option>
            </select></label
          >
          <label
            >{{ controlText('domain.reactionCast') }}<select v-model="shieldMode" :aria-label="controlText('domain.reactionCast')">
              <option v-for="m in shieldGrant?.modes" :key="m" :value="m">
                {{ uiLabel(MODE_NAMES[m]) ?? m }}
              </option>
            </select></label
          >
          <button
            class="primary"
            :disabled="busy || !shieldGrant || (shieldMode === 'slot' && actor.slotSpent)"
            @click="
              run(
                {
                  type: 'reaction-shield',
                  actorId: actor.id,
                  key: shieldKey,
                  mode: shieldMode,
                  requirementsConfirmed: false,
                },
                true,
                '反应：护盾术',
              )
            "
          >
            {{ controlText('combat.shieldReaction') }}
          </button>
        </div>
        <div v-for="t in ownRolls" :key="t.index" class="room-own-roll">
          <p>{{ controlText('liveSummary.myDCurrentTotal', {p0:(pending.kind === 'attack' ? controlText('controls.attack') : controlText('controls.saveThrow')),p1:(t.roll?.dice.join(', ')),p2:(t.roll?.total),p3:(t.failed ? controlText('controls.failed') : controlText('controls.success'))}) }}
          </p>
          <button
            v-if="state.heroicInspiration"
            class="secondary"
            :disabled="busy || t.roll?.autoFail"
            @click="
              run(
                { type: 'inspiration', actorId: actor.id, targetIndex: t.index, kind: 'heroic' },
                false,
                '使用英雄激励',
              )
            "
          >
            {{ controlText('combat.heroicReroll') }}
          </button>
          <button
            v-if="bardic"
            class="secondary"
            :disabled="busy || !t.failed || t.roll?.autoFail"
            @click="
              run(
                { type: 'inspiration', actorId: actor.id, targetIndex: t.index, kind: 'bardic' },
                false,
                '使用吟游激励',
              )
            "
          >
            {{ controlText('combat.bardicAdd') }}
          </button>
        </div>
        <p v-if="!ownRolls.length && !shieldEligible" class="muted">
          {{ controlText('combat.noReactions') }}
        </p>
      </section>
      <label
        >{{ controlText('controls.target') }}<MapFieldPicker kind="entity"><select v-model="target" :aria-label="controlText('controls.target')">
          <option value="">{{ controlText('domain.publicTarget') }}</option>
          <option v-for="a in battle?.actors" :key="a.id" :value="a.id">{{ a.id==='unarmed'?controlText('confirmation.unarmedStrike'):localizedEntryName(a) }}</option>
        </select></MapFieldPicker></label
      >
      <details
        v-if="
          character &&
          (((character?.level ?? 0) >= 2 && character?.build.classId === 'sorcerer') ||
            ((character?.level ?? 0) >= 5 && ['druid', 'bard'].includes(character?.build.classId)))
        "
      >
        <summary>{{ controlText('combat.conversionReview') }}</summary>
        <label
          >{{ controlText('game.featureConversion') }}<select v-model="conversion" :aria-label="controlText('game.combatConversion')">
            <template v-if="character?.build.classId === 'sorcerer'"
              ><option value="font-slot">{{ controlText('game.createSlots') }}</option>
              <option value="font-points">{{ controlText('game.slotsToPoints') }}</option></template
            ><template v-if="character?.build.classId === 'druid' && (character?.level ?? 0) >= 5"
              ><option value="wild-resurgence">{{ controlText('game.slotToWild') }}</option>
              <option value="wild-slot">{{ controlText('game.wildToSlot') }}</option></template
            >
            <option v-if="character?.build.classId === 'bard'" value="font-inspiration">
              {{ controlText('game.fontInspiration') }}
            </option>
          </select></label
        ><label
          >{{ controlText('game.conversionLevel') }}<select v-model.number="conversionLevel" :aria-label="controlText('game.combatConversionLevel')">
            <option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ controlText('quantity.spellLevel', {p0:(l)}) }}</option>
          </select></label
        ><button
          class="secondary"
          :disabled="!canStart"
          @click="
            run(
              {
                type: 'convert',
                actorId: actor.id,
                command: { type: 'recover', id: conversion, slotLevel: conversionLevel },
              },
              true,
              '特性资源转换',
            )
          "
        >
          {{ controlText('combat.requestConversion') }}
        </button>
      </details>
      <section
        v-if="character?.build.classId === 'druid' && (character?.level ?? 0) >= 2"
        class="room-combat-block"
      >
        <h3>{{ controlText('combat.wildCompanions') }}</h3>
        <p v-if="state.wildShape">{{ controlText('liveSummary.currentBeastForm', {p0:(localizedEntryName(beast(state.wildShape.formId))),p1:(controlText('combat.mergedEquipment'))}) }}
        </p>
        <label
          >{{ controlText('combat.beastForm') }}<select v-model="beastId" :aria-label="controlText('combat.playerBeastForm')">
            <option v-for="id in state.knownBeasts" :key="id" :value="id">
              {{ localizedEntryName(beast(id)) }}
            </option>
          </select></label
        >
        <button
          :disabled="!canStart || !note.trim()"
          @click="
            run(
              { type: 'wild-shape', actorId: actor.id, formId: beastId, note },
              true,
              '申请荒野形态',
            )
          "
        >
          {{ controlText('combat.requestWildShape') }}
        </button>
        <button
          v-if="state.wildShape"
          :disabled="!canStart || !note.trim()"
          @click="
            run({ type: 'wild-shape', actorId: actor.id, formId: '', note }, true, '结束荒野形态')
          "
        >
          {{ controlText('combat.endWildShape') }}
        </button>
        <label
          >{{ controlText('game.companionForm') }}<select v-model="familiarId" :aria-label="controlText('combat.playerCompanionForm')">
            <option v-for="b in BEASTS.filter((b) => b.cr === 0)" :key="b.id" :value="b.id">
              {{ localizedEntryName(b) }}
            </option>
          </select></label
        >
        <button
          :disabled="!canStart || !note.trim()"
          @click="
            run(
              {
                type: 'wild-companion',
                actorId: actor.id,
                formId: familiarId,
                mode: 'wild-shape',
                note,
              },
              true,
              '申请荒野伙伴',
            )
          "
        >
          {{ controlText('combat.wildCompanion') }}
        </button>
      </section>
      <div class="room-combat-grid">
        <section class="room-combat-block">
          <h3>{{ controlText('combat.weaponsActions') }}</h3>
          <p v-if="actor.turn?.attacksLeft">{{ controlText('liveSummary.attacks', {p0:(controlText('combat.remainingAttacks')),p1:(actor.turn.attacksLeft)}) }}</p>
          <label
            >{{ controlText('controls.attack') }}<select v-model="attackId" :aria-label="controlText('controls.attack')">
              <option v-for="a in attacks" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
            </select></label
          >
          <AttackMethodPicker
            v-model="cost"
            v-model:available="attackAllowed"
            :context="attackContext"
            :busy="busy"
            @activate-flurry="activateFlurry"
          />
          <UnarmedOptions
            v-if="character"
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
                run({ type: 'grapple-release', actorId: actor!.id, targetId }, false, '释放擒抱')
            "
            @escape="
              (sourceId) =>
                run(
                  {
                    type: 'grapple-escape',
                    actorId: actor!.id,
                    sourceId,
                    skill: escapeSkill,
                    env: defaultEnvironment(),
                  },
                  false,
                  '动作挣脱擒抱',
                )
            "
          />
          <WeaponHandlingPicker
            v-if="character"
            v-model="handling"
            :character="character"
            :content="content"
            :busy="busy || !!battle?.pending"
            :cost="cost"
          />
          <AttackFeatureFields
            v-model:sneak="sneak"
            v-model:mastery="mastery"
            :character="character"
            :turn="actor?.turn"
            :attack="attacks.find((a) => a.id === attackId)"
            :busy="busy || !!battle?.pending"
          />
          <button
            class="primary"
            :disabled="
              busy ||
              !canAct ||
              battle?.pending ||
              !target ||
              !attackId ||
              !attackAllowed ||
              (cost === 'opportunity' ? !actor.turn?.reaction : !canStart) ||
              (cost === 'action' && !actor.turn?.action && !(actor.turn?.attacksLeft ?? 0)) ||
              (['light', 'martial'].includes(cost) && !actor.turn?.bonus)
            "
            @click="attack"
          >
            {{ controlText('combat.submitAttack') }}
          </button>
          <div class="room-row room-quick-actions">
            <button
              v-for="a in ['dash', 'disengage', 'dodge', 'extinguish'] as const"
              :key="a"
              class="secondary"
              :disabled="!canStart || !actor.turn?.action"
              @click="
                run(
                  { type: 'action', actorId: actor.id, action: a, note: '' },
                  false,
                  ACTION_NAMES[a],
                )
              "
            >
              {{ uiLabel(ACTION_NAMES[a]) }}
            </button>
            <button
              class="secondary"
              :disabled="!canStart || !actor.turn?.action || !target"
              @click="
                run(
                  {
                    type: 'wake',
                    actorId: actor.id,
                    targetId: target,
                    env: defaultEnvironment(),
                    note: '动作唤醒睡眠／催眠图纹目标',
                  },
                  true,
                  '动作唤醒',
                )
              "
            >
              {{ controlText('combat.wakeAction') }}
            </button>
          </div>
          <details>
            <summary>{{ controlText('combat.damageItemReview') }}</summary>
            <label
              >{{ controlText('combat.damageItem') }}<select v-model="itemInstanceId">
                <option value="">{{ controlText('game.choose') }}</option>
                <option v-for="r in damageItems" :key="r.instanceId" :value="r.instanceId">
                  {{ itemName(r.itemId) }} × {{ r.quantity }}
                </option>
              </select></label
            >
            <p class="small muted">
              {{ controlText('combat.damageItemHelp') }}
            </p>
            <button
              class="secondary"
              :disabled="!canStart || !itemInstanceId || !target"
              @click="
                run(
                  {
                    type: 'item-use',
                    actorId: actor.id,
                    targetId: target,
                    instanceId: itemInstanceId,
                    env: defaultEnvironment(),
                    note: note || '投掷伤害物品',
                  },
                  true,
                  '使用伤害物品',
                )
              "
            >
              {{ controlText('combat.submitItem') }}
            </button>
          </details>
        </section>
        <PlayerCompanionPanel
          :view="view"
          :owner-id="actor.id"
          :busy="busy"
          @execute="(c) => emit('execute', c, true, '伙伴操作申请')"
        />
        <section class="room-combat-block">
          <h3>{{ controlText('combat.spellIntent') }}</h3>
          <p v-if="!grants.length" class="muted">{{ controlText('combat.noAvailableSpells') }}</p>
          <template v-else>
            <label v-if="character?.build.choices.subclass?.includes('wild-magic')" class="check"
              ><input
                v-model="wildCheck"
                type="checkbox"
              />{{ controlText('combat.requestWildMagic') }}</label
            >
            <label v-if="grant?.spell.id.startsWith('summon-')"
              >{{ controlText('game.spirit') }}<select v-model="summonForm" :aria-label="controlText('game.spirit')">
                <option value="">{{ controlText('game.choose') }}</option>
                <option
                  v-for="f in grant.spell.id === 'summon-beast'
                    ? ['air', 'land', 'water']
                    : grant.spell.id === 'summon-fey'
                      ? ['fuming', 'mirthful', 'tricksy']
                      : ['ghostly', 'putrid', 'skeletal']"
                  :key="f"
                  :value="f"
                >
                  {{ uiLabel(SUMMON_FORM_NAMES[f]) ?? f }}
                </option>
              </select></label
            >
            <label
              >{{ controlText('controls.spells') }}<select v-model="spellKey" :aria-label="controlText('controls.spells')">
                <option v-for="g in grants" :key="g.key" :value="g.key">
                  {{ localizedEntryName(g.spell) }} · {{ g.source }}
                </option>
              </select></label
            >
            <label
              >{{ controlText('domain.castMethod') }}<select v-model="mode" :aria-label="controlText('domain.castMethod')">
                <option v-for="m in grant?.modes" :key="m" :value="m">
                  {{ uiLabel(MODE_NAMES[m]) ?? m }}
                </option>
              </select></label
            >
            <p v-if="grant" class="muted">
              {{ spellPresentation(grant.spell).castingTime }} · {{ spellPresentation(grant.spell).range }} ·
              {{ spellPresentation(grant.spell).components }} · {{ sourceCaption(grant.spell.source) }}
            </p>
            <label v-if="grant?.spell.id === 'arcane-vigor'"
              >{{ controlText('game.arcaneVigor') }}<input
                v-model.number="vigorDice"
                type="number"
                min="1"
                max="3"
                :aria-label="controlText('game.arcaneVigor')"
            /></label>
            <MetamagicFields
              v-model="metamagic"
              :character="character"
              :targets="battle?.actors ?? []"
            />
            <label v-if="grant?.spell.id === 'cordon-of-arrows'"
              >{{ controlText('game.cordonAmmo') }}<select v-model="ammoId" :aria-label="controlText('game.cordonAmmo')">
                <option value="">{{ controlText('game.choose') }}</option>
                <option
                  v-for="row in character?.inventory.filter((x) =>
                    ['arrow', 'bolt'].includes(x.itemId),
                  )"
                  :key="row.instanceId"
                  :value="row.instanceId"
                >
                  {{ row.itemId === 'arrow' ? controlText('expressionOne.arrows') : controlText('expressionOne.bolts') }} ×{{ row.quantity }}
                </option>
              </select></label
            >
            <label v-if="grant?.spell.id === 'cordon-of-arrows'"
              >{{ controlText('game.fixedAmmo') }}<input
                v-model.number="ammoCount"
                type="number"
                min="1"
                :max="4 + Math.max(0, castSlotLevel(mode) - 2) * 2"
                :aria-label="controlText('game.fixedAmmo')"
            /></label>
            <fieldset
              v-if="['spirit-guardians', 'cordon-of-arrows'].includes(grant?.spell.id ?? '')"
            >
              <legend>{{ controlText('combat.guardiansExclusions') }}</legend>
              <MapTargetsButton v-model="excludedIds" :items="(battle?.actors) ?? []" /><label v-for="a in battle?.actors" :key="a.id" class="check"
                ><input v-model="excludedIds" type="checkbox" :value="a.id" />{{ localizedEntryName(a) }}</label
              >
            </fieldset>
            <SpellAreaPicker
              :background="background"
              v-if="view.scene && grant && actor"
              :scene="view.scene"
              :caster-id="view.scene.tokens.find((t) => t.actorId === actor?.id)?.id ?? ''"
              :spell="grant.spell"
              :busy="busy"
              :revision="view.worldRevision"
              :allowed-ids="
                view.scene.tokens
                  .filter((t) => battle?.actors.some((a) => a.id === t.actorId))
                  .map((t) => t.id)
              "
              @apply="applySpellArea"
              @clear="areaTemplate = undefined"
            />
            <p v-if="policy?.self">{{ controlText('game.selfTarget') }}</p>
            <template v-else-if="policy?.darts"
              ><label v-for="(_, i) in darts" :key="i"
                >{{ controlText('game.projectile') }} {{ i + 1 }} {{ controlText('controls.target') }}<MapFieldPicker kind="entity"><select
                  v-model="darts[i]"
                  :aria-label="controlText('expressionTwo.missile') + (i + 1) + controlText('expressionTwo.target')"
                >
                  <option value="">{{ controlText('combat.repeatTargets') }}</option>
                  <option v-for="a in battle?.actors" :key="a.id" :value="a.id">
                    {{ localizedEntryName(a) }}
                  </option>
                </select></MapFieldPicker></label
              ></template
            >
            <fieldset v-else-if="(policy?.max ?? 1) > 1" class="room-targets">
              <legend>
                {{ controlText('liveSummary.selectedEntry87', {p0:(policy?.area ? controlText('expressionTwo.areaCandidates') : controlText('expressionTwo.spellTargets')),p1:(selected.length),p2:(policy?.max)}) }}
              </legend>
              <MapTargetsButton v-model="selected" :max="policy?.max" :items="(battle?.actors) ?? []" /><label v-for="a in battle?.actors" :key="a.id" class="check"
                ><input v-model="selected" type="checkbox" :value="a.id" />{{ localizedEntryName(a) }}</label
              ><button
                v-if="policy?.area"
                class="subtle"
                :disabled="!view.scene?.template"
                @click="areaCandidates()"
              >
                {{ controlText('domain.gmAreaCandidate') }}
              </button>
            </fieldset>
            <label
              v-if="
                ['true-strike', 'shillelagh', 'magic-weapon', 'elemental-weapon'].includes(
                  grant?.spell.id ?? '',
                )
              "
              >{{ controlText('domain.spellWeapon') }}<select v-model="weaponId" :aria-label="controlText('domain.spellWeapon')">
                <option
                  v-for="a in spellWeapons"
                  :key="a.id"
                  :value="
                    ['magic-weapon', 'elemental-weapon'].includes(grant?.spell.id ?? '')
                      ? a.instanceId!
                      : a.id
                  "
                >
                  {{ localizedEntryName(a) }}
                </option>
              </select></label
            >
            <SupportSpellFields v-model:control="controlSelection" :targets="(battle?.actors??[]).map(a=>({id:a.id,name:a.name}))" :selected-ids="castTargets"
              :spell-id="grant?.spell.id"
              v-model:choice="supportChoice"
              v-model:willing="willing"
            />
            <label v-if="damageOptions.length"
              >{{ controlText('domain.spellDamageType') }}<select v-model="damageType" :aria-label="controlText('domain.spellDamageType')">
                <option v-for="t in damageOptions" :key="t" :value="t">
                  {{ damageDisplayName(t)
                  }}{{
                    grant?.spell.id === 'true-strike' && t !== 'radiant'
                      ? controlText('expressionTwo.useSelectedWeaponSOriginalType')
                      : ''
                  }}
                </option>
              </select></label
            >
            <details v-if="grant">
              <summary>{{ controlText('combat.spellScope') }}</summary>
              <p class="spell-description">{{ spellPresentation(grant.spell).description }}</p>
              <p>{{ spellEffect(grant.spell.id).note }}</p>
              <p v-if="policy?.manual">{{ controlText('combat.complexSpellHelp') }}</p>
            </details>
            <p v-if="policy?.area" class="muted">
              {{ controlText('combat.templateCandidatesHelp') }}
            </p>
            <p v-if="slotBlocked || longCasting" class="error-text">
              {{
                slotBlocked
                  ? controlText('expressionTwo.aSpellSlotWasAlreadySpentThisTurn')
                  : controlText('expressionTwo.handleRitualsAndLongCastingOutsideCombat')
              }}
            </p>
            <button
              class="secondary"
              :disabled="!canCast || !hasTargets || grant?.spell.id === 'shield'"
              @click="cast"
            >
              {{ controlText('combat.submitCastIntent') }}
            </button>
            <p v-if="grant?.spell.id === 'shield'" class="muted">{{ controlText('combat.shieldHelp') }}</p>
          </template>
        </section>
        <AdvancedPanel
          v-if="character && actor"
          :character="character"
          :content="content"
          :actor-id="actor.id"
          :targets="battle?.actors ?? []"
          :pending-count="battle?.pendingAction?.targets.length"
          :own-turn="ownTurn"
          :busy="busy"
          :review="true"
          @combat="emit('execute', $event, true, '专长与子职业能力裁定')"
        />
        <OriginCombatPanel
          v-if="actor"
          :character="character"
          :content="content"
          :actor-id="actor.id"
          :actors="battle?.actors ?? []"
          :current-id="battle?.currentId ?? ''"
          :pending="battle?.pendingAction"
          :env="view.environment"
          :busy="busy"
          @execute="(command) => emit('execute', command, true, '起源与战斗风格能力申请')"
        />
        <section class="room-combat-block">
          <h3>{{ controlText('combat.classSpeciesFeatures') }}</h3>
          <p v-if="!features.length" class="muted">
            {{ controlText('combat.noCountFeatures') }}
          </p>
          <template v-else>
            <label
              >{{ controlText('domain.trait') }}<select v-model="featureId" :aria-label="controlText('domain.trait')">
                <option v-for="f in features" :key="f.id" :value="f.id">
                  {{ localizedEntryName(f)
                  }}{{
                    f.id.startsWith('growth/')
                      ? controlText('expressionOne.stepByStepGmRulingAlias38')
                      : ' · ' + (state.resources[f.id] ?? 0) + ' / ' + f.max
                  }}
                </option>
              </select></label
            >
            <p>{{ feature?.detail }} · SRD p.{{ feature?.page }}</p>
            <p v-if="featureSelf(featureId)">{{ controlText('game.selfTarget') }}</p>
            <template v-if="featureId === 'lay-on-hands'"
              ><label class="check"
                ><input v-model="purify" type="checkbox" />{{ controlText('combat.layRemovePoison') }}</label
              ><label v-if="!purify"
                >{{ controlText('combat.layPoints') }}<input
                  v-model.number="amount"
                  type="number"
                  min="1"
                  :max="state.resources[featureId] ?? 0" /></label
            ></template>
            <fieldset v-if="featureId === 'breath'" class="room-targets">
              <legend>{{ controlText('combat.breathCandidates') }}</legend>
              <MapTargetsButton v-model="featureTargets" :items="(battle?.actors) ?? []" /><label v-for="a in battle?.actors" :key="a.id" class="check"
                ><input v-model="featureTargets" type="checkbox" :value="a.id" />{{ localizedEntryName(a) }}</label
              ><button
                class="subtle"
                :disabled="!view.scene?.template"
                @click="areaCandidates(true)"
              >
                {{ controlText('domain.gmAreaCandidate') }}
              </button>
            </fieldset>
            <button
              class="secondary"
              :disabled="
                !canStart ||
                (!manualFeature && !(state.resources[featureId] ?? 0)) ||
                (manualFeature?.resource &&
                  (state.resources[manualFeature.resource] ?? 0) < manualFeature.amount) ||
                !(manualFeature
                  ? manualFeature.cost === 'none' || actor.turn?.[manualFeature.cost]
                  : featureId === 'action-surge'
                    ? !actor.turn?.surgeUsed
                    : featureId === 'breath'
                      ? actor.turn?.action || !!actor.turn?.attacksLeft
                      : actor.turn?.bonus) ||
                (featureId === 'lay-on-hands' &&
                  (purify
                    ? (state.resources[featureId] ?? 0) < 5
                    : amount < 1 || amount > (state.resources[featureId] ?? 0))) ||
                (featureId === 'breath'
                  ? !featureTargets.length
                  : !featureSelf(featureId) && !target)
              "
              @click="useFeature"
            >
              {{ controlText('combat.submitFeature') }}
            </button>
          </template>
        </section>
      </div>
      <label
        >{{ controlText('combat.actionBasis') }}<input
          v-model="note"
          maxlength="2000"
          :placeholder="controlText('combat.intentPlaceholder')"
      /></label>
      <p class="muted">
        {{ controlText('combat.intentHelp') }}
      </p>
    </template>
    <ol>
      <li v-for="a in battle?.actors" :key="a.id">
        {{ controlText('liveSummary.initiative', {p0:(a.id === battle?.currentId ? '▶ ' : ''),p1:(localizedEntryName(a)),p2:(a.initiative ?? controlText('expressionTwo.undetermined'))}) }}
      </li>
    </ol>
  </section>
</template>
