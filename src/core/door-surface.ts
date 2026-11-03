import type { Catalogue } from './engine'
import type { Adventure, MapPoint, MapScene, MapToken, MapWorld, Position } from './map-types'
import { tokenPerception, m3PerceptionCache } from './m3-map-perception'
import { sightLine } from './map-spatial'

export function doorSurfaces(s:MapScene,p:MapPoint,from:MapToken) {
  const rows:{display:Position;probe:Position}[]=[]
  for(const w of s.walls??[]){
    if(w.kind!=='door'||w.pointId!==p.id||w.hidden)continue
    const dx=w.b.x-w.a.x,dy=w.b.y-w.a.y,l2=dx*dx+dy*dy;if(!l2)continue
    const x=from.x+from.span/2,y=from.y+from.span/2,t=Math.max(.001,Math.min(.999,((x-w.a.x)*dx+(y-w.a.y)*dy)/l2))
    const surface={x:w.a.x+t*dx,y:w.a.y+t*dy},d=Math.hypot(x-surface.x,y-surface.y)
    const directions=d>.00001?[{x:(x-surface.x)/d,y:(y-surface.y)/d}]:[{x:-dy/Math.sqrt(l2),y:dx/Math.sqrt(l2)},{x:dy/Math.sqrt(l2),y:-dx/Math.sqrt(l2)}]
    for(const v of directions)rows.push({display:{x:surface.x-.5,y:surface.y-.5},probe:{x:surface.x+v.x*.01,y:surface.y+v.y*.01}})
  }
  if(!rows.length&&!(s.walls??[]).some(w=>w.kind==='door'&&w.pointId===p.id))rows.push({display:{x:p.x,y:p.y},probe:{x:p.x+.5,y:p.y+.5}})
  return rows
}
/** The door's own plane is the destination, not a wall beyond the destination. */
export function doorInteractionPosition(s:MapScene,p:MapPoint,from:MapToken) {
  const walls=(s.walls??[]).filter(w=>w.pointId!==p.id)
  return doorSurfaces(s,p,from).find(r=>sightLine({...s,walls},from,r.display,'blocksTargeting').clear)?.display??p
}

/** Real door surface, approached from the observer side; never reveal the far cell. */
export function visibleDoorSurface(
  world: MapWorld, a: Adventure, s: MapScene, p: MapPoint,
  from: MapToken, cat: Catalogue,
  allowedCell?: (p: Position) => boolean,
  cache = m3PerceptionCache(),
): { display: Position; probe: Position } | undefined {
  if (p.kind !== 'door' || p.hidden || !p.enabled) return
  for (const {display,probe} of doorSurfaces(s,p,from)) {
    const cell = { x: Math.floor(probe.x), y: Math.floor(probe.y) }
    if (allowedCell && !allowedCell(cell)) continue
    const target: MapToken = { id: 'door-surface:' + p.id, name: '', x: probe.x - .5, y: probe.y - .5,
      span: 1, characterId: null, actorId: null, hidden: false, color: '#000', facing: 0,
      spatial: { height: 0, layer: 'material' } }
    const onPlane=Math.hypot(from.x+from.span/2-display.x-.5,from.y+from.span/2-display.y-.5)<.00001
    const eye=onPlane?{...from,x:from.x+probe.x-display.x-.5,y:from.y+probe.y-display.y-.5}:from
    if (tokenPerception(world, a, s, eye, target, cat, false, cache).canSee)
      return { display, probe }
  }
}
