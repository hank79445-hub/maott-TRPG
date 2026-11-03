<script setup lang="ts">
import {uiLabel} from '../ui-label'
import {displayFeedback} from '../feedback-presentation'
import {presentAuthoringProblem} from '../../shared/localization/authoring'
import {localizeSyntheticAuthoringExample} from '../../content/authoring-example-language'
import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {preflightAuthoring} from '../../core/authoring-preflight'
import AuthoringPreflightReport from './AuthoringPreflightReport.vue'
const preflight=shallowRef<ReturnType<typeof preflightAuthoring>>()
function repairObject(target:string){repairTarget.value=target;saveBlob(textFilesZip(authoringRepairFiles(json.value,rawError.value,target,controlI18n.global.locale.value)),'authoring-repair.zip')}
function downloadPreflight(){if(preflight.value)saveBlob(new Blob([JSON.stringify({issues:preflight.value.issues,options:preflight.value.options,blocked:preflight.value.blocked,...(controlI18n.global.locale.value==='en'?{instructionLocale:'en',presentation:preflight.value.issues.map(p=>({path:p.path,...presentAuthoringProblem(p,'en')}))}:{})},null,2)],{type:'application/json'}),'authoring-preflight.json')}
import { AUTHORING_BYTES, AUTHORING_BRIEF_CHARACTERS } from '../../core/configuration-limits'
import { useGenerationDraft } from './useGenerationDraft'
import AuthoringStages from './AuthoringStages.vue'
import '../../app/authoring-theme.css'
import {
  compileAuthoring,
  checkSceneLocks,
  replaceAuthorScene,
  authoringPrompt,
  authoringCatalogue,
  type CompiledAuthoring,
} from '../../core/script-authoring'
import { syncArtBrief } from '../../core/scene-art-brief'
import { authoringExample } from '../../content/script-authoring-example'
import { parseAuthoring } from '../../persistence/script-authoring-schema'
import { authoringAssets } from '../../core/authoring-map-image'
import { browserScriptPack } from '../../persistence/script-pack-browser'
import { saveBlob } from '../../online/script-client'
import type { MapAsset } from '../../core/map-types'
import {
  readAuthoringModelText,
  authoringModelFiles,
  authoringRepairFiles,
} from '../../core/authoring-model-files'
import { textFilesZip, sceneArtBundle } from '../../core/scene-art-pack'
import { projectSceneArt } from '../../core/scene-art-projection'
import { assertArtReady, type SceneArtDraft } from '../../core/scene-art-state'
import {
  artBriefSchema,
  artPolicySchema,
  type SceneArtRecords,
  type SceneArtRecord,
  type ArtTransform,
} from '../../persistence/scene-art-schema'
import SceneArtPanel from './SceneArtPanel.vue'
import AuthoringRequirementsEditor from './AuthoringRequirementsEditor.vue'
import AuthoringModuleEditor from './AuthoringModuleEditor.vue'
import AuthoringReadinessSummary from './AuthoringReadinessSummary.vue'
import { authoringLaunchText } from '../../core/authoring-readiness'
import { authoringWorkbenchExample } from '../../content/script-authoring-workbench-example'
import ScriptDesignReference from './ScriptDesignReference.vue'
import {
  authoringRequirementsSchema,
} from '../../core/authoring-requirements'
import ScriptCapacitySummary from './ScriptCapacitySummary.vue'
import AuthorSceneEnvironment from './AuthorSceneEnvironment.vue'
import { useWorkshop } from '../../app/store'
import { authoringV16Example } from '../../content/script-authoring-v16-example'
const props = defineProps<{ accountId: string }>()
const workshop = useWorkshop()
const emit = defineEmits<{ close: []; pack: [blob: Blob, art: SceneArtRecords] }>()
const {
  pipeline,
  pipelineRecovery,
  recoveryIssues,
  retryRecovery,
  requirements,
  requirementsNotice,
  brief,
  json,
  step,
  locks,
  images,
  art,
  ready,
  saved,
  storageError,
  defaultLayoutMode,
} = useGenerationDraft(props.accountId)
const compiled = shallowRef<CompiledAuthoring | null>(null),
  assets = shallowRef<MapAsset[]>([])
const error = ref(''),
  busy = ref(false),
  partial = ref(''),
  selected = ref(''),
  urls = ref<string[]>([])
