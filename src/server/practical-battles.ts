import type {Room,RoomCommand} from '../online/protocol'
import type {BattlePreset,BattleRequest} from '../core/battle-types'
import {catalogue,clone,featIds} from '../core/engine'
import {combatStats} from '../core/combat-rules'
import {srd} from '../content/srd'
import {activeScene,adventure} from './room-engine'
import {executeRoomDice} from './room-dice'
import {finalizeRoomBroadcast} from './room-broadcast'
import {preparePracticalInitiative} from './practical-initiative'
import {practicalEnabled,practicalTask,practicalTransition,practicalBranch,practicalReceipt,practicalState} from './practical-review-state'
import {addBattleParticipants} from '../core/battle'
import {newEncounter} from '../core/combat'
import type {Encounter} from '../core/combat-types'
import type {BattleParticipant} from '../core/battle-types'
function reinforce(r:Room,request:BattleRequest,participants:BattleParticipant[],active:Encounter){
 const task=r.practicalReview!.tasks.find(t=>t.sourceId===request.id&&t.phase==='battle-start')!,a=adventure(r),s=activeScene(r)!,state=practicalState(r)
 const actorId=(p:BattleParticipant)=>p.kind==='character'?active.actors.find(a=>a.characterId===p.id)?.id:p.kind==='npc'?active.actors.find(a=>a.npcId===p.id)?.id:s.tokens.find(t=>t.id===p.id)?.actorId
 const added=participants.filter(p=>!actorId(p)||!active.actors.some(a=>a.id===actorId(p)))
 if(!added.length){practicalTransition(task,'needs-gm','没有尚未参战的实际增援人员；原先攻不重掷');return}
 if(active.pending||r.dice?.pending.length){practicalTransition(task,'waiting-dice','等待原战斗的待结算窗口，未重新投先攻');return}
 let saved=state.reinforcements.find(p=>p.requestId===request.id&&p.branchId===practicalBranch(r))
 if(!saved){
  if(state.reinforcements.length>=100){const i=state.reinforcements.findIndex(p=>p.status==='committed');if(i<0)throw Error('增援记录已满');state.reinforcements.splice(i,1)}
  const w=clone(r.world),ad=w.adventures[0]!,scene=ad.scenes.find(v=>v.id===s.id)!,staging=addBattleParticipants(w,ad,scene,newEncounter('增援先攻准备'),added,catalogue([srd,...r.world.packs]))
  saved={requestId:request.id,branchId:practicalBranch(r),encounterId:active.id,sceneId:s.id,participants:clone(added),staging,status:'rolling',rollRequested:false};state.reinforcements.push(saved)
 }
 if(saved.encounterId!==active.id||saved.sceneId!==s.id){practicalTransition(task,'needs-gm','增援的原战斗／场景已变化');return}
 if(saved.status==='rolling'){
  if(saved.rollRequested){practicalTransition(task,'needs-gm','增援先攻已取消或尚待输入，未自动重新掷骰');return}
  saved.rollRequested=true;dispatch(r,{kind:'practical-staging-roll',requestId:request.id})
  if(r.dice?.pending.length){practicalTransition(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'waiting-dice','仅等待新增参战者的实际先攻骰');return}
 }
 const current=r.practicalReview!.reinforcements.find(v=>v.requestId===request.id&&v.branchId===practicalBranch(r))!
 if(current.status==='committed')return
 if(!preparePracticalInitiative(r,current.staging)){practicalTransition(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'waiting-player','原战斗先攻保持，仅等待增援人物的合法先攻选项');return}
 const ready=current.participants.map(p=>{const actor=current.staging.actors.find(actor=>p.kind==='character'?actor.characterId===p.id:p.kind==='npc'?actor.npcId===p.id:actor.id===s.tokens.find(t=>t.id===p.id)?.actorId);if(!actor||actor.initiative===null)throw Error('增援先攻来源缺失');return {...p,initiative:actor.initiative}})
 dispatch(r,{kind:'map',command:{type:'battle-request-review',requestId:request.id,approve:true,reason:'实用策略：仅增援名单投先攻，原回合与先攻保持',participants:ready}})
 r.practicalReview!.reinforcements.find(v=>v.requestId===request.id&&v.branchId===practicalBranch(r))!.status='committed'
 practicalTransition(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'committed','实际增援已加入；原参战者先攻、资源、回合未重置')
}
function dispatch(r:Room,c:RoomCommand){const gm=r.members.find(m=>m.role==='gm'&&!m.revoked);if(!gm)throw Error('缺少有效GM');const before=clone(r.world);executeRoomDice(r,gm,c);finalizeRoomBroadcast(r,before,c,crypto.randomUUID())}
function begin(r:Room,request:BattleRequest,preset:BattlePreset){
 const task=practicalTask(r,{domain:'combat',sourceId:request.id,phase:'battle-start',label:'预设战斗启动',basis:'script'})!
 if(['committed','needs-gm','stale'].includes(task.status))return
 const a=adventure(r),s=activeScene(r),cat=catalogue([srd,...r.world.packs])
 if(!s||s.id!==request.sceneId||preset.sceneId!==s.id){practicalTransition(task,'needs-gm','触发场景与预设已变化');return}
 if(a.exploration&&a.exploration.status!=='closed'){practicalTransition(task,'needs-gm','探索轮仍有实际进程，需要先按原入口收尾');return}
 let encounter=r.world.encounters.find(e=>e.id===s.encounterId)
 if(request.status==='pending'){
  let participants=clone(preset.participants)
  let waiting=false
  for(const choice of preset.practical?.entry??[]){
    if(choice.mode==='fixed')continue
    participants=participants.filter(p=>p.kind!=='npc'||p.id!==choice.npcId)
    if(choice.mode==='exclude')continue
    const npc=a.ai?.npcs.find(n=>n.id===choice.npcId&&n.sceneId===s.id&&n.enabled)
    if(!npc||npc.npcType!=='important'){practicalTransition(task,'needs-gm','AI参战判断仅限本场景已配置的重要NPC');return}
    const entry=practicalTask(r,{domain:'combat',sourceId:request.id+':'+npc.id,phase:'battle-entry',label:'重要NPC参战判断',basis:'model'})!
    entry.context={type:'battle-entry',requestId:request.id,npcId:npc.id}
    if(['needs-gm','stale','canceled'].includes(entry.status)){practicalTransition(task,'needs-gm','重要NPC参战判断需要人工接管');return}
    if(entry.decision?.kind!=='battle-entry'){waiting=true;continue}
    if(entry.decision.join)participants.push({kind:'npc',id:npc.id,side:entry.decision.side})
  }
  if(waiting){practicalTransition(task,'waiting-model','等待重要NPC在各自允许的阵营范围内判断；尚未投先攻');return}
  for(const c of r.world.characters.filter(c=>a.party.includes(c.id)&&!c.npcOwnerId&&s.tokens.some(t=>t.characterId===c.id&&!t.hidden)&&!c.runtime?.death?.dead))if(!participants.some(p=>p.kind==='character'&&p.id===c.id))participants.push({kind:'character',id:c.id,side:'party'})
  if(!participants.length){practicalTransition(task,'needs-gm','没有合法参战人员');return}
  if(encounter?.phase==='active'){reinforce(r,request,participants,encounter);return}
  dispatch(r,{kind:'map',command:{type:'battle-request-review',requestId:request.id,approve:true,reason:'实用策略：按GM已授权预设冻结参战名单',participants}})
  encounter=r.world.encounters.find(e=>e.id===activeScene(r)?.encounterId)
  if(!encounter)throw Error('未产生实际战斗准备')
  practicalReceipt(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'prepared:'+encounter.id)
 }
 if(!encounter||encounter.phase!=='setup')return
 const liveTask=r.practicalReview!.tasks.find(t=>t.id===task.id)!
 if(!liveTask.receipts.includes('prepared:'+encounter.id)){practicalTransition(liveTask,'needs-gm','当前战斗不是原冻结名单，需GM核对');return}
 if(r.dice?.pending.length){practicalTransition(liveTask,'waiting-dice','等待实际先攻骰组');return}
 if(encounter.actors.some(actor=>actor.initiative===null)){
  if(liveTask.receipts.includes('initiative:'+encounter.id)){practicalTransition(liveTask,'needs-gm','先攻骰组已取消或名单改变，不自动重新掷骰');return}
  practicalReceipt(liveTask,'initiative:'+encounter.id)
  dispatch(r,{kind:'map',command:{type:'combat',sceneId:s.id,command:{type:'roll-initiative'}}})
  encounter=r.world.encounters.find(e=>e.id===s.encounterId)!
  if(r.dice?.pending.length){practicalTransition(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'waiting-dice','等待GM录入冻结名单的先攻原始面值');return}
 }
 if(!preparePracticalInitiative(r,encounter)){practicalTransition(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'waiting-player','先攻已保存；等待玩家重掷／同值顺序／警觉自愿交换，未送达不计时');return}
 if(preset.practical?.autoStart){dispatch(r,{kind:'map',command:{type:'combat',sceneId:s.id,command:{type:'start'}}});practicalTransition(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'committed','固定名单先攻已确认，已走原开战路径；无攻击目标不等于胜利')}
 else practicalTransition(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'needs-gm','先攻已就绪，预设要求GM手动开始')
}
export function advancePracticalBattles(r:Room){
 if(!practicalEnabled(r,'combat'))return
 const a=adventure(r)
 for(const request of a.battles?.requests??[]){
  const preset=a.battles?.presets.find(p=>p.id===request.presetId&&p.practical?.enabled)
  if(!preset||request.status==='rejected')continue
  const existing=r.practicalReview?.tasks.find(t=>t.domain==='combat'&&t.sourceId===request.id&&t.phase==='battle-start'&&t.branchId===practicalBranch(r))
  if(request.status!=='pending'&&!existing)continue
  try{begin(r,request,preset)}catch(e){const task=r.practicalReview?.tasks.find(t=>t.sourceId===request.id&&t.phase==='battle-start'&&t.branchId===practicalBranch(r));if(task)practicalTransition(task,'needs-gm',e instanceof Error?e.message:'战斗准备失败')}
 }
 const s=activeScene(r),e=r.world.encounters.find(e=>e.id===s?.encounterId&&e.phase==='active'),request=a.battles?.requests.find(q=>q.encounterId===e?.id),preset=a.battles?.presets.find(p=>p.id===request?.presetId)
 if(!s||!e||!preset?.practical?.enabled||preset.practical.finish==='manual'||e.pending||r.dice?.pending.length||r.intents.some(i=>i.status==='pending')||a.battles?.requests.some(q=>q.status==='pending'))return
 const cat=catalogue([srd,...r.world.packs]),enemies=e.actors.filter(actor=>actor.side==='enemy')
 if(!enemies.length||!enemies.every(actor=>{const stats=combatStats(actor,r.world.characters,cat);return preset.practical!.finish==='enemy-dead'?stats.dead:stats.dead||stats.hp<=0}))return
 const task=practicalTask(r,{domain:'combat',sourceId:e.id,phase:'battle-finish',label:'预设战斗结束条件',basis:'script'})!
 if(task.status==='committed'||task.status==='needs-gm')return
 try{dispatch(r,{kind:'map',command:{type:'battle-finish',sceneId:s.id,reason:'预设明确的敌方存活条件已满足；待处理队列经原统一守卫核验'}});practicalTransition(r.practicalReview!.tasks.find(t=>t.id===task.id)!,'committed','已正常归档战斗；仍有效的持续法术沿原生命周期保留')}catch(error){practicalTransition(task,'needs-gm',error instanceof Error?error.message:'存在未结后果')}
}
