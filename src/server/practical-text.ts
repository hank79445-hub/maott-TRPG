import type { AiJob, AiModelRequest } from '../core/ai-types'
import type { Room } from '../online/protocol'
import { practicalEnabled, practicalTask, practicalTransition, practicalRepair } from './practical-review-state'

export function textTask(room: Room, job: AiJob) {
  if (!practicalEnabled(room, 'text') || (job.kind === 'npc' && (job.spatialPlanning || job.activityTest || job.purpose === 'combat' || job.socialDecision && job.socialDecision.status !== 'completed')) || (job.kind === 'narration' && (job.skillPreview || job.modelProbe))) return
  return practicalTask(room, { domain: 'text', sourceId: job.id, phase: 'generation', label: job.kind === 'npc' ? 'NPC公开回应' : '已确认事件旁白', basis: 'model', participantIds: job.kind === 'npc' ? [job.sessionId] : [] })
}
export function preparePracticalText(room: Room, job: AiJob, request: AiModelRequest) {
  const task = textTask(room, job)
  if (!task) return request
  if (task.repairs) request = { ...request, system: request.system + '\n上次输出未通过程序契约校验。请只按当前输出契约重新生成合法JSON；不要增加命令或更改已确认结果。', input: { ...request.input, contractCorrection: { attempt: task.repairs, validation: task.reason } } }
  practicalTransition(task, 'waiting-model', task.repairs ? task.reason : '只生成一次，不追加语义审稿', '正在生成回应')
  return request
}
export function dispatchPracticalText(room: Room, job: AiJob) {
  const task = textTask(room, job)
  if (task) task.calls[task.repairs ? 'repair' : 'generation']++
}
export function practicalJobAvailable(room: Room, job: AiJob) {
  const task = room.practicalReview?.tasks.find(t => t.sourceId === job.id && t.phase === 'generation' && t.branchId === job.branchId)
  const plan=room.practicalReview?.tasks.find(t=>t.phase==='npc-planning'&&t.receipts.includes('job:'+job.id)&&t.branchId===job.branchId)
  return (!task || !['paused','stale','canceled'].includes(task.status))&&(!plan||!['paused','stale','canceled','needs-gm'].includes(plan.status))
}
export function recordTextUsage(room: Room, job: AiJob, tokens: number | null) {
  const task = room.practicalReview?.tasks.find(t=>t.sourceId===job.id&&t.phase==='generation'&&t.branchId===job.branchId)??textTask(room, job)
  if (task && tokens !== null) task.reportedTokens = (task.reportedTokens ?? 0) + tokens
}
export function repairPracticalText(room: Room, job: AiJob, reason: string) {
  const task = textTask(room, job)
  if (!task || !practicalRepair(room, task, reason)) return false
  job.status = 'queued'; job.attempt = null; job.error = reason
  if (job.kind === 'npc') {
    job.text = ''; job.plan = []; job.proposal = { kind: 'none' }; delete job.checkSuggestion
    if (job.dialogueReview) { job.dialogueReview.stage = 'candidate'; delete job.dialogueReview.audit }
  }
  return true
}
export function finishPracticalText(room: Room, job: AiJob) {
  const task = textTask(room, job)
  if (!task) return
  if (job.status === 'published') practicalTransition(task, 'committed', '程序结构、来源与权限验证通过；已发布，未进行二次语义审核', '回应已发布')
  else if (['fallback','waiting-gm'].includes(job.status)) practicalTransition(task, 'needs-gm', job.error || '需要人工处理', '需要GM处理')
  else if (job.status === 'stale') practicalTransition(task, 'stale', '相关条件已变化', '本次回应已失效')
  else if (job.status === 'draft') practicalTransition(task, 'needs-gm', (job.kind === 'npc' ? job.dialogueReview?.reason : '') || job.error || '未满足自动发布条件', '等待GM处理')
}
export function resumePracticalDrafts(room:Room,publish:(room:Room,job:AiJob)=>unknown){
 for(const task of room.practicalReview?.tasks??[]){
  if(task.domain!=='text'||task.phase!=='generation')continue
  const job=room.world.adventures[0]?.aiLog?.jobs.find(j=>j.id===task.sourceId&&j.branchId===task.branchId)
  if(!job)continue
  if(['interrupted','fallback'].includes(job.status)&&['waiting-model','paused'].includes(task.status)){
   if(task.status==='paused'){task.resumeStatus='needs-gm';task.resumeReason=job.error||'原调用已中断，保留费用，不自动重复生成'}else practicalTransition(task,'needs-gm',job.error||'原调用已中断，保留费用，不自动重复生成')
  }
  if(job.status==='draft'&&['waiting-model','ready'].includes(task.status)&&practicalEnabled(room,'text')){
   try{publish(room,job);finishPracticalText(room,job)}catch(e){practicalTransition(task,'needs-gm',e instanceof Error?e.message:'恢复发布时来源已变化')}
  }
 }
}
