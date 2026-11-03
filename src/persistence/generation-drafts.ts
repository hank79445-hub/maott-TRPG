import { openDB, type DBSchema } from 'idb'
import type { AuthorScene } from './script-authoring-schema'
import type { MapAsset } from '../core/map-types'
import type { SceneArtDraft } from '../core/scene-art-state'
export interface GenerationDraft {
  version: 1
  pipelineRecovery?: string
  pipeline?: import('../core/authoring-stages').AuthoringPipeline
  requirementsVersion?: 2
  requirements?: import('../core/authoring-requirements').AuthoringRequirements
  brief: string
  json: string
  defaultLayoutMode?: import('./scene-art-schema').LayoutMode
  step: number
  locks: Record<string, AuthorScene>
  images: Record<string, MapAsset>
  art?: Record<string, SceneArtDraft>
  at: string
}
interface GenerationDatabase extends DBSchema {
  drafts: { key: string; value: GenerationDraft }
}
const db = () =>
  openDB<GenerationDatabase>('trpg-generation-drafts', 1, {
    upgrade(d) {
      d.createObjectStore('drafts')
    },
  })
export const generationDrafts = {
  async get(account: string) {
    return (await db()).get('drafts', account)
  },
  async put(account: string, value: GenerationDraft) {
    await (await db()).put('drafts', value, account)
  },
}
