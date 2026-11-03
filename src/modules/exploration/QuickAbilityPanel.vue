<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import { computed, ref, watch } from 'vue'
import type { RoomView, RoomAction } from '../../online/protocol'
import type { Catalogue } from '../../core/engine'
import type { CombatCommand } from '../../core/combat-types'
import type { MapTemplate } from '../../core/map-types'
import type { RuntimeCommand } from '../../core/runtime'
import { quickAbilities, BASIC_CLASS_ABILITIES } from './quick-abilities'
import { defaultEnvironment } from '../../core/combat-rules'
import PlayerCombatPanel from '../PlayerCombatPanel.vue'
import type { QuickPreset } from './quick-preset'
import AdvancedPanel from '../AdvancedPanel.vue'
import { beast } from '../../core/beasts'
import { runtimeState, runtimeDerived } from '../../core/runtime'
const props = defineProps<{
  view: RoomView
  content: Catalogue
  characterId: string
  abilityId: string
  busy: boolean
}>()
const emit = defineEmits<{
  request: [RoomAction, boolean, string]
  combat: [CombatCommand, boolean, string, string?, MapTemplate?]
  inspect: []
  cancel: []
}>()
const character = computed(() => props.view.ownCharacters.find((c) => c.id === props.characterId)),
  ability = computed(
    () =>
      character.value &&
      quickAbilities(character.value, props.content).find((a) => a.id === props.abilityId),
  ),
  battle = computed(() =>
    props.view.encounter?.phase === 'active' ? props.view.encounter : undefined,
  ),
  actor = computed(() => battle.value?.actors.find((a) => a.characterId === props.characterId)),
  state = computed(() => character.value && runtimeState(character.value, props.content)),
  targets = computed(() => battle.value?.actors ?? props.view.characters),
  token = computed(() => props.view.scene?.tokens.find((t) => t.characterId === props.characterId)),
  budget = computed(() =>
    props.view.exploration?.status === 'active'
      ? props.view.exploration.members.find((m) => m.tokenId === token.value?.id)
      : undefined,
  )
const manualPreset = computed<QuickPreset>(() => ({
  kind: 'feature',
  key: props.abilityId,
  target: '',
}))
const amount = ref(1),
  target = ref(''),
  note = ref(''),
  confirmed = ref(false),
  purify = ref(false),
  slotLevel = ref(1),
  form = ref('')
