import type {MapWorld,Adventure} from './map-types'
import type {Catalogue} from './engine'
import type {GmSpellRequest} from './spell-workflow-types'
import {gEntity,gClock,gFact} from './gm-spell-world'
import {assertGmSpellFresh,gRequestContext} from './gm-spell-requests'
import {G_CONTINUOUS,G_ILLUSIONS,G_RULES,validateGChoice} from './gm-spell-rules'
import {m3ActionCost} from './m3-world-actions'
import {tokenPoint} from './scene-effects'
import {magicDistance} from './scene-magic'
import {physicalPropagation} from './scene-propagation'
import {defaultEnvironment,freshTurn,d20,savingRoll} from './combat-rules'
import {checkDetail} from './runtime'
import {sourcedDie,recordDiceOutcome} from './dice-source'
export type GUse={operation:'move'|'operate'|'aura'|'switch'|'probe'|'resist-probe'|'reply'|'communicate'|'end';receipt:string;actorId:string;point?:{x:number;y:number;height:number};objectId?:string;mode?:'sight'|'hearing';text:string;wordCount?:number}
export function gActive(w:MapWorld,a:Adventure,r:GmSpellRequest,cat:Catalogue){
 if(r.status!=='published'||r.ongoing?.ended)throw Error('需要已确认且仍生效的法术实例')
 const copy={...r,status:'pending' as const,contextKey:undefined,choice:undefined};assertGmSpellFresh(w,a,copy,cat)
}
export function refreshGRequest(w:MapWorld,a:Adventure,r:GmSpellRequest,cat:Catalogue){
 if(r.status==='canceled')throw Error('不能恢复已取消的施法')
 assertGmSpellFresh(w,a,{...r,status:'pending',contextKey:undefined},cat)
 r.contextKey=gRequestContext(w,a,r)
}
function skill(w:MapWorld,a:Adventure,id:string,cat:Catalogue,key:'investigation'|'arcana'){
 const t=gEntity(w,a,id).entity;if(!t)throw Error('检定者不存在')
 const detail=t.c?checkDetail(t.c,cat,'skill',key):undefined
 const bonus=detail?.bonus??t.body?.templateMetadata?.skills[key]??Math.floor(((t.body?.scores.int??10)-10)/2)
 return d20(bonus,detail?.adv??[],detail?.dis??[],sourcedDie,false,[],detail?.autoFail??false)
}
export function observeGIllusion(w:MapWorld,a:Adventure,r:GmSpellRequest,cat:Catalogue,id:string,method:'study'|'physical'|'gm',text:string){
 gActive(w,a,r,cat);if(!G_ILLUSIONS.includes(r.spellId))throw Error('该术不是观察者识破型幻象')
 const observer=gEntity(w,a,id).entity,source=gEntity(w,a,r.characterId).entity,s=a.scenes.find(s=>s.id===r.sceneId)
 if(!observer?.token||!s?.tokens.includes(observer.token))throw Error('观察者不在实际场景')
 const point=r.ongoing?.point??r.choice?.point??(source?.token&&tokenPoint(source.token));if(!point)throw Error('幻象位置尚未确定')
 const ray=physicalPropagation(a,s,tokenPoint(observer.token),point,'visual');if(!ray.clear||ray.uncertain)throw Error('观察者无法实际观察幻象')
 let recognized=true,report=text
 if(method==='physical'){
  if(r.spellId==='illusory-script')throw Error('迷幻手稿不能以物理接触自动读出真文')
  if(magicDistance(tokenPoint(observer.token),point,s.grid.feet)>5)throw Error('物理识破需要实际接触范围')
 }else if(method==='study'){
  if(r.spellId==='illusory-script')throw Error('迷幻手稿的真文资格须按指定读者或真实感官由GM核对，不能靠通用研究解密')
  m3ActionCost(w,a,observer.id,'action',cat,false)
  const roll=skill(w,a,observer.id,cat,'investigation');if(!r.dc)throw Error('缺少实际施法DC，请GM先补登记后重试')
  recognized=!roll.autoFail&&roll.total>=r.dc;report=`调查 ${roll.total} / DC ${r.dc}：${recognized?'识破':'未识破'}；${text}`
  recordDiceOutcome({label:'幻象研究',dice:roll.dice,total:roll.total,bonus:roll.bonus},sourcedDie)
 }
 r.observations??=[];r.observations=r.observations.filter(v=>v.observerId!==observer.id).concat({observerId:observer.id,recognized,method,text:report,at:new Date().toISOString()})
}
export function applyGUse(w:MapWorld,a:Adventure,r:GmSpellRequest,cat:Catalogue,c:GUse){
 gActive(w,a,r,cat);const ongoing=r.ongoing??={ended:false,uses:[]};if(ongoing.uses.includes(c.receipt))throw Error('该次持续操作已经执行')
 if(ongoing.uses.length>=1000)throw Error('持续操作记录达到上限')
 const source=gEntity(w,a,r.characterId).entity,actor=gEntity(w,a,c.actorId).entity,s=a.scenes.find(s=>s.id===r.sceneId)
 if(!source?.token||!actor?.token||actor.dead||!s)throw Error('实际来源／操作者已失效')
 const point=ongoing.point??r.choice?.point??tokenPoint(source.token),same=actor.id===source.id
 const near=(p:typeof point,feet:number,physical=true)=>{if(!s.tokens.includes(source.token!)||magicDistance(tokenPoint(source.token!),p,s.grid.feet)>feet)throw Error('超过本术实际操作范围');const ray=physicalPropagation(a,s,point,p,'effect');if(physical&&(!ray.clear||ray.uncertain))throw Error('操作路径受到实体阻隔或需先核实墙高')}
 if(c.operation==='resist-probe'){
  if(r.spellId!=='detect-thoughts'||gEntity(w,a,r.choice?.subjectId??r.targetIds[0]??'').entity?.id!==actor.id||!ongoing.uses.some(v=>v.startsWith('probe:')))throw Error('没有针对该人物的深入探查')
  m3ActionCost(w,a,actor.id,'action',cat);const roll=skill(w,a,actor.id,cat,'arcana');if(roll.total>=(r.dc??99))ongoing.ended=true
  recordDiceOutcome({label:'摆脱深入探查',dice:roll.dice,total:roll.total,bonus:roll.bonus},sourcedDie)
 }else if(c.operation==='reply'){
  if(r.noResult||!['message','sending'].includes(r.spellId)||!r.targetIds.includes(actor.id)||ongoing.replyUsed)throw Error('该人物没有本次一次回复资格')
  validateGChoice(r.spellId,{description:c.text,wordCount:c.wordCount});if(r.spellId==='sending'&&c.wordCount===undefined)throw Error('请核对回复词数')
  ongoing.replyUsed=true
 }else{
  if(!same)throw Error('只有原实际施法者可以控制该法术')
  if(c.operation==='end'){ongoing.ended=true;const conc=source.c?.runtime?.concentration??source.body?.concentration;if(conc?.castId===r.castId){if(source.c)source.c.runtime!.concentration=null;else if(source.body)delete source.body.concentration}}
  else if(c.operation==='move'){
   if(!['mage-hand','silent-image','major-image'].includes(r.spellId)||!c.point||c.point.x>=s.grid.columns||c.point.y>=s.grid.rows)throw Error('该术不能移动到此位置')
   near(c.point,r.spellId==='mage-hand'?30:r.spellId==='silent-image'?60:120)
   const carried=ongoing.heldObjectId&&a.m3?.entities.find(o=>o.id===ongoing.heldObjectId&&o.enabled)
   if(ongoing.heldObjectId&&(!carried||carried.boundCharacterId||carried.weight>10))throw Error('原物件状态已变化，请GM复核')
   m3ActionCost(w,a,source.id,'action',cat,true);ongoing.point=c.point
   if(carried){carried.x=c.point.x;carried.y=c.point.y;carried.height=c.point.height}
  }else if(c.operation==='operate'){
   const object=a.m3?.entities.find(o=>o.id===c.objectId&&o.enabled),fact=object&&gFact(a,object.id,source.id)
   if(r.spellId!=='mage-hand'||!object||object.sceneId!==s.id||object.weight>10||!object.loose||object.magical||fact?.magical||fact?.locked||object.boundCharacterId)throw Error('法师之手仅能操作实际已登记、未锁、未携带、非魔法且不超过10磅的物件')
   const to={x:object.x+.5,y:object.y+.5,height:object.height};near(to,30);if(magicDistance(point,to,s.grid.feet)>5)throw Error('手尚未触及物件，请先移动法师之手')
   m3ActionCost(w,a,source.id,'action',cat,true);ongoing.heldObjectId=object.id
   if(c.point){near(c.point,30);object.x=c.point.x;object.y=c.point.y;object.height=c.point.height;ongoing.point=c.point}
  }else if(c.operation==='switch'){
   if(r.spellId!=='clairvoyance'||!c.mode)throw Error('只有鹰眼术传感器可以这样切换感官')
   m3ActionCost(w,a,source.id,'bonus',cat,true);ongoing.mode=c.mode
  }else if(c.operation==='probe'){
   if(r.spellId!=='detect-thoughts')throw Error('该法术没有深入探查')
   const target=gEntity(w,a,r.choice?.subjectId??r.targetIds[0]??'').entity;if(!target?.token)throw Error('实际思绪目标已离场')
   near(tokenPoint(target.token),30);const round=w.encounters.find(e=>e.id===s.encounterId&&e.phase==='active')
   if(round&&r.pendingId&&round.tick===Number(ongoing.uses.find(x=>x.startsWith('cast-tick:'))?.slice(10)))throw Error('深入探查须在后续回合使用魔法动作')
   m3ActionCost(w,a,source.id,'action',cat,true)
   const body=target.actor??{id:target.id,characterId:target.c?.id??null,npc:target.body??null,side:'neutral' as const,initiative:null,surprised:false,turn:freshTurn()}
   const roll=savingRoll(body,'wis',defaultEnvironment(),w.characters,cat,sourcedDie);if(!roll.autoFail&&roll.total>=(r.dc??99))ongoing.ended=true
   ongoing.uses.push('probe:'+target.id+':'+c.receipt)
 }else if(c.operation==='aura'){
   if(!['detect-magic','detect-thoughts'].includes(r.spellId))throw Error('该术没有此魔法动作操作')
   if(r.spellId==='detect-magic'&&c.objectId){const t=gEntity(w,a,c.objectId),p=t.token?tokenPoint(t.token):t.object&&{x:t.object.x+.5,y:t.object.y+.5,height:t.object.height};if(!p)throw Error('灵光对象不存在');near(p,30);const ray=physicalPropagation(a,s,tokenPoint(source.token),p,'visual');if(!ray.clear||ray.uncertain)throw Error('灵光对象必须实际可见')}
   m3ActionCost(w,a,source.id,'action',cat,true)
  }else if(c.operation==='communicate'){
   if(!G_CONTINUOUS.includes(r.spellId))throw Error('该术没有持续信息操作')
   // Content and material penetration remain explicit GM adjudication, never a full-map projection.
  }else throw Error('该术不支持此持续操作')
 }
 ongoing.uses.push(c.receipt);return c.text
}
/** Permission-bearing effects used by the existing dialogue engine; no world knowledge is fabricated. */
export function activateGResult(w:MapWorld,a:Adventure,r:GmSpellRequest,cat:Catalogue){
 const ongoing=r.ongoing??={ended:false,uses:[]},e=w.encounters.find(e=>e.id===r.encounterId)
 if(e)ongoing.uses.push('cast-tick:'+e.tick)
 if(['speak-with-animals','tongues','comprehend-languages'].includes(r.spellId)){
  const t=gEntity(w,a,r.spellId==='tongues'?(r.choice?.subjectId??r.targetIds[0]??''):r.characterId).entity
  if(!t)throw Error('实际沟通目标不存在')
  t.state.effects=(t.state.effects??[]).filter(f=>f.castId!==r.castId).concat({id:crypto.randomUUID(),key:r.spellId,spellId:r.spellId,castId:r.castId,sourceId:r.characterId,clockSourceId:r.clockSourceId,name:r.name,page:cat.spells.find(s=>s.id===r.spellId)?.source.page??0,concentration:false,expiresAt:null,encounterId:'outside',phase:'start',endsAt:r.endsAt??undefined,visibility:'owner',note:'GM确认的沟通资格，不改变知识、态度或权限'})
 }
 const cap=r.spellId==='thaumaturgy'||r.spellId==='prestidigitation'?3:r.spellId==='minor-illusion'?1:Infinity
 const old=(a.gmSpellRequests??[]).filter(q=>q.id!==r.id&&q.characterId===r.characterId&&q.spellId===r.spellId&&q.status==='published'&&!q.ongoing?.ended&&(q.endsAt===null||q.endsAt>gClock(w,a,r.characterId).hours))
 if(old.length>=cap)for(const q of old.slice(0,old.length-cap+1)){q.ongoing??={ended:false,uses:[]};q.ongoing.ended=true}
}
