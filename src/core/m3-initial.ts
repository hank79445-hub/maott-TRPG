import type {Adventure} from './map-types'
import {m3State} from './m3-world-cast'
export function initialiseM3Scenes(a:Adventure){
 for(const s of a.scenes){const setup=s.spatialSetup;if(!setup)continue;const state=m3State(a)
  if(!state.environments.some(e=>e.sceneId===s.id))state.environments.push({sceneId:s.id,floorHeight:setup.floorHeight,light:setup.light,openSky:setup.openSky,ceilingHeight:setup.ceilingHeight})
  for(const object of setup.objects){if(object.x>=s.grid.columns||object.y>=s.grid.rows)throw Error('初始空间物件超出场景：'+object.name);if(!state.entities.some(e=>e.id===object.id))state.entities.push({...structuredClone(object),sceneId:s.id})}
 }
 for(const n of a.ai?.npcs??[])for(const gear of n.body?.equipment??[]){const object=a.m3?.entities.find(o=>o.id===gear.objectId);if(object){object.inventoryInstanceId=gear.id;if(gear.held)object.boundCharacterId=n.id}}
}
