import {systemMessage} from '../shared/localization/system-messages'
import {executeGSpellAction} from './room-gm-spell-actions'
import {activateGResult} from '../core/gm-spell-actions'
import {G_RULES} from '../core/gm-spell-rules'
import {gEntity} from '../core/gm-spell-world'
import { catalogue, clone } from '../core/engine'
import { srd } from '../content/srd'
import { appendBroadcast } from '../core/broadcast'
import { applyCombat } from '../core/combat'
import { createGmSpellRequest, assertGmSpellFresh } from '../core/spell-gm-resolution'
import { spellWorkflowPolicy } from '../core/spell-workflow-policies'
import type { Room, RoomCommand, RoomMember } from '../online/protocol'
import { adventure, RoomError } from './room-engine'

export function syncGmSpellRequests(room: Room) {
  const a = adventure(room), cat = catalogue([srd, ...room.world.packs])
  const scene = a.scenes.find(s => s.id === a.activeSceneId)
  const e = room.world.encounters.find(e => e.id === scene?.encounterId)
  const frames=e?[e.pending,...e.reactionParents??[],...e.attackParents??[]].filter((p):p is NonNullable<typeof p>=>!!p):[]
  for(const p of frames)if (scene && e && p.spellId && p.id && spellWorkflowPolicy(p.spellId)) {
    const actor = e.actors.find(x => x.id === p.actorId), spell = cat.spells.find(s => s.id === p.spellId)
    if (actor && spell)
      createGmSpellRequest(room.world, a, cat, { spell, characterId: actor.characterId??actor.npcId??actor.id, choice:p.gmChoice,dc:p.dc??undefined,
        sceneId: scene.id, targetIds: p.targets.map(t => t.id), slotLevel: p.slotLevel ?? spell.level,
        question: p.notes.join('；') || '请GM核对实际效果', encounterId: e.id, pendingId: p.id })
  }
  for (const r of a.gmSpellRequests ?? []) {
    if (r.status === 'pending' && r.encounterId && !((encounter)=>encounter&&[encounter.pending,...encounter.reactionParents??[],...encounter.attackParents??[]].some(p=>p?.id===r.pendingId))(room.world.encounters.find(e => e.id === r.encounterId)))
      r.status = 'canceled'
  }
}

