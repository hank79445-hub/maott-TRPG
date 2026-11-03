import type {Room} from '../online/protocol'
import {practicalEnabled,practicalState} from './practical-review-state'
import {advancePracticalCombat} from './practical-combat'
import {advanceNpcDice} from './room-dice'
import {schedulePracticalNpc,finishPracticalPlanning} from './practical-planning'
import {queuePracticalEffects,advancePracticalEffects} from './practical-effects'
import type {MapWorld} from '../core/map-types'
import {clone} from '../core/engine'
/** Bounded rule-only progression. Idle polling never creates a new model decision. */
export function advancePracticalFlow(room:Room,before?:MapWorld){
 if(before)queuePracticalEffects(room,before)
 advancePracticalEffects(room)
 if(!practicalEnabled(room,'combat'))return
 for(let step=0;step<4;step++){
  const prior=clone(room.world)
  const before=JSON.stringify([room.worldRevision,room.world.encounters.map(e=>[e.id,e.tick,e.current,e.pending?.id]),room.world.adventures[0]?.aiLog?.turns])
  advancePracticalCombat(room)
  if(room.dice?.pending.length)return
  advanceNpcDice(room);schedulePracticalNpc(room)
  queuePracticalEffects(room,prior);advancePracticalEffects(room)
  for(const run of room.world.adventures[0]?.aiLog?.turns??[])if(run.state==='completed'){const job=room.world.adventures[0]?.aiLog?.jobs.find(j=>j.id===run.jobId);if(job)finishPracticalPlanning(room,job)}
  const after=JSON.stringify([room.worldRevision,room.world.encounters.map(e=>[e.id,e.tick,e.current,e.pending?.id]),room.world.adventures[0]?.aiLog?.turns])
  if(before===after)return
 }
 practicalState(room).combatNeedsAdvance=true
}
