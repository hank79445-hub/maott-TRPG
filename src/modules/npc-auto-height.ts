import type { Directive } from 'vue'
const cleanups = new WeakMap<HTMLElement, () => void>()
/** Opt-in container directive: never changes text or character limits. */
export const vNpcAutoHeight: Directive<HTMLElement> = {
  mounted(root) {
    root.setAttribute('data-npc-auto-height', '')
    const caps = new WeakMap<HTMLTextAreaElement, number>()
    let frame = 0
    const widths = new WeakMap<Element, number>()
    const tracked = new Set<HTMLTextAreaElement>()
    const values = new WeakMap<HTMLTextAreaElement, string>()
    const resize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        for (const el of root.querySelectorAll('textarea')) {
          if (!tracked.has(el)) {
            tracked.add(el)
            sizes.observe(el)
          }
          if (!el.getClientRects().length) continue
          if (el.classList.contains('expanded')) {
            el.style.removeProperty('min-height')
            el.style.removeProperty('height')
            el.style.overflowY = 'auto'
            values.set(el, el.value)
            continue
          }
          const cap = caps.get(el) ?? el.getBoundingClientRect().height
          if (cap < 1) continue
          caps.set(el, cap)
          el.style.minHeight = '0'
          // `auto` retains the native rows height (notably rows=12), preventing
          // short persona fields from shrinking. Measure from zero instead.
          el.style.height = '0px'
          const style = getComputedStyle(el)
          const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
          el.style.height = Math.min(cap, Math.max(44, el.scrollHeight + borders)) + 'px'
          el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden'
          values.set(el, el.value)
        }
      })
    }
    root.addEventListener('input', resize)
    root.addEventListener('toggle', resize, true)
    const observer = new MutationObserver(resize)
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    })
    const sizes = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        if (widths.get(entry.target) !== entry.contentRect.width) {
          widths.set(entry.target, entry.contentRect.width)
          changed = true
        }
      }
      if (changed) resize()
    })
    sizes.observe(root)
    // A child v-model can change the DOM value without an input event or a
    // parent directive update. Check only opted-in, mounted NPC textareas.
    const timer = window.setInterval(() => {
      for (const el of tracked) {
        if (!root.contains(el)) {
          tracked.delete(el)
          sizes.unobserve(el)
          continue
        }
        if (el.getClientRects().length && values.get(el) !== el.value) {
          resize()
          break
        }
      }
    }, 160)
    cleanups.set(root, () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      sizes.disconnect()
      window.clearInterval(timer)
      root.removeEventListener('input', resize)
      root.removeEventListener('toggle', resize, true)
    })
    resize()
  },
  updated(root) {
    root.dispatchEvent(new Event('input'))
  },
  unmounted(root) {
    root.removeAttribute('data-npc-auto-height')
    cleanups.get(root)?.()
    cleanups.delete(root)
  },
}
