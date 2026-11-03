import type {Character,InventoryItem} from './types'
let characters:readonly Character[]|undefined
/** Synchronous rule context; never retain it across async work. */
export function withInventoryClocks<T>(rows:readonly Character[],fn:()=>T):T {
 const previous=characters;characters=rows;try{return fn()}finally{characters=previous}
}
export function inventorySourceHour(row:InventoryItem,owner:Character,ownHour:number){
 const source=row.consumable?.clockSourceId
 if(!source||source===owner.id)return ownHour
 return characters?.find(c=>c.id===source)?.runtime?.hours
}
