import {spellKeySchema} from './item-spell-schema'
import {gmSpellChoiceSchema} from './gm-spell-choice-schema'
import { m3CastChoiceSchema } from '../persistence/m3-schema'
import { z } from 'zod'
import { weaponHandlingOperationSchema } from './weapon-handling-schema'
import { DAMAGE_TYPES, type Encounter } from '../core/combat-types'
import { characterSchema, effectSchema, packSchema, snapshotSchema, inventorySchema } from './schema'
import { areaTemplateSchema } from './area-schema'
import { npcTemplateMetadataSchema } from './npc-template-schema'
import { npcMonsterAbilitySchema, npcResourcePoolSchema } from './npc-ability-schema'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((x) => !['__proto__', 'prototype', 'constructor'].includes(x))
const text = z.string().max(20000),
  int = z.number().int().finite(),
  type = z.enum(DAMAGE_TYPES)
const ability = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const values = z.object({ str: int, dex: int, con: int, int: int, wis: int, cha: int }).strict()
const turn = z
  .object({
    npcMultiattackOptions: z.array(id).max(8).optional(),
    npcMultiattackLeft: z.array(id).max(8).optional(),
    lastAttack: z
      .object({
        targetDown: z.boolean().optional(),
        targetId: id,
        weaponId: id.nullable(),
        unarmed: z.boolean(),
        ranged: z.boolean(),
        type,
        critical: z.boolean(),
        hit: z.boolean(),
        damaged: z.boolean(),
        tick: int.nonnegative(),
        token: id,
      })
      .strict()
      .optional(),
    lastSpell: z
      .object({ id, school: text, slot: int.min(0).max(3), token: id })
      .strict()
      .optional(),
    levelSpellCast: z.boolean().optional(),
    quickenedCast: z.boolean().optional(),
    flurryLeft: int.min(0).max(2).optional(),
    deathSaveDone: z.boolean().default(false),
    objectInteraction: z.boolean().default(true),
    action: z.boolean(),
    manualUsed: z.array(id).max(30).optional(),
    groundTrail: z
      .array(
        z
          .object({ x: z.number().int().min(0).max(79), y: z.number().int().min(0).max(79) })
          .strict(),
      )
      .max(200)
      .optional(),
    attacksLeft: int.min(0).max(7).optional(),
    surgeUsed: z.boolean().optional(),
    surgeAction: z.boolean().optional(),
    bonus: z.boolean(),
    reaction: z.boolean(),
    movement: int.min(0).max(10000),
    dash: int.min(0).max(10000),
    lightWeapon: id.nullable(),
    lightWeapons: z.array(id).max(40).optional(),
    lightUsed: z.boolean(),
    nickUsed: z.boolean(),
    cleaveUsed: z.boolean(),
    sneakUsed: z.boolean(),
    savageUsed: z.boolean(),
    loading: z.array(id).max(100),
  })
  .strict()
