import type { Locale } from './locale'
/** Compatibility text is preserved; codes never depend on the viewer's language. */
const definitions = {
 'request.failed':['请求失败','Request failed'],
 'request.jsonRequired':['需要 JSON 请求','A JSON request is required'],
 'request.tooLarge':['请求超过大小限制','The request exceeds the size limit'],
 'request.invalidJson':['JSON 格式不正确','Invalid JSON'],
 'request.notFound':['未找到','Not found'],
 'auth.required':['请先登录','Please sign in first'],
 'auth.forbidden':['无权执行此操作','You do not have permission to perform this operation'],
 'room.host':['请求主机不允许','This request host is not allowed'],
 'room.missing':['房间不存在','Room not found'],
 'room.identity':['身份凭证无效','Invalid identity credential'],
 'room.gmOnly':['只有 GM 可以执行此操作','Only the GM can perform this operation'],
 'asset.background':['背景图片读取失败','Could not load the map background'],
 'asset.script':['剧本图片读取失败','Could not load the script image'],
 'script.failed':['剧本请求失败','Script request failed'],
 'submission.locked':['原提交内容已锁定，请先查询其结果','The submitted request is locked. Check its result first.'],
 'submission.switched':['房间连接已切换，请回原房间核对本次结果','The room connection changed. Return to the original room to check this result.'],
 'http.badRequest':['请求内容或规则条件不符合要求','The request or rule requirements are not valid'],
 'http.unauthorized':['需要有效身份或授权','A valid identity or authorization is required'],
 'http.forbidden':['没有执行权限','Permission denied'],
 'http.notFound':['请求的资源不存在','The requested resource was not found'],
 'http.conflict':['相关状态已变化或存在冲突','The relevant state has changed or conflicts with this request'],
 'http.tooLarge':['内容超过允许大小','The content exceeds the allowed size'],
 'http.rateLimit':['调用频率或预算达到上限','The request rate or budget limit has been reached'],
 'http.upstream':['上游服务未能完成请求','The upstream service could not complete the request'],
 'http.unavailable':['服务暂不可用','The service is temporarily unavailable'],
 'http.timeout':['服务请求超时','The service request timed out'],
 'http.failed':['请求未能完成','The request could not be completed'],
} as const
export type ErrorCode=keyof typeof definitions
export interface ErrorEnvelope {error:string;code?:ErrorCode;params?:Record<string,never>}
const codes=new Map<string,ErrorCode>(Object.entries(definitions).map(([key,text])=>[text[0],key as ErrorCode]))
const httpCodes:Record<number,ErrorCode>={400:'http.badRequest',401:'http.unauthorized',403:'http.forbidden',404:'http.notFound',409:'http.conflict',413:'http.tooLarge',429:'http.rateLimit',502:'http.upstream',503:'http.unavailable',504:'http.timeout'}
export function errorEnvelope(value:unknown,status?:number):unknown{
 if(!value||typeof value!=='object'||!('error' in value)||typeof value.error!=='string')return value
 const code=codes.get(value.error)??(status&&status>=400?httpCodes[status]??'http.failed':undefined)
 return code?{...value,code,params:{}}:value
}
export function errorPresentation(message:string,locale:Locale,code?:string,status?:number){
 const key=code&&Object.hasOwn(definitions,code)?code as ErrorCode:codes.get(message)
 if(key?.startsWith('http.'))return locale==='en'?definitions[key][1]+'.\n[Original detail] '+message:message
 if(!key&&locale==='en'&&/\p{Script=Han}/u.test(message))return definitions[httpCodes[status??0]??'http.failed'][1]+'.\n[Original detail · translation unavailable] '+message
 return key?definitions[key][locale==='en'?1:0]:message
}
export function hasErrorTranslation(message:string,code?:string){return !!(codes.has(message)||(code&&Object.hasOwn(definitions,code)))}
