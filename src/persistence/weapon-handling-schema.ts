import { z } from 'zod'
export const weaponHandlingOperationSchema = z
  .object({
    type: z.literal('equip'),
    instanceId: z.string().min(1).max(120),
    equipped: z.boolean(),
    slot: z.enum(['main-hand', 'off-hand']).optional(),
    grip: z.enum(['one-handed', 'two-handed']).optional(),
    takeOut: z.boolean().optional(),
  })
  .strict()
export const weaponHandlingSchema = z
  .object({
    before: z.array(weaponHandlingOperationSchema).max(2),
    after: z.array(weaponHandlingOperationSchema).max(2),
  })
  .strict()
