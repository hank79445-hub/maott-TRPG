import { soundBetween,hearsSound } from '../core/scene-magic'
import { tokenPoint } from '../core/scene-effects'
import type { Room } from '../online/protocol'
import type { NpcProfile } from '../core/ai-types'
import {appliedEffects} from '../core/effects'
import {charmEffective} from '../core/m2-social-controls'
import type { ActiveEffect } from '../core/types'
import {gCurrentHours} from '../core/gm-spell-world'
import {resolveNpcRelationship} from '../core/npc-relationships'

function effectActive(room: Room, effect: ActiveEffect, hours: number) {
  const g=room.world.adventures.find(a=>a.gmSpellRequests?.some(r=>r.castId===effect.castId))
  if(g&&effect.endsAt!==undefined&&effect.endsAt<=gCurrentHours(room.world,g))return false
  const clock = room.world.characters.find((c) => c.id === effect.clockSourceId)?.runtime?.hours
  if (effect.endsAt !== undefined && effect.endsAt <= (clock ?? hours)) return false
  const encounter = room.world.encounters.find((e) => e.id === effect.encounterId)
  return !(
    encounter?.phase === 'active' &&
    effect.expiresAt !== null &&
    (effect.expiresAt < encounter.tick ||
      (effect.expiresAt === encounter.tick && effect.phase === 'start'))
  )
}

/** The GM profile and live server effects are the only communication authorities. */
export function npcCommunication(room: Room, n: NpcProfile, characterId: string) {
  const actors = room.world.encounters.flatMap((e) => e.actors)
  const body = actors.find((a) => a.id === n.actorId)?.npc ?? n.body
  const speaker = room.world.characters.find((c) => c.id === characterId)
  const tongues=!![...(speaker?.runtime?.effects??[]),...(body?.effects??[])].some(f=>f.key==='tongues'&&effectActive(room,f,speaker?.runtime?.hours??0))
  const animalCommunication = !!speaker?.runtime?.effects?.some(
    (effect) =>
      effect.key === 'speak-with-animals' &&
      effectActive(room, effect, speaker.runtime?.hours ?? 0),
  )
  const adventure=room.world.adventures.find(a=>a.ai?.npcs.some(v=>v.id===n.id)),scene=adventure?.scenes.find(s=>s.id===adventure.activeSceneId),from=scene?.tokens.find(t=>t.characterId===characterId),to=scene?.tokens.find(t=>t.npcId===n.id||!!n.actorId&&t.actorId===n.actorId||!!n.characterId&&t.characterId===n.characterId)
  const audible=!(adventure&&scene&&from&&to)||hearsSound(room.world,adventure!,from!)&&hearsSound(room.world,adventure!,to!)&&soundBetween(room.world,adventure!,scene!,tokenPoint(from!),tokenPoint(to!))
  const basis =
    n.communication === 'nonverbal'
      ? 'nonverbal'
      : n.communication === 'speaking'
        ? 'gm-confirmed'
        : body?.creatureType !== 'beast'
          ? 'compatible-default'
          : animalCommunication||tongues&&!!body?.templateMetadata?.languages.length
            ? 'speak-with-animals'
            : 'unavailable'
  return {
    spoken: audible && basis !== 'unavailable' && basis !== 'nonverbal',
    basis,
    animalCommunication,
    creatureType: body?.creatureType,
  }
}

export const npcCommunicationLimits =
  '语言资格只由GM配置及当前有效法术决定，模型自称会说话不构成授权。动物交谈不提高智力，不改变知识、态度或服从，只能交流该野兽亲历或已获准知道的事实；所有适用影响技能仍由GM裁定。缺少知识时拒答或仅描述已知感官经历，不编造抽象知识、秘密或共同语言。魅惑或友好只按规则影响交涉，不授权交易、泄密、招募、任务完成或任意服从。'

