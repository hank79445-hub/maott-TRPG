<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import {
  authoringRequirementsSchema,
  type AuthoringRequirements,
} from '../../core/authoring-requirements'
const model = defineModel<AuthoringRequirements>({ required: true })
defineProps<{ disabled: boolean }>()
function update(key: keyof AuthoringRequirements, value: unknown) {
  model.value = { ...model.value, [key]: value }
}
function number(event: Event, key: keyof AuthoringRequirements, nullable = false) {
  const value = (event.target as HTMLInputElement).value
  update(key, value === '' && nullable ? null : Number(value))
}
const problem = computed(() => {
  const result = authoringRequirementsSchema.safeParse(model.value)
  return result.success
    ? model.value.startLevel !== null && model.value.startLevel > 5
      ? '当前创作起始等级仅支持1–5级；旧数值已保留，请调整后生成资料。'
      : ''
    : result.error.issues.map((i) => i.message).join('；')
})
</script>
<template>
  <section class="authoring-requirements" :aria-label="controlText('remainingField.baseCreationRequirements')">
    <h3>{{ controlText('domain.basicRequirements') }}</h3><label>{{ controlText('domain.creationLanguage') }}<select :value="model.contentLocale??'zh-CN'" :disabled="disabled" @change="update('contentLocale', ($event.target as HTMLSelectElement).value)"><option value="zh-CN">{{ controlText('domain.chinese') }}</option><option value="en">English</option></select></label><p>{{ controlText('domain.creationLanguageHelp') }}</p>
    <fieldset :disabled="disabled">
      <div class="requirement-grid">
        <label
          >{{ controlText('remainingField.playerCountBlankLeavesUnspecified') }}<input
            :value="model.players ?? ''"
            type="number"
            min="1"
            max="10"
            @input="number($event, 'players', true)"
        /></label>
        <label
          >{{ controlText('remainingField.startingLevelBlankLeavesUnspecified') }}<input
            :value="model.startLevel ?? ''"
            type="number"
            min="1"
            max="5"
            @input="number($event, 'startLevel', true)"
        /></label>
        <label
          >{{ controlText('remainingField.estimatedHoursBlankLeavesUnspecified') }}<input
            :value="model.hours ?? ''"
            type="number"
            min="0.5"
            max="1000"
            step="0.5"
            @input="number($event, 'hours', true)"
        /></label>
      </div>
      <p>
        {{ controlText('authoringFlow.explicitNumericEntriesOverrideWrittenRequirementsBlanksDefer') }}
      </p>
    </fieldset>
    <details>
      <summary>{{ controlText('authoringFlow.charactersQuestsAndAdvancementReferencesOptional') }}</summary>
      <fieldset :disabled="disabled">
        <div class="requirement-grid">
          <label
            >{{ controlText('remainingField.ordinaryNpcCountBlankLeavesUnspecified') }}<input
              :value="model.ordinary ?? ''"
              type="number"
              min="0"
              max="100"
              @input="number($event, 'ordinary', true)"
          /></label>
          <label
            >{{ controlText('remainingField.residentImportantNpcCountBlankLeavesUnspecified') }}<input
              :value="model.resident ?? ''"
              type="number"
              min="0"
              max="100"
              @input="number($event, 'resident', true)"
          /></label>
          <label class="check"
            ><input
              :checked="model.companions"
              type="checkbox"
              @change="update('companions', ($event.target as HTMLInputElement).checked)"
            />{{ controlText('remainingField.designRecruitableImportantNpcs') }}</label
          >
          <label v-if="model.companions"
            >{{ controlText('remainingField.companionCount') }}<input
              :value="model.companionCount"
              type="number"
              min="1"
              max="10"
              @input="number($event, 'companionCount')"
          /></label>
          <label class="check"
            ><input
              :checked="model.quests"
              type="checkbox"
              @change="update('quests', ($event.target as HTMLInputElement).checked)"
            />{{ controlText('remainingField.designMainGoalsCurrentObjectivesAndSideQuest') }}</label
          >
          <label
            >{{ controlText('remainingField.advancementReference') }}<select
              :value="model.growth"
              @change="update('growth', ($event.target as HTMLSelectElement).value)"
            >
              <option value="none">{{ controlText('authoringFlow.noAdditionalDesign') }}</option>
              <option value="xp">{{ controlText('authoringFlow.experiencePointReference') }}</option>
              <option value="milestone">{{ controlText('authoringFlow.milestoneReference') }}</option>
            </select></label
          >
        </div>
        <div v-if="model.growth !== 'none'" class="requirement-grid">
          <label
            >{{ controlText('remainingField.advancementTargetLevelBlankLeavesUnspecified') }}<input
              :value="model.endLevel ?? ''"
              type="number"
              min="1"
              max="20"
              @input="number($event, 'endLevel', true)"
          /></label>
        </div>
        <p>
          {{ controlText('authoringFlow.companionDesignCreatesRecruitableCharactersTheyDoNot') }}
        </p>
      </fieldset>
    </details>
    <p v-if="problem" role="alert">{{ problem }}</p>
  </section>
</template>
<style scoped>
.authoring-requirements {
  margin: 12px 0;
}
fieldset {
  border: 0;
  padding: 12px 0;
  min-width: 0;
}
.requirement-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 12px;
}
.requirement-grid input:not([type='checkbox']),
.requirement-grid select {
  min-height: 44px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.check {
  flex-direction: row;
  align-items: center;
}
p {
  font-size: 0.85rem;
}
</style>
