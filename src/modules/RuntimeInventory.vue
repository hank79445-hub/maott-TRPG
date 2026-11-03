<script setup lang="ts">
import {runtimeSpells} from '../core/runtime'
import {itemSpellDefinition} from '../core/item-spells'
import {itemCastText} from './item-spell-presentation'
const emit=defineEmits<{cast:[string]}>()
import {displayFeedback} from './feedback-presentation'
import {uiLabel} from './ui-label'
import {ruleText,ruleLabel,armorClassPresentation} from './rule-presentation'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { purchasePrice } from '../core/engine'
import { inventoryName } from '../core/special-weapons'
import SpecialWeaponEditor from './SpecialWeaponEditor.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type {
  Character,
  EquipmentSlot,
  Grip,
  InventoryItem,
  InventoryTag,
  Source,
} from '../core/types'
import { INVENTORY_TAGS, SRD_SOURCE } from '../core/types'
import { signed, type Catalogue } from '../core/engine'
import {
  assignedSlot,
  canUseTwoHands,
  compatibleSlots,
  equipmentLayout,
  gripOf,
  handSlot,
  inventoryGroups,
  inventoryTag,
  SLOT_NAMES,
  TAG_NAMES,
} from '../core/equipment'
import {
  applyRuntime,
  containerWeight,
  CONTAINERS,
  CONTAINER_VOLUMES,
  findItem,
  isContainer,
  runtimeDerived,
  type RuntimeCommand,
} from '../core/runtime'
import EquipmentGlyph from './EquipmentGlyph.vue'
import CharacterAvatar from './CharacterAvatar.vue'
import PortraitPicker from './PortraitPicker.vue'

const props = defineProps<{
  character: Character
  content: Catalogue
  pending: boolean
  active: boolean
  feedback: string
  failure: boolean
  allowGmConfiguration?: boolean
  run: (command: RuntimeCommand) => Promise<boolean>
}>()
const selectedSpell = computed(()=>runtimeSpells(props.character,props.content).find(g=>g.item?.instanceId===selectedRow.value?.instanceId&&!g.retired&&g.modes.length))
const d = computed(() => runtimeDerived(props.character, props.content))
const layout = computed(() => equipmentLayout(props.character, props.content))
const workspace = ref<HTMLElement | null>(null)
const slotCaption = (slot: EquipmentSlot) => {
  if (props.character.runtime?.grapples?.some((g) => g.hand === slot))
    return uiLabel('擒抱占用 · 先释放目标')!
  const rows = layout.value.slots[slot] ?? []
  return rows.length > 1
    ? controlText('confirmation.itemStackCaption',{name:inventoryName(rows[0]!, localizedEntryName(item(rows[0]!.itemId))),count:rows.length})
    : rows[0]
      ? inventoryName(rows[0], localizedEntryName(item(rows[0].itemId)))
      : uiLabel('空')!
}
const item = (id: string) => findItem(props.character, props.content, id)!
const propertyName = (p: string) => {
  const names: Record<string, string> = {
    finesse: '灵巧',
    heavy: '重型',
    light: '轻型',
    loading: '装填',
    reach: '延伸触及',
    'two-handed': '双手',
    'two-handed-unless-mounted': '双手（骑乘时例外）',
  }
  if (names[p]) return names[p]
  if (p.startsWith('versatile')) return '两用（双手 ' + p.slice(9) + '）'
  if (p.startsWith('ammunition')) return '弹药（射程 ' + p.slice(10) + ' 尺）'
  if (p.startsWith('thrown')) return '投掷（射程 ' + p.slice(6) + ' 尺）'
  return p
}
const incapacitated = computed(() => d.value.conditions.includes('incapacitated'))
const classEntry = computed(() =>
  props.content.classes.find((x) => x.id === props.character.build.classId),
)
const leftSlots: EquipmentSlot[] = ['head', 'cloak', 'armor']
const rightSlots: EquipmentSlot[] = ['hands', 'feet', 'accessories']
const mobileView = ref('equipment')
const search = ref(''),
  tag = ref<InventoryTag | '*'>('*'),
  location = ref('*')
const openTags = ref(new Set<InventoryTag>(['consumables']))
const groups = computed(() =>
  inventoryGroups(props.character, props.content, search.value, location.value),
)
const categories = computed(() =>
  INVENTORY_TAGS.map((id) => ({
    id,
    name: TAG_NAMES[id],
    groups: groups.value.filter((x) => x.tag === id),
  })).filter((x) => x.groups.length && (tag.value === '*' || tag.value === x.id)),
)
const inventoryCount = computed(() => props.character.inventory.filter((x) => !x.equipped).length)
const containers = computed(() =>
  props.character.inventory.filter((x) => x.quantity === 1 && isContainer(item(x.itemId))),
)
const locationName = (row: InventoryItem) =>
  row.containerId
    ? item(props.character.inventory.find((x) => x.instanceId === row.containerId)!.itemId).name
    : controlText('confirmation.carriedItems')
