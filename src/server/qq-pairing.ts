import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { Room, RoomMember } from '../online/protocol'
import { hash, RoomError } from './room-engine'
import { qqState, qqView, qqWeb } from './qq-room'
const request = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('create'),
      bots: z.array(z.string()).min(1).max(20),
      characterId: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal('confirm'),
      markers: z
        .array(z.object({ bot: z.string(), marker: z.string() }).strict())
        .min(1)
        .max(20),
    })
    .strict(),
])
export function batchPairing(
  room: Room,
  member: RoomMember,
  bindings: { id: string; key: string; name: string }[],
  input?: unknown,
) {
  if (member.revoked || member.role !== 'player')
    throw new RoomError('集中配对仅供当前玩家成员使用', 403)
  const q = qqState(room),
    errors: { bot: string; reason: string }[] = []
  let code = ''
  if (input) {
    const c = request.parse(input)
    if (c.type === 'create') {
      if (!member.characterIds.includes(c.characterId))
        throw new RoomError('只能选择本人获分配的角色', 403)
      const targets = bindings.filter((b) => c.bots.includes(b.key))
      if (new Set(c.bots).size !== c.bots.length || targets.length !== c.bots.length)
        throw new RoomError('Bot未绑定当前房间或不可用')
      const needed = targets.filter(
        (b) =>
          !q.identities.some((i) => i.memberId === member.id && i.bindingId === b.id && !i.revoked),
      )
      q.codes = q.codes.filter(
        (x) =>
          x.expires > Date.now() &&
          !(x.memberId === member.id && needed.some((b) => b.id === x.bindingId)),
      )
      if (q.codes.length + needed.length > 100) throw new RoomError('配对请求已满')
      code = randomBytes(8).toString('hex').toUpperCase()
      for (const b of needed) {
        q.codes = q.codes.filter((x) => x.memberId !== member.id || x.bindingId !== b.id)
        q.codes.push({
          hash: hash(code),
          memberId: member.id,
          bindingId: b.id,
          expires: Date.now() + 600000,
          identity: '',
          marker: '',
          characterId: c.characterId,
        })
      }
      if (!needed.length) code = ''
    } else {
      for (const choice of c.markers) {
        const b = bindings.find((b) => b.key === choice.bot)
        try {
          if (!b) throw Error('端点已不可用')
          qqWeb(room, member, b.id, { type: 'confirm', marker: choice.marker })
        } catch (e) {
          errors.push({ bot: choice.bot, reason: e instanceof Error ? e.message : '配对失败' })
        }
      }
    }
  }
  return {
    code,
    errors,
    bots: bindings.map((b) => {
      const v = qqView(room, member, b.id)
      return {
        key: b.key,
        name: b.name,
        paired: !!v.identity,
        characterId: v.identity?.characterId ?? '',
        pending: v.pending,
      }
    }),
  }
}
