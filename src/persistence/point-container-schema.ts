import { z } from 'zod'
const id = z.string().min(1).max(120)
export const containerActionSchema = z
  .object({
    kind: z.literal('container'),
    sceneId: id,
    pointId: id,
    characterId: id,
    stamp: z.string().regex(/^[a-f0-9]{64}$/),
    operation: z.enum(['take', 'take-all', 'put']),
    rowId: z.string().min(1).max(180).optional(),
    quantity: z.number().finite().positive().max(1000000).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.operation !== 'take-all' && (!v.rowId || v.quantity === undefined))
      ctx.addIssue({ code: 'custom', message: '须选择实际物品与数量' })
  })
export type ContainerAction = z.infer<typeof containerActionSchema>
export interface ContainerRow {
  id: string
  itemId: string
  name: string
  quantity: number
  tag: string
  reason?: string
  coins?: boolean
}
export interface PointContainerView {
  sceneId: string
  pointId: string
  characterId: string
  name: string
  characterName: string
  stamp: string
  items: ContainerRow[]
  inventory: ContainerRow[]
  reviewRequired: boolean
}
