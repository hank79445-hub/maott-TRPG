import { z } from 'zod'
const num = z.number().finite(),
  int = num.int()
export const areaTemplateSchema = z
  .object({
    x: int.min(0).max(79),
    y: int.min(0).max(79),
    shape: z.enum(['circle', 'cone', 'line', 'square', 'sphere', 'cube', 'cylinder', 'emanation']),
    size: num.min(1).max(1000),
    angle: num.min(-360).max(360),
    width: num.min(1).max(1000),
    origin: z
      .object({ x: num.min(0).max(80), y: num.min(0).max(80) })
      .strict()
      .optional(),
    originSpan: int.min(1).max(4).optional(),
    includeOrigin: z.boolean().optional(),
    originRule: z.enum(['face', 'center']).optional(),
    propagation: z.enum(['straight', 'manual']).optional(),
    note: z.string().max(2000).optional(),
  })
  .strict()
