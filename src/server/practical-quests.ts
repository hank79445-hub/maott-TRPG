import type {Room} from '../online/protocol'
import {reviewQuestStep} from '../core/quest-steps'
import {eventAttributedToParty} from './practical-attribution'
import {practicalEnabled,practicalTask,practicalTransition,practicalBranch} from './practical-review-state'
/** Configured confirmed events propose a step first; automatic acceptance uses the same validator. */
export function advancePracticalQuests(room:Room){
 if(!practicalEnabled(room,'knowledge'))return
 const a=room.world.adventures[0]!
 for(const quest of a.quests??[])for(const suggestion of quest.stepSuggestions??[]){
  if(suggestion.status!=='pending'||suggestion.branchId!==practicalBranch(room))continue
  const step=quest.steps?.find(s=>s.id===suggestion.stepId),event=a.broadcastLog?.events.find(e=>e.id===suggestion.eventId&&e.phase==='confirmed'&&e.branchId===suggestion.branchId)
  if(!step?.automatic||!event)continue
  const task=practicalTask(room,{domain:'knowledge',sourceId:`${quest.id}:${step.id}`,phase:'quest',label:'已确认小目标',basis:'script'})
  if(!task||['committed','needs-gm','canceled','stale'].includes(task.status))continue
  if(!eventAttributedToParty(room,event,step)){practicalTransition(task,'needs-gm','事件缺少队伍／指定代理归属；未推进任务');continue}
  try{
   reviewQuestStep(a,quest.id,suggestion.id,true)
   room.worldRevision++
   practicalTransition(task,'committed','固定触发已确认且归属于队伍；已按原校验完成小目标，不发经验或奖励')
  }catch(e){practicalTransition(task,'needs-gm',e instanceof Error?e.message:'目标前置条件变化')}
 }
}
