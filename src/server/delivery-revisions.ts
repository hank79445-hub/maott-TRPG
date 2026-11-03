import type {Room} from '../online/protocol'
/** Only a contiguous interval of proven timing-only updates can be rebased.
 * Restart, unrelated writes, real choices and expiry all break that interval. */
export class DeliveryRevisions {
 private ranges=new Map<string,{from:number;to:number}>()
 allows(id:string,base:number,current:number){const range=this.ranges.get(id);return !!range&&range.to===current&&base>=range.from&&base<=current}
 record(id:string,before:number,after:number,timingOnly:boolean){
  if(!timingOnly||after!==before+1){this.ranges.delete(id);return}
  const old=this.ranges.get(id);this.ranges.set(id,{from:old?.to===before?old.from:before,to:after})
 }
 clear(id:string){this.ranges.delete(id)}
}
// Persist may reconcile other subsystems. Compare the whole room, not just the
// reaction window, so those changes never inherit timing-only compatibility.
export function deliverySemantics(room:Room){
 const {revision:_revision,receipts:_receipts,lastSavedAt:_saved,practicalReview,...business}=room
 const timingFree=practicalReview===undefined?undefined:JSON.parse(JSON.stringify(practicalReview,(key,item)=>['lastSeen','lastSeenAt','deadlineAt','remainingMs'].includes(key)?undefined:item))
 return JSON.stringify({...business,practicalReview:timingFree})
}
