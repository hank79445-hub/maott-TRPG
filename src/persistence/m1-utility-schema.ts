import {spellKeySchema} from './item-spell-schema'
import {z} from 'zod'
const id=z.string().min(1).max(160),num=z.number().finite().nonnegative()
export const m1CastSchema=z.object({operation:z.literal('cast'),characterId:id,key:spellKeySchema,mode:id,targetId:id,materialId:id.optional(),confirmed:z.literal(true),reactionsConfirmed:z.boolean().optional(),note:z.string().min(1).max(2000)}).strict()
export const m1ObjectSchema=z.object({id,sceneId:id,name:z.string().min(1).max(200),
 x:z.number().int().min(0).max(199),y:z.number().int().min(0).max(199),
 food:z.boolean(),magical:z.boolean(),poisoned:z.boolean(),rotten:z.boolean(),cursed:z.boolean(),
 boundCharacterId:id.optional(),inventoryInstanceId:id.optional()}).strict()
export const m1UtilitySchema=z.object({
 casts:z.array(z.object({id,encounterId:id,action:m1CastSchema}).strict()).max(1000).optional(),
 corpses:z.array(z.object({id,entityId:id,sceneId:id,clockSourceId:id,deathHour:num.nullable(),dead:z.boolean(),
 oldAge:z.boolean(),bodyViable:z.boolean(),repose:z.array(z.object({start:num,end:num}).strict().refine(v=>v.end>v.start)).max(100)}).strict()).max(1000),
 materials:z.array(z.object({characterId:id,instanceId:id,kind:z.enum(['diamond','copper','holy-water','silver-powder','diamond-dust']),valueGP:num.max(1000000)}).strict()).max(1000),
 objects:z.array(m1ObjectSchema).max(1000),
 pulses:z.array(z.object({castId:id,window:z.number().int().min(0).max(9)}).strict()).max(1000),
}).strict()
export const m1ActionSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('material'),characterId:id,instanceId:id,kind:z.enum(['diamond','copper','holy-water','silver-powder','diamond-dust']),valueGP:num.max(1000000)}).strict(),
 z.object({operation:z.literal('corpse'),entityId:id,ageSeconds:num.max(31536000),oldAge:z.boolean(),bodyViable:z.boolean()}).strict(),
 z.object({operation:z.literal('object'),object:m1ObjectSchema}).strict(),
 m1CastSchema,
 z.object({operation:z.literal('pulse'),characterId:id,targetId:id,window:z.number().int().min(0).max(9),confirmed:z.literal(true),note:z.string().min(1).max(2000)}).strict(),
])
export type M1Action=z.infer<typeof m1ActionSchema>
