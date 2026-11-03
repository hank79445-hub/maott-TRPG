<script setup lang="ts">
import {uiLabel} from '../ui-label'
import {displayFeedback} from '../feedback-presentation'
import { i18n as controlI18n } from '../../app/i18n'
const { t: controlText } = controlI18n.global

import {entryDisplayName as localizedEntryName} from '../runtime-presentation'

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  artBriefSchema,
  artPolicySchema,
  type SceneArtRecord,
  type ArtTransform,
} from '../../persistence/scene-art-schema'
import { projectSceneArt, sceneArtFingerprint } from '../../core/scene-art-projection'
import {
  adoptArt,
  currentArtCandidate,
  artStatus,
  coverTransform,
  backgroundTransform,
  logicalTransform,
  coversScene,
  type SceneArtDraft,
  type ArtBackgroundScene,
} from '../../core/scene-art-state'
import { sceneArtBundle, sceneArtPrompt } from '../../core/scene-art-pack'
import { prepareMapImage } from '../map-images'
import { syncArtBrief } from '../../core/scene-art-brief'
import { saveBlob } from '../../online/script-client'
import type { MapAsset } from '../../core/map-types'
import SceneArtPreview from './SceneArtPreview.vue'
import SceneBeautificationControls from './SceneBeautificationControls.vue'
import { renderSceneArt } from '../../core/scene-art-render'
const props = defineProps<{
  scene: ArtBackgroundScene
  asset?: MapAsset
  modelValue?: SceneArtDraft
  locked?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: SceneArtDraft]
  adopt: [asset: MapAsset, transform: ArtTransform, record: SceneArtRecord]
  reset: []
  calibrate: []
}>()
const state = computed<SceneArtDraft>(() => ({
    ...props.modelValue,
    record: syncArtBrief(props.modelValue?.record, props.scene.art),
  })),
  error = ref(''),
  notice = ref(''),
  busy = ref(false),
  checked = ref(false),
  original = ref(false),
  status = ref('未生成')
