import type { Position } from './map-types'
export interface ArrivalGroup {
  manualReason?: string
  id: string
  name: string
  npcIds: string[]
  battleMode: 'none' | 'start' | 'reinforce'
  intro: string
  status?: 'waiting' | 'pending' | 'spawned'
  reason?: string
  requestId?: string
  sourceEventId?: string
}
export interface GroundItem extends Position {
  inventoryState?:import('./types').InventoryItem
  specialWeapon?: import('./types').SpecialWeapon
  inventoryInstanceId?: string
  customItem?: import('./types').Item
  id: string
  itemId: string
  name: string
  icon: string
  color: string
  note: string
  initialQuantity: number
  quantity: number
  hidden: boolean
  enabled: boolean
  range: number
  requiresGM: boolean
  cost: 'free' | 'action'
}
export type SceneToolCommand =
  | {
      type: 'grapple-release'
      sceneId: string
      characterId: string
      encounterId: string
      targetId: string
    }
  | {
      type: 'ground-drop'
      sceneId: string
      characterId: string
      instanceId: string
      cost: 'free' | 'action'
    }
  | {
      type: 'gm-place-npcs'
      sceneId: string
      templateId?: string
      sourceNpcId?: string
      positions: Position[]
    }
  | { type: 'gm-relocate'; sceneId: string; tokenId: string; position: Position; reason: string }
  | { type: 'arrival-trigger'; sceneId: string; groupId: string }
  | {
      type: 'ground-pickup'
      sceneId: string
      itemId: string
      characterId: string
      quantity: number
      cost: 'free' | 'action'
    }
