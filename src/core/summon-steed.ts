import type {Adventure,MapWorld,MapCommand} from './map-types'
import type {Catalogue} from './engine'
import type {SummonAction} from '../persistence/summon-action-schema'
import {summonLive,summonDC,sameSpace,summonBudget,teleportSummon,saveEffect,summonSave} from './summon-operations'
import {runtimeDerived} from './runtime'
import {m1Entity} from './m1-utility'
import {m3Landing} from './m3-world-cast'
import {m3ActionCost} from './m3-world-actions'
import {combatStats,freshTurn,rollDamage} from './combat-rules'
import {distance} from './map'
import {tokenPerception} from './m3-map-perception'
import {clone} from './engine'
import {gClock,gCurrentHours} from './gm-spell-world'
import {nextTurnTick} from './combat'
const sizes=['tiny','small','medium','large','huge','gargantuan']
export function applySteedOperation(w:MapWorld,a:Adventure,c:Extract<SummonAction,{operation:'mount'|'steed-power'}>,cat:Catalogue,dice:(n:number)=>number){
 const v=summonLive(w,a,c.instanceId,cat,false,false,c.operation==='mount'&&!c.mount),{i}=v
 if(!['find-steed','phantom-steed'].includes(i.spellId))throw Error('不是实际法术坐骑')
 if(c.operation==='mount'){
  const rider=m1Entity(w,a,c.riderId);if(!rider?.token||rider.dead||!v.s.tokens.includes(rider.token))throw Error('骑手须在场存活')
  if(i.spellId==='phantom-steed'&&![i.designatedRiderId,i.sourceEntityId].includes(rider.id))throw Error('不是此魅影驹指定骑手')
  if(c.mount&&i.riderId)throw Error('坐骑已由他人骑乘')
  if(!c.mount&&i.riderId!==rider.id)throw Error('没有该骑乘关系')
  if(c.mount&&a.summons?.instances.some(n=>n.id!==i.id&&n.riderId===rider.id))throw Error('骑手已经骑乘其他坐骑')
  sameSpace(v.s,rider.token,v.token,5)
  const stats=rider.c?runtimeDerived(rider.c,cat):combatStats(rider.actor??{id:rider.id,characterId:null,npc:rider.body!,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},w.characters,cat),size=rider.c?stats.spatialCapabilities.size:rider.body?.size??'medium'
  if(stats.speed<=0)throw Error('实际速度为0，不能自愿上下马');if(c.mount&&(sizes.indexOf(size)>=sizes.indexOf(v.body!.size??'large')||stats.conditions.includes('incapacitated')))throw Error('体型或行动资格不符合骑乘')
  const e=v.e,actor=e?.actors.find(t=>t.id===rider.actor?.id||!!rider.c&&t.characterId===rider.c.id),cost=stats.speed/2
  if(e){if(!actor||e.actors[e.current]?.id!==actor.id||actor.turn.movement+cost>stats.speed+actor.turn.dash)throw Error('上下马须自己的回合并有半速移动预算');actor.turn.movement+=cost}
  else if(a.exploration?.status==='active'){const m=a.exploration.members.find(m=>m.tokenId===rider.token!.id);if(!m||m.movement+cost>stats.speed)throw Error('探索移动预算不足');m.movement+=cost}
  if(c.mount){i.riderId=rider.id;v.token.riderTokenId=rider.token.id;rider.token.x=v.token.x;rider.token.y=v.token.y;rider.token.spatial=clone(v.token.spatial);if(rider.c)rider.c.runtime!.mounted=true}
  else{if(!c.to)throw Error('请指定实际下马空位');sameSpace(v.s,v.token,{...rider.token,...c.to,spatial:{height:c.to.height,layer:v.token.spatial?.layer??'material'}},5);m3Landing(v.s,rider.token,c.to);rider.token.x=c.to.x;rider.token.y=c.to.y;rider.token.spatial={height:c.to.height,layer:v.token.spatial?.layer??'material'};delete i.riderId;delete v.token.riderTokenId;if(rider.c)rider.c.runtime!.mounted=false}
  return w
 }
 if(i.spellId!=='find-steed')throw Error('魅影驹没有异界坐骑专能')
 if(i.form==='fiend')summonDC(w,a,i,cat)
 const rest=String(Math.max(v.source.c?.runtime?.lastLongRestEnd??0,Number(i.uses?.steedRestHour??0))),key='power:'+rest
 if(i.uses?.powerRest===key)throw Error('坐骑专能须完成长休后恢复，不能靠重连刷新')
 summonBudget(w,a,i,'bonus',cat)
 if(i.form==='fey'){
  if(!c.to)throw Error('请选择至多60尺的实际空位')
  const rider=i.riderId?m1Entity(w,a,i.riderId):undefined;if(rider?.token)sameSpace(v.s,v.token,rider.token,0)
  teleportSummon(w,a,i,c.to,cat,60,false)
  if(rider?.token){rider.token.x=c.to.x;rider.token.y=c.to.y;rider.token.spatial=clone(v.token.spatial)}
 }else{
  const target=c.targetId?m1Entity(w,a,c.targetId):undefined;if(!target?.token||!v.s.tokens.includes(target.token))throw Error('须当前场景实际生物')
  sameSpace(v.s,v.token,target.token,i.form==='celestial'?5:60)
  if(i.form==='celestial'){
   const heal=rollDamage('2d8+'+i.slot,dice).total
   target.state.hp=Math.min(target.c?runtimeDerived(target.c,cat).hp:target.body!.maxHp,target.state.hp+heal)
  }else{
   if(!tokenPerception(w,a,v.s,v.token,target.token,cat).canSee)throw Error('邪视目标须可见')
   const roll=summonSave(w,a,target.id,'wis',cat,dice,'fear')
   const sourceActor=v.e?.actors.find(t=>t.id===v.source.actor?.id||!!v.source.c&&t.characterId===v.source.c.id)
   if(roll.autoFail||roll.total<i.dc!)saveEffect(w,a,i,target.id,'steed-fell-glare','frightened',cat,{expiresAt:v.e&&sourceActor?nextTurnTick(v.e,sourceActor.id):null,phase:'end',endsAt:gClock(w,a,i.sourceEntityId).hours+2/600})
  }
 }
 i.uses={...i.uses,powerRest:key,powerHour:String(gCurrentHours(w,a))};return w
}
/** Called only by an actual, already settled levelled-spell healing result. */
export function steedRecoveredHP(w:MapWorld,a:Adventure,targetId:string,recovered:number){
 if(recovered<=0)return
 for(const i of a.summons?.instances??[]){if(i.spellId!=='find-steed'||i.state!=='present'||i.sourceEntityId!==targetId||!i.position)continue
  const source=m1Entity(w,a,i.sourceEntityId),s=a.scenes.find(s=>s.id===i.position!.sceneId),t=s?.tokens.find(t=>t.id===i.id),body=t&&m1Entity(w,a,i.id)?.body
  if(!source?.token||!s?.tokens.includes(source.token)||!t||!body||body.hp<=0||body.effects.some(e=>e.blocksHealing)||distance(s,source.token,t)>5)continue
  body.hp=Math.min(body.maxHp+hpSpellBonus(body.effects),body.hp+recovered);i.body=clone(body);t.npcBody=clone(body)
 }
}
/** True healing only: Aid, temporary HP, unrelated edits and restoring an archive never invoke this link. */
export function steedLifeBond(w:MapWorld,a:Adventure,before:MapWorld,command:MapCommand,cat:Catalogue){
 const oldA=before.adventures.find(x=>x.id===a.id);if(!oldA)return
 let healing=false
 if(command.type==='combat'&&command.command.type==='resolve'){const e=before.encounters.find(e=>e.id===oldA.scenes.find(s=>s.id===command.sceneId)?.encounterId),p=e?.pending;healing=!!p?.spellId&&(p.slotLevel??cat.spells.find(s=>s.id===p.spellId)?.level??0)>0&&p.mode==='heal'}
 if(command.type==='explore'&&command.command.operation==='spell-cast'){const op=command.command,c=before.characters.find(c=>c.id===oldA.scenes.flatMap(s=>s.tokens).find(t=>t.id===op.tokenId)?.characterId),g=c&&runtimeSpells(c,cat).find(g=>g.key===op.key);healing=!!g&&g.spell.level>0&&['cure-wounds','healing-word','mass-healing-word','prayer-of-healing'].includes(g.spell.id)}
 if(!healing)return
 for(const id of new Set((a.summons?.instances??[]).filter(i=>i.spellId==='find-steed').map(i=>i.sourceEntityId))){const now=m1Entity(w,a,id),old=m1Entity(before,oldA,id);if(now&&old)steedRecoveredHP(w,a,id,Math.max(0,now.state.hp-old.state.hp))}
}
import {runtimeSpells} from './runtime'
import {hpSpellBonus} from './spell-restoration'
