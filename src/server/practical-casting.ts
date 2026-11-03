import type {Room} from '../online/protocol'
import type {NpcProfile,NpcDirective} from '../core/ai-types'
import {catalogue} from '../core/engine'
import {srd} from '../content/srd'
import {npcCapabilities} from '../core/npc-strategy'
import {abilityAvailable} from '../core/npc-abilities'
import {silenced} from '../core/scene-magic'
import {spellWorkflowPolicy} from '../core/spell-workflow-policies'
import {castingEvidence} from './practical-intents'
import {practicalEnabled} from './practical-review-state'
import {activeScene,adventure} from './room-engine'
export function npcAutomaticAbility(room:Room,n:NpcProfile,d:NpcDirective){
 if(!practicalEnabled(room,'spells')||d.kind!=='ability')return false
 const cap=npcCapabilities(room.world,n).find(c=>c.id===d.abilityId&&c.enabled),selected=n.abilities.find(c=>c.id===cap?.id&&c.enabled)
 if(!cap||!selected)return false
 if(selected.mode==='ritual')return false
 if(n.characterId&&cap.kind==='spell')return !castingEvidence(room,n.characterId,cap.key,d.targets??(d.targetId?[d.targetId]:[]))
 if(!cap.key.startsWith('monster:'))return cap.kind==='feature'
 const actor=room.world.encounters.flatMap(e=>e.actors).find(a=>a.id===n.actorId),body=actor?.npc??n.body,definition=body?.abilities?.find(a=>a.id===cap.key.slice(8))
 if(!body||!definition||definition.support!=='automatic'||!abilityAvailable(body,definition.id))return false
 if(!definition.spellId)return false
 const spell=catalogue([srd,...room.world.packs]).spells.find(s=>s.id===definition.spellId),scene=activeScene(room),token=scene?.tokens.find(t=>t.npcId===n.id||t.actorId===n.actorId)
 if(!spell||spellWorkflowPolicy(spell.id)||/minute|hour/i.test(spell.castingTime))return false
 // A stat-block's registered V/S casting ability is actual capability evidence;
 // material requirements still need registered supplies, never an invented focus.
 if(/(^|[,\s])M([,\s(]|$)/.test(spell.components)){
  if(/\d|consume|消耗|价值|worth/i.test(spell.components))return false
  if(!n.consumables?.some(row=>row.itemId==='component-pouch'&&row.quantity>0))return false
 }
 if(/(^|[,\s])V([,\s(]|$)/.test(spell.components)&&(!scene||!token||silenced(room.world,adventure(room),scene,token)))return false
 return true
}
