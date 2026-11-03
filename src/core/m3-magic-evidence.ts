import {actorCreatureType} from './control-spells'
import {freshTurn} from './combat-rules'
import type {MapWorld,Adventure} from './map-types'
import {magicalAura,magicalCreatureType,magicalPerceptionAllowed} from './m3-magic-perception'
import {m1Entity} from './m1-utility'
export function m3MagicEvidence(world:MapWorld,a:Adventure,id:string,method:'divination-target'|'scrying-sensor'|'ordinary-sense'|'self-divination-sense',reading?:'aura'|'type'){
 const entity=m1Entity(world,a,id),object=a.m3?.entities.find(e=>e.id===id&&e.enabled),effects=entity?.state.effects??object?.effects??[]
 if(!entity&&!object)throw Error('实际感知目标已失效')
 if(!magicalPerceptionAllowed(effects,method))return {blocked:true as const}
 return {blocked:false as const,...(object||reading==='aura'?{aura:magicalAura({magical:object?.magical??(!!object?.castId||effects.some(f=>!!f.spellId))},effects)}:{creatureType:magicalCreatureType(actorCreatureType(entity!.actor??{id:entity!.id,characterId:entity!.c?.id??null,npc:entity!.body??null,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},world.characters),effects)})}
}
