<script setup lang="ts">
import {uiLabel} from '../ui-label'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed } from 'vue'
import type { RoomView } from '../../online/protocol'
const props = defineProps<{ view: RoomView }>()
const tasks = computed(() => [...(props.view.practicalReview?.tasks ?? [])].reverse())
const active = computed(() => tasks.value.filter(t => !props.view.archivedPracticalReviewIds?.includes(t.id) && !['committed','rejected','canceled','stale'].includes(t.status)))
const names: Record<string,string> = { pending:'待处理', 'waiting-model':'模型处理中', 'waiting-player':'等待玩家', 'waiting-dice':'等待实体骰', 'needs-fact':'缺少事实', 'needs-gm':'需要GM', ready:'准备提交', committed:'已完成', rejected:'已拒绝', canceled:'已取消', stale:'已失效', paused:'已暂停' }
</script>
<template>
  <details v-if="tasks.length">
    <summary>{{ controlText('progressSummary.practicalReviewTasksProcessingRecords', {p0:(active.length),p1:(tasks.length)}) }}</summary>
    <article v-for="task in tasks" :key="task.id" class="practical-task">
      <strong>{{ task.label }} · {{ view.archivedPracticalReviewIds?.includes(task.id) ? controlText('expressionThree.invalidPendingItemArchived') : uiLabel(names[task.status]) ?? task.status }}</strong>
      <p>{{ task.reason }}</p>
      <small v-if="task.calls">{{ controlText('progressSummary.rulingRevisionSummaryTokens', {p0:(controlText('game.generate')),p1:(task.calls.generation),p2:(task.calls.adjudication),p3:(task.calls.repair),p4:(task.calls.summary),p5:(task.reportedTokens ?? controlText('dialogueReview.notReported'))}) }}</small>
    </article>
  </details>
</template>
<style scoped>.practical-task{padding:8px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}.practical-task p{margin:4px 0}</style>
