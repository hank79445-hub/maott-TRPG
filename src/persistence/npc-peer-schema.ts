import { z } from 'zod'
const id = z.string().min(1).max(120)
export const peerSessionsSchema = z
  .array(
    z
      .object({
        id,
        branchId: id,
        sceneId: id,
        participants: z.array(id).min(2).max(4),
        topic: z.string().max(2000),
        status: z.enum(['pending', 'active', 'paused', 'stopped']),
        generation: z.number().int().nonnegative(),
        lastJobId: id.optional(),
        transcript: z
          .array(z.object({ speaker: z.string().max(200), text: z.string().max(2000) }).strict())
          .max(100),
      })
      .strict(),
  )
  .max(100)
