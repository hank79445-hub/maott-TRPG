import type {Room} from '../online/protocol'
import type {NpcProfile} from '../core/ai-types'
import type {SpatialProposal} from '../persistence/npc-spatial-schema'
import {practicalEnabled} from './practical-review-state'
import {npcSpatialObservation,spatialSource} from './npc-spatial-observation'
/** Only the acting NPC's registered items and explicitly bounded costs count as evidence. */
export function practicalSpatialAllowed(room:Room,n:NpcProfile,p:SpatialProposal){
 const policy=n.spatialPolicy?.practical
 if(!practicalEnabled(room,'exploration')||!policy?.enabled)return false
 if(p.kind==='move')return !!n.spatialPolicy?.autoMove
 if(!p.pointId||!policy.pointIds.includes(p.pointId))return false
 const source=spatialSource(room,n),point=source.scene?.points.find(v=>v.id===p.pointId),view=npcSpatialObservation(room,n)
 if(!point||!point.enabled||!view.points.some(v=>v.id===point.id)&&!(p.kind==='travel'&&view.exits.some(e=>e.pointId===point.id&&e.sceneId===n.sceneId)))return false
 if(p.kind==='travel'&&(!policy.travel||!n.spatialPolicy?.independentTravel||n.importanceRole==='resident'||n.followParty||!view.exits.some(e=>e.pointId===point.id&&e.sceneId===n.sceneId)))return false
 if(p.kind==='interact'&&(!p.operation||!policy.operations.includes(p.operation)))return false
 const limits=Object.fromEntries(policy.itemLimits.map(v=>[v.itemId,v.quantity]))
 const costs=[...(point.consume?[point.consume]:[]),...(point.itemUse?.requirements.filter(r=>r.mode==='attempt'||r.mode==='success')??[])]
 const totals=new Map<string,number>();for(const c of costs)totals.set(c.itemId,(totals.get(c.itemId)??0)+c.quantity)
 if([...totals].some(([id,quantity])=>quantity>(limits[id]??0)))return false
 if(point.resource&&!policy.resourceLimits.some(v=>v.id===point.resource!.id&&v.amount>=point.resource!.amount))return false
 return true
}
