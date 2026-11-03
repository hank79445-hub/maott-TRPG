import { z } from 'zod'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s))
const xy = { x: z.number().int().min(0).max(79), y: z.number().int().min(0).max(79) }
export const spatialExitSchema = z.object({ sceneId: id, pointId: id }).strict()
export const npcSpatialPolicySchema = z
  .object({
    enabled: z.boolean(),
    compactInput: z.boolean(),
    autoMove: z.boolean(),
    autoPlan: z.boolean().default(false),
    plansPerScene: z.number().int().min(1).max(6).default(3),
    maxSteps: z.number().int().min(1).max(24),
    goal: z.string().max(500),
    knownExits: z.array(spatialExitSchema).max(40),
    independentTravel: z.boolean(),
    practical: z.object({enabled:z.boolean(),pointIds:z.array(id).max(200),operations:z.array(z.enum(['use','toggle','check','claim'])).max(4),travel:z.boolean(),itemLimits:z.array(z.object({itemId:id,quantity:z.number().int().min(1).max(1000)}).strict()).max(100),resourceLimits:z.array(z.object({id,amount:z.number().int().min(1).max(100)}).strict()).max(100)}).strict().optional(),
  })
  .strict()
export const spatialProposalSchema = z
  .object({
    kind: z.enum(['move', 'interact', 'travel']),
    destination: z.object(xy).strict().optional(),
    pointId: id.optional(),
    operation: z.enum(['use', 'toggle', 'check', 'claim']).optional(),
    itemIds: z.array(id).max(20).optional(),
    confirmItemCosts: z.boolean().optional(),
    detail: z.string().max(500).optional(),
  })
  .strict()
export const npcSpatialTaskSchema = z
  .object({
    id,
    npcId: id,
    branchId: id,
    sceneId: id,
    profileRevision: z.number().int().nonnegative(),
    receipt: id,
    fingerprint: z.string().max(64),
    observation: z.string().max(64),
    proposal: spatialProposalSchema,
    outcome: z
      .object({
        success: z.boolean().optional(),
        pointId: id.optional(),
        state: z.string().max(40).optional(),
        sceneId: id.optional(),
      })
      .strict()
      .optional(),
    status: z.enum(['review', 'ready', 'paused', 'completed', 'canceled']),
    approved: z.boolean(),
    reason: z.string().max(500),
    origin: z.object(xy).strict(),
    current: z.object(xy).strict(),
    steps: z.number().int().nonnegative(),
    spentFeet: z.number().nonnegative(),
    maxFeet: z.number().nonnegative(),
  })
  .strict()
const seen = z
  .object({
    npcId: id,
    sceneId: id,
    id,
    kind: z.enum(['unit', 'point']),
    name: z.string().max(200),
    ...xy,
    at: z.number().int().nonnegative(),
  })
  .strict()
export const npcSpatialStateSchema = z
  .object({
    reportNpcId: id.optional(),
    decisions: z
      .array(
        z
          .object({
            npcId: id,
            sceneId: id,
            count: z.number().int().nonnegative(),
            version: z.string().max(64),
          })
          .strict(),
      )
      .max(500)
      .optional(),
    branchId: id,
    nextSequence: z.number().int().positive(),
    seen: z.array(seen).max(4000),
    tasks: z.array(npcSpatialTaskSchema).max(100),
    events: z
      .array(
        z
          .object({
            sequence: z.number().int().positive(),
            npcId: id,
            version: z.string().max(64),
            sceneId: id,
          })
          .strict(),
      )
      .max(300),
  })
  .strict()
export const npcSpatialCommandSchema = z.discriminatedUnion('operation', [
  z
    .object({ operation: z.literal('configure'), npcId: id, policy: npcSpatialPolicySchema })
    .strict(),
  z.object({ operation: z.literal('observe'), npcId: id }).strict(),
  z
    .object({
      operation: z.literal('propose'),
      npcId: id,
      observation: z.string().min(1).max(64),
      receipt: id,
      proposal: spatialProposalSchema,
    })
    .strict(),
  z
    .object({ operation: z.enum(['approve', 'advance', 'pause', 'resume', 'cancel']), taskId: id })
    .strict(),
  z.object({ operation: z.literal('plan'), npcId: id }).strict(),
  z.object({ operation: z.literal('cancel-plan'), jobId: id }).strict(),
])
export type NpcSpatialPolicy = z.infer<typeof npcSpatialPolicySchema>
export type NpcSpatialTask = z.infer<typeof npcSpatialTaskSchema>
export type NpcSpatialState = z.infer<typeof npcSpatialStateSchema>
export type SpatialProposal = z.infer<typeof spatialProposalSchema>
export type NpcSpatialCommand = z.infer<typeof npcSpatialCommandSchema>
export const defaultSpatialPolicy = (): NpcSpatialPolicy => ({
  enabled: false,
  compactInput: true,
  autoMove: false,
  autoPlan: false,
  plansPerScene: 3,
  maxSteps: 12,
  goal: '',
  knownExits: [],
  independentTravel: false,
})
