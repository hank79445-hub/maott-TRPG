import {spellKeySchema} from './item-spell-schema'
import {z} from 'zod'
import {m3CastChoiceSchema} from './m3-schema'
import {gmSpellChoiceSchema} from './gm-spell-choice-schema'
import {summonPositionSchema,summonOptionsSchema} from './summon-schema'
import {m3DestinationSchema} from './m3-world-schema'
const id=z.string().min(1).max(120).refine(s=>!['__proto__','constructor','prototype'].includes(s)),note=z.string().trim().min(1).max(1000)
export const summonCastActionSchema=z.object({operation:z.literal('cast'),sourceId:id,key:spellKeySchema,mode:id,form:id,position:summonPositionSchema,materialId:z.string().max(120),receipt:id,note,options:summonOptionsSchema.optional()}).strict()
export const summonActionSchema=z.discriminatedUnion('operation',[
 summonCastActionSchema,
 z.object({operation:z.literal('steed-rest'),instanceId:id,startedHour:z.number().finite().nonnegative(),receipt:id,note}).strict(),
 z.object({operation:z.literal('phase'),instanceId:id,targetId:id.optional(),phase:z.enum(['start','end']),receipt:id,note}).strict(),
 z.object({operation:z.literal('gear'),instanceId:id,objectId:id,holderId:id.optional(),to:m3DestinationSchema.optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('remains'),corpseId:id,form:z.enum(['skeleton','zombie']),equipment:z.array(z.object({objectId:id,itemId:id}).strict()).max(10),receipt:id,note}).strict(),
 z.object({operation:z.literal('force-damage'),instanceId:id,amount:z.number().int().min(1).max(10000),receipt:id,note}).strict(),
 z.object({operation:z.literal('resolve-cast'),draftId:id,receipt:id,note}).strict(),
 z.object({operation:z.literal('command'),sourceId:id,instanceIds:z.array(id).min(1).max(22),text:note,targetId:id.optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('move'),instanceId:id,to:m3DestinationSchema,mode:z.enum(['walk','climb','swim','fly']),supportId:id.optional(),reactionsConfirmed:z.boolean().optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('fey-step'),instanceId:id,to:m3DestinationSchema,targetId:id.optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('familiar'),instanceId:id,action:z.enum(['pocket','return','end','senses','communicate','mimic','ink','help','jump']),to:m3DestinationSchema.optional(),targetId:id.optional(),text:z.string().max(1000).optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('touch-cast'),instanceId:id,key:spellKeySchema,mode:id,targetId:id,materialId:id.optional(),choice:m3CastChoiceSchema.optional(),gmChoice:gmSpellChoiceSchema.optional(),weaponId:id.optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('chain-attack'),instanceId:id,targetId:id,receipt:id,note}).strict(),
 z.object({operation:z.literal('mount'),instanceId:id,riderId:id,mount:z.boolean(),to:m3DestinationSchema.optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('steed-power'),instanceId:id,targetId:id.optional(),to:m3DestinationSchema.optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('servant-task'),instanceId:id,to:m3DestinationSchema,objectId:id.optional(),task:z.enum(['fetch','put','clean','mend','fold','light','serve','pour','wait']),supply:z.object({batchId:id,containerId:id,units:z.number().int().min(1).max(1000000)}).strict().optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('carry'),instanceId:id,objectId:id,take:z.boolean(),receipt:id,note}).strict(),
 z.object({operation:z.literal('event'),eventId:id,to:m3DestinationSchema.optional(),useReaction:z.boolean().optional(),decline:z.boolean().optional(),receipt:id,note}).strict(),
 z.object({operation:z.literal('follow'),instanceId:id,sceneId:id,to:m3DestinationSchema,receipt:id,note}).strict(),
 z.object({operation:z.literal('attach'),instanceId:id,receipt:id,note}).strict(),
 z.object({operation:z.literal('task-complete'),instanceId:id,receipt:id,note}).strict(),
])
export type SummonAction=z.infer<typeof summonActionSchema>
