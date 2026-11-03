<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {damageDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import type { NpcDirective } from '../core/ai-types'
import type { RoomView } from '../online/protocol'
import { DAMAGE_TYPES, DAMAGE_NAMES } from '../core/combat-types'
const props = defineProps<{ modelValue: NpcDirective; view: RoomView; npcId: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: NpcDirective] }>()
function set(key: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
function repeatTarget(id: string, event: Event) {
  const count = Math.min(
    20,
    Math.max(1, Math.floor(Number((event.target as HTMLInputElement).value) || 1)),
  )
  set('targets', [
    ...(props.modelValue.targets ?? []).filter((t) => t !== id),
    ...Array.from({ length: count }, () => id),
  ])
}
const names = {
  move: '移动',
  action: '使用动作',
  ability: '使用已配置能力',
  none: '仅回复',
  hostile: '转为敌对',
  'start-combat': '发起战斗',
  attack: '攻击',
  flee: '场景内逃跑',
  surrender: '声明投降',
  alert: '发出警报',
  promise: '作出承诺',
  trade: '交易',
  reveal: '公开线索',
}
</script>
<template>
  <div class="ai-form">
    <details v-if="modelValue.summon"><summary>{{ controlText('configuration.summoningParametersReviewedWithTheOriginalAbility') }}</summary><p>{{ controlText('liveSummary.formMaterials', {p0:(modelValue.summon.form),p1:(modelValue.summon.materialId||controlText('expressionTwo.noMonetaryConsumableForThisSpell'))}) }}</p><p v-if="modelValue.summon.corpseIds?.length">{{ controlText('liveSummary.actualRemains', {p0:(modelValue.summon.corpseIds.join('、'))}) }}</p><p v-if="modelValue.summon.maintainIds?.length">{{ controlText('liveSummary.renewControlOfOriginalEntity', {p0:(modelValue.summon.maintainIds.join('、'))}) }}</p><p>{{ controlText('configuration.usesConfiguredAbilitiesOnlyTheExistingServerStill') }}</p></details>
    <label
      >{{ controlText('domain.proposal') }}<select
        :aria-label="controlText('domain.proposal')"
        :value="modelValue.kind"
        @change="
          emit('update:modelValue', {
            kind: ($event.target as HTMLSelectElement).value as NpcDirective['kind'],
          })
        "
      >
        <option v-for="(name, key) in names" :key="key" :value="key">{{ uiLabel(name) }}</option>
      </select></label
    >
    <template v-if="modelValue.kind === 'attack'"
      ><label
        >{{ controlText('controls.target') }}<MapFieldPicker kind="entity"><select
          :value="modelValue.targetId"
          @change="set('targetId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ controlText('game.chooseTarget') }}</option>
          <option v-for="a in view.encounter?.actors" :key="a.id" :value="a.id">
            {{ localizedEntryName(a) }}
          </option>
        </select></MapFieldPicker></label
      ><label
        >{{ controlText('configurationField.npcAttack') }}<select
          :value="modelValue.attackId"
          @change="set('attackId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ controlText('configuration.chooseAttack') }}</option>
          <option
            v-for="a in view.encounter?.actors.find(
              (a) => a.id === view.ai.npcs.find((n) => n.id === npcId)?.actorId,
            )?.attacks"
            :key="a.id"
            :value="a.id"
          >
            {{ localizedEntryName(a) }}
          </option>
        </select></label
      ></template
    >
    <template v-if="modelValue.kind === 'flee' || modelValue.kind === 'move'"
      ><label
        >{{ controlText('configurationField.destinationX') }}<input
          type="number"
          min="0"
          max="79"
          :value="modelValue.destination?.x ?? 0"
          @input="
            set('destination', {
              x: Number(($event.target as HTMLInputElement).value),
              y: modelValue.destination?.y ?? 0,
            })
          " /></label
      ><label
        >{{ controlText('configurationField.destinationY') }}<input
          type="number"
          min="0"
          max="79"
          :value="modelValue.destination?.y ?? 0"
          @input="
            set('destination', {
              y: Number(($event.target as HTMLInputElement).value),
              x: modelValue.destination?.x ?? 0,
            })
          " /></label
    ></template>
    <label v-if="modelValue.kind === 'action'"
      >{{ controlText('configurationField.specificAction') }}<select
        :value="modelValue.action"
        @change="set('action', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ controlText('configuration.chooseAction') }}</option>
        <option value="dash">{{ controlText('state.dash') }}</option>
        <option value="disengage">{{ controlText('state.disengage') }}</option>
        <option value="dodge">{{ controlText('state.evade') }}</option>
        <option value="help">{{ controlText('domain.help') }}</option>
        <option value="ready">{{ controlText('state.prepare') }}</option>
        <option value="utilize">{{ controlText('domain.useItem') }}</option>
        <option value="hide">{{ controlText('configuration.hideGmConfirmsConditions') }}</option>
      </select></label
    >
    <label v-if="modelValue.kind === 'action' && modelValue.action === 'utilize'"
      >{{ controlText('domain.ownItems') }}
      <select
        :value="modelValue.itemId ?? ''"
        @change="set('itemId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ controlText('configuration.selectAnExistingItemEnteringOnlyUtilizeIs') }}</option>
        <option
          v-for="s in view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === npcId)
            ?.consumables ?? []"
          :key="s.id"
          :value="s.id"
        >
          {{ s.itemId }} ×{{ s.quantity }}
        </option>
        <option
          v-for="r in view.world?.characters.find(
            (c) =>
              c.id === view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === npcId)?.characterId,
          )?.inventory ?? []"
          :key="r.instanceId"
          :value="r.instanceId"
        >
          {{ r.itemId }} ×{{ r.quantity }}
        </option></select
      ><small>{{ controlText('configuration.automaticSupportInitiallyCoversDrinkingYourOwnHealing') }}</small>
    </label>
    <template v-if="modelValue.kind === 'ability'"
      ><label
        >{{ controlText('configurationField.configuredAbility') }}<select
          :value="modelValue.abilityId"
          @change="set('abilityId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ controlText('game.feature') }}</option>
          <option
            v-for="a in view.world?.adventures[0]?.ai?.npcs
              .find((n) => n.id === npcId)
              ?.abilities.filter((a) => a.enabled)"
            :key="a.id"
            :value="a.id"
          >
            {{ localizedEntryName(a) }} · {{ a.mode }}
          </option>
        </select></label
      ><label
        >{{ controlText('configurationField.amount') }}<input
          type="number"
          min="1"
          max="10000"
          :value="modelValue.amount ?? 1"
          @input="set('amount', Number(($event.target as HTMLInputElement).value))"
      /></label>
      <label
        >{{ controlText('configurationField.abilityDamageTypeChooseAccordingToSpell') }}<select
          :value="modelValue.damageType ?? 'force'"
          @change="set('damageType', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="type in DAMAGE_TYPES" :key="type" :value="type">
            {{ damageDisplayName(type) }}
          </option>
        </select></label
      >
      <fieldset>
        <legend>{{ controlText('game.featureTarget') }}</legend>
        <label v-for="a in view.encounter?.actors" :key="a.id" class="check"
          ><input
            type="checkbox"
            :checked="(modelValue.targets ?? []).includes(a.id)"
            @change="
              set(
                'targets',
                ($event.target as HTMLInputElement).checked
                  ? [...(modelValue.targets ?? []), a.id]
                  : (modelValue.targets ?? []).filter((id) => id !== a.id),
              )
            " />{{ localizedEntryName(a) }}
          <input
            v-if="(modelValue.targets ?? []).includes(a.id)"
            type="number"
            min="1"
            max="20"
            :aria-label="controlText('expressionTwo.targetUses') + localizedEntryName(a)"
            :value="(modelValue.targets ?? []).filter((id) => id === a.id).length"
            @input="repeatTarget(a.id, $event)"
        /></label>
        <p class="muted">
          {{ controlText('configuration.selectEachTargetOnceForOrdinaryAbilitiesFor') }}
        </p>
      </fieldset></template
    >
    <template v-if="modelValue.kind === 'trade'"
      ><label
        >{{ controlText('configurationField.stockItem') }}<select
          :value="modelValue.itemId"
          @change="set('itemId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ controlText('domain.stock') }}</option>
          <option
            v-for="s in view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === npcId)?.stock"
            :key="s.itemId"
            :value="s.itemId"
          >
            {{ controlText('liveSummary.stockGp', {p0:(s.itemId),p1:(s.quantity),p2:(s.priceGP)}) }}</option>
        </select></label
      ><label
        >{{ controlText('controls.quantity') }}<input
          type="number"
          min="1"
          :value="modelValue.quantity ?? 1"
          @input="set('quantity', Number(($event.target as HTMLInputElement).value))" /></label
      ><label
        >{{ controlText('configurationField.unitPriceGp') }}<input
          type="number"
          min="0"
          step="0.01"
          :value="modelValue.priceGP ?? 0"
          @input="set('priceGP', Number(($event.target as HTMLInputElement).value))" /></label
    ></template>
    <label v-if="modelValue.kind === 'reveal'"
      >{{ controlText('configurationField.publicClue') }}<select
        :value="modelValue.factId"
        @change="set('factId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ controlText('configuration.chooseClue') }}</option>
        <option
          v-for="s in view.world?.adventures[0]?.ai?.npcs.find((n) => n.id === npcId)?.secrets"
          :key="s.id"
          :value="s.id"
        >
          {{ s.text }}
        </option>
      </select></label
    >
    <label v-if="modelValue.kind !== 'none'"
      >{{ controlText('configurationField.actionNotes') }}<textarea
        :value="modelValue.detail ?? ''"
        maxlength="2000"
        @input="set('detail', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
  </div>
</template>
