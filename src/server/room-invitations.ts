import { randomInt } from 'node:crypto'
import type { Room } from '../online/protocol'
import { RoomError, hash } from './room-engine'
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newInvite = () =>
  Array.from({ length: 8 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]!).join('')
export const shortRoomCode = (room: Pick<Room, 'id' | 'shortCode'>) =>
  room.shortCode ?? room.id.replaceAll('-', '').slice(0, 8).toUpperCase()
export function validateInvite(room: Room, invite: string) {
  if (room.inviteEnabled === false) throw new RoomError('房间已停用新成员邀请', 403)
  if (room.inviteExpiresAt && Date.parse(room.inviteExpiresAt) <= Date.now())
    throw new RoomError('邀请码已过期，请联系 GM', 401)
  if (hash(invite) !== room.inviteHash) throw new RoomError('邀请码无效', 401)
}
