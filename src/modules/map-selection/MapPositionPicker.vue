<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import { h, onBeforeUnmount, ref } from 'vue'
import { useMapSelection } from './selection'
import GeometryOutline from './GeometryOutline.vue'
import type { PreviewGeometry } from './geometry-preview'
const props = defineProps<{
    x: number
    y: number
    height?: number
    sceneId?: string
    label?: string
    disabled?: boolean
    required?: boolean
    preview?: PreviewGeometry
    previewAt?: (point: { x: number; y: number; height: number }) => PreviewGeometry | undefined
    color?: string
    span?: number
    from?: { x: number; y: number; span?: number }
  }>(),
  emit = defineEmits<{ select: [value: { x: number; y: number; height: number }] }>(),
  selection = useMapSelection()
let ownSession: number | undefined
function start() {
  if (!selection || props.disabled) return
  const point = ref({ x: props.x, y: props.y }),
    height = props.height ?? 0
  if (
    selection.start({
      kind: 'position',
      pointSpan: props.span ?? 1,
      priority: props.required ? 'required' : 'normal',
      label: props.label ?? '选择实际位置',
      sceneId: props.sceneId,
      point: () => point.value,
      path: () =>
        props.from
          ? [
              {
                x: props.from.x + (props.from.span ?? 1) / 2 - 0.5,
                y: props.from.y + (props.from.span ?? 1) / 2 - 0.5,
              },
              {
                x: point.value.x + (props.span ?? 1) / 2 - 0.5,
                y: point.value.y + (props.span ?? 1) / 2 - 0.5,
              },
            ]
          : [],
      onPoint: (p) => (point.value = p),
      overlay: () => {
        const map = selection.activeMap.value?.scene(),
          original = props.preview,
          g = props.previewAt
            ? props.previewAt({ ...point.value, height })
            : original
              ? {
                  ...original,
                  x: original.x + point.value.x - props.x,
                  y: original.y + point.value.y - props.y,
                }
              : undefined
        if (!map || !g) return
        return h(GeometryOutline, {
          geometry: g,
          feet: map.grid.feet,
          size: map.grid.cellPixels ?? 64,
          color: props.color,
        })
      },
      canConfirm: () =>
        !props.disabled &&
        (props.height ?? 0) === height &&
        Number.isFinite(point.value.x) &&
        Number.isFinite(point.value.y),
      panel: () =>
        h(
          'p',
          `候选格(${point.value.x},${point.value.y})；高度${height}尺，支撑与空间条件仍沿用原表单。`,
        ),
      onConfirm: () => {
        if (props.disabled || (props.height ?? 0) !== height) throw Error('操作输入已变化')
        emit('select', { ...point.value, height })
        ownSession = undefined
      },
      onCancel: () => (ownSession = undefined),
    })
  )
    ownSession = selection.current.value!.id
}
onBeforeUnmount(() => {
  selection?.cancelSession(ownSession)
})
</script>
<template>
  <button
    v-if="selection?.maps.value.length"
    type="button"
    data-map-controls
    :disabled="disabled || (!!selection.current.value && !required)"
    @click="start"
  >
    {{ label ?? controlText('expressionTwo.selectPositionOnInteractiveMap') }}
  </button>
</template>
