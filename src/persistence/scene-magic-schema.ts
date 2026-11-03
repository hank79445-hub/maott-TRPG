import {spellKeySchema} from './item-spell-schema'
import { z } from 'zod'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s))
const point = z
  .object({
    x: z.number().finite().min(0).max(80),
    y: z.number().finite().min(0).max(80),
    height: z.number().finite().min(-10000).max(10000),
  })
  .strict()
export const sceneMagicTypes = ['celestial', 'elemental', 'fey', 'fiend', 'undead'] as const
export const sceneTriggerSchema = z
  .object({
    kind: z.enum(['enter', 'touch', 'open', 'uncover', 'speak', 'gm']),
    range: z.number().finite().min(0).max(60).default(0),
    phrase: z.string().max(200).optional(),
    types: z.array(z.string().max(40)).max(20).default([]),
    description: z.string().max(2000).default(''),
    sense: z.enum(['sight', 'sound', 'either']).default('either'),
  })
  .strict()
export const sceneMagicChoiceSchema = z
  .object({
    angle: z.number().finite().min(-360).max(360).default(0),
    path: z.array(point).max(100).default([]),
    excludedIds: z.array(id).max(1000).default([]),
    pointId: id.optional(),
    materialIds: z.array(id).max(5).default([]),
    ammunitionIds: z.array(id).max(6).default([]),
    damageType: z
      .enum(['acid', 'cold', 'fire', 'lightning', 'thunder', 'radiant', 'necrotic'])
      .default('radiant'),
    storm: z.boolean().default(false),
    strike: point.optional(),
    password: z.string().max(200).default(''),
    alarm: z.enum(['audible', 'mental']).default('audible'),
    trigger: sceneTriggerSchema.optional(),
    message: z.string().max(2000).default(''),
    wordCountConfirmed: z.boolean().default(false),
    repeat: z.boolean().default(false),
    glyph: z.enum(['explosive', 'spell']).default('explosive'),
    stored: z
      .object({
        key: spellKeySchema,
        mode: id,
        spellId: id,
        supportChoice: z.string().max(120).optional(),
        willing: z.boolean().optional(),
      })
      .strict()
      .optional(),
    types: z.array(z.enum(sceneMagicTypes)).max(5).default([]),
    reverse: z.boolean().default(false),
    hutLight: z.enum(['dim', 'dark']).default('dim'),
  })
  .strict()
export const sceneMagicSchema = z
  .object({
    dc: z.number().int().min(1).max(40),
    attackBonus: z.number().finite().min(-20).max(50).default(0),
    createdTurn: z.string().max(400),
    excludedIds: z.array(id).max(1000).default([]),
    damageType: z.string().max(40).default('radiant'),
    angle: z.number().finite().default(0),
    lastMoveTurn: z.string().max(400).optional(),
    moveBudget: z.number().finite().min(0).max(1000).default(0),
    ammunition: z.number().int().min(0).max(6).default(0),
    storm: z.boolean().default(false),
    pointId: id.optional(),
    allowedIds: z.array(id).max(1000).default([]),
    objectIds: z.array(id).max(1000).default([]),
    password: z.string().max(200).default(''),
    alarm: z.enum(['audible', 'mental']).default('audible'),
    suppressedUntil: z.number().finite().min(0).optional(),
    trigger: sceneTriggerSchema.optional(),
    message: z.string().max(2000).default(''),
    repeat: z.boolean().default(false),
    glyph: z.enum(['explosive', 'spell']).optional(),
    stored: z
      .object({
        spellId: id,
        key: spellKeySchema,
        slotLevel: z.number().int().min(0).max(3),
        ability: z.string().max(10),
        dc: z.number().int().min(1).max(40),
        attackBonus: z.number().finite(),
        modifier: z.number().finite().default(0),
        sourceLevel: z.number().int().min(1).max(20),
        supportChoice: z.string().max(120).optional(),
        willing: z.boolean().optional(),
      })
      .strict()
      .optional(),
    origin: point.optional(),
    inside: z.array(id).max(1000).default([]),
    types: z.array(z.enum(sceneMagicTypes)).max(5).default([]),
    reverse: z.boolean().default(false),
    hutLight: z.enum(['dim', 'dark']).default('dim'),
    triggered: z.boolean().default(false),
    initialMembers: z.array(id).max(1000).default([]),
    migrated: z.boolean().default(false),
    oldReceipts: z
      .array(
        z
          .object({ entityId: id, phase: z.string().max(30), tick: z.number().int().min(0) })
          .strict(),
      )
      .max(10000)
      .default([]),
    fixtureRolls: z.array(id).max(1000).default([]),
    crossings: z
      .array(
        z
          .object({ entityId: id, turnKey: z.string().max(400), to: point, success: z.boolean() })
          .strict(),
      )
      .max(1000)
      .default([]),
    passwordPasses: z
      .array(z.object({ entityId: id, turnKey: z.string().max(400) }).strict())
      .max(1000)
      .default([]),
    allowedInventory: z
      .array(z.object({ instanceId: id, quantity: z.number().int().min(1).max(1000000) }).strict())
      .max(2000)
      .default([]),
  })
  .strict()
