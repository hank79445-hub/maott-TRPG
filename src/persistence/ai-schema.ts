import {localeSchema,localizedTextSchema} from '../shared/localization/locale'
import {modelContractReportSchema,planningDialogueSchema} from './model-contract-schema'
import { practicalSocialPolicySchema, socialDecisionSchema } from './practical-social-schema'
import { npcSpatialPolicySchema, npcSpatialStateSchema } from './npc-spatial-schema'
import {textStyleSettingsSchema,textStyleSnapshotSchema,textStyleReportSchema} from './model-text-style-schema'
import { npcDesignSchema } from './script-design-schema'
import { NPC_LIMIT } from '../core/configuration-limits'
import { z } from 'zod'
import { npcPersonaSchema } from './npc-persona-schema'
import { narrationSkillSchema } from './narration-skill-schema'
import {
  NPC_BEHAVIORS,
  NPC_ACTIVITY_EVENTS,
  NPC_RESPONSE_TYPES,
  DIALOGUE_CATEGORIES,
} from '../core/ai-types'
import { DAMAGE_TYPES } from '../core/combat-types'
import { npcSchema } from './combat-schema'
import {npcKnowledgeProfileSchema,npcKnowledgeDesignSchema,memoryStateSchema,memoryConfigSchema} from './npc-knowledge-schema'
import { npcTemplateMetadataSchema } from './npc-template-schema'
import { broadcastAudienceSchema, broadcastEventSchema } from './broadcast-schema'
import { PORTRAIT_MAX_LENGTH, PORTRAIT_PATTERN } from '../core/types'
const portrait = z.string().max(PORTRAIT_MAX_LENGTH).regex(PORTRAIT_PATTERN).nullable().optional()
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'prototype', 'constructor'].includes(s))
const text = z.string().max(2000),
  int = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const categories = z
  .array(z.enum(DIALOGUE_CATEGORIES))
  .max(4)
  .refine((a) => new Set(a).size === a.length, '类别不可重复')
const dialogueCategory = z.enum([
  ...DIALOGUE_CATEGORIES,
  'influence',
  'secret',
  'transaction',
  'commitment',
  'action',
  'unknown',
])
const dialogueReviewRecord = z
  .object({
    contractVersion: int.optional(),
    generationDurationMs: z.number().nonnegative().optional(),
    audit: z
      .object({
        status: z.enum(['queued', 'running', 'passed', 'escalated', 'suggested']),
        stamp: z.string().max(80),
        reason: text,
        calls: int,
        model: z.string().max(200).optional(),
        durationMs: z.number().nonnegative().optional(),
        tokens: z.number().nonnegative().nullable().optional(),
      })
      .strict()
      .optional(),
    publicInput: z.boolean(),
    policyStamp: z.string().max(80),
    stage: z.enum(['candidate', 'adjudication', 'proofread', 'automatic', 'manual', 'failed']),
    category: dialogueCategory.optional(),
    sourceIds: z.array(z.string().min(1).max(200)).max(100),
    citedIds: z.array(z.string().min(1).max(200)).max(100),
    reason: text,
  })
  .strict()
export const aiSettingsSchema = z
  .object({
    textStyle:textStyleSettingsSchema.optional(),
    narrationSkills: z
      .array(narrationSkillSchema)
      .max(30)
      .refine((a) => new Set(a.map((s) => s.id)).size === a.length, 'Skill ID重复')
      .optional(),
    defaultNarrationSkill: id.nullable().optional(),
    sceneNarrationSkills: z.record(id, id).optional(),
    qqDialogueReview: z
      .object({
        enabled: z.boolean(),
        paused: z.boolean(),
        categories,
        revision: int.optional(),
        policyVersion: int.optional(),
      })
      .strict()
      .optional(),
    narrationModelRef: z.string().max(80).optional(),
    npcModelRef: z.string().max(80).optional(),
    activitySpeakers: int.min(1).max(2).optional(),
    npcPortrait: portrait,
    enabled: z.boolean(),
    mode: z.enum(['turn', 'action', 'manual']),
    autoPublish: z.boolean(),
    narrationDirectPublish: z.boolean().optional(),
    privateNarration: z.boolean(),
    style: text,
    background: text.default(''),
    language: z.string().min(1).max(80),
    contentLocale: localeSchema.optional(),
    maxCharacters: int.min(80).max(2000),
    includeNumbers: z.boolean(),
    requestsPerHour: int.min(1).nullable().default(null).transform(():number|null => null),
    tokensPerHour: int.positive().nullable(),
  })
  .strict()
