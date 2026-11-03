import type { Adventure, MapScene } from '../../core/map-types'
import type { MapCandidate } from './selection'
/** GM-only registry geometry. An unknown corpse position is deliberately absent. */
export function gmMapMarkers(scene: MapScene, adventure?: Adventure): MapCandidate[] {
  const markers: MapCandidate[] = (adventure?.m1Utility?.objects ?? [])
    .filter((o) => o.sceneId === scene.id)
    .map((o) => ({ id: o.id, name: o.name, x: o.x, y: o.y, kind: 'surface' }))
  for (const c of adventure?.m1Utility?.corpses ?? []) {
    if (c.sceneId !== scene.id || !c.dead) continue
    const t = [...scene.tokens, ...(scene.defeatedTokens ?? [])].find((t) =>
      [t.id, t.characterId, t.npcId, t.actorId].includes(c.entityId),
    )
    if (!t) continue
    for (const id of [c.id, c.entityId])
      markers.push({
        id,
        name: t.name + '（遗体）',
        x: t.x,
        y: t.y,
        span: t.span,
        kind: 'entity',
        hitId: t.id,
      })
  }
  return markers
}
