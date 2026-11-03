<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import { h, onBeforeUnmount, ref } from 'vue'
import { useMapSelection } from './selection'
const props = defineProps<{
    points: { x: number; y: number; height: number }[]
    sceneId?: string
    min?: number
    max?: number
    disabled?: boolean
    label?: string
    cells?: boolean
    vertices?: boolean
  }>(),
  emit = defineEmits<{ select: [points: { x: number; y: number; height: number }[]] }>(),
  selection = useMapSelection()
let own: number | undefined
function start() {
  if (!selection || props.disabled) return
  const points = ref(props.points.map((p) => ({ ...p }))),
    height = points.value.at(-1)?.height ?? 0
  if (
    selection.start({
      kind: 'route',
      label: props.label ?? '依次选择路线／墙段控制点',
      sceneId: props.sceneId,
      path: () => points.value,
      pathVertices: props.vertices,
      point: () => points.value.at(-1),
      onPoint: (p) => {
        if (props.cells && points.value.some((q) => p.x === q.x && p.y === q.y)) {
          points.value = points.value.filter((q) => p.x !== q.x || p.y !== q.y)
          return
        }
        if (points.value.length < (props.max ?? 100)) points.value.push({ ...p, height })
      },
      canConfirm: () =>
        !props.disabled &&
        points.value.length >= (props.min ?? 2) &&
        points.value.length <= (props.max ?? 100),
      panel: () =>
        h('div', [
          h(
            'p',
            `已设${points.value.length}点；高度仍取原表单的${height}尺。路线预览不代表可通行。`,
          ),
          h(
            'button',
            { onClick: () => points.value.pop(), disabled: !points.value.length },
            '撤回上一点',
          ),
          h('button', { onClick: () => (points.value = []) }, '清空控制点'),
        ]),
      onConfirm: () => {
        if (props.disabled) throw Error('已禁用')
        emit(
          'select',
          points.value.map((p) => ({ ...p })),
        )
        own = undefined
      },
      onCancel: () => (own = undefined),
    })
  )
    own = selection.current.value!.id
}
onBeforeUnmount(() => selection?.cancelSession(own))
</script>
<template>
  <button
    v-if="selection?.maps.value.length"
    type="button"
    data-map-controls
    :disabled="disabled || !!selection.current.value"
    @click="start"
  >
    {{ label ?? controlText('expressionTwo.pickPointsInOrderOnInteractiveMap') }}
  </button>
</template>
