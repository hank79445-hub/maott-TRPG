<script setup lang="ts">
import {uiDate} from '../locale-format'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { useOperationFeedback } from '../../app/useOperationFeedback'
import { notifyOperation } from '../../app/notifications'
import { computed, defineAsyncComponent, onMounted, ref, shallowRef, watch } from 'vue'
import { useWorkshop } from '../../app/store'
import { extractScript } from '../../core/script'
import { browserScriptPack } from '../../persistence/script-pack-browser'
import {
  scriptAccount,
  scriptApi,
  saveBlob,
  type ScriptSummary,
  type ScriptList,
  type ScriptEntry,
  type ImportPreview,
} from '../../online/script-client'
import type { SitePrincipal } from '../../server/access-config'
import type { RoomView } from '../../online/protocol'
import ScriptEditor from './ScriptEditor.vue'
import ScriptImportPreview from './ScriptImportPreview.vue'
import ScriptLaunchWizard from './ScriptLaunchWizard.vue'
import './scripts.css'
import type { SceneArtRecords } from '../../persistence/scene-art-schema'
const previewArt = shallowRef<SceneArtRecords>({})
const ScriptGenerationWorkbench = defineAsyncComponent(
  () => import('./ScriptGenerationWorkbench.vue'),
)
const generating = ref(false)
const emit = defineEmits<{
  local: [id: string]
  room: [value: { roomId: string; token: string; invite: string; view: RoomView }]
}>()
const store = useWorkshop(),
  account = shallowRef<SitePrincipal | null>(null),
  list = shallowRef<ScriptList | null>(null),
  trash = ref(false),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  name = ref('新的剧本'),
  query = ref(''),
  editing = ref(''),
  launch = shallowRef<ScriptSummary | null>(null),
  preview = shallowRef<ImportPreview | null>(null),
  sourceAdventure = ref(''),
  sourceConfirmed = ref(false),
  sourceChoice = ref<'current' | 'original'>('current'),
  roomSource = shallowRef<{ roomId: string; roomToken: string; view: RoomView } | null>(null),
  selectedVersion = ref<Record<string, string>>({})
