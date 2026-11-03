import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { cellAtPixel } from '../../core/map-view'
import type { SelectionMap } from './selection'
import { useMapSelection, type MapSelection } from './selection'
/** Capture only selection input. Original map handlers remain untouched when idle. */
export function useSelectionSurface(
  svg: Ref<SVGSVGElement | null>,
  map: SelectionMap,
  provided?: MapSelection,
) {
  const selection = provided ?? useMapSelection()
  let dispose: (() => void) | undefined,
    frame = 0,
    last: PointerEvent | undefined
  const active = () => selection?.current.value?.mapId === map.id
  function cell(e: MouseEvent) {
    const matrix = svg.value?.getScreenCTM(),
      s = map.scene()
    if (!matrix || !s) return
    return cellAtPixel(s.grid, new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()))
  }
  function click(e: MouseEvent) {
    if (!active() || e.button !== 0) return
    e.preventDefault()
    e.stopImmediatePropagation()
    const p = cell(e)
    if (!p) return
    const el = (e.target as Element).closest(
      '[data-token],[data-point],[data-ground],[data-region]',
    ) as HTMLElement | null
    const hit = el?.dataset.token ?? el?.dataset.point ?? el?.dataset.ground ?? el?.dataset.region
    const request = selection!.current.value!,
      matches = hit
        ? (request.candidates?.().filter((c) => c.id === hit || c.hitId === hit) ?? [])
        : []
    if (matches.length > 1) {
      selection!.notice.value = '此处对应多个合法引用，请在选取栏明确选择'
      return
    }
    selection!.choose(p, matches[0]?.id)
  }
  function block(e: PointerEvent) {
    if (active() && e.button === 0) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }
  function move(e: PointerEvent) {
    if (!active() || e.buttons === 2 || e.pointerType === 'touch') return
    last = e
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!active() || !last) return
        const p = cell(last)
        if (p) selection?.hover(p)
      })
    e.stopImmediatePropagation()
  }
  function key(e: KeyboardEvent) {
    if (!active()) return
    if (e.key === 'Escape') {
      selection?.cancel()
      e.preventDefault()
      e.stopImmediatePropagation()
      return
    }
    if (!svg.value?.contains(e.target as Node)) return
    const delta: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      },
      d = delta[e.key],
      s = map.scene()
    if (d && s) {
      const p = selection!.cursor.value ?? selection!.current.value?.point?.() ?? { x: 0, y: 0 }
      selection!.hover({
        x: Math.max(0, Math.min(s.grid.columns - 1, p.x + d[0])),
        y: Math.max(0, Math.min(s.grid.rows - 1, p.y + d[1])),
      })
      e.preventDefault()
      e.stopImmediatePropagation()
    } else if (e.key === 'Enter' || e.key === ' ') {
      const p = selection!.cursor.value
      if (p) selection!.choose(p)
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }
  function attach(el: SVGSVGElement | null, add: boolean) {
    if (!el) return
    const op = add ? 'addEventListener' : 'removeEventListener'
    el[op]('click', click as EventListener, true)
    el[op]('pointerdown', block as EventListener, true)
    el[op]('pointerup', block as EventListener, true)
    el[op]('pointermove', move as EventListener, true)
  }
  onMounted(() => {
    dispose = selection?.register(map)
    window.addEventListener('keydown', key, true)
  })
  watch(
    svg,
    (el, old) => {
      attach(old ?? null, false)
      attach(el, true)
    },
    { immediate: true },
  )
  watch(
    () => map.scene()?.id,
    (next, old) => {
      if (old && next !== old && active()) selection?.cancel()
    },
  )
  onBeforeUnmount(() => {
    dispose?.()
    attach(svg.value, false)
    cancelAnimationFrame(frame)
    window.removeEventListener('keydown', key, true)
  })
}
