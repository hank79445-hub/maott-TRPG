import { z } from 'zod'
import { packSchema,inventorySchema } from './schema'
import { specialWeaponSchema } from './special-weapon-schema'
const id = z.string().min(1).max(120),
  text = z.string().max(2000),
  num = z.number().finite(),
  int = num.int(),
  pos = { x: int.min(0).max(79), y: int.min(0).max(79) }
export const arrivalGroupSchema = z
  .object({
    id,
    name: text.min(1),
    npcIds: z.array(id).min(1).max(20),
    battleMode: z.enum(['none', 'start', 'reinforce']),
    intro: text,
    manualReason: text.optional(),
    status: z.enum(['waiting', 'pending', 'spawned']).optional(),
    reason: text.optional(),
    requestId: id.optional(),
    sourceEventId: id.optional(),
  })
  .strict()
export const groundItemSchema = z
  .object({
    inventoryState:inventorySchema.optional(),
    specialWeapon: specialWeaponSchema.optional(),
    inventoryInstanceId: id.optional(),
    customItem: packSchema.shape.items.element.optional(),
    id,
    ...pos,
    itemId: id,
    name: text.min(1),
    icon: z.string().max(16),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    note: text,
    initialQuantity: int.min(1).max(9999),
    quantity: int.min(0).max(9999),
    hidden: z.boolean(),
    enabled: z.boolean(),
    range: num.min(0).max(1000),
    requiresGM: z.boolean(),
    cost: z.enum(['free', 'action']),
  })
  .strict()
export const sceneToolCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('grapple-release'),
      sceneId: id,
      characterId: id,
      encounterId: id,
      targetId: id,
    })
    .strict(),
  z
    .object({
      type: z.literal('ground-drop'),
      sceneId: id,
      characterId: id,
      instanceId: id,
      cost: z.enum(['free', 'action']),
    })
    .strict(),
  z
    .object({
      type: z.literal('gm-place-npcs'),
      sceneId: id,
      templateId: id.optional(),
      sourceNpcId: id.optional(),
      positions: z.array(z.object(pos).strict()).min(1).max(20),
    })
    .strict(),
  z
    .object({
      type: z.literal('gm-relocate'),
      sceneId: id,
      tokenId: id,
      position: z.object(pos).strict(),
      reason: text.min(1),
    })
    .strict(),
  z.object({ type: z.literal('arrival-trigger'), sceneId: id, groupId: id }).strict(),
  z
    .object({
      type: z.literal('ground-pickup'),
      sceneId: id,
      itemId: id,
      characterId: id,
      quantity: int.min(1).max(9999),
      cost: z.enum(['free', 'action']),
    })
    .strict(),
])
