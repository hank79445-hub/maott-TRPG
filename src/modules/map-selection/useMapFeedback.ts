import { computed, inject, provide, ref, type InjectionKey } from 'vue'
import type { MapFeedbackFeed } from '../../online/map-feedback-types'
export interface FeedbackSource {
  feed?: MapFeedbackFeed
  epoch: number
  live: boolean
}
const key: InjectionKey<() => FeedbackSource> = Symbol('map-feedback')
export const provideMapFeedback = (source: () => FeedbackSource) => provide(key, source)
export const useMapFeedback = () => inject(key, null)
export const feedbackPreferences = ref<{
  mode: 'off' | 'reduced' | 'light'
  audience: 'all' | 'self'
}>({ mode: 'light', audience: 'all' })
let loaded = false
export function loadFeedbackPreferences() {
  if (loaded) return
  loaded = true
  try {
    const p = JSON.parse(localStorage.getItem('trpg-map-feedback-v01') ?? '{}')
    if (['off', 'reduced', 'light'].includes(p.mode) && ['all', 'self'].includes(p.audience))
      feedbackPreferences.value = p
  } catch {
    /* local presentation preferences only */
  }
}
export function saveFeedbackPreferences() {
  try {
    localStorage.setItem('trpg-map-feedback-v01', JSON.stringify(feedbackPreferences.value))
  } catch {
    /* unavailable storage never blocks play */
  }
}
