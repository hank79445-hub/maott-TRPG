export interface M1Corpse {
  id: string
  entityId: string
  sceneId: string
  clockSourceId: string
  deathHour: number | null
  dead: boolean
  oldAge: boolean
  bodyViable: boolean
  repose: {start: number; end: number}[]
}
export interface M1Material {
  characterId: string
  instanceId: string
  kind: 'diamond' | 'copper' | 'holy-water' | 'silver-powder' | 'diamond-dust'
  valueGP: number
}
export interface M1Object {
  id: string
  sceneId: string
  name: string
  x: number
  y: number
  food: boolean
  magical: boolean
  poisoned: boolean
  rotten: boolean
  cursed: boolean
  boundCharacterId?: string
  inventoryInstanceId?: string
}
export interface M1UtilityState {
  casts?: {id:string;encounterId:string;action:Extract<import('../persistence/m1-utility-schema').M1Action,{operation:'cast'}>}[]
  corpses: M1Corpse[]
  materials: M1Material[]
  objects: M1Object[]
  pulses: {castId: string; window: number}[]
}
