<script setup lang="ts">
import {uiDate} from '../locale-format'
import {uiLabel} from '../ui-label'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import { computed, nextTick, shallowRef, watch, useTemplateRef } from 'vue'
import { groupMessageRows } from './group-message-rows'
import type { RoomMessage, MessageNpc } from '../../online/message-types'
import type { RoomView } from '../../online/protocol'
import CharacterAvatar from '../CharacterAvatar.vue'
const props = defineProps<{
  items: RoomMessage[]
  npcs: MessageNpc[]
  view: RoomView
  shown: Record<string, number>
  older?: boolean
  loading?: boolean
  scope?: string
}>()
const emit = defineEmits<{ read: []; older: []; next: [] }>()
const rows = computed(() => groupMessageRows(props.items))
const scroll = useTemplateRef<HTMLElement>('scroll'),
  bottom = shallowRef(true),
  newCount = shallowRef(0)
const positions = new Map<string, number>()
let switching = false
watch(
  () => props.scope,
  async (next, old) => {
    if (scroll.value && old) positions.set(old, scroll.value.scrollTop)
    switching = true
    await nextTick()
    if (scroll.value)
      scroll.value.scrollTop = positions.get(next ?? '') ?? scroll.value.scrollHeight
    switching = false
    onScroll()
  },
)
function onScroll() {
  const el = scroll.value
  if (!el) return
  bottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 36
  if (bottom.value) {
    newCount.value = 0
    emit('read')
  }
}
async function latest() {
  await nextTick()
  if (scroll.value) scroll.value.scrollTop = scroll.value.scrollHeight
  onScroll()
}
watch(
  () => props.items.length,
  () => {
    if (props.items.length === 0) {
      positions.clear()
      bottom.value = true
      newCount.value = 0
    }
  },
)
watch(
  () =>
    props.items
      .map((i) => i.id + ':' + i.status + ':' + (props.shown[i.id] ?? i.segments.length))
      .join('|'),
  async () => {
    if (switching) return
    if (bottom.value) await latest()
    else newCount.value++
  },
)
function portrait(m: RoomMessage) {
  return m.kind === 'npc'
    ? props.npcs.find((n) => n.id === m.npcId)?.portrait
    : (props.view.ownCharacters.find((c) => c.id === m.characterId)?.portrait ??
        props.view.scene?.tokens.find((t) => t.characterId === m.characterId)?.portrait)
}
const labels: Record<string, string> = {
  queued: '排队中',
  running: '生成／审稿中',
  'waiting-gm': '等待GM裁定',
  draft: '等待审稿',
  fallback: '生成失败，待GM处理',
  stale: '相关条件变化，请GM重新评估',
  interrupted: '生成中断',
  canceled: '已撤回／取消',
  rejected: '已拒绝',
  published: '已发布',
}
</script>
<template>
  <div ref="scroll" class="message-feed" tabindex="0" :aria-label="controlText('ai.dialogueHistory')" @scroll="onScroll">
    <button v-if="older" :disabled="loading" @click="emit('older')">{{ controlText('ai.earlierConversations') }}</button>
    <p v-if="!items.length" class="muted">{{ controlText('ai.noConversationHelp') }}</p>
    <article
      v-for="m in rows"
      v-show="shown[m.id] !== 0"
      :key="m.id"
      class="message-row"
      :class="{ mine: m.kind === 'player' && view.self.characterIds.includes(m.characterId) }"
    >
      <CharacterAvatar :name="m.name" :portrait="portrait(m)" :size="36" />
      <div class="message-content">
        <small
          >{{ localizedEntryName(m) }} · {{ uiDate(m.at,'time')
          }}{{ m.personal ? controlText('expressionTwo.personal') : '' }}</small
        >
        <small v-if="m.kind === 'player' && m.dialogueGroup"
          >{{ m.dialogueGroup.mode === 'shout' ? controlText('domain.everyone') : controlText('room.groupTalk') }} →
          {{ m.dialogueGroup.recipients.map((n) => localizedEntryName(n)).join('、') }}</small
        >
        <div class="message-bubble">
          <small v-if="m.translationFallback">{{controlText('language.missing')}}</small>
          <p
            v-for="(s, index) in m.segments.slice(0, shown[m.id] ?? m.segments.length)"
            :key="index"
            :class="{ stage: s.kind === 'action' }"
          >
            {{ s.text }}
          </p>
          <button
            v-if="(shown[m.id] ?? m.segments.length) < m.segments.length"
            @click="emit('next')"
          >
            {{ controlText('ai.nextSegment') }}
          </button>
        </div>
        <small v-if="m.groupStates">{{
          m.groupStates
            .map(
              (s) =>
                (localizedEntryName(m.dialogueGroup?.recipients.find((n) => n.id === s.npcId)) ?? 'NPC') +
                '：' +
                (uiLabel(labels[s.status]) ?? '处理中'),
            )
            .join('；')
        }}</small>
        <small v-else-if="m.kind === 'player' && m.status !== 'published'"
          >{{ uiLabel(labels[m.status]) ?? controlText('domain.working')
          }}{{ m.queueAhead ? controlText('expressionTwo.previous') + m.queueAhead + controlText('expressionTwo.itemsIncomplete') : '' }}</small
        >
      </div>
    </article>
    <button v-if="newCount" class="new-messages" @click="latest">{{ controlText('ai.latestMessages') }}</button>
  </div>
</template>
<style scoped>
.message-feed {
  min-height: 0;
  overflow: auto;
  padding: 10px;
  overscroll-behavior: contain;
  overflow-anchor: none;
  position: relative;
}
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0;
}
.message-content {
  min-width: 0;
  max-width: 90%;
}
.message-content > small {
  display: block;
  font-size: 0.75rem;
  line-height: 1.5;
}
.message-bubble {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px 12px 12px 12px;
  padding: 8px 12px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.message-bubble p {
  margin: 4px 0;
  line-height: 1.6;
}
.message-bubble p.stage {
  font-style: italic;
  opacity: 0.8;
  border-left: 3px solid var(--line);
  padding-left: 8px;
}
.mine {
  flex-direction: row-reverse;
}
.mine .message-bubble {
  border-radius: 12px 4px 12px 12px;
}
.new-messages {
  position: sticky;
  bottom: 0;
  display: block;
  margin: auto;
  min-height: 44px;
}
</style>
