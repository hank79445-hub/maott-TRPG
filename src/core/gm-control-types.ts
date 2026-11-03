export interface GmControl {
  id: string
  targetKind: 'character' | 'npc'
  targetId: string
  gmId: string
  at: string
  previousController?: 'gm' | 'model'
}
