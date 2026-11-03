import type { Room } from '../online/protocol'
import type { AiJob,AiModelRequest,NpcConversation,NpcTurnRun } from '../core/ai-types'
import { activeScene,adventure } from './room-engine'
import { journal,newNpcTask,liveConversation } from './room-ai'
import { startNpcTurn,refreshNpcRunScope } from './room-npc-execution'
import { heldNpc } from './gm-control'
import { practicalEnabled,practicalBranch,practicalTask,practicalTransition,practicalRepair,practicalReceipt } from './practical-review-state'
export function npcPlanningTask(room:Room,job:AiJob){
 if(job.kind!=='npc'||job.purpose!=='combat'||!practicalEnabled(room,'combat'))return
 const n=adventure(room).ai?.npcs.find(n=>n.id===job.npcId),e=room.world.encounters.find(e=>e.id===activeScene(room)?.encounterId)
 if(!n||!e||e.actors[e.current]?.id!==n.actorId||n.turnMode!=='plan'||heldNpc(room,n.id))return
 const task=practicalTask(room,{domain:'combat',sourceId:`${e.id}:${e.tick}:${n.id}`,phase:'npc-planning',label:'NPC回合规划',basis:'npc-policy'})
 if(task)practicalReceipt(task,'job:'+job.id)
 return task
}
export function practicalPlanningRequest(room:Room,job:AiJob,request:AiModelRequest){
 const task=npcPlanningTask(room,job)
 if(!task)return request
 const run=journal(room).turns?.find(r=>r.jobId===job.id&&r.tick===room.world.encounters.find(e=>e.id===activeScene(room)?.encounterId)?.tick)
 return {...request,system:request.system+' 本房间采用实用审核。规划只返回结构化plan、proposal和简短私有text/reason，不撰写公开台词。需要公开发言时仅填写requestPublicSpeech:true，由另一个公开上下文生成。不可执行步骤会反馈一次，最多追加两次修正。已完成步骤、已掷骰和已消费资源不得重做，只规划剩余预算。',input:{...request.input,executionReceipt:{completedSteps:run?.steps.slice(0,run.nextStep)??[],executed:run?.executed??0,repairs:task.repairs,feedback:task.repairs?task.reason:'',remainingOnly:true}}}
}
export function dispatchPracticalPlanning(room:Room,job:AiJob){const task=npcPlanningTask(room,job);if(task){task.calls[task.repairs?'repair':'generation']++;practicalTransition(task,'waiting-model',task.reason||'等待合法剩余回合计划')}}
export function acceptPracticalPlan(room:Room,job:NpcConversation){
 const task=npcPlanningTask(room,job)
 if(!task||['needs-gm','canceled','stale'].includes(task.status)||job.status!=='draft')return false
 const n=liveConversation(room,job)
 if(n.turnHold)return false
 const e=room.world.encounters.find(e=>e.id===activeScene(room)?.encounterId)!
 const existing=journal(room).turns?.find(r=>r.npcId===n.id&&r.encounterId===e.id&&r.tick===e.tick&&r.branchId===practicalBranch(room))
 if(existing){
  if(existing.state!=='review'||existing.needsApproval)return false
  existing.steps=[...existing.steps.slice(0,existing.nextStep),...structuredClone(job.plan)];existing.state='running';existing.reason='保留已完成步骤，只继续合法剩余计划';existing.waitingStep=undefined
  refreshNpcRunScope(room,existing)
 }else startNpcTurn(room,job)
 job.status='published';job.attempt=null
 practicalTransition(task,'ready','模型计划已接入逐步规则复验，不执行私有规划文本')
 return true
}
export function repairPracticalPlan(room:Room,job:AiJob,reason:string){
 if(job.kind!=='npc')return false
 const task=npcPlanningTask(room,job)
 if(!task||!practicalRepair(room,task,reason))return false
 job.status='queued';job.attempt=null;job.error=reason
 job.baseWorldRevision=room.worldRevision
 return true
}
export function repairNpcRun(room:Room,run:NpcTurnRun,reason:string){
 const job=journal(room).jobs.find(j=>j.id===run.jobId)
 if(!job||job.kind!=='npc'||!practicalEnabled(room,'combat'))return false
 // Feedback categorizes invalidity without disclosing unseen geometry, actors or private IDs.
 const feedback=/资源|不足|次数|动作|回合/.test(reason)?'剩余动作、资源或次数不允许该步骤；只规划剩余预算。':/目标|距离|射程|视线/.test(reason)?'所选目标或距离当前不可执行；请仅使用本次公开观察中的合法目标。':'此步骤未通过服务端规则验证；请根据当前自身能力、位置和公开观察调整。'
 if(!repairPracticalPlan(room,job,feedback)){const task=npcPlanningTask(room,job);if(task)practicalTransition(task,'needs-gm','本回合两次修正仍未得到合法方案；保留已完成步骤');return false}
 run.state='review';run.reason=feedback;return true
}
export function schedulePracticalNpc(room:Room){
 if(!practicalEnabled(room,'combat'))return
 const scene=activeScene(room),e=room.world.encounters.find(e=>e.id===scene?.encounterId&&e.phase==='active')
 if(!e||e.pending||room.dice?.pending.length)return
 const n=adventure(room).ai?.npcs.find(n=>n.actorId===e.actors[e.current]?.id&&n.enabled&&n.sceneId===scene?.id)
 if(!n||n.controller!=='model'||n.turnMode!=='plan'||!n.combatPolicy.planOnTurn||n.turnHold||heldNpc(room,n.id))return
 if(journal(room).turns?.some(r=>r.npcId===n.id&&r.encounterId===e.id&&r.tick===e.tick&&r.branchId===practicalBranch(room)))return
 const prior=room.practicalReview?.tasks.find(t=>t.domain==='combat'&&t.sourceId===`${e.id}:${e.tick}:${n.id}`&&t.phase==='npc-planning'&&t.branchId===practicalBranch(room))
 if(prior)return
 const gm=room.members.find(m=>m.role==='gm'&&!m.revoked)
 if(!gm)return
 try{const job=newNpcTask(room,gm,n,n.characterId??adventure(room).party[0]??n.id,'combat','当前回合规划剩余动作',n.goals);npcPlanningTask(room,job)}catch(error){const task=practicalTask(room,{domain:'combat',sourceId:`${e.id}:${e.tick}:${n.id}`,phase:'npc-planning',label:'NPC回合规划',basis:'npc-policy'});if(task)practicalTransition(task,'needs-gm',error instanceof Error?error.message:'无法创建规划')}
}
export function finishPracticalPlanning(room:Room,job:AiJob){
 const task=room.practicalReview?.tasks.find(t=>t.phase==='npc-planning'&&t.receipts.includes('job:'+job.id)&&t.branchId===practicalBranch(room))
 if(!task)return
 if(['fallback','interrupted'].includes(job.status))practicalTransition(task,'needs-gm',job.error||'规划未完成，保留已执行步骤')
 const run=journal(room).turns?.find(r=>r.jobId===job.id&&r.branchId===task.branchId)
 if(run?.state==='completed')practicalTransition(task,'committed','本回合实际完成'+run.executed+'步；先前骰值与资源不重复执行')
}
