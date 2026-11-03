import { ref, watch, nextTick, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { zoomAnchor } from '../core/map-experience'
import { notifications } from '../app/notifications'
type Size = { width: number; height: number }
type View = { zoom: number; x: number; y: number }
const views = new Map<string, View>()
let storageTimer: ReturnType<typeof setTimeout> | undefined
let storageDirty=false
function flushViews() {
  clearTimeout(storageTimer)
  storageTimer = undefined
  if(!storageDirty)return
  try { localStorage.setItem('trpg-map-views-v01', JSON.stringify([...views]));storageDirty=false } catch { /* unavailable or full */ }
}
export function useMapViewport(
  host: Ref<HTMLElement | null>,
  key: () => string,
  dimensions: () => Size,
  zoom: Ref<number>,
  cancelEdit?: () => void,
  rightClick?: () => void,
) {
  try {
    const saved = JSON.parse(localStorage.getItem('trpg-map-views-v01') ?? '[]')
    if (Array.isArray(saved))
      for (const [k, v] of saved.slice(-80))
        if (
          typeof k === 'string' &&
          [v?.zoom, v?.x, v?.y].every(Number.isFinite) &&
          v.zoom >= 0.08 &&
          v.zoom <= 3
        )
          if (!views.has(k)) views.set(k, v)
  } catch {
    /* SSR, invalid or unavailable local preferences */
  }
  const active = ref(false)
  const touches = new Map<number, { x: number; y: number }>()
  let pan: { id: number; x: number; y: number; left: number; top: number; moved: boolean; entered?: boolean } | null = null
  let pinch: {
    distance: number
    zoom: number
    center: { x: number; y: number }
    scroll: { x: number; y: number }
  } | null = null
  let suppressUntil = 0,
    restoring = false,
    currentKey = '',
    epoch = 0
  // Resizing the scaled SVG (or its scrollbars) must not replace a user's camera with fit().
  let autoFit = true,
    zoomOperation = 0
  let replaying = false
  let touchDraft: { target: Element; events: PointerEvent[] } | null = null
  let cameraFrame = 0
  let pendingPan: { x: number; y: number; epoch: number } | null = null
  let pendingPinch: { zoom:number; x:number; y:number; epoch:number } | null = null
  let pendingWheel: { zoom: number; at: { x: number; y: number }; epoch: number } | null = null
  let pendingZoomView:{key:string;epoch:number;operation:number;view:View}|null=null
  function flushCamera() {
    if(cameraFrame&&typeof cancelAnimationFrame!=='undefined')cancelAnimationFrame(cameraFrame)
    cameraFrame = 0
    const move = pendingPan, wheel = pendingWheel, pinchView=pendingPinch, el = host.value
    pendingPan = pendingWheel = pendingPinch = null
    if (el && move?.epoch === epoch) {
      el.scrollLeft = move.x
      el.scrollTop = move.y
      persist()
    }
    if (wheel?.epoch === epoch) void setZoom(wheel.zoom, wheel.at)
    else if(el&&pinchView?.epoch===epoch){const operation=++zoomOperation;zoom.value=pinchView.zoom;pendingZoomView={key:currentKey,epoch,operation,view:{zoom:pinchView.zoom,x:Math.max(0,pinchView.x),y:Math.max(0,pinchView.y)}};void nextTick(()=>{if(operation!==zoomOperation||pinchView.epoch!==epoch||host.value!==el)return;el.scrollLeft=pinchView.x;el.scrollTop=pinchView.y;pendingZoomView=null;persist()})}
  }
  function scheduleCamera() { if (!cameraFrame) cameraFrame = requestAnimationFrame(flushCamera) }
  function replayTouch(up: PointerEvent) {
    const draft = touchDraft
    touchDraft = null
    if (!draft || !draft.target.isConnected) return
    replaying = true
    try {
      for (const [i, e] of [...draft.events, up].entries()) {
        draft.target.dispatchEvent(
          new PointerEvent(i === 0 ? 'pointerdown' : e === up ? 'pointerup' : 'pointermove', {
            bubbles: true,
            cancelable: true,
            pointerId: e.pointerId,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons: e === up ? 0 : 1,
            clientX: e.clientX,
            clientY: e.clientY,
          }),
        )
      }
      draft.target.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: up.clientX,
          clientY: up.clientY,
        }),
      )
    } finally {
      replaying = false
    }
  }
  function persist() {
    const el = host.value
    if (!el || restoring || !currentKey) return
    const value = pendingZoomView?.key===currentKey&&pendingZoomView.epoch===epoch?pendingZoomView.view:{ zoom: zoom.value, x: el.scrollLeft, y: el.scrollTop }
    const prior=views.get(currentKey)
    if(prior?.zoom===value.zoom&&prior.x===value.x&&prior.y===value.y)return
    views.set(currentKey, value)
    storageDirty=true
    if (views.size > 80) views.delete(views.keys().next().value!)
    clearTimeout(storageTimer)
    storageTimer = setTimeout(flushViews, 200)
  }
  function saveBeforeLeaving() { flushCamera(); persist(); flushViews() }
  async function setZoom(value: number, at?: { x: number; y: number }) {
    pendingWheel = pendingPinch = null
    const el = host.value
    if (!el) return
    autoFit = false
    const operation = ++zoomOperation,
      sceneEpoch = epoch
    const before = zoom.value,
      after = Math.max(0.08, Math.min(3, value))
    const pointer = at ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 }
    const target = zoomAnchor({ x: el.scrollLeft, y: el.scrollTop }, pointer, before, after)
    zoom.value = after
    pendingZoomView={key:currentKey,epoch,operation,view:{zoom:after,x:Math.max(0,target.x),y:Math.max(0,target.y)}}
    await nextTick()
    if (operation !== zoomOperation || sceneEpoch !== epoch || host.value !== el) return
    el.scrollLeft = target.x
    el.scrollTop = target.y
    pendingZoomView=null
    persist()
  }
  async function fit() {
    pendingWheel = pendingPan = pendingPinch = null
    const el = host.value,
      size = dimensions()
    if (!el || !size.width || !size.height) return
    autoFit = true
    const operation = ++zoomOperation,
      sceneEpoch = epoch
    zoom.value = Math.max(
      0.08,
      Math.min(1, (el.clientWidth - 4) / size.width, (el.clientHeight - 4) / size.height),
    )
    pendingZoomView={key:currentKey,epoch,operation,view:{zoom:zoom.value,x:0,y:0}}
    await nextTick()
    if (operation !== zoomOperation || sceneEpoch !== epoch || host.value !== el) return
    el.scrollLeft = el.scrollTop = 0
    pendingZoomView=null
    persist()
  }
  async function reset() {
    await fit()
  }
  function clearGesture() {
    flushCamera()
    for (const id of [...touches.keys(), ...(pan ? [pan.id] : [])])
      if (host.value?.hasPointerCapture(id)) host.value.releasePointerCapture(id)
    touches.clear()
    pan = null
    pinch = null
    touchDraft = null
    cancelEdit?.()
  }
  function exit(announce = false) {
    if (!active.value) return false
    active.value = false
    clearGesture()
    persist()
    if (announce) notifications.push('已退出地图交互；行动草稿保留', 'info')
    return true
  }
  function toggle() {
    if (!exit(true)) {
      active.value = true
      notifications.push('地图交互已开启：右拖查看，滚轮缩放', 'info')
    }
  }
  function block(event: Event) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  function down(event: PointerEvent) {
    if (replaying) return
    const el = host.value!
    if (event.button === 2) {
      suppressUntil = 0
      const entered = !active.value
      active.value = true
      pan = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: el.scrollLeft,
        top: el.scrollTop,
        moved: false,
        entered,
      }
      el.setPointerCapture(event.pointerId)
      block(event)
      return
    }
    if (!active.value) {
      event.stopImmediatePropagation()
      return
    }
    if (event.pointerType === 'touch' && !touches.size && !pinch) suppressUntil = 0
    else if (Date.now() < suppressUntil && !touches.size && !pinch) {
      block(event)
      return
    }
    if (event.pointerType === 'touch') {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touches.size === 1 && !pinch)
        touchDraft = { target: event.target as Element, events: [event] }
      if (touches.size >= 2) {
        touchDraft = null
        cancelEdit?.()
        const [a, b] = [...touches.values()] as [{ x: number; y: number }, { x: number; y: number }]
        const rect = el.getBoundingClientRect()
        pinch = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: zoom.value,
          center: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
          scroll: { x: el.scrollLeft, y: el.scrollTop },
        }
        suppressUntil = Date.now() + 700
        el.setPointerCapture(event.pointerId)
        block(event)
      } else {
        el.setPointerCapture(event.pointerId)
        block(event)
      }
    }
  }
  function move(event: PointerEvent) {
    if (replaying) return
    const el = host.value!
    if (pan?.id === event.pointerId) {
      if (!pan.moved && Math.hypot(event.clientX - pan.x, event.clientY - pan.y) < 4) {
        block(event)
        return
      }
      pan.moved = true
      autoFit = false
      pendingPan = { x: pan.left - (event.clientX - pan.x), y: pan.top - (event.clientY - pan.y), epoch }
      scheduleCamera()
      suppressUntil = Date.now() + 400
      block(event)
      return
    }
    if (touches.has(event.pointerId))
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinch && touches.size >= 2) {
      autoFit = false
      const [a, b] = [...touches.values()] as [{ x: number; y: number }, { x: number; y: number }]
      const rect = el.getBoundingClientRect(),
        center = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }
      const after = Math.max(
        0.08,
        Math.min(3, (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.distance)),
      )
      const gesture = pinch
      const point = zoomAnchor(gesture.scroll, gesture.center, gesture.zoom, after)
      pendingPinch={zoom:after,x:point.x+gesture.center.x-center.x,y:point.y+gesture.center.y-center.y,epoch}
      scheduleCamera()
      suppressUntil = Date.now() + 700
      block(event)
    } else if (pinch) block(event)
    else if (touchDraft && touches.has(event.pointerId)) {
      if (touchDraft.events.length < 200) touchDraft.events.push(event)
      block(event)
    }
  }
  function up(event: PointerEvent) {
    if (replaying) return
    flushCamera()
    const wasGesture = !!pan?.moved || !!pinch
    const rightPointer = pan?.id === event.pointerId
    if (rightPointer && !pan?.moved && !pan?.entered && event.type !== "pointercancel") rightClick?.()
    const singleTouch = event.pointerType === 'touch' && !!touchDraft && !wasGesture
    if (event.type === 'pointercancel') touchDraft = null
    else if (singleTouch) replayTouch(event)
    touches.delete(event.pointerId)
    if (pan?.id === event.pointerId) pan = null
    if ((wasGesture || singleTouch) && !rightPointer) {
      suppressUntil = Date.now() + 700
      block(event)
    }
    // Right-button releases cannot synthesize a primary click. A fresh left press
    // must work immediately, even after a real pan; touch still suppresses ghost taps.
    if (rightPointer) { suppressUntil = 0; block(event) }
    if (!touches.size) pinch = null
    if (host.value?.hasPointerCapture(event.pointerId))
      host.value.releasePointerCapture(event.pointerId)
    persist()
  }
  function click(event: MouseEvent) {
    if (!replaying && (!active.value || Date.now() < suppressUntil)) block(event)
  }
  function wheel(event: WheelEvent) {
    if (!active.value || event.ctrlKey || !(event.target as Element).closest('svg')) return
    event.preventDefault()
    const rect = host.value!.getBoundingClientRect()
    pendingWheel = { zoom: Math.max(.08, Math.min(3, (pendingWheel?.zoom ?? zoom.value) * Math.exp(-event.deltaY * .002))), at: { x: event.clientX - rect.left, y: event.clientY - rect.top }, epoch }
    scheduleCamera()
  }
  function context(event: Event) {
    event.preventDefault()
  }
  function outside(event: PointerEvent) {
    const target = event.target as Element
    if (
      event.button === 0 &&
      !host.value?.contains(target) &&
      !target.closest('[data-ui-notifications], [data-map-controls]')
    )
      exit()
  }
  function escape(event: KeyboardEvent) {
    if (document.body.hasAttribute('data-map-selection-active')) return
    if (event.key === 'Escape' && exit()) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  function attach(el: HTMLElement | null, add: boolean) {
    if (!el) return
    const method = add ? 'addEventListener' : 'removeEventListener'
    el[method]('pointerdown', down as EventListener, true)
    el[method]('pointermove', move as EventListener, true)
    el[method]('pointerup', up as EventListener, true)
    el[method]('pointercancel', up as EventListener, true)
    el[method]('click', click as EventListener, true)
    el[method]('contextmenu', context)
    el[method]('wheel', wheel as EventListener, { passive: false })
    el[method]('scroll', persist)
  }
  watch(host, (el, old) => {
    attach(old, false)
    attach(el, true)
    resizeObserver?.disconnect()
    if (el) {
      lastBox = { w: el.clientWidth, h: el.clientHeight }
      resizeObserver?.observe(el)
    }
    const saved = views.get(currentKey)
    if (el && saved) {
      autoFit = false
      zoom.value = saved.zoom
      void nextTick(() => {
        el.scrollLeft = saved.x
        el.scrollTop = saved.y
      })
    } else if (el) void fit()
  })
  watch(
    key,
    async (value) => {
      flushCamera()
      persist()
      pendingZoomView=null
      const mine = ++epoch
      zoomOperation++
      const initial = !currentKey
      currentKey = value
      active.value = false
      if (!initial) clearGesture()
      restoring = true
      await nextTick()
      if (mine !== epoch) return
      const saved = views.get(value),
        el = host.value
      if (saved && el) {
        autoFit = false
        zoom.value = saved.zoom
        await nextTick()
        el.scrollLeft = saved.x
        el.scrollTop = saved.y
      } else await fit()
      restoring = false
    },
    { immediate: true },
  )
  let resizeObserver: ResizeObserver | null = null
  let resizeTimer = 0
  let lastBox = { w: 0, h: 0 }
  onMounted(() => {
    window.addEventListener('pagehide', saveBeforeLeaving)
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', escape, true)
    const saved = views.get(currentKey)
    if (saved && host.value) {
      autoFit = false
      zoom.value = saved.zoom
      void nextTick(() => {
        if (host.value) {
          host.value.scrollLeft = saved.x
          host.value.scrollTop = saved.y
        }
      })
    }
    const el = host.value
    if (el && typeof ResizeObserver !== 'undefined') {
      lastBox = { w: el.clientWidth, h: el.clientHeight }
      resizeObserver = new ResizeObserver(() => {
        const target = host.value
        if (!target) return
        const w = target.clientWidth
        const h = target.clientHeight
        if (Math.abs(w - lastBox.w) < 2 && Math.abs(h - lastBox.h) < 2) return
        lastBox = { w, h }
        clearTimeout(resizeTimer)
        if (!autoFit) return
        const sceneEpoch = epoch
        resizeTimer = window.setTimeout(() => {
          if (autoFit && sceneEpoch === epoch) void fit()
        }, 120)
      })
      resizeObserver.observe(el)
    }
  })
  onBeforeUnmount(() => {
    flushCamera()
    persist()
    flushViews()
    window.removeEventListener('pagehide', saveBeforeLeaving)
    attach(host.value, false)
    resizeObserver?.disconnect()
    resizeObserver = null
    clearTimeout(resizeTimer)
    window.removeEventListener('pointerdown', outside, true)
    window.removeEventListener('keydown', escape, true)
  })
  return { active, toggle, exit, fit, reset, setZoom }
}
