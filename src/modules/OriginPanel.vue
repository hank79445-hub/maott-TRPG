<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import MapFieldPicker from "./map-selection/MapFieldPicker.vue"
import { computed, ref, watch } from 'vue'
import type { Character } from '../core/types'
import type { Catalogue } from '../core/engine'
import { featIds } from '../core/engine'
import { pbOf } from '../core/growth-rules'
import { runtimeState } from '../core/runtime'
import { craftingOptions, type OriginCommand } from '../core/origins'
const props = defineProps<{
  character: Character
  content: Catalogue
  people?: { id: string; name: string }[]
  busy?: boolean
}>()
const emit = defineEmits<{ execute: [command: OriginCommand] }>()
const r = computed(() => runtimeState(props.character, props.content)),
  feats = computed(() => featIds(props.character.build, props.content))
const target = ref(''),
  targets = ref<string[]>([]),
  kitId = ref(''),
  itemId = ref(''),
  mode = ref<OriginCommand['mode']>('wings'),
  confirmed = ref(false),
  reroll = ref(true),
  note = ref('')
const kits = computed(() =>
    props.character.inventory.filter((x) => x.itemId === 'healers-kit' && !x.containerId),
  ),
  crafts = computed(() => craftingOptions(props.character, props.content))
const people = computed(() => [
  { id: props.character.id, name: props.character.build.name },
  ...(props.people ?? []).filter((p) => p.id !== props.character.id),
])
watch(
  () => props.character.id,
  () => {
    target.value = props.character.id
    targets.value = []
    confirmed.value = false
  },
  { immediate: true },
)
watch(
  kits,
  (list) => {
    if (!list.some((x) => x.instanceId === kitId.value)) kitId.value = list[0]?.instanceId ?? ''
  },
  { immediate: true },
)
watch(
  crafts,
  (list) => {
    if (!list.some((x) => x.id === itemId.value)) itemId.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
const can = computed(() => !props.busy && confirmed.value && !!note.value.trim())
const available = computed(
  () =>
    ['healer', 'crafter', 'musician', 'chef', 'inspiring-leader'].some((id) =>
      feats.value.includes(id),
    ) || props.character.build.speciesId === 'aasimar',
)
function run(id: OriginCommand['id']) {
  emit('execute', {
    type: 'origin',
    id,
    targets: ['musician', 'chef-meal', 'inspiring-leader'].includes(id)
      ? targets.value
      : ['healer', 'healing-hands'].includes(id)
        ? [target.value]
        : [props.character.id],
    mode: mode.value,
    itemId: itemId.value,
    kitId: kitId.value,
    confirmed: confirmed.value,
    reroll: reroll.value,
    note: note.value,
  })
}
</script>
<template>
  <section v-if="available" class="origin-panel card" :aria-label="controlText('configurationField.originAndSpeciesAbilities')">
    <h3>{{ controlText('domain.partyOriginSpecies') }}</h3>
    <p class="muted">{{ controlText('workspace.phb2024TheGmConfirmsTargetsTriggersAnd') }}</p>
    <label
      >{{ controlText('domain.originAbilityBasis') }}<input
        v-model="note"
        :aria-label="controlText('domain.originAbilityBasis')"
        :placeholder="controlText('configurationField.describeConditionsSuchAsTouchCompletedRestOr')"
    /></label>
    <label class="check"
      ><input v-model="confirmed" type="checkbox" />{{ controlText('configurationField.actionDistanceTriggerAndTargetConditionsConfirmed') }}</label
    >
    <fieldset v-if="feats.includes('chef') || feats.includes('inspiring-leader')">
      <legend>{{ controlText('workspace.partyFeatTargetsAfterRest') }}</legend>
      <label v-for="p in people" :key="p.id" class="check"
        ><input v-model="targets" type="checkbox" :value="p.id" />{{ localizedEntryName(p) }}</label
      ><button v-if="feats.includes('chef')" :disabled="!can" @click="run('chef-meal')">{{ controlText('workspace.shortRestMealExtraD8PerRecipient') }}</button
      ><button
        v-if="feats.includes('inspiring-leader')"
        :disabled="!can"
        @click="run('inspiring-leader')"
      >{{ controlText('workspace.inspiringLeaderPartyTemporaryHp') }}</button>
    </fieldset>
    <template v-if="feats.includes('healer') || character.build.speciesId === 'aasimar'">
      <label
        >{{ controlText('configurationField.healingTarget') }}<MapFieldPicker kind="entity"><select v-model="target" :aria-label="controlText('configurationField.originHealingTarget')">
          <option v-for="p in people" :key="p.id" :value="p.id">{{ localizedEntryName(p) }}</option>
        </select></MapFieldPicker></label
      >
      <template v-if="feats.includes('healer')">
        <label
          >{{ controlText('configurationField.healerSKit') }}<select v-model="kitId" :aria-label="controlText('configurationField.healerSHealerSKit')">
            <option v-for="kit in kits" :key="kit.instanceId" :value="kit.instanceId">{{ controlText('liveSummary.healerSKitThisKitUsesKits', {p0:(kit.uses ?? 10),p1:(kit.quantity)}) }}</option>
          </select></label
        >
        <label class="check"
          ><input v-model="reroll" type="checkbox" />{{ controlText('configurationField.healerRerollsAHealingDieShowingOnce') }}</label
        >
        <button class="secondary" :disabled="!can || !kitId || !target" @click="run('healer')">{{ controlText('workspace.battleMedicTargetSpendsOneHitDie') }}</button>
        <p class="muted">{{ controlText('workspace.utilizeActionTouchATargetWithin5Ft') }}</p>
      </template>
      <button
        v-if="character.build.speciesId === 'aasimar'"
        class="secondary"
        :disabled="!can || !r.resources['healing-hands']"
        @click="run('healing-hands')"
      >{{ controlText('liveSummary.healingHands', {p0:(r.resources['healing-hands'] ?? 0)}) }}</button>
    </template>
    <template v-if="character.build.speciesId === 'aasimar' && character.level >= 3">
      <label
        >{{ controlText('game.revelation') }}<select v-model="mode" :aria-label="controlText('game.revelation')">
          <option value="wings">{{ controlText('domain.heavenlyWings') }}</option>
          <option value="radiance">{{ controlText('domain.innerRadiance') }}</option>
          <option value="shroud">{{ controlText('domain.necroticShroud') }}</option>
        </select></label
      >
      <p v-if="r.revelation" class="tag">{{ controlText('liveSummary.revelationEndsAtAdventureHour', {p0:(r.revelation.mode),p1:(r.revelation.endsAt.toFixed(4))}) }}</p>
      <button
        class="secondary"
        :disabled="!can || !!r.revelation || !r.resources['aasimar-revelation']"
        @click="run('revelation')"
      >{{ controlText('workspace.activateCelestialRevelationBonusAction') }}</button>
      <button class="subtle" :disabled="!can || !r.revelation" @click="run('end-revelation')">{{ controlText('workspace.endCelestialRevelation') }}</button>
      <p class="muted">{{ controlText('workspace.useTheCombatTableForExtraDamageEnd') }}</p>
    </template>
    <template v-if="feats.includes('crafter')">
      <p>{{ controlText('workspace.crafterAutomaticallyDiscountsNonmagicalPurchasesBy20The') }}</p>
      <label
        >{{ controlText('configurationField.fastCrafting') }}<select v-model="itemId" :aria-label="controlText('configurationField.fastCraftingEquipment')">
          <option v-for="item in crafts" :key="item.id" :value="item.id">{{ localizedEntryName(item) }}</option>
        </select></label
      >
      <button
        class="secondary"
        :disabled="!can || !itemId || r.lastRest?.kind !== 'long' || r.lastRest.crafted"
        @click="run('craft')"
      >{{ controlText('workspace.craftTemporaryEquipmentAfterALongRest') }}</button>
      <p class="muted">{{ controlText('workspace.aLongRestMustHaveJustFinishedWithout') }}</p>
    </template>
    <template v-if="feats.includes('musician')">
      <fieldset>
        <legend>{{ controlText('liveSummary.alliesWhoHearTheInspiringPerformanceLimit', {p0:(pbOf(character.build))}) }}</legend>
        <label v-for="p in people.filter((p) => p.id !== character.id)" :key="p.id" class="check"
          ><input v-model="targets" type="checkbox" :value="p.id" />{{ localizedEntryName(p) }}</label
        >
      </fieldset>
      <button
        class="secondary"
        :disabled="!can || !targets.length || !r.lastRest || r.lastRest.sang"
        @click="run('musician')"
      >{{ controlText('workspace.performAfterRestGrantHeroicInspiration') }}</button>
      <p class="muted">{{ controlText('workspace.possessAndUseAProficientMusicalInstrumentPerform') }}</p>
    </template>
  </section>
</template>
