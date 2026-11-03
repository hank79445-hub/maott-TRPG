import { z } from 'zod'
import { SKILLS } from '../core/types'
const id = z.string().min(1).max(120),
  xy = z
    .object({ x: z.number().int().min(0).max(100), y: z.number().int().min(0).max(100) })
    .strict()
export const pointDiscoverySchema = z
  .object({
    method: z.enum(['proximity', 'gm', 'linked']),
    range: z.number().min(0).max(300).default(20),
    skill: z
      .string()
      .refine((k) => k in SKILLS, '未知发现技能')
      .default('perception'),
    dc: z.number().int().min(1).max(100).default(10),
  })
  .strict()
export const discoveryAttemptSchema = z
  .object({
    id,
    pointId: id,
    characterId: id,
    tokenId: id,
    branchId: id,
    status: z.enum(['pending', 'success', 'failure', 'canceled']),
    at: z.string().datetime(),
    total: z.number().finite().optional(),
  })
  .strict()
export const pausedRouteSchema = z
  .object({
    id,
    tokenId: id,
    characterId: id,
    branchId: id,
    start: xy,
    path: z.array(xy).min(1).max(160),
    reactionsConfirmed: z.boolean(),
  })
  .strict()
export type DiscoveryAttempt = z.infer<typeof discoveryAttemptSchema>
export type PausedRoute = z.infer<typeof pausedRouteSchema>
