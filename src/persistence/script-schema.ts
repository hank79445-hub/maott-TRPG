import {openingPresentationSchema} from './opening-reading-schema'
import {localeSchema} from '../shared/localization/locale'
import { authoringNotebookSchema } from './authoring-stage-schema'
import { growthGuideSchema } from './script-design-schema'
import { NPC_LIMIT, BROADCAST_LIMIT } from '../core/configuration-limits'
import { scriptObjectId } from './script-object-id'
export { scriptObjectId } from './script-object-id'
import {
  scriptNpcSchema,
  scriptCharacterSchema,
  initialCharacterStateSchema,
} from './npc-static-schema'
export {
  scriptNpcSchema,
  scriptCharacterSchema,
  initialCharacterStateSchema,
} from './npc-static-schema'
import { z } from 'zod'
import { sceneSchema } from './map-schema'
import { characterSchema, runtimeSchema, packSchema } from './schema'
import { npcProfileSchema, npcTemplateSchema, aiSettingsSchema } from './ai-schema'
import { npcSchema } from './combat-schema'
import {npcKnowledgeDesignSchema} from './npc-knowledge-schema'
import { battlePresetSchema } from './battle-schema'
import { broadcastTemplateSchema } from './broadcast-schema'
import {
  MAP_IMAGE_BYTES,
  MAP_PREVIEW_BYTES,
  MAP_IMAGE_EDGE,
  MAP_IMAGE_PIXELS,
  MAP_TOTAL_IMAGE_BYTES,
  MAP_IMAGE_MIMES,
} from '../core/map-limits'

export const SCRIPT_DOCUMENT_BYTES = 16 * 1024 * 1024
const body = scriptNpcSchema.shape.body.unwrap()
const token = sceneSchema.shape.tokens.element
  .omit({ actorId: true, npcSourceActorId: true, companionKey: true, npcBody: true })
  .extend({ npcBody: body.optional() })
  .strict()
export const scriptSceneSchema = sceneSchema
  .omit({
    encounterId: true,
    template: true,
    tokens: true,
    defeatedTokens: true,
    linkRuns: true,
    discoveryAttempts: true,
    pausedRoutes: true,
  })
  .extend({ tokens: z.array(token).max(100) })
  .strict()
const imageMeta = z
  .object({
    mime: z.enum(MAP_IMAGE_MIMES),
    width: z.number().int().min(1).max(MAP_IMAGE_EDGE),
    height: z.number().int().min(1).max(MAP_IMAGE_EDGE),
    bytes: z.number().int().min(1).max(MAP_IMAGE_BYTES),
  })
  .strict()
  .refine((a) => a.width * a.height <= MAP_IMAGE_PIXELS, '图片像素超限')
export const scriptAssetSchema = imageMeta
  .safeExtend({
    id: scriptObjectId,
    name: z.string().min(1).max(2000),
    preview: imageMeta
      .safeExtend({
        bytes: z.number().int().min(1).max(MAP_PREVIEW_BYTES),
        width: z.number().int().min(1).max(4096),
        height: z.number().int().min(1).max(4096),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (a) =>
      !a.preview ||
      (a.preview.width <= a.width &&
        a.preview.height <= a.height &&
        Math.abs(a.preview.width * a.height - a.preview.height * a.width) <=
          Math.max(a.width, a.height)),
    '预览图必须与原图等比',
  )
export const scriptSchema = z
  .object({
    format: z.literal('trpg-script'),
    version: z.literal(1),
    metadata: z
      .object({
        name: z.string().min(1).max(120),
        contentLocale: localeSchema.optional(),
        author: z.string().max(120),
        description: z.string().max(6000),
        authorVersion: z.string().min(1).max(80),
        ruleset: z.literal('DND2024'),
        levels: z
          .object({ min: z.number().int().min(1).max(5), max: z.number().int().min(1).max(5) })
          .strict()
          .refine((x) => x.max >= x.min),
        players: z
          .object({ min: z.number().int().min(1).max(100), max: z.number().int().min(1).max(100) })
          .strict()
          .refine((x) => x.max >= x.min),
        startSceneId: scriptObjectId,
        landing: z
          .object({ x: z.number().int().min(0).max(79), y: z.number().int().min(0).max(79) })
          .strict(),
      })
      .strict(),
    dependencies: z
      .array(z.object({ id: scriptObjectId, version: scriptObjectId }).strict())
      .max(30),
    roles: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(120),
            required: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    scenes: z.array(scriptSceneSchema).min(1).max(30),
    designNotebook: authoringNotebookSchema.optional(),
    growthGuide: growthGuideSchema.optional(),
    quests: z.array(questDefinitionSchema).max(QUEST_LIMIT).optional(),
    npcs: z.array(scriptNpcSchema).max(NPC_LIMIT),
    knowledgeDesign:npcKnowledgeDesignSchema.optional(),
    characters: z.array(scriptCharacterSchema).max(100),
    npcTemplates: z.array(npcTemplateSchema.omit({ body: true }).extend({ body }).strict()).max(30),
    ai: aiSettingsSchema,
    battles: z.array(battlePresetSchema).max(100),
    openingPresentation: openingPresentationSchema.optional(),
    broadcasts: z.array(broadcastTemplateSchema).max(BROADCAST_LIMIT),
    packs: z.array(packSchema).max(20),
    assets: z.array(scriptAssetSchema).max(100),
  })
  .strict()
  .refine(
    (s) =>
      s.assets.reduce((n, a) => n + a.bytes + (a.preview?.bytes ?? 0), 0) <= MAP_TOTAL_IMAGE_BYTES,
    '剧本图片总量超过 200 MB',
  )

export type ScriptDefinition = z.infer<typeof scriptSchema>
export type ScriptAsset = z.infer<typeof scriptAssetSchema>
export type ScriptInitialState = z.infer<typeof initialCharacterStateSchema>
import { questDefinitionSchema, QUEST_LIMIT } from './quest-schema'
