import { z } from 'zod'
const id = z
  .string()
  .min(1)
  .max(120)
  .refine((v) => !['__proto__', 'prototype', 'constructor'].includes(v))
export const npcMonsterAbilitySchema = z
  .object({
    id,
    name: z.string().min(1).max(200),
    cost: z.enum(['action', 'bonus', 'reaction', 'none']),
    support: z.enum(['automatic', 'gm', 'unsupported']),
    note: z.string().max(4000),
    resourceId: id.optional(),
    spellId: id.optional(),
    slotLevel: z.number().int().min(0).max(9).optional(),
    ability: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']).optional(),
    reaction: z.enum(['parry', 'shield', 'redirect', 'counterspell']).optional(),
  })
  .strict()
export const npcResourcePoolSchema = z
  .object({
    id,
    name: z.string().min(1).max(200),
    max: z.number().int().min(1).max(100),
    remaining: z.number().int().min(0).max(100),
    recovery: z.enum(['day', 'recharge', 'manual']),
    rechargeMin: z.number().int().min(2).max(6).optional(),
    lastRechargeTick: z.number().int().nonnegative().optional(),
    lastRechargeEncounter: z.string().max(120).optional(),
  })
  .strict()
  .refine(
    (r) => r.remaining <= r.max && (r.recovery !== 'recharge' || !!r.rechargeMin),
    '怪物资源余量／充能条件无效',
  )
