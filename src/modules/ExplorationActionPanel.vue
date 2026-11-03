<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {damageDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import RequestDisclosure from './RequestDisclosure.vue'
import { useRequestDisclosure } from './useRequestDisclosure'
import { computed, ref, watch, nextTick } from 'vue'
import type { QuickPreset } from './exploration/quick-preset'
import type { RoomView } from '../online/protocol'
import type { Catalogue } from '../core/engine'
import type { BattleOpening } from '../core/battle-types'
import { explorationAttacks, combatOpeningModes } from '../core/battle-opening'
import { runtimeSpells, castSlotLevel, MODE_NAMES, findItem } from '../core/runtime'
import { spellTargets, spellDamageOptions } from '../online/combat-controls'
import { DAMAGE_NAMES, type DamageType } from '../core/combat-types'
import { SUMMON_FORM_NAMES, spellSummonForms } from '../core/phb-companions'
const props = defineProps<{
  view: RoomView
  content: Catalogue
  busy: boolean
  preset?: QuickPreset
  submitOpening?: (opening: BattleOpening, reason: string) => Promise<boolean>
}>()
const characterId = defineModel<string>('characterId', { required: true })
const emit = defineEmits<{ submit: [opening: BattleOpening, reason: string] }>()
const kind = ref<'attack' | 'cast' | 'item'>('attack'),
  attackId = ref(''),
  key = ref(''),
  mode = ref(''),
  instanceId = ref(''),
  target = ref(''),
  selected = ref<string[]>([]),
  darts = ref<string[]>([]),
  reason = ref(''),
  damageType = ref<DamageType>('fire'),
  weaponId = ref(''),
  hitDice = ref(1),
  summonForm = ref(''),
  sneak = ref(false)
const character = computed(() => props.view.ownCharacters.find((c) => c.id === characterId.value))
const onScene = computed(() =>
  props.view.scene?.tokens.some((t) => t.characterId === characterId.value),
)
const attacks = computed(() =>
  character.value ? explorationAttacks(character.value, props.content) : [],
)
const grants = computed(() =>
  character.value
    ? runtimeSpells(character.value, props.content).filter((g) => combatOpeningModes(g).length)
    : [],
)
const grant = computed(() => grants.value.find((g) => g.key === key.value))
const items = computed(
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
const damageOptions = computed(() =>
  grant.value ? spellDamageOptions(grant.value.spell.id) : ['fire' as DamageType],
)
const policy = computed(() =>
  grant.value
    ? spellTargets(
        grant.value.spell,
        grant.value.key,
        character.value?.level ?? 1,
        castSlotLevel(mode.value) || grant.value.spell.level || 1,
      )
    : null,
)
const tokens = computed(() => props.view.scene?.tokens ?? [])
const ammunitionId = ref(''),
  ammunitionCount = ref(4)
const ammoRows = computed(
  () =>
    character.value?.inventory.filter(
      (r) => ['arrow', 'bolt'].includes(r.itemId) && r.quantity > 0,
    ) ?? [],
)
const targetCharacter = computed(() =>
  props.view.ownCharacters.find(
    (c) => c.id === tokens.value.find((t) => t.id === target.value)?.characterId,
  ),
)
const targetWeapons = computed(
  () =>
    targetCharacter.value?.inventory.filter(
      (r) =>
        r.quantity === 1 &&
        findItem(targetCharacter.value!, props.content, r.itemId)?.kind === 'weapon',
    ) ?? [],
)
watch(
  () => [characterId.value, grants.value.map((g) => g.key).join('|')].join(':'),
  () => {
    key.value = grants.value[0]?.key ?? ''
    attackId.value = attacks.value[0]?.id ?? ''
    instanceId.value = items.value[0]?.instanceId ?? ''
    target.value = ''
    selected.value = []
  },
  { immediate: true },
)
watch(key, () => {
  mode.value = grant.value ? (combatOpeningModes(grant.value)[0] ?? '') : ''
  damageType.value = damageOptions.value[0] ?? 'fire'
  selected.value = []
  darts.value = []
  summonForm.value = ''
  weaponId.value = ''
})
watch(
  () => [key.value, policy.value?.darts ? policy.value.max : 0].join('|'),
  () => {
    const n = policy.value?.darts ? policy.value.max : 0
    darts.value = Array.from({ length: n }, (_, i) => darts.value[i] ?? '')
  },
  { immediate: true },
)
const targetIds = computed(() =>
  kind.value === 'cast' && policy.value?.self
    ? tokens.value.filter((t) => t.characterId === characterId.value).map((t) => t.id)
    : kind.value === 'cast' && policy.value?.darts
      ? darts.value
      : kind.value === 'cast' && (policy.value?.max ?? 1) > 1
        ? selected.value
        : target.value
          ? [target.value]
          : [],
)
const metadataReady = computed(() => {
  if (kind.value !== 'cast' || !grant.value) return true
  const id = grant.value.spell.id
  if (
    ['shillelagh', 'true-strike', 'magic-weapon', 'elemental-weapon'].includes(id) &&
    !weaponId.value
  )
    return false
  if (id === 'cordon-of-arrows' && (!ammunitionId.value || ammunitionCount.value < 1)) return false
  if (id.startsWith('summon-') && !spellSummonForms(id).includes(summonForm.value)) return false
  return (
    targetIds.value.length >= (policy.value?.darts ? policy.value.max : 1) &&
    targetIds.value.length <= (policy.value?.max ?? 1)
  )
})
const valid = computed(
  () =>
    onScene.value &&
    !!character.value &&
    reason.value.trim() &&
    metadataReady.value &&
    targetIds.value.length > 0 &&
    targetIds.value.every((id) => tokens.value.some((t) => t.id === id)) &&
    (kind.value !== 'cast' || (!!grant.value && !!mode.value)) &&
    (kind.value !== 'attack' || !!attackId.value) &&
    (kind.value !== 'item' || !!instanceId.value),
)
async function submit() {
  if (!valid.value) return
  const tokenIds = [...targetIds.value]
  const opening: BattleOpening =
    kind.value === 'attack'
      ? { kind: 'attack', attackId: attackId.value, tokenIds, sneak: sneak.value, mastery: true }
      : kind.value === 'cast'
        ? {
            kind: 'cast',
            key: key.value,
            mode: mode.value,
            tokenIds,
            damageType: damageType.value,
            ...(['shillelagh', 'true-strike', 'magic-weapon', 'elemental-weapon'].includes(
              grant.value?.spell.id ?? '',
            ) && weaponId.value
              ? { weaponId: weaponId.value }
              : {}),
            ...(grant.value?.spell.id === 'cordon-of-arrows' && ammunitionId.value
              ? { ammunition: { instanceId: ammunitionId.value, count: ammunitionCount.value } }
              : {}),
            ...(grant.value?.spell.id === 'arcane-vigor' ? { hitDice: hitDice.value } : {}),
            ...(grant.value?.spell.id.startsWith('summon-') && summonForm.value
              ? { summonForm: summonForm.value }
              : {}),
          }
        : { kind: 'item', instanceId: instanceId.value, tokenIds, note: reason.value.trim() }
  const ticket = disclosure.ticket()
  if (props.submitOpening)
    disclosure.acknowledge(await props.submitOpening(opening, reason.value.trim()), ticket)
  else emit('submit', opening, reason.value.trim())
}
watch(
  () => props.preset,
  async (p, _, cleanup) => {
    if (!p) return
    let alive = true
    cleanup(() => (alive = false))
    if (p.kind === 'feature') return
    kind.value = p.kind
    if (p.kind === 'cast') key.value = p.key
    else if (p.kind === 'attack' && p.key) attackId.value = p.key
    else if (p.kind === 'item') instanceId.value = p.key
    await nextTick()
    if (!alive) return
    target.value = tokens.value.some((t) => t.id === p.target) ? p.target : ''
  },
  { immediate: true },
)
watch(
  () => tokens.value.map((t) => t.id).join('|'),
  () => {
    if (!tokens.value.some((t) => t.id === target.value)) target.value = ''
    selected.value = selected.value.filter((id) => tokens.value.some((t) => t.id === id))
    darts.value = darts.value.map((id) => (tokens.value.some((t) => t.id === id) ? id : ''))
  },
)
const matchingRequests = computed(() =>
  props.view.battleRequests.filter(
    (r) =>
      r.characterId === characterId.value &&
      !!r.opening &&
      (!r.sceneId || r.sceneId === props.view.scene?.id),
  ),
)
const disclosure = useRequestDisclosure(
  () => `${props.view.id}:${props.view.scene?.id}:${characterId.value}`,
  () => matchingRequests.value.length > 0,
)
const requestSummary = computed(() => {
  const r = matchingRequests.value.at(-1)
  return r
    ? `${r.reason.slice(0, 100)} · ${r.status === 'pending' ? '待 GM 确认' : r.status === 'accepted' ? '已确认；执行入口在战斗面板' : '已拒绝'} · ${r.id}`
    : ''
})
</script>

<template>
  <section class="room-card" :aria-label="controlText('domain.activeExploration')">
    <RequestDisclosure
      v-model="disclosure.open.value"
      :title="controlText('domain.activeExploration')"
      :summary="requestSummary"
      :busy="busy"
    >
      <p>
        {{ controlText('adjudication.chooseASpecificActionAndPublicTargetRoll') }}
      </p>
      <label
        >{{ controlText('field.proactiveActionMethod') }}<select v-model="kind">
          <option value="attack">{{ controlText('operations.weaponAttackThrownWeapon') }}</option>
          <option value="cast">{{ controlText('operations.castSpell') }}</option>
          <option value="item">{{ controlText('operations.useThrowItem') }}</option>
        </select></label
      >
      <label v-if="kind === 'attack'"
        >{{ controlText('field.proactiveActionWeapon') }}<select v-model="attackId">
          <option value="">{{ controlText('game.choose') }}</option>
          <option v-for="a in attacks" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
        </select></label
      >
      <label v-if="kind === 'attack' && character?.build.classId === 'rogue'" class="check"
        ><input v-model="sneak" type="checkbox" />{{ controlText('field.requestSneakAttackDamageClassConditionsStillApply') }}</label
      >
      <template v-if="kind === 'cast'">
        <label
          >{{ controlText('field.proactiveActionSpell') }}<select v-model="key">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="g in grants" :key="g.key" :value="g.key">
              {{ localizedEntryName(g.spell) }} · {{ g.source }}
            </option>
          </select></label
        >
        <label
          >{{ controlText('field.proactiveCastingMethod') }}<select v-model="mode">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="m in grant ? combatOpeningModes(grant) : []" :key="m" :value="m">
              {{ uiLabel(MODE_NAMES[m]) ?? m }}
            </option>
          </select></label
        >
        <label v-if="damageOptions.length > 1"
          >{{ controlText('field.proactiveActionDamageType') }}<select v-model="damageType">
            <option v-for="d in damageOptions" :key="d" :value="d">{{ damageDisplayName(d) }}</option>
          </select></label
        >
        <label v-if="['shillelagh', 'true-strike'].includes(grant?.spell.id ?? '')"
          >{{ controlText('field.proactiveActionSpellWeapon') }}<select v-model="weaponId">
            <option value="">{{ controlText('game.choose') }}</option>
            <option
              v-for="a in attacks.filter(
                (a) =>
                  a.weaponId &&
                  (grant?.spell.id !== 'shillelagh' ||
                    ['club', 'quarterstaff'].includes(a.weaponId)),
              )"
              :key="a.id"
              :value="a.id"
            >
              {{ localizedEntryName(a) }}
            </option>
          </select></label
        >
        <label v-if="grant?.spell.id === 'arcane-vigor'"
          >{{ controlText('field.proactiveActionHitDiceCount') }}<input v-model.number="hitDice" type="number" min="1" max="3"
        /></label>
        <label v-if="grant?.spell.id.startsWith('summon-')"
          >{{ controlText('field.proactiveActionSpiritForm') }}<select v-model="summonForm">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="id in spellSummonForms(grant.spell.id)" :key="id" :value="id">
              {{ uiLabel(SUMMON_FORM_NAMES[id]) }}
            </option>
          </select></label
        >
        <template v-if="grant?.spell.id === 'cordon-of-arrows'"
          ><label
            >{{ controlText('field.proactiveActionAmmunition') }}<select v-model="ammunitionId">
              <option value="">{{ controlText('game.choose') }}</option>
              <option v-for="r in ammoRows" :key="r.instanceId" :value="r.instanceId">
                {{ itemName(r.itemId) }} × {{ r.quantity }}
              </option>
            </select></label
          ><label
            >{{ controlText('field.proactiveActionAmmunitionQuantity') }}<input
              v-model.number="ammunitionCount"
              type="number"
              min="1"
              :max="4 + 2 * Math.max(0, (castSlotLevel(mode) || 2) - 2)" /></label
        ></template>
      </template>
      <template v-if="kind === 'item'">
        <label
          >{{ controlText('field.proactiveActionItem') }}<select v-model="instanceId">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="r in items" :key="r.instanceId" :value="r.instanceId">
              {{ itemName(r.itemId) }} × {{ r.quantity }}
            </option>
          </select></label
        >
        <p class="small muted">
          {{ controlText('adjudication.acidAlchemistSFireAndHolyWaterUse') }}
        </p>
      </template>
      <p v-if="kind === 'cast' && policy?.self">{{ controlText('operations.thisSpellAffectsTheActingCharacter') }}</p>
      <template v-else-if="kind === 'cast' && policy?.darts">
        <label v-for="(_, i) in darts" :key="i"
          >{{ controlText('field.proactiveActionMissiles') }} {{ i + 1 }} {{ controlText('controls.target') }}<select v-model="darts[i]">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="t in tokens" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
          </select></label
        >
      </template>
      <fieldset v-else-if="kind === 'cast' && (policy?.max ?? 1) > 1" class="room-targets">
        <legend>{{ controlText('quantity.proactiveTargets', {p0:(policy?.max)}) }}</legend>
        <label v-for="t in tokens" :key="t.id" class="check"
          ><input v-model="selected" type="checkbox" :value="t.id" />{{ localizedEntryName(t) }}</label
        >
      </fieldset>
      <label v-else
        >{{ controlText('domain.activeTarget') }}<MapFieldPicker kind="entity"><select v-model="target" :aria-label="controlText('domain.activeTarget')">
          <option value="">{{ controlText('domain.publicTarget') }}</option>
          <option v-for="t in tokens" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
        </select></MapFieldPicker></label
      >
      <template
        v-if="
          kind === 'cast' && ['magic-weapon', 'elemental-weapon'].includes(grant?.spell.id ?? '')
        "
        ><label
          >{{ controlText('field.proactiveActionTargetWeapon') }}<select v-model="weaponId">
            <option value="">{{ controlText('operations.selectOneWeaponBelongingToTheTargetCharacter') }}</option>
            <option v-for="r in targetWeapons" :key="r.instanceId" :value="r.instanceId">
              {{ targetCharacter ? localizedEntryName(findItem(targetCharacter, content, r.itemId)) : r.itemId }}
            </option>
          </select></label
        >
        <p v-if="!targetCharacter" class="small muted">
          {{ controlText('operations.youCannotViewTheTargetSInventoryChoose') }}
        </p></template
      >
      <label
        >{{ controlText('field.proactiveActionNotes') }}<textarea
          v-model="reason"
          maxlength="2000"
          :placeholder="controlText('field.describeTheApproachConcealmentConditionsOrItemUse')"
        />
      </label>
      <p v-if="!onScene" class="muted">{{ controlText('operations.selectAControlledCharacterInTheCurrentScene') }}</p>
      <p v-if="!metadataReady" class="muted">{{ controlText('operations.completeTheSpellSTargetCountWeaponAmmunition') }}</p>
      <button
        class="primary"
        :disabled="busy || !valid || matchingRequests.some((r) => r.status === 'pending')"
        @click="submit"
      >
        {{ controlText('operations.submitProactiveAction') }}
      </button>
    </RequestDisclosure>
  </section>
</template>
