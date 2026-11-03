import type {AuthoringProblem} from '../../core/authoring-preflight'
import type {Locale} from './locale'
import {formatSystemText} from './system-messages'
const stages:Record<string,string>={'一级构建':'Level-one build','职业成长':'Class advancement','门墙坐标':'Wall / door geometry','互动语义':'Interaction semantics','整体编译':'Full compilation'}
const abilities:Record<string,string>={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'}
/** Explain existing findings only; this function neither validates nor modifies a build. */
export function presentAuthoringProblem(p:AuthoringProblem,locale:Locale){
 if(locale==='zh-CN')return {stage:p.stage,name:p.name,message:p.message,hint:p.hint,original:undefined}
 let message=p.message
 if(p.code==='choice-selection'&&typeof p.expected==='number'&&Array.isArray(p.actual)&&Array.isArray(p.allowed)){
  const ids=p.actual.filter((v):v is string=>typeof v==='string'),unique=[...new Set(ids)]
  const permitted=new Set(p.allowed.filter((v):v is {id:string}=>!!v&&typeof v==='object'&&typeof v.id==='string').map(v=>v.id))
  message=formatSystemText(locale,'authoring.choice',{expected:p.expected,actual:ids.length,valid:unique.filter(id=>permitted.has(id)).length,duplicates:ids.length-unique.length,invalid:unique.filter(id=>!permitted.has(id)).length})
 }else if(p.code==='boosts'&&p.expected&&typeof p.expected==='object'){
  const expected=p.expected as {abilities?:unknown;maximum?:unknown}
  message=formatSystemText(locale,'authoring.boosts',{abilities:Array.isArray(expected.abilities)?expected.abilities.map(a=>abilities[String(a)]??String(a)).join(', '):'see permitted values',maximum:typeof expected.maximum==='number'?expected.maximum:20})
 }else if(p.code==='wall-reference-geometry')message=formatSystemText(locale,'authoring.wall')
 else if(p.code==='item-open-kind')message=formatSystemText(locale,'authoring.open')
 else if(['character-build','character-growth'].includes(p.code))message=formatSystemText(locale,'authoring.character')
 else if(p.code==='compile')message=formatSystemText(locale,'authoring.compile')
 else if(/\p{Script=Han}/u.test(message))message=formatSystemText(locale,p.code==='json'?'authoring.json':'authoring.schema')
 return {stage:stages[p.stage]??p.stage,name:p.code==='json'?'Authoring JSON':p.stage==='Schema'?'Structural field':p.name,message,hint:formatSystemText(locale,'authoring.hint'),original:message!==p.message?p.message:undefined}
}
