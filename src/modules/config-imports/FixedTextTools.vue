<script setup lang="ts">
import {displayFeedback} from '../feedback-presentation'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { BROADCAST_LIMIT } from '../../core/configuration-limits'
import { useOperationFeedback } from '../../app/useOperationFeedback'
import { nextTick, ref } from 'vue'
import { clone } from '../../core/engine'
import { applyConfigImport, configStamp } from '../../core/npc-config'
import {
  broadcastTextsSchema,
  CONFIG_FILE_BYTES,
  type BroadcastTextsDocument,
  type ConfigImportCommand,
} from '../../persistence/npc-config-schema'
import type { Adventure, MapWorld } from '../../core/map-types'
import { saveBlob } from '../../online/script-client'
import { ApiError } from '../../online/client'
import './config-imports.css'
import { fileFingerprint, importedBefore, rememberImport } from './import-history'
const props = defineProps<{
  world: MapWorld
  adventure: Adventure
  busy?: boolean
  submitCommand: (c: ConfigImportCommand, id?: string) => Promise<boolean>
}>()
const document = ref<BroadcastTextsDocument | null>(null),
  selected = ref<string[]>([]),
  error = ref(''),
  notice = ref(''),
  working = ref(false),
  unknown = ref(false),
  accepted = ref(false),
  stamp = ref(''),
  id = ref(''),
  pending = ref<ConfigImportCommand | null>(null),
  errorBox = ref<HTMLElement | null>(null),
  fileHash = ref(''),
  duplicate = ref(false)
