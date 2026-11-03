import {computed} from 'vue'
import type {RoomView} from '../../online/protocol'
import {catalogue} from '../../core/engine'
import {srd} from '../../content/srd'
import {m1Entity} from '../../core/m1-utility'
export function useM3View(view:()=>RoomView){
  const world=computed(()=>view().world),adventure=computed(()=>world.value?.adventures[0])
  const scene=computed(()=>adventure.value?.scenes.find(s=>s.id===adventure.value?.activeSceneId))
  const cat=computed(()=>catalogue([srd,...world.value?.packs??[]]))
  const people=computed(()=>scene.value?.tokens.flatMap(t=>{
    const entity=world.value&&adventure.value&&m1Entity(world.value,adventure.value,t.characterId??t.npcId??t.actorId??t.id)
    return entity?[{id:entity.id,name:t.name,token:t,entity}]:[]
  })??[])
  return {world,adventure,scene,cat,people,state:computed(()=>adventure.value?.m3)}
}
