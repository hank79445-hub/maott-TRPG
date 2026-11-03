import { z } from 'zod'
import { DAMAGE_TYPES } from '../core/combat-types'
export const specialWeaponSchema = z
  .object({
    templateId: z.string().min(1).max(120),
    version: z.literal(1),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000),
    attackBonus: z.number().int().min(-3).max(3),
    damageBonus: z.number().int().min(-3).max(3),
    extraDamage: z
      .array(
        z
          .object({
            formula: z.string().regex(/^(?:[1-9]|1[0-2])d(?:4|6|8|10|12)$/),
            type: z.enum(DAMAGE_TYPES),
          })
          .strict(),
      )
      .max(4),
  })
  .strict()
