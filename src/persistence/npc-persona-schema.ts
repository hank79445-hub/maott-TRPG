import { z } from 'zod'
const text = z.string().max(12000).default('')
export const PERSONA_FIELDS = [
  'situation',
  'desire',
  'attachment',
  'contradiction',
  'relationships',
  'boundaries',
  'voice',
  'pressure',
] as const
export const personaLayerSchema = z
  .object({
    situation: text,
    desire: text,
    attachment: text,
    contradiction: text,
    relationships: text,
    boundaries: text,
    voice: text,
    pressure: text,
  })
  .strict()
export const npcPersonaSchema = z
  .object({
    version: z.literal(1),
    public: personaLayerSchema,
    self: z
      .array(
        z
          .object({
            key: z.string().min(1).max(120),
            kind: z.enum(['fact', 'hearsay', 'misbelief', 'lie', 'goal']),
            text,
            source: text,
          })
          .strict(),
      )
      .max(100)
      .default([]),
    relations: z
      .array(
        z
          .object({
            target: z.string().min(1).max(200),
            ref: z.string().max(120).default(''),
            kind: z.string().max(200).default(''),
            reason: text,
            change: text,
            visibility: z.enum(['public', 'self', 'director']).default('self'),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    director: text,
    summary: text,
    summaryBasis: z.string().max(120).default(''),
    scenarios: z
      .array(z.object({ kind: z.enum(['help', 'offense', 'threat']), response: text }).strict())
      .max(3)
      .default([]),
  })
  .strict()
export type NpcPersona = z.infer<typeof npcPersonaSchema>
