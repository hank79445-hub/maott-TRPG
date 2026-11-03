import { z } from 'zod'
import { encounterSchema } from './combat-schema'
import type { Encounter } from '../core/combat-types'
const savedEncounter = encounterSchema as unknown as z.ZodType<Encounter>
const id = z.string().min(1).max(120),
  point = z
    .object({
      x: z.number().int().min(0).max(79),
      y: z.number().int().min(0).max(79),
      height: z.number().finite().min(-10000).max(10000),
    })
    .strict()
export const m5ChoiceSchema = z
  .object({
    targetIds: z.array(id).max(100).default([]),
    damageType: z.enum(['acid', 'cold', 'fire', 'lightning', 'poison']).default('fire'),
    willing: z.boolean().default(false),
  })
  .strict()
export const m5EffectSchema = z
  .object({
    targetId: id.optional(),
    sourceKey: id,
    ability: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']),
    dc: z.number().int().min(1).max(100),
    attackBonus: z.number().int().min(-30).max(50),
    modifier: z.number().int().min(-20).max(30),
    damageType: z.enum([
      'acid',
      'cold',
      'fire',
      'lightning',
      'poison',
      'force',
      'psychic',
      'necrotic',
    ]),
    formula: z.string().max(30),
    held: z.boolean(),
    uses: z.array(z.string().max(240)).max(2000).default([]),
  })
  .strict()
export const m5OutcomeSchema = z
  .object({
    id,
    receipt: z.string().max(240),
    spellId: id,
    sourceId: id,
    targetId: id.optional(),
    sceneId: id,
    encounterId: id,
    attackId: id,
    blockedByAttackId: id.optional(),
    kind: z.enum(['pull', 'push', 'flee', 'ignite', 'objects', 'sound']),
    feet: z.number().min(0).max(1000),
    travel: z.number().min(0).max(1000).default(0),
    spent: z.number().min(0).max(10000).optional(),
    current: point.optional(),
    layer: z.enum(['material', 'ethereal', 'pocket', 'stone']).optional(),
    spaceAnchorId: id.optional(),
    from: point,
    origin: point,
    status: z.enum(['pending', 'resolved', 'skipped']),
    note: z.string().max(2000),
  })
  .strict()
export const m5StateSchema = z
  .object({
    outcomes: z.array(m5OutcomeSchema).max(5000).default([]),
    metals: z
      .array(
        z
          .object({
            objectId: id,
            manufactured: z.literal(true),
            contactIds: z.array(id).max(100),
            cannotDropIds: z.array(id).max(100),
          })
          .strict(),
      )
      .max(1000)
      .default([]),
    resolutions: z
      .array(
        z
          .object({
            id,
            effectId: id,
            actorId: id,
            sceneId: id,
            encounterId: id.optional(),
            pendingId: id,
            status: z.enum(['pending', 'resolved', 'canceled']),
            frame: savedEncounter.optional(),
            targets: z.array(z.object({ id, hit: z.boolean() }).strict()).max(100),
          })
          .strict(),
      )
      .max(2000)
      .default([]),
  })
  .strict()
export const m5Actions = [
  z.object({operation:z.literal('m5-close'),eventId:id,kind:z.enum(['resolution','movement']),disposition:z.enum(['manual-completed','canceled']),note:z.string().trim().min(1).max(2000)}).strict(),
  z
    .object({
      operation: z.literal('m5-equipment-drop'),
      actorId: id,
      equipmentId: id,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('m5-mark'),
      actorId: id,
      effectId: id,
      targetId: id,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('m5-search'),
      actorId: id,
      effectId: id,
      skill: z.enum(['perception', 'survival']),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('m5-response'),
      eventId: id,
      actorId: id,
      response: z.enum(['shield', 'npc', 'defense', 'confirm-reaction', 'concentration']),
      key: z.string().max(300).default(''),
      mode: z.string().max(120).default(''),
      targetIndex: z.number().int().min(0).max(99).default(0),
      defense: z.enum(['uncanny', 'deflect', 'stone']).default('uncanny'),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('m5-move'),
      eventId: id,
      path: z.array(point).max(200),
      skip: z.boolean().default(false),
      reactionsConfirmed: z.boolean().default(false),
      safeRouteConfirmed: z.boolean().default(false),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('m5-metal'),
      objectId: id,
      manufactured: z.literal(true),
      contactIds: z.array(id).max(100),
      cannotDropIds: z.array(id).max(100),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('m5-equipment'),
      actorId: id,
      equipment: z
        .object({
          id,
          objectId: id,
          itemId: id,
          attackIds: z.array(id).max(30),
          held: z.boolean(),
          proficient: z.boolean().default(false),
          magical: z.boolean(),
          material: z.enum(['metal', 'wood', 'other']),
        })
        .strict(),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('m5-use'),
      effectId: id,
      actorId: id,
      targetIds: z.array(id).max(100),
      use: z.enum(['attack', 'move-attack', 'breathe', 'heat', 'resummon', 'put-away']),
      to: point.optional(),
      angle: z.number().finite().min(-360).max(360).default(0),
      receipt: id,
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({ operation: z.literal('m5-resolve'), eventId: id, note: z.string().min(1).max(2000) })
    .strict(),
] as const
