import {systemMessage} from '../shared/localization/system-messages'
import type {Room,RoomCommand,RoomMember} from '../online/protocol'
import {applyM1Action,m1Entity,M1_UTILITY_SPELLS} from '../core/m1-utility'
import {catalogue} from '../core/engine'
import {srd} from '../content/srd'
import {appendBroadcast,gmAudience,publicAudience} from '../core/broadcast'
import {adventure,RoomError,forgetUndo} from './room-engine'
import {runtimeSpells} from '../core/runtime'
import {fogEntityAllowed} from './fog'
import {tokenPerception} from '../core/m3-map-perception'
import {practicalEnabled} from './practical-review-state'
export function practicalM1Choices(room:Room,member:RoomMember){
 if(member.revoked)return []
 const a=adventure(room),s=a.scenes.find(s=>s.id===a.activeSceneId),cat=catalogue([srd,...room.world.packs]);if(!s)return []
 return room.world.characters.filter(c=>member.role==='gm'||member.characterIds.includes(c.id)).flatMap(c=>{
  const from=s.tokens.find(t=>t.characterId===c.id&&!t.hidden);if(!from)return []
  const grants=runtimeSpells(c,cat).filter(g=>M1_UTILITY_SPELLS.includes(g.spell.id));if(!grants.length)return []
  const seen=(token:import('../core/map-types').MapToken)=>member.role==='gm'||!token.hidden&&tokenPerception(room.world,a,s,from,token,cat).canPerceive
  const targets:{id:string;name:string;position?:{sceneId:string;x:number;y:number;hitId?:string}}[]=[...s.tokens,...s.defeatedTokens??[]].filter(seen).map(t=>{const entity=m1Entity(room.world,a,t.characterId??t.npcId??t.actorId??t.id);return {id:entity?.id??t.id,name:entity?.name??t.name,position:{sceneId:s.id,x:t.x,y:t.y,hitId:t.id}}})
  for(const corpse of a.m1Utility?.corpses??[]){const entity=m1Entity(room.world,a,corpse.entityId);if(corpse.dead&&corpse.sceneId===s.id&&entity?.token&&seen(entity.token))targets.push({id:corpse.id,name:entity.name+'（遗体）',position:{sceneId:s.id,x:entity.token.x,y:entity.token.y,hitId:entity.token.id}})}
  for(const object of a.m1Utility?.objects??[])if(object.sceneId===s.id&&(member.role==='gm'||member.characterIds.includes(object.boundCharacterId??'')||a.m3?.entities.some(o=>o.id===object.id&&o.enabled&&!o.hidden))){const carrier=object.boundCharacterId?s.tokens.find(t=>t.characterId===object.boundCharacterId):undefined,at=carrier??{x:object.x,y:object.y,span:1,characterId:null,actorId:null,id:object.id,name:object.name,hidden:false,color:'#000',facing:0};targets.push({id:object.id,name:object.name,...((member.role==='gm'||carrier&&!carrier.hidden&&seen(carrier)&&fogEntityAllowed(room,member,s.id,carrier))?{position:{sceneId:s.id,x:at.x,y:at.y,hitId:carrier?.id}}:{})})}
  return [{sourceId:c.id,name:c.build.name,grants:grants.map(g=>({key:g.key,name:g.spell.name,spellId:g.spell.id,modes:g.modes})),targets:[...new Map(targets.map(t=>[t.id,t])).values()],materials:(a.m1Utility?.materials??[]).filter(m=>m.characterId===c.id&&c.inventory.some(row=>row.instanceId===m.instanceId&&row.quantity>0)).map(m=>({id:m.instanceId,name:m.kind+' · '+m.valueGP+'GP'}))}]
 })
}
export function authorizeM1(room:Room,member:RoomMember,action:import('../persistence/m1-utility-schema').M1Action){
 if(member.revoked)throw new RoomError('身份已撤销',403)
 if(member.role==='gm')return
 if(!['cast','pulse'].includes(action.operation)||!('characterId'in action)||!member.characterIds.includes(action.characterId))throw new RoomError('仅可申请本人施法，事实登记仍由GM处理',403)
 const a=adventure(room),scene=a.scenes.find(s=>s.id===a.activeSceneId),source=m1Entity(room.world,a,action.characterId),target=m1Entity(room.world,a,'targetId'in action?action.targetId:'')
 const corpse='targetId'in action?a.m1Utility?.corpses.find(c=>c.id===action.targetId&&c.dead):undefined,corpseEntity=corpse&&m1Entity(room.world,a,corpse.entityId),object='targetId'in action?a.m1Utility?.objects.find(o=>o.id===action.targetId&&o.sceneId===scene?.id):undefined
 if(!source?.token||!scene?.tokens.includes(source.token)||!target?.token&&!corpseEntity?.token&&!object||target?.token?.hidden||corpseEntity?.token?.hidden)throw new RoomError('只能申请当前已公开的实际目标',403)
 const token=target?.token??corpseEntity?.token
 if(token&&(![...scene.tokens,...scene.defeatedTokens??[]].includes(token)||!tokenPerception(room.world,a,scene,source.token,token,catalogue([srd,...room.world.packs])).canPerceive))throw new RoomError('不能申请当前未感知的实际目标',403)
 if(object&&!member.characterIds.includes(object.boundCharacterId??'')&&!a.m3?.entities.some(o=>o.id===object.id&&o.enabled&&!o.hidden))throw new RoomError('该物件尚未向本人公开',403)
}
export function executeM1Utility(room:Room,member:RoomMember,command:RoomCommand){
 if(command.kind!=='m1-utility')return false
 if(member.role!=='gm'||member.revoked)throw new RoomError('M1专用结算及材料核验仅限有效GM',403)
 const a=adventure(room),action=command.action
 const caster='characterId'in action?m1Entity(room.world,a,action.characterId):undefined
 const targetId='targetId'in action?(a.m1Utility?.corpses.find(c=>c.id===action.targetId)?.entityId??action.targetId):undefined
 const target=targetId?m1Entity(room.world,a,targetId):undefined
 const battle=a.scenes.find(s=>s.id===a.activeSceneId)?.encounterId
 const prepare=action.operation==='cast'&&room.world.encounters.some(e=>e.id===battle&&e.phase==='active')
 const result=applyM1Action(room.world,a.id,action,catalogue([srd,...room.world.packs]),undefined,prepare?'prepare':'commit')
 room.world=result.world;forgetUndo(room.world);room.worldRevision++
 const publicResult=['cast','pulse'].includes(action.operation)&&!!caster?.token&&!caster.token.hidden&&!!target?.token&&!target.token.hidden
 appendBroadcast(adventure(room),crypto.randomUUID(),{message:systemMessage(publicResult?'spell.utility-result':'audit.utility'),category:'resolution',type:'spell.m1-result',
  title:publicResult?'法术结果':'GM法术记录',text:(publicResult?`${caster!.name} → ${target!.name}：`:'')+result.detail,narration:'context',
  audience:publicResult?publicAudience():gmAudience(),sceneId:a.activeSceneId,
  facts:{operation:action.operation,...(caster?{characterId:caster.id}:{}),...(target?{targetId:target.id,...(target.n?{npcId:target.n.id}:{})}:{})}})
 return true
}
