import {spellKeySchema} from '../persistence/item-spell-schema'
import {openingCommandSchema,type OpeningReadings,type OpeningReadingView} from '../persistence/opening-reading-schema'
import { containerActionSchema } from '../persistence/point-container-schema'
import {summonActionSchema} from '../persistence/summon-action-schema'
import { fogCommandSchema } from '../persistence/fog-schema'
import { tradeCommandSchema } from '../persistence/trade-schema'
import { npcSpatialCommandSchema } from '../persistence/npc-spatial-schema'
import {gmSpellChoiceSchema,gmSpellFactSchema} from '../persistence/gm-spell-choice-schema'
import {sceneEffectActionSchema} from '../persistence/scene-effects-schema'
import { m3ActionSchema } from '../persistence/m3-world-schema'
import { m3CastChoiceSchema } from '../persistence/m3-schema'
import { questSchema } from '../persistence/quest-schema'
import { configImportSchema } from '../persistence/npc-config-schema'
import {
  aiSettingsSchema,
  npcProfileSchema,
  npcDirectiveSchema,
  npcTemplateSchema,
  modelConfigurationInputSchema,
} from '../persistence/ai-schema'
import type { AiView, ModelConfiguration } from '../core/ai-types'
import {knowledgeCommandSchema} from '../persistence/npc-knowledge-schema'
import { broadcastTemplateSchema, broadcastAudienceSchema } from '../persistence/broadcast-schema'
import type { BroadcastFeed } from '../core/broadcast-types'
import { metamagicSchema } from '../persistence/combat-schema'
import { reviewSettingsSchema } from '../persistence/gm-review-schema'
import { z } from 'zod'
import {m1ActionSchema} from '../persistence/m1-utility-schema'
import { specialWeaponSchema } from '../persistence/special-weapon-schema'
import { weaponHandlingSchema } from '../persistence/weapon-handling-schema'
import { sceneToolCommandSchema } from '../persistence/scene-tools-schema'
import { explorationCommandSchema } from '../persistence/exploration-schema'
import { battleMapSchemas } from '../persistence/battle-schema'
import { sceneSchema, mapArchiveSchema } from '../persistence/map-schema'
import { encounterSchema } from '../persistence/combat-schema'
import { archiveSchema } from '../persistence/schema'
import { ABILITIES, EQUIPMENT_SLOTS } from '../core/types'
import { DAMAGE_TYPES } from '../core/combat-types'
import type { MapWorld, MapScene, MapAsset, MapCommand, MapCombatOptions } from '../core/map-types'
import type { Character, Pack } from '../core/types'
import type {
  CombatCommand,
  Environment,
  AttackSpec,
  TurnBudget,
  D20Result,
  DamageReroll,
} from '../core/combat-types'
import type { RuntimeCommand } from '../core/runtime'
import type { BattleRequest } from '../core/battle-types'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s))
const text = z.string().max(2000),
  int = z.number().int().min(0).max(100000)
