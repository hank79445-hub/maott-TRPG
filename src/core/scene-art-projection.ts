import { wallState } from './map-spatial'
import {
  artBriefSchema,
  artPolicySchema,
  type SceneArtBrief,
  type SceneArtPolicy,
} from '../persistence/scene-art-schema'
import type { MapScene } from './map-types'
export type ArtScene = Pick<MapScene, 'id' | 'name' | 'grid' | 'regions' | 'walls'> &
  Partial<
    Pick<
      MapScene,
      'art' | 'points' | 'groundItems' | 'artCalibration' | 'environment' | 'boundaryWalls'
    >
  >
export interface SceneArtDocument {
  doorObjectIndexes?: number[]
  environment?: 'outdoor' | 'indoor' | 'mixed'
  boundaryWalls?: 'explicit-only' | 'auto-enclose'
  format: 'trpg-scene-art'
  version: 1
  policyVersion: 1
  canvas: {
    columns: number
    rows: number
    pixelWidth: number
    pixelHeight: number
    feet: number
    origin: 'top-left'
    mapping: {
      originX: number
      originY: number
      offsetX: number
      offsetY: number
      cellPixels: number
    }
  }
  geometry: {
    objects: {
      label: string
      description: string
      x: number
      y: number
      width: number
      height: number
      rotation: number
    }[]
    floor: string[]
    walls: {
      a: { x: number; y: number }
      b: { x: number; y: number }
      kind: 'wall' | 'door'
      open: boolean
    }[]
    terrain: { cells: string[]; tags: string[]; height: number | null }[]
  }
  brief: SceneArtBrief
  policy: SceneArtPolicy
}
export function projectSceneArt(
  scene: ArtScene,
  brief?: Partial<SceneArtBrief>,
  policy?: Partial<SceneArtPolicy>,
): SceneArtDocument {
  const b = artBriefSchema.parse({ ...scene.art, ...brief }),
    p = artPolicySchema.parse(policy ?? {})
  const { columns, rows, feet } = scene.grid
  if (
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 1 ||
    rows < 1 ||
    columns > 80 ||
    rows > 80
  )
    throw Error('场景网格尺寸无效')
  const regions = scene.regions.filter((r) => !r.hidden || p.includeHiddenGeometry)
  const blocked = new Set(regions.filter((r) => r.tags.includes('blocked')).flatMap((r) => r.cells))
  const floor: string[] = []
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) if (!blocked.has(`${x},${y}`)) floor.push(`${x},${y}`)
  const walls = (scene.walls ?? [])
    .filter((w) => !w.hidden || p.includeHiddenGeometry)
    .map((w) => {
      const swap = w.a.x > w.b.x || (w.a.x === w.b.x && w.a.y > w.b.y)
      const a = swap ? w.b : w.a,
        b = swap ? w.a : w.b
      return {
        a: { x: a.x, y: a.y },
        b: { x: b.x, y: b.y },
        kind: w.kind,
        open: w.kind === 'door' && wallState({ points: scene.points ?? [] }, w) === 'open',
      }
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const terrain = regions
    .flatMap((r) => {
      const tags = r.tags.filter((t) => ['high', 'difficult'].includes(t)).sort()
      return tags.length ? [{ cells: [...r.cells].sort(), tags, height: r.height }] : []
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const objects = (scene.points ?? [])
    .flatMap((point) => {
      const a = point.appearance
      if (!a || a.visibility === 'omit' || (point.hidden && a.visibility !== 'surface')) return []
      return [
        {
          label: a.label,
          description: a.description,
          x: point.x,
          y: point.y,
          width: a.width,
          height: a.height,
          rotation: a.rotation,
        },
      ]
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return {
    ...(scene.environment ? { environment: scene.environment } : {}),
    ...(scene.boundaryWalls ? { boundaryWalls: scene.boundaryWalls } : {}),
    format: 'trpg-scene-art',
    version: 1,
    policyVersion: 1,
    canvas: {
      columns,
      rows,
      pixelWidth: columns * 32,
      pixelHeight: rows * 32,
      feet,
      origin: 'top-left',
      mapping: {
        originX: scene.grid.originX,
        originY: scene.grid.originY,
        offsetX: scene.grid.offsetX ?? 0,
        offsetY: scene.grid.offsetY ?? 0,
        cellPixels: scene.grid.cellPixels ?? 64,
      },
    },
    doorObjectIndexes: objects.flatMap((o, i) =>
      (scene.points ?? []).some(
        (p) =>
          p.kind === 'door' &&
          !p.hidden &&
          p.appearance?.visibility !== 'omit' &&
          p.x === o.x &&
          p.y === o.y &&
          p.appearance?.label === o.label &&
          p.appearance?.description === o.description,
      )
        ? [i]
        : [],
    ),
    geometry: { floor, walls, terrain, objects },
    brief: b,
    policy: p,
  }
}
export const artDigest = (value: unknown) =>
  artBytesDigest(new TextEncoder().encode(JSON.stringify(value)))
export async function artBytesDigest(bytes: Uint8Array) {
  // WebCrypto SHA-256 is available on the private HTTPS and localhost entry points.
  if (!globalThis.crypto?.subtle) throw Error('生图指纹需要HTTPS或localhost安全入口')
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
export const sceneArtFingerprint = (doc: SceneArtDocument) =>
  artDigest({
    ...(doc.environment ? { environment: doc.environment } : {}),
    ...(doc.boundaryWalls ? { boundaryWalls: doc.boundaryWalls } : {}),
    canvas: doc.canvas,
    // Preserve pre-enhancement fingerprints when no explicit visual objects exist.
    geometry: {
      floor: doc.geometry.floor,
      walls: doc.geometry.walls,
      terrain: doc.geometry.terrain,
      ...(doc.geometry.objects.length ? { objects: doc.geometry.objects } : {}),
    },
    policy: { includeHiddenGeometry: doc.policy.includeHiddenGeometry },
    policyVersion: doc.policyVersion,
  })