export const npcDirectiveSchema = z
  .object({
    pointId: id.optional(),
    operation: z.enum(['use','toggle','check','claim']).optional(),
    itemIds: z.array(id).max(20).optional(),
    confirmItemCosts: z.boolean().optional(),
    summon:z.object({form:id,materialId:z.string().max(120),corpseIds:z.array(id).max(20).optional(),maintainIds:z.array(id).max(22).optional(),creatureType:z.enum(['celestial','fey','fiend']).optional()}).strict().optional(),
    angle:z.number().finite().min(0).max(360).optional(),
    actionCost: z.enum(['action', 'bonus']).optional(),
    kind: z.enum(['none', ...NPC_BEHAVIORS]),
    targetId: id.optional(),
    attackId: id.optional(),
    destination: z
      .object({ x: int.max(79), y: int.max(79) })
      .strict()
      .optional(),
    itemId: id.optional(),
    quantity: int.min(1).max(1000).optional(),
    priceGP: z.number().finite().min(0).max(100000).optional(),
    factId: id.optional(),
    detail: text.optional(),
    abilityId: id.optional(),
    targets: z.array(id).max(20).optional(),
    amount: int.min(1).max(10000).optional(),
    action: z.enum(['dash', 'disengage', 'dodge', 'help', 'ready', 'utilize', 'hide']).optional(),
    damageType: z.enum(DAMAGE_TYPES).optional(),
  })
  .strict()
const relationSchema = z
  .object({ characterId: id, score: z.number().int().min(-100).max(100), note: text })
  .strict()
const inputReportSchema = z
  .object({
    sections: z.array(z.object({key:z.string().max(80),bytes:int}).strict()).max(80).optional(),
    textStyle:textStyleReportSchema.optional(),
    eventSelections: z
      .array(
        z
          .object({ id, text: z.string().max(400), status: z.string().max(30), reason: text })
          .strict(),
      )
      .max(80)
      .optional(),
    estimatedTokens: int,
    budget: int.nullable(),
    outputTokens: int.nullable(),
    selectedIds: z.array(id).max(2000),
    omittedIds: z.array(id).max(2000),
    preview: z.string().max(16000),
  })
  .strict()
