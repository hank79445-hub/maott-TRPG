import { z } from 'zod'
const id = z.string().min(1).max(120),
  bits = z
    .string()
    .max(1100)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/)
export const fogPolicySchema = z
  .object({
    mode: z.enum(['legacy', 'enclosed']).optional(),
    areas: z
      .array(
        z
          .object({
            id,
            name: z.string().max(120),
            cells: z
              .array(z.string().regex(/^\d+,\d+$/))
              .min(1)
              .max(6400),
            doorIds: z.array(id).max(100).default([]),
            initiallyRevealed: z.boolean().default(false),
            revealOnOpen: z.boolean().default(true),
            manualOnly: z.boolean().default(false),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    shading: z
      .object({ level1: z.number().min(0.05).max(0.8), level2: z.number().min(0.1).max(0.95) })
      .strict()
      .refine((v) => v.level1 < v.level2, '2级遮罩须强于1级')
      .optional(),
    enabled: z.boolean(),
    shared: z.boolean().default(false),
    rangeFeet: z.number().finite().positive().max(10000).nullable().default(null),
    initial: z
      .array(z.string().regex(/^\d+,\d+$/))
      .max(6400)
      .default([]),
  })
  .strict()
const row = z
  .object({
    sceneId: id,
    observerId: id,
    space: z.string().max(160),
    columns: z.number().int().min(2).max(80),
    rows: z.number().int().min(2).max(80),
    explored: bits,
  })
  .strict()
export const fogStateSchema = z
  .object({
    areaRecords: z
      .array(
        z
          .object({
            sceneId: id,
            areaId: id,
            observerId: id,
            revealed: z.boolean().optional(),
            reason: z.enum(['enter', 'door', 'manual']),
            at: z.string(),
            branchId: id.optional(),
            sourceEventId: id.optional(),
            sourceTokenId: id.optional(),
            doorId: id.optional(),
          })
          .strict(),
      )
      .max(10000)
      .optional(),
    records: z.array(row).max(1000),
    manual: z
      .array(
        z
          .object({
            sceneId: id,
            observerId: id,
            space: z.string().max(160),
            columns: z.number().int().min(2).max(80),
            rows: z.number().int().min(2).max(80),
            revealed: bits,
            concealed: bits,
          })
          .strict(),
      )
      .max(1000),
    preview: z.object({ sceneId: id, observerId: id }).strict().optional(),
  })
  .strict()
export const fogCommandSchema = z
  .object({
    kind: z.literal('fog'),
    command: z.discriminatedUnion('operation', [
      z
        .object({
          operation: z.literal('configure'),
          sceneId: id,
          policy: fogPolicySchema,
          confirmMigration: z.literal(true).optional(),
        })
        .strict(),
      z
        .object({
          operation: z.literal('area'),
          sceneId: id,
          areaId: id,
          observerId: id,
          revealed: z.boolean(),
          confirmed: z.literal(true),
        })
        .strict(),
      z
        .object({
          operation: z.enum(['reveal', 'hide', 'reset']),
          sceneId: id,
          observerId: id,
          cells: z.array(z.string().regex(/^\d+,\d+$/)).max(6400),
          confirmed: z.literal(true),
        })
        .strict(),
      z
        .object({ operation: z.literal('preview'), sceneId: id, observerId: id.nullable() })
        .strict(),
    ]),
  })
  .strict()
export type FogPolicy = z.infer<typeof fogPolicySchema>
export type FogState = z.infer<typeof fogStateSchema>
export interface FogShading {
  level1: number
  level2: number
  runs: { x: number; y: number; length: number; level: 1 | 2; blend?: number }[]
  reasons?: Record<string, number>
}
export interface FogView {
  mode?: 'legacy' | 'enclosed'
  shading?: FogShading
  shadingViews?: (FogShading & { observerId: string })[]
  enabled: true
  sceneId: string
  columns: number
  rows: number
  visible: string
  explored: string
  version: string
  assetId: string
  shared: boolean
  preview?: boolean
}
