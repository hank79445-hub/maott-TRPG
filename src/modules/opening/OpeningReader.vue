<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, shallowRef } from 'vue'
import type { RoomView, RoomCommand } from '../../online/protocol'
import { openingText, openingPageTitles } from './opening-labels'
const props = defineProps<{
  view: RoomView
  busy: boolean
  active?: boolean
  submit: (command: RoomCommand) => Promise<boolean>
}>()
const reading = computed(() => props.view.openingReading),
  dialog = shallowRef<HTMLDialogElement | null>(null),
  page = shallowRef(0),
  localClosed = shallowRef(''),
  manual = shallowRef(false),
  saving = shallowRef(false)
let opener: HTMLElement | null = null,
  timer: ReturnType<typeof setInterval> | undefined
const scope = computed(() =>
  [
    props.view.id,
    props.view.self.id,
    props.view.broadcast.branchId,
    props.view.self.characterIds.join(','),
    props.active !== false,
  ].join(':'),
)
function close() {
  dialog.value?.close()
  if (opener?.isConnected) opener.focus()
}
function tryOpen() {
  if (
    props.active === false ||
    !reading.value ||
    props.view.self.role !== 'player' ||
    (localClosed.value === reading.value.id && !manual.value) ||
    (!manual.value && (reading.value.dismissed || reading.value.complete))
  )
    return
  if (!dialog.value?.open && !document.querySelector('dialog[open]')) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.value?.showModal()
  }
}
function open() {
  manual.value = true
  localClosed.value = ''
  page.value = reading.value?.page ?? 0
  tryOpen()
}
function keepFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = [
    ...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]'),
  ].filter((el) => el.getClientRects().length > 0)
  const first = controls[0],
    last = controls.at(-1)
  if (!first || !last) return
  if (
    event.shiftKey &&
    (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))
  ) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
watch(scope, () => {
  close()
  manual.value = false
  localClosed.value = ''
  void nextTick(tryOpen)
})
watch(
  () => reading.value?.id,
  async () => {
    close()
    manual.value = false
    localClosed.value = ''
    page.value = reading.value?.page ?? 0
    await nextTick()
    tryOpen()
  },
  { immediate: true },
)
timer = setInterval(tryOpen, 300)
async function save(next: number, complete = false, dismissed = false) {
  if (!reading.value || saving.value || props.busy) return
  const id = reading.value.id
  const captured = scope.value
  saving.value = true
  try {
    const ok = await props.submit({
      kind: 'opening',
      operation: 'read',
      runId: id,
      page: next,
      complete,
      dismissed,
    })
    if (ok && captured === scope.value && reading.value?.id === id) {
      page.value = next
      if (complete || dismissed) {
        localClosed.value = id
        manual.value = false
        close()
      } else {
        await nextTick()
        dialog.value?.querySelector<HTMLElement>('h2')?.focus()
      }
    }
  } finally {
    saving.value = false
  }
}
async function dismiss() {
  if (reading.value) {
    localClosed.value = reading.value.id
    manual.value = false
    close()
    await save(page.value, false, true)
  }
}
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  close()
})
</script>
<template>
  <button v-if="reading" class="opening-read-trigger" @click="open">
    {{ openingText('read') }}
  </button>
  <Teleport to="body"
    ><dialog
      ref="dialog"
      class="opening-reader"
      :aria-label="openingText('title')"
      @cancel.prevent="dismiss"
      @keydown="keepFocus"
    >
      <header>
        <div>
          <p class="muted">{{ openingText('title') }} · {{ page + 1 }}/4</p>
          <h2 tabindex="-1">{{ openingPageTitles()[page] }}</h2>
        </div>
        <button :disabled="saving" @click="dismiss">{{ openingText('close') }}</button>
      </header>
      <article :key="page" tabindex="0">
        {{
          reading?.pages[page] || (page === 2 ? openingText('unassigned') : openingText('empty'))
        }}
      </article>
      <footer>
        <button :disabled="page === 0 || saving || busy" @click="save(page - 1)">
          {{ openingText('previous') }}</button
        ><button :disabled="saving || busy" @click="save(Math.min(3, page + 1), page === 3)">
          {{ page === 3 ? openingText('finish') : openingText('next') }}
        </button>
      </footer>
    </dialog></Teleport
  >
</template>
<style scoped>
.opening-reader {
  width: min(780px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  color: var(--ink);
}
.opening-reader[open] {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.opening-reader::backdrop {
  background: var(--overlay);
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: none;
}
header p,
header h2 {
  margin: 0 0 5px;
}
article {
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.75;
  min-height: 180px;
  max-height: 62dvh;
}
footer {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
button {
  min-height: 44px;
}
h2:focus-visible,
article:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .opening-reader {
    width: calc(100vw - 12px);
    max-height: calc(100dvh - 12px);
    padding: 14px;
    padding-bottom: max(14px, env(safe-area-inset-bottom));
    font-size: 16px;
  }
  header {
    align-items: flex-start;
  }
  article {
    max-height: 65dvh;
  }
  header button {
    max-width: 120px;
  }
}
</style>
