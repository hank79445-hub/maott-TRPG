import { z } from 'zod'
import { inventorySchema } from './schema'
const id = z.string().min(1).max(120),
  cp = z.number().int().min(0).max(100000000),
  quantity = z.number().int().min(1).max(10000)
export const merchantPolicySchema = z
  .object({
    enabled: z.boolean(),
    buy: z.boolean(),
    buyRate: z.number().min(0).max(1),
    buyItems: z.array(id).max(500),
    blockedItems: z.array(id).max(500),
    autoPurchase: z.boolean(),
    zeroPrice: z.boolean(),
    practical:z.object({enabled:z.boolean(),scope:z.enum(['listed','all']),buyback:z.boolean(),barter:z.boolean(),negotiation:z.boolean(),dc:z.number().int().min(1).max(40),cost:z.enum(['free','action','bonus'])}).strict().optional(),
  })
  .strict()
export const merchantStockSchema = z
  .object({
    id: id.optional(),
    itemId: id,
    quantity: z.number().int().min(0).max(10000),
    priceGP: z.number().finite().min(0).max(100000),
    inventoryState: inventorySchema.optional(),
  })
  .strict()
export const tradeBasketSchema = z
  .object({
    take: z.array(z.object({ stockId: id, quantity }).strict()).max(30),
    give: z.array(z.object({ instanceId: id, quantity }).strict()).max(30),
    playerPayCP: cp,
    npcPayCP: cp,
    note: z.string().max(500).default(''),
  })
  .strict()
const line = z
  .object({
    id,
    itemId: id,
    name: z.string().max(300),
    quantity,
    referenceCP: cp.nullable(),
    valueCP: cp.nullable(),
    reason: z.string().max(500),
  })
  .strict()
export const tradeSessionSchema = z
  .object({
    id,
    branchId: id,
    sessionId: id,
    characterId: id,
    npcId: id,
    sceneId: id,
    version: z.number().int().positive(),
    status: z.enum(['draft', 'quoted', 'awaitingGM', 'ready', 'committed', 'canceled', 'stale']),
    authorization: z.enum(['gm', 'policy']).optional(),
    basket: tradeBasketSchema,
    fingerprint: z.string().max(64),
    take: z.array(line).max(30),
    give: z.array(line).max(30),
    askCP: cp.nullable(),
    bidCP: cp.nullable(),
    gapCP: z.number().int().min(-100000000).max(100000000).nullable(),
    playerAccepted: z.boolean(),
    npcAccepted: z.boolean(),
    reason: z.string().max(1000),
    at: z.string().datetime(),
    negotiation: z
      .object({
        skill: z.enum(['persuasion', 'deception', 'intimidation']),
        goal: z.string().min(1).max(500),
        version: z.number().int(),
        status: z.enum(['requested', 'resolved']),
        resetAt: z.string().datetime().optional(),
        total: z.number().finite().optional(),
        success: z.boolean().optional(),
        dc: z.number().int().min(1).max(40).optional(),
        untilHours:z.number().finite().nonnegative().optional(),
        policyPrices:z.record(id,cp).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
export const tradeStateSchema = z
  .object({ sessions: z.array(tradeSessionSchema).max(300) })
  .strict()
export const tradeCommandSchema = z
  .object({
    kind: z.literal('trade'),
    command: z.discriminatedUnion('operation', [
      z.object({ operation: z.literal('open'), branchId: id, npcId: id, characterId: id }).strict(),
      z
        .object({
          operation: z.literal('quote'),
          branchId: id,
          tradeId: id,
          version: z.number().int().positive(),
          basket: tradeBasketSchema,
        })
        .strict(),
      z
        .object({
          operation: z.enum(['request', 'commit', 'cancel']),
          branchId: id,
          tradeId: id,
          version: z.number().int().positive(),
        })
        .strict(),
      z
        .object({
          operation: z.literal('review'),
          branchId: id,
          tradeId: id,
          version: z.number().int().positive(),
          decision: z.enum(['approve', 'counter', 'reject']),
          reason: z.string().min(1).max(500),
          playerPayCP: cp.optional(),
          npcPayCP: cp.optional(),
          prices: z.record(z.string(), cp).optional(),
        })
        .strict(),
      z
        .object({
          operation: z.literal('negotiate'),
          branchId: id,
          tradeId: id,
          version: z.number().int().positive(),
          skill: z.enum(['persuasion', 'deception', 'intimidation']),
          goal: z.string().min(1).max(500),
        })
        .strict(),
      z
        .object({
          operation: z.literal('roll'),
          branchId: id,
          tradeId: id,
          version: z.number().int().positive(),
          dc: z.number().int().min(1).max(40),
          cost: z.enum(['free', 'action', 'bonus']),
          successPayCP: cp,
          failurePayCP: cp,
          policyPricing:z.boolean().optional(),
        })
        .strict(),
      z
        .object({
          operation: z.literal('reset-negotiation'),
          branchId: id,
          tradeId: id,
          version: z.number().int().positive(),
          reason: z.string().min(1).max(500),
        })
        .strict(),
      z
        .object({ operation: z.literal('configure'), npcId: id, policy: merchantPolicySchema })
        .strict(),
    ]),
  })
  .strict()
export type MerchantPolicy = z.infer<typeof merchantPolicySchema>
export type MerchantStock = z.infer<typeof merchantStockSchema>
export type TradeSession = z.infer<typeof tradeSessionSchema>
export type TradeState = z.infer<typeof tradeStateSchema>
export type TradeBasket = z.infer<typeof tradeBasketSchema>
export const defaultMerchant = (): MerchantPolicy => ({
  enabled: true,
  buy: false,
  buyRate: 0.5,
  buyItems: [],
  blockedItems: [],
  autoPurchase: false,
  zeroPrice: false,
})
export interface ShopView {
  npcId: string
  name: string
  buyRestricted: boolean
  policy: MerchantPolicy
  stock: {
    id: string
    itemId: string
    name: string
    quantity: number
    priceCP: number
    special: boolean
  }[]
}
export interface TradeView {
  shops: ShopView[]
  sessions: TradeSession[]
}
