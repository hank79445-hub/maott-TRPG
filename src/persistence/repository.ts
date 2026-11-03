import { openDB } from 'idb'
import type { Character, Pack } from '../core/types'
import { parseCharacter, parsePack } from './schema'
import { parseEncounter } from './combat-schema'
import type { Encounter } from '../core/combat-types'
import type { Adventure, MapAsset } from '../core/map-types'
import { parseAdventure } from './map-schema'
export interface EditorSession {
  character: Character
  editingId: string | null
  rebuild: boolean
  step: number
}
const db = () => {
  let blocked = false,
    rejectBlocked: (error: Error) => void = () => {}
  const blockedPromise = new Promise<never>((_, reject) => {
    rejectBlocked = reject
  })
  const request = openDB('trpg-character-workshop', 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('state')) database.createObjectStore('state')
      if (!database.objectStoreNames.contains('assets'))
        database.createObjectStore('assets', { keyPath: 'id' })
    },
    blocked() {
      blocked = true
      rejectBlocked(new Error('旧页面正在使用角色存储，请刷新其他本工具页面后重试'))
    },
  })
  request
    .then((database) => {
      if (blocked) database.close()
    })
    .catch(() => {})
  return Promise.race([request, blockedPromise])
}
export const repository = {
  async raw() {
    const database = await db()
    try {
      return {
        characters: await database.get('state', 'characters'),
        packs: await database.get('state', 'packs'),
        editor: await database.get('state', 'editor'),
        encounters: await database.get('state', 'encounters'),
        adventures: await database.get('state', 'adventures'),
        assets: await database.getAll('assets'),
      }
    } finally {
      database.close()
    }
  },
  async read(): Promise<{
    characters: Character[]
    packs: Pack[]
    encounters: Encounter[]
    editor: EditorSession | null
    adventures?: Adventure[]
    assets?: MapAsset[]
  }> {
    const database = await db()
    try {
      const characters = (await database.get('state', 'characters')) || []
      const packs = (await database.get('state', 'packs')) || []
      const editor = (await database.get('state', 'editor')) || null
      const encounters = (await database.get('state', 'encounters')) || []
      return {
        characters: characters.map(parseCharacter) as Character[],
        packs: packs.map(parsePack) as Pack[],
        encounters: encounters.map(parseEncounter) as Encounter[],
        adventures: ((await database.get('state', 'adventures')) || []).map(parseAdventure),
        assets: await database.getAll('assets'),
        editor: editor
          ? ({ ...editor, character: parseCharacter(editor.character) } as EditorSession)
          : null,
      }
    } finally {
      database.close()
    }
  },
  async write(
    characters: Character[],
    packs: Pack[],
    editor: EditorSession | null,
    encounters: Encounter[] = [],
    adventures: Adventure[] = [],
    assets: MapAsset[] = [],
  ) {
    const database = await db()
    const tx = database.transaction(['state', 'assets'], 'readwrite')
    try {
      const state = tx.objectStore('state'),
        images = tx.objectStore('assets')
      const imageKeys = await images.getAllKeys(),
        keep = new Set(assets.map((asset) => asset.id)),
        existing = new Set(imageKeys)
      await Promise.all([
        state.put(JSON.parse(JSON.stringify(characters)), 'characters'),
        state.put(JSON.parse(JSON.stringify(packs)), 'packs'),
        state.put(editor ? JSON.parse(JSON.stringify(editor)) : null, 'editor'),
        state.put(JSON.parse(JSON.stringify(encounters)), 'encounters'),
        state.put(JSON.parse(JSON.stringify(adventures)), 'adventures'),
        ...imageKeys.filter((key) => !keep.has(String(key))).map((key) => images.delete(key)),
        ...assets
          .filter((asset) => !existing.has(asset.id))
          .map((asset) =>
            images.put({
              id: asset.id,
              name: asset.name,
              mime: asset.mime,
              width: asset.width,
              height: asset.height,
              blob: asset.blob,
              ...(asset.importInfo ? { importInfo: { ...asset.importInfo } } : {}),
              ...(asset.preview ? { preview: { ...asset.preview } } : {}),
            }),
          ),
      ])
      await tx.done
    } catch (e) {
      try {
        tx.abort()
      } catch {
        /* Already aborted or completed by IndexedDB. */
      }
      await tx.done.catch(() => {})
      throw e
    } finally {
      database.close()
    }
  },
}