const sourceUrl = (s: Source) => {
  const url = s.url || (s.pack === SRD_SOURCE.pack ? SRD_SOURCE.url : undefined)
  if (!url || !/^https?:\/\//.test(url)) return undefined
  return /\.pdf(?:[?#]|$)/i.test(url) ? url.split('#')[0] + '#page=' + s.page : url
}
function toggleCategory(id: InventoryTag, event: Event) {
  const next = new Set(openTags.value)
  if ((event.target as HTMLDetailsElement).open) next.add(id)
  else next.delete(id)
  openTags.value = next
}
function filterTag(id: InventoryTag | '*') {
  tag.value = id
  if (id !== '*') openTags.value = new Set([...openTags.value, id])
}

const dialog = ref<HTMLDialogElement | null>(null)
const drawer = ref<'item' | 'slot' | 'add' | 'coins' | null>(null)
const selectedId = ref(''),
  candidateId = ref(''),
  chosenSlot = ref<EquipmentSlot>('armor')
const equipSlot = ref<EquipmentSlot>('main-hand'),
  grip = ref<Grip>('one-handed')
const amount = ref(1),
  note = ref(''),
  splitQuantity = ref(1)
const selectedRow = computed(() =>
  props.character.inventory.find(
    (x) => x.instanceId === (drawer.value === 'slot' ? candidateId.value : selectedId.value),
  ),
)
const selectedItem = computed(() =>
  selectedRow.value ? item(selectedRow.value.itemId) : undefined,
)
const slotOptions = computed(() => (selectedItem.value ? compatibleSlots(selectedItem.value) : []))
const candidates = computed(() =>
  props.character.inventory.filter((x) =>
    compatibleSlots(item(x.itemId)).includes(chosenSlot.value),
  ),
)
const currentSlotRows = computed(() => layout.value.slots[chosenSlot.value] ?? [])
const otherHandItem = computed(() =>
  handSlot(chosenSlot.value)
    ? layout.value.slots[chosenSlot.value === 'main-hand' ? 'off-hand' : 'main-hand']?.find(
        (x) => gripOf(props.character, props.content, x) === 'two-handed',
      )
    : undefined,
)
const drawerTitle = computed(() =>
  drawer.value === 'slot'
    ? controlText('confirmation.changeEquipmentSlot',{slot:uiLabel(SLOT_NAMES[chosenSlot.value])})
    : drawer.value === 'add'
      ? uiLabel('添加或购买物品')!
      : drawer.value === 'coins'
        ? uiLabel('金币收支')!
        : localizedEntryName(selectedItem.value) || uiLabel('物品详情')!,
)
function openItem(id: string) {
  selectedId.value = id
  drawer.value = 'item'
}
function openSlot(slot: EquipmentSlot) {
  chosenSlot.value = slot
  candidateId.value = ''
  drawer.value = 'slot'
}
function closeDrawer() {
  if (!props.pending) drawer.value = null
}
watch(drawer, async (value) => {
  await nextTick()
  if (value && props.active && !dialog.value?.open) dialog.value?.showModal()
  else if (!value && dialog.value?.open) dialog.value.close()
})
watch(
  () => props.active,
  (active) => {
    if (!active) drawer.value = null
  },
)
watch(
  () => props.character.id,
  () => {
    drawer.value = null
    search.value = ''
    tag.value = '*'
    location.value = '*'
    mobileView.value = 'equipment'
  },
)
watch(
  () => [selectedRow.value?.instanceId, drawer.value],
  () => {
    const row = selectedRow.value
    if (!row) return
    amount.value = 1
    splitQuantity.value = 1
    note.value = row.note
    const options = compatibleSlots(item(row.itemId))
    equipSlot.value =
      drawer.value === 'slot'
        ? chosenSlot.value
        : (assignedSlot(props.character, props.content, row) ??
          (item(row.itemId).kind === 'shield' ? 'off-hand' : options[0]) ??
          'main-hand')
    grip.value = row.equipped
      ? gripOf(props.character, props.content, row)
      : item(row.itemId).properties?.includes('two-handed')
        ? 'two-handed'
        : 'one-handed'
  },
)
watch(
  () => [selectedRow.value, props.pending],
  () => {
    if (!props.pending && ['item'].includes(drawer.value || '') && !selectedRow.value)
      drawer.value = null
  },
)
onBeforeUnmount(() => dialog.value?.close())
const equipCommand = computed<RuntimeCommand | null>(() =>
  props.active &&
  (drawer.value === 'item' || drawer.value === 'slot') &&
  selectedRow.value &&
  slotOptions.value.length
    ? {
        type: 'equip',
        instanceId: selectedRow.value.instanceId,
        equipped: true,
        slot: drawer.value === 'slot' ? chosenSlot.value : equipSlot.value,
        grip: handSlot(drawer.value === 'slot' ? chosenSlot.value : equipSlot.value)
          ? grip.value
          : undefined,
        takeOut: true,
      }
    : null,
)
const preview = computed(() => {
  if (!equipCommand.value) return null
  try {
    const next = applyRuntime(
      { ...props.character, journal: [] },
      props.content,
      equipCommand.value,
    )
    const after = runtimeDerived(next, props.content)
    return {
      ac: after.ac,
      attack: after.attacks.find((x) => x.instanceId === selectedRow.value!.instanceId),
      error: '',
    }
  } catch (e) {
    return { ac: d.value.ac, attack: undefined, error: e instanceof Error ? e.message : String(e) }
  }
})
async function equip() {
  const command = equipCommand.value
  if (command?.type === 'equip' && (await props.run(command))) {
    mobileView.value = 'equipment'
    closeDrawer()
    await nextTick()
    workspace.value?.querySelector<HTMLButtonElement>(`[data-slot="${command.slot}"]`)?.focus()
  }
}
async function remove(consume: boolean) {
  const row = selectedRow.value
  if (!row) return
  if (!consume && !window.confirm(controlText('confirmation.remove', {p0:(item(row.itemId).name),p1:(amount.value)}))) return
  await props.run({
    type: 'item-remove',
    instanceId: row.instanceId,
    quantity: amount.value,
    consume,
    note: note.value,
  })
}
const addSearch = ref(''),
  addId = ref(''),
  addQuantity = ref(1),
  purchase = ref(false),
  addNote = ref('')
async function move(event: Event) {
  const row = selectedRow.value
  if (!row) return
  const select = event.target as HTMLSelectElement
  if (
    !(await props.run({
      type: 'item-move',
      instanceId: row.instanceId,
      containerId: select.value || null,
    }))
  )
    select.value = row.containerId || ''
}
const selectedGroup = computed(() =>
  selectedRow.value
    ? inventoryGroups(props.character, props.content).find((x) =>
        x.rows.some((y) => y.instanceId === selectedRow.value!.instanceId),
      )
    : undefined,
)
const addOptions = computed(() =>
  [...props.content.items, ...props.character.build.customItems]
    .filter(
      (x) =>
        x.kind !== 'pack' &&
        `${x.name} ${x.english}`.toLowerCase().includes(addSearch.value.toLowerCase()),
    )
    .slice(0, 100),
)
const addCost = computed(() =>
  (
    (addId.value ? purchasePrice(props.character.build, props.content, item(addId.value)) : 0) *
    addQuantity.value
  ).toFixed(2),
)
async function add() {
  if (
    await props.run({
      type: 'item-add',
      itemId: addId.value,
      quantity: addQuantity.value,
      purchase: purchase.value,
      note: addNote.value,
    })
  ) {
    selectedId.value = props.character.inventory.at(-1)!.instanceId
    drawer.value = 'item'
  }
}
const coinAmount = ref(0),
  coinReason = ref('')
</script>

<template>
  <div ref="workspace" class="inventory-workspace">
    <div class="inventory-topbar">
      <div>
        <p class="eyebrow">EQUIPMENT & INVENTORY</p>
        <h3>{{ controlText('ai.inventoryTab') }}</h3>
      </div>
      <div class="inventory-balances">
        <span
          >{{ controlText('game.gold') }} <b data-testid="inventory-coins">{{ character.coins }} GP</b></span
        ><span :class="{ error: d.weight > d.capacity }"
          >{{ controlText('inventory.load') }} <b data-testid="inventory-weight">{{ d.weight }} / {{ d.capacity }} {{ controlText('game.pounds') }}</b></span
        >
      </div>
      <div class="inventory-toolbar">
        <button class="secondary" @click="drawer = 'add'">{{ controlText('inventory.addBuy') }}</button
        ><button class="text-button" @click="drawer = 'coins'">{{ controlText('inventory.goldChanges') }}</button>
      </div>
    </div>
    <div class="inventory-mobile-tabs" :aria-label="controlText('inventory.equipmentView')">
      <button :aria-pressed="mobileView === 'equipment'" @click="mobileView = 'equipment'">
        {{ controlText('game.equipped') }}</button
      ><button :aria-pressed="mobileView === 'bag'" @click="mobileView = 'bag'">
        {{ controlText('inventory.backpackItems') }} {{ inventoryCount }}
      </button>
    </div>
    <div class="inventory-columns">
      <section
        class="panel equipment-panel"
        :class="{ 'mobile-hidden': mobileView !== 'equipment' }"
        :aria-label="controlText('game.equipped')"
      >
        <div class="equipment-panel-heading">
          <h3>{{ controlText('game.equipped') }}</h3>
          <span class="small muted">{{ controlText('inventory.changeSlot') }}</span>
        </div>
        <div class="equipment-body">
          <div class="equipment-side">
            <button
              v-for="slot in leftSlots"
              :key="slot"
              class="equipment-slot"
              :class="{ occupied: layout.slots[slot]?.length }"
              :data-slot="slot"
              :aria-label="controlText('expressionThree.change') + uiLabel(SLOT_NAMES[slot])"
              @click="openSlot(slot)"
            >
              <EquipmentGlyph :name="slot" /><span class="slot-label">{{ uiLabel(SLOT_NAMES[slot]) }}</span
              ><b>{{ slotCaption(slot) }}</b>
            </button>
          </div>
          <div class="equipment-portrait">
            <PortraitPicker
              :portrait="character.portrait"
              :name="character.build.name"
              :disabled="pending"
              @change="run({ type: 'portrait-set', image: $event })"
            >
              <template #preview>
                <CharacterAvatar
                  class="portrait-art"
                  :name="character.build.name"
                  :portrait="character.portrait"
                  :size="92"
                />
                <span class="muted small"
                  >{{ localizedEntryName(classEntry) }} · LEVEL {{ character.level }}</span
                >
              </template>
            </PortraitPicker>
            <b class="portrait-name">{{ localizedEntryName(character.build) || controlText('expressionOne.unnamedAdventurer') }}</b>
            <button
              class="equipment-outfit"
              data-slot="clothing"
              :aria-label="controlText('inventory.changeClothes')"
              @click="openSlot('clothing')"
            >
              <EquipmentGlyph name="clothing" />{{
                layout.slots.clothing?.map((x) => localizedEntryName(item(x.itemId))).join('、') || controlText('expressionThree.chooseClothing')
              }}
            </button>
          </div>
          <div class="equipment-side">
            <button
              v-for="slot in rightSlots"
              :key="slot"
              class="equipment-slot"
              :class="{ occupied: layout.slots[slot]?.length }"
              :data-slot="slot"
              :aria-label="controlText('expressionThree.change') + uiLabel(SLOT_NAMES[slot])"
              @click="openSlot(slot)"
            >
              <EquipmentGlyph :name="slot" /><span class="slot-label">{{ uiLabel(SLOT_NAMES[slot]) }}</span
              ><b>{{ slotCaption(slot) }}</b>
            </button>
          </div>
        </div>
        <div class="equipment-held">
          <button
            v-for="slot in ['main-hand', 'off-hand'] as const"
            :key="slot"
            class="equipment-slot held-slot"
            :class="{ occupied: layout.slots[slot]?.length }"
            :data-slot="slot"
            :aria-label="controlText('expressionThree.change') + uiLabel(SLOT_NAMES[slot])"
            @click="openSlot(slot)"
          >
            <EquipmentGlyph :name="slot" /><span
              ><span class="slot-label">{{ uiLabel(SLOT_NAMES[slot]) }}</span
              ><b>{{
                layout.slots[slot]?.map((x) => inventoryName(x, localizedEntryName(item(x.itemId)))).join('、') ||
                (character.runtime?.grapples?.some((g) => g.hand === slot) ? controlText('expressionThree.occupiedByGrapple') : '') ||
                (layout.slots[slot === 'main-hand' ? 'off-hand' : 'main-hand']?.some(
                  (x) => gripOf(character, content, x) === 'two-handed',
                )
                  ? controlText('expressionThree.usedForTwoHandedGrip')
                  : controlText('expressionThree.free'))
              }}</b
              ><small v-for="row in layout.slots[slot]" :key="row.instanceId">{{
                gripOf(character, content, row) === 'two-handed' ? controlText('inventory.twoHands') : controlText('inventory.oneHand')
              }}</small></span
            >
          </button>
        </div>
        <div class="equipment-statline">
          <span
            >{{ controlText('controls.armor') }} <b data-testid="equipment-ac">{{ d.ac }}</b></span
          ><span>{{ armorClassPresentation(d.acSource,content) }}</span>
        </div>
        <div v-for="attack in d.attacks" :key="attack.instanceId" class="equipment-attack">
          <b>{{ localizedEntryName(attack.item) }}</b
          ><span>{{
            attack.ready
              ? controlText('expressionThree.attack') +
                signed(attack.bonus) +
                ' · ' +
                attack.damage +
                ' ' +
                attack.item.damageType
              : controlText('expressionOne.requiresTwoHandsToAttack')
          }}</span>
        </div>
        <p v-if="d.untrainedArmor" class="small error">
          {{ controlText('inventory.armorTraining') }}
        </p>
        <details v-if="layout.unplaced.length" class="equipment-legacy">
          <summary>{{ controlText('inventory.legacyEquipment') }} {{ layout.unplaced.length }}</summary>
          <p class="small muted">{{ controlText('inventory.legacyHint') }}</p>
          <button
            v-for="row in layout.unplaced"
            :key="row.instanceId"
            class="text-button"
            @click="openItem(row.instanceId)"
          >
            {{ controlText('progressSummary.view', {p0:(localizedEntryName(item(row.itemId)))}) }}</button>
        </details>
        <p class="equipment-hint">{{ controlText('inventory.clothingHint') }}</p>
      </section>
      <section
        class="panel backpack-panel"
        :class="{ 'mobile-hidden': mobileView !== 'bag' }"
        :aria-label="controlText('inventory.categories')"
      >
        <div class="equipment-panel-heading">
          <h3>
            {{ controlText('domain.inventoryItems') }} <span class="count">{{ controlText('quantity.itemCount', {p0:(inventoryCount)}) }}</span>
          </h3>
          <span class="small muted">{{ controlText('inventory.spares') }}</span>
        </div>
        <label class="bag-search"
          >{{ controlText('inventory.search') }}<input v-model="search" type="search" :placeholder="controlText('inventory.searchHint')"
        /></label>
        <label
          >{{ controlText('domain.storageFilter') }}<select v-model="location" :aria-label="controlText('domain.storageFilter')">
            <option value="*">{{ controlText('inventory.allLocations') }}</option>
            <option value="">{{ controlText('domain.carried') }}</option>
            <option
              v-for="container in containers"
              :key="container.instanceId"
              :value="container.instanceId"
            >
              {{ localizedEntryName(item(container.itemId)) }} · {{ container.instanceId.slice(-4) }}
            </option>
          </select></label
        >
        <div class="bag-tags" :aria-label="controlText('game.inventoryCategory')">
          <button :aria-pressed="tag === '*'" @click="filterTag('*')">{{ controlText('controls.all') }}</button
          ><button
            v-for="id in INVENTORY_TAGS"
            :key="id"
            :aria-pressed="tag === id"
            @click="filterTag(id)"
          >
            {{ uiLabel(TAG_NAMES[id]) }}
          </button>
        </div>
        <div class="bag-groups">
          <details
            v-for="category in categories"
            :key="category.id"
            class="bag-category"
            :data-category="category.id"
            :open="!!search.trim() || tag !== '*' || openTags.has(category.id)"
            @toggle="toggleCategory(category.id, $event)"
          >
            <summary>
              <EquipmentGlyph :name="category.id" /><b>{{ uiLabel(localizedEntryName(category)) }}</b
              ><span
                >{{ controlText('progressSummary.cellsItems', {p0:(category.groups.length),p1:(category.groups.reduce((n, x) => n + x.quantity, 0))}) }}</span
              >
            </summary>
            <div class="bag-grid">
              <button
                v-for="group in category.groups"
                :key="group.rows[0]!.instanceId"
                class="bag-item"
                :data-item="group.item.id"
                :aria-label="
                  controlText('expressionThree.viewItem') +
                  inventoryName(group.rows[0]!, localizedEntryName(group.item)) +
                  controlText('expressionThree.quantity') +
                  group.quantity
                "
                @click="openItem(group.rows[0]!.instanceId)"
              >
                <EquipmentGlyph :name="group.tag" /><span class="bag-quantity"
                  >×{{ group.quantity }}</span
                ><b>{{ inventoryName(group.rows[0]!, localizedEntryName(group.item)) }}</b
                ><small>{{ locationName(group.rows[0]!) }}</small>
              </button>
            </div>
          </details>
          <p v-if="!categories.length" class="bag-empty muted">
            {{ controlText('inventory.noMatches') }}
          </p>
        </div>
        <p class="equipment-hint">{{ controlText('inventory.categoryHint') }}</p>
      </section>
    </div>

    <dialog
      ref="dialog"
      class="inventory-drawer"
      aria-labelledby="inventory-drawer-title"
      @cancel.prevent="closeDrawer"
      @close="drawer = null"
    >
      <div class="drawer-heading">
        <div>
          <p class="eyebrow">CHARACTER INVENTORY</p>
          <h3 id="inventory-drawer-title">{{ drawerTitle }}</h3>
        </div>
        <button
          class="drawer-close"
          :aria-label="controlText('inventory.closeItem')"
          :disabled="pending"
          @click="closeDrawer"
        >
          ×
        </button>
      </div>
      <div v-if="drawer === 'slot'">
        <div v-for="row in currentSlotRows" :key="row.instanceId" class="slot-current">
          <EquipmentGlyph :name="chosenSlot" /><span
            >{{ controlText('inventory.current') }}<b>{{ inventoryName(row, localizedEntryName(item(row.itemId))) }}</b></span
          ><button
            class="text-button"
            :disabled="incapacitated"
            @click="run({ type: 'equip', instanceId: row.instanceId, equipped: false })"
          >
            {{ controlText('domain.unequip') }}
          </button>
        </div>
        <p v-if="!currentSlotRows.length && !otherHandItem" class="small muted">{{ controlText('inventory.emptySlot') }}</p>
        <div v-if="otherHandItem" class="slot-current">
          <span>{{ controlText('progressSummary.thisHandIsOccupiedByTheTwo', {p0:(localizedEntryName(item(otherHandItem.itemId)))}) }}</span
          ><button class="text-button" @click="openItem(otherHandItem.instanceId)">
            {{ controlText('inventory.changeGrip') }}
          </button>
        </div>
        <label
          >{{ controlText('domain.equipmentCandidates') }}<select v-model="candidateId" :aria-label="controlText('domain.equipmentCandidates')">
            <option value="">{{ controlText('inventory.chooseItem') }}</option>
            <option v-for="row in candidates" :key="row.instanceId" :value="row.instanceId">
              {{ inventoryName(row, localizedEntryName(item(row.itemId))) }} ·
              {{ row.equipped ? controlText('expressionThree.equipped') : locationName(row) }} ·
              {{ row.instanceId.slice(-4) }}
            </option>
          </select></label
        >
        <p v-if="!candidates.length" class="small muted">
          {{ controlText('inventory.noSlotItems') }}
        </p>
      </div>
      <div
        v-if="selectedRow && selectedItem && (drawer === 'item' || drawer === 'slot')"
        class="item-details"
        :data-detail-item="selectedItem.id"
      >
        <div class="item-detail-title">
          <EquipmentGlyph :name="inventoryTag(selectedItem)" />
          <div>
            <h4>{{ inventoryName(selectedRow, localizedEntryName(selectedItem)) }}</h4>
            <p>{{ selectedItem.english }}</p>
          </div>
          <span class="tag">×{{ selectedRow.quantity }}</span>
        </div>
        <div class="item-detail-meta">
          <span>{{ selectedItem.weight }} {{ controlText('inventory.weightEach') }}</span><span>{{ selectedItem.cost }} {{ controlText('inventory.goldEach') }}</span
          ><span>{{
            selectedRow.equipped
              ? controlText('expressionThree.equippedAlias114') +
                (assignedSlot(character, content, selectedRow)
                  ? uiLabel(SLOT_NAMES[assignedSlot(character, content, selectedRow)!])
                  : controlText('expressionThree.slotAwaitingConfirmation'))
              : controlText('expressionThree.storedIn') + locationName(selectedRow)
          }}</span>
        </div>
        <p class="small">
          {{ selectedItem.summary || controlText('expressionThree.theGmConfirmsThisItemSUseAnd') }}
        </p>
        <p v-if="selectedItem.damage" class="small">
          {{ controlText('inventory.baseDamage') }} {{ selectedItem.damage }} {{ selectedItem.damageType }}<br />{{ controlText('inventory.properties') }}{{
            selectedItem.properties?.map(propertyName).join('、') || controlText('controls.none')
          }}<span v-if="selectedItem.mastery"> {{ controlText('inventory.mastery') }} {{ selectedItem.mastery }}</span>
        </p>
        <SpecialWeaponEditor
          v-if="selectedItem.kind === 'weapon' && selectedRow.quantity === 1"
          :row="selectedRow"
          :base-name="selectedItem.name"
          :editable="!!allowGmConfiguration"
          :busy="pending"
          @save="
            (definition, reason) =>
              run({
                type: 'special-weapon',
                instanceId: selectedRow!.instanceId,
                definition,
                reason,
              })
          "
        />
        <p v-if="selectedItem.kind === 'armor'" class="small">
          {{ controlText('inventory.armorAc') }} {{ selectedItem.ac }} · {{ selectedItem.category
          }}<span v-if="selectedItem.strength"> {{ controlText('inventory.strengthRequired') }} {{ selectedItem.strength }}</span
          ><span v-if="selectedItem.stealthDisadvantage"> {{ controlText('inventory.stealthDisadvantage') }}</span>
        </p>
        <p class="small muted">{{ controlText('inventory.source') }}{{ selectedRow.source }}</p>
        <p class="small muted">
          <a
            v-if="sourceUrl(selectedItem.source)"
            :href="sourceUrl(selectedItem.source)"
            target="_blank"
            rel="noopener"
            >{{ selectedItem.source.pack }} · p.{{ selectedItem.source.page }}</a
          ><span v-else>{{ selectedItem.source.pack }} {{ controlText('inventory.customContent') }}</span>
        </p>
        <p v-if="selectedItem.id === 'healers-kit'">
          {{ controlText('inventory.kitRemaining') }} {{ selectedRow?.uses ?? 10 }} {{ controlText('inventory.kitTotal') }}{{
            selectedRow && selectedRow.quantity > 1
              ? controlText('expressionThree.plus') + (selectedRow.quantity - 1) + controlText('expressionThree.unusedKits')
              : ''
          }}
        </p>
        <p v-if="selectedRow?.craftedBy" class="muted">{{ controlText('inventory.temporaryGear') }}</p>
        <template v-if="slotOptions.length">
          <label v-if="drawer === 'item'"
            >{{ controlText('domain.equipmentSlot') }}<select v-model="equipSlot" :aria-label="controlText('domain.equipmentSlot')">
              <option v-for="slot in slotOptions" :key="slot" :value="slot">
                {{ uiLabel(SLOT_NAMES[slot]) }}
              </option>
            </select></label
          >
          <label v-if="handSlot(drawer === 'slot' ? chosenSlot : equipSlot)"
            >{{ controlText('domain.wielding') }}<select v-model="grip" :aria-label="controlText('domain.wielding')">
              <option value="one-handed">
                {{ controlText('inventory.oneHand') }}{{
                  selectedItem.properties?.includes('two-handed') ? controlText('expressionThree.attackRequiresTwoHands') : ''
                }}
              </option>
              <option v-if="canUseTwoHands(selectedItem)" value="two-handed">{{ controlText('inventory.twoHands') }}</option>
            </select></label
          >
          <p v-if="preview && !preview.error" class="equip-preview">
            {{ controlText('inventory.equipPreview') }} {{ d.ac }} → {{ preview.ac
            }}<span v-if="preview.attack"
              ><br />{{
                preview.attack.ready
                  ? controlText('expressionThree.attack') +
                    signed(preview.attack.bonus) +
                    ' · ' +
                    preview.attack.damage +
                    ' ' +
                    preview.attack.item.damageType
                  : controlText('expressionThree.canCurrentlyHoldOnlyAttackingRequiresTwoHands')
              }}</span
            >
          </p>
          <p v-if="preview?.error" class="small error" role="status">{{ displayFeedback(preview.error,'error') }}</p>
          <div class="runtime-actions">
            <button class="primary" :disabled="incapacitated || !!preview?.error" @click="equip">
              {{ selectedRow.containerId ? controlText('expressionThree.retrieveAndEquip') : controlText('expressionThree.equipUpdateGrip') }}</button
            ><button
              v-if="selectedRow.equipped && drawer === 'item'"
              class="text-button"
              :disabled="incapacitated"
              @click="run({ type: 'equip', instanceId: selectedRow.instanceId, equipped: false })"
            >
              {{ controlText('domain.unequip') }}
            </button>
          </div>
          <p
            v-if="selectedItem.properties?.includes('two-handed-unless-mounted')"
            class="small muted"
          >
            {{ controlText('inventory.lanceHint') }}
          </p>
          <button
            v-if="
              allowGmConfiguration && selectedItem.properties?.includes('two-handed-unless-mounted')
            "
            type="button"
            @click="
              run({
                type: 'mounted',
                active: !character.runtime?.mounted,
                reason: 'GM 核对当前骑乘状态',
              })
            "
          >
            {{ character.runtime?.mounted ? controlText('expressionThree.gmEndsRiding') : controlText('expressionThree.gmConfirmsRiding') }}
          </button>
          <p class="small muted">
            {{ controlText('inventory.equipHint') }}
          </p>
        </template>
        <button
          v-else-if="selectedRow.equipped"
          class="secondary"
          @click="run({ type: 'equip', instanceId: selectedRow.instanceId, equipped: false })"
        >
          {{ controlText('inventory.stowLegacy') }}
        </button>
        <template v-if="drawer === 'item'">
          <div v-if="selectedGroup && selectedGroup.rows.length > 1" class="visual-stack">
            <p class="small">{{ controlText('inventory.stackHint') }}</p>
            <label
              >{{ controlText('domain.itemEntry') }}<select v-model="selectedId" :aria-label="controlText('domain.itemEntry')">
                <option
                  v-for="row in selectedGroup.rows"
                  :key="row.instanceId"
                  :value="row.instanceId"
                >
                  ×{{ row.quantity }} · {{ row.instanceId.slice(-4) }}
                </option>
              </select></label
            >
          </div>
          <h4 class="detail-section-title">{{ controlText('inventory.storageUse') }}</h4>
          <label
            >{{ controlText('inventory.location') }}<select
              :value="selectedRow.containerId || ''"
              :aria-label="localizedEntryName(selectedItem) + controlText('inventory.location')"
              :disabled="incapacitated"
              @change="move"
            >
              <option value="">{{ controlText('domain.carried') }}</option>
              <option
                v-for="container in containers.filter(
                  (x) => x.instanceId !== selectedRow!.instanceId,
                )"
                :key="container.instanceId"
                :value="container.instanceId"
              >
                {{ localizedEntryName(item(container.itemId)) }} · {{ container.instanceId.slice(-4) }}
              </option>
            </select></label
          >
          <p v-if="isContainer(selectedItem)" class="small">
            {{ controlText('inventory.inContainer') }} {{ containerWeight(character, content, selectedRow.instanceId).toFixed(2) }} {{ controlText('game.pounds') }}{{
              CONTAINERS[selectedRow.itemId]
                ? controlText('expressionThree.capacity') + CONTAINERS[selectedRow.itemId] + controlText('expressionThree.lb')
                : ''
            }}；{{
              uiLabel(CONTAINER_VOLUMES[selectedRow.itemId]) || controlText('expressionThree.customCapacity')
            }}{{ controlText('inventory.capacityHint') }}
          </p>
          <label
            >{{ controlText('inventory.operationQuantity') }}<input
              v-model.number="amount"
              type="number"
              min="1"
              :max="selectedRow.quantity"
              :aria-label="localizedEntryName(selectedItem) + controlText('inventory.operationQuantity')"
          /></label>
          <label
            >{{ controlText('inventory.purpose') }}<input
              v-model="note"
              maxlength="2000"
              :placeholder="controlText('inventory.purposeHint')"
              :aria-label="localizedEntryName(selectedItem) + controlText('inventory.purpose')"
          /></label>
          <div class="runtime-actions">
            <button v-if="itemSpellDefinition(selectedItem,content)" class="secondary inventory-spell-cast" :disabled="incapacitated||!selectedSpell" :title="itemCastText(!!selectedSpell)" @click="emit('cast',selectedSpell!.key);closeDrawer()">{{itemCastText()}}</button>
            <button v-else class="secondary" :disabled="incapacitated" @click="remove(true)">
              {{
                selectedItem.id === 'healing-potion'
                  ? controlText('expressionThree.drinkPotionOfHealingAutomaticHealing')
                  : selectedItem.id === 'goodberry'
                    ? controlText('expressionThree.eatGoodberryBonusActionHp')
                  : selectedItem.id === 'chef-treat'
                    ? controlText('expressionThree.eatSnackBonusActionTemporaryHp')
                    : controlText('expressionThree.recordConsumption')
              }}</button
            ><button
              class="text-button"
              @click="run({ type: 'item-note', instanceId: selectedRow.instanceId, note })"
            >
              {{ controlText('inventory.saveNotes') }}</button
            ><button class="text-button danger" @click="remove(false)">{{ controlText('domain.removeItem') }}</button>
          </div>
          <p class="small muted">
            {{ controlText('inventory.consumableHint') }}
          </p>
          <details v-if="selectedRow.quantity > 1 && !selectedRow.equipped" class="split-details">
            <summary>{{ controlText('inventory.splitQuantity') }}</summary>
            <label
              >{{ controlText('inventory.splitCount') }}<input
                v-model.number="splitQuantity"
                type="number"
                min="1"
                :max="selectedRow.quantity - 1" /></label
            ><button
              class="secondary"
              @click="
                run({
                  type: 'item-split',
                  instanceId: selectedRow.instanceId,
                  quantity: splitQuantity,
                })
              "
            >
              {{ controlText('inventory.splitItem') }}
            </button>
            <p class="small muted">{{ controlText('inventory.splitHint') }}</p>
          </details>
        </template>
      </div>
      <form v-if="drawer === 'add'" @submit.prevent="add">
        <label>{{ controlText('inventory.searchAdd') }}<input v-model="addSearch" type="search" /></label
        ><label
          >{{ controlText('game.item') }}<select v-model="addId" :aria-label="controlText('game.item')">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="option in addOptions" :key="option.id" :value="option.id">
              {{ localizedEntryName(option) }} · {{ option.cost }} GP
            </option>
          </select></label
        ><label
          >{{ controlText('inventory.addQuantity') }}<input v-model.number="addQuantity" type="number" min="1" max="10000" /></label
        ><label class="inline-check"
          ><input v-model="purchase" type="checkbox" />{{ controlText('inventory.buyPrice') }}</label
        ><label
          >{{ controlText('inventory.sourceNotes') }}<input v-model="addNote" maxlength="2000" :placeholder="controlText('inventory.sourceHint')"
        /></label>
        <p v-if="purchase" class="equip-preview">
          {{ controlText('inventory.pay') }} {{ addCost }} {{ controlText('inventory.goldCurrent') }} {{ character.coins }} GP
        </p>
        <button class="primary" :disabled="!addId">{{ purchase ? controlText('expressionThree.buyItem') : controlText('domain.addItem') }}</button>
        <p class="small muted">{{ controlText('inventory.buyHint') }}</p>
      </form>
      <form
        v-if="drawer === 'coins'"
        @submit.prevent="run({ type: 'coins', amount: coinAmount, reason: coinReason })"
      >
        <p class="equip-preview">{{ controlText('inventory.currentGold') }} {{ character.coins }} GP</p>
        <label
          >{{ controlText('inventory.goldDelta') }}<input
            v-model.number="coinAmount"
            type="number"
            step="0.01" /></label
        ><label>{{ controlText('inventory.goldReason') }}<input v-model="coinReason" maxlength="2000" /></label
        ><button class="secondary">{{ controlText('inventory.recordGold') }}</button>
        <p class="small muted">
          {{ controlText('inventory.currencyHint') }}
        </p>
      </form>
      <p v-if="pending" class="small muted" role="status">{{ controlText('inventory.saving') }}</p>
      <p
        v-if="feedback"
        class="drawer-feedback"
        :class="{ error: failure }"
        :role="failure ? 'alert' : 'status'"
      >
        {{ feedback }}
      </p>
    </dialog>
  </div>
</template>
