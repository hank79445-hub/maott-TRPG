import { z } from 'zod'
const id = z.string().min(1).max(120)
export const pointLinkSchema = z
  .object({
    id,
    name: z.string().min(1).max(120),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    sourcePointId: id,
    outcome: z.enum(['success', 'failure']),
    effects: z
      .array(
        z
          .object({
            pointId: id,
            operation: z.enum(['open', 'close', 'unlock', 'reveal', 'enable']),
          })
          .strict(),
      )
      .max(50),
    arrivalGroupIds: z.array(id).max(30).optional(),
  })
  .strict()
  .refine(g=>g.effects.length>0||!!g.arrivalGroupIds?.length,'关联组必须有互动效果或出场组')
export const pointLinkRunSchema = z
  .object({
    id,
    groupId: id,
    sourceEventId: id,
    branchId: id,
    status: z.enum(['pending', 'completed']),
    reason: z.string().max(2000),
  })
  .strict()
export type PointLink = z.infer<typeof pointLinkSchema>
export type PointLinkRun = z.infer<typeof pointLinkRunSchema>
