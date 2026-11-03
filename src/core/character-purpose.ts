import type { Character } from './types'
export const characterPurpose = (c: Pick<Character, 'purpose' | 'npcOwnerId'>) =>
  c.npcOwnerId ? 'npc' : (c.purpose ?? 'shared')
export const defaultPlayerImport = (c: Pick<Character, 'purpose' | 'npcOwnerId'>) =>
  characterPurpose(c) === 'player'
