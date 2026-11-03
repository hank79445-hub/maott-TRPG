import { NPC_LIMIT, BROADCAST_LIMIT } from '../core/configuration-limits'
import { z } from 'zod'
import { scriptNpcSchema, scriptCharacterSchema } from './npc-static-schema'
import { packSchema } from './schema'
import { npcProfileSchema } from './ai-schema'

export const CONFIG_FILE_BYTES = 16 * 1024 * 1024
const key = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !['__proto__', 'prototype', 'constructor'].includes(s))
const text = z.string().max(2000).default('')
export const configNpcSchema = scriptNpcSchema
  .extend({
    description: text,
    personality: text,
    goals: text,
    strategy: text,
    knowledge: text,
    privateNote: text,
    fallbackReply: text,
    side: npcProfileSchema.shape.side.default('neutral'),
    hidden: z.boolean().default(false),
    enabled: z.boolean().default(false),
    characterId: key.nullable().default(null),
    body: scriptNpcSchema.shape.body.default(null),
    autoDialogue: z.boolean().default(false),
    attitude: npcProfileSchema.shape.attitude.default('indifferent'),
    secrets: npcProfileSchema.shape.secrets.default([]),
    stock: npcProfileSchema.shape.stock.default([]),
    coins: z.number().min(0).max(1000000).default(0),
    preauthorization: scriptNpcSchema.shape.preauthorization.default({
      trade: false,
      revealIds: [],
      maxQuantity: 1,
      maxDiscountGP: 0,
      maxValueGP: 0,
    }),
  })
  .strict()
export const npcConfigSchema = z
  .object({
    format: z.literal('trpg-npc-config'),
    version: z.literal(1),
    scenes: z
      .array(
        z
          .object({
            id: key,
            name: z.string().min(1).max(120),
            presets:z.array(z.object({id:key,name:z.string().min(1).max(200)}).strict()).max(100).optional(),
            points: z
              .array(z.object({ id: key, name: z.string().min(1).max(2000) }).strict())
              .max(200)
              .optional(),
          })
          .strict(),
      )
      .max(30),
    subjects: z
      .array(z.object({ id: key, name: z.string().min(1).max(120) }).strict())
      .max(100)
      .default([]),
    knowledgeReferences:z.object({factions:z.array(z.object({id:key,name:z.string().min(1).max(120),signature:key}).strict()).max(200),templates:z.array(z.object({id:key,name:z.string().min(1).max(120),signature:key}).strict()).max(500)}).strict().optional(),
    npcs: z.array(configNpcSchema).max(NPC_LIMIT),
    characters: z.array(scriptCharacterSchema).max(20).default([]),
    dependencies: z
      .array(z.object({ id: key, version: key }).strict())
      .max(30)
      .default([]),
    packs: z.array(packSchema).max(20).default([]),
  })
  .strict()
export type NpcConfigDocument = z.infer<typeof npcConfigSchema>
export const configMappingSchema = z
  .object({
    scenes: z.record(key, key),
    subjects: z.record(key, key).default({}),
    entries: z
      .array(
        z
          .object({
            id: key,
            name: z.string().min(1).max(120),
            x: z.number().int().min(0).max(79),
            y: z.number().int().min(0).max(79),
            enabled: z.boolean(),
            protect: z.boolean().default(false),
            activity: z.boolean().default(false),
            follow: z.boolean().default(false),
            autoReply: z.boolean().default(false),
            hp: z.number().int().nonnegative().max(100000).optional(),
            conditions: z.array(z.string().min(1).max(120)).max(30).optional(),
            resources: z.record(key, z.number().int().nonnegative().max(100000)).optional(),
          })
          .strict(),
      )
      .max(NPC_LIMIT),
  })
  .strict()
export type ConfigMapping = z.infer<typeof configMappingSchema>
const fixedText = z
  .string()
  .min(1)
  .max(4000)
  .refine((s) => !/\{\{/.test(s), '固定文案不接受变量表达式，请替换为固定文字')
export const broadcastTextsSchema = z
  .object({
    format: z.literal('trpg-broadcast-texts'),
    version: z.literal(1),
    templates: z
      .array(z.object({ title: z.string().trim().min(1).max(120), text: fixedText }).strict())
      .max(BROADCAST_LIMIT),
  })
  .strict()
export type BroadcastTextsDocument = z.infer<typeof broadcastTextsSchema>
export const configImportSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('npc-config-import'),
      document: npcConfigSchema,
      mapping: configMappingSchema,
      expectedStamp: z.string().max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal('broadcast-text-import'),
      document: broadcastTextsSchema,
      expectedStamp: z.string().max(120),
    })
    .strict(),
])
export type ConfigImportCommand = z.infer<typeof configImportSchema>
