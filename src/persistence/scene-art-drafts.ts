import { toRaw } from 'vue'
import { clone } from '../core/engine'
import type { SceneArtDraft } from '../core/scene-art-state'
// IndexedDB/structuredClone cannot serialize nested Vue proxies. Keep image blobs intact.
export function snapshotArtDrafts(
  drafts: Record<string, SceneArtDraft>,
): Record<string, SceneArtDraft> {
  return Object.fromEntries(
    Object.entries(drafts).map(([id, draft]) => {
      const candidate = draft.candidate
      if (!candidate) return [id, { record: clone(draft.record) }]
      const { blob, preview, ...metadata } = toRaw(candidate.asset)
      return [
        id,
        {
          record: clone(draft.record),
          candidate: {
            transform: clone(candidate.transform),
            sourceGeometryHash: candidate.sourceGeometryHash,
            ...(candidate.sourcePurpose ? { sourcePurpose: candidate.sourcePurpose } : {}),
            ...(candidate.sourceMode ? { sourceMode: candidate.sourceMode } : {}),
            ...(candidate.sourceMaterialHash
              ? { sourceMaterialHash: candidate.sourceMaterialHash }
              : {}),
            asset: {
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
            },
          },
        },
      ]
    }),
  )
}
