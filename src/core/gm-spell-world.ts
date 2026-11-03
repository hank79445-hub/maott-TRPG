import type {Adventure,MapWorld} from './map-types'
import type {Catalogue} from './engine'
import type {GmSpellChoice,GmSpellFact} from '../persistence/gm-spell-choice-schema'
import {m1Entity} from './m1-utility'
import {m3State} from './m3-world-cast'
import {G_RULES,validateGChoice} from './gm-spell-rules'
import {tokenPoint} from './scene-effects'
import {magicDistance} from './scene-magic'
import {actorCreatureType} from './control-spells'
import {freshTurn} from './combat-rules'
import {physicalPropagation} from './scene-propagation'
export function gEntity(w:MapWorld,a:Adventure,id:string){
 const token=a.scenes.flatMap(s=>[...s.tokens,...s.defeatedTokens??[]]).find(t=>[t.id,t.actorId,t.npcSourceActorId,t.characterId,t.npcId].includes(id)),actor=w.encounters.flatMap(e=>e.actors).find(t=>t.id===(token?.actorId??token?.npcSourceActorId??id))
 const explicit=a.m1Utility?.corpses.find(c=>c.id===id),canonical=token?.characterId??token?.npcId??actor?.characterId??actor?.npcId??token?.actorId??explicit?.entityId??id
 const entity=m1Entity(w,a,canonical),corpses=(a.m1Utility?.corpses??[]).filter(c=>c.entityId===(entity?.id??canonical)),corpse=explicit??[...corpses].reverse().find(c=>c.dead)??corpses.at(-1),object=a.m3?.entities.find(o=>o.id===id)
 return {id:explicit||corpse?.dead&&entity?.dead?corpse!.id:entity?.id??object?.id??id,entity,object,corpse,token:entity?.token??token}
}
export function gClock(w:MapWorld,a:Adventure,sourceId:string){
 const source=gEntity(w,a,sourceId).entity,clocks=w.characters.filter(c=>a.party.includes(c.id)&&c.runtime),c=source?.c??clocks[0];if(!c?.runtime)throw Error('需要已登记的游戏时钟')
 const sample=Object.fromEntries(clocks.map(c=>[c.id,c.runtime!.hours??0])),state=a.gmSpellClock??={hours:Math.max(0,...Object.values(sample)),samples:sample}
 const delta=Math.max(0,...Object.entries(sample).map(([id,h])=>state.samples[id]===undefined?0:h-state.samples[id]!));state.hours+=delta;state.samples={...state.samples,...sample}
 return {id:c.id,hours:state.hours}
}
export function gCurrentHours(w:MapWorld,a:Adventure){
 const clocks=w.characters.filter(c=>a.party.includes(c.id)&&c.runtime),state=a.gmSpellClock
 return state?state.hours+Math.max(0,...clocks.map(c=>state.samples[c.id]===undefined?0:(c.runtime!.hours??0)-state.samples[c.id]!)):Math.max(0,...clocks.map(c=>c.runtime!.hours??0))
}
export function gFact(a:Adventure,id:string,observerId?:string){return a.gmSpellFacts?.find(f=>f.entityId===id&&f.observerId===observerId)??a.gmSpellFacts?.find(f=>f.entityId===id&&!f.observerId)}
export function validateGWorld(w:MapWorld,a:Adventure,cat:Catalogue,spellId:string,sourceId:string,targetIds:string[],choice:GmSpellChoice={},skipMaterials=false){
 const rule=G_RULES[spellId];if(!rule)return
 validateGChoice(spellId,choice)
 const source=gEntity(w,a,sourceId).entity;if(!source?.token||source.dead||source.state.hp<=0)throw Error('实际施法来源无效')
 const s=a.scenes.find(s=>s.tokens.includes(source.token!))!,raw=choice.subjectId??targetIds.find(id=>gEntity(w,a,id).entity?.id!==source.id)??targetIds[0],target=raw?gEntity(w,a,raw):undefined,fact=target&&gFact(a,target.id,source.id)
 if(choice.point&&(choice.point.x>=s.grid.columns||choice.point.y>=s.grid.rows))throw Error('法术位置超出实际场景')
 const point=target?.token?tokenPoint(target.token):target?.object?{x:target.object.x+.5,y:target.object.y+.5,height:target.object.height}:choice.point
 const targetScene=target?.token?a.scenes.find(s=>[...s.tokens,...s.defeatedTokens??[]].includes(target.token!))?.id:target?.object?.sceneId
 const ranged=(feet:number,blocked=true)=>{if(skipMaterials)return;if(!point||targetScene&&targetScene!==s.id||magicDistance(tokenPoint(source.token!),point,s.grid.feet)>feet)throw Error('实际目标／位置超出本术'+feet+'尺范围');if(blocked){const ray=physicalPropagation(a,s,tokenPoint(source.token!),point,'effect');if(!ray.clear||ray.uncertain)throw Error('实际目标有实体阻隔或需GM先确认墙高')}}
 const touch=()=>ranged(5)
 if(point&&spellId!=='sending'){
  const ranges:Record<string,number>={'speak-with-dead':10,'animal-messenger':30,'mage-hand':30,'minor-illusion':30,'silent-image':60,'major-image':120,'clairvoyance':5280,'druidcraft':30,'elementalism':30,'thaumaturgy':30,'prestidigitation':10,'detect-thoughts':30,'message':120}
  if(ranges[spellId]!==undefined)ranged(ranges[spellId]!,!['message','clairvoyance'].includes(spellId))
 }
 if(target?.token&&spellId!=='sending'&&target.token.spatial?.layer!==source.token.spatial?.layer&&!(target.token.spatial?.layer===undefined&&source.token.spatial?.layer==='material')&&!(source.token.spatial?.layer===undefined&&target.token.spatial?.layer==='material'))throw Error('实际目标不在同一可互动空间')
 if(spellId==='speak-with-dead'){
  if(!target?.corpse?.dead||!target.corpse.bodyViable||target.entity&&!target.entity.dead||fact?.mouthIntact!==true)throw Error('须选择M1中有效的实际遗骸，并先由GM登记仍有嘴')
  if(target.entity?.body?.creatureType==='undead')throw Error('死者交谈不能指定亡灵生物')
 }
 if(['beast-sense','animal-messenger'].includes(spellId)){
  const t=target?.entity,body=t?.actor??(t?.body?{id:t.id,characterId:null,npc:t.body,side:'neutral' as const,initiative:0,surprised:false,turn:freshTurn()}:undefined)
  if(!body||actorCreatureType(body,w.characters,true)!=='beast'||t?.dead)throw Error('须选择已登记、存活的实际野兽')
  if(spellId==='beast-sense'){touch();if(fact?.willing!==true)throw Error('请GM先登记野兽自愿接受感官连接')}
  if(spellId==='animal-messenger'&&t?.body?.templateMetadata?.cr===undefined)throw Error('动物信使须先登记实际野兽挑战等级')
  if(spellId==='animal-messenger'&&fact?.tiny!==true)throw Error('请GM先核实实际野兽符合微型条件')
 }
 if(['identify','mending','tongues','beast-sense'].includes(spellId)||spellId==='comprehend-languages'&&choice.subjectId)touch()
 if(spellId==='identify'&&!target?.entity&&!target?.object)throw Error('鉴定须选择实际物件或生物')
 if(spellId==='mending'&&!target?.object)throw Error('修复术须选择已登记的实际破损物件，不能修复生物')
 if(spellId==='sending'&&(!target||fact?.knowsTarget!==true))throw Error('请GM先登记来源熟悉的实际接收者')
 if(rule.words&&(!choice.description?.trim()||choice.wordCount===undefined))throw Error('请填写消息及待GM核对的词数')
 if(rule.material&&!skipMaterials){
  const material=choice.materialId?gFact(a,choice.materialId,source.id):undefined
  const inventory=material?.inventoryOwnerId&&w.characters.find(c=>c.id===material.inventoryOwnerId)?.inventory.find(i=>i.instanceId===material.inventoryInstanceId&&i.quantity>0),object=material&&a.m3?.entities.find(o=>o.id===material.entityId&&o.enabled&&o.boundCharacterId===source.id)
  if(!material||material.material!==rule.material.name||(material.valueGP??0)<rule.material.gp||!(inventory&&material.inventoryOwnerId===source.c?.id||object))throw Error('需要GM登记的实际'+rule.material.name+'材料（价值至少'+rule.material.gp+'GP），不能仅填写拥有')
 }
 return {source,target,clock:gClock(w,a,source.id)}
}
export function saveGFact(w:MapWorld,a:Adventure,fact:GmSpellFact){
 const target=gEntity(w,a,fact.entityId)
 const inventory=fact.inventoryOwnerId&&w.characters.find(c=>c.id===fact.inventoryOwnerId)?.inventory.some(i=>i.instanceId===fact.inventoryInstanceId&&i.quantity>0)
 if(!a.scenes.some(s=>s.id===fact.sceneId)||!target.entity&&!target.object&&!target.corpse&&!inventory)throw Error('规则事实必须关联实际场景人物、物件、背包实例或遗骸')
 if(fact.inventoryOwnerId&&!w.characters.find(c=>c.id===fact.inventoryOwnerId)?.inventory.some(i=>i.instanceId===fact.inventoryInstanceId&&i.quantity>0))throw Error('材料须关联真实背包实例')
 if(fact.observerId&&!gEntity(w,a,fact.observerId).entity)throw Error('熟悉关系须实际观察者')
 a.gmSpellFacts=[...(a.gmSpellFacts??[]).filter(f=>!(f.entityId===target.id&&f.observerId===fact.observerId)),{...fact,entityId:target.id}]
 if(a.gmSpellFacts.length>1000)throw Error('规则事实容量已满，请先归档')
}
