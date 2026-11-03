<script setup lang="ts">
import OpeningConfigEditor from '../opening/OpeningConfigEditor.vue'
import {emptyOpeningPresentation} from '../../persistence/opening-reading-schema'

import {uiDate} from '../locale-format'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { notifyOperation } from '../../app/notifications'
import { computed, onMounted, nextTick, ref, watch } from 'vue'
import { createPinia } from 'pinia'
import { useWorkshop } from '../../app/store'
import { clone } from '../../core/engine'
import { inspectScript, roleReference, scriptAssetMeta } from '../../core/script'
import QuestPanel from '../QuestPanel.vue'
import ScriptDesignReference from './ScriptDesignReference.vue'
import type { Quest } from '../../persistence/quest-schema'
import { applyScriptCommand, scriptCharacter, scriptEditorWorld } from '../../core/script-editor'
import { applyRuntime } from '../../core/runtime'
import { prepareScriptParty } from '../../core/script-party'
import { archiveSchema, packSchema } from '../../persistence/schema'
import { useScriptDraft } from './useScriptDraft'
import { browserScriptPack } from '../../persistence/script-pack-browser'
import {
  scriptApi,
  saveBlob,
  type ScriptSummary,
  type ImportPreview,
} from '../../online/script-client'
import type { MapCommand, MapAsset } from '../../core/map-types'
import type { RoomCommand } from '../../online/protocol'
import { ApiError } from '../../online/client'
import type { ScriptDefinition } from '../../persistence/script-schema'
import MapPanel from '../MapPanel.vue'
import NpcEditor from '../NpcEditor.vue'
import BroadcastPanel from '../BroadcastPanel.vue'
import RuntimePanel from '../RuntimePanel.vue'
import ScriptBattleEditor from './ScriptBattleEditor.vue'
import SceneArtPanel from './SceneArtPanel.vue'
import {
  artBriefSchema,
  artPolicySchema,
  type SceneArtRecord,
  type ArtTransform,
} from '../../persistence/scene-art-schema'
import type { SceneArtDraft } from '../../core/scene-art-state'
import { sceneArtBundle } from '../../core/scene-art-pack'
import { projectSceneArt } from '../../core/scene-art-projection'

const props = defineProps<{ accountId: string; id: string }>()
const emit = defineEmits<{ close: []; updated: []; open: [id: string] }>()
const draft = useScriptDraft(props.accountId, props.id)
const {
  definition,
  entry,
  assets,
  art,
  artDrafts,
  status,
  error,
  cacheWarning,
  conflict,
  dirty,
  recovery,
} = draft
const artScene = computed(
  () => definition.value?.scenes.find((s) => s.id === sceneId.value) ?? definition.value?.scenes[0],
)
const artValue = computed(() => {
  const id = artScene.value?.id
  if (!id) return undefined
  return {
    ...artDrafts.value[id],
    record: clone(
      art.value[id] ??
        artDrafts.value[id]?.record ?? {
          brief: artBriefSchema.parse(artScene.value?.art ?? {}),
          ...(artScene.value?.art ? { sourceBrief: artScene.value.art } : {}),
          policy: artPolicySchema.parse({}),
        },
    ),
  }
})
function updateArt(value: SceneArtDraft) {
  const id = artScene.value?.id
  if (!id) return
  artDrafts.value = { ...artDrafts.value, [id]: value }
  art.value = { ...art.value, [id]: clone(value.record) }
}
function adoptSceneArt(asset: MapAsset, transform: ArtTransform, record: SceneArtRecord) {
  const id = artScene.value?.id
  if (!id || !definition.value) return
  draft.setImage(asset)
  const next = clone(definition.value),
    s = next.scenes.find((s) => s.id === id)!
  s.background = { assetId: asset.id, ...transform, locked: true, clip: true }
  if (
    record.adopted?.calibration === 'pending' &&
    record.adopted.mode &&
    record.adopted.mode !== 'precise'
  )
    s.artCalibration = { status: 'pending', mode: record.adopted.mode }
  else delete s.artCalibration
  definition.value = inspectScript(next).definition
  art.value = { ...art.value, [id]: clone(record) }
  artDrafts.value = { ...artDrafts.value, [id]: { record: clone(record) } }
  notice.value = '候选已采用，正在按原修订流程同步个人库'
}
function resetSceneArt() {
  if (!definition.value || !artScene.value) return
  const id = artScene.value.id,
    next = clone(definition.value)
  next.scenes.find((s) => s.id === id)!.background = null
  delete next.scenes.find((s) => s.id === id)!.artCalibration
  definition.value = next
  const record = art.value[id]
  if (record) {
    const { adopted: _a, ...remaining } = record
    art.value = { ...art.value, [id]: remaining }
    artDrafts.value = { ...artDrafts.value, [id]: { record: clone(remaining) } }
  }
}
const tab = ref('overview'),
  busy = ref(false),
  notice = ref(''),
  sceneId = ref(''),
  selectedCharacter = ref('')
