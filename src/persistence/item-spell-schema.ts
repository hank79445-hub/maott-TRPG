import { z } from 'zod'
export const spellKeySchema = z.string().min(1).max(300)
export const itemSpellSchema = z
  .object({
    components: z.string().max(1000).optional(),
    requiresSpellList: z.boolean().optional(),
    casterLevel: z.number().int().min(1).max(20).optional(),
    spellId: z.string().min(1).max(120),
    level: z.number().int().min(0).max(9),
    charges: z.number().int().min(1).max(1000).optional(),
    chargeCost: z.number().int().min(1).max(1000).optional(),
    dc: z.number().int().min(1).max(40).optional(),
    attackBonus: z.number().int().min(-10).max(30).optional(),
  })
  .strict()
export const itemCastReceiptSchema = z
  .object({
    id: z.string().min(1).max(120),
    key: z.string().max(300),
    itemId: z.string().max(120),
    instanceId: z.string().max(120),
    spellId: z.string().max(120),
    source: z.string().max(300),
    ability: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']),
    level: z.number().int().min(0).max(9),
    dc: z.number().int().min(1).max(40),
    attackBonus: z.number().int().min(-10).max(30),
    returned: z.boolean().optional(),
    success: z.boolean(),
    checkDC: z.number().int().optional(),
    checkTotal: z.number().optional(),
    castId: z.string().max(120).optional(),
  })
  .strict()
export type ItemSpellDefinition = z.infer<typeof itemSpellSchema>
export type ItemCastReceipt = z.infer<typeof itemCastReceiptSchema>
