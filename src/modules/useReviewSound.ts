import { shallowRef, watch, onBeforeUnmount } from 'vue'
import type { RoomView } from '../online/protocol'
import { pendingRoomReviews, pendingBattleReview } from './room-review-queue'

const preference = 'trpg-review-chime-v1'
export const reviewSoundEnabled = shallowRef(false)
export const reviewSoundNotice = shallowRef('')
try {
  reviewSoundEnabled.value = localStorage.getItem(preference) === 'on'
} catch {
  /* optional storage */
}
let context: AudioContext | undefined
async function audioReady() {
  if (typeof AudioContext === 'undefined') throw Error('此浏览器不支持审核提示音')
  if (!context || context.state === 'closed') context = new AudioContext()
  if (context.state !== 'running') {
    const audio = context
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        audio.resume(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Error('请点击“启用声音／试听”允许播放')), 1500)
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }
  if (context.state !== 'running') throw Error('请点击“启用声音／试听”允许播放')
  return context
}
export async function reviewChime() {
  try {
    const audio = await audioReady(),
      start = audio.currentTime
    for (const [offset, frequency] of [
      [0, 660],
      [0.13, 880],
    ] as const) {
      const tone = audio.createOscillator(),
        gain = audio.createGain()
      tone.type = 'sine'
      tone.frequency.value = frequency
      gain.gain.setValueAtTime(0, start + offset)
      gain.gain.linearRampToValueAtTime(0.09, start + offset + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.25)
      tone.connect(gain).connect(audio.destination)
      tone.start(start + offset)
      tone.stop(start + offset + 0.27)
      tone.onended = () => {
        tone.disconnect()
        gain.disconnect()
      }
    }
    reviewSoundNotice.value = ''
  } catch (error) {
    reviewSoundNotice.value =
      error instanceof Error ? error.message : '声音暂不可用，点击启用后重试'
    throw error
  }
}
export function setReviewSound(value: boolean) {
  reviewSoundEnabled.value = value
  reviewSoundNotice.value = ''
  try {
    localStorage.setItem(preference, value ? 'on' : 'off')
  } catch {
    /* optional storage */
  }
  if (value) void reviewChime().catch(() => {})
}
export function reviewPendingKeys(view: RoomView) {
  if (view.self.role !== 'gm') return []
  const q = pendingRoomReviews(view)
  const ids = Object.entries(q).flatMap(([kind, list]) =>
    Array.isArray(list)
      ? list.map(
          (r) =>
            `${kind}:${r.id}:${'status' in r ? r.status : 'state' in r ? r.state : ''}${'needsApproval' in r ? ':' + r.needsApproval : ''}`,
        )
      : [],
  )
  // A published reply may acquire a later independent check; it is a new review stage.
  for (const job of q.jobs) {
    if (job.checkSuggestion && !job.check?.adjudicated) ids.push(`job-check:${job.id}`)
    if (
      job.check?.adjudicated &&
      job.check.total !== null &&
      !job.groupInfluence &&
      job.dialogueGroup?.primaryNpcId === job.npcId
    )
      ids.push(`job-group:${job.id}`)
  }
  const battle = pendingBattleReview(view)
  if (battle) ids.push('battle:' + battle.key)
  for (const d of view.dice?.pending ?? []) ids.push('dice:' + d.id)
  for (const l of view.lanRequests ?? []) if (l.status === 'pending') ids.push('lan:' + l.id)
  for (const r of view.characterRequests ?? [])
    if (r.status === 'pending') ids.push('character:' + r.id)
  return ids
}

