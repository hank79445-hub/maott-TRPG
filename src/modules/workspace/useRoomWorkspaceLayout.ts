import { computed, onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from 'vue'

export const TOOL_MIN = 320
export const TOOL_MAX = 520
export const MESSAGE_MIN = 320
export const MESSAGE_MAX = 600
const bounded = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))
export function workspaceGeometry(
  width: number,
  gm: boolean,
  tools: number,
  messages: number,
  toolsClosed: boolean,
  messagesClosed: boolean,
  enabled: boolean,
  focused: boolean,
) {
  const desktop = width > 1024
  const docked = desktop && width >= 1600 && !gm && enabled && !messagesClosed && !focused
  const toolMax = desktop
    ? Math.max(TOOL_MIN, Math.min(TOOL_MAX, width - 24 - (docked ? 800 + MESSAGE_MIN : 700)))
    : TOOL_MAX
  const toolWidth = bounded(tools, TOOL_MIN, toolMax)
  const toolSpace = desktop && !toolsClosed && !focused ? toolWidth : 0
  const messageMax = docked
    ? Math.max(MESSAGE_MIN, Math.min(MESSAGE_MAX, width - 24 - 800 - toolSpace))
    : MESSAGE_MAX
  const messageWidth = bounded(messages, MESSAGE_MIN, messageMax)
  return {
    desktop,
    docked,
    toolMax,
    toolWidth,
    toolSpace,
    messageMax,
    messageWidth,
    messageSpace: docked ? messageWidth : 0,
  }
}

export function useRoomWorkspaceLayout(
  gm: Ref<boolean>,
  enabled: Ref<boolean>,
  focused: Ref<boolean>,
) {
  const viewport = shallowRef(typeof window === 'undefined' ? 1440 : window.innerWidth)
  const toolPreference = shallowRef<number | null>(null),
    messagePreference = shallowRef<number | null>(null)
  const toolsClosed = shallowRef(false),
    messagesClosed = shallowRef(false)
  const key = () => 'trpg.room-workspace.' + (gm.value ? 'gm' : 'player') + '.v1'
  function readWidth(value: unknown, min: number, max: number) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min
      ? bounded(value, min, max)
      : null
  }
  watch(
    gm,
    () => {
      let saved: Record<string, unknown> = {},
        exists = false
      try {
        const raw = localStorage.getItem(key())
        exists = raw !== null
        saved = raw ? (JSON.parse(raw) ?? {}) : {}
        if (typeof saved !== 'object') saved = {}
        if (!exists) saved.tools = Number(localStorage.getItem('trpg-character-rail-width'))
      } catch {
        /* Browser storage is optional. */
      }
      toolPreference.value = readWidth(saved.tools, TOOL_MIN, TOOL_MAX)
      messagePreference.value = readWidth(saved.messages, MESSAGE_MIN, MESSAGE_MAX)
      toolsClosed.value = saved.toolsClosed === true
      messagesClosed.value = saved.messagesClosed === true
    },
    { immediate: true, flush: 'sync' },
  )
  watch(
    [toolPreference, messagePreference, toolsClosed, messagesClosed],
    () => {
      try {
        localStorage.setItem(
          key(),
          JSON.stringify({
            tools: toolPreference.value,
            messages: messagePreference.value,
            toolsClosed: toolsClosed.value,
            messagesClosed: messagesClosed.value,
          }),
        )
      } catch {
        /* Browser storage is optional. */
      }
    },
    { flush: 'sync' },
  )
  const geometry = computed(() =>
    workspaceGeometry(
      viewport.value,
      gm.value,
      toolPreference.value ?? (gm.value && viewport.value >= 1280 ? 360 : 320),
      messagePreference.value ?? 380,
      toolsClosed.value,
      messagesClosed.value,
      enabled.value,
      focused.value,
    ),
  )
  function sync() {
    viewport.value = window.innerWidth
  }
  onMounted(() => {
    sync()
    window.addEventListener('resize', sync)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', sync))
  return {
    geometry,
    toolsClosed,
    messagesClosed,
    toolWidth: computed(() => geometry.value.toolWidth),
    messageWidth: computed(() => geometry.value.messageWidth),
    setTools(value: number) {
      if (Number.isFinite(value))
        toolPreference.value = bounded(value, TOOL_MIN, geometry.value.toolMax)
    },
    setMessages(value: number) {
      if (Number.isFinite(value))
        messagePreference.value = bounded(value, MESSAGE_MIN, geometry.value.messageMax)
    },
    resetTools() {
      toolPreference.value = null
    },
    resetMessages() {
      messagePreference.value = null
    },
  }
}
