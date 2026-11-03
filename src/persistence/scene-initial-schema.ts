import { z } from 'zod'
import { sceneGeometrySchema } from './scene-effects-schema'
import { sceneMagicChoiceSchema } from './scene-magic-schema'
const id = z.string().min(1).max(120),
  text = z.string().max(2000)
export const sceneInitialSchema = z
  .object({
    regions: z
      .array(
        z
          .object({
            id,
            spellId: id,
            geometry: sceneGeometrySchema,
            sourceNpcId: id.optional(),
            objectId: id.optional(),
            pointId: id.optional(),
            slotLevel: z.number().int().min(0).max(3),
            dc: z.number().int().min(1).max(40).optional(),
            hidden: z.boolean(),
            remainingHours: z.number().finite().positive().max(8760).optional(),
            magic: sceneMagicChoiceSchema.optional(),
            terrain: z
              .object({
                plantCells: z
                  .array(z.string().regex(/^\d+,\d+$/))
                  .max(6400)
                  .default([]),
                excludedCells: z
                  .array(z.string().regex(/^\d+,\d+$/))
                  .max(6400)
                  .default([]),
                supportIds: z.array(id).max(100).default([]),
                webSupport: z.enum(['opposing', 'surface', 'unsupported']).optional(),
              })
              .strict()
              .optional(),
            light: z
              .object({
                bright: z.number().min(0).max(2000),
                dimExtra: z.number().min(0).max(2000),
                sunlight: z.boolean(),
                magical: z.boolean(),
                flame: z.boolean().optional(),
                protected: z.boolean().optional(),
                color: z.string().regex(/^#[\da-f]{6}$/i),
              })
              .strict()
              .optional(),
            note: text,
          })
          .strict(),
      )
      .max(100)
      .default([]),
    containers: z
      .array(
        z
          .object({
            id,
            objectId: id,
            name: z.string().min(1).max(200),
            waterCapacity: z.number().int().min(0).max(100000000),
            foodCapacity: z.number().int().min(0).max(100000000),
            open: z.boolean(),
            hidden: z.boolean(),
            water: z.number().int().min(0).max(100000000).default(0),
            food: z.number().int().min(0).max(100000000).default(0),
          })
          .strict()
          .refine(
            (c) => c.water <= c.waterCapacity && c.food <= c.foodCapacity,
            '初始内容超出容器容量',
          ),
      )
      .max(100)
      .default([]),
    materials: z
      .array(
        z
          .object({
            id,
            npcId: id,
            consumableId: id,
            kind: z.enum(['ruby-dust', 'gold-dust', 'jade-dust', 'diamond-dust', 'silver-salt']),
            valueGP: z.number().finite().min(1).max(1000000),
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict()
  .refine((s) => {
    const ids = [...s.regions, ...s.containers, ...s.materials].map((x) => x.id)
    return new Set(ids).size === ids.length
  }, '场景预置配置编号重复')
export type InitialSceneEffects = z.infer<typeof sceneInitialSchema>