export const sceneMagicHazardSchema = z
  .object({
    formula: z
      .string()
      .regex(/^\d+d(?:4|6|8|10|12)(?:[+-]\d+)?$/)
      .optional(),
    type: z.string().max(40).optional(),
    save: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']).optional(),
    dc: z.number().int().min(1).max(40),
    half: z.boolean().default(false),
    push: z
      .object({
        angle: z.number().finite(),
        feet: z.number().finite().min(0).max(1000),
        travel: z.number().finite().min(0).max(1000).default(0),
        from: point,
      })
      .strict()
      .optional(),
    rolled: z.boolean().default(false),
    decision: z.enum(['apply', 'skip']).optional(),
    endsSource: z.boolean().default(false),
  })
  .strict()
const note = z.string().min(1).max(2000)
export const sceneMagicActions = [
  z.object({ operation: z.literal('weather'), sceneId: id, storm: z.boolean(), note }).strict(),
  z.object({ operation: z.literal('adopt-zone'), effectId: id, note }).strict(),
  z.object({ operation: z.literal('wind-flames'), effectId: id, note }).strict(),
  z
    .object({
      operation: z.literal('mental-alarm'),
      effectId: id,
      eventId: id,
      distance: z.number().finite().min(0).max(5280),
      note,
    })
    .strict(),
  z
    .object({ operation: z.literal('magic-cross'), effectId: id, actorId: id, to: point, note })
    .strict(),
  z
    .object({
      operation: z.literal('magic-move'),
      effectId: id,
      actorId: id,
      to: point,
      angle: z.number().finite().min(-360).max(360).optional(),
      note,
    })
    .strict(),
  z
    .object({ operation: z.literal('magic-strike'), effectId: id, actorId: id, to: point, note })
    .strict(),
  z.object({ operation: z.literal('magic-push'), eventId: id, note }).strict(),
  z
    .object({
      operation: z.literal('magic-trigger'),
      effectId: id,
      entityId: id,
      event: z.enum(['touch', 'open', 'uncover', 'speak', 'gm']),
      text: z.string().max(2000).default(''),
      note,
    })
    .strict(),
  z
    .object({ operation: z.literal('magic-decision'), eventId: id, apply: z.boolean(), note })
    .strict(),
  z
    .object({
      operation: z.literal('hut-light'),
      effectId: id,
      actorId: id,
      light: z.enum(['dim', 'dark']),
      note,
    })
    .strict(),
  z
    .object({
      operation: z.literal('mundane-locks'),
      pointId: id,
      locks: z.number().int().min(0).max(20),
      barred: z.boolean(),
      jammed: z.boolean(),
      note,
    })
    .strict(),
] as const
export type SceneMagicChoice = z.infer<typeof sceneMagicChoiceSchema>
export type SceneMagic = z.infer<typeof sceneMagicSchema>
