/** Internal synchronous evidence scope, never accepted from a client payload. */
let scope:{sourceId:string;key:string;hours:number}|undefined
export function completedCasting(sourceId:string,key:string){return scope?.sourceId===sourceId&&scope.key===key?scope.hours:0}
export function withCompletedCasting<T>(sourceId:string,key:string,hours:number,run:()=>T):T{
 const old=scope;scope={sourceId,key,hours};try{return run()}finally{scope=old}
}
