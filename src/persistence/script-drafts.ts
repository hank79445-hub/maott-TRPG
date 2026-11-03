import { openDB, type DBSchema } from 'idb'
import type { ScriptDefinition } from './script-schema'
import type { MapAsset } from '../core/map-types'
import type { SceneArtDraft } from '../core/scene-art-state'
import type { SceneArtRecords } from './scene-art-schema'
export interface CachedScriptDraft {
  accountId: string
  scriptId: string
  revision: number
  definition: ScriptDefinition
  assets: MapAsset[]
  at: string
  dirty: boolean
  art?: SceneArtRecords
  artDrafts?: Record<string, SceneArtDraft>
}
interface DraftDatabase extends DBSchema {
  drafts: { key: string; value: CachedScriptDraft }
}
const database = () =>
  openDB<DraftDatabase>('trpg-personal-script-drafts', 1, {
    upgrade(db) {
      db.createObjectStore('drafts')
    },
  })
const key = (owner: string, id: string) => owner + ':' + id
export const scriptDrafts = {
  async get(owner: string, id: string) {
    return (await database()).get('drafts', key(owner, id))
  },
  async put(value: CachedScriptDraft) {
    await (await database()).put('drafts', value, key(value.accountId, value.scriptId))
  },
  async remove(owner: string, id: string) {
    await (await database()).delete('drafts', key(owner, id))
  },
}
