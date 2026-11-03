<script setup lang="ts">
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'
import { fieldMapCandidates } from './candidates'
import { useMapSelection, type PickKind, type MapCandidate } from './selection'
const props = defineProps<{
    kind: PickKind
    locations?: (MapCandidate & { sceneId?: string })[]
  }>(),
  selection = useMapSelection(),
  host = ref<HTMLElement | null>(null),
  message = ref('')
let ownSession: number | undefined
const available = ref(false),
  unavailable = ref(false)
function refreshControl() {
  const el = control()
  available.value = !!el
  unavailable.value = !el || el.matches(':disabled')
}
onUpdated(refreshControl)
const control = () => host.value?.querySelector('select')
function start() {
  const el = control(),
    map = selection?.maps.value.at(-1),
    scene = map?.scene()
  if (!el || el.matches(':disabled') || !map || !scene) return
  const options = () =>
      Array.from(el.options)
        .filter((o) => o.value && !o.disabled)
        .map((o) => ({ id: o.value, name: o.label })),
    candidates = () =>
      fieldMapCandidates(
        {
          ...map.scene()!,
          registeredMarkers: [
            ...(map.scene()!.registeredMarkers ?? []),
            ...(props.locations?.filter((p) => !p.sceneId || p.sceneId === map.scene()!.id) ?? []),
          ],
        },
        options(),
        props.kind,
        map.gm,
      )
  if (!candidates().length) {
    message.value = '当前地图没有对应可见标记，请使用原列表'
    return
  }
  const ids = ref(
    el.multiple ? Array.from(el.selectedOptions, (o) => o.value) : el.value ? [el.value] : [],
  )
  const started = selection!.start({
    label: el.getAttribute('aria-label') || '选择对象',
    sceneId: scene.id,
    kind: props.kind,
    candidates,
    selected: () => ids.value,
    onEntity: (id) => {
      ids.value = el.multiple
        ? ids.value.includes(id)
          ? ids.value.filter((v) => v !== id)
          : [...ids.value, id]
        : [id]
    },
    onReveal: () => el.focus(),
    canConfirm: () =>
      !el.matches(':disabled') &&
      ids.value.length > 0 &&
      ids.value.every((id) => candidates().some((c) => c.id === id)),
    onConfirm: () => {
      if (
        el.matches(':disabled') ||
        !el.isConnected ||
        ids.value.some((id) => !options().some((o) => o.id === id))
      )
        throw Error('目标已变化')
      if (el.multiple) {
        for (const o of el.options) o.selected = ids.value.includes(o.value)
      } else el.value = ids.value[0]!
      el.dispatchEvent(new Event('change', { bubbles: true }))
      ownSession = undefined
    },
    onCancel: () => (ownSession = undefined),
  })
  if (started) {
    ownSession = selection!.current.value!.id
    message.value = ''
  } else message.value = selection!.notice.value
}
onMounted(() => {
  refreshControl()
  const el = control(),
    label = el?.closest('label')?.cloneNode(true) as HTMLElement | undefined
  if (el && !el.hasAttribute('aria-label') && label) {
    label.querySelectorAll('select,button,small').forEach((e) => e.remove())
    const text = label.textContent?.trim()
    if (text) el.setAttribute('aria-label', text)
  }
})
onBeforeUnmount(() => {
  selection?.cancelSession(ownSession)
})
</script>
<template>
  <span ref="host" class="map-field-picker"
    ><slot /><button
      v-if="available && selection?.maps.value.length"
      type="button"
      data-map-controls
      :disabled="unavailable || !!selection.current.value"
      :aria-label="controlText('configurationField.selectThisObjectOnTheInteractiveMap')"
      @click.prevent.stop="start"
    >
      {{ controlText('domain.mapSelection') }}</button
    ><small v-if="message" role="status">{{ message }}</small></span
  >
</template>
<style scoped>
.map-field-picker {
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}
.map-field-picker :deep(select) {
  min-width: 0;
  max-width: 100%;
  flex: 1;
}
button {
  font-size: 12px;
  padding: 5px 8px;
  min-height: 36px;
  flex-shrink: 0;
}
small {
  flex-basis: 100%;
}
@media (pointer: coarse) {
  button {
    min-height: 44px;
  }
}
</style>