/** Convey playable understanding/attitude without exposing hidden spell IDs, caster or duration. */
export function npcSocialModelContext(room: Room, n: NpcProfile, characterId: string) {
  const social = npcSocialContext(room, n, characterId)
  return {
    attitude: social.attitude,
    relationship: {band:social.relationship.band, constraint:'仅用于当前对象的态度演绎；不是目击事实，不提供组织归属、交易、泄密或行动授权。'},
    creatureType: social.creatureType,
    confirmedSpellInformation:room.world.adventures.flatMap(a=>(a.gmSpellRequests??[]).filter(r=>r.status==='published'&&r.result&&(r.result.audience.kind==='public'&&a.broadcastLog?.events.find(e=>e.id===r.result!.eventId)?.perceivedBy?.some(id=>id===n.id||id===n.characterId)||r.result.audience.kind==='personal'&&r.result.audience.characterIds.some(id=>id===n.id||id===n.characterId))).slice(-10).map(r=>({spell:r.name,text:r.result!.text}))),
    confirmedSpellReplies:room.world.adventures.flatMap(a=>(a.broadcastLog?.events??[]).filter(e=>e.type==='spell.gm-followup'&&e.audience.kind==='personal'&&e.audience.characterIds.some(id=>id===n.id||id===n.characterId)).slice(-10).map(e=>({title:e.title,text:e.text}))),
    recognizedIllusions:room.world.adventures.flatMap(a=>(a.gmSpellRequests??[]).flatMap(r=>(r.observations??[]).filter(o=>o.recognized&&(o.observerId===n.id||o.observerId===n.characterId)).map(o=>({spell:r.name,fact:'你曾识破这一幻象，但不因此获得施法者身份或其他秘密'})))),
    communication: { spoken: social.communication.spoken },
    limits: social.limits,
  }
}

export function npcSocialContext(room: Room, n: NpcProfile, characterId: string) {
  const appearance=room.world.characters.find(c=>c.id===characterId)?.runtime
  const recognized=!appearance?.wildShape&&!appearance?.effects?.some(e=>/disguise-self|alter-self|polymorph/.test(e.key))
  const relationship=resolveNpcRelationship(room.world.adventures[0]?.ai,n,characterId,recognized)
  const actors = room.world.encounters.flatMap((e) => e.actors),
    c = room.world.characters.find((c) => c.id === characterId),
    own = room.world.characters.find((c) => c.id === n.characterId),
    actor = actors.find((a) => a.id === n.actorId),
    body = actor?.npc ?? n.body
  const effects = own?.runtime?.effects ?? body?.effects ?? []
  const active=appliedEffects(effects.filter(f=>effectActive(room,f,own?.runtime?.hours??c?.runtime?.hours??0)))
  const indifferent=active.some(f=>f.key==='calm-emotions'&&f.supportChoice==='indifferent'&&f.control?.targets.some(id=>id===characterId||actors.some(a=>a.id===id&&a.characterId===characterId)||room.world.adventures.some(a=>a.scenes.some(s=>s.tokens.some(t=>t.id===id&&t.characterId===characterId)))))
  const sourced = (charmEffective(active)?active:[]).filter(
    (f) =>
      f.condition === 'charmed' &&
      effectActive(room, f, own?.runtime?.hours ?? c?.runtime?.hours ?? 0) &&
      (f.sourceId === characterId ||
        actors.some((a) => a.id === f.sourceId && a.characterId === characterId)),
  )
  const friendly = sourced.some((f) => f.key === 'charm-person')
  const communication = npcCommunication(room, n, characterId)
  const speakerIds=new Set([characterId,...actors.filter(a=>a.characterId===characterId).map(a=>a.id),...room.world.adventures.flatMap(a=>a.scenes.flatMap(s=>s.tokens.filter(t=>t.characterId===characterId).map(t=>t.id)))])
  const truth=active.filter(f=>f.key==='zone-of-truth-source').flatMap(f=>f.control?.trials??[]).find(r=>speakerIds.has(r.targetId))
  return {
    attitude: indifferent?'indifferent':friendly ? 'friendly' : relationship.attitude,
    relationship,
    charmedBySpeaker: sourced.length > 0,
    animalCommunication: communication.animalCommunication,
    communication: { spoken: communication.spoken, basis: communication.basis },
    creatureType: body?.creatureType,
    limits: npcCommunicationLimits+(truth?' 你作为诚实之域来源，知道当前交谈者'+(truth.success?'最近豁免成功，不能因此认定无法说谎。':'曾在本区域豁免失败，仍在区域内时不能故意说谎；可拒答或回避。')+' 这不是识谎能力，也不保证对方资料完整或正确。':'')+(active.some(f=>f.key==='phantasmal-force')?' 你目前感知到：'+active.filter(f=>f.key==='phantasmal-force').map(f=>f.control?.text??'').join('；')+'。描述只属于你的感官，不让其他人物自动看见，也不能自行判定其真假。':'')+(active.some(f=>f.key==='zone-of-truth'&&f.control?.inside&&f.control.result===false)?' 当前受诚实之域影响：不能故意说谎，可以沉默、拒答或回避；不能泄露未知信息。':'')+(charmEffective(active)&&active.some(f=>f.key==='suggestion')?' 当前须尽力遵循已确认的活动：'+active.filter(f=>f.key==='suggestion').map(f=>f.control?.text??'').join('；')+'；不能自行花费资源或宣布行为完成。':''),
  }
}
