<script setup lang="ts">
import {i18n as controlI18n} from '../../app/i18n'
const {t:controlText}=controlI18n.global

import { ref, onBeforeUnmount } from 'vue'
import { useMapSelection } from './selection'
import { fieldMapCandidates } from './candidates'
const props = defineProps<{
    items: { id: string; name: string }[]
    modelValue: string[]
    max?: number
    disabled?: boolean
    label?: string
  }>(),
  emit = defineEmits<{ 'update:modelValue': [value: string[]] }>(),
  selection = useMapSelection(),
  message = ref('')
let own: number | undefined
function start() {
  const map = selection?.maps.value.at(-1),
    s = map?.scene()
  if (!map || !s || props.disabled) return
  const ids = ref([...props.modelValue]),
    candidates = () => fieldMapCandidates(map.scene()!, props.items, 'entity', map.gm)
  if (!candidates().length) {
    message.value = '当前地图无对应可见人物，请使用原名单'
    return
  }
  if (
    selection!.start({
      kind: 'entity',
      sceneId: s.id,
      label: props.label ?? '选择多个目标',
      candidates,
      selected: () => ids.value,
      onEntity: (id) => {
        if (ids.value.includes(id)) ids.value = ids.value.filter((v) => v !== id)
        else if (props.max === 1) ids.value = [id]
        else if (!props.max || ids.value.length < props.max) ids.value = [...ids.value, id]
      },
      canConfirm: () =>
        !props.disabled &&
        (!props.max || ids.value.length <= props.max) &&
        ids.value.every((id) => candidates().some((c) => c.id === id)),
      onConfirm: () => {
        if (props.disabled || ids.value.some((id) => !props.items.some((p) => p.id === id)))
          throw Error('名单已变化')
        emit('update:modelValue', [...ids.value])
        own = undefined
      },
      onCancel: () => (own = undefined),
    })
  )
    own = selection!.current.value!.id
}
onBeforeUnmount(() => {
  selection?.cancelSession(own)
})
</script>
<template>
  <span
    ><button
      v-if="selection?.maps.value.length"
      type="button"
      data-map-controls
      :disabled="disabled || !!selection.current.value"
      @click="start"
    >
      {{ label ?? controlText('expressionTwo.selectMultipleTargetsOnMap') }}</button
    ><small v-if="message" role="status">{{ message }}</small></span
  >
</template>
