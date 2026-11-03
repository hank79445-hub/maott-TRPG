import {spellKeySchema} from './item-spell-schema'
import { z } from 'zod'
import {m5ChoiceSchema,m5EffectSchema,m5StateSchema,m5Actions} from './scene-m5-schema'
import { sceneSuppliesSchema,supplyCastSchema,supplyActions } from './scene-supply-schema'
import { sceneMagicActions, sceneMagicChoiceSchema, sceneMagicHazardSchema, sceneMagicSchema } from './scene-magic-schema'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s))
const feet = z.number().finite().min(-10000).max(10000)
export const scenePointSchema = z
  .object({
    x: z.number().finite().min(0).max(80),
    y: z.number().finite().min(0).max(80),
    height: feet,
  })
  .strict()
export const sceneGeometrySchema = z
  .object({
    shape: z.enum(['sphere', 'cylinder', 'cube', 'square', 'emanation', 'line', 'wall']),
    x: z.number().finite().min(0).max(79),
    y: z.number().finite().min(0).max(79),
    height: feet,
    size: z.number().finite().min(0.1).max(2000),
    heightFeet: z.number().finite().min(0).max(2000).default(0),
    width: z.number().finite().min(0.1).max(2000).default(5),
    angle: z.number().finite().min(-360).max(360).default(0),
    originSpan: z.number().int().min(1).max(80).default(1),
    points: z.array(scenePointSchema).min(2).max(100).optional(),
    cuts: z
      .array(
        z
          .object({
            x: z.number().finite(),
            y: z.number().finite(),
            height: feet,
            width: z.number().finite().positive(),
            depth: z.number().finite().positive(),
            heightFeet: z.number().finite().positive(),
          })
          .strict(),
      )
      .max(200)
      .optional(),
  })
  .strict()
  .refine((g) => g.shape !== 'wall' || !!g.points, '墙形区域须有连续路径')
export const sceneAnchorSchema = z
  .object({
    kind: z.enum(['point', 'creature', 'object', 'inventory']),
    id: id.optional(),
    ownerId: id.optional(),
    offsetHeight: feet.default(0),
  })
  .strict()
  .refine((a) => a.kind === 'point' || !!a.id, '锚点须关联稳定实体')
const terrainSchema = z
  .object({
    dc: z.number().int().min(1).max(40),
    multiplier: z.union([z.literal(1), z.literal(2), z.literal(4)]),
    groundOnly: z.boolean(),
    plantCells: z
      .array(z.string().regex(/^\d+,\d+$/))
      .max(6400)
      .default([]),
    excludedCells: z
      .array(z.string().regex(/^\d+,\d+$/))
      .max(6400)
      .default([]),
    knownTo: z.array(id).max(1000).default([]),
    supportIds: z.array(id).max(100).default([]),
    webSupport: z.enum(['opposing', 'surface', 'unsupported']).optional(),
    createdTurn: z.string().max(400),
    burns: z
      .array(
        z
          .object({
            x: z.number().finite(),
            y: z.number().finite(),
            height: feet,
            startedTurn: z.string().max(400),
            endsAt: z.number().finite().min(0),
          })
          .strict(),
      )
      .max(6400)
      .default([]),
    enrichment: z.boolean().default(false),
    travel: z
      .array(z.object({ entityId: id, remainder: z.number().finite().min(0).max(5) }).strict())
      .max(1000)
      .default([]),
  })
  .strict()
export const sceneEffectSchema = z
  .object({
    id,
    castId: id,
    spellId: id,
    name: z.string().min(1).max(200),
    sceneId: id,
    sourceId: id,
    sourceKind: z.enum(['character', 'npc', 'scenario']),
    clockSourceId: id,
    slotLevel: z.number().int().min(0).max(9),
    createdHour: z.number().finite().min(0),
    endsAt: z.number().finite().min(0).optional(),
    concentration: z.boolean(),
    status: z.enum(['active', 'ended']),
    layer: z.enum(['material', 'ethereal', 'pocket', 'stone']).optional(),
    spaceAnchorId: id.optional(),
    geometry: sceneGeometrySchema.optional(),
    anchor: sceneAnchorSchema,
    hidden: z.boolean(),
    covered: z.boolean(),
    terrain: terrainSchema.optional(),
    m5:m5EffectSchema.optional(),
    magic: sceneMagicSchema.optional(),
    light: z
      .object({
        bright: z.number().finite().min(0).max(2000),
        dimExtra: z.number().finite().min(0).max(2000),
        sunlight: z.boolean(),
        magical: z.boolean(),
        flame: z.boolean().optional(),
        protected: z.boolean().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })
      .strict()
      .optional(),
    obscurity: z
      .enum(['none', 'light', 'heavy', 'magical-darkness', 'absolute-darkness'])
      .default('none'),
    channels: z
      .array(z.enum(['visual', 'light', 'sound', 'movement', 'projectile', 'effect']))
      .max(6)
      .default([]),
    legacy: z.object({ encounterId: id, zoneId: id }).strict().optional(),
    legacyLight: z.object({ entityId: id, effectId: id }).strict().optional(),
    combined: z.boolean().optional(),
    lightUnits: z.number().int().min(1).max(4).optional(),
    requiresGeometry: z.boolean().default(false),
    reason: z.string().max(2000).optional(),
    note: z.string().max(2000),
  })
  .strict()