watch(
  () => [props.characterId, props.abilityId],
  () => {
    amount.value = 1
    target.value = actor.value?.id ?? props.characterId
    confirmed.value = false
    note.value = ''
    form.value = state.value?.knownBeasts[0] ?? ''
  },
  { immediate: true },
)
const blocked = computed(
  () =>
    props.busy ||
    !character.value ||
    !ability.value ||
    !props.view.self.characterIds.includes(props.characterId) ||
    !!state.value?.death.dead ||
    !!(
      character.value &&
      runtimeDerived(character.value, props.content).conditions.includes('incapacitated')
    ) ||
    (ability.value?.kind !== 'advanced' &&
      battle.value &&
      actor.value?.id !== battle.value.currentId) ||
    props.view.intents.some(
      (i) =>
        i.status === 'pending' &&
        i.sessionId === props.view.self.id &&
        ((i.action.kind === 'runtime' && i.action.characterId === props.characterId) ||
          (i.action.kind === 'map' &&
            i.action.command.type === 'combat' &&
            'actorId' in i.action.command.command &&
            i.action.command.command.actorId === actor.value?.id)),
    ) ||
    !!state.value?.concentration?.pendingDC ||
    (battle.value &&
      (!actor.value ||
        (battle.value.pending && ability.value?.kind !== 'advanced') ||
        ability.value?.recovery === 'magical-cunning')) ||
    (ability.value?.remaining !== undefined && ability.value.remaining < 1),
)
const outsideManual = computed(
  () =>
    !battle.value &&
    ability.value?.kind === 'manual' &&
    !(props.abilityId === 'growth/wind' && budget.value),
)
function runtime(command: RuntimeCommand) {
  emit(
    'request',
    { kind: 'runtime', characterId: props.characterId, command },
    true,
    '职业能力：' + ability.value?.name,
  )
}
function combat(command: CombatCommand) {
  emit('combat', command, true, '职业能力：' + ability.value?.name)
}
function submit() {
  const a = ability.value
  if (
    !a ||
    a.kind === 'context' ||
    blocked.value ||
    !confirmed.value ||
    !note.value.trim() ||
    outsideManual.value
  )
    return
  if (a.kind === 'recovery') {
    const command: Extract<RuntimeCommand, { type: 'recover' }> = {
      type: 'recover',
      id: a.recovery!,
      slotLevel: slotLevel.value,
    }
    if (actor.value) combat({ type: 'convert', actorId: actor.value.id, command })
    else runtime(command)
  } else if (actor.value) {
    if (a.id === 'growth/wild-shape')
      combat({ type: 'wild-shape', actorId: actor.value.id, formId: form.value, note: note.value })
    else if (a.id === 'growth/companion')
      combat({
        type: 'wild-companion',
        actorId: actor.value.id,
        formId: form.value,
        mode: 'wild-shape',
        note: note.value,
      })
    else
      combat({
        type: 'feature',
        actorId: actor.value.id,
        id: a.id,
        targetId: BASIC_CLASS_ABILITIES[a.id]?.self ? actor.value.id : target.value,
        amount: a.id === 'lay-on-hands' ? (purify.value ? 5 : amount.value) : 1,
        purify: purify.value,
        env: defaultEnvironment(),
        note: note.value,
      })
  } else if (
    props.view.scene &&
    token.value &&
    budget.value &&
    ['action-surge', 'growth/wind'].includes(a.id)
  ) {
    emit(
      'request',
      {
        kind: 'map',
        command: {
          type: 'explore',
          sceneId: props.view.scene.id,
          command: {
            operation: 'action',
            tokenId: token.value.id,
            action: a.id === 'action-surge' ? 'surge' : 'wind-focus',
            confirmed: false,
            note: note.value,
          },
        },
      },
      true,
      a.name,
    )
  } else if (a.id === 'action-surge') return
  else
    runtime({
      type: 'resource',
      id: a.id,
      amount: a.id === 'lay-on-hands' ? (purify.value ? 5 : amount.value) : 1,
      target:
        a.id === 'lay-on-hands'
          ? purify.value
            ? 'purify'
            : target.value === props.characterId
              ? 'self'
              : 'other'
          : undefined,
      note:
        note.value +
        '；目标：' +
        (targets.value.find((t) => t.id === target.value)?.name ?? target.value),
    })
}
</script>
<template>
  <section class="quick-ability" :aria-label="controlText('field.classAbilityQuickParameters')">
    <template v-if="character && ability">
      <h3>{{ localizedEntryName(ability) }}</h3>
      <p>
        {{ ability.cost
        }}<span v-if="ability.remaining !== undefined">{{ controlText('quantity.remaining', {p0:(ability.remaining),p1:(ability.max)}) }}</span
        >
      </p>
      <p>{{ ability.detail }}</p>
      <AdvancedPanel
        v-if="ability.kind === 'advanced'"
        :character="character"
        :content="content"
        :focus-id="ability.id"
        :busy="busy"
        :blocked="!!blocked"
        :actor-id="actor?.id"
        :targets="targets"
        :pending-count="battle?.pendingAction?.targets.length"
        :own-turn="!battle || actor?.id === battle.currentId"
        review
        @runtime="runtime"
        @combat="combat"
      />
      <PlayerCombatPanel
        v-else-if="
          battle &&
          ability.kind === 'manual' &&
          !['growth/wild-shape', 'growth/companion'].includes(ability.id)
        "
        :key="character.id + ability.id"
        :character-id="characterId"
        lock-character
        :view="view"
        :content="content"
        :busy="busy"
        :preset="manualPreset"
        @execute="(...args) => emit('combat', ...args)"
      />
      <template v-else-if="ability.kind !== 'context'">
        <p v-if="outsideManual" class="muted">
          {{ controlText('operations.thisAbilityRequiresCombatTimingATriggerOr') }}
        </p>
        <p v-if="ability.id === 'action-surge' && !battle && !budget" class="muted">
          {{ controlText('operations.enableExplorationRoundsBeforeTrackingExtraActions') }}
        </p>
        <p
          v-if="!battle && ['bardic-inspiration', 'lay-on-hands'].includes(ability.id)"
          class="muted"
        >
          {{ controlText('operations.selfHealingFollowsTheExistingRulesTheGm') }}
        </p>
        <label v-if="!BASIC_CLASS_ABILITIES[ability.id]?.self && ability.kind !== 'recovery'"
          >{{ controlText('game.featureTarget') }}<MapFieldPicker kind="entity"><select v-model="target">
            <option v-for="t in targets" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
          </select></MapFieldPicker></label
        >
        <label v-if="ability.id === 'lay-on-hands'"
          >{{ controlText('field.healingPoints') }}<input v-model.number="amount" type="number" min="1" :max="ability.remaining"
        /></label>
        <label v-if="ability.id === 'lay-on-hands'" class="check"
          ><input v-model="purify" type="checkbox" />{{ controlText('field.removePoisonedCostsPointsSelfOnlyInExploration') }}</label
        >
        <label v-if="ability.kind === 'recovery'"
          >{{ controlText('game.conversionLevel') }}<select v-model.number="slotLevel">
            <option v-for="l in [1, 2, 3]" :key="l" :value="l">{{ controlText('quantity.spellLevel', {p0:(l)}) }}</option>
          </select></label
        >
        <label v-if="['growth/wild-shape', 'growth/companion'].includes(ability.id)"
          >{{ controlText('domain.form') }}<select v-model="form">
            <option v-for="id in state?.knownBeasts ?? []" :key="id" :value="id">
              {{ localizedEntryName(beast(id)) ?? id }}
            </option>
          </select></label
        >
        <label>{{ controlText('field.classAbilityConditionNotes') }}<textarea v-model="note" maxlength="2000" rows="2" /></label>
        <label class="check"
          ><input v-model="confirmed" type="checkbox" />{{ controlText('field.targetAndTriggerConditionsSuppliedSubmitForGm') }}</label
        >
        <button
          :disabled="
            !!blocked ||
            !confirmed ||
            !note.trim() ||
            outsideManual ||
            (ability.id === 'action-surge' && !battle && !budget)
          "
          @click="submit"
        >
          {{ controlText('operations.submitClassAbilityForReview') }}
        </button>
      </template>
      <button class="subtle" @click="emit('inspect')">{{ controlText('operations.openFullCharacterAndResourcesView') }}</button>
      <button class="subtle" @click="emit('cancel')">{{ controlText('operations.cancelAbilitySelection') }}</button>
    </template>
    <p v-else role="status">{{ controlText('operations.thisCharacterNoLongerHasThisAbilityChoose') }}</p>
  </section>
</template>
<style scoped>
.quick-ability {
  padding: 1rem;
  border: 1px solid var(--border, #76664b);
  border-radius: 12px;
}
.quick-ability label {
  display: grid;
  gap: 0.4rem;
  margin-block: 0.8rem;
}
.quick-ability label.check {
  display: flex;
}
.quick-ability button,
.quick-ability select {
  min-height: 44px;
}
</style>