export function executeGmSpellCommand(room: Room, member: RoomMember, command: RoomCommand) {
  if(executeGSpellAction(room,member,command))return true
  if (command.kind !== 'spell-gm-resolve' && command.kind !== 'spell-gm-cancel' && command.kind !== 'spell-gm-question') return false
  const a = adventure(room), r = a.gmSpellRequests?.find(r => r.id === command.requestId)
  if (!r) throw new RoomError('法术裁定申请不存在或已被读档撤销')
  const cat = catalogue([srd, ...room.world.packs])
  if (command.kind === 'spell-gm-question') {
    if (member.role !== 'gm' && !member.characterIds.includes(r.characterId)) throw new RoomError('未获该角色操控权', 403)
    const siblings = a.gmSpellRequests!.filter(q => q.castId === r.castId)
    if (siblings.some(q => q.status === 'pending')) throw new RoomError('请先等待上一问裁定')
    if (r.status !== 'published' || siblings.length >= (spellWorkflowPolicy(r.spellId)?.maxQuestions ?? 1))
      throw new RoomError('本次法术问题次数已用尽')
    if (a.gmSpellRequests!.length >= 500) throw new RoomError('法术裁定记录达到500项')
    assertGmSpellFresh(room.world, a, {...r, status:'pending'}, cat)
    a.gmSpellRequests!.push({...clone(r), id:crypto.randomUUID(), question:command.question,
      questionIndex:siblings.length + 1, status:'pending', result:undefined, encounterId:undefined,
      pendingId:undefined, noResult:undefined, createdAt:new Date().toISOString()})
    return true
  }
  if (member.role !== 'gm') throw new RoomError('法术结果与取消只能由GM确认', 403)
  if (r.status !== 'pending') throw new RoomError('该法术裁定已经处理')
  if (command.kind === 'spell-gm-cancel') {
    const e = room.world.encounters.find(e => e.id === r.encounterId)
    if(e&&r.pendingId&&e.pending?.id!==r.pendingId&&[...e.reactionParents??[],...e.attackParents??[]].some(p=>p.id===r.pendingId))throw new RoomError('请先处理挂起中的反应，再结束原法术裁定')
    r.status = 'canceled'
    if (e && r.pendingId && e.pending?.id === r.pendingId) e.pending = null
    room.worldRevision++
    return true // A valid already-cast spell is not refunded by ending adjudication.
  }
  assertGmSpellFresh(room.world, a, r, cat)
  if(['augury','sending','animal-messenger'].includes(r.spellId)&&r.noResult&&!command.noResult)throw new RoomError('本次规则骰已确定无所得／施法未奏效，请明确发布无所得结果')
  if (!command.text.trim()) throw new RoomError('请填写法术结果或明确无所得')
  if (command.audience.kind === 'personal' && (!command.audience.characterIds.length ||
    command.audience.characterIds.some(id => !gEntity(room.world,a,id).entity)))
    throw new RoomError('请选择有效接收角色')
  const checks=G_RULES[r.spellId]?.checks??[]
  if(r.choice?.operation&&checks.some(check=>!command.ruleChecks?.includes(check)))throw new RoomError('请逐项核对本术规则边界')
  r.ruleChecks=command.ruleChecks
  activateGResult(room.world,a,r,cat)
  if (r.encounterId) {
    const index = room.world.encounters.findIndex(e => e.id === r.encounterId)
    const e = room.world.encounters[index]
    if (!e?.pending || e.pending.id !== r.pendingId) throw new RoomError('原施法结算已变化')
    const next = applyCombat(e, room.world.characters, cat, { type:'resolve', nonlethal:false,
      savage:false, stone:false, relentless:false, pushConfirmed:false,
      manual:{ damage:0, damageType:'force', heal:0, condition:'', rounds:0, note:'GM法术结果已按接收权限单独发布' } })
    room.world.encounters[index] = next.encounter
    room.world.characters = next.characters
  }
  const event = appendBroadcast(a, r.id, {message:systemMessage('spell.gm-result',{spell:r.name}), category:'resolution', type:'spell.gm-result',
    title:r.name + ' · GM裁定', text:command.text.trim(), narration:'context',
    audience:clone(command.audience), sceneId:r.sceneId,
    facts:{characterId:r.characterId, spellId:r.spellId, requestId:r.id},
  })
  r.status = 'published'; r.noResult = r.noResult||command.noResult
  r.result = {text:command.text.trim(), privateNote:command.privateNote, audience:clone(event.audience), eventId:event.id}
  room.worldRevision++
  return true
}

export function projectGmSpells(room: Room, member: RoomMember) {
  const gm = member.role === 'gm'
  if(!gm&&member.revoked)return []
  return (adventure(room).gmSpellRequests ?? []).filter(r => gm || member.characterIds.includes(r.characterId)||r.observations?.some(o=>member.characterIds.includes(o.observerId))||r.result?.audience.kind==='personal'&&r.result.audience.characterIds.some(id=>member.characterIds.includes(id)))
    .slice(-100).map(r => {
      if (gm) return clone(r)
      const next = clone(r)
      delete next.uncertaintyChance;delete next.uncertaintyRoll;delete next.noResult
      delete next.contextKey;delete next.ruleChecks;delete next.choice;delete next.clockSourceId;delete next.restKey;delete next.dc
      next.observations=next.observations?.filter(o=>member.characterIds.includes(o.observerId)).map(o=>({...o,text:o.recognized?'本人已识破幻象':'本人的研究尚未识破'}));delete next.ongoing;delete next.sourceNpcId;if(!member.characterIds.includes(r.characterId))next.characterId=''
      next.targetIds = []; next.question = r.name + '：' + (r.status === 'pending' ? '等待GM裁定' : '已处理')
      const audience = r.result?.audience
      if (r.result && audience && (audience.kind === 'public' ||
        ['party','personal'].includes(audience.kind) && audience.characterIds.some(id => member.characterIds.includes(id))))
        next.result = {...clone(r.result), privateNote:''}
      else delete next.result
      return next
    })
}
