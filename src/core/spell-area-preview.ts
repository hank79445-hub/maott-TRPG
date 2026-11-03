import type { MapScene, MapTemplate, MapToken, Position } from './map-types'
import { areaTargets, makeAreaTemplate, validateSpellArea, type AreaSpec } from './map-area'

/** Only pass the scene visible to the caller; never fetch hidden scene data for a player. */
export type AreaPreviewScene = Pick<
  MapScene,
  'id' | 'name' | 'grid' | 'background' | 'tokens' | 'walls'
> & { points: Pick<MapScene['points'][number], 'id' | 'state'>[] }
export function previewScene(scene: AreaPreviewScene, gm = false): MapScene {
  return {
    ...scene,
    tokens: scene.tokens.filter((t) => gm || !t.hidden),
    walls: scene.walls
      ?.filter((w) => gm || !w.hidden)
      .map((w) => {
        const state =
          w.kind === 'door' && w.pointId
            ? (scene.points.find((p) => p.id === w.pointId)?.state ?? w.state)
            : w.state
        return {
          ...w,
          state:
            state === 'open'
              ? ('open' as const)
              : state === 'locked'
                ? ('locked' as const)
                : ('closed' as const),
          pointId: null,
        }
      }),
    note: '',
    regions: [],
    points: [],
    annotations: [],
    encounterId: null,
    template: null,
    highGround: { enabled: false, weapon: false, thrown: false, spell: false },
  }
}
export function aimedSpellTemplate(
  scene: AreaPreviewScene,
  from: MapToken,
  spec: AreaSpec,
  aim: Position,
  angle = 0,
): MapTemplate {
  const t = makeAreaTemplate(scene.grid, from, spec)
  if (spec.shape === 'emanation') return t
  const caster = { x: from.x + from.span / 2, y: from.y + from.span / 2 }
  if (spec.self && ['cone', 'line'].includes(spec.shape)) {
    t.origin = caster
    t.angle = (Math.atan2(aim.y + 0.5 - caster.y, aim.x + 0.5 - caster.x) * 180) / Math.PI
    return t
  }
  if (spec.shape === 'cube' && spec.originRule !== 'center') {
    // Four cardinal faces keep the existing integer-cell template contract exact.
    t.angle = (((Math.round(angle / 90) * 90) % 360) + 360) % 360
    const a = (t.angle * Math.PI) / 180,
      half = spec.size / scene.grid.feet / 2
    const origin = spec.self ? caster : { x: aim.x + 0.5, y: aim.y + 0.5 }
    t.x = Math.round(origin.x + half * Math.cos(a) - 0.5)
    t.y = Math.round(origin.y + half * Math.sin(a) - 0.5)
    return t
  }
  if (!spec.self) {
    t.x = aim.x
    t.y = aim.y
  }
  t.angle = angle
  return t
}
export function spellAreaPreview(
  scene: AreaPreviewScene,
  from: MapToken,
  spec: AreaSpec,
  template: MapTemplate,
  gm = false,
) {
  const safe = previewScene(scene, gm)
  let error = ''
  try {
    validateSpellArea(safe, from, template, spec)
  } catch (e) {
    error = (e as Error).message
  }
  return { error, candidates: areaTargets(safe, template).filter((r) => r.inside && !(spec.self && template.includeOrigin === false && r.token.id === from.id)) }
}