export const sceneEffectCastSchema = z
  .object({
    operation: z.literal('cast'),
    casterId: id,
    subtle: z.boolean().optional(),
    key: spellKeySchema,
    mode: id,
    objectId: id.optional(),
    inventoryInstanceId: id.optional(),
    materialId: id.optional(),
    magic: sceneMagicChoiceSchema.optional(),
    supply:supplyCastSchema.optional(),
    m5:m5ChoiceSchema.optional(),
    terrain: z
      .object({
        plantIds: z.array(id).max(100).default([]),
        excludedCells: z
          .array(z.string().regex(/^\d+,\d+$/))
          .max(6400)
          .default([]),
        supportIds: z.array(id).max(100).default([]),
        webSupport: z.enum(['opposing', 'surface', 'unsupported']).optional(),
        enrichment: z.boolean().default(false),
      })
      .strict()
      .optional(),
    points: z.array(scenePointSchema).max(4).default([]),
    combined: z.boolean().default(false),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#f3ce6b'),
    confirmed: z.literal(true),
    note: z.string().min(1).max(2000),
  })
  .strict()
export const sceneEffectActionSchema = z.discriminatedUnion('operation', [
  sceneEffectCastSchema,
  z
    .object({
      operation: z.literal('move-lights'),
      effectId: id,
      actorId: id,
      points: z.array(scenePointSchema).min(1).max(4),
      combined: z.boolean(),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('cover'),
      effectId: id,
      actorId: id.optional(),
      covered: z.boolean(),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('end'),
      effectId: id,
      actorId: id,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('material'),
      ownerId: id,
      instanceId: id,
      kind: z.enum(['ruby-dust','gold-dust','jade-dust','diamond-dust','silver-salt']),
      valueGP: z.number().finite().min(10).max(1000000),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('dispel'),
      casterId: id,
      key: spellKeySchema,
      mode: id,
      effectId: id,
      to: scenePointSchema.optional(),
      confirmed: z.literal(true),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('throw-flame'),
      casterId: id,
      effectId: id,
      targetId: id,
      confirmed: z.literal(true),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('disperse'),
      effectId: id,
      reason: z.literal('strong-wind'),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('legacy-geometry'),
      effectId: id,
      geometry: sceneGeometrySchema,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('fixture-light'),
      flame: z.boolean().optional(),
      protected: z.boolean().optional(),
      objectId: id,
      bright: z.number().finite().min(0).max(2000),
      dimExtra: z.number().finite().min(0).max(2000),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('object-durability'),
      combustible: z.boolean().optional(),
      objectId: id,
      ac: z.number().int().min(0).max(40),
      hp: z.number().int().min(0).max(100000),
      maxHp: z.number().int().min(1).max(100000),
      fire: z.enum(['normal', 'resistant', 'immune', 'vulnerable']),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({ operation: z.literal('hazard'), eventId: id, note: z.string().min(1).max(2000) })
    .strict(),
  z
    .object({
      operation: z.literal('hazard-order'),
      eventIds: z.array(id).min(1).max(100),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('escape'),
      effectId: id,
      actorId: id,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('search-terrain'),
      effectId: id,
      actorId: id,
      skill: z.enum(['perception', 'survival']),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('burn-web'),
      effectId: id,
      point: scenePointSchema,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('clear-growth'),
      effectId: id,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('environment-round'),
      phase: z.enum(['start', 'end']),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('resume-route'),
      routeId: id,
      actorId: id,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  ...sceneMagicActions,
  ...supplyActions,
  ...m5Actions,
])
export const sceneEffectsSchema = z
  .object({
    initialised:z.array(id).max(10000).optional(),
    supplies:sceneSuppliesSchema.optional(),
    m5:m5StateSchema.optional(),
    version: z.literal(1),
    regions: z.array(sceneEffectSchema).max(3000),
    casts: z
      .array(
        z
          .object({
            id,
            castId: id,
            action: z.union([sceneEffectCastSchema, sceneEffectActionSchema.options[5]]),
            spellId: id,
            sceneId: id,
            spaceLayer: z.enum(['material', 'ethereal', 'pocket', 'stone']).optional(),
            spaceAnchorId: id.optional(),
            clockSourceId: id,
            sourceId: id,
            slotLevel: z.number().int().min(0).max(9),
            createdHour: z.number().finite().min(0),
            endsAt: z.number().finite().min(0).optional(),
            encounterId: id.optional(),
            settled: z.boolean(),
            canceled: z.boolean(),
          })
          .strict(),
      )
      .max(2000),
    events: z
      .array(
        z
          .object({
            id,
            castId: id,
            effectId: id,
            kind: z.enum([
              'created',
              'ended',
              'moved',
              'covered',
              'uncovered',
              'dispersed',
              'migrated',
              'located',
              'attack',
              'check',
            ]),
            atHour: z.number().finite().min(0),
            receipt: id,
            reason: z.string().max(2000),
          })
          .strict(),
      )
      .max(10000),
    materials: z
      .array(
        z
          .object({
            ownerId: id,
            instanceId: id,
            kind: z.enum(['ruby-dust','gold-dust','jade-dust','diamond-dust','silver-salt']),
            valueGP: z.number().finite().min(10).max(1000000),
          })
          .strict(),
      )
      .max(1000),
    objectBodies: z
      .array(
        z
          .object({
            objectId: id,
            combustible: z.boolean().optional(),
            ac: z.number().int().min(0).max(40),
            hp: z.number().int().min(0).max(100000),
            maxHp: z.number().int().min(1).max(100000),
            fire: z.enum(['normal', 'resistant', 'immune', 'vulnerable']),
            note: z.string().max(2000),
          })
          .strict(),
      )
      .max(1000)
      .default([]),
    objectAttacks: z
      .array(
        z
          .object({
            id,
            castId: id,
            sourceId: id,
            objectId: id,
            attackRolls: z.array(z.number().int().min(1).max(20)).max(2),
            attackTotal: z.number().finite(),
            hit: z.boolean(),
            critical: z.boolean(),
            damageRolls: z.array(z.number().int().min(1).max(8)).max(8),
            damageTotal: z.number().int().min(0),
            finalDamage: z.number().int().min(0),
            remainingHP: z.number().int().min(0),
            atHour: z.number().finite().min(0),
          })
          .strict(),
      )
      .max(5000)
      .default([]),
    hazards: z
      .array(
        z
          .object({
            id,
            effectId: id,
            entityId: id,
            sceneId: id,
            receipt: z.string().min(1).max(800),
            phase: z.enum(['created', 'enter', 'start', 'end', 'spikes', 'burn', 'moved', 'strike', 'trigger']),
            magic: sceneMagicHazardSchema.optional(),
            status: z.enum(['pending', 'resolved', 'canceled']),
            turnKey: z.string().max(400),
            distance: z.number().finite().min(0).max(2000).default(0),
            rolls: z.array(z.number().int().min(1).max(100)).max(1000).default([]),
            total: z.number().finite().optional(),
            success: z.boolean().optional(),
            damage: z.number().int().min(0).optional(),
            note: z.string().max(2000).default(''),
          })
          .strict(),
      )
      .max(10000)
      .default([]),
    routes: z
      .array(
        z
          .object({
            id,
            sceneId: id,
            entityId: id,
            tokenId: id,
            branchId: z.string().max(120),
            start: scenePointSchema,
            path: z.array(scenePointSchema).min(1).max(160),
            mode: z.enum(['map', 'walk', 'climb', 'swim', 'fly']),
            supportId: id.optional(),
            reactionsConfirmed: z.boolean(),
            status: z.enum(['paused', 'resumed', 'canceled']),
          })
          .strict(),
      )
      .max(1000)
      .default([]),
    locks: z.array(z.object({pointId:id,locks:z.number().int().min(0).max(20),barred:z.boolean(),jammed:z.boolean()}).strict()).max(3000).default([]),
  })
  .strict()
export type SceneGeometry = z.infer<typeof sceneGeometrySchema>
export type SceneEffect = z.infer<typeof sceneEffectSchema>
export type SceneEffectCast = z.infer<typeof sceneEffectCastSchema>
export type SceneEffectAction = z.infer<typeof sceneEffectActionSchema>
export type SceneEffects = z.infer<typeof sceneEffectsSchema>
