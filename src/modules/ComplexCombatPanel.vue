<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {abilityDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { hasSubclass } from '../core/growth-rules'
import { computed, ref, watch } from 'vue'
import type { Encounter, CombatCommand, Environment } from '../core/combat-types'
import { ABILITIES, ABILITY_NAMES, type Character } from '../core/types'
import type { Catalogue } from '../core/engine'
import { BEASTS, beast } from '../core/beasts'
import { combatStats, customNpc } from '../core/combat-rules'
import { runtimeState } from '../core/runtime'
import { runtimeSpells, castSlotLevel } from '../core/runtime'
const props = defineProps<{
  encounter: Encounter
  characters: Character[]
  content: Catalogue
  actorId: string
  targetId: string
  env: Environment
  busy: boolean
}>()
const emit = defineEmits<{ execute: [command: CombatCommand] }>()
const actor = computed(() => props.encounter.actors.find((a) => a.id === props.actorId)),
  c = computed(() => props.characters.find((c) => c.id === actor.value?.characterId)),
  r = computed(() => c.value && runtimeState(c.value, props.content))
const formId = ref('wolf'),
  familiarId = ref('cat'),
  companionMode = ref<'wild-shape' | 'slot' | 'slot-2' | 'slot-3'>('wild-shape'),
  note = ref(''),
  confirmed = ref(false),
  selectedZoneTarget = ref(''),
  zonePhase = ref<'created' | 'enter' | 'start' | 'end' | 'moved'>('enter'),
  zoneDistance = ref(30),
  plantAmmo = ref(''),
  plantCount = ref(4),
  plantMode = ref('slot-2'),
  destination = ref({ x: 1, y: 1 }),
  surgeId = ref(''),
  surgeNpc = ref(customNpc()),
  known = ref<string[]>([])
watch(
  () => [c.value?.id, c.value?.revision],
  () => {
    known.value = [...(r.value?.knownBeasts ?? [])]
  },
  { immediate: true },
)
const name = (id: string) => {
  const a = props.encounter.actors.find((a) => a.id === id)
  return a ? combatStats(a, props.characters, props.content).name : id
}
const can = computed(() => !props.busy && !!note.value.trim())
const zoneTarget = computed(() => selectedZoneTarget.value || props.targetId)
const cordon = computed(
  () =>
    c.value && runtimeSpells(c.value, props.content).find((g) => g.spell.id === 'cordon-of-arrows'),
)
const npcSurges = computed(
  () =>
    r.value?.advanced.surges?.filter(
      (s) =>
        s.roll >= 5 &&
        s.roll <= 8 &&
        !props.encounter.actors.some(
          (a) => a.companion?.ownerId === props.actorId && a.companion.surgeId === s.id,
        ),
    ) ?? [],
)
function spawnSurge() {
  emit('execute', {
    type: 'surge-npc',
    actorId: props.actorId,
    surgeId: surgeId.value,
    npc: { ...surgeNpc.value, hp: surgeNpc.value.maxHp },
    note: note.value,
    destination: destination.value,
  })
}
function plant() {
  if (!cordon.value) return
  emit('execute', {
    type: 'cast',
    actorId: props.actorId,
    key: cordon.value.key,
    mode: plantMode.value,
    targets: [props.actorId],
    env: props.env,
    requirementsConfirmed: confirmed.value,
    damageType: 'piercing',
    ammunition: { instanceId: plantAmmo.value, count: plantCount.value },
  })
}
</script>
<template>
  <details class="complex-combat" open>
    <summary>{{ controlText('operations.reactionsBeastFormsAndOngoingEffects') }}</summary>
    <label
      >{{ controlText('field.triggerAdjudicationBasis') }}<input
        v-model="note"
        :aria-label="controlText('field.dAdjudicationBasis')"
        :placeholder="controlText('field.describeTheHitAreaTimingOrBeastForm')"
    /></label>
    <button
      v-if="r?.effects.some((f) => f.key === 'crown-of-madness' && f.maintainedTick !== undefined)"
      :disabled="!can || !!encounter.pending"
      @click="emit('execute', { type: 'maintain-spell', actorId, note })"
    >
      {{ controlText('operations.magicActionToSustainCrownOfMadness') }}
    </button>
    <details v-if="cordon && encounter.phase !== 'active'">
      <summary>{{ controlText('operations.setCordonOfArrowsOutsideCombat') }}</summary>
      <label
        >{{ controlText('game.cordonAmmo') }}<select v-model="plantAmmo" :aria-label="controlText('field.ammunitionForOutOfCombatArrowWard')">
          <option value="">{{ controlText('game.choose') }}</option>
          <option
            v-for="row in c?.inventory.filter((x) => ['arrow', 'bolt'].includes(x.itemId))"
            :key="row.instanceId"
            :value="row.instanceId"
          >
            {{ row.itemId === 'arrow' ? controlText('expressionOne.arrows') : controlText('expressionOne.bolts') }} ×{{ row.quantity }}
          </option>
        </select></label
      ><label
        >{{ controlText('field.spellSourceMethod') }}<select v-model="plantMode">
          <option v-for="mode in cordon.modes" :key="mode" :value="mode">{{ mode }}</option>
        </select></label
      ><label
        >{{ controlText('game.fixedAmmo') }}<input
          v-model.number="plantCount"
          type="number"
          min="1"
          :max="4 + Math.max(0, castSlotLevel(plantMode) - 2) * 2" /></label
      ><label class="check"
        ><input v-model="confirmed" type="checkbox" />{{ controlText('field.gmConfirmedPlacementNonmagicalAmmunitionAndSpellComponents') }}</label
      ><button :disabled="!can || !confirmed || !!encounter.pending" @click="plant">
        {{ controlText('operations.setCordonOfArrows') }}
      </button>
    </details>
    <details v-if="npcSurges.length && encounter.phase === 'active'">
      <summary>{{ controlText('operations.gmCreatesFriendlyCreaturesFromASavedSurge') }}</summary>
      <p class="muted">
        {{ controlText('adjudication.theAdditionalD4For0508IsSaved') }}
      </p>
      <label
        >{{ controlText('field.surgeResult') }}<select v-model="surgeId" :aria-label="controlText('field.friendlyCreatureSurgeResult')">
          <option value="">{{ controlText('game.choose') }}</option>
          <option v-for="s in npcSurges" :key="s.id" :value="s.id">
            d100={{ s.roll }} · d4={{ s.subRolls.join(',') }}
          </option>
        </select></label
      ><label
        >{{ controlText('field.surgeCreatureDestinationX') }}<input
          v-model.number="destination.x"
          type="number"
          min="0"
          max="79"
          :aria-label="controlText('field.surgeCreatureDestinationX')" /></label
      ><label
        >{{ controlText('game.landingYShort') }}<input
          v-model.number="destination.y"
          type="number"
          min="0"
          max="79"
          :aria-label="controlText('field.surgeCreatureDestinationY')" /></label
      ><label>{{ controlText('field.creatureName') }}<input v-model="surgeNpc.name" /></label
      ><label>AC<input v-model.number="surgeNpc.ac" type="number" min="0" max="100" /></label
      ><label
        >{{ controlText('game.maxHP') }}<input v-model.number="surgeNpc.maxHp" type="number" min="1" max="100000" /></label
      ><label>{{ controlText('controls.speed') }}<input v-model.number="surgeNpc.speed" type="number" min="0" max="300" /></label
      ><label
        >{{ controlText('domain.initiativeBonus') }}<input
          v-model.number="surgeNpc.initiativeBonus"
          type="number"
          min="-100"
          max="100" /></label
      ><template v-for="ability in ABILITIES" :key="ability"
        ><label
          >{{ abilityDisplayName(ability) }} {{ controlText('game.abilities') }}<input
            v-model.number="surgeNpc.scores[ability]"
            type="number"
            min="1"
            max="30" /></label
        ><label
          >{{ abilityDisplayName(ability) }} {{ controlText('controls.saveThrow') }}<input
            v-model.number="surgeNpc.saves[ability]"
            type="number"
            min="-30"
            max="50" /></label></template
      ><label>{{ controlText('game.attackName') }}<input v-model="surgeNpc.attacks[0]!.name" /></label
      ><label
        >{{ controlText('domain.hitBonus') }}<input
          v-model.number="surgeNpc.attacks[0]!.bonus"
          type="number"
          min="-30"
          max="50" /></label
      ><label>{{ controlText('game.damageFormula') }}<input v-model="surgeNpc.attacks[0]!.damage" /></label
      ><label>{{ controlText('field.dataSource') }}<input v-model="surgeNpc.source" /></label
      ><label class="check"
        ><input
          v-model="confirmed"
          type="checkbox"
        />{{ controlText('field.creatureDataRandomDestinationAndSpecialAbilitiesChecked') }}</label
      ><button
        :disabled="!can || !confirmed || !surgeId || !!encounter.pending"
        @click="spawnSurge"
      >
        {{ controlText('operations.createSurgeCreatures') }}
      </button>
    </details>
    <p v-if="encounter.pending" class="muted">
      {{ controlText('operations.onHitAbilitiesRerollsAndDefensiveReactionsAre') }}
    </p>
    <template
      v-else-if="c?.build.classId === 'druid' && c.level >= 2 && encounter.phase === 'active'"
    >
      <p class="muted">{{ controlText('workspace.wildShapeRetainsActualHpAndMentalAbility') }}</p>
      <p v-if="r?.wildShape" class="tag">{{ controlText('quantity.beastForm', {p0:(localizedEntryName(beast(r.wildShape.formId))),p1:(r.wildShape.endsAt),p2:(controlText('game.hours'))}) }}
      </p>
      <div class="complex-row">
        <label
          >{{ controlText('field.knownBeastForms') }}<select v-model="formId" :aria-label="controlText('field.wildShapeSelection')">
            <option v-for="id in r?.knownBeasts" :key="id" :value="id">
              {{ localizedEntryName(beast(id)) }}
            </option>
          </select></label
        ><button
          :disabled="!can"
          @click="emit('execute', { type: 'wild-shape', actorId, formId, note })"
        >
          {{ controlText('operations.enterWildShape') }}</button
        ><button
          v-if="r?.wildShape"
          :disabled="!can"
          @click="emit('execute', { type: 'wild-shape', actorId, formId: '', note })"
        >
          {{ controlText('operations.endWildShape') }}
        </button>
      </div>
      <details>
        <summary>{{ controlText('operations.gmConfiguresKnownBeastFormsInitialSelectionLong') }}</summary>
        <label
          v-for="b in BEASTS.filter(
            (b) =>
              !b.fly &&
              b.cr <=
                (hasSubclass(c!.build, 'moon')
                  ? Math.floor(c!.level / 3)
                  : c!.level >= 4
                    ? 0.5
                    : 0.25),
          )"
          :key="b.id"
          class="check"
          ><input v-model="known" type="checkbox" :value="b.id" />{{ localizedEntryName(b) }} · CR
          {{ b.cr }}</label
        ><button
          :disabled="!can"
          @click="emit('execute', { type: 'beast-forms', actorId, ids: known, note })"
        >
          {{ controlText('operations.saveKnownBeastForms') }}
        </button>
      </details>
      <div class="complex-row">
        <label
          >{{ controlText('game.companionForm') }}<select v-model="familiarId" :aria-label="controlText('game.companionForm')">
            <option v-for="b in BEASTS.filter((b) => b.cr === 0)" :key="b.id" :value="b.id">
              {{ localizedEntryName(b) }}
            </option>
          </select></label
        ><label
          >{{ controlText('field.companionCost') }}<select v-model="companionMode" :aria-label="controlText('field.companionCost')">
            <option value="wild-shape">{{ controlText('operations.wildShape1') }}</option>
            <option value="slot">{{ controlText('state.levelOneSlot') }}</option>
            <option value="slot-2">{{ controlText('state.levelTwoSlot') }}</option>
            <option value="slot-3">{{ controlText('state.levelThreeSlot') }}</option>
          </select></label
        ><button
          :disabled="!can"
          @click="
            emit('execute', {
              type: 'wild-companion',
              actorId,
              formId: familiarId,
              mode: companionMode,
              note,
            })
          "
        >
          {{ controlText('operations.summonWildCompanion') }}
        </button>
      </div>
    </template>
    <label v-if="encounter.zones?.length"
      >{{ controlText('field.ongoingEffectTarget') }}<select v-model="selectedZoneTarget" :aria-label="controlText('field.ongoingEffectTarget')">
        <option value="">{{ controlText('operations.useCurrentCombatTarget') }}</option>
        <option v-for="target in encounter.actors" :key="target.id" :value="target.id">
          {{ name(target.id) }}
        </option>
      </select></label
    >
    <div v-for="z in encounter.zones ?? []" :key="z.id" class="complex-row">
      <strong>{{ localizedEntryName(z) }} · {{ name(z.sourceId) }} · DC {{ z.dc }}</strong>
      <span v-if="z.ammunition !== undefined" class="tag">{{ controlText('quantity.ammunition', {p0:(z.ammunition)}) }}</span>
      <p class="muted">
        {{ controlText('quantity.gmAreaCheck', {p0:(z.spellId === 'hunger-of-hadar'
            ? controlText('expressionOne.coldDamageAutomaticallyAtTargetTurnStartDexterity')
            : z.spellId === 'cordon-of-arrows'
              ? controlText('expressionOne.canTriggerOnFirstEntryAndTurnEnd')
              : controlText('expressionOne.atMostOncePerCreaturePerTurn'))}) }}</p>
      <label
        >{{ controlText('field.triggerTiming') }}<select v-model="zonePhase" :aria-label="controlText('field.areaTriggerTiming')">
          <option value="created">{{ controlText('state.areaAppears') }}</option>
          <option value="enter">{{ controlText('operations.firstEntry') }}</option>
          <option value="start">{{ controlText('operations.targetSTurnStartsHungerOfHadar') }}</option>
          <option value="end">{{ controlText('operations.targetSTurnEnds') }}</option>
          <option value="moved">{{ controlText('operations.areaMovesIntoTargetSSpace') }}</option>
        </select></label
      >
      <label class="check"
        ><input v-model="confirmed" type="checkbox" />{{ controlText('field.areaCoverageAndThisTriggerSTimingConfirmed') }}</label
      >
      <button
        :disabled="!can || !zoneTarget || !confirmed || !!encounter.pending"
        @click="
          emit('execute', {
            type: 'zone-trigger',
            actorId: z.sourceId,
            zoneId: z.id,
            targetId: zoneTarget,
            env: { ...env, areaConfirmed: confirmed },
            phase: zonePhase,
            note,
          })
        "
      >
        {{ controlText('operations.triggerForSelectedTarget') }}
      </button>
      <button
        :disabled="!can || !!encounter.pending"
        @click="emit('execute', { type: 'zone-end', actorId: z.sourceId, zoneId: z.id, note })"
      >
        {{ controlText('operations.endThisArea') }}
      </button>
    </div>
    <div
      v-for="z in (encounter.zones ?? []).filter((z) => z.spellId === 'cloud-of-daggers')"
      :key="z.id + '-move'"
      class="complex-row"
    >
      <label
        >{{ controlText('field.areaMovementDistance') }}<input v-model.number="zoneDistance" type="number" min="0" max="30" /></label
      ><button
        :disabled="!can || !!encounter.pending"
        @click="
          emit('execute', {
            type: 'zone-move',
            actorId: z.sourceId,
            zoneId: z.id,
            distance: zoneDistance,
            note,
          })
        "
      >
        {{ controlText('operations.magicActionToMoveCloudOfDaggers') }}
      </button>
    </div>
    <label
      v-if="
        encounter.actors.some(
          (a) => a.companion?.spellId === 'summon-fey' && !a.companion.dismissed,
        )
      "
      >{{ controlText('game.feyStepX') }}<input
        v-model.number="destination.x"
        type="number"
        min="0"
        max="79"
        :aria-label="controlText('game.feyStepX')" /></label
    ><label
      v-if="
        encounter.actors.some(
          (a) => a.companion?.spellId === 'summon-fey' && !a.companion.dismissed,
        )
      "
      >{{ controlText('game.landingYShort') }}<input
        v-model.number="destination.y"
        type="number"
        min="0"
        max="79"
        :aria-label="controlText('field.feyStepDestinationY')"
    /></label>
    <div v-for="a in encounter.actors.filter((a) => a.companion)" :key="a.id" class="complex-row">
      <span
        >{{ name(a.id) }} ·
        {{
          a.companion?.dismissed
            ? controlText('expressionOne.goneOrTransferredToALaterEncounter')
            : a.companion?.source === 'wild-companion'
              ? controlText('expressionOne.presentCannotAttack')
              : a.companion?.source === 'primal-companion'
                ? controlText('expressionOne.presentFollowsCommands')
                : a.companion?.source === 'wild-surge'
                  ? controlText('expressionOne.presentGmControlledWithSeparateInitiative')
                  : controlText('expressionOne.presentFollowsControllerSTurn')
        }}</span
      ><button
        v-if="!a.companion?.dismissed"
        :disabled="!can || !!encounter.pending"
        @click="
          emit('execute', {
            type: 'dismiss-companion',
            actorId: a.companion!.ownerId,
            targetId: a.id,
            note,
          })
        "
      >
        {{ controlText('operations.permanentlyDismissCompanion') }}
      </button>
      <button
        v-if="a.companion?.spellId === 'summon-fey' && !a.companion.dismissed"
        :disabled="!can || !!encounter.pending"
        @click="
          emit('execute', {
            type: 'companion-power',
            actorId: a.id,
            targetId: a.companion.form === 'mirthful' ? targetId : a.id,
            kind: 'fey-step',
            destination,
            env: { ...env, areaConfirmed: confirmed },
            note,
          })
        "
      >
        {{ controlText('state.feyStep') }}
      </button>
      <button
        v-if="a.companion?.form === 'putrid' && !a.companion.dismissed"
        :disabled="!can || !confirmed || !targetId || !!encounter.pending"
        @click="
          emit('execute', {
            type: 'companion-power',
            actorId: a.id,
            targetId,
            kind: 'putrid-aura',
            env: { ...env, areaConfirmed: confirmed },
            note,
          })
        "
      >
        {{ controlText('operations.targetSTurnStartsFesteringAura') }}
      </button>
    </div>
  </details>
</template>
<style scoped>
.complex-combat {
  padding: 14px;
  border: 1px solid var(--border, #ddd);
  border-radius: 14px;
  margin: 14px 0;
  min-width: 0;
}
.complex-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border, #ddd);
}
.complex-row p {
  width: 100%;
}
label {
  max-width: 100%;
}
input,
select {
  max-width: 100%;
}
summary {
  font-weight: 700;
  cursor: pointer;
  margin-bottom: 12px;
}
</style>
