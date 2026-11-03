<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import type { TradeSession } from '../../persistence/trade-schema'
defineProps<{ session?: TradeSession }>()
const gp = (cp: number | null) => (cp == null ? '待GM定价' : cp / 100 + ' GP')
</script>
<template>
  <section class="offer-summary" :aria-label="controlText('remainingField.exchangeListsAndValueComparison')">
    <template v-if="session"
      ><div class="offer-baskets">
        <div>
          <b>{{ controlText('resourceFlow.otherPartyGives') }}</b>
          <p v-for="r in session.take" :key="r.id">{{ localizedEntryName(r) }} ×{{ r.quantity }}</p>
          <p v-if="session.basket.npcPayCP">{{ controlText('game.gold') }} {{ gp(session.basket.npcPayCP) }}</p>
        </div>
        <span aria-hidden="true">⇄</span>
        <div>
          <b>{{ controlText('resourceFlow.iGive') }}</b>
          <p v-for="r in session.give" :key="r.id">{{ localizedEntryName(r) }} ×{{ r.quantity }}</p>
          <p v-if="session.basket.playerPayCP">{{ controlText('game.gold') }} {{ gp(session.basket.playerPayCP) }}</p>
        </div>
      </div>
      <p>{{ controlText('scriptSummary.npcItemPriceMyTradeInValue', {p0:(gp(session.askCP)),p1:(gp(session.bidCP))}) }}</p>
      <p>{{ controlText('scriptSummary.differenceAtThisShopSPrices', {p0:(gp(session.gapCP))}) }}</p>
      <details>
        <summary>{{ controlText('resourceFlow.catalogueReferencePriceNotTransactionPrice') }}</summary>
        <p v-for="r in [...session.take, ...session.give]" :key="r.id">
          {{ controlText('scriptSummary.each', {p0:(localizedEntryName(r)),p1:(gp(r.referenceCP))}) }}</p>
      </details>
      <p role="status">{{ session.reason }}</p>
      <p v-if="session.negotiation">{{ controlText('scriptSummary.bargainingCheck', {p0:(session.negotiation.status === 'resolved'
            ? (session.negotiation.success ? controlText('controls.success') : controlText('controls.failed')) + controlText('expressionFour.totalValue') + session.negotiation.total
            : controlText('expressionFour.awaitingGmRuling'))}) }}
      </p></template
    >
    <p v-else>{{ controlText('resourceFlow.selectBothPartiesItemsEnterAdditionalCoinsAnd') }}</p>
  </section>
</template>
<style scoped>
.offer-summary {
  font-size: 12px;
  padding: 12px 0;
  border-block: 1px solid var(--line);
}
.offer-baskets {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
}
.offer-baskets > div {
  align-self: stretch;
  padding: 9px;
  background: var(--surface);
  border-radius: 7px;
  overflow-wrap: anywhere;
}
.offer-summary p {
  margin: 7px 0;
}
.offer-summary [role='status'] {
  color: var(--accent);
}
.offer-summary summary {
  font-size: 11px;
}
</style>
