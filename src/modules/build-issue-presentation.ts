import {i18n} from '../app/i18n'
import {validationControls} from '../content/locales/validation-controls'
import {equipmentChoices,getChoices,selected,validate,type Catalogue} from '../core/engine'
import {choiceFeedback} from '../core/choice-feedback'
import type {Build,Issue} from '../core/types'
import type {Locale} from '../shared/localization/locale'
import {abilityDisplayName,ruleLabel} from './rule-presentation'
import {entryDisplayName} from './runtime-presentation'
import {displayFeedback} from './feedback-presentation'

const exact=new Map<string,string>(Object.entries(validationControls).map(([key,pair])=>[pair[0],key]))
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const templates=Object.entries(validationControls).filter(([,pair])=>/\{p\d+\}/.test(pair[0])).map(([key,pair])=>{
 const fields:string[]=[],parts=pair[0].split(/(\{p\d+\})/g)
 const pattern=parts.map(part=>/^\{p\d+\}$/.test(part)?(fields.push(part.slice(1,-1)),'([\\s\\S]*?)'):escape(part)).join('')
 return {key,fields,pattern:new RegExp('^'+pattern+'$','u')}
})
/** Only fresh validation output. Never pass a saved journal, character prose or chat. */
export function currentValidationText(text:string,locale:Locale=i18n.global.locale.value):string{
 if(locale!=='en')return text
 const key=exact.get(text)
 if(key)return i18n.global.t('validation.'+key,{}, {locale})
 const matches=text.length<=8000?templates.flatMap(row=>{const match=row.pattern.exec(text);return match?[{row,match}]:[]}):[]
 if(matches.length===1){const {row,match}=matches[0]!,args=Object.fromEntries(row.fields.map((field,index)=>[field,ruleLabel(match[index+1],locale)]));return i18n.global.t('validation.'+row.key,args,{locale})}
 return displayFeedback(text,'error')??text
}
export function buildIssuePresentation(issue:Issue,build:Build,cat:Catalogue,locale:Locale=i18n.global.locale.value):string{
 if(locale!=='en')return issue.message
 if(issue.key==='boosts'){
  const bg=cat.backgrounds.find(b=>b.id===build.backgroundId)
  return i18n.global.t('validation.boostRequirement',{allowed:bg?.abilities.map(id=>abilityDisplayName(id,locale)).join(', ')??'Choose a background',actual:JSON.stringify(build.boosts)},{locale})
 }
 const node=[...getChoices(build,cat),...equipmentChoices(build,cat)].find(node=>node.id===issue.key)
 if(node){
  const actual=node.step===4?build.equipmentChoices[node.id]??[]:selected(build,node.id),feedback=choiceFeedback(node,actual)
  // A feat prerequisite can share a key with a choice; do not mask it as a count error.
  if(feedback.messages.length&&issue.message===node.label+'：'+feedback.messages.join('；'))return i18n.global.t('validation.choiceRequirement',{label:ruleLabel(node.label,locale),expected:node.count,actual:actual.length,valid:feedback.validCount,duplicates:feedback.duplicates.join(', ')||'None',invalid:feedback.invalid.join(', ')||'None'},{locale})
 }
 if(issue.key.startsWith('feat-')){
  const feat=cat.feats.find(feat=>feat.id===issue.key.slice(5))
  if(feat&&issue.message.startsWith(feat.name+'：'))return i18n.global.t('validation.featRequirement',{name:entryDisplayName(feat,locale),reason:issue.message.slice(feat.name.length+1).split('；').map(text=>currentValidationText(text,locale)).join('; ')},{locale})
 }
 return currentValidationText(issue.message,locale)
}
export function growthIssuePresentations(messages:string[],build:Build,cat:Catalogue,locale:Locale=i18n.global.locale.value){
 if(locale!=='en')return messages
 const byMessage=new Map(validate(build,cat,{existingCharacter:true}).map(issue=>[issue.message,issue]))
 return messages.map(message=>{const issue=byMessage.get(message);return issue?buildIssuePresentation(issue,build,cat,locale):currentValidationText(message,locale)})
}
