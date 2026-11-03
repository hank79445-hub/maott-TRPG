import type { SceneGeometry } from '../persistence/scene-effects-schema'
export const M4_TERRAIN_SPELLS = [
  'entangle',
  'grease',
  'web',
  'spike-growth',
  'plant-growth',
  'sleet-storm',
  'stinking-cloud',
] as const
export const isTerrainSpell = (id: string) => (M4_TERRAIN_SPELLS as readonly string[]).includes(id)
/** Pinned 2024 clauses: spell-audit-rules.ts. Radius and side length are different units. */
export const TERRAIN_RULES: Record<
  string,
  {
    shape: SceneGeometry['shape']
    size: number
    height: number
    range: number
    hours?: number
    multiplier: 1 | 2 | 4
    ground: boolean
    obscurity: 'none' | 'light' | 'heavy'
    color: string
  }
> = {
  entangle: {
    shape: 'square',
    size: 20,
    height: 0,
    range: 90,
    hours: 1 / 60,
    multiplier: 2,
    ground: true,
    obscurity: 'none',
    color: '#4f8753',
  },
  grease: {
    shape: 'square',
    size: 10,
    height: 0,
    range: 60,
    hours: 1 / 60,
    multiplier: 2,
    ground: true,
    obscurity: 'none',
    color: '#98683e',
  },
  web: {
    shape: 'cube',
    size: 20,
    height: 20,
    range: 60,
    hours: 1,
    multiplier: 2,
    ground: false,
    obscurity: 'light',
    color: '#b2c7ce',
  },
  'spike-growth': {
    shape: 'cylinder',
    size: 20,
    height: 0,
    range: 150,
    hours: 1 / 6,
    multiplier: 2,
    ground: true,
    obscurity: 'none',
    color: '#637a38',
  },
  'plant-growth': {
    shape: 'cylinder',
    size: 100,
    height: 0,
    range: 150,
    multiplier: 4,
    ground: true,
    obscurity: 'none',
    color: '#3b7544',
  },
  'sleet-storm': {
    shape: 'cylinder',
    size: 20,
    height: 40,
    range: 150,
    hours: 1 / 60,
    multiplier: 2,
    ground: true,
    obscurity: 'heavy',
    color: '#8caebb',
  },
  'stinking-cloud': {
    shape: 'sphere',
    size: 20,
    height: 0,
    range: 90,
    hours: 1 / 60,
    multiplier: 1,
    ground: false,
    obscurity: 'heavy',
    color: '#b4a649',
  },
}
