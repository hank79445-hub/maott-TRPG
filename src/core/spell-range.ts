/** Effective normal range; metamagic is applied by the caller afterwards. */
export function spellRangeFeet(id:string,range:string,level:number,fallback=0){
 if(id==='spare-the-dying')return 15*(level>=17?8:level>=11?4:level>=5?2:1)
 if(range==='Touch')return 5
 return Number(range.match(/(\d+)\s*feet/i)?.[1]??fallback)
}
