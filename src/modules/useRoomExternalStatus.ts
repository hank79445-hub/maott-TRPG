import { computed, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import type { RoomView } from '../online/protocol'
import type { RoomQqSummary } from '../online/room-status-types'
/** Shared by preparation and run status. One small request; no snapshots/history downloads. */
export function useRoomExternalStatus(
  view: Ref<RoomView | null>,
  request: <T>(suffix: string) => Promise<T | null>,
) {
  const state = shallowRef<RoomQqSummary | null>(null),
    error = shallowRef(''),
    loading = shallowRef(false)
  let epoch = 0,
    timer: ReturnType<typeof setInterval> | undefined
  const scope = computed(() =>
    view.value?.self.role === 'gm' ? view.value.id + ':' + view.value.self.id : '',
  )
  async function refresh() {
    if (!scope.value || loading.value || (typeof document !== 'undefined' && document.hidden))
      return
    const captured = epoch
    loading.value = true
    try {
      const next = await request<RoomQqSummary>('qq-summary')
      if (captured !== epoch) return
      state.value = next
      error.value = ''
    } catch {
      if (captured === epoch) {
        state.value = null
        error.value = 'QQ接入状态暂不可用；不影响Web保存，可稍后刷新。'
      }
    } finally {
      if (captured === epoch) loading.value = false
    }
  }
  watch(
    scope,
    () => {
      epoch++
      state.value = null
      error.value = ''
      loading.value = false
      void refresh()
    },
    { immediate: true },
  )
  onMounted(() => {
    timer = setInterval(() => {
      void refresh()
    }, 15000)
  })
  onBeforeUnmount(() => {
    epoch++
    clearInterval(timer)
    state.value = null
  })
  return { state, error, loading, refresh }
}
