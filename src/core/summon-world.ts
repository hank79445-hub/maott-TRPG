import type {Adventure,MapWorld} from './map-types'
import type {Combatant,Encounter} from './combat-types'
import type {SummonInstance,SummonState} from '../persistence/summon-schema'
import {clone} from './engine'
import {gEntity,gClock,gCurrentHours} from './gm-spell-world'
import {S_NATIVE_SPIRITS,S_RULES,S_RULE_VERSION,type SummonSpell} from './summon-rules'
import {spatialState} from './m3-spatial'
export const summonState=(a:Adventure):SummonState=>a.summons??={version:1,instances:[],drafts:[],migrationIssues:[]}
export const summonTokenKey=(id:string)=>'summon-instance:'+id
const native=(id?:string)=>(S_NATIVE_SPIRITS as readonly string[]).includes(id??'')
function context(w:MapWorld,a:Adventure,e:Encounter,actor:Combatant){
 const companion=actor.companion,owner=e.actors.find(v=>v.id===companion?.ownerId),source=owner&&gEntity(w,a,owner.characterId??owner.npcId??owner.id).entity
 const scene=a.scenes.find(s=>s.id===e.session?.sceneId||s.encounterId===e.id),token=a.scenes.flatMap(s=>s.tokens).find(t=>t.actorId===actor.id||companion?.instanceId&&t.companionKey===summonTokenKey(companion.instanceId))
 const conc=source?.c?.runtime?.concentration??source?.body?.concentration
 return {owner,source,scene:token?a.scenes.find(s=>s.tokens.includes(token))??scene:scene,token,conc}
}
export function adoptSummon(w:MapWorld,a:Adventure,encounterId:string,actorId:string,note:string,explicit=false,originalEndsAt?:number){
 const e=w.encounters.find(e=>e.id===encounterId),actor=e?.actors.find(v=>v.id===actorId)
 if(!e||!actor?.npc||actor.companion?.source!=='spell-summon'||!native(actor.companion.spellId))throw Error('只能采用已有三灵魄的实际伙伴，不能以此生成任意召唤物')
 const state=summonState(a),existing=state.instances.find(i=>i.id===actor.companion!.instanceId)
 if(existing)return existing
 const {source,conc,scene,token}=context(w,a,e,actor),spellId=actor.companion.spellId as SummonSpell
 if(!source||!scene||!token||!conc||conc.spellId!==spellId||actor.companion.dismissed)throw Error('来源、位置、实际专注或存活映射缺失；保留旧记录供GM处理')
 if(!actor.companion.castId&&!explicit)throw Error('旧伙伴缺少施放ID，需要GM明确确认采用，不能按同名专注猜测')
 if(actor.companion.castId&&conc.castId!==actor.companion.castId)throw Error('旧伙伴不属于当前实际施放实例')
 if(state.instances.length>=200)throw Error('召唤实例容量已满')
 if(conc.endsAt==null&&(!explicit||originalEndsAt===undefined))throw Error('旧伙伴缺少原存在期限，请GM明确原到期游戏时刻，不从现在重新计时')
 if(conc.endsAt==null&&originalEndsAt!==undefined){if(originalEndsAt>(source.c?.runtime?.hours??gCurrentHours(w,a))+S_RULES[spellId].hours)throw Error('原期限超出本术最大持续时间');conc.endsAt=originalEndsAt}
 if(!conc.castId){if(!explicit)throw Error('旧专注没有实例ID');conc.castId=crypto.randomUUID()}
 const id=actor.companion.instanceId??crypto.randomUUID(),clock=gClock(w,a,source.id),rule=S_RULES[spellId]
 actor.companion.instanceId=id;actor.companion.castId=conc.castId;actor.companion.sourceEntityId=source.id
 const instance:SummonInstance={id,castId:conc.castId,sourceEntityId:source.id,controllerId:source.id,spellId,slot:actor.companion.slotLevel??0,form:actor.companion.form??'unknown',templateVersion:S_RULE_VERSION,kind:rule.kind,body:clone(actor.npc),position:{sceneId:scene.id,x:token.x,y:token.y,span:token.span,spatial:spatialState(token.spatial)},actorRefs:[{encounterId:e.id,actorId:actor.id}],state:actor.npc.dead?'dead':'present',control:'controlled',createdHour:clock.hours,existenceEndsAt:conc.endsAt==null?null:clock.hours+conc.endsAt-(source.c?.runtime?.hours??clock.hours),controlEndsAt:rule.controlHours?clock.hours+rule.controlHours:null,concentrationCastId:conc.castId,vanishOnZero:rule.vanishOnZero,vanishOnSourceDeath:rule.vanishOnSourceDeath,carriedItemIds:[],generatedItemIds:[],receipts:[{id:crypto.randomUUID(),operation:explicit?'gm-adopt':'native-map'}],migration:explicit?'adopted':'native',note}
 token.companionKey=summonTokenKey(id);state.instances.push(instance);return instance
}
function dropCarried(w:MapWorld,a:Adventure,i:SummonInstance){
 // Existing actual object instances move; generated gear is separate and is never duplicated as loot.
 if(i.position){for(const id of i.carriedItemIds){const object=a.m3?.entities.find(o=>o.id===id);if(object){object.sceneId=i.position.sceneId;object.x=i.position.x;object.y=i.position.y;object.height=i.position.spatial.height;delete object.boundCharacterId}}}
 for(const id of i.generatedItemIds){const object=a.m3?.entities.find(o=>o.id===id);if(object)object.enabled=false}
 i.carriedItemIds=[]
}
export function endSummon(w:MapWorld,a:Adventure,i:SummonInstance,reason:string){
 if(i.state==='vanished')return
 if(i.riderId){const events=summonState(a).events??=[];if(!events.some(e=>e.instanceId===i.id&&e.type==='dismount'&&e.status==='pending'))events.push({id:crypto.randomUUID(),instanceId:i.id,targetId:i.riderId,type:'dismount',reason:'ended',turn:'end:'+i.castId,status:'pending',note:'坐骑消失，实际下马／坠落待GM处理'})}
 dropCarried(w,a,i);delete i.senses;i.state='vanished';i.control='released';i.controllerId=null;i.note=reason
 if(i.receipts.length<2000)i.receipts.push({id:'end:'+i.castId,operation:'existence-end'})
 for(const ref of i.actorRefs){const actor=w.encounters.find(e=>e.id===ref.encounterId)?.actors.find(t=>t.id===ref.actorId);if(actor?.companion)actor.companion.dismissed=true}
 retireTokens(a,i)
}
function retireTokens(a:Adventure,i:SummonInstance){for(const scene of a.scenes){for(const t of scene.tokens)if(t.companionKey===summonTokenKey(i.id))t.hidden=true;scene.tokens=scene.tokens.filter(t=>t.companionKey!==summonTokenKey(i.id))}}
export function reconcileSummons(w:MapWorld){
 for(const a of w.adventures){
  const relevant=w.encounters.filter(e=>e.session?.adventureId===a.id||a.scenes.some(s=>s.encounterId===e.id)||a.summons?.instances.some(i=>i.actorRefs.some(r=>r.encounterId===e.id)))
  if(!a.summons&&!relevant.some(e=>e.actors.some(t=>t.companion?.source==='spell-summon')))continue
  const state=summonState(a);state.migrationIssues=[]
  for(const d of state.drafts.filter(d=>d.status==='pending'&&d.battle)){const e=w.encounters.find(e=>e.id===d.battle!.encounterId);if(![e?.pending,...(e?.reactionParents??[]),...(e?.attackParents??[])].some(p=>p?.summonDraftId===d.id)){d.status='canceled';d.note+='；原施法窗口结束／反制，未创建实体'}}
  for(const e of relevant)for(const actor of e.actors.filter(t=>t.companion?.source==='spell-summon'&&!t.companion.dismissed)){
   if(actor.companion!.instanceId&&state.instances.some(i=>i.id===actor.companion!.instanceId))continue
   try{adoptSummon(w,a,e.id,actor.id,'实际既有施放的稳定映射')}catch(error){state.migrationIssues.push({encounterId:e.id,actorId:actor.id,reason:(error as Error).message})}
  }
  for(const i of state.instances){
   const matches=relevant.flatMap(e=>e.actors.filter(t=>t.companion?.instanceId===i.id).map(actor=>({e,actor}))).sort((x,y)=>Number(x.actor.companion!.dismissed)-Number(y.actor.companion!.dismissed)||Number(y.e.phase==='active')-Number(x.e.phase==='active'))
   for(const m of matches)if(!i.actorRefs.some(r=>r.actorId===m.actor.id&&r.encounterId===m.e.id))i.actorRefs.push({encounterId:m.e.id,actorId:m.actor.id})
   const live=matches[0],token=a.scenes.flatMap(s=>s.tokens).find(t=>t.companionKey===summonTokenKey(i.id)&&(!live||t.actorId===live.actor.id))??a.scenes.flatMap(s=>s.tokens).find(t=>t.companionKey===summonTokenKey(i.id))
   if(i.state==='vanished'){retireTokens(a,i);continue}
   if(live?.actor.companion&&['find-steed','phantom-steed'].includes(i.spellId)){const sourceActor=live.e.actors.find(t=>t.id===live.actor.companion!.ownerId),incap=sourceActor?.npc?.conditions.some(c=>['incapacitated','unconscious','paralyzed','stunned','petrified'].includes(c))||sourceActor?.npc?.effects.some(e=>!!e.condition&&['incapacitated','unconscious','paralyzed','stunned','petrified'].includes(e.condition))||!!sourceActor?.characterId&&!!w.characters.find(c=>c.id===sourceActor.characterId)?.runtime?.effects?.some(f=>!!f.condition&&['incapacitated','unconscious','paralyzed','stunned','petrified'].includes(f.condition))||!!sourceActor?.characterId&&!!w.characters.find(c=>c.id===sourceActor.characterId)?.runtime?.conditions?.some(c=>['incapacitated','unconscious','paralyzed','stunned','petrified'].includes(c));live.actor.companion.controlledMount=!!i.riderId&&!incap}
   if(live?.actor.npc&&!live.actor.companion?.dismissed&&live.e.phase==='active')i.body=clone(live.actor.npc)
   if(token){const s=a.scenes.find(s=>s.tokens.includes(token))!;i.position={sceneId:s.id,x:token.x,y:token.y,span:token.span,spatial:spatialState(token.spatial)};if(live?.e.phase!=='active'&&token.npcBody)i.body=clone(token.npcBody)}
   if(!token&&live?.actor.npc)i.body=clone(live.actor.npc)
   const source=gEntity(w,a,i.sourceEntityId).entity,conc=source?.c?.runtime?.concentration??source?.body?.concentration,now=gCurrentHours(w,a)
   if(i.senses&&now>=i.senses.endsAt)delete i.senses
   if(i.spellId==='phantom-steed'&&i.state==='present'&&((i.lastHp!==undefined&&!!i.body&&i.body.hp+i.body.temporaryHp<i.lastHp)||(i.existenceEndsAt!==null&&now>=i.existenceEndsAt))){i.state='fading';i.fadeEndsAt=now+1/60;i.existenceEndsAt=null;i.note='法术结束，保留1分钟下马窗口'}
   if(i.body?.equipment){for(const gear of i.body.equipment){const o=a.m3?.entities.find(o=>o.id===gear.objectId);if(o)gear.held=o.enabled&&o.boundCharacterId===i.id}if(live?.actor.npc)live.actor.npc.equipment=clone(i.body.equipment);if(token?.npcBody)token.npcBody.equipment=clone(i.body.equipment)}
   if(i.body)i.lastHp=i.body.hp+i.body.temporaryHp
   if(i.riderId&&token){const rider=gEntity(w,a,i.riderId).entity,conditions=rider?.c?.runtime?.conditions??rider?.body?.conditions??[],effects=rider?.state.effects??[],prone=(conditions.includes('prone')||effects.some(e=>e.condition==='prone')),mountProne=i.body?.conditions.includes('prone')||i.body?.effects.some(e=>e.condition==='prone'),displaced=!!rider?.token&&(rider.token.x!==token.x||rider.token.y!==token.y||spatialState(rider.token.spatial).height!==spatialState(token.spatial).height),reason=mountProne?'mount-prone':prone?'rider-prone':rider?.dead||displaced?'displaced':undefined
    if(reason){const events=state.events??=[],turn=(live?.e.phase==='active'?live.e.id+':'+live.e.tick:String(now))+':'+reason;if(!events.some(e=>e.instanceId===i.id&&e.type==='dismount'&&(e.status==='pending'||e.turn===turn)))events.push({id:crypto.randomUUID(),instanceId:i.id,targetId:i.riderId,type:'dismount',reason,turn,status:'pending',note:'骑乘后果：'+reason+'；按实际反应／敏捷豁免和坠落处理'})}
   }
   for(const objectId of i.generatedItemIds){const object=a.m3?.entities.find(o=>o.id===objectId);if(object?.boundCharacterId&&object.enabled){const holder=object.boundCharacterId===i.id?i.position:gEntity(w,a,object.boundCharacterId).entity?.token;if(holder){object.x=holder.x;object.y=holder.y;object.height='spatial'in holder?holder.spatial?.height??0:0;if('sceneId'in holder)object.sceneId=holder.sceneId;else object.sceneId=a.scenes.find(s=>s.tokens.includes(holder))?.id??object.sceneId}}if(object&&i.position&&object.enabled&&(object.sceneId!==i.position.sceneId||Math.max(Math.abs(object.x-i.position.x),Math.abs(object.y-i.position.y))*a.scenes.find(s=>s.id===i.position!.sceneId)!.grid.feet>10))object.enabled=false}
   for(const objectId of i.carriedItemIds){const object=a.m3?.entities.find(o=>o.id===objectId);if(object&&i.position){object.x=i.position.x;object.y=i.position.y;object.height=i.position.spatial.height;object.sceneId=i.position.sceneId}}

   if(i.control==='controlled'&&i.controlEndsAt!==null&&now>=i.controlEndsAt){i.control='expired';i.controllerId=null}
   for(const m of matches)if(m.actor.companion)m.actor.companion.controllerExpired=i.control!=='controlled'
   const reason=i.state==='fading'&&i.fadeEndsAt!==undefined&&now>=i.fadeEndsAt?'渐隐期限结束':i.existenceEndsAt!==null&&now>=i.existenceEndsAt?'存在期限结束':i.concentrationCastId&&conc?.castId!==i.concentrationCastId?'原施放专注结束':i.vanishOnZero&&(i.kind==='force'?(i.forceState?.hp??0)<=0:!i.body||i.body.hp<=0)?'生命归零':i.vanishOnSourceDeath&&(!source||source.dead)?'实际来源死亡或离开':native(i.spellId)&&i.state==='present'&&live?.actor.companion?.dismissed&&matches.every(m=>m.actor.companion!.dismissed)?'原实体已明确退场':undefined
   if(reason)endSummon(w,a,i,reason)
   else if(i.state!=='fading'&&(i.body?.dead||i.body?.hp===0))i.state='dead'
   // Loss of control does not delete animate-dead bodies or grant nearest-target attacks.
  }
 }
}
export function summonController(w:MapWorld,a:Adventure,actorId:string){
 const i=a.summons?.instances.find(i=>i.actorRefs.some(r=>r.actorId===actorId))
 return i&&i.state==='present'&&i.control==='controlled'?i.controllerId:null
}
