import type {ActiveEffect} from './types'
import type {MapWorld,MapScene,MapToken,Position} from './map-types'
import type {Catalogue} from './engine'
import {clone} from './engine'
import {equipmentLayout} from './equipment'
import {findItem} from './runtime'
import {newGroundItem} from './ground-items'
import {inventoryName} from './special-weapons'
import {distance} from './map'
import {charmEffective} from './m2-social-controls'
export function assertDuelRoute(world:MapWorld,scene:MapScene,token:MapToken,path:Position[],effects:ActiveEffect[]){
 const encounter=world.encounters.find(e=>e.id===scene.encounterId&&e.phase==='active'),a=world.adventures.find(a=>a.scenes.some(s=>s.id===scene.id))
 const turn=encounter?encounter.id+':'+encounter.tick:a?.exploration?.status==='active'?a.exploration.id+':'+a.exploration.round:'outside:0'
 if(charmEffective(effects))for(const f of effects.filter(f=>f.key==='crown-of-madness'))if(f.control?.turnKey!==turn||!f.control.result)throw Error('疯狂冠冕要求移动前实际近战攻击；请先进入战斗结算，或由GM确认当前无合法目标')
 for(const effect of effects.filter(e=>e.key==='compelled-duel')){
  const actor=world.encounters.flatMap(e=>e.actors).find(a=>[a.id,a.characterId,a.npcId].includes(effect.sourceId))
  const source=scene.tokens.find(t=>[t.id,t.actorId,t.characterId,t.npcId].some(id=>id&&(id===effect.sourceId||[actor?.id,actor?.characterId,actor?.npcId].includes(id))))
  if(!source)continue
  let prior=distance(scene,token,source)
  for(const step of path){const gap=distance(scene,{...token,...step},source);if(gap>30&&gap>=prior)throw Error('强令对决不能自愿移动到来源30尺外；已在外只能靠近');prior=gap}
 }
}
export function dropFearHeldItems(world:MapWorld,scene:MapScene,characterId:string,cat:Catalogue){
 const c=world.characters.find(c=>c.id===characterId),token=scene.tokens.find(t=>t.characterId===characterId)
 if(!c||!token)return
 const layout=equipmentLayout(c,cat),ids=new Set([...(layout.slots['main-hand']??[]),...(layout.slots['off-hand']??[])].map(r=>r.instanceId))
 const rows=c.inventory.filter(r=>ids.has(r.instanceId))
 if((scene.groundItems?.length??0)+rows.length>100)throw Error('恐惧术掉落物超出地面容量，请GM先处理')
 if(rows.some(r=>c.inventory.some(child=>child.containerId===r.instanceId)))throw Error('恐惧术目标持有装满物品的容器，请GM先核对整包掉落，不能丢失包内物品')
 for(const r of rows){
  const item=findItem(c,cat,r.itemId);if(!item)throw Error('持有物缺少物品定义，请GM核对')
  const ground=newGroundItem(token,r.itemId,inventoryName(r,item.name))
  ground.quantity=r.quantity;ground.initialQuantity=r.quantity;ground.note=r.note;ground.inventoryInstanceId=r.instanceId
  ground.inventoryState={...clone(r),equipped:false,equipmentSlot:null,grip:null,containerId:null}
  if(r.specialWeapon)ground.specialWeapon=clone(r.specialWeapon)
  if(!cat.items.some(i=>i.id===item.id))ground.customItem=clone(item)
  ;(scene.groundItems??=[]).push(ground)
 }
 c.inventory=c.inventory.filter(r=>!ids.has(r.instanceId))
}
/** Frightened movement is constrained by known sources, independently of attack disadvantage visibility. */
export function assertFrightenedRoute(world:MapWorld,scene:MapScene,token:MapToken,path:Position[],effects:ActiveEffect[]){
 if(effects.some(e=>e.key==='heroism'||e.conditionImmunities?.includes('frightened')))return
 const gap=(a:Position,b:MapToken)=>distance(scene,{...token,...a},b)
 for(const effect of effects.filter(e=>e.condition==='frightened'||e.conditions?.includes('frightened'))){
  const source=world.encounters.flatMap(e=>e.actors).find(a=>[a.id,a.characterId,a.npcId].includes(effect.sourceId))
  const target=scene.tokens.find(t=>t.id!==token.id&&[t.id,t.actorId,t.characterId,t.npcId].some(id=>id&&(id===effect.sourceId||[source?.id,source?.characterId,source?.npcId].includes(id))))
  if(!target)continue // No invented position for an unknown or other-scene source.
  let prior:Position=token
  for(const next of path){if(gap(next,target)<gap(prior,target))throw Error('恐惧状态不能主动向已知恐惧来源靠近');prior=next}
 }
}
