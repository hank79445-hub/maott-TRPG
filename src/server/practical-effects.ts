import type {Room,RoomCommand} from '../online/protocol'
import type {MapWorld} from '../core/map-types'
import {executeRoomDice} from './room-dice'
import {tickPracticalEffectInputs} from './practical-effect-inputs'
import {practicalEnabled,practicalTask,practicalTransition,practicalBranch} from './practical-review-state'
const sources=(w:MapWorld)=>{const a=w.adventures[0];return {hazard:a?.sceneEffects?.hazards??[],m3:a?.m3?.events??[],summon:a?.summons?.events??[],m5:a?.sceneEffects?.m5?.resolutions??[]}}
/** Only newly created consequences are enrolled; enabling a mode does not execute old queues. */
export function queuePracticalEffects(r:Room,before:MapWorld){
 if(!practicalEnabled(r,'spells'))return
 const prior=sources(before),current=sources(r.world)
 for(const kind of ['hazard','m3','summon','m5'] as const)for(const e of current[kind])if(e.status==='pending'&&!prior[kind].some(old=>old.id===e.id)){
  const task=practicalTask(r,{domain:'spells',sourceId:e.id,phase:'effect-'+kind,label:kind==='hazard'?'已确认区域后果':kind==='m3'?'空间后果':kind==='summon'?'召唤物后果':'法术后续结算',basis:'rule'})
  if(task)practicalTransition(task,'ready','真实机制生成的后果，沿用已保存的来源、费用与骰值')
 }
}
export function advancePracticalEffects(r:Room){
 if(!practicalEnabled(r,'spells'))return
 tickPracticalEffectInputs(r)
 for(const task of r.practicalReview?.tasks??[]){if(task.domain!=='spells'||!task.phase.startsWith('effect-')||task.branchId!==practicalBranch(r)||['committed','rejected','canceled','stale'].includes(task.status))continue;const e=sources(r.world)[task.phase.slice(7) as keyof ReturnType<typeof sources>]?.find(e=>e.id===task.sourceId);if(e&&e.status!=='pending')practicalTransition(task,'committed','原机制后果已经处理，不重复掷骰／扣费')}
 const gm=r.members.find(m=>m.role==='gm'&&!m.revoked);if(!gm)return
 for(let count=0;count<12;count++){
  const task=r.practicalReview?.tasks.find(t=>t.domain==='spells'&&t.phase.startsWith('effect-')&&t.branchId===practicalBranch(r)&&['ready','waiting-dice'].includes(t.status))
  if(!task)return
  const a=r.world.adventures[0]!,kind=task.phase.slice(7),e=sources(r.world)[kind as keyof ReturnType<typeof sources>]?.find(e=>e.id===task.sourceId)
  if(!e||e.status!=='pending'){practicalTransition(task,'committed','原后果已处理；不重复掷骰或应用');continue}
  if(r.dice?.pending.length)return
  let command:RoomCommand|undefined
  if(kind==='hazard')command={kind:'scene-effect',action:{operation:'hazard',eventId:e.id,note:'原区域触发已确认，自动核验实际来源、保存骰及后果'}}
  else if(kind==='summon'){
   const event=a.summons?.events?.find(v=>v.id===e.id)
   if(event?.type==='putrid-aura')command={kind:'summon-action',action:{operation:'event',eventId:e.id,receipt:'practical:'+e.id,note:'实际腐灭光环强制豁免，沿用原控制与时序'}}
   else practicalTransition(task,'needs-fact','需要本人选择实际排出／下马落点或魔宠反应；请在原召唤后果入口处理','等待必要落点／反应选择')
  }else if(kind==='m3')practicalTransition(task,'needs-fact','需要实际落点／实体变化输入；请在原空间后果入口选择，不以超时跳过坠落或豁免','等待实际落点')
  else if(kind==='m5'){
   const event=a.sceneEffects?.m5?.resolutions.find(v=>v.id===e.id),native=event?.encounterId?r.world.encounters.find(v=>v.id===event.encounterId):undefined
   if(event?.encounterId&&!native?.pending)command={kind:'scene-effect',action:{operation:'m5-resolve',eventId:e.id,note:'原攻击与反应已经结算，仅完成同一次法术后果'}}
   else {practicalTransition(task,'waiting-player','原法术后续进入实际攻击／防御窗口；必要玩家选项或实体骰不跳过','等待实际法术窗口');return}
  }
  if(!command)continue
  try{executeRoomDice(r,gm,command);const waiting=!!r.dice?.pending.length,latest=r.practicalReview!.tasks.find(t=>t.id===task.id)!;practicalTransition(latest,waiting?'waiting-dice':'committed',waiting?'等待原模式实体骰输入；未重复提交':'原后果已结算，未重新施法或重新消费材料',waiting?'等待实体骰':'后果已结算');if(waiting)return}catch(error){practicalTransition(task,'needs-gm',error instanceof Error?error.message:'实际后果条件变化','需要GM处理此项')}
 }
}
