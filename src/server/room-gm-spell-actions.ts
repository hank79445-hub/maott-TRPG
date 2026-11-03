import {systemMessage} from '../shared/localization/system-messages'
import type {Room,RoomMember,RoomCommand} from '../online/protocol'
import {adventure,RoomError} from './room-engine'
import {catalogue,clone} from '../core/engine'
import {srd} from '../content/srd'
import {gEntity,gClock,saveGFact,validateGWorld} from '../core/gm-spell-world'
import {G_RULES} from '../core/gm-spell-rules'
import {createGmSpellRequest} from '../core/gm-spell-requests'
import {applyGUse,observeGIllusion,refreshGRequest} from '../core/gm-spell-actions'
import {m3Caster} from '../core/m3-world-cast'
import {m3ActionCost} from '../core/m3-world-actions'
import {consumeNpcAbility} from '../core/npc-abilities'
import {applyRuntime} from '../core/runtime'
import {appendBroadcast} from '../core/broadcast'
import {silenced} from '../core/scene-magic'
export function executeGSpellAction(room:Room,member:RoomMember,c:RoomCommand){
 if(!['spell-gm-fact','spell-gm-refresh','spell-gm-observe','spell-gm-use','spell-gm-npc-cast'].includes(c.kind))return false
 if(member.revoked)throw new RoomError('操控权限已撤销',403)
 const a=adventure(room),cat=catalogue([srd,...room.world.packs]),gm=member.role==='gm'
 if(c.kind==='spell-gm-fact'){if(!gm)throw new RoomError('规则事实仅由GM登记',403);saveGFact(room.world,a,c.fact)}
 else if(c.kind==='spell-gm-npc-cast'){
  if(!gm)throw new RoomError('普通NPC施法须GM接管',403)
  const source=m3Caster(room.world,a,c.npcId,cat),scene=a.scenes.find(s=>s.id===a.activeSceneId),ability=source.body?.abilities?.find(b=>b.id===c.abilityId),spell=cat.spells.find(s=>s.id===ability?.spellId)
  if(source.c||!source.body||!ability||!spell||!G_RULES[spell.id]||!scene?.tokens.includes(source.token!))throw Error('须使用本场景普通NPC实际配置的G类施法能力')
  if((ability.slotLevel??spell.level)<spell.level)throw Error('实际NPC施法环位低于法术最低环级')
  if(room.world.encounters.some(e=>e.id===scene.encounterId&&e.phase==='active'))throw Error('战斗中请使用NPC能力原结算与反制窗口')
  if(silenced(room.world,a,scene,source.token!)&&/(^|[,\s])V([,\s(]|$)/.test(spell.components))throw Error('沉默中不能使用言语成分')
  validateGWorld(room.world,a,cat,spell.id,source.id,c.targetIds,c.choice)
  const long=spell.castingTime.match(/(\d+)\s*(minute|hour)/i)
  if(long){if(a.exploration&&a.exploration.status!=='closed')throw Error('请先收尾探索轮，再确认连续长施法完成');const hours=+long[1]!*(long[2]!.toLowerCase()==='hour'?1:1/60);for(const pc of room.world.characters.filter(pc=>a.party.includes(pc.id)&&pc.runtime))room.world.characters[room.world.characters.indexOf(pc)]=applyRuntime(pc,cat,{type:'time',hours})}
  if(ability.cost!=='none')m3ActionCost(room.world,a,source.id,ability.cost,cat,true)
  consumeNpcAbility(gEntity(room.world,a,source.id).entity!.body!,ability.id)
  const live=gEntity(room.world,a,source.id).entity!,clock=gClock(room.world,a,source.id),duration=spell.duration.match(/(\d+)\s*(minute|hour|day)/i)
  if(spell.concentration)live.body!.concentration={spellId:spell.id,castId:crypto.randomUUID(),clockSourceId:clock.id,endsAt:duration?clock.hours+Number(duration[1])*(duration[2]!.toLowerCase()==='day'?24:duration[2]!.toLowerCase()==='hour'?1:1/60):undefined,encounterId:'outside'}
  createGmSpellRequest(room.world,a,cat,{spell,characterId:source.id,sceneId:scene.id,targetIds:c.targetIds,choice:c.choice,slotLevel:ability.slotLevel??spell.level,question:c.note,dc:live.body!.spellcasting?.dc??8+2+Math.floor(((live.body!.scores[ability.ability??'wis'])-10)/2)})
 }else if('requestId'in c){
  const r=a.gmSpellRequests?.find(r=>r.id===c.requestId);if(!r)throw Error('实际法术实例不存在')
  if(c.kind==='spell-gm-refresh'){if(!gm)throw new RoomError('相关条件复核只能由GM确认',403);refreshGRequest(room.world,a,r,cat)}
  else if(c.kind==='spell-gm-observe'){const observer=gEntity(room.world,a,c.observerId).entity;if(!gm&&r.result?.audience.kind!=='public'&&!r.result?.audience.characterIds.some(id=>member.characterIds.includes(id)))throw new RoomError('不能研究尚未向本人公开的幻象实例',403);if(!gm&&(!observer?.c||!member.characterIds.includes(observer.c.id)||c.method!=='study'))throw new RoomError('只能研究自己所见的幻象；接触／GM确认另由GM核实',403);observeGIllusion(room.world,a,r,cat,c.observerId,c.method,c.note)}
  else if(c.kind==='spell-gm-use'){
   const actor=gEntity(room.world,a,c.action.actorId).entity
   if(!gm&&(!actor?.c||!member.characterIds.includes(actor.c.id)))throw new RoomError('未获实际操作者权限',403)
   if(!gm&&c.action.operation==='communicate')throw new RoomError('信息内容须GM按可感知事实裁定',403)
   const text=applyGUse(room.world,a,r,cat,c.action)
   if(text.trim()&&(gm||c.action.operation==='reply'))appendBroadcast(a,c.action.receipt,{message:systemMessage('spell.gm-followup',{spell:r.name}),category:'resolution',type:'spell.gm-followup',title:r.name+' · 持续操作',text,narration:'context',audience:{kind:'personal',characterIds:[r.characterId,...(c.action.operation==='reply'?[c.action.actorId]:[])]},sceneId:r.sceneId,facts:{spellId:r.spellId,requestId:r.id}})
  }
 }
 room.worldRevision++;return true
}