const configurationSummary = computed(() => {
  try { const value = JSON.parse(json.value); return typeof value.title === 'string' ? value.title : controlText('workbench.configurationUntitled') }
  catch { return json.value ? controlText('workbench.configurationInvalid') : controlText('workbench.configurationMissing') }
})
const catalogue = authoringCatalogue()
const compatibility = ref(''),
  rawError = shallowRef<unknown>(null)
const repairTarget = ref('')
const repairTargets = computed(() => compiled.value ? [
  ...compiled.value.source.scenes.map(s => ({ value: 'scene:' + s.key, label: controlText('workbench.repairSceneLabel',{name:s.name}) })),
  ...compiled.value.source.npcs.map(n => ({ value: 'npc:' + n.key, label: controlText('workbench.repairNpcLabel',{name:n.name}) })),
] : [])
const selectedIndex = computed(
  () => compiled.value?.source.scenes.findIndex((s) => s.key === selected.value) ?? -1,
)
const artScene = computed(() => compiled.value?.definition.scenes[selectedIndex.value])
const artRecords = () =>
  Object.fromEntries(Object.entries(art.value).map(([k, v]) => [k, v.record]))
function mappedRecords(c: CompiledAuthoring) {
  return Object.fromEntries(
    c.source.scenes.flatMap((s, i) =>
      art.value[s.key] ? [[c.definition.scenes[i]!.id, art.value[s.key]!.record]] : [],
    ),
  )
}
const counts = computed(() =>
  compiled.value
    ? controlText('workbench.compiledCounts',{scenes:compiled.value.definition.scenes.length,npcs:compiled.value.definition.npcs.length,broadcasts:compiled.value.definition.broadcasts.length})
    : '',
)
function downloadModelFiles(zip: boolean) {
  error.value = ''
  try {
    const options = authoringRequirementsSchema.parse(requirements.value)
    const designNotebook = {version:1 as const,story:pipeline.value.story,specification:pipeline.value.specification}
    if (zip)
      saveBlob(
        textFilesZip(authoringModelFiles(brief.value, options, workshop.packs, designNotebook, controlI18n.global.locale.value)),
        'authoring-model-files.zip',
      )
    else
      downloadText(
        authoringPrompt(brief.value, localizeSyntheticAuthoringExample(Object.values(options.modules).includes('required') ? authoringWorkbenchExample() : authoringV16Example(),options.contentLocale??'zh-CN'), options, workshop.packs, designNotebook, controlI18n.global.locale.value),
        '剧本创作提示词.txt',
      )
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创作需求校验失败'
  }
}
function applyStagedJson(value:string){ json.value=value; error.value='' }
function clearPreview() {
  compiled.value = null
  assets.value = []
  for (const u of urls.value) URL.revokeObjectURL(u)
  urls.value = []
}
watch([json, images], clearPreview, { flush: 'sync' })
watch(json,()=>{preflight.value=undefined},{flush:'sync'})
onBeforeUnmount(clearPreview)
function syncModelArt(source: import('../../persistence/script-authoring-schema').Authoring) {
  const next = { ...art.value }
  for (const scene of source.scenes) {
    const previous = next[scene.key],
      record = syncArtBrief(previous?.record, scene.art)
    next[scene.key] = {
      ...previous,
      record: previous
        ? record
        : { ...record, policy: { ...record.policy, layoutMode: defaultLayoutMode.value } },
    }
  }
  art.value = next
}
function check() {
  preflight.value=undefined
  error.value = ''
  clearPreview()
  try {
    const read = readAuthoringModelText(json.value),
      source = read.source
    if (read.cleaned) {
      json.value = JSON.stringify(source, null, 2)
      compatibility.value = '已移除单一JSON代码围栏，内容仍经严格校验。'
    }
    checkSceneLocks(source, locks.value)
    syncModelArt(source)
    preflight.value=preflightAuthoring(source)
    if(!preflight.value.ready)throw Error('创作预检有待修复项目，请查看分组反馈')
    const c = preflight.value.compiled!,
      a = authoringAssets(c, images.value, artRecords())
    rawError.value = null
    compiled.value = c
    assets.value = a
    urls.value = a.map((x) => URL.createObjectURL(x.blob))
    if (!source.scenes.some((s) => s.key === selected.value)) selected.value = source.scenes[0]!.key
    step.value = 2
  } catch (e) {
    rawError.value = e
    error.value = e instanceof Error ? e.message : '预检失败'
    if(!preflight.value||preflight.value.ready)preflight.value=preflightAuthoring(json.value)
  }
}
function example(comprehensive = false) {
  if (json.value && !window.confirm(controlText('confirmation.loadingAnExampleReplacesTheCurrentAuthoringJson'))) return
  if (json.value && !window.confirm(controlText('confirmation.replaceThisAuthoringDraftWithTheExampleAnd'))) return
  defaultLayoutMode.value = 'approximate'
  locks.value = {}
  images.value = {}
  art.value = {}
  json.value = JSON.stringify(localizeSyntheticAuthoringExample(comprehensive ? authoringWorkbenchExample() : authoringExample(),requirements.value.contentLocale??'zh-CN'), null, 2)
  step.value = 1
}
async function read(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    if (file.size > AUTHORING_BYTES) throw Error('创作JSON超过2MiB')
    const text = await file.text()
    const read = readAuthoringModelText(text)
    checkSceneLocks(read.source, locks.value)
    json.value = JSON.stringify(read.source, null, 2)
    compatibility.value = read.cleaned ? '已移除单一JSON代码围栏，内容仍经严格校验。' : ''
    step.value = 1
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败'
  }
}
function downloadText(text: string, name: string) {
  saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), name)
}
function toggleLock(key: string) {
  try {
    const value = { ...locks.value }
    if (value[key]) delete value[key]
    else value[key] = structuredClone(parseAuthoring(json.value).scenes.find((s) => s.key === key)!)
    locks.value = value
  } catch (e) {
    error.value = String(e)
  }
}
function applyEnvironment(scene: import('../../persistence/script-authoring-schema').AuthorScene) {
  partial.value = JSON.stringify(scene)
  replace()
}
function replace() {
  try {
    json.value = JSON.stringify(
      replaceAuthorScene(
        parseAuthoring(json.value),
        JSON.parse(partial.value),
        Object.keys(locks.value),
      ),
      null,
      2,
    )
    error.value = ''
    check()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '替换失败'
  }
}
async function pack(importing: boolean) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    // Regenerate from the current source; never export a stale successful preview.
    const source = parseAuthoring(json.value)
    checkSceneLocks(source, locks.value)
    syncModelArt(source)
    const c = compileAuthoring(source, json.value),
      a = authoringAssets(c, images.value, artRecords())
    const records = mappedRecords(c)
    if (!importing) await assertArtReady(c.definition.scenes, records)
    const blob = await browserScriptPack(c.definition, a, { draft: importing })
    if (importing) emit('pack', blob, records)
    else saveBlob(blob, source.title.replace(/[<>:"/\\|?*]/g, '_') + '.trpg-script.zip')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '打包失败'
  } finally {
    busy.value = false
  }
}
function updateArt(value: SceneArtDraft) {
  art.value = { ...art.value, [selected.value]: value }
}
function adopt(asset: MapAsset, transform: ArtTransform, record: SceneArtRecord) {
  if (locks.value[selected.value]) {
    error.value = '场景已锁定'
    return
  }
  art.value = { ...art.value, [selected.value]: { record } }
  images.value = { ...images.value, [selected.value]: asset }
  check()
}
function resetArt() {
  if (locks.value[selected.value]) return
  const next = { ...images.value }
  delete next[selected.value]
  images.value = next
  const record = art.value[selected.value]?.record
  if (record) {
    const { adopted: _a, ...remaining } = record
    art.value = { ...art.value, [selected.value]: { record: remaining } }
  }
  check()
}
async function batchArt() {
  const c = compiled.value
  if (!c || busy.value) return
  busy.value = true
  error.value = ''
  const stamp = json.value
  try {
    const docs = c.source.scenes.map((s, i) =>
      projectSceneArt(
        c.definition.scenes[i]!,
        art.value[s.key]?.record.brief,
        art.value[s.key]?.record.policy,
      ),
    )
    const result = await sceneArtBundle(docs)
    if (stamp !== json.value || !compiled.value) throw Error('导出期间场景已变化，请重试')
    const currentDocs = c.source.scenes.map((s, i) =>
      projectSceneArt(
        c.definition.scenes[i]!,
        art.value[s.key]?.record.brief,
        art.value[s.key]?.record.policy,
      ),
    )
    if (JSON.stringify(currentDocs) !== JSON.stringify(docs))
      throw Error('导出期间美术需求已变化，请重试')
    const next = { ...art.value }
    c.source.scenes.forEach((s, i) => {
      const old = next[s.key] ?? {
        record: { brief: artBriefSchema.parse({}), policy: artPolicySchema.parse({}) },
      }
      next[s.key] = { ...old, record: { ...old.record, export: result.receipts[i]! } }
    })
    art.value = next
    saveBlob(result.blob, 'scene-art-bundle.zip')
  } catch (e) {
    error.value = String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="script-generation authoring-theme" :aria-label="controlText('workbench.title')">
    <ScriptCapacitySummary v-if="compiled" :compiled="compiled" :assets="assets" />
    <header class="script-heading">
      <div>
        <h1>{{ controlText('workbench.title') }}</h1>
        <p>{{ controlText('workbench.workflow') }}</p>
      </div>
      <button class="secondary" :disabled="busy || !ready" @click="emit('close')">
        {{ controlText('workbench.backLibrary') }}
      </button>
    </header>
    <p class="muted">
      {{ controlText('workbench.introduction') }}
    </p>
    <p role="status">
      {{
        saved
          ? controlText('expressionFour.localDraftSavedRestoreInThisBrowserAnd')
          : ready
            ? controlText('expressionFour.localDraftNotSavedYet')
            : controlText('expressionFour.restoringLocalDraft')
      }}
    </p>
    <div v-if="Object.keys(locks).length" class="script-actions" :aria-label="controlText('workbench.lockedScenes')">
      <span>{{ controlText('authoringFlow.locked') }}</span
      ><button
        v-for="(scene, key) in locks"
        :key="key"
        :disabled="busy || !ready"
        @click="toggleLock(String(key))"
      >
        {{ controlText('workbench.unlock') }} {{ localizedEntryName(scene) }}
      </button>
    </div>
    <p v-if="storageError" role="alert">{{ displayFeedback(storageError,'error') }}</p>
    <p v-if="error" role="alert" class="generation-error">{{ displayFeedback(error,'error') }}</p>
    <p v-if="compatibility" role="status">{{ compatibility }}</p>
    <p v-if="requirementsNotice" role="status">{{requirementsNotice}}</p>
<section v-if="pipelineRecovery" class="script-card" :aria-label="controlText('workbench.recovery')">
      <strong>{{ controlText('workbench.recovery') }}</strong><p>{{ controlText('workbench.recoveryHelp') }}</p>
      <ul v-if="recoveryIssues.length"><li v-for="issue in recoveryIssues" :key="issue">{{issue}}</li></ul>
      <p v-else>{{ controlText('workbench.preservedBackup') }}</p>
      <button @click="downloadText(pipelineRecovery,'原始阶段资料恢复副本.json')">{{ controlText('workbench.downloadRecovery') }}</button>
      <button @click="retryRecovery">{{ controlText('workbench.retryRecovery') }}</button>
    </section>
    <AuthoringStages v-if="ready" v-model="pipeline" :content-locale="requirements.contentLocale" :brief="brief" :json="json" :ready="ready" @update:json="applyStagedJson" @update:brief="brief=$event" @update:content-locale="requirements={...requirements,contentLocale:$event}">
      <template #specification-options><section class="script-card"><h2>{{ controlText('workbench.constraints') }}</h2><p>{{ controlText('workbench.constraintNote') }}</p><AuthoringRequirementsEditor v-model="requirements" :disabled="!ready || busy" /><AuthoringModuleEditor v-model="requirements" :disabled="!ready || busy" /></section></template>
      <template #project-tools>
        <p>{{ controlText('scriptSummary.storySpecificationPlayersLevelDuration', {p0:(pipeline.story?.title||controlText('expressionFour.notLoaded')),p1:(pipeline.specification?.title||controlText('expressionFour.notLoaded')),p2:(requirements.players??controlText('domain.unspecified')),p3:(requirements.startLevel??controlText('domain.unspecified')),p4:(requirements.hours??controlText('domain.unspecified'))}) }}</p>
        <button @click="pipeline.active=2">{{ controlText('workbench.editSpecification') }}</button>
        <details v-if="!pipeline.specification"><summary>{{ controlText('workbench.legacyOptions') }}</summary><AuthoringRequirementsEditor v-model="requirements" :disabled="!ready || busy" /><AuthoringModuleEditor v-model="requirements" :disabled="!ready || busy" /></details>
              <div class="script-actions">
        <button :disabled="!ready || busy" @click="downloadModelFiles(true)">
          {{ controlText('workbench.modelPack') }}
        </button>
        <details><summary>{{ controlText('workbench.otherExports') }}</summary><button :disabled="!ready || busy" @click="downloadModelFiles(false)">{{ controlText('workbench.promptDownload') }}</button
        ><button :disabled="!ready || busy" @click="example()">{{ controlText('workbench.example') }}</button
        ><button :disabled="!ready || busy" @click="example(true)">{{ controlText('workbench.integratedExample') }}</button
        ></details><label class="generation-file"
          >{{ controlText('workbench.jsonImport') }}<input
            type="file"
            accept=".json,application/json"
            :disabled="!ready || busy"
            @change="read"
        /></label>
      </div>

      </template>
    </AuthoringStages>
    <div v-show="pipeline.active===3">
    <nav class="script-tabs" :aria-label="controlText('workbench.productionSteps')">
      <button
        v-for="(label, i) in ['配置校验', '地图与美术', '打包入库']"
        :key="label"
        :class="{ active: step === i + 1 }"
        :disabled="!ready || busy || (i > 0 && !compiled)"
        @click="step = i + 1"
      >
        {{ i + 1 }} · {{ uiLabel(label) }}
      </button>
    </nav>
    <div v-show="step === 1" class="script-card">
      <p>{{ controlText('scriptSummary.currentConfiguration', {p0:(configurationSummary),p1:(compiled ? controlText('expressionFour.currentPreflightPassed') : controlText('expressionFour.compilationPreflightRequired'))}) }}</p>
      <details>
        <summary>{{ controlText('scriptSummary.availableNpcTemplates', {p0:(catalogue.length)}) }}</summary>
        <p v-for="t in catalogue" :key="t.id">{{ t.id }} · {{ localizedEntryName(t) }}</p>
      </details>
      <details><summary>{{ controlText('workbench.advancedJSON') }}</summary><label
        >{{ controlText('workbench.jsonLabel') }}<textarea
          v-model="json"
          class="generation-json"
          rows="16"
          spellcheck="false"
          :disabled="!ready || busy"
          :placeholder="controlText('workbench.jsonPlaceholder')"
        />
      </label></details>
      <div class="script-actions">
        <button
          v-if="error"
          :disabled="busy"
          @click="
            saveBlob(
              textFilesZip(authoringRepairFiles(json, rawError, repairTarget || (selected?'scene:'+selected:undefined), controlI18n.global.locale.value)),
              'authoring-repair.zip',
            )
          "
        >
          {{ controlText('workbench.repairDownload') }}
        </button>
        <button class="primary" :disabled="!ready || busy || !json" @click="check">
          {{ controlText('workbench.compile') }}</button
        ><button :disabled="!json || busy" @click="downloadText(json, '剧本创作.json')">
          {{ controlText('workbench.jsonDownload') }}
        </button>
      </div>
    </div>
    <div v-if="step === 2 && compiled" class="script-card">
      <h2>{{ localizedEntryName(compiled.definition.metadata) }}</h2>
      <p>{{ counts }}</p>
      <ScriptDesignReference :definition="compiled.definition" />
      <AuthoringReadinessSummary :compiled="compiled" :requirements="requirements" />
      <button :disabled="busy" @click="batchArt">{{ controlText('workbench.allArt') }}</button>
      <div class="generation-maps">
        <article v-for="(scene, i) in compiled.source.scenes" :key="scene.key">
          <h3>{{ localizedEntryName(scene) }}</h3>
          <img :src="urls[i]" :alt="localizedEntryName(scene) + controlText('expressionFour.layoutBackgroundPreview')" /><label
            ><input
              type="checkbox"
              :checked="!!locks[scene.key]"
              @change="toggleLock(scene.key)"
            />{{ controlText('workbench.lockScene') }}</label
          >
          <p>
            {{ controlText('scriptSummary.cellsInteractions', {p0:(scene.width),p1:(scene.height),p2:(scene.points.length),p3:(images[scene.key] ? controlText('expressionFour.customBackgroundVerifyAlignment') : controlText('expressionFour.proceduralStructuralMap'))}) }}
          </p>
        </article>
      </div>
      <label
        >{{ controlText('workbench.backgroundScene') }}<select v-model="selected">
          <option v-for="s in compiled.source.scenes" :key="s.key" :value="s.key">
            {{ localizedEntryName(s) }}
          </option>
        </select></label
      >
      <AuthorSceneEnvironment
        v-if="artScene"
        :source="compiled.source"
        :scene-key="selected"
        :disabled="busy || !!locks[selected]"
        @apply="applyEnvironment"
      />
      <SceneArtPanel
        v-if="artScene"
        :key="selected"
        :scene="artScene"
        :asset="images[selected] ?? assets[selectedIndex]"
        :model-value="art[selected]"
        :locked="!!locks[selected]"
        @update:model-value="updateArt"
        @adopt="adopt"
        @reset="resetArt"
        @calibrate="pack(true)"
      />
      <details>
        <summary>{{ controlText('workbench.repairScene') }}</summary>
        <label>{{ controlText('workbench.repairTarget') }}<select v-model="repairTarget"><option value="">{{ controlText('workbench.currentScene') }}</option><option v-for="target in repairTargets" :key="target.value" :value="target.value">{{ target.label }}</option></select></label>
        <button :disabled="busy" @click="saveBlob(textFilesZip(authoringRepairFiles(json, rawError, repairTarget || 'scene:' + selected, controlI18n.global.locale.value)), 'authoring-repair.zip')">{{ controlText('workbench.repairSelected') }}</button>
        <p>{{ controlText('workbench.sceneJSONHelp') }}</p>
        <textarea v-model="partial" rows="6" :aria-label="controlText('workbench.sceneJSON')" /><button
          :disabled="busy || !partial"
          @click="replace"
        >
          {{ controlText('workbench.replaceScene') }}
        </button>
      </details>
      <button class="primary" @click="step = 3">{{ controlText('workbench.continueExport') }}</button>
    </div>
    <div v-if="step === 3 && compiled" class="script-card">
      <h2>{{ controlText('workbench.ready') }}</h2>
      <p>{{ controlText('scriptSummary.includesBackgroundsInitialNpcValuesInteractionLinks', {p0:(counts)}) }}</p>
      <AuthoringReadinessSummary :compiled="compiled" :requirements="requirements" handoff />
      <p>
        {{ controlText('workbench.importFinalHelp') }}
      </p>
      <div class="script-actions">
        <button :disabled="busy" @click="downloadText(authoringLaunchText(compiled, requirements), 'GM开团检查清单.md')">{{ controlText('workbench.gmChecklist') }}</button>
        <button :disabled="busy" @click="pack(false)">{{ controlText('workbench.zip') }}</button
        ><button class="primary" :disabled="busy" @click="pack(true)">{{ controlText('workbench.importLibrary') }}</button>
      </div>
    </div>
    <AuthoringPreflightReport v-if="preflight" :report="preflight" @repair="repairObject" @download="downloadPreflight" />
    <button v-if="step !== 1 && !compiled" :disabled="busy" @click="check">{{ controlText('workbench.recompile') }}</button>
  </div>
</section>
</template>

<style scoped>
.generation-json {
  width: 100%;
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
.script-generation textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}
.generation-maps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.generation-maps img {
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  background: #283137;
  border-radius: 8px;
}
.generation-file {
  max-width: 300px;
}
.script-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0;
}
.script-actions > details {
  width: auto;
  max-width: 100%;
}
.script-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.generation-error {
  color: var(--danger, #a52d2d);
  white-space: pre-wrap;
  max-height: 240px;
  overflow: auto;
}
.script-generation button {
  min-height: 42px;
}
@media (max-width: 600px) {
  .script-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .generation-maps {
    grid-template-columns: 1fr;
  }
  .script-tabs button {
    flex: 1;
  }
  .script-generation textarea {
    max-width: 100%;
  }
}
</style>
