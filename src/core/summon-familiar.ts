import type {Adventure,MapWorld} from './map-types'
import type {Catalogue} from './engine'
import type {SummonAction} from '../persistence/summon-action-schema'
import {summonLive,mentalRange,summonBudget,dropSummonGear,sameSpace,saveEffect,summonCloud,summonTurn,actualObject} from './summon-operations'
import {m3ActionCost} from './m3-world-actions'
import {castM3Creature} from './m3-creature-cast'
import {consumeNpcAbility} from './npc-abilities'
import {spellEffect,rollDamage} from './combat-rules'
import {healingRollTotal,hpSpellBonus} from './spell-restoration'
import {applyRuntime} from './runtime'
import {gRequestContext} from './gm-spell-requests'
import {gClock,gCurrentHours} from './gm-spell-world'
import {m3Landing} from './m3-world-cast'
import {endSummon,summonTokenKey} from './summon-world'
import {runtimeSpells,runtimeDerived} from './runtime'
import {m1Entity,applyM1Action,M1_UTILITY_SPELLS} from './m1-utility'
import {M3_WORLD_SPELLS,m3WorldCast} from './m3-world-cast'
import {applyMap,distance} from './map'
import {applyCombat,nextTurnTick} from './combat'
import {defaultEnvironment,attackOptions,combatStats} from './combat-rules'
import {tokenPerception} from './m3-map-perception'
import {runUpDistance,jumpCapacity} from './movement-rules'
import {validateM3Route} from './m3-route'
import {movementWalls,sightLine} from './map-spatial'
import {m3Airspace} from './m3-world-actions'
import {clone} from './engine'
import {hasInvocation} from './growth-rules'

