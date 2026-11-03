<script setup lang="ts">
import OpeningConfigEditor from '../opening/OpeningConfigEditor.vue'
import {emptyOpeningPresentation} from '../../persistence/opening-reading-schema'
import {openingText} from '../opening/opening-labels'
import {displayFeedback} from '../feedback-presentation'
import {uiDate} from '../locale-format'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, ref, watch } from 'vue'
import LaunchDisabledReport from './LaunchDisabledReport.vue'
import { useWorkshop } from '../../app/store'
import {
  scriptApi,
  scriptImage,
  type ScriptEntry,
  type ScriptSummary,
} from '../../online/script-client'
import type { RoomView } from '../../online/protocol'
import type { ScriptDefinition } from '../../persistence/script-schema'
import { prepareScriptParty } from '../../core/script-party'
import { instantiateScript } from '../../core/script'
const props = defineProps<{ summary: ScriptSummary }>(),
  emit = defineEmits<{
    close: []
    local: [adventureId: string]
    room: [value: { roomId: string; token: string; invite: string; view: RoomView }]
  }>()
const store = useWorkshop(),
  version = ref(props.summary.versions.at(-1)?.id ?? ''),
  definition = ref<ScriptDefinition | null>(null),
  mode = ref<'room' | 'local'>('room'),
  selected = ref<string[]>([]),
  bindings = ref<Record<string, string>>({}),
  name = ref(props.summary.name + ' · 新冒险'),
  nickname = ref('GM'),
  busy = ref(false),
  error = ref(''),
  aiConfirmed = ref(false),
  confirmed = ref(false),
  report = ref<{
    disabled: { kind: string; id: string; reason: string }[]
    startSceneName: string
    sceneCount: number
    npcCount: number
    characterCount: number
  } | null>(null)
