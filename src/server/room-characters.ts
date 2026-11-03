import { BUILTIN_PACKS } from '../content/builtin-packs'
import { isBuiltinPack } from '../content/builtin-ids'
import { randomUUID } from 'node:crypto'
import { catalogue, clone, validate } from '../core/engine'
import { srd } from '../content/srd'
import { validateInventory, validateRuntimeArchive } from '../core/runtime'
import { archiveSchema, packSchema } from '../persistence/schema'
import type { Character, Pack } from '../core/types'
import type { Room } from '../online/protocol'

export function validateRoomCharacter(c: Character, packs: Pack[]) {
  const cat = catalogue([...BUILTIN_PACKS, ...packs])
  if (c.status !== 'complete' || validate(c.build, cat, { existingCharacter: true }).length)
    throw new Error('角色尚未完成建角或未通过规则校验：' + (c.build.name || '未命名角色'))
  for (const used of c.packs)
    if (![...BUILTIN_PACKS, ...packs].some((p) => p.id === used.id && p.version === used.version))
      throw new Error('缺少角色规则包或版本不一致：' + used.id)
  validateInventory(c, cat)
  validateRuntimeArchive(c, cat)
}

/** Copy selected local characters; never replace a room character's live state. */
export function importRoomCharacters(
  room: Room,
  inputs: unknown[],
  options: { purpose?: 'player' | 'player-copy' | 'npc'; sourceNamespace?: string } = {},
) {
  const archives = inputs.map((input) => archiveSchema.parse(input)),
    ids = archives.map((a) => a.character.id)
  if (
    options.purpose !== 'npc' &&
    options.purpose !== 'player-copy' &&
    archives.some((a) => a.character.purpose === 'npc' || a.character.npcOwnerId)
  )
    throw new Error('NPC 模板／专用角色请使用复制给 NPC；创建玩家副本须由 GM 明确选择')
  if (!archives.length || room.world.characters.length + archives.length > 100)
    throw new Error('房间最多保留 100 位角色，请选择要导入的角色')
  if (new Set(ids).size !== ids.length) throw new Error('选择的角色重复')
  const sources = options.sourceNamespace
    ? (room.characterRequestSources ?? {})
    : (room.characterSources ?? {})
  const sourceKey = (id: string) =>
    options.sourceNamespace ? options.sourceNamespace + ':' + id : id
  if (ids.some((id) => room.world.characters.some((c) => c.id === sources[sourceKey(id)])))
    throw new Error('此角色已带入房间，不能用本地副本覆盖当前进度')
  const packs = clone(room.world.packs)
  for (const archive of archives)
    for (const pack of archive.packs) {
      if (isBuiltinPack(pack.id) || ['custom', 'local-custom'].includes(pack.id))
        throw new Error('不能用扩展规则包替换内置规则')
      const installed = packs.find((p) => p.id === pack.id)
      if (installed && JSON.stringify(packSchema.parse(installed)) !== JSON.stringify(pack))
        throw new Error('规则包冲突：' + pack.id)
      if (!installed) packs.push(pack)
    }
  if (packs.length > 20) throw new Error('房间规则包超过 20 份')
  const mapping = new Map(ids.map((id) => [id, randomUUID()]))
  const characters = archives.map((archive) => {
    const c = clone(archive.character) as Character
    // A standalone imported sheet is a new player copy, not an orphan NPC assignment.
    delete c.npcOwnerId
    c.purpose = options.purpose === 'npc' ? 'npc' : 'player'
    validateRoomCharacter(c, packs)
    c.id = mapping.get(c.id)!
    for (const row of c.inventory)
      if (row.craftedBy)
        row.craftedBy =
          mapping.get(row.craftedBy) ?? sources[sourceKey(row.craftedBy)] ?? row.craftedBy
    c.journal = []
    for (const effect of c.runtime?.effects ?? [])
      effect.sourceId =
        mapping.get(effect.sourceId) ?? sources[sourceKey(effect.sourceId)] ?? effect.sourceId
    c.createdAt = new Date().toISOString()
    c.updatedAt = c.createdAt
    return c
  })
  room.world.characters.push(...characters)
  room.world.packs = packs
  const tracked = {
    ...sources,
    ...Object.fromEntries([...mapping].map(([source, id]) => [sourceKey(source), id])),
  }
  if (options.sourceNamespace) room.characterRequestSources = tracked
  else room.characterSources = tracked
  room.worldRevision++
}
