import {formatSystemText,type SystemMessageKey} from '../shared/localization/system-messages'
import {localeOrDefault} from '../shared/localization/locale'
import { randomBytes, randomUUID } from 'node:crypto'
import { dialogueFresh } from './dialogue-lifecycle'
import { dialogueSegments } from '../core/dialogue-segments'
import { z } from 'zod'
import type { Room, RoomMember, RoomCommand } from '../online/protocol'
import { actionSchema } from '../online/protocol'
import type { QqRoomState, QqMemberView } from '../online/qq-types'
import { activeScene, adventure, hash, RoomError, executeCommand } from './room-engine'
import { qqAction, choose } from './qq-actions'
import { journal, canTalk } from './room-ai'
import { queuePublicDialogue, dialoguePaused, dialogueCategories } from './npc-dialogue-review'

const id = z.string().min(1).max(128),
  text = z.string().max(2000)
const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
export const qqRoomSchema = object({
  version: z.literal(1),
  activeBindingId: id.optional(),
  activeBindingIds: z.array(id).max(30).optional(),
  codes: z
    .array(
      object({
        hash: id,
        memberId: id,
        bindingId: id,
        expires: z.number(),
        identity: z.string().max(128),
        marker: z.string().max(12),
        characterId: id.optional(),
      }),
    )
    .max(100),
  identities: z
    .array(
      object({
        id,
        bindingId: id,
        identity: id,
        memberId: id,
        characterId: z.string().max(128),
        revoked: z.boolean(),
      }),
    )
    .max(200),
  receipts: z
    .array(
      object({
        source: id,
        at: z.number(),
        response: z.string().max(1800),
        conversationId: id.optional(),
      }),
    )
    .max(1000),
  requests: z
    .array(
      object({
        id,
        identityId: id,
        characterId: id,
        sceneId: id,
        branch: id,
        turn: z.string().max(200),
        intentId: id,
        action: actionSchema,
      }),
    )
    .max(100),
  sessions: z
    .array(
      object({
        id,
        bindingId: id,
        npcId: id,
        sceneId: id,
        branch: id,
        participants: z.array(object({ memberId: id, characterId: id })).max(100),
        closed: z.boolean(),
      }),
    )
    .max(100),
  contexts: z
    .array(
      object({
        id,
        npcId: id,
        sceneId: id,
        branch: id,
        characterId: id,
        purpose: text.min(1),
        text: text.min(1),
      }),
    )
    .max(50),
})
export const qqWebCommand = z.discriminatedUnion('type', [
  object({ type: z.literal('code') }),
  object({ type: z.literal('confirm'), marker: z.string().min(1).max(12) }),
  object({ type: z.literal('revoke'), identityId: id }),
  object({ type: z.literal('select'), characterId: id }),
  object({
    type: z.literal('context'),
    npcId: id,
    characterId: id,
    purpose: text.min(1),
    text: text.min(1),
  }),
  object({ type: z.literal('context-remove'), contextId: id }),
  object({ type: z.literal('close-session'), sessionId: id }),
])
export function qqState(room: Room): QqRoomState {
  return (room.qq ??= {
    version: 1,
    codes: [],
    identities: [],
    receipts: [],
    requests: [],
    sessions: [],
    contexts: [],
  })
}
export const qqBranch = (r: Room) => adventure(r).broadcastLog?.branchId ?? 'legacy'
export function qqTurn(room: Room) {
  const s = activeScene(room),
    e = room.world.encounters.find((e) => e.id === s?.encounterId && e.phase === 'active')
  const explore = adventure(room).exploration
  return e
    ? `${e.id}:${e.tick}:${e.actors[e.current]?.id}`
    : explore?.status === 'active'
      ? explore.roundId
      : ''
}
export function liveQqBinding(room: Room, id: string) {
  return (
    !!room.qq?.activeBindingId &&
    (room.qq.activeBindingId === id || !!room.qq.activeBindingIds?.includes(id))
  )
}
export function qqIdentityLive(room: Room, identityId: string, characterId: string) {
  const i = room.qq?.identities.find(
      (i) => i.id === identityId && !i.revoked && liveQqBinding(room, i.bindingId),
    ),
    m = room.members.find((m) => m.id === i?.memberId && !m.revoked && m.role === 'player')
  return !!m && m.characterIds.includes(characterId)
}
export function qqRequestLive(room: Room, request: QqRoomState['requests'][number]) {
  return (
    qqIdentityLive(room, request.identityId, request.characterId) &&
    request.branch === qqBranch(room) &&
    request.sceneId === activeScene(room)?.id &&
    request.turn === qqTurn(room)
  )
}
export function reconcileQq(room: Room) {
  if (!room.qq) return
  for (const request of room.qq.requests) {
    const intent = room.intents.find((i) => i.id === request.intentId)
    if (
      intent?.status === 'pending' &&
      (!qqRequestLive(room, request) || intent.baseWorldRevision !== room.worldRevision)
    ) {
      intent.status = 'stale'
      intent.reason = 'QQ 申请的权限、场景、存档分支、回合或世界状态已变化，请重新提交'
    }
  }
  for (const session of room.qq.sessions) {
    if (
      session.branch !== qqBranch(room) ||
      session.sceneId !== activeScene(room)?.id ||
      !room.qq.identities.some(
        (i) =>
          i.bindingId === session.bindingId &&
          !i.revoked &&
          room.members.some((m) => m.id === i.memberId && !m.revoked),
      )
    )
      session.closed = true
  }
  for (const job of adventure(room).aiLog?.jobs ?? []) {
    if (
      job.kind !== 'npc' ||
      !job.qqSessionId ||
      ['published', 'rejected', 'stale', 'canceled'].includes(job.status)
    )
      continue
    const session = room.qq.sessions.find((s) => s.id === job.qqSessionId && !s.closed)
    if (
      !session ||
      !qqIdentityLive(room, job.qqIdentityId ?? '', job.characterId) ||
      !dialogueFresh(room, job)
    ) {
      job.status = 'stale'
      job.attempt = null
      job.error = 'QQ 会话状态或角色权限已变化，请重新发起'
    }
  }
}
export function qqView(room: Room, member: RoomMember, bindingId: string): QqMemberView {
  const q = qqState(room),
    gm = member.role === 'gm',
    identity = q.identities.find(
      (i) => i.memberId === member.id && i.bindingId === bindingId && !i.revoked,
    ),
    chars = room.world.characters.filter((c) => member.characterIds.includes(c.id))
  return {
    enabled: !!bindingId,
    gm,
    pending: q.codes
      .filter(
        (c) =>
          c.memberId === member.id &&
          c.bindingId === bindingId &&
          c.expires > Date.now() &&
          c.marker,
      )
      .map((c) => ({ marker: c.marker, expires: c.expires })),
    identity: identity ? { id: identity.id, characterId: identity.characterId } : null,
    characters: chars.map((c) => ({ id: c.id, name: c.build.name })),
    identities: gm
      ? q.identities
          .filter((i) => !i.revoked && i.bindingId === bindingId)
          .map((i) => ({
            id: i.id,
            nickname: room.members.find((m) => m.id === i.memberId)?.nickname ?? '已撤销成员',
            character:
              room.world.characters.find((c) => c.id === i.characterId)?.build.name ?? '尚未选择',
          }))
      : [],
    contexts: gm ? q.contexts : [],
    sessions: gm
      ? q.sessions
          .filter((s) => !s.closed && s.bindingId === bindingId)
          .map((s) => ({
            id: s.id,
            npcName: adventure(room).ai?.npcs.find((n) => n.id === s.npcId)?.name ?? '已移除 NPC',
          }))
      : [],
    npcs: gm ? (adventure(room).ai?.npcs ?? []).map((n) => ({ id: n.id, name: n.name })) : [],
    sceneId: activeScene(room)?.id ?? '',
  }
}
export function qqWeb(room: Room, member: RoomMember, bindingId: string, input: unknown) {
  if (!bindingId || !liveQqBinding(room, bindingId)) throw new RoomError('请先由 GM 关联当前 QQ 群')
  const c = qqWebCommand.parse(input),
    q = qqState(room)
  q.codes = q.codes.filter((c) => c.expires > Date.now())
  let code = ''
  if (c.type === 'code') {
    if (member.role !== 'player')
      throw new RoomError('QQ 行动身份仅绑定玩家成员；GM 裁定请在 Web 操作', 403)
    if (q.codes.length >= 100) throw new RoomError('配对请求已满')
    q.codes = q.codes.filter((c) => c.memberId !== member.id || c.bindingId !== bindingId)
    code = randomBytes(8).toString('hex').toUpperCase()
    q.codes.push({
      hash: hash(code),
      memberId: member.id,
      bindingId,
      expires: Date.now() + 600000,
      identity: '',
      marker: '',
    })
  } else if (c.type === 'confirm') {
    const candidate = q.codes.find(
      (x) =>
        x.memberId === member.id &&
        x.bindingId === bindingId &&
        x.marker === c.marker &&
        x.identity,
    )
    if (!candidate || member.role !== 'player') throw new RoomError('配对标记不可用，请重新配对')
    if (candidate.characterId && !member.characterIds.includes(candidate.characterId))
      throw new RoomError('原选角色已不归本人控制，请重新配对', 403)
    if (
      q.identities.some(
        (i) =>
          !i.revoked &&
          i.bindingId === bindingId &&
          i.identity === candidate.identity &&
          i.memberId !== member.id,
      )
    )
      throw new RoomError('该 QQ 身份已绑定另一成员，请先撤销')
    for (const i of q.identities)
      if (i.memberId === member.id && i.bindingId === bindingId) i.revoked = true
    q.identities = q.identities.filter(
      (i) => !i.revoked || q.requests.some((r) => r.identityId === i.id),
    )
    if (q.identities.length >= 200) throw new RoomError('QQ 身份记录已满，请由 GM 清理旧绑定')
    q.identities.push({
      id: randomUUID(),
      memberId: member.id,
      bindingId,
      identity: candidate.identity,
      characterId:
        candidate.characterId && member.characterIds.includes(candidate.characterId)
          ? candidate.characterId
          : member.characterIds.length === 1
            ? member.characterIds[0]!
            : '',
      revoked: false,
    })
    q.codes = q.codes.filter((x) => x.memberId !== member.id || x.bindingId !== bindingId)
  } else if (c.type === 'revoke') {
    const i = q.identities.find((i) => i.id === c.identityId && i.bindingId === bindingId)
    if (!i || (i.memberId !== member.id && member.role !== 'gm'))
      throw new RoomError('不能撤销他人的身份', 403)
    i.revoked = true
  } else if (c.type === 'select') {
    const i = q.identities.find(
      (i) => i.memberId === member.id && i.bindingId === bindingId && !i.revoked,
    )
    if (!i || !member.characterIds.includes(c.characterId))
      throw new RoomError('请选择自己获分配的角色', 403)
    i.characterId = c.characterId
  } else {
    if (member.role !== 'gm') throw new RoomError('上下文选择需要 GM', 403)
    if (c.type === 'close-session') {
      const session = q.sessions.find((s) => s.id === c.sessionId && s.bindingId === bindingId)
      if (!session) throw new RoomError('会话不存在')
      session.closed = true
    } else if (c.type === 'context-remove')
      q.contexts = q.contexts.filter((x) => x.id !== c.contextId)
    else {
      const scene = activeScene(room),
        npc = adventure(room).ai?.npcs.find(
          (n) => n.id === c.npcId && n.sceneId === scene?.id && n.enabled && !n.hidden,
        )
      if (!scene || !npc || !scene.tokens.some((t) => t.characterId === c.characterId && !t.hidden))
        throw new RoomError('请选择当前公开场景的 NPC 与说话角色')
      if (q.contexts.length >= 50) throw new RoomError('上下文已满，请先清理')
      q.contexts.push({
        id: randomUUID(),
        npcId: npc.id,
        sceneId: scene.id,
        branch: qqBranch(room),
        characterId: c.characterId,
        purpose: c.purpose,
        text: c.text,
      })
    }
  }
  reconcileQq(room)
  return { ...qqView(room, member, bindingId), ...(code ? { code } : {}) }
}

