<script setup lang="ts">
import {displayFeedback} from '../feedback-presentation'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { NPC_LIMIT } from '../../core/configuration-limits'
import { useOperationFeedback } from '../../app/useOperationFeedback'
import { computed, nextTick, ref } from 'vue'
import { clone } from '../../core/engine'
import {
  exportNpcConfig,
  parseNpcConfig,
  duplicateConfig,
  defaultConfigMapping,
  applyConfigImport,
  configStamp,
} from '../../core/npc-config'
import {
  CONFIG_FILE_BYTES,
  type ConfigImportCommand,
  type NpcConfigDocument,
  type ConfigMapping,
} from '../../persistence/npc-config-schema'
import type { MapWorld, Adventure } from '../../core/map-types'
import { saveBlob } from '../../online/script-client'
import { ApiError } from '../../online/client'
import ConfigImportPreview from './ConfigImportPreview.vue'
import './config-imports.css'
import { fileFingerprint, importedBefore, rememberImport } from './import-history'
const props = defineProps<{
  world: MapWorld
  adventure: Adventure
  subjects?: { id: string; name: string }[]
  busy?: boolean
  submitCommand: (command: ConfigImportCommand, requestId?: string) => Promise<boolean>
}>()
const selectionSearch = ref('')
const selected = ref<string[]>([]),
  copies = ref(1),
  doc = ref<NpcConfigDocument | null>(null),
  mapping = ref<ConfigMapping | null>(null),
  stamp = ref(''),
  error = ref(''),
  notice = ref(''),
  working = ref(false),
  unknown = ref(false),
  requestId = ref(''),
  pending = ref<ConfigImportCommand | null>(null),
  accepted = ref(false),
  sourceLabel = ref('')
const errorBox = ref<HTMLElement | null>(null),
  fingerprint = ref(''),
  duplicate = ref(false),
  partial = ref(false)
const npcs = computed(() => props.adventure.ai?.npcs ?? []),
  scenes = computed(() => props.adventure.scenes.map((s) => ({ id: s.id, name: s.name }))),
  subjects = computed(() =>
    (
      props.subjects ?? props.world.characters.map((c) => ({ id: c.id, name: c.build.name }))
    ).filter(
      (s) =>
        s.id.startsWith('role:') ||
        props.world.characters.some((c) => c.id === s.id && c.purpose !== 'npc' && !c.npcOwnerId),
    ),
  )
