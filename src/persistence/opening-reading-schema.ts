import { z } from 'zod'
const id = z.string().min(1).max(120)
const text = z.string().max(12000)
export const openingPresentationSchema = z
  .object({
    opening: text,
    background: text,
    origin: text,
    identities: z.array(z.object({ characterId: id, text }).strict()).max(100),
  })
  .strict()
  .refine(
    (v) => new Set(v.identities.map((i) => i.characterId)).size === v.identities.length,
    '身份介绍引用重复',
  )
export type OpeningPresentation = z.infer<typeof openingPresentationSchema>
export const emptyOpeningPresentation = (): OpeningPresentation => ({
  opening: '',
  background: '',
  origin: '',
  identities: [],
})
export const openingCommandSchema = z
  .object({
    kind: z.literal('opening'),
    operation: z.enum(['configure', 'start', 'read']),
    presentation: openingPresentationSchema.optional(),
    runId: id.optional(),
    page: z.number().int().min(0).max(3).optional(),
    dismissed: z.boolean().optional(),
    complete: z.boolean().optional(),
    targets: z.array(id).max(100).optional(),
  })
  .strict()
export const openingReadingsSchema = z
  .object({
    runs: z
      .array(
        z
          .object({
            id,
            branchId: id,
            at: z.string().max(80),
            presentation: openingPresentationSchema,
            targets: z.array(id).max(100),
          })
          .strict(),
      )
      .max(5),
    progress: z
      .array(
        z
          .object({
            runId: id,
            memberId: id,
            page: z.number().int().min(0).max(3),
            dismissed: z.boolean(),
            complete: z.boolean(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict()
export type OpeningReadings = z.infer<typeof openingReadingsSchema>
export interface OpeningReadingView {
  id: string
  page: number
  dismissed: boolean
  complete: boolean
  pages: string[]
  participants?: { id: string; name: string; page: number; complete: boolean; dismissed: boolean }[]
}
