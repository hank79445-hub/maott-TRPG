import type { ActiveEffect } from './types'
/** A failed/countered casting has never applied Haste and cannot cause lethargy.
 * A dormant second source prevents ending the actual Haste benefit. */
export function rememberEndedHaste(before: ActiveEffect[], after: ActiveEffect[], context: {
  hours: number; encounterId?: string; nextEndTick?: number;tick?:number;actors?:number;clockSourceId?:string
}): ActiveEffect[] {
  if (!before.some(f=>f.key==='haste') || after.some(f=>f.key==='haste'||f.key==='haste-lethargy')) return after
  const source=[...before].reverse().find(f=>f.key==='haste')!
  return [...after,{
    id:crypto.randomUUID(),key:'haste-lethargy',name:'加速术结束：迟滞',sourceId:source.sourceId,
    spellId:'haste',castId:source.castId,page:source.page,concentration:false,
    expiresAt:context.nextEndTick??null,encounterId:context.encounterId??'outside',phase:'end',
    endsAt:context.hours+(context.encounterId?Math.max(1,(context.nextEndTick??0)-(context.tick??0)+1)/(600*Math.max(1,context.actors??1)):1/600),
    clockSourceId:context.clockSourceId??source.clockSourceId,condition:'incapacitated',speedZero:true,
    note:'加速术已结束；直到受术者下个回合结束不能行动或移动',
  }]
}
