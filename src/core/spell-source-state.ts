import type {ActiveEffect} from './types'
/** Old saves may lack a casting ID; never invent one. New effects match their exact casting. */
export function concentrationMatches(effect:Pick<ActiveEffect,'key'|'spellId'|'castId'>,source:{spellId:string;castId?:string}|null|undefined){
 return !!source&&source.spellId===(effect.spellId??effect.key)&&(!effect.castId||!source.castId||effect.castId===source.castId)
}