export const npcProfileSchema = z
  .object({
    practicalSocial: practicalSocialPolicySchema.optional(),
    merchantPolicy: merchantPolicySchema.optional(),
    spatialPolicy: npcSpatialPolicySchema.optional(),
    knowledgeProfile:npcKnowledgeProfileSchema.optional(),
    persona: npcPersonaSchema.optional(),
            publicSpeechStyle: text.optional(),
    gmDesign: npcDesignSchema.optional(),
    importanceRole: z.enum(['resident', 'companion']).optional(),
    fixedReplies: z
      .array(z.object({ id, text: text.min(1), localized:localizedTextSchema.optional() }).strict())
      .max(30)
      .optional(),
    fixedReplyMode: z.enum(['end', 'loop']).optional(),
    fixedReplyEnd: text.optional(),
    fixedReplyEndLocales:localizedTextSchema.optional(),
    fixedReplyCursor: int.max(30).optional(),
    consumables: z
      .array(z.object({ id, itemId: id, quantity: int.min(1).max(999) }).strict())
      .max(30)
      .optional(),
    consumablesUsed: z.record(id, int.max(999)).optional(),
    arrivalOrigin: z
      .object({ sceneId: id, x: int.max(79), y: int.max(79) })
      .strict()
      .optional(),
    initiallyAbsent: z.boolean().optional(),
    appeared: z.boolean().optional(),
    initialMemories: z
      .array(
        z
          .object({
            id,
            text: text.min(1),
            visibility: z.enum(['public', 'personal', 'private']),
            characterId: id.nullable(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
    experiences: z
      .array(
        z
          .object({
            id,
            sourceId: id,
            importance: z.literal('major').optional(),
            knowledgeSource: z.enum(['witness', 'told']).optional(),
            branchId: id,
            sceneId: id.nullable(),
            at: z.string().datetime(),
            text,
            characterId: id.nullable(),
            visibility: z.enum(['public', 'personal']),
            pinned: z.boolean(),
            kind: z.enum(['event', 'relationship']),
          })
          .strict(),
      )
      .max(500)
      .optional(),
    experienceOmitted: int.optional(),
    affinityEnabled: z.boolean().optional(),
    initialRelations: z.array(relationSchema).max(100).optional(),
    relations: z.array(relationSchema).max(100).optional(),
    modelRef: z.string().max(80).optional(),
    portrait,
    illustration: portrait,
    turnHold: z
      .object({ encounterId: id, tick: int, state: z.enum(['paused', 'manual']) })
      .strict()
      .optional(),
    id,
    revision: int,
    turnMode: z.enum(['manual', 'automatic', 'plan', 'step']).default('manual'),
    followParty: z.boolean().default(false),
    tacticalInput: z.boolean().default(false),
    guardOrigin: z
      .object({ sceneId: id, x: int.max(79), y: int.max(79) })
      .strict()
      .optional(),
    templateId: id.optional(),
    npcType: z.enum(['ordinary', 'important']).default('important'),
    controller: z.enum(['gm', 'model']).default('model'),
    characterId: id.nullable().default(null),
    body: npcSchema.nullable().default(null),
    side: z.enum(['party', 'enemy', 'neutral']).default('enemy'),
    dialogue: z
      .array(
        z
          .object({
            id,
            when: z.enum([
              'default',
              'initial',
              'repeat',
              'success',
              'failure',
              'friendly',
              'hostile',
            ]),
            text: text.min(1),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    abilities: z
      .array(
        z
          .object({
            id,
            name: text.min(1),
            kind: z.enum(['spell', 'feature']),
            key: id,
            mode: z.string().max(80),
            enabled: z.boolean(),
            note: text,
          })
          .strict(),
      )
      .max(50)
      .default([]),
    combatPolicy: z
      .object({
        monsterAbilityIds: z.array(id).max(40).optional(),
        healPercent: int.min(0).max(100).optional(),
        strategy: z.enum(['nearest', 'guard', 'protect', 'ranged', 'retreat']),
        attackIds: z.array(id).max(8),
        guardRadius: int.max(300),
        protectCharacterId: id.nullable(),
        retreatPercent: int.max(100),
        planOnTurn: z.boolean(),
          resourceStrategy:z.enum(['conservative','balanced','aggressive']).optional(),
      })
      .strict()
      .default({
        strategy: 'nearest',
        attackIds: [],
        guardRadius: 10,
        protectCharacterId: null,
        retreatPercent: 25,
        planOnTurn: false,
      }),
    activity: z
      .object({
        scope: z.enum(['party', 'selected']).default('selected'),
        publishMode: z.enum(['review', 'ordinary']).optional(),
        templates: z
          .array(
            z
              .object({
                id,
                type: z.enum(NPC_RESPONSE_TYPES),
                enabled: z.boolean(),
                pointId: id.nullable(),
                sceneId: id.nullable(),
                outcome: z.enum(['any', 'success', 'failure']),
                thresholdPercent: int.min(1).max(100),
                tendency: text,
                priority: int.max(100),
                cooldownSeconds: int.max(86400),
              })
              .strict(),
          )
          .max(30)
          .optional(),
        enabled: z.boolean(),
        events: z.array(z.enum(NPC_ACTIVITY_EVENTS)).max(5),
        characterIds: z.array(id).max(100),
        range: int.max(300),
        cooldownSeconds: int.max(86400),
        maxPerScene: int.min(1).max(20),
        allowDuringCombat: z.boolean(),
      })
      .strict()
      .default({
        scope: 'selected',
        enabled: false,
        events: ['scene.enter'],
        characterIds: [],
        range: 30,
        cooldownSeconds: 300,
        maxPerScene: 3,
        allowDuringCombat: false,
      }),
    name: z.string().min(1).max(120),
    sceneId: id,
    actorId: id.nullable(),
    position: z.object({ x: int.max(79), y: int.max(79) }).strict(),
    hidden: z.boolean(),
    enabled: z.boolean(),
    description: text,
    personality: text,
    goals: text,
    strategy: text,
    knowledge: text,
    communication: z.enum(['auto', 'speaking', 'nonverbal']).optional(),
    secrets: z.array(z.object({ id, text: text.min(1) }).strict()).max(30),
    revealedIds: z.array(id).max(30),
    urgingCooldowns: z
      .array(
        z
          .object({
            characterId: id,
            key: z.string().max(2000),
            untilHours: z.number().finite().nonnegative(),
          })
          .strict(),
      )
      .max(100),
    privateNote: text,
    fallbackReply: text,
    attitude: z.enum(['friendly', 'indifferent', 'hostile']),
    behaviorState: z.enum(['none', 'fleeing', 'surrendered']).default('none'),
    publicKnowledgeOnly: z.boolean().optional(),
    dialogueReview: z
      .object({ mode: z.enum(['inherit', 'review', 'custom']), categories })
      .strict()
      .optional(),
    publicDialogue: text.optional(),
    publicKnowledge: z
      .array(z.object({ id, text: text.min(1) }).strict())
      .max(30)
      .refine((a) => new Set(a.map((r) => r.id)).size === a.length, '公开知识编号不可重复')
      .optional(),
    autoDialogue: z.boolean(),
    allowed: z.array(z.enum(NPC_BEHAVIORS)).max(NPC_BEHAVIORS.length),
    preauthorization: z
      .object({
        trade: z.boolean(),
        revealIds: z.array(id).max(30),
        characterIds: z.array(id).max(100),
        maxQuantity: int.min(1).max(1000),
        maxDiscountGP: z.number().finite().min(0).max(100000),
        maxValueGP: z.number().finite().min(0).max(100000),
        remaining: int.max(1000),
        expiresAt: z.string().datetime().nullable(),
      })
      .strict(),
    stock: z.array(merchantStockSchema).max(100),
    coins: z.number().finite().min(0).max(1000000),
    memory: z
      .array(
        z
          .object({
            id,
            at: z.string().datetime(),
            characterId: id,
            visibility: z.enum(['public', 'personal']),
            qqSessionId: id.optional(),
            branchId: id.optional(),
            player: text,
            reply: text,
          })
          .strict(),
      )
      .max(500),
  })
  .strict()
export const npcTemplateSchema = z
  .object({
    metadata: npcTemplateMetadataSchema.optional(),
    portrait,
    id,
    name: text.min(1),
    source: text,
    body: npcSchema,
    strategy: z.enum(['nearest', 'guard', 'protect', 'ranged', 'retreat']),
    notes: z.array(text).max(20),
  })
  .strict()
export const adventureAiSchema = z
  .object({
    spatialState: npcSpatialStateSchema.optional(),
    memoryConfig:memoryConfigSchema.optional(),
    knowledgeDesign:npcKnowledgeDesignSchema.optional(),
    knowledgeState:memoryStateSchema.optional(),
    settings: aiSettingsSchema,
    npcs: z.array(npcProfileSchema).max(NPC_LIMIT),
    templates: z.array(npcTemplateSchema).max(30).optional(),
  })
  .strict()
const common = {
  outputLocale: localeSchema.optional(),
  translationFallback: z.boolean().optional(),
  languagePolicyVersion: z.number().int().positive().optional(),
  modelContract:modelContractReportSchema.optional(),
  textStyle:textStyleSnapshotSchema.optional(),
  inputReport: inputReportSchema.optional(),
  modelIdentity: z.string().max(100).optional(),
  id,
  sequence: int.min(1),
  branchId: id,
  status: z.string(),
  text: z.string().max(6000),
  error: text,
  at: z.string().datetime(),
  attempt: id.nullable(),
  modelRevision: int,
}
const narrationSchema = z
  .object({
    ...common,
    kind: z.literal('narration'),
    directPublish: z.boolean().optional(),
    narrationAudit: dialogueReviewRecord.shape.audit,
    skillPreview: z.boolean().optional(),
    modelProbe: z.string().min(1).max(80).optional(),
    sceneId: id.nullable(),
    turnId: id.nullable(),
    audience: broadcastAudienceSchema,
    eventIds: z.array(id).max(500),
    events: z.array(broadcastEventSchema).max(500),
    context: z.record(z.string(), z.json()),
    title: z.string().min(1).max(120),
    status: z.enum([
      'queued',
      'running',
      'draft',
      'fallback',
      'published',
      'skipped',
      'canceled',
      'interrupted',
    ]),
    publishedEventId: id.nullable(),
    summary: z.boolean(),
  })
  .strict()
const npcConversationSchema = z
  .object({
    peerSessionId:id.optional(),peerGeneration:int.optional(),
    socialDecision:socialDecisionSchema.optional(),
    requestPublicSpeech:z.boolean().optional(),
    publicDialogue:planningDialogueSchema.optional(),planningParentId:id.optional(),planningSpeechJobId:id.optional(),planningSpeechError:text.optional(),
    dialogueGroup: z
      .object({
        id,
        mode: z.enum(['group', 'shout']),
        npcIds: z.array(id).min(1).max(5),
        primaryNpcId: id.optional(),
      })
      .strict()
      .optional(),
    groupInfluence: z
      .array(
        z
          .object({
            npcId: id,
            dc: z.number().int().min(1).max(100),
            attitude: text.min(1),
            consequence: text.min(1),
            total: z.number().finite(),
            success: z.boolean(),
          })
          .strict(),
      )
      .max(4)
      .optional(),
    dialogueBasis: z.string().max(64).optional(),
    inputOrder: int.optional(),
    publishedOrder: int.optional(),
    segments: z
      .array(z.object({ kind: z.enum(['speech', 'action']), text }).strict())
      .max(80)
      .optional(),
    checkSuggestion: z.object({ skill: id, reason: text }).strict().optional(),
    requestedCheck: z.boolean().optional(),
    behaviorIntentIds: z.array(id).max(7).optional(),
    dialogueReview: dialogueReviewRecord.optional(),
    ...common,
    kind: z.literal('npc'),
    spatialPlanning: z.boolean().optional(),
    spatialObservation: z.string().max(64).optional(),
    activityTest: z.boolean().optional(),
    testEvent: broadcastEventSchema.optional(),
    affinityProposal: z
      .object({
        characterId: id,
        delta: z.number().int().min(-20).max(20),
        reason: text.min(1),
        status: z.enum(['pending', 'approved', 'rejected']),
      })
      .strict()
      .optional(),
    qqSessionId: id.optional(),
    qqIdentityId: id.optional(),
    activityKey: id.optional(),
    reviewRequired: z.boolean().optional(),
    activityEventIds: z.array(id).max(50).optional(),
    purpose: z.enum(['dialogue', 'proactive', 'combat']).default('dialogue'),
    triggerIds: z.array(id).max(20).default([]),
    plan: z.array(npcDirectiveSchema).max(6).default([]),
    nextStep: int.max(6).default(0),
    strategyFixed: z.boolean().default(false),
    npcId: id,
    profileRevision: int,
    characterId: id,
    sessionId: id,
    visibility: z.enum(['public', 'personal']),
    message: text.min(1),
    goal: text,
    constraints: text,
    baseWorldRevision: int,
    check: z
      .object({
        skill: id,
        total: z.number().finite().nullable(),
        success: z.boolean().nullable(),
        adjudicated: z.boolean(),
        autoFail: z.boolean().optional(),
      })
      .strict()
      .nullable(),
    status: z.enum([
      'waiting-gm',
      'queued',
      'running',
      'draft',
      'fallback',
      'published',
      'rejected',
      'stale',
      'canceled',
      'interrupted',
    ]),
    proposal: npcDirectiveSchema,
    reason: text,
    intentId: id.nullable(),
  })
  .strict()
export const aiJournalSchema = z
  .object({
    activityDiagnostics: z
      .array(
        z
          .object({
            id,
            branchId: id,
            actionId: id,
            npcId: id,
            sceneId: id,
            eventIds: z.array(id).max(50),
            at: z.string().datetime(),
            status: z.enum(['blocked', 'eligible', 'waiting', 'queued', 'skipped']),
            reason: text,
            characterId: id.nullable(),
            templateId: id.nullable(),
            jobId: id.optional(),
          })
          .strict(),
      )
      .max(200)
      .optional(),
    activityQueue: z
      .array(
        z
          .object({
            actionId: id,
            sceneId: id,
            branchId: id,
            eventIds: z.array(id).max(50),
            createdAt: z.string().datetime(),
            respondedNpcIds: z.array(id).max(20),
            limit: int.min(1).max(2),
          })
          .strict(),
      )
      .max(50)
      .optional(),
    turns: z
      .array(
        z
          .object({
            id,
            npcId: id,
            jobId: id,
            encounterId: id,
            tick: int,
            branchId: id,
            profileRevision: int,
            mode: z.enum(['automatic', 'plan']),
            state: z.enum(['running', 'paused', 'review', 'completed', 'canceled']),
            steps: z.array(npcDirectiveSchema).max(6),
            nextStep: int.max(6),
            executed: int.max(64),
            finishTurn: z.boolean(),
            reason: text,
            targetScope: z.string().max(20000),
            conditionsConfirmed: z.boolean(),
            abilityConditions: z.boolean().optional(),
            waitingStep: npcDirectiveSchema.optional(),
            needsApproval: z.boolean().optional(),
            rider: text,
          })
          .strict(),
      )
      .max(100)
      .optional(),
    version: z.literal(1),
    activations: z
      .array(
        z
          .object({
            npcId: id,
            sceneId: id,
            branchId: id,
            eventId: id,
            at: z.string().datetime(),
            activityKey: id.optional(),
            critical: z.boolean().optional(),
          })
          .strict(),
      )
      .max(1000)
      .optional(),
    branchId: id,
    cursor: int,
    buffered: z.array(id).max(5000),
    nextSequence: int.min(1),
    jobs: z.array(z.discriminatedUnion('kind', [narrationSchema, npcConversationSchema])).max(150),
    usage: z.array(
      z
        .object({
          at: z.string().datetime(),
          jobId: id,
          reservedTokens: int,
          calls:int.positive().optional(),
          reportedTokens: int.nullable(),
          model: z.string().max(120),
        })
        .strict(),
    ),
  })
  .strict()
export const modelConfigurationInputSchema = z
  .object({
    contextBudgetTokens: int.positive().nullable().optional(),
    baseUrl: z.string().url().max(1000),
    model: z.string().min(1).max(120),
    apiKey: z.string().max(4096).optional(),
    clearKey: z.boolean(),
    timeoutSeconds: int.min(5).max(120),
    maxOutputTokens: int.positive().nullable(),
    tokenParameter: z.enum(['max_tokens', 'max_completion_tokens']),
    jsonMode: z.boolean(),
  })
  .strict()
export const narrationOutputSchema = z
  .object({
    text: z.string().min(1).max(6000),
    eventIds: z.array(id).min(1).max(500),
    claims: z
      .array(
        z
          .object({
            eventId: id,
            damage: z.number().finite().nonnegative().optional(),
            hit: z.boolean().optional(),
            dead: z.boolean().optional(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict()
export const npcOutputSchema = z
  .object({
    requestPeerDialogue:z.object({npcIds:z.array(id).min(1).max(3),topic:text.min(1)}).strict().optional(),
    requestPublicSpeech:z.boolean().optional(),
    publicDialogue:planningDialogueSchema.optional(),
    segments: z.unknown().optional(),
    checkSuggestion: z.object({ skill: id, reason: text }).strict().optional(),
    dialogueCategory: dialogueCategory.optional(),
    publicSourceIds: z.array(z.string().min(1).max(200)).max(100).optional(),
    affinityChange: z
      .object({ delta: z.number().int().min(-20).max(20), reason: text.min(1) })
      .strict()
      .optional(),
    reviewRequired: z.boolean().optional(),
    text: text.min(1),
    proposal: npcDirectiveSchema,
    reason: text,
    plan: z.array(npcDirectiveSchema).max(6).optional(),
  })
  .strict()
import { merchantPolicySchema,merchantStockSchema } from './trade-schema'