const players = computed(() =>
  store.characters.filter((c) => c.status === 'complete' && c.purpose !== 'npc' && !c.npcOwnerId),
)
watch(
  version,
  async () => {
    definition.value = null
    report.value = null
    error.value = ''
    if (!version.value) return
    const current = version.value
    try {
      const entry = await scriptApi<ScriptEntry>(`/scripts/${props.summary.id}/versions/${current}`)
      if (version.value === current) {
        definition.value = entry.definition
        bindings.value = {}
        selected.value = []
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '版本读取失败'
    }
  },
  { immediate: true },
)
watch(
  [mode, selected, bindings, name, nickname, version],
  () => {
    report.value = null
    confirmed.value = false
    aiConfirmed.value = false
  },
  { deep: true },
)
watch(()=>JSON.stringify(definition.value?.openingPresentation),()=>{report.value=null;confirmed.value=false;aiConfirmed.value=false})
function body() {
  return {
    players: players.value.filter((c) => selected.value.includes(c.id)),
    bindings: bindings.value,
    ...(definition.value?.openingPresentation?{openingPresentation:definition.value.openingPresentation}:{}),
    name: name.value,
    nickname: nickname.value,
  }
}
async function localInstance() {
  const d = definition.value!
  const files = []
  for (const m of d.assets) files.push(await scriptImage(props.summary.id, m))
  const party = await prepareScriptParty(d, body().players, bindings.value)
  const instance = instantiateScript(d, files, party.players, party.bindings, {
    scriptId: props.summary.id,
    versionId: version.value,
    authorVersion: d.metadata.authorVersion,
  })
  const a = instance.world.adventures[0]!
  a.name = name.value
  a.sourceScript!.startSceneId = instance.startSceneId
  a.sourceScript!.landing = instance.landing
  return instance
}
async function preview() {
  busy.value = true
  error.value = ''
  try {
    if (!selected.value.length) throw Error('请至少选择一名玩家角色')
    if (mode.value === 'room')
      report.value = await scriptApi(
        `/scripts/${props.summary.id}/instances/${version.value}/preview`,
        'POST',
        body(),
      )
    else {
      const instance = await localInstance(),
        a = instance.world.adventures[0]!
      report.value = {
        disabled: instance.disabled,
        startSceneName: a.scenes.find((s) => s.id === instance.startSceneId)!.name,
        sceneCount: a.scenes.length,
        npcCount: a.ai?.npcs.length ?? 0,
        characterCount: a.party.length,
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '开团预检失败'
  } finally {
    busy.value = false
  }
}
async function create() {
  if (!report.value || !confirmed.value || !aiConfirmed.value) return
  busy.value = true
  error.value = ''
  try {
    if (mode.value === 'room')
      emit(
        'room',
        await scriptApi(`/scripts/${props.summary.id}/instances/${version.value}`, 'POST', {
          ...body(),
          confirmed: true,
          aiConfirmed: true,
        }),
      )
    else emit('local', await store.addScriptInstance(await localInstance()))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="script-card script-launch" :aria-label="controlText('authoringFlow.startGameFromScript')">
    <header class="script-heading">
      <div>
        <p class="eyebrow">NEW ADVENTURE</p>
        <h1>{{ controlText('authoringFlow.startGameFromSavedVersion') }}</h1>
      </div>
      <button class="subtle" :disabled="busy" @click="emit('close')">{{ controlText('workbench.backLibrary') }}</button>
    </header>
    <p class="muted">
      {{ controlText('authoringFlow.copiesPlayerCharactersAndInitialNpcValuesFor') }}
    </p>
    <div class="script-form">
      <label
        >{{ controlText('game.saveVersion') }}<select v-model="version" :disabled="busy">
          <option v-for="v in summary.versions" :key="v.id" :value="v.id">
            {{ v.authorVersion }} · {{ uiDate(v.createdAt,'datetime') }}
          </option>
        </select></label
      >
      <label
        >{{ controlText('remainingField.creationType') }}<select v-model="mode" :disabled="busy" :aria-label="controlText('remainingField.creationType')">
          <option value="room">{{ controlText('domain.multiplayer') }}</option>
          <option value="local">{{ controlText('domain.localAdventure') }}</option>
        </select></label
      ><label>{{ controlText('remainingField.adventureNameForThisGame') }}<input v-model="name" maxlength="120" :disabled="busy" /></label
      ><label v-if="mode === 'room'"
        >{{ controlText('remainingField.gmNickname') }}<input v-model="nickname" maxlength="60" :disabled="busy"
      /></label>
    </div>
    <fieldset :disabled="busy">
      <legend>{{ controlText('authoringFlow.bringPlayerCharacters') }}</legend>
      <p v-if="!players.length">{{ controlText('authoringFlow.completePlayerCharactersInTheWorkshopFirstNpc') }}</p>
      <label v-for="c in players" :key="c.id" class="check"
        ><input v-model="selected" type="checkbox" :value="c.id" />{{ localizedEntryName(c.build) }} ·
        {{ c.build.growth?.at(-1)?.level ?? 1 }} {{ controlText('remainingField.level') }}</label
      >
    </fieldset>
    <fieldset v-if="definition?.roles.length" :disabled="busy">
      <legend>{{ controlText('authoringFlow.bindScriptCharacterSlots') }}</legend>
      <label v-for="r in definition.roles" :key="r.id"
        >{{ localizedEntryName(r) }} · {{ r.required ? controlText('workflow.requiredSlot') : controlText('controls.optional')
        }}<select v-model="bindings[r.id]">
          <option :value="undefined">{{ controlText('authoringFlow.unbound') }}</option>
          <option
            v-for="c in players.filter((c) => selected.includes(c.id))"
            :key="c.id"
            :value="c.id"
          >
            {{ localizedEntryName(c.build) }}
          </option>
        </select></label
      >
    </fieldset>
    <details v-if="definition" class="script-card launch-opening"><summary>{{openingText('configure')}}</summary><OpeningConfigEditor :model-value="definition.openingPresentation??emptyOpeningPresentation()" :disabled="busy" :characters="definition.roles.map(r=>({id:'role:'+r.id,name:r.name}))" @update:model-value="definition.openingPresentation=$event" /></details>
    <p v-if="definition" class="muted">{{ controlText('scriptSummary.suggestedPlayersLevelsAuthorGuidanceOnlyCharacter', {p0:(definition.metadata.players.min),p1:(definition.metadata.players.max),p2:(definition.metadata.levels.min),p3:(definition.metadata.levels.max)}) }}</p>
    <p v-if="error" class="script-warning" role="alert">{{ displayFeedback(error,'error') }}</p>
    <button class="secondary" :disabled="busy || !definition" @click="preview">{{ controlText('authoringFlow.preflightThisGameStart') }}</button>
    <div v-if="report" class="script-banner">
      <h2>{{ controlText('authoringFlow.gameStartPreflightResults') }}</h2>
      <p>
        {{ controlText('scriptSummary.scenesNpcsPlayerCharactersStartingScene', {p0:(report.sceneCount),p1:(report.npcCount),p2:(report.characterCount),p3:(report.startSceneName)}) }}
      </p>
      <LaunchDisabledReport :rows="report.disabled" :names="Object.fromEntries((definition?.npcs??[]).map(n=>[n.id,n.name]))" />
      <label class="check"
        ><input
          v-model="confirmed"
          type="checkbox"
          :disabled="busy"
        />{{ controlText('remainingField.confirmPartyCharacterSlotsAndDisabledItemsAbove') }}</label
      >
      <p>{{ controlText('scriptSummary.aiNarrationConfigureModelServicesInThe', {p0:(definition?.ai.enabled ? controlText('controls.enabled') : controlText('expressionThree.notEnabled')),p1:(definition?.ai.autoPublish ? controlText('expressionFour.automaticPublication') : controlText('expressionFour.gmReview'))}) }}</p>
      <label class="check"
        ><input v-model="aiConfirmed" type="checkbox" :disabled="busy" />{{ controlText('remainingField.aiPolicyAndAuthorizationBoundariesForThisGame') }}</label
      >
      <button class="primary" :disabled="busy || !confirmed || !aiConfirmed" @click="create">
        {{ busy ? controlText('expressionFour.creating') : controlText('expressionFour.confirmCreation') + (mode === 'room' ? controlText('expressionFour.newRoom') : controlText('domain.localAdventure')) }}
      </button>
    </div>
  </section>
</template>
