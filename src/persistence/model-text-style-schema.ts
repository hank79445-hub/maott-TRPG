import { z } from 'zod'
export const textStyleSettingsSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    enabled: z.boolean(),
    npc: z.boolean(),
    narration: z.boolean(),
    actionDensity: z.enum(['sparse', 'none']),
    selfCheck: z.boolean(),
    customRules: z.string().max(4000),
  })
  .strict()
export const textStyleSnapshotSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    enabled: z.boolean(),
    purpose: z.enum(['dialogue', 'proactive', 'narration', 'combat-dialogue']),
    actionDensity: z.enum(['sparse', 'none']),
    selfCheck: z.boolean(),
    rules: z.string().max(8000),
    samples: z
      .array(z.object({ id: z.string().min(1).max(200), text: z.string().max(240) }).strict())
      .max(6),
  })
  .strict()
export const textStyleReportSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    enabled: z.boolean(),
    purpose: textStyleSnapshotSchema.shape.purpose,
    selfCheck: z.boolean(),
    sampleIds: z.array(z.string().max(200)).max(6),
    warnings: z.array(z.string().max(200)).max(8),
  })
  .strict()
