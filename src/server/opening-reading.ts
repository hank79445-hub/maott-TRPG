import { randomUUID } from 'node:crypto'
import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import {
  openingPresentationSchema,
  type OpeningReadingView,
} from '../persistence/opening-reading-schema'
import { adventure, executeAction, RoomError } from './room-engine'

function current(room: Room, member: RoomMember) {
  const branch = adventure(room).broadcastLog?.branchId ?? 'legacy'
  return [...(room.openingReadings?.runs ?? [])]
    .reverse()
    .find(
      (r) =>
        r.branchId === branch &&
        (member.role === 'gm' || !r.targets.length || r.targets.includes(member.id)),
    )
}
export function openingReadingView(room: Room, member: RoomMember): OpeningReadingView | undefined {
  if (member.revoked || member.role === 'ai') return
  const run = current(room, member)
  if (!run) return
  const progress = room.openingReadings!.progress.find(
    (p) => p.runId === run.id && p.memberId === member.id,
  )
  const a = adventure(room)
  const ids = run.presentation.identities.filter(
    (i) =>
      member.role === 'gm' ||
      (member.characterIds.includes(i.characterId) && a.party.includes(i.characterId)),
  )
  return {
    id: run.id,
    page: progress?.page ?? 0,
    dismissed: progress?.dismissed ?? false,
    complete: progress?.complete ?? false,
    pages: [
      run.presentation.opening,
      run.presentation.background,
      ids
        .map(
          (i) =>
            `${room.world.characters.find((c) => c.id === i.characterId)?.build.name ?? ''}\n${i.text}`,
        )
        .join('\n\n'),
      run.presentation.origin,
    ],
    ...(member.role === 'gm'
      ? {
          participants: room.members
            .filter(
              (m) =>
                !m.revoked &&
                m.role === 'player' &&
                (!run.targets.length || run.targets.includes(m.id)),
            )
            .map((m) => {
              const p = room.openingReadings!.progress.find(
                (p) => p.runId === run.id && p.memberId === m.id,
              )
              return {
                id: m.id,
                name: m.nickname,
                page: p?.page ?? -1,
                complete: p?.complete ?? false,
                dismissed: p?.dismissed ?? false,
              }
            }),
        }
      : {}),
  }
}
export function executeOpeningReading(
  room: Room,
  member: RoomMember,
  command: Extract<RoomCommand, { kind: 'opening' }>,
) {
  if (member.revoked || member.role === 'ai') throw new RoomError('当前身份不可使用开场阅读', 403)
  const a = adventure(room)
  if (command.operation === 'read') {
    if (member.role !== 'player') throw new RoomError('只有玩家保存个人阅读进度', 403)
    const run = current(room, member)
    if (!run || run.id !== command.runId || command.page === undefined)
      throw new RoomError('开场轮次已变化，请刷新', 409)
    if (command.complete && command.page !== 3) throw new RoomError('请在最后一段完成阅读')
    const state = room.openingReadings!,
      old = state.progress.find((p) => p.runId === run.id && p.memberId === member.id)
    const value = {
      runId: run.id,
      memberId: member.id,
      page: command.page,
      dismissed: command.dismissed ?? false,
      complete: !!old?.complete || command.complete === true,
    }
    if (old) Object.assign(old, value)
    else {
      if (state.progress.length >= 500) throw new RoomError('开场阅读人数达到容量限制')
      state.progress.push(value)
    }
    return
  }
  if (member.role !== 'gm') throw new RoomError('配置或启动开场需要GM', 403)
  if (command.operation === 'configure') {
    if (!command.presentation) throw new RoomError('缺少开场内容')
    const value = openingPresentationSchema.parse(command.presentation)
    if (value.identities.some((i) => !a.party.includes(i.characterId)))
      throw new RoomError('身份介绍必须关联本冒险队伍角色')
    a.openingPresentation = structuredClone(value)
    room.worldRevision++
    return
  }
  const presentation = command.presentation
    ? openingPresentationSchema.parse(command.presentation)
    : a.openingPresentation
  if (
    !presentation?.opening.trim() ||
    !presentation.background.trim() ||
    !presentation.origin.trim()
  )
    throw new RoomError('请填写开场广播、背景和事件起源')
  if (presentation.identities.some((i) => !a.party.includes(i.characterId)))
    throw new RoomError('身份介绍角色已不在队伍')
  const targets = command.targets ?? []
  if (
    new Set(targets).size !== targets.length ||
    targets.some(
      (id) => !room.members.some((m) => m.id === id && m.role === 'player' && !m.revoked),
    )
  )
    throw new RoomError('开场接收者已失效')
  if (!a.broadcast?.storyStarted)
    executeAction(room, member, { kind: 'map', command: { type: 'broadcast-start' } })
  const live = adventure(room)
  if (JSON.stringify(live.openingPresentation) !== JSON.stringify(presentation)) {
    live.openingPresentation = structuredClone(presentation)
    room.worldRevision++
  }
  room.events.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    sessionId: member.id,
    detail: 'GM启动开场阅读',
  })
  const state = (room.openingReadings ??= { runs: [], progress: [] })
  state.runs.push({
    id: randomUUID(),
    branchId: adventure(room).broadcastLog?.branchId ?? 'legacy',
    at: new Date().toISOString(),
    presentation: structuredClone(presentation),
    targets,
  })
  state.runs = state.runs.slice(-5)
  state.progress = state.progress.filter((p) => state.runs.some((r) => r.id === p.runId))
}
