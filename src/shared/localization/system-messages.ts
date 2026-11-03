import {definitions} from '../../content/locales/system-message-definitions'
import {systemMessageFunctions} from '../../content/locales/system-message-functions'
import { createCoreContext, translate, resolveWithKeyValue } from '@intlify/core-base'
import { z } from 'zod'
import type { Locale } from './locale'

export type SystemMessageKey = keyof typeof definitions
export type SystemMessageArgs=Record<string,string|number|string[]>
export interface LocalizedMessage { key: string; args: SystemMessageArgs }
const valid = (value: {key:string;args:SystemMessageArgs}) => {
  if (!Object.hasOwn(definitions,value.key)) return false
  const expected=definitions[value.key as SystemMessageKey].args as readonly string[],keys=Object.keys(value.args)
  const definition=definitions[value.key as SystemMessageKey]
  const lists='lists' in definition?definition.lists as readonly string[]:[]
  return keys.length===expected.length && keys.every(k=>expected.includes(k)&&Array.isArray(value.args[k])===lists.includes(k))
}
export const localizedMessageSchema = z.object({key:z.string().max(120),args:z.record(z.string().max(80),z.union([z.string().max(2000),z.number().finite(),z.array(z.string().max(120)).max(40)]))}).strict().refine(valid,'本地化消息键或参数不匹配')
export function systemMessage(key: SystemMessageKey,args:SystemMessageArgs = {}): LocalizedMessage {
  return localizedMessageSchema.parse({key,args})
}
const contexts = {
  'zh-CN':createCoreContext({messageResolver:resolveWithKeyValue,locale:'zh-CN',fallbackLocale:'zh-CN',messages:{'zh-CN':systemMessageFunctions['zh-CN']}}),
  en:createCoreContext({messageResolver:resolveWithKeyValue,locale:'en',fallbackLocale:'en',messages:{en:systemMessageFunctions.en}}),
}
function displayArgs(args:SystemMessageArgs,locale:Locale) {
 return Object.fromEntries(Object.entries(args).map(([key,value])=>[key,Array.isArray(value)?value.join(locale==='en'?', ':'、')||(locale==='en'?'None':'无'):value]))
}
export function formatSystemText(locale:Locale,key:SystemMessageKey,args:SystemMessageArgs={}) {
  localizedMessageSchema.parse({key,args})
  return String(translate(contexts[locale],key+'.text',displayArgs(args,locale)))
}
export function localizedEvent<T extends {title:string;text:string;message?:unknown}>(event:T,locale:Locale) {
  const parsed=localizedMessageSchema.safeParse(event.message)
  if(!parsed.success)return {title:event.title,text:event.text}
  const {key,args}=parsed.data,context=contexts[locale]
  const rendered=displayArgs(args,locale)
  const definition=definitions[key as SystemMessageKey]
  // Authored content is never translated with UI labels. Technical logs retain exact
  // original detail, visibly marked in English, without copying it into public args.
  const text='originalText' in definition
    ? definition.originalText==='diagnostic'&&locale==='en'&&/\p{Script=Han}/u.test(event.text)
      ? '[Original rule-engine detail · translation unavailable] '+event.text
      : event.text
    : String(translate(context,key+'.text',rendered))
  return {title:String(translate(context,key+'.title',rendered)),text}
}
