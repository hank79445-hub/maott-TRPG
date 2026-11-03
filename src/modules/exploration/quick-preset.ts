export interface QuickPreset {
  kind: 'attack' | 'cast' | 'item' | 'feature'
  key: string
  target: string
}
