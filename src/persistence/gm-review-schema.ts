import { z } from 'zod'
import { practicalPolicySchema } from './practical-review-schema'
export const pointReviewSchema = z
  .object({
    enabled: z.boolean(),
    method: z.enum(['program', 'model']),
    successText: z.string().trim().min(1).max(1000),
    failureText: z.string().trim().min(1).max(1000),
  })
  .strict()
export const reviewSettingsSchema = z
  .object({
    mode: z.enum(['human', 'shadow', 'assisted']),
    paused: z.boolean(),
    fixedInteractions: z.boolean(),
    npcDialogue: z.boolean().optional(),
    narration: z.boolean().optional(),
    modelRef: z.string().max(80),
    maxConcurrent: z.number().int().min(1).max(3),
    queueLimit: z.number().int().min(1).max(50),
    timeoutSeconds: z.number().int().min(5).max(180),
    revision: z.number().int().min(0),
    practical: practicalPolicySchema.optional(),
  })
  .strict()
export const reviewOutputSchema = z
  .object({
    decision: z.enum(['pass', 'escalate', 'reject']),
    policyId: z.literal('conservative-exploration/1'),
    evidenceIds: z.array(z.string().max(80)).max(10),
    reason: z.string().min(1).max(1000),
    missingFacts: z.array(z.string().max(200)).max(10),
  })
  .strict()
export type PointReview = z.infer<typeof pointReviewSchema>
export type ReviewSettings = z.infer<typeof reviewSettingsSchema>
export type ReviewOutput = z.infer<typeof reviewOutputSchema>
