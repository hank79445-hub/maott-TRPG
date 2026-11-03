import type { NpcProfile } from './ai-types'
import type { MapScene, MapToken, MapWorld } from './map-types'
import { npcLifeState } from './npc-life-state'

type Profile = Pick<
  NpcProfile,
  'id' | 'name' | 'sceneId' | 'position' | 'characterId' | 'hidden' | 'npcType' | 'initiallyAbsent'
> & { body: { size?: string; dead?: boolean } | null } & Partial<Pick<NpcProfile, 'appeared'>>
type Scene = Pick<MapScene, 'id' | 'grid' | 'regions'> & {
  tokens: Pick<MapToken, 'npcId' | 'characterId' | 'x' | 'y' | 'span'>[]
  defeatedTokens?: Pick<MapToken, 'npcId' | 'characterId'>[]
}

/** Fill missing representations only. Never reset an existing token or spawn a pending arrival. */
export function missingNpcTokens(scene: Scene, profiles: Profile[]) {
  const added: Omit<MapToken, 'actorId'>[] = []
  for (const n of profiles) {
    if (n.sceneId !== scene.id || n.body?.dead || (n.initiallyAbsent && !n.appeared)) continue
    if (
      scene.defeatedTokens?.some(
        (t) => t.npcId === n.id || (!!n.characterId && t.characterId === n.characterId),
      )
    )
      continue
    if (
      [...scene.tokens, ...added].some(
        (t) => t.npcId === n.id || (n.characterId && t.characterId === n.characterId),
      )
    )
      continue
    const span =
      n.body?.size === 'large'
        ? 2
        : n.body?.size === 'huge'
          ? 3
          : n.body?.size === 'gargantuan'
            ? 4
            : 1
    const cells = Array.from({ length: span * span }, (_, i) => ({
      x: n.position.x + (i % span),
      y: n.position.y + Math.floor(i / span),
    }))
    // A live unit may have occupied the original design position. Do not move either unit silently.
    if (
      cells.some(
        (p) =>
          p.x < 0 ||
          p.y < 0 ||
          p.x >= scene.grid.columns ||
          p.y >= scene.grid.rows ||
          scene.regions.some(
            (r) => r.tags.includes('blocked') && r.cells.includes(`${p.x},${p.y}`),
          ) ||
          [...scene.tokens, ...added].some(
            (t) => p.x >= t.x && p.x < t.x + t.span && p.y >= t.y && p.y < t.y + t.span,
          ),
      )
    )
      continue
    added.push({
      id: crypto.randomUUID(),
      npcId: n.id,
      characterId: n.characterId,
      name: n.name,
      ...n.position,
      span,
      hidden: n.hidden,
      color: n.npcType === 'important' ? '#75609e' : '#a86c42',
      facing: 0,
    })
  }
  return added
}

export function repairScriptRoomNpcTokens(world: MapWorld) {
  let count = 0
  for (const a of world.adventures) {
    if (!a.sourceScript) continue
    for (const s of a.scenes) {
      const added = missingNpcTokens(
        s,
        (a.ai?.npcs ?? []).filter((n) => !npcLifeState(world, n).dead),
      )
      s.tokens.push(
        ...added.map((t) => ({
          ...t,
          actorId: a.ai?.npcs.find((n) => n.id === t.npcId)?.actorId ?? null,
        })),
      )
      count += added.length
    }
  }
  return count
}
