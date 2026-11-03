<script setup lang="ts">
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import {uiLabel} from './ui-label'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { computed, shallowRef, watch } from 'vue'
import type { Combatant, CombatCommand } from '../core/combat-types'
import { NPC_SUPPORT_NAMES } from '../core/npc-template-library'
const props = defineProps<{ actor: Combatant; disabled: boolean; tick: number }>()
const emit = defineEmits<{ command: [command: CombatCommand] }>()
const confirmed = shallowRef(false)
watch(
  () => [props.actor.id, props.tick],
  () => {
    confirmed.value = false
  },
)
const rules = computed(() => props.actor.npc?.templateMetadata?.abilities ?? [])
function use(action: 'disengage' | 'hide') {
  emit('command', {
    type: 'action',
    actorId: props.actor.id,
    action,
    cost: 'bonus',
    note:
      action === 'hide'
        ? '灵巧逃脱：仅登记附赠动作；隐藏条件、检定、隐形及解除由GM处理'
        : '灵巧逃脱：附赠动作撤离',
  })
  confirmed.value = false
}
function web() {
  emit('command', {
    type: 'action',
    actorId: props.actor.id,
    action: 'utilize',
    note: '登记蛛网动作；GM需另行完成充能5–6、60尺可见目标DC13敏捷豁免、束缚及蛛网物体处理，未自动执行效果',
  })
  confirmed.value = false
}
</script>
<template>
  <details class="battle-card npc-rule-actions">
    <summary>{{ controlText('workspace.ordinaryNpcTraitsAndRulings') }}</summary>
    <p v-if="actor.npc?.templateMetadata" class="muted small">{{ controlText('liveSummary.sourceSnapshotTemplateActualAbilitiesFollowThe', {p0:(actor.npc.templateMetadata.englishName),p1:(actor.npc.templateMetadata.sourceVersion),p2:(actor.npc.templateMetadata.templateVersion)}) }}</p>
    <ul>
      <li v-for="rule in rules" :key="rule.id">
        <strong>{{ localizedEntryName(rule) }} · {{ uiLabel(NPC_SUPPORT_NAMES[rule.support]) }}</strong
        >：{{ rule.detail }}
      </li>
    </ul>
    <div v-if="actor.npc?.nimbleEscape" class="room-row">
      <button type="button" :disabled="disabled || !actor.turn.bonus" @click="use('disengage')">{{ controlText('workspace.nimbleEscapeDisengageBonusAction') }}</button>
      <button
        type="button"
        :disabled="disabled || !actor.turn.bonus || !confirmed"
        @click="use('hide')"
      >{{ controlText('workspace.nimbleEscapeHideGmRuling') }}</button>
    </div>
    <button
      v-if="
        !actor.npc?.abilities?.some((a) => a.id === 'web') &&
        rules.some((r) => r.id === 'web' && r.support === 'gm')
      "
      type="button"
      :disabled="disabled || !actor.turn.action || !confirmed"
      @click="web"
    >{{ controlText('workspace.registerWebActionGmAdjudicatesEffects') }}</button>
    <label v-if="actor.npc?.nimbleEscape || rules.some((r) => r.id === 'web')" class="check"
      ><input
        v-model="confirmed"
        type="checkbox"
        :disabled="disabled"
      />{{ controlText('configurationField.gmConfirmsSourceRulesForConditionsChargesAnd') }}</label
    >
    <p class="muted small">
      {{ controlText('adjudication.theGmVerifiesSkillsSpecialMovementAndSenses') }}
    </p>
  </details>
</template>
<style scoped>
.npc-rule-actions {
  min-width: 0;
  overflow-wrap: anywhere;
}
.npc-rule-actions summary,
.npc-rule-actions button,
.npc-rule-actions label {
  min-height: 44px;
}
.npc-rule-actions li {
  margin: 8px 0;
}
.npc-rule-actions label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
}
.npc-rule-actions input {
  flex: none;
  margin-top: 5px;
}
</style>
