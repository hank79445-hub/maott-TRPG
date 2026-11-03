import {openingPresentationSchema} from './opening-reading-schema'
import {localeSchema,localizedTextSchema} from '../shared/localization/locale'
import { authoringNotebookSchema } from './authoring-stage-schema'
import {sceneInitialSchema} from './scene-initial-schema'
import { practicalSocialPolicySchema } from './practical-social-schema'
import { npcSpatialPolicySchema } from './npc-spatial-schema'
import { battlePresetSchema } from './battle-schema'
import { fogPolicySchema } from './fog-schema'
import { merchantPolicySchema } from './trade-schema'
import {initialSpatialSchema} from './m3-initial-schema'
import { pointItemsSchema } from './point-items-schema'
import { npcDesignSchema, questDesignSchema, growthGuideSchema } from './script-design-schema'
import {
  NPC_LIMIT,
  AUTHORING_LIMITS as LIMIT,
  assertAuthoringBytes,
} from '../core/configuration-limits'
import {
  environmentSchema,
  boundaryWallsSchema,
  artBriefSchema,
  pointAppearanceSchema,
} from './scene-art-schema'
import { z } from 'zod'
import { npcPersonaSchema } from './npc-persona-schema'
import { itemReferenceSchema } from './item-reference-schema'
import { packSchema } from './schema'
import { authoringCharacterSchema } from './authoring-character-schema'
import { pointDiscoverySchema } from './point-discovery-schema'
import {npcKnowledgeDesignSchema,npcKnowledgeProfileSchema} from './npc-knowledge-schema'
const key = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,39}$/)
  .refine((s) => !['constructor', 'prototype', '__proto__'].includes(s), '编号为保留字')
const text = z.string().max(2000)
const pos = { x: z.number().int().min(0).max(79), y: z.number().int().min(0).max(79) }
const point = z
  .object({
    key,
    appearance: pointAppearanceSchema.optional(),
    name: text.min(1),
    ...pos,
    kind: z.enum(['clue', 'chest', 'trap', 'door', 'exit']).default('clue'),
    repeatAccess: z.boolean().optional(),
    text: text.default(''),
    hidden: z.boolean().default(false),
    check: z
      .object({ skill: z.string().min(1).max(80), dc: z.number().int().min(1).max(30) })
      .strict()
      .optional(),
    exit: z.object({ scene: key, point: key }).strict().optional(),
    rescueNpc: key.optional(),
    discovery: pointDiscoverySchema.optional(),
    itemUse: pointItemsSchema.optional(),
    container: z
      .object({
        items: z
          .array(
            z
              .object({
                itemId: itemReferenceSchema,
                quantity: z.number().int().min(1).max(10000),
              })
              .strict(),
          )
          .max(100),
        coins: z
          .number()
          .min(0)
          .max(1000000)
          .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8)
          .default(0),
        emptyReason: text.optional(),
        gmNote: text.optional(),
      })
      .strict()
      .refine(
        (c) => c.items.length > 0 || c.coins > 0 || !!c.emptyReason?.trim(),
        '刻意空容器必须填写原因',
      )
      .optional(),
    arrivalGroup: key.optional(),
    failureArrivalGroup: key.optional(),
    battle: key.optional(),
    success: text.optional(),
    failure: text.optional(),
  })
  .strict()
