<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {uiLabel} from './ui-label'
import { computed, ref, watch } from 'vue'
import { clone } from '../core/engine'
import {
  DIALOGUE_CATEGORIES,
  DIALOGUE_CATEGORY_LABELS,
  type AiSettings,
  type NpcProfile,
} from '../core/ai-types'
const props = defineProps<{
  profile: NpcProfile
  settings?: AiSettings
  disabled: boolean
  practicalText?: boolean
  designOnly?: boolean
}>()
type Patch = Pick<
  NpcProfile,
  'dialogueReview' | 'publicDialogue' | 'publicKnowledge' | 'publicSpeechStyle'
>
const emit = defineEmits<{ update: [patch: Patch] }>()
function read() {
  return {
    mode: props.profile.dialogueReview?.mode ?? 'inherit',
    categories: clone(props.profile.dialogueReview?.categories ?? [...DIALOGUE_CATEGORIES]),
    publicDialogue: props.profile.publicDialogue ?? '',
    publicSpeechStyle: props.profile.publicSpeechStyle ?? '',
    publicKnowledge: clone(props.profile.publicKnowledge ?? []),
  }
}
const draft = ref(read())
watch(
  () => [props.profile.id, props.profile.revision],
  () => {
    draft.value = read()
  },
)
watch(
  draft,
  () =>
    emit('update', {
      dialogueReview: {
        mode: draft.value.mode as 'inherit' | 'review' | 'custom',
        categories: clone(draft.value.categories),
      },
      publicDialogue: draft.value.publicDialogue,
      publicSpeechStyle: draft.value.publicSpeechStyle,
      publicKnowledge: clone(draft.value.publicKnowledge),
    }),
  { deep: true },
)
const effective = computed(() => {
  if (draft.value.mode === 'review') return '始终由 GM 审核'
  // The parent provides the effective newer policy when it is active.
  if (props.practicalText) return controlI18n.global.locale.value==='en'?'Inherit practical text policy: publish public replies; handle action proposals separately':'继承房间实用文本策略：公开回复直接发布，行为提议独立处理'
  if (props.designOnly) return '继承开团房间策略；新房间默认开启，旧房间由GM确认迁移'
  if (!props.settings?.qqDialogueReview?.enabled || props.settings.qqDialogueReview.paused)
    return '房间未开启或已暂停，当前需 GM 审核'
  const categories =
    draft.value.mode === 'custom'
      ? draft.value.categories
      : props.settings.qqDialogueReview.categories
  return categories.length
    ? '可免审：' + categories.map((c) => DIALOGUE_CATEGORY_LABELS[c]).join('、')
    : '没有开放类别，需 GM 审核'
})
function addKnowledge() {
  draft.value.publicKnowledge.push({ id: crypto.randomUUID(), text: '' })
}
</script>
<template>
  <fieldset class="ai-wide npc-dialogue-settings" :disabled="disabled">
    <legend>{{ controlText('configuration.publicSafeDialoguePolicyWebQq') }}</legend>
    <label
      >{{ controlText('configurationField.handlingMethod') }}<select v-model="draft.mode" :aria-label="controlText('configurationField.qqDialogueHandling')">
        <option value="inherit">{{ controlText('configuration.inheritRoomCategoriesDefault') }}</option>
        <option value="review">{{ controlText('configuration.alwaysReview') }}</option>
        <option value="custom">{{ controlText('configuration.customCategories') }}</option>
      </select></label
    >
    <div v-if="draft.mode === 'custom'" class="category-list">
      <label v-for="category in DIALOGUE_CATEGORIES" :key="category" class="check"
        ><input v-model="draft.categories" type="checkbox" :value="category" />{{
          uiLabel(DIALOGUE_CATEGORY_LABELS[category])
        }}</label
      >
    </div>
    <p role="status" class="muted">{{ effective }}</p>
    <p class="muted">{{ controlText('workspace.newCategoriesAuthorizePublicDialogueOnlyNotTrades') }}</p>
    <label
      >{{ controlText('configurationField.publicSpeakingStyle') }}<textarea
        v-model="draft.publicSpeechStyle"
        maxlength="2000"
        rows="2"
        :placeholder="controlText('configurationField.publicToneAndRefusalHabitsOnlySuchAs')"
      />
    </label>
    <label
      >{{ controlText('configurationField.publicConversationProfile') }}<textarea
        v-model="draft.publicDialogue"
        maxlength="2000"
        rows="3"
        :placeholder="controlText('configurationField.explicitlyPublicTonePersonalityAndCharacterizationOnlyNo')"
      />
    </label>
    <p class="muted small">
      {{ controlText('adjudication.publicDescriptionsKnowledgeBelowAndAuthorizedPublicExperiences') }}
    </p>
    <div v-for="(row, index) in draft.publicKnowledge" :key="row.id" class="room-card">
      <label
        >{{ controlText('configurationField.publicKnowledge') }} {{ index + 1 }}<textarea v-model="row.text" maxlength="2000" rows="2" /></label
      ><button type="button" class="subtle" @click="draft.publicKnowledge.splice(index, 1)">{{ controlText('liveSummary.removePublicKnowledge', {p0:(index + 1)}) }}
      </button>
    </div>
    <button type="button" :disabled="draft.publicKnowledge.length >= 30" @click="addKnowledge">
      {{ controlText('configuration.addPublicKnowledge') }}
    </button>
    <p class="muted small">{{ controlText('workspace.savedWithNpcConfigurationKnowledgeEntriesCannotBe') }}</p>
  </fieldset>
</template>
<style scoped>
.category-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 6px 16px;
}
.npc-dialogue-settings .check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-height: 44px;
  line-height: 1.5;
}
.npc-dialogue-settings input[type='checkbox'] {
  flex: none;
  margin-top: 5px;
}
.npc-dialogue-settings button {
  min-height: 44px;
}
</style>
