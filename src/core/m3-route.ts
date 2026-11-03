import type {MapWorld,Adventure,MapScene,MapToken} from './map-types'
import type {Catalogue} from './engine'
import {directPath,distance} from './map'
import {combatStats,attackOptions} from './combat-rules'
import {assertDuelRoute,assertFrightenedRoute} from './control-movement'
import {tokenPerception} from './m3-map-perception'
import {spatialState} from './m3-spatial'
/** Uses a real straight segment; unknown three-dimensional obstacles remain explicit GM facts. */
export function validateM3Route(world:MapWorld,a:Adventure,s:MapScene,t:MapToken,to:{x:number;y:number;height:number},effects:import('./types').ActiveEffect[],cat:Catalogue,reactionsConfirmed=false,mode?:'walk'|'fly'|'swim'|'climb'){
 const path=directPath(t,to);assertDuelRoute(world,s,t,path,effects);assertFrightenedRoute(world,s,t,path,effects)
 const e=world.encounters.find(e=>e.id===s.encounterId&&e.phase==='active'),actor=e?.actors.find(a=>a.id===t.actorId||!!t.characterId&&a.characterId===t.characterId)
 const body=actor?.npc??t.npcBody,traits=body?.templateMetadata?.abilities.map(a=>a.id)??[]
 if(!e||!actor||effects.some(f=>f.key==='disengage')||traits.includes('agile')||traits.includes('flyby')&&mode==='fly')return
 const start={...t},end={...t,...to,spatial:{...spatialState(t.spatial),height:to.height}},candidates:string[]=[]
 for(const other of e.actors){if(other.side===actor.side||other.side==='neutral'||!other.turn.reaction)continue
  const enemy=s.tokens.find(t=>t.actorId===other.id);if(!enemy||combatStats(other,world.characters,cat).conditions.includes('incapacitated'))continue
  if(!tokenPerception(world,a,s,enemy,start,cat).canSee)continue
  const reach=Math.max(5,...attackOptions(other,world.characters,cat).filter(a=>!a.ranged).map(a=>a.reach))
  if(distance(s,enemy,start)<=reach&&distance(s,enemy,end)>reach)candidates.push(enemy.name)
 }
 if(candidates.length&&!reactionsConfirmed)throw Error('实际立体路线可能触发借机攻击：'+candidates.join('、')+'；请GM处理后明确确认')
}
