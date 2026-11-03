import { randomUUID } from 'node:crypto'
import type { CombatCommand, Encounter } from '../core/combat-types'
import type { Room,RoomMember,RoomCommand } from '../online/protocol'
import type { PracticalWindow } from '../persistence/practical-window-schema'
import { catalogue,clone } from '../core/engine'
import { srd } from '../content/srd'
import { resolutionAbilities,shieldCandidates,shieldModes,type ResolutionAbility } from '../core/combat-resolution-options'
import { combatStats } from '../core/combat-rules'
import { runtimeSpells,availableSlots,castSlotLevel,runtimeState } from '../core/runtime'
import { mapEnvironment } from '../core/map'
import { tokenPerception,m3PerceptionCache } from '../core/m3-map-perception'
import { castingEvidence } from './practical-intents'
import { spellWorkflowPolicy } from '../core/spell-workflow-policies'
import { activeScene,RoomError } from './room-engine'
import { executeRoomDice } from './room-dice'
import { heldNpc } from './gm-control'
import { practicalEnabled,practicalBranch,practicalState,practicalTask,practicalTransition } from './practical-review-state'
import { finalizeRoomBroadcast } from './room-broadcast'
import {combatPushChoices} from '../core/combat-push'
import {abilityAvailable} from '../core/npc-abilities'
import {applyPrivateM5Command} from '../core/spell-followups'
import {executeSceneEffectAction} from './room-scene-effects'
import {silenced} from '../core/scene-magic'

