<script setup lang="ts">
import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import {uiDate} from './locale-format'
import {uiLabel} from './ui-label'
import { computed } from 'vue'
import type { RoomView } from '../online/protocol'
import type { RoomQqSummary } from '../online/room-status-types'
import { roomRunStatus } from './room-run-status'
const props = defineProps<{
  view: RoomView
  qq: RoomQqSummary | null
  connection: string
  submission: 'idle' | 'pending' | 'confirmed' | 'failed' | 'unknown'
  progress: string
  qqLoading: boolean
  qqError: string
}>()
const emit = defineEmits<{ navigate: [tab: string]; refresh: [] }>()
const items = computed(() => roomRunStatus(props.view, props.qq))
const saveTime = computed(() =>
  props.view.lastSavedAt
    ? uiDate(props.view.lastSavedAt)
    : controlText('room.noSaveTime'),
)
const stateLabels = {
  idle: '当前无提交',
  pending: '当前操作正在提交／保存',
  confirmed: '本次操作已获服务端保存确认',
  failed: '本次操作未完成，请查看提示',
  unknown: '本次提交结果未确认，请刷新核对；不要重复掷骰或提交',
}
</script>
<template>
  <section v-if="view.self.role === 'gm'" class="room-run-status" :aria-label="controlText('interactionField.gmRuntimeStatusSummary')">
    <div class="run-status-heading">
      <strong>{{ controlText('room.runHeading') }}</strong><span>{{ uiLabel(connection) }} · {{ uiLabel(stateLabels[submission]) }}</span>
    </div>
    <div class="run-status-items">
      <button
        v-for="item in items"
        :key="item.id"
        class="status-chip"
        :class="[item.tone, { 'is-idle': item.tone === 'normal' && item.count === 0 }]"
        :title="item.detail"
        :aria-label="`${item.title}：${item.detail}`"
        @click="emit('navigate', item.target)"
      >
        <strong>{{ item.title }} · {{ item.count ?? controlText('room.unconfirmedShort') }}</strong
        ><span>{{ item.detail }}</span>
      </button>
    </div>
    <div class="run-status-footer">
      <small
        >{{ controlText('room.lastSave') }}{{ saveTime
        }}<template v-if="connection !== '已同步'"> {{ controlText('room.lastConnection') }}</template></small
      >
      <small v-if="submission === 'pending'">{{ controlText('room.progressNotice',{progress:uiLabel(progress)}) }}</small>
      <button :disabled="qqLoading" @click="emit('refresh')">
        {{ qqLoading ? controlText('room.updatingQq') : controlText('room.refreshQq') }}
      </button>
    </div>
    <p v-if="qqError" role="status">{{ qqError }}</p>
  </section>
</template>
<style scoped>
.room-run-status {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px;
  margin: 12px 0;
  background: var(--panel);
}
.run-status-heading,
.run-status-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.run-status-heading span,
.run-status-footer small {
  font-size: 0.8rem;
  line-height: 1.5;
}
.run-status-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
  margin: 10px 0;
}
.status-chip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  padding: 10px;
  min-width: 0;
}
.status-chip.is-idle {
  justify-content: center;
  min-height: 44px;
}
.status-chip.is-idle span {
  display: none;
}
.status-chip span {
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.status-chip.waiting {
  border-left: 4px solid #ad7b26;
}
.status-chip.error {
  border-left: 4px solid #b44938;
}
.run-status-footer button {
  margin-left: auto;
  min-height: 44px;
}
@media (max-width: 900px) {
  .run-status-items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 480px) {
  .run-status-items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .status-chip span {
    display: none;
  }
  .status-chip {
    min-height: 44px;
  }
  .run-status-footer button {
    margin-left: 0;
  }
}
</style>
