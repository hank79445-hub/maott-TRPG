<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { RoomView } from '../../online/protocol'
import type {
  ContainerAction,
  ContainerRow,
  PointContainerView,
} from '../../persistence/point-container-schema'
import TransferItemCard from '../trade/TransferItemCard.vue'
import { v22Text } from './v22-labels'
const pointId = defineModel<string>({ required: true })
const props = defineProps<{
  view: RoomView
  characterId: string
  active?: boolean
  request: <T>(path: string) => Promise<T | null>
  submit: (action: ContainerAction) => Promise<boolean>
}>()
const dialog = ref<HTMLDialogElement | null>(null),
  data = ref<PointContainerView | null>(null)
const mode = ref<'take' | 'put'>('take'),
  quantities = ref<Record<string, number>>({}),
  busy = ref(false),
  loading = ref(false),
  notice = ref('')
let epoch = 0,
  opener: HTMLElement | null = null
const scope = computed(() =>
  [
    props.view.id,
    props.view.self.id,
    props.view.broadcast.branchId,
    props.view.scene?.id,
    props.characterId,
    props.active !== false,
  ].join(':'),
)
const rows = computed(
  () => (mode.value === 'take' ? data.value?.items : data.value?.inventory) ?? [],
)
const pending = computed(() =>
  props.view.intents.some(
    (intent) =>
      intent.status === 'pending' &&
      intent.sessionId === props.view.self.id &&
      intent.action.kind === 'container' &&
      intent.action.pointId === pointId.value &&
      intent.action.characterId === props.characterId,
  ),
)
function amount(row: ContainerRow) {
  return (
    quantities.value[mode.value + ':' + row.id] ??
    (mode.value === 'take' ? row.quantity : Math.min(1, row.quantity))
  )
}
function valid(row: ContainerRow) {
  const n = amount(row)
  return (
    Number.isFinite(n) &&
    n > 0 &&
    n <= row.quantity &&
    (row.coins ? Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 : Number.isInteger(n))
  )
}
async function refresh() {
  if (!pointId.value || !props.view.scene || props.active === false) return
  const captured = ++epoch,
    id = pointId.value
  loading.value = true
  const params = new URLSearchParams({
    sceneId: props.view.scene.id,
    pointId: id,
    characterId: props.characterId,
  })
  try {
    const result = await props.request<PointContainerView>('container?' + params)
    if (captured !== epoch || id !== pointId.value) return
    data.value = result
    if (!result) notice.value = v22Text('unavailable')
  } catch {
    if (captured === epoch) {
      data.value = null
      notice.value = v22Text('unavailable')
    }
  } finally {
    if (captured === epoch) loading.value = false
  }
}
watch(scope, () => {
  pointId.value = ''
})
watch(
  pointId,
  async (id, previous) => {
    ++epoch
    data.value = null
    notice.value = ''
    busy.value = false
    loading.value = false
    quantities.value = {}
    mode.value = 'take'
    if (id) {
      if (!previous)
        opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      if (pointId.value !== id) return
      if (!dialog.value?.open) dialog.value?.showModal()
      void refresh()
    } else {
      dialog.value?.close()
      void nextTick(() => {
        if (opener?.isConnected) opener.focus()
      })
    }
  },
  { flush: 'post', immediate: true },
)
watch(
  () => props.view.revision,
  () => {
    if (pointId.value && !busy.value && !loading.value) void refresh()
  },
)
async function transfer(row?: ContainerRow) {
  if (
    !data.value ||
    busy.value ||
    loading.value ||
    pending.value ||
    (row && (!valid(row) || row.reason))
  )
    return
  const captured = scope.value,
    id = pointId.value
  const action: ContainerAction = {
    kind: 'container',
    sceneId: data.value.sceneId,
    pointId: id,
    characterId: props.characterId,
    stamp: data.value.stamp,
    operation: row ? mode.value : 'take-all',
    ...(row ? { rowId: row.id, quantity: amount(row) } : {}),
  }
  busy.value = true
  notice.value = ''
  try {
    const ok = await props.submit(action)
    if (captured !== scope.value || id !== pointId.value) return
    notice.value = ok
      ? data.value.reviewRequired && props.view.self.role !== 'gm'
        ? v22Text('pending')
        : v22Text('done')
      : v22Text('failed')
    await refresh()
  } catch {
    if (captured === scope.value && id === pointId.value) {
      notice.value = v22Text('failed')
      await refresh()
    }
  } finally {
    if (captured === scope.value && id === pointId.value) busy.value = false
  }
}
onBeforeUnmount(() => {
  ++epoch
  dialog.value?.close()
})
</script>
<template>
  <Teleport to="body"
    ><dialog
      ref="dialog"
      class="container-dialog"
      :aria-label="v22Text('container')"
      @cancel.prevent="pointId = ''"
      @close="pointId = ''"
    >
      <header>
        <div>
          <h2>{{ data?.name ?? v22Text('container') }}</h2>
          <p class="muted">{{ data?.characterName }}</p>
        </div>
        <button :aria-label="v22Text('close')" @click="pointId = ''">×</button>
      </header>
      <div class="container-actions">
        <button
          :disabled="busy || loading || pending || !data?.items.some((r) => !r.reason)"
          @click="transfer()"
        >
          {{ v22Text('takeAll') }}
        </button>
        <button :aria-pressed="mode === 'take'" @click="mode = 'take'">
          {{ v22Text('take') }}
        </button>
        <button :aria-pressed="mode === 'put'" @click="mode = 'put'">{{ v22Text('put') }}</button>
      </div>
      <p class="muted">{{ v22Text(mode === 'take' ? 'takeHelp' : 'putHelp') }}</p>
      <p v-if="pending || notice" role="status">{{ pending ? v22Text('pending') : notice }}</p>
      <p v-if="loading && !data" role="status">{{ v22Text('loading') }}</p>
      <div class="container-list">
        <TransferItemCard
          v-for="row in rows"
          :key="mode + ':' + row.id"
          :name="row.coins ? v22Text('coins') : row.name"
          :tag="row.tag"
          :disabled="busy || loading || pending || !!row.reason || !valid(row)"
          clickable
          @activate="transfer(row)"
        >
          <template #details
            ><small>{{ v22Text('available') }} {{ row.quantity }}{{ row.coins ? ' GP' : '' }}</small
            ><small v-if="row.reason">{{ row.reason }}</small></template
          >
          <template #quantity
            ><input
              type="number"
              :aria-label="(row.coins ? v22Text('coins') : row.name) + ' · ' + v22Text('amount')"
              :min="row.coins ? 0.01 : 1"
              :max="row.quantity"
              :step="row.coins ? 0.01 : 1"
              :value="amount(row)"
              :disabled="busy || !!row.reason"
              @input="
                quantities[mode + ':' + row.id] = ($event.target as HTMLInputElement).valueAsNumber
              "
          /></template>
        </TransferItemCard>
        <p v-if="data && !rows.length" class="muted">
          {{ v22Text(mode === 'take' ? 'empty' : 'noInventory') }}
        </p>
      </div>
      <button :disabled="busy || loading" @click="refresh">{{ v22Text('retry') }}</button>
    </dialog></Teleport
  >
</template>
<style scoped>
.container-dialog {
  width: min(680px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  color: var(--ink);
  overflow: auto;
}
.container-dialog::backdrop {
  background: #0008;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 20px;
}
header p {
  margin: 4px 0 10px;
}
.container-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  position: sticky;
  top: -14px;
  background: var(--panel);
  padding: 10px 0;
  z-index: 1;
}
.container-actions button {
  padding: 8px 4px;
  white-space: normal;
}
.container-actions [aria-pressed='true'] {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.container-list {
  min-width: 0;
}
.container-list input {
  width: 82px;
  flex: 0 0 82px;
  min-width: 0;
}
.container-dialog > p {
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .container-dialog {
    width: calc(100vw - 12px);
    max-height: calc(100dvh - 12px);
    padding: 12px;
  }
  .container-actions {
    top: -12px;
  }
  .container-dialog button {
    min-height: 44px;
  }
  .container-list input {
    width: 72px;
    flex-basis: 72px;
  }
}
</style>
