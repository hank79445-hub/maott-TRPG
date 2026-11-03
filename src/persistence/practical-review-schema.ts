import {localeSchema} from '../shared/localization/locale'
import { z } from 'zod'
import { practicalWindowSchema } from './practical-window-schema'
import {practicalInitiativeSchema} from './practical-initiative-schema'
import {practicalCastingSchema,practicalConsentSchema} from './practical-casting-schema'
import {practicalReinforcementSchema} from './practical-reinforcement-schema'

export const PRACTICAL_DOMAINS = ['text', 'social', 'combat', 'exploration', 'spells', 'knowledge', 'trade'] as const
export const practicalPolicySchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  text: z.boolean(), social: z.boolean(), combat: z.boolean(), exploration: z.boolean(),
  spells: z.boolean(), knowledge: z.boolean(), trade: z.boolean(),
  responseSeconds: z.number().int().min(5).max(300),
  maxRepairs: z.number().int().min(0).max(2),
  npcResources: z.enum(['conservative', 'balanced', 'aggressive']),
  npcAcceptAlert:z.boolean().optional(),
  sellDiscountPercent: z.number().int().min(0).max(50),
  buyIncreasePercent: z.number().int().min(0).max(50),
}).strict()

export const recommendedPracticalPolicy = () => practicalPolicySchema.parse({
  version: 1, enabled: true, text: true, social: true, combat: true, exploration: true,
  spells: true, knowledge: true, trade: true, responseSeconds: 30, maxRepairs: 2,
  npcResources: 'balanced',npcAcceptAlert:true, sellDiscountPercent: 10, buyIncreasePercent: 10,
})

const id = z.string().min(1).max(200)
export const practicalTaskStatusSchema = z.enum([
  'pending', 'waiting-model', 'waiting-player', 'waiting-dice', 'needs-fact', 'needs-gm',
  'ready', 'committed', 'rejected', 'canceled', 'stale', 'paused',
])
export const practicalTaskSchema = z.object({
  outputLocale:localeSchema.optional(),languagePolicyVersion:z.number().int().positive().optional(),
  id, key: z.string().min(1).max(500), branchId: id,
  domain: z.enum(PRACTICAL_DOMAINS), sourceId: id, phase: z.string().min(1).max(80),
  label: z.string().max(200), status: practicalTaskStatusSchema,
  basis: z.enum(['rule', 'script', 'model', 'player', 'npc-policy']),
  policyRevision: z.number().int().nonnegative(),
  fingerprint: z.string().max(128), participantIds: z.array(id).max(100),
  reason: z.string().max(1500), publicReason: z.string().max(500),
  receipts: z.array(id).max(300), repairs: z.number().int().min(0).max(2),
  calls: z.object({ generation: z.number().int().nonnegative(), adjudication: z.number().int().nonnegative(), repair: z.number().int().nonnegative(), summary: z.number().int().nonnegative() }).strict(),
  reportedTokens: z.number().int().nonnegative().nullable(),
  at: z.number().finite(), updatedAt: z.number().finite(),
  deadlineAt: z.number().finite().optional(), remainingMs: z.number().finite().nonnegative().optional(),
  lastSeenAt:z.number().finite().optional(),
  resumeStatus: practicalTaskStatusSchema.optional(),
  resumeReason:z.string().max(1500).optional(),
  context:z.object({type:z.enum(['battle-entry','reputation-attribution']),requestId:id,npcId:id.optional()}).strict().optional(),
  decision:z.discriminatedUnion('kind',[
    z.object({kind:z.literal('battle-entry'),join:z.boolean(),side:z.enum(['party','enemy','neutral'])}).strict(),
    z.object({kind:z.literal('reputation'),apply:z.boolean(),contribution:z.number().int().min(-100).max(100)}).strict(),
  ]).optional(),
}).strict()
export const practicalStateSchema = z.object({ version: z.literal(1), tasks: z.array(practicalTaskSchema).max(1000), windows:z.array(practicalWindowSchema).max(200).default([]),initiatives:z.array(practicalInitiativeSchema).max(100).default([]),castings:z.array(practicalCastingSchema).max(200).default([]),consents:z.array(practicalConsentSchema).max(1000).default([]),reinforcements:z.array(practicalReinforcementSchema).max(100).default([]),combatNeedsAdvance:z.boolean().default(false) }).strict()
export type PracticalPolicy = z.infer<typeof practicalPolicySchema>
export type PracticalDomain = typeof PRACTICAL_DOMAINS[number]
export type PracticalTask = z.infer<typeof practicalTaskSchema>
export type PracticalState = z.infer<typeof practicalStateSchema>
