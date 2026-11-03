import { z } from 'zod'
export const gmControlSchema = z
  .object({
    id: z.string().min(1).max(120),
    targetKind: z.enum(['character', 'npc']),
    targetId: z.string().min(1).max(120),
    gmId: z.string().min(1).max(120),
    at: z.string().min(1).max(120),
    previousController: z.enum(['gm', 'model']).optional(),
  })
  .strict()