const calibrationChecks = ref([false, false, false, false])
const calibrationLabels = [
  '已核对主要对象及互动点位置',
  '已核对墙门、通路与地形',
  '已核对入口、出口与落点',
  '已核对网格距离尺度',
]
const candidateMode = computed(
  () =>
    candidate.value?.sourceMode ??
    props.scene.artCalibration?.mode ??
    state.value.record.adopted?.mode ??
    state.value.record.policy.layoutMode ??
    'precise',
)
const doc = computed(() =>
  projectSceneArt(props.scene, state.value.record.brief, { ...state.value.record.policy, purpose: 'beautify' }),
)
const candidate = computed(() => state.value.candidate)
const previewAsset = computed(() =>
  !original.value && candidate.value ? candidate.value.asset : props.asset,
)
const previewTransform = computed(() => {
  const t =
    !original.value && candidate.value
      ? candidate.value.transform
      : (props.scene.background ??
        (props.asset ? coverTransform(props.scene, props.asset) : undefined))
  return t ? logicalTransform(props.scene, t) : undefined
})
const currentHash = ref('')
let statusGeneration = 0
let alive = true
onBeforeUnmount(() => {
  alive = false
  statusGeneration++
})
watch(
  () => [props.scene, state.value.record],
  async () => {
    const version = ++statusGeneration
    try {
      const s = await artStatus(props.scene, state.value.record),
        hash = await sceneArtFingerprint(doc.value)
      if (version === statusGeneration) {
        currentHash.value = hash
        status.value = {
          none: '未采用图片',
          unknown: '来源信息未携带，待GM核对',
          confirmed: '已核对采用',
          pending: '背景待GM校准：请检查玩法布局后确认',
          stale: '布局或背景变换已变化，需要复核',
        }[s]
      }
    } catch (e) {
      if (version === statusGeneration) error.value = String(e)
    }
  },
  { immediate: true, deep: true },
)
watch(
  () => [props.scene.id, JSON.stringify(doc.value), candidate.value?.transform],
  () => {
    checked.value = false
    calibrationChecks.value = [false, false, false, false]
  },
  { deep: true },
)
function update(value: SceneArtDraft) {
  emit('update:modelValue', value)
}
function brief(key: keyof SceneArtRecord['brief'], value: string) {
  update({
    ...state.value,
    record: { ...state.value.record, brief: { ...state.value.record.brief, [key]: value } },
  })
}
function policy(value: boolean) {
  update({
    ...state.value,
    record: {
      ...state.value.record,
      policy: { ...state.value.record.policy, includeHiddenGeometry: value },
    },
  })
}
function transform(key: keyof ArtTransform, value: number) {
  if (!candidate.value) return
  update({
    ...state.value,
    candidate: { ...candidate.value, transform: { ...candidate.value.transform, [key]: value } },
  })
}
async function download() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const sourceId = props.scene.id,
    captured = JSON.stringify(doc.value)
  try {
    const bundle = await sceneArtBundle([doc.value])
    if (!alive || props.scene.id !== sourceId || JSON.stringify(doc.value) !== captured)
      throw Error('场景资料已变化，请重新导出')
    update({ ...state.value, record: { ...state.value.record, export: bundle.receipts[0]! } })
    saveBlob(
      bundle.blob,
      'scene-beautification.zip',
    )
    notice.value = '已导出程序底图与美化提示词；请交给外部应用编辑美化。'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
async function image(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return
  const sceneId = props.scene.id
  busy.value = true
  error.value = ''
  try {
    const asset = await prepareMapImage(file, true)
    if (!alive || props.scene.id !== sceneId) throw Error('目标场景已改变，请重新选择图片')
    update({
      ...state.value,
      candidate: {
        asset,
        transform: coverTransform(props.scene, asset),
        sourceGeometryHash: null,
        sourcePurpose: 'beautify',
        sourceMode: 'approximate',
        sourceMaterialHash: null,
      },
    })
    original.value = false
    checked.value = false
    const mismatch =
      Math.abs(asset.width / asset.height - props.scene.grid.columns / props.scene.grid.rows) > 0.01
    notice.value =
      '仅载入候选，原背景保留。图片来源未提供，请核对后采用。' +
      (mismatch ? '返图画幅与地图不一致；当前等比覆盖会裁切，请明确调整并校准。' : '')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
async function apply(existing = false, calibrated = false) {
  if (busy.value) return
  const b = props.scene.background
  const draft: SceneArtDraft =
    existing && props.asset && b
      ? {
          ...state.value,
          candidate: currentArtCandidate(props.scene, props.asset, state.value.record),
        }
      : state.value
  const id = props.scene.id,
    captured = JSON.stringify(doc.value)
  busy.value = true
  error.value = ''
  try {
    if (calibrated && !calibrationChecks.value.every(Boolean)) throw Error('请完成四项GM校准核对')
    const record = await adoptArt(props.scene, draft, !!props.locked, checked.value, calibrated)
    if (!alive || id !== props.scene.id || captured !== JSON.stringify(doc.value))
      throw Error('核对期间场景已变化，请重新核对')
    update({ record })
    emit('adopt', draft.candidate!.asset, record.adopted!.transform, record)
    notice.value =
      record.adopted?.calibration === 'pending'
        ? '已保存待校准背景；可进入场景编辑调整，完成后再确认。'
        : '已核对采用；保存位置由所在工作台／个人库说明。'
    checked.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
function resetTransform(stretch = false) {
  if (!candidate.value) return
  const t = stretch
    ? backgroundTransform(props.scene, {
        x: 0,
        y: 0,
        width: props.scene.grid.columns,
        height: props.scene.grid.rows,
        rotation: 0,
      })
    : coverTransform(props.scene, candidate.value.asset)
  update({ ...state.value, candidate: { ...candidate.value, transform: t } })
}
async function receipt(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file || !candidate.value) return
  const sceneId = props.scene.id,
    assetId = candidate.value.asset.id
  try {
    if (file.size > 128000) throw Error('关联文件过大')
    const raw = JSON.parse(await file.text()),
      expected = state.value.record.export
    if (!alive || sceneId !== props.scene.id || assetId !== candidate.value?.asset.id)
      throw Error('候选或场景已变化，请重新选择关联文件')
    const found = Array.isArray(raw.scenes)
      ? raw.scenes.find((r: { sceneRef?: string }) => r.sceneRef === expected?.sceneRef)
      : raw
    if (
      !expected ||
      found?.sceneRef !== expected.sceneRef ||
      found?.exportId !== expected.exportId ||
      found?.geometryHash !== expected.geometryHash ||
      found?.policyVersion !== expected.policyVersion ||
      (expected.materialHash && found?.materialHash !== expected.materialHash)
    )
      throw Error('关联文件不是此场景最近一次导出；图片仍为未关联候选')
    update({
      ...state.value,
      candidate: {
        ...candidate.value,
        sourcePurpose: expected.purpose ?? 'direct',
        sourceGeometryHash: expected.geometryHash,
        sourceMode: expected.mode ?? 'precise',
        sourceMaterialHash: expected.materialHash ?? null,
      },
    })
    notice.value = '已关联导出编号；仍需人工核对图片实际内容。'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
const fields = [
  ['publicName', '对外场景别名'],
  ['description', '场景美术描述'],
  ['composition', '构图说明与必要连接'],
  ['style', '美术风格'],
  ['materials', '地面与墙体材质'],
  ['lighting', '光照'],
  ['decorations', '明确绘制的静态装饰'],
  ['exclusions', '排除内容'],
] as const
const dimensions = [
  ['x', '背景X'],
  ['y', '背景Y'],
  ['width', '背景宽'],
  ['height', '背景高'],
  ['rotation', '旋转角度'],
] as const
defineExpose({ document: doc })
</script>
<template>
  <section class="scene-art-panel" :aria-label="controlText('remainingField.perSceneImageCreationAndReturn')">
    <h3>{{ controlText('progressSummary.imageCreationAndReturn', {p0:(localizedEntryName(scene))}) }}</h3>
    <p role="status">{{ uiLabel(status) }}{{ candidate ? controlText('expressionFour.anotherCandidateAwaitsVerification') : '' }}</p>
    <p class="muted">
      {{ controlText('authoringFlow.sceneArtDefaultsToDetailedCreationJsonDescriptions') }}
    </p>
    <p v-if="error" role="alert" class="art-error">{{ displayFeedback(error,'error') }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p
      v-if="
        candidate?.sourceGeometryHash && currentHash && candidate.sourceGeometryHash !== currentHash
      "
      role="alert"
    >
      {{ controlText('authoringFlow.theCandidateUsesAnOlderLayoutRecheckIt') }}
    </p>
    <details>
      <summary>{{ controlText('authoringFlow.artRequirementsAndExportScope') }}</summary>
      <div class="art-form">
        <label v-for="[key, label] in fields" :key="key"
          >{{ label
          }}<textarea
            :value="state.record.brief[key]"
            rows="2"
            :maxlength="
              key === 'publicName'
                ? 80
                : ['decorations', 'description', 'composition'].includes(key)
                  ? 2000
                  : 1000
            "
            :disabled="busy"
            @input="brief(key, ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
      </div>
      <button
        v-if="scene.art"
        type="button"
        :disabled="busy || locked"
        @click="
          update({
            ...state,
            record: {
              ...state.record,
              brief: artBriefSchema.parse(scene.art),
              sourceBrief: artBriefSchema.parse(scene.art),
            },
          })
        "
      >
        {{ controlText('authoringFlow.restoreArtRequirementsFromCreationJson') }}
      </button>
      <p class="muted">
        {{ controlText('authoringFlow.creationJsonSuppliesObjectAppearancesPositionedByScene') }}
      </p>
      <ul v-if="doc.geometry.objects.length" :aria-label="controlText('remainingField.interactionObjectsToDraw')">
        <li v-for="(object, i) in doc.geometry.objects" :key="i">
          {{ controlText('progressSummary.cellsFacing', {p0:(object.label),p1:(object.x),p2:(object.y),p3:(object.width),p4:(object.height),p5:(object.rotation),p6:(object.description)}) }}
        </li>
      </ul>
      <p v-else class="muted">{{ controlText('authoringFlow.noExportableInteractionObjectAppearancesConfigured') }}</p>
      <label 
        ><input
          type="checkbox"
          :checked="state.record.policy.includeHiddenGeometry"
          :disabled="busy"
          @change="policy(($event.target as HTMLInputElement).checked)"
        />{{ controlText('remainingField.explicitlyIncludePhysicalAppearancesOfHiddenWallsDoors') }}</label
      >
    </details>
    <SceneBeautificationControls
      :document="doc"
      :disabled="busy"
      @policy="update({ ...state, record: { ...state.record, policy: $event } })"
    />
    <div class="script-actions">
      <button :disabled="busy" @click="download">
        {{
          controlText('expressionFour.downloadThisSceneSBeautificationPackage')
        }}</button
      ><label
        >{{ controlText('remainingField.uploadCandidateBackgroundForThisScene') }}<input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          :disabled="busy"
          @change="image"
      /></label>
    </div>
    <button
      :disabled="busy"
      @click="saveBlob(renderSceneArt(doc, true).blob, 'gm-calibration-guide.png')"
    >
      {{ controlText('authoringFlow.downloadSeparateGmCalibrationMapNotForBeautification') }}
    </button>
    <div v-if="candidate" class="art-form">
      <label v-for="[key, label] in dimensions" :key="key"
        >{{ label
        }}<input
          type="number"
          step="0.1"
          :value="candidate.transform[key]"
          :disabled="busy"
          @input="transform(key, Number(($event.target as HTMLInputElement).value))" /></label
      ><label
        >{{ controlText('remainingField.returnedImageAssociationJsonOptional') }}<input
          type="file"
          accept=".json"
          :disabled="busy"
          @change="receipt"
      /></label>
    </div>
    <div v-if="candidate" class="script-actions">
      <button :disabled="busy" @click="resetTransform()">{{ controlText('authoringFlow.restoreProportionalCoverage') }}</button
      ><button :disabled="busy" @click="resetTransform(true)">{{ controlText('authoringFlow.explicitlyStretchToFill') }}</button
      ><label><input v-model="original" type="checkbox" />{{ controlText('remainingField.viewOriginalImage') }}</label
      ><span v-if="!coversScene(scene, candidate.transform)" class="art-error"
        >{{ controlText('authoringFlow.candidateDoesNotCoverTheEntireMap') }}</span
      ><button :disabled="busy" @click="update({ record: state.record })">
        {{ controlText('authoringFlow.discardCandidateAndKeepOriginal') }}
      </button>
    </div>
    <SceneArtPreview :document="doc" :asset="previewAsset" :transform="previewTransform" />
    <label
      ><input
        v-model="checked"
        type="checkbox"
        :disabled="busy"
      />{{ controlText('remainingField.iVerifiedImageSourceWallsDoorsPassagesAnd') }}</label
    >
    <div class="script-actions">
      <button class="primary" :disabled="busy || locked || !candidate || !checked" @click="apply()">
        {{ candidateMode === 'precise' ? controlText('expressionFour.useCandidateImage') : controlText('expressionFour.saveAsBackgroundAwaitingCalibration') }}</button
      ><button :disabled="busy || locked || !asset || !checked" @click="apply(true)">
        {{
          scene.artCalibration ||
          (state.record.adopted?.mode && state.record.adopted.mode !== 'precise')
            ? controlText('expressionFour.markCurrentBackgroundAsAwaitingCalibrationAgain')
            : controlText('expressionFour.reviewAndContinueUsingCurrentBackground')
        }}</button
      ><button :disabled="busy || locked" @click="emit('reset')">{{ controlText('authoringFlow.restoreProceduralMapRemoveBackground') }}</button>
    </div>
    <div
      v-if="
        scene.artCalibration ||
        (state.record.adopted?.mode && state.record.adopted.mode !== 'precise')
      "
      class="calibration-box"
    >
      <h4>{{ controlText('authoringFlow.gmCalibrationConfirmation') }}</h4>
      <p>{{ controlText('authoringFlow.saveTheDraftAndOpenSceneEditingFirst') }}</p>
      <button :disabled="busy || locked" @click="emit('calibrate')">{{ controlText('authoringFlow.openThisSceneForCalibration') }}</button>
      <label v-for="(label, i) in calibrationLabels" :key="label" style="display: block"
        ><input v-model="calibrationChecks[i]" type="checkbox" :disabled="busy" />{{ uiLabel(label) }}</label
      >
      <button
        :disabled="busy || locked || !asset || !checked || !calibrationChecks.every(Boolean)"
        @click="apply(true, true)"
      >
        {{ controlText('authoringFlow.confirmCalibrationAndUseCurrentBackground') }}
      </button>
    </div>
    <p v-if="locked" class="muted">{{ controlText('authoringFlow.sceneIsLockedViewingAndExportingAreAllowed') }}</p>
  </section>
</template>
<style scoped>
.scene-art-panel {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}
.art-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.art-form textarea,
.art-form input {
  width: 100%;
  box-sizing: border-box;
}
.art-data {
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 12px;
}
.art-error {
  color: var(--danger, #a52d2d);
}
.scene-art-panel .script-actions {
  margin: 12px 0;
}
.scene-art-panel button {
  min-height: 42px;
}
@media (max-width: 600px) {
  .art-form {
    grid-template-columns: 1fr;
  }
  .scene-art-panel {
    padding: 12px;
  }
}
</style>
