<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import {uiLabel} from './ui-label'
import { computed, ref, watch } from 'vue'
import { clone } from '../core/engine'
import { DIALOGUE_CATEGORIES, DIALOGUE_CATEGORY_LABELS, type AiSettings } from '../core/ai-types'
const props = defineProps<{ settings: AiSettings; busy: boolean }>()
const emit = defineEmits<{ save: [settings: AiSettings] }>()
const defaults = () => ({
  enabled: false,
  paused: false,
  categories: [...DIALOGUE_CATEGORIES],
  policyVersion: 14,
})
const draft = ref(clone(props.settings.qqDialogueReview ?? defaults()))
watch(
  () => JSON.stringify(props.settings.qqDialogueReview),
  () => {
    draft.value = clone(props.settings.qqDialogueReview ?? defaults())
  },
)
const status = computed(() =>
  props.settings.qqDialogueReview?.paused
    ? '已暂停公开对话自动发布'
    : props.settings.qqDialogueReview?.enabled
      ? '分类免审已开启'
      : '分类免审关闭；重要NPC安全台词等待GM',
)
const needsMigration = computed(() => props.settings.qqDialogueReview?.policyVersion !== 14)
function save() {
  emit('save', {
    ...clone(props.settings),
    qqDialogueReview: { ...clone(draft.value), policyVersion: 14 },
  })
}
function pause() {
  const current = clone(props.settings.qqDialogueReview ?? defaults())
  current.paused = !current.paused
  emit('save', { ...clone(props.settings), qqDialogueReview: current })
}
</script>
<template>
  <section class="room-card qq-dialogue-settings" aria-labelledby="qq-dialogue-review-title">
    <h3 id="qq-dialogue-review-title">{{ controlText('workspace.publicSafeDialogueExemptionWebQq') }}</h3>
    <p role="status">{{ uiLabel(status) }}</p>
    <section v-if="needsMigration" class="room-card" :aria-label="controlText('configurationField.vSafeDialogueMigrationPreview')">
      <strong>{{ controlText('workspace.v14SettingsMigrationPreview') }}</strong>
      <p>
        {{ controlText('adjudication.enabledByDefaultInNewRoomsExistingRoom') }}
      </p>
      <p>{{ controlText('workspace.checkTheSwitchBelowAndSaveOnceIf') }}</p>
      <button type="button" :disabled="busy" @click="draft.enabled = true">{{ controlText('workspace.enableSafeDialogueTakesEffectOnSave') }}</button>
    </section>
    <form @submit.prevent="save">
      <label class="check"
        ><input
          v-model="draft.enabled"
          type="checkbox"
          :disabled="busy"
        />{{ controlText('configurationField.enablePublicSafeDialogueExemptionOnByDefault') }}</label
      >
      <fieldset class="category-list" :disabled="busy || !draft.enabled">
        <legend>{{ controlText('workspace.defaultReviewExemptCategories') }}</legend>
        <label v-for="category in DIALOGUE_CATEGORIES" :key="category" class="check"
          ><input v-model="draft.categories" type="checkbox" :value="category" />{{
            uiLabel(DIALOGUE_CATEGORY_LABELS[category])
          }}</label
        >
      </fieldset>
      <p class="muted">
        {{ controlText('adjudication.appliesToPublicPlayerDialogueOnWebAnd') }}
      </p>
      <div class="room-row">
        <button :disabled="busy">{{ controlText('workspace.saveDialogueExemptionSettings') }}</button
        ><button type="button" class="subtle" :disabled="busy" @click="pause">
          {{ settings.qqDialogueReview?.paused ? controlText('expressionTwo.resumeAutomaticDialoguePublication') : controlText('expressionTwo.pauseAutomaticPublicDialoguePublicationNow') }}
        </button>
      </div>
      <p class="muted small">{{ controlText('workspace.pausingAlsoCoversLegacyFixedRepliesAndPreauthorized') }}</p>
    </form>
  </section>
</template>
<style scoped>
.category-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 6px 16px;
}
.qq-dialogue-settings .check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-height: 44px;
  line-height: 1.5;
}
.qq-dialogue-settings input[type='checkbox'] {
  flex: none;
  margin-top: 5px;
}
.qq-dialogue-settings button {
  min-height: 44px;
}
</style>
