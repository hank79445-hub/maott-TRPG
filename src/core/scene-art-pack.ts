import {
  BEAUTIFICATION_LIGHTING_RULE,
  BEAUTIFICATION_LIGHTING_RULE_EN,
  beautificationMaterial,
  beautificationPrompt,
  renderBeautificationBase,
} from './scene-beautification'
import { zipSync, strToU8 } from 'fflate'
import {
  sceneArtFingerprint,
  artDigest,
  artBytesDigest,
  type SceneArtDocument,
} from './scene-art-projection'
import type { ArtReceipt } from '../persistence/scene-art-schema'
export function textFilesZip(files: Record<string, string>) {
  const data: Record<string, Uint8Array> = {}
  for (const [name, text] of Object.entries(files)) {
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(name)) throw Error('资料文件名无效')
    data[name] = strToU8(text)
  }
  return new Blob([new Uint8Array(zipSync(data))], { type: 'application/zip' })
}
export const sceneArtPrompt = (doc: SceneArtDocument) => beautificationPrompt(doc)
export async function sceneArtBundle(documents: SceneArtDocument[]) {
  if (!documents.length || documents.length > 30) throw Error('请选择1～30个场景')
  const exportId = crypto.randomUUID(),
    files: Record<string, Uint8Array> = {},
    receipts: ArtReceipt[] = []
  const baseMetadata = new Map<number, Record<string, unknown>>()
  for (const [i, original] of documents.entries()) {
    // Export the current workflow without mutating legacy policies or receipts.
    const doc = { ...original, policy: { ...original.policy, purpose: 'beautify' as const } }
    const receipt: ArtReceipt = {
      exportId,
      sceneRef: crypto.randomUUID(),
      geometryHash: await sceneArtFingerprint(doc),
      briefHash: await artDigest(doc.brief),
      policyVersion: 2,
      mode: 'approximate',
      purpose: 'beautify',
      materialHash: await artDigest(beautificationMaterial(doc)),
      at: new Date().toISOString(),
    }
    receipts.push(receipt)
    const folder = `scene-${String(i + 1).padStart(2, '0')}`
    {
      const base = new Uint8Array(await renderBeautificationBase(doc).blob.arrayBuffer())
      files[folder + '/base-map.png'] = base
      files[folder + '/visual-brief.json'] = strToU8(
        JSON.stringify(beautificationMaterial(doc), null, 2),
      )
      files[folder + '/beautify-prompt.txt'] = strToU8(beautificationPrompt(doc))
      files[folder + '/requirements.txt'] = strToU8(
        doc.brief.contentLocale === 'en' ? 'Edit base-map.png while preserving its canvas and layout. Return PNG/JPEG/WebP without text, grids, NPCs or construction marks. GM calibration is required before use. The procedural base is simplified and model compliance is not guaranteed. '+BEAUTIFICATION_LIGHTING_RULE_EN : '使用base-map.png编辑美化；底图提供当前布局。最终PNG/JPEG/WebP保持原画幅；不含文字、网格、NPC和辅助框。必须由GM校准后才能保存可开团版本。程序底图为基础材质与简化形状，不保证模型遵守布局。' + BEAUTIFICATION_LIGHTING_RULE,
      )
      baseMetadata.set(i, {
        ...beautificationMaterial(doc),
        brief: undefined,
        objects: undefined,
        limitations: undefined,
        baseImageHash: await artBytesDigest(base),
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  files['manifest.json'] = strToU8(
    JSON.stringify(
      {
        format: 'trpg-scene-art',
        version: 2,
        exportId,
        scenes: receipts.map((r, i) => ({
          ...r,
          ...baseMetadata.get(i),
          doorArtwork: documents[i]!.policy.doorArtwork ?? 'hidden',
          directory: `scene-${String(i + 1).padStart(2, '0')}`,
        })),
        files: Object.keys(files),
      },
      null,
      2,
    ),
  )
  const bytes = zipSync(files, { level: 1 })
  if (bytes.length > 200 * 1024 ** 2) throw Error('生图资料包超过200MB，请分批导出')
  return { blob: new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), receipts }
}
