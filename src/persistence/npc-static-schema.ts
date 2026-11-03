import { z } from 'zod'
import { characterSchema, runtimeSchema } from './schema'
import { npcProfileSchema } from './ai-schema'
import { npcSchema } from './combat-schema'
import { scriptObjectId } from './script-object-id'
const { effects: _effects, ...npcInitialShape } = npcSchema.shape
const body = z
  .object(npcInitialShape)
  .strict()
  .refine((n) => npcSchema.safeParse({ ...n, effects: [] }).success, 'NPC 初始战斗数据无效')
export const initialCharacterStateSchema = runtimeSchema
  .pick({
    hp: true,
    temporaryHp: true,
    resources: true,
    conditions: true,
    exhaustion: true,
    hitDice: true,
    death: true,
    heroicInspiration: true,
    preparedSpells: true,
    restSpellChoices: true,
    knownBeasts: true,
  })
  .partial()
  .strict()
export const scriptCharacterSchema = characterSchema
  .omit({
    revision: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    runtime: true,
    journal: true,
    purpose: true,
    npcOwnerId: true,
  })
  .extend({
    initial: initialCharacterStateSchema,
    initialConsumableDurations: z
      .array(
        z
          .object({
            instanceId: scriptObjectId,
            hours: z.number().finite().nonnegative().max(1000000),
          })
          .strict(),
      )
      .max(5000)
      .default([]),
  })
  .strict()
export const scriptNpcSchema = npcProfileSchema
  .omit({
    fixedReplyCursor: true,
    consumablesUsed: true,
    arrivalOrigin: true,
    appeared: true,
    actorId: true,
    revision: true,
    turnHold: true,
    revealedIds: true,
    urgingCooldowns: true,
    memory: true,
    experiences: true,
    experienceOmitted: true,
    relations: true,
    behaviorState: true,
    body: true,
    preauthorization: true,
  })
  .extend({
    body: body.nullable(),
    preauthorization: npcProfileSchema.shape.preauthorization
      .omit({ characterIds: true, remaining: true, expiresAt: true })
      .strict(),
  })
  .strict()
