<script setup lang="ts">
import {displayFeedback} from '../feedback-presentation'
import {uiLabel} from '../ui-label'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref } from 'vue'
import type { ReviewSettings } from '../../persistence/gm-review-schema'
import { recommendedPracticalPolicy, practicalPolicySchema, type PracticalPolicy } from '../../persistence/practical-review-schema'
const props = defineProps<{ settings: ReviewSettings; busy: boolean }>()
const emit = defineEmits<{ save: [value: ReviewSettings] }>()
const preview = ref<PracticalPolicy>()
const error=ref('')
const domains = { text: '公开文本直发', social: '交涉裁定', combat: '战斗结算', exploration: 'NPC探索', spells: '法术与召唤', knowledge: '知识与声望', trade: '交易与议价' } as const
const active = computed(() => props.settings.practical?.enabled)
function prepare() { error.value='';preview.value = practicalPolicySchema.parse(props.settings.practical ?? recommendedPracticalPolicy()) }
function save() {
  if (!preview.value) return
  const parsed=practicalPolicySchema.safeParse(preview.value)
  if(!parsed.success){error.value='请核对等待秒数、修正次数与议价比例的数值范围';return}
  emit('save', { ...props.settings, practical: parsed.data })
  preview.value = undefined
}
</script>
<template>
  <details class="practical-settings">
    <summary>{{ controlText('progressSummary.practicalAiReview', {p0:(active ? controlText('expressionThree.configured') : controlText('expressionThree.notEnabled'))}) }}</summary>
    <p class="muted">{{ controlText('adjudication.enabledSeparatelyForThisRoomSubjectToManual') }}</p>
    <button :disabled="busy" @click="prepare">{{ active ? controlText('expressionThree.adjustPolicy') : controlText('expressionThree.previewRecommendedPolicy') }}</button>
    <section v-if="preview" :aria-label="controlText('interactionField.practicalAiReviewPolicyPreview')">
      <label><input v-model="preview.enabled" type="checkbox">{{ controlText('interactionField.enablePracticalPolicyForThisRoom') }}</label>
      <label><input v-model="preview.npcAcceptAlert" type="checkbox">{{ controlText('interactionField.npcsConsentToLegalAlliedAlertInitiativeSwaps') }}</label>
      <div class="domain-grid"><label v-for="(name, key) in domains" :key="key"><input v-model="preview[key]" type="checkbox">{{ uiLabel(name) }}</label></div>
      <div class="policy-fields">
        <label>{{ controlText('interactionField.playerOptionalChoiceWaitSeconds') }}<input v-model.number="preview.responseSeconds" type="number" min="5" max="300"></label>
        <label>{{ controlText('interactionField.additionalRepairsPerItem') }}<input v-model.number="preview.maxRepairs" type="number" min="0" max="2"></label>
        <label>{{ controlText('interactionField.npcResourcePolicy') }}<select v-model="preview.npcResources"><option value="conservative">{{ controlText('domain.conservative') }}</option><option value="balanced">{{ controlText('domain.balanced') }}</option><option value="aggressive">{{ controlText('adjudication.proactive') }}</option></select></label>
        <label>{{ controlText('interactionField.bargainedSalePriceDiscount') }}<input v-model.number="preview.sellDiscountPercent" type="number" min="0" max="50"></label>
        <label>{{ controlText('interactionField.bargainedBuybackPriceIncrease') }}<input v-model.number="preview.buyIncreasePercent" type="number" min="0" max="50"></label>
      </div>
      <p class="muted">{{ controlText('adjudication.savingPolicyDoesNotSwitchReviewModeRemove') }}</p>
      <div class="policy-actions"><button :disabled="busy" @click="save">{{ controlText('adjudication.confirmAndSavePolicy') }}</button><button @click="preview = undefined">{{ controlText('controls.cancel') }}</button></div>
      <p v-if="error" role="alert">{{displayFeedback(error,'error')}}</p>
    </section>
  </details>
</template>
<style scoped>
.practical-settings { margin-block: 12px; }
.domain-grid,.policy-fields,.policy-actions { display:flex; flex-wrap:wrap; gap:8px 16px; }
.domain-grid label { min-width:135px; }
.policy-fields label { display:grid; gap:4px; }
.policy-fields input,.policy-fields select { max-width:170px; min-height:36px; }
button { min-height:36px; background:var(--button-bg); border:1px solid var(--button-border); border-radius:6px; padding:6px 12px; color:var(--ink); }
section { border:1px solid var(--line); border-radius:8px; padding:12px; margin-top:8px; }
</style>
