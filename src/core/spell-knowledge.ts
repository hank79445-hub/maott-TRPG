import type {Adventure,MapToken} from './map-types'
const plane=(t:MapToken)=>t.spatial?.layer==='stone'?'material':t.spatial?.layer??'material'
export function mindSpikeKnows(a:Adventure,from:MapToken,to:MapToken){
 const sources=[from.id,from.characterId,from.npcId,from.actorId],targets=[to.id,to.characterId,to.npcId,to.actorId]
 return plane(from)===plane(to)&&(plane(from)!=='pocket'||from.spatial?.anchorId===to.spatial?.anchorId)&&!!a.sceneEffects?.regions.some(e=>e.status==='active'&&e.spellId==='mind-spike'&&e.m5?.held&&sources.includes(e.sourceId)&&targets.includes(e.m5.targetId??''))
}
