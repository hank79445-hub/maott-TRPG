<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {damageDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { ref, watch } from 'vue'
import { clone } from '../core/engine'
import type { InventoryItem, SpecialWeapon } from '../core/types'
import { SPECIAL_WEAPONS, validateSpecialWeapon } from '../core/special-weapons'
import { DAMAGE_TYPES, DAMAGE_NAMES } from '../core/combat-types'
const props = defineProps<{
  row: InventoryItem
  baseName: string
  editable: boolean
  busy: boolean
}>()
const emit = defineEmits<{ save: [definition: SpecialWeapon | null, reason: string] }>()
const draft = ref<SpecialWeapon>(),
  error = ref(''),
  reason = ref('GM 配发特殊武器'),
  preset = ref('')
const damageCaption = (w: SpecialWeapon) =>
  w.extraDamage.map((d) => d.formula + ' ' + DAMAGE_NAMES[d.type]).join('、') || '无'
function reset() {
  draft.value = clone(
    props.row.specialWeapon ?? {
      templateId: 'custom/' + crypto.randomUUID(),
      version: 1,
      name: props.baseName,
      description: '',
      attackBonus: 0,
      damageBonus: 0,
      extraDamage: [],
    },
  )
  error.value = ''
}
watch(() => [props.row.instanceId, props.row.specialWeapon], reset, { immediate: true })
function applyPreset() {
  const p = SPECIAL_WEAPONS.find(
    (p) => p.definition.templateId === preset.value && p.itemId === props.row.itemId,
  )
  if (p) draft.value = clone(p.definition)
}
function save() {
  try {
    if (!draft.value || !reason.value.trim()) throw Error('请填写 GM 配置原因')
    validateSpecialWeapon(draft.value)
    emit('save', clone(draft.value), reason.value)
  } catch (e) {
    error.value = String(e instanceof Error ? e.message : e)
  }
}
</script>
<template>
  <section v-if="row.specialWeapon || editable" class="special-weapon" :aria-label="controlText('remainingField.specialWeapons')">
    <template v-if="row.specialWeapon"
      ><strong>{{ localizedEntryName(row.specialWeapon) }}</strong>
      <p>
        {{ controlText('scriptSummary.fixedDamage', {p0:(controlText('domain.hit')),p1:(row.specialWeapon.attackBonus >= 0 ? '+' : ''),p2:(row.specialWeapon.attackBonus),p3:(row.specialWeapon.damageBonus >= 0 ? '+' : ''),p4:(row.specialWeapon.damageBonus)}) }}
      </p>
      <p>{{ controlText('scriptSummary.onHitExtraDamageExtraDiceOn', {p0:(damageCaption(row.specialWeapon))}) }}</p>
      <p>{{ row.specialWeapon.description }}</p>
    </template>
    <details v-if="editable && draft">
      <summary>{{ controlText('resourceFlow.gmSpecialWeaponConfiguration') }}</summary>
      <fieldset :disabled="busy">
        <label v-if="SPECIAL_WEAPONS.some((p) => p.itemId === row.itemId)"
          >{{ controlText('remainingField.example') }}<select v-model="preset" :aria-label="controlText('remainingField.specialWeaponExample')" @change="applyPreset">
            <option value="">{{ controlText('resourceFlow.custom') }}</option>
            <option
              v-for="p in SPECIAL_WEAPONS.filter((p) => p.itemId === row.itemId)"
              :key="p.definition.templateId"
              :value="p.definition.templateId"
            >
              {{ controlText('scriptSummary.customExample', {p0:(localizedEntryName(p.definition))}) }}</option>
          </select></label
        >
        <label>{{ controlText('remainingField.weaponName') }}<input v-model="draft.name" maxlength="120" /></label>
        <div class="special-grid">
          <label
            >{{ controlText('remainingField.fixedAttackBonus') }}<input
              v-model.number="draft.attackBonus"
              type="number"
              min="-3"
              max="3" /></label
          ><label
            >{{ controlText('remainingField.fixedDamageBonus') }}<input v-model.number="draft.damageBonus" type="number" min="-3" max="3"
          /></label>
        </div>
        <div v-for="(d, i) in draft.extraDamage" :key="i" class="special-grid">
          <label>{{ controlText('remainingField.onHitExtraDamageDice') }}<input v-model="d.formula" placeholder="1d4" /></label
          ><label
            >{{ controlText('game.damageType') }}<select v-model="d.type">
              <option v-for="t in DAMAGE_TYPES" :key="t" :value="t">{{ damageDisplayName(t) }}</option>
            </select></label
          >
          <button type="button" @click="draft.extraDamage.splice(i, 1)">{{ controlText('resourceFlow.removeThisExtraDamageComponent') }}</button>
        </div>
        <button
          type="button"
          :disabled="draft.extraDamage.length >= 4"
          @click="draft.extraDamage.push({ formula: '1d4', type: 'fire' })"
        >
          {{ controlText('resourceFlow.addOnHitDamage') }}
        </button>
        <label>{{ controlText('controls.description') }}<textarea v-model="draft.description" maxlength="2000" /></label>
        <label>{{ controlText('remainingField.gmReason') }}<input v-model="reason" maxlength="2000" /></label>
        <p class="muted small">
          {{ controlText('resourceFlow.retainsTheBaseWeaponSProficiencyAbilityAnd') }}
        </p>
        <p v-if="error" role="alert">{{ displayFeedback(error,'error') }}</p>
        <button type="button" @click="save">{{ controlText('resourceFlow.saveSpecialWeaponConfiguration') }}</button>
        <button v-if="row.specialWeapon" type="button" @click="emit('save', null, reason)">
          {{ controlText('resourceFlow.restoreBaseWeapon') }}
        </button>
      </fieldset>
    </details>
  </section>
</template>
<style scoped>
.special-weapon {
  border: 1px solid var(--line, #ccd3d1);
  border-radius: 0.6rem;
  padding: 0.75rem;
  overflow-wrap: anywhere;
}
.special-weapon p {
  margin: 0.35rem 0;
}
.special-weapon fieldset {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
  margin-top: 0.5rem;
}
.special-weapon label {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.special-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
.special-weapon input,
.special-weapon select {
  min-width: 0;
  width: 100%;
}
@media (max-width: 480px) {
  .special-grid {
    grid-template-columns: 1fr;
  }
}
</style>
