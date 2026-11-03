import { shallowRef, watch, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type { RoomMessage } from '../../online/message-types'
export function useMessagePlayback(items: Ref<RoomMessage[]>, baseline: Ref<number>) {
  const shown = shallowRef<Record<string, number>>({}),
    paused = shallowRef(false),
    speed = shallowRef(1600),
    enabled = shallowRef(true)
  let known = new Set<string>(),
    timer: ReturnType<typeof setInterval> | undefined,
    last = 0
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  function all() {
    shown.value = Object.fromEntries(items.value.map((m) => [m.id, m.segments.length]))
  }
  watch(
    baseline,
    () => {
      known = new Set(items.value.map((m) => m.id))
      all()
    },
    { flush: 'post' },
  )
  watch(items, (messages) => {
    const next = { ...shown.value }
    for (const m of messages)
      if (!known.has(m.id)) {
        known.add(m.id)
        const earlierPending = messages.some(
          (p) =>
            p.id !== m.id &&
            known.has(p.id) &&
            (next[p.id] ?? p.segments.length) < p.segments.length,
        )
        next[m.id] =
          m.kind === 'npc' && enabled.value && !reduced
            ? earlierPending
              ? 0
              : 1
            : m.segments.length
      }
    shown.value = next
  })
  function next() {
    const m = items.value.find((m) => (shown.value[m.id] ?? m.segments.length) < m.segments.length)
    if (m) shown.value = { ...shown.value, [m.id]: (shown.value[m.id] ?? 0) + 1 }
  }
  timer = setInterval(() => {
    if (!paused.value && enabled.value && !document.hidden && Date.now() - last >= speed.value) {
      next()
      last = Date.now()
    }
  }, 250)
  watch(enabled, (v) => {
    if (!v) all()
  })
  onBeforeUnmount(() => clearInterval(timer))
  return { shown, paused, speed, enabled, all, next }
}