const entries = computed(() =>
  [...(list.value?.scripts ?? [])]
    .filter((s) => s.name.includes(query.value))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
)
const bytes = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`
async function load() {
  account.value = await scriptAccount()
  list.value = await scriptApi(`/scripts${trash.value ? '?trash=1' : ''}`)
}
async function run(fn: () => unknown | Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    busy.value = false
  }
}
async function refresh() {
  await run(load)
}
function closeEditor() {
  editing.value = ''
  void refresh()
}
function closeLaunch() {
  launch.value = null
  void refresh()
}
function toggleTrash() {
  trash.value = !trash.value
  void refresh()
}
async function create() {
  await run(async () => {
    const created = await scriptApi<ScriptSummary>('/scripts', 'POST', { name: name.value })
    await load()
    editing.value = created.id
  })
}
async function readFile(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  previewArt.value = {}
  await run(async () => {
    if (preview.value) await scriptApi(`/scripts/import-preview/${preview.value.token}`, 'DELETE')
    preview.value = null
    preview.value = await scriptApi('/scripts/import-preview', 'POST', file, {
      'Content-Type': 'application/zip',
    })
  })
}
async function importCopy() {
  await run(async () => {
    let created: ScriptSummary
    try {
      created = await scriptApi<ScriptSummary>('/scripts/import', 'POST', {
        token: preview.value!.token,
        art: previewArt.value,
      })
    } catch (e) {
      preview.value = null
      previewArt.value = {}
      notice.value =
        '本次导入未确认成功，请刷新个人库核对是否已创建；不会自动重试，请勿直接重复导入。'
      throw e
    }
    preview.value = null
    previewArt.value = {}
    await load()
    editing.value = created.id
  })
}
async function generatedPack(blob: Blob, art: SceneArtRecords = {}) {
  await run(async () => {
    if (preview.value) await scriptApi(`/scripts/import-preview/${preview.value.token}`, 'DELETE')
    preview.value = null
    previewArt.value = {}
    preview.value = await scriptApi('/scripts/import-preview', 'POST', blob, {
      'Content-Type': 'application/zip',
    })
    previewArt.value = art
    generating.value = false
  })
}
async function cancelImport() {
  await run(async () => {
    await scriptApi(`/scripts/import-preview/${preview.value!.token}`, 'DELETE')
    preview.value = null
    previewArt.value = {}
  })
}
async function exportZip(s: ScriptSummary) {
  await run(async () => {
    const v = selectedVersion.value[s.id] ?? s.versions.at(-1)?.id
    if (!v) throw Error('请先保存一个版本')
    const res = await fetch(`/api/scripts/${s.id}/export/${v}`)
    if (!res.ok) throw Error((await res.json()).error ?? '导出失败')
    saveBlob(await res.blob(), s.name.replace(/[<>:"/\\|?*]/g, '_') + '.trpg-script.zip')
    notice.value = '已导出完整剧本包；文件包含 GM 私有内容'
  })
}
async function mutate(
  s: ScriptSummary,
  action: 'copy' | 'trash' | 'restore' | 'purge' | 'version-delete',
) {
  await run(async () => {
    if (
      action === 'purge' &&
      !window.confirm(controlText('confirmation.permanentlyDeleteAndAllItsLibraryVersionsExisting', {p0:(s.name)}))
    )
      return
    if (
      action === 'version-delete' &&
      !window.confirm(controlText('confirmation.deleteTheSelectedSavedVersionDraftsAndExisting'))
    )
      return
    const v = selectedVersion.value[s.id] ?? s.versions.at(-1)?.id
    const route =
      action === 'trash' ? '' : action === 'version-delete' ? `/versions/${v}` : `/${action}`
    await scriptApi(
      `/scripts/${s.id}${route}`,
      action === 'trash' || action === 'version-delete' ? 'DELETE' : 'POST',
      action === 'copy'
        ? { ...(v ? { versionId: v } : {}) }
        : {
            expectedRevision: s.revision,
            ...(['purge', 'version-delete'].includes(action) ? { confirmed: true } : {}),
          },
    )
    await load()
  })
}
async function source() {
  previewArt.value = {}
  await run(async () => {
    const local = store.adventures.find((a) => a.id === sourceAdventure.value)
    const original =
      local?.sourceScript ?? roomSource.value?.view.world?.adventures[0]?.sourceScript
    if (sourceChoice.value === 'original') {
      if (!original) throw Error('来源没有保存版本记录')
      const copied = await scriptApi<ScriptSummary>(`/scripts/${original.scriptId}/copy`, 'POST', {
        versionId: original.versionId,
      })
      editing.value = copied.id
    } else {
      if (!sourceConfirmed.value) throw Error('请确认当前初始值范围')
      if (local) {
        const d = extractScript(
          {
            adventures: store.adventures,
            characters: store.characters,
            encounters: store.encounters,
            packs: store.packs,
          },
          store.assets,
          local.id,
          true,
        )
        preview.value = await scriptApi(
          '/scripts/import-preview',
          'POST',
          await browserScriptPack(d, store.assets),
          { 'Content-Type': 'application/zip' },
        )
      } else if (roomSource.value) {
        const copied = await scriptApi<ScriptSummary>('/scripts/from-room', 'POST', {
          roomId: roomSource.value.roomId,
          roomToken: roomSource.value.roomToken,
          confirmedCurrentInitialState: true,
        })
        editing.value = copied.id
      } else throw Error('请选择一个本地冒险或已连接的 GM 房间')
    }
    await load()
  })
}
async function probeRoom() {
  try {
    const saved = localStorage.getItem('trpg-room-session')
    if (!saved) return
    const credentials = JSON.parse(saved)
    const res = await fetch(`/api/rooms/${credentials.roomId}/snapshot`, {
      headers: { Authorization: 'Bearer ' + credentials.token },
    })
    if (!res.ok) return
    const view = (await res.json()) as RoomView
    if (view.self.role === 'gm')
      roomSource.value = { roomId: credentials.roomId, roomToken: credentials.token, view }
  } catch {
    /* No connected GM source. Library permissions stay independent. */
  }
}
onMounted(() =>
  run(async () => {
    await load()
    await probeRoom()
  }),
)
watch(
  error,
  (value) => {
    if (value) notifyOperation(value, true, undefined, true)
  },
  { flush: 'post' },
)
useOperationFeedback(notice)
</script>
<template>
  <main class="script-page">
    <ScriptGenerationWorkbench
      v-if="generating && account"
      :key="account.accountId"
      :account-id="account.accountId"
      @close="generating = false"
      @pack="generatedPack"
    />
    <ScriptEditor
      v-else-if="editing && account"
      :key="editing"
      :id="editing"
      :account-id="account.accountId"
      @close="closeEditor"
      @updated="refresh"
      @open="editing = $event"
    />
    <ScriptLaunchWizard
      v-else-if="launch"
      :summary="launch"
      @close="closeLaunch"
      @local="
        (id) => {
          launch = null
          emit('local', id)
        }
      "
      @room="
        (value) => {
          launch = null
          emit('room', value)
        }
      "
    />
    <template v-else
      ><header class="script-heading">
        <div>
          <p class="eyebrow">YOUR STORIES</p>
          <h1>{{ controlText('authoringFlow.personalScriptLibrary') }}</h1>
          <p class="muted">{{ controlText('authoringFlow.saveTheWorldSInitialConfigurationSoEach') }}</p>
        </div>
        <div class="script-actions">
          <button class="secondary" :disabled="busy" @click="refresh">{{ controlText('authoringFlow.refreshScriptLibrary') }}</button
          ><label v-if="account" class="secondary script-file"
            >{{ controlText('remainingField.importCompleteScriptPackage') }}<input
              type="file"
              accept=".zip,application/zip"
              :aria-label="controlText('remainingField.importCompleteScriptPackage')"
              :disabled="busy"
              @change="readFile"
          /></label>
        </div>
      </header>

      <div v-if="!account && !busy" class="script-card">
        <h2>{{ controlText('authoringFlow.cloudPersonalLibraryRequiresSignIn') }}</h2>
        <p>
          {{ controlText('authoringFlow.thisServiceRequiresAPermanentAccountAndPersistent') }}
        </p>
        <a href="/__test/login">{{ controlText('authoringFlow.openTestSignIn') }}</a>
      </div>
      <template v-if="account && list"
        ><p class="script-account">
          {{ controlText('scriptSummary.sLibraryScriptsIncludingTrash', {p0:(account.username),p1:(bytes(list.usage.usedBytes)),p2:(bytes(list.usage.limitBytes)),p3:(list.usage.count),p4:(list.usage.countLimit)}) }}</p>
        <ScriptImportPreview
          v-if="preview"
          :preview="preview"
          :busy="busy"
          @confirm="importCopy"
          @cancel="cancelImport"
        />
        <div class="script-toolbar">
          <label>{{ controlText('remainingField.findScript') }}<input v-model="query" type="search" :placeholder="controlText('remainingField.searchByName')" /></label
          ><button class="secondary" :disabled="busy" @click="toggleTrash">
            {{ trash ? controlText('expressionFour.backToScriptList') : controlText('expressionFour.trashDays') }}
          </button>
        </div>
        <div v-if="!trash" class="script-new">
          <button class="secondary" :disabled="busy" @click="generating = true">
            {{ controlText('authoringFlow.scriptGenerationWorkbench') }}
          </button>
          <label>{{ controlText('remainingField.newScriptName') }}<input v-model="name" maxlength="120" /></label
          ><button class="primary" :disabled="busy || !name.trim()" @click="create">
            {{ controlText('domain.newScript') }}
          </button>
        </div>
        <details v-if="!trash" class="script-card">
          <summary>{{ controlText('authoringFlow.extractScriptFromCurrentAdventureGmRoom') }}</summary>
          <p class="muted">
            {{ controlText('authoringFlow.currentDoorLocksLootQuantitiesAndNpcStates') }}
          </p>
          <label
            >{{ controlText('remainingField.extractionSource') }}<select v-model="sourceAdventure">
              <option value="">
                {{ roomSource ? controlText('expressionFour.connectedGmRoom') + localizedEntryName(roomSource.view) : controlText('expressionFour.chooseLocalAdventure') }}
              </option>
              <option v-for="a in store.adventures" :key="a.id" :value="a.id">{{ localizedEntryName(a) }}</option>
            </select></label
          >
          <label
            >{{ controlText('remainingField.initialConfigurationSource') }}<select v-model="sourceChoice">
              <option value="current">{{ controlText('authoringFlow.extractCurrentConfigurationAndInitialValues') }}</option>
              <option value="original">{{ controlText('authoringFlow.copyOriginalSavedScriptVersionCurrentAccountMust') }}</option>
            </select></label
          >
          <label v-if="sourceChoice === 'current'" class="check"
            ><input v-model="sourceConfirmed" type="checkbox" />{{ controlText('remainingField.iVerifiedCurrentDoorLocksLootAndInitial') }}</label
          ><button class="secondary" :disabled="busy" @click="source">{{ controlText('authoringFlow.extractAsNewScript') }}</button>
        </details>
        <p v-if="!entries.length" class="script-empty">
          {{ trash ? controlText('expressionFour.trashIsEmpty') : controlText('expressionFour.noMatchingScriptsCreateOneOrImportA') }}
        </p>
        <section class="script-grid">
          <article v-for="s in entries" :key="s.id" class="script-card">
            <h2>{{ localizedEntryName(s) }}</h2>
            <p>
              {{ controlText('scriptSummary.scenesNpcsImagesEntry17', {p0:(s.authorVersion),p1:(s.sceneCount),p2:(s.npcCount),p3:(s.assetCount)}) }}</p>
            <p class="muted">{{ controlText('scriptSummary.draftUpdated', {p0:(uiDate(s.updatedAt,'datetime'))}) }}</p>
            <template v-if="!trash"
              ><p v-if="!s.ready" class="script-warning">
                {{ s.missingDependencies.length ? controlText('expressionFour.draftNeedsRuleDependencies') : controlText('expressionFour.draftBackgroundNeedsGmCalibration') }} ·
                {{ s.missingDependencies.map((d) => d.id + ' ' + d.version).join('、') }}
              </p>
              <label
                >{{ controlText('game.saveVersion') }}<select v-model="selectedVersion[s.id]">
                  <option :value="undefined">
                    {{ s.versions.length ? controlText('expressionFour.latestSavedVersion') : controlText('expressionFour.noSavedVersionYet') }}
                  </option>
                  <option v-for="v in [...s.versions].reverse()" :key="v.id" :value="v.id">
                    {{ v.authorVersion }} · {{ uiDate(v.createdAt,'datetime') }}
                  </option>
                </select></label
              >
              <div class="script-actions">
                <button class="primary" :disabled="busy" @click="editing = s.id">{{ controlText('authoringFlow.editScript') }}</button
                ><button
                  class="secondary"
                  :disabled="busy || !s.versions.length"
                  @click="launch = s"
                >
                  {{ controlText('authoringFlow.startGameFromScript') }}</button
                ><button
                  class="secondary"
                  :disabled="busy || !s.versions.length"
                  @click="exportZip(s)"
                >
                  {{ controlText('authoringFlow.exportCompletePackage') }}</button
                ><button class="subtle" :disabled="busy" @click="mutate(s, 'copy')">{{ controlText('authoringFlow.copyScript') }}</button
                ><button
                  class="subtle"
                  :disabled="busy || !s.versions.length"
                  @click="mutate(s, 'version-delete')"
                >
                  {{ controlText('resourceFlow.pruneSelectedVersions') }}</button
                ><button class="subtle" :disabled="busy" @click="mutate(s, 'trash')">
                  {{ controlText('resourceFlow.moveToTrash') }}
                </button>
              </div> </template
            ><template v-else
              ><p>{{ controlText('scriptSummary.deletedAutomaticallyPurgedAfterDays', {p0:(uiDate(s.trashedAt!,'datetime'))}) }}</p>
              <div class="script-actions">
                <button :disabled="busy" @click="mutate(s, 'restore')">{{ controlText('resourceFlow.restoreScript') }}</button
                ><button class="subtle" :disabled="busy" @click="mutate(s, 'purge')">
                  {{ controlText('resourceFlow.deletePermanently') }}
                </button>
              </div></template
            >
          </article>
        </section>
      </template>
    </template>
  </main>
</template>
