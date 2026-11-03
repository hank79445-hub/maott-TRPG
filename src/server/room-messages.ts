import type { Room, RoomMember } from '../online/protocol'
import type { RoomMessage, RoomMessages } from '../online/message-types'
import { dialogueSegments } from '../core/dialogue-segments'
import { adventure, activeScene } from './room-engine'
import { createHash } from 'node:crypto'
import { fogEntityAllowed, fogMapAllowed, createFogAccess } from './fog'
import { enclosedMode } from '../core/enclosed-exploration'
import { canReadBroadcast } from './room-broadcast'
import { canTalk, canTalkGroup, visibleNpc, publicDialogueAudience } from './room-ai'
import { npcPortrait } from '../core/portraits'
import type { MessageNpc } from '../online/message-types'
export function messageNpcs(room: Room, member: RoomMember): MessageNpc[] {
  const a = adventure(room),scene=activeScene(room),context=scene&&member.role!=='gm'?createFogAccess(room,member,scene.id,false):undefined
  return (a.ai?.npcs ?? [])
    .filter((n) => visibleNpc(room, n) && (member.role==='gm'||!scene?.fog?.enabled||!!scene.tokens.some(t=>(t.npcId===n.id||!!n.characterId&&t.characterId===n.characterId)&&(enclosedMode(scene)?fogMapAllowed(room,member,n.sceneId,t,context):fogEntityAllowed(room,member,n.sceneId,t,context)))))
    .map((n) => ({
      id: n.id,
      name: n.name,
      npcType: n.npcType,
      portrait: npcPortrait(
        n,
        room.world.characters.find((c) => c.id === n.characterId),
        a.ai?.settings.npcPortrait,
        a.ai?.templates?.find((t) => t.id === n.templateId),
      ),
      illustration: n.illustration,
      groupCharacters: room.world.characters
        .filter(
          (c) => !c.npcOwnerId && (member.role === 'gm' || member.characterIds.includes(c.id)),
        )
        .filter((c) => {
          try {
            canTalkGroup(room, member, n, c.id)
            return true
          } catch {
            return false
          }
        })
        .map((c) => c.id),
      characters: room.world.characters
        .filter(
          (c) => !c.npcOwnerId && (member.role === 'gm' || member.characterIds.includes(c.id)),
        )
        .filter((c) => {
          try {
            canTalk(room, member, n, c.id)
            return true
          } catch {
            return false
          }
        })
        .map((c) => c.id),
    }))
}
export function roomMessages(room: Room, member: RoomMember, before = ''): RoomMessages {
  const a = adventure(room),
    branchId = a.broadcastLog?.branchId ?? 'legacy'
  const items: RoomMessage[] = []
  const scene=activeScene(room),publishedNpcIds=scene&&enclosedMode(scene)&&member.role!=='gm'?new Set(messageNpcs(room,member).map(n=>n.id)):undefined
  for (const j of a.aiLog?.jobs ?? []) {
    if (j.kind !== 'npc' || j.spatialPlanning || j.purpose === 'combat' || j.activityTest || j.branchId !== branchId)
      continue
    if (
      member.role !== 'gm' &&
      j.visibility !== 'public' &&
      !member.characterIds.includes(j.characterId)
    )
      continue
    const n = a.ai?.npcs.find((n) => n.id === j.npcId)
    if (!n || (member.role !== 'gm' && n.hidden)) continue
    if(publishedNpcIds&&n.sceneId===scene?.id&&!publishedNpcIds.has(n.id)&&!member.characterIds.includes(j.characterId))continue
    const publishedEvent=a.broadcastLog?.events.find(e=>e.type==='npc.reply'&&e.facts.conversationId===j.id&&e.branchId===branchId)
    if(publishedEvent&&!canReadBroadcast(room,member,publishedEvent))continue
    const c = room.world.characters.find((c) => c.id === j.characterId)
    const base = {
      dialogueGroup: (()=>{const g=publicDialogueAudience(room,j);return g&&publishedNpcIds?{...g,recipients:g.recipients.filter(n=>publishedNpcIds.has(n.id))}:g})(),
      conversationId: j.id,
      npcId: j.npcId,
      characterId: j.characterId,
      personal: j.visibility === 'personal',
    }
    if (j.purpose === 'dialogue')
      items.push({
        ...base,
        id: j.id + ':input',
        kind: 'player',
        at: j.at,
        order: (j.inputOrder ?? j.sequence) * 2,
        name: c?.build.name ?? '玩家',
        text: j.message,
        segments: [{ kind: 'speech', text: j.message }],
        status: j.status,
        queueAhead:
          j.status === 'queued'
            ? (a.aiLog?.jobs ?? []).filter(
                (p) =>
                  p.kind === 'npc' &&
                  p.npcId === j.npcId &&
                  p.branchId === branchId &&
                  p.sequence < j.sequence &&
                  !['published', 'rejected', 'stale', 'canceled'].includes(p.status),
              ).length
            : 0,
      })
    if (j.status === 'published') {
      const event = a.broadcastLog?.events.find(
        (e) => e.type === 'npc.reply' && e.facts.conversationId === j.id && e.branchId === branchId,
      )
      items.push({
        ...base,
        id: j.id + ':reply',
        kind: 'npc',
        contentLocale:j.translationFallback?undefined:j.outputLocale,
        translationFallback:j.translationFallback,
        at: event?.at ?? j.at,
        order: (j.publishedOrder ?? j.sequence) * 2 + 1,
        name: n.name,
        text: j.text,
        segments: dialogueSegments(j.text, j.segments),
        status: 'published',
      })
    }
  }
  for(const event of a.broadcastLog?.events??[]){
    if(event.type!=='npc.peer-interruption'||event.branchId!==branchId||!canReadBroadcast(room,member,event)||typeof event.facts.characterId!=='string')continue
    const session=room.peerSessions?.find(s=>s.id===event.facts.peerSessionId&&s.branchId===branchId)
    if(!session)continue
    const speaker=room.world.characters.find(c=>c.id===event.facts.characterId)
    items.push({id:event.id,conversationId:event.id,npcId:session.participants[0]!,characterId:event.facts.characterId,at:event.at,order:event.sequence*2,kind:'player',name:speaker?.build.name??'玩家',text:event.text,segments:[{kind:'speech',text:event.text}],status:'published',personal:false})
  }
  items.sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order || a.id.localeCompare(b.id))
  const index = before ? items.findIndex((i) => i.id === before) : items.length
  const end = index < 0 ? items.length : index,
    start = Math.max(0, end - 50)
  const directoryStamp = createHash('sha256')
    .update(
      JSON.stringify([
        (a.ai?.npcs ?? [])
          .filter((n) => visibleNpc(room, n))
          .map((n) => [n.id, n.revision, n.body?.hp, n.body?.conditions]),
        activeScene(room)?.id,
        activeScene(room)?.fog,
        a.fogState?.areaRecords,
        activeScene(room)?.tokens.map((t) => [t.id, t.x, t.y, t.hidden]),
        activeScene(room)?.walls,
        member.characterIds,
        room.world.characters
          .filter((c) => member.role === 'gm' || member.characterIds.includes(c.id))
          .map((c) => [c.id, c.runtime?.hp, c.runtime?.conditions]),
      ]),
    )
    .digest('hex')
  return {
    permittedConversationIds: [...new Set(items.map((m) => m.conversationId))],
    directoryStamp,
    branchId,
    items: items.slice(start, end),
    older: start > 0 ? items[start]!.id : null,
    gap: index < 0,
    delivery: room.messageDelivery ?? 'both',
  }
}
