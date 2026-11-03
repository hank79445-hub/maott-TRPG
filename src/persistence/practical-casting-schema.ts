import {spellKeySchema} from './item-spell-schema'
import {z} from 'zod'
const id=z.string().min(1).max(200)
export const practicalCastingSchema=z.object({intentId:id,branchId:id,sourceId:id,key:spellKeySchema,mode:id,sceneId:id,startedHour:z.number().nonnegative(),durationHours:z.number().positive(),status:z.enum(['casting','completed','interrupted','canceled','committed']),focusId:id,position:z.object({x:z.number(),y:z.number(),height:z.number()}).strict(),reason:z.string().max(1000)}).strict()
export const practicalConsentSchema=z.object({intentId:id,branchId:id,targetId:id,memberId:id,accepted:z.boolean()}).strict()
