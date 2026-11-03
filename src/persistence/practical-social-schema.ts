import { z } from 'zod'
const id = z.string().min(1).max(120)
export const socialSkillSchema = z.enum(['persuasion','deception','intimidation','performance','animal-handling'])
export const socialOperationSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('follow'),join:z.boolean()}).strict(),
 z.object({kind:z.literal('interaction'),pointId:id,operation:z.enum(['use','toggle','check','claim'])}).strict(),
 z.object({kind:z.literal('battle-support'),presetId:id}).strict(),
 z.object({kind:z.literal('trade-offer'),itemId:id,quantity:z.number().int().min(1).max(1000)}).strict(),
])
const consequence = z.object({ text:z.string().min(1).max(1200), revealIds:z.array(id).max(20).default([]), promise:z.string().max(500).default(''),operations:z.array(socialOperationSchema).max(4).refine(ops=>new Set(ops.map(o=>o.kind)).size===ops.length,'同一结果每类后果最多一项').optional() }).strict()
export const practicalSocialRuleSchema=z.object({id,goal:z.string().min(1).max(500),willingness:z.enum(['willing','unwilling','hesitant','judge']),skill:socialSkillSchema,dc:z.number().int().min(1).max(100).optional(),cost:z.enum(['none','action']),success:consequence,failure:consequence}).strict()
export const practicalSocialPolicySchema = z.object({ enabled:z.boolean(), rules:z.array(practicalSocialRuleSchema).max(30) }).strict()
export const socialDecisionOutputSchema = z.object({
  decision:z.enum(['willing','unwilling','hesitant','escalate']), ruleId:id.nullable(),
  skill:socialSkillSchema, dc:z.number().int().min(1).max(100).nullable(),
  sameRequestAs:id.nullable(), materialChange:z.boolean(), reason:z.string().min(1).max(1200),
}).strict()
export const socialDecisionSchema = z.object({
  status:z.enum(['queued','decided','waiting-dice','completed','needs-gm']),
  fingerprint:z.string().max(64), taskId:id, output:socialDecisionOutputSchema.optional(),
  rule:practicalSocialRuleSchema.optional(), resultApplied:z.boolean().default(false),
}).strict()
export type SocialDecision = z.infer<typeof socialDecisionSchema>
