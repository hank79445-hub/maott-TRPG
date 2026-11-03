import type {Room,RoomMember,RoomCommand} from '../online/protocol'
import {adventure,RoomError} from './room-engine'
import {practicalEnabled,practicalBranch,practicalTransition} from './practical-review-state'
import {m1Entity} from '../core/m1-utility'
import {m3GroundAt} from '../core/m3-ground'
import {executeM3Action} from './room-m3'
import {executeSummonAction} from './room-summons'
import {executeRoomDice} from './room-dice'
import {heldNpc} from './gm-control'
function input(r:Room,id:string){
 const t=r.practicalReview?.tasks.find(t=>t.id===id&&t.branchId===practicalBranch(r)&&['effect-m3','effect-summon'].includes(t.phase));if(!t)return
 const a=adventure(r),m3=t.phase==='effect-m3'?a.m3?.events.find(e=>e.id===t.sourceId):undefined,summon=t.phase==='effect-summon'?a.summons?.events?.find(e=>e.id===t.sourceId):undefined
 if(m3?.type==='stone-damage'||summon?.type==='putrid-aura')return
 const instance=summon&&a.summons?.instances.find(i=>i.id===summon.instanceId),affected=m3?.entityId??(summon?.type==='dismount'?summon.targetId??instance?.riderId:instance?.control==='controlled'?instance.controllerId:undefined),entity=affected?m1Entity(r.world,a,affected):undefined
 const ownerId=entity?.c?.id,owner=ownerId&&r.members.find(m=>!m.revoked&&m.role==='player'&&m.characterIds.includes(ownerId))||r.members.find(m=>!m.revoked&&m.role==='gm')
 const scene=a.scenes.find(s=>s.id===(m3?.sceneId??instance?.position?.sceneId)),token=entity?.token,summonPosition=instance?.position?{x:instance.position.x,y:instance.position.y,height:instance.position.spatial.height}:undefined,from=m3?.from??(summon?.type==='ghost-eject'?summonPosition:token?{x:token.x,y:token.y,height:token.spatial?.height??0}:summonPosition)
 if(!owner||!scene||!from||!m3&&!summon)return
 return {task:t,m3,summon,owner,ownerId,scene,from,span:summon?.type==='ghost-eject'?instance?.position?.span??1:token?.span??instance?.position?.span??1,npcId:entity?.n?.id,name:m3||summon?.type==='dismount'?entity?.name??'受影响对象':instance?.body?.name??'召唤物',floor:m3GroundAt(a,scene,from)}
}
export interface PracticalEffectInputView {id:string;name:string;sceneId?:string;span?:number;type:'putrid-aura'|'ghost-eject'|'dismount'|'ink-cloud'|'fall'|'return'|'eject'|'descend'|'stone-damage';from:{x:number;y:number;height:number};floor:number;columns:number;rows:number;canReact?:boolean;waitingDice:boolean}
export function practicalEffectInputView(r:Room,m:RoomMember):PracticalEffectInputView[]{
 if(!practicalEnabled(r,'spells')||m.revoked)return []
 return (r.practicalReview?.tasks??[]).flatMap(t=>{const p=input(r,t.id);if(!p||p.owner.id!==m.id||['committed','rejected','canceled','stale','paused'].includes(p.task.status)||p.m3?.status==='resolved'||p.summon?.status==='resolved')return [];return [{id:t.id,name:p.name,sceneId:p.scene.id,span:p.span,type:p.m3?.type??p.summon!.type,from:p.from,floor:p.floor,columns:p.scene.grid.columns,rows:p.scene.grid.rows,...(p.summon?.type==='dismount'&&p.summon.reason==='mount-prone'?{canReact:true}:{}),waitingDice:!!r.dice?.pending.some(d=>d.command.kind==='practical-effect-input'&&d.command.taskId===t.id)}]})
}
export function practicalEffectInputCharacter(r:Room,id:string){return input(r,id)?.ownerId??undefined}
export function tickPracticalEffectInputs(r:Room,now=Date.now()){
 if(!practicalEnabled(r,'spells'))return
 for(const candidate of (r.practicalReview?.tasks??[]).filter(t=>t.phase==='effect-summon')){const p=input(r,candidate.id);if(!p||p.summon?.type!=='ink-cloud'||p.summon.status!=='pending'||!['ready','needs-fact','waiting-player'].includes(p.task.status))continue;const t=p.task
  const npc=adventure(r).ai?.npcs.find(n=>n.id===p.npcId)
  if(p.owner.role==='gm'&&npc?.allowed.includes('ability')&&!heldNpc(r,npc.id)){
   try{executeRoomDice(r,p.owner,{kind:'practical-effect-input',taskId:t.id,reaction:(npc.combatPolicy.resourceStrategy??r.gmReview!.settings.practical!.npcResources)==='conservative'?'decline':'use'})}catch(error){practicalTransition(t,'needs-gm',error instanceof Error?error.message:'NPC原反应条件变化')}continue
  }
  if(t.lastSeenAt===undefined)continue
  if(now-t.lastSeenAt>10000){if(t.deadlineAt!==undefined){t.remainingMs=Math.max(0,t.deadlineAt-Math.min(now,t.lastSeenAt+10000));delete t.deadlineAt}delete t.lastSeenAt;continue}
  t.deadlineAt??=now+(t.remainingMs??r.gmReview!.settings.practical!.responseSeconds*1000)
  if(t.deadlineAt<=now)executeRoomDice(r,p.owner,{kind:'practical-effect-input',taskId:t.id,reaction:'decline'})
 }
}
export function executePracticalEffectInput(r:Room,m:RoomMember,c:RoomCommand){
 if(c.kind!=='practical-effect-input')return false
 const p=input(r,c.taskId)
 if(!p||m.revoked||p.owner.id!==m.id||!practicalEnabled(r,'spells')||!['ready','needs-fact','waiting-player','waiting-dice','committed'].includes(p.task.status))throw new RoomError('后果选择来源、分支或本人权限已变化',403)
 if(p.m3?.status==='resolved'||p.summon?.status==='resolved')return true
 if(c.operation==='delivered'){if(p.summon?.type==='ink-cloud'){p.task.lastSeenAt=Date.now();p.task.deadlineAt??=p.task.lastSeenAt+(p.task.remainingMs??r.gmReview!.settings.practical!.responseSeconds*1000)}return true}
 if(r.dice?.pending.some(d=>d.command.kind==='practical-effect-input'&&d.command.taskId===c.taskId))throw Error('该后果正在等待完整实体骰，不重复提交')
 if(p.m3){if(!c.to||c.reaction!==undefined)throw Error('请确认本人的实际落点');executeM3Action(r,{operation:'event',eventId:p.m3.id,to:c.to,note:'本人确认实际空间后果落点；原规则核验范围、阻隔、支撑、豁免与伤害'})}
  else if(p.summon){if(p.summon.type==='ink-cloud'&&!c.reaction)throw Error('请明确使用或放弃魔宠反应');if(p.summon.type!=='ink-cloud'&&!c.to)throw Error('请选择实际排出／下马落点')
   if(p.summon.type==='ink-cloud'&&c.reaction==='use')executeSummonAction(r,{operation:'familiar',instanceId:p.summon.instanceId,action:'ink',targetId:p.summon.targetId,receipt:'practical-effect:'+p.task.id,note:'本人确认使用原魔宠墨云反应'})
   else {if(c.reaction==='use'&&!(p.summon.type==='dismount'&&p.summon.reason==='mount-prone'))throw Error('本后果没有该可选反应');executeSummonAction(r,{operation:'event',eventId:p.summon.id,to:c.to,useReaction:c.reaction==='use',decline:c.reaction==='decline',receipt:'practical-effect:'+p.task.id,note:'本人确认召唤物原后果与实际落点／反应'})}
  }
 practicalTransition(r.practicalReview!.tasks.find(t=>t.id===p.task.id)!,'committed','本人选择已由原机制结算，不重施法、重扣材料或跳过伤害');return true
}
