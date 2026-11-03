import { shallowRef, watch, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type { RoomView } from '../../online/protocol'
import type { RoomMessage, RoomMessages, MessageNpc } from '../../online/message-types'
export function useRoomMessages(
  view: () => RoomView,
  open: Ref<boolean>,
  request: <T>(s: string) => Promise<T | null>,
) {
  const items = shallowRef<RoomMessage[]>([]),
    npcs = shallowRef<MessageNpc[]>([]),
    older = shallowRef<string | null>(null),
    error = shallowRef(''),
    loading = shallowRef(false)
  const baseline = shallowRef(0)
  let epoch = 0,
    stamp = '',
    branch = '',
    timer: ReturnType<typeof setInterval> | undefined
  function reset() {
    epoch++
    items.value = []
    npcs.value = []
    older.value = null
    stamp = ''
    branch = ''
    loading.value = false
    baseline.value++
  }
  watch(
    () =>
      [
        view().id,
        view().self.id,
        view().self.role,
        view().self.characterIds.join(','),
        view().broadcast.branchId,
      ].join(':'),
    reset,
    { immediate: true },
  )
  async function refresh(history = false) {
    if (loading.value || !open.value || document.hidden) return
    const captured = epoch
    loading.value = true
    try {
      const data = await request<RoomMessages>(
        'messages' + (history && older.value ? '?before=' + encodeURIComponent(older.value) : ''),
      )
      if (captured !== epoch || !data) return
      if (branch && branch !== data.branchId) {
        reset()
        void refresh()
        return
      }
      const initial = !branch
      branch = data.branchId
      const permitted = new Set(data.permittedConversationIds)
      const merged = new Map(
        items.value.filter((i) => permitted.has(i.conversationId)).map((i) => [i.id, i]),
      )
      for (const i of data.items) merged.set(i.id, i)
      // Cancelled/permission-changed scopes clear via the watcher, not by retaining a global cache.
      items.value = [...merged.values()].sort(
        (a, b) => a.at.localeCompare(b.at) || a.order - b.order || a.id.localeCompare(b.id),
      )
      if (initial || history) older.value = data.older
      if (initial || history) baseline.value++
      if (stamp !== data.directoryStamp) {
        const directory = await request<MessageNpc[]>('message-npcs')
        if (captured !== epoch) return
        npcs.value = directory ?? []
        stamp = data.directoryStamp
      }
      error.value = ''
    } catch {
      if (captured === epoch) error.value = '消息暂未同步，请重试；不会自动重发交谈。'
    } finally {
      if (captured === epoch) loading.value = false
    }
  }
  watch(open, (value) => {
    clearInterval(timer)
    if (value) {
      void refresh()
      timer = setInterval(() => void refresh(), 3000)
    }
  }, { immediate: true })
  onBeforeUnmount(() => {
    reset()
    clearInterval(timer)
  })
  return { items, npcs, older, error, loading, baseline, refresh }
}
