import type {Room,Intent,RoomAction} from '../online/protocol'
import type {PracticalDomain} from '../persistence/practical-review-schema'
import {catalogue} from '../core/engine'
import {hasFeat} from '../core/advanced-rules'
import {srd} from '../content/srd'
import {runtimeSpells} from '../core/runtime'
import {equipmentLayout} from '../core/equipment'
import {spellWorkflowPolicy} from '../core/spell-workflow-policies'
import {adventure,activeScene,authorizeAction} from './room-engine'
import {executeRoomDice} from './room-dice'
import {practicalEnabled,practicalTask,practicalTransition,practicalFingerprint,practicalBranch} from './practical-review-state'
import {practicalCast,missingConsent,reconcilePracticalCasting} from './practical-spell-inputs'
import {withCompletedCasting} from '../core/completed-casting'

function domain(action:RoomAction):PracticalDomain|undefined {
 if(['m1','scene-effect','spatial','summon'].includes(action.kind))return 'spells'
 if(action.kind==='map'){
  if(action.command.type==='interact')return 'exploration'
  if(action.command.type==='combat')return action.command.command.type==='cast'?'spells':'combat'
  if(action.command.type==='explore'&&action.command.command.operation==='spell-cast')return 'spells'
 }
}
function fingerprint(r:Room,i:Intent){
 const s=activeScene(r),m=r.members.find(m=>m.id===i.sessionId)
 return practicalFingerprint([practicalBranch(r),i.action,m&&{id:m.id,revoked:m.revoked,characterIds:m.characterIds,actorIds:m.actorIds},s?.id,s?.tokens,s?.points,s?.walls,s?.regions,s?.grid,r.world.characters.map(c=>({id:c.id,build:c.build,inventory:c.inventory,runtime:c.runtime?{...c.runtime,hours:undefined}:undefined,coins:c.coins})),r.world.encounters.map(e=>({id:e.id,phase:e.phase,tick:e.tick,current:e.current,actors:e.actors,pending:e.pending,reactionParents:e.reactionParents,zones:e.zones})),adventure(r).sceneEffects,adventure(r).summons,adventure(r).m3,r.environment])
}
export function practicalIntentDiceFingerprint(r:Room,id:string){const i=r.intents.find(i=>i.id===id);return i&&r.practicalReview?.tasks.some(t=>t.sourceId===id&&t.phase==='intent')?fingerprint(r,i):undefined}
export function recheckPracticalIntent(r:Room,id:string){const i=r.intents.find(i=>i.id===id&&i.status==='pending'),task=r.practicalReview?.tasks.find(t=>t.sourceId===id&&t.phase==='intent'&&t.branchId===practicalBranch(r));if(i&&task){const member=r.members.find(m=>m.id===i.sessionId&&!m.revoked);if(!member)throw Error('原申请身份已失效');authorizeAction(r,member,i.action);task.fingerprint=fingerprint(r,i);practicalTransition(task,'ready','本人补充输入／GM明确复核后继续；仍调用原规则检查')}}
export function queuePracticalIntent(r:Room,i:Intent){
 const d=domain(i.action)
 if(!d||!practicalEnabled(r,d))return
 practicalTask(r,{domain:d,sourceId:i.id,phase:'intent',label:i.summary,basis:'rule',participantIds:[i.sessionId],fingerprint:fingerprint(r,i)})
}
export function castingEvidence(r:Room,casterId:string,key:string,targets:string[],willing?:boolean,mechanismProof=false,elapsed=false){
 const cat=catalogue([srd,...r.world.packs]),caster=r.world.characters.find(c=>c.id===casterId)
 if(!caster)return '缺少实际职业卡施法来源；普通NPC须登记真实能力与施法条件'
 const grant=runtimeSpells(caster,cat).find(g=>g.key===key)
 if(!grant)return '法术不属于角色当前实际可用来源'
 const spell=grant.spell
 if(!elapsed&&/minute|hour/i.test(spell.castingTime))return '长时间施法需要实际连续施法进度，不能把完成布尔值当作时长证明'
 if(spellWorkflowPolicy(spell.id))return '此法术仍需具体环境／信息结果事实，等待既有GM裁定流程'
 if(willing&&targets.some(id=>id!==caster.id&&!r.world.encounters.some(e=>e.actors.some(a=>a.id===id&&a.characterId===caster.id))&&!activeScene(r)?.tokens.some(t=>t.id===id&&t.characterId===caster.id)))return '需目标本人明确同意；施法者不能代替其他角色填写自愿'
 const layout=equipmentLayout(caster,cat),free=!layout.slots['main-hand']?.length||!layout.slots['off-hand']?.length
 if(/(^|[,\s])S([,\s(]|$)/.test(spell.components)&&!free&&!hasFeat(caster.build,'war-caster',cat))return '姿势成分需要核实空手／施法特例，未自动假定满足'
 if(/(^|[,\s])M([,\s(]|$)/.test(spell.components)){
   if(/\d|consume|消耗|价值|worth/i.test(spell.components))return mechanismProof?'':'须登记具体有价／消耗材料，不能用普通材料包代替'
   if(!caster.inventory.some(row=>row.itemId==='component-pouch'&&row.quantity>0&&!row.containerId))return '材料成分缺少可验证的随身材料包或已确认法器登记'
 }
 return ''
}
function eligibility(r:Room,i:Intent){
 const action=i.action,s=activeScene(r)
 const cast=practicalCast(r,action)
 if(cast){
  const missing=missingConsent(r,i)
  if(missing.some(t=>t.declined))return '受术者已明确拒绝；不会用模型覆盖本人决定'
  if(missing.length)return '等待受术者本人明确同意；不使用施法者自填的自愿作为证据'
  if(cast.hours){const progress=r.practicalReview?.castings?.find(p=>p.intentId===i.id&&p.branchId===practicalBranch(r));if(progress?.status!=='completed')return progress?.reason??'请本人开始连续施法，并推进实际游戏时间'}
  if(cast.entity.c){const problem=castingEvidence(r,cast.entity.c.id,cast.key,[],false,cast.specialized,!!cast.hours);if(problem)return problem}
  else if(!cast.specialized)return '普通NPC必须使用实际能力的专用机制入口'
 }
 if(action.kind==='map'){
  const c=action.command
  if(c.type==='interact'){
    const p=s?.points.find(p=>p.id===c.pointId)
    return !p?.assistedReview?.enabled?'互动点未逐点授权':c.gm?'不能自动使用GM覆盖互动':p.hidden?'尚未公开互动点需要先发现':p.itemUse?.requirements.some(v=>v.mode!=='possess')&&!c.confirmItemCosts?'消耗物品须本人明确确认':''
  }
  if(c.type==='combat'){
    const cmd=c.command,e=r.world.encounters.find(e=>e.id===s?.encounterId)
    if(cmd.type==='attack')return ''
    if(cmd.type==='cast'){
      if(!cmd.requirementsConfirmed)return '本人尚未确认施法条件；不会代填确认字段'
      const actor=e?.actors.find(a=>a.id===cmd.actorId)
      return cast?'':castingEvidence(r,actor?.characterId??'',cmd.key,cmd.targets,cmd.willing)
    }
    if(['inspiration','reaction-defense','spell-reroll','trigger-feature','resolution-draft'].includes(cmd.type))return ''
    return '此操作保留原角色选择／GM入口，不从一般意图批量批准'
  }
  if(c.type==='explore'&&c.command.operation==='spell-cast'){
    const cmd=c.command,token=s?.tokens.find(t=>t.id===cmd.tokenId)
    if(!cmd.confirmed)return '本人尚未确认施法所需事实'
    return cast?'':castingEvidence(r,token?.characterId??'',cmd.key,cmd.targets??[],cmd.willing)
  }
 }
 if(action.kind==='m1')return ['cast','pulse'].includes(action.action.operation)?'':'材料／物件／遗骸事实登记仍由GM完成'
 if(action.kind==='summon'){
  if(action.action.operation==='familiar'&&action.action.action==='mimic')return '拟声须GM核对魔宠实际听过的声音来源，不从输入文本推定知识'
  return ['cast','move','fey-step','command','familiar','touch-cast','chain-attack','mount','steed-power','servant-task','carry','gear','follow'].includes(action.action.operation)?'':'真实后果、创建提交及生命周期仍须原阶段处理'
 }
 if(action.kind==='scene-effect')return ['cast','dispel','throw-flame','move-lights','cover','end','escape','search-terrain','resume-route','m5-use','m5-mark','supply-transfer','supply-consume'].includes(action.action.operation)?'':'环境事实或尚未授予的法术后果仍由GM核对'
 if(action.kind==='spatial')return ['cast','move','effect-action','portal'].includes(action.action.operation)?'':'空间事实或后果仍由GM核对'
 return '无此自动策略'
}
export function advancePracticalIntents(r:Room){
 reconcilePracticalCasting(r)
 for(const task of r.practicalReview?.tasks??[]){if(task.phase!=='intent'||task.branchId!==practicalBranch(r))continue;const i=r.intents.find(i=>i.id===task.sourceId);if(i?.status==='approved'){practicalTransition(task,'committed','原规则操作已完成，沿用已有骰与费用');const p=r.practicalReview!.castings.find(p=>p.intentId===i.id&&p.branchId===task.branchId);if(p)p.status='committed'}else if(i?.status==='rejected')practicalTransition(task,'rejected','原申请已拒绝，不自动重试')}
 for(const candidate of r.intents.filter(i=>i.status==='pending')){
  const task=r.practicalReview?.tasks.find(t=>t.sourceId===candidate.id&&t.phase==='intent'&&t.branchId===practicalBranch(r)),d=domain(candidate.action)
  if(!task||!d||!practicalEnabled(r,d)||!['pending','ready','waiting-dice'].includes(task.status))continue
  const member=r.members.find(m=>m.id===candidate.sessionId&&!m.revoked),gm=r.members.find(m=>m.role==='gm'&&!m.revoked)
  if(!member||!gm){practicalTransition(task,'needs-gm','原身份或GM权限已失效');continue}
  if(r.dice?.pending.some(p=>p.command.kind==='intent-review'&&p.command.intentId===candidate.id))continue
  try{
   authorizeAction(r,member,candidate.action)
   if(task.fingerprint!==fingerprint(r,candidate)){practicalTransition(task,'needs-gm','相关角色、目标、环境或资源已变化，需复核；聊天版本本身不使申请失效');continue}
   const problem=eligibility(r,candidate)
   if(problem){practicalTransition(task,'needs-fact',problem,'等待必要条件');continue}
   candidate.baseWorldRevision=r.worldRevision
   const cast=practicalCast(r,candidate.action),progress=r.practicalReview?.castings?.find(p=>p.intentId===candidate.id&&p.branchId===practicalBranch(r)&&p.status==='completed')
   const submit=()=>executeRoomDice(r,gm,{kind:'intent-review',intentId:candidate.id,approve:true,reason:'实用策略：原提交身份、逐项授权及真实机制验证'})
   if(cast&&progress)withCompletedCasting(cast.id,cast.key,progress.durationHours,submit);else submit()
   const latest=r.intents.find(i=>i.id===candidate.id)!,ledger=r.practicalReview!.tasks.find(t=>t.id===task.id)!
   practicalTransition(ledger,latest.status==='approved'?'committed':'waiting-dice','沿用原权限与规则执行；不新增GM覆盖或确认字段',latest.status==='approved'?'操作已提交规则结算':'等待实体骰')
   if(latest.status==='approved'&&progress){const current=r.practicalReview!.castings.find(p=>p.intentId===candidate.id&&p.branchId===practicalBranch(r));if(current)current.status='committed'}
  }catch(error){practicalTransition(task,'needs-gm',error instanceof Error?error.message:'规则预检失败','需要GM处理')}
 }
}