const artVersion = ref('')
async function exportVersionArt() {
  if (!artVersion.value) return
  await run(async () => {
    const snapshot = await scriptApi<import('../../online/script-client').ScriptEntry>(
      `/scripts/${props.id}/versions/${artVersion.value}`,
    )
    const result = await sceneArtBundle(
      snapshot.definition.scenes.map((s) =>
        projectSceneArt(s, snapshot.art[s.id]?.brief, snapshot.art[s.id]?.policy),
      ),
    )
    saveBlob(result.blob, 'scene-art-saved-version.zip')
    notice.value = '已从所选保存版本导出；未改变当前草稿。返图仍需按当前结构核对。'
  })
}
const map = ref<InstanceType<typeof MapPanel> | null>(null)
const facade = useWorkshop(createPinia())
const world = computed(() => (definition.value ? scriptEditorWorld(definition.value) : null))
watch(
  [world, assets],
  () => {
    if (!world.value) return
    facade.adventures = world.value.adventures
    facade.characters = world.value.characters
    facade.packs = world.value.packs
    facade.encounters = []
    facade.assets = assets.value
    facade.loaded = true
    if (!sceneId.value) sceneId.value = definition.value!.metadata.startSceneId
  },
  { immediate: true },
)
function command(c: MapCommand) {
  if (!definition.value) throw Error('草稿未加载')
  definition.value = applyScriptCommand(definition.value, c)
  notice.value = '配置已加入草稿'
  error.value = ''
}
function saveQuest(value: Quest) {
  if (!definition.value) return
  const next = JSON.parse(JSON.stringify(definition.value)),
    { status: _status, stepSuggestions: _suggestions, ...q } = value
  q.steps = q.steps?.map(({ status: _status, ...step }) => step)
  next.quests ??= []
  if (q.main)
    next.quests.forEach((x: Quest) => {
      x.main = false
    })
  if (q.current)
    next.quests.forEach((x: Quest) => {
      x.current = false
    })
  const index = next.quests.findIndex((x: Quest) => x.id === q.id)
  if (index < 0) next.quests.push(q)
  else next.quests[index] = q
  definition.value = inspectScript(next).definition
  notice.value = '任务配置已加入剧本草稿'
}
facade.mapOperate = async (_id, c) => {
  command(c)
  return facade.adventures[0]!
}
facade.mapBackground = async (_id, _scene, a: MapAsset, s) => {
  if (!s) throw Error('缺少场景配置')
  const candidate = clone(definition.value!)
  candidate.assets = candidate.assets.filter((m) => m.id !== a.id)
  candidate.assets.push(scriptAssetMeta(a))
  const next = applyScriptCommand(candidate, { type: 'scene-edit', scene: s })
  draft.setImage(a)
  definition.value = next
  return facade.adventures[0]!
}
facade.operate = async (id, c) => {
  const previous = facade.characters.find((x) => x.id === id)
  if (!previous) throw Error('NPC 角色不存在')
  const next = applyRuntime(previous, facade.content, c)
  const value = clone(definition.value!)
  value.characters = value.characters.map((x) => (x.id === id ? scriptCharacter(next) : x))
  definition.value = inspectScript(value).definition
  return next
}
const npcView = computed(() => ({
  world: world.value ?? undefined,
  scene: null,
  sceneNames: definition.value?.scenes.map((s) => ({ id: s.id, name: s.name })) ?? [],
  packs: definition.value?.packs ?? [],
  encounter: null,
  characters:
    definition.value?.roles.map((r) => ({
      id: roleReference(r.id),
      name: r.name + '（角色位）',
    })) ?? [],
}))
async function run(fn: () => unknown | Promise<unknown>) {
  if (busy.value) return false
  busy.value = true
  try {
    await fn()
    return true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
    return false
  } finally {
    busy.value = false
  }
}
async function submitConfig(c: RoomCommand, id?: string) {
  if (c.kind !== 'map') throw new ApiError('导入只接受配置命令', 400)
  busy.value = true
  try {
    await draft.commitConfig(id ?? crypto.randomUUID(), (d) => applyScriptCommand(d, c.command))
    notice.value = '整批配置已保存至云端剧本草稿'
    return true
  } finally {
    busy.value = false
  }
}
async function npcCommand(c: RoomCommand) {
  await run(async () => {
    if (c.kind === 'map') {
      command(c.command)
      return
    }
    if (c.kind !== 'npc-character-copy') throw Error('此操作请在开团后执行')
    const archive = archiveSchema.parse(c.archive),
      value = clone(definition.value!)
    for (const p of archive.packs) {
      const existing = value.packs.find((x) => x.id === p.id)
      if (existing && JSON.stringify(existing) !== JSON.stringify(p))
        throw Error('NPC 规则包冲突：' + p.id)
      if (!existing) {
        value.packs.push(p)
        value.dependencies.push({ id: p.id, version: p.version })
      }
    }
    const npc = value.npcs.find((n) => n.id === c.npcId)
    if (!npc) throw Error('请先保存 NPC 配置')
    const party = await prepareScriptParty(value, [archive.character], {})
    const copied = scriptCharacter(party.players[0]!)
    value.characters = value.characters.filter((x) => x.id !== npc.characterId)
    value.characters.push(copied)
    npc.characterId = copied.id
    npc.body = null
    for (const s of value.scenes)
      for (const t of s.tokens) if (t.npcId === npc.id) t.characterId = copied.id
    definition.value = inspectScript(value).definition
    notice.value = '已建立 NPC 专用角色副本'
  })
}
async function openCalibration() {
  const id = artScene.value?.id
  if (!id) return
  await run(async () => {
    if (map.value && !(await map.value.flush())) throw Error('请先保存当前场景修改')
    tab.value = 'map'
    await nextTick()
    await map.value?.selectScene(id)
    notice.value = '校准对象、墙门、出入口和尺度后，点击“返回校准确认”。'
  })
}
async function returnToCalibration() {
  await run(async () => {
    if (map.value && !(await map.value.flush())) throw Error('请先完成场景配置')
    tab.value = 'art'
  })
}
async function saveVersion() {
  await run(async () => {
    if (map.value && !(await map.value.flush())) throw Error('请先完成场景配置')
    await draft.version()
    notice.value = '已保存独立版本'
    emit('updated')
  })
}
async function copyUnsynced() {
  await run(async () => {
    const bundle = await draft.copyRecovery(),
      file = await browserScriptPack(
        {
          ...bundle.definition,
          metadata: {
            ...bundle.definition.metadata,
            name: bundle.definition.metadata.name.slice(0, 114) + ' · 副本',
          },
        },
        bundle.assets,
        { draft: true },
      )
    const preview = await scriptApi<ImportPreview>('/scripts/import-preview', 'POST', file, {
      'Content-Type': 'application/zip',
    })
    const copied = await scriptApi<ScriptSummary>('/scripts/import', 'POST', {
      token: preview.token,
    })
    await draft.load(true)
    emit('updated')
    emit('open', copied.id)
  })
}
function close() {
  if (
    (dirty.value || map.value?.dirty) &&
    !window.confirm(controlText('confirmation.thereAreUnsyncedOrUnsubmittedChangesCloseThe'))
  )
    return
  emit('close')
}
function addRole() {
  definition.value!.roles.push({ id: crypto.randomUUID(), name: '新的角色位', required: true })
}
function removeRole(id: string) {
  const next = clone(definition.value!)
  next.roles = next.roles.filter((r) => r.id !== id)
  try {
    definition.value = inspectScript(next).definition
  } catch {
    error.value = '角色位仍被 NPC、战斗或广播引用，请先清理引用。'
  }
}
async function packFile(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  await run(async () => {
    if (file.size > 4 * 1024 * 1024) throw Error('规则包超过 4 MB')
    const p = packSchema.parse(JSON.parse(await file.text())),
      next = clone(definition.value!)
    next.packs = next.packs.filter((x) => x.id !== p.id)
    next.packs.push(p)
    next.dependencies = next.dependencies.filter((x) => x.id !== p.id)
    next.dependencies.push({ id: p.id, version: p.version })
    definition.value = inspectScript(next).definition
    notice.value = '规则包已补入，请同步后重新预检'
  })
}
onMounted(() => run(() => draft.load()))
watch(
  error,
  (value) => {
    if (value) notifyOperation(value, true, undefined, true)
  },
  { flush: 'post' },
)
</script>
<template>
  <section class="script-editor">
    <header class="script-heading">
      <div>
        <p class="eyebrow">SCRIPT STUDIO</p>
        <h1>{{ localizedEntryName(definition?.metadata) ?? controlText('authoringFlow.editScript') }}</h1>
        <p role="status" :class="{ 'script-warning': dirty || conflict }">{{ status }}</p>
      </div>
      <div class="script-actions">
        <button
          class="secondary"
          :disabled="busy || !definition || conflict || !!recovery"
          @click="run(() => draft.save())"
        >
          {{ controlText('workflow.syncDraft') }}
        </button>
        <button
          class="primary"
          :disabled="busy || !definition || conflict || !!recovery"
          @click="saveVersion"
        >
          {{ controlText('game.saveVersion') }}
        </button>
        <button class="subtle" @click="close">{{ controlText('workbench.backLibrary') }}</button>
      </div>
    </header>

    <p v-if="cacheWarning" role="alert" class="script-warning">{{ cacheWarning }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div v-if="recovery" class="script-banner">
      <p>
        {{ controlText('scriptSummary.unsynchronizedBrowserDraftChooseRestoreOrDiscard', {p0:(controlText('domain.discover')),p1:(uiDate(recovery.at,'datetime'))}) }}</p>
      <button @click="draft.restore">{{ controlText('workflow.restoreDraft') }}</button
      ><button @click="run(() => draft.load(true))">{{ controlText('workflow.discardCache') }}</button>
    </div>
    <div v-if="conflict" class="script-banner">
      <p>{{ controlText('workflow.conflict') }}</p>
      <button @click="run(() => draft.load(true))">{{ controlText('workflow.reloadServer') }}</button
      ><button @click="copyUnsynced">{{ controlText('workflow.copyDraft') }}</button>
    </div>
    <template v-if="definition">
      <ScriptDesignReference :definition="definition" /><details class="script-card"><summary>开场 / Opening</summary><OpeningConfigEditor :model-value="definition.openingPresentation??emptyOpeningPresentation()" :characters="definition.roles.map(r=>({id:roleReference(r.id),name:r.name}))" @update:model-value="definition.openingPresentation=$event" /></details>
      <QuestPanel
        design-only
        :quests="definition.quests ?? []"
        :npcs="definition.npcs"
        gm
        :scenes="definition.scenes"
        :characters="definition.roles.map((r) => ({ id: roleReference(r.id), name: r.name }))"
        @save="saveQuest"
      />
      <nav class="script-tabs" :aria-label="controlText('workflow.editorSections')">
        <button
          v-for="(label, key) in {
            overview: '基本资料与绑定',
            map: '场景与地图',
            art: '场景生图与回填',
            npc: 'NPC 配置',
            characters: 'NPC 初始角色',
            battle: '战斗预设',
            broadcast: '广播',
            ai: 'AI 与规则依赖',
          }"
          :key="key"
          :class="{ active: tab === key }"
          @click="tab = key"
        >
          {{ label }}
        </button>
      </nav>
      <p class="muted">
        {{ controlText('workflow.editorSaveHint') }}
      </p>
      <div v-show="tab === 'overview'" class="script-card">
        <div class="script-form">
          <label>{{ controlText('workflow.scriptTitle') }}<input v-model="definition.metadata.name" maxlength="120" /></label
          ><label>{{ controlText('workflow.author') }}<input v-model="definition.metadata.author" maxlength="120" /></label>
          <label>{{ controlText('workflow.authorVersion') }}<input v-model="definition.metadata.authorVersion" maxlength="80" /></label
          ><label>{{ controlText('workflow.rulesSystem') }}<input value="DND 5e 2024" disabled /></label>
          <label
            >{{ controlText('workflow.minLevel') }}<input
              v-model.number="definition.metadata.levels.min"
              type="number"
              min="1"
              max="5" /></label
          ><label
            >{{ controlText('workflow.maxLevel') }}<input
              v-model.number="definition.metadata.levels.max"
              type="number"
              min="1"
              max="5"
          /></label>
          <label
            >{{ controlText('workflow.minPlayers') }}<input
              v-model.number="definition.metadata.players.min"
              type="number"
              min="1"
              max="100" /></label
          ><label
            >{{ controlText('workflow.maxPlayers') }}<input
              v-model.number="definition.metadata.players.max"
              type="number"
              min="1"
              max="100"
          /></label>
          <label
            >{{ controlText('workflow.initialScene') }}<select v-model="definition.metadata.startSceneId">
              <option v-for="s in definition.scenes" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
            </select></label
          >
          <label
            >{{ controlText('workflow.entryX') }}<input
              v-model.number="definition.metadata.landing.x"
              type="number"
              min="0"
              max="79" /></label
          ><label
            >{{ controlText('workflow.entryY') }}<input
              v-model.number="definition.metadata.landing.y"
              type="number"
              min="0"
              max="79"
          /></label>
        </div>
        <label
          >{{ controlText('workflow.summary') }}<textarea
            v-model="definition.metadata.description"
            maxlength="6000"
            rows="4"
          ></textarea>
        </label>
        <h2>{{ controlText('workflow.playerSlots') }}</h2>
        <p class="muted">{{ controlText('workflow.slotsHint') }}</p>
        <div v-for="role in definition.roles" :key="role.id" class="script-role">
          <label>{{ controlText('workflow.slotName') }}<input v-model="role.name" maxlength="120" /></label
          ><label class="check"><input v-model="role.required" type="checkbox" />{{ controlText('workflow.requiredSlot') }}</label
          ><button class="subtle" @click="removeRole(role.id)">{{ controlText('workflow.deleteSlot') }}</button>
        </div>
        <button class="secondary" @click="addRole">{{ controlText('workflow.addSlot') }}</button>
        <details>
          <summary>{{ controlText('workflow.imageCleanup') }}</summary>
          <p class="muted">
            {{ controlText('workflow.imageCleanupHint') }}
          </p>
          <div v-for="image in entry?.assets ?? []" :key="image.id" class="script-role">
            <span>{{ localizedEntryName(image) }} · {{ (image.bytes / 1024 / 1024).toFixed(1) }} MB</span>
            <button
              v-if="
                definition.assets.some((a) => a.id === image.id) &&
                !definition.scenes.some((s) => s.background?.assetId === image.id)
              "
              class="subtle"
              @click="definition.assets = definition.assets.filter((a) => a.id !== image.id)"
            >
              {{ controlText('workflow.removeImageRefs') }}
            </button>
            <button
              v-if="!definition.assets.some((a) => a.id === image.id)"
              class="subtle"
              :disabled="busy"
              @click="run(() => draft.deleteImage(image.id))"
            >
              {{ controlText('workflow.cleanImageFiles') }}
            </button>
          </div>
        </details>
      </div>
      <div v-if="tab === 'map'" class="script-actions">
        <button @click="returnToCalibration">{{ controlText('workflow.returnCalibration') }}</button
        ><span>{{ controlText('workflow.calibrationHint') }}</span>
      </div>
      <MapPanel
        ref="map"
        v-show="tab === 'map'"
        :workshop="facade"
        initial-adventure-id="script-editor"
        :initial-scene-id="definition.metadata.startSceneId"
        design-only
        @selection="(_a, s) => (sceneId = s)"
      />
      <div v-if="tab === 'art' && artScene" class="script-card">
        <details>
          <summary>{{ controlText('workflow.exportArtVersion') }}</summary>
          <label
            >{{ controlText('workflow.artVersion') }}<select v-model="artVersion">
              <option value="">{{ controlText('workflow.chooseVersion') }}</option>
              <option v-for="v in entry?.versions ?? []" :key="v.id" :value="v.id">
                {{ v.authorVersion }} · {{ uiDate(v.createdAt,'datetime') }}
              </option>
            </select></label
          ><button :disabled="busy || !artVersion" @click="exportVersionArt">
            {{ controlText('workflow.exportAllScenes') }}
          </button>
        </details>
        <label
          >{{ controlText('workflow.artScene') }}<select v-model="sceneId">
            <option v-for="s in definition.scenes" :key="s.id" :value="s.id">{{ localizedEntryName(s) }}</option>
          </select></label
        >
        <p class="muted">
          {{ controlText('workflow.artProvenance') }}
        </p>
        <SceneArtPanel
          :key="artScene.id"
          :scene="artScene"
          :asset="assets.find((a) => a.id === artScene!.background?.assetId)"
          :model-value="artValue"
          @update:model-value="updateArt"
          @adopt="adoptSceneArt"
          @reset="resetSceneArt"
          @calibrate="openCalibration"
        />
      </div>
      <div v-show="tab === 'npc'">
        <NpcEditor
          :view="npcView"
          :busy="busy"
          design-only
          :submit-command="submitConfig"
          @command="npcCommand"
        />
      </div>
      <div v-show="tab === 'characters'" class="script-card">
        <h2>{{ controlText('workflow.npcInitialData') }}</h2>
        <p class="muted">
          {{ controlText('workflow.npcInitialHint') }}
        </p>
        <label
          >{{ controlText('workflow.npcCharacter') }}<select v-model="selectedCharacter">
            <option value="">{{ controlText('game.choose') }}</option>
            <option v-for="c in facade.characters" :key="c.id" :value="c.id">
              {{ localizedEntryName(c.build) }}
            </option>
          </select></label
        >
        <RuntimePanel
          v-if="facade.characters.find((c) => c.id === selectedCharacter)"
          :character="facade.characters.find((c) => c.id === selectedCharacter)!"
          :content="facade.content"
          :workshop="facade"
          @notice="(text) => (notice = text)"
        />
      </div>
      <ScriptBattleEditor
        v-show="tab === 'battle'"
        :definition="definition"
        @command="(c) => run(() => command(c))"
      />
      <BroadcastPanel
        v-show="tab === 'broadcast'"
        :adventure="facade.adventures[0]"
        :world="world ?? undefined"
        :submit-command="(c, id) => submitConfig({ kind: 'map', command: c }, id)"
        :characters="npcView.characters"
        :events="[]"
        branch-id="design"
        gm
        design-only
        :busy="busy"
        @command="(c) => run(() => command(c))"
      />
      <div v-show="tab === 'ai'" class="script-card">
        <h2>{{ controlText('workflow.aiDependencies') }}</h2>
        <label class="check"
          ><input v-model="definition.ai.enabled" type="checkbox" />{{ controlText('workflow.enableAi') }}</label
        ><label class="check"
          ><input v-model="definition.ai.autoPublish" type="checkbox" />{{ controlText('workflow.autoNarration') }}</label
        >
        <label
          >{{ controlText('workflow.narrationBatch') }}<select v-model="definition.ai.mode">
            <option value="turn">{{ controlText('workflow.perRound') }}</option>
            <option value="action">{{ controlText('workflow.perAction') }}</option>
            <option value="manual">{{ controlText('domain.gmManual') }}</option>
          </select></label
        >
        <label>{{ controlText('workflow.narrationStyle') }}<textarea v-model="definition.ai.style" rows="3"></textarea></label
        ><label>{{ controlText('workflow.background') }}<textarea v-model="definition.ai.background" rows="5"></textarea></label>
        <p class="muted">{{ controlText('workflow.modelPrivacy') }}</p>
        <ul>
          <li v-for="d in definition.dependencies" :key="d.id">
            {{ d.id }} · {{ d.version
            }}<button
              v-if="entry?.missingDependencies.some((x) => x.id === d.id)"
              class="subtle"
              @click="
                definition.dependencies = definition.dependencies.filter((x) => x.id !== d.id)
              "
            >
              {{ controlText('workflow.removeDependency') }}
            </button>
          </li>
        </ul>
        <label class="secondary script-file"
          >{{ controlText('workflow.addExpansion') }}<input
            type="file"
            accept=".json,application/json"
            :aria-label="controlText('workflow.addScriptPack')"
            @change="packFile"
        /></label>
      </div>
    </template>
  </section>
</template>
