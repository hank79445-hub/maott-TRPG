<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {abilityDisplayName,damageDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import M3ReactionFrames from './M3ReactionFrames.vue'
import '../app/m2-controls.css'
import ResolutionAbilityCards from './ResolutionAbilityCards.vue'
import {
  resolutionAbilities,
  resolutionPassiveSources,
  shieldCandidates,
  shieldModes,
  type ResolutionAbility,
} from '../core/combat-resolution-options'
import CounterspellReaction from './CounterspellReaction.vue'
import DispelZoneForm from './DispelZoneForm.vue'
import ControlRulingForm from './ControlRulingForm.vue'
import FearRulingForm from './FearRulingForm.vue'
import SanctuaryRetargetForm from './SanctuaryRetargetForm.vue'
import CommandRulingForm from './CommandRulingForm.vue'
import { supportChoiceName } from '../core/support-spells'
import { computed, ref, watch } from 'vue'
import { resolutionIdentity, type ResolutionGuard } from './battle-resolution-identity'
import type { useWorkshop } from '../app/store'
import { combatStats } from '../core/combat-rules'
import { ABILITIES, ABILITY_NAMES } from '../core/types'
import {
  DAMAGE_TYPES,
  DAMAGE_NAMES,
  type Combatant,
  type CombatCommand,
} from '../core/combat-types'
import { signed } from '../core/engine'
import { sourceCaption } from '../core/rule-sources'
import { srd } from '../content/srd'
import { CONDITIONS } from '../content/conditions'
import { damageRerollCaption } from './combat-reroll-presentation'
import NpcMonsterReactions from './NpcMonsterReactions.vue'
const props = defineProps<{
  encounterId: string
  workshop: ReturnType<typeof useWorkshop>
  busy: boolean
  scope?: string
}>()
type Guard = ResolutionGuard
const emit = defineEmits<{ command: [CombatCommand, Guard] }>()
const store = props.workshop
const encounter = computed(() => store.encounters.find((e) => e.id === props.encounterId))
const stat = (a: Combatant) => combatStats(a, store.characters, store.content)
const componentsConfirmed = ref(false),
  shieldActor = ref(''),
  shieldKey = ref(''),
  shieldMode = ref('')
const manual = ref<NonNullable<Extract<CombatCommand, { type: 'resolve' }>['manual']>>({
  damage: 0,
  damageType: 'fire',
  heal: 0,
  condition: '',
  rounds: 1,
  note: '',
})
const pendingSource = computed(
  () => store.content.spells.find((s) => s.id === encounter.value?.pending?.spellId)?.source,
)
const shieldGrants = computed(() => {
  const a = encounter.value?.actors.find((a) => a.id === shieldActor.value)
  return a ? shieldModes(a, store.characters, store.content) : []
})
watch(
  shieldGrants,
  (list) => {
    if (!list.some((g) => g.key === shieldKey.value)) shieldKey.value = list[0]?.key ?? ''
  },
  { immediate: true },
)
watch(
  () => shieldGrants.value.find((g) => g.key === shieldKey.value)?.modes.join('|') ?? '',
  () => {
    if (
      !shieldGrants.value.find((g) => g.key === shieldKey.value)?.modes.includes(shieldMode.value)
    )
      shieldMode.value = shieldGrants.value.find((g) => g.key === shieldKey.value)?.modes[0] ?? ''
  },
  { immediate: true },
)
const selectionKeys = ref<string[]>([])
const abilities = computed(() =>
  encounter.value ? resolutionAbilities(encounter.value, store.characters, store.content) : [],
)
const chosen = (id: ResolutionAbility['choice']) =>
  abilities.value.filter((o) => o.choice === id && !o.reason && selectionKeys.value.includes(o.key))
function saveAbilityDraft() {
  const pendingId = encounter.value?.pending?.id
  if (!pendingId) return
  const keys = selectionKeys.value.filter((key) =>
    abilities.value.some((o) => o.key === key && o.choice && !o.reason && !o.committed),
  )
  run({ type: 'resolution-draft', pendingId, keys })
}
function selectAbility(option: ResolutionAbility) {
  if (props.busy || option.reason) return
  if (selectionKeys.value.includes(option.key))
    selectionKeys.value = selectionKeys.value.filter((key) => key !== option.key)
  else {
    if (option.choice === 'revelation')
      selectionKeys.value = selectionKeys.value.filter(
        (key) => !abilities.value.some((o) => o.key === key && o.choice === 'revelation'),
      )
    selectionKeys.value = [...selectionKeys.value, option.key]
  }
}
function activateAbility(option: ResolutionAbility) {
  if (!option.reason && option.command) run(option.command)
}
const shieldTargets = computed(() =>
  encounter.value ? shieldCandidates(encounter.value, store.characters, store.content) : [],
)
const shieldReason = computed(
  () =>
    shieldTargets.value.find((entry) => entry.actor.id === shieldActor.value)?.reason ??
    '请选择具备护盾术的目标',
)
watch(shieldTargets, (list) => {
  if (!list.some((entry) => entry.actor.id === shieldActor.value))
    shieldActor.value = list[0]?.actor.id ?? ''
})
const passiveEffects = computed(() =>
  encounter.value ? resolutionPassiveSources(encounter.value, store.characters, store.content) : [],
)
const identity = computed(() => resolutionIdentity(store, props.encounterId, props.scope))
const pendingKey = computed(() => identity.value?.key ?? '')
watch(
  pendingKey,
  () => {
    selectionKeys.value = [...(encounter.value?.pending?.resolutionDraft??[])]
    componentsConfirmed.value = false
    const id = encounter.value?.pending?.targets[0]?.id ?? ''
    shieldActor.value = shieldTargets.value[0]?.actor.id ?? id
    manual.value = { damage: 0, damageType: 'fire', heal: 0, condition: '', rounds: 1, note: '' }
  },
  { immediate: true },
)
watch(()=>encounter.value?.pending?.resolutionDraft?.join('|'),()=>{selectionKeys.value=[...(encounter.value?.pending?.resolutionDraft??[])]})
function run(command: CombatCommand) {
  const e = encounter.value
  if (props.busy || !e) return
  if (identity.value) emit('command', command, identity.value.guard)
}
const damageLine = (
  part: NonNullable<import('../core/combat-types').PendingAction['damage']>[number],
) =>
  DAMAGE_NAMES[part.type] +
  ' ' +
  part.roll.formula +
  ' [' +
  part.roll.dice +
  '] = ' +
  part.roll.total
const sourceUrl = (page: number) =>
  'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=' + page
const concentration = computed(
  () =>
    encounter.value?.actors.flatMap((a) => {
      const dc = a.characterId
        ? store.characters.find((c) => c.id === a.characterId)?.runtime?.concentration?.pendingDC
        : a.npc?.concentration?.pendingDC
      return dc ? [{ actor: a, dc }] : []
    }) ?? [],
)
</script>
<template>
  <M3ReactionFrames v-if="encounter" :encounter="encounter" />
  <NpcMonsterReactions
    v-if="encounter?.pending"
    :pending="encounter.pending"
    :actors="encounter.actors"
    :busy="busy"
    @command="run"
  />
  <DispelZoneForm v-if="encounter" :encounter="encounter" :characters="store.characters" :cat="store.content" :busy="busy" @command="run" />
  <ControlRulingForm v-if="encounter" :encounter="encounter" :characters="store.characters" :cat="store.content" :busy="busy" @command="run" />
  <FearRulingForm v-if="encounter" :encounter="encounter" :characters="store.characters" :cat="store.content" :busy="busy" @command="run" />
  <CommandRulingForm v-if="encounter" :encounter="encounter" :characters="store.characters" :cat="store.content" :busy="busy" @command="run" />
  <section v-if="encounter?.pending" class="pending-action battle-card" :aria-label="controlText('field.actionAwaitingResolution')">
    <SanctuaryRetargetForm :encounter="encounter" :characters="store.characters" :cat="store.content" :busy="busy" @command="run" />
    <CounterspellReaction
      :encounter="encounter"
      :characters="store.characters"
      :cat="store.content"
      :busy="busy"
      @command="run"
    />
    <p class="eyebrow">RESOLUTION WINDOW</p>
    <h3>{{ controlText('quantity.pendingResolution', {p0:(localizedEntryName(encounter.pending))}) }}</h3>
    <p class="muted">{{ controlText('operations.confirmReactionsAndTargetsBeforeSubmittingTheResult') }}</p>
    <p v-if="encounter.pending.attack?.effectNote" class="muted">{{ controlText('quantity.npcRules', {p0:(encounter.pending.attack.effectNote)}) }}
    </p>
    <p v-if="encounter.pending.damageRolled" class="muted">
      {{ controlText('operations.damageHasBeenRolledButHpHasNot') }}
    </p>
    <p
      v-if="
        encounter.pending.kind === 'attack' &&
        !encounter.pending.damageRolled &&
        encounter.pending.targets.some((t) => t.hit)
      "
      class="muted"
    >
      {{ controlText('operations.choosePreDamageAbilitiesThenRollAttackDamage') }}
    </p>
    <p class="muted">{{ controlText('operations.afterFinalConfirmationTheRulesEngineResolvesResistance') }}</p>
    <p v-if="encounter.pending.supportChoice" class="muted">{{ controlText('quantity.selectedEffect', {p0:(supportChoiceName(encounter.pending.supportChoice))}) }}
    </p>
    <ul class="pending-targets">
      <li v-for="(t, index) in encounter.pending.targets" :key="index">
        <strong>{{ localizedEntryName(stat(encounter.actors.find((a) => a.id === t.id)!)) }}</strong
        ><span v-if="t.roll"
          >d20 [{{ t.roll.dice.join(', ') }}] {{ signed(t.roll.bonus)
          }}<template v-if="t.roll.bonusDice.length">{{ controlText('quantity.effectDice', {p0:(t.roll.bonusDice)}) }}</template> =
          {{ t.roll.total }} /
          {{ encounter.pending.kind === 'attack' ? 'AC ' + t.ac : 'DC ' + encounter.pending.dc }}
          ·
          {{
            encounter.pending.kind === 'attack'
              ? t.hit
                ? t.critical
                  ? controlText('expressionOne.criticalHit')
                  : controlText('domain.hit')
                : controlText('domain.miss')
              : t.hit
                ? controlText('expressionOne.saveFailed')
                : controlText('expressionOne.saveSucceeded')
          }}</span
        ><span v-else>{{ controlText('operations.selectedTargets') }}</span
        ><small v-if="t.roll?.reasons.length">{{ t.roll.reasons.join('；') }}</small>
<small v-if="t.mirror">{{ controlText('quantity.mirrorDice', {p0:(t.mirror.rolls.join(', ')),p1:(t.mirror.destroyed?controlText('expressionOne.oneDuplicateDestroyedOriginalNotHit'):controlText('expressionOne.notIntercepted'))}) }}</small>
        <small v-if="encounter.pending.damageRolled">{{
          t.damageOverride?.map(damageLine).join('；')
        }}</small>
        <small
          v-for="(reroll, rerollIndex) in t.damageOverride?.flatMap(
            (part) => part.roll.rerolls ?? [],
          ) ?? []"
          :key="rerollIndex"
          >{{ damageRerollCaption(reroll) }}</small
        >
      </li>
    </ul>
    <p v-if="pendingSource && pendingSource.pack !== srd.id">{{ controlText('quantity.ruleSource', {p0:(sourceCaption(pendingSource))}) }}
    </p>
    <a v-else :href="sourceUrl(encounter.pending.page || 15)" target="_blank" rel="noopener"
      >{{ encounter.pending.page ? controlText('domain.sourceRules') : controlText('expressionOne.generalCombatRules') }} · SRD p.{{
        encounter.pending.page || 15
      }}</a
    >
    <details v-if="shieldTargets.length" class="reaction-options">
      <summary>{{ controlText('operations.shieldReaction') }}</summary>
      <label
        >{{ controlText('field.reactor') }}<select v-model="shieldActor" :aria-label="controlText('field.shieldReactor')">
          <option v-for="a in shieldTargets.map((entry) => entry.actor)" :key="a.id" :value="a.id">
            {{ localizedEntryName(stat(a)) }}
          </option>
        </select></label
      ><label
        >{{ controlText('field.shieldSource') }}<select v-model="shieldKey">
          <option value="" disabled>{{ controlText('operations.noAvailableSource') }}</option>
          <option v-for="g in shieldGrants" :key="g.key" :value="g.key">
            {{ localizedEntryName(g.spell) }} · {{ g.source }}
          </option>
        </select></label
      ><label
        >{{ controlText('domain.castMethod') }}<select v-model="shieldMode">
          <option v-for="mode in shieldGrants.find((g) => g.key === shieldKey)?.modes" :key="mode">
            {{ mode }}
          </option>
        </select></label
      ><label class="check"
        ><input
          v-model="componentsConfirmed"
          type="checkbox"
        />{{ controlText('field.reactionTriggerComponentAndMaterialRequirementsAreMet') }}</label
      >
      <p v-if="shieldReason" class="muted">{{ shieldReason }}</p>
      <button
        class="secondary"
        :disabled="busy || !shieldKey || !componentsConfirmed || !!shieldReason"
        @click="
          run({
            type: 'reaction-shield',
            actorId: shieldActor,
            key: shieldKey,
            mode: shieldMode,
            requirementsConfirmed: componentsConfirmed,
          })
        "
      >
        {{ controlText('operations.useShieldReaction') }}
      </button>
    </details>
    <div v-if="encounter.pending.kind === 'manual'" class="manual-effect">
      <p>{{ encounter.pending.notes.join('；') }}</p>
      <p class="muted">
        {{ controlText('operations.enterThisStageSResultAccordingToThe') }}
      </p>
      <div class="battle-form-grid">
        <label>{{ controlText('field.originalDamageResolved') }}<input v-model.number="manual.damage" type="number" min="0" /></label
        ><label
          >{{ controlText('game.damageType') }}<select v-model="manual.damageType">
            <option v-for="t in DAMAGE_TYPES" :key="t" :value="t">
              {{ damageDisplayName(t) }}
            </option>
          </select></label
        ><label>{{ controlText('game.healAmount') }}<input v-model.number="manual.heal" type="number" min="0" /></label
        ><label
          >{{ controlText('domain.addCondition') }}<select v-model="manual.condition">
            <option value="">{{ controlText('controls.none') }}</option>
            <option
              v-for="c in CONDITIONS.filter((c) => c.id !== 'exhaustion')"
              :key="c.id"
              :value="c.id"
            >
              {{ localizedEntryName(c) }}
            </option>
          </select></label
        ><label
          >{{ controlText('game.durationRounds') }}<input v-model.number="manual.rounds" type="number" min="0"
        /></label>
      </div>
      <label
        >{{ controlText('field.repeatSaveAtEachTurnEnd') }}<select v-model="manual.repeatSave" :aria-label="controlText('field.repeatedSaveAbility')">
          <option :value="undefined">{{ controlText('controls.none') }}</option>
          <option v-for="ability in ABILITIES" :key="ability" :value="ability">
            {{ abilityDisplayName(ability) }}
          </option>
        </select></label
      ><label
        >{{ controlText('game.acModifier') }}<input
          v-model.number="manual.acBonus"
          type="number"
          min="-10"
          max="10"
          :aria-label="controlText('game.acModifier')" /></label
      ><label
        >{{ controlText('field.ongoingSpeedReductionFt') }}<input
          v-model.number="manual.speedPenalty"
          type="number"
          min="0"
          max="300"
          :aria-label="controlText('field.ongoingSpeedReduction')"
      /></label>
      <p class="muted">{{ controlText('workspace.theseAreExplicitGmRulingsRepeatedSavesUse') }}</p>
      <label>{{ controlText('field.gmAdjudicationBasis') }}<textarea v-model="manual.note" rows="2" /></label>
    </div>
    <button v-if="encounter.pending.id && abilities.some(o=>o.choice)" class="secondary" :disabled="busy" @click="saveAbilityDraft">{{ controlText('operations.saveAbilitySelectionsNoResourceCost') }}</button>
    <ResolutionAbilityCards
      :key="pendingKey"
      :options="abilities"
      :selected="selectionKeys"
      :busy="busy"
      @select="selectAbility"
      @activate="activateAbility"
    />
    <details v-if="passiveEffects.length" class="reaction-options">
      <summary>{{ controlText('operations.passiveAndOngoingEffectSources') }}</summary>
      <ul>
        <li v-for="name in passiveEffects" :key="name">{{ name }}</li>
      </ul>
      <p class="muted">{{ controlText('operations.noExtraCheckboxIsRequiredTheExistingRules') }}</p>
    </details>
    <button
      v-if="encounter.pending.kind === 'attack' && !encounter.pending.damageRolled"
      :disabled="busy"
      @click="
        run({
          type: 'damage-roll',
          actorId: encounter.pending.actorId,
          savage: chosen('savage').length > 0,
          tavernReroll: chosen('tavernReroll').length > 0,
        })
      "
    >
      {{ controlText('domain.rollDamage') }}
    </button>
    <button
      class="primary"
      :disabled="
        busy ||
        (encounter.pending.kind === 'attack' &&
          !encounter.pending.damageRolled &&
          encounter.pending.targets.some((t) => t.hit)) ||
        (encounter.pending.kind === 'manual' && !manual.note.trim())
      "
      @click="
        run({
          type: 'resolve',
          nonlethal: chosen('nonlethal').length > 0,
          nonlethalTargetIds: [
            ...new Set(
              chosen('nonlethal').map((o) => encounter!.pending!.targets[o.targetIndex]!.id),
            ),
          ],
          savage: chosen('savage').length > 0,
          uncanny: false,
          deflect: false,
          stone: false,
          relentless: chosen('relentless').length > 0,
          relentlessTargetIds: [...new Set(chosen('relentless').map((o) => o.actorId))],
          pushConfirmed: chosen('push').length > 0,
          tavernReroll: chosen('tavernReroll').length > 0,
          healerReroll: chosen('healerReroll').length > 0,
          revelationBonus: chosen('revelation').length > 0,
          revelationTargetId: chosen('revelation')[0]
            ? encounter!.pending!.targets[chosen('revelation')[0]!.targetIndex]!.id
            : undefined,
          manual:
            encounter.pending.kind === 'manual'
              ? {
                  ...manual,
                  acBonus: typeof manual.acBonus === 'number' ? manual.acBonus : undefined,
                  speedPenalty:
                    typeof manual.speedPenalty === 'number' ? manual.speedPenalty : undefined,
                }
              : undefined,
        })
      "
    >
      {{ controlText('domain.confirmResult') }}
    </button>
  </section>
  <section
    v-if="!encounter?.pending && concentration.length"
    :aria-label="controlText('field.pendingConcentrationSaves')"
    class="battle-card"
  >
    <h3>{{ controlText('operations.damageConfirmedAwaitingConcentrationSave') }}</h3>
    <p v-for="entry in concentration" :key="entry.actor.id">
      {{ localizedEntryName(stat(entry.actor)) }} · DC {{ entry.dc }}
      <button
        :disabled="busy"
        @click="
          run({
            type: entry.actor.characterId ? 'concentration' : 'npc-concentration',
            actorId: entry.actor.id,
          })
        "
      >
        {{ controlText('game.concentrationSave') }}
      </button>
    </p>
  </section>
</template>
<style scoped>
.pending-action {
  padding: 1rem;
  border: 1px solid var(--line, #ccd5d2);
  border-radius: 12px;
}
.pending-targets {
  padding-left: 1.2rem;
}
.pending-targets li {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.battle-controls,
.resolve-options,
.inline-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-block: 0.7rem;
}
.battle-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.6rem;
}
label:not(.check) {
  display: grid;
  gap: 0.3rem;
  margin-block: 0.5rem;
}
input,
select,
textarea {
  max-width: 100%;
}
</style>