const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
const position = object({ x: int.max(79), y: int.max(79) })
const mapOptionsSchema = object({
  distance: z.boolean(),
  highGround: z.boolean(),
  obstacles: z.boolean().optional(),
  cover: z.boolean().optional(),
  area: z.boolean().optional(),
  template: sceneSchema.shape.template.unwrap().optional(),
  reason: text,
})
export const environmentSchema = object({
  npcChargeConfirmed: z.boolean().optional(),
  npcGrappleConfirmed: z.boolean().optional(),
  crusaderActive: z.boolean().optional(),
  protectionActive: z.boolean().optional(),
  distance: z.number().finite().min(0).max(10000),
  cover: z.enum(['none', 'half', 'three-quarters', 'total']),
  attackerHears:z.boolean().optional(),
  attackerSees: z.boolean(),
  targetSees: z.boolean(),
  nearbyEnemy: z.boolean(),
  advantage: z.boolean(),
  disadvantage: z.boolean(),
  fearVisible: z.boolean(),
  targetLocationConfirmed: z.boolean(),
  areaConfirmed: z.boolean(),
  note: text,
  attackAdvantages: z.array(text).max(20).optional(),
  spatial: text.optional(),
})
const inventorySchemas = [
  object({
    type: z.literal('equip'),
    instanceId: id,
    equipped: z.boolean(),
    slot: z.enum(EQUIPMENT_SLOTS).optional(),
    grip: z.enum(['one-handed', 'two-handed']).optional(),
    takeOut: z.boolean().optional(),
  }),
  object({
    type: z.literal('item-remove'),
    instanceId: id,
    quantity: int.min(1).max(10000),
    consume: z.boolean().optional(),
    note: text.optional(),
    potionRolls: z.array(int).max(30).optional(),
  }),
  object({ type: z.literal('item-move'), instanceId: id, containerId: id.nullable() }),
  object({ type: z.literal('item-note'), instanceId: id, note: text }),
  object({ type: z.literal('item-split'), instanceId: id, quantity: int.min(1).max(10000) }),
  object({ type: z.literal('portrait-set'), image: z.string().max(180000).nullable() }),
] as const
export const runtimeSchema = z.discriminatedUnion('type', [
  object({
    type: z.literal('special-weapon'),
    instanceId: id,
    definition: specialWeaponSchema.nullable(),
    reason: text,
  }),
  object({ type: z.literal('mounted'), active: z.boolean(), reason: text }),
  object({
    type: z.literal('advanced'),
    id,
    amount: int.min(1).max(10),
    confirmed: z.boolean(),
    note: text,
    choice: id.optional(),
  }),
  object({
    type: z.literal('origin'),
    id: z.enum([
      'healer',
      'healing-hands',
      'revelation',
      'end-revelation',
      'craft',
      'musician',
      'chef-meal',
      'inspiring-leader',
    ]),
    targets: z.array(id).max(7),
    mode: z.enum(['wings', 'radiance', 'shroud']),
    itemId: text,
    kitId: text,
    confirmed: z.boolean(),
    reroll: z.boolean(),
    note: text,
  }),
  object({
    type: z.literal('recover'),
    id: z.enum([
      'magical-cunning',
      'font-slot',
      'font-points',
      'font-inspiration',
      'wild-resurgence',
      'wild-slot',
    ]),
    slotLevel: int.min(1).max(3),
  }),
  object({
    type: z.literal('level-up'),
    expectedRevision: int,
    targetLevel: int.min(2).max(5),
    hpMethod: z.enum(['fixed', 'roll']),
    choices: z.record(id, z.array(id).max(100)),
    abilityIncreases: z.partialRecord(
      z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']),
      int.max(2),
    ),
    confirmed: z.boolean(),
    reason: text,
  }),
  ...inventorySchemas,
  object({
    type: z.literal('damage'),
    damageType: z.enum(DAMAGE_TYPES).optional(),
    amount: int,
    critical: z.boolean().optional(),
    relentless: z.boolean().optional(),
    note: text.optional(),
  }),
  object({ type: z.literal('heal'), amount: int, note: text.optional() }),
  object({ type: z.literal('temporary'), amount: int, replace: z.boolean().optional() }),
  object({ type: z.literal('condition'), id, active: z.boolean() }),
  object({
    type: z.literal('resource'),
    id,
    amount: z.number().int().min(-100000).max(100000),
    roll: int.optional(),
    target: z.enum(['self', 'other', 'purify']).optional(),
    note: text.optional(),
  }),
  object({
    type: z.literal('coins'),
    amount: z.number().finite().min(-1000000).max(1000000),
    reason: text,
  }),
  object({
    type: z.literal('item-add'),
    itemId: id,
    quantity: int.min(1).max(10000),
    purchase: z.boolean(),
    note: text.optional(),
  }),
  object({
    type: z.literal('check'),
    kind: z.enum(['skill', 'save', 'initiative', 'ability']),
    id,
    dc: int.min(1).max(100).optional(),
    context: object({
      advantage: z.boolean().optional(),
      disadvantage: z.boolean().optional(),
      purpose: z
        .enum(['normal', 'poison', 'charm', 'fear', 'concentration', 'sight', 'hearing', 'grapple'])
        .optional(),
      fearVisible: z.boolean().optional(),
      lucky: z.boolean().optional(),
    }).optional(),
  }),
  object({
    type: z.literal('rest'),
    kind: z.enum(['short', 'long']),
    confirmed: z.boolean(),
    hitDieRoll: int.optional(),
    useHitDie: z.boolean().optional(),
    arcaneRecovery: z.boolean().optional(),
    recoverySlots: z.array(int.min(1).max(3)).max(3).optional(),
    sorcerousRestoration: z.boolean().optional(),
    prepared: z.array(id).max(30).optional(),
    spellChoices: z.partialRecord(z.enum(['class-cantrips','tome-cantrips','tome-rituals']), z.array(id).max(20)).optional(),
    recoverExhaustion: z.boolean().optional(),
  }),
  object({ type: z.literal('resource-set'), id, amount: int, reason: text }),
  object({ type: z.literal('effect-remove'), effectId: id, reason: text }),
  object({ type: z.literal('exhaustion'), level: int.max(6) }),
  object({
    type: z.literal('death-save'),
    roll: int.min(1).max(20),
    bonus: int.optional(),
    lucky: z.boolean().optional(),
  }),
  object({ type: z.literal('stabilize') }),
  object({
    type: z.literal('end-effect'),
    effect: z.enum(['rage', 'innateSorcery', 'concentration']),
  }),
  object({ type: z.literal('inspiration'), active: z.boolean(), note: text.optional() }),
  object({
    type: z.literal('cast'),

    key: spellKeySchema,
    mode: id,
    requirementsConfirmed: z.boolean(),
    hitDice: int.min(1).max(3).optional(),
    ammunition: object({ instanceId: id, count: int.min(1).max(18) }).optional(),
    wildCheck: z.boolean().optional(),
  }),
  object({ type: z.literal('concentration-result'), success: z.boolean() }),
  object({ type: z.literal('time'), hours: z.number().finite().min(0).max(100000) }),
  object({ type: z.literal('undo') }),
]) as z.ZodType<RuntimeCommand>
const actor = { actorId: id }
export const combatCommandSchema = z.discriminatedUnion('type', [
  object({type:z.literal('control-ruling'),actorId:id,effectId:id,operation:z.enum(['crown-target','illusion-study','illusion-damage','truth-presence','activity-complete','witness-harm','duel-distance']),targetId:id.optional(),inside:z.boolean(),confirmed:z.boolean(),note:text}),
  object({type:z.literal('command-complete'),actorId:id,effectId:id,confirmed:z.boolean(),note:text}),
  object({type:z.literal('sanctuary-retarget'),...actor,targetIndex:int.min(0).max(99),targetId:id,env:environmentSchema}),
  object({type:z.literal('fear-context'),actorId:id,effectId:id,noSafeRoute:z.boolean(),sourceVisible:z.boolean(),movementResolved:z.boolean(),confirmed:z.boolean(),note:text}),
  object({type:z.literal('resolution-draft'),pendingId:id,keys:z.array(z.string().min(1).max(300)).max(100)}),
  object({
    type: z.literal('unarmed'),
    actorId: id,
    targetId: id,
    kind: z.enum(['grapple', 'prone', 'push']),
    save: z.enum(['str', 'dex']),
    hand: z.enum(['main-hand', 'off-hand']),
    cost: z.enum(['action', 'martial', 'flurry', 'opportunity', 'agile']),
    env: environmentSchema,
    handling: weaponHandlingSchema.optional(),
    pushTo: z
      .object({ x: int.min(0).max(79), y: int.min(0).max(79) })
      .strict()
      .optional(),
  }),
  object({type:z.literal('escape-vines'),actorId:id,targetId:id,effectId:id,env:environmentSchema,note:text}),
  object({type:z.literal('transfer-mark'),actorId:id,effectId:id,targetId:id,env:environmentSchema,note:text}),
  object({type:z.literal('hit-spell'),actorId:id,targetId:id,attackId:id,key:spellKeySchema,mode:id,note:text}),
  object({ type: z.literal('grapple-release'), actorId: id, targetId: id }),
  object({
    type: z.literal('grapple-escape'),
    actorId: id,
    sourceId: id,
    skill: z.enum(['athletics', 'acrobatics']),
    env: environmentSchema,
  }),
  object({
    attackWindowId:id.optional(),
    type: z.literal('npc-ability'),
    gmChoice:gmSpellChoiceSchema.optional(),
    weaponId:id.optional(),damageType:z.enum(DAMAGE_TYPES).optional(),
    dispelZoneId:id.optional(),
    m3Choice: m3CastChoiceSchema.optional(),
    supportChoice: id.optional(),
    controlChoices:z.record(id,id).optional(),
    controlTargets:z.array(id).max(100).optional(),
    controlText:z.string().max(2000).optional(),
    willing: z.boolean().optional(),
    actorId: id,
    abilityId: id,
    targetIds: z.array(id).max(100),
    env: environmentSchema,
    targetEnvironments: z.record(id, environmentSchema).optional(),
    confirmed: z.boolean(),
    note: text,
    shape: z.enum(['imp', 'rat', 'raven', 'spider']).optional(),
  }),
  object({
    type: z.literal('npc-reaction'),
    env:environmentSchema.optional(),
    actorId: id,
    abilityId: id,
    targetIndex: int.min(0).max(99),
    confirmed: z.boolean(),
    note: text,
  }),
  object({
    type: z.literal('npc-resource-restore'),
    actorId: id,
    recovery: z.enum(['day', 'manual']),
    resourceId: id.optional(),
    note: text,
  }),
  object({ type: z.literal('npc-concentration'), actorId: id, end: z.boolean().optional() }),
  object({
    type: z.literal('social-check'),
    actorId: id,
    skill: id,
    dc: int.min(1).max(100),
    advantage: z.boolean(),
    disadvantage: z.boolean(),
    fearVisible: z.boolean().optional(),
    cost: z.enum(['action', 'none']),
    note: text.min(1),
  }),
  object({
    type: z.literal('damage-roll'),
    ...actor,
    savage: z.boolean().optional(),
    tavernReroll: z.boolean().optional(),
  }),
  object({
    type: z.literal('add-character'),
    characterId: id,
    side: z.enum(['party', 'enemy', 'neutral']),
  }),
  object({
    type: z.literal('add-npc'),
    npc: encounterSchema.shape.actors.element.shape.npc.unwrap(),
    side: z.enum(['party', 'enemy', 'neutral']),
  }),
  object({ type: z.literal('remove-actor'), ...actor }),
  object({
    type: z.literal('initiative'),
    ...actor,
    value: z.number().finite().nullable(),
    surprised: z.boolean(),
  }),
  object({ type: z.literal('roll-initiative') }),
  object({type:z.literal('initiative-reroll'),actorId:id}),
  object({type:z.literal('initiative-swap'),actorId:id,targetId:id}),
  object({ type: z.literal('order'), ids: z.array(id).max(100) }),
  object({
    type: z.literal('convert'),
    actorId: id,
    command: object({
      type: z.literal('recover'),
      id: z.enum([
        'magical-cunning',
        'font-slot',
        'font-points',
        'font-inspiration',
        'wild-resurgence',
        'wild-slot',
      ]),
      slotLevel: int.min(1).max(3),
    }),
  }),
  object({ type: z.literal('start') }),
  object({ type: z.literal('next') }),
  object({ type: z.literal('end-turn'), ...actor, encounterId: id, expectedTick: int }),
  object({
    type: z.literal('item-use'),
    ...actor,
    targetId: id,
    instanceId: id,
    env: environmentSchema,
    note: text,
    manualCost: z.enum(['action', 'bonus', 'free']).optional(),
  }),
  object({ type: z.literal('end') }),
  object({ type: z.literal('undo') }),
  object({
    type: z.literal('action'),
    ...actor,
    cost: z.enum(['action', 'bonus','haste']).optional(),
    action: z.enum([
      'dash',
      'disengage',
      'dodge',
      'help',
      'ready',
      'magic',
      'utilize',
      'extinguish',
      'hide',
      'search',
      'study',
      'influence',
    ]),
    note: text,
  }),
  object({
    type: z.literal('attack'),
    handling: weaponHandlingSchema.optional(),
    ...actor,
    targetId: id,
    attackId: id,
    env: environmentSchema,
    cost: z.enum([
      'action',
      'haste',
      'light',
      'nick',
      'cleave',
      'martial',
      'flurry',
      'opportunity',
      'dual',
      'pole',
      'hew',
      'war-priest',
      'psychic',
      'star',
      'agile',
    ]),
    sneak: z.boolean(),
    mastery: z.boolean(),
    gmReason: text.optional(),
  }),
  object({
    type: z.literal('cast'),
    gmChoice:gmSpellChoiceSchema.optional(),
    ...actor,
    dispelZoneId:id.optional(),
    key: spellKeySchema,
    mode: id,
    targets: z.array(id).max(100),
    env: environmentSchema,
    requirementsConfirmed: z.boolean(),
    m3Choice: m3CastChoiceSchema.optional(),
    supportChoice: id.optional(),
    controlChoices:z.record(id,id).optional(),
    controlTargets:z.array(id).max(100).optional(),
    controlText:z.string().max(2000).optional(),
    willing: z.boolean().optional(),
    targetEnvironments: z.record(id, environmentSchema).optional(),
    ammunition: object({ instanceId: id, count: int.min(1).max(18) }).optional(),
    hitDice: int.min(1).max(3).optional(),
    wildCheck: z.boolean().optional(),
    summonForm: id.optional(),
    damageType: z.enum(DAMAGE_TYPES),
    weaponId: id.optional(),
    attackWindowId:id.optional(),
    triggerConfirmed: z.boolean().optional(),
    metamagic: metamagicSchema.optional(),
    excludedIds: z.array(id).max(100).optional(),
  }),
  object({
    type: z.literal('resolve'),
    nonlethal: z.boolean(),
    nonlethalTargetIds: z.array(id).max(100).optional(),
    savage: z.boolean(),
    uncanny: z.boolean().optional(),
    deflect: z.boolean().optional(),
    defenseTargetId: id.optional(),
    stone: z.boolean(),
    stoneTargetId: id.optional(),
    relentless: z.boolean(),
    relentlessTargetId: id.optional(),
    relentlessTargetIds: z.array(id).max(100).optional(),
    pushConfirmed: z.boolean(),
    pushDestinations:z.array(object({targetId:id,x:int.min(0).max(79),y:int.min(0).max(79)})).max(100).optional(),
    tavernReroll: z.boolean().optional(),
    healerReroll: z.boolean().optional(),
    revelationBonus: z.boolean().optional(),
    revelationTargetId: id.optional(),
    manual: object({
      repeatSave: z.enum(ABILITIES).optional(),
      acBonus: int.min(-10).max(10).optional(),
      speedPenalty: int.max(300).optional(),
      damage: int,
      damageType: z.enum(DAMAGE_TYPES),
      heal: int,
      condition: text,
      rounds: int.max(1000),
      note: text,
    }).optional(),
  }),
  object({
    type: z.literal('inventory'),
    ...actor,
    command: runtimeSchema,
    cost: z.enum(['free', 'action', 'bonus']),
    requirementsConfirmed: z.boolean(),
    note: text,
  }),
  object({ type: z.literal('runtime'), ...actor, command: runtimeSchema, reason: text }),
  object({
    type: z.literal('save'),
    ...actor,
    ability: z.enum(ABILITIES),
    dc: int.min(1).max(100),
    env: environmentSchema,
    purpose: z.enum(['normal', 'concentration', 'poison', 'charm', 'fear']),
    note: text,
  }),
  object({ type: z.literal('death-save'), ...actor, lucky: z.boolean().optional() }),
  object({ type: z.literal('beast-forms'), ...actor, ids: z.array(id).max(6), note: text }),
  object({ type: z.literal('wild-shape'), ...actor, formId: z.string().max(120), note: text }),
  object({
    type: z.literal('wild-companion'),
    ...actor,
    formId: id,
    mode: z.enum(['wild-shape', 'slot', 'slot-2', 'slot-3']),
    note: text,
  }),
  object({ type: z.literal('dismiss-companion'), ...actor, targetId: id, note: text }),
  object({
    type: z.literal('zone-trigger'),
    ...actor,
    zoneId: id,
    targetId: id,
    env: environmentSchema,
    phase: z.enum(['created', 'enter', 'start', 'end', 'moved']).optional(),
    note: text,
  }),
  object({ type: z.literal('zone-end'), ...actor, zoneId: id, note: text }),
  object({
    type: z.literal('zone-move'),
    ...actor,
    zoneId: id,
    distance: z.number().finite().min(0).max(30),
    note: text,
  }),
  object({ type: z.literal('maintain-spell'), ...actor, note: text }),
  object({
    type: z.literal('surge-npc'),
    ...actor,
    surgeId: id,
    npc: encounterSchema.shape.actors.element.shape.npc.unwrap(),
    note: text,
    destination: object({ x: int.max(79), y: int.max(79) }).optional(),
  }),
  object({
    type: z.literal('companion-power'),
    ...actor,
    targetId: id,
    kind: z.enum(['fey-step', 'putrid-aura']),
    env: environmentSchema,
    note: text,
    destination: object({ x: int.max(79), y: int.max(79) }).optional(),
  }),
  object({ type: z.literal('concentration'), ...actor }),
  object({type:z.literal('concentration-roll'),...actor}),
  object({ type: z.literal('end-concentration'), ...actor }),
  object({
    type: z.literal('reaction-shield'),
    ...actor,
    key: spellKeySchema,
    mode: id,
    requirementsConfirmed: z.boolean(),
  }),
  object({
    type:z.literal('reaction-counterspell'), ...actor, targetId:id,key:spellKeySchema,mode:id,requirementsConfirmed:z.boolean(),env:environmentSchema,
  }),
  object({
    type: z.literal('reaction-defense'),
    ...actor,
    targetIndex: int.max(99),
    kind: z.enum(['uncanny', 'deflect', 'stone']),
  }),
  object({
    type: z.literal('spell-reroll'),
    ...actor,
    kind: z.enum(['seeking', 'empowered']),
    targetIndex: int.max(99),
    diceIndices: z.array(int.max(99)).max(20),
  }),
  object({
    type: z.literal('trigger-feature'),
    ...actor,
    targetIndex: int.max(99),
    id: z.literal('stun'),
    note: text,
  }),
  object({
    type: z.literal('interact'),
    ...actor,
    cost: z.enum(['free', 'action', 'bonus']),
    note: text,
  }),
  object({ type: z.literal('wake'), ...actor, targetId: id, env: environmentSchema, note: text }),
  object({
    type: z.literal('move'),
    mode:z.enum(['walk','climb','swim','fly','levitate']).optional(),
    ...actor,
    distance: z.number().finite().min(0).max(10000),
    difficult: z.boolean(),
    extraCost: z.number().finite().min(0).max(10000).optional(),
    stand: z.boolean(),
    note: text,
  }),
  object({
    type: z.literal('inspiration'),
    ...actor,
    targetIndex: int.max(100),
    kind: z.enum(['bardic', 'heroic']),
  }),
  object({
    type: z.literal('adjudicate'),
    ...actor,
    targetIds: z.array(id).max(100),
    damage: int,
    damageType: z.enum(DAMAGE_TYPES),
    heal: int,
    condition: text,
    active: z.boolean(),
    rounds: int.max(1000),
    cost: z.enum(['action', 'bonus', 'reaction', 'none']),
    note: text,
  }),
  object({
    type: z.literal('feature'),
    ...actor,
    id,
    targetId: text,
    amount: int,
    purify: z.boolean().optional(),
    kitId: id.optional(),
    triggerActorId: id.optional(),
    rule: object({
      entry: int.max(100),
      count: int.min(1).max(10),
      choice: id.optional(),
    }).optional(),
    env: environmentSchema,
    note: text,
    targets: z.array(id).max(100).optional(),
    targetEnvironments: z.record(id, environmentSchema).optional(),
  }),
  object({ type: z.literal('end-effect'), ...actor, effectId: id, reason: text }),
]) as z.ZodType<CombatCommand>
export const mapCommandSchema = z.discriminatedUnion('type', [
  ...sceneToolCommandSchema.options,
  ...configImportSchema.options,
  object({ type: z.literal('explore'), sceneId: id, command: explorationCommandSchema }),
  object({ type: z.literal('ai-settings'), settings: aiSettingsSchema }),
  object({ type: z.literal('npc-profile'), profile: npcProfileSchema }),
  object({ type: z.literal('npc-party-scope'), npcIds: z.array(id).min(1).max(20) }),
  object({ type: z.literal('npc-template'), template: npcTemplateSchema }),
  object({ type: z.literal('npc-template-delete'), templateId: id }),
  object({ type: z.literal('npc-delete'), npcId: id }),
  object({ type: z.literal('broadcast-template'), template: broadcastTemplateSchema }),
  object({ type: z.literal('broadcast-delete'), templateId: id }),
  object({ type: z.literal('broadcast-reset'), templateId: id }),
  object({ type: z.literal('broadcast-play'), templateId: id, replay: z.boolean() }),
  object({ type: z.literal('broadcast-start') }),
  object({
    type: z.literal('broadcast-mark'),
    title: z.string().min(1).max(120),
    text: z.string().min(1).max(4000),
    audience: broadcastAudienceSchema,
  }),
  object({ type: z.literal('scene-add'), name: text.min(1) }),
  object({ type: z.literal('party'), ids: z.array(id).max(100) }),
  object({ type: z.literal('leave') }),
  object({ type: z.literal('scene-edit'), scene: sceneSchema }),
  object({ type: z.literal('point-link-retry'), sceneId: id, runId: id }),
  object({ type: z.literal('discovery-check'), sceneId: id, attemptId: id }),
  object({
    type: z.enum(['discovery-continue', 'discovery-cancel-route']),
    sceneId: id,
    routeId: id,
  }),
  object({
    type: z.literal('discovery-reset'),
    sceneId: id,
    pointId: id,
    characterId: id.optional(),
  }),
  object({ type: z.literal('wall-toggle'), sceneId: id, wallId: id }),
  object({ type: z.literal('enter'), sceneId: id, landing: position }),
  object({ type: z.literal('token-add'), sceneId: id, characterId: id, position }),
  object({
    type: z.literal('token-edit'),
    sceneId: id,
    token: z.preprocess((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value
      const {
        statuses: _statuses,
        npcType: _npcType,
        portrait: _portrait,
        ...editable
      } = value as Record<string, unknown>
      return editable
    }, sceneSchema.shape.tokens.element),
  }),
  object({
    type: z.literal('move'),
    sceneId: id,
    tokenId: id,
    path: z.array(position).min(1).max(6400),
    gm: z.boolean(),
    reason: text,
    reactionsConfirmed: z.boolean(),
  }),
  object({
    type: z.literal('interact'),
    sceneId: id,
    pointId: id,
    characterId: z.string().max(120),
    npcId: id.optional(),
    itemIds: z.array(id).max(20).optional(),
    confirmItemCosts: z.boolean().optional(),
    itemLimits: z.record(id,z.number().int().min(1).max(10000)).refine(r=>Object.keys(r).length<=20).optional(),
    bypassItems: z.boolean().optional(),
    requestItemRuling: z.boolean().optional(),
    operation: z.enum(['use', 'toggle', 'claim', 'check']),
    gm: z.boolean(),
    reason: text,
  }),
  object({
    type: z.literal('portal-pair'),
    sceneId: id,
    pointId: id,
    targetSceneId: id.nullable(),
    targetPointId: id.nullable(),
    bidirectional: z.boolean(),
  }),
  object({ type: z.literal('encounter-create'), sceneId: id, name: text }),
  ...battleMapSchemas,
  object({ type: z.literal('encounter-link'), sceneId: id, encounterId: id }),
  object({ type: z.literal('encounter-unlink'), sceneId: id }),
  object({
    type: z.literal('combat'),
    resolutionGuard: z
      .object({
        encounterId: id,
        pendingId: z.string().max(128),
        branch: id,
        tick: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    sceneId: id,
    command: combatCommandSchema,
    options: mapOptionsSchema.optional(),
    openingRequestId: id.optional(),
  }),
  object({ type: z.literal('undo') }),
  object({ type: z.literal('restore'), checkpointId: id }),
  object({ type: z.literal('checkpoint-edit'), checkpointId: id, name: text, pinned: z.boolean() }),
  object({ type: z.literal('checkpoint-delete'), checkpointId: id }),
]) as z.ZodType<MapCommand>
export const actionSchema = z.discriminatedUnion('kind', [
  containerActionSchema,
  object({kind:z.literal('m1'),action:m1ActionSchema}),
  object({kind:z.literal('summon'),action:summonActionSchema}),
  object({kind:z.literal('scene-effect'),action:sceneEffectActionSchema}),
  object({kind:z.literal('spatial'),action:m3ActionSchema}),
  object({
    kind: z.literal('npc'),
    npcId: id,
    profileRevision: int,
    conversationId: id,
    characterId: id,
    directive: npcDirectiveSchema,
  }),
  object({ kind: z.literal('map'), command: mapCommandSchema }),
  object({ kind: z.literal('runtime'), characterId: id, command: runtimeSchema }),
  object({
    kind: z.literal('give'),
    fromId: id,
    toId: id,
    instanceId: id,
    quantity: int.min(1).max(10000),
  }),
])
export type RoomAction = z.infer<typeof actionSchema>
export const roomCommandSchema = z.discriminatedUnion('kind', [
  object({ kind: z.literal('review-archive-expired') }),
  object({ kind: z.literal('corpse-loot'), corpseId: id, characterId: id, source: z.enum(['inventory','stock','consumable','coins','equipment']), itemId: id, quantity: z.number().positive().max(1000000) }),
  tradeCommandSchema,
  fogCommandSchema,
  knowledgeCommandSchema,
  object({kind:z.literal('summon-action'),action:summonActionSchema}),
  object({kind:z.literal('m3-spatial'),action:m3ActionSchema}),
  object({kind:z.literal('m1-utility'),action:m1ActionSchema}),
  object({kind:z.literal('story-item-save'),itemId:id,name:text.trim().min(1),description:text,weight:z.number().finite().min(0).max(10000),cost:z.number().finite().min(0).max(1000000)}),
  object({kind:z.literal('story-item-delete'),itemId:id,reason:text.trim().min(1)}),
  object({ kind: z.literal('gm-control'), targetKind: z.enum(['character', 'npc']), targetId: id,
    operation: z.enum(['take', 'release']), reason: text.trim().min(1) }),
  object({ kind: z.literal('gm-control-npc'), npcId: id, directive: npcDirectiveSchema, reason: text.trim().min(1) }),
  object({kind:z.literal('summon-cancel-creation'),draftId:id,note:text.min(1)}),
  object({kind:z.literal('summon-adopt'),encounterId:id,actorId:id,note:text.min(1),confirmed:z.literal(true),originalEndsAt:z.number().finite().nonnegative().optional()}),
  object({kind:z.literal('summon-lifecycle'),instanceId:id,operation:z.enum(['release','end']),receipt:id,note:text.min(1)}),
  object({kind:z.literal('spell-gm-fact'),fact:gmSpellFactSchema}),
  object({kind:z.literal('spell-gm-refresh'),requestId:id,note:text.min(1)}),
  object({kind:z.literal('spell-gm-observe'),requestId:id,observerId:id,method:z.enum(['study','physical','gm']),note:text.min(1)}),
  object({kind:z.literal('spell-gm-use'),requestId:id,action:object({operation:z.enum(['move','operate','aura','switch','probe','resist-probe','reply','communicate','end']),receipt:id,actorId:id,point:gmSpellChoiceSchema.shape.point,objectId:id.optional(),mode:z.enum(['sight','hearing']).optional(),text:text,wordCount:int.min(0).max(1000).optional()})}),
  object({kind:z.literal('spell-gm-npc-cast'),npcId:id,abilityId:id,targetIds:z.array(id).max(100),choice:gmSpellChoiceSchema,note:text.min(1),confirmed:z.literal(true)}),
  object({ kind: z.literal('spell-gm-resolve'), requestId: id,ruleChecks:z.array(z.string().max(200)).max(30).optional(),
    text: z.string().min(1).max(6000), privateNote: z.string().max(4000),
    audience: broadcastAudienceSchema, noResult: z.boolean() }),
  object({ kind: z.literal('spell-gm-cancel'), requestId: id, reason: text.min(1) }),
  object({ kind: z.literal('spell-gm-question'), requestId: id, question: text.min(1) }),
  object({ kind: z.literal('dice-config'), mode: z.enum(['automatic', 'manual']) }),
  object({ kind: z.literal('dice-input'), id, faces: z.array(int.min(1).max(100)).max(100) }),
  object({ kind: z.literal('dice-draft'), id, faces: z.array(int.min(1).max(100)).max(100) }),
  object({ kind: z.literal('dice-auto'), id, reason: text.min(1) }),
  object({ kind: z.literal('dice-cancel'), id, reason: text.min(1) }),
  object({ kind: z.literal('character-submit'), archive: archiveSchema }),
  object({ kind: z.literal('character-withdraw'), requestId: id }),
  object({
    kind: z.literal('character-review'),
    requestId: id,
    approve: z.boolean(),
    resetRuntime: z.boolean().default(false),
    reason: text.min(1),
  }),
  object({
    kind: z.literal('npc-character-copy'),
    npcId: id,
    archive: archiveSchema,
    replace: z.boolean().optional(),
  }),
  object({ kind: z.literal('npc-attach'), npcId: id }),
  object({
    kind: z.literal('scene-effect-visibility'),
    tokenId: id,
    effectId: id,
    visibility: z.enum(['public', 'owner', 'gm']),
  }),
  object({
    kind: z.literal('npc-story-confirm'),
    eventId: id,
    approve: z.boolean(),
    reason: text.min(1),
  }),
  object({ kind: z.literal('npc-test-cancel'), jobId: id }),
  object({ kind: z.literal('npc-memory-pin'), npcId: id, memoryId: id, pinned: z.boolean() }),
  object({ kind: z.literal('npc-inform-event'), npcId: id, eventId: id }),
  object({
    kind: z.literal('npc-memory-delete'),
    npcId: id,
    source: z.enum(['experience', 'dialogue']),
    ids: z.array(id).min(1).max(100),
    confirm: z.literal(true),
  }),
  object({
    kind: z.literal('npc-affinity-set'),
    npcId: id,
    characterId: id,
    score: z.number().int().min(-100).max(100),
    reason: text.min(1),
  }),
  object({
    kind: z.literal('npc-affinity-review'),
    jobId: id,
    approve: z.boolean(),
    reason: text.min(1),
  }),
  object({
    kind: z.literal('npc-activity-check'),
    npcId: id,
    source: z.discriminatedUnion('kind', [
      object({ kind: z.literal('event'), eventId: id }),
      object({ kind: z.literal('template'), templateId: id, characterId: id }),
    ]),
  }),
  object({
    kind: z.literal('npc-activity-test'),
    npcId: id,
    source: z.discriminatedUnion('kind', [
      object({ kind: z.literal('event'), eventId: id }),
      object({ kind: z.literal('template'), templateId: id, characterId: id }),
    ]),
  }),
  object({ kind: z.literal('npc-plan'), npcId: id }),
  object({ kind: z.literal('npc-spatial'), command: npcSpatialCommandSchema }),
  object({kind:z.literal('npc-peer'),operation:z.enum(['propose','approve','next','interrupt','stop','pause']),sessionId:z.string().max(120).optional(),npcIds:z.array(z.string().max(120)).max(4).optional(),npcId:z.string().max(120).optional(),characterId:z.string().max(120).optional(),text:z.string().max(2000).optional()}),
  object({
    kind: z.literal('npc-proactive'),
    npcId: id,
    characterId: id,
    reason: text.min(1),
    visibility: z.enum(['public', 'personal']),
  }),
  object({ kind: z.literal('npc-plan-step'), jobId: id, step: int.max(5), reason: text.min(1) }),
  object({
    kind: z.literal('npc-turn-control'),
    runId: id,
    action: z.enum(['pause', 'resume', 'approve', 'manual', 'reveal', 'conditions', 'rider']),
    reason: text.min(1),
  }),
  object({
    kind: z.literal('npc-proposal'),
    jobId: id,
    directive: npcDirectiveSchema,
    reason: text.min(1),
  }),
  object({ kind: z.literal('model-config'), configuration: modelConfigurationInputSchema }),
  object({ kind: z.literal('model-clear') }),
  object({
    kind: z.literal('model-profile-save'),
    name: z.string().trim().min(1).max(80),
    configuration: modelConfigurationInputSchema,
  }),
  object({ kind: z.literal('model-profile-test'), name: z.string().min(1).max(80) }),
  object({ kind: z.literal('model-profile-delete'), name: z.string().min(1).max(80) }),
  object({ kind: z.literal('narration-skill-test') }),
  object({ kind: z.literal('narration-request'), summary: z.boolean().default(false) }),
  object({
    kind: z.literal('narration-review'),
    jobId: id,
    operation: z.enum(['publish', 'skip', 'retry', 'fallback', 'cancel']),
    text: z.string().max(6000).optional(),
  }),
  object({
    kind: z.literal('npc-fixed-talk'),
    npcId: id,
    characterId: id,
    message: text.min(1).optional(),
  }),
  object({
    kind: z.literal('npc-talk-group'),
    requestedSkill: z
      .enum(['persuasion', 'deception', 'intimidation', 'performance', 'animal-handling'])
      .optional(),
    primaryNpcId: id.optional(),
    goal: text.optional(),
    npcIds: z
      .array(id)
      .min(1)
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length, '交谈对象不能重复'),
    characterId: id,
    message: text.min(1),
    mode: z.enum(['group', 'shout']),
  }),
  object({ kind: z.literal('quest-save'), quest: questSchema }),
  object({
    kind: z.literal('quest-step-review'),
    questId: id,
    suggestionId: id,
    approve: z.boolean(),
  }),
  object({ kind: z.literal('message-delivery'), mode: z.enum(['web', 'both']) }),
  object({ kind: z.literal('npc-talk-withdraw'), jobId: id }),
  object({kind:z.literal('npc-planning-speech-retry'),jobId:id}),
  object({
    kind: z.literal('npc-talk'),
    requestedSkill: z
      .enum(['persuasion', 'deception', 'intimidation', 'performance', 'animal-handling'])
      .optional(),
    npcId: id,
    characterId: id,
    message: text.min(1),
    goal: text,
    visibility: z.enum(['public', 'personal']),
  }),
  object({
    kind: z.literal('npc-group-influence-review'),
    jobId: id,
    targets: z
      .array(
        z
          .object({
            npcId: id,
            dc: int.min(1).max(100),
            attitude: text.min(1),
            consequence: text.min(1),
          })
          .strict(),
      )
      .max(4),
  }),
  object({
    kind: z.literal('npc-talk-review'),
    jobId: id,
    approve: z.boolean(),
    skill: z.string().max(120),
    dc: int.min(1).max(100),
    check: z.enum(['none', 'roll', 'willing', 'unwilling']),
    cooldownHours: z.number().finite().min(0).max(8760).default(24),
    ignoreCooldown: z.boolean().default(false),
    cost: z.enum(['action', 'none']),
    reason: text.min(1),
    constraints: text,
  }),
  object({
    kind: z.literal('npc-reply-review'),
    jobId: id,
    approve: z.boolean(),
    text: text.optional(),
    proposal: npcDirectiveSchema.optional(),
    finishTurn: z.boolean().optional(),
    conditionsConfirmed: z.boolean().optional(),
    reason: text.min(1),
  }),
  object({ kind: z.literal('npc-reevaluate'), jobId: id }),
  object({kind:z.literal('practical-response'),windowId:id,actorId:id,operation:z.enum(['delivered','choose','pass']),optionId:id.optional(),diceIndices:z.array(int).max(20).optional(),requirementsConfirmed:z.boolean().optional()}),
  object({kind:z.literal('practical-takeover'),taskId:id}),
  object({kind:z.literal('practical-recheck'),taskId:id}),
  object({kind:z.literal('practical-staging-roll'),requestId:id}),
  object({kind:z.literal('practical-frame-action'),eventId:id,command:combatCommandSchema}),
  object({kind:z.literal('practical-effect-input'),taskId:id,operation:z.enum(['delivered','submit']).optional(),to:z.object({x:z.number().int().min(0).max(79),y:z.number().int().min(0).max(79),height:z.number().finite().min(0).max(10000)}).strict().optional(),reaction:z.enum(['use','decline']).optional()}),
  object({kind:z.literal('practical-spell-input'),intentId:id,operation:z.enum(['consent','decline','begin-casting','cancel-casting']),targetId:id.optional()}),
  object({kind:z.literal('practical-initiative'),windowId:id,actorId:id,operation:z.enum(['delivered','pass','reroll','offer-swap','accept-swap','decline-swap','before']),targetId:id.optional()}),
  ...actionSchema.options,
  object({
    kind: z.literal('character-import'),
    archives: z.array(archiveSchema).min(1).max(100),
    asPlayerCopy: z.boolean().optional(),
  }),
  object({
    kind: z.literal('control'),
    sessionId: id,
    characterIds: z.array(id).max(100),
    actorIds: z.array(id).max(100).default([]),
    revoked: z.boolean().default(false),
  }),
  object({
    kind: z.literal('invite-rotate'),
    invite: z.string().regex(/^(?:[A-HJ-NP-Z2-9]{8}|[A-Za-z0-9_-]{24,128})$/),
    hours: int.min(1).max(720).optional(),
  }),
  object({
    kind: z.literal('invite-policy'),
    enabled: z.boolean(),
    hours: int.min(1).max(720).optional(),
  }),
  object({ kind: z.literal('lan-review'), id, approve: z.boolean() }),
  object({ kind: z.literal('environment'), environment: environmentSchema }),
  object({
    kind: z.literal('background'),
    scene: sceneSchema,
    asset: mapArchiveSchema.shape.assets.element,
  }),
  object({
    kind: z.literal('ai-create'),
    name: text.min(1),
    token: z.string().min(32).max(128),
    characterIds: z.array(id).max(100),
    actorIds: z.array(id).max(100),
  }),
  object({
    kind: z.literal('gm-review-config'),
    settings: reviewSettingsSchema.omit({ revision: true }),
  }),
  object({
    kind: z.literal('gm-review-control'),
    intentId: id,
    jobId: id.optional(),
    operation: z.enum(['send', 'takeover', 'wrong', 'missing']),
  }),
  openingCommandSchema,
  object({
    kind: z.literal('intent-submit'),
    action: actionSchema,
    summary: text.min(1),
    source: z.enum(['external', 'sealchat', 'player']),
    baseWorldRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  }),
  object({
    kind: z.literal('intent-review'),
    intentId: id,
    approve: z.boolean(),
    reason: text.min(1),
    environment: environmentSchema.optional(),
    itemCost: z.enum(['action', 'bonus', 'free']).optional(),
    targets: z.array(id).min(1).max(100).optional(),
    targetEnvironments: z.record(id, environmentSchema).optional(),
    mapOptions: mapOptionsSchema.optional(),
    npcDirective: npcDirectiveSchema.optional(),
  }),
])
export type RoomCommand = z.infer<typeof roomCommandSchema>
export const requestSchema = object({
  id: z.string().uuid(),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  command: roomCommandSchema,
})
export const createRoomSchema = object({
  name: z.string().min(1).max(120),
  nickname: z.string().min(1).max(80),
  archive: mapArchiveSchema,
  characters: z.array(archiveSchema).max(100).default([]),
})
export const joinRoomSchema = object({
  invite: z
    .string()
    .trim()
    .regex(/^(?:[A-HJ-NP-Z2-9]{8}|[A-Za-z0-9_-]{16,128})$/i)
    .transform((s) => (s.length === 8 ? s.toUpperCase() : s)),
  nickname: z.string().min(1).max(80),
})
export interface RoomMember {
  internalNpcId?: string
  id: string
  nickname: string
  role: 'gm' | 'player' | 'ai'
  tokenHash: string
  characterIds: string[]
  actorIds: string[]
  revoked: boolean
}
export interface Intent {
  id: string
  sessionId: string
  summary: string
  source: string
  action: RoomAction
  pendingWindow?: string
  sceneEffectContext?:{sceneId:string;branch:string;encounterId?:string;tick?:number}
  baseWorldRevision: number
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'stale'
  reason: string
  at: string
  adjudication?: {
    environment: Environment
    itemCost?: 'action' | 'bonus' | 'free'
    targets?: string[]
    targetEnvironments?: Record<string, Environment>
    mapOptions?: MapCombatOptions
    npcDirective?: import('../core/ai-types').NpcDirective
  }
}
export interface Room {
  openingReadings?: OpeningReadings
  peerSessions?: import('../server/npc-peer-dialogue').PeerSession[]
  reviewArchive?: string[]
  mapFeedback?: import('./map-feedback-types').RoomMapFeedback
  practicalReview?: import('../persistence/practical-review-schema').PracticalState
  messageDeliveryState?: { generation: number; boundary: number; branchId: string }
  messageDelivery?: 'web' | 'both'
  lastSavedAt?: string
  gmReview?: import('./gm-review-types').GmReviewState
  shortCode?: string
  inviteExpiresAt?: string
  inviteEnabled?: boolean
  lanRequests?: {
    id: string
    nickname: string
    tokenHash: string
    status: 'pending' | 'approved' | 'rejected'
    at: string
    memberId?: string
  }[]
  dice?: import('./dice-types').RoomDiceState
  qq?: import('./qq-types').QqRoomState
  characterRequests?: import('../core/character-request-types').CharacterRequest[]
  characterRequestSources?: Record<string, string>
  modelProfiles?: { name: string; configuration: ModelConfiguration }[]
  aiModel?: ModelConfiguration
  broadcastAcks?: Record<string, number>
  version: 1
  id: string
  name: string
  revision: number
  worldRevision: number
  world: MapWorld
  characterSources?: Record<string, string>
  inviteHash: string
  members: RoomMember[]
  environment: Environment
  intents: Intent[]
  events: { id: string; at: string; detail: string; sessionId?: string; characterId?: string }[]
  receipts: { id: string; sessionId: string; hash: string; revision: number }[]
}
export interface PublicScene {
  corpses?: import("../server/room-corpses").CorpseView[]
  fog?: import('../persistence/fog-schema').FogView
  sceneEffects?:import('../core/scene-effect-view').SceneMapEffects
  lastKnownTokens?:{id:string;name:string;x:number;y:number;height:number}[]
  discovery?: {
    attempts: { id: string; characterId: string; status: string }[]
    routes: { id: string; characterId: string; tokenId: string; steps: number }[]
  }
  spatialObjects?:Pick<import('../persistence/m3-world-schema').M3Entity,'id'|'name'|'kind'|'x'|'y'|'height'|'width'|'heightFeet'|'depth'>[]
  groundItems?: Omit<import('../core/scene-tools-types').GroundItem, 'note' | 'initialQuantity'>[]
  awaitingTokens?: { id: string; name: string; x: number; y: number; color: string }[]
  id: string
  name: string
  note: string
  grid: MapScene['grid']
  background: MapScene['background']
  tokens: (MapScene['tokens'][number] & {
    portrait?: string | null
    npcType?: 'important' | 'ordinary'
    statuses?: import('../core/status-summary').StatusSummary[]
  })[]
  regions: MapScene['regions']
  annotations: MapScene['annotations']
  walls?: MapScene['walls']
  sightLines?: {
    fromId: string
    toId: string
    sightRay?:import('../core/scene-ray-view').SceneRayView
    targetRay?:import('../core/scene-ray-view').SceneRayView
    sightClear: boolean
    targetingClear: boolean
    cover?: Environment['cover']
  }[]
  areaCandidates?: {
    tokenId: string
    inside: boolean
    blocked: boolean
    eligible: boolean
    cover: Environment['cover']
  }[]
  template: MapScene['template']
  points: (Pick<
    MapScene['points'][number],
    'id' | 'x' | 'y' | 'kind' | 'name' | 'state' | 'revealed' | 'repeatAccess'
  > & { reviewRequired?: boolean; acceptsItems?: boolean; itemReviewAvailable?: boolean; displayPosition?: { x: number; y: number } })[]
}
export interface RoomView {
  openingReading?: OpeningReadingView
  peerSessions?: Omit<import('../server/npc-peer-dialogue').PeerSession,'transcript'>[]
  reviewArchive?: string[]
  expiredReviewCount?: number
  archivedAiReviewIds?: string[]
  archivedPracticalReviewIds?: string[]
  trade?: import('../persistence/trade-schema').TradeView
  fogPreview?: import('../persistence/fog-schema').FogView
  npcSpatial?: { npcId: string; observation: ReturnType<typeof import('../server/npc-spatial-observation').npcSpatialObservation> }
  summons?:import('../server/room-summons').SummonView[]
  summonChoices?:ReturnType<typeof import('../server/room-summons').summonChoices>
  summonTouchChoices?:ReturnType<typeof import('../server/room-summons').summonTouchChoices>
  summonCorpses?:ReturnType<typeof import('../server/room-summons').summonCorpses>
  gmControls?: Omit<import('../core/gm-control-types').GmControl, 'previousController'>[]
  gmSpells?: import('../core/spell-workflow-types').GmSpellRequest[]
  messageDelivery?: 'web' | 'both'
  lastSavedAt?: string
  quests?: import('../persistence/quest-schema').Quest[]
  gmReview?: import('./gm-review-types').GmReviewView
  practicalReview?: import('../server/practical-review-state').PracticalReviewView
  practicalWindows?: ReturnType<typeof import('../server/practical-combat').practicalCombatView>
  practicalInitiative?: ReturnType<typeof import('../server/practical-initiative').practicalInitiativeView>
  practicalSpellInputs?: ReturnType<typeof import('../server/practical-spell-inputs').practicalSpellInputView>
  practicalM1?:ReturnType<typeof import('../server/room-m1').practicalM1Choices>
  practicalEffectInputs?:ReturnType<typeof import('../server/practical-effect-inputs').practicalEffectInputView>
  historyAvailable?: boolean
  canUndo?: boolean
  shortCode?: string
  invitation?: { expiresAt: string | null; enabled: boolean }
  lanRequests?: {
    id: string
    nickname: string
    status: 'pending' | 'approved' | 'rejected'
    at: string
  }[]
  dice?: import('./dice-types').RoomDiceView
  exploration?: import('../core/exploration-types').ExplorationState
  characterRequests?: import('../core/character-request-types').CharacterRequest[]
  battleRequests: {
    sceneId?: string
    opening?: BattleRequest['opening']
    openingStatus?: BattleRequest['openingStatus']
    encounterId?: string
    characterId: string | null
    id: string
    reason: string
    status: 'pending' | 'accepted' | 'rejected'
    reviewReason: string
  }[]
  ai: AiView
  broadcast: BroadcastFeed
  mapFeedback?: import('./map-feedback-types').MapFeedbackFeed
  id: string
  name: string
  revision: number
  worldRevision: number
  self: Omit<RoomMember, 'tokenHash'>
  members: Omit<RoomMember, 'tokenHash'>[]
  scene: PublicScene | null
  sceneNames: { id: string; name: string }[]
  characters: { id: string; name: string; portrait?: string | null }[]
  importedCharacterIds: string[]
  ownCharacters: Character[]
  packs: Pack[]
  environment: Environment
  encounter: {
    id: string
    name: string
    phase: string
    round: number
    tick: number
    currentId: string
    pending: boolean
    endTurnBlocked?: boolean
    pendingAction: {
      damageRolled?: boolean
      id?: string
      spellId?: string | null
      damageDice?: { index: number; value: number }[]
      damageRerolls?: (DamageReroll & { targetIndex: number })[]
      tavernRerollAvailable?: boolean
      name: string
      kind: 'attack' | 'save' | 'automatic' | 'manual'
      actorId: string
      targets: {
        id: string
        index: number
        defenseChoices?: ('uncanny' | 'deflect' | 'stone')[]
        defense?: { kind: 'uncanny' | 'deflect' | 'stone'; reduction: number }
        shieldAvailable: boolean
        roll: D20Result | null
        failed: boolean | null
      }[]
    } | null
    actors: {
      statuses?: import('../core/status-summary').StatusSummary[]
      portrait?: string | null
      id: string
      characterId: string | null
      companion?: {
        ownerId: string
        source: string
        hp: number
        maxHp: number
        dismissed: boolean
        form?: string
        spellId?: string
      }
      name: string
      side: string
      initiative: number | null
      movement: number
      attacks: AttackSpec[]
      turn: TurnBudget | null
      slotSpent: boolean
    }[]
  } | null
  events: Room['events']
  intents: Intent[]
  world?: MapWorld
  assets: (Omit<MapAsset, 'blob' | 'preview'> & {
    preview?: { mime: MapAsset['mime']; width: number; height: number }
  })[]
}
