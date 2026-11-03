import type { Room } from '../online/protocol'
import type { NpcProfile, AiJob } from '../core/ai-types'

/** References are portable labels, never credentials or URLs. An explicit missing label must not fall back. */
export function resolveModel(room: Room, kind: 'narration' | 'npc', npc?: NpcProfile) {
  const settings = room.world.adventures[0]?.ai?.settings
  const ref =
    kind === 'narration' ? settings?.narrationModelRef : npc?.modelRef || settings?.npcModelRef
  return ref
    ? {
        id: 'profile:' + ref,
        config: room.modelProfiles?.find((p) => p.name === ref)?.configuration,
      }
    : { id: 'legacy', config: room.aiModel }
}
export function modelProfileViews(room: Room) {
  return (room.modelProfiles ?? []).map(({ name, configuration }) => {
    const { apiKey, ...safe } = configuration
    return { name, ...safe, hasKey: !!apiKey }
  })
}

export function resolveJobModel(room: Room, job: AiJob) {
  if (job.kind === 'narration' && job.modelProbe)
    return {
      id: 'profile:' + job.modelProbe,
      config: room.modelProfiles?.find((p) => p.name === job.modelProbe)?.configuration,
    }
  return resolveModel(
    room,
    job.kind,
    job.kind === 'npc'
      ? room.world.adventures[0]?.ai?.npcs.find((n) => n.id === job.npcId)
      : undefined,
  )
}
