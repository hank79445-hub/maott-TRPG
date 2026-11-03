import { z } from 'zod'
export const modelContractReportSchema = z
  .object({
    version: z.literal(1),
    purpose: z.enum(['npc', 'narration']),
    repairs: z
      .array(
        z
          .object({ path: z.string().max(100), operation: z.enum(['alias', 'move', 'ignore']) })
          .strict(),
      )
      .max(16),
  })
  .strict()
export const planningDialogueSchema = z
  .object({
    text: z.string().min(1).max(2000),
    segments: z.unknown().optional(),
    publicSourceIds: z.array(z.string().min(1).max(200)).max(100),
    dialogueCategory: z.enum([
      'greeting',
      'small-talk',
      'public-recap',
      'emotional-response',
      'unknown',
    ]),
    reviewRequired: z.boolean(),
  })
  .strict()
