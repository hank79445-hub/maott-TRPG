import {uiLabel} from './ui-label'
import { i18n } from '../app/i18n'
import { ABILITY_NAMES, SKILLS, type Ability, type Choice, type ChoiceOption } from '../core/types'
import type { Catalogue } from '../core/engine'
import type { Locale } from '../shared/localization/locale'
import { entryDisplayName, spellPresentation } from './runtime-presentation'
import { DAMAGE_NAMES, type DamageType } from '../core/combat-types'
import { ruleControls } from '../content/locales/rule-controls'
import {ruleTextEnglish} from '../content/locales/rule-text-en'
import { domainControls } from '../content/locales/domain-controls'
const labels=new Map<string,string>([...Object.values(ruleControls),...Object.values(domainControls)].map(pair=>[pair[0],pair[1]]))
const ruleTexts=new Map(ruleTextEnglish)
/** Only use with rule descriptions, never room messages or user-authored character prose. */
export function ruleText(text:string|undefined,locale:Locale=i18n.global.locale.value){
 if(!text)return ''
 if(locale!=='en')return text
 return ruleTexts.get(text)??labels.get(text)??(uiLabel(text)!==text?uiLabel(text)!:undefined)??(/\p{Script=Han}/u.test(text)?'[Original text · translation unavailable] '+text:text)
}
export function ruleLabel(text:string|undefined,locale:Locale=i18n.global.locale.value){return locale==='en'&&text?labels.get(text)??text:text??''}
export function choiceSource(node:Choice,catalogue:Catalogue,locale:Locale=i18n.global.locale.value){
  const source=[...catalogue.classes,...catalogue.species,...catalogue.backgrounds,...catalogue.feats,...catalogue.subclasses].find(e=>e.name===node.source)
  return source?entryDisplayName(source,locale):ruleLabel(node.source,locale)
}
const abilities:Record<string,string>={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'}
const skills:Record<string,string>={acrobatics:'Acrobatics',animalHandling:'Animal Handling',arcana:'Arcana',athletics:'Athletics',deception:'Deception',history:'History',insight:'Insight',intimidation:'Intimidation',investigation:'Investigation',medicine:'Medicine',nature:'Nature',perception:'Perception',performance:'Performance',persuasion:'Persuasion',religion:'Religion',sleightOfHand:'Sleight of Hand',stealth:'Stealth',survival:'Survival'}
export function abilityDisplayName(id: string, locale:Locale=i18n.global.locale.value) {return locale==='en'?(abilities[id]??id):(ABILITY_NAMES[id as Ability]??id)}
export function skillDisplayName(id:string,locale:Locale=i18n.global.locale.value){return locale==='en'?(skills[id]??id):(SKILLS[id]?.name??id)}
export function damageDisplayName(id:string,locale:Locale=i18n.global.locale.value){return locale==='en'?id.charAt(0).toUpperCase()+id.slice(1):(DAMAGE_NAMES[id as DamageType]??id)}
export function abilityDisplayNames(){return Object.fromEntries(Object.keys(abilities).map(id=>[id,abilityDisplayName(id)]))}
/** Return a presentation copy; IDs, eligibility and emitted selections remain canonical. */
export function choiceOptionPresentation(node:Choice,option:ChoiceOption,catalogue:Catalogue,locale:Locale=i18n.global.locale.value){
  if(locale!=='en')return option
  const spell=node.kind==='spell'?catalogue.spells.find(s=>s.id===option.id):undefined
  if(spell){const details=spellPresentation(spell,locale);return {...option,name:entryDisplayName(spell,locale),detail:[details.school,details.castingTime,details.range,spell.ritual?'Ritual':'',spell.concentration?'Concentration':''].filter(Boolean).join(' · ')}}
  if(SKILLS[option.id])return {...option,name:skillDisplayName(option.id,locale)}
  if(abilities[option.id])return {...option,name:abilityDisplayName(option.id,locale)}
  const choices=[...catalogue.feats,...catalogue.items,...catalogue.classes,...catalogue.species,...catalogue.backgrounds,...catalogue.subclasses].filter(e=>e.id===option.id&&e.name===option.name)
  return choices.length===1?{...option,name:entryDisplayName(choices[0]!,locale)}:{...option,name:ruleLabel(option.name,locale),detail:ruleLabel(option.detail,locale)}
}

/** Only for freshly derived check breakdowns, never journal or user text. */
export function checkReasonPresentation(text:string,locale:Locale=i18n.global.locale.value){
 if(locale!=='en')return text
 const match=/^(.+) ([+−-]?\d+)$/.exec(text)
 if(!match)return ruleLabel(text,locale)
 const ability=Object.entries(ABILITY_NAMES).find(([,name])=>name===match[1])?.[0]
 const label=ability?abilityDisplayName(ability,locale):({熟练:'Proficiency',特性:'Feature',力竭:'Exhaustion'} as Record<string,string>)[match[1]!]
 return label?label+' '+match[2]:ruleLabel(text,locale)
}
/** A fresh engine AC breakdown, not stored journal text. Keep custom item names intact. */
export function armorClassPresentation(text:string,catalogue:Catalogue,locale:Locale=i18n.global.locale.value){
 if(locale!=='en')return text
 const armor=catalogue.items.filter(item=>item.kind==='armor'&&text.startsWith(item.name+' ')).sort((a,b)=>b.name.length-a.name.length)[0]
 const prefix=armor?entryDisplayName(armor,locale):''
 let formula=armor?text.slice(armor.name.length):text
 formula=formula.replace(/^基础 /,'Base ').replace(/^无甲防御 /,'Unarmored Defense ').replace(/^耀目步法 /,'Dazzling Footwork ').replace(/^龙族韧性 /,'Draconic Resilience ')
 for(const [zh,en]of [['敏捷','Dexterity'],['体质','Constitution'],['感知','Wisdom'],['魅力','Charisma'],['盾牌','Shield'],['防御风格','Defense Fighting Style']])formula=formula.replaceAll(' + '+zh,' + '+en)
 return prefix+formula
}
