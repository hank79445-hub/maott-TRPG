<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import { defaultMerchant, type MerchantPolicy } from '../../persistence/trade-schema'
const props = defineProps<{
    modelValue?: MerchantPolicy
    items: { id: string; name: string }[]
    disabled: boolean
  }>(),
  emit = defineEmits<{ 'update:modelValue': [MerchantPolicy] }>(),
  policy = computed(() => props.modelValue ?? defaultMerchant())
const patch = (v: Partial<MerchantPolicy>) => emit('update:modelValue', { ...policy.value, ...v })
function practical(v:Partial<NonNullable<MerchantPolicy['practical']>>){patch({practical:{enabled:false,scope:'listed',buyback:false,barter:false,negotiation:false,dc:15,cost:'free',...policy.value.practical,...v}})}
function multiple(event: Event, key: 'buyItems' | 'blockedItems') {
  patch({ [key]: [...(event.target as HTMLSelectElement).selectedOptions].map((o) => o.value) })
}
</script>
<template>
  <details class="merchant-policy">
    <summary>{{ controlText('resourceFlow.messageTradingAndBuyingPolicy') }}</summary>
    <fieldset :disabled="disabled">
      <label class="check"
        ><input
          type="checkbox"
          :checked="policy.enabled"
          @change="patch({ enabled: ($event.target as HTMLInputElement).checked })"
        />{{ controlText('remainingField.enableMessageTrading') }}</label
      ><label class="check"
        ><input
          type="checkbox"
          :checked="policy.buy"
          @change="patch({ buy: ($event.target as HTMLInputElement).checked })"
        />{{ controlText('remainingField.willingToBuyPlayerItems') }}</label
      ><label
        >{{ controlText('remainingField.referenceBuybackRatio') }}<input
          type="number"
          min="0"
          max="1"
          step=".05"
          :value="policy.buyRate"
          @change="patch({ buyRate: Number(($event.target as HTMLInputElement).value) })" /></label
      ><label
        >{{ controlText('remainingField.buybackScopeNoSelectionAcceptsPricedItemsNot') }}<select
          multiple
          size="4"
          :value="policy.buyItems"
          @change="multiple($event, 'buyItems')"
        >
          <option v-for="i in items" :key="i.id" :value="i.id">{{ localizedEntryName(i) }}</option>
        </select></label
      ><label
        >{{ controlText('remainingField.itemsProhibitedFromTradingIncludingKeyProps') }}<select
          multiple
          size="4"
          :value="policy.blockedItems"
          @change="multiple($event, 'blockedItems')"
        >
          <option v-for="i in items" :key="i.id" :value="i.id">{{ localizedEntryName(i) }}</option>
        </select></label
      ><label class="check"
        ><input
          type="checkbox"
          :checked="policy.autoPurchase"
          @change="patch({ autoPurchase: ($event.target as HTMLInputElement).checked })"
        />{{ controlText('remainingField.ordinaryPurchasesMayUseTheTradePreauthorizationConfigured') }}</label
      ><label class="check"
        ><input
          type="checkbox"
          :checked="policy.zeroPrice"
          @change="patch({ zeroPrice: ($event.target as HTMLInputElement).checked })"
        />{{ controlText('remainingField.explicitlyAllowZeroPriceGoods') }}</label
      >
      <p class="muted">
        {{ controlText('resourceFlow.buyingFromPlayersAndBarteringStillDefaultTo') }}
      </p>
      <details><summary>{{ controlText('resourceFlow.practicalReviewAutomaticBuyingBarteringAndFixedBargaining') }}</summary>
        <label><input type="checkbox" :checked="policy.practical?.enabled" @change="practical({enabled:($event.target as HTMLInputElement).checked})">{{ controlText('remainingField.enablePracticalPolicyForThisShop') }}</label>
        <template v-if="policy.practical">
          <label>{{ controlText('remainingField.authorizedPlayers') }}<select :value="policy.practical.scope" @change="practical({scope:($event.target as HTMLSelectElement).value as 'listed'|'all'})"><option value="listed">{{ controlText('resourceFlow.preauthorizedListBelowOnlyEmptyListGrantsNothing') }}</option><option value="all">{{ controlText('resourceFlow.explicitlyAuthorizeAllPlayersInThisRoom') }}</option></select></label>
          <label><input type="checkbox" :checked="policy.practical.buyback" @change="practical({buyback:($event.target as HTMLInputElement).checked})">{{ controlText('remainingField.allowAutomaticBuyingAtActualBuybackPrices') }}</label>
          <label><input type="checkbox" :checked="policy.practical.barter" @change="practical({barter:($event.target as HTMLInputElement).checked})">{{ controlText('remainingField.allowEqualValueBarter') }}</label>
          <label><input type="checkbox" :checked="policy.practical.negotiation" @change="practical({negotiation:($event.target as HTMLInputElement).checked})">{{ controlText('remainingField.automaticBargainingUnderFixedRules') }}</label>
          <label>{{ controlText('remainingField.bargainingDc') }}<input type="number" min="1" max="40" :value="policy.practical.dc" @change="practical({dc:Number(($event.target as HTMLInputElement).value)})"></label>
          <label>{{ controlText('remainingField.bargainingCost') }}<select :value="policy.practical.cost" @change="practical({cost:($event.target as HTMLSelectElement).value as 'free'|'action'|'bonus'})"><option value="free">{{ controlText('resourceFlow.free') }}</option><option value="action">{{ controlText('controls.action') }}</option><option value="bonus">{{ controlText('controls.bonus') }}</option></select></label>
          <p class="muted">{{ controlText('resourceFlow.tradeUseQuantityAndTotalValueLimitsStill') }}</p>
        </template>
      </details>
    </fieldset>
  </details>
</template>
<style scoped>
.merchant-policy fieldset {
  border: 0;
  padding: 10px 0;
  display: grid;
  gap: 9px;
}
.merchant-policy label {
  display: grid;
  gap: 4px;
}
.merchant-policy .check {
  display: flex;
  align-items: center;
  gap: 6px;
}
.merchant-policy select,
.merchant-policy input {
  min-width: 0;
  max-width: 100%;
}
.merchant-policy p {
  font-size: 12px;
  margin: 0;
}
</style>
