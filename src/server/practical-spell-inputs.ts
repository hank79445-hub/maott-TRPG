import type {Room,RoomAction,RoomCommand,RoomMember,Intent} from '../online/protocol'
import {catalogue} from '../core/engine'
import {srd} from '../content/srd'
import {runtimeSpells} from '../core/runtime'
import {gCurrentHours,gEntity,gFact} from '../core/gm-spell-world'
import {combatStats} from '../core/combat-rules'
import {practicalState,practicalBranch,practicalEnabled,practicalTransition} from './practical-review-state'
import {activeScene,adventure,authorizeAction,RoomError} from './room-engine'
export function practicalCast(r:Room,action:RoomAction){
 let id='',key='',mode='',targets:string[]=[],willing=false,specialized=false
 if(['m1','spatial','scene-effect','summon'].includes(action.kind)&&'action'in action){
  const c=action.action
  if(c.operation!=='cast')return
  id='casterId'in c?c.casterId:'sourceId'in c?c.sourceId:'characterId'in c?c.characterId:'';key=c.key;mode=c.mode;specialized=true
  targets='targets'in c?c.targets:'targetId'in c?[c.targetId]:'m5'in c?c.m5?.targetIds??[]:[];willing='willing'in c?c.willing:false
 }else if(action.kind==='map'&&action.command.type==='combat'&&action.command.command.type==='cast'){
  const c=action.command.command;id=r.world.encounters.flatMap(e=>e.actors).find(a=>a.id===c.actorId)?.characterId??c.actorId;key=c.key;mode=c.mode;targets=c.targets;willing=!!c.willing
 }else if(action.kind==='map'&&action.command.type==='explore'&&action.command.command.operation==='spell-cast'){
  const c=action.command.command,t=activeScene(r)?.tokens.find(t=>t.id===c.tokenId);id=t?.characterId??t?.npcId??'';key=c.key;mode=c.mode;targets=c.targets??[];willing=!!c.willing
 }else return
 const a=adventure(r),entity=gEntity(r.world,a,id).entity,cat=catalogue([srd,...r.world.packs]),grant=entity?.c?runtimeSpells(entity.c,cat).find(g=>g.key===key&&g.modes.includes(mode)):undefined,ability=entity?.body?.abilities?.find(v=>v.id===key),spell=grant?.spell??cat.spells.find(s=>s.id===ability?.spellId)
 if(!entity||!spell)return
 const match=spell.castingTime.match(/(\d+)\s*(minute|hour)/i),chain=key.startsWith('chain:')&&mode==='at-will',hours=chain?0:(match?Number(match[1])*(match[2]!.toLowerCase()==='hour'?1:1/60):0)+(mode==='ritual'?1/6:0)
 const needsWilling=willing||['haste','jump','darkvision','fly','spider-climb','water-breathing','gaseous-form','nondetection','arcanist-s-magic-aura','protection-from-evil-and-good'].includes(spell.id)
 return {id:entity.id,key,mode,spell,entity,hours,targets,specialized,needsWilling,source:grant?.source}
}
export function missingConsent(r:Room,i:Intent){
 const c=practicalCast(r,i.action);if(!c?.needsWilling)return []
 const a=adventure(r)
 return c.targets.flatMap(id=>{const target=gEntity(r.world,a,id).entity;if(!target||target.id===c.id)return []
  const proof=r.practicalReview?.consents?.find(s=>s.intentId===i.id&&s.branchId===practicalBranch(r)&&s.targetId===target.id)
  if(proof?.accepted===false)return [{id:target.id,name:target.name,declined:true}]
  if(proof?.accepted&&r.members.some(m=>m.id===proof.memberId&&!m.revoked&&(m.role==='gm'||m.characterIds.includes(target.c?.id??''))))return []
  // An existing GM-recorded willingness is evidence, not a caster's checkbox.
  if(gFact(a,target.id,c.id)?.willing===true)return []
  return [{id:target.id,name:target.name,declined:false}]
 })
}
export function reconcilePracticalCasting(r:Room){
 const a=adventure(r),s=activeScene(r),now=gCurrentHours(r.world,a),cat=catalogue([srd,...r.world.packs])
 for(const p of r.practicalReview?.castings??[]){if(!['casting','completed'].includes(p.status))continue
  const entity=gEntity(r.world,a,p.sourceId).entity,focus=entity?.c?.runtime?.concentration??entity?.body?.concentration,token=entity?.token
  const conditions=entity?.actor?combatStats(entity.actor,r.world.characters,cat).conditions:entity?.c?.runtime?.conditions??entity?.body?.conditions??[]
  if(p.branchId!==practicalBranch(r)||s?.id!==p.sceneId||!entity||entity.dead||!token||token.x!==p.position.x||token.y!==p.position.y||(token.spatial?.height??0)!==p.position.height||focus?.castId!==p.focusId||conditions.includes('incapacitated')||r.world.encounters.some(e=>e.id===s.encounterId&&e.phase==='active')){p.status='interrupted';p.reason='来源、位置、专注或场景变化，连续施法中断；已过游戏时间不退还';if(focus?.castId===p.focusId){if(entity?.c?.runtime)entity.c.runtime.concentration=null;else if(entity?.body)delete entity.body.concentration}}
  else if(!focus.pendingDC&&now+1e-9>=p.startedHour+p.durationHours){p.status='completed';p.reason='实际连续施法时长已完成；原材料及目标仍须复验'}
  const task=r.practicalReview?.tasks.find(t=>t.sourceId===p.intentId&&t.phase==='intent')
  if(task&&p.status==='interrupted')practicalTransition(task,'needs-fact',p.reason,'施法已中断')
  else if(task&&p.status==='completed'&&task.status==='needs-fact')practicalTransition(task,'ready',p.reason,'施法进度已完成，复验目标和材料')
 }
}
export function executePracticalSpellInput(r:Room,m:RoomMember,c:RoomCommand){
 if(c.kind!=='practical-spell-input')return false
 if(!practicalEnabled(r,'spells')||m.revoked)throw new RoomError('实用法术处理未启用或身份无效',403)
 const i=r.intents.find(i=>i.id===c.intentId&&i.status==='pending'),cast=i&&practicalCast(r,i.action)
 if(!i||!cast)throw Error('原施法申请已变化')
 const state=practicalState(r),branch=practicalBranch(r)
 if(c.operation==='consent'||c.operation==='decline'){
  const target=missingConsent(r,i).find(t=>t.id===c.targetId),entity=target&&gEntity(r.world,adventure(r),target.id).entity
  const playerOwner=entity?.c&&r.members.find(member=>member.role==='player'&&!member.revoked&&member.characterIds.includes(entity.c!.id))
  if(!target||!entity||(playerOwner?m.id!==playerOwner.id:m.role!=='gm'&&!m.characterIds.includes(entity.c?.id??'')))throw new RoomError('只能决定本人受术意愿；NPC由GM或已有授权事实决定',403)
  state.consents=state.consents.filter(s=>s.intentId!==i.id||s.targetId!==target.id||s.branchId!==branch)
  if(state.consents.length>=1000)throw Error('同意记录已满')
  state.consents.push({intentId:i.id,branchId:branch,targetId:target.id,memberId:m.id,accepted:c.operation==='consent'})
  return true
 }
 if(m.role!=='gm'&&m.id!==i.sessionId)throw new RoomError('只有原施法者可开始／取消连续施法',403)
 const prior=state.castings.find(p=>p.intentId===i.id&&p.branchId===branch)
 if(c.operation==='cancel-casting'){
  if(!prior||!['casting','completed'].includes(prior.status))throw Error('没有进行中的施法')
  prior.status='canceled';prior.reason='本人明确取消；已过游戏时间保留'
  const focus=cast.entity.c?.runtime?.concentration??cast.entity.body?.concentration
  if(focus?.castId===prior.focusId){if(cast.entity.c?.runtime)cast.entity.c.runtime.concentration=null;else if(cast.entity.body)delete cast.entity.body.concentration}
  return true
 }
 if(prior)throw Error('本次连续施法已登记；中断后请重新申请，不能重置原进度')
 authorizeAction(r,r.members.find(m=>m.id===i.sessionId)!,i.action)
 const a=adventure(r),s=activeScene(r),token=cast.entity.token
 if(!cast.hours||!token||!s||r.world.encounters.some(e=>e.id===s.encounterId&&e.phase==='active')||a.exploration?.status==='active'||cast.entity.dead||cast.entity.state.hp<=0)throw Error('连续施法须在自由探索中由存活来源实际开始')
 if(state.castings.some(p=>p.sourceId===cast.id&&['casting','completed'].includes(p.status)))throw Error('该来源已有连续施法')
 const focusId=crypto.randomUUID()
 if(cast.entity.c?.runtime)cast.entity.c.runtime.concentration={spellId:cast.spell.id,castId:focusId,source:cast.source!,castingKey:cast.key,castingMode:cast.mode,pendingDC:null,endsAt:null}
 else if(cast.entity.body)cast.entity.body.concentration={spellId:cast.spell.id,castId:focusId,encounterId:'outside',clockSourceId:adventure(r).party[0]}
 if(state.castings.length>=200){const index=state.castings.findIndex(p=>!['casting','completed'].includes(p.status));if(index<0)throw Error('施法进度记录已满');state.castings.splice(index,1)}
 state.castings.push({intentId:i.id,branchId:branch,sourceId:cast.id,key:cast.key,mode:cast.mode,sceneId:s.id,startedHour:gCurrentHours(r.world,a),durationHours:cast.hours,status:'casting',focusId,position:{x:token.x,y:token.y,height:token.spatial?.height??0},reason:'连续施法中；使用游戏时钟，不使用网页停留时间'})
 r.worldRevision++
 return true
}
export function assertPracticalCastingFocus(r:Room,m:RoomMember,action:RoomAction){
 if(m.role==='gm')return
 const active=r.practicalReview?.castings?.filter(p=>p.branchId===practicalBranch(r)&&['casting','completed'].includes(p.status)&&r.intents.find(i=>i.id===p.intentId)?.sessionId===m.id)??[]
 for(const p of active){
  const original=r.intents.find(i=>i.id===p.intentId)
  if(original&&JSON.stringify(original.action)===JSON.stringify(action))continue
  if(original&&p.status==='completed'){
   const copy=JSON.parse(JSON.stringify(original.action)) as RoomAction
   applyPracticalConsent(r,original,copy)
   if(JSON.stringify(copy)===JSON.stringify(action))continue
  }
  const entity=gEntity(r.world,adventure(r),p.sourceId).entity
  const ids=[p.sourceId,entity?.c?.id,entity?.token?.id,entity?.actor?.id].filter(Boolean) as string[]
  const cast=practicalCast(r,action)
  const operator=cast?.id??(action.kind==='runtime'||action.kind==='container'?action.characterId:action.kind==='give'?action.fromId:action.kind==='npc'?action.npcId:action.kind==='map'?('characterId'in action.command?action.command.characterId:'tokenId'in action.command?action.command.tokenId:action.command.type==='combat'&&'actorId'in action.command.command?action.command.command.actorId:action.command.type==='explore'&&'tokenId'in action.command.command?action.command.command.tokenId:''):'')
  if(operator&&ids.includes(operator))throw Error('该来源正在连续施法；请先明确取消，不能同时执行其他行动')
 }
}
export function applyPracticalConsent(r:Room,i:Intent,action:RoomAction){
 const cast=practicalCast(r,action)
 if(!practicalEnabled(r,'spells')||!cast?.needsWilling||missingConsent(r,i).length||!r.practicalReview?.tasks.some(t=>t.sourceId===i.id&&t.phase==='intent'))return
 if(action.kind==='spatial'&&action.action.operation==='cast')action.action.willing=true
 if(action.kind==='map'&&action.command.type==='combat'&&action.command.command.type==='cast')action.command.command.willing=true
 if(action.kind==='map'&&action.command.type==='explore'&&action.command.command.operation==='spell-cast')action.command.command.willing=true
}
export function practicalSpellInputView(r:Room,m:RoomMember){
 if(!practicalEnabled(r,'spells')||m.revoked)return []
 return r.intents.filter(i=>i.status==='pending').flatMap(i=>{
  const cast=practicalCast(r,i.action);if(!cast)return []
  const own=m.role==='gm'||i.sessionId===m.id,targets=missingConsent(r,i).filter(t=>{
   const entity=gEntity(r.world,adventure(r),t.id).entity
   if(!entity)return false
   const owner=entity.c&&r.members.find(member=>member.role==='player'&&!member.revoked&&member.characterIds.includes(entity.c!.id))
   return owner?m.id===owner.id:m.role==='gm'||m.characterIds.includes(entity.c?.id??'')
  })
  if(!own&&!targets.length)return []
  const progress=r.practicalReview?.castings?.find(p=>p.intentId===i.id&&p.branchId===practicalBranch(r))
  return [{intentId:i.id,name:cast.spell.name,source:cast.entity.name,targets,canBegin:own&&cast.hours>0&&!progress,canCancel:own&&!!progress&&['casting','completed'].includes(progress.status),remainingMinutes:own&&progress?Math.max(0,(progress.startedHour+progress.durationHours-gCurrentHours(r.world,adventure(r)))*60):undefined,status:own?progress?.status:undefined}]
 })
}
