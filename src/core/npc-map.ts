import { npcAbsent } from './scene-arrivals'
import { clone, type Catalogue } from './engine'
import { applyCombat } from './combat'
import type { Adventure, MapWorld, MapScene, MapToken } from './map-types'
import type { NpcProfile } from './ai-types'
import { blocked, inside, occupied } from './map'
import { npcLifeState } from './npc-life-state'

export const npcForCharacter = (world: MapWorld, id: string) =>
  world.adventures.flatMap((a) => a.ai?.npcs ?? []).find((n) => n.characterId === id)
export const isNpcCharacter = (world: MapWorld, id: string) =>
  !!world.characters.find((c) => c.id === id)?.npcOwnerId ||
  world.characters.find((c) => c.id === id)?.purpose === 'npc' ||
  !!npcForCharacter(world, id)
export function npcBody(world: MapWorld, n: NpcProfile) {
  return world.encounters.flatMap((e) => e.actors).find((a) => a.id === n.actorId)?.npc ?? n.body
}
/** Templates seed an ordinary actor; thereafter actorId points to its one live runtime. */
export function attachSceneNpcs(a: Adventure, world: MapWorld, s: MapScene, cat: Catalogue) {
  const index = world.encounters.findIndex((e) => e.id === s.encounterId)
  if (index < 0 || world.encounters[index]!.phase === 'active') return
  for (const n of a.ai?.npcs.filter((n) => n.sceneId === s.id && n.enabled && !npcAbsent(n)) ??
    []) {
    if (npcLifeState(world, n).dead) continue
    const current = world.encounters[index]!,
      prior = current.actors.find(
        (t) => t.id === n.actorId || (n.characterId && t.characterId === n.characterId),
      )
    if (prior) {
      if (n.actorId !== prior.id) n.revision++
      n.actorId = prior.id
      continue
    }
    const body = npcBody(world, n)
    if (!n.characterId && !body) continue
    const next = applyCombat(
      current,
      world.characters,
      cat,
      n.characterId
        ? { type: 'add-character', characterId: n.characterId, side: n.side }
        : { type: 'add-npc', npc: { ...clone(body!), name: n.name }, side: n.side },
    )
    world.encounters[index] = next.encounter
    world.characters = next.characters
    n.actorId = next.encounter.actors.at(-1)!.id
    next.encounter.actors.at(-1)!.npcId=n.id
    n.revision++
  }
}
export function syncNpcTokens(a: Adventure, world: MapWorld, editedProfileId?: string) {
  for (const s of a.scenes) {
    s.tokens = s.tokens.filter(
      (t) =>
        !t.npcId || a.ai?.npcs.some((n) => n.id === t.npcId && n.sceneId === s.id && !npcAbsent(n)),
    )
    const e = world.encounters.find((e) => e.id === s.encounterId)
    for (const n of a.ai?.npcs.filter((n) => n.sceneId === s.id && !npcAbsent(n)) ?? []) {
      if (npcLifeState(world, n).dead) continue
      if (s.defeatedTokens?.some((t) => t.npcId === n.id)) continue
      const actor = e?.actors.find(
        (t) => t.id === n.actorId || (n.characterId && t.characterId === n.characterId),
      )
      let t = s.tokens.find(
        (t) =>
          t.npcId === n.id ||
          (actor && t.actorId === actor.id) ||
          (n.characterId && t.characterId === n.characterId),
      )
      const span =
        n.body?.size === 'large'
          ? 2
          : n.body?.size === 'huge'
            ? 3
            : n.body?.size === 'gargantuan'
              ? 4
              : (t?.span ?? 1)
      if (!t) {
        const candidates = [
          n.position,
          ...Array.from({ length: s.grid.columns * s.grid.rows }, (_, i) => ({
            x: i % s.grid.columns,
            y: Math.floor(i / s.grid.columns),
          })).sort(
            (p, q) =>
              Math.max(Math.abs(p.x - n.position.x), Math.abs(p.y - n.position.y)) -
              Math.max(Math.abs(q.x - n.position.x), Math.abs(q.y - n.position.y)),
          ),
        ]
        const p = candidates.find((p) =>
          occupied({ ...p, span } as MapToken).every(
            (p) =>
              inside(s, p) &&
              !blocked(s, p) &&
              !s.tokens.some((t) => occupied(t).some((o) => o.x === p.x && o.y === p.y)),
          ),
        )
        if (!p) throw Error('场景没有可用 NPC 落点')
        t = {
          id: crypto.randomUUID(),
          npcId: n.id,
          characterId: n.characterId,
          actorId: actor?.id ?? null,
          name: n.name,
          ...p,
          span,
          hidden: n.hidden,
          color: n.npcType === 'important' ? '#75609e' : '#a86c42',
          facing: 0,
        }
        s.tokens.push(t)
      }
      t.npcId = n.id
      t.characterId = n.characterId
      t.actorId = actor?.id ?? null
      t.name = n.name
      if (actor && n.actorId !== actor.id) {
        n.actorId = actor.id
        n.revision++
      }
      // A GM-hidden map token must stay hidden through enter/link/restore operations.
      t.hidden = n.hidden
    }
  }
}
