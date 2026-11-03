export const NPC_CATEGORIES = {
  goblinoid: '地精类',
  civilian: '城镇与匪徒',
  undead: '不死生物',
  beast: '野兽',
  giant: '巨人',
  fiend: '邪魔',
} as const
export type NpcCategory = keyof typeof NPC_CATEGORIES
export type NpcRuleSupport = 'automatic' | 'gm' | 'unsupported'
export interface NpcTemplateMetadata {
  sourceKind?: 'official' | 'custom' | 'summon'
  classIds?: string[]
  tags?: ('elite' | 'caster' | 'special')[]
  englishName: string
  category: NpcCategory
  sourceVersion: string
  templateVersion: string
  pages?: number[]
  cr?: string
  xp?: number
  proficiencyBonus: number
  alignment: string
  hitDice: string
  skills: Record<string, number>
  senses: string[]
  passivePerception: number
  languages: string[]
  movement: { kind: 'climb' | 'swim' | 'fly' | 'burrow'; feet: number }[]
  gear: string[]
  requiresManualTurn?: boolean
  abilities: {
    id: string
    name: string
    support: NpcRuleSupport
    detail: string
    cost?: 'action' | 'bonus' | 'reaction' | 'none'
  }[]
}
