<script setup lang="ts">
import {displayFeedback} from './feedback-presentation'
import {i18n as controlI18n} from '../app/i18n'
const {t:controlText}=controlI18n.global
import {entryDisplayName as localizedEntryName} from './runtime-presentation'

import { ref, onMounted } from 'vue'
import NpcRouteMultiSelect from './NpcRouteMultiSelect.vue'
interface Routes {
  revision: number
  system: string
  narration: string
  compatibility: string
  npcBots: Record<string, string>
  sharedBots?: Record<string, string[]>
  fallbackToCompatibility: boolean
}
interface State {
  routes: Routes
  bots: { key: string; name: string; enabled: boolean; bound: boolean; status: string }[]
  npcs: { id: string; name: string; npcType?: 'ordinary' | 'important' }[]
}
const props = defineProps<{ request: <T>(suffix: string, body?: unknown) => Promise<T | null> }>(),
  emit = defineEmits<{ bots: [State['bots']] }>()
const state = ref<State | null>(null),
  draft = ref<Routes | null>(null),
  error = ref(''),
  busy = ref(false),
  notice = ref('')
function reserved(key: string) {
  return (
    !!draft.value &&
    [draft.value.system, draft.value.narration, draft.value.compatibility].includes(key)
  )
}
function dedicated(key: string) {
  return Object.entries(draft.value?.npcBots ?? {}).find(([, bot]) => bot === key)?.[0] ?? ''
}
function owner(id: string) {
  return (
    draft.value?.npcBots[id] ??
    Object.entries(draft.value?.sharedBots ?? {}).find(([, ids]) => ids.includes(id))?.[0]
  )
}
function options(key: string, kind?: 'ordinary' | 'important') {
  return (state.value?.npcs ?? [])
    .filter((n) => !kind || (n.npcType ?? 'important') === kind)
    .map((n) => ({ ...n, disabled: !!owner(n.id) && owner(n.id) !== key }))
}
function setDedicated(key: string, event: Event) {
  if (!draft.value) return
  const id = (event.target as HTMLSelectElement).value
  for (const [npc, bot] of Object.entries(draft.value.npcBots))
    if (bot === key) delete draft.value.npcBots[npc]
  if (id) draft.value.npcBots[id] = key
  notice.value = ''
}
function shared(key: string, kind: 'ordinary' | 'important') {
  return (draft.value?.sharedBots?.[key] ?? []).filter((id) =>
    state.value?.npcs.some((n) => n.id === id && (n.npcType ?? 'important') === kind),
  )
}
function setShared(key: string, kind: 'ordinary' | 'important', ids: string[]) {
  if (!draft.value) return
  const others = (draft.value.sharedBots?.[key] ?? []).filter(
    (id) => !state.value?.npcs.some((n) => n.id === id && (n.npcType ?? 'important') === kind),
  )
  ;(draft.value.sharedBots ??= {})[key] = [...others, ...ids]
  notice.value = ''
}
async function reload() {
  try {
    const s = await props.request<State>('qq-bots')
    if (s) {
      state.value = s
      draft.value = JSON.parse(JSON.stringify(s.routes))
      emit('bots', s.bots)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '多Bot配置不可用'
  }
}
async function save() {
  if (!draft.value) return
  busy.value = true
  try {
    const body = {
      ...draft.value,
      npcBots: Object.fromEntries(Object.entries(draft.value.npcBots).filter(([, v]) => !!v)),
      sharedBots: Object.fromEntries(
        Object.entries(draft.value.sharedBots ?? {}).filter(([, ids]) => ids.length),
      ),
    }
    const s = await props.request<State>('qq-bots', body)
    if (s) {
      state.value = s
      draft.value = JSON.parse(JSON.stringify(s.routes))
      emit('bots', s.bots)
    }
    error.value = ''
    notice.value = 'QQ Bot分工已保存'
  } catch (e) {
    error.value = String(e)
  } finally {
    busy.value = false
  }
}
onMounted(reload)
</script>
<template>
  <details class="qq-bot-routes">
    <summary>{{ controlText('workspace.qqBotRolesAndNpcAssignments') }}</summary>
    <p>
      {{ controlText('configurationField.theDeployerUsesTheLocal') }}
      <a href="http://127.0.0.1:8796/" target="_blank" rel="noopener">{{ controlText('workspace.botConnectionLibrary') }}</a>
      {{ controlText('configurationField.toAddCredentialsTheGmAssignsRolesHere') }}
    </p>
    <template v-if="state && draft"
      ><fieldset :disabled="busy" class="primary-routes">
        <label
          v-for="[field, label] in [
            ['system', '系统广播Bot'],
            ['narration', '旁白Bot'],
            ['compatibility', '未分配NPC的兼容Bot'],
          ] as const"
          :key="field"
          >{{ label
          }}<select v-model="draft[field]">
            <option v-for="b in state.bots" :key="b.key" :value="b.key">
              {{ localizedEntryName(b) }} · {{ b.bound ? controlText('expressionTwo.bound') : controlText('expressionTwo.awaitingBinding') }} · {{ b.status }}
            </option>
          </select></label
        >
      </fieldset>
      <p>
        {{ controlText('adjudication.oneRowPerBotDedicatedAndSharedModes') }}
      </p>
      <fieldset :disabled="busy" class="npc-bot-rows">
        <section
          v-for="b in state.bots"
          :key="b.key"
          class="npc-bot-row"
          :aria-label="localizedEntryName(b) + controlText('expressionTwo.roleAssignments')"
        >
          <div class="bot-identity">
            <strong>{{ localizedEntryName(b) }}</strong
            ><small>{{ b.bound ? controlText('expressionTwo.bound') : controlText('expressionTwo.awaitingGroupBinding') }} · {{ b.status }}</small
            ><small v-if="reserved(b.key)">{{ controlText('workspace.handlesSystemNarrationCompatibilityRolesNpcAssignmentDisabled') }}</small>
          </div>
          <label
            >{{ controlText('configurationField.dedicatedNpcSingleSelection') }}<select
              :aria-label="localizedEntryName(b) + controlText('expressionTwo.dedicatedNpc')"
              :value="dedicated(b.key)"
              :disabled="reserved(b.key) || !!draft.sharedBots?.[b.key]?.length"
              @change="setDedicated(b.key, $event)"
            >
              <option value="">{{ controlText('workspace.doNotUseDedicatedMode') }}</option>
              <option v-for="n in options(b.key)" :key="n.id" :value="n.id" :disabled="n.disabled">
                {{ localizedEntryName(n) }}{{ n.disabled ? controlText('expressionTwo.assigned') : '' }}
              </option>
            </select></label
          >
          <NpcRouteMultiSelect
            :label="controlText('expressionTwo.sharedImportantNpcs')"
            :options="options(b.key, 'important')"
            :model-value="shared(b.key, 'important')"
            :disabled="reserved(b.key) || !!dedicated(b.key)"
            @update:model-value="setShared(b.key, 'important', $event)"
          />
          <NpcRouteMultiSelect
            :label="controlText('expressionTwo.sharedOrdinaryNpcs')"
            :options="options(b.key, 'ordinary')"
            :model-value="shared(b.key, 'ordinary')"
            :disabled="reserved(b.key) || !!dedicated(b.key)"
            @update:model-value="setShared(b.key, 'ordinary', $event)"
          />
        </section>
      </fieldset>
      <fieldset :disabled="busy" class="route-actions">
        <label class="check"
          ><input
            v-model="draft.fallbackToCompatibility"
            type="checkbox"
          />{{ controlText('configurationField.allowNewMessagesToFallBackToCompatibility') }}</label
        >
        <button type="button" @click="save">{{ controlText('workspace.saveQqBotRoles') }}</button
        ><button type="button" @click="reload">{{ controlText('workspace.refreshConnectionLibrary') }}</button>
      </fieldset>
      <p v-if="notice" role="status">{{ notice }}</p>
      <p>{{ controlText('liveSummary.routingVersionDedicatedBotsAreOneTo', {p0:(state.routes.revision)}) }}</p></template
    >
    <p v-if="error" role="alert">{{ displayFeedback(error,'error') }}</p>
  </details>
</template>
<style scoped>
.qq-bot-routes {
  padding: 12px;
  border: 1px solid var(--line, #ccd5d4);
  border-radius: 12px;
}
.qq-bot-routes summary {
  min-height: 44px;
}
.qq-bot-routes fieldset {
  border: 0;
  padding: 0;
}
.primary-routes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.primary-routes label,
.npc-bot-row > label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.qq-bot-routes select {
  width: 100%;
  min-height: 44px;
  min-width: 0;
}
.npc-bot-rows {
  display: grid;
  gap: 10px;
}
.npc-bot-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.8fr) repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
  padding: 14px;
  border: 1px solid var(--line, #ccd5d4);
  border-radius: 10px;
}
.bot-identity {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-wrap: anywhere;
}
.bot-identity small {
  opacity: 0.8;
}
.route-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 16px;
}
.route-actions button {
  min-height: 44px;
}
@media (max-width: 900px) {
  .npc-bot-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .bot-identity {
    grid-column: 1/-1;
  }
}
@media (max-width: 600px) {
  .primary-routes,
  .npc-bot-row {
    grid-template-columns: 1fr;
  }
  .bot-identity {
    grid-column: auto;
  }
}
.qq-bot-routes p {
  overflow-wrap: anywhere;
}
</style>
