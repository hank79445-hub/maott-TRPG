<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {isM5HitSpell} from '../core/spell-attack-windows'
import {isM5WorldSpell} from '../core/m5-spell-rules'
import { computed, ref, watch } from 'vue'
import type { Combatant, CombatCommand, Environment } from '../core/combat-types'
import { abilityAvailable } from '../core/npc-abilities'
import type {ControlSelection} from '../core/m2-social-controls'
import SupportSpellFields from './SupportSpellFields.vue'
const props = defineProps<{
  actor: Combatant
  targets: { id: string; name: string }[]
  environment: Environment
  busy: boolean
  ownTurn: boolean
  pending: boolean
  weapons?:{id:string;ownerId:string;name:string}[]
  zones?:{id:string;name:string}[]
  tick: number
}>()
const emit = defineEmits<{ command: [CombatCommand] }>()
const zoneId=ref(''),weaponId=ref(''),damageType=ref<'acid'|'cold'|'fire'|'lightning'|'thunder'|'radiant'>('fire')
const selected = ref(''),
  controlSelection = ref<ControlSelection>({}), supportChoice = ref(''), willing = ref(false),
  targets = ref<string[]>([]),
  confirmed = ref(false),
  note = ref(''),
  shape = ref<'imp' | 'rat' | 'raven' | 'spider'>('imp')
