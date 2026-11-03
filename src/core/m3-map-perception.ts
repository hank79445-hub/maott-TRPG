import {gCurrentHours} from './gm-spell-world'
import {mindSpikeKnows} from './spell-knowledge'
import {sceneQueryCache} from './scene-query-cache'
import {sceneVision,sceneIllumination,tokenSceneVision} from './scene-lighting'
import {tokenPoint} from './scene-effects'
import {regionContains} from './scene-propagation'
import {combatStats,freshTurn} from './combat-rules'
import type { MapWorld, Adventure, MapScene, MapToken } from './map-types'
import type { Catalogue } from './engine'
import { runtimeDerived } from './runtime'
import { sightLine } from './map-spatial'
import { distance } from './map'
import { spatialPerception } from './m3-spatial'
export function tokenM3State(world:MapWorld,a:Adventure,t:MapToken,cat:Catalogue){
  const n=a.ai?.npcs.find(n=>n.id===t.npcId),c=world.characters.find(c=>c.id===(t.characterId??n?.characterId))
  const body=world.encounters.flatMap(e=>e.actors).find(x=>x.id===(t.actorId??n?.actorId))?.npc??n?.body??t.npcBody
  const derived=c?runtimeDerived(c,cat):undefined
  const npcConditions=body?combatStats({id:t.id,characterId:null,npc:body,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},world.characters,cat).conditions:[]
  const sense=(kind:RegExp)=>Math.max(0,...(body?.templateMetadata?.senses??[]).filter(s=>kind.test(s)).map(s=>Number(s.match(/\d+/)?.[0]??0)))
  return {effects:c?.runtime?.effects??body?.effects??[],invisible:(derived?.conditions??npcConditions).includes('invisible'),blinded:(derived?.conditions??npcConditions).includes('blinded'),
    devilsSight:derived?.devilsSight??0,darkvision:derived?.spatialCapabilities.darkvision??sense(/darkvision|黑暗视觉/i),blindsight:derived?.blindsight??sense(/blindsight|盲视/i),truesight:sense(/truesight|真实视觉/i),spatial:t.spatial}
}
/** Cache is scoped to one immutable projection/reconciliation pass, never across transactions. */
export const m3PerceptionCache=()=>({states:new Map<string,ReturnType<typeof tokenM3State>>(),lit:new Map<string,boolean>(),sceneQueries:new Map<string,ReturnType<typeof sceneQueryCache>>()})
export function tokenPerception(world:MapWorld,a:Adventure,s:MapScene,from:MapToken,to:MapToken,cat:Catalogue,locationKnown?:boolean,cache= m3PerceptionCache()){
  const senseLink=a.summons?.instances.find(i=>i.spellId==='find-familiar'&&i.state==='present'&&i.senses&&[from.characterId,from.npcId,from.actorId,from.id].includes(i.senses.sourceId)&&i.senses.endsAt>gCurrentHours(world,a)),familiar=senseLink&&s.tokens.find(t=>t.id===senseLink.id),battle=senseLink&&world.encounters.find(e=>e.id===senseLink.senses?.encounterId)
  if(familiar&&distance(s,from,familiar)<=100&&(!battle||battle.tick<(senseLink!.senses!.expiresTick??0))){const body=world.encounters.flatMap(e=>e.actors).find(t=>t.id===familiar.actorId)?.npc??familiar.npcBody;if(body&&!body.dead&&body.hp>0&&!combatStats({id:familiar.id,characterId:null,npc:body,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},world.characters,cat).conditions.includes('incapacitated'))from=familiar}
  const state=(t:MapToken)=>{let value=cache.states.get(t.id);if(!value){value=tokenM3State(world,a,t,cat);cache.states.set(t.id,value)}return value}
  const tracking=mindSpikeKnows(a,from,to)
  const targetState=()=>tracking?{...state(to),invisible:false,effects:state(to).effects.map(f=>({...f,key:f.key==='invisibility'?'mind-spike-no-invisibility-benefit':f.key,condition:f.condition==='invisible'?undefined:f.condition,conditions:f.conditions?.filter(c=>c!=='invisible')}))}:state(to)
  if(locationKnown==null){
    const last=a.m3?.knowledge?.find(k=>k.observerId===from.id&&k.targetId===to.id&&k.sceneId===s.id)
    locationKnown=!!last&&last.x===to.x&&last.y===to.y&&last.height===(to.spatial?.height??0)&&last.layer===(to.spatial?.layer??'material')&&last.anchorId===to.spatial?.anchorId
  }
  if(tracking)locationKnown=true
  let query=cache.sceneQueries.get(s.id);if(!query){query=sceneQueryCache();cache.sceneQueries.set(s.id,query)}
  const pocket=from.spatial?.layer==='pocket'&&a.m3?.entities.find(e=>e.id===from.spatial!.anchorId&&e.kind==='portal'&&e.enabled)
  if(pocket&&(!to.spatial||to.spatial.layer==='material')){
    const outside=sceneVision(world,a,s,{x:pocket.x+.5,y:pocket.y+.5,height:pocket.height,layer:'material'},tokenPoint(to),state(from),query)
    const result=spatialPerception({illuminated:outside.illuminated,magicalDarkness:outside.magicalDarkness,observer:{...state(from),spatial:{height:pocket.height,layer:'material'}},target:{...targetState(),gmHidden:to.hidden&&!tracking},distance:distance(s,{...from,x:pocket.x,y:pocket.y,spatial:{height:pocket.height,layer:'material'}},to),lineOfSight:outside.ray.clear,locationKnown})
    return {...result,sameInteractionSpace:false,reasons:[...result.reasons,'只能从魔绳入口观察，不能跨空间互动']}
  }
  const light=a.m3?.environments.find(f=>f.sceneId===s.id)?.light??'bright'
  const outlined=cache.lit.get(to.id)??(s.tokens.some(t=>state(t).effects.some(e=>e.key==='faerie-fire')&&distance(s,t,to)<=10&&sightLine(s,t,to).clear)||!!a.m3?.entities.some(e=>e.enabled&&e.sceneId===s.id&&e.effects?.some(f=>f.key==='faerie-fire')&&distance(s,{...e,spatial:{height:e.height,layer:'material'}},to)<=10&&sightLine(s,e,to).clear))
  cache.lit.set(to.id,outlined)
  const vision=tokenSceneVision(world,a,s,from,to,state(from),query)
  const result=spatialPerception({illuminated:vision.illuminated||!!outlined&&!vision.light.magicalDarkness,magicalDarkness:vision.magicalDarkness,observer:state(from),target:{...targetState(),gmHidden:to.hidden&&!tracking},distance:distance(s,from,to),lineOfSight:vision.ray.clear,locationKnown})
  return {...result,perceptionDisadvantage:vision.lightlyObscured,reasons:[...new Set([...result.reasons,...vision.ray.reasons,...(vision.lightlyObscured?['轻度遮蔽：依赖视觉的察觉检定劣势']:[])])]}
}

/** An unassigned spectator has only the ordinary GM-published map, never another creature's special senses. */
export function publicCameraToken(world:MapWorld,a:Adventure,s:MapScene,t:MapToken,cat:Catalogue){const lit=sceneIllumination(world,a,s,tokenPoint(t)),light=lit.magicalDarkness?'magical-darkness':lit.level,state=tokenM3State(world,a,t,cat);if(a.sceneEffects?.regions.some(e=>e.obscurity==='heavy'&&regionContains(world,a,s,e,tokenPoint(t))))return false;return spatialPerception({observer:{effects:[]},target:{...state,gmHidden:t.hidden},distance:0,lineOfSight:true,locationKnown:false,illuminated:light!=='magical-darkness'&&(light!=='dark'||state.effects.some(e=>e.key==='faerie-fire')),magicalDarkness:light==='magical-darkness'}).canSee}
