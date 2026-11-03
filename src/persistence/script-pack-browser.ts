import { assertCalibrationReady } from '../core/scene-art-state'
import { Zip, ZipPassThrough, strToU8 } from 'fflate'
import type { ScriptDefinition } from './script-schema'
import type { MapAsset } from '../core/map-types'
import { inspectScript } from '../core/script'
/** Stored binary entries avoid PNG base64 inflation and expensive recompression. */
export async function browserScriptPack(
  input: ScriptDefinition,
  assets: MapAsset[],
  options: { draft?: boolean } = {},
) {
  const definition = inspectScript(input).definition
  if (!options.draft) assertCalibrationReady(definition.scenes)
  const parts: BlobPart[] = []
  let failure: Error | null = null
  const zip = new Zip((error, chunk) => {
    if (error) failure = error
    else parts.push(new Uint8Array(chunk))
  })
  const manifest = new ZipPassThrough('manifest.json')
  zip.add(manifest)
  manifest.push(strToU8(JSON.stringify(definition)), true)
  for (const [i, meta] of definition.assets.entries()) {
    const a = assets.find((a) => a.id === meta.id)
    if (!a) throw Error('缺少背景图片，无法创建完整文件')
    for (const preview of meta.preview ? [false, true] : [false]) {
      const blob = preview ? a.preview!.blob : a.blob
      const entry = new ZipPassThrough(`assets/${i}${preview ? '-preview' : ''}.bin`)
      zip.add(entry)
      const reader = blob.stream().getReader()
      try {
        while (true) {
          const next = await reader.read()
          if (next.done) break
          entry.push(next.value, false)
        }
      } finally {
        reader.releaseLock()
      }
      entry.push(new Uint8Array(), true)
      if (failure) throw failure
    }
  }
  zip.end()
  if (failure) throw failure
  return new Blob(parts, { type: 'application/zip' })
}
