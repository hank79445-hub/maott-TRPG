<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { i18n as controlI18n } from '../app/i18n'
const { t: controlText } = controlI18n.global

import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import type { RoomView } from '../online/protocol'
const props = defineProps<{
  view: RoomView
  request: <T>(suffix: string, body?: unknown) => Promise<T | null>
}>()
type Pairing = {
  code: string
  errors: { bot: string; reason: string }[]
  bots: {
    key: string
    name: string
    paired: boolean
    pending: { marker: string; expires: number }[]
  }[]
}
const state = ref<Pairing | null>(null),
  code = ref(''),
  busy = ref(false),
  error = ref(''),
  selected = ref<string[]>([]),
  characterId = ref(''),
  markers = ref<Record<string, string>>({})
const characters = computed(() =>
  props.view.characters.filter((c) => props.view.self.characterIds.includes(c.id)),
)
let live = true,
  timer: ReturnType<typeof setInterval> | undefined
async function load(body?: unknown) {
  if (busy.value) return
  busy.value = true
  try {
    const result = await props.request<Pairing>('qq-pairing', body)
    if (!live || !result) return
    const first = !state.value
    state.value = result
    if (result.code || (body && (body as { type?: string }).type === 'create'))
      code.value = result.code
    if (first) {
      selected.value = result.bots.filter((b) => !b.paired).map((b) => b.key)
      characterId.value = characters.value[0]?.id ?? ''
    }
    error.value = result.errors.map((e) => e.bot + '：' + e.reason).join('；')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '连接向导不可用'
  } finally {
    busy.value = false
  }
}
function confirm() {
  void load({
    type: 'confirm',
    markers: Object.entries(markers.value)
      .filter(([, marker]) => marker)
      .map(([bot, marker]) => ({ bot, marker })),
  })
}
onMounted(() => {
  if (props.view.self.role !== 'player') return
  void load()
  timer = setInterval(() => {
    void load()
  }, 10000)
})
onBeforeUnmount(() => {
  live = false
  clearInterval(timer)
})
</script>
<template>
  <details v-if="view.self.role === 'player'" class="qq-pairing">
    <summary>{{ controlText('workspace.connectMultipleBotsForThisGameAtOnce') }}</summary>
    <p>{{ controlText('workspace.chooseACharacterOnceGenerateATenMinute') }}</p>
    <label
      >{{ controlText('game.speaker') }}<select v-model="characterId">
        <option v-for="c in characters" :key="c.id" :value="c.id">{{ localizedEntryName(c) }}</option>
      </select></label
    >
    <div v-for="b in state?.bots ?? []" :key="b.key">
      <label
        ><input v-model="selected" type="checkbox" :value="b.key" :disabled="b.paired" />{{
          localizedEntryName(b)
        }}
        · {{ b.paired ? controlText('expressionTwo.paired') : controlText('expressionTwo.awaitingConnection') }}</label
      >
      <label v-for="p in b.pending" :key="p.marker"
        ><input
          v-model="markers[b.key]"
          type="radio"
          :value="p.marker"
          :name="'pair-marker-' + b.key"
        />{{ controlText('interactionField.markerISeeInQq') }}{{ p.marker }}</label
      >
    </div>
    <button
      :disabled="busy || !characterId || !selected.length"
      @click="load({ type: 'create', characterId, bots: selected })"
    >{{ controlText('workspace.generateSharedConnectionCode') }}</button>
    <p v-if="code">
      {{ controlText('interactionField.mentionTheSelectedBotsInTheTargetGroup') }}<code>连接 {{ code }}</code
      >{{ controlText('interactionField.thePublicCodeGrantsNoPermissionDirectlyVerify') }}
    </p>
    <button :disabled="busy || !Object.values(markers).some(Boolean)" @click="confirm">{{ controlText('workspace.confirmSelectedMarkers') }}</button>
    <button :disabled="busy" @click="load()">{{ controlText('domain.refreshPairing') }}</button>
    <p v-if="error" role="alert">{{ displayFeedback(error,'error') }}</p>
  </details>
</template>
<style scoped>
.qq-pairing {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.qq-pairing label {
  display: block;
  margin: 8px 0;
}
.qq-pairing button {
  margin: 4px;
  min-height: 44px;
}
</style>
