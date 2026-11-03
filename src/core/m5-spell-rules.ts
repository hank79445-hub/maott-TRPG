export const M5_WORLD_SPELLS = [
  'dragon-s-breath',
  'flame-blade',
  'spiritual-weapon',
  'heat-metal',
  'mind-spike',
  'vampiric-touch',
  'witch-bolt',
] as const
export const M5_SPELLS = [
  ...M5_WORLD_SPELLS,
  'armor-of-agathys',
  'shillelagh',
  'true-strike',
  'magic-weapon',
  'elemental-weapon',
  'divine-favor',
  'hex',
  'hunter-s-mark',
  'crusaders-mantle',
  'chill-touch',
  'mind-sliver',
  'ray-of-frost',
  'shocking-grasp',
  'starry-wisp',
  'vicious-mockery',
  'arms-of-hadar',
  'guiding-bolt',
  'ray-of-sickness',
  'searing-smite',
  'thunderous-smite',
  'wrathful-smite',
  'shining-smite',
  'blinding-smite',
  'ensnaring-strike',
  'fire-bolt',
  'burning-hands',
  'fireball',
  'thorn-whip',
  'thunderwave',
  'dissonant-whispers',
] as const
export const isM5Spell = (id: string) => (M5_SPELLS as readonly string[]).includes(id)
export const isM5WorldSpell = (id: string) => (M5_WORLD_SPELLS as readonly string[]).includes(id)
export const M5_OBJECT_SPELLS = ['fire-bolt', 'starry-wisp'] as const
export const isM5ObjectSpell = (id: string) => (M5_OBJECT_SPELLS as readonly string[]).includes(id)
export const M5_ELEMENTS = ['acid', 'cold', 'fire', 'lightning', 'poison'] as const
