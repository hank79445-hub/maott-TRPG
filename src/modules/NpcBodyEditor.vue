<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import type { CombatNpc } from '../core/combat-types'
import { DAMAGE_NAMES } from '../core/combat-types'
import { customNpc } from '../core/combat-rules'
import { clone } from '../core/engine'
const props = defineProps<{ modelValue: CombatNpc | null; name: string; locked: boolean }>(),
  emit = defineEmits<{ 'update:modelValue': [value: CombatNpc] }>()
function create() {
  emit('update:modelValue', { ...customNpc(), name: props.name })
}
function revive() {
  if (!props.modelValue || props.locked || props.modelValue.hp <= 0) return
  emit('update:modelValue', { ...clone(props.modelValue), dead: false })
}
function add() {
  props.modelValue?.attacks.push({ ...customNpc().attacks[0]!, id: crypto.randomUUID() })
}
function removeAttack(index: number) {
  const id = props.modelValue?.attacks[index]?.id
  props.modelValue?.attacks.splice(index, 1)
  if (props.modelValue?.multiattack) {
    props.modelValue.multiattack = props.modelValue.multiattack.filter((v) => v !== id)
    if (!props.modelValue.multiattack.length) delete props.modelValue.multiattack
  }
  if (props.modelValue?.multiattackChoice) {
    props.modelValue.multiattackChoice.attackIds =
      props.modelValue.multiattackChoice.attackIds.filter((v) => v !== id)
    if (!props.modelValue.multiattackChoice.attackIds.length)
      delete props.modelValue.multiattackChoice
  }
}
function removeMultiattack(index: number) {
  props.modelValue?.multiattack?.splice(index, 1)
  if (props.modelValue?.multiattack && !props.modelValue.multiattack.length)
    delete props.modelValue.multiattack
}
function flag(key: 'nimbleEscape' | 'bloodiedFury' | 'undeadFortitude', event: Event) {
  if (props.modelValue)
    emit('update:modelValue', {
      ...clone(props.modelValue),
      [key]: (event.target as HTMLInputElement).checked,
    })
}
</script>
<template>
  <fieldset class="ai-wide">
    <legend>{{ controlText('configuration.simpleNpcStatBlock') }}</legend>
    <p v-if="locked" class="muted">
      {{ controlText('configuration.thisNpcIsInCombatPreparationOrCombat') }}
    </p>
    <button v-if="!modelValue" type="button" class="subtle" :disabled="locked" @click="create">
      {{ controlText('configuration.createQuickStatBlock') }}
    </button>
    <fieldset v-if="modelValue" :disabled="locked" class="ai-form">
      <label
        >{{ controlText('game.creatureType') }}<select v-model="modelValue.creatureType">
          <option :value="undefined">{{ controlText('game.gmCheck') }}</option>
          <option value="humanoid">{{ controlText('game.humanoid') }}</option>
          <option value="beast">{{ controlText('game.beast') }}</option>
          <option value="monstrosity">{{ controlText('game.monstrosity') }}</option>
          <option value="fey">{{ controlText('game.fey') }}</option>
          <option value="fiend">{{ controlText('game.fiend') }}</option>
          <option value="undead">{{ controlText('game.undead') }}</option>
          <option value="giant">{{ controlText('configuration.giants') }}</option>
          <option value="other">{{ controlText('game.other') }}</option>
        </select></label
      >
      <label>AC<input v-model.number="modelValue.ac" type="number" min="0" max="100" /></label
      ><label
        >{{ controlText('domain.size') }}<select v-model="modelValue.size">
          <option value="tiny">{{ controlText('domain.tiny') }}</option>
          <option value="small">{{ controlText('domain.sizeSmall') }}</option>
          <option value="medium">{{ controlText('domain.sizeMedium') }}</option>
          <option value="large">{{ controlText('domain.sizeLarge') }}</option>
          <option value="huge">{{ controlText('domain.sizeHuge') }}</option>
          <option value="gargantuan">{{ controlText('domain.sizeGargantuan') }}</option>
        </select></label
      ><label
        >{{ controlText('domain.maxHP') }}<input
          v-model.number="modelValue.maxHp"
          type="number"
          min="1"
          max="100000" /></label
      ><label
        >{{ controlText('configurationField.currentHp') }}<input v-model.number="modelValue.hp" type="number" min="0" :max="modelValue.maxHp"
      /></label>
      <div v-if="modelValue.dead" class="ai-wide">
        <strong>{{ controlText('state.dead') }}</strong>
        <p>{{ controlText('configuration.toReviveEnterHpGreaterThanZeroAnd') }}</p>
        <button type="button" :disabled="locked || modelValue.hp <= 0" @click="revive">
          {{ controlText('configuration.gmConfirmsRevivalClearsDeathStatus') }}
        </button>
      </div>
      <label
        >{{ controlText('game.speed') }}<input
          v-model.number="modelValue.speed"
          type="number"
          min="0"
          max="300" /></label
      ><label
        >{{ controlText('domain.initiativeBonus') }}<input
          v-model.number="modelValue.initiativeBonus"
          type="number"
          min="-100"
          max="100" /></label
      ><label v-for="(_, key) in modelValue.scores" :key="key"
        >{{ key }} {{ controlText('game.abilities') }}<input
          v-model.number="modelValue.scores[key]"
          type="number"
          min="1"
          max="30"
      /></label>
      <div class="ai-wide">
        <h4>{{ controlText('configuration.attackOptions') }}</h4>
        <fieldset v-for="(attack, index) in modelValue.attacks" :key="attack.id" class="ai-form">
          <label>{{ controlText('game.attackName') }}<input v-model="attack.name" maxlength="120" /></label
          ><label
            >{{ controlText('domain.hitBonus') }}<input v-model.number="attack.bonus" type="number" min="-30" max="50" /></label
          ><label>{{ controlText('game.damageFormula') }}<input v-model="attack.damage" maxlength="100" /></label
          ><label
            >{{ controlText('game.damageType') }}<select v-model="attack.damageType">
              <option v-for="(name, id) in DAMAGE_NAMES" :key="id" :value="id">{{ uiLabel(name) }}</option>
            </select></label
          ><label
            >{{ controlText('configurationField.reachFt') }}<input
              v-model.number="attack.reach"
              type="number"
              min="0"
              max="300" /></label
          ><label
            >{{ controlText('configurationField.attackCategory') }}<select v-model="attack.kind">
              <option value="weapon">{{ controlText('domain.weapon') }}</option>
              <option value="thrown">{{ controlText('configuration.thrownWeapon') }}</option>
              <option value="spell">{{ controlText('game.spellAttack') }}</option>
            </select></label
          ><label
            >{{ controlText('configurationField.projectileCategory') }}<select v-model="attack.projectile"><option :value="undefined">{{ controlText('configuration.unverifiedConfirmBeforeCrossingWindWall') }}</option><option value="ordinary">{{ controlText('configuration.ordinaryArrowBoltProjectile') }}</option><option value="massive">{{ controlText('configuration.boulderSiegeProjectile') }}</option><option value="energy">{{ controlText('configuration.energySpellAttack') }}</option></select></label><label>{{ controlText('configurationField.rangeFtForMelee') }}<input
              v-model.number="attack.range"
              type="number"
              min="0"
              max="2000" /></label
          ><label
            >{{ controlText('configurationField.longRangeFt') }}<input v-model.number="attack.longRange" type="number" min="0" max="2000"
          /></label>
          <details class="ai-wide">
            <summary>{{ controlText('configuration.additionalDamageAndEffects') }}</summary>
            <div v-for="(part, i) in attack.extraDamage ?? []" :key="i" class="ai-form">
              <label>{{ controlText('configurationField.extraDamageFormula') }}<input v-model="part.formula" maxlength="100" /></label
              ><label
                >{{ controlText('configurationField.extraDamageType') }}<select v-model="part.type">
                  <option v-for="(name, id) in DAMAGE_NAMES" :key="id" :value="id">
                    {{ uiLabel(name) }}
                  </option>
                </select></label
              ><label
                >{{ controlText('domain.extraDamage') }}<select v-model="part.when" :aria-label="controlText('domain.extraDamage')">
                  <option :value="undefined">{{ controlText('configuration.noAdditionalCondition') }}</option>
                  <option value="advantage">{{ controlText('configuration.theActualCheckHasAdvantage') }}</option>
                  <option value="charge">{{ controlText('configuration.gmConfirmsAChargeAndAMediumOr') }}</option>
                </select></label
              >
              <button type="button" class="subtle" @click="attack.extraDamage?.splice(i, 1)">
                {{ controlText('configuration.removeThisDamage') }}
              </button>
            </div>
            <button
              type="button"
              class="subtle"
              :disabled="(attack.extraDamage?.length ?? 0) >= 3"
              @click="(attack.extraDamage ??= []).push({ formula: '1d6', type: 'necrotic' })"
            >
              {{ controlText('configuration.addExtraDamage') }}</button
            ><label
              >{{ controlText('configurationField.additionalEffectGmRuling') }}<textarea v-model="attack.effectNote" maxlength="2000" /></label
            ><label class="check"
              ><input v-model="attack.manualOnly" type="checkbox" />{{ controlText('configurationField.thisAttackIsManuallyUsedByTheGm') }}</label
            >
          </details>
          <button type="button" class="subtle" @click="removeAttack(index)">{{ controlText('configuration.removeAttack') }}</button>
        </fieldset>
        <button
          type="button"
          class="subtle"
          :disabled="modelValue.attacks.length >= 8"
          @click="add"
        >
          {{ controlText('configuration.addAttackOption') }}
        </button>
        <details>
          <summary>{{ controlText('configuration.multiattackAndGroupTactics') }}</summary>
          <p v-if="modelValue.multiattackChoice">{{ controlText('liveSummary.anyCombinationUsesKeepReferencesValidWhen', {p0:(modelValue.multiattackChoice.count),p1:(modelValue.multiattackChoice.attackIds
                .map((id) => localizedEntryName(modelValue!.attacks.find((a) => a.id === id)) ?? id)
                .join('／'))}) }}</p>
          <label class="check"
            ><input
              :checked="modelValue.nimbleEscape"
              type="checkbox"
              @change="flag('nimbleEscape', $event)"
            />{{ controlText('configurationField.nimbleEscapeBonusActionDisengageGmHandlesHide') }}</label
          >
          <label class="check"
            ><input
              :checked="modelValue.bloodiedFury"
              type="checkbox"
              @change="flag('bloodiedFury', $event)"
            />{{ controlText('configurationField.bloodFrenzyAttackAdvantageAgainstInjuredTargets') }}</label
          >
          <label class="check"
            ><input
              :checked="modelValue.undeadFortitude"
              type="checkbox"
              @change="flag('undeadFortitude', $event)"
            />{{ controlText('configurationField.undeadFortitudeRadiantCriticalHitExceptions') }}</label
          >
          <label class="check"
            ><input
              v-model="modelValue.packTactics"
              type="checkbox"
            />{{ controlText('configurationField.packTacticsAttackAdvantageWithANonIncapacitated') }}</label
          >
          <div v-for="(_, i) in modelValue.multiattack ?? []" :key="i" class="room-row">
            <label
              >{{ controlText('configurationField.entry') }} {{ i + 1 }} {{ controlText('configurationField.attacks') }}<select v-model="modelValue.multiattack![i]">
                <option v-for="attack in modelValue.attacks" :key="attack.id" :value="attack.id">
                  {{ localizedEntryName(attack) }}
                </option>
              </select></label
            ><button type="button" class="subtle" @click="removeMultiattack(i)">{{ controlText('configuration.removeUseCount') }}</button>
          </div>
          <button
            type="button"
            class="subtle"
            :disabled="
              !!modelValue.multiattackChoice ||
              !modelValue.attacks.length ||
              (modelValue.multiattack?.length ?? 0) >= 8
            "
            @click="(modelValue.multiattack ??= []).push(modelValue.attacks[0]!.id)"
          >
            {{ controlText('configuration.addMultiattackUseCount') }}
          </button>
          <p class="muted">{{ controlText('configuration.spendsOneActionAndFollowsConfiguredAttackCounts') }}</p>
        </details>
      </div>
    </fieldset>
  </fieldset>
</template>
