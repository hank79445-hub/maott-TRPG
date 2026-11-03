import {
  artBriefSchema,
  artPolicySchema,
  type SceneArtBrief,
  type SceneArtRecord,
} from '../persistence/scene-art-schema'
// Carry revised model descriptions forward without silently overwriting deliberate GM edits.
export function syncArtBrief(record?: SceneArtRecord, source?: SceneArtBrief): SceneArtRecord {
  if (!record)
    return {
      brief: artBriefSchema.parse(source ?? {}),
      policy: artPolicySchema.parse({ purpose: 'beautify' }),
      ...(source ? { sourceBrief: source } : {}),
    }
  if (!source) return record
  const brief = { ...record.brief }
  if (record.sourceBrief)
    for (const key of Object.keys(source) as (keyof SceneArtBrief)[])
      if (brief[key] === record.sourceBrief[key]) Object.assign(brief, { [key]: source[key] })
  return { ...record, brief, sourceBrief: source }
}
