import {i18n} from '../app/i18n'
import {zhCN,en} from '../content/locales/interface'
function pairs(zh:Record<string,unknown>,english:Record<string,unknown>,prefix=''): [string,string][] {
 return Object.entries(zh).flatMap(([key,value])=>typeof value==='string'&&typeof english[key]==='string'?[[value.replace(/\{'([@|])'\}/g,'$1'),prefix+key] as [string,string]]:value&&typeof value==='object'&&english[key]&&typeof english[key]==='object'?pairs(value as Record<string,unknown>,english[key] as Record<string,unknown>,prefix+key+'.'):[])
}
const keys=new Map(pairs(zhCN,en))
/** For program-defined UI labels only. Never pass saved prose or player messages. */
export function uiLabel(value:string):string
export function uiLabel(value:string|undefined|null):string|undefined
export function uiLabel(value:string|undefined|null){const item=value&&/^物品施法（([0-9])环）$/.exec(value);if(item&&i18n.global.locale.value==='en')return `Item spell (level ${item[1]})`;const key=value&&keys.get(value);return key?i18n.global.t(key):value??undefined}
