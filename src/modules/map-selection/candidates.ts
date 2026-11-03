import type { MapCandidate, PickKind, SelectionScene } from './selection'
/** Intersect original form options with the current projected map; no name matching. */
export function fieldMapCandidates(
  scene: SelectionScene,
  options: { id: string; name: string }[],
  kind: PickKind,
  gm = false,
): MapCandidate[] {
  return options.flatMap<MapCandidate>((o) => {
    const token =
      kind === 'entity' &&
      scene.tokens.find(
        (t) => [t.id, t.actorId, t.characterId, t.npcId].includes(o.id) && (gm || !t.hidden),
      )
    if (token) return [{ ...o, x: token.x, y: token.y, span: token.span, kind, hitId: token.id }]
    const corpse = kind === 'entity' && scene.corpses?.find(c => c.id === o.id || c.entityId === o.id || c.recordId === o.id)
    if (corpse) return [{ ...o, x: corpse.x, y: corpse.y, kind, hitId: corpse.id }]
    const point = kind === 'point' && scene.points.find((p) => p.id === o.id && (gm || !p.hidden))
    if (point) return [{ ...o, ...(point.displayPosition ?? { x: point.x, y: point.y }), kind, hitId: point.id }]
    const object =
      (kind === 'surface' || kind === 'entity') && scene.spatialObjects?.find((p) => p.id === o.id)
    if (object) return [{ ...o, x: object.x, y: object.y, kind, hitId: object.id }]
    const ground = kind === 'ground' && scene.groundItems?.find((p) => p.id === o.id)
    if (ground) return [{ ...o, x: ground.x, y: ground.y, kind, hitId: ground.id }]
    const registered = scene.registeredMarkers?.find((p) => p.id === o.id)
    if (registered) return [{ ...registered, ...o, kind }]
    const wall = kind === 'surface' && scene.walls?.find((w) => w.id === o.id && (gm || !w.hidden))
    if (wall)
      return [
        {
          ...o,
          x: Math.min(scene.grid.columns - 1, Math.floor((wall.a.x + wall.b.x) / 2)),
          y: Math.min(scene.grid.rows - 1, Math.floor((wall.a.y + wall.b.y) / 2)),
          kind,
          hitId: wall.id,
        },
      ]
    const region =
      kind === 'region' &&
      (scene.regions?.find((p) => p.id === o.id) ||
        scene.sceneEffects?.regions.find((p) => p.id === o.id))
    if (region && region.cells.length && (!('hidden' in region) || gm || !region.hidden)) {
      const [x, y] = region.cells[0]!.split(',').map(Number)
      return Number.isFinite(x) && Number.isFinite(y)
        ? [{ ...o, x: x!, y: y!, cells: region.cells, kind, hitId: region.id }]
        : []
    }
    return []
  })
}
