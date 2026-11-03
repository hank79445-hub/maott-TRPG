import {spellKeySchema} from './item-spell-schema'
import { z } from 'zod'
import { encounterSchema } from './combat-schema'
import { characterSchema } from './schema'
import { DAMAGE_TYPES } from '../core/combat-types'
const id = z
    .string()
    .min(1)
    .max(120)
    .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s)),
  text = z.string().max(2000)
export const battleOpeningSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('attack'),
      attackId: id,
      tokenIds: z.array(id).length(1),
      sneak: z.boolean(),
      mastery: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('cast'),
      supportChoice: id.optional(),
    controlChoices:z.record(id,id).optional(),
    controlTargets:z.array(id).max(100).optional(),
    controlText:z.string().max(2000).optional(),
      willing: z.boolean().optional(),
      key: spellKeySchema,
      mode: id,
      tokenIds: z.array(id).min(1).max(100),
      damageType: z.enum(DAMAGE_TYPES),
      weaponId: id.optional(),
      hitDice: z.number().int().min(1).max(3).optional(),
      summonForm: id.optional(),
      ammunition: z
        .object({ instanceId: id, count: z.number().int().min(1).max(18) })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('item'),
      instanceId: id,
      tokenIds: z.array(id).length(1),
      note: text,
    })
    .strict(),
])
export const battleParticipantSchema = z
  .object({
    kind: z.enum(['character', 'npc', 'token']),
    id,
    side: z.enum(['party', 'enemy', 'neutral']),
    initiative: z.number().int().min(-100).max(100).optional(),
  })
  .strict()
export const battlePresetSchema = z
  .object({
    practical:z.object({enabled:z.boolean(),autoStart:z.boolean(),finish:z.enum(['manual','enemy-unconscious','enemy-dead']),entry:z.array(z.object({npcId:id,mode:z.enum(['fixed','judge','exclude']),allowedSides:z.array(z.enum(['party','enemy','neutral'])).min(1).max(3)}).strict()).max(100).optional()}).strict().optional(),
    id,
    sceneId: id,
    name: text.min(1),
    participants: z.array(battleParticipantSchema).max(100),
    intro: text,
  })
  .strict()
export const battleStateSchema = z
  .object({
    presets: z.array(battlePresetSchema).max(100),
    requests: z
      .array(
        z
          .object({
            id,
            sceneId: id,
            at: z.string().datetime(),
            name: text.min(1),
            reason: text,
            source: z.enum(['gm', 'player', 'npc', 'point']),
            sourceId: id,
            characterId: id.nullable(),
            presetId: id.nullable(),
            status: z.enum(['pending', 'accepted', 'rejected']),
            reviewReason: text,
            opening: battleOpeningSchema.optional(),
            openingStatus: z.enum(['waiting', 'executed', 'canceled']).optional(),
            encounterId: id.optional(),
          })
          .strict(),
      )
      .max(500),
    history: z
      .array(
        z
          .object({
            id,
            sceneId: id,
            name: text.min(1),
            preparedAt: z.string().datetime(),
            endedAt: z.string().datetime(),
            reason: text,
            legacy: z.boolean(),
            branchId: id.optional(),
            encounter: encounterSchema,
            characters: z.array(characterSchema).max(100),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict()
export const battleMapSchemas = [
  z
    .object({
      type: z.literal('battle-prepare'),
      sceneId: id,
      name: text.min(1),
      participants: z.array(battleParticipantSchema).min(1).max(100),
      presetId: id.optional(),
    })
    .strict(),
  z.object({ type: z.literal('battle-finish'), sceneId: id, reason: text.min(1) }).strict(),
  z.object({ type: z.literal('battle-cancel'), sceneId: id, reason: text.min(1) }).strict(),
  z
    .object({
      type: z.literal('battle-reinforce'),
      sceneId: id,
      participants: z.array(battleParticipantSchema).min(1).max(100),
      reason: text.min(1),
      requestId: id.optional(),
    })
    .strict(),
  z
    .object({ type: z.literal('battle-reset'), confirmed: z.boolean(), reason: text.min(1) })
    .strict(),
  z.object({ type: z.literal('battle-preset'), preset: battlePresetSchema }).strict(),
  z.object({ type: z.literal('battle-preset-delete'), presetId: id }).strict(),
  z
    .object({
      type: z.literal('battle-request'),
      sceneId: id,
      name: text.min(1),
      reason: text.min(1),
      source: z.enum(['gm', 'player', 'npc', 'point']),
      sourceId: id,
      characterId: id.nullable(),
      presetId: id.optional(),
      opening: battleOpeningSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('battle-request-review'),
      requestId: id,
      name: text.min(1).optional(),
      approve: z.boolean(),
      reason: text.min(1),
      participants: z.array(battleParticipantSchema).max(100),
    })
    .strict(),
] as const
