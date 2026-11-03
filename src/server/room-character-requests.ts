import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { archiveSchema } from '../persistence/schema'
import { catalogue, clone } from '../core/engine'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { runtimeState } from '../core/runtime'
import type { CharacterRequest } from '../core/character-request-types'
import type { Room, RoomCommand, RoomMember } from '../online/protocol'
import { importRoomCharacters } from './room-characters'

const summarySchema = z.strictObject({
  name: z.string().max(120),
  level: z.number().int().min(1).max(20),
  classId: z.string().max(120),
  speciesId: z.string().max(120),
  purpose: z.string().max(80),
  custom: z.boolean(),
  packs: z.array(z.strictObject({ id: z.string(), version: z.string() })).max(100),
  hp: z.number().finite().nullable(),
  conditions: z.array(z.string()).max(100),
  inventoryCount: z.number().int().nonnegative(),
})
const storedSchema = z
  .strictObject({
    id: z.string().uuid(),
    sessionId: z.string(),
    sourceId: z.string(),
    status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']),
    at: z.string(),
    reason: z.string().max(6000),
    summary: summarySchema,
    archive: archiveSchema.optional(),
    characterId: z.string().optional(),
    resetRuntime: z.boolean().optional(),
  })
  .refine((r) => r.status !== 'pending' || !!r.archive, { message: '待审角色申请缺少档案' })

export function validateCharacterRequests(room: Room) {
  room.characterRequests = z
    .array(storedSchema)
    .max(80)
    .parse(room.characterRequests ?? [])
  if (room.characterRequestSources)
    room.characterRequestSources = z
      .record(z.string(), z.string())
      .parse(room.characterRequestSources)
}
export function projectCharacterRequests(room: Room, member: RoomMember): CharacterRequest[] {
  return (room.characterRequests ?? [])
    .filter((r) => member.role === 'gm' || r.sessionId === member.id)
    .map((r) => {
      const copy = clone(r)
      if (member.role !== 'gm') delete copy.archive
      return copy
    })
}
function compact(room: Room) {
  const requests = room.characterRequests ?? []
  room.characterRequests = [
    ...requests.filter((r) => r.status !== 'pending').slice(-60),
    ...requests.filter((r) => r.status === 'pending'),
  ].sort((a, b) => a.at.localeCompare(b.at))
}
/** Runs inside RoomStore's clone/validate/persist transaction. */
export function executeCharacterRequest(
  room: Room,
  member: RoomMember,
  command: RoomCommand,
): boolean {
  if (command.kind === 'character-submit') {
    if (member.role !== 'player' || member.revoked) throw new Error('只有有效玩家身份可以提交角色')
    if (Buffer.byteLength(JSON.stringify(command.archive), 'utf8') > 4 * 1024 * 1024)
      throw new Error('角色档案超过 4 MiB，请精简扩展规则包后提交')
    const archive = archiveSchema.parse(command.archive),
      c = archive.character
    if (c.purpose === 'npc' || c.npcOwnerId) throw new Error('NPC 专用角色不能提交为玩家角色')
    const requests = room.characterRequests ?? []
    if (
      requests.some(
        (r) => r.status === 'pending' && r.sessionId === member.id && r.sourceId === c.id,
      )
    )
      throw new Error('此角色已有待审申请，可先撤回再重新提交')
    if (
      requests.filter((r) => r.status === 'pending').length >= 20 ||
      requests.filter((r) => r.status === 'pending' && r.sessionId === member.id).length >= 5
    )
      throw new Error('待审角色申请已满，请先处理现有申请')
    // Reuse full import checks, without touching the actual world or source tracking.
    importRoomCharacters(clone(room), [archive], { sourceNamespace: member.id })
    room.characterRequests = [
      ...requests,
      {
        id: randomUUID(),
        sessionId: member.id,
        sourceId: c.id,
        status: 'pending',
        at: new Date().toISOString(),
        reason: '',
        archive: clone(archive),
        summary: {
          name: c.build.name || '未命名角色',
          level: c.level,
          classId: c.build.classId ?? '',
          speciesId: c.build.speciesId ?? '',
          purpose: c.purpose ?? 'shared',
          custom: !!(
            c.build.customItems.length ||
            c.build.adjustments.length ||
            archive.packs.length
          ),
          packs: c.packs.map((p) => ({ id: p.id, version: p.version })),
          hp: c.runtime?.hp ?? null,
          conditions: [...(c.runtime?.conditions ?? [])],
          inventoryCount: c.inventory.length,
        },
      },
    ]
    compact(room)
    return true
  }
  if (command.kind !== 'character-review' && command.kind !== 'character-withdraw') return false
  if (command.kind === 'character-review' && member.role !== 'gm') throw new Error('需要 GM 权限')
  const request = room.characterRequests?.find((r) => r.id === command.requestId)
  if (!request || request.status !== 'pending' || !request.archive)
    throw new Error('角色申请不存在或已处理')
  if (command.kind === 'character-withdraw') {
    if (member.role !== 'player' || request.sessionId !== member.id)
      throw new Error('只能由提交者本人撤回角色申请')
    request.status = 'withdrawn'
    request.reason = '提交者撤回'
    delete request.archive
    compact(room)
    return true
  }
  if (command.approve) {
    const source = room.members.find(
      (m) => m.id === request.sessionId && m.role === 'player' && !m.revoked,
    )
    if (!source) throw new Error('提交者权限已撤销，不能批准角色申请')
    const archive = clone(request.archive)
    if (command.resetRuntime) {
      archive.character.runtime = null
      archive.character.runtime = archiveSchema.shape.character.shape.runtime.parse(
        runtimeState(
          archive.character,
          catalogue([
            ...BUILTIN_PACKS,
            ...room.world.packs,
            ...archive.packs.filter((p) => !room.world.packs.some((x) => x.id === p.id)),
          ]),
        ),
      )
    }
    importRoomCharacters(room, [archive], { sourceNamespace: source.id })
    const id = room.characterRequestSources![source.id + ':' + request.sourceId]!
    source.characterIds = [...new Set([...source.characterIds, id])]
    request.characterId = id
    request.resetRuntime = command.resetRuntime
  }
  request.status = command.approve ? 'approved' : 'rejected'
  request.reason = command.reason
  delete request.archive
  compact(room)
  return true
}
