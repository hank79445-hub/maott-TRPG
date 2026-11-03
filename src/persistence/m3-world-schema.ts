import {spellKeySchema} from './item-spell-schema'
import {effectSchema} from './schema'
import { z } from 'zod'
import { m3CastChoiceSchema, spaceLayerSchema } from './m3-schema'
const id=z.string().min(1).max(120).refine(s=>!['__proto__','constructor','prototype'].includes(s))
const feet=z.number().finite().min(-10000).max(10000),nonnegative=z.number().finite().min(0).max(100000)
export const m3DestinationSchema=z.object({x:z.number().int().min(0).max(79),y:z.number().int().min(0).max(79),height:feet}).strict()
export const m3EntitySchema=z.object({
 id,sceneId:id,name:z.string().min(1).max(200),kind:z.enum(['object','rope','stone','surface','liquid','plants','disk','portal']),
 x:z.number().int().min(0).max(79),y:z.number().int().min(0).max(79),height:feet,
 width:nonnegative,heightFeet:nonnegative,depth:nonnegative,weight:nonnegative,
 mundaneTask:z.object({operation:z.enum(['clean','mend','fold']),sourceId:id,receipt:id,status:z.enum(['working','completed'])}).strict().optional(),
 supportsStanding:z.boolean().optional(),
 loose:z.boolean(),enabled:z.boolean(),hidden:z.boolean(),inventoryInstanceId:id.optional(),boundCharacterId:id.optional(),
 sourceId:id.optional(),castId:id.optional(),clockSourceId:id.optional(),endsAt:nonnegative.optional(),
 retracted:z.boolean().optional(),knownTo:z.array(id).max(100).optional(),
 targetIds:z.array(id).max(100).optional(),loadIds:z.array(id).max(100).optional(),
 effects:z.array(effectSchema).max(100).optional(),option:m3CastChoiceSchema.optional(),magical:z.boolean().optional(),layer:spaceLayerSchema.optional(),anchorId:id.optional(),
}).strict()
export const m3CastSchema=z.object({operation:z.literal('cast'),casterId:id,key:spellKeySchema,mode:id,targets:z.array(id).min(1).max(100),
 objectId:id.optional(),to:m3DestinationSchema.optional(),choice:m3CastChoiceSchema.optional(),materialId:id.optional(),
 willing:z.boolean().default(false),confirmed:z.literal(true),note:z.string().min(1).max(2000),}).strict()
export const m3SceneFactsSchema=z.object({sceneId:id,floorHeight:feet,light:z.enum(['bright','dim','dark','magical-darkness']).optional(),storm:z.boolean().optional(),openSky:z.boolean(),ceilingHeight:feet.optional()}).strict().refine(s=>s.openSky||s.ceilingHeight!==undefined,'室内须登记实际天花板高度')
export const m3ActionSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('environment'),facts:m3SceneFactsSchema}).strict(),
 z.object({operation:z.literal('entity'),entity:m3EntitySchema}).strict(),m3CastSchema,
 z.object({operation:z.literal('move'),entityId:id,to:m3DestinationSchema,mode:z.enum(['walk','climb','swim','fly']),reactionsConfirmed:z.boolean().optional(),supportId:id.optional(),note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('effect-action'),entityId:id,effectId:id,action:z.enum(['alter-option','end-form','levitate','water-cross','stone-exit']),choice:m3CastChoiceSchema.optional(),to:m3DestinationSchema.optional(),note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('portal'),entityId:id,portalId:id,enter:z.boolean(),note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('turn-phase'),entityId:id,phase:z.enum(['start','end']),note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('initial-config'),sceneId:id,note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('material'),ownerId:id,instanceId:id,valueGP:z.number().finite().min(25).max(1000000),note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('portal-control'),portalId:id,retracted:z.boolean(),knownTo:z.array(id).max(100),note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('disk'),diskId:id,action:z.enum(['load','unload','follow']),entityId:id.optional(),to:m3DestinationSchema.optional(),note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('event'),eventId:id,to:m3DestinationSchema.optional(),stoneDamage:z.enum(['minor','partial','destroyed']).optional(),note:z.string().min(1).max(2000)}).strict(),
 z.object({operation:z.literal('aura-day'),castId:id,day:z.number().int().min(0).max(100000),note:z.string().min(1).max(2000)}).strict(),
])
export type M3Action=z.infer<typeof m3ActionSchema>
export type M3Cast=z.infer<typeof m3CastSchema>
export type M3Entity=z.infer<typeof m3EntitySchema>
export const m3EventSchema=z.object({id,type:z.enum(['fall','return','eject','descend','stone-damage']),entityId:id,sceneId:id,
 castId:id.optional(),from:m3DestinationSchema,layer:spaceLayerSchema,anchorId:id.optional(),status:z.enum(['pending','resolved']),
 damage:z.number().int().min(0).max(1000).optional(),to:m3DestinationSchema.optional(),createdTurn:z.string().max(240).optional(),note:z.string().max(2000),}).strict()
export const m3WorldSchema=z.object({environments:z.array(m3SceneFactsSchema).max(100),entities:z.array(m3EntitySchema).max(1000),events:z.array(m3EventSchema).max(2000),
 casts:z.array(z.object({id,spellId:id,castHour:nonnegative,action:m3CastSchema,encounterId:id.optional(),sceneId:id,castId:id,clockSourceId:id,endsAt:nonnegative,settled:z.boolean(),canceled:z.boolean().optional()}).strict()).max(2000),
 knowledge:z.array(z.object({observerId:id,targetId:id,sceneId:id,name:z.string().max(200),x:z.number().int().min(0).max(79),y:z.number().int().min(0).max(79),height:feet,layer:spaceLayerSchema,anchorId:id.optional()}).strict()).max(20000).default([]),
 materials:z.array(z.object({ownerId:id,instanceId:id,valueGP:z.number().finite().min(25).max(1000000)}).strict()).max(1000).default([]),
 reactions:z.array(z.object({sourceId:id,round:z.string().max(240)}).strict()).max(1000).default([]),
 auraDays:z.array(z.object({sourceId:id,targetId:id,days:z.array(z.number().int().min(0).max(100000)).max(30),castIds:z.array(id).max(30)}).strict()).max(1000),}).strict()
export type M3WorldState=z.infer<typeof m3WorldSchema>