export const authorSceneSchema = z
  .object({
    fog: fogPolicySchema.optional(),
    links: z
      .array(
        z
          .object({
            key,
            name: text.min(1),
            color: z.string().regex(/^#[0-9a-f]{6}$/i),
            source: key,
            outcome: z.enum(['success', 'failure']).default('success'),
            effects: z
              .array(
                z
                  .object({
                    point: key,
                    operation: z.enum(['open', 'close', 'unlock', 'reveal', 'enable']),
                  })
                  .strict(),
              )
              .max(50),
            arrivalGroups: z.array(key).max(30).optional(),
          })
          .strict().refine(g=>g.effects.length>0||!!g.arrivalGroups?.length,'关联组必须有互动效果或出场组'),
      )
      .max(100)
      .optional(),
    key,
    effectSetup:sceneInitialSchema.optional(),
    spatialSetup:initialSpatialSchema.optional(),
    environment: environmentSchema.optional(),
    boundaryWalls: boundaryWallsSchema.optional(),
    art: artBriefSchema.optional(),
    walls: z
      .array(
        z
          .object({
            key,
            a: z
              .object({ x: z.number().int().min(0).max(40), y: z.number().int().min(0).max(40) })
              .strict(),
            b: z
              .object({ x: z.number().int().min(0).max(40), y: z.number().int().min(0).max(40) })
              .strict(),
            heightFeet:z.number().finite().min(0).max(10000).optional(),
            gapFeet:z.number().finite().min(0).max(5).optional(),
            kind: z.enum(['wall', 'door']),
            state: z.enum(['closed', 'open', 'locked']).default('closed'),
            point: key.optional(),
            hidden: z.boolean().default(false),
          })
          .strict(),
      )
      .max(LIMIT.walls)
      .optional(),
    name: text.min(1),
    description: text.default(''),
    intro: text.default(''),
    width: z.number().int().min(6).max(40),
    height: z.number().int().min(6).max(40),
    landing: z.object(pos).strict(),
    floors: z
      .array(
        z
          .object({
            ...pos,
            width: z.number().int().min(1).max(40),
            height: z.number().int().min(1).max(40),
          })
          .strict(),
      )
      .min(1)
      .max(LIMIT.floors),
    points: z.array(point).max(LIMIT.points).default([]),
    ground: z
      .array(
        z
          .object({
            key,
            ...pos,
            item: itemReferenceSchema,
            quantity: z.number().int().min(1).max(999).default(1),
            hidden: z.boolean().default(false),
          })
          .strict(),
      )
      .max(LIMIT.ground)
      .default([]),
  })
  .strict()
export const authoringSchema = z
  .object({
    format: z.literal('trpg-authoring'),
    contentLocale: localeSchema.optional(),
    version: z.literal(1),
    title: z.string().min(1).max(120),
    author: z.string().max(120).default(''),
    itemPacks: z.array(packSchema).max(20).optional(),
    description: text.default(''),
    level: z.number().int().min(1).max(5),
    players: z.number().int().min(1).max(10),
    start: key,
    opening: text.default(''),
    openingPresentation: openingPresentationSchema.optional(),
    scenes: z.array(authorSceneSchema).min(1).max(LIMIT.scenes),
    designNotebook: authoringNotebookSchema.optional(),
    growthGuide: growthGuideSchema.optional(),
    quests: z
      .array(
        z
          .object({
            key,
            title: z.string().min(1).max(120),
            gmDesign: questDesignSchema.optional(),
            chapter: z.string().max(120).default(''),
            description: text.default(''),
            initialStatus: z
              .enum(['inactive', 'active', 'completed', 'failed'])
              .default('inactive'),
            visibility: z.enum(['public', 'hidden']).default('public'),
            main: z.boolean().default(false),
            current: z.boolean().default(false),
            pinnedStep: key.optional(),
            steps: z
              .array(
                z
                  .object({
                    key,
                    title: z.string().min(1).max(120),
                    description: text.default(''),
                    visibility: z.enum(['public', 'hidden']).default('hidden'),
                    initialStatus: z
                      .enum(['inactive', 'active', 'completed', 'failed'])
                      .default('inactive'),
                    after: z.array(key).max(100).default([]),
                    scene: key.optional(),
                    point: key.optional(),
                    arrival: key.optional(),
                    trigger: z
                      .enum(['point-success', 'scene-enter', 'arrival', 'battle-ended'])
                      .optional(),
                    alternatives: text.optional(),
                    gmNote: text.optional(),
                    automatic:z.boolean().optional(),activateNext:z.boolean().optional(),attribution:z.enum(['party','proxy','world']).optional(),proxyNpcIds:z.array(key).max(100).optional(),
                  })
                  .strict(),
              )
              .max(100)
              .optional(),
            scene: key.optional(),
            point: key.optional(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    knowledgeDesign:npcKnowledgeDesignSchema.optional(),
    npcs: z
      .array(
        z
          .object({
            key,
            name: z.string().min(1).max(120),
            merchantPolicy: merchantPolicySchema.optional(),
            practicalSocial:practicalSocialPolicySchema.optional(),
            resourceStrategy:z.enum(['conservative','balanced','aggressive']).optional(),
            spatialPolicy:npcSpatialPolicySchema.optional(),
            coinsGP: z.number().finite().min(0).max(100000).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-6,'金币最多两位GP小数').optional(),
            stock: z.array(z.object({itemId:itemReferenceSchema,quantity:z.number().int().min(0).max(10000),priceGP:z.number().finite().min(0).max(100000)}).strict()).max(100).optional(),
            scene: key,
            ...pos,
            template: key.optional(),
            initialHeight:z.number().finite().min(-10000).max(10000).optional(),
            initialSupport:z.string().max(120).optional(),
            cardType: z.enum(['template','character']).default('template'),
            character: authoringCharacterSchema.optional(),
            type: z.enum(['ordinary', 'important']).default('ordinary'),
            side: z.enum(['party', 'enemy', 'neutral']).default('enemy'),
            hidden: z.boolean().default(false),
            description: text.default(''),
            personality: text.default('谨慎、简洁'),
            persona: npcPersonaSchema.optional(),
            publicSpeechStyle: text.optional(),
            knowledgeProfile:npcKnowledgeProfileSchema.optional(),
            gmDesign: npcDesignSchema.optional(),
            knowledge: text.default(''),
            secret: text.default(''),
            dialogue: text.default(''),
            fixedReplies: z
              .array(z.object({ key, text: text.min(1), localized:localizedTextSchema.optional() }).strict())
              .max(30)
              .optional(),
            fixedReplyMode: z.enum(['end', 'loop']).optional(),
            fixedReplyEnd: text.optional(),
    fixedReplyEndLocales:localizedTextSchema.optional(),
            importanceRole: z.enum(['resident', 'companion']).optional(),
            consumables: z
              .array(
                z.object({ key, itemId: itemReferenceSchema, quantity: z.number().int().min(1).max(999) }).strict(),
              )
              .max(30)
              .optional(),
          })
          .strict(),
      )
      .max(NPC_LIMIT),
    arrivals: z
      .array(
        z
          .object({
            key,
            scene: key,
            name: text.min(1),
            npcs: z.array(key).min(1).max(20),
              manualReason: text.optional(),
            battleMode: z.enum(['none', 'start', 'reinforce']).default('none'),
            intro: text.default(''),
          })
          .strict(),
      )
      .max(LIMIT.arrivals)
      .default([]),
    battles: z
      .array(
        z
          .object({
            key,
            scene: key,
            name: text.min(1),
            npcs: z.array(key).min(1).max(LIMIT.battleMembers),
            practical:battlePresetSchema.shape.practical,
            intro: text.default(''),
          })
          .strict(),
      )
      .max(LIMIT.battles)
      .default([]),
    broadcasts: z
      .array(
        z
          .object({
            title: z.string().min(1).max(120),
            text: text.min(1),
            scene: key.optional(),
            point: key.optional(),
            audience: z.enum(['public', 'gm']).default('public'),
            trigger: z.enum(['story', 'scene', 'point', 'manual']).default('manual'),
            result: z.enum(['any', 'success', 'failure']).default('any'),
          })
          .strict(),
      )
      .max(LIMIT.manualBroadcasts)
      .default([]),
  })
  .strict()
export type Authoring = z.infer<typeof authoringSchema>
export type AuthorScene = Authoring['scenes'][number]
export function parseAuthoringValue(input: unknown) {
  const result = authoringSchema.safeParse(input)
  if (result.success) return result.data
  throw new z.ZodError(
    result.error.issues.map((issue) => {
      if (issue.code !== 'too_big' || issue.origin !== 'array') return issue
      const value = issue.path.reduce<unknown>(
        (v, k) => (v && typeof v === 'object' ? (v as Record<PropertyKey, unknown>)[k] : undefined),
        input,
      )
      return {
        ...issue,
        message: `${issue.path.join('.')}：当前 ${Array.isArray(value) ? value.length : '未知'}，上限 ${issue.maximum}；不会截断导入`,
      }
    }),
  )
}
export function parseAuthoring(text: string) {
  assertAuthoringBytes(text)
  return parseAuthoringValue(JSON.parse(text))
}
