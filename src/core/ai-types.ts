import type { BroadcastAudience, BroadcastEvent } from './broadcast-types'
import type { CombatNpc, DamageType } from './combat-types'
import type { NarrationSkill } from './narration-skills'
export const NPC_ACTIVITY_EVENTS = [
  'scene.enter',
  'token.moved',
  'point.result',
  'target.resolved',
  'gm.mark',
] as const
export interface NpcAbility {
  id: string
  name: string
  kind: 'spell' | 'feature'
  key: string
  mode: string
  enabled: boolean
  note: string
}
export interface AiSettings {
  contentLocale?: import('../shared/localization/locale').Locale
  textStyle?:import('./model-text-style').TextStyleSettings
  narrationSkills?: NarrationSkill[]
  defaultNarrationSkill?: string | null
  sceneNarrationSkills?: Record<string, string>
  qqDialogueReview?: {
    policyVersion?: number
    enabled: boolean
    paused: boolean
    categories: DialogueCategory[]
    revision?: number
  }
  narrationModelRef?: string
  npcModelRef?: string
  activitySpeakers?: number
  npcPortrait?: string | null
  enabled: boolean
  mode: 'turn' | 'action' | 'manual'
  autoPublish: boolean
  narrationDirectPublish?: boolean
  privateNarration: boolean
  style: string
  background: string
  language: string
  maxCharacters: number
  includeNumbers: boolean
  requestsPerHour: number | null
  tokensPerHour: number | null
}
export const DIALOGUE_CATEGORIES = [
  'greeting',
  'small-talk',
  'public-recap',
  'emotional-response',
] as const
export type DialogueCategory = (typeof DIALOGUE_CATEGORIES)[number]
export const DIALOGUE_CATEGORY_LABELS: Record<DialogueCategory, string> = {
  greeting: '问候与身份介绍',
  'small-talk': '闲聊与性格表达',
  'public-recap': '已公开背景与经历',
  'emotional-response': '感谢、关心与情绪回应',
}
export interface DialogueReviewRecord {
  contractVersion?: number
  generationDurationMs?: number
  audit?: {
    status: 'queued' | 'running' | 'passed' | 'escalated' | 'suggested'
    stamp: string
    reason: string
    calls: number
    model?: string
    durationMs?: number
    tokens?: number | null
  }
  publicInput: boolean
  policyStamp: string
  stage: 'candidate' | 'adjudication' | 'proofread' | 'automatic' | 'manual' | 'failed'
  category?:
    DialogueCategory | 'influence' | 'secret' | 'transaction' | 'commitment' | 'action' | 'unknown'
  sourceIds: string[]
  citedIds: string[]
  reason: string
}
export const NPC_BEHAVIORS = [
  'hostile',
  'start-combat',
  'attack',
  'flee',
  'surrender',
  'alert',
  'promise',
  'trade',
  'reveal',
  'move',
  'action',
  'ability',
  'interact',
  'travel',
] as const
export type NpcBehavior = (typeof NPC_BEHAVIORS)[number]
export interface NpcDirective {
  pointId?: string
  operation?: 'use' | 'toggle' | 'check' | 'claim'
  itemIds?: string[]
  confirmItemCosts?: boolean
  summon?:{form:string;materialId:string;corpseIds?:string[];maintainIds?:string[];creatureType?:'celestial'|'fey'|'fiend'}
  angle?:number
  actionCost?: 'action' | 'bonus'
  kind: NpcBehavior | 'none'
  targetId?: string
  attackId?: string
  destination?: { x: number; y: number }
  itemId?: string
  quantity?: number
  priceGP?: number
  factId?: string
  detail?: string
  abilityId?: string
  targets?: string[]
  amount?: number
  action?: 'dash' | 'disengage' | 'dodge' | 'help' | 'ready' | 'utilize' | 'hide'
  damageType?: DamageType
}
export interface NpcInitialMemory {
  id: string
  text: string
  visibility: 'public' | 'personal' | 'private'
  characterId: string | null
}
export interface NpcRelation {
  characterId: string
  score: number
  note: string
}
export interface NpcExperience {
  importance?: 'major'
  knowledgeSource?: 'witness' | 'told'
  id: string
  sourceId: string
  branchId: string
  sceneId: string | null
  at: string
  text: string
  characterId: string | null
  visibility: 'public' | 'personal'
  pinned: boolean
  kind: 'event' | 'relationship'
}
export interface AiInputReport {
  sections?: { key: string; bytes: number }[]
  textStyle?:import('zod').infer<typeof import('../persistence/model-text-style-schema').textStyleReportSchema>
  eventSelections?: { id: string; text: string; status: string; reason: string }[]
  estimatedTokens: number
  budget: number | null
  outputTokens: number | null
  selectedIds: string[]
  omittedIds: string[]
  preview: string
}
export interface NpcActivityDiagnostic {
  id: string
  branchId: string
  actionId: string
  npcId: string
  sceneId: string
  eventIds: string[]
  at: string
  status: 'blocked' | 'eligible' | 'waiting' | 'queued' | 'skipped'
  reason: string
  characterId: string | null
  templateId: string | null
  jobId?: string
}
export interface NpcProfile {
  persona?: import('../persistence/npc-persona-schema').NpcPersona
  spatialPolicy?: import('../persistence/npc-spatial-schema').NpcSpatialPolicy
  knowledgeProfile?: import('../persistence/npc-knowledge-schema').KnowledgeProfile
  /** GM-authored capability; never inferred from model output or descriptive prose. */
  communication?: 'auto' | 'speaking' | 'nonverbal'
  publicSpeechStyle?: string
  gmDesign?: import('zod').infer<
    typeof import('../persistence/script-design-schema').npcDesignSchema
  >
  importanceRole?: 'resident' | 'companion'
  fixedReplies?: { id: string; text: string; localized?: Partial<Record<import('../shared/localization/locale').Locale,string>> }[]
  fixedReplyMode?: 'end' | 'loop'
  fixedReplyEndLocales?: Partial<Record<import('../shared/localization/locale').Locale,string>>
  fixedReplyEnd?: string
  fixedReplyCursor?: number
  consumables?: { id: string; itemId: string; quantity: number }[]
  consumablesUsed?: Record<string, number>
  arrivalOrigin?: { sceneId: string; x: number; y: number }
  initiallyAbsent?: boolean
  appeared?: boolean
  initialMemories?: NpcInitialMemory[]
  experiences?: NpcExperience[]
  experienceOmitted?: number
  affinityEnabled?: boolean
  initialRelations?: NpcRelation[]
  relations?: NpcRelation[]
  modelRef?: string
  portrait?: string | null
  illustration?: string | null
  turnHold?: { encounterId: string; tick: number; state: 'paused' | 'manual' }
  turnMode?: 'manual' | 'automatic' | 'plan' | 'step'
  followParty?: boolean
  tacticalInput?: boolean
  guardOrigin?: { sceneId: string; x: number; y: number }
  templateId?: string
  npcType: 'ordinary' | 'important'
  controller: 'gm' | 'model'
  characterId: string | null
  body: CombatNpc | null
  side: 'party' | 'enemy' | 'neutral'
  dialogue: {
    id: string
    when: 'default' | 'initial' | 'repeat' | 'success' | 'failure' | 'friendly' | 'hostile'
    text: string
  }[]
  abilities: NpcAbility[]
  combatPolicy: {
    resourceStrategy?: 'conservative'|'balanced'|'aggressive'
    monsterAbilityIds?: string[]
    healPercent?: number
    strategy: 'nearest' | 'guard' | 'protect' | 'ranged' | 'retreat'
    attackIds: string[]
    guardRadius: number
    protectCharacterId: string | null
    retreatPercent: number
    planOnTurn: boolean
  }
  activity: {
    scope?: 'party' | 'selected'
    publishMode?: 'review' | 'ordinary'
    templates?: NpcActivityTemplate[]
    enabled: boolean
    events: (typeof NPC_ACTIVITY_EVENTS)[number][]
    characterIds: string[]
    range: number
    cooldownSeconds: number
    maxPerScene: number
    allowDuringCombat: boolean
  }
  id: string
  revision: number
  name: string
  sceneId: string
  actorId: string | null
  position: { x: number; y: number }
  hidden: boolean
  enabled: boolean
  description: string
  personality: string
  goals: string
  strategy: string
  knowledge: string
  secrets: { id: string; text: string }[]
  revealedIds: string[]
  urgingCooldowns: { characterId: string; key: string; untilHours: number }[]
  privateNote: string
  fallbackReply: string
  attitude: 'friendly' | 'indifferent' | 'hostile'
  behaviorState: 'none' | 'fleeing' | 'surrendered'
  publicKnowledgeOnly?: boolean
  dialogueReview?: { mode: 'inherit' | 'review' | 'custom'; categories: DialogueCategory[] }
  publicDialogue?: string
  publicKnowledge?: { id: string; text: string }[]
  autoDialogue: boolean
  allowed: NpcBehavior[]
  preauthorization: {
    trade: boolean
    revealIds: string[]
    characterIds: string[]
    maxQuantity: number
    maxDiscountGP: number
    maxValueGP: number
    remaining: number
    expiresAt: string | null
  }
  merchantPolicy?: import('../persistence/trade-schema').MerchantPolicy
  practicalSocial?: import('zod').infer<typeof import('../persistence/practical-social-schema').practicalSocialPolicySchema>
  stock: import('../persistence/trade-schema').MerchantStock[]
  coins: number
  memory: {
    id: string
    at: string
    characterId: string
    visibility: 'public' | 'personal'
    qqSessionId?: string
    branchId?: string
    player: string
    reply: string
  }[]
}
export interface AdventureAi {
  spatialState?: import('../persistence/npc-spatial-schema').NpcSpatialState
  memoryConfig?: import('../persistence/npc-knowledge-schema').KnowledgeConfig
  knowledgeDesign?: import('../persistence/npc-knowledge-schema').KnowledgeDesign
  knowledgeState?: import('../persistence/npc-knowledge-schema').KnowledgeState
  templates?: NpcTemplate[]
  settings: AiSettings
  npcs: NpcProfile[]
}
export interface NpcTemplate {
  metadata?: import('./npc-template-types').NpcTemplateMetadata
  portrait?: string | null
  id: string
  name: string
  source: string
  body: CombatNpc
  strategy: 'nearest' | 'guard' | 'protect' | 'ranged' | 'retreat'
  notes: string[]
}
export interface NarrationJob {
  outputLocale?: import('../shared/localization/locale').Locale
  translationFallback?: boolean
  languagePolicyVersion?: number
  modelContract?:import('../server/model-output-normalization').ModelContractReport
  textStyle?:import('./model-text-style').TextStyleSnapshot
  directPublish?: boolean
  narrationAudit?: NonNullable<DialogueReviewRecord['audit']>
  inputReport?: AiInputReport
  modelProbe?: string
  modelIdentity?: string
  id: string
  sequence: number
  kind: 'narration'
  skillPreview?: boolean
  branchId: string
  sceneId: string | null
  turnId: string | null
  audience: BroadcastAudience
  eventIds: string[]
  events: BroadcastEvent[]
  context: Record<string, unknown>
  title: string
  status:
    | 'queued'
    | 'running'
    | 'draft'
    | 'fallback'
    | 'published'
    | 'skipped'
    | 'canceled'
    | 'interrupted'
  text: string
  error: string
  at: string
  attempt: string | null
  modelRevision: number
  publishedEventId: string | null
  summary: boolean
}
export interface NpcConversation {
  outputLocale?: import('../shared/localization/locale').Locale
  translationFallback?: boolean
  languagePolicyVersion?: number
  requestPublicSpeech?: boolean
  socialDecision?: import('../persistence/practical-social-schema').SocialDecision
  spatialPlanning?: boolean
  spatialObservation?: string
  peerSessionId?:string
  peerGeneration?:number
  modelContract?:import('../server/model-output-normalization').ModelContractReport
  publicDialogue?:import('zod').infer<typeof import('../persistence/model-contract-schema').planningDialogueSchema>
  planningParentId?:string
  planningSpeechJobId?:string
  planningSpeechError?:string
  textStyle?:import('./model-text-style').TextStyleSnapshot
  dialogueGroup?: { id: string; mode: 'group' | 'shout'; npcIds: string[]; primaryNpcId?: string }
  groupInfluence?: {
    npcId: string
    dc: number
    attitude: string
    consequence: string
    total: number
    success: boolean
  }[]
  inputOrder?: number
  publishedOrder?: number
  dialogueBasis?: string
  segments?: import('./dialogue-segments').DialogueSegment[]
  checkSuggestion?: { skill: string; reason: string }
  requestedCheck?: boolean
  behaviorIntentIds?: string[]
  dialogueReview?: DialogueReviewRecord
  activityTest?: boolean
  testEvent?: BroadcastEvent
  affinityProposal?: {
    characterId: string
    delta: number
    reason: string
    status: 'pending' | 'approved' | 'rejected'
  }
  inputReport?: AiInputReport
  modelIdentity?: string
  activityKey?: string
  reviewRequired?: boolean
  activityEventIds?: string[]
  qqSessionId?: string
  qqIdentityId?: string
  purpose: 'dialogue' | 'proactive' | 'combat'
  triggerIds: string[]
  plan: NpcDirective[]
  nextStep: number
  strategyFixed: boolean
  id: string
  sequence: number
  kind: 'npc'
  npcId: string
  profileRevision: number
  branchId: string
  characterId: string
  sessionId: string
  visibility: 'public' | 'personal'
  message: string
  goal: string
  constraints: string
  baseWorldRevision: number
  check: {
    skill: string
    total: number | null
    success: boolean | null
    adjudicated: boolean
    autoFail?: boolean
  } | null
  status:
    | 'waiting-gm'
    | 'queued'
    | 'running'
    | 'draft'
    | 'fallback'
    | 'published'
    | 'rejected'
    | 'stale'
    | 'canceled'
    | 'interrupted'
  text: string
  proposal: NpcDirective
  reason: string
  error: string
  at: string
  attempt: string | null
  modelRevision: number
  intentId: string | null
}
export type AiJob = NarrationJob | NpcConversation
export interface NpcTurnRun {
  id: string
  npcId: string
  jobId: string
  encounterId: string
  tick: number
  branchId: string
  profileRevision: number
  mode: 'automatic' | 'plan'
  state: 'running' | 'paused' | 'review' | 'completed' | 'canceled'
  steps: NpcDirective[]
  nextStep: number
  executed: number
  finishTurn: boolean
  reason: string
  targetScope: string
  conditionsConfirmed: boolean
  abilityConditions?: boolean
  waitingStep?: NpcDirective
  needsApproval?: boolean
  rider: string
}
export interface AiJournal {
  activityDiagnostics?: NpcActivityDiagnostic[]
  activityQueue?: NpcActivityGroup[]
  turns?: NpcTurnRun[]
  activations?: {
    npcId: string
    sceneId: string
    branchId: string
    eventId: string
    at: string
    activityKey?: string
    critical?: boolean
  }[]
  version: 1
  branchId: string
  cursor: number
  buffered: string[]
  nextSequence: number
  jobs: AiJob[]
  usage: {
    calls?:number
    at: string
    jobId: string
    reservedTokens: number
    reportedTokens: number | null
    model: string
  }[]
}
export interface ModelConfiguration {
  contextBudgetTokens?: number | null
  revision: number
  baseUrl: string
  model: string
  apiKey: string
  timeoutSeconds: number
  maxOutputTokens: number | null
  tokenParameter: 'max_tokens' | 'max_completion_tokens'
  jsonMode: boolean
}
export const NPC_RESPONSE_TYPES = [
  'rescued',
  'aided',
  'critical',
  'wounded',
  'downed',
  'recovered',
  'danger',
  'goal',
  'scene',
  'interaction',
] as const
export type NpcResponseType = (typeof NPC_RESPONSE_TYPES)[number]
export interface NpcActivityTemplate {
  id: string
  type: NpcResponseType
  enabled: boolean
  pointId: string | null
  sceneId: string | null
  outcome: 'any' | 'success' | 'failure'
  thresholdPercent: number
  tendency: string
  priority: number
  cooldownSeconds: number
}
export interface NpcActivityGroup {
  actionId: string
  sceneId: string
  branchId: string
  eventIds: string[]
  createdAt: string
  respondedNpcIds: string[]
  limit: number
}
export interface ModelProfileView extends Omit<ModelConfiguration, 'apiKey'> {
  name: string
  hasKey: boolean
}
export interface AiModelRequest {
  kind: 'narration' | 'npc' | 'review'
  system: string
  input: Record<string, unknown>
}
export interface AiModelResult {
  output: unknown
  tokens: number | null
}
export interface AiProvider {
  generate(
    request: AiModelRequest,
    config: ModelConfiguration,
    signal: AbortSignal,
  ): Promise<AiModelResult>
}
export interface AiView {
  knowledgeReport?: { npcId:string; characterId:string|null; page:number; total:number; records:import('../persistence/npc-knowledge-schema').KnowledgeRecord[]; relationship:ReturnType<typeof import('./npc-relationships').resolveNpcRelationship>|null; status:string }
  activityDiagnostics?: NpcActivityDiagnostic[]
  modelProfiles?: ModelProfileView[]
  turns?: NpcTurnRun[]
  settings: AiSettings
  model: {
    contextBudgetTokens?: number | null
    configured: boolean
    model: string
    baseUrl: string
    hasKey: boolean
    timeoutSeconds: number
    maxOutputTokens: number | null
    tokenParameter: ModelConfiguration['tokenParameter']
    jsonMode: boolean
  }
  npcs: (Pick<
    NpcProfile,
    | 'id'
    | 'name'
    | 'description'
    | 'sceneId'
    | 'actorId'
    | 'position'
    | 'attitude'
    | 'npcType'
    | 'characterId'
    | 'behaviorState'
  > & {attitudes?:{characterId:string;band:string;attitude:NpcProfile['attitude']}[]})[]
  jobs: {
    outputLocale?: import('../shared/localization/locale').Locale
  translationFallback?: boolean
    spatialPlanning?: boolean
    modelContract?:import('../server/model-output-normalization').ModelContractReport
    planningParentId?:string
    planningSpeechJobId?:string
    planningSpeechError?:string
    textStyle?:import('zod').infer<typeof import('../persistence/model-text-style-schema').textStyleReportSchema>
    narrationAudit?: NarrationJob['narrationAudit']
    modelProbe?: string
    skillPreview?: boolean
    narrationSkill?: { id: string; name: string; version: number }
    dialogueReview?: DialogueReviewRecord
    dialogueGroup?: NpcConversation['dialogueGroup']
    groupInfluence?: NpcConversation['groupInfluence']
    checkSuggestion?: { skill: string; reason: string }
    behaviorIntentIds?: string[]
    inputReport?: AiInputReport
    activityTest?: boolean
    affinityProposal?: NpcConversation['affinityProposal']
    id: string
    kind: 'narration' | 'npc'
    sequence: number
    title: string
    status: string
    text: string
    at: string
    historical: boolean
    audience: BroadcastAudience
    eventIds: string[]
    error: string
    proposal?: NpcDirective
    reason?: string
    characterId?: string
    npcId?: string
    message?: string
    goal?: string
    check?: NpcConversation['check']
    intentId?: string | null
    purpose?: NpcConversation['purpose']
    plan?: NpcDirective[]
    nextStep?: number
    strategyFixed?: boolean
  }[]
  usage: { requests: number; reservedTokens: number; reportedTokens: number }
  buffered: number
}
export type AiMapCommand =
  | { type: 'npc-template'; template: NpcTemplate }
  | { type: 'npc-template-delete'; templateId: string }
  | { type: 'ai-settings'; settings: AiSettings }
  | { type: 'npc-profile'; profile: NpcProfile }
  | { type: 'npc-delete'; npcId: string }
  | { type: 'npc-party-scope'; npcIds: string[] }
