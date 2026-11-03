<script setup lang="ts">
import {uiDate} from '../locale-format'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {i18n} from '../../app/i18n'
import {localizedEvent} from '../../shared/localization/system-messages'
const eventText=(e:BroadcastEvent)=>localizedEvent(e,i18n.global.locale.value)
import { nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import type { BroadcastEvent } from '../../core/broadcast-types'
const props = defineProps<{
  events: BroadcastEvent[]
  branch: string
  visible: boolean
  sources: (event: BroadcastEvent) => BroadcastEvent[]
}>()
const emit = defineEmits<{ read: [] }>()
const scroll = useTemplateRef<HTMLElement>('scroll')
const limit = shallowRef(50),
  atBottom = shallowRef(true),
  pending = shallowRef(false)
function source(e: BroadcastEvent) {
  if (e.type === 'ai.narration') return controlText('domain.narration')
  if (e.category === 'preset') return controlText('room.fixedBroadcast')
  return controlText(({combat:'room.systemCombat',interaction:'room.systemInteraction',resolution:'room.systemResolution',trigger:'room.systemTrigger',progress:'room.systemScene'} as Record<string,string>)[e.category]??'room.systemEvent')
}
function onScroll() {
  const el = scroll.value
  if (!el || !props.visible) return
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 32
  if (atBottom.value) {
    pending.value = false
    emit('read')
  }
}
async function latest() {
  await nextTick()
  if (!props.visible) return
  if (scroll.value) scroll.value.scrollTop = scroll.value.scrollHeight
  onScroll()
}
async function older() {
  const el = scroll.value,
    previous = el?.scrollHeight ?? 0
  limit.value += 50
  await nextTick()
  if (el) el.scrollTop += el.scrollHeight - previous
}
watch(
  () => props.branch,
  () => {
    limit.value = 50
    pending.value = false
    atBottom.value = true
    void latest()
  },
)
watch(
  () => [props.events.at(-1)?.id, props.events.length] as const,
  (next, old) => {
    if (atBottom.value) void latest()
    else {
      // Keep the beginning of the rendered history stable while reading older items.
      limit.value += Math.max(0, next[1] - (old?.[1] ?? next[1]))
      pending.value = true
    }
  },
  { immediate: true },
)
watch(
  () => props.visible,
  (visible) => {
    if (visible && atBottom.value) void latest()
  },
)
</script>
<template>
  <div ref="scroll" class="broadcast-feed" tabindex="0" :aria-label="controlText('domain.broadcastWindow')" @scroll="onScroll">
    <button v-if="events.length > limit" @click="older">{{ controlText('room.loadEarlierBroadcasts') }}</button>
    <article v-for="e in events.slice(-limit)" :key="e.id" :class="{ 'narration-message': e.type === 'ai.narration' }">
      <span class="broadcast-source">[{{ source(e) }}]</span>
      <span class="broadcast-text">{{ eventText(e).text || eventText(e).title }}</span>
      <details>
        <summary :aria-label="e.title + controlText('expressionTwo.timingAndDetails')">{{ controlText('room.details') }}</summary>
        <small>{{ eventText(e).title }} · {{ uiDate(e.at,'datetime') }}</small>
        <p v-for="s in sources(e)" :key="s.id">{{eventText(s).text}}</p>
      </details>
    </article>
    <p v-if="!events.length">{{ controlText('room.noBroadcasts') }}</p>
    <button v-if="pending" class="broadcast-new" @click="latest">{{ controlText('room.newBroadcasts') }}</button>
  </div>
</template>
<style scoped>
.broadcast-feed {
  overflow: auto;
  min-height: 0;
  font-size: 0.85rem;
  line-height: 1.6;
  overflow-anchor: none;
  overscroll-behavior: contain;
}
article {
  padding: 4px 0;
  overflow-wrap: anywhere;
}
.broadcast-source {
  font-weight: 600;
  margin-right: 6px;
}
.narration-message {
  background: #e7f3e8;
  color: #203c2a;
  border-left: 3px solid #79a886;
  border-radius: 5px;
  padding: 5px 8px;
  margin: 3px 0;
}
:global(:root[data-theme='dark'] .narration-message) {
  background: #233b2c;
  color: #dcefe0;
  border-left-color: #83b994;
}
.broadcast-text,
p {
  white-space: pre-wrap;
}
details {
  display: inline;
  margin-left: 8px;
  font-size: 0.75rem;
}
details[open] {
  display: block;
  margin: 4px 0;
  padding-left: 8px;
  border-left: 2px solid var(--line);
}
summary {
  display: inline;
  cursor: pointer;
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
  background: transparent;
  padding: 0;
  min-height: 0;
}
small {
  display: block;
}
p {
  margin: 4px 0;
}
.broadcast-new {
  position: sticky;
  bottom: 0;
  display: block;
  margin: auto;
}
button {
  min-height: 32px;
  padding: 4px 8px;
}
@media (pointer: coarse) {
  button,
  summary {
    min-height: 44px;
  }
  summary {
    display: inline-flex;
    align-items: center;
  }
}
</style>
