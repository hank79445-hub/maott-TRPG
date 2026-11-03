import type {Room,RoomCommand,RoomMember} from '../online/protocol'
import type {Encounter,CombatCommand} from '../core/combat-types'
import type {PracticalInitiative} from '../persistence/practical-initiative-schema'
import {catalogue,featIds} from '../core/engine'
import {srd} from '../content/srd'
import {combatStats} from '../core/combat-rules'
import {practicalState,practicalBranch,practicalEnabled} from './practical-review-state'
import {activeScene,RoomError} from './room-engine'
import {executeRoomDice} from './room-dice'
import {applyCombat} from '../core/combat'
const cat=(r:Room)=>catalogue([srd,...r.world.packs])
const character=(r:Room,e:Encounter,id:string)=>r.world.characters.find(c=>c.id===e.actors.find(a=>a.id===id)?.characterId)
function owner(r:Room,e:Encounter,id:string){const a=e.actors.find(a=>a.id===id),c=character(r,e,id);if(!a||a.npcId||a.npc||c?.npcOwnerId)return 'npc';return r.members.find(m=>m.role==='player'&&!m.revoked&&(m.actorIds.includes(id)||m.characterIds.includes(a.characterId??'')))?.id??r.members.find(m=>m.role==='gm'&&!m.revoked)?.id??''}
const encounter=(r:Room,id:string)=>r.world.encounters.find(e=>e.id===id)??r.practicalReview?.reinforcements?.find(p=>p.staging.id===id&&p.branchId===practicalBranch(r)&&p.status!=='committed')?.staging
function dispatch(r:Room,e:Encounter,c:CombatCommand){const staged=r.practicalReview?.reinforcements?.find(p=>p.staging.id===e.id);if(staged){const result=applyCombat(staged.staging,r.world.characters,cat(r),c);staged.staging=result.encounter;r.world.characters=result.characters;r.worldRevision++;return}const gm=r.members.find(m=>m.role==='gm'&&!m.revoked);if(!gm)throw Error('缺少GM');executeRoomDice(r,gm,{kind:'map',command:{type:'combat',sceneId:activeScene(r)!.id,command:c}})}
export function executePracticalStagingRoll(r:Room,m:RoomMember,c:RoomCommand){if(c.kind!=='practical-staging-roll')return false;if(m.role!=='gm'||m.revoked||!practicalEnabled(r,'combat'))throw Error('增援先攻仅由实际冻结名单流程调用');const staged=r.practicalReview?.reinforcements?.find(p=>p.requestId===c.requestId&&p.branchId===practicalBranch(r)&&p.status==='rolling');if(!staged||staged.staging.actors.some(a=>a.initiative!==null))throw Error('增援先攻已经处理或来源已变化');dispatch(r,staged.staging,{type:'roll-initiative'});staged.status='choices';return true}
function tick(r:Room,w:PracticalInitiative,now:number){for(const response of w.responses){if(response.done)continue;const online=practicalEnabled(r,'combat')&&response.lastSeen!==undefined&&now-response.lastSeen<=10000&&!response.dicePendingId
 if(!online&&response.deadlineAt!==undefined){response.remainingMs=Math.max(0,response.deadlineAt-Math.min(now,(response.lastSeen??now)+10000));delete response.deadlineAt}
 if(online&&response.deadlineAt===undefined)response.deadlineAt=now+response.remainingMs
 if(online&&response.deadlineAt!<=now){response.done=true;delete response.deadlineAt}
 }for(const swap of w.swaps)if(swap.status==='offered'&&w.responses.some(v=>v.done&&(v.actorId===swap.from||v.actorId===swap.to)))swap.status='expired'}