const roleIds = computed(() =>
  subjects.value.filter((c) => c.id.startsWith('role:')).map((c) => c.id),
)
const locked = computed(() => working.value || unknown.value || !!props.busy)
async function failure(e: unknown) {
  error.value = e instanceof Error ? e.message : String(e)
  await nextTick()
  errorBox.value?.focus()
}
function setMapping(value: ConfigMapping) {
  mapping.value = value
  accepted.value = false
}
function cancel() {
  doc.value = null
  mapping.value = null
}
function begin(d: NpcConfigDocument, label: string) {
  doc.value = d
  mapping.value = defaultConfigMapping(d)
  stamp.value = configStamp(props.world, props.adventure)
  accepted.value = false
  requestId.value = ''
  unknown.value = false
  pending.value = null
  sourceLabel.value = label
  notice.value = ''
  error.value = ''
}
async function copy() {
  try {
    const d = duplicateConfig(
      exportNpcConfig(props.world, props.adventure, selected.value, true, subjects.value),
      copies.value,
    )
    begin(d, '健康复制')
    for (const s of d.scenes)
      if (props.adventure.scenes.some((t) => t.id === s.id)) mapping.value!.scenes[s.id] = s.id
    duplicate.value = false
    fingerprint.value = ''
  } catch (e) {
    await failure(e)
  }
}
async function file(event: Event) {
  const input = event.target as HTMLInputElement,
    f = input.files?.[0]
  input.value = ''
  if (!f) return
  working.value = true
  try {
    if (f.size > CONFIG_FILE_BYTES) throw Error('文件超过16 MiB')
    const data = new Uint8Array(await f.arrayBuffer())
    const d = /\.xlsx$/i.test(f.name)
      ? await (await import('../../persistence/npc-config-xlsx')).parseNpcXlsx(data)
      : /\.json$/i.test(f.name)
        ? parseNpcConfig(JSON.parse(new TextDecoder().decode(data)))
        : (() => {
            throw Error('请选择JSON或XLSX文件；不支持XLS／CSV')
          })()
    fingerprint.value = await fileFingerprint(data)
    duplicate.value = importedBefore('npc', fingerprint.value)
    begin(d, f.name)
  } catch (e) {
    await failure(e)
  } finally {
    working.value = false
  }
}
function check() {
  if (!doc.value || !mapping.value) throw Error('请先选择复制或导入文件')
  const command: ConfigImportCommand = {
    type: 'npc-config-import',
    document: clone(doc.value),
    mapping: clone(mapping.value),
    expectedStamp: stamp.value,
  }
  const w = clone(props.world)
  applyConfigImport(
    w,
    w.adventures.find((a) => a.id === props.adventure.id)!,
    command,
    roleIds.value,
  )
  return command
}
async function refresh() {
  stamp.value = configStamp(props.world, props.adventure)
  requestId.value = ''
  pending.value = null
  accepted.value = false
  try {
    check()
    error.value = ''
    notice.value = '已按当前配置重新预检，请核对并确认'
  } catch (e) {
    await failure(e)
  }
}
async function submit() {
  working.value = true
  error.value = ''
  let started = false
  try {
    if (!unknown.value) {
      if (!accepted.value) throw Error('请确认本批配置与权限')
      pending.value = check()
      requestId.value = crypto.randomUUID()
    }
    started = true
    const ok = await props.submitCommand(pending.value!, requestId.value)
    if (!ok) throw new ApiError('保存未确认，请查看操作提示并重新预检', 400)
    rememberImport('npc', fingerprint.value)
    unknown.value = false
    doc.value = null
    mapping.value = null
    notice.value = '整批配置已保存；新人物、卡片及背包均独立。'
  } catch (e) {
    unknown.value = started && !(e instanceof ApiError)
    await failure(e)
  } finally {
    working.value = false
  }
}
function download(value: unknown, name: string) {
  saveBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), name)
}
async function output(excel = false) {
  try {
    const d = exportNpcConfig(props.world, props.adventure, selected.value, false, subjects.value)
    if (!d.npcs.length) throw Error('请先选择NPC')
    if (excel) {
      if (d.characters.length && !partial.value)
        throw Error('所选人物含完整职业卡：请使用JSON，或明确勾选仅支持字段')
      saveBlob(
        new Blob([
          new Uint8Array(
            await (
              await import('../../persistence/npc-config-xlsx')
            ).writeNpcXlsx(d, partial.value),
          ),
        ]),
        'npc-config.xlsx',
      )
    } else download(d, 'npc-config.json')
    error.value = ''
  } catch (e) {
    await failure(e)
  }
}
async function template(kind: string) {
  working.value = true
  try {
    const empty = {
      format: 'trpg-npc-config',
      version: 1,
      scenes: [],
      npcs: [],
      characters: [],
      subjects: [],
      dependencies: [],
      packs: [],
    } as NpcConfigDocument
    if (kind === 'json') download(empty, 'npc-template.json')
    else if (kind === 'xlsx')
      saveBlob(
        new Blob([
          new Uint8Array(
            await (await import('../../persistence/npc-config-xlsx')).writeNpcXlsx(empty),
          ),
        ]),
        'npc-template.xlsx',
      )
    else {
      const name = kind === 'sample-json' ? 'lamplit-inn-npcs.json' : 'lamplit-inn-npcs.xlsx'
      const response = await fetch('/examples/' + name)
      if (!response.ok) throw Error('样例暂不可用，请刷新后重试')
      saveBlob(await response.blob(), name)
    }
  } catch (e) {
    await failure(e)
  } finally {
    working.value = false
  }
}
useOperationFeedback(notice)
</script>
<template>
  <details class="room-card config-tools">
    <summary>{{ controlText('operations.npcQuickCopyConfigurationImportAndExport') }}</summary>
    <p>{{ controlText('liveSummary.limitNpcsAppendsIndependentCopiesWithoutOverwriting', {p0:(NPC_LIMIT)}) }}</p>
    <div ref="errorBox" tabindex="-1" role="alert" v-show="error" class="config-error">
      {{ displayFeedback(error,'error') }}
    </div>

    <label>{{ controlText('field.filterExistingConfigurations') }}<input v-model="selectionSearch" type="search" /></label>
    <fieldset :disabled="locked" class="config-grid" style="max-height: 280px; overflow: auto">
      <legend>{{ controlText('operations.selectExistingConfiguration') }}</legend>
      <label
        v-for="n in npcs.filter((n) => !selectionSearch || n.name.includes(selectionSearch))"
        :key="n.id"
        class="check"
        ><input v-model="selected" type="checkbox" :value="n.id" />{{ localizedEntryName(n) }}</label
      >
      <p v-if="!npcs.length">{{ controlText('operations.noNpcsYetImportAFileToCreate') }}</p>
    </fieldset>
    <div class="room-row">
      <label
        >{{ controlText('field.numberOfCopies') }}<input
          v-model.number="copies"
          type="number"
          min="1"
          :max="
            Math.min(
              NPC_LIMIT,
              Math.floor((NPC_LIMIT - npcs.length) / Math.max(1, selected.length)),
            )
          "
          :disabled="locked" /></label
      ><button :disabled="locked || !selected.length" @click="copy">{{ controlText('operations.makeAHealthyCopyAndPreview') }}</button
      ><button class="secondary" :disabled="locked" @click="output()">{{ controlText('operations.exportSelectedAsJson') }}</button
      ><button class="secondary" :disabled="locked" @click="output(true)">{{ controlText('operations.exportSelectedAsExcel') }}</button>
    </div>
    <label class="check"
      ><input
        v-model="partial"
        type="checkbox"
        :disabled="locked"
      />{{ controlText('field.excelExportsSupportedFieldsOnlyExcludesFullCards') }}</label
    >
    <label class="config-upload"
      >{{ controlText('field.importNpcFile') }}<input type="file" accept=".json,.xlsx" :disabled="locked" @change="file"
    /></label>
    <div class="room-row">
      <button
        v-for="[kind, label] in [
          ['json', 'JSON空模板'],
          ['xlsx', 'Excel空模板＋字典'],
          ['sample-json', '暮灯驿站4人JSON'],
          ['sample-xlsx', '暮灯驿站简明4人Excel（部分字段）'],
        ]"
        :key="kind"
        class="subtle"
        :disabled="locked"
        @click="template(kind!)"
      >
        {{ label }}
      </button>
    </div>
    <section v-if="doc && mapping" class="config-preview" :aria-label="controlText('field.npcImportPreview')">
      <h3>
        {{ controlText('liveSummary.toAppendNpcsIndependentCharacterCards', {p0:(sourceLabel),p1:(doc.npcs.length),p2:(doc.characters.length)}) }}</h3>
      <p>{{ controlText('liveSummary.currentAutomaticRepliesFollowingAndProactiveActions', {p0:(npcs.length),p1:(NPC_LIMIT),p2:(sourceLabel === '健康复制'
            ? controlText('expressionOne.hpAndUsesRestoreInjuriesTemporaryHpAnd')
            : controlText('expressionOne.retainExplicitlyDeclaredInitialHpUsesAndConditions'))}) }}</p>
      <p v-if="duplicate">{{ controlText('operations.thisBrowserPreviouslyImportedThisFileConfirmWhether') }}</p>
      <p v-if="doc.npcs.some((n) => npcs.some((p) => p.name === n.name))">
        {{ controlText('operations.includesNpcsWithIdenticalNamesCheckTheirNames') }}
      </p>
      <p v-if="doc.dependencies.length">{{ controlText('quantity.dependency', {p0:(doc.dependencies.map((p) => p.id + '@' + p.version).join('、'))}) }}
      </p>
      <ConfigImportPreview
        :document="doc"
        :mapping="mapping"
        :scenes="scenes"
        :subjects="subjects"
        :locked="locked"
        @update="setMapping"
      />
      <p v-if="unknown">
        {{ controlText('operations.theResultIsUnconfirmedAndThePreviewIs') }}
      </p>
      <label class="check"
        ><input
          v-model="accepted"
          type="checkbox"
          :disabled="locked"
        />{{ controlText('field.confirmNamesDestinationsInitialValuesAndReauthorizedFeatures') }}</label
      >
      <div class="room-row">
        <button :disabled="working || busy || (!unknown && !accepted)" @click="submit">
          {{ unknown ? controlText('expressionOne.queryOriginalSubmissionRetrySafely') : controlText('expressionOne.confirmBatchSave') }}</button
        ><button class="secondary" :disabled="locked" @click="refresh">{{ controlText('domain.refreshPreflight') }}</button
        ><button class="subtle" :disabled="locked" @click="cancel">{{ controlText('domain.cancelPreview') }}</button>
      </div>
    </section>
  </details>
</template>
