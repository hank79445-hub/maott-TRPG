<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "../map-selection/MapFieldPicker.vue"
import { computed, ref, watch, nextTick, useTemplateRef } from 'vue'
import { focusDock } from '../dock-focus'
import type { RoomView, RoomCommand } from '../../online/protocol'
import { catalogue } from '../../core/engine'
import { srd } from '../../content/srd'
import { inventoryName } from '../../core/special-weapons'
import { inventoryTag } from '../../core/equipment'
import TradeItemList from './TradeItemList.vue'
import TradeOfferSummary from './TradeOfferSummary.vue'
const props = defineProps<{
    view: RoomView
    visible: boolean
    busy: boolean
    npcId?: string
    characterId?: string
    box: { x: number; y: number; width: number; height: number }
    submit: (c: RoomCommand) => Promise<boolean>
  }>(),
  emit = defineEmits<{ close: [] }>()
const panel = useTemplateRef<HTMLElement>('tradePanel')
watch(
  () => props.visible,
  (v) => {
    if (v)
      void nextTick(() => {
        focusDock(panel.value)
        panel.value?.focus({ preventScroll: true })
      })
  },
)
const npc = ref(''),
  character = ref(''),
  take = ref<Record<string, number>>({}),
  give = ref<Record<string, number>>({}),
  pay = ref(0),
  receive = ref(0),
  note = ref(''),
  skill = ref<'persuasion' | 'deception' | 'intimidation'>('persuasion'),
  goal = ref(''),
  localBusy = ref(false),
  notice = ref('')
const shops = computed(() => props.view.trade?.shops ?? []),
  characters = computed(() => props.view.ownCharacters.filter((c) => !c.npcOwnerId)),
  shop = computed(() => shops.value.find((s) => s.npcId === npc.value)),
  pc = computed(() => characters.value.find((c) => c.id === character.value)),
  cat = computed(() => catalogue([srd, ...props.view.packs]))
watch(
  () => props.view.id + ':' + props.view.self.id,
  () => {
    npc.value = props.npcId ?? ''
    character.value = props.characterId ?? characters.value[0]?.id ?? ''
    take.value = {}
    give.value = {}
    notice.value = ''
  },
  { immediate: true },
)
watch(
  () => props.npcId,
  (id) => {
    if (id && shops.value.some((s) => s.npcId === id)) npc.value = id
  },
)
watch(
  () => props.characterId,
  (id) => {
    if (id) character.value = id
  },
)
watch(
  shops,
  (rows) => {
    if (!npc.value && rows.length) npc.value = rows[0]!.npcId
  },
  { immediate: true },
)
const session = computed(() =>
  [...(props.view.trade?.sessions ?? [])]
    .reverse()
    .find((t) => t.characterId === character.value && t.npcId === npc.value),
)
watch(
  () => [session.value?.id, session.value?.version],
  () => {
    const t = session.value
    take.value = Object.fromEntries(t?.basket.take.map((r) => [r.stockId, r.quantity]) ?? [])
    give.value = Object.fromEntries(t?.basket.give.map((r) => [r.instanceId, r.quantity]) ?? [])
    pay.value = (t?.basket.playerPayCP ?? 0) / 100
    receive.value = (t?.basket.npcPayCP ?? 0) / 100
    note.value = t?.basket.note ?? ''
  },
  { immediate: true },
)
const waiting = computed(() => props.busy || localBusy.value),
  ended = computed(
    () => !session.value || ['committed', 'canceled', 'stale'].includes(session.value.status),
  )
