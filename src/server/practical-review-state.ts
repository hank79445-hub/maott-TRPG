import {localeOrDefault,LANGUAGE_POLICY_VERSION} from '../shared/localization/locale'
import { createHash, randomUUID } from 'node:crypto'
import type { Room, RoomMember,RoomCommand } from '../online/protocol'
import { practicalStateSchema, type PracticalDomain, type PracticalTask } from '../persistence/practical-review-schema'

export const PRACTICAL_POLICY = 'practical-review/1'
export const practicalBranch = (room: Room) => room.world.adventures[0]?.broadcastLog?.branchId ?? 'legacy'
export function practicalMode(room: Room, domain: PracticalDomain): 'off' | 'shadow' | 'assisted' {
  const s = room.gmReview?.settings
  return !s || s.paused || s.mode === 'human' || !s.practical?.enabled || !s.practical[domain] ? 'off' : s.mode
}
export const practicalEnabled = (room: Room, domain: PracticalDomain) => practicalMode(room, domain) === 'assisted'
export function practicalState(room: Room) {
  return room.practicalReview ??= practicalStateSchema.parse({ version: 1, tasks: [] })
}
export const practicalFingerprint = (input: unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex')
export const practicalFinished = (task: PracticalTask) => ['committed', 'rejected', 'canceled', 'stale'].includes(task.status)
export function practicalTask(room: Room, input: Pick<PracticalTask, 'domain' | 'sourceId' | 'phase' | 'label' | 'basis'> & { participantIds?: string[]; fingerprint?: string }, now = Date.now()) {
  const branchId = practicalBranch(room), key = `${branchId}:${input.domain}:${input.sourceId}:${input.phase}`
  const state = practicalState(room), old = state.tasks.find(t => t.key === key)
  if (old) return old
  while (state.tasks.length >= 1000) {
    const i = state.tasks.findIndex(practicalFinished)
    if (i < 0) return undefined
    state.tasks.splice(i, 1)
  }
  const task: PracticalTask = {
    outputLocale:localeOrDefault(room.world.adventures[0]?.ai?.settings.contentLocale ?? room.world.adventures[0]?.ai?.settings.language),languagePolicyVersion:LANGUAGE_POLICY_VERSION,
    ...input, id: randomUUID(), key, branchId, participantIds: input.participantIds ?? [],
    fingerprint: input.fingerprint ?? '', status: 'pending', policyRevision: room.gmReview?.settings.revision ?? 0,
    reason: '', publicReason: '', receipts: [], repairs: 0,
    calls: { generation: 0, adjudication: 0, repair: 0, summary: 0 }, reportedTokens: null, at: now, updatedAt: now,
  }
  state.tasks.push(task)
  return task
}
export function practicalTransition(task: PracticalTask, status: PracticalTask['status'], reason: string, publicReason = '', now = Date.now()) {
  if (practicalFinished(task)) return false
  task.status = status; task.reason = reason.slice(0, 1500); task.publicReason = publicReason.slice(0, 500); task.updatedAt = now
  return true
}
export function practicalReceipt(task: PracticalTask, receipt: string, now = Date.now()) {
  if (task.receipts.includes(receipt)) return false
  if (task.receipts.length >= 300) throw Error('任务收据已达上限，需接管；未重复提交')
  task.receipts.push(receipt); task.updatedAt = now
  return true
}
export function practicalRepair(room: Room, task: PracticalTask, reason: string) {
  const limit = room.gmReview?.settings.practical?.maxRepairs ?? 0
  if (!practicalEnabled(room, task.domain) || practicalFinished(task) || task.branchId !== practicalBranch(room) || task.repairs >= limit) return false
  task.repairs++; practicalTransition(task, 'waiting-model', reason, '正在自动修正')
  return true
}
/** Pauses and old branches are state, never permission to replay a committed action. */
export function reconcilePracticalState(room: Room, now = Date.now()) {
  if (!room.practicalReview) return
  for (const task of room.practicalReview.tasks) {
    if (practicalFinished(task)) continue
    if (task.branchId !== practicalBranch(room)) { practicalTransition(task, 'stale', '已读档或切换分支，原任务不再执行', '原任务已失效', now); continue }
    if (practicalMode(room, task.domain) === 'off') {
      if (task.status !== 'paused') {
        task.resumeStatus = task.status
        task.resumeReason=task.reason
        if (task.deadlineAt !== undefined) { task.remainingMs = Math.max(0, task.deadlineAt - now); delete task.deadlineAt }
        practicalTransition(task, 'paused', '自动策略已暂停或关闭，保留原进度', '自动处理已暂停', now)
      }
    } else if (task.status === 'paused') {
      const status = task.resumeStatus ?? 'pending'; delete task.resumeStatus
      if (task.remainingMs !== undefined) {if(task.phase==='effect-summon'){delete task.deadlineAt;delete task.lastSeenAt}else{task.deadlineAt = now + task.remainingMs; delete task.remainingMs}}
      const reason=task.resumeReason??'已恢复，提交前仍核对相关条件';delete task.resumeReason
      practicalTransition(task, status, reason, '继续处理', now)
    }
  }
}
export interface PracticalReviewView {
  policy: typeof PRACTICAL_POLICY
  tasks: (Pick<PracticalTask, 'id' | 'domain' | 'sourceId' | 'phase' | 'label' | 'status' | 'basis' | 'updatedAt' | 'deadlineAt'> & { reason: string; calls?: PracticalTask['calls']; reportedTokens?: number | null })[]
}
export function projectPractical(room: Room, member: RoomMember): PracticalReviewView | undefined {
  if (!room.practicalReview) return undefined
  return {
    policy: PRACTICAL_POLICY,
    tasks: room.practicalReview.tasks.filter(t => t.branchId === practicalBranch(room) && (member.role === 'gm' || !member.revoked && t.participantIds.includes(member.id))).slice(-100).map(t => ({
      id: t.id, domain: t.domain, sourceId: t.sourceId, phase: t.phase, label: member.role === 'gm' ? t.label : '本次操作',
      status: t.status, basis: t.basis, updatedAt: t.updatedAt, deadlineAt: t.deadlineAt,
      reason: member.role === 'gm' ? t.reason : t.publicReason,
      ...(member.role === 'gm' ? { calls: { ...t.calls }, reportedTokens: t.reportedTokens } : {}),
    })),
  }
}
export function practicalTakeover(room:Room,member:RoomMember,command:RoomCommand){
 if(command.kind!=='practical-takeover')return false
 if(member.role!=='gm'||member.revoked)throw Error('只有GM可接管自动任务')
 const task=room.practicalReview?.tasks.find(t=>t.id===command.taskId&&t.branchId===practicalBranch(room))
 if(!task||practicalFinished(task))throw Error('任务不存在、已结束或属于旧分支')
 practicalTransition(task,'needs-gm','GM已明确接管；已完成步骤、输入和费用保持，不再自动推进','GM已接管')
 for(const w of room.practicalReview!.windows)if(w.id===task.sourceId)w.status='needs-gm'
 const a=room.world.adventures[0],jobIds=new Set([task.sourceId,...task.receipts.filter(r=>r.startsWith('job:')).map(r=>r.slice(4))])
 for(const job of a?.aiLog?.jobs??[])if(jobIds.has(job.id)&&['queued','running'].includes(job.status)){
  job.status='interrupted';job.attempt=null;job.error='GM已接管，不再自动生成'
  if(job.kind==='npc'&&job.purpose==='combat'){
   const n=a?.ai?.npcs.find(n=>n.id===job.npcId),e=room.world.encounters.find(e=>e.phase==='active'&&e.actors[e.current]?.id===n?.actorId)
   if(n&&e)n.turnHold={encounterId:e.id,tick:e.tick,state:'manual'}
  }
 }
 for(const run of a?.aiLog?.turns??[])if(jobIds.has(run.jobId)&&!['completed','canceled'].includes(run.state)){
  run.state='paused';run.needsApproval=true;run.reason='GM接管；保留已完成步骤与资源'
  const n=a?.ai?.npcs.find(n=>n.id===run.npcId);if(n)n.turnHold={encounterId:run.encounterId,tick:run.tick,state:'manual'}
 }
 const spatial=a?.ai?.spatialState?.tasks.find(t=>t.id===task.sourceId)
 if(spatial&& !['completed','canceled'].includes(spatial.status)){spatial.status='paused';spatial.reason='GM已接管空间任务';spatial.approved=false}
 return true
}
