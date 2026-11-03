import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type VNodeChild,
} from 'vue'
import type { MapScene, MapTemplate, Position } from '../../core/map-types'
import type { PublicScene } from '../../online/protocol'
export type SelectionScene = Pick<MapScene, 'id' | 'grid' | 'tokens' | 'walls'> & {
  registeredMarkers?: MapCandidate[]
  points: (Pick<MapScene['points'][number], 'id' | 'name' | 'x' | 'y'> & { hidden?: boolean; displayPosition?: Position })[]
} & Partial<Pick<PublicScene, 'spatialObjects' | 'groundItems' | 'sceneEffects' | 'regions' | 'corpses'>>
export type PickKind = 'entity' | 'point' | 'region' | 'surface' | 'ground'
const activeOwners = new Set<symbol>()
let surfaceSequence = 0
/** Local UI identity, intentionally independent of secure-context-only randomUUID. */
export const mapSurfaceId = (prefix: string) => prefix + ':' + ++surfaceSequence
const sessionOwners = new Set<symbol>()
export interface MapCandidate {
  id: string
  name: string
  x: number
  y: number
  span?: number
  kind: PickKind
  hitId?: string
  cells?: string[]
}
export interface SelectionRequest {
  priority?: 'normal' | 'required'
  label: string
  sceneId?: string
  kind: PickKind | 'position' | 'area' | 'route'
  candidates?: () => MapCandidate[]
  selected?: () => string[]
  template?: () => MapTemplate | null
  point?: () => Position | undefined
  path?: () => Position[]
  pathVertices?: boolean
  pointSpan?: number
  overlay?: () => VNodeChild
  error?: () => string
  canConfirm?: () => boolean
  panel?: () => VNodeChild
  onEntity?: (id: string) => void
  onPoint?: (point: Position) => void
  onHover?: (point: Position) => void
  onConfirm: () => void
  onCancel?: () => void
  onReveal?: () => void
}
export interface SelectionMap {
  id: string
  gm?: boolean
  scene: () => SelectionScene | undefined
  activate: () => void
  focus?: () => void
  allowPoint?: (p: Position) => boolean
}
export function createMapSelection(scope: () => string) {
  const owner = Symbol('selection-owner')
  const surfaceFocused = shallowRef(true)
  const maps = shallowRef<SelectionMap[]>([]),
    current = shallowRef<(SelectionRequest & { id: number; mapId: string; scope: string }) | null>(
      null,
    ),
    notice = shallowRef('')
  let sequence = 0
  const paused = shallowRef<typeof current.value>(null),
    cursor = shallowRef<Position>()
  const activeMap = computed(() => maps.value.find((m) => m.id === current.value?.mapId))
  function resume() {
    const prior = paused.value
    paused.value = null
    current.value = null
    cursor.value = undefined
    surfaceFocused.value = true
    if (
      prior &&
      prior.scope === scope() &&
      maps.value.some((m) => m.id === prior.mapId && m.scene()?.id === prior.sceneId)
    ) {
      current.value = prior
      notice.value = '已返回先前的选取草稿'
      activeMap.value?.activate()
    } else prior?.onCancel?.()
  }
  function cancel() {
    const old = current.value
    resume()
    notice.value = ''
    old?.onCancel?.()
  }
  function cancelAll() {
    const old = paused.value
    paused.value = null
    old?.onCancel?.()
    cancel()
  }
  function cancelSession(id: number | undefined) {
    if (id === undefined) return
    if (paused.value?.id === id) {
      const old = paused.value
      paused.value = null
      old.onCancel?.()
    } else if (current.value?.id === id) cancel()
  }
  function register(map: SelectionMap) {
    maps.value = [...maps.value.filter((m) => m.id !== map.id), map]
    return () => {
      maps.value = maps.value.filter((m) => m !== map)
      if (paused.value?.mapId === map.id) cancelSession(paused.value.id)
      if (current.value?.mapId === map.id) cancel()
    }
  }
  function start(request: SelectionRequest) {
    const map = [...maps.value]
      .reverse()
      .find((m) => m.scene() && (!request.sceneId || m.scene()!.id === request.sceneId))
    if (!map) return false
    if (current.value) {
      if (request.priority !== 'required' || paused.value) {
        notice.value = '请先确认或取消当前地图选取'
        return false
      }
      paused.value = current.value
    }
    surfaceFocused.value = true
    current.value = {
      ...request,
      sceneId: map.scene()!.id,
      id: ++sequence,
      mapId: map.id,
      scope: scope(),
    }
    cursor.value = request.point?.()
    notice.value = paused.value ? '先前草稿已暂停；请先完成必要落点' : ''
    map.activate()
    const mine = current.value.id
    void nextTick(() => {
      if (current.value?.id === mine) map.focus?.()
    })
    return true
  }
  function choose(point: Position, hit?: string) {
    const c = current.value,
      map = activeMap.value,
      s = map?.scene()
    if (!c || !s || !map) return
    if (c.scope !== scope() || (c.sceneId && c.sceneId !== s.id)) {
      cancel()
      return
    }
    if (point.x < 0 || point.y < 0 || point.x >= s.grid.columns || point.y >= s.grid.rows) return
    if (map.allowPoint?.(point) === false || (c.kind === 'position' && !allowed(point))) {
      notice.value = '此位置暂不可用于本次选取'
      return
    }
    if (c.kind === 'area' && hit && c.candidates?.().some((p) => p.id === hit)) {
      c.onEntity?.(hit)
      return
    }
    if (c.kind === 'position' || c.kind === 'area' || c.kind === 'route') {
      c.onPoint?.(point)
      notice.value = ''
      return
    }
    const found = (c.candidates?.() ?? []).filter((p) =>
      hit
        ? p.id === hit
        : p.cells
          ? p.cells.includes(point.x + ',' + point.y)
          : point.x >= p.x &&
            point.x < p.x + (p.span ?? 1) &&
            point.y >= p.y &&
            point.y < p.y + (p.span ?? 1),
    )
    if (found.length === 1) {
      c.onEntity?.(found[0]!.id)
      notice.value = ''
    } else
      notice.value = found.length ? '此格有多个对象，请从选取栏明确选择' : '此处没有本次可选对象'
  }
  function confirm() {
    const c = current.value,
      p = c?.point?.()
    if (!c || c.scope !== scope() || c.canConfirm?.() === false || c.error?.()) return
    if (p && !allowed(p)) {
      notice.value = '此位置暂不可用于本次选取'
      return
    }
    try {
      c.onConfirm()
      if (current.value === c) resume()
    } catch {
      notice.value = '相关输入已变化，请核对原表单后重试'
    }
  }
  function allowed(p: Position) {
    const s = activeMap.value?.scene(),
      span = current.value?.pointSpan ?? 1
    if (!s || p.x < 0 || p.y < 0 || p.x + span > s.grid.columns || p.y + span > s.grid.rows)
      return false
    for (let x = 0; x < span; x++)
      for (let y = 0; y < span; y++)
        if (activeMap.value?.allowPoint?.({ x: p.x + x, y: p.y + y }) === false) return false
    return true
  }
  function hover(p: Position) {
    if (!allowed(p)) return
    cursor.value = p
    current.value?.onHover?.(p)
  }
  const pointError = computed(() => {
    const p = current.value?.point?.()
    return p && !allowed(p) ? '此位置不符合当前可见地图或占格范围' : ''
  })
  watch(scope, (value, old) => {
    if (old !== undefined && value !== old) cancelAll()
  })
  function showOriginal(restore = true) {
    surfaceFocused.value = false
    if (restore) void nextTick(() => current.value?.onReveal?.())
  }
  function focusMap() {
    surfaceFocused.value = true
    activeMap.value?.activate()
    activeMap.value?.focus?.()
  }
  watch(
    [current, surfaceFocused],
    ([c, focused]) => {
      if (c) sessionOwners.add(owner)
      else sessionOwners.delete(owner)
      if (c && focused) activeOwners.add(owner)
      else activeOwners.delete(owner)
      if (typeof document !== 'undefined') {
        document.body.toggleAttribute('data-map-selection-active', !!sessionOwners.size)
        document.body.toggleAttribute('data-map-selecting', !!activeOwners.size)
      }
    },
    { flush: 'sync' },
  )
  onBeforeUnmount(cancelAll)
  return {
    current,
    pointError,
    paused,
    cursor,
    surfaceFocused,
    showOriginal,
    focusMap,
    notice,
    maps,
    activeMap,
    start,
    register,
    cancel,
    cancelSession,
    cancelAll,
    confirm,
    choose,
    hover,
  }
}
export type MapSelection = ReturnType<typeof createMapSelection>
export const mapSelectionKey: InjectionKey<MapSelection> = Symbol('map-selection-v01')
export const useMapSelection = () => inject(mapSelectionKey, null)
export function provideMapSelection(scope: () => string) {
  const inherited = useMapSelection()
  if (inherited) return inherited
  const selection = createMapSelection(scope)
  provide(mapSelectionKey, selection)
  return selection
}
