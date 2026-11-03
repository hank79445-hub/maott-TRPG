import { z } from 'zod'
import { characterSchema, growthRequestSchema } from './schema'
export const authoringCharacterSchema = z
  .object({
    build: characterSchema.shape.build.omit({ growth: true }),
    growth: z
      .array(
        growthRequestSchema
          .omit({ expectedRevision: true, confirmed: true, reason: true, hpMethod: true })
          .extend({ hpMethod: z.literal('fixed').default('fixed') }),
      )
      .max(4)
      .default([]),
  })
  .strict()
export type AuthoringCharacter = z.infer<typeof authoringCharacterSchema>
