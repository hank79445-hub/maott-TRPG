import type {Room} from '../online/protocol'
import type {BroadcastEvent} from '../core/broadcast-types'
export function eventAttributedToParty(room:Room,e:BroadcastEvent,policy?:{attribution?:'party'|'proxy'|'world';proxyNpcIds?:string[]}){
 const a=room.world.adventures[0]!
 if(policy?.attribution==='world')return true
 if(e.type==='scene.enter'&&e.sceneId===a.activeSceneId&&a.scenes.find(s=>s.id===e.sceneId)?.tokens.some(t=>a.party.includes(t.characterId??'')&&!room.world.characters.find(c=>c.id===t.characterId)?.npcOwnerId))return true
 const sourceId=typeof e.facts.sourceId==='string'?e.facts.sourceId:typeof e.facts.actorId==='string'?e.facts.actorId:null
 const characterId=!sourceId&&typeof e.facts.characterId==='string'?e.facts.characterId:null
 const actor=room.world.encounters.flatMap(e=>e.actors).find(a=>a.id===sourceId)
 const actual=sourceId?(actor?.characterId??room.world.characters.find(c=>c.id===sourceId)?.id):characterId
 if(actual&&a.party.includes(actual)&&!room.world.characters.find(c=>c.id===actual)?.npcOwnerId)return true
 const npcId=sourceId?(actor?.npcId??a.ai?.npcs.find(n=>n.id===sourceId||n.characterId===actual)?.id):typeof e.facts.actorNpcId==='string'?e.facts.actorNpcId:typeof e.facts.npcId==='string'?e.facts.npcId:room.world.characters.find(c=>c.id===actual)?.npcOwnerId
 return policy?.attribution==='proxy'&&!!npcId&&!!policy.proxyNpcIds?.includes(npcId)
}
