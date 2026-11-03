import type {Adventure,MapWorld,MapScene,MapToken,Position} from './map-types'
import type {ActiveEffect} from './types'
import type {Catalogue} from './engine'
import {clone} from './engine'
import {runtimeState} from './runtime'
import {explorationActor} from './exploration'
import {savingRoll,defaultEnvironment,combatStats} from './combat-rules'
import {areaTargets} from './map-area'

/** A failed save is remembered even while outside; its restriction applies only inside.
 * The source's own ledger conveys its rule-granted knowledge, never a public announcement. */
export function refreshTruthZones(world:MapWorld,a:Adventure,scene:MapScene,token:MapToken,path:Position[],cat:Catalogue,dice:(n:number)=>number,start=false){
 const all:ActiveEffect[]=[]
 for(const c of world.characters)all.push(...(c.runtime?.effects??[]))
 for(const e of world.encounters)for(const actor of e.actors)if(actor.npc)all.push(...actor.npc.effects)
 for(const n of a.ai?.npcs??[])if(n.body)all.push(...n.body.effects)
 const sources=all.filter(f=>f.key==='zone-of-truth-source'&&f.control?.region?.sceneId===scene.id).filter((f,i,rows)=>rows.findIndex(row=>row.id===f.id)===i)
 if(!sources.length)return
 const target=explorationActor(world,token),c=world.characters.find(c=>c.id===token.characterId),state=c?runtimeState(c,cat):target.npc
 if(!state||combatStats(target,world.characters,cat).dead)return
 if(c)c.runtime=state as ReturnType<typeof runtimeState>
 const encounter=world.encounters.find(e=>e.id===scene.encounterId&&e.phase==='active')
 const turn=encounter?encounter.id+':'+encounter.tick:a.exploration?.status==='active'?a.exploration.id+':'+a.exploration.round:'outside:'+Math.floor((world.characters[0]?.runtime?.hours??0)*600+1e-7)
 for(const source of sources){
  const clock=world.characters.find(c=>c.id===source.clockSourceId)?.runtime?.hours??0
  if(source.endsAt!==undefined&&source.endsAt<=clock)continue
  const region=source.control!.region!
  if(region.template.propagation!=='straight')continue // Explicit manual geometry stays under the GM's ruling.
  const within=(p:Position)=>areaTargets({...scene,tokens:[{...token,...p}]},region.template)[0]?.eligible===true
  let mark=state.effects.find(f=>f.key==='zone-of-truth'&&f.castId===source.castId)
  const touched=path.some(within),lastInside=within(path.at(-1)??token)
  if(!mark&&!touched)continue
  if(!mark){mark={...clone(source),id:crypto.randomUUID(),key:'zone-of-truth',name:'诚实之域',control:{dc:source.control!.dc,targets:[],text:'范围内不能故意说谎，可以拒答或回避',inside:false},note:'来源知道豁免结果；不自动识谎'};state.effects.push(mark)}
  if(!mark.control)continue
  const trigger=(start&&lastInside||path.some((p,i)=>within(p)&&!(i===0?mark!.control!.inside:within(path[i-1]!))))
  if(trigger&&mark.control.result!==false&&mark.control.turnKey!==turn){
   const roll=savingRoll(target,'cha',{...defaultEnvironment(),advantage:!!target.npc?.magicResistance},world.characters,cat,dice)
   mark.control.result=!roll.autoFail&&roll.total>=mark.control.dc;mark.control.turnKey=turn
   const current=world.characters.flatMap(c=>c.runtime?.effects??[]).find(f=>f.id===source.id)??source
   current.control!.trials=[...(current.control!.trials??[]).filter(r=>r.targetId!==target.id),{targetId:target.id,success:mark.control.result}]
  }
  mark.control.inside=lastInside
 }
}
