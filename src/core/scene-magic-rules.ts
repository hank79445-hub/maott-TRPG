export const M4_LEGACY_ZONES = [
  'moonbeam',
  'spirit-guardians',
  'cloud-of-daggers',
  'hunger-of-hadar',
  'cordon-of-arrows',
] as const
export const M4_WIND_SPELLS = ['silence', 'gust-of-wind', 'wind-wall'] as const
export const M4_ZONE_SPELLS = [
  ...M4_LEGACY_ZONES,
  'flaming-sphere',
  'call-lightning',
  'conjure-animals',
] as const
export const M4_DEVICE_SPELLS = [
  'arcane-lock',
  'knock',
  'alarm',
  'magic-mouth',
  'glyph-of-warding',
] as const
export const M4_BARRIER_SPELLS = ['tiny-hut', 'magic-circle'] as const
export const M4_MAGIC_SPELLS = [
  ...M4_WIND_SPELLS,
  ...M4_ZONE_SPELLS,
  ...M4_DEVICE_SPELLS,
  ...M4_BARRIER_SPELLS,
]
export const isMagicSceneSpell = (id: string) => (M4_MAGIC_SPELLS as readonly string[]).includes(id)
export const MAGIC_RULES: Record<
  string,
  {
    range: number
    hours?: number
    shape: 'sphere' | 'cylinder' | 'cube' | 'emanation' | 'line' | 'wall'
    size: number
    height: number
    action?: 'action' | 'bonus'
    color: string
  }
> = {
  silence: { range: 120, hours: 1 / 6, shape: 'sphere', size: 20, height: 0, color: '#8294b3' },
  'gust-of-wind': {
    range: 0,
    hours: 1 / 60,
    shape: 'line',
    size: 60,
    height: 10,
    color: '#90c2c9',
  },
  'wind-wall': { range: 120, hours: 1 / 60, shape: 'wall', size: 50, height: 15, color: '#6eb0bc' },
  moonbeam: { range: 120, hours: 1 / 60, shape: 'cylinder', size: 5, height: 40, color: '#c0d4de' },
  'spirit-guardians': {
    range: 0,
    hours: 1 / 6,
    shape: 'emanation',
    size: 15,
    height: 0,
    color: '#e3cc82',
  },
  'cloud-of-daggers': {
    range: 60,
    hours: 1 / 60,
    shape: 'cube',
    size: 5,
    height: 5,
    color: '#b2bdd0',
  },
  'hunger-of-hadar': {
    range: 150,
    hours: 1 / 60,
    shape: 'sphere',
    size: 20,
    height: 0,
    color: '#45364f',
  },
  'cordon-of-arrows': {
    range: 5,
    hours: 8,
    shape: 'sphere',
    size: 30,
    height: 0,
    color: '#b88f63',
  },
  'flaming-sphere': {
    range: 60,
    hours: 1 / 60,
    shape: 'sphere',
    size: 2.5,
    height: 0,
    color: '#d1783b',
  },
  'call-lightning': {
    range: 120,
    hours: 1 / 6,
    shape: 'cylinder',
    size: 60,
    height: 10,
    color: '#929ac6',
  },
  'conjure-animals': {
    range: 60,
    hours: 1 / 6,
    shape: 'emanation',
    size: 10,
    height: 0,
    color: '#92b294',
  },
  'arcane-lock': { range: 5, shape: 'sphere', size: 0.5, height: 0, color: '#b89858' },
  knock: { range: 60, shape: 'sphere', size: 0.5, height: 0, color: '#b89858' },
  alarm: { range: 30, hours: 8, shape: 'cube', size: 20, height: 20, color: '#b99a60' },
  'magic-mouth': { range: 30, shape: 'sphere', size: 30, height: 0, color: '#a98ab1' },
  'glyph-of-warding': { range: 5, shape: 'sphere', size: 5, height: 0, color: '#ac82a8' },
  'tiny-hut': { range: 0, hours: 8, shape: 'emanation', size: 10, height: 0, color: '#819fa9' },
  'magic-circle': {
    range: 10,
    hours: 1,
    shape: 'cylinder',
    size: 10,
    height: 20,
    color: '#c0a458',
  },
}
