import type {Adventure,MapWorld,MapScene,MapToken} from './map-types'
import type {Catalogue} from './engine'
import type {ActiveEffect} from './types'
import type {SummonInstance} from '../persistence/summon-schema'
import {clone} from './engine'
import {m1Entity} from './m1-utility'
import {gClock,gCurrentHours} from './gm-spell-world'
import {m3Caster,m3Landing,m3State} from './m3-world-cast'
import {m3ActionCost} from './m3-world-actions'
import {combatStats,defaultEnvironment,freshTurn,savingRoll} from './combat-rules'
import {distance} from './map'
import {sightLine} from './map-spatial'
import {tokenPerception} from './m3-map-perception'
import {sceneEffects,tokenPoint} from './scene-effects'
import {magicCrossing} from './scene-magic'
import {queueTerrain} from './scene-terrain'
import {summonTokenKey} from './summon-world'
import {protectionBlocks} from './protection-evil'
import {runtimeSpells,runtimeDerived} from './runtime'
import {spatialState} from './m3-spatial'
export function summonLive(w:MapWorld,a:Adventure,id:string,cat:Catalogue,allowPocket=false,allowAway=false,allowFading=false){
 const i=a.summons?.instances.find(i=>i.id===id)
 if(!i||!['present',...(allowPocket?['pocket']:[]),...(allowFading?['fading']:[])].includes(i.state)||i.control!=='controlled'||!i.controllerId)throw Error('实体不在场或控制已结束')
 const source=m1Entity(w,a,i.controllerId);if(!source)throw Error('原控制来源已失效，请GM接管')
 const s=a.scenes.find(s=>s.id===i.position?.sceneId),token=s?.tokens.find(t=>t.companionKey===summonTokenKey(i.id)),e=s&&w.encounters.find(e=>e.id===s.encounterId&&e.phase==='active'),actor=e?.actors.find(t=>t.companion?.instanceId===i.id&&!t.companion.dismissed)
 const body=actor?.npc??token?.npcBody??i.body
 if(i.kind!=='force'&&!allowFading&&(!body||body.hp<=0||body.dead))throw Error('实体没有可行动的生命')
 if(i.state!=='pocket'&&(!s||!token&&i.kind!=='force'||!allowAway&&s.id!==a.activeSceneId))throw Error('实体须在当前实际场景')
 if(actor&&combatStats(actor,w.characters,cat).conditions.includes('incapacitated'))throw Error('实体失能，不能执行操作')
 return {i,source,s:s!,token:token??{id:i.id,name:'无形力量',characterId:null,actorId:null,x:i.position!.x,y:i.position!.y,span:1,spatial:i.position!.spatial,hidden:true,color:'#597a60',facing:0},e,actor,body}
}
export function summonBudget(w:MapWorld,a:Adventure,i:SummonInstance,cost:'action'|'bonus'|'reaction',cat:Catalogue){
 if(i.kind==='force')throw Error('无形力量没有独立生物动作预算')
 m3ActionCost(w,a,i.id,cost,cat,cost!=='reaction')
}
export function receipt(i:SummonInstance,id:string,operation:string){
 if(i.receipts.some(r=>r.id===id))throw Error('该次操作已经结算，不能重复收费或执行')
 if(i.receipts.length>=2000)throw Error('操作记录达到上限')
 i.receipts.push({id,operation})
}
export function syncSummonBody(w:MapWorld,a:Adventure,i:SummonInstance){
 const s=a.scenes.find(s=>s.id===i.position?.sceneId),t=s?.tokens.find(t=>t.id===i.id),e=w.encounters.find(e=>e.id===s?.encounterId&&e.phase==='active'),actor=e?.actors.find(t=>t.companion?.instanceId===i.id&&!t.companion.dismissed)
 if(actor?.npc)i.body=clone(actor.npc);else if(t?.npcBody)i.body=clone(t.npcBody)
 if(t&&i.body)t.npcBody=clone(i.body)
}
export function teleportSummon(w:MapWorld,a:Adventure,i:SummonInstance,to:{x:number;y:number;height:number},cat:Catalogue,range:number,visible=true){
 const v=summonLive(w,a,i.id,cat),{s,token}=v
 if(distance(s,token,{...to,spatial:{...spatialState(token.spatial),height:to.height}})>range)throw Error('传送落点超过实际范围')
 m3Landing(s,token,to)
 const probe={...token,...to,id:'summon-probe',spatial:{...spatialState(token.spatial),height:to.height},hidden:false}
 if(visible&&!tokenPerception(w,a,s,token,probe,cat).canSee)throw Error('传送落点必须实际可见')
 magicCrossing(w,a,s,tokenPoint(token),tokenPoint(probe),i.id,{teleport:true})
 token.x=to.x;token.y=to.y;token.spatial=probe.spatial;i.position={sceneId:s.id,x:to.x,y:to.y,span:token.span,spatial:clone(probe.spatial)}
 queueTerrain(w,a,s,token,'enter','summon-teleport:'+i.id+':'+crypto.randomUUID())
}
export function saveEffect(w:MapWorld,a:Adventure,i:SummonInstance,targetId:string,key:string,condition:string|undefined,cat:Catalogue,extra:Partial<ActiveEffect>={}){
 const t=m1Entity(w,a,targetId);if(!t)throw Error('实际目标已失效')
 const actor=t.actor??{id:t.id,characterId:t.c?.id??null,npc:t.body??null,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},stats=combatStats(actor,w.characters,cat)
 if(condition&&['charmed','frightened','possessed'].includes(condition)&&protectionBlocks(stats.effects,i.body?.creatureType??'other',i.id))return false
 if(condition&&(t.body?.conditionImmunities.includes(condition)||stats.effects.some(e=>e.conditionImmunities?.includes(condition))))return false
 const e=w.encounters.find(e=>e.actors.some(v=>v.id===t.actor?.id)&&e.phase==='active'),now=w.characters.find(c=>c.id===gClock(w,a,i.sourceEntityId).id)!.runtime!.hours??0
 const effect:ActiveEffect={id:crypto.randomUUID(),key,name:key,sourceId:i.id,spellId:i.spellId,castId:i.castId,page:0,concentration:false,expiresAt:null,encounterId:e?.id??'outside',phase:'start',clockSourceId:gClock(w,a,i.sourceEntityId).id,endsAt:now+1/60,note:'召唤物实际能力',...(condition?{condition}:{}),...extra}
 t.state.effects=(t.state.effects??[]).filter(f=>!(f.key===key&&f.sourceId===i.id)).concat(effect);return true
}
export function summonSave(w:MapWorld,a:Adventure,targetId:string,ability:'wis'|'con'|'dex',cat:Catalogue,dice:(n:number)=>number,purpose:'normal'|'charm'|'poison'|'fear'='normal'){
 const t=m1Entity(w,a,targetId);if(!t)throw Error('实际目标已失效')
 return savingRoll(t.actor??{id:t.id,characterId:t.c?.id??null,npc:t.body??null,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},ability,defaultEnvironment(),w.characters,cat,dice,purpose)
}
export function summonCloud(w:MapWorld,a:Adventure,i:SummonInstance,to:{x:number;y:number;height:number},size:number,dark:boolean,hours:number){
 const s=a.scenes.find(s=>s.id===i.position!.sceneId)!,clock=gClock(w,a,i.sourceEntityId),state=sceneEffects(a)
 if(state.regions.length>=3000)throw Error('场景区域已满')
 state.regions.push({id:crypto.randomUUID(),castId:i.castId,spellId:dark?'fey-tricksy':'octopus-ink',name:dark?'妖精诡诈黑暗':'墨水云',sourceId:i.id,sourceKind:'npc',clockSourceId:clock.id,slotLevel:i.slot,createdHour:w.characters.find(c=>c.id===clock.id)!.runtime!.hours??0,endsAt:(w.characters.find(c=>c.id===clock.id)!.runtime!.hours??0)+hours,concentration:false,status:'active',sceneId:s.id,anchor:{kind:'point',offsetHeight:0},hidden:false,covered:false,geometry:{shape:'cube',x:to.x,y:to.y,height:to.height,size,heightFeet:size,width:size,angle:0,originSpan:1},obscurity:dark?'magical-darkness':'heavy',channels:['visual',...(dark?['light' as const]:[])],requiresGeometry:false,note:'实际能力生成；保留原施放来源'})
}
export function sameSpace(s:MapScene,from:MapToken,to:MapToken,max:number){
 if(spatialState(from.spatial).layer!==spatialState(to.spatial).layer||spatialState(from.spatial).anchorId!==spatialState(to.spatial).anchorId||distance(s,from,to)>max||!sightLine(s,from,to,'blocksTargeting').clear)throw Error('目标不在实际距离、空间或可触及范围内')
}
/** Mental links require actual range and plane, not a visual ray through a wall. */
export function mentalRange(a:Adventure,s:MapScene,from:MapToken|undefined,to:MapToken,max:number){
 if(!from||![...s.tokens,...s.defeatedTokens??[]].some(t=>t.id===from.id)||spatialState(from.spatial).layer!==spatialState(to.spatial).layer||spatialState(from.spatial).anchorId!==spatialState(to.spatial).anchorId||distance(s,from,to)>max)throw Error('心灵连接不在实际距离或同一空间内；跨场景距离须GM另行核对')
}
export function summonDC(w:MapWorld,a:Adventure,i:SummonInstance,cat:Catalogue){
 if(i.dc!==undefined)return i.dc
 const source=m1Entity(w,a,i.sourceEntityId),conc=source?.c?.runtime?.concentration,grant=source?.c&&runtimeSpells(source.c,cat).find(g=>g.spell.id===i.spellId&&g.source===conc?.source)
 if(source?.c&&grant){const stats=runtimeDerived(source.c,cat);return i.dc=8+stats.pb+stats.mods[grant.ability]}
 if(source?.body?.spellcasting)return i.dc=source.body.spellcasting.dc
 throw Error('原施放缺少可核对的实际DC，须GM核对来源后再处理')
}
export function actualObject(a:Adventure,s:MapScene,id:string){const o=m3State(a).entities.find(o=>o.id===id&&o.sceneId===s.id&&o.enabled&&!o.hidden);if(!o||!o.loose||o.boundCharacterId)throw Error('须已发现、未被携带且可操作的实际物件');return o}
export function dropSummonGear(a:Adventure,i:SummonInstance){if(!i.position)return;for(const id of i.carriedItemIds){const o=a.m3?.entities.find(o=>o.id===id);if(o){o.sceneId=i.position.sceneId;o.x=i.position.x;o.y=i.position.y;o.height=i.position.spatial.height;delete o.boundCharacterId}}i.carriedItemIds=[]}
export const summonTurn=(w:MapWorld,a:Adventure,s:MapScene,id:string)=>{const e=w.encounters.find(e=>e.id===s.encounterId&&e.phase==='active');return e?e.id+':'+e.tick+':'+id:a.exploration?.status==='active'?a.exploration.roundId+':'+id:'time:'+Math.floor(gCurrentHours(w,a)*600+1e-6)+':'+id}
