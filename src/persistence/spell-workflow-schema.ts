import {gmSpellChoiceSchema,gmSpellObservationSchema,gmSpellOngoingSchema} from './gm-spell-choice-schema'
import { z } from 'zod'
import { broadcastAudienceSchema } from './broadcast-schema'
const id = z.string().min(1).max(160)
export const gmSpellRequestSchema = z.object({
  sourceKind:z.enum(['character','npc']).optional(),sourceNpcId:id.optional(),clockSourceId:id.optional(),restKey:z.string().max(240).optional(),choice:gmSpellChoiceSchema.optional(),contextKey:z.string().max(6000).optional(),dc:z.number().int().min(1).max(100).optional(),observations:z.array(gmSpellObservationSchema).max(1000).optional(),ongoing:gmSpellOngoingSchema.optional(),ruleChecks:z.array(z.string().max(200)).max(30).optional(),
  id, castId: id, spellId: id, name: z.string().min(1).max(200), sceneId: id,
  characterId: id, targetIds: z.array(id).max(100), encounterId: id.optional(),
  pendingId: id.optional(), slotLevel: z.number().int().min(0).max(9),
  question: z.string().min(1).max(2000), questionIndex: z.number().int().min(1).max(5),
  createdAt: z.string().max(100), castHour: z.number().finite().nonnegative(),
  endsAt: z.number().finite().nonnegative().nullable(), concentration: z.boolean(),
  status: z.enum(['pending', 'published', 'canceled']), noResult: z.boolean().optional(),
  uncertaintyChance:z.number().int().min(0).max(100).optional(),
  uncertaintyRoll:z.number().int().min(1).max(100).optional(),
  result: z.object({ text: z.string().min(1).max(6000), privateNote: z.string().max(4000),
    audience: broadcastAudienceSchema, eventId: id }).strict().optional(),
}).strict()