const dirty = computed(() => {
  const t = session.value
  if (!t) return false
  const rows = (r: Record<string, number>) =>
    Object.entries(r)
      .filter(([, q]) => q > 0)
      .sort(([a], [b]) => a.localeCompare(b))
  return (
    JSON.stringify([
      rows(take.value),
      rows(give.value),
      Math.round(pay.value * 100),
      Math.round(receive.value * 100),
      note.value,
    ]) !==
    JSON.stringify([
      t.basket.take
        .map((r) => [r.stockId, r.quantity])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
      t.basket.give
        .map((r) => [r.instanceId, r.quantity])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
      t.basket.playerPayCP,
      t.basket.npcPayCP,
      t.basket.note,
    ])
  )
})
const stock = computed(
  () =>
    shop.value?.stock.map((r) => ({
      ...r,
      tag: inventoryTag(
        cat.value.items.find((i) => i.id === r.itemId) ?? ({ inventoryTag: 'misc' } as never),
      ),
    })) ?? [],
)
const inventory = computed(
  () =>
    pc.value?.inventory.map((row) => {
      const item = cat.value.items.find((i) => i.id === row.itemId),
        policy = shop.value?.policy,
        reason = row.equipped
          ? '请先卸下装备'
          : row.containerId
            ? '请先从容器取出'
            : pc.value!.inventory.some((i) => i.containerId === row.instanceId)
              ? '请先清空容器'
              : row.consumable || row.spellEnchantments?.length
                ? '持续或临时效果须GM处理'
                : policy?.blockedItems.includes(row.itemId) || /剧情|关键|quest/i.test(row.source)
                  ? '关键或禁止出售物品'
                  : !policy?.buy ||
                      (shop.value?.buyRestricted && !policy.buyItems.includes(row.itemId))
                    ? '对方不收购'
                    : !item
                      ? '缺少共享物品定义'
                      : ''
      return {
        id: row.instanceId,
        itemId: row.itemId,
        name: inventoryName(row, item?.name ?? row.itemId),
        quantity: row.quantity,
        tag: item ? inventoryTag(item) : 'misc',
        priceCP: item ? Math.floor(item.cost * 100 * (policy?.buyRate ?? 0)) : null,
        reason,
      }
    }) ?? [],
)
const selection = (rows: Record<string, number>, id: string, value: number) => ({
  ...rows,
  [id]: value,
})
async function run(operation: Record<string, unknown>) {
  localBusy.value = true
  notice.value = ''
  try {
    const ok = await props.submit({
      kind: 'trade',
      command: { branchId: props.view.broadcast.branchId, ...operation },
    } as RoomCommand)
    if (!ok) notice.value = '保存未完成，请查看错误提示；尚未交割。'
  } finally {
    localBusy.value = false
  }
}
function saveQuote() {
  if (!session.value) return
  void run({
    operation: 'quote',
    tradeId: session.value.id,
    version: session.value.version,
    basket: {
      take: Object.entries(take.value)
        .filter(([, q]) => q > 0)
        .map(([stockId, quantity]) => ({ stockId, quantity })),
      give: Object.entries(give.value)
        .filter(([, q]) => q > 0)
        .map(([instanceId, quantity]) => ({ instanceId, quantity })),
      playerPayCP: Math.round(pay.value * 100),
      npcPayCP: Math.round(receive.value * 100),
      note: note.value,
    },
  })
}
function act(operation: string) {
  if (session.value)
    void run({ operation, tradeId: session.value.id, version: session.value.version })
}
function suggestCoins() {
  const ask = stock.value.reduce((v, r) => v + (take.value[r.id] ?? 0) * r.priceCP, 0),
    bid = inventory.value.reduce((v, r) => v + (give.value[r.id] ?? 0) * (r.priceCP ?? 0), 0)
  pay.value = Math.max(0, ask - bid) / 100
  receive.value = Math.max(0, bid - ask) / 100
}
</script>
<template>
  <aside
    ref="tradePanel"
    data-trpg-dock="trade"
    tabindex="-1"
    v-show="visible"
    class="message-trade-dock"
    @pointerdown="focusDock(panel)"
    :style="{
      left: box.x + 'px',
      top: box.y + 'px',
      width: box.width + 'px',
      height: box.height + 'px',
    }"
    role="dialog"
    :aria-label="controlText('remainingField.messageTradeWindow')"
    @keydown.esc.stop="emit('close')"
  >
    <header>
      <strong>{{ controlText('scriptSummary.trade', {p0:(localizedEntryName(shop) ?? controlText('expressionFour.chooseNpc'))}) }}</strong
      ><button @click="emit('close')">{{ controlText('resourceFlow.returnToDialogueCollapse') }}</button>
    </header>
    <div class="trade-scroll">
      <div class="trade-target">
        <label
          >{{ controlText('remainingField.tradingPartner') }}<MapFieldPicker kind="entity"><select v-model="npc" :disabled="waiting">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="s in shops" :key="s.npcId" :value="s.npcId">{{ localizedEntryName(s) }}</option>
          </select></MapFieldPicker></label
        ><label
          >{{ controlText('remainingField.myCharacter') }}<select v-model="character" :disabled="waiting">
            <option v-for="c in characters" :key="c.id" :value="c.id">{{ localizedEntryName(c.build) }}</option>
          </select></label
        >
      </div>
      <button
        v-if="ended"
        :disabled="waiting || !shop || !pc"
        @click="run({ operation: 'open', npcId: npc, characterId: character })"
      >
        {{ session ? controlText('expressionFour.newTrade') : controlText('domain.offer') }}
      </button>
      <p v-if="!shops.length" class="muted">{{ controlText('resourceFlow.noKnownNpcCurrentlyOffersTrading') }}</p>
      <template v-if="session"
        ><p class="trade-state">
          {{
            session.status === 'committed'
              ? controlText('expressionFour.completed')
              : session.status === 'awaitingGM'
                ? controlText('state.waitingGmReview')
                : session.status === 'ready'
                  ? controlText('expressionFour.offerApprovedAwaitingFinalConfirmation')
                  : session.status === 'stale'
                    ? controlText('expressionFour.newOfferRequired')
                    : session.status === 'canceled'
                      ? controlText('ai.canceled')
                      : controlText('expressionFour.draftOffer')
          }}
          {{ controlText('room.version') }}{{ session.version }}
        </p>
        <TradeItemList
          :title="controlText('remainingField.otherPartyOffersForSale')"
          :items="stock"
          :selected="take"
          :busy="waiting || ended"
          @quantity="(id, q) => (take = selection(take, id, q))" />
        <p v-if="dirty" role="status">{{ controlText('resourceFlow.theListChangedTheSummaryBelowStillShows') }}</p>
        <TradeOfferSummary :session="session" />
        <fieldset :disabled="waiting || ended">
          <div class="trade-money">
            <label>{{ controlText('remainingField.iPayGp') }}<input v-model.number="pay" type="number" min="0" step=".01" /></label
            ><label
              >{{ controlText('remainingField.otherPartyPaysGp') }}<input v-model.number="receive" type="number" min="0" step=".01"
            /></label>
          </div>
          <small>{{ controlText('scriptSummary.myCoinsGpMerchantFundsArePrivate', {p0:(pc?.coins ?? 0)}) }}</small
          ><button @click="suggestCoins">{{ controlText('resourceFlow.calculateDifferenceFromOffer') }}</button
          ><label
            >{{ controlText('remainingField.bargainingGoalNotes') }}<input
              v-model="note"
              maxlength="500"
              :placeholder="controlText('remainingField.forExampleIWouldLikeToExchangeThis')" /></label
          ><button @click="saveQuote">{{ controlText('resourceFlow.saveUpdateOffer') }}</button>
          <div class="trade-actions">
            <button
              v-if="session.status === 'quoted'"
              :disabled="dirty"
              @click="!dirty && act('request')"
            >
              {{ controlText('resourceFlow.bothPartiesConfirmSubmitForReview') }}</button
            ><button
              v-if="session.status === 'ready'"
              class="primary"
              :disabled="dirty"
              @click="!dirty && act('commit')"
            >
              {{ controlText('resourceFlow.confirmTrade') }}</button
            ><button @click="act('cancel')">{{ controlText('resourceFlow.cancelTrade') }}</button>
          </div>
          <details v-if="['quoted', 'awaitingGM'].includes(session.status)">
            <summary>{{ controlText('resourceFlow.requestBargainingCheckDoesNotRollImmediately') }}</summary>
            <label
              >{{ controlText('game.skill') }}<select v-model="skill">
                <option value="persuasion">{{ controlText('game.persuasion') }}</option>
                <option value="deception">{{ controlText('game.deception') }}</option>
                <option value="intimidation">{{ controlText('game.intimidation') }}</option>
              </select></label
            ><label>{{ controlText('remainingField.desiredOutcome') }}<input v-model="goal" maxlength="500" /></label
            ><button
              :disabled="!goal.trim() || (!!session.negotiation && !session.negotiation.resetAt)"
              @click="
                run({
                  operation: 'negotiate',
                  tradeId: session.id,
                  version: session.version,
                  skill,
                  goal,
                })
              "
            >
              {{ controlText('resourceFlow.submitSeparateCheckRequest') }}
            </button>
          </details>
        </fieldset>
        <TradeItemList
          :title="controlText('remainingField.myInventoryTradableInstances')"
          :items="inventory"
          :selected="give"
          :busy="waiting || ended"
          @quantity="(id, q) => (give = selection(give, id, q))"
      /></template>
      <p v-if="notice" role="status">{{ notice }}</p>
      <p class="muted trade-help">
        {{ controlText('resourceFlow.collapsingDoesNotCancelSettlementHappensOnlyAfter') }}
      </p>
    </div>
  </aside>
