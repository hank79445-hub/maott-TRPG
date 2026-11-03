import {systemMessage} from '../shared/localization/system-messages'
import {tokenPerception} from '../core/m3-map-perception'
import {catalogue,clone} from '../core/engine'
import {srd} from '../content/srd'
import type {Room,RoomCommand,RoomMember} from '../online/protocol'
import {adventure,RoomError} from './room-engine'
import {adoptSummon,endSummon,reconcileSummons,summonTokenKey} from '../core/summon-world'
import {gEntity} from '../core/gm-spell-world'
import type {SummonAction} from '../persistence/summon-action-schema'
import {applySummonAction} from '../core/summon-actions'
import {runtimeSpells} from '../core/runtime'
import {S_SPELL_IDS,S_RULES,type SummonSpell} from '../core/summon-rules'
import {appendBroadcast,gmAudience} from '../core/broadcast'
import {gCurrentHours} from '../core/gm-spell-world'
import {m1Entity} from '../core/m1-utility'
import {distance} from '../core/map'
import {combatStats,freshTurn} from '../core/combat-rules'
export function summonObservers(room:Room,member:RoomMember){
 const a=adventure(room),s=a.scenes.find(s=>s.id===a.activeSceneId),cat=catalogue([srd,...room.world.packs]);if(!s)return []
 return s.tokens.filter(t=>member.characterIds.includes(t.characterId??'')||member.actorIds.includes(t.actorId??'')).flatMap(t=>{
  const i=a.summons?.instances.find(i=>i.spellId==='find-familiar'&&i.state==='present'&&i.senses?.sourceId===t.characterId&&i.senses.endsAt>gCurrentHours(room.world,a)),f=i&&s.tokens.find(t=>t.id===i.id)
  if(!i||!f)return [t]
  const entity=m1Entity(room.world,a,i.id),e=room.world.encounters.find(e=>e.id===i.senses!.encounterId),valid=(!e||e.tick<(i.senses!.expiresTick??0))&&entity?.body&&!combatStats(entity.actor??{id:i.id,characterId:null,npc:entity.body,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},room.world.characters,cat).conditions.includes('incapacitated')&&distance(s,t,f)<=100
  return valid?[f]:[t]
 })
}
export interface SummonView{card?:import('../core/combat-types').CombatNpc;id:string;name:string;kind:string;state:string;control:string;controlled:boolean;sourceName?:string;sourceId?:string;spellId?:string;form?:string;hp?:number;maxHp?:number;temporaryHp?:number;sceneId?:string;position?:{x:number;y:number;height:number;span?:number};castId?:string;existenceEndsAt?:number|null;controlEndsAt?:number|null;riderId?:string;task?:string;rideable?:boolean;generatedGear?:{id:string;name:string;enabled:boolean}[]}
export function authorizeSummonAction(room:Room,member:RoomMember,c:SummonAction){
 if(member.role==='gm')return
 if(member.revoked||member.role!=='player')throw new RoomError('只有有效玩家可申请本人召唤物操作',403)
 if(c.operation==='event'||c.operation==='resolve-cast'||c.operation==='attach'||c.operation==='remains'||c.operation==='steed-rest'||c.operation==='force-damage'||c.operation==='phase')throw new RoomError('实际后果及创建确认由GM处理',403)
 const a=adventure(room),ids=c.operation==='cast'||c.operation==='command'?[c.sourceId]:[a.summons?.instances.find(i=>i.id===c.instanceId)?.controllerId]
 const riding=c.operation==='mount'&&member.characterIds.includes(c.riderId)&&!!a.summons?.instances.some(i=>i.id===c.instanceId&&i.control==='controlled'&&(['present','fading'].includes(i.state))&&(c.mount?i.spellId==='find-steed'||[i.designatedRiderId,i.sourceEntityId].includes(c.riderId):i.riderId===c.riderId))||c.operation==='move'&&!!a.summons?.instances.some(i=>i.id===c.instanceId&&i.riderId&&member.characterIds.includes(i.riderId)&&i.state==='present')
 if(!riding&&ids.some(id=>!id||!member.characterIds.includes(id)))throw new RoomError('只能申请本人的实际来源或受控实例',403)
 if(c.operation==='cast'){
  const source=room.world.characters.find(ch=>ch.id===c.sourceId),grant=source&&runtimeSpells(source,catalogue([srd,...room.world.packs])).find(g=>g.key===c.key&&g.modes.includes(c.mode))
  if(!grant||(S_SPELL_IDS as readonly string[]).includes(grant.spell.id)===false)throw new RoomError('没有实际召唤法术来源',403)
 }
 if('targetId'in c&&c.targetId){const s=a.scenes.find(s=>s.id===a.activeSceneId),t=s?.tokens.find(t=>[t.id,t.characterId,t.actorId,t.npcId].includes(c.targetId));if(!s||!t||t.hidden)throw new RoomError('只能申请已公开的实际目标',403)}
 if(c.operation==='command')for(const id of c.instanceIds)assertSummonControl(room,member,id)
 if(c.operation==='mount'&&!member.characterIds.includes(c.riderId))throw new RoomError('只能申请本人角色上下马',403)
}
export function executeSummonAction(room:Room,c:SummonAction){
 const a=adventure(room),result=applySummonAction(room.world,a.id,c,catalogue([srd,...room.world.packs]))
 room.world=result.world;room.worldRevision++
 appendBroadcast(adventure(room),crypto.randomUUID(),{message:systemMessage('audit.summon'),category:'resolution',type:'spell.summon-result',title:'召唤与伙伴',text:result.detail,narration:'context',audience:gmAudience(),sceneId:a.activeSceneId})
}
export function summonChoices(room:Room,member:RoomMember){
 if(member.revoked)return []
 const a=adventure(room),cat=catalogue([srd,...room.world.packs]),ids=member.role==='gm'?[...a.party,...(a.ai?.npcs.map(n=>n.characterId??n.id)??[])]:member.characterIds
 return [...new Set(ids)].flatMap(id=>{const v=gEntity(room.world,a,id).entity;if(!v||v.dead)return [];const pc=v.c?runtimeSpells(v.c,cat).filter(g=>(S_SPELL_IDS as readonly string[]).includes(g.spell.id)).flatMap(g=>g.modes.map(mode=>({key:g.key,mode,spell:g.spell}))):v.body?.abilities?.filter(b=>b.spellId&&(S_SPELL_IDS as readonly string[]).includes(b.spellId)).flatMap(b=>{const spell=cat.spells.find(s=>s.id===b.spellId);return spell?[{key:b.id,mode:'npc',spell}]:[]})??[]
 return pc.map(g=>({sourceId:v.id,sourceName:v.name,key:g.key,mode:g.mode,spellId:g.spell.id,name:g.spell.name,castingTime:g.spell.castingTime,forms:S_RULES[g.spell.id as SummonSpell].forms,material:S_RULES[g.spell.id as SummonSpell].material,materials:(a.gmSpellFacts??[]).filter(f=>f.kind==='material'&&(f.inventoryOwnerId===v.id||a.m3?.entities.some(o=>o.id===f.entityId&&o.enabled&&o.boundCharacterId===v.id))).map(f=>({id:f.entityId,name:f.material??'已登记材料'}))}))})
}
export function summonTouchChoices(room:Room,member:RoomMember){
 if(member.revoked)return []
 const a=adventure(room),cat=catalogue([srd,...room.world.packs]),ids=member.role==='gm'?room.world.characters.map(c=>c.id):member.characterIds
 return [...new Set([...ids,...(member.role==='gm'?(a.ai?.npcs.map(n=>n.characterId??n.id)??[]):[])])].flatMap(id=>{const v=m1Entity(room.world,a,id);if(v?.c)return runtimeSpells(v.c,cat).filter(g=>g.spell.range==='Touch').map(g=>({sourceId:v.id,key:g.key,spellId:g.spell.id,name:g.spell.name,modes:g.modes}));return v?.body?.abilities?.filter(b=>b.support!=='unsupported').flatMap(b=>{const spell=cat.spells.find(s=>s.id===b.spellId);return spell?.range==='Touch'?[{sourceId:v.id,key:b.id,spellId:spell.id,name:spell.name,modes:['npc']}]:[]})??[]})
}
export function summonCorpses(room:Room,member:RoomMember){
 if(member.revoked)return []
 const a=adventure(room),s=a.scenes.find(s=>s.id===a.activeSceneId),cat=catalogue([srd,...room.world.packs]),observers=summonObservers(room,member)
 return (a.m1Utility?.corpses??[]).flatMap(c=>{const r=a.summons?.remains?.find(r=>r.corpseId===c.id),entity=m1Entity(room.world,a,c.entityId),t=entity?.token
 if(!r||!c.dead||!c.bodyViable||a.summons?.instances.some(i=>i.corpseId===c.id)||!s||c.sceneId!==s.id||!t||member.role!=='gm'&&(t.hidden||!observers.some(from=>tokenPerception(room.world,a,s,from,t,cat).canPerceive)))return []
 return [{id:c.id,name:entity?.name??'已确认遗骸',form:r.form,x:t.x,y:t.y}]
 })
}
export function assertSummonControl(room:Room,member:RoomMember,actorOrTokenId:string){
 if(member.role==='gm')return
 const a=adventure(room),token=a.scenes.flatMap(s=>s.tokens).find(t=>t.id===actorOrTokenId),i=a.summons?.instances.find(i=>i.id===actorOrTokenId||token?.companionKey===summonTokenKey(i.id)||i.actorRefs.some(r=>r.actorId===actorOrTokenId))
 if(a.summons?.migrationIssues.some(issue=>issue.actorId===actorOrTokenId||issue.actorId===token?.actorId))throw new RoomError('旧召唤伙伴尚待GM核对原施放，暂不授予自动操控',403)
 if(!i)return
 if(i.state!=='present'||i.control!=='controlled'||!i.controllerId||!member.characterIds.includes(i.controllerId))throw new RoomError('该召唤实例未授予当前身份操控，或控制已经结束',403)
}
export function executeSummonCommand(room:Room,member:RoomMember,c:RoomCommand){
 if(c.kind==='summon-action'){if(member.role!=='gm'||member.revoked)throw new RoomError('请先向GM提交召唤操作意图',403);executeSummonAction(room,c.action);return true}
 if(c.kind!=='summon-adopt'&&c.kind!=='summon-lifecycle'&&c.kind!=='summon-cancel-creation')return false
 if(member.role!=='gm')throw new RoomError('采用旧实例与生命周期接管仅限GM',403)
 const a=adventure(room)
 if(c.kind==='summon-cancel-creation'){const d=a.summons?.drafts.find(d=>d.id===c.draftId);if(!d||d.status!=='pending')throw Error('待创建记录不存在或已处理');d.status='canceled';d.note+='；'+c.note;const source=gEntity(room.world,a,d.sourceEntityId).entity,conc=source?.c?.runtime?.concentration??source?.body?.concentration;if(conc?.castId===d.castId){if(source?.c)source.c.runtime!.concentration=null;else if(source?.body)delete source.body.concentration}}
 else if(c.kind==='summon-adopt')adoptSummon(room.world,a,c.encounterId,c.actorId,c.note,true,c.originalEndsAt)
 else{
  const i=a.summons?.instances.find(i=>i.id===c.instanceId);if(!i)throw Error('稳定召唤实例不存在')
  if(i.receipts.some(r=>r.id===c.receipt))throw Error('该次实例操作已经处理')
  if(i.receipts.length>=2000)throw Error('实例操作记录达到上限')
  if(c.operation==='release'){i.control='released';i.controllerId=null;i.note=c.note}
  else endSummon(room.world,a,i,c.note)
  i.receipts.push({id:c.receipt,operation:c.operation})
 }
 reconcileSummons(room.world);room.worldRevision++;return true
}
/** No hidden template, material proof, original source secret or full NPC card is a public projection. */
export function projectSummons(room:Room,member:RoomMember):SummonView[]{
 if(member.role!=='gm'&&member.revoked)return []
 const a=adventure(room),gm=member.role==='gm',cat=catalogue([srd,...room.world.packs]),s=a.scenes.find(s=>s.id===a.activeSceneId)
 return (a.summons?.instances??[]).flatMap(i=>{
  const rideable=['find-steed','phantom-steed'].includes(i.spellId)&&(i.spellId==='find-steed'||member.characterIds.includes(i.designatedRiderId??i.sourceEntityId)||member.characterIds.includes(i.riderId??'')),known=member.characterIds.includes(i.sourceEntityId),own=i.control==='controlled'&&!!i.controllerId&&member.characterIds.includes(i.controllerId),visible=i.state==='present'&&s?.tokens.some(t=>t.companionKey===summonTokenKey(i.id)&&!t.hidden&&s.tokens.some(from=>(member.characterIds.includes(from.characterId??'')||member.actorIds.includes(from.actorId??''))&&tokenPerception(room.world,a,s,from,t,cat).canPerceive))
  if(!gm&&!own&&!known&&!visible)return []
  const source=gEntity(room.world,a,i.sourceEntityId).entity
  return [{id:i.id,name:i.body?.name??'无形力量',kind:i.kind,state:i.state,control:i.control,rideable,...(rideable?{spellId:i.spellId,form:i.form,riderId:i.riderId}:{}),controlled:i.control==='controlled'&&['present','pocket','fading'].includes(i.state)&&(gm||!!i.controllerId&&member.characterIds.includes(i.controllerId)),...((gm||own)?{card:i.body?clone(i.body):undefined,sourceName:source?.name,sourceId:i.sourceEntityId,spellId:i.spellId,form:i.form,hp:i.body?.hp??i.forceState?.hp,maxHp:i.body?.maxHp??i.forceState?.maxHp,temporaryHp:i.body?.temporaryHp,sceneId:i.position?.sceneId,position:i.position?{x:i.position.x,y:i.position.y,height:i.position.spatial.height,span:i.position.span}:undefined,castId:i.castId,existenceEndsAt:i.existenceEndsAt,controlEndsAt:i.controlEndsAt,riderId:i.riderId,task:i.task?.text,generatedGear:i.generatedItemIds.flatMap(id=>{const o=a.m3?.entities.find(o=>o.id===id);return o?[{id:o.id,name:o.name,enabled:o.enabled}]:[]})}:{})}]
 })
}
