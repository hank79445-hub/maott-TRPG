import type { SceneGeometry } from '../persistence/scene-effects-schema'
/** Broad phase only: consumers must still run their exact geometry predicate. */
export function geometryCellBounds(g: SceneGeometry, feet: number, columns: number, rows: number) {
  const cx = g.x + g.originSpan / 2, cy = g.y + g.originSpan / 2
  let minX: number, maxX: number, minY: number, maxY: number
  if (g.shape === 'wall' && g.points?.length) {
    minX = Math.min(...g.points.map(p => p.x)) - g.width / feet
    maxX = Math.max(...g.points.map(p => p.x)) + g.width / feet
    minY = Math.min(...g.points.map(p => p.y)) - g.width / feet
    maxY = Math.max(...g.points.map(p => p.y)) + g.width / feet
  } else if (g.shape === 'line') {
    const angle = g.angle * Math.PI / 180, x = cx + Math.cos(angle) * g.size / feet, y = cy + Math.sin(angle) * g.size / feet
    const pad = g.width / feet + g.originSpan
    minX = Math.min(cx,x)-pad; maxX = Math.max(cx,x)+pad
    minY = Math.min(cy,y)-pad; maxY = Math.max(cy,y)+pad
  } else {
    const radius = g.size / feet * (g.shape === 'cube' || g.shape === 'square' ? Math.SQRT2 / 2 : 1) + g.originSpan
    minX=cx-radius; maxX=cx+radius; minY=cy-radius; maxY=cy+radius
  }
  if (![minX,maxX,minY,maxY].every(Number.isFinite)) return { minX:0,minY:0,maxX:columns-1,maxY:rows-1 }
  return { minX:Math.max(0,Math.floor(minX)-1),minY:Math.max(0,Math.floor(minY)-1),maxX:Math.min(columns-1,Math.ceil(maxX)+1),maxY:Math.min(rows-1,Math.ceil(maxY)+1) }
}
