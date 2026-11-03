<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import type { Environment } from '../core/combat-types'
const model = defineModel<Environment>({ required: true })
</script>
<template>
  <div class="room-row">
    <label
      >{{ controlText('game.cover') }}<select v-model="model.cover" :aria-label="controlText('game.cover')">
        <option value="none">{{ controlText('controls.none') }}</option>
        <option value="half">{{ controlText('domain.halfCover') }}</option>
        <option value="three-quarters">{{ controlText('state.threeQuarterCover') }}</option>
        <option value="total">{{ controlText('state.totalCover') }}</option>
      </select></label
    >
    <label class="check"
      ><input v-model="model.attackerSees" type="checkbox" />{{ controlText('domain.actorSeesTarget') }}</label
    >
    <label class="check"><input v-model="model.targetSees" type="checkbox" />{{ controlText('domain.targetSeesActor') }}</label>
    <label class="check"><input v-model="model.nearbyEnemy" type="checkbox" />{{ controlText('domain.nearbyEnemy') }}</label>
    <label class="check"><input v-model="model.advantage" type="checkbox" />{{ controlText('domain.otherAdvantage') }}</label>
    <label class="check"
      ><input v-model="model.protectionActive" type="checkbox" />{{ controlText('interactionField.protectorRemainsWithinFtOfProtectedCreatureMap') }}</label
    >
    <label class="check"><input v-model="model.disadvantage" type="checkbox" />{{ controlText('domain.otherDisadvantage') }}</label>
    <label class="check"
      ><input
        v-model="model.crusaderActive"
        type="checkbox"
      />{{ controlText('interactionField.actorIsWithinFtOfAnAllyS') }}</label
    >
    <label class="check"><input v-model="model.fearVisible" type="checkbox" />{{ controlText('game.fearVisible') }}</label>
    <label class="check"
      ><input v-model="model.targetLocationConfirmed" type="checkbox" />{{ controlText('domain.targetPositionConfirmed') }}</label
    >
    <label class="check"
      ><input v-model="model.areaConfirmed" type="checkbox" />{{ controlText('domain.areaTargetsConfirmed') }}</label
    >
    <label class="room-environment-note"
      >{{ controlText('interactionField.environmentTriggerBasis') }}<input v-model="model.note" maxlength="2000"
    /></label>
  </div>
</template>
