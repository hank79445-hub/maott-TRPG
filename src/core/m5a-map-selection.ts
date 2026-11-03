import type {MapWorld,Adventure,MapScene} from './map-types'
import type {Catalogue} from './engine'
import type {CombatCommand,Encounter,Environment} from './combat-types'
import {defaultEnvironment} from './combat-rules'
import {runtimeSpells} from './runtime'
import {distance,mapEnvironment} from './map'
import {physicalPropagation} from './scene-propagation'
import {tokenPoint} from './scene-effects'
import {m1Entity} from './m1-utility'
/** Trusted map expansion. Clients only choose the primary target, not secret creatures. */
export function m5aAreaCommand(w:MapWorld,a:Adventure,s:MapScene,e:Encounter,c:CombatCommand,cat:Catalogue):CombatCommand{
 if(!['cast','npc-ability','hit-spell'].includes(c.type)||!('actorId'in c))return c
 const actor=e.actors.find(a=>a.id===c.actorId),pc=w.characters.find(p=>p.id===actor?.characterId)
 let spell:string|undefined,primary:string|undefined
 if(c.type==='cast'){spell=pc&&runtimeSpells(pc,cat).find(g=>g.key===c.key)?.spell.id;primary=c.targets[0]}
 if(c.type==='npc-ability'){spell=actor?.npc?.abilities?.find(b=>b.id===c.abilityId)?.spellId;primary=c.targetIds[0]}
 if(c.type==='hit-spell'){spell=pc?runtimeSpells(pc,cat).find(g=>g.key===c.key)?.spell.id:actor?.npc?.abilities?.find(b=>'npc:'+b.id===c.key)?.spellId;primary=c.targetId}
 if(!['ice-knife','lightning-arrow'].includes(spell??''))return c
 const center=s.tokens.find(t=>t.actorId===primary||t.characterId===primary||t.npcId===primary),source=s.tokens.find(t=>t.actorId===actor?.id||!!pc&&t.characterId===pc.id)
 if(!center||!source)throw Error('范围附效须原攻击目标和来源的实际场景位置')
 const radius=spell==='ice-knife'?5:10
 const inBurst=(token:typeof source)=>distance(s,center,token)<=radius&&(center.spatial?.layer??'material')===(token.spatial?.layer??'material')&&physicalPropagation(a,s,tokenPoint(center),tokenPoint(token),'effect').clear
 for(const token of s.tokens.filter(inBurst)){
  const entity=m1Entity(w,a,token.characterId??token.npcId??token.actorId??token.id)
  if(entity&&!entity.dead&&!e.actors.some(actor=>actor.id===token.actorId||!!actor.characterId&&actor.characterId===token.characterId||!!actor.npcId&&actor.npcId===token.npcId))throw Error('爆裂范围内还有未加入战斗的实际人物，请先纳入名单，避免漏算范围伤害')
 }
 const rows=e.actors.flatMap(actor=>{const token=s.tokens.find(t=>t.actorId===actor.id||!!actor.characterId&&t.characterId===actor.characterId);return token&&inBurst(token)?[{actor,token}]:[]}),envs:Record<string,Environment>={}
 for(const row of rows)envs[row.actor.id]=mapEnvironment(s,center,row.token,{...defaultEnvironment(),...('env'in c?c.env:{}),areaConfirmed:true,note:'服务端按原目标位置确认实际范围、空间和阻隔'},'spell')
 return {...c,areaTargets:rows.map(r=>r.actor.id),areaEnvironments:envs} as CombatCommand
}
