import {catalogue,newCharacter,assignRecommended,getChoices,reconcile,equipmentChoices,startingInventory,validate} from '../src/core/engine'
import {runtimeState} from '../src/core/runtime'
export function teachingCharacter(classId='fighter',name='晨铃') {
  const cat=catalogue(),c=newCharacter(),b=c.build
  Object.assign(b,{classId,speciesId:'human',backgroundId:classId==='wizard'?'sage':'soldier',name})
  assignRecommended(b)
  const bg=cat.backgrounds.find(x=>x.id===b.backgroundId)!
  b.boosts[bg.abilities[0]!]=2;b.boosts[bg.abilities[1]!]=1
  for(let pass=0;pass<8;pass++){for(const n of getChoices(b,cat)){const current=b.choices[n.id]??[];if(current.length<n.count)b.choices[n.id]=[...current,...n.options.filter(x=>!current.includes(x.id)).slice(0,n.count-current.length).map(x=>x.id)]}reconcile(b,cat)}
  for(const n of equipmentChoices(b,cat))b.equipmentChoices[n.id]=n.options.slice(0,n.count).map(x=>x.id)
  const errors=validate(b,cat);if(errors.length)throw Error(classId+': '+JSON.stringify(errors))
  c.status='complete';c.inventory=startingInventory(b,cat).inventory;c.runtime=runtimeState(c,cat)
  return c
}
