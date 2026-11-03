import { z } from 'zod'
import { itemReferenceSchema } from './item-reference-schema'
export const pointItemsSchema = z
  .object({
    match: z.enum(['all', 'any']),
    requirements: z
      .array(
        z
          .object({
            itemId: itemReferenceSchema,
            quantity: z.number().int().min(1).max(10000),
            mode: z.enum(['possess', 'use', 'attempt', 'success']),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    effect: z.enum(['open', 'prerequisite']),
    fallback: z.enum(['none', 'check', 'gm']),
  })
  .strict()
  .refine(
    (p) => new Set(p.requirements.map((r) => r.itemId)).size === p.requirements.length,
    '同一物品条件请合并数量',
  )
export type PointItems = z.infer<typeof pointItemsSchema>
