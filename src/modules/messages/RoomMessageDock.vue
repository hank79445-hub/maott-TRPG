<script setup lang="ts">
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, nextTick, shallowRef, watch, onBeforeUnmount, useTemplateRef } from 'vue'
import type { RoomView, RoomCommand } from '../../online/protocol'
import type { BroadcastEvent } from '../../core/broadcast-types'
import { safePortrait } from '../../core/portraits'
import { useRoomReviewLayout } from '../useRoomReviewLayout'
import { focusDock } from '../dock-focus'
import { useRoomMessages } from './useRoomMessages'
import { useMessagePlayback } from './useMessagePlayback'
import MessageFeed from './MessageFeed.vue'
import MessageBroadcastFeed from './MessageBroadcastFeed.vue'
import CharacterAvatar from '../CharacterAvatar.vue'
import MessageTradeDock from '../trade/MessageTradeDock.vue'
import MapTargetsButton from '../map-selection/MapTargetsButton.vue'
import { workspaceText } from '../workspace/workspace-labels'
const props = defineProps<{
  view: RoomView
  events: BroadcastEvent[]
  busy: boolean
  request: <T>(s: string) => Promise<T | null>
  submit: (c: RoomCommand) => Promise<boolean>
  docked?: boolean
  dockTarget?: string
  dockWidth?: number
  active?: boolean
}>()
const emit = defineEmits<{ review: []; opened: []; history: []; collapse: []; expand: [] }>()
const enabled = defineModel<boolean>('enabled', { default: true })
const scope = () => props.view.id + ':' + props.view.self.id
const open = shallowRef(false),
  selected = shallowRef(''),
  filter = shallowRef('all'),
  character = shallowRef(''),
  settingsOpen = shallowRef(false),
  portraitOpen = shallowRef(true),
  pinned = shallowRef(''),
  phoneTab = shallowRef('dialogue'),
  broadcastFilter = shallowRef('all'),
  split = shallowRef(25)
const drafts = shallowRef<Record<string, string>>({}),
  favorites = shallowRef<string[]>([]),
  seen = shallowRef<Record<string, string>>({}),
  broadcastSeen = shallowRef(props.view.broadcast.head),
  localBusy = shallowRef(false),
  notice = shallowRef('')
const talkMode = shallowRef<'single' | 'group' | 'shout'>('single')
const requestedSkill = shallowRef<
  '' | 'persuasion' | 'deception' | 'intimidation' | 'performance' | 'animal-handling'
>('')
const requestGoal = shallowRef(''),
  primaryNpcId = shallowRef('')
const recipientIds = shallowRef<string[]>([])
const npcEventSeen = shallowRef<Record<string, number>>({}),
  initialHead = shallowRef(props.view.broadcast.head)
const panel = useTemplateRef<HTMLElement>('panel')
const launcher = useTemplateRef<HTMLButtonElement>('launcher')
const tradeEntry=useTemplateRef<HTMLButtonElement>('tradeEntry'),tradeOpen=shallowRef(false)
const { layout, mobile, reset, resize, keyAdjust, startGesture, shouldOpenFromClick } =
  useRoomReviewLayout('trpg.message-layout.' + scope(), { width: 800, height: 840, minHeight: 620 })
const visible = computed(() => props.active !== false && enabled.value && (props.docked === true || open.value))
const data = useRoomMessages(() => props.view, visible, props.request),
  play = useMessagePlayback(data.items, data.baseline)
