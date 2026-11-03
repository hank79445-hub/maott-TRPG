import {systemMessage} from '../shared/localization/system-messages'
import type {M3Action} from '../persistence/m3-world-schema'
import type { Room, RoomCommand, RoomMember } from '../online/protocol'
import { applyM3Action } from '../core/m3-world-actions'
import { catalogue } from '../core/engine'
import { srd } from '../content/srd'
import { adventure, RoomError, forgetUndo } from './room-engine'
import { appendBroadcast, gmAudience } from '../core/broadcast'
export function executeM3(room:Room,member:RoomMember,command:RoomCommand){
  if(command.kind!=='m3-spatial')return false
  if(member.role!=='gm'||member.revoked)throw new RoomError('空间环境、物件施法及后续裁定仅限有效GM',403)
  executeM3Action(room,command.action)
  return true
}
export function executeM3Action(room:Room,action:M3Action){
  const a=adventure(room),result=applyM3Action(room.world,a.id,action,catalogue([srd,...room.world.packs]))
  room.world=result.world;forgetUndo(room.world);room.worldRevision++
  appendBroadcast(adventure(room),crypto.randomUUID(),{message:systemMessage('audit.spatial'),category:'resolution',type:'spell.m3-result',title:'空间／物件法术',text:result.detail,narration:'context',audience:gmAudience(),sceneId:a.activeSceneId})
  return true
}
