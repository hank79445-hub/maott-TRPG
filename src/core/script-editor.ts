import { initialNpcState } from './npc-abilities'
import { scriptCharacter } from './character-config'
export { scriptCharacter } from './character-config'
import { applyConfigImport } from './npc-config'
import { roleReference } from './script'
import { clone, catalogue } from './engine'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { newBroadcastSettings } from './broadcast'
import { newAdventure, newScene } from './map'
import { newNpcProfile } from './ai'
import { runtimeState } from './runtime'
import {
  scriptSceneSchema,
  scriptNpcSchema,
  scriptCharacterSchema,
  type ScriptDefinition,
} from '../persistence/script-schema'
import type { MapWorld, MapCommand, MapScene } from './map-types'
import type { Character } from './types'
import { inspectScript } from './script'
import { packSchema } from '../persistence/schema'

export function scriptEditorWorld(script: ScriptDefinition): MapWorld {
  const a = newAdventure(script.metadata.name)
  a.id = 'script-editor'
  a.scenes = script.scenes.map((s) => ({
    ...clone(s),
    encounterId: null,
    template: null,
    tokens: s.tokens.map((t) => ({
      ...clone(t),
      actorId: null,
      ...(t.npcBody ? { npcBody: { ...clone(t.npcBody), effects: [] } } : {}),
    })),
  })) as MapScene[]
  a.ai = {
    settings: clone(script.ai),
    npcs: script.npcs.map((n) => ({
      ...newNpcProfile(n.sceneId, n.npcType),
      ...clone(n),
      revision: 0,
      actorId: null,
      body: n.body ? { ...clone(n.body), effects: [] } : null,
      preauthorization: {
        ...clone(n.preauthorization),
        characterIds: [],
        remaining: 0,
        expiresAt: null,
      },
    })),
    templates: script.npcTemplates.map((t) => ({
      ...clone(t),
      body: { ...clone(t.body), effects: [] },
    })),
  }
  a.broadcast = { ...newBroadcastSettings(), templates: clone(script.broadcasts) }
  a.battles = { presets: clone(script.battles), history: [], requests: [] }
  const characters = script.characters.map(({ initial, initialConsumableDurations, ...c }) => {
    const value: Character = {
      ...clone(c),
      status: 'complete',
      purpose: 'npc',
      npcOwnerId: script.npcs.find((n) => n.characterId === c.id)?.id,
      revision: 0,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      journal: [],
      runtime: null,
    }
    const runtime = runtimeState(value, catalogue([...BUILTIN_PACKS, ...script.packs]))
    value.runtime = {
      ...runtime,
      ...clone(initial),
      resources: { ...runtime.resources, ...initial.resources },
    }
    for (const duration of initialConsumableDurations) {
      const item = value.inventory.find((i) => i.instanceId === duration.instanceId)
      if (item?.consumable) item.consumable.expiresAt = duration.hours
    }
    return value
  })
  return { adventures: [a], characters, encounters: [], packs: clone(script.packs) }
}
export function applyScriptCommand(
  script: ScriptDefinition,
  command: MapCommand,
): ScriptDefinition {
  const next = clone(script)
  switch (command.type) {
    case 'npc-config-import':
    case 'broadcast-text-import': {
      const world = scriptEditorWorld(next),
        a = world.adventures[0]!
      applyConfigImport(
        world,
        a,
        command,
        next.roles.map((r) => roleReference(r.id)),
      )
      next.npcs = a.ai!.npcs.map((n) => {
        const {
          fixedReplyCursor: _fixedReplyCursor,
          consumablesUsed: _consumablesUsed,
          actorId,
          revision,
          turnHold,
          arrivalOrigin: _arrivalOrigin,
          appeared: _appeared,
          experiences: _experiences,
          experienceOmitted: _omitted,
          relations: _relations,
          memory,
          revealedIds,
          urgingCooldowns,
          behaviorState,
          preauthorization,
          body,
          ...config
        } = n
        const { characterIds, remaining, expiresAt, ...preauth } = preauthorization
        const { effects, ...b } = body ?? { effects: [] }
        return scriptNpcSchema.parse({
          ...config,
          preauthorization: preauth,
          body: body ? b : null,
        })
      })
      next.characters = world.characters.map(scriptCharacter)
      next.packs = world.packs.map((p) => packSchema.parse(p))
      for (const p of world.packs)
        if (!next.dependencies.some((d) => d.id === p.id))
          next.dependencies.push({ id: p.id, version: p.version })
      next.scenes = world.adventures[0]!.scenes.map((s) => {
        const {
          encounterId,
          template,
          defeatedTokens: _retired,
          linkRuns: _links,
          discoveryAttempts: _attempts,
          pausedRoutes: _routes,
          ...scene
        } = s
        return scriptSceneSchema.parse({
          ...scene,
          tokens: s.tokens.map(({ actorId, npcSourceActorId, companionKey, ...t }) => t),
        })
      })
      next.broadcasts = a.broadcast?.templates ?? []
      break
    }
    case 'scene-add': {
      const { encounterId: _e, template: _t, ...s } = newScene(command.name)
      next.scenes.push(scriptSceneSchema.parse(s))
      break
    }
    case 'scene-edit': {
      const {
        encounterId: _e,
        template: _t,
        linkRuns: _links,
        defeatedTokens: _retired,
        discoveryAttempts: _attempts,
        pausedRoutes: _routes,
        ...s
      } = clone(command.scene)
      const tokens = s.tokens.map(
        ({ actorId: _a, npcSourceActorId: _n, companionKey: _c, npcBody, ...t }) => {
          const { effects: _fx, ...body } = npcBody ?? { effects: [] }
          return { ...t, ...(npcBody ? { npcBody: body } : {}) } as typeof t
        },
      )
      next.scenes = next.scenes.map((old) =>
        old.id === s.id
          ? scriptSceneSchema.parse({
              ...s,
              groundItems: s.groundItems?.map((g) => ({ ...g,inventoryState:undefined, quantity: g.initialQuantity })),
              arrivalGroups: s.arrivalGroups?.map(
                ({ status, reason, requestId, sourceEventId, ...g }) => g,
              ),
              tokens,
            })
          : old,
      )
      break
    }
    case 'token-edit': {
      const scene = next.scenes.find((s) => s.id === command.sceneId)
      if (!scene) throw Error('场景不存在')
      const {
        actorId: _a,
        npcSourceActorId: _n,
        companionKey: _c,
        npcBody,
        ...token
      } = command.token
      const { effects: _fx, ...body } = npcBody ?? { effects: [] }
      scene.tokens = scene.tokens.map((t) =>
        t.id === token.id
          ? ({ ...clone(token), ...(npcBody ? { npcBody: body } : {}) } as typeof t)
          : t,
      )
      const npc = next.npcs.find((n) => n.id === token.npcId)
      if (npc) npc.hidden = token.hidden
      break
    }
    case 'move': {
      const s = next.scenes.find((s) => s.id === command.sceneId),
        t = s?.tokens.find((t) => t.id === command.tokenId),
        p = command.path.at(-1)
      if (!t || !p) throw Error('请选择棋子和初始位置')
      t.x = p.x
      t.y = p.y
      const npc = next.npcs.find((n) => n.id === t.npcId)
      if (npc) {
        npc.position = { ...p }
        if (npc.guardOrigin) npc.guardOrigin = { sceneId: s!.id, ...p }
      }
      break
    }
    case 'npc-profile': {
      const p = clone(command.profile)
      const {
        fixedReplyCursor: _fixedReplyCursor,
        consumablesUsed: _consumablesUsed,
        actorId: _a,
        revision: _r,
        turnHold: _h,
        arrivalOrigin: _arrivalOrigin,
        appeared: _appeared,
        experiences: _experiences,
        experienceOmitted: _omitted,
        relations: _relations,
        memory: _m,
        revealedIds: _v,
        urgingCooldowns: _u,
        behaviorState: _b,
        preauthorization,
        body,
        ...config
      } = p
      const { characterIds: _c, remaining: _q, expiresAt: _e, ...preauth } = preauthorization
      const { effects: _fx, ...initialBody } = body ? initialNpcState(body) : { effects: [] }
      const value = scriptNpcSchema.parse({
        ...config,
        preauthorization: preauth,
        body: body ? initialBody : null,
      })
      const previous = next.npcs.find((n) => n.id === p.id)
      if (previous) next.npcs = next.npcs.map((n) => (n.id === p.id ? value : n))
      else next.npcs.push(value)
      for (const scene of next.scenes) scene.tokens = scene.tokens.filter((t) => t.npcId !== p.id)
      // Placing an NPC is part of the design, not a live encounter participant.
      const scene = next.scenes.find((s) => s.id === p.sceneId)
      if (!scene) throw Error('NPC 场景不存在')
      const oldToken = script.scenes.flatMap((s) => s.tokens).find((t) => t.npcId === p.id)
      const token = {
        span: 1,
        facing: 0,
        color: '#c98459',
        ...clone(oldToken ?? {}),
        id: oldToken?.id ?? crypto.randomUUID(),
        name: p.name,
        npcId: p.id,
        characterId: p.characterId,
        ...p.position,
        hidden: p.hidden,
      }
      scene.tokens.push(scriptSceneSchema.parse({ ...scene, tokens: [token] }).tokens[0]!)
      break
    }
    case 'npc-delete': {
      const npc = next.npcs.find((n) => n.id === command.npcId)
      next.npcs = next.npcs.filter((n) => n.id !== command.npcId)
      next.characters = next.characters.filter((c) => c.id !== npc?.characterId)
      for (const s of next.scenes) s.tokens = s.tokens.filter((t) => t.npcId !== command.npcId)
      next.battles = next.battles.map((b) => ({
        ...b,
        participants: b.participants.filter(
          (p) => p.id !== command.npcId && p.id !== npc?.characterId,
        ),
      }))
      break
    }
    case 'npc-template': {
      const { effects: _fx, ...body } = command.template.body
      const value = { ...clone(command.template), body }
      const index = next.npcTemplates.findIndex((t) => t.id === value.id)
      if (index < 0) next.npcTemplates.push(value)
      else next.npcTemplates[index] = value
      break
    }
    case 'npc-template-delete':
      next.npcTemplates = next.npcTemplates.filter((t) => t.id !== command.templateId)
      break
    case 'broadcast-template': {
      const index = next.broadcasts.findIndex((b) => b.id === command.template.id)
      if (index < 0) next.broadcasts.push(clone(command.template))
      else next.broadcasts[index] = clone(command.template)
      break
    }
    case 'broadcast-delete':
      next.broadcasts = next.broadcasts.filter((b) => b.id !== command.templateId)
      break
    case 'battle-preset': {
      const index = next.battles.findIndex((b) => b.id === command.preset.id)
      if (index < 0) next.battles.push(clone(command.preset))
      else next.battles[index] = clone(command.preset)
      break
    }
    case 'battle-preset-delete':
      next.battles = next.battles.filter((b) => b.id !== command.presetId)
      break
    default:
      throw Error('剧本编辑只保存初始配置；请在开团后执行运行操作')
  }
  return inspectScript(next).definition
}
