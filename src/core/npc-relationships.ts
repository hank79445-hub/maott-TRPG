import type { AdventureAi, NpcProfile } from './ai-types'
import type { KnowledgeState } from '../persistence/npc-knowledge-schema'
export const defaultMemoryConfig = () => ({
  enabled: false,
  provider: 'native' as const,
  embeddingModelRef: '',
  extractorModelRef: '',
  dimension: 1536,
})
export const defaultKnowledgeProfile = () => ({
  enabled: false,
  factionId: null as string | null,
  membership: 'direct' as const,
  hiddenMembership: false,
  backgroundBias: 0,
  lockedAttitude: null as NpcProfile['attitude'] | null,
  lockReason: '',
  templateIds: [] as string[],
})
export function newKnowledgeState(): KnowledgeState {
  return {
    version: 1,
    epoch: crypto.randomUUID(),
    sequence: 0,
    ancestors: [],
    outbox: [],
    removedIds: [],
    reputations: {},
    requests: [],
    revision: 0,
    status: '使用本地记忆',
  }
}
export function resolveNpcRelationship(
  ai: AdventureAi | undefined,
  n: NpcProfile,
  characterId: string,
  recognized = true,
) {
  const p = n.knowledgeProfile,
    enabled = p?.enabled === true
  const personal =
    n.affinityEnabled && recognized
      ? n.relations?.find((r) => r.characterId === characterId)?.score
      : undefined
  const base = personal ?? (n.attitude === 'friendly' ? 40 : n.attitude === 'hostile' ? -40 : 0)
  const faction =
    enabled && recognized && p.factionId && p.membership === 'direct'
      ? ai?.knowledgeDesign?.factions.find((f) => f.id === p.factionId)
      : undefined
  const reputation = faction
    ? (ai?.knowledgeState?.reputations[faction.id] ?? faction.initialScore)
    : 0
  const background = enabled ? p.backgroundBias : 0,
    total = Math.max(-100, Math.min(100, base + reputation + background))
  const band = total <= -40 ? '敌视' : total < -9 ? '戒备' : total < 40 ? '平常' : '亲近'
  const derived: NpcProfile['attitude'] =
    total <= -40 ? 'hostile' : total >= 40 ? 'friendly' : 'indifferent'
  return {
    enabled,
    personal: base,
    reputation,
    background,
    total,
    band,
    attitude: enabled ? (p.lockedAttitude ?? derived) : n.attitude,
    factionId: faction?.id ?? null,
    locked: enabled && !!p.lockedAttitude,
    revision:
      ai?.knowledgeState?.requests
        .filter((r) => r.factionId === faction?.id && r.applied !== 0)
        .map((r) => [r.id, r.applied]) ?? [],
  }
}
export function npcKnowledgeEntries(
  ai: AdventureAi | undefined,
  n: NpcProfile,
  publicOnly: boolean,
) {
  return (ai?.knowledgeDesign?.templates ?? [])
    .filter(
      (t) =>
        n.knowledgeProfile?.templateIds.includes(t.id) &&
        (!publicOnly || t.visibility === 'public'),
    )
    .map((t) => ({
      id: 'template:' + t.id + ':' + t.version,
      text: t.text,
      visibility: t.visibility,
    }))
}