</template>
<style scoped>
.message-trade-dock {
  position: fixed;
  z-index: 171;
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 16px);
  max-height: calc(100dvh - 16px);
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow);
  overflow: hidden;
  font-size: 12px;
}
.message-trade-dock > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 9px 11px;
  border-bottom: 1px solid var(--line);
}
.message-trade-dock > header strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.message-trade-dock button {
  font-size: 12px;
  min-height: 36px;
  padding: 6px 9px;
  background: var(--button-bg);
  border: 1px solid var(--button-border);
}
.message-trade-dock .primary {
  background: var(--accent);
  color: var(--panel);
}
.trade-scroll {
  overflow: auto;
  padding: 11px;
  overscroll-behavior: contain;
}
.trade-scroll fieldset {
  border: 0;
  margin: 10px 0;
  padding: 0;
  display: grid;
  gap: 8px;
  min-width: 0;
}
.trade-scroll label {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.trade-target,
.trade-money {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-bottom: 8px;
}
.trade-scroll input,
.trade-scroll select {
  width: 100%;
  min-width: 0;
  font-size: 12px;
}
.trade-scroll small {
  font-size: 11px;
  color: var(--muted);
}
.trade-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.trade-help {
  font-size: 11px;
}
.trade-state {
  color: var(--accent);
  font-size: 11px;
}
.trade-scroll details label {
  margin-block: 7px;
}
.message-trade-dock [hidden] {
  display: none;
}
@media (pointer: coarse) {
  .message-trade-dock button,
  .message-trade-dock input,
  .message-trade-dock select {
    min-height: 44px;
  }
}
</style>