const ability = computed(() => props.actor.npc?.abilities?.find((a) => a.id === selected.value))
watch(
  () => [props.actor.id, props.tick, selected.value],
  () => {
    confirmed.value = false
    targets.value = []
  },
)
function use() {
  emit('command', {
    type: 'npc-ability',
    actorId: props.actor.id,
    abilityId: selected.value,
    targetIds:ability.value?.spellId==='dispel-magic'&&zoneId.value?[props.actor.id]:targets.value,dispelZoneId:ability.value?.spellId==='dispel-magic'?zoneId.value||undefined:undefined,
    env: { ...props.environment, areaConfirmed: confirmed.value },
    confirmed: confirmed.value,
    note: note.value,
    shape: shape.value,
    supportChoice: supportChoice.value || undefined,...controlSelection.value,
    willing: willing.value,weaponId:weaponId.value||undefined,damageType:ability.value?.spellId==='shillelagh'?(supportChoice.value==='force'?'force':undefined):damageType.value,
  })
}
function restore(resourceId?: string) {
  if (!note.value.trim()) return
  emit('command', {
    type: 'npc-resource-restore',
    actorId: props.actor.id,
    recovery: resourceId ? 'manual' : 'day',
    resourceId,
    note: note.value,
  })
}
</script>
<template>
  <details v-if="actor.npc?.abilities?.length" class="battle-card npc-monster-actions">
    <summary>{{ controlText('configuration.monsterAbilitiesSpellsAndResources') }}</summary>
    <p class="muted">
      {{ controlText('adjudication.spendsTheMonsterStatBlockSBudgetAnd') }}
    </p>
    <div v-for="r in actor.npc.resources ?? []" :key="r.id" class="room-row">
      <strong>{{ localizedEntryName(r) }} {{ r.remaining }}／{{ r.max }}</strong
      ><span>{{
        r.recovery === 'recharge'
          ? controlText('expressionTwo.recharge') + r.rechargeMin + controlText('expressionTwo.checkAtTurnStart')
          : r.recovery === 'day'
            ? controlText('expressionTwo.dailyRecovery')
            : controlText('expressionTwo.gmRecovery')
      }}</span>
      <button class="subtle" :disabled="busy || pending || !note.trim()" @click="restore(r.id)">
        {{ controlText('configuration.forceRestorationOfThisPool') }}
      </button>
    </div>
    <p v-if="actor.npc.concentration" role="status">
      {{ controlText('configurationField.concentration') }}{{ actor.npc.concentration.spellId
      }}<span v-if="actor.npc.concentration.pendingDC">{{ controlText('liveSummary.constitutionSavePendingDc', {p0:(actor.npc.concentration.pendingDC)}) }}</span
      >
      <button
        v-if="actor.npc.concentration.pendingDC"
        :disabled="busy || pending"
        @click="emit('command', { type: 'npc-concentration', actorId: actor.id })"
      >
        {{ controlText('configuration.npcConcentrationSave') }}
      </button>
      <button
        :disabled="busy || pending"
        @click="emit('command', { type: 'npc-concentration', actorId: actor.id, end: true })"
      >
        {{ controlText('configuration.endNpcConcentration') }}
      </button>
    </p>
    <label
      >{{ controlText('domain.chooseMonsterAbility') }}<select v-model="selected" :aria-label="controlText('domain.chooseMonsterAbility')" :disabled="busy || pending">
        <option value="">{{ controlText('game.feature') }}</option>
        <option
          v-for="a in actor.npc.abilities.filter((a) => a.cost !== 'reaction')"
          :key="a.id"
          :value="a.id"
        >
          {{ localizedEntryName(a) }} · {{ a.cost }} ·
          {{ a.support === 'automatic' ? controlText('expressionTwo.resolutionSupport') : a.support === 'gm' ? controlText('domain.gmAdjudication') : controlText('state.unsupported')
          }}{{ abilityAvailable(actor.npc!, a.id) ? '' : controlText('expressionTwo.unavailable') }}
        </option>
      </select></label
    >
    <template v-if="ability">
      <p v-if="isM5HitSpell(ability.spellId??'')" class="muted">{{ controlText('configuration.firstMakeAnActualWeaponAttackOrUnarmed') }}</p>
      <p v-if="isM5WorldSpell(ability.spellId??'')" class="muted">{{ controlText('configuration.selectThisNpcUnderOngoingSceneEffectsIn') }}</p>
      <label v-if="['true-strike','shillelagh','magic-weapon','elemental-weapon'].includes(ability.spellId??'')">{{ controlText('configurationField.actualWeaponInstance') }}<select v-model="weaponId"><option value="">{{ controlText('configuration.chooseARegisteredWeapon') }}</option><option v-for="w in (weapons??[]).filter(w=>['true-strike','shillelagh'].includes(ability!.spellId??'')?w.ownerId===actor.id:targets.includes(w.ownerId))" :key="w.ownerId+':'+w.id" :value="w.id">{{localizedEntryName(w)}}</option></select></label>
      <label v-if="['true-strike','elemental-weapon'].includes(ability.spellId??'')">{{ controlText('configurationField.damageChoice') }}<select v-model="damageType"><template v-if="ability.spellId==='true-strike'"><option value="fire">{{ controlText('configuration.useWeaponSOriginalType') }}</option><option value="radiant">{{ controlText('configuration.radiant') }}</option></template><template v-else><option value="acid">{{ controlText('domain.acid') }}</option><option value="cold">{{ controlText('domain.cold') }}</option><option value="fire">{{ controlText('domain.fire') }}</option><option value="lightning">{{ controlText('domain.lightning') }}</option><option value="thunder">{{ controlText('configuration.thunder') }}</option></template></select></label>
      <SupportSpellFields v-model:control="controlSelection" :targets="props.targets" :selected-ids="targets" :spell-id="ability.spellId" v-model:choice="supportChoice" v-model:willing="willing" />
      <label v-if="ability.spellId==='dispel-magic'">{{ controlText('configurationField.endTargetArea') }}<select v-model="zoneId"><option value="">{{ controlText('configuration.chooseAnEffectOnTheCharacterInstead') }}</option><option v-for="z in zones??[]" :key="z.id" :value="z.id">{{localizedEntryName(z)}}</option></select></label>
      <p>{{ ability.note }}</p>
      <label v-if="ability.id === 'shape-shift'"
        >{{ controlText('configurationField.impForm') }}<select v-model="shape">
          <option value="imp">{{ controlText('configuration.trueFormFly40Ft') }}</option>
          <option value="rat">{{ controlText('configuration.ratGround20Ft') }}</option>
          <option value="raven">{{ controlText('configuration.ravenFly60Ft') }}</option>
          <option value="spider">{{ controlText('configuration.spiderClimb20Ft') }}</option>
        </select></label
      >
      <fieldset v-if="ability.spellId">
        <legend>{{ controlText('configuration.targetList') }}</legend>
        <label v-for="t in props.targets" :key="t.id" class="check"
          ><input v-model="targets" type="checkbox" :value="t.id" :disabled="busy || pending" />{{
            localizedEntryName(t)
          }}</label
        >
      </fieldset>
      <label class="check"
        ><input
          v-model="confirmed"
          type="checkbox"
          :disabled="busy || pending"
        />{{ controlText('configurationField.gmConfirmsTargetRangeObscurationAndSourceRules') }}</label
      >
      <button
        :disabled="
          busy ||
          pending ||
          !ownTurn ||isM5HitSpell(ability.spellId??'')||isM5WorldSpell(ability.spellId??'')||
          !abilityAvailable(actor.npc, ability.id) ||
          (ability.cost !== 'none' && !actor.turn[ability.cost])
        "
        @click="use"
      >
        {{ controlText('configuration.useMonsterAbility') }}
      </button>
    </template>
    <label
      >{{ controlText('configurationField.monsterAbilityRecoveryReason') }}<input
        v-model="note"
        maxlength="2000"
        :placeholder="controlText('configurationField.dailyRecoveryPointOrGmVerifiedConditions')"
    /></label>
    <button class="subtle" :disabled="busy || pending || !note.trim()" @click="restore()">
      {{ controlText('configuration.gmAdvancesDailyResourceRecovery') }}
    </button>
    <small>{{ controlText('configuration.endingCombatRestingRefreshingOrChangingScenesDoes') }}</small>
  </details>
</template>
<style scoped>
.npc-monster-actions {
  overflow-wrap: anywhere;
}
.npc-monster-actions summary {
  min-height: 44px;
}
.npc-monster-actions fieldset {
  max-height: 220px;
  overflow: auto;
}
.npc-monster-actions label {
  display: block;
  margin: 8px 0;
}
.npc-monster-actions .check {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.npc-monster-actions .room-row {
  flex-wrap: wrap;
}
.npc-monster-actions input,
.npc-monster-actions select {
  max-width: 100%;
}
</style>
