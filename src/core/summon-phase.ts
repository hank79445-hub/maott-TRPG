import {m3ActionCost} from './m3-world-actions'
import type {MapWorld,Adventure,MapScene,MapToken} from './map-types'
import type {Catalogue} from './engine'
import type {SummonAction} from '../persistence/summon-action-schema'
import {summonState} from './summon-world'
import {m1Entity} from './m1-utility'
import {distance,blocked,inside,directPath} from './map'
import {movementWalls} from './map-spatial'
import {m3Hazard} from './m3-space-events'
import {validateM3Route} from './m3-route'
import {m3Airspace} from './m3-world-actions'
import {m3Landing} from './m3-world-cast'
import {rollDamage,combatStats,freshTurn} from './combat-rules'
import {summonSave,saveEffect,summonDC} from './summon-operations'
import {gClock,gCurrentHours} from './gm-spell-world'
import {nextTurnTick,applyCombat} from './combat'
import {magicCrossing} from './scene-magic'
import {tokenPoint} from './scene-effects'
import {prepareTerrainRoute,terrainTouches,queueTerrain,terrainTurn} from './scene-terrain'
import {spatialState,spatialDistance} from './m3-spatial'
export function summonPhase(w:MapWorld,a:Adventure,s:MapScene,t:MapToken,phase:'start'|'end',cat:Catalogue){
 const state=summonState(a),e=w.encounters.find(e=>e.id===s.encounterId&&e.phase==='active'),turn=e?e.id+':'+e.tick:terrainTurn(w,a,s),entity=m1Entity(w,a,t.characterId??t.npcId??t.actorId??t.id)
 const queue=(instanceId:string,type:'putrid-aura'|'ghost-eject'|'dismount'|'ink-cloud',targetId?:string)=>{const events=state.events??=[];if(!events.some(v=>v.instanceId===instanceId&&v.type===type&&v.targetId===targetId&&v.turn===turn)){if(events.length>=2000)throw Error('召唤后果记录达到上限');events.push({id:crypto.randomUUID(),instanceId,type,targetId,turn,status:'pending',note:'实际'+phase+'时序后果'})}}
 if(phase==='start'){
  for(const i of state.instances){if(i.senses&&i.senses.sourceId===entity?.id&&i.senses.encounterId===e?.id&&(i.senses.expiresTick??Infinity)<=(e?.tick??0))delete i.senses
   if(i.spellId!=='summon-undead'||i.form!=='putrid'||i.state!=='present'||i.sourceEntityId===entity?.id)continue
   const from=s.tokens.find(t=>t.id===i.id);if(from&&distance(s,from,t)<=5&&spatialState(from.spatial).layer===spatialState(t.spatial).layer)queue(i.id,'putrid-aura',entity?.id)
  }
 }
 if(phase==='end'){
  for(const i of state.instances){if(i.spellId!=='find-familiar'||i.form!=='Octopus'||i.state!=='present'||i.uses?.inkDay===String(Math.floor(gCurrentHours(w,a)/24)))continue
   const from=s.tokens.find(t=>t.id===i.id),water=from&&a.m3?.entities.find(o=>o.kind==='liquid'&&o.enabled&&o.sceneId===s.id&&[from,t].every(p=>p.x>=o.x&&p.y>=o.y&&p.x<o.x+o.width/s.grid.feet&&p.y<o.y+o.depth/s.grid.feet&&(p.spatial?.height??0)<o.height));if(from&&water&&distance(s,from,t)<=5&&entity?.id!==i.id)queue(i.id,'ink-cloud',entity?.id)
  }
  const i=state.instances.find(i=>i.id===t.id&&i.spellId==='summon-undead'&&i.form==='ghostly'&&i.state==='present')
  if(i&&(blocked(s,t)||movementWalls(s,t,t,t).some(w=>w.heightFeet===undefined||(t.spatial?.height??0)<w.heightFeet)))queue(i.id,'ghost-eject')
  {const any=state.instances.find(i=>i.id===t.id);if(any)for(const r of a.sceneEffects?.regions??[])if(r.status==='active'&&r.sourceId===any.id&&r.spellId==='fey-tricksy'&&any.uses?.darknessTurn!==turn)r.status='ended'}
 }
 return (state.events??[]).some(v=>v.status==='pending'&&(v.targetId===entity?.id||v.instanceId===t.id))
}
export function settleSummonEvent(w:MapWorld,a:Adventure,c:Extract<SummonAction,{operation:'event'}>,cat:Catalogue,dice:(n:number)=>number){
 const event=a.summons?.events?.find(v=>v.id===c.eventId&&v.status==='pending'),i=event&&a.summons?.instances.find(i=>i.id===event.instanceId),s=a.scenes.find(s=>s.id===i?.position?.sceneId),token=s?.tokens.find(t=>t.id===i?.id)??(i?.position?{id:i.id,name:i.body?.name??'坐骑',characterId:null,actorId:null,x:i.position.x,y:i.position.y,span:i.position.span,spatial:i.position.spatial,hidden:false,color:'#597a60',facing:0}:undefined)
 if(!event||!i||!s||!token)throw Error('原实际后果已失效或结算')
 if(i.receipts.some(r=>r.id===c.receipt))throw Error('该操作已处理')
 if(event.type==='ink-cloud'){
  if(!c.decline)throw Error('请在魔宠能力入口使用已保存的墨水云反应，或明确放弃')
  event.note+='；GM明确放弃反应'
 }else if(event.type==='putrid-aura'){
  if(!event.targetId)throw Error('目标缺失');summonDC(w,a,i,cat)
  const target=m1Entity(w,a,event.targetId);if(!target?.token||distance(s,token,target.token)>5)throw Error('原光环目标已离开，须GM核对原时序')
  const roll=summonSave(w,a,target.id,'con',cat,dice,'poison'),e=w.encounters.find(e=>e.id===s.encounterId&&e.phase==='active')
  if(roll.autoFail||roll.total<i.dc!)saveEffect(w,a,i,target.id,'putrid-aura','poisoned',cat,{expiresAt:e&&target.actor?nextTurnTick(e,target.actor.id):null,phase:'start',endsAt:gClock(w,a,i.sourceEntityId).hours+2/600})
  event.note+='；体质 '+roll.total+'/DC '+i.dc
 }else if(event.type==='ghost-eject'){
  if(!c.to)throw Error('请选择最近合法空位')
  const choices:{x:number;y:number;height:number;distance:number}[]=[]
  for(let y=0;y<s.grid.rows;y++)for(let x=0;x<s.grid.columns;x++){const to={x,y,height:token.spatial?.height??0};try{m3Landing(s,token,to);choices.push({...to,distance:distance(s,token,{...to,spatial:{height:to.height,layer:token.spatial?.layer??'material'}})})}catch{/* not a legal space */}}
  const best=Math.min(...choices.map(v=>v.distance)),chosen=choices.find(v=>v.x===c.to!.x&&v.y===c.to!.y&&v.height===c.to!.height)
  if(!chosen||chosen.distance!==best)throw Error('须最近的实际未占据空位，不能用挤出免费远距传送')
  const amount=rollDamage(Math.max(1,Math.ceil(best/5))+'d10',dice).total
  token.x=chosen.x;token.y=chosen.y;token.spatial={...spatialState(token.spatial),height:chosen.height};m3Hazard(w,a,i.id,amount,'force',cat,dice);event.note+='；挤出'+best+'尺，力场'+amount
 }else{
  const rider=i.riderId?m1Entity(w,a,i.riderId):undefined;if(!rider?.token)throw Error('实际骑手已不存在')
  if(event.reason==='displaced'||event.reason==='rider-prone'){
   const save=summonSave(w,a,rider.id,'dex',cat,dice);event.note+='；敏捷 '+save.total+'/DC10'
   if(!save.autoFail&&save.total>=10&&i.state!=='vanished'){rider.token.x=token.x;rider.token.y=token.y;rider.token.spatial={...spatialState(token.spatial)};event.status='resolved';i.receipts.push({id:c.receipt,operation:event.type});return}
  }
  if(!c.to)throw Error('请选择坐骑5尺内实际下马地面空位')
  const ground=a.m3?.environments.find(e=>e.sceneId===s.id)?.floorHeight??0
  if(c.to.height!==ground)throw Error('下马／坠落落点须实际地面高度，不能凭空停在半空')
  m3Landing(s,rider.token,c.to);if(distance(s,{...token,spatial:{...spatialState(token.spatial),height:c.to.height}},{...c.to,spatial:{height:c.to.height,layer:token.spatial?.layer??'material'}})>5)throw Error('下马必须在坐骑5尺内')
  let upright=false
  if(event.reason==='mount-prone'&&c.useReaction){event.status='resolved';m3ActionCost(w,a,rider.id,'reaction',cat);upright=true}
  const fall=Math.max(0,(rider.token.spatial?.height??0)-ground)
  rider.token.x=c.to.x;rider.token.y=c.to.y;rider.token.spatial={height:c.to.height,layer:token.spatial?.layer??'material'};if(rider.c)rider.c.runtime!.mounted=false;delete i.riderId;delete token.riderTokenId
  if(!upright||fall>=10){if(!rider.state.conditions.includes('prone'))rider.state.conditions.push('prone');if(fall>=10)m3Hazard(w,a,rider.id,rollDamage(Math.min(20,Math.floor(fall/10))+'d6',dice).total,'bludgeoning',cat,dice)}

 }
 event.status='resolved';i.receipts.push({id:c.receipt,operation:event.type})
}
export function moveGhost(w:MapWorld,a:Adventure,id:string,to:{x:number;y:number;height:number},mode:'walk'|'climb'|'swim'|'fly',cat:Catalogue,dice:(n:number)=>number,reactionsConfirmed=false){
 const entity=m1Entity(w,a,id),s=a.scenes.find(s=>s.tokens.includes(entity?.token!)),t=entity?.token
 if(!s||!t||!entity?.body)throw Error('幽体不存在')
 const e=w.encounters.find(e=>e.id===s.encounterId&&e.phase==='active'),actor=e?.actors.find(t=>t.id===entity.actor?.id),cap=combatStats(entity.actor??{id,characterId:null,npc:entity.body,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},w.characters,cat).spatialCapabilities
 if(!['walk','fly'].includes(mode)||cap[mode]===0||mode==='walk'&&to.height!==0||!inside(s,to))throw Error('不合法幽体移动方式或范围')
 if(s.tokens.some(v=>v.id!==t.id&&v.x===to.x&&v.y===to.y&&v.spatial?.height===to.height))throw Error('不能停留在其他生物占据位置')
 validateM3Route(w,a,s,t,to,entity.state.effects??[],cat,reactionsConfirmed,mode)
 m3Airspace(a,s,to.height)
 const path=prepareTerrainRoute(w,a,s,t,directPath(t,to).map(p=>({...p,height:to.height})),mode,reactionsConfirmed),end=path.at(-1);if(!end)throw Error('路线为空')
 let cost=0,previous:{x:number;y:number;height:number}={x:t.x,y:t.y,height:t.spatial?.height??0}
 for(const p of path){cost+=spatialDistance({...previous,spatial:{height:previous.height,layer:'material'}},{...p,spatial:{height:p.height,layer:'material'}},s.grid.feet)*(blocked(s,p)||movementWalls(s,t,previous,p).length?2:1);previous=p}
 if(e&&actor){if(e.actors[e.current]?.id!==actor.id||actor.turn.movement+cost>cap[mode]+actor.turn.dash)throw Error('实际幽体移动预算不足');actor.turn.movement+=cost}else if(cost>cap[mode])throw Error('一次明确移动不能超过实际速度')
 magicCrossing(w,a,s,tokenPoint(t),{x:end.x+.5,y:end.y+.5,height:end.height},id)
 t.x=end.x;t.y=end.y;t.spatial={...spatialState(t.spatial),height:end.height}
}
