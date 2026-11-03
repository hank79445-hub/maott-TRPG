import {spellKeySchema} from './item-spell-schema'
import {gmSpellChoiceSchema} from './gm-spell-choice-schema'
import { m3CastChoiceSchema } from './m3-schema'
import { z } from 'zod'
import { areaTemplateSchema } from './area-schema'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'prototype', 'constructor'].includes(s))
const num = z.number().finite().nonnegative().max(100000)
const pos = z
  .object({ x: z.number().int().min(0).max(79), y: z.number().int().min(0).max(79) })
  .strict()
export const explorationActions = [
  'surge',
  'dash',
  'dodge',
  'disengage',
  'stand',
  'utilize',
  'search',
  'study',
  'influence',
  'hide',
  'help',
  'ready',
  'reaction',
  'wind',
  'wind-focus',
  'cunning-dash',
  'cunning-disengage',
  'cunning-hide',
] as const
export const explorationCommandSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('toggle'),
      enabled: z.boolean(),
      tokenIds: z.array(id).max(100).optional(),
    })
    .strict(),
  z.object({ operation: z.literal('finish'), close: z.boolean() }).strict(),
  z.object({ operation: z.literal('roster'), tokenIds: z.array(id).min(1).max(100) }).strict(),
  z.object({ operation: z.literal('end'), tokenId: id, roundId: id }).strict(),
  z
    .object({
      operation: z.literal('action'),
      tokenId: id,
      action: z.enum(explorationActions),
      note: z.string().max(2000),
      confirmed: z.boolean(),
    })
    .strict(),
  z
    .object({ operation: z.literal('trigger'), triggerId: id, note: z.string().min(1).max(2000) })
    .strict(),
  z
    .object({ operation: z.literal('zone-roll'), triggerId: id, note: z.string().min(1).max(2000) })
    .strict(),
  z.object({ operation: z.literal('zone-resolve'), encounterId: id }).strict(),
  z
    .object({
      operation: z.literal('zone-move'),
      tokenId: id,
      zoneId: id,
      to: pos,
      note: z.string().min(1).max(2000),
      confirmed: z.boolean(),
    })
    .strict(),
  z.object({operation:z.literal('control-ruling'),wakerTokenId:id.optional(),tokenId:id,effectId:id,kind:z.enum(['end','wake','command-complete','fear-context','illusion-study','end-damage','illusion-damage','truth-presence','maintain-crown','crown-no-target']),sourceVisible:z.boolean(),inside:z.boolean(),confirmed:z.boolean(),note:z.string().min(1).max(2000)}).strict(),
  z.object({ operation: z.literal('concentration'), tokenId: id }).strict(),
  z
    .object({
      operation: z.literal('spell-cast'),
      gmChoice:gmSpellChoiceSchema.optional(),
      m3Choice:m3CastChoiceSchema.optional(),
      dispelZoneId:id.optional(),dispelDistance:z.number().min(0).max(120).optional(),
      hitDice: z.number().int().min(1).max(9).optional(),
      supportChoice: id.optional(),
    controlChoices:z.record(id,id).optional(),
    controlTargets:z.array(id).max(100).optional(),
    controlText:z.string().max(2000).optional(),
      willing: z.boolean().optional(),
      template: areaTemplateSchema.optional(),
      tokenId: id,
      key: spellKeySchema,
      mode: id,
      targets: z.array(id).min(1).max(100),
      confirmed: z.boolean(),
      note: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('jump'),
      runup: z.boolean().optional(),
      tokenId: id,
      to: pos,
      mode: z.enum(['normal', 'magic']),
      confirmed: z.boolean(),
      note: z.string().max(2000),
    })
    .strict(),
  z
    .object({
      operation: z.literal('jump-cast'),
      tokenId: id,
      key: spellKeySchema,
      mode: id,
      targets: z.array(id).min(1).max(10),
      confirmed: z.boolean(),
    })
    .strict(),
])
const budget = z
  .object({
    tokenId: id,
    characterId: id.nullable(),
    action: z.boolean(),
    bonus: z.boolean(),
    reaction: z.boolean(),
    interaction: z.boolean(),
    movement: num,
    dash: num,
    ended: z.boolean(),
    deathSaved: z.boolean(),
    slotSpent: z.boolean(),
    jumpUsed: z.boolean(),
    wind: z.boolean(),
    surgeAction: z.boolean(),
    surgeUsed: z.boolean(),
    endProcessed: z.boolean(),
    trail: z.array(pos).max(200),
    flags: z.array(id).max(30),
  })
  .strict()
export const explorationSchema = z
  .object({
    id,
    sceneId: id,
    status: z.enum(['active', 'paused', 'closed']),
    round: num.int().min(1),
    roundId: id,
    acted: z.boolean(),
    effectEndProcessed: z.array(id).max(100).optional(),
    members: z.array(budget).max(100),
    retired: z.array(budget).max(100),
    clocks: z.record(id, num),
    triggers: z
      .array(
        z
          .object({
            id,
            tokenId: id,
            sourceId: id,
            encounterId: id,
            targetId: id,
            turnTokenId: id,
            phase: z.enum(['enter', 'start', 'end']),
            resolved: z.boolean(),
            note: z.string().max(2000),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict()
