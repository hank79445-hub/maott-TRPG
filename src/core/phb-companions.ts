import type {Character,Ability} from './types'
import type {Catalogue} from './engine'
import type {CombatNpc} from './combat-types'
export const SUMMON_FORM_NAMES:Record<string,string>={}
export const spellSummonForms=(_id:string):string[]=>[]
const unavailable=():never=>{throw Error('该非SRD召唤数据未随公共版本提供')}
export function primalCompanion(_c:Character,_cat:Catalogue,_form:string):CombatNpc{return unavailable()}
export function spellSummon(_c:Character,_cat:Catalogue,_spellId:string,_slot:number,_form:string,_ability:Ability):CombatNpc{return unavailable()}
export function spiritSummonBody(_spellId:string,_slot:number,_form:string,_attack:number):CombatNpc{return unavailable()}
