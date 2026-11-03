import { questDesignSchema } from './script-design-schema'
import { z } from 'zod'
export const QUEST_LIMIT = 100
export const questStatus = z.enum(['inactive', 'active', 'completed', 'failed'])
const id = z.string().min(1).max(120)
export const questStepDefinitionSchema = z
  .object({
    id,
    title: z.string().min(1).max(120),
    description: z.string().max(2000).default(''),
    visibility: z.enum(['public', 'hidden']).default('hidden'),
    initialStatus: questStatus.default('inactive'),
    afterIds: z.array(id).max(100).default([]),
    sceneId: id.optional(),
    pointId: id.optional(),
    arrivalGroupId: id.optional(),
    trigger: z.enum(['point-success', 'scene-enter', 'arrival', 'battle-ended']).optional(),
    alternatives: z.string().max(2000).optional(),
    gmNote: z.string().max(2000).optional(),
    automatic:z.boolean().optional(),
    activateNext:z.boolean().optional(),
    attribution:z.enum(['party','proxy','world']).optional(),
    proxyNpcIds:z.array(id).max(100).optional(),
  })
  .strict()
export const questStepSchema = questStepDefinitionSchema
  .extend({ status: questStatus.optional() })
  .strict()
const suggestionSchema = z
  .object({
    id,
    stepId: id,
    eventId: id,
    branchId: id,
    status: z.enum(['pending', 'approved', 'dismissed']),
  })
  .strict()
export const questDefinitionSchema = z
  .object({
    gmDesign: questDesignSchema.optional(),
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(120),
    chapter: z.string().max(120).default(''),
    description: z.string().max(2000).default(''),
    initialStatus: questStatus.default('inactive'),
    visibility: z.enum(['public', 'personal', 'hidden']).default('public'),
    characterIds: z.array(z.string().min(1).max(120)).max(100).default([]),
    sceneId: z.string().min(1).max(120).nullable().default(null),
    pointId: z.string().min(1).max(120).nullable().default(null),
    main: z.boolean().default(false),
    current: z.boolean().default(false),
    steps: z.array(questStepDefinitionSchema).max(100).optional(),
    pinnedStepId: id.optional(),
  })
  .strict()
export const questSchema = questDefinitionSchema
  .extend({
    status: questStatus.optional(),
    steps: z.array(questStepSchema).max(100).optional(),
    stepSuggestions: z.array(suggestionSchema).max(500).optional(),
  })
  .strict()
export type QuestDefinition = z.infer<typeof questDefinitionSchema>
export type Quest = z.infer<typeof questSchema>
