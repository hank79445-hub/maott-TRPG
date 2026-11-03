import {systemMessage} from '../shared/localization/system-messages'
import type { Room, RoomCommand, RoomMember } from '../online/protocol'
import type { SceneEffectAction } from '../persistence/scene-effects-schema'
import { applySceneEffectAction } from '../core/scene-effect-actions'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { adventure, forgetUndo, RoomError } from './room-engine'
import { appendBroadcast, gmAudience } from '../core/broadcast'
export function executeSceneEffects(room: Room, member: RoomMember, command: RoomCommand) {
  if (command.kind !== 'scene-effect') return false
  if (member.role !== 'gm' || member.revoked)
    throw new RoomError('场景效果事实与施法确认仅限有效GM', 403)
  executeSceneEffectAction(room, command.action)
  return true
}
export function executeSceneEffectAction(room: Room, action: SceneEffectAction) {
  const a = adventure(room),
    pendingM5=new Set(a.sceneEffects?.m5?.resolutions.filter(r=>r.status==='pending').map(r=>r.id)??[]),
    result = applySceneEffectAction(room.world, a.id, action, catalogue([srd, ...room.world.packs]))
  room.world = result.world
  forgetUndo(room.world)
  room.worldRevision++
  appendBroadcast(adventure(room), crypto.randomUUID(), {message:systemMessage('audit.sceneEffect'),
    category: 'resolution',
    type: 'spell.scene-effect',
    title: '持续场景效果',
    text: result.detail,
    narration: 'context',
    audience: gmAudience(),
    sceneId: a.activeSceneId,
  })
  if (action.operation === 'hazard') {
    const current = adventure(room),
      event = current.sceneEffects?.hazards.find(
        (h) => h.id === action.eventId && h.status === 'resolved',
      ),
      recipient = event && room.world.characters.find((c) => c.id === event.entityId),
      effect = current.sceneEffects?.regions.find((e) => e.id === event?.effectId)
    if (recipient && event)
      appendBroadcast(current, crypto.randomUUID(), {message:systemMessage(event.damage!==undefined?'spell.terrain.damage':event.success?'spell.terrain.success':'spell.terrain.failure',{effect:effect?.name??'Area',...(event.damage!==undefined?{damage:event.damage}:{})}),
        category: 'resolution',
        type: 'spell.terrain-result',
        title: '区域后果已结算',
        text: `${effect?.name ?? '区域'}：${event.damage !== undefined ? `实际承受${event.damage}点伤害` : event.success ? '豁免成功' : '豁免失败；请查看本人当前状态'}。`,
        narration: 'direct',
        audience: { kind: 'personal', characterIds: [recipient.id] },
        sceneId: event.sceneId,
      })
  }
  const current=adventure(room)
  for(const event of current.sceneEffects?.m5?.resolutions??[]){
    if(event.status!=='resolved'||!pendingM5.has(event.id))continue
    const participants=new Set([event.actorId,...event.targets.map(t=>t.id)])
    for(const id of participants){const pc=room.world.characters.find(c=>c.id===id);if(!pc)continue
      const text=event.targets.some(t=>t.id===id)?`本次法术后续已结算。当前生命 ${pc.runtime?.hp??0}；状态和专注以角色卡及待处理豁免为准。`:'本次法术后续已结算，原骰值、费用与来源已保存。'
      appendBroadcast(current,crypto.randomUUID(),{message:systemMessage(event.targets.some(t=>t.id===id)?'spell.m5.target':'spell.m5.source',event.targets.some(t=>t.id===id)?{hp:pc.runtime?.hp??0}:{}),category:'resolution',type:'spell.m5-result',title:'法术后续结果',text,narration:'direct',audience:{kind:'personal',characterIds:[id]},sceneId:event.sceneId})
    }
  }
}