type Option=ResolutionAbility&{requiresConfirmation?:boolean;push?:{targetId:string;x:number;y:number}}
const content=(r:Room)=>catalogue([srd,...r.world.packs])
const privateFrames=(r:Room)=>(r.world.adventures[0]?.sceneEffects?.m5?.resolutions??[]).filter(event=>event.frame&&event.sceneId===activeScene(r)?.id&&r.practicalReview?.tasks.some(t=>t.sourceId===event.id&&t.phase==='effect-m5'&&t.branchId===practicalBranch(r)&&!['needs-gm','needs-fact','paused','stale','canceled'].includes(t.status))).map(v=>v.frame!)
const frame=(r:Room,id:string|undefined)=>r.world.encounters.find(e=>e.id===id)??privateFrames(r).find(e=>e.id===id)
function runnable(r:Room){const all=[...r.world.encounters.filter(e=>e.id===activeScene(r)?.encounterId&&e.phase==='active'),...privateFrames(r)];return (all.find(e=>e.pending)||all.find(e=>e.actors.some(a=>a.npc?.concentration?.pendingDC||r.world.characters.find(c=>c.id===a.characterId)?.runtime?.concentration?.pendingDC)))??all[0]}
const actorToken=(r:Room,e:Encounter,id:string)=>{const a=e.actors.find(a=>a.id===id);return activeScene(r)?.tokens.find(t=>t.actorId===id||!!a?.characterId&&t.characterId===a.characterId||!!a?.npcId&&t.npcId===a.npcId)}
export function executePracticalFrameAction(r:Room,m:RoomMember,c:RoomCommand){
 if(c.kind!=='practical-frame-action')return false
 if(m.role!=='gm'||m.revoked||!practicalEnabled(r,'spells'))throw Error('实际法术后续仅由已授权流程继续')
 const a=r.world.adventures[0]!,event=a.sceneEffects?.m5?.resolutions.find(v=>v.id===c.eventId&&v.frame&&!v.encounterId)
 if(!event||!r.practicalReview?.tasks.some(t=>t.sourceId===event.id&&t.phase==='effect-m5'&&t.branchId===practicalBranch(r)))throw Error('后续帧没有本分支处理记录')
 applyPrivateM5Command(r.world,a,event.id,c.command,content(r));r.worldRevision++
 if(event.status==='pending'&&!event.frame?.pending)executeSceneEffectAction(r,{operation:'m5-resolve',eventId:event.id,note:'原法术后续实际窗口完成，保留原骰与费用'})
 return true
}
function options(r:Room,e:Encounter,phase:PracticalWindow['phase']):Option[]{
 const all=resolutionAbilities(e,r.world.characters,content(r)).filter(o=>!o.reason&&!o.committed)
 const rows:Option[]=all.filter(o=>phase==='d20'?o.id==='heroic'||o.id==='bardic'||o.id==='seeking':phase==='defense'?false:phase==='damage'?['savage','tavern','hit-spell','stun'].includes(o.id):!['heroic','bardic','seeking','savage','tavern','hit-spell','stun','push'].includes(o.id))
 if(phase==='after-damage'&&activeScene(r))for(const target of combatPushChoices(r.world,activeScene(r)!,e,content(r)))for(const d of target.destinations)rows.push({key:`push:${target.targetId}:${d.x}:${d.y}`,id:'push',choice:'push',actorId:target.actorId,targetIndex:target.index,group:'攻击方',name:`推移 ${combatStats(e.actors.find(a=>a.id===target.targetId)!,r.world.characters,content(r)).name} 到格 (${d.x+1},${d.y+1})`,cost:'本次命中推移',stage:'伤害结算时',reason:'',push:{targetId:target.targetId,...d}})
 if(phase==='defense')for(const candidate of shieldCandidates(e,r.world.characters,content(r)).filter(v=>!v.reason))for(const grant of shieldModes(candidate.actor,r.world.characters,content(r)))for(const mode of grant.modes)rows.push({key:`shield:${candidate.actor.id}:${grant.key}:${mode}`,id:'shield',actorId:candidate.actor.id,targetIndex:0,group:'防御方',name:`护盾术 · ${mode}`,cost:'反应及对应法术资源',stage:'命中后，伤害前',reason:'',requiresConfirmation:true,command:{type:'reaction-shield',actorId:candidate.actor.id,key:grant.key,mode,requirementsConfirmed:false}})
 if(phase==='defense'&&e.pending&&!e.pending.attackLocked&&!e.pending.damageRolled)for(const actor of e.actors){
   const body=actor.npc,scene=activeScene(r),from=actorToken(r,e,actor.id),caster=actorToken(r,e,e.pending!.actorId)
  if(!body||!actor.turn.reaction||!from||!scene)continue
  for(const ability of body.abilities??[]){if(!abilityAvailable(body,ability.id)||ability.cost!=='reaction'||!['shield','parry','counterspell'].includes(ability.reaction??'')||ability.support==='unsupported')continue
   const spell=content(r).spells.find(s=>s.id===(ability.spellId??ability.reaction))
   if(spell&&/(^|[,\s])V([,\s(]|$)/.test(spell.components)&&silenced(r.world,r.world.adventures[0]!,scene,from))continue
   if(ability.reaction==='parry'&&!body.equipment?.some(g=>g.held&&content(r).items.some(i=>i.id===g.itemId&&i.kind==='weapon'&&i.category?.includes('melee'))))continue
   const index=e.pending.targets.findIndex(t=>t.id===actor.id&&t.hit),entry=e.pending.targets[index]
   const counter=ability.reaction==='counterspell'
   if(counter?(!e.pending.spellId||e.pending.notCasting||!caster||actor.id===e.pending.actorId||!tokenPerception(r.world,r.world.adventures[0]!,scene,from,caster,content(r)).canSee||mapEnvironment(scene,from,caster,r.environment,'spell').distance>60):!entry||ability.reaction==='parry'&&(e.pending.kind!=='attack'||e.pending.attack?.ranged))continue
   const useful=counter||e.pending.spellId==='magic-missile'||entry?.roll&&entry.roll.chosen!==20&&entry.roll.total<entry.ac+(ability.reaction==='parry'?2:5)
   if(!useful)continue
   rows.push({key:`npc-reaction:${actor.id}:${ability.id}`,id:counter?'counterspell':ability.reaction!,actorId:actor.id,targetIndex:Math.max(0,index),group:'防御方',name:ability.name,stage:'伤害前',cost:'反应及实际能力次数',reason:'',command:{type:'npc-reaction',actorId:actor.id,abilityId:ability.id,targetIndex:Math.max(0,index),confirmed:true,note:'已登记实际能力、触发和资源，地图重新核验感知及范围'}})
  }
 }
 if(phase==='defense'&&e.pending?.spellId&&!e.pending.notCasting&&!e.pending.damageRolled){
  const scene=activeScene(r),caster=actorToken(r,e,e.pending!.actorId),cat=content(r)
  for(const actor of e.actors){
   const c=r.world.characters.find(c=>c.id===actor.characterId),from=actorToken(r,e,actor.id)
   if(!c||!actor.turn.reaction||actor.id===e.pending.actorId||!from||!caster||!scene)continue
   const env=mapEnvironment(scene,from,caster,r.environment,'spell'),perception=tokenPerception(r.world,r.world.adventures[0]!,scene,from,caster,cat,false,m3PerceptionCache())
   if(env.distance>60||env.cover==='total'||!perception.canSee)continue
   for(const grant of runtimeSpells(c,cat).filter(g=>g.spell.id==='counterspell'))for(const mode of grant.modes){
    const level=castSlotLevel(mode),state=runtimeState(c,cat)
    if(level?availableSlots(c,cat,level)<=0:mode!=='at-will'&&!(grant.resource&&(state.resources[grant.resource]??0)>0))continue
    rows.push({key:`counter:${actor.id}:${grant.key}:${mode}`,id:'counterspell',actorId:actor.id,targetIndex:0,group:'反制方',name:`法术反制 · ${mode}`,stage:'施法时',cost:'反应及对应法术资源',reason:'',requiresConfirmation:true,command:{type:'reaction-counterspell',actorId:actor.id,targetId:e.pending.actorId,key:grant.key,mode,requirementsConfirmed:false,env:{...env,attackerSees:true,targetLocationConfirmed:true}}})
   }
  }
 }
 return rows
}
function owner(r:Room,e:Encounter,actorId:string){
 const a=e.actors.find(a=>a.id===actorId),c=r.world.characters.find(c=>c.id===a?.characterId)
 if(!a||a.npcId||a.npc||c?.npcOwnerId)return 'npc'
 const members=r.members.filter(m=>!m.revoked&&m.role!=='ai'&&(m.actorIds.includes(actorId)||!!a.characterId&&m.characterIds.includes(a.characterId)))
 return members.find(m=>m.role==='player')?.id??members.find(m=>m.role==='gm')?.id??'uncontrolled'
}
function windowFor(r:Room,e:Encounter,phase:PracticalWindow['phase'],now:number){
 const p=e.pending!,state=practicalState(r);p.id??=randomUUID()
 const key=`${practicalBranch(r)}:${e.id}:${e.tick}:${p.id}:${phase}`
 let window=state.windows.find(w=>w.key===key)
 if(window)return window
 while(state.windows.length>=200){const index=state.windows.findIndex(w=>w.status!=='open');if(index<0)throw Error('反应窗口已满，需要GM接管');state.windows.splice(index,1)}
 const available=options(r,e,phase)
 window={id:randomUUID(),key,branchId:practicalBranch(r),encounterId:e.id,pendingId:p.id,tick:e.tick,phase,status:'open',reason:'',createdAt:now,responses:[...new Set(available.map(o=>o.actorId))].map(actorId=>({actorId,memberId:owner(r,e,actorId),optionIds:available.filter(o=>o.actorId===actorId).map(o=>o.key),selectedIds:[],done:false,remainingMs:(r.gmReview!.settings.practical!.responseSeconds)*1000}))}
 state.windows.push(window)
 return window
}
function phaseTask(r:Room,e:Encounter,w:PracticalWindow){return practicalTask(r,{domain:'combat',sourceId:w.id,phase:w.phase,label:e.pending?.name??'战斗结算',basis:'rule',participantIds:w.responses.filter(v=>v.memberId!=='npc').map(v=>v.memberId)})!}
function command(r:Room,c:CombatCommand,frameId?:string){
 const gm=r.members.find(m=>m.role==='gm'&&!m.revoked),s=activeScene(r)
 if(!gm||!s)throw Error('缺少有效GM或当前场景')
 const current=frameId?frame(r,frameId):runnable(r),saved=r.world.adventures[0]?.sceneEffects?.m5?.resolutions.find(v=>v.frame?.id===current?.id&&!v.encounterId)
 if(saved){executeRoomDice(r,gm,{kind:'practical-frame-action',eventId:saved.id,command:c});return}
 const before=clone(r.world);executeRoomDice(r,gm,{kind:'map',command:{type:'combat',sceneId:s.id,command:c}})
 finalizeRoomBroadcast(r,before,{kind:'map',command:{type:'combat',sceneId:s.id,command:c}},randomUUID())
}
function clock(r:Room,w:PracticalWindow,now:number,suspended=false){
 const enabled=practicalEnabled(r,'combat')&&!suspended
 for(const response of w.responses){
   if(response.done||response.memberId==='npc')continue
   const online=enabled&&response.lastSeen!==undefined&&now-response.lastSeen<=10000&&!response.dicePendingId
   if(!online&&response.deadlineAt!==undefined){response.remainingMs=Math.max(0,response.deadlineAt-Math.min(now,(response.lastSeen??now)+10000));delete response.deadlineAt}
   if(online&&response.deadlineAt===undefined)response.deadlineAt=now+response.remainingMs
   if(online&&response.deadlineAt!==undefined&&now>=response.deadlineAt){response.done=true;response.remainingMs=0;delete response.deadlineAt}
 }
}
function chosen(r:Room,w:PracticalWindow,choice:ResolutionAbility['choice']){
 const e=frame(r,w.encounterId)
 return e?options(r,e,w.phase).filter(o=>o.choice===choice&&w.responses.some(v=>v.selectedIds.includes(o.key))):[]
}
export function executePracticalResponse(r:Room,m:RoomMember,c:RoomCommand,now=Date.now()){
 if(c.kind!=='practical-response')return false
 if(!practicalEnabled(r,'combat'))throw new RoomError('自动结算已暂停或关闭')
 const w=r.practicalReview?.windows.find(w=>w.id===c.windowId&&w.branchId===practicalBranch(r)),response=w?.responses.find(v=>v.actorId===c.actorId)
 const e=frame(r,w?.encounterId)
 if(!w||w.status!=='open'||!response||response.memberId!==m.id||m.revoked||!e||e.tick!==w.tick||e.pending?.id!==w.pendingId||owner(r,e,c.actorId)!==m.id)throw new RoomError('操作窗口或操控权已变化',409)
 if(response.done)return true
 if(c.operation==='delivered'){response.lastSeen=now;clock(r,w,now);return true}
 clock(r,w,now)
 if(response.done)throw new RoomError('本次可选窗口已关闭')
 if(c.operation==='pass'){response.done=true;delete response.deadlineAt;return true}
 const available=options(r,e,w.phase),option=available.find(o=>o.key===c.optionId&&o.actorId===c.actorId&&response.optionIds.includes(o.key))
 if(!option)throw new RoomError('此能力当前不可用，未消费资源')
 if(response.selectedIds.includes(option.key))return true
 if(option.requiresConfirmation&&!c.requirementsConfirmed)throw new RoomError('请先确认本角色的实际施法条件')
 if(option.choice){if(option.choice==='revelation'&&w.responses.some(v=>v.selectedIds.some(id=>available.some(o=>o.key===id&&o.choice==='revelation'))))throw new RoomError('本次天启加伤只能选择一个目标');if(option.push&&response.selectedIds.some(id=>available.some(o=>o.key===id&&o.push)))throw new RoomError('请勿重复选择推移落点');response.selectedIds.push(option.key);return true}
 if(!option.command)throw new RoomError('该选项需要GM处理')
 let action=clone(option.command)
 if(action.type==='reaction-shield')action.requirementsConfirmed=!!c.requirementsConfirmed
 if(action.type==='reaction-counterspell')action.requirementsConfirmed=!!c.requirementsConfirmed
 if(action.type==='spell-reroll'&&action.kind==='empowered'){
  const indices=c.diceIndices??[]
  if(!indices.length||new Set(indices).size!==indices.length||indices.length>(option.maxDice??0)||indices.some(i=>i>=(option.dice?.length??0)))throw new RoomError('请选择允许重掷的骰子')
  action.diceIndices=indices
 }
 command(r,action,e.id)
 const current=r.practicalReview!.windows.find(x=>x.id===w.id)!.responses.find(v=>v.actorId===c.actorId)!
 const pending=r.dice?.pending.find(p=>p.command.kind==='map'&&p.command.command.type==='combat'&&JSON.stringify(p.command.command.command)===JSON.stringify(action)||p.command.kind==='practical-frame-action'&&JSON.stringify(p.command.command)===JSON.stringify(action))
 if(pending)current.dicePendingId=pending.id
 else current.selectedIds.push(option.key)
 return true
}
function runPracticalCombat(r:Room,now=Date.now()){
 if(!r.practicalReview&&!practicalEnabled(r,'combat'))return
 if(r.practicalReview)r.practicalReview.combatNeedsAdvance=false
 for(const w of r.practicalReview?.windows??[])if(w.status==='open'){
  const e=frame(r,w.encounterId)
  const savedParent=e?.reactionParents?.some(p=>p.id===w.pendingId)
  if(w.branchId!==practicalBranch(r)||!e||e.tick!==w.tick||e.phase!=='active'||e.pending?.id!==w.pendingId&&!savedParent){w.status='stale';continue}
  clock(r,w,now,!!savedParent)
 }
 if(!practicalEnabled(r,'combat')||r.dice?.pending.length)return
 const s=activeScene(r)
 for(let step=0;step<8;step++){
  const e=runnable(r),p=e?.pending
  if(!e)return
  if(!p){const concentration=e.actors.find(actor=>actor.npc?.concentration?.pendingDC||r.world.characters.find(c=>c.id===actor.characterId)?.runtime?.concentration?.pendingDC);if(concentration){command(r,{type:'concentration-roll',actorId:concentration.id});if(r.dice?.pending.length)return;continue}return}
  const special=p.kind==='manual'||p.utilityId||p.sceneEffectCastId||p.m3WorldId||p.targets.some(t=>t.sanctuaryBlocked)||!!p.spellId&&!!spellWorkflowPolicy(p.spellId)
  const phases:PracticalWindow['phase'][]=special?['d20','defense']:p.damageRolled||p.kind!=='attack'?['d20','defense','after-damage']:['d20','defense','damage']
  let window:PracticalWindow|undefined
  for(const phase of phases){const w=windowFor(r,e,phase,now);if(w.status!=='closed'){window=w;break}}
  if(window){
   const w=window,task=phaseTask(r,e,w),available=options(r,e,w.phase)
   if(w.status==='needs-gm'||['needs-gm','needs-fact','canceled'].includes(task.status))return
   for(const response of w.responses){
    if(response.done)continue
    if(response.dicePendingId){
      if(r.dice?.pending.some(p=>p.id===response.dicePendingId))return
      if(!r.dice?.records.some(record=>record.sourcePendingId===response.dicePendingId)){w.status='needs-gm';practicalTransition(task,'needs-gm','GM取消了可选能力骰组，等待明确接管；未自动重掷');return}
      response.selectedIds.push('dice:'+response.dicePendingId);delete response.dicePendingId
    }
    if(!available.some(o=>o.actorId===response.actorId&&!response.selectedIds.includes(o.key))){response.done=true;continue}
    if(response.memberId==='uncontrolled'){w.status='needs-gm';practicalTransition(task,'needs-gm','角色没有有效操作者','需要GM处理');return}
    if(response.memberId==='npc'){
      const npc=e.actors.find(a=>a.id===response.actorId)?.npcId
      if(npc&&heldNpc(r,npc)){w.status='needs-gm';practicalTransition(task,'needs-gm','NPC由GM接管，不代为选择');return}
      const policy=r.world.adventures[0]?.ai?.npcs.find(n=>n.id===npc)?.combatPolicy.resourceStrategy??r.gmReview!.settings.practical!.npcResources
      const allowed=available.filter(o=>o.actorId===response.actorId)
      const use=allowed.find(o=>['savage','tavern'].includes(o.id)||policy!=='conservative'&&(['uncanny','deflect','stone','parry'].includes(o.id)||o.id==='shield'&&p.targets.some(t=>t.id===o.actorId&&t.hit&&((t.roll?.total??Infinity)<t.ac+5||p.spellId==='magic-missile'))||o.id==='counterspell'&&new Set([e.actors.find(a=>a.id===p.actorId)?.side,e.actors.find(a=>a.id===o.actorId)?.side]).has('enemy')&&e.actors.find(a=>a.id===p.actorId)?.side!==e.actors.find(a=>a.id===o.actorId)?.side))
      if(use?.choice)response.selectedIds.push(use.key)
      else if(use?.command){const cmd=clone(use.command);if(cmd.type==='reaction-shield'||cmd.type==='reaction-counterspell'){const actor=e.actors.find(a=>a.id===cmd.actorId),problem=castingEvidence(r,actor?.characterId??'',cmd.key,[]);if(problem){w.status='needs-gm';practicalTransition(task,'needs-fact',problem);return}cmd.requirementsConfirmed=true}command(r,cmd);const updated=r.practicalReview!.windows.find(x=>x.id===w.id)!.responses.find(v=>v.actorId===response.actorId)!;updated.done=true;return}
      response.done=true
    }
   }
   clock(r,w,now)
   if(!w.responses.every(v=>v.done)){practicalTransition(task,'waiting-player','仅等待实际拥有可用选项的角色；送达后计时','请选择能力或放弃');return}
   w.status='closed';practicalTransition(task,'committed','可选窗口已关闭；不选择不消耗资源','选择已保存')
   continue
  }
  if(special){
   if(p.utilityId||p.sceneEffectCastId||p.m3WorldId||p.summonDraftId){command(r,{type:'resolve',nonlethal:false,savage:false,stone:false,relentless:false,pushConfirmed:false});if(r.dice?.pending.length)return;continue}
   return
  }
  if(!p.damageRolled&&p.kind==='attack'){
   const w=windowFor(r,e,'damage',now)
   command(r,{type:'damage-roll',actorId:p.actorId,savage:chosen(r,w,'savage').length>0,tavernReroll:chosen(r,w,'tavernReroll').length>0})
  }else{
   const w=windowFor(r,e,'after-damage',now)
   const push=chosen(r,w,'push').flatMap(o=>o.push?[o.push]:[])
   command(r,{type:'resolve',nonlethal:chosen(r,w,'nonlethal').length>0,nonlethalTargetIds:chosen(r,w,'nonlethal').map(o=>p.targets[o.targetIndex]!.id),savage:false,stone:false,pushConfirmed:push.length>0,pushDestinations:push,revelationBonus:chosen(r,w,'revelation').length>0,revelationTargetId:chosen(r,w,'revelation')[0]?p.targets[chosen(r,w,'revelation')[0]!.targetIndex]!.id:undefined,relentless:chosen(r,w,'relentless').length>0,relentlessTargetIds:chosen(r,w,'relentless').map(o=>o.actorId)})
  }
  if(r.dice?.pending.length)return
 }
 practicalState(r).combatNeedsAdvance=true
}
export function advancePracticalCombat(r:Room,now=Date.now()){
 const e=runnable(r),source=e?.pending?.id
 if(source&&r.practicalReview?.tasks.some(t=>t.sourceId===source&&t.phase==='exception'&&t.branchId===practicalBranch(r)&&t.status==='needs-gm'))return
 const trial=clone(r)
 try{runPracticalCombat(trial,now);Object.assign(r,trial)}catch(error){
  // Every rule command is itself atomic. Preserve previously committed stages/rolls.
  Object.assign(r,trial)
  const current=frame(r,e?.id)?.pending?.id??source
  if(current){const task=practicalTask(r,{domain:'combat',sourceId:current,phase:'exception',label:'战斗自动结算异常',basis:'rule'});if(task)practicalTransition(task,'needs-gm',error instanceof Error?error.message:'规则结算失败')}
 }
}
export function practicalCombatView(r:Room,m:RoomMember){
 if(!practicalEnabled(r,'combat'))return []
 return (r.practicalReview?.windows??[]).filter(w=>w.status==='open'&&w.branchId===practicalBranch(r)).flatMap(w=>{
  const e=frame(r,w.encounterId)
  if(!e||e.pending?.id!==w.pendingId)return []
  const all=options(r,e,w.phase)
  return w.responses.filter(v=>v.memberId===m.id&&!v.done&&!m.revoked).map(v=>({id:w.id,actorId:v.actorId,phase:w.phase,actorName:combatStats(e.actors.find(a=>a.id===v.actorId)!,r.world.characters,content(r)).name,deadlineAt:v.deadlineAt,remainingMs:v.remainingMs,options:all.filter(o=>o.actorId===v.actorId&&v.optionIds.includes(o.key)&&!v.selectedIds.includes(o.key)).map(o=>({id:o.key,name:o.name,cost:o.cost,requiresConfirmation:!!o.requiresConfirmation,dice:o.dice,maxDice:o.maxDice}))}))
 })
}
