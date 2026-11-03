<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { computed, ref, watch } from 'vue'
import type { Character } from '../core/types'
import type { Catalogue } from '../core/engine'
import type { RuntimeCommand } from '../core/runtime'
import type { CombatCommand, Environment } from '../core/combat-types'
import { rulePowers } from '../core/phb-powers'
import { runtimeState, resources } from '../core/runtime'
import { defaultEnvironment } from '../core/combat-rules'
const props = defineProps<{
  focusId?: string
  character: Character
  content: Catalogue
  busy?: boolean
  blocked?: boolean
  actorId?: string
  targets?: { id: string; name: string }[]
  pendingCount?: number
  ownTurn?: boolean
  review?: boolean
  environment?: Environment
}>()
const emit = defineEmits<{ runtime: [RuntimeCommand]; combat: [CombatCommand] }>()
const selected = ref(''),
  target = ref(''),
  count = ref(1),
  entry = ref(0),
  choice = ref(''),
  note = ref(''),
  confirmed = ref(false)
const state = computed(() => runtimeState(props.character, props.content))
const powers = computed(() =>
  rulePowers(props.character)
    .filter((p) => !props.focusId || p.id === props.focusId)
    .map((p) => ({
      ...p,
      name: p.id.startsWith('phb/feat-')
        ? (props.content.feats.find((f) => f.id === p.id.slice(9))?.name ?? p.name)
        : p.name,
      detail: p.id.startsWith('phb/feat-')
        ? (props.content.feats.find((f) => f.id === p.id.slice(9))?.summary ?? p.detail)
        : p.detail,
    })),
)
const power = computed(() => powers.value.find((p) => p.id === selected.value))
const weapons = computed(() =>
  props.character.inventory.filter((r) =>
    props.content.items.some((i) => i.id === r.itemId && i.kind === 'weapon'),
  ),
)
watch(
  powers,
  (p) => {
    if (!p.some((p) => p.id === selected.value)) selected.value = p[0]?.id ?? ''
  },
  { immediate: true },
)
watch(
  () => props.actorId,
  () => {
    target.value = props.actorId ?? ''
  },
  { immediate: true },
)
const locked = computed(
  () =>
    props.busy ||
    props.blocked ||
    !power.value ||
    !confirmed.value ||
    !note.value.trim() ||
    (!!props.actorId &&
      !props.ownTurn &&
      power.value.cost !== 'reaction' &&
      power.value.timing !== 'before-roll' &&
      !['hit', 'miss', 'damage'].includes(power.value.timing)),
)
function submit() {
  if (locked.value || !power.value) return
  if (props.actorId)
    emit('combat', {
      type: 'feature',
      actorId: props.actorId,
      id: power.value.id,
      targetId: power.value.self ? props.actorId : target.value || props.actorId,
      amount: count.value,
      rule: { entry: entry.value, count: count.value, choice: choice.value || undefined },
      env: props.environment ?? defaultEnvironment(),
      note: note.value,
    })
  else
    emit('runtime', {
      type: 'advanced',
      id: power.value.id,
      amount: count.value,
      choice: choice.value || undefined,
      confirmed: confirmed.value,
      note: note.value,
    })
}
function selectSurge(id: string) {
  selected.value = 'phb/surge-ruling'
  choice.value = id
}
</script>
<template>
  <details
    v-if="powers.length"
    class="panel advanced-panel"
    :open="!!focusId"
    :aria-label="controlText('field.featsAndSubclassAbilities')"
  >
    <summary>{{ controlText('quantity.features', {p0:(powers.length)}) }}</summary>
    <p v-if="state.advanced.ward !== null">{{ controlText('quantity.ward', {p0:(state.advanced.ward)}) }}</p>
    <p v-if="state.advanced.portents.length">{{ controlText('quantity.portent', {p0:(state.advanced.portents.map((n, i) => `${i + 1}号：${n}`).join('、'))}) }}
    </p>
    <article
      v-for="s in state.advanced.surges?.filter((s) => !s.settled)"
      :key="s.id"
      class="panel"
    >
      <b
        >{{ controlText('quantity.wildSurge', {p0:(s.roll),p1:(s.subRolls.length ? controlText('expressionOne.additionalDice') + s.subRolls.join('、') : '')}) }}</b
      >
      <p>{{ s.detail }}</p>
      <button class="secondary" @click="selectSurge(s.id)">{{ controlText('operations.selectThisResultToRecordTheRuling') }}</button>
    </article>
    <label
      >{{ controlText('game.features') }}<select v-model="selected" :aria-label="controlText('field.advancedAbilities')">
        <option v-for="p in powers" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
      </select></label
    >
    <p v-if="power">{{ power.detail }}</p>
    <p v-if="power" class="muted">
      {{
        { action: controlText('controls.action'), bonus: controlText('domain.bonusAction'), reaction: controlText('domain.reaction'), none: controlText('finalField.noAdditionalAction') }[power.cost]
      }}
      ·
      {{
        power.resource
          ? controlText('inlineSummary.remaining',{p0:(state.resources[power.resource] ?? 0),p1:(localizedEntryName(resources(character, content).find((r) => r.id === power?.resource)) ?? controlText('expressionOne.uses'))})
          : controlText('expressionOne.noLimitedUseResource')
      }}{{ power.duration ? controlText('inlineSummary.durationMinutes',{p0:(Math.round(power.duration * 60 * 100) / 100)}) : '' }}
    </p>
    <label v-if="actorId && !power?.self"
      >{{ controlText('controls.target') }}<MapFieldPicker kind="entity"><select v-model="target" :aria-label="controlText('field.advancedAbilityTarget')">
        <option v-for="t in targets" :key="t.id" :value="t.id">{{ localizedEntryName(t) }}</option>
      </select></MapFieldPicker></label
    >
    <label v-if="pendingCount"
      >{{ controlText('field.pendingTargetEntry') }}<select v-model.number="entry" :aria-label="controlText('field.advancedAbilityAttackEntry')">
        <option v-for="i in pendingCount" :key="i" :value="i - 1">{{ i }}</option>
      </select></label
    >
    <label
      >{{ controlText('field.diceCountPortentIndexRecoveredSlotLevel') }}<input
        v-model.number="count"
        type="number"
        min="1"
        max="10"
        :aria-label="controlText('field.advancedAbilityQuantity')"
    /></label>
    <label
      v-if="
        ['phb/feat-charger', 'phb/feat-shield-master', 'phb/maneuver-bait-switch'].includes(
          selected,
        )
      "
      >{{ controlText('field.outcomeSelection') }}<select v-model="choice" :aria-label="controlText('field.abilityOutcomeSelection')">
        <option value="">{{ controlText('operations.defaultDamageProneAllyAc') }}</option>
        <option value="push">{{ controlText('operations.pushAway') }}</option>
        <option v-if="selected === 'phb/maneuver-bait-switch'" value="self">{{ controlText('operations.ownAc') }}</option>
      </select></label
    >
    <label v-if="selected === 'phb/primal-companion'"
      >{{ controlText('game.primalBeast') }}<select v-model="choice" :aria-label="controlText('game.primalBeast')">
        <option value="">{{ controlText('game.land') }}</option>
        <option value="land">{{ controlText('game.land') }}</option>
        <option value="sea">{{ controlText('state.sea') }}</option>
        <option value="sky">{{ controlText('state.sky') }}</option>
      </select></label
    >
    <label v-if="selected === 'phb/companion-command'"
      >{{ controlText('field.commandCost') }}<select v-model="choice" :aria-label="controlText('field.primalCompanionCommandCost')">
        <option value="">{{ controlText('controls.bonus') }}</option>
        <option value="replace-attack">{{ controlText('operations.replaceOneAttackInTheAttackAction') }}</option>
      </select></label
    >
    <label v-if="['phb/war-bond', 'phb/war-recall', 'phb/poisoner-coat'].includes(selected)"
      >{{ controlText('field.weaponInstance') }}<select v-model="choice" :aria-label="controlText('field.bondedOrPoisonedWeapon')">
        <option value="">{{ controlText('operations.chooseWeapon') }}</option>
        <option v-for="w in weapons" :key="w.instanceId" :value="w.instanceId">
          {{ localizedEntryName(content.items.find((i) => i.id === w.itemId)) }} · {{ w.instanceId.slice(-6) }}
        </option>
      </select></label
    >
    <label
      >{{ controlText('field.triggerAndAdjudicationBasis') }}<textarea
        v-model="note"
        :aria-label="controlText('field.advancedAbilityAdjudicationBasis')"
        maxlength="2000"
        :placeholder="controlText('field.recordTheSpecificAttackCheckPositionOrRest')"
      />
    </label>
    <label class="check"
      ><input v-model="confirmed" type="checkbox" />{{ controlText('field.thisAbilitySTriggerTimingAndFullRules') }}</label
    >
    <button class="primary" :disabled="locked" @click="submit">
      {{ review ? controlText('game.submit') : controlText('expressionOne.executeAbility') }}
    </button>
    <p class="muted">
      {{ controlText('adjudication.theSystemRecordsActualResourcesRulesDiceAnd') }}
    </p>
  </details>
</template>
<style scoped>
.advanced-panel label {
  display: block;
  margin: 0.8rem 0;
}
.advanced-panel select,
.advanced-panel textarea,
.advanced-panel input[type='number'] {
  width: 100%;
  max-width: 100%;
}
.advanced-panel .check {
  display: flex;
  gap: 0.5rem;
}
.advanced-panel p {
  overflow-wrap: anywhere;
}
</style>
