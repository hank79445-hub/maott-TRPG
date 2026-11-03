import { snapshotArtDrafts } from '../../persistence/scene-art-drafts'
import { ref, shallowRef, watch, onBeforeUnmount, toRaw } from 'vue'
import { clone } from '../../core/engine'
import { inspectScript, scriptAssetMeta } from '../../core/script'
import { scriptApi, scriptImage, type ScriptEntry } from '../../online/script-client'
import { ApiError } from '../../online/client'
import { scriptDrafts, type CachedScriptDraft } from '../../persistence/script-drafts'
import type { ScriptDefinition } from '../../persistence/script-schema'
import type { MapAsset } from '../../core/map-types'
import type { SceneArtRecords } from '../../persistence/scene-art-schema'
import type { SceneArtDraft } from '../../core/scene-art-state'

export function useScriptDraft(accountId: string, scriptId: string) {
  const definition = ref<ScriptDefinition | null>(null),
    art = ref<SceneArtRecords>({}),
    artDrafts = shallowRef<Record<string, SceneArtDraft>>({}),
    entry = shallowRef<ScriptEntry | null>(null),
    assets = shallowRef<MapAsset[]>([]),
    status = ref('正在加载'),
    error = ref(''),
    conflict = ref(false),
    dirty = ref(false),
    recovery = shallowRef<CachedScriptDraft | null>(null),
    cacheWarning = ref('')
  let revision = 0,
    baseline = '',
    baselineArt = '{}',
    active = true,
    timer: ReturnType<typeof setTimeout>,
    chain = Promise.resolve(),
    suppression = false
  function assign(value: ScriptDefinition) {
    suppression = true
    definition.value = clone(value)
    baseline = JSON.stringify(value)
    dirty.value = false
    suppression = false
  }
  async function cache() {
    if (!definition.value) return
    try {
      await scriptDrafts.put({
        accountId,
        scriptId,
        revision,
        definition: clone(definition.value),
        assets: assets.value.map((a) => {
          const { blob, preview, ...metadata } = toRaw(a)
          return {
            ...clone(metadata),
            blob: toRaw(blob),
            ...(preview
              ? {
                  preview: {
                    mime: preview.mime,
                    width: preview.width,
                    height: preview.height,
                    blob: toRaw(preview.blob),
                  },
                }
              : {}),
          }
        }),
        at: new Date().toISOString(),
        dirty: dirty.value,
        art: clone(art.value),
        artDrafts: snapshotArtDrafts(artDrafts.value),
      })
      cacheWarning.value = ''
    } catch {
      cacheWarning.value = '浏览器缓存不可用；请保持页面打开并尽快同步云端。'
    }
  }
  async function load(discard = false) {
    const saved = await scriptDrafts.get(accountId, scriptId).catch(() => undefined)
    const next = await scriptApi<ScriptEntry>(`/scripts/${scriptId}`)
    if (!active) return
    revision = next.revision
    entry.value = next
    suppression = true
    art.value = clone(next.art ?? {})
    baselineArt = JSON.stringify(art.value)
    assign(next.definition)
    artDrafts.value = saved?.artDrafts ?? {}
    // Images are private blobs, never anonymous static paths.
    const images: MapAsset[] = []
    for (const m of next.definition.assets) images.push(await scriptImage(scriptId, m))
    if (!active) return
    assets.value = images
    recovery.value = !discard && saved?.dirty ? saved : null
    status.value = '云端已保存'
    conflict.value = false
    if (!recovery.value) await cache()
  }
  async function restore() {
    const saved = recovery.value
    if (!saved) return
    definition.value = clone(saved.definition)
    assets.value = saved.assets
    art.value = clone(saved.art ?? {})
    artDrafts.value = saved.artDrafts ?? {}
    recovery.value = null
    dirty.value = true
    conflict.value = saved.revision !== revision
    if (conflict.value) {
      revision = saved.revision
      status.value = '双设备冲突，草稿已保留'
    } else {
      status.value = '浏览器草稿未同步'
      await cache()
    }
  }
  function currentArt() {
    const ids = new Set(definition.value?.scenes.map((s) => s.id) ?? [])
    return Object.fromEntries(Object.entries(art.value).filter(([id]) => ids.has(id)))
  }
  function save() {
    const task = chain
      .catch(() => {})
      .then(async () => {
        if (!definition.value || !dirty.value || conflict.value || recovery.value) return
        status.value = '正在同步'
        try {
          let captured = inspectScript(clone(definition.value)).definition
          const capturedArt = Object.fromEntries(
            Object.entries(clone(art.value)).filter(([id]) =>
              captured.scenes.some((s) => s.id === id),
            ),
          )
          for (const meta of [...captured.assets]) {
            if (entry.value!.assets.some((a) => a.id === meta.id)) continue
            const local = assets.value.find((a) => a.id === meta.id)
            if (!local) throw Error('缺少未同步背景图片，请重新导入')
            let upload = await scriptApi<{ revision: number; asset: typeof meta }>(
              `/scripts/${scriptId}/assets?name=${encodeURIComponent(meta.name)}`,
              'POST',
              local.blob,
              { 'Content-Type': meta.mime, 'If-Match': String(revision) },
            )
            revision = upload.revision
            if (local.preview)
              upload = await scriptApi(
                `/scripts/${scriptId}/assets/${upload.asset.id}/preview`,
                'POST',
                local.preview.blob,
                { 'Content-Type': local.preview.mime, 'If-Match': String(revision) },
              )
            revision = upload.revision
            const replace = (d: ScriptDefinition) => {
              d.assets = d.assets.map((a) => (a.id === meta.id ? upload.asset : a))
              for (const s of d.scenes)
                if (s.background?.assetId === meta.id) s.background.assetId = upload.asset.id
            }
            replace(captured)
            replace(definition.value!)
            for (const records of [capturedArt, art.value])
              for (const record of Object.values(records))
                if (record.adopted?.assetId === meta.id) record.adopted.assetId = upload.asset.id
            assets.value = assets.value.map((a) =>
              a.id === meta.id ? { ...a, id: upload.asset.id } : a,
            )
            entry.value = {
              ...entry.value!,
              revision,
              assets: [...entry.value!.assets, upload.asset],
            }
          }
          const summary = await scriptApi<{ revision: number }>(`/scripts/${scriptId}`, 'PUT', {
            expectedRevision: revision,
            definition: captured,
            art: capturedArt,
          })
          revision = summary.revision
          baseline = JSON.stringify(captured)
          baselineArt = JSON.stringify(capturedArt)
          dirty.value =
            JSON.stringify(definition.value) !== baseline ||
            JSON.stringify(currentArt()) !== baselineArt
          entry.value = { ...entry.value!, ...summary, definition: captured, art: capturedArt }
          status.value = dirty.value ? '浏览器草稿未同步' : '云端已保存'
          error.value = ''
          await cache()
        } catch (e) {
          conflict.value = e instanceof ApiError && e.status === 409
          status.value = conflict.value ? '双设备冲突，草稿已保留' : '浏览器草稿未同步'
          error.value = e instanceof Error ? e.message : '同步失败'
          await cache()
        }
      })
    chain = task
    return task
  }
  const configCommits = new Map<
    string,
    { candidate: ScriptDefinition; revision: number; before: string }
  >()
  async function acceptConfig(
    prepared: { candidate: ScriptDefinition; before: string },
    nextRevision: number,
    id: string,
  ) {
    revision = nextRevision
    entry.value = { ...entry.value!, revision, definition: prepared.candidate }
    configCommits.delete(id)
    if (JSON.stringify(definition.value) !== prepared.before) {
      conflict.value = true
      status.value = '批量已保存，后续本地编辑仍保留'
      error.value = '本批已在云端保存。提交后另有本地编辑，请先处理草稿冲突，再继续导入。'
    } else {
      assign(prepared.candidate)
      status.value = '云端已保存'
      error.value = ''
    }
    await cache()
  }
  async function commitConfig(id: string, change: (d: ScriptDefinition) => ScriptDefinition) {
    if (!definition.value) throw new ApiError('剧本未加载', 400)
    let prepared = configCommits.get(id)
    if (!prepared) {
      await save()
      if (dirty.value || conflict.value || recovery.value)
        throw new ApiError('请先同步草稿或处理双设备冲突', 409)
      try {
        prepared = {
          candidate: inspectScript(change(clone(definition.value))).definition,
          revision,
          before: JSON.stringify(definition.value),
        }
      } catch (e) {
        throw new ApiError(e instanceof Error ? e.message : String(e), 400)
      }
      configCommits.set(id, prepared)
    } else {
      // A lost PUT response is recovered by comparing the exact new entity IDs,
      // never by applying the additive import a second time.
      const current = await scriptApi<ScriptEntry>(`/scripts/${scriptId}`)
      if (JSON.stringify(current.definition) === JSON.stringify(prepared.candidate)) {
        await acceptConfig(prepared, current.revision, id)
        return
      }
      if (current.revision !== prepared.revision) {
        configCommits.delete(id)
        throw new ApiError('剧本已在另一端更新；本批结果未匹配，请刷新后核对', 409)
      }
    }
    try {
      const summary = await scriptApi<{ revision: number }>(`/scripts/${scriptId}`, 'PUT', {
        expectedRevision: prepared.revision,
        definition: prepared.candidate,
      })
      await acceptConfig(prepared, summary.revision, id)
    } catch (e) {
      if (e instanceof ApiError) configCommits.delete(id)
      throw e
    }
  }
  async function version() {
    await save()
    if (dirty.value || conflict.value) throw Error('请先同步草稿或处理冲突')
    const value = await scriptApi<{ savedVersionId: string; revision: number }>(
      `/scripts/${scriptId}/versions`,
      'POST',
      { expectedRevision: revision },
    )
    revision = value.revision
    await load(true)
    return value.savedVersionId
  }
  function setImage(asset: MapAsset) {
    assets.value = [...assets.value.filter((a) => a.id !== asset.id), asset]
    definition.value!.assets = [
      ...definition.value!.assets.filter((a) => a.id !== asset.id),
      scriptAssetMeta(asset),
    ]
  }
  async function copyRecovery() {
    if (!definition.value) throw Error('草稿未加载')
    // Use atomic package import so offline images are included and no partial copy appears.
    return { definition: clone(definition.value), assets: assets.value }
  }
  async function deleteImage(id: string) {
    await save()
    if (dirty.value || conflict.value) throw Error('请先同步草稿')
    const result = await scriptApi<{ revision: number }>(
      `/scripts/${scriptId}/assets/${id}`,
      'DELETE',
      { expectedRevision: revision },
    )
    revision = result.revision
    entry.value = {
      ...entry.value!,
      revision,
      assets: entry.value!.assets.filter((a) => a.id !== id),
    }
    assets.value = assets.value.filter((a) => a.id !== id)
    await cache()
  }
  watch(
    [definition, art],
    () => {
      if (suppression || !definition.value) return
      dirty.value =
        JSON.stringify(definition.value) !== baseline ||
        JSON.stringify(currentArt()) !== baselineArt
      if (!dirty.value) return
      status.value = conflict.value ? '双设备冲突，草稿已保留' : '浏览器草稿未同步'
      void cache()
      clearTimeout(timer)
      timer = setTimeout(() => {
        void save()
      }, 900)
    },
    { deep: true, flush: 'sync' },
  )
  watch(artDrafts, () => {
    void cache()
  })
  const online = () => {
    if (dirty.value && !conflict.value && !recovery.value) void save()
  }
  const unload = (e: BeforeUnloadEvent) => {
    if (dirty.value) {
      e.preventDefault()
      e.returnValue = ''
    }
  }
  window.addEventListener('online', online)
  window.addEventListener('beforeunload', unload)
  onBeforeUnmount(() => {
    active = false
    clearTimeout(timer)
    window.removeEventListener('online', online)
    window.removeEventListener('beforeunload', unload)
  })
  return {
    definition,
    art,
    artDrafts,
    entry,
    assets,
    status,
    error,
    cacheWarning,
    conflict,
    dirty,
    recovery,
    load,
    restore,
    save,
    commitConfig,
    version,
    setImage,
    copyRecovery,
    deleteImage,
  }
}
