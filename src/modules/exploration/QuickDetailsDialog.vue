<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useMapSelection } from '../map-selection/selection'
import { quickText } from './quick-action-labels'
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ contextKey: string }>()
const dialog = ref<HTMLDialogElement | null>(null),
  mounted = shallowRef(false)
const selection = useMapSelection()
let opener: HTMLElement | null = null,
  lastField: HTMLElement | null = null
let ownedSelection: number | undefined
function close() {
  open.value = false
}
function sync() {
  const element = dialog.value
  if (!element) return
  const picking = selection?.current.value
  if (open.value && picking) {
    if (element.open) {
      ownedSelection = picking.id
      lastField = document.activeElement instanceof HTMLElement ? document.activeElement : null
      element.close()
    }
    return
  }
  if (open.value && !element.open) {
    element.showModal()
    if (lastField?.isConnected) lastField.focus()
    ownedSelection = undefined
  } else if (!open.value) {
    selection?.cancelSession(ownedSelection)
    ownedSelection = undefined
    if (element.open) element.close()
  }
}
watch(
  open,
  async (value) => {
    if (value) {
      mounted.value = true
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    await nextTick()
    sync()
    if (!value && opener?.isConnected) opener.focus()
  },
  { immediate: true },
)
watch(
  () => selection?.current.value?.id,
  () => {
    void nextTick(sync)
  },
)
watch(
  () => props.contextKey,
  () => {
    close()
    lastField = null
  },
)
onBeforeUnmount(() => {
  selection?.cancelSession(ownedSelection)
  dialog.value?.close()
})
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="quick-details-dialog"
      :aria-label="quickText('details')"
      @cancel.prevent="close"
    >
      <header>
        <h2>{{ quickText('details') }}</h2>
        <button type="button" autofocus @click="close">{{ quickText('close') }}</button>
      </header>
      <div v-if="mounted" class="quick-details-content"><slot /></div>
    </dialog>
  </Teleport>
</template>
<style scoped>
.quick-details-dialog {
  box-sizing: border-box;
  width: min(960px, calc(100vw - 32px));
  max-width: none;
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  color: var(--ink);
  overflow: auto;
}
.quick-details-dialog::backdrop {
  background: rgb(0 0 0 / 55%);
}
header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
h2 {
  margin: 0;
  font-size: 18px;
}
header button {
  min-height: 44px;
  flex-shrink: 0;
}
.quick-details-content {
  padding: 12px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.quick-details-content :deep(.room-card) {
  max-width: 100%;
  min-width: 0;
  margin: 0;
}
.quick-details-content :deep(input),
.quick-details-content :deep(select),
.quick-details-content :deep(textarea) {
  max-width: 100%;
  min-width: 0;
}
@media (max-width: 700px) {
  .quick-details-dialog {
    width: calc(100vw - 12px);
    height: calc(100dvh - 12px);
    max-height: calc(100dvh - 12px);
    border-radius: 8px;
  }
  header {
    padding: 8px;
  }
  h2 {
    font-size: 16px;
  }
  .quick-details-content {
    padding: 8px;
  }
}
</style>
