import type {MapWorld,MapScene} from './map-types'
import type {Encounter} from './combat-types'
import type {Catalogue} from './engine'
import {hasOrigin} from './origins'
import {runtimeDerived} from './runtime'
import {distance,occupied,inside,blocked,directPath} from './map'
import {movementWalls} from './map-spatial'
/** Grid-resolved, directly-away landing choices. No destination override or free movement. */
export function combatPushChoices(w:MapWorld,s:MapScene,e:Encounter,cat:Catalogue){
 const p=e.pending,a=e.actors.find(a=>a.id===p?.actorId),c=w.characters.find(c=>c.id===a?.characterId),from=s.tokens.find(t=>t.actorId===a?.id)
 if(!p||!c||!from||p.kind!=='attack')return []
 const mastery=!!p.mastery&&p.attack?.mastery==='Push',tavern=p.attack?.id==='unarmed'&&hasOrigin(c,cat,'tavern-brawler')&&p.triggered?.includes('attack-action')&&e.actors[e.current]?.id===a?.id&&!a.turn.manualUsed?.includes('tavern-push')
 if(!mastery&&!tavern)return []
 return p.targets.flatMap((entry,index)=>{
  const actor=e.actors.find(a=>a.id===entry.id),to=s.tokens.find(t=>t.actorId===entry.id),target=w.characters.find(c=>c.id===actor?.characterId),size=target?runtimeDerived(target,cat).currentSize:actor?.npc?.size
  if(!entry.hit||!to||mastery&&['huge','gargantuan'].includes(size??''))return []
  const dx=to.x-from.x,dy=to.y-from.y,choices:{x:number;y:number}[]=[]
  for(let x=0;x<s.grid.columns;x++)for(let y=0;y<s.grid.rows;y++){
   const dest={...to,x,y},n=distance(s,to,dest)
   if(!n||n>(mastery?10:5)||(x-to.x)*dy!==(y-to.y)*dx||(x-to.x)*dx+(y-to.y)*dy<=0||distance(s,from,dest)<=distance(s,from,to))continue
   const obstructed=directPath(to,dest).some(q=>{
    const cells=occupied({...to,...q})
    return cells.some(cell=>!inside(s,cell)||blocked(s,cell))||s.tokens.some(t=>t.id!==to.id&&occupied(t).some(v=>cells.some(c=>c.x===v.x&&c.y===v.y)))
   })
   if(obstructed)continue
   if(movementWalls(s,to,to,dest).length)continue
   choices.push({x,y})
  }
  return choices.length?[{actorId:p.actorId,targetId:entry.id,index,kind:mastery?'mastery' as const:'tavern' as const,destinations:choices}]:[]
 })
}
