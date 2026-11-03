import { ref, watch, type Ref } from 'vue'
import {
  quickActionsSchema,
  type QuickAction,
  type QuickActions,
  quickActionBoard,
  type QuickActionBoard,
} from '../../persistence/quick-actions-schema'

export function useQuickActions(characterId: Ref<string>) {
  const state = ref<QuickActions>({ revision: 0, entries: [] }),
    ready = ref(false),
    busy = ref(false),
    message = ref(''),
    cloud = ref(false)
  let generation = 0,
    owner = ''
  const endpoint = (id: string) =>
    '/api/preferences/quick-actions?characterId=' + encodeURIComponent(id)
  const localKey = (id: string) => 'trpg-anonymous-quick-actions:' + id
  async function reload() {
    const g = ++generation,
      id = characterId.value
    ready.value = false
    busy.value = false
    message.value = ''
    state.value = { revision: 0, entries: [] }
    if (!id) return
    try {
      const account = await fetch('/api/account', { signal: AbortSignal.timeout(8000) })
      if (g !== generation) return
      cloud.value = account.ok
      if (account.ok) {
        owner = (await account.json()).accountId
        const response = await fetch(endpoint(id), { signal: AbortSignal.timeout(8000) })
        if (!response.ok) throw Error('云端收藏读取失败')
        const value = quickActionsSchema.parse(await response.json())
        if (g === generation) state.value = value
      } else if ([401, 404, 503].includes(account.status)) {
        owner = ''
        state.value = quickActionsSchema.parse(
          JSON.parse(localStorage.getItem(localKey(id)) ?? '{"revision":0,"entries":[]}'),
        )
      } else throw Error('账号状态读取失败')
      if (g === generation) ready.value = true
    } catch (e) {
      if (g === generation) message.value = (e as Error).message
    }
  }
  async function change(edit: (entries: QuickAction[]) => QuickAction[]) {
    if (!ready.value || busy.value) return
    busy.value = true
    message.value = ''
    const id = characterId.value,
      g = generation,
      currentOwner = owner,
      entries = edit(state.value.entries.map((e) => ({ ...e, board: quickActionBoard(e) })))
    try {
      const next = quickActionsSchema.parse({ ...state.value, entries })
      if (cloud.value) {
        const account = await fetch('/api/account')
        if (!account.ok || (await account.json()).accountId !== currentOwner)
          throw Error('账号已变化，请重新读取收藏')
        if (g !== generation || id !== characterId.value) return
        const response = await fetch(endpoint(id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        })
        const result = await response.json()
        if (!response.ok) throw Error(result.error ?? '收藏保存失败')
        if (g === generation) state.value = quickActionsSchema.parse(result)
      } else {
        next.revision++
        localStorage.setItem(localKey(id), JSON.stringify(next))
        if (g === generation) state.value = next
      }
    } catch (e) {
      if (g === generation) message.value = (e as Error).message
    } finally {
      if (g === generation) busy.value = false
    }
  }
  const same = (a: QuickAction, b: QuickAction) => a.kind === b.kind && a.key === b.key
  const toggle = (entry: QuickAction) =>
    change((entries) =>
      entries.some((e) => same(e, entry))
        ? entries.filter((e) => !same(e, entry))
        : [...entries, { ...entry, board: quickActionBoard(entry) }],
    )
  const setBoard = (entry: QuickAction, board: QuickActionBoard) =>
    change((entries) => entries.map((e) => (same(e, entry) ? { ...e, board } : e)))
  const reorder = (entry: QuickAction, direction: -1 | 1) =>
    change((entries) => {
      const indices = entries.flatMap((e, index) =>
        quickActionBoard(e) === quickActionBoard(entry) ? [index] : [],
      )
      const at = indices.findIndex((i) => same(entries[i]!, entry)),
        other = indices[at + direction]
      if (at >= 0 && other !== undefined) {
        const current = indices[at]!
        ;[entries[current], entries[other]] = [entries[other]!, entries[current]!]
      }
      return entries
    })
  watch(characterId, reload, { immediate: true })
  return { state, ready, busy, message, cloud, toggle, setBoard, reorder, reload }
}
