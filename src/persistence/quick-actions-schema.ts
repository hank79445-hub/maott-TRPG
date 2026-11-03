import { z } from 'zod'
export const quickActionBoardSchema = z.enum(['action', 'attack', 'magic'])
export type QuickActionBoard = z.infer<typeof quickActionBoardSchema>
export const quickActionSchema = z
  .object({
    kind: z.enum(['spell', 'item', 'feature', 'attack']),
    key: z.string().min(1).max(300),
    board: quickActionBoardSchema.optional(),
  })
  .strict()
export const quickActionsSchema = z
  .object({ revision: z.number().int().nonnegative(), entries: z.array(quickActionSchema).max(20) })
  .strict()
  .refine(
    (v) => new Set(v.entries.map((e) => e.kind + ':' + e.key)).size === v.entries.length,
    '收藏项重复',
  )
export type QuickAction = z.infer<typeof quickActionSchema>
export type QuickActions = z.infer<typeof quickActionsSchema>
/** Old records remain readable without rewriting a user's saved preferences. */
export const quickActionBoard = (entry: QuickAction): QuickActionBoard =>
  entry.board ?? (entry.kind === 'item' || entry.kind === 'attack' ? 'attack' : 'magic')
