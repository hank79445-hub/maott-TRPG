<script setup lang="ts">
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import {damageDisplayName} from './rule-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { NPC_CLASS_NAMES } from '../content/npc-class-template-index'
import { NPC_LIMIT } from '../core/configuration-limits'
import { computed, reactive } from 'vue'
import type { NpcTemplate } from '../core/ai-types'
import { NPC_CATEGORIES } from '../core/npc-template-types'
import { filterNpcTemplates, NPC_SUPPORT_NAMES } from '../core/npc-template-library'
import { ABILITY_NAMES, SKILLS, type Ability } from '../core/types'
import { DAMAGE_NAMES } from '../core/combat-types'
const props = withDefaults(
  defineProps<{
    templates: NpcTemplate[]
    modelValue: string
    disabled?: boolean
    label?: string
    extraSources?: { id: string; name: string }[]
  }>(),
  { label: '普通 NPC 生物模板', disabled: false, extraSources: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const filters = reactive({
  query: '',
  category: '',
  cr: '',
  attack: '',
  support: '',
  tag: '',
  classId: '',
})
const visible = computed(() => filterNpcTemplates(props.templates, filters))
const selected = computed(() => props.templates.find((t) => t.id === props.modelValue))
const extra = computed(() => props.extraSources.find((s) => s.id === props.modelValue))
const crs = computed(() =>
  [...new Set(props.templates.map((t) => t.metadata?.cr).filter((s): s is string => !!s))].sort(
    (a, b) => {
      const value = (s: string) =>
        s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s)
      return value(a) - value(b)
    },
  ),
)
const signed = (n: number) => (n >= 0 ? '+' + n : String(n))
const abilities = (values: Record<Ability, number>, bonus = false) =>
  Object.entries(values)
    .map(
      ([key, value]) =>
        (ABILITY_NAMES[key as Ability] ?? key) + ' ' + (bonus ? signed(value) : value),
    )
    .join(' · ')
const skills = (values: Record<string, number>) =>
  Object.entries(values)
    .map(([key, value]) => (SKILLS[key]?.name ?? key) + signed(value))
    .join('、') || '无额外技能'
</script>
<template>
  <section class="npc-template-picker" :aria-label="label + controlText('expressionTwo.library')">
    <div class="picker-filters">
      <label
        >{{ controlText('domain.classTheme') }}<select v-model="filters.classId" :aria-label="controlText('domain.classTheme')" :disabled="disabled">
          <option value="">{{ controlText('workspace.allClasses') }}</option>
          <option v-for="(name, id) in NPC_CLASS_NAMES" :key="id" :value="id">{{ uiLabel(name) }}</option>
        </select></label
      >
      <label
        >{{ controlText('configurationField.searchTemplates') }}<input
          v-model="filters.query"
          type="search"
          maxlength="120"
          :placeholder="controlText('configurationField.chineseEnglishId')"
          :disabled="disabled"
      /></label>
      <label
        >{{ controlText('domain.templateCategory') }}<select v-model="filters.category" :aria-label="controlText('domain.templateCategory')" :disabled="disabled">
          <option value="">{{ controlText('workspace.allCategories') }}</option>
          <option v-for="(name, key) in NPC_CATEGORIES" :key="key" :value="key">{{ uiLabel(name) }}</option>
          <option value="custom">{{ controlText('workspace.gmCustom') }}</option>
        </select></label
      >
      <label
        >{{ controlText('domain.challengeRating') }}<select v-model="filters.cr" :aria-label="controlText('domain.challengeRating')" :disabled="disabled">
          <option value="">{{ controlText('workspace.allCrs') }}</option>
          <option v-for="cr in crs" :key="cr" :value="cr">CR {{ cr }}</option>
        </select></label
      >
      <label
        >{{ controlText('domain.attackRange') }}<select v-model="filters.attack" :aria-label="controlText('domain.attackRange')" :disabled="disabled">
          <option value="">{{ controlText('controls.all') }}</option>
          <option value="melee">{{ controlText('workspace.includesMelee') }}</option>
          <option value="ranged">{{ controlText('workspace.includesRangedThrown') }}</option>
        </select></label
      >
      <label
        >{{ controlText('domain.abilitySupport') }}<select v-model="filters.support" :aria-label="controlText('domain.abilitySupport')" :disabled="disabled">
          <option value="">{{ controlText('controls.all') }}</option>
          <option v-for="(name, key) in NPC_SUPPORT_NAMES" :key="key" :value="key">{{ controlText('liveSummary.includes', {p0:(uiLabel(name)),p1:(controlText('game.features'))}) }}
          </option>
        </select></label
      >
    </div>
    <label
      >{{ controlText('domain.templateTags') }}<select v-model="filters.tag" :aria-label="controlText('domain.templateTags')" :disabled="disabled">
        <option value="">{{ controlText('controls.all') }}</option>
        <option value="elite">{{ controlText('workspace.elite') }}</option>
        <option value="caster">{{ controlText('workspace.spellcaster') }}</option>
        <option value="special">{{ controlText('workspace.special') }}</option>
      </select></label
    >
    <p class="muted small" role="status">
      {{ controlText('liveSummary.templateCategoriesFilteringDoesNotChangeThe', {p0:(visible.length),p1:(templates.length),p2:(NPC_LIMIT)}) }}</p>
    <label
      >{{ label
      }}<select
        :value="modelValue"
        :aria-label="label"
        :disabled="disabled"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ controlText('workspace.chooseTemplate') }}</option>
        <option v-if="selected && !visible.some((t) => t.id === selected?.id)" :value="selected.id">
          {{ controlText('liveSummary.currentSelectionOutsideFilter', {p0:(localizedEntryName(selected))}) }}</option>
        <optgroup :label="controlText('finalField.builtInCustomTemplates')">
          <option v-for="t in visible" :key="t.id" :value="t.id">
            {{ localizedEntryName(t) }}{{ t.metadata ? ' · CR ' + t.metadata.cr : '' }}
          </option>
        </optgroup>
        <optgroup v-if="extraSources.length" :label="controlText('finalField.copyAnExistingOrdinaryNpcConfiguration')">
          <option v-for="s in extraSources" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
        </optgroup>
      </select></label
    >
    <article v-if="selected" class="template-preview">
      <strong
        >{{ localizedEntryName(selected) }} <span class="muted">{{ selected.metadata?.englishName }}</span></strong
      >
      <p>
        AC {{ selected.body.ac }} · HP {{ selected.body.maxHp }} {{ controlText('configurationField.groundSpeed') }}
        {{ selected.body.speed }}{{ controlText('configurationField.ftInitiative') }} {{ signed(selected.body.initiativeBonus)
        }}<template v-if="selected.metadata">
          · CR {{ selected.metadata.cr ?? controlText('expressionTwo.notCalibrated') }}／XP
          {{ selected.metadata.xp ?? controlText('expressionTwo.gmEstimate') }}</template
        >
      </p>
      <p v-for="a in selected.body.attacks" :key="a.id" class="small">
        {{ localizedEntryName(a) }} {{ signed(a.bonus) }} · {{ a.damage }} {{ damageDisplayName(a.damageType)
        }}<span v-for="(d, i) in a.extraDamage ?? []" :key="i">
          ＋{{ d.formula }} {{ damageDisplayName(d.type)
          }}{{ d.when === 'charge' ? controlText('expressionTwo.whenGmConfirmsCollision') : d.when ? controlText('expressionTwo.withAdvantage') : '' }}</span
        >
        · {{ a.range ? controlText('expressionTwo.range') + a.range + '/' + a.longRange : controlText('expressionOne.reach') + a.reach }}{{ controlText('game.feet') }}{{
          a.manualOnly ? controlText('expressionTwo.gmManual') : ''
        }}
      </p>
      <p v-if="selected.metadata?.requiresManualTurn" class="muted">{{ controlText('workspace.newInstancesOfThisTemplateDefaultToGm') }}</p>
      <details>
        <summary>{{ controlText('workspace.templateRulesAndAdjudicationScope') }}</summary>
        <p>{{ selected.source }}</p>
        <template v-if="selected.metadata">
          <p>{{ controlText('liveSummary.templateVersion', {p0:(selected.metadata.templateVersion),p1:(selected.metadata.sourceVersion),p2:(selected.metadata.pages?.length
                ? controlText('expressionTwo.page') + selected.metadata.pages.join('、') + controlText('expressionTwo.pageAlias129')
                : controlText('expressionTwo.customReferenceNoOfficialPage'))}) }}
          </p>
          <p>
            {{ controlText('liveSummary.hpDiceProficiencyBonus', {p0:(selected.metadata.alignment),p1:(selected.metadata.hitDice),p2:(signed(selected.metadata.proficiencyBonus))}) }}
          </p>
          <p>{{ abilities(selected.body.scores) }}</p>
          <p>{{ controlText('liveSummary.totalSavingThrowBonus', {p0:(abilities(selected.body.saves, true))}) }}</p>
          <p class="muted">{{ controlText('workspace.referenceFieldsSkillsSensesLanguagesAndSpecialMovement') }}</p>
          <p>
            {{ controlText('liveSummary.passivePerception', {p0:(controlText('game.skill')),p1:(skills(selected.metadata.skills)),p2:(selected.metadata.passivePerception)}) }}
          </p>
          <p>{{ controlText('liveSummary.sensesLanguages', {p0:(selected.metadata.senses.join('、') || controlText('expressionTwo.ordinarySenses')),p1:(selected.metadata.languages.join('、') || controlText('controls.none'))}) }}
          </p>
          <p>{{ controlText('liveSummary.specialMovementEquipmentDoesNotCreateInventory', {p0:(selected.metadata.movement
                .map(
                  (m) =>
                    ({ climb: '攀爬', swim: '游泳', fly: '飞行', burrow: '掘穴' })[m.kind] +
                    m.feet +
                    '尺',
                )
                .join('、') || controlText('controls.none')),p1:(selected.metadata.gear.join('、') || controlText('expressionTwo.noListedEquipment'))}) }}</p>
          <ul>
            <li v-for="rule in selected.metadata.abilities" :key="rule.id">
              <strong>{{ localizedEntryName(rule) }} · {{ uiLabel(NPC_SUPPORT_NAMES[rule.support]) }}</strong
              >：{{ rule.detail }}
            </li>
          </ul>
          <p>
            {{ controlText('configurationField.source') }}<a
              href="https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf"
              target="_blank"
              rel="noopener noreferrer"
              >{{ controlText('workspace.officialSrd521') }}</a
            >
            {{ controlText('configurationField.ccByChineseTextIsTheToolS') }}
          </p>
        </template>
        <ul v-if="selected.notes.length">
          <li v-for="note in selected.notes" :key="note">{{ note }}</li>
        </ul>
      </details>
    </article>
    <p v-else-if="extra" class="muted">{{ controlText('liveSummary.copiesAHealthyInstanceOfConfigurationWithout', {p0:(localizedEntryName(extra))}) }}</p>
    <p class="muted small">{{ controlText('workspace.templateUpdatesAffectNewSelectionsOnlyExistingNpcs') }}</p>
  </section>
</template>
<style scoped>
.npc-template-picker {
  min-width: 0;
}
.picker-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));
  gap: 10px;
  margin-bottom: 8px;
}
.npc-template-picker label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.npc-template-picker input,
.npc-template-picker select {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
}
.template-preview {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
  margin-top: 10px;
  overflow-wrap: anywhere;
}
.template-preview p {
  margin: 8px 0;
}
.template-preview summary {
  min-height: 44px;
  display: list-item;
  cursor: pointer;
}
.template-preview li {
  margin-bottom: 8px;
}
</style>