export function preparePracticalInitiative(r:Room,e:Encounter,now=Date.now()){
 const state=practicalState(r);state.initiatives??=[]
 for(const old of state.initiatives)if(old.status==='open'&&(old.branchId!==practicalBranch(r)||encounter(r,old.encounterId)?.phase!=='setup'))old.status='stale'
 let w=state.initiatives.find(w=>w.encounterId===e.id&&w.branchId===practicalBranch(r))
 if(!w){
  if(state.initiatives.length>=100){const i=state.initiatives.findIndex(w=>w.status!=='open');if(i<0)throw Error('先攻窗口已满');state.initiatives.splice(i,1)}
  const actors=e.actors.filter(a=>owner(r,e,a.id)!=='npc'),hasAlert=actors.some(a=>{const c=character(r,e,a.id);return c&&featIds(c.build,cat(r)).includes('alert')})
  const eligible=actors.filter(a=>{const c=character(r,e,a.id);return c?.runtime?.heroicInspiration||hasAlert||e.actors.some(b=>b.id!==a.id&&b.initiative===a.initiative)})
  w={id:crypto.randomUUID(),encounterId:e.id,branchId:practicalBranch(r),status:'open',swaps:[],responses:eligible.map(a=>({actorId:a.id,memberId:owner(r,e,a.id),done:false,remainingMs:r.gmReview!.settings.practical!.responseSeconds*1000}))};state.initiatives.push(w)
 }
 if(w.status!=='open')return w.status==='closed'
 tick(r,w,now)
 for(const response of w.responses)if(response.dicePendingId&&!r.dice?.pending.some(p=>p.id===response.dicePendingId)){
  if(!r.dice?.records.some(v=>v.sourcePendingId===response.dicePendingId)){w.status='needs-gm';return false}
  delete response.dicePendingId
 }
 if(w.responses.every(v=>v.done)){w.status='closed';return true}return false
}
export function executePracticalInitiative(r:Room,m:RoomMember,c:RoomCommand,now=Date.now()){
 if(c.kind!=='practical-initiative')return false
 if(!practicalEnabled(r,'combat'))throw new RoomError('先攻自动流程已暂停')
 const w=r.practicalReview?.initiatives?.find(w=>w.id===c.windowId&&w.branchId===practicalBranch(r)),e=w&&encounter(r,w.encounterId),response=w?.responses.find(v=>v.actorId===c.actorId)
 if(!w||w.status!=='open'||!e||e.phase!=='setup'||!response||response.memberId!==m.id||m.revoked||owner(r,e,c.actorId)!==m.id)throw new RoomError('先攻窗口或权限已变化',409)
 if(response.done)return true
 if(c.operation!=='delivered'&&r.dice?.pending.some(p=>p.command.kind==='practical-initiative'&&p.command.windowId===w.id&&p.command.actorId===c.actorId))throw Error('该人物已有待录入先攻骰，请先完成')
 if(c.operation==='delivered'){response.lastSeen=now;tick(r,w,now);return true}
 tick(r,w,now);if(response.done)throw Error('可选先攻窗口已关闭')
 if(response.dicePendingId)throw Error('请先完成已提交的实体骰')
 if(c.operation==='pass'){response.done=true;delete response.deadlineAt;return true}
 if(c.operation==='reroll'){
  dispatch(r,e,{type:'initiative-reroll',actorId:c.actorId})
  const live=r.practicalReview!.initiatives!.find(v=>v.id===w.id)!.responses.find(v=>v.actorId===c.actorId)!,pending=r.dice?.pending.find(p=>p.command.kind==='map'&&p.command.command.type==='combat'&&p.command.command.command.type==='initiative-reroll')
  if(pending)live.dicePendingId=pending.id
  return true
 }
 const actor=e.actors.find(a=>a.id===c.actorId)!,target=e.actors.find(a=>a.id===c.targetId),scene=activeScene(r)
 if(!target||target.id===actor.id||!scene?.tokens.some(t=>(t.actorId===target.id||!!target.characterId&&t.characterId===target.characterId||!!target.npcId&&t.npcId===target.npcId)&&!t.hidden))throw Error('须选择已公开的参战者')
 if(c.operation==='before'){
  if(target.initiative!==actor.initiative)throw Error('只能选择同值先攻顺序')
  const ids=e.actors.map(a=>a.id).filter(id=>id!==actor.id);ids.splice(ids.indexOf(target.id),0,actor.id);dispatch(r,e,{type:'order',ids});return true
 }
 const source=c.operation==='offer-swap'?actor:target,recipient=c.operation==='offer-swap'?target:actor,sourceCard=character(r,e,source.id)
 if(!sourceCard||!featIds(sourceCard.build,cat(r)).includes('alert')||source.side!==recipient.side||[source,recipient].some(a=>combatStats(a,r.world.characters,cat(r)).conditions.includes('incapacitated')))throw Error('警觉交换须是未失能的自愿同阵营盟友')
 if(w.swaps.some(s=>s.status==='accepted'&&[s.from,s.to].some(id=>[source.id,recipient.id].includes(id))))throw Error('该人物已完成一次先攻交换')
 if(c.operation==='offer-swap'){
  if(w.swaps.some(s=>s.status==='offered'&&[s.from,s.to].some(id=>[source.id,recipient.id].includes(id))))throw Error('请先处理已有交换邀请')
  const recipientResponse=w.responses.find(v=>v.actorId===recipient.id)
  if(owner(r,e,recipient.id)==='npc'){
   if(!r.gmReview!.settings.practical!.npcAcceptAlert)throw Error('NPC没有启用自愿先攻交换策略，请GM明确决定')
   w.swaps.push({from:source.id,to:recipient.id,status:'offered'})
   dispatch(r,e,{type:'initiative-swap',actorId:source.id,targetId:recipient.id})
   r.practicalReview!.initiatives.find(v=>v.id===w.id)!.swaps.find(s=>s.from===source.id&&s.to===recipient.id&&s.status==='offered')!.status='accepted';return true
  }
  if(!recipientResponse||recipientResponse.done)throw Error('对方已结束先攻选择，不能代为同意')
  w.swaps.push({from:source.id,to:recipient.id,status:'offered'});return true
 }
 const swap=w.swaps.find(s=>s.from===source.id&&s.to===recipient.id&&s.status==='offered')
 if(!swap)throw Error('没有待本人接受的交换邀请')
 if(c.operation==='decline-swap'){swap.status='declined';return true}
 dispatch(r,e,{type:'initiative-swap',actorId:source.id,targetId:recipient.id})
 r.practicalReview!.initiatives!.find(v=>v.id===w.id)!.swaps.find(s=>s.from===swap.from&&s.to===swap.to)!.status='accepted'
 return true
}
export function practicalInitiativeView(r:Room,m:RoomMember){
 if(!practicalEnabled(r,'combat')||m.revoked)return []
 return (r.practicalReview?.initiatives??[]).filter(w=>w.status==='open'&&w.branchId===practicalBranch(r)).flatMap(w=>{const e=encounter(r,w.encounterId),s=activeScene(r);if(!e||e.phase!=='setup')return []
  return w.responses.filter(v=>v.memberId===m.id&&!v.done).map(v=>{const actor=e.actors.find(a=>a.id===v.actorId)!,c=character(r,e,actor.id),alert=!!c&&featIds(c.build,cat(r)).includes('alert');return {id:w.id,actorId:actor.id,name:combatStats(actor,r.world.characters,cat(r)).name,value:actor.initiative,heroic:!!c?.runtime?.heroicInspiration&&!v.dicePendingId,deadlineAt:v.deadlineAt,targets:e.actors.filter(a=>a.id!==actor.id&&s?.tokens.some(t=>(t.actorId===a.id||!!a.characterId&&t.characterId===a.characterId||!!a.npcId&&t.npcId===a.npcId)&&!t.hidden)).map(a=>({id:a.id,name:combatStats(a,r.world.characters,cat(r)).name,tie:a.initiative===actor.initiative,swap:alert&&a.side===actor.side&&(!!w.responses.find(v=>v.actorId===a.id&&!v.done)||owner(r,e,a.id)==='npc'&&!!r.gmReview!.settings.practical!.npcAcceptAlert),offered:w.swaps.some(s=>s.from===a.id&&s.to===actor.id&&s.status==='offered')}))}})
 })
}