const terminal = new Set(['published', 'rejected', 'stale', 'canceled'])
export function qqReceive(
  room: Room,
  bindingId: string,
  identity: string,
  source: string,
  message: string,
) {
  if (!liveQqBinding(room, bindingId)) throw new RoomError('QQ 房间关联已变化，请由 GM 重新确认')
  const q = qqState(room),
    previous = q.receipts.find((r) => r.source === source)
  if (previous) return previous.response
  reconcileQq(room)
  const locale=localeOrDefault(adventure(room).ai?.settings.contentLocale)
  const msg=(key:SystemMessageKey,args:Record<string,string|number>={})=>formatSystemText(locale,key,args)
  let response: string
  let conversationId: string | undefined
  const pair = message.match(/^配对\s+([A-Fa-f0-9]{16})$/)
  if (pair) {
    let c = q.codes.find(
      (c) =>
        c.bindingId === bindingId &&
        c.hash === hash(pair[1]!.toUpperCase()) &&
        c.expires > Date.now(),
    )
    if (!c) throw new RoomError('配对码不可用或已过期')
    if (c.identity && c.identity !== identity) {
      const existing = q.codes.find(
        (x) => x.hash === c!.hash && x.bindingId === bindingId && x.identity === identity,
      )
      if (existing) c = existing
      else {
        if (q.codes.length >= 100) throw new RoomError('配对候选已满')
        c = { ...c, identity: '', marker: '' }
        q.codes.push(c)
      }
    }
    if (!room.members.some((m) => m.id === c.memberId && m.role === 'player' && !m.revoked))
      throw new RoomError('Web 成员权限已失效')
    c.identity = identity
    c.marker ||= randomBytes(4).toString('hex').toUpperCase()
    response = msg('qq.pairMarker',{marker:c.marker})
  } else {
    const i = q.identities.find(
        (i) => i.bindingId === bindingId && i.identity === identity && !i.revoked,
      ),
      member = room.members.find((m) => m.id === i?.memberId && !m.revoked && m.role === 'player')
    if (!i || !member)
      throw new RoomError('请先在 Web 玩家身份生成配对码，在群 @Bot 配对 <码>，再回 Web 确认')
    if (member.characterIds.length === 1) i.characterId = member.characterIds[0]!
    const characterId = i.characterId
    const lookup = message.match(/^(查询申请|撤回申请)\s+(\S+)$/)
    if (lookup) {
      const r = q.requests.find((r) => r.id === lookup[2] && r.identityId === i.id),
        intent = room.intents.find((x) => x.id === r?.intentId)
      if (!r || !intent) throw new RoomError('申请不存在或不属于此 QQ 身份')
      if (lookup[1] === '撤回申请') {
        if (intent.status !== 'pending')
          throw new RoomError('只能撤回尚未批准的申请；已执行行动不能回滚')
        intent.status = 'withdrawn'
        intent.reason = 'QQ 玩家主动撤回'
      }
      const labels = {
        pending: msg('qq.pending'),
        approved: msg('qq.approved'),
        rejected: msg('qq.rejected'),
        stale: msg('qq.stale'),
        withdrawn: msg('qq.withdrawn'),
      }
      response = msg('qq.requestStatus',{id:r.id,status:labels[intent.status]})
    } else if (!characterId || !member.characterIds.includes(characterId))
      throw new RoomError('请先在 Web 选择自己的操控角色；单角色会自动选择')
    else if (message.startsWith('行动 ')) {
      const action = qqAction(room, member, characterId, message.slice(3).trim())
      executeCommand(room, member, {
        kind: 'intent-submit',
        action,
        source: 'player',
        summary: 'QQ：' + message.slice(3),
        baseWorldRevision: room.worldRevision,
      })
      const intent = room.intents.at(-1)!,
        id = randomBytes(5).toString('hex').toUpperCase()
      intent.source = 'qq'
      q.requests.push({
        id,
        identityId: i.id,
        characterId,
        sceneId: activeScene(room)!.id,
        branch: qqBranch(room),
        turn: qqTurn(room),
        intentId: intent.id,
        action,
      })
      q.requests = q.requests
        .filter((r) => room.intents.some((i) => i.id === r.intentId))
        .slice(-100)
      response = msg('qq.actionSubmitted',{id})
    } else if (message.startsWith('领取回复 ')) {
      const npcId = message.slice(5).trim()
      const job = journal(room)
        .jobs.filter(
          (j) =>
            j.kind === 'npc' &&
            j.npcId === npcId &&
            j.qqIdentityId === i.id &&
            j.characterId === characterId &&
            j.branchId === qqBranch(room) &&
            q.sessions.some(
              (s) =>
                s.id === j.qqSessionId &&
                !s.closed &&
                s.sceneId === activeScene(room)?.id &&
                s.bindingId === bindingId,
            ) &&
            j.status === 'published' &&
            j.visibility === 'public',
        )
        .at(-1)
      if (!job || job.kind !== 'npc')
        throw new RoomError('暂无本人可领取的已发布回复，请在Web核对审核状态')
      const npc = adventure(room).ai?.npcs.find((n) => n.id === npcId)
      if (!npc) throw new RoomError('NPC已不可交谈')
      canTalk(room, member, npc, characterId)
      conversationId = job.id
      response = `[NPC·${npc.name}] ${dialogueSegments(job.text, job.segments)
        .map((s) => s.text)
        .join('\n\n')}`
    } else {
      const direct = message.match(/^直聊\s+(.+?)[：:]\s*([\s\S]+)$/)
      const start = message.match(/^对话\s+(.+?)[：:]\s*([\s\S]+)$/),
        continuation = message.match(/^继续对话\s+(\S+)[：:]\s*([\s\S]+)$/),
        join = message.match(/^加入对话\s+(\S+)$/),
        scene = activeScene(room)
      if (!scene) throw new RoomError('尚未进入场景')
      let session: QqRoomState['sessions'][number] | undefined
      let line = ''
      if (start || direct) {
        const n = choose(
          (adventure(room).ai?.npcs ?? []).filter(
            (n) => n.enabled && !n.hidden && n.sceneId === scene.id,
          ),
          (start ?? direct)![1]!,
          '公开 NPC',
        )
        session = direct
          ? q.sessions
              .filter(
                (s) =>
                  s.bindingId === bindingId &&
                  s.npcId === n.id &&
                  !s.closed &&
                  s.branch === qqBranch(room) &&
                  s.sceneId === scene.id &&
                  s.participants.some(
                    (p) => p.memberId === member.id && p.characterId === characterId,
                  ),
              )
              .at(-1)
          : undefined
        if (!session) {
          if (q.sessions.filter((s) => !s.closed).length >= 50)
            throw new RoomError('公开会话已满，请由 GM 清理旧场景会话')
          session = {
            id: randomBytes(5).toString('hex').toUpperCase(),
            bindingId,
            npcId: n.id,
            sceneId: scene.id,
            branch: qqBranch(room),
            participants: [{ memberId: member.id, characterId }],
            closed: false,
          }
          if (q.sessions.length >= 100) {
            const old = q.sessions.findIndex((s) => s.closed)
            if (old < 0) throw new RoomError('会话记录已满，请先关闭旧会话')
            q.sessions.splice(old, 1)
          }
          q.sessions.push(session)
        }
        line = (start ?? direct)![2]!
      } else if (continuation || join) {
        session = q.sessions.find(
          (s) =>
            s.id === (continuation ?? join)![1] &&
            s.bindingId === bindingId &&
            !s.closed &&
            s.branch === qqBranch(room) &&
            s.sceneId === scene.id,
        )
        if (!session) throw new RoomError('会话已关闭或场景、存档分支已变化，请重新发起对话')
        if (join) {
          const npc = adventure(room).ai?.npcs.find((n) => n.id === session!.npcId)
          if (!npc) throw new RoomError('NPC 已不可交谈')
          canTalk(room, member, npc, characterId)
          if (
            !session.participants.some(
              (p) => p.memberId === member.id && p.characterId === characterId,
            )
          ) {
            if (session.participants.length >= 100) throw new RoomError('会话参与人数已满')
            session.participants.push({ memberId: member.id, characterId })
          }
        } else {
          if (
            !session.participants.some(
              (p) => p.memberId === member.id && p.characterId === characterId,
            )
          )
            throw new RoomError('请先明确加入此公开会话')
          line = continuation![2]!
        }
      } else
        throw new RoomError(
          '命令：对话 <NPC编号/名称>：台词；继续对话 <编号>：台词；加入对话 <编号>；行动 <明确行动>；查询申请 <编号>；撤回申请 <编号>。群内均为公开内容；私人交谈请到 Web。',
        )
      if (line) {
        if (line.length > 2000) throw new RoomError('台词最多 2000 字')
        const cmd: RoomCommand = {
          kind: 'npc-talk',
          npcId: session.npcId,
          characterId,
          message: line,
          visibility: 'public',
          goal: '',
        }
        executeCommand(room, member, cmd)
        const job = journal(room).jobs.at(-1)!
        if (job.kind === 'npc') {
          job.qqSessionId = session.id
          job.qqIdentityId = i.id
          conversationId = job.id
          const n = adventure(room).ai!.npcs.find((n) => n.id === session!.npcId)!
          if (n.npcType !== 'ordinary') queuePublicDialogue(room, n, job)
          // Fixed NPC lines incur no model classification. Explicit new policies still require GM.
          if (
            n.npcType === 'ordinary' &&
            !dialoguePaused(room) &&
            (!n.dialogueReview || dialogueCategories(room, n).length > 0)
          ) {
            job.status = 'queued'
            job.check = { skill: 'none', total: null, success: null, adjudicated: true }
          }
        }
      }
      const last = journal(room).jobs.at(-1)
      response = msg('qq.session',{id:session.id,status:line?msg(last?.kind==='npc'&&last.dialogueReview?'qq.classifying':last?.status==='queued'?'qq.generating':'qq.awaitingDialogue'):msg('qq.joined')})
      if (direct)
        response = line
          ? msg('qq.directSubmitted')
          : msg('qq.directJoined')
    }
  }
  q.receipts = q.receipts.filter((r) => r.at > Date.now() - 600000)
  if (q.receipts.length >= 1000) throw new RoomError('QQ 输入记录已满，请稍后重试')
  q.receipts.push({
    source,
    at: Date.now(),
    response,
    ...(conversationId ? { conversationId } : {}),
  })
  return response
}
