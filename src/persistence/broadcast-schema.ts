import {localizedMessageSchema} from '../shared/localization/system-messages'
import { BROADCAST_LIMIT } from '../core/configuration-limits'
import { z } from 'zod'
import { BROADCAST_CATEGORIES } from '../core/broadcast-types'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s))
const seq = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const broadcastAudienceSchema = z
  .object({
    kind: z.enum(['public', 'party', 'personal', 'gm']),
    characterIds: z.array(id).max(100),
  })
  .strict()
  .refine((a) => a.kind !== 'personal' || a.characterIds.length > 0, '个人广播需要接收角色')
export const broadcastTemplateSchema = z
  .object({
    id,
    title: z.string().min(1).max(120),
    text: z.string().min(1).max(4000),
    enabled: z.boolean(),
    narration: z.enum(['direct', 'generate', 'context']).optional(),
    trigger: z.enum(['manual', 'story', 'scene', 'point', 'region', 'wall', 'event']),
    eventType: z.string().min(1).max(120).optional(),
    result: z.enum(['any', 'success', 'failure']).optional(),
    sceneId: id.nullable(),
    targetId: id.nullable(),
    policy: z.enum(['manual', 'once', 'always', 'cooldown']),
    cooldownSeconds: seq.max(86400),
    audience: broadcastAudienceSchema,
  })
  .strict()
export const broadcastSettingsSchema = z
  .object({
    templates: z.array(broadcastTemplateSchema).max(BROADCAST_LIMIT),
    played: z
      .array(z.object({ templateId: id, count: seq, lastAt: z.string().datetime() }).strict())
      .max(BROADCAST_LIMIT),
    storyStarted: z.boolean(),
  })
  .strict()
export const broadcastEventSchema = z
  .object({
    fogKnowledge:z.object({witnesses:z.array(id).max(200),names:z.array(z.object({name:z.string().max(200),aliases:z.array(id).max(4),knownTo:z.array(id).max(200)}).strict()).max(200)}).strict().optional(),
    message:localizedMessageSchema.optional(),
    perceivedBy: z.array(id).max(500).optional(),
    npcWitnesses: z.array(z.object({npcId:id,entityIds:z.array(id).max(40)}).strict()).max(500).optional(),
    version: z.literal(1),
    narration: z.enum(['direct', 'generate', 'context']).optional(),
    id,
    roomId: id.nullable(),
    branchId: id,
    sequence: seq.min(1),
    actionId: id,
    causeId: id.nullable(),
    worldRevision: seq,
    at: z.string().datetime(),
    category: z.enum(BROADCAST_CATEGORIES),
    type: z.string().min(1).max(120),
    phase: z.enum(['confirmed', 'pending', 'correction']),
    sceneId: id.nullable(),
    title: z.string().min(1).max(120),
    text: z.string().max(6000),
    facts: z
      .record(id, z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()]))
      .refine((x) => Object.keys(x).length <= 50),
    audience: broadcastAudienceSchema,
    supersedes: z.array(id).max(5000),
  })
  .strict()
export const broadcastJournalSchema = z
  .object({
    version: z.literal(1),
    branchId: id,
    nextSequence: seq.min(1),
    events: z.array(broadcastEventSchema).max(5000),
  })
  .strict()
  .superRefine((j, ctx) => {
    if (
      new Set(j.events.map((e) => e.id)).size !== j.events.length ||
      j.events.some(
        (e, i) =>
          e.sequence >= j.nextSequence || (i > 0 && e.sequence <= j.events[i - 1]!.sequence),
      )
    )
      ctx.addIssue({ code: 'custom', message: '广播序列或 ID 不一致' })
  })
