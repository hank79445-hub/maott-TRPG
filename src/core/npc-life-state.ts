import type { MapWorld, MapScene, MapToken } from './map-types'
import type { NpcProfile } from './ai-types'
import { clone } from './engine'
import { npcAbsent } from './scene-arrivals'
import { occupied, inside, blocked } from './map'
export function npcLifeState(world: MapWorld, n: NpcProfile) {
  const character = world.characters.find((c) => c.id === n.characterId)
  if (character?.runtime)
    return { hp: character.runtime.hp, dead: character.runtime.death?.dead ?? false }
  const actor = world.encounters.flatMap((e) => e.actors).find((a) => a.id === n.actorId)
  const body = actor?.npc ?? n.body
  return { hp: body?.hp ?? 1, dead: body?.dead ?? false }
}
function tokenDead(world: MapWorld, scene: MapScene, token: MapToken) {
  const n = world.adventures
    .flatMap((a) => a.ai?.npcs ?? [])
    .find((n) => n.id === token.npcId || (!!n.characterId && n.characterId === token.characterId))
  if (n) return npcLifeState(world, n).dead
  const actor = world.encounters
    .flatMap((e) => e.actors)
    .find((a) => a.id === (token.actorId ?? token.npcSourceActorId))
  return actor?.npc?.dead ?? token.npcBody?.dead ?? false
}
/** Keep retired markers for recovery; they are not live tokens and never occupy cells. */
export function syncNpcLifeTokens(world: MapWorld) {
  for (const a of world.adventures)
    for (const scene of a.scenes) {
      const retiring = scene.tokens.filter((t) => tokenDead(world, scene, t))
      if (retiring.length) {
        scene.defeatedTokens ??= []
        for (const token of retiring) {
          if (!scene.defeatedTokens.some((t) => t.id === token.id))
            scene.defeatedTokens.push(clone(token))
          const n = a.ai?.npcs.find((n) => n.id === token.npcId)
          if (n) n.position = { x: token.x, y: token.y }
        }
        scene.tokens = scene.tokens.filter((t) => !retiring.includes(t))
      }
      scene.defeatedTokens = scene.defeatedTokens?.filter((t) => {
        const profile = t.npcId
          ? a.ai?.npcs.find((n) => n.id === t.npcId && n.sceneId === scene.id)
          : null
        if (t.npcId && !profile) return false
        if (tokenDead(world, scene, t)) return true
        if (profile && npcAbsent(profile)) return true
        const actor = world.encounters
          .find((e) => e.id === scene.encounterId)
          ?.actors.find(
            (a) =>
              a.id === (profile?.actorId ?? t.actorId) ||
              (!!profile?.characterId && a.characterId === profile.characterId),
          )
        if (!profile && !actor) return true
        if (
          !scene.tokens.some(
            (live) =>
              live.id === t.id ||
              (!!t.npcId && live.npcId === t.npcId) ||
              (!!actor && live.actorId === actor.id),
          )
        ) {
          const restored = clone(t)
          restored.actorId = actor?.id ?? null
          if (profile) {
            restored.name = profile.name
            restored.hidden = profile.hidden
            restored.characterId = profile.characterId
            restored.x = profile.position.x
            restored.y = profile.position.y
          }
          if (
            !occupied(restored).every(
              (p) =>
                inside(scene, p) &&
                !blocked(scene, p) &&
                !scene.tokens.some((live) =>
                  occupied(live).some((q) => q.x === p.x && q.y === p.y),
                ),
            )
          )
            return true
          scene.tokens.push(restored)
        }
        return false
      })
      if (!scene.defeatedTokens?.length) delete scene.defeatedTokens
    }
}
