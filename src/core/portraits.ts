import { PORTRAIT_MAX_LENGTH, PORTRAIT_PATTERN, type Character } from './types'
import type { NpcProfile, NpcTemplate } from './ai-types'
import type { Combatant } from './combat-types'
import type { Adventure, MapToken, MapWorld } from './map-types'

/** Only local JPEG thumbnails produced by the picker may be displayed. */
export function isSafePortrait(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= PORTRAIT_MAX_LENGTH &&
    (PORTRAIT_PATTERN.test(value) ||
      /^\/npc-portraits\/(commoner|guard|bandit|goblin|beast|undead|important)\.svg$/.test(value))
  )
}

export function safePortrait(value: unknown): string | null {
  return isSafePortrait(value) ? value : null
}

export function npcPortrait(
  profile: Pick<NpcProfile, 'portrait'> &
    Partial<Pick<NpcProfile, 'npcType' | 'templateId' | 'body'>>,
  character?: Pick<Character, 'portrait'>,
  fallback?: string | null,
  template?: Pick<NpcTemplate, 'portrait'>,
): string | null {
  return (
    safePortrait(profile.portrait) ??
    safePortrait(character?.portrait) ??
    safePortrait(template?.portrait) ??
    safePortrait(fallback) ??
    (profile.npcType ? defaultNpcPortrait(profile) : null)
  )
}

function defaultNpcPortrait(n: Partial<Pick<NpcProfile, 'npcType' | 'templateId' | 'body'>>) {
  if (n.npcType === 'important') return '/npc-portraits/important.svg'
  const id = n.templateId ?? n.body?.templateMetadata?.englishName?.toLowerCase() ?? ''
  const kind = /guard|hobgoblin/.test(id)
    ? 'guard'
    : /goblin/.test(id)
      ? 'goblin'
      : /bandit|scout/.test(id)
        ? 'bandit'
        : /skeleton|zombie|ghoul/.test(id)
          ? 'undead'
          : /wolf|bear|rat|spider|boar|panther/.test(id)
            ? 'beast'
            : 'commoner'
  return `/npc-portraits/${kind}.svg`
}

function profilePortrait(world: MapWorld, adventure: Adventure, profile: NpcProfile) {
  return npcPortrait(
    profile,
    world.characters.find((c) => c.id === profile.characterId),
    adventure.ai?.settings.npcPortrait,
    adventure.ai?.templates?.find((t) => t.id === profile.templateId),
  )
}

export function actorPortrait(world: MapWorld, actor: Combatant): string | null {
  for (const adventure of world.adventures) {
    const profile = adventure.ai?.npcs.find(
      (n) => n.actorId === actor.id || (!!actor.characterId && n.characterId === actor.characterId),
    )
    if (profile) return profilePortrait(world, adventure, profile)
  }
  const character = world.characters.find((c) => c.id === actor.characterId)
  if (character) return safePortrait(character.portrait)
  if (!actor.npc || actor.companion) return null
  const encounter = world.encounters.find((e) => e.actors.some((a) => a.id === actor.id))
  const adventure = world.adventures.find((a) =>
    a.scenes.some((s) => s.encounterId === encounter?.id),
  )
  return safePortrait(adventure?.ai?.settings.npcPortrait)
}

export function tokenPortrait(
  world: MapWorld,
  adventure: Adventure,
  token: MapToken,
): string | null {
  const profile = adventure.ai?.npcs.find(
    (n) =>
      n.id === token.npcId ||
      (!!token.actorId && n.actorId === token.actorId) ||
      (!!token.characterId && n.characterId === token.characterId),
  )
  if (profile) return profilePortrait(world, adventure, profile)
  const actor = world.encounters.flatMap((e) => e.actors).find((a) => a.id === token.actorId)
  return actor
    ? actorPortrait(world, actor)
    : safePortrait(world.characters.find((c) => c.id === token.characterId)?.portrait)
}