export function applyFamiliarOperation(w:MapWorld,a:Adventure,c:Extract<SummonAction,{operation:'familiar'|'touch-cast'|'chain-attack'}>,cat:Catalogue,dice:(n:number)=>number){
 const v=summonLive(w,a,c.instanceId,cat,true),{i,source}=v
 if(i.spellId!=='find-familiar')throw Error('须实际寻获魔宠实例，不能借其他随从获得感官或传递权限')
 if(c.operation==='familiar'){
  if(c.action==='end'){m3ActionCost(w,a,source.id,'action',cat,true);endSummon(w,a,i,'永久解散魔宠');return w}
  if(c.action==='pocket'){
   if(i.state!=='present')throw Error('魔宠已暂时解散')
   m3ActionCost(w,a,source.id,'action',cat,true);dropSummonGear(a,i);i.state='pocket';delete i.senses
   for(const s of a.scenes)s.tokens=s.tokens.filter(t=>t.companionKey!==summonTokenKey(i.id))
   for(const r of i.actorRefs){const actor=w.encounters.find(e=>e.id===r.encounterId)?.actors.find(t=>t.id===r.actorId);if(actor?.companion)actor.companion.dismissed=true}
  }else if(c.action==='return'){
   if(i.state!=='pocket'||!c.to)throw Error('须暂时解散且指定再现落点')
   const s=a.scenes.find(s=>s.tokens.includes(source.token!))!;sameSpace(s,source.token!,{...source.token!,...c.to,spatial:{height:c.to.height,layer:source.token!.spatial?.layer??'material'}},30)
   m3Landing(s,{...source.token!,id:i.id,span:i.body!.size==='large'?2:1},c.to)
   m3ActionCost(w,a,source.id,'action',cat,true);i.state='present';i.position={sceneId:s.id,x:c.to.x,y:c.to.y,span:1,spatial:{height:c.to.height,layer:source.token!.spatial?.layer??'material'}}
   s.tokens.push({id:i.id,characterId:null,actorId:null,name:i.body!.name,x:c.to.x,y:c.to.y,span:1,spatial:clone(i.position.spatial),hidden:false,color:'#597a60',facing:0,npcBody:clone(i.body!),companionKey:summonTokenKey(i.id)})
  }else{
   if(i.state!=='present')throw Error('魔宠不在场')
   mentalRange(a,v.s,source.token,v.token,100)
   if(c.action==='senses'){
    m3ActionCost(w,a,source.id,'bonus',cat,true)
    const e=v.e,owner=e?.actors.find(t=>t.id===source.actor?.id||!!source.c&&t.characterId===source.c.id)
    i.senses={sourceId:source.id,endsAt:gClock(w,a,source.id).hours+1/600,...(e&&owner?{encounterId:e.id,expiresTick:e.tick+((e.actors.indexOf(owner)-e.current+e.actors.length)%e.actors.length||e.actors.length)}:{})}
   }else if(c.action==='communicate'){if(!c.text?.trim())throw Error('请输入心灵交流内容');i.note='心灵交流（不创造知识）：'+c.text}
   else if(c.action==='help'){
    if(!c.targetId)throw Error('须选择实际可协助目标')
    const target=m1Entity(w,a,c.targetId);if(!target?.token)throw Error('协助目标无效');sameSpace(v.s,v.token,target.token,5);summonBudget(w,a,i,'action',cat)
    saveEffect(w,a,i,target.id,'summon-help',undefined,cat,{supportChoice:i.id,control:{dc:0,targets:v.e?v.e.actors.filter(a=>a.side===v.actor?.side&&a.id!==v.actor?.id).map(a=>a.id):[source.id],text:'下一位实际盟友的一次攻击'},expiresAt:v.e&&v.actor?nextTurnTick(v.e,v.actor.id):null,phase:'start',endsAt:gClock(w,a,i.sourceEntityId).hours+1/600,note:'帮助攻击此敌人：下一位盟友的一次攻击优势，在魔宠下回合开始结束'})
   }else if(c.action==='mimic'){
    if(i.form!=='Raven'||!c.text?.trim())throw Error('只有渡鸦可模仿实际听过的简单声音，须GM核对来源')
    summonBudget(w,a,i,'action',cat);i.note='拟声：'+c.text+'；听者可DC10感知（洞悉）识破，不产生新事实'
   }else if(c.action==='ink'){
    if(i.form!=='Octopus'||i.uses?.inkDay===String(Math.floor(gCurrentHours(w,a)/24)))throw Error('无墨水云能力或今日次数已用')
    const event=a.summons?.events?.find(e=>e.instanceId===i.id&&e.type==='ink-cloud'&&e.status==='pending'&&e.targetId===c.targetId),target=c.targetId?m1Entity(w,a,c.targetId):undefined;if(!event||!target?.token)throw Error('墨水云须响应水下生物在5尺内结束回合')
    sameSpace(v.s,v.token,target.token,5)
    const liquid=a.m3?.entities.find(o=>o.kind==='liquid'&&o.enabled&&o.sceneId===v.s.id&&v.token.x>=o.x&&v.token.y>=o.y&&v.token.x<o.x+o.width/v.s.grid.feet&&v.token.y<o.y+o.depth/v.s.grid.feet&&(v.token.spatial?.height??0)<o.height&&(target.token!.spatial?.height??0)<o.height)
    if(!liquid)throw Error('两者须在已登记的实际水下空间')
    event.status='resolved';event.note+='；魔宠实际消耗反应施放墨水云';summonBudget(w,a,i,'reaction',cat);summonCloud(w,a,i,{x:v.token.x,y:v.token.y,height:v.token.spatial?.height??0},5,false,1/60);i.uses={...i.uses,inkDay:String(Math.floor(gCurrentHours(w,a)/24))}
    if(c.to){if(distance(v.s,v.token,{...c.to,spatial:{height:c.to.height,layer:'material'}})>30)throw Error('墨水云反应移动最多游泳30尺');m3Landing(v.s,v.token,c.to);v.token.x=c.to.x;v.token.y=c.to.y;v.token.spatial={height:c.to.height,layer:'material'}}
   }else if(c.action==='jump'){
    if(!c.to||!['Cat','Frog'].includes(i.form))throw Error('跳跃须猫或蛙及实际落点')
    const running=runUpDistance(v.actor?.turn.groundTrail??v.token.groundTrail??[],v.token,v.s.grid.feet)>=10,capacity=jumpCapacity(v.body!.scores.dex,running),max=i.form==='Frog'?10:capacity.long,vertical=i.form==='Frog'?5:capacity.high
    if(distance(v.s,v.token,{...c.to,spatial:{height:v.token.spatial?.height??0,layer:'material'}})>max||c.to.height-(v.token.spatial?.height??0)>vertical)throw Error('超过此形态的真实跳跃距离')
    // Landing is still a legal movement route; no free grid teleport or movement reset.
    const e=v.e,actor=v.actor,cost=distance(v.s,v.token,{...c.to,spatial:{height:c.to.height,layer:'material'}})
    if(!e||!actor||e.actors[e.current]?.id!==actor.id||actor.turn.movement+cost>combatStats(actor,w.characters,cat).speed+actor.turn.dash)throw Error('须有当前魔宠回合及足够移动预算')
    if(movementWalls(v.s,v.token,v.token,c.to).length)throw Error('跳跃路径穿过实际墙门，请GM核对高度，不能默认穿墙');m3Airspace(a,v.s,c.to.height);validateM3Route(w,a,v.s,v.token,c.to,v.body?.effects??[],cat);m3Landing(v.s,v.token,c.to);actor.turn.movement+=cost;actor.turn.groundTrail=[];v.token.groundTrail=[];v.token.x=c.to.x;v.token.y=c.to.y;v.token.spatial={height:c.to.height,layer:'material'}
   }
  }
  return w
 }
 if(i.state!=='present')throw Error('魔宠不在场')
 mentalRange(a,v.s,source.token,v.token,100)
 const target=m1Entity(w,a,c.targetId);if(!target?.token||!v.s.tokens.includes(target.token)||!tokenPerception(w,a,v.s,v.token,target.token,cat).canPerceive)throw Error('目标须在魔宠实际可感知范围内')
 if(c.operation==='chain-attack'){
  if(!source.c||!hasInvocation(source.c.build,'chain')||!v.e||!v.actor||!source.actor||v.e.actors[v.e.current]?.id!==source.actor.id)throw Error('链契攻击须真实链契主人在自己攻击动作内牺牲一次攻击')
  const owner=source.actor;if(owner.turn.action){m3ActionCost(w,a,source.id,'action',cat);const liveOwner=w.encounters.find(e=>e.id===v.e!.id)!.actors.find(t=>t.id===owner.id)!;liveOwner.turn.attacksLeft=source.c.level>=5&&hasInvocation(source.c.build,'thirsting')&&!source.state.effects?.some(f=>f.key==='slow')&&attackOptions(liveOwner,w.characters,cat).some(a=>a.weaponId===source.c!.build.choices['pact-weapon']?.[0])?2:1;Object.assign(owner,liveOwner)}if(!owner.turn.attacksLeft)throw Error('须有尚未消耗的攻击动作或剩余攻击，不能凭魔宠增加攻击')
  if(!v.actor.turn.reaction)throw Error('魔宠没有可用反应')
  sameSpace(v.s,v.token,target.token,5);owner.turn.attacksLeft--
  const liveEncounter=w.encounters.find(e=>e.id===v.e!.id)!,liveOwner=liveEncounter.actors.find(t=>t.id===owner.id)!
  liveOwner.turn=clone(owner.turn);(liveOwner.turn.manualUsed??=[]).push('chain-authorized:'+v.actor.id+':'+c.receipt)
  const result=applyCombat(liveEncounter,w.characters,cat,{type:'familiar-strike',actorId:v.actor.id,ownerId:owner.id,targetId:target.actor?.id??target.id,receipt:c.receipt,env:{...defaultEnvironment(),distance:distance(v.s,v.token,target.token),attackerSees:tokenPerception(w,a,v.s,v.token,target.token,cat).canSee,targetSees:tokenPerception(w,a,v.s,target.token,v.token,cat).canSee,targetLocationConfirmed:true,note:c.note}},dice)
  w.encounters[w.encounters.findIndex(e=>e.id===v.e!.id)]=result.encounter;w.characters=result.characters;return w
 }
 const grant=source.c&&runtimeSpells(source.c,cat).find(g=>g.key===c.key&&g.modes.includes(c.mode)),ability=source.body?.abilities?.find(b=>b.id===c.key&&b.support!=='unsupported'),spell=grant?grant.spell:ability&&cat.spells.find(s=>s.id===ability.spellId)
 if(!spell||spell.range!=='Touch')throw Error('只能传递主人实际可施放的触碰法术')
 sameSpace(v.s,v.token,target.token,5);summonBudget(w,a,i,'reaction',cat)
 const originalGIds=new Set(a.gmSpellRequests?.map(r=>r.id)??[]),origin=clone(source.token!),sourceTokenId=origin.id
 // The authoritative target origin changes for this single cast only; caster identity, slot and concentration remain the owner's.
 Object.assign(source.token!,{x:v.token.x,y:v.token.y,spatial:clone(v.token.spatial)})
 let result:MapWorld
 if(grant&&M1_UTILITY_SPELLS.includes(spell.id)){
  result=applyM1Action(w,a.id,{operation:'cast',characterId:source.id,key:c.key,mode:c.mode,targetId:c.targetId,materialId:c.materialId,confirmed:true,note:c.note},cat,dice,v.e?'prepare':'commit').world
 }else if(M3_WORLD_SPELLS.includes(spell.id)){
  m3WorldCast(w,a,{operation:'cast',casterId:source.id,key:c.key,mode:c.mode,targets:[target.id],materialId:c.materialId,choice:c.choice,willing:true,confirmed:true,note:c.note},cat,dice);result=w
 }else if(v.e){
  const owner=v.e.actors.find(t=>t.id===source.actor?.id||!!source.c&&t.characterId===source.c.id),targetActor=v.e.actors.find(t=>t.id===target.actor?.id||!!target.c&&t.characterId===target.c.id);if(!owner||!targetActor)throw Error('双方须在当前遭遇')
  result=applyMap(w,a.id,{type:'combat',sceneId:v.s.id,command:grant?{type:'cast',actorId:owner.id,key:c.key,mode:c.mode,targets:[targetActor.id],env:{...defaultEnvironment(),note:c.note},requirementsConfirmed:true,damageType:'radiant',gmChoice:c.gmChoice,weaponId:c.weaponId}:{type:'npc-ability',actorId:owner.id,abilityId:ability!.id,targetIds:[targetActor.id],env:{...defaultEnvironment(),note:c.note},confirmed:true,note:c.note}},cat,dice)
 }else if(!grant&&ability&&source.body){
  const profile=spellEffect(spell.id,1,ability.slotLevel??spell.level)
  if(profile.kind==='heal'){
   if(target.state.effects?.some(e=>e.blocksHealing))throw Error('实际目标禁止治疗');if(!profile.dice)throw Error('缺少此法术实际治疗骰组');m3ActionCost(w,a,source.id,ability.cost==='bonus'?'bonus':'action',cat,true);consumeNpcAbility(source.body,ability.id)
   const attr=ability.ability??source.body.spellcasting?.ability??'wis',oldHP=target.state.hp,amount=Math.max(0,healingRollTotal(target.state.effects??[],rollDamage(profile.dice,target.state.effects?.some(e=>e.maximizeHealing)?n=>n:dice))+Math.floor((source.body.scores[attr]-10)/2))
   if(target.c)w.characters[w.characters.indexOf(target.c)]=applyRuntime(target.c,cat,{type:'heal',amount,note:spell.name},dice);else target.state.hp=Math.min(target.body!.maxHp+hpSpellBonus(target.state.effects??[]),target.state.hp+amount)
   steedRecoveredHP(w,a,target.id,Math.max(0,(m1Entity(w,a,target.id)?.state.hp??oldHP)-oldHP));result=w
  }else if(profile.kind==='buff'){castM3Creature(w,a,{operation:'cast',casterId:source.id,key:c.key,mode:'npc',targets:[target.id],choice:c.choice,willing:true,confirmed:true,note:c.note},cat,dice);result=w}
  else throw Error('此普通NPC触碰能力须进入实际战斗／专用裁定入口，不能用通用标签代替效果')
 }else result=applyMap(w,a.id,{type:'explore',sceneId:v.s.id,command:{operation:'spell-cast',tokenId:sourceTokenId,key:c.key,mode:c.mode,targets:[target.token.id],gmChoice:c.gmChoice,confirmed:true,note:c.note}},cat,dice)
 if(v.e){const adventure=result.adventures.find(x=>x.id===a.id)!,e=result.encounters.find(e=>e.id===v.e!.id),p=e?.pending;if(p){p.id??=crypto.randomUUID();const deliveries=adventure.summons!.deliveries??=[];if(deliveries.length>=500)throw Error('触碰传递记录已满');deliveries.push({pendingId:p.id,instanceId:i.id,encounterId:e!.id,sourceTokenId,origin:{sceneId:v.s.id,x:v.token.x,y:v.token.y,span:v.token.span,spatial:clone(v.token.spatial??{height:0,layer:'material'})}})}}
 const restored=result.adventures.find(x=>x.id===a.id)!.scenes.flatMap(s=>s.tokens).find(t=>t.id===sourceTokenId);if(restored){restored.x=origin.x;restored.y=origin.y;restored.spatial=origin.spatial}
 for(const r of result.adventures.find(x=>x.id===a.id)!.gmSpellRequests??[])if(r.status==='pending'&&r.characterId===source.id&&!originalGIds.has(r.id))r.contextKey=gRequestContext(result,result.adventures.find(x=>x.id===a.id)!,r)
 return result
}
import {steedRecoveredHP} from './summon-steed'
