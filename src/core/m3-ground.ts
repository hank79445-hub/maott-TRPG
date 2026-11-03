import type {Adventure,MapScene} from './map-types'
export function m3GroundAt(a:Adventure,s:MapScene,p:{x:number;y:number}){
 const base=a.m3?.environments.find(e=>e.sceneId===s.id)?.floorHeight??0
 return Math.max(base,...(a.m3?.entities??[]).filter(e=>e.sceneId===s.id&&e.enabled&&e.kind==='surface'&&e.supportsStanding&&p.x>=e.x&&p.y>=e.y&&(p.x-e.x)*s.grid.feet<e.width&&(p.y-e.y)*s.grid.feet<e.depth).map(e=>e.height+e.heightFeet))
}
