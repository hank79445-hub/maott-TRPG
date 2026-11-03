import type {MapWorld} from './map-types'
import type {Catalogue} from './engine'
import {m3PerceptionCache,tokenPerception} from './m3-map-perception'
import {spatialState} from './m3-spatial'
import {m3State} from './m3-world-cast'
/** Last actually seen position, never an invisible creature's subsequent route. */
export function rememberM3Sight(world:MapWorld,cat:Catalogue){
 for(const a of world.adventures){
  const relevant=!!a.m3||!!a.sceneEffects||a.scenes.some(s=>world.encounters.some(e=>e.id===s.encounterId&&['invisibility','see-invisibility','faerie-fire','blink'].includes(e.pending?.spellId??'')))
  if(!relevant)continue;const state=m3State(a);state.knowledge??=[]
  const cache=m3PerceptionCache()
  // Absolute positions preserve first-match semantics, order and FIFO at capacity.
  const key=(r:{sceneId:string;observerId:string;targetId:string})=>JSON.stringify([r.sceneId,r.observerId,r.targetId])
  const indices=new Map<string,{positions:number[];head:number}>();let offset=0
  state.knowledge.forEach((r,index)=>{const k=key(r),entry=indices.get(k);if(entry)entry.positions.push(index);else indices.set(k,{positions:[index],head:0})})
  for(const s of a.scenes)for(const from of s.tokens)for(const to of s.tokens){if([from,to].some(t=>t.characterId&&a.party.includes(t.characterId)&&s.id!==a.activeSceneId))continue;if(from.id===to.id||!tokenPerception(world,a,s,from,to,cat,false,cache).canSee)continue
   const row={observerId:from.id,targetId:to.id,sceneId:s.id,name:to.name,x:to.x,y:to.y,height:spatialState(to.spatial).height,layer:spatialState(to.spatial).layer,anchorId:to.spatial?.anchorId}
   const k=key(row),entry=indices.get(k)
   if(entry)state.knowledge[entry.positions[entry.head]!-offset]=row
   else{
    if(state.knowledge.length>=20000){const removed=state.knowledge.shift()!,oldKey=key(removed),old=indices.get(oldKey)!;old.head++;if(old.head>=old.positions.length)indices.delete(oldKey);offset++}
    indices.set(k,{positions:[offset+state.knowledge.length],head:0});state.knowledge.push(row)
   }
  }
 }
}
