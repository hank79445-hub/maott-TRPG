<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import { computed } from 'vue'
import type { MapPoint } from '../core/map-types'
import type { PointReview } from '../persistence/gm-review-schema'
const props = defineProps<{ point: MapPoint; disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: PointReview | undefined] }>()
const value = computed(() => props.point.assistedReview)
function update(patch: Partial<PointReview>) {
  emit('update:modelValue', {
    enabled: true,
    method: 'model',
    successText: props.point.revealed || '',
    failureText: '',
    ...value.value,
    ...patch,
  })
}
const eligible = computed(
  () =>
    props.point.kind === 'clue' &&
    !props.point.hidden &&
    !props.point.loot.length &&
    !props.point.coins &&
    !props.point.consume &&
    !props.point.resource &&
    !props.point.targetSceneId &&
    !props.point.portal &&
    !props.point.arrivalGroupIds?.length &&
    !props.point.storyResults?.length &&
    !props.point.battlePresetId,
)
</script>
<template>
  <fieldset class="point-review-settings" :disabled="disabled">
    <legend>{{ controlText('workspace.assistedReviewAuthorization') }}</legend>
    <label
      ><input
        type="checkbox"
        :checked="!!value?.enabled"
        @change="
          ($event.target as HTMLInputElement).checked
            ? update({ enabled: true })
            : emit('update:modelValue', undefined)
        "
      />{{ controlText('configurationField.allowAssistedReviewForThisInteraction') }}</label
    >
    <p class="muted">{{ controlText('workspace.whenSelectedPlayersSubmitAnIntentFirstThe') }}</p>
    <template v-if="value?.enabled">
      <p v-if="!eligible" role="status">{{ controlText('workspace.hiddenOrMandatoryReviewConsequencesRemainWithThe') }}</p>
      <label
        >{{ controlText('configurationField.reviewMethod') }}<select
          :value="value.method"
          @change="
            update({ method: ($event.target as HTMLSelectElement).value as PointReview['method'] })
          "
        >
          <option value="model">{{ controlText('workspace.modelAssistedJudgment') }}</option>
          <option value="program">{{ controlText('workspace.fixedRulesOnlyProgramValidationNoModelCall') }}</option>
        </select></label
      >
      <label
        >{{ controlText('configurationField.fixedPublicSuccessText') }}<textarea
          :value="value.successText"
          maxlength="1000"
          rows="2"
          @input="update({ successText: ($event.target as HTMLTextAreaElement).value })"
        />
      </label>
      <label
        >{{ controlText('configurationField.fixedPublicFailureText') }}<textarea
          :value="value.failureText"
          maxlength="1000"
          rows="2"
          @input="update({ failureText: ($event.target as HTMLTextAreaElement).value })"
        />
      </label>
      <p class="muted">{{ controlText('workspace.theGmMustExplicitlyWriteBothTextsText') }}</p>
    </template>
  </fieldset>
</template>
<style scoped>
.point-review-settings {
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 12px 0;
  padding: 10px;
}
.point-review-settings label {
  display: block;
  margin: 8px 0;
}
.point-review-settings textarea,
.point-review-settings select {
  box-sizing: border-box;
  width: 100%;
  min-height: 42px;
}
</style>