const tradePlacement=computed(()=>{const w=window.innerWidth,h=window.innerHeight,p=props.docked?{x:w-(props.dockWidth??380)-12,y:86,width:props.dockWidth??380,height:Math.max(200,h-166)}:layout.value.panel;if(w<960)return {trade:{x:8,y:8,width:w-16,height:h-16},message:p};const width=Math.min(p.width,w-396),x=Math.max(12,Math.min(w-width-384,p.x-372));return {trade:{x,y:p.y,width:360,height:p.height},message:{...p,x:x+372,width}}})
const messageBox=computed(()=>tradeOpen.value?tradePlacement.value.message:layout.value.panel)
function closeTrade(){tradeOpen.value=false;void nextTick(()=>{focusDock(panel.value);tradeEntry.value?.focus()})}
let focus: HTMLElement | null = null
const settingsPortrait = shallowRef(false)
const prefKey = () => 'trpg.message-prefs.' + scope()
watch(
  scope,
  () => {
    open.value = false
    selected.value = ''
    talkMode.value = 'single'
    recipientIds.value = []
    filter.value = 'all'
    pinned.value = ''
    drafts.value = {}
    try {
      drafts.value = JSON.parse(sessionStorage.getItem('trpg.message-drafts.' + scope()) ?? '{}')
    } catch {}
    seen.value = {}
    broadcastSeen.value = props.view.broadcast.head
    initialHead.value = props.view.broadcast.head
    npcEventSeen.value = {}
    try {
      const pref = JSON.parse(localStorage.getItem(prefKey()) ?? '{}')
      enabled.value = pref.enabled ?? true
      portraitOpen.value = pref.portraitOpen ?? !mobile.value
      settingsPortrait.value = pref.narrowPortrait ?? false
      favorites.value = pref.favorites ?? []
      split.value = pref.split ?? 25
      play.speed.value = pref.speed ?? 1600
      play.enabled.value = pref.play ?? true
    } catch {}
  },
  { immediate: true },
)
watch(drafts, (value) => {
  try {
    sessionStorage.setItem('trpg.message-drafts.' + scope(), JSON.stringify(value))
  } catch {}
})
watch(
  () => props.view.self.characterIds.join(','),
  () => {
    drafts.value = {}
  },
)
watch(
  () => [
    enabled.value,
    portraitOpen.value,
    settingsPortrait.value,
    split.value,
    play.speed.value,
    play.enabled.value,
    favorites.value.join(','),
  ],
  () => {
    try {
      localStorage.setItem(
        prefKey(),
        JSON.stringify({
          enabled: enabled.value,
          portraitOpen: portraitOpen.value,
          narrowPortrait: settingsPortrait.value,
          split: split.value,
          speed: play.speed.value,
          play: play.enabled.value,
          favorites: favorites.value,
        }),
      )
    } catch {}
  },
)
watch(enabled, (v) => {
  if (!v) close()
})
const choices = computed(() =>
  data.npcs.value
    .slice()
    .sort(
      (a, b) => Number(favorites.value.includes(b.id)) - Number(favorites.value.includes(a.id)),
    ),
)
const shortName = (name: string) => name.split(/[|｜]/)[0]!.trim()
function pickerName(n: { id: string; name: string }) {
  const name = shortName(n.name)
  return data.npcs.value.some((other) => other.id !== n.id && shortName(other.name) === name)
    ? n.name
    : name
}
const narrowPortrait = computed(() => props.docked || mobile.value || layout.value.panel.width < 600)
const playing = computed(() =>
  data.items.value.some((m) => (play.shown.value[m.id] ?? m.segments.length) < m.segments.length),
)
const target = computed(() => data.npcs.value.find((n) => n.id === selected.value))
const own = computed(() =>
  props.view.self.role === 'gm'
    ? props.view.characters
    : props.view.ownCharacters.map((c) => ({ id: c.id, name: c.build.name })),
)
watch(
  own,
  (list) => {
    if (!list.some((c) => c.id === character.value)) character.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
const recipients = computed(() => data.npcs.value.filter((n) => recipientIds.value.includes(n.id)))
const targetAttitudes = computed(() => {
  const targets = talkMode.value === 'single' ? (target.value ? [target.value] : []) : recipients.value
  return targets.flatMap((npc) => {
    const attitude = props.view.ai.npcs.find((n) => n.id === npc.id)?.attitudes?.find(
      (entry) => entry.characterId === character.value,
    )
    return attitude ? [{ id: npc.id, name: pickerName(npc), band: attitude.band }] : []
  })
})
const eligible = computed(() =>
  choices.value.filter((n) => (n.groupCharacters ?? n.characters).includes(character.value)),
)
const active = computed(() =>
  talkMode.value === 'single'
    ? !!target.value?.characters.includes(character.value)
    : recipientIds.value.length > 0 &&
      recipientIds.value.length <= 5 &&
      recipients.value.length === recipientIds.value.length &&
      recipients.value.every((n) => (n.groupCharacters ?? n.characters).includes(character.value)),
)
const ordinaryOnly = computed(
  () =>
    !requestedSkill.value && talkMode.value === 'single' && target.value?.npcType === 'ordinary',
)
const draftKey = computed(() =>
  talkMode.value === 'single' ? selected.value : '$' + talkMode.value,
)
const messages = computed(() =>
  data.items.value.filter((m) => filter.value === 'all' || m.npcId === filter.value),
)
const latestNpc = computed(
  () => [...data.items.value].reverse().find((m) => m.kind === 'npc')?.npcId,
)
const art = computed(() =>
  data.npcs.value.find(
    (n) =>
      n.id ===
      (pinned.value ||
        (filter.value === 'all' ? latestNpc.value : selected.value) ||
        selected.value),
  ),
)
const draft = computed({
  get: () => drafts.value[draftKey.value] ?? '',
  set: (v) => (drafts.value = { ...drafts.value, [draftKey.value]: v }),
})
const unreadFor = (id: string) =>
  data.items.value.filter((m) => m.npcId === id && messageCursor(m) > (seen.value[id] ?? ''))
    .length +
  props.events.filter(
    (e) =>
      e.type === 'npc.reply' &&
      e.facts.npcId === id &&
      e.sequence > (npcEventSeen.value[id] ?? initialHead.value) &&
      !data.items.value.some(
        (m) => m.kind === 'npc' && m.conversationId === e.facts.conversationId,
      ),
  ).length
const messageCursor = (m: { at: string; id: string; order: number }) =>
  m.at + '|' + String(m.order).padStart(16, '0') + '|' + m.id
const unread = computed(
  () =>
    [
      ...new Set([
        ...data.items.value.map((m) => m.npcId),
        ...props.events.filter((e) => e.type === 'npc.reply').map((e) => String(e.facts.npcId)),
      ]),
    ].reduce((s, id) => s + unreadFor(id), 0) +
    props.events.filter((e) => e.sequence > broadcastSeen.value && e.type !== 'npc.reply').length,
)
watch(
  data.baseline,
  () => {
    const next = { ...seen.value }
    for (const m of data.items.value) if (!seen.value[m.npcId]) next[m.npcId] = messageCursor(m)
    seen.value = next
  },
  { flush: 'post' },
)
const broadcasts = computed(() =>
  props.events.filter(
    (e) =>
      e.branchId === props.view.broadcast.branchId &&
      e.type !== 'npc.reply' &&
      e.type !== 'npc.plan' &&
      e.type !== 'npc.dialogue-status' &&
      (broadcastFilter.value === 'all' ||
        (broadcastFilter.value === 'narration'
          ? e.type === 'ai.narration'
          : e.type !== 'ai.narration')),
  ),
)
const sources = (event: BroadcastEvent) => {
  const ids =
    props.view.ai.jobs.find((j) => j.kind === 'narration' && j.id === event.facts.jobId)
      ?.eventIds ?? []
  return props.events.filter((e) => ids.includes(e.id))
}
watch(
  () => props.view.broadcast.branchId,
  () => {
    notice.value = '已切换存档分支；旧分支播放已取消。'
    drafts.value = {}
    recipientIds.value = []
    seen.value = {}
    play.all()
  },
)
async function show() {
  focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  open.value = true
  emit('expand')
  if (mobile.value) emit('opened')
  await nextTick()
  focusDock(panel.value)
  panel.value?.focus()
}
function close() {
  stopSplit()
  settingsOpen.value = false
  open.value = false
  if (props.docked && enabled.value) emit('collapse')
  void nextTick(() => { if (focus?.isConnected) focus.focus(); else launcher.value?.focus() })
}
function choose(id: string) {
  if (talkMode.value !== 'single') {
    if (recipientIds.value.includes(id))
      recipientIds.value = recipientIds.value.filter((n) => n !== id)
    else if (recipientIds.value.length >= 5)
      notice.value = '每次最多选择 5 位 NPC，请先取消其他对象。'
    else recipientIds.value = [...recipientIds.value, id]
    filter.value = 'all'
    return
  }
  selected.value = id
  filter.value = id
}
function changeTalkMode() {
  recipientIds.value = []
  notice.value = ''
  if (talkMode.value !== 'single') filter.value = 'all'
}
function selectAudience() {
  if (eligible.value.length > 5) {
    notice.value = `当前有 ${eligible.value.length} 位可交谈 NPC；请手动选择，最多 5 位。`
    return
  }
  recipientIds.value = eligible.value.map((n) => n.id)
  notice.value = eligible.value.length ? '' : '当前没有满足距离、视线和状态要求的 NPC。'
}
watch(
  () => [props.view.scene?.id, character.value, props.view.self.characterIds.join(',')].join(':'),
  () => {
    recipientIds.value = []
    requestedSkill.value = ''
    requestGoal.value = ''
    primaryNpcId.value = ''
  },
)
function read() {
  const next = { ...seen.value }
  for (const m of messages.value) next[m.npcId] = messageCursor(m)
  seen.value = next
  const events = { ...npcEventSeen.value }
  for (const e of props.events)
    if (e.type === 'npc.reply' && (filter.value === 'all' || e.facts.npcId === filter.value)) {
      const id = String(e.facts.npcId)
      if (
        messages.value.some((m) => m.kind === 'npc' && m.conversationId === e.facts.conversationId)
      )
        events[id] = Math.max(events[id] ?? 0, e.sequence)
    }
  npcEventSeen.value = events
}
function favorite() {
  if (!selected.value) return
  favorites.value = favorites.value.includes(selected.value)
    ? favorites.value.filter((id) => id !== selected.value)
    : [...favorites.value, selected.value]
}
async function send() {
  if (!active.value || localBusy.value || props.busy) return
  if (
    requestedSkill.value &&
    (!requestGoal.value.trim() ||
      (talkMode.value !== 'single' && !recipientIds.value.includes(primaryNpcId.value)))
  ) {
    notice.value = '请填写检定诉求，并在多人交谈时选择主检定对象。'
    return
  }
  const npc = target.value,
    body = draft.value,
    captured = scope(),
    key = draftKey.value
  localBusy.value = true
  try {
    const ok = await props.submit(
      talkMode.value !== 'single'
        ? {
            kind: 'npc-talk-group',
            npcIds: [...recipientIds.value],
            characterId: character.value,
            message: body,
            mode: talkMode.value,
            requestedSkill: requestedSkill.value || undefined,
            primaryNpcId: requestedSkill.value ? primaryNpcId.value : undefined,
            goal: requestedSkill.value ? requestGoal.value : undefined,
          }
        : npc!.npcType === 'ordinary' && !requestedSkill.value
          ? { kind: 'npc-fixed-talk', npcId: npc!.id, characterId: character.value }
          : {
              kind: 'npc-talk',
              npcId: npc!.id,
              characterId: character.value,
              message: body,
              goal: requestedSkill.value ? requestGoal.value : '',
              requestedSkill: requestedSkill.value || undefined,
              visibility: 'public',
            },
    )
    if (captured === scope()) {
      if (ok && drafts.value[key] === body) drafts.value = { ...drafts.value, [key]: '' }
      if (ok) await data.refresh()
    }
  } finally {
    if (captured === scope()) localBusy.value = false
  }
}
function togglePortrait() {
  const visible = portraitOpen.value && (!narrowPortrait.value || settingsPortrait.value)
  portraitOpen.value = !visible
  settingsPortrait.value = !visible
}
function changeDelivery(event: Event) {
  void props.submit({
    kind: 'message-delivery',
    mode: (event.target as HTMLSelectElement).value as 'web' | 'both',
  })
}
let splitGesture: {
  element: HTMLElement
  id: number
  y: number
  ratio: number
  height: number
} | null = null
function stopSplit() {
  if (splitGesture?.element.hasPointerCapture(splitGesture.id))
    splitGesture.element.releasePointerCapture(splitGesture.id)
  splitGesture = null
  window.removeEventListener('pointermove', moveSplit)
  window.removeEventListener('pointerup', stopSplit)
  window.removeEventListener('pointercancel', stopSplit)
}
function moveSplit(event: PointerEvent) {
  if (!splitGesture || event.pointerId !== splitGesture.id) return
  split.value = Math.max(
    15,
    Math.min(
      50,
      Math.round(
        splitGesture.ratio + ((event.clientY - splitGesture.y) / splitGesture.height) * 100,
      ),
    ),
  )
}
function startSplit(event: PointerEvent) {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
  stopSplit()
  splitGesture = {
    element: event.currentTarget,
    id: event.pointerId,
    y: event.clientY,
    ratio: split.value,
    height: panel.value?.clientHeight || 1,
  }
  event.currentTarget.setPointerCapture(event.pointerId)
  event.currentTarget.focus()
  window.addEventListener('pointermove', moveSplit)
  window.addEventListener('pointerup', stopSplit)
  window.addEventListener('pointercancel', stopSplit)
  event.preventDefault()
}
function splitKey(event: KeyboardEvent) {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  split.value =
    event.key === 'Home'
      ? 15
      : event.key === 'End'
        ? 50
        : Math.max(15, Math.min(50, split.value + (event.key === 'ArrowDown' ? 2 : -2)))
}
function key(event: KeyboardEvent) {
  if (visible.value && event.key === 'Escape' && !event.defaultPrevented) {
    if (props.docked && !panel.value?.contains(event.target as Node)) return
    event.stopPropagation()
    if (settingsOpen.value) {
      settingsOpen.value = false
      void nextTick(() =>
        panel.value
          ?.querySelector<HTMLButtonElement>('[aria-controls="message-settings"]')
          ?.focus(),
      )
      return
    }
    if (tradeOpen.value) { closeTrade(); return }
    if (!props.docked) close()
  }
}
watch(visible, (v) => {
  if (v) window.addEventListener('keydown', key)
  else window.removeEventListener('keydown', key)
}, { immediate: true })
onBeforeUnmount(() => {
  stopSplit()
  window.removeEventListener('keydown', key)
  drafts.value = {}
  try {
    sessionStorage.removeItem('trpg.message-drafts.' + scope())
  } catch {}
})
function openNpc(id: string) {
  talkMode.value = 'single'
  selected.value = id
  filter.value = id
  phoneTab.value = 'dialogue'
  void show()
}
defineExpose({ close, openNpc })
</script>
<template>
  <Teleport defer :to="docked && dockTarget ? dockTarget : 'body'">
    <button
      v-if="enabled && !docked && props.active !== false"
      ref="launcher"
      class="message-dot"
      :class="{ mobile }"
      :style="
        mobile
          ? undefined
          : { left: Math.max(12, layout.dot.x - 72) + 'px', top: layout.dot.y + 'px' }
      "
      @pointerdown="startGesture($event, 'dot')"
      @click="shouldOpenFromClick($event) && (open ? close() : show())"
    >
      {{ controlText('room.messages') }} <span v-if="unread">{{ unread }}</span>
    </button>
    <section
      v-if="visible"
      ref="panel"
      class="message-window"
      data-trpg-dock="message"
      :class="{ mobile: mobile && !docked, docked, 'trade-covered':tradeOpen }"
      :style="
        mobile || docked
          ? undefined
          : {
              left: messageBox.x + 'px',
              top: messageBox.y + 'px',
              width: messageBox.width + 'px',
              height: messageBox.height + 'px',
            }
      "
      :role="docked ? 'region' : 'dialog'"
      :aria-label="docked ? workspaceText('messageRail') : controlText('room.messageWindow')"
      tabindex="-1"
      @pointerdown="focusDock(panel)"
    >
      <header class="message-header">
        <strong
          class="drag-title"
          tabindex="0"
          :aria-label="docked ? workspaceText('messageRail') : controlText('room.dragMessage')"
          @pointerdown="!docked && startGesture($event, 'panel')"
          @keydown="!docked && keyAdjust($event, 'panel')"
          >{{ controlText('room.messagesTalk') }}</strong
        >
        <select v-model="broadcastFilter" :aria-label="controlText('domain.broadcastFilter')" class="broadcast-filter">
          <option value="all">{{ controlText('domain.allBroadcasts') }}</option>
          <option value="system">{{ controlText('room.systemStory') }}</option>
          <option value="narration">{{ controlText('controls.narration') }}</option>
        </select>
        <button
          v-if="mobile"
          @click="phoneTab = phoneTab === 'dialogue' ? 'broadcast' : 'dialogue'"
        >
          {{ phoneTab === 'dialogue' ? controlText('controls.broadcast') : controlText('controls.dialogue') }}
        </button>
        <button v-if="view.self.role === 'gm'" @click="emit('review')">{{ controlText('room.quickReview') }}</button>
        <button
          :aria-expanded="settingsOpen"
          aria-controls="message-settings"
          @click="settingsOpen = !settingsOpen"
        >
          {{ controlText('controls.more') }}
        </button>
        <button :aria-label="controlText('room.minimizeMessage')" @click="close">{{ controlText('controls.collapse') }}</button>
      </header>
      <div v-if="settingsOpen" id="message-settings" class="message-settings" :aria-label="controlText('room.messageSettings')">
        <div class="settings-actions">
          <button v-if="!mobile && !docked" @click="resize(100, 60)">{{ controlText('domain.enlarge') }}</button>
          <button v-if="!mobile && !docked" @click="resize(-100, -60)">{{ controlText('domain.shrink') }}</button>
          <button v-if="!docked" @click="reset">{{ controlText('domain.reset') }}</button>
          <button @click="emit('history')">{{ controlText('room.branchHistory') }}</button>
          <button @click="togglePortrait()">
            {{ portraitOpen && (!narrowPortrait || settingsPortrait) ? controlText('controls.collapse') : controlText('controls.expand') }}{{ controlText('domain.illustration') }}
          </button>
          <button :disabled="!selected" @click="favorite">
            {{ favorites.includes(selected) ? controlText('expressionTwo.removeFavorite') : controlText('expressionTwo.favoriteItem') }}
          </button>
          <button v-if="art" @click="pinned = pinned ? '' : art!.id">
            {{ pinned ? controlText('expressionTwo.unpinPortrait') : controlText('domain.pinPortrait') }}
          </button>
        </div>
        <label><input v-model="play.enabled.value" type="checkbox" />{{ controlText('domain.segmented') }}</label>
        <label
          >{{ controlText('room.playSpeed') }}<select v-model.number="play.speed.value">
            <option :value="800">{{ controlText('room.fast') }}</option>
            <option :value="1600">{{ controlText('room.medium') }}</option>
            <option :value="3000">{{ controlText('room.slow') }}</option>
          </select></label
        >
        <label v-if="!mobile"
          >{{ controlText('room.broadcastRatio') }}<input v-model.number="split" type="range" min="15" max="50"
        /></label>
        <label v-if="view.self.role === 'gm'"
          >{{ controlText('room.roomChannel') }}<select
            :value="view.messageDelivery ?? 'both'"
            :disabled="busy"
            @change="changeDelivery"
          >
            <option value="both">{{ controlText('room.webQq') }}</option>
            <option value="web">{{ controlText('room.webOnly') }}</option>
          </select></label
        >
        <button @click="settingsOpen = false">{{ controlText('room.closeSettings') }}</button>
      </div>
      <p v-if="notice || data.error.value" role="status">{{ notice || data.error.value }}</p>
      <section
        v-show="!mobile || phoneTab === 'broadcast'"
        class="broadcast-box"
        :style="!mobile ? { flexBasis: split + '%' } : undefined"
        :aria-label="controlText('domain.broadcastWindow')"
      >
        <MessageBroadcastFeed
          :key="broadcastFilter"
          :events="broadcasts"
          :branch="view.broadcast.branchId"
          :visible="!mobile || phoneTab === 'broadcast'"
          :sources="sources"
          @read="broadcastSeen = view.broadcast.head"
        />
      </section>
      <div
        v-if="!mobile"
        class="broadcast-divider"
        role="separator"
        tabindex="0"
        :aria-label="controlText('room.resizeBroadcast')"
        aria-orientation="horizontal"
        :aria-valuenow="split"
        :aria-valuemin="15"
        :aria-valuemax="50"
        @pointerdown="startSplit"
        @keydown="splitKey"
      >
        <span />
      </div>
      <section v-show="!mobile || phoneTab === 'dialogue'" class="dialogue-box">
        <aside v-if="portraitOpen && (!narrowPortrait || settingsPortrait)" class="npc-art">
          <img
            v-if="safePortrait(art?.illustration || art?.portrait)"
            :src="safePortrait(art?.illustration || art?.portrait)!"
            :alt="localizedEntryName(art) + controlText('domain.illustration')"
            loading="lazy"
          /><CharacterAvatar v-else :name="art?.name ?? '选择NPC'" :size="100" />
          <p>{{ localizedEntryName(art) ?? controlText('expressionTwo.selectNpcToViewCharacter') }}</p>
        </aside>
        <div class="dialogue-main">
          <div class="talk-modes">
            <MapTargetsButton :items="data.npcs.value" :max="talkMode==='single'?1:5" :model-value="talkMode==='single'?(selected?[selected]:[]):recipientIds" :label="controlText('finalField.selectAConversationTargetOnTheMap')" @update:model-value="ids=>{if(talkMode==='single'){selected=ids[0]??'';filter=selected||'all'}else{recipientIds=ids;filter='all'}}" />
            <label
              >{{ controlText('game.talkMode') }}<select v-model="talkMode" :aria-label="controlText('game.talkMode')" @change="changeTalkMode">
                <option value="single">{{ controlText('room.singleTalk') }}</option>
                <option value="group">{{ controlText('room.groupTalk') }}</option>
                <option value="shout">{{ controlText('domain.everyone') }}</option>
              </select></label
            >
            <button v-if="talkMode === 'shout'" @click="selectAudience">{{ controlText('room.chooseTalkTarget') }}</button>
            <button v-if="talkMode !== 'single' && recipientIds.length" @click="recipientIds = []">
              {{ controlText('domain.clearSelection') }}
            </button>
          </div>
          <div class="npc-picker">
            <button
              :class="{ active: filter === 'all' }"
              :aria-pressed="filter === 'all'"
              @click="filter = 'all'"
            >
              {{ controlText('controls.targetAll') }}
            </button>
            <button
              v-for="n in choices"
              :key="n.id"
              :class="{
                active: talkMode === 'single' ? n.id === selected : recipientIds.includes(n.id),
              }"
              :aria-pressed="
                talkMode === 'single' ? n.id === selected : recipientIds.includes(n.id)
              "
              :disabled="
                talkMode !== 'single' &&
                !(n.groupCharacters ?? n.characters).includes(character) &&
                !recipientIds.includes(n.id)
              "
              :title="localizedEntryName(n)"
              :aria-label="localizedEntryName(n)"
              @click="choose(n.id)"
            >
              <CharacterAvatar :name="n.name" :portrait="n.portrait" :size="32" />
              <span class="npc-short-name">{{ pickerName(n) }}</span
              ><small v-if="unreadFor(n.id)" class="npc-unread">{{ unreadFor(n.id) }}</small>
            </button>
          </div>
          <MessageFeed
            :scope="filter"
            :items="messages"
            :npcs="data.npcs.value"
            :view="view"
            :shown="play.shown.value"
            :older="!!data.older.value"
            :loading="data.loading.value"
            @read="read"
            @older="data.refresh(true)"
            @next="play.next"
          />
        </div>
      </section>
      <footer v-show="!mobile || phoneTab === 'dialogue'">
        <div v-if="playing" class="playback">
          <span>{{ controlText('domain.segmented') }}</span
          ><button @click="play.paused.value = !play.paused.value">
            {{ play.paused.value ? controlText('controls.continue') : controlText('controls.pause') }}
          </button>
          <button @click="play.all">{{ controlText('controls.showAll') }}</button>
        </div>
        <div class="talk-target">
          <button ref="tradeEntry" :aria-expanded="tradeOpen" @click="tradeOpen=!tradeOpen">{{ controlText('domain.trade') }}</button>
          <strong
            >{{ controlText('room.speakingTo') }}{{
              talkMode === 'single'
                ? (localizedEntryName(target) ?? (selected ? controlText('expressionTwo.previousTargetIsNoLongerAvailableForConversation') : controlText('expressionTwo.chooseNpc')))
                : recipients.map(pickerName).join('、') || controlText('expressionTwo.chooseMultipleNpcs')
            }}{{ controlText('room.talkPublic') }}</strong
          ><label
            >{{ controlText('game.talkMode') }}<select v-model="requestedSkill" :aria-label="controlText('room.socialMethod')">
              <option value="">{{ controlText('domain.ordinaryTalk') }}</option>
              <option value="persuasion">{{ controlText('domain.askPersuasion') }}</option>
              <option value="deception">{{ controlText('domain.askDeception') }}</option>
              <option value="intimidation">{{ controlText('domain.askIntimidation') }}</option>
              <option value="performance">{{ controlText('domain.askPerformance') }}</option>
              <option value="animal-handling">{{ controlText('domain.askAnimal') }}</option>
            </select></label
          ><label
            >{{ controlText('controls.character') }}<select v-model="character" :aria-label="controlText('game.speaker')">
              <option v-for="c in own" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
            </select></label
          >
        </div>
        <p v-if="targetAttitudes.length" class="target-attitudes" :aria-label="controlText('room.relationshipBand')">
          <span>{{ controlText('room.relationship') }}</span><span v-for="item in targetAttitudes" :key="item.id">{{ localizedEntryName(item) }} · {{ item.band }}</span>
        </p>
        <div v-if="requestedSkill" class="talk-target">
          <label
            >{{ controlText('room.socialGoal') }}<input v-model="requestGoal" maxlength="500" :placeholder="controlText('room.wantedResult')"
          /></label>
          <label v-if="talkMode !== 'single'"
            >{{ controlText('room.primaryTarget') }}<select v-model="primaryNpcId">
              <option value="">{{ controlText('game.choose') }}</option>
              <option v-for="n in recipients" :key="n.id" :value="n.id">{{ pickerName(n) }}</option>
            </select></label
          >
          <small>{{ controlText('room.checkHelp') }}</small>
        </div>
        <p v-if="talkMode !== 'single'" class="audience-hint" role="status">
          {{ controlText('quantity.groupDialogue', {p0:(controlText('game.selected')),p1:(recipientIds.length),p2:(recipients.filter((n) => n.npcType === 'important').length)}) }}</p>
        <p v-if="(selected || recipientIds.length) && !active" role="status">
          {{ controlText('room.invalidTalkTarget') }}
        </p>
        <div class="talk-compose">
          <textarea
            v-model="draft"
            :aria-label="controlText('room.sayToNpc')"
            :disabled="!active || ordinaryOnly"
            maxlength="2000"
            rows="2"
            :placeholder="ordinaryOnly ? controlText('expressionTwo.ordinaryNpcsUseFixedReplies') : controlText('domain.messageInput')"
          /><button
            :disabled="!active || busy || localBusy || (!ordinaryOnly && !draft.trim())"
            @click="send"
          >
            {{
              localBusy
                ? controlText('expressionTwo.submitting')
                : ordinaryOnly
                  ? controlText('expressionTwo.talkFixedReply')
                  : talkMode === 'single'
                    ? controlText('controls.send')
                    : controlText('expressionTwo.sendToSelectedNpcs')
            }}
          </button>
        </div>
        <button
          v-if="
            messages.some(
              (m) =>
                m.kind === 'player' &&
                ['queued', 'waiting-gm'].includes(m.status) &&
                view.self.characterIds.includes(m.characterId),
            )
          "
          @click="
            submit({
              kind: 'npc-talk-withdraw',
              jobId: messages.find(
                (m) =>
                  m.kind === 'player' &&
                  ['queued', 'waiting-gm'].includes(m.status) &&
                  view.self.characterIds.includes(m.characterId),
              )!.conversationId,
            })
          "
        >
          {{ controlText('room.withdrawTalk') }}
        </button>
      </footer>
      <button
        v-if="!mobile && !docked"
        class="resize-corner"
        :aria-label="controlText('room.resizeMessage')"
        @pointerdown="startGesture($event, 'resize')"
      >
        ↘
      </button>
    </section>
    <MessageTradeDock v-if="enabled" :view="view" :visible="visible&&tradeOpen" :npc-id="talkMode==='single'?selected:undefined" :character-id="character" :busy="busy" :box="tradePlacement.trade" :submit="submit" @close="closeTrade" />
  </Teleport>
</template>
<style scoped>
.talk-modes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 8px;
}
.talk-modes label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
}
.audience-hint {
  font-size: 0.75rem;
  margin: 4px 0;
}
.message-option {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.message-dot {
  position: fixed;
  width: 64px;
  z-index: 120;
  min-height: 44px;
  max-width: 130px;
  touch-action: none;
  right: 12px;
  bottom: 76px;
}
.message-dot:not(.mobile) {
  right: auto;
  height: 44px;
}
.message-window {
  position: fixed;
  z-index: 170;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 12px 36px #0004;
  overflow: hidden;
  min-width: 320px;
  min-height: min(520px, calc(100dvh - 24px));
  max-height: calc(100dvh - 24px);
}
.message-window button {
  min-height: 32px;
  padding: 4px 8px;
  font-size: 0.8rem;
  line-height: 1.3;
}
.message-window select {
  width: auto;
  min-height: 32px;
  padding: 4px 24px 4px 8px;
  font-size: 0.8rem;
}
.message-window select,
.message-window input,
.message-window textarea {
  min-width: 0;
  max-width: 100%;
}
.message-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.drag-title {
  flex: 1;
  min-width: 100px;
  touch-action: none;
  cursor: move;
  font-size: 0.95rem;
}
.broadcast-filter {
  flex: 0 1 125px;
  max-width: 140px;
}
.message-settings {
  position: absolute;
  right: 8px;
  top: 48px;
  z-index: 2;
  width: min(390px, calc(100% - 16px));
  max-height: 65%;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 6px 24px #0003;
  font-size: 0.8rem;
}
.settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.message-settings label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 0;
}
.message-settings input[type='checkbox'] {
  width: auto;
  min-height: 0;
}
.message-settings input[type='range'] {
  width: 55%;
  min-height: 24px;
  padding: 0;
}
.broadcast-box {
  display: flex;
  flex-direction: column;
  min-height: 60px;
  max-height: 50%;
  flex-shrink: 1;
  padding: 4px 10px;
}
.broadcast-divider {
  flex: 0 0 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  touch-action: none;
  border-block: 1px solid var(--line);
}
.broadcast-divider span {
  width: 42px;
  height: 3px;
  background: var(--line);
  border-radius: 3px;
}
.dialogue-box {
  display: flex;
  flex: 1;
  min-height: 80px;
  overflow: hidden;
}
.npc-art {
  flex: 0 0 20%;
  max-width: 145px;
  min-width: 0;
  overflow: auto;
  padding: 8px;
  text-align: center;
  font-size: 0.8rem;
}
.npc-art img {
  width: 100%;
  height: auto;
  object-fit: contain;
}
.npc-art p {
  overflow-wrap: anywhere;
  margin: 6px 0;
}
.dialogue-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.npc-picker {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;
  padding: 6px;
}
.npc-picker button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  max-width: 170px;
}
.npc-short-name {
  display: block;
  max-width: 110px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.npc-unread {
  font-size: 0.75rem;
  font-weight: bold;
}
.npc-picker button.active {
  border: 2px solid var(--accent, var(--ink));
}
.dialogue-main > :last-child {
  flex: 1;
}
.message-window footer {
  border-top: 1px solid var(--line);
  padding: 6px 8px 24px;
  flex-shrink: 0;
}
.playback,
.talk-target {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.8rem;
}
.playback {
  margin-bottom: 4px;
}
.talk-target {
  margin-bottom: 4px;
}
.talk-target strong {
  flex: 1 1 200px;
  overflow-wrap: anywhere;
}
.talk-target label {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.talk-target select {
  max-width: 150px;
}
.target-attitudes {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  max-height: 2.8em;
  overflow: auto;
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
.talk-compose {
  display: flex;
  align-items: stretch;
  gap: 6px;
}
.talk-compose textarea {
  flex: 1;
  resize: vertical;
  max-height: 100px;
  padding: 6px 8px;
  font-size: 0.9rem;
}
.talk-compose button {
  max-width: 110px;
}
.message-window .resize-corner {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 24px;
  min-height: 22px;
  height: 22px;
  padding: 0;
  touch-action: none;
  font-size: 14px;
}
.message-window.mobile {
  inset: 6px 4px calc(env(safe-area-inset-bottom) + 6px);
  width: auto;
  height: auto;
  min-width: 0;
  min-height: 0;
  max-width: none;
}
.mobile .broadcast-box {
  flex: 1;
  max-height: none;
}
.mobile footer {
  max-height: 45%;
  overflow: auto;
  padding-bottom: 8px;
}
.mobile .npc-art {
  flex-basis: 24%;
  max-width: 100px;
  padding: 4px;
}
.mobile .message-settings {
  top: 100px;
}
.mobile .message-header {
  gap: 4px;
}
.message-window > p {
  font-size: 0.8rem;
  margin: 3px 8px;
  flex-shrink: 0;
}
@media (pointer: coarse) {
  .message-window button,
  .message-window select {
    min-height: 44px;
  }
  .message-header {
    gap: 8px;
  }
}
@media(max-width:959px){.message-window.trade-covered{visibility:hidden;pointer-events:none}}
</style>
