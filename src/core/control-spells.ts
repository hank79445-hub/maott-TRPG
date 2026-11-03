import {magicalCreatureType} from './m3-magic-perception'
/** PHB 2024's ten playable species all have the Humanoid creature type.
 * Unknown/custom species do not silently acquire that type. NPCs use their actual stat block. */
export function humanoidPlayerSpecies(id: string) {
  return [
    'aasimar',
    'dragonborn',
    'dwarf',
    'elf',
    'gnome',
    'goliath',
    'halfling',
    'human',
    'orc',
    'tiefling',
  ].includes(id)
}
export function actorCreatureType(actor:import('./combat-types').Combatant,characters:import('./types').Character[],magic=false){
 const c=characters.find(c=>c.id===actor.characterId)
 const real=c?(c.runtime?.wildShape?'beast':humanoidPlayerSpecies(c.build.speciesId)?'humanoid':undefined):actor.npc?.creatureType
 return magic?magicalCreatureType(real,c?.runtime?.effects??actor.npc?.effects??[]):real
}
export function controlAutoSave(id:string,source:import('./combat-types').Combatant,target:import('./combat-types').Combatant,characters:import('./types').Character[],active:boolean){
 const type=actorCreatureType(target,characters,true),c=characters.find(c=>c.id===target.characterId)
 if(id==='friends'&&type&&type!=='humanoid')return true
 if(id==='sleep'&&(c?.build.speciesId==='elf'||target.npc?.conditionImmunities.includes('exhaustion')))return true
 if(['enthrall','friends'].includes(id)&&active&&source.side!==target.side&&source.side!=='neutral'&&target.side!=='neutral')return true
 return false
}
export function validateControlTargets(id:string,targets:import('./combat-types').Combatant[],characters:import('./types').Character[]){
 const required=['hold-person','charm-person','crown-of-madness','calm-emotions'].includes(id)?'humanoid':id==='animal-friendship'?'beast':undefined
 if(required&&targets.some(t=>actorCreatureType(t,characters,true)!==required))throw Error(required==='humanoid'?'该法术需要已登记的类人生物目标':'动物友善需要已登记的野兽目标')
}
