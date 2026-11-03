import {localeSchema} from '../shared/localization/locale'
import { z } from 'zod'
export const environmentSchema = z.enum(['outdoor', 'indoor', 'mixed'])
export const boundaryWallsSchema = z.enum(['explicit-only', 'auto-enclose'])
export const layoutModeSchema = z.enum(['precise', 'approximate', 'free'])
export const artZoneSchema = z.enum([
  'northwest',
  'north',
  'northeast',
  'west',
  'center',
  'east',
  'southwest',
  'south',
  'southeast',
])
export const artSizeSchema = z.enum(['small', 'medium', 'large'])
export const artAspectSchema = z.enum(['original', '1:1', '4:3', '16:9', '3:4', '9:16'])
export type LayoutMode = z.infer<typeof layoutModeSchema>
export const calibrationPendingSchema = z
  .object({ status: z.literal('pending'), mode: z.enum(['approximate', 'free']) })
  .strict()

export const artBriefSchema = z
  .object({
    contentLocale: localeSchema.optional(),
    composition: z.string().max(2000).optional(),
    description: z.string().max(2000).default(''),
    publicName: z.string().max(80).default('场景'),
    style: z.string().max(1000).default('写实奇幻战术地图，正上方俯视'),
    materials: z.string().max(1000).default('石材地面与墙体'),
    lighting: z.string().max(1000).default('均匀照明，清晰辨认地面和通道'),
    decorations: z.string().max(2000).default(''),
    exclusions: z.string().max(1000).default('人物、文字、数字、网格'),
  })
  .strict()
export const artPolicySchema = z
  .object({
    includeHiddenGeometry: z.boolean().default(false),
    purpose: z.enum(['direct', 'beautify']).optional(),
    beautifyStrength: z.enum(['conservative', 'enriched']).optional(),
    seed: z.number().int().min(0).max(2147483647).optional(),
    doorArtwork: z.enum(['hidden', 'subtle', 'full']).optional(),
    layoutMode: layoutModeSchema.optional(),
    aspect: artAspectSchema.optional(),
    anchorOverrides: z
      .array(
        z
          .object({
            label: z.string().min(1).max(120),
            description: z.string().max(1000),
            occurrence: z.number().int().min(1).max(100),
            zone: artZoneSchema,
            size: artSizeSchema,
          })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict()
export const artTransformSchema = z
  .object({
    x: z.number().finite().min(-5000).max(5000),
    y: z.number().finite().min(-5000).max(5000),
    width: z.number().positive().max(10000),
    height: z.number().positive().max(10000),
    rotation: z.number().finite().min(-360).max(360),
  })
  .strict()
const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const artReceiptSchema = z
  .object({
    exportId: z.string().uuid(),
    sceneRef: z.string().uuid(),
    geometryHash: hash,
    briefHash: hash,
    policyVersion: z.union([z.literal(1), z.literal(2)]),
    purpose: z.enum(['direct', 'beautify']).optional(),
    mode: layoutModeSchema.optional(),
    materialHash: hash.optional(),
    at: z.string().datetime(),
  })
  .strict()
export const sceneArtRecordSchema = z
  .object({
    brief: artBriefSchema,
    sourceBrief: artBriefSchema.optional(),
    policy: artPolicySchema,
    export: artReceiptSchema.optional(),
    adopted: z
      .object({
        purpose: z.enum(['direct', 'beautify']).optional(),
        mode: layoutModeSchema.optional(),
        calibration: z.enum(['pending', 'confirmed']).optional(),
        calibrationHash: hash.optional(),
        sourceMaterialHash: hash.nullable().optional(),
        assetId: z.string().min(1).max(120),
        exportGeometryHash: hash.nullable(),
        geometryHash: hash,
        transform: artTransformSchema,
        reviewedAt: z.string().datetime(),
      })
      .strict()
      .optional(),
  })
  .strict()
export const sceneArtRecordsSchema = z
  .record(z.string().min(1).max(120), sceneArtRecordSchema)
  .refine((x) => Object.keys(x).length <= 30, '生图记录最多30场景')
export type SceneArtBrief = z.infer<typeof artBriefSchema>
export type SceneArtPolicy = z.infer<typeof artPolicySchema>
export type ArtTransform = z.infer<typeof artTransformSchema>
export type ArtReceipt = z.infer<typeof artReceiptSchema>
export type SceneArtRecord = z.infer<typeof sceneArtRecordSchema>
export type SceneArtRecords = z.infer<typeof sceneArtRecordsSchema>

export const pointAppearanceSchema = z
  .object({
    label: z.string().min(1).max(120),
    description: z.string().min(1).max(1000),
    width: z.number().int().min(1).max(8).default(1),
    height: z.number().int().min(1).max(8).default(1),
    rotation: z.number().finite().min(-360).max(360).default(0),
    visibility: z.enum(['public', 'surface', 'omit']).default('public'),
  })
  .strict()
export type PointAppearance = z.infer<typeof pointAppearanceSchema>
