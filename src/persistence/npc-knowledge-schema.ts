import { z } from 'zod'
const id = z
    .string()
    .min(1)
    .max(160)
    .refine((v) => !['__proto__', 'prototype', 'constructor'].includes(v), '编号为保留字'),
  text = z.string().max(4000),
  score = z.number().int().min(-100).max(100)
export const reputationPolicySchema = z
  .object({
    id,
    sceneId: id,
    pointId: id,
    outcome: z.enum(['success', 'failure']),
    contribution: score,
    automatic: z.boolean(),
    attribution:z.enum(['party','proxy','world']).optional(),
    proxyNpcIds:z.array(id).max(100).optional(),
    reason: text.min(1),
  })
  .strict()
export const factionSchema = z
  .object({
    practical:z.object({enabled:z.boolean(),allowAttackAdjudication:z.boolean(),min:z.number().int().min(-100).max(0),max:z.number().int().min(0).max(100)}).strict().optional(),
    id,
    name: z.string().min(1).max(120),
    description: text,
    hidden: z.boolean(),
    initialScore: score,
    policies: z.array(reputationPolicySchema).max(100).optional(),
  })
  .strict()
export const knowledgeTemplateSchema = z
  .object({
    id,
    name: z.string().min(1).max(120),
    version: z.number().int().positive(),
    layer: z.enum([
      'world',
      'region',
      'culture',
      'upbringing',
      'profession',
      'organization',
      'script',
      'gm',
    ]),
    visibility: z.enum(['public', 'private']),
    text: text.min(1),
  })
  .strict()
export const npcKnowledgeDesignSchema = z
  .object({
    factions: z.array(factionSchema).max(100),
    templates: z.array(knowledgeTemplateSchema).max(200),
  })
  .strict()
export const npcKnowledgeProfileSchema = z
  .object({
    enabled: z.boolean(),
    factionId: id.nullable(),
    membership: z.enum(['direct', 'associated']),
    hiddenMembership: z.boolean(),
    backgroundBias: score,
    lockedAttitude: z.enum(['friendly', 'indifferent', 'hostile']).nullable(),
    lockReason: text,
    templateIds: z.array(id).max(30),
  })
  .strict()
export const memoryConfigSchema = z
  .object({
    enabled: z.boolean(),
    provider: z.enum(['native', 'mem0']),
    embeddingModelRef: z.string().max(80),
    extractorModelRef: z.string().max(80),
    dimension: z.number().int().min(1).max(8192),
  })
  .strict()
export const memoryRecordSchema = z
  .object({
    id,
    npcId: id,
    epoch: id,
    sequence: z.number().int().nonnegative(),
    sourceId: id,
    sourceKind: z.enum(['event', 'dialogue', 'relationship', 'manual']),
    kind: z.enum(['fact', 'statement', 'opinion', 'knowledge']),
    text: text.min(1),
    reply: text.optional(),
    visibility: z.enum(['public', 'personal', 'private']),
    characterId: id.nullable(),
    at: z.string(),
    importance: z.enum(['routine', 'major']),
    basis: z.enum(['witness', 'told', 'published', 'gm']),
    dependencies: z.array(id).max(100),
  })
  .strict()
export const reputationRequestSchema = z
  .object({
    id,
    factionId: id,
    eventGroupId: id,
    sourceIds: z.array(id).min(1).max(100),
    actorId: id.nullable(),
    reason: text.min(1),
    suggested: score,
    applied: score,
    status: z.enum(['pending', 'attribution', 'applied', 'rejected']),
    attributed: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
export const memoryStateSchema = z
  .object({
    version: z.literal(1),
    epoch: id,
    sequence: z.number().int().nonnegative(),
    ancestors: z
      .array(z.object({ epoch: id, upto: z.number().int().nonnegative() }).strict())
      .max(1000),
    outbox: z.array(memoryRecordSchema).max(10000),
    archiveSegments: z.array(z.array(memoryRecordSchema).max(500)).optional(),
    indexGeneration: id.optional(),
    probeRequested: z.boolean().optional(),
    consolidationRun: z
      .object({ id, epoch: id, status: z.enum(['running', 'interrupted']) })
      .strict()
      .optional(),
    providerVerified: z
      .object({
        ref: z.string().max(80),
        revision: z.number().int().nonnegative(),
        dimension: z.number().int().positive(),
        at: z.string(),
      })
      .strict()
      .optional(),
    summaryWatermarks: z.record(id, z.number().int().nonnegative()).optional(),
    removedIds: z.array(id).max(10000),
    reputations: z.record(id, score),
    requests: z.array(reputationRequestSchema).max(2000),
    revision: z.number().int().nonnegative(),
    status: z.string().max(1000),
  })
  .strict()
export const knowledgeCommandSchema = z
  .object({
    kind: z.literal('npc-knowledge'),
    operation: z.discriminatedUnion('type', [
      z
        .object({
          type: z.literal('configure'),
          config: memoryConfigSchema,
          confirm: z.literal(true),
        })
        .strict(),
      z
        .object({
          type: z.literal('design'),
          design: npcKnowledgeDesignSchema,
          confirm: z.literal(true),
        })
        .strict(),
      z
        .object({
          type: z.literal('profile'),
          npcId: id,
          profile: npcKnowledgeProfileSchema,
          confirm: z.literal(true),
        })
        .strict(),
      z
        .object({
          type: z.literal('reputation'),
          requestId: id,
          approve: z.boolean(),
          attributed: z.boolean(),
          contribution: score,
          reason: text.min(1),
          revision: z.number().int().nonnegative(),
        })
        .strict(),
      z
        .object({
          type: z.literal('propose'),
          factionId: id,
          eventGroupId: id,
          sourceIds: z.array(id).min(1).max(100),
          contribution: score,
          attributed: z.boolean(),
          reason: text.min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal('inspect'),
          npcId: id,
          characterId: id.nullable(),
          page: z.number().int().min(0).max(10000),
        })
        .strict(),
      z
        .object({
          type: z.literal('forget'),
          npcId: id,
          ids: z.array(id).min(1).max(100),
          reason: text.min(1),
        })
        .strict(),
      z.object({ type: z.literal('reindex') }).strict(),
      z.object({ type: z.literal('probe') }).strict(),
    ]),
  })
  .strict()
export type KnowledgeRecord = z.infer<typeof memoryRecordSchema>
export type KnowledgeState = z.infer<typeof memoryStateSchema>
export type KnowledgeDesign = z.infer<typeof npcKnowledgeDesignSchema>
export type KnowledgeProfile = z.infer<typeof npcKnowledgeProfileSchema>
export type KnowledgeConfig = z.infer<typeof memoryConfigSchema>
export type KnowledgeCommand = z.infer<typeof knowledgeCommandSchema>
