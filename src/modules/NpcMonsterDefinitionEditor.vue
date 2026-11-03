<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global

import type { CombatNpc } from '../core/combat-types'
defineProps<{ body: CombatNpc; disabled: boolean }>()
</script>
<template>
  <details v-if="body.attacks.length || body.abilities?.length || body.resources?.length" class="ai-wide">
    <summary>{{ controlText('configuration.monsterAbilitiesAndInitialResources') }}</summary>
    <p class="muted">
      {{ controlText('adjudication.abilitySourcesRemainInTheDataSnapshotEdits') }}
    </p>
    <fieldset :disabled="disabled" class="ai-form">
      <label v-for="attack in body.attacks" :key="attack.id">{{localizedEntryName(attack)}} {{ controlText('configurationField.attackAbility') }}<select v-model="attack.ability"><option :value="undefined">{{ controlText('configuration.unregisteredGmVerificationRequired') }}</option><option v-for="(label,id) in {str:'力量',dex:'敏捷',con:'体质',int:'智力',wis:'感知',cha:'魅力'}" :key="id" :value="id">{{label}}</option></select></label>
      <label v-for="attack in body.attacks" :key="'unarmed-'+attack.id"><input v-model="attack.unarmed" type="checkbox">{{localizedEntryName(attack)}} {{ controlText('configurationField.explicitUnarmedStrikeNotInferredFromNameNo') }}</label>
      <label v-for="r in body.resources ?? []" :key="r.id"
        >{{ localizedEntryName(r) }}{{ controlText('configurationField.maximumUses') }}<input
          v-model.number="r.max"
          type="number"
          min="1"
          max="100"
          @change="r.remaining = Math.min(r.remaining, r.max)"
        /><small
          >{{ controlText('liveSummary.spellsShareThisPoolWithoutAddingDuplicate', {p0:(r.recovery === 'recharge'
              ? controlText('expressionTwo.recharge') + r.rechargeMin + '–6'
              : r.recovery === 'day'
                ? controlText('expressionTwo.dailyResourcePool')
                : controlText('expressionTwo.gmRecoveryPool'))}) }}</small
        ></label
      >
      <div v-for="a in body.abilities ?? []" :key="a.id">
        <strong>{{ localizedEntryName(a) }}</strong
        ><span>
          · {{ a.cost }} · {{ a.resourceId ? controlText('expressionTwo.shared') + a.resourceId : controlText('expressionTwo.atWill') }} ·
          {{
            a.support === 'automatic' ? controlText('expressionTwo.effectSupport') : a.support === 'gm' ? controlText('domain.gmAdjudication') : controlText('expressionTwo.unsupported')
          }}</span
        ><label>{{ controlText('configurationField.additionalAbilityNotes') }}<textarea v-model="a.note" maxlength="4000" /></label>
      </div>
    </fieldset>
  </details>
</template>
