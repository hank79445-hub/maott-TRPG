import {i18n} from '../app/i18n'
const dates=new Map<string,Intl.DateTimeFormat>()
/** Presentation only: never use formatted dates in ordering, storage or protocol fields. */
export function uiDate(value:string|number|Date,kind:'date'|'time'|'datetime'='datetime',options:Intl.DateTimeFormatOptions={}){
 const date=value instanceof Date?value:new Date(value)
 if(!Number.isFinite(date.getTime()))return String(value)
 const locale=i18n.global.locale.value
 const defaults:Intl.DateTimeFormatOptions=kind==='time'?{hour:'2-digit',minute:'2-digit',second:'2-digit'}:kind==='date'?{year:'numeric',month:'2-digit',day:'2-digit'}:{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}
 const key=locale+':'+kind+':'+JSON.stringify(options)
 let formatter=dates.get(key)
 if(!formatter){formatter=new Intl.DateTimeFormat(locale,{...defaults,...options});if(dates.size>=64)dates.clear();dates.set(key,formatter)}
 return formatter.format(date)
}
