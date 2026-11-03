import { computed, onBeforeUnmount, onMounted, readonly, shallowRef } from 'vue'
import {
  clampReviewLayout,
  defaultReviewLayout,
  restoreReviewLayout,
  REVIEW_MOBILE_WIDTH,
  type ReviewLayout,
} from './room-review-layout'

type DragTarget = 'dot' | 'panel' | 'resize'

export function useRoomReviewLayout(
  storageKey = 'trpg.room-review-layout.v1',
  initialSize: { width?: number; height?: number; minHeight?: number } = {},
) {
  function initial(viewport: { width: number; height: number }) {
    const base = defaultReviewLayout(viewport)
    return clampReviewLayout(
      {
        ...base,
        panel: {
          ...base.panel,
          width: initialSize.width ?? base.panel.width,
          height: initialSize.height ?? base.panel.height,
        },
      },
      viewport,
    )
  }
  const viewport = shallowRef({ width: window.innerWidth, height: window.innerHeight }),
    layout = shallowRef(initial(viewport.value)),
    dragging = shallowRef<DragTarget | null>(null),
    mobile = computed(() => viewport.value.width <= REVIEW_MOBILE_WIDTH)
  let gesture: {
      target: DragTarget
      pointerId: number
      x: number
      y: number
      initial: ReviewLayout
      element: HTMLElement
      moved: boolean
    } | null = null,
    suppressDotClick = false

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(layout.value))
    } catch {
      // Moving and reviewing remain available when browser storage is unavailable.
    }
  }
  function update(next: ReviewLayout) {
    layout.value = clampReviewLayout(
      {
        ...next,
        panel: {
          ...next.panel,
          height: Math.max(
            next.panel.height,
            Math.min(initialSize.minHeight ?? 0, viewport.value.height - 24),
          ),
        },
      },
      viewport.value,
    )
  }
  function syncViewport() {
    viewport.value = { width: window.innerWidth, height: window.innerHeight }
    finishGesture()
    update(layout.value)
  }
  function reset() {
    finishGesture()
    layout.value = initial(viewport.value)
    save()
  }
  function move(target: 'dot' | 'panel', x: number, y: number) {
    update({
      ...layout.value,
      [target]: {
        ...layout.value[target],
        x: layout.value[target].x + x,
        y: layout.value[target].y + y,
      },
    })
    save()
  }
  function resize(width: number, height: number) {
    update({
      ...layout.value,
      panel: {
        ...layout.value.panel,
        width: layout.value.panel.width + width,
        height: layout.value.panel.height + height,
      },
    })
    save()
  }
  function keyAdjust(event: KeyboardEvent, target: DragTarget) {
    const step = event.shiftKey ? 60 : 20,
      change: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      },
      delta = change[event.key]
    if (mobile.value || !delta) return
    event.preventDefault()
    if (target === 'resize') resize(...delta)
    else move(target, ...delta)
  }
  function startGesture(event: PointerEvent, target: DragTarget) {
    if (mobile.value || event.button !== 0 || gesture) return
    const element = event.currentTarget
    if (!(element instanceof HTMLElement)) return
    suppressDotClick = false
    gesture = {
      target,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      initial: layout.value,
      element,
      moved: false,
    }
    element.setPointerCapture(event.pointerId)
    element.focus({ preventScroll: true })
    event.preventDefault()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }
  function onMove(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.pointerId) return
    const dx = event.clientX - gesture.x,
      dy = event.clientY - gesture.y
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return
    gesture.moved = true
    dragging.value = gesture.target
    if (gesture.target === 'resize') {
      const panel = gesture.initial.panel
      update({
        ...gesture.initial,
        panel: { ...panel, width: panel.width + dx, height: panel.height + dy },
      })
    } else {
      const initial = gesture.initial[gesture.target]
      update({
        ...gesture.initial,
        [gesture.target]: { ...initial, x: initial.x + dx, y: initial.y + dy },
      })
    }
    event.preventDefault()
  }
  function finishGesture() {
    if (gesture) {
      suppressDotClick = gesture.target === 'dot' && gesture.moved
      if (gesture.element.hasPointerCapture(gesture.pointerId))
        gesture.element.releasePointerCapture(gesture.pointerId)
    }
    gesture = null
    dragging.value = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onEnd)
    window.removeEventListener('pointercancel', onEnd)
  }
  function onEnd(event: PointerEvent) {
    if (gesture?.pointerId !== event.pointerId) return
    finishGesture()
    save()
  }
  function shouldOpenFromClick(event: MouseEvent) {
    const allow = event.detail === 0 || !suppressDotClick
    suppressDotClick = false
    return allow
  }

  onMounted(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      update(saved ? restoreReviewLayout(saved, viewport.value) : initial(viewport.value))
    } catch {
      layout.value = initial(viewport.value)
    }
    window.addEventListener('resize', syncViewport)
  })
  onBeforeUnmount(() => {
    finishGesture()
    window.removeEventListener('resize', syncViewport)
  })

  return {
    layout: readonly(layout),
    mobile,
    dragging: readonly(dragging),
    reset,
    resize,
    keyAdjust,
    startGesture,
    shouldOpenFromClick,
  }
}
