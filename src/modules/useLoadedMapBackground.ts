import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

/** Keep the last decoded image only inside the same authorized scene projection. */
export function useLoadedMapBackground(
  source: () => { scope: string; blob?: Blob },
  io = {
    create: (blob: Blob) => URL.createObjectURL(blob),
    revoke: (url: string) => URL.revokeObjectURL(url),
    decode: async (url: string) => {
      const image = new Image()
      image.src = url
      await image.decode()
    },
  },
) {
  const background = ref(''), failed = ref(false)
  let scope = '', sequence = 0
  const urls = new Set<string>()
  const release = (url: string) => { if (urls.delete(url)) io.revoke(url) }
  watch([() => source().scope, () => source().blob], async ([key, blob]) => {
    const ticket = ++sequence
    failed.value = false
    if (scope !== key) {
      scope = key
      background.value = ''
      // Pending images from another scene/identity/branch must never become visible.
      for (const url of urls) release(url)
    }
    if (!key || !blob) return
    const candidate = io.create(blob)
    urls.add(candidate)
    try {
      await io.decode(candidate)
      if (ticket !== sequence) { release(candidate); return }
      const old = background.value
      background.value = candidate
      await nextTick()
      release(old)
    } catch {
      release(candidate)
      if (ticket === sequence) failed.value = true
    }
  }, { immediate: true })
  onBeforeUnmount(() => { sequence++; for (const url of urls) release(url) })
  return { background, failed }
}
