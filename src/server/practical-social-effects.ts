import type {NpcConversation,NpcProfile} from '../core/ai-types'
import type {Room,RoomMember} from '../online/protocol'
import type {SocialDecision} from '../persistence/practical-social-schema'
import {activeScene,adventure,executeAction} from './room-engine'
import {practicalSpatialAllowed} from './practical-spatial'
import {proposeSpatial} from './npc-spatial'
import {npcSpatialObservation} from './npc-spatial-observation'
import {offerPracticalTrade} from './practical-trade'
import {clone} from '../core/engine'
type Consequence=NonNullable<SocialDecision['rule']>['success']
/** Validate both branches before rolling; policy IDs are capabilities, never model-made commands. */
export function validateSocialEffects(r:Room,n:NpcProfile,value:Consequence){
 const a=adventure(r),s=activeScene(r)
 for(const id of value.revealIds)if(!n.secrets.some(s=>s.id===id)||!n.allowed.includes('reveal'))throw Error('约定线索不存在或NPC未授权披露')
 if(value.promise&&!n.allowed.includes('promise'))throw Error('NPC未开放承诺行为')
 for(const op of value.operations??[]){
  if(op.kind==='follow'&&(n.npcType!=='important'||n.importanceRole!=='companion'||!n.allowed.includes('move')))throw Error('随队后果须为可随队重要NPC，并保留原移动权限')
  if(op.kind==='interaction'&&!practicalSpatialAllowed(r,n,{kind:'interact',pointId:op.pointId,operation:op.operation,confirmItemCosts:true}))throw Error('具体互动未在本NPC对象、操作和费用授权内')
  if(op.kind==='battle-support'){const p=a.battles?.presets.find(p=>p.id===op.presetId&&p.sceneId===s?.id);if(!p?.practical?.enabled||!p.participants.some(p=>p.kind==='npc'&&p.id===n.id)||!n.allowed.includes('attack'))throw Error('战斗支援须引用已授权且包含本NPC的当前场景预设')}
  if(op.kind==='trade-offer'&&(!n.allowed.includes('trade')||!n.merchantPolicy?.practical?.enabled||!n.stock.some(row=>row.itemId===op.itemId&&row.quantity>=op.quantity)))throw Error('约定交易缺少实际库存或商店授权')
 }
}
export function applySocialEffects(r:Room,gm:RoomMember,j:NpcConversation,profile:NpcProfile,value:Consequence){
 validateSocialEffects(r,profile,value)
 for(const op of value.operations??[]){
  const n=adventure(r).ai!.npcs.find(n=>n.id===profile.id)!
  if(op.kind==='follow')executeAction(r,gm,{kind:'map',command:{type:'npc-profile',profile:{...clone(n),followParty:op.join}}},true)
  if(op.kind==='interaction'){const task=proposeSpatial(r,n,npcSpatialObservation(r,n).version,j.id+':social-interaction',{kind:'interact',pointId:op.pointId,operation:op.operation,confirmItemCosts:true});if(!task.approved)throw Error('互动授权发生变化，不重复申请或消耗')}
  if(op.kind==='battle-support')executeAction(r,gm,{kind:'map',command:{type:'battle-request',sceneId:n.sceneId,name:n.name+'：约定战斗支援',reason:'已确认交涉后果；名单与阵营沿用预设',source:'npc',sourceId:j.id,characterId:j.characterId,presetId:op.presetId}},true)
  if(op.kind==='trade-offer')offerPracticalTrade(r,j,{kind:'trade',itemId:op.itemId,quantity:op.quantity})
 }
}