const npc = z
  .object({
    equipment:z.array(z.object({id,objectId:id,itemId:id,attackIds:z.array(id).max(30),held:z.boolean(),magical:z.boolean(),proficient:z.boolean().optional(),material:z.enum(['metal','wood','other'])}).strict()).max(30).optional(),
    prayerHealingSinceLongRest:z.boolean().optional(),
    resistanceUsedTurn: z.string().max(300).nullable().optional(),
    abilities: z.array(npcMonsterAbilitySchema).max(40).optional(),
    resources: z.array(npcResourcePoolSchema).max(30).optional(),
    spellcasting: z
      .object({ ability, dc: int.min(0).max(50), attackBonus: int.min(-30).max(50),level:int.min(1).max(20).optional() })
      .strict()
      .optional(),
    concentration: z
      .object({
        spellId: id,
        castId:id.optional(),
        clockSourceId:id.optional(),
        endsAt:z.number().finite().nonnegative().optional(),
        pendingDC: int.min(10).max(100000).optional(),
        expiresAt: int.nonnegative().optional(),
        encounterId: id.optional(),
      })
      .strict()
      .optional(),
    magicResistance: z.boolean().optional(),
    authorityAura: z.boolean().optional(),
    shape: z.enum(['imp', 'rat', 'raven', 'spider']).optional(),
    templateMetadata: npcTemplateMetadataSchema.optional(),
    multiattackChoice: z
      .object({ count: int.min(1).max(8), attackIds: z.array(id).min(1).max(8) })
      .strict()
      .optional(),
    nimbleEscape: z.boolean().optional(),
    bloodiedFury: z.boolean().optional(),
    undeadFortitude: z.boolean().optional(),
    size: z.enum(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']).optional(),
    multiattack: z.array(id).min(1).max(8).optional(),
    packTactics: z.boolean().optional(),
    name: text.min(1),
    ac: int.min(0).max(100),
    maxHp: int.positive().max(100000),
    hp: int.nonnegative().max(100000),
    temporaryHp: int.nonnegative().max(100000),
    creatureType: z
      .enum(['humanoid', 'beast', 'monstrosity', 'celestial', 'fey', 'fiend', 'undead', 'giant', 'other'])
      .optional(),
    speed: int.min(0).max(300),
    scores: values,
    saves: values,
    initiativeBonus: int.min(-100).max(100),
    attacks: z
      .array(
        z
          .object({
            id,
            name: text.min(1),
            extraDamage: z
              .array(
                z
                  .object({ formula: text, type, when: z.enum(['advantage', 'charge']).optional() })
                  .strict(),
              )
              .max(3)
              .optional(),
            effectNote: text.optional(),
            manualOnly: z.boolean().optional(),
            ability:ability.optional(),
            proneMaxSize: z.enum(['medium', 'large']).optional(),
            proneRequiresCharge: z.boolean().optional(),
            advantageWhileGrappling: z.boolean().optional(),
            bonus: int.min(-30).max(50),
            damage: text,
            damageType: type,
            reach: int.min(0).max(300),
            range: int.min(0).max(2000),
            longRange: int.min(0).max(2000),
            projectile: z.enum(['ordinary','massive','energy']).optional(),
            unarmed:z.boolean().optional(),
            kind: z.enum(['weapon', 'thrown', 'spell']).optional(),
          })
          .strict(),
      )
      .max(30),
    resistances: z.array(type).max(13),
    vulnerabilities: z.array(type).max(13),
    immunities: z.array(type).max(13),
    conditionImmunities: z.array(id).max(30),
    conditions: z.array(id).max(30),
    effects: z.array(effectSchema).max(100),
    dead: z.boolean(),
    source: text,
  })
  .strict()
export const npcSchema = npc.superRefine((n, ctx) => {
  if (
    new Set(n.abilities?.map((a) => a.id)).size !== (n.abilities?.length ?? 0) ||
    new Set(n.resources?.map((r) => r.id)).size !== (n.resources?.length ?? 0)
  )
    ctx.addIssue({ code: 'custom', message: '怪物能力／资源ID不能重复' })
  if (n.abilities?.some((a) => a.resourceId && !n.resources?.some((r) => r.id === a.resourceId)))
    ctx.addIssue({ code: 'custom', message: '怪物能力引用不存在的资源池', path: ['abilities'] })
  if (new Set(n.attacks.map((a) => a.id)).size !== n.attacks.length)
    ctx.addIssue({ code: 'custom', message: '攻击ID不能重复', path: ['attacks'] })
  if (n.multiattack?.some((id) => !n.attacks.some((a) => a.id === id)))
    ctx.addIssue({ code: 'custom', message: '多重攻击引用了不存在的攻击', path: ['multiattack'] })
  if (n.multiattack && n.multiattackChoice)
    ctx.addIssue({
      code: 'custom',
      message: '固定与任选多重攻击不可同时配置',
      path: ['multiattackChoice'],
    })
  if (
    n.multiattackChoice &&
    (new Set(n.multiattackChoice.attackIds).size !== n.multiattackChoice.attackIds.length ||
      n.multiattackChoice.attackIds.some((id) => !n.attacks.some((a) => a.id === id)))
  )
    ctx.addIssue({ code: 'custom', message: '任选多重攻击引用无效', path: ['multiattackChoice'] })
})
const actor = z
  .object({
    npcId: id.optional(),
    id,
    companion: z
      .object({
        instanceId:id.optional(),castId:id.optional(),sourceEntityId:id.optional(),
        ownerId: id,
        source: z.enum(['wild-companion', 'spell-summon', 'primal-companion', 'wild-surge']),
        surgeId: id.optional(),
        expiresHour: z.number().finite().nonnegative().optional(),
        spellId: id.optional(),
        castingAbility: ability.optional(),
        ownerLevel: int.min(1).max(5).optional(),
        slotLevel: int.min(0).max(9).optional(),
        form: id.optional(),
        controllerExpired:z.boolean().optional(),worldManaged:z.boolean().optional(),controlledMount:z.boolean().optional(),
        commandText:z.string().max(1000).optional(),
        commandedTick: int.nonnegative().optional(),
        deathAt: z.number().finite().nonnegative().nullable().optional(),
        reviveAt: z.number().finite().nonnegative().nullable().optional(),
        expiresAfterRest: z.number().finite().nullable(),
        dismissed: z.boolean(),
      })
      .strict()
      .optional(),
    characterId: id.nullable(),
    npc: npc.nullable(),
    side: z.enum(['party', 'enemy', 'neutral']),
    initiative: int.min(-100).max(100).nullable(),
    initiativeRoll:z.object({dice:z.array(int.min(1).max(20)).min(1).max(2),chosen:int.min(1).max(20),bonus:int.min(-1000).max(1000),bonusDice:z.array(int.min(-100).max(100)).max(100),total:int.min(-10000).max(10000),mode:z.enum(['normal','advantage','disadvantage']),reasons:z.array(text).max(100),autoFail:z.boolean()}).strict().optional(),
    surprised: z.boolean(),
    turn,
  })
  .strict()
const environment = z
  .object({
    windWallMiss: z.boolean().optional(),
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
    attackAdvantages: z.array(text).max(100).optional(),
    spatial: text.optional(),
  })
  .strict()
const roll = z
  .object({
    dice: z.array(int.min(1).max(20)).max(2),
    chosen: int.min(0).max(20),
    bonus: int.min(-1000).max(1000),
    bonusDice: z.array(int.min(-100).max(100)).max(100),
    total: int.min(-10000).max(10000),
    mode: z.enum(['normal', 'advantage', 'disadvantage']),
    reasons: z.array(text).max(100),
    autoFail: z.boolean(),
  })
  .strict()
  .refine((r) => r.autoFail || (r.dice.length > 0 && r.chosen > 0), '实际检定必须有有效 d20')
const damage = z
  .object({
    rerolls: z
      .array(
        z
          .object({
            index: int.min(0).max(99),
            from: int.min(1).max(100),
            to: int.min(1).max(100),
            reason: z.enum(['tavern-brawler', 'healer']),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    formula: text,
    dice: z.array(int.min(1).max(100)).max(100),
    flat: int.min(-100000).max(100000),
    total: int.nonnegative().max(100000),
  })
  .strict()
const spec = z
  .object({
    damageBonus: int.min(-3).max(3).optional(),
    proneMaxSize: z.enum(['medium', 'large']).optional(),
    proneRequiresCharge: z.boolean().optional(),
    advantageWhileGrappling: z.boolean().optional(),
    extraDamage: z
      .array(
        z
          .object({ formula: text, type, when: z.enum(['advantage', 'charge']).optional() })
          .strict(),
      )
      .max(3)
      .optional(),
    effectNote: text.optional(),
    id,
    name: text,
    bonus: int,
    ability,
    abilityKnown:z.boolean().optional(),
    modifier: int,
    damage: text,
    type,
    ranged: z.boolean(),
    reach: int.nonnegative(),
    range: int.nonnegative(),
    projectile: z.enum(['ordinary','massive','energy']).optional(),
    longRange: int.nonnegative(),
    weaponId: id.nullable(),
    instanceId: id.nullable(),
    properties: z.array(text).max(30),
    mastery: text.nullable(),
    page: int.nonnegative(),
  })
  .strict()
export const metamagicSchema = z
  .object({
    option: z.enum([
      'careful',
      'distant',
      'extended',
      'heightened',
      'quickened',
      'subtle',
      'transmuted',
      'twinned',
    ]),
    protectedIds: z.array(id).max(100),
    heightenedId: z.string().max(120),
    damageType: type,
  })
  .strict()
const hitWindow = z.object({id,attackId:id,actorId:id,targetId:id,spellId:id,status:z.enum(['pending','attached','canceled']),critical:z.boolean()}).strict()
const pending = z
  .object({
    iceBurst:z.object({targetIds:z.array(id).max(100),envs:z.record(id,environment),slot:int.min(1).max(9),dc:int.min(1).max(100)}).strict().optional(),
    gmChoice:gmSpellChoiceSchema.optional(),
    attackWindowId:id.optional(),
    m5EffectId:id.optional(),
    m5Area:areaTemplateSchema.optional(),
    attackLocked:z.boolean().optional(),
    m3WorldId:id.optional(),
    summonDraftId:id.optional(),
    sceneEffectCastId:id.optional(),
    notCasting:z.boolean().optional(),
    reactionFrame:z.object({kind:z.enum(['shield','counterspell']),dc:int.min(0).max(100).optional(),env:environment.optional()}).strict().optional(),
    concentrationSave:z.object({actorId:id,spellId:id,castId:id.optional(),dc:int.min(1)}).strict().optional(),
    zoneCreation:z.object({id,sourceId:id,castId:id.optional(),spellId:z.enum(['moonbeam','spirit-guardians','cloud-of-daggers','hunger-of-hadar','cordon-of-arrows']),name:text,dc:int.min(1).max(100),slotLevel:int.min(1).max(9),damageType:type,expiresHour:z.number().finite().nonnegative(),excludedIds:z.array(id).max(100),triggered:z.record(id,int.nonnegative()),note:text,createdTick:int.nonnegative().optional(),ammunition:int.min(0).max(18).optional(),template:areaTemplateSchema.optional()}).strict().optional(),
    zoneAmmo:z.object({instanceId:id,count:int.min(1).max(18)}).strict().optional(),
    enfeeblementReduced:z.boolean().optional(),
    controlRegion:z.object({sceneId:id,template:areaTemplateSchema}).strict().optional(),
    afterWeapon: z.array(weaponHandlingOperationSchema).max(2).optional(),
    unarmed: z
      .object({
        kind: z.enum(['grapple', 'prone', 'push']),
        hand: z.enum(['main-hand', 'off-hand']),
        range: int.min(5).max(30),
        pushTo: z
          .object({ x: int.min(0).max(79), y: int.min(0).max(79) })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    m3Choice: m3CastChoiceSchema.optional(),
    supportChoice: id.optional(),
    controlChoices:z.record(id,id).optional(),
    controlTargets:z.array(id).max(100).optional(),
    controlText:z.string().max(2000).optional(),
    boundWeaponId: id.optional(),
    dispelZoneId:id.optional(),
    bonusDamage: z
      .array(z.object({ type, roll: damage }).strict())
      .max(20)
      .optional(),
    damageRolled: z.boolean().optional(),
    resolutionDraft: z.array(z.string().min(1).max(300)).max(100).optional(),
    damageChoices: z.object({ savage: z.boolean(), tavernReroll: z.boolean() }).strict().optional(),
    damageAlways: z.boolean().optional(),
    kind: z.enum(['attack', 'save', 'automatic', 'manual']),
    id: id.default(() => crypto.randomUUID()),
    metamagic: metamagicSchema.optional(),
    triggered: z.array(id).max(100).optional(),
    actorId: id,
    name: text,
    page: int.nonnegative(),
    spellId: id.nullable(),
    itemReceipt:z.object({receiptId:id,item:inventorySchema}).strict().optional(),
    slotReceipt:z.object({resourceId:id,created:z.boolean()}).strict().optional(),
    utilityId:id.optional(),
    castingId:id.optional(),
    sanctuaryFailures:z.array(id).max(100).optional(),
    sanctuaryPassed:z.array(id).max(100).optional(),
    sourceKey: spellKeySchema.optional(),
    slotLevel: int.min(0).max(3).optional(),
    attack: spec.nullable(),
    targets: z
      .array(
        z
          .object({
            acBonus: int.nonnegative().max(50).optional(),
            sanctuaryBlocked:z.boolean().optional(),
            mirror:z.object({effectId:id,rolls:z.array(int.min(1).max(6)).max(3),destroyed:z.boolean()}).strict().optional(),
            hitSpellDamage: z.array(z.object({type,roll:damage}).strict()).max(30).optional(),
    damageOverride: z
              .array(z.object({ type, roll: damage }).strict())
              .max(20)
              .optional(),
            interceptions: z
              .array(
                z
                  .object({
                    sourceId: id,
                    reduction: int.nonnegative().max(1000),
                    kind: z.enum(['interception', 'protective-field', 'maneuver-parry']).optional(),
                  })
                  .strict(),
              )
              .max(100)
              .optional(),
            defense: z
              .object({
                kind: z.enum(['uncanny', 'deflect', 'stone']),
                reduction: int.nonnegative().max(1000),
              })
              .strict()
              .optional(),
            id,
            env: environment,
            roll: roll.nullable(),
            hit: z.boolean(),
            critical: z.boolean(),
            ac: int,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    damage: z.array(z.object({ type, roll: damage }).strict()).max(20),
    save: ability.nullable(),
    dc: int.nullable(),
    half: z.boolean(),
    effectKey: id.nullable(),
    modifier: int,
    mode: text,
    notes: z.array(text).max(100),
    sneak: z.boolean(),
    mastery: z.boolean(),
    startedAt: int.nonnegative(),
  })
  .strict()
const state = z
  .object({
    session: z
      .object({
        intro: z.string().max(2000).optional(),
        introPlayed: z.boolean().optional(),
        canceled: z.boolean().optional(),
        adventureId: id,
        sceneId: id,
        preparedAt: z.string().datetime(),
        startedAt: z.string().datetime().nullable(),
      })
      .strict()
      .optional(),
    id,
    name: text.min(1),
    version: z.literal(1),
    zones: z
      .array(
        z
          .object({
            id,
            sourceId: id,
            castId:id.optional(),
            spellId: z.enum([
              'moonbeam',
              'spirit-guardians',
              'cloud-of-daggers',
              'hunger-of-hadar',
              'cordon-of-arrows',
            ]),
            template: areaTemplateSchema.optional(),
            createdTick: int.nonnegative().optional(),
            explorationTriggered: z.array(id).max(2000).optional(),
            ammunition: int.nonnegative().max(18).optional(),
            phaseTriggered: z
              .record(
                id,
                z
                  .object({
                    start: int.nonnegative().optional(),
                    end: int.nonnegative().optional(),
                    enter: int.nonnegative().optional(),
                  })
                  .strict(),
              )
              .optional(),
            name: text,
            dc: int.min(1).max(100),
            slotLevel: int.min(1).max(9),
            damageType: type,
            expiresHour: z.number().finite().nonnegative(),
            excludedIds: z.array(id).max(100),
            triggered: z.record(id, int.nonnegative()),
            note: text,
          })
          .strict(),
      )
      .max(100)
      .optional(),
    phase: z.enum(['setup', 'active', 'ended']),
    round: int.min(0).max(100000),
    tick: int.min(0).max(1000000),
    current: int.min(0).max(99),
    actors: z.array(actor).max(100),
    pending: pending.nullable(),
    attackWindows:z.array(hitWindow).max(200).optional(),
    attackParents:z.array(pending).max(16).optional(),
    reactionParents:z.array(pending).max(16).optional(),
    slotSpent: z.array(id).max(100),
    lastDamage: z
      .object({ actorId: id, sourceId: z.string().max(120), tick: int.nonnegative() })
      .strict()
      .nullable(),
  })
  .strict()
const snapshot = z
  .object({
    encounter: state,
    characters: z.record(
      id,
      z
        .object({
          state: snapshotSchema,
          revision: int.nonnegative(),
          journal: characterSchema.shape.journal,
        })
        .strict(),
    ),
  })
  .strict()
export const encounterSchema = state
  .extend({
    log: z
      .array(
        z
          .object({
            id,
            at: z.string().datetime(),
            kind: id,
            damageResults: z
              .array(
                z
                  .object({
                    actorId: id,
                    pendingId: id.nullable(),
                    damage: int.nonnegative(),
                    types: z.string().max(200),
                    damageReceived:z.number().int().nonnegative().optional(),
                    receivedTypes:z.partialRecord(z.enum(DAMAGE_TYPES),z.number().int().nonnegative()).optional(),
                    typeAmounts:z.partialRecord(z.enum(DAMAGE_TYPES),z.number().int().nonnegative()).optional(),
                  })
                  .strict(),
              )
              .max(100)
              .optional(),
            outcomes: z
              .array(
                z
                  .object({
                    actorId: id,
                    kind: z.enum(['save', 'concentration', 'death-save', 'check']),
                    total: z.number().finite(),
                    success: z.boolean(),
                  })
                  .strict(),
              )
              .max(200)
              .optional(),
            detail: text,
            before: snapshot.nullable(),
            revisions: z.record(id, int.nonnegative()),
            undone: z.boolean(),
          })
          .strict(),
      )
      .max(80),
  })
  .strict()
export const encounterArchiveSchema = z
  .object({
    format: z.literal('trpg-encounter'),
    version: z.literal(1),
    encounter: encounterSchema,
    characters: z.array(characterSchema).max(100),
    packs: z.array(packSchema).max(20),
  })
  .strict()
export const parseEncounter = (value: unknown) => encounterSchema.parse(value) as Encounter
