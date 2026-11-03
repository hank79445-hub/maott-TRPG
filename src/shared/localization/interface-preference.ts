import {localeSchema,type Locale} from './locale'
// Public presentation preference only; never a session or room identity credential.
export const INTERFACE_LOCALE_COOKIE='trpg_ui_locale_v1'
export function interfaceLocaleFromCookie(header:string|undefined):Locale|undefined{
 const values=(header??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(INTERFACE_LOCALE_COOKIE+'='))
 if(values.length!==1)return undefined
 const result=localeSchema.safeParse(values[0]!.slice(INTERFACE_LOCALE_COOKIE.length+1))
 return result.success?result.data:undefined
}
export function interfaceLocaleCookie(locale:Locale,secure=false){
 return `${INTERFACE_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure?'; Secure':''}`
}
