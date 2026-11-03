<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { ref, watch } from 'vue'
import type { RoomView, RoomCommand } from '../../online/protocol'
import type { TradeSession } from '../../persistence/trade-schema'
import TradeOfferSummary from './TradeOfferSummary.vue'
const props = defineProps<{ view: RoomView; session: TradeSession; busy: boolean }>(),
  emit = defineEmits<{ command: [RoomCommand] }>()
const reason = ref('GM已核对清单、双方意愿和价格'),
  pay = ref(0),
  receive = ref(0),
  dc = ref(10),
  success = ref(0),
  cost = ref<'free' | 'action' | 'bonus'>('free'),
  prices = ref<Record<string, number>>({})
watch(
  () => props.session.id + ':' + props.session.version,
  () => {
    pay.value = props.session.basket.playerPayCP / 100
    receive.value = props.session.basket.npcPayCP / 100
    success.value = pay.value
    prices.value = Object.fromEntries(
      [...props.session.take, ...props.session.give].map((r) => [r.id, (r.valueCP ?? 0) / 100]),
    )
  },
  { immediate: true },
)
function command(op: Record<string, unknown>) {
  emit('command', {
    kind: 'trade',
    command: {
      branchId: props.view.broadcast.branchId,
      tradeId: props.session.id,
      version: props.session.version,
      ...op,
    },
  } as RoomCommand)
}
function review(decision: 'approve' | 'counter' | 'reject') {
  command({
    operation: 'review',
    decision,
    reason: reason.value,
    playerPayCP: Math.round(pay.value * 100),
    npcPayCP: Math.round(receive.value * 100),
    prices: Object.fromEntries(
      Object.entries(prices.value).map(([id, gp]) => [id, Math.round(gp * 100)]),
    ),
  })
}
</script>
<template>
  <article class="trade-review">
    <h4>{{ controlText('scriptSummary.tradeEntry52', {p0:(localizedEntryName(view.characters.find((c) => c.id === session.characterId)) ?? controlText('controls.character')),p1:(localizedEntryName(view.ai.npcs.find((n) => n.id === session.npcId)) ?? 'NPC')}) }}
    </h4>
    <TradeOfferSummary :session="session" />
    <fieldset :disabled="busy">
      <label
        v-for="r in [...session.take, ...session.give].filter((r) => r.valueCP === null)"
        :key="r.id"
        >{{ localizedEntryName(r) }}{{ controlText('remainingField.explicitUnitPriceGp') }}<input
          v-model.number="prices[r.id]"
          type="number"
          min="0"
          step=".01"
      /></label>
      <div class="trade-review-row">
        <label>{{ controlText('remainingField.iPayGp') }}<input v-model.number="pay" type="number" min="0" step=".01" /></label
        ><label>{{ controlText('remainingField.npcPaysGp') }}<input v-model.number="receive" type="number" min="0" step=".01" /></label>
      </div>
      <label>{{ controlText('game.basis') }}<input v-model="reason" maxlength="500" /></label>
      <div class="trade-review-row">
        <button :disabled="!reason.trim()" @click="review('approve')">{{ controlText('resourceFlow.approveOriginalOffer') }}</button
        ><button :disabled="!reason.trim()" @click="review('counter')">{{ controlText('resourceFlow.makeCounteroffer') }}</button
        ><button :disabled="!reason.trim()" @click="review('reject')">{{ controlText('resourceFlow.rejectTrade') }}</button>
      </div>
      <details v-if="session.negotiation?.status === 'requested'">
        <summary>{{ controlText('scriptSummary.bargainingCheckRuling', {p0:(session.negotiation.skill)}) }}</summary>
        <p>{{ session.negotiation.goal }}</p>
        <label>DC<input v-model.number="dc" type="number" min="1" max="40" /></label
        ><label
          >{{ controlText('remainingField.playerPaysGpAfterSuccess') }}<input v-model.number="success" type="number" min="0" step=".01" /></label
        ><label
          >{{ controlText('remainingField.explorationCost') }}<select v-model="cost">
            <option value="free">{{ controlText('resourceFlow.noActionCost') }}</option>
            <option value="action">{{ controlText('controls.action') }}</option>
            <option value="bonus">{{ controlText('game.bonus') }}</option>
          </select></label
        ><button
          @click="
            command({
              operation: 'roll',
              dc,
              cost,
              successPayCP: Math.round(success * 100),
              failurePayCP: Math.round(pay * 100),
            })
          "
        >
          {{ controlText('resourceFlow.confirmConditionsAndRollCheckRoomDiceMode') }}
        </button>
      </details>
      <button
        :disabled="!reason.trim()"
        @click="command({ operation: 'reset-negotiation', reason })"
      >
        {{ controlText('resourceFlow.explicitlyResetBargainingAttemptsForThisCharacterAnd') }}
      </button>
    </fieldset>
  </article>
</template>
<style scoped>
.trade-review {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
}
.trade-review h4 {
  margin: 0 0 8px;
}
.trade-review fieldset {
  border: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  min-width: 0;
}
.trade-review label {
  display: grid;
  gap: 3px;
}
.trade-review-row {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.trade-review-row label {
  flex: 1;
  min-width: 120px;
}
.trade-review input,
.trade-review select {
  max-width: 100%;
  min-width: 0;
}
.trade-review button {
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  min-height: 40px;
}
.trade-review details label {
  margin: 8px 0;
}
@media (pointer: coarse) {
  .trade-review button {
    min-height: 44px;
  }
}
</style>