/** Initial snapshots establish history; only subsequent waiting stages enter the audible queue. */
export function useReviewSound(view: () => RoomView) {
  let scope = '',
    previous = new Set<string>(),
    pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined,
    active = true,
    playing = false,
    epoch = 0
  const cancelScheduled = () => {
    clearTimeout(timer)
    timer = undefined
  }
  const schedule = (delay = 250) => {
    if (timer) return
    if (
      !active ||
      !pending.size ||
      !reviewSoundEnabled.value ||
      document.visibilityState !== 'visible'
    )
      return
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, delay)
  }
  async function flush() {
    if (
      playing ||
      !active ||
      !pending.size ||
      !reviewSoundEnabled.value ||
      document.visibilityState !== 'visible' ||
      view().self.role !== 'gm'
    )
      return
    playing = true
    const ownEpoch = epoch,
      ownScope = scope
    let completed = false
    const valid = () =>
      active &&
      ownEpoch === epoch &&
      ownScope === scope &&
      reviewSoundEnabled.value &&
      view().self.role === 'gm' &&
      document.visibilityState === 'visible'
    const play = async () => {
      if (!valid()) return
      const key = 'trpg-review-chime-played-v2:' + ownScope
      let last: { at: number; keys: string[] } | undefined
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (
          value &&
          typeof value === 'object' &&
          'at' in value &&
          typeof value.at === 'number' &&
          'keys' in value &&
          Array.isArray(value.keys)
        )
          last = {
            at: value.at,
            keys: value.keys.filter((id): id is string => typeof id === 'string'),
          }
      } catch {
        /* optional storage */
      }
      if (last) {
        for (const id of last.keys) pending.delete(id)
        const wait = 1800 - (Date.now() - last.at)
        if (wait > 0) {
          schedule(wait + 20)
          return
        }
      }
      const ids = [...pending]
      if (!ids.length || !valid()) return
      await audioReady()
      if (!valid()) return
      await reviewChime()
      // Mark only after audio has actually been scheduled, not before an autoplay failure.
      if (!valid()) return
      for (const id of ids) pending.delete(id)
      completed = true
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), keys: [...new Set([...(last?.keys ?? []), ...ids])].slice(-3000) }))
      } catch {
        /* optional storage */
      }
    }
    try {
      if (navigator.locks) await navigator.locks.request('trpg-review-chime:' + ownScope, play)
      else await play()
    } catch (error) {
      if (valid())
        reviewSoundNotice.value =
          error instanceof Error ? error.message : '声音暂不可用，点击启用后重试'
      // Keep waiting items. Retry on a user gesture or return to this tab, without a busy loop.
    } finally {
      playing = false
      if (completed && valid() && pending.size) schedule(1800)
      else if (ownEpoch !== epoch && pending.size) schedule()
    }
  }
  const unlock = () => {
    if (!reviewSoundEnabled.value) return
    void audioReady()
      .then(() => {
        reviewSoundNotice.value = ''
        schedule()
      })
      .catch((error) => {
        reviewSoundNotice.value = error instanceof Error ? error.message : '请点击启用声音'
      })
  }
  const visibility = () => {
    if (document.visibilityState === 'visible') schedule()
    else cancelScheduled()
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === preference) reviewSoundEnabled.value = e.newValue === 'on'
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', visibility)
  watch(
    () => [
      view().id,
      view().broadcast.branchId,
      view().self.id,
      view().self.role,
      ...reviewPendingKeys(view()),
    ],
    () => {
      const v = view(),
        key = `${v.id}:${v.self.id}:${v.broadcast.branchId}:${v.self.role}`,
        ids = new Set(reviewPendingKeys(v))
      if (key !== scope) {
        scope = key
        epoch++
        previous = ids
        pending.clear()
        cancelScheduled()
        return
      }
      for (const id of pending) if (!ids.has(id)) pending.delete(id)
      if (reviewSoundEnabled.value && v.self.role === 'gm')
        for (const id of ids) if (!previous.has(id)) pending.add(id)
      previous = ids
      schedule()
    },
    { immediate: true },
  )
  watch(
    reviewSoundEnabled,
    () => {
      epoch++
      pending.clear()
      cancelScheduled()
      previous = new Set(reviewPendingKeys(view()))
    },
    { flush: 'sync' },
  )
  onBeforeUnmount(() => {
    active = false
    epoch++
    pending.clear()
    cancelScheduled()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('storage', onStorage)
    document.removeEventListener('visibilitychange', visibility)
  })
}
