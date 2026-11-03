import { z } from 'zod'
const id = z.string().min(1).max(120),
  units = z.number().int().min(0).max(100000000),
  note = z.string().min(1).max(2000)
export const supplyPointSchema = z
  .object({
    x: z.number().finite().min(0).max(79),
    y: z.number().finite().min(0).max(79),
    height: z.number().finite().min(-10000).max(10000),
  })
  .strict()
export const supplyContainerSchema = z
  .object({
    id,
    name: z.string().min(1).max(200),
    sceneId: id,
    objectId: id.optional(),
    instanceId: id.optional(),
    ownerId: id.optional(),
    groundItemId: id.optional(),
    open: z.boolean(),
    waterCapacity: units,
    foodCapacity: units,
    hidden: z.boolean().default(false),
  })
  .strict()
  .refine((c) => !!c.objectId !== !!c.instanceId, '容器须绑定一个真实物件或单件库存')
export const supplyBatchSchema = z
  .object({
    id,
    castId: id,
    clockSourceId: id,
    kind: z.enum(['water', 'food']),
    layer: z.enum(['material', 'ethereal', 'pocket', 'stone']).optional(),
    units,
    sceneId: id,
    containerId: id.optional(),
    point: supplyPointSchema.optional(),
    liquidId: id.optional(),
    pileId: id.optional(),
    createdHour: z.number().finite().min(0),
    spoilsAt: z.number().finite().min(0).optional(),
    rotten: z.boolean().default(false),
    appearance: z.string().max(200),
    origin: z.enum(['spell', 'scenario']),
    hidden: z.boolean().default(false),
  })
  .strict()
  .refine((b) => !!b.containerId !== !!b.point, '批次须位于真实容器或地面')
export const sceneSuppliesSchema = z
  .object({
    containers: z.array(supplyContainerSchema).max(1000).default([]),
    batches: z.array(supplyBatchSchema).max(5000).default([]),
    receipts: z
      .array(
        z
          .object({
            id,
            kind: z.string().max(40),
            batchId: id.optional(),
            actorId: id.optional(),
            units,
            at: z.number().finite().min(0),
          })
          .strict(),
      )
      .max(10000)
      .default([]),
  })
  .strict()
export const supplyCastSchema = z
  .object({
    branch: z.enum(['create-water', 'destroy-water', 'rain', 'clear-fog', 'food']),
    containerId: id.optional(),
    foodContainerId: id.optional(),
    waterUnits: units.optional(),
    appearance: z.string().max(200).default('朴素而营养丰富的食物'),
  })
  .strict()
export const supplyActions = [
  z
    .object({ operation: z.literal('supply-container'), container: supplyContainerSchema, note })
    .strict(),
  z
    .object({
      operation: z.literal('supply-seed'),
      containerId: id,
      kind: z.enum(['water', 'food']),
      units: units.positive(),
      note,
    })
    .strict(),
  z
    .object({
      operation: z.literal('supply-transfer'),
      batchId: id,
      containerId: id,
      actorId: id,
      units: units.positive(),
      receipt: id,
      note,
    })
    .strict(),
  z
    .object({
      operation: z.literal('supply-consume'),
      batchId: id,
      actorId: id,
      units: units.positive(),
      receipt: id,
      note,
    })
    .strict(),
] as const
export type SupplyContainer = z.infer<typeof supplyContainerSchema>
export type SupplyBatch = z.infer<typeof supplyBatchSchema>
export type SupplyCast = z.infer<typeof supplyCastSchema>
