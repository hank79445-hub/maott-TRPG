import { z } from 'zod'
import { spatialProposalSchema } from './npc-spatial-schema'
const id = z.string().min(1).max(120)
export const spatialToolSchemas = {
  observe: z.object({}).strict(),
  capabilities: z.object({ abilityId: id.optional() }).strict(),
  route: z
    .object({
      destination: z
        .object({ x: z.number().int().min(0).max(79), y: z.number().int().min(0).max(79) })
        .strict(),
    })
    .strict(),
  propose: z
    .object({
      observation: z.string().min(1).max(64),
      receipt: id,
      proposal: spatialProposalSchema,
    })
    .strict(),
  task: z
    .object({
      taskId: id.optional(),
      operation: z.enum(['read', 'pause', 'cancel']).default('read'),
    })
    .strict(),
  events: z.object({ after: z.number().int().nonnegative().default(0) }).strict(),
}
export type SpatialToolName = keyof typeof spatialToolSchemas
export const spatialToolRequestSchema = z
  .object({
    branchId: id,
    npcId: id,
    tool: z.enum(['observe', 'capabilities', 'route', 'propose', 'task', 'events']),
    args: z.record(z.string(), z.unknown()),
  })
  .strict()
