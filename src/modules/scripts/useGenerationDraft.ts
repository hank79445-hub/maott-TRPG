import {newPipeline} from '../../core/authoring-stages'
import { recoverAuthoringPipeline } from '../../core/authoring-pipeline-recovery'
import {
  defaultAuthoringRequirements,
  restoreAuthoringRequirements,
} from '../../core/authoring-requirements'
import { snapshotArtDrafts } from '../../persistence/scene-art-drafts'
import { clone } from '../../core/engine'
import { onMounted, ref, shallowRef, watch } from 'vue'
import { generationDrafts } from '../../persistence/generation-drafts'
import type { AuthorScene } from '../../persistence/script-authoring-schema'
import type { MapAsset } from '../../core/map-types'
import type { SceneArtDraft } from '../../core/scene-art-state'
export function useGenerationDraft(account: string) {
  const brief = ref(
    '4名2级角色，约2小时的原创逃离冒险；3场景，2重要NPC，6普通NPC，包含解救、增援及两个结局。剧情：从海港囚室逃往码头，营救学者并乘船离开。场景：潮湿石室→守卫回廊→雾中码头；主要物体为铁笼控制台、铜铃拉绳和小艇。',
  )
  const requirements = ref(defaultAuthoringRequirements())
  const pipeline = ref(newPipeline())
  const pipelineRecovery = ref('')
  const json = ref(''),
    step = ref(1),
    locks = shallowRef<Record<string, AuthorScene>>({}),
    images = shallowRef<Record<string, MapAsset>>({}),
    art = shallowRef<Record<string, SceneArtDraft>>({})
  const defaultLayoutMode =
    ref<import('../../persistence/scene-art-schema').LayoutMode>('approximate')
  const ready = ref(false),
    saved = ref(''),
    storageError = ref(''),
    requirementsNotice = ref('')
  const recoveryIssues = ref<string[]>([])
  function retryRecovery() {
    try {
      const result = recoverAuthoringPipeline(JSON.parse(pipelineRecovery.value))
      recoveryIssues.value = result.issues
      const next = { ...pipeline.value }
      for (const key of ['story', 'specification'] as const) {
        if (!next[key] && result.pipeline[key]) next[key] = result.pipeline[key]
      }
      pipeline.value = next
      if (!result.issues.length) recoveryIssues.value = ['副本检查完成；合法且缺失的阶段已补回，已有阶段保留。']
    } catch { recoveryIssues.value = ['恢复副本不是有效JSON；原始副本继续保留，请下载修复。'] }
  }
  let queue = Promise.resolve()
  onMounted(async () => {
    try {
      const old = await generationDrafts.get(account)
      if (old?.version === 1) {
        defaultLayoutMode.value = old.defaultLayoutMode ?? 'precise'
        const restored = restoreAuthoringRequirements(old.requirements, old.requirementsVersion)
        requirements.value = restored.value
        requirementsNotice.value = restored.notice
        pipelineRecovery.value = old.pipelineRecovery ?? ''
        if (old.pipeline) {
          const result = recoverAuthoringPipeline(old.pipeline)
          pipeline.value = result.pipeline
          recoveryIssues.value = result.issues
          if (result.issues.length) {
            // Keep an earlier failed original; never replace it with a partial recovery.
            pipelineRecovery.value ||= JSON.stringify(old.pipeline)
          }
        } else if (old.json) pipeline.value.active = 3
        brief.value = old.brief
        json.value = old.json
        step.value = old.step
        locks.value = old.locks
        images.value = old.images
        art.value = old.art ?? {}
        saved.value = old.at
      }
    } catch {
      storageError.value = '无法恢复本机草稿，请下载创作JSON另存。'
    }
    ready.value = true
  })
  watch([brief, json, step, locks, images, art, requirements, defaultLayoutMode, () => JSON.stringify(pipeline.value)], () => {
    if (!ready.value) return
    const at = new Date().toISOString()
    const value = {
      version: 1 as const,
      pipeline: clone(pipeline.value),
      pipelineRecovery: pipelineRecovery.value || undefined,
      requirementsVersion: 2 as const,
      defaultLayoutMode: defaultLayoutMode.value,
      brief: brief.value,
      requirements: clone(requirements.value),
      json: json.value,
      step: step.value,
      locks: structuredClone(locks.value),
      images: structuredClone(images.value),
      art: snapshotArtDrafts(art.value),
      at,
    }
    saved.value = ''
    queue = queue
      .catch(() => {})
      .then(async () => {
        try {
          await generationDrafts.put(account, value)
          saved.value = at
          storageError.value = ''
        } catch {
          storageError.value = '本机草稿保存失败，请立即下载JSON与完整ZIP另存；图片未保证保存。'
        }
      })
  })
  return {
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
  }
}
