import type {Room} from '../online/protocol'
import type {NpcConversation,NpcDirective} from '../core/ai-types'
import {executeRoomDice} from './room-dice'
import {executeTrade,stockId,copper} from './trade-engine'
import {practicalEnabled,practicalTask,practicalTransition,practicalBranch} from './practical-review-state'
export function advancePracticalTrades(room:Room){
 if(!practicalEnabled(room,'trade')||room.dice?.pending.length)return
 const a=room.world.adventures[0]!,gm=room.members.find(m=>m.role==='gm'&&!m.revoked)
 if(!gm)return
 for(const session of a.trades?.sessions??[]){
  const existing=room.practicalReview?.tasks.find(t=>t.sourceId===session.id&&t.domain==='trade'&&t.phase==='bargain'&&t.branchId===practicalBranch(room))
  if(session.negotiation?.status==='resolved'&&existing?.status==='waiting-dice')practicalTransition(existing,'committed','原骰组已经结算；请玩家确认最新报价','议价完成，请确认最终报价')
  if(session.branchId!==practicalBranch(room)||session.negotiation?.status!=='requested'||session.status!=='awaitingGM')continue
  const n=a.ai?.npcs.find(n=>n.id===session.npcId),policy=n?.merchantPolicy?.practical
  if(!policy?.enabled||!policy.negotiation)continue
  const task=practicalTask(room,{domain:'trade',sourceId:session.id,phase:'bargain',label:'商店固定议价',basis:'script',participantIds:[session.sessionId]})
  if(!task||task.status==='needs-gm'||task.status==='committed')continue
  try{
   executeRoomDice(room,gm,{kind:'trade',command:{operation:'roll',branchId:session.branchId,tradeId:session.id,version:session.version,dc:policy.dc,cost:policy.cost,successPayCP:0,failurePayCP:0,policyPricing:true}})
   const latest=room.world.adventures[0]!.trades!.sessions.find(t=>t.id===session.id)!,ledger=room.practicalReview!.tasks.find(t=>t.id===task.id)!
   practicalTransition(ledger,latest.negotiation?.status==='resolved'?'committed':'waiting-dice','价格规则在掷骰前预检；最终交易仍须玩家确认最新报价',latest.negotiation?.status==='resolved'?'议价完成，请确认最终报价':'等待实体骰')
  }catch(e){practicalTransition(task,'needs-gm',e instanceof Error?e.message:'议价条件变化','需要GM处理交易')}
 }
}
/** Legacy proposal becomes an offer only. It never performs the final player commit. */
export function offerPracticalTrade(room:Room,job:NpcConversation,d:NpcDirective){
 const a=room.world.adventures[0]!,n=a.ai!.npcs.find(n=>n.id===job.npcId)!,member=room.members.find(m=>m.id===job.sessionId&&!m.revoked)
 if(!member||!d.itemId||!Number.isInteger(d.quantity)||!d.quantity||d.quantity<1)throw Error('交易缺少真实玩家、物品或数量')
 const old=room.practicalReview?.tasks.find(t=>t.domain==='trade'&&t.sourceId===job.id&&t.phase==='offer'&&t.branchId===practicalBranch(room))
 if(old?.status==='committed')return
 const rows=n.stock.map((r,index)=>({r,index})).filter(v=>v.r.itemId===d.itemId&&v.r.quantity>=d.quantity!)
 if(rows.length!==1)throw Error('库存不存在或存在多个实际实例，请使用消息交易界面明确选择')
 const {r:stock,index}=rows[0]!
 if(d.priceGP!==undefined&&copper(d.priceGP)!==copper(stock.priceGP))throw Error('模型报价不同于实际商店价格，请使用交易议价或GM明确还价')
 const branchId=practicalBranch(room)
 executeTrade(room,member,{kind:'trade',command:{operation:'open',branchId,npcId:n.id,characterId:job.characterId}})
 const t=a.trades!.sessions.find(t=>t.characterId===job.characterId&&t.npcId===n.id&&!['committed','canceled','stale'].includes(t.status))!
 executeTrade(room,member,{kind:'trade',command:{operation:'quote',branchId,tradeId:t.id,version:t.version,basket:{take:[{stockId:stockId(n,index),quantity:d.quantity}],give:[],playerPayCP:copper(stock.priceGP)*d.quantity,npcPayCP:0,note:'NPC提出的交易；尚未由玩家确认'}}})
 const task=practicalTask(room,{domain:'trade',sourceId:job.id,phase:'offer',label:'NPC交易报价',basis:'script',participantIds:[member.id]})
 if(task)practicalTransition(task,'committed','已转入同一交易会话，未扣款或交付','请在交易界面检查并确认报价')
}
