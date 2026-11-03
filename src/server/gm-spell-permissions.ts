import type {Room,RoomMember} from '../online/protocol'
import type {GmSpellChoice} from '../persistence/gm-spell-choice-schema'
import {adventure,RoomError} from './room-engine'
/** Additional structured IDs cannot bypass the ordinary public target picker. */
export function authorizeGChoice(room:Room,member:RoomMember,choice?:GmSpellChoice){
 if(member.role==='gm'||!choice?.subjectId)return
 const a=adventure(room),s=a.scenes.find(s=>s.id===a.activeSceneId),id=choice.subjectId
 const visible=s?.tokens.some(t=>!t.hidden&&[t.id,t.actorId,t.characterId,t.npcId].includes(id))||a.m3?.entities.some(o=>o.id===id&&o.enabled&&o.sceneId===s?.id&&(!o.hidden||o.knownTo?.some(id=>member.characterIds.includes(id))))
 const familiar=a.gmSpellFacts?.some(f=>f.entityId===id&&f.knowsTarget&&!!f.observerId&&member.characterIds.includes(f.observerId))
 const corpse=a.m1Utility?.corpses.find(c=>c.id===id),visibleCorpse=corpse&&s&&[...s.tokens,...s.defeatedTokens??[]].some(t=>!t.hidden&&[t.id,t.actorId,t.characterId,t.npcId].includes(corpse.entityId))
 if(!visible&&!familiar&&!visibleCorpse)throw new RoomError('只能填写已公开或GM已登记本人熟悉的实际法术对象',403)
}