async function failure(e: unknown) {
  error.value = e instanceof Error ? e.message : String(e)
  await nextTick()
  errorBox.value?.focus()
}
function download(value: unknown, name: string) {
  saveBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), name)
}
function sample(empty = false) {
  download(
    {
      format: 'trpg-broadcast-texts',
      version: 1,
      templates: empty
        ? []
        : [
{title:'暮灯驿站开场',text:'雨夜的铜铃响起，管事青叶端来热茶，请你们帮忙找回补给。'},
{title:'发现线索',text:'搬运记录上写着：备用物资临时放在地窖门边。'},
{title:'收尾',text:'核对标签后，管事确认物资已经找回。由GM确认结果后播放。'}
],
    },
    empty ? 'broadcast-template.json' : 'lamplit-inn-broadcasts.json',
  )
}
async function input(event: Event) {
  const el = event.target as HTMLInputElement,
    f = el.files?.[0]
  el.value = ''
  if (!f) return
  working.value = true
  try {
    if (!/\.json$/i.test(f.name) || f.size > CONFIG_FILE_BYTES)
      throw Error('请选择不超过16 MiB的JSON文件')
    const text = await f.text(),
      d = broadcastTextsSchema.parse(JSON.parse(text))
    document.value = d
    fileHash.value = await fileFingerprint(new TextEncoder().encode(text))
    duplicate.value = importedBefore('broadcast', fileHash.value)
    stamp.value = configStamp(props.world, props.adventure)
    accepted.value = false
    pending.value = null
    unknown.value = false
    error.value = ''
  } catch (e) {
    await failure(e)
  } finally {
    working.value = false
  }
}
function check() {
  const c: ConfigImportCommand = {
      type: 'broadcast-text-import',
      document: broadcastTextsSchema.parse(document.value),
      expectedStamp: stamp.value,
    },
    w = clone(props.world)
  applyConfigImport(
    w,
    w.adventures.find((a) => a.id === props.adventure.id)!,
    c,
  )
  return c
}
async function refresh() {
  stamp.value = configStamp(props.world, props.adventure)
  accepted.value = false
  pending.value = null
  try {
    check()
    error.value = ''
    notice.value = '已重新预检，请再次确认'
  } catch (e) {
    await failure(e)
  }
}
async function submit() {
  working.value = true
  let started = false
  try {
    if (!unknown.value) {
      if (!accepted.value) throw Error('请确认本批文案')
      pending.value = check()
      id.value = crypto.randomUUID()
    }
    started = true
    const ok = await props.submitCommand(pending.value!, id.value)
    if (!ok) throw new ApiError('未保存，请查看操作提示', 400)
    rememberImport('broadcast', fileHash.value)
    document.value = null
    pending.value = null
    unknown.value = false
    notice.value = '固定文案已整批保存为GM手动直接播放；没有播放或调用模型。'
    error.value = ''
  } catch (e) {
    unknown.value = started && !(e instanceof ApiError)
    await failure(e)
  } finally {
    working.value = false
  }
}
async function output() {
  try {
    const templates = (props.adventure.broadcast?.templates ?? [])
      .filter((t) => selected.value.includes(t.id))
      .map((t) => ({ title: t.title, text: t.text }))
    if (!templates.length) throw Error('请勾选要导出的固定文案')
    download(
      broadcastTextsSchema.parse({ format: 'trpg-broadcast-texts', version: 1, templates }),
      'broadcast-fixed-texts.json',
    )
  } catch (e) {
    await failure(e)
  }
}
useOperationFeedback(notice)
</script>
<template>
  <details class="room-card config-tools">
    <summary>{{ controlText('operations.fixedBroadcastJsonImportExport') }}</summary>
    <p>{{ controlText('operations.onlyTitlesAndFixedTextAreImportedNew') }}</p>
    <div ref="errorBox" role="alert" tabindex="-1" v-show="error" class="config-error">
      {{ displayFeedback(error,'error') }}
    </div>

    <label class="config-upload"
      >{{ controlText('field.importFixedBroadcastJson') }}<input
        type="file"
        accept=".json"
        :disabled="working || busy || unknown"
        @change="input"
    /></label>
    <div class="room-row">
      <button class="subtle" @click="sample(true)">{{ controlText('operations.downloadEmptyTemplate') }}</button
      ><button class="subtle" @click="sample()">{{ controlText('operations.downloadNautiloidFixedTextExample') }}</button>
    </div>
    <fieldset class="config-grid" :disabled="working || busy || unknown">
      <legend>{{ controlText('operations.selectTextToExportVariablesBlockExport') }}</legend>
      <label v-for="t in adventure.broadcast?.templates ?? []" :key="t.id" class="check"
        ><input v-model="selected" type="checkbox" :value="t.id" />{{ t.title }}</label
      >
    </fieldset>
    <button class="secondary" @click="output">{{ controlText('operations.exportSelectedFixedText') }}</button>
    <section v-if="document" class="config-preview" :aria-label="controlText('field.fixedBroadcastImportPreview')">
      <h3>{{ controlText('liveSummary.appendEntriesInFileOrderCurrent', {p0:(document.templates.length),p1:(adventure.broadcast?.templates.length ?? 0),p2:(BROADCAST_LIMIT)}) }}
      </h3>
      <p v-if="duplicate">{{ controlText('operations.thisBrowserPreviouslyImportedThisFileConfirmingAgain') }}</p>
      <fieldset :disabled="working || busy || unknown">
        <legend>{{ controlText('operations.reviewText') }}</legend>
        <details
          v-for="(t, index) in document.templates"
          :key="index"
          class="config-preview-item"
          open
        >
          <summary>
            {{ index + 1 }}. {{ t.title
            }}{{
              adventure.broadcast?.templates.some((p) => p.title === t.title)
                ? controlText('expressionOne.sameNameAppendNewTemplate')
                : ''
            }}
          </summary>
          <label>{{ controlText('workbench.titleLabel') }}<input v-model="t.title" maxlength="120" @input="accepted = false" /></label
          ><label
            >{{ controlText('field.fixedText') }}<textarea v-model="t.text" maxlength="4000" @input="accepted = false" />
          </label>
        </details>
      </fieldset>
      <p v-if="unknown">{{ controlText('operations.awaitingTheOriginalSubmissionResultQueryItBefore') }}</p>
      <label class="check"
        ><input
          v-model="accepted"
          type="checkbox"
          :disabled="working || busy || unknown"
        />{{ controlText('field.confirmTextOrderAndGmManualPlaybackSettings') }}</label
      >
      <div class="room-row">
        <button :disabled="working || busy || (!unknown && !accepted)" @click="submit">
          {{ unknown ? controlText('expressionOne.queryOriginalSubmissionRetrySafely') : controlText('expressionOne.confirmBatchTextSave') }}</button
        ><button class="secondary" :disabled="working || busy || unknown" @click="refresh">
          {{ controlText('domain.refreshPreflight') }}</button
        ><button class="subtle" :disabled="working || busy || unknown" @click="document = null">
          {{ controlText('domain.cancelPreview') }}
        </button>
      </div>
    </section>
  </details>
</template>
