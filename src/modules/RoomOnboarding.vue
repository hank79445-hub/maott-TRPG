<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {uiLabel} from './ui-label'
import { computed, shallowRef, watch } from 'vue'
import type { RoomView } from '../online/protocol'
import type { RoomQqSummary } from '../online/room-status-types'
import { roomPreparation } from './room-preparation'
const props = defineProps<{ view: RoomView; localCount: number; qq?: RoomQqSummary | null }>()
const emit = defineEmits<{ navigate: [tab: string] }>()
const preparation = computed(() => roomPreparation(props.view, props.qq ?? null))
const expanded = shallowRef(!preparation.value.ready)
watch(
  () => props.view.id + ':' + props.view.self.id,
  () => {
    expanded.value = !preparation.value.ready
  },
)
const names = {
  ready: '已就绪',
  attention: '待配置',
  unavailable: '不可用',
  optional: '可选未配置',
  unknown: '尚未确认',
}
function enter() {
  expanded.value = false
  emit('navigate', 'map')
}
</script>
<template>
  <details
    class="room-onboarding"
    :open="expanded"
    @toggle="expanded = ($event.target as HTMLDetailsElement).open"
  >
    <summary>{{ controlText('progressSummary.roomPreparation', {p0:(preparation.ready
          ? controlText('expressionThree.enteredSceneExplorationAndCombatAvailable')
          : view.self.role === 'gm'
            ? controlText('expressionThree.completeCharacterAndPartyConfigurationInOrder')
            : controlText('expressionThree.waitingForGmToAssignControlAndScene'))}) }}
    </summary>
    <p v-if="view.self.role === 'gm'" class="muted">{{ controlText('progressSummary.completedCharactersInThisBrowserSWorkshop', {p0:(localCount)}) }}</p>
    <ol class="room-onboarding-steps">
      <li
        v-for="item in preparation.items"
        :key="item.id"
        :class="{ done: item.status === 'ready' }"
      >
        <strong
          >{{ item.title }} · {{ uiLabel(names[item.status])
          }}{{ item.blocking ? controlText('expressionThree.entryRequirementsMissing') : '' }}</strong
        >
        <span>{{ item.detail }}</span>
        <button class="subtle" @click="emit('navigate', item.target)">
          {{ item.status === 'ready' ? controlText('expressionThree.view') : controlText('expressionThree.configure') }}{{ item.title.replace('（可选）', '') }}
        </button>
      </li>
    </ol>
    <p class="muted" v-if="view.self.role === 'gm'">
      {{ controlText('adjudication.aiNarrationSkillAndQqAreOptionalOpening') }}
    </p>
    <button :disabled="!preparation.ready" @click="enter">
      {{ view.self.role === 'gm' ? controlText('expressionThree.openMapForHostingWebOnlySupported') : controlText('expressionThree.openPublicMap') }}
    </button>
  </details>
</template>
