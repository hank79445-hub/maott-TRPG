import type {MapWorld} from './map-types'
import type {Catalogue} from './engine'
import type {SummonAction} from '../persistence/summon-action-schema'
import {clone} from './engine'
import {rollDie} from './runtime'
import {prepareSummon,commitSummonInPlace,attachSummon} from './summon-transactions'
import {applyMap,distance,directPath} from './map'
import {applyM3Action,m3ActionCost} from './m3-world-actions'
import {summonLive,mentalRange,summonDC,receipt,syncSummonBody,teleportSummon,summonSave,saveEffect,summonCloud,sameSpace,actualObject,dropSummonGear,summonTurn} from './summon-operations'
import {reconcileSummons,endSummon,summonTokenKey,summonState} from './summon-world'
import {applySupplyOperation} from './scene-supplies'
import {reconcileWorld} from './combat-lifecycle'
import {silenced} from './scene-magic'
import {gClock} from './gm-spell-world'
import {m1Entity} from './m1-utility'
import {tokenPerception} from './m3-map-perception'
import {applyFamiliarOperation} from './summon-familiar'
import {applySteedOperation} from './summon-steed'
import {settleSummonEvent,moveGhost,summonPhase} from './summon-phase'
import {m3Landing,m3State,m3Caster} from './m3-world-cast'
import {spatialState} from './m3-spatial'
/** The caller uses a cloned transaction, including dice replay. No partial resource or item changes escape errors. */
export function applySummonAction(input:MapWorld,adventureId:string,c:SummonAction,cat:Catalogue,dice:(n:number)=>number=rollDie):{world:MapWorld;detail:string}{
 let w=clone(input),a=w.adventures.find(a=>a.id===adventureId);if(!a)throw Error('冒险不存在')
 if(c.operation==='remains'){const corpse=a.m1Utility?.corpses.find(r=>r.id===c.corpseId&&r.dead&&r.bodyViable);if(!corpse)throw Error('须真实尚可使用的遗骸记录');const state=summonState(a);if(state.instances.some(i=>i.corpseId===corpse.id))throw Error('遗骸已用于原实例');for(const gear of c.equipment){const o=a.m3?.entities.find(o=>o.id===gear.objectId&&o.enabled),item=cat.items.find(i=>i.id===gear.itemId&&i.kind==='weapon');if(!o||!item||o.sceneId!==corpse.sceneId||o.boundCharacterId)throw Error('须遗骸处真实可用武器引用')}state.remains=(state.remains??[]).filter(r=>r.corpseId!==corpse.id).concat({corpseId:corpse.id,form:c.form,equipment:clone(c.equipment),note:c.note});return {world:w,detail:'GM登记实际遗骨／遗体及已有装备，没有生成新物品'}}
 if(c.operation==='force-damage'){const i=a.summons?.instances.find(i=>i.id===c.instanceId&&i.kind==='force'&&i.state==='present');if(!i?.forceState)throw Error('无形力量不在场');receipt(i,c.receipt,c.operation);i.forceState.hp=Math.max(0,i.forceState.hp-c.amount);reconcileWorld(w);return {world:w,detail:'GM核对实际伤害，已结算无形力量HP'}}
 if(c.operation==='cast'){
  const paid=prepareSummon(w,a.id,c,cat,dice);w=paid.world;a=w.adventures.find(a=>a.id===adventureId)!
  if(paid.failed)return {world:w,detail:'卷轴施法检定失败，卷轴和行动已消耗，没有法术效果'}
  if(!paid.draft.battle)commitSummonInPlace(w,a.id,paid.draft.id,cat)
  reconcileWorld(w);return {world:w,detail:paid.draft.battle?'已支付实际施法，等待反制与召唤确认':'实际施法完成，实体已创建／维持；没有生成额外职业权限'}
 }
 if(c.operation==='resolve-cast'){
  const d=a.summons?.drafts.find(d=>d.id===c.draftId&&d.status==='pending');if(!d)throw Error('原召唤创建已结束')
  if(d.battle){const e=w.encounters.find(e=>e.id===d.battle!.encounterId),s=a.scenes.find(s=>s.encounterId===e?.id);if(e?.pending?.summonDraftId!==d.id||!s)throw Error('先完成当前反制子窗口，不能跳过原施法');w=applyMap(w,a.id,{type:'combat',sceneId:s.id,command:{type:'resolve',nonlethal:false,savage:false,stone:false,relentless:false,pushConfirmed:false}},cat,dice)}
  else commitSummonInPlace(w,a.id,d.id,cat)
  reconcileWorld(w);return {world:w,detail:'原召唤施法已确认，费用及实体只结算一次'}
 }
 if(c.operation==='phase'){const i=a.summons?.instances.find(i=>i.id===c.instanceId),s=a.scenes.find(s=>s.id===i?.position?.sceneId),t=c.targetId?m1Entity(w,a,c.targetId)?.token:s?.tokens.find(t=>t.id===i?.id);if(!i||!s||!t||w.encounters.some(e=>e.phase==='active')||a.exploration?.status==='active')throw Error('只在自由探索由GM明确处理个体时序；战斗／探索轮用原回合');if(!s.tokens.includes(t))throw Error('时序人物须在该实体实际场景');const key=summonTurn(w,a,s,t.id)+':'+c.phase;if(i.uses?.[c.phase]===key)throw Error('本次明确时序已经处理，请推进实际游戏时间');i.uses={...i.uses,[c.phase]:key};summonPhase(w,a,s,t,c.phase,cat);return {world:w,detail:'GM明确处理实际个人时序'}}
 if(c.operation==='event'){settleSummonEvent(w,a,c,cat,dice);reconcileWorld(w);return {world:w,detail:'已结算保存的召唤物后果'}}
 if(c.operation==='command'){
  if(new Set(c.instanceIds).size!==c.instanceIds.length)throw Error('重复的指挥目标')
  m3Caster(w,a,c.sourceId,cat)
  const vs=c.instanceIds.map(id=>summonLive(w,a!,id,cat));if(vs.some(v=>v.i.controllerId!==c.sourceId))throw Error('只能指挥本人的实际受控实体')
  const undead=vs.every(v=>v.i.spellId==='animate-dead');if(!undead&&vs.length!==1)throw Error('只有操纵死尸支持同一次附赠动作发出同一群体命令')
  for(const v of vs){if(v.i.kind==='force')throw Error('仆役使用简单任务入口');if(v.i.receipts.some(r=>r.id===c.receipt))throw Error('该指挥已经处理');if(v.i.spellId==='animate-dead')mentalRange(a,v.s,v.source.token,v.token,60);if(v.i.spellId==='find-steed')mentalRange(a,v.s,v.source.token,v.token,5280);else if(v.i.spellId.startsWith('summon-')&&silenced(w,a,v.s,v.source.token!))throw Error('口头命令不能穿过沉默')
   if(c.targetId){const target=m1Entity(w,a,c.targetId)?.token;if(!target||!v.s.tokens.includes(target)||!tokenPerception(w,a,v.s,v.source.token!,target,cat).canPerceive)throw Error('不能命令攻击未感知的隐藏目标')}
  }
  if(undead)m3ActionCost(w,a,c.sourceId,'bonus',cat)
  for(const v of vs){v.i.task={text:c.text,targetId:c.targetId,commandHour:gClock(w,a,c.sourceId).hours,completed:false};receipt(v.i,c.receipt,'command');const live=summonLive(w,a,v.i.id,cat);if(live.actor?.companion)live.actor.companion.commandText=c.text}
 }else{
  const v=summonLive(w,a,c.instanceId,cat,c.operation==='familiar',c.operation==='follow',c.operation==='mount'&&!c.mount),i=v.i
  receipt(i,c.receipt,c.operation)
  if(c.operation==='steed-rest'){const now=gClock(w,a,i.sourceEntityId).hours;if(i.spellId!=='find-steed'||v.e||now-c.startedHour<8||c.startedHour<Math.max(i.createdHour,Number(i.uses?.powerHour??0),Number(i.uses?.steedRestHour??0)))throw Error('须GM核对实际坐骑8小时长休；不得跨越使用能力或原休息记录重复恢复');i.uses={...i.uses,steedRestHour:String(now)}}
  else if(c.operation==='attach')attachSummon(w,a,i,v.s)
  else if(c.operation==='task-complete'){if(i.task){i.task.completed=true;const o=a.m3?.entities.find(o=>o.id===i.task!.targetId&&o.mundaneTask?.sourceId===i.id);if(o?.mundaneTask)o.mundaneTask.status='completed'};if(v.actor?.companion)delete v.actor.companion.commandText}
  else if(c.operation==='move'){
   if(i.riderId&&a.summons?.events?.some(e=>e.instanceId===i.id&&e.type==='dismount'&&e.status==='pending'))throw Error('请先处理原骑乘中断后果，不能用移动清除');if(i.kind==='force')throw Error('仆役移动须由主人附赠动作的简单任务触发')
   if(['summon-beast','summon-fey','summon-undead','animate-dead'].includes(i.spellId)&&(!i.task||i.task.completed))throw Error('默认只回避，请先下达命令或由GM明确避险')
   if(i.spellId==='summon-undead'&&i.form==='ghostly')moveGhost(w,a,i.id,c.to,c.mode,cat,dice,c.reactionsConfirmed)
   else {const result=applyM3Action(w,a.id,{operation:'move',entityId:i.id,to:c.to,mode:c.mode,supportId:c.supportId,reactionsConfirmed:c.reactionsConfirmed,note:c.note},cat,dice);w=result.world}
   const currentA=w.adventures.find(q=>q.id===a!.id)!,current=currentA.summons!.instances.find(q=>q.id===i.id)!,token=currentA.scenes.flatMap(s=>s.tokens).find(t=>t.id===i.id);if(token){if(c.mode==='walk'){const path=directPath(v.token,token);token.groundTrail=[...(v.token.groundTrail?.length?v.token.groundTrail:[{x:v.token.x,y:v.token.y}]),...path].slice(-200);const actor=w.encounters.flatMap(e=>e.actors).find(t=>t.id===token.actorId);if(actor)actor.turn.groundTrail=clone(token.groundTrail)}if(current.riderId){const rider=m1Entity(w,currentA,current.riderId);if(rider?.token){rider.token.x=token.x;rider.token.y=token.y;rider.token.spatial=clone(token.spatial);if(current.state==='present')currentA.summons!.events=(currentA.summons!.events??[]).filter(e=>!(e.instanceId===i.id&&e.type==='dismount'&&e.reason==='displaced'&&e.status==='pending'))}}}
  }else if(c.operation==='fey-step'){
   if(i.spellId!=='summon-fey')throw Error('不是妖精灵魄');if(!i.task||i.task.completed)throw Error('请先实际指挥妖精灵魄，不能以特能绕过默认回避')
   if(i.form==='mirthful')summonDC(w,a,i,cat)
   const turn=summonTurn(w,a,v.s,i.id);if(i.uses?.feyStepTurn===turn)throw Error('本回合妖精步伐已经使用');i.uses={...i.uses,feyStepTurn:turn}
   m3ActionCost(w,a,i.id,'bonus',cat,true);teleportSummon(w,a,i,c.to,cat,30)
   const live=summonLive(w,a,i.id,cat)
   if(i.form==='fuming')saveEffect(w,a,i,i.id,'fey-fuming',undefined,cat,{attackAdvantage:true,expiresAt:live.e?.tick??null,phase:'end',endsAt:gClock(w,a,i.sourceEntityId).hours+1/600})
   if(i.form==='mirthful'){
    const target=c.targetId?m1Entity(w,a,c.targetId):undefined;if(!target?.token||!live.s.tokens.includes(target.token)||distance(live.s,live.token,target.token)>10||!tokenPerception(w,a,live.s,live.token,target.token,cat).canSee)throw Error('欢欣须指定传送后10尺内实际可见生物')
    const roll=summonSave(w,a,target.id,'wis',cat,dice,'charm');if(roll.autoFail||roll.total<i.dc!)saveEffect(w,a,i,target.id,'fey-mirthful','charmed',cat,{charmSources:[i.id,i.sourceEntityId]})
   }
   if(i.form==='tricksy'){summonCloud(w,a,i,{...c.to,x:c.to.x,y:c.to.y},10,true,2/600);i.uses={...i.uses,darknessTurn:summonTurn(w,a,live.s,i.id)}}
  }else if(c.operation==='familiar'||c.operation==='touch-cast'||c.operation==='chain-attack')w=applyFamiliarOperation(w,a,c,cat,dice)
  else if(c.operation==='mount'||c.operation==='steed-power')w=applySteedOperation(w,a,c,cat,dice)
  else if(c.operation==='gear'){if(i.spellId!=='phantom-steed'||!i.generatedItemIds.includes(c.objectId))throw Error('须此魅影驹实际生成装备');const object=a.m3?.entities.find(o=>o.id===c.objectId&&o.enabled);if(!object)throw Error('装备已消失');if(c.holderId){const holder=m1Entity(w,a,c.holderId);if(!holder?.token||!v.s.tokens.includes(holder.token))throw Error('携带者须在本场景');sameSpace(v.s,v.token,holder.token,5);object.boundCharacterId=holder.id;object.x=holder.token.x;object.y=holder.token.y;object.height=holder.token.spatial?.height??0}else{if(!c.to||distance(v.s,v.token,{...c.to,spatial:{height:c.to.height,layer:'material'}})>5)throw Error('只能将生成装备放在坐骑5尺内');delete object.boundCharacterId;object.x=c.to.x;object.y=c.to.y;object.height=c.to.height}
  }else if(c.operation==='carry'){
   if(i.kind==='force')throw Error('仆役携物必须通过附赠动作简单任务，不能绕过15尺与每回合限制');if(c.take){const o=actualObject(a,v.s,c.objectId);sameSpace(v.s,v.token,{...v.token,x:o.x,y:o.y,spatial:{height:o.height,layer:o.layer??'material'}},5);if(i.carriedItemIds.reduce((n,id)=>n+(a.m3?.entities.find(o=>o.id===id)?.weight??0),0)+o.weight>15*(v.body?.scores.str??0)*(v.body?.size==='tiny'?.5:v.body?.size==='large'?2:1))throw Error('超过实际携带能力');o.boundCharacterId=i.id;i.carriedItemIds.push(o.id)}else{if(!i.carriedItemIds.includes(c.objectId))throw Error('该物件未被实体携带');const o=a.m3?.entities.find(o=>o.id===c.objectId);if(o){o.x=v.token.x;o.y=v.token.y;o.height=v.token.spatial?.height??0;delete o.boundCharacterId}i.carriedItemIds=i.carriedItemIds.filter(id=>id!==c.objectId)}
  }else if(c.operation==='servant-task'){
   if(i.spellId!=='unseen-servant')throw Error('不是无形仆役')
   const turn=summonTurn(w,a,v.s,i.sourceEntityId);if(i.uses?.commandTurn===turn)throw Error('每个来源回合只能命令仆役一次')
   sameSpace(v.s,v.token,{...v.token,...c.to,spatial:{...spatialState(v.token.spatial),height:c.to.height}},15)
   m3ActionCost(w,a,i.sourceEntityId,'bonus',cat)
   if(distance(v.s,v.source.token!,{...c.to,spatial:{height:c.to.height,layer:spatialState(v.token.spatial).layer}})>60){endSummon(w,a,i,'任务将使仆役离来源超过60尺');return {world:w,detail:'该任务使仆役超出60尺，法术结束'}}
   if(c.to.height!==(a.m3?.environments.find(e=>e.sceneId===v.s.id)?.floorHeight??0))throw Error('无形仆役不能以物体任务获得飞行')
   m3Landing(v.s,v.token,c.to);if(!sightRoute(v.s,v.token,c.to))throw Error('仆役实际路线被墙门阻挡')
   let object=c.objectId?m3State(a).entities.find(o=>o.id===c.objectId&&o.enabled&&!o.hidden&&o.sceneId===v.s.id):undefined
   if(!['wait','pour','serve'].includes(c.task)&&!object)throw Error('简单任务须关联已发现的实际物件')
   if(object){if(object.boundCharacterId&&object.boundCharacterId!==i.id||object.weight>30||distance(v.s,{...c.to,spatial:{height:c.to.height,layer:'material'}},{...object,spatial:{height:object.height,layer:'material'}})>5)throw Error('仆役不能操作远处、他人携带或超重物件')
    if(c.task==='fetch'){if(object.boundCharacterId===i.id)throw Error('该物件已被仆役携带');if(i.carriedItemIds.reduce((n,id)=>n+(a.m3?.entities.find(o=>o.id===id)?.weight??0),0)+object.weight>30)throw Error('仆役总携带重量超过30磅');if(!object.loose)throw Error('不能拿取固定物件');object.boundCharacterId=i.id;i.carriedItemIds.push(object.id)}
    if(c.task==='put'){if(object.boundCharacterId!==i.id)throw Error('须已携带的物件');delete object.boundCharacterId;object.x=c.to.x;object.y=c.to.y;i.carriedItemIds=i.carriedItemIds.filter(id=>id!==object!.id)}
    // Lighting is a mundane physical operation, never free magical damage or a hidden interaction result.
    if(c.task==='light'){const fixture=a.sceneEffects?.regions.find(e=>e.anchor.id===object!.id&&e.spellId==='mundane-light'&&e.status==='ended');if(!fixture||!a.sceneEffects?.regions.some(e=>e.status==='active'&&e.light?.flame&&!e.covered&&e.geometry&&distance(v.s,{...c.to,spatial:{height:c.to.height,layer:'material'}},{x:e.geometry.x,y:e.geometry.y,spatial:{height:e.geometry.height,layer:e.layer??'material'}})<=5))throw Error('须已登记可点燃光源及5尺内实际火种，不能凭任务生成火焰');fixture.status='active'}
   }
   if(object&&['clean','mend','fold'].includes(c.task))object.mundaneTask={operation:c.task as 'clean'|'mend'|'fold',sourceId:i.id,receipt:c.receipt,status:'working'}
   if(c.task==='pour'||c.task==='serve'){if(!c.supply)throw Error('倒饮料／上菜须选择实际批次、接收容器与数量');const batch=a.sceneEffects?.supplies?.batches.find(b=>b.id===c.supply!.batchId);if(!batch||batch.kind!==(c.task==='pour'?'water':'food'))throw Error('任务与实际补给类型不符');i.position={sceneId:v.s.id,x:c.to.x,y:c.to.y,span:1,spatial:{height:c.to.height,layer:'material'}};applySupplyOperation(w,a,{operation:'supply-transfer',actorId:i.id,...c.supply,receipt:c.receipt,note:c.note},cat,i.id)}
   v.token.x=c.to.x;v.token.y=c.to.y;i.position={sceneId:v.s.id,x:c.to.x,y:c.to.y,span:1,spatial:{height:c.to.height,layer:'material'}};i.task={text:c.task+'：'+c.note,targetId:object?.id,commandHour:gClock(w,a,i.sourceEntityId).hours,completed:['wait','fetch','put','serve','pour','light'].includes(c.task)};i.uses={...i.uses,commandTurn:turn}
  }else if(c.operation==='follow'){
   const target=a.scenes.find(s=>s.id===c.sceneId);if(!target||a.activeSceneId!==target.id||!target.tokens.includes(v.source.token!))throw Error('只有实际来源已正式转场，才能沿已确认路线带入伙伴')
   if(v.e)throw Error('战斗中不能通过跟随转场')
   const rider=i.riderId?m1Entity(w,a,i.riderId):undefined;if(i.riderId&&(!rider?.token||!target.tokens.includes(rider.token)))throw Error('实际骑手须已通过正式转场进入目标场景，不能凭跟随搬走另一场景人物');m3Landing(target,{...v.token,id:i.id,riderTokenId:rider?.token?.id},c.to)
   v.s.tokens=v.s.tokens.filter(t=>t.id!==v.token.id);target.tokens.push({...v.token,...c.to,spatial:{...spatialState(v.token.spatial),height:c.to.height},actorId:null,riderTokenId:rider?.token?.id});if(rider?.token){rider.token.x=c.to.x;rider.token.y=c.to.y;rider.token.spatial={...spatialState(v.token.spatial),height:c.to.height}}i.position={sceneId:target.id,x:c.to.x,y:c.to.y,span:v.token.span,spatial:{...spatialState(v.token.spatial),height:c.to.height}}
  }
  const currentA=w.adventures.find(a=>a.id===adventureId)!;const current=currentA.summons!.instances.find(n=>n.id===i.id)!;syncSummonBody(w,currentA,current)
 }
 reconcileSummons(w);reconcileWorld(w);return {world:w,detail:'已执行召唤物实际操作：'+c.operation+'；'+c.note}
}
import {movementWalls} from './map-spatial'
const sightRoute=(s:import('./map-types').MapScene,t:import('./map-types').MapToken,to:{x:number;y:number;height:number})=>!movementWalls(s,t,t,to).some(w=>w.heightFeet===undefined||Math.min(t.spatial?.height??0,to.height)<w.heightFeet)
