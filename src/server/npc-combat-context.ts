import {m1Entity} from '../core/m1-utility'
import {npcM5Capabilities} from '../core/npc-strategy'
import {projectSceneEffects} from '../core/scene-effect-view'
import {runtimeDerived} from '../core/runtime'
import {combatStats,freshTurn} from '../core/combat-rules'
import {tokenPerception} from '../core/m3-map-perception'
import type { Room } from '../online/protocol'
import type { NpcProfile } from '../core/ai-types'
import { sightLine } from '../core/map-spatial'
import { tokenStatuses } from './token-status'
import { catalogue } from '../core/engine'
import { npcSpatialObservation } from './npc-spatial-observation'
import { BUILTIN_PACKS } from '../content/builtin-packs'

/** Perception-limited facts shared by dialogue and planning; no opponent statistics. */
export function npcCombatContext(room: Room, npc: NpcProfile) {
  const scene = room.world.adventures[0]?.scenes.find((s) => s.id === npc.sceneId)
  const encounter = room.world.encounters.find(
    (e) => e.id === scene?.encounterId && e.phase === 'active',
  )
  const ownToken = scene?.tokens.find(
    (t) =>
      t.npcId === npc.id ||
      (!!npc.actorId && t.actorId === npc.actorId) ||
      (!!npc.characterId && t.characterId === npc.characterId),
  )
  const origin = ownToken ?? npc.position
  const own = encounter?.actors.find(
    (a) => a.id === npc.actorId || (!!npc.characterId && a.characterId === npc.characterId),
  )
  const side = own?.side ?? npc.side
  const cat = catalogue([...BUILTIN_PACKS, ...room.world.packs])
  const scoped = npc.spatialPolicy?.enabled ? new Set(npcSpatialObservation(room,npc).units.map(t=>t.id)) : undefined
  const units = (scene?.tokens ?? [])
    .filter(t=>!scoped||scoped.has(t.id))
    .filter((t) => !t.hidden && (t.id===ownToken?.id|| (ownToken?tokenPerception(room.world,room.world.adventures[0]!,scene!,ownToken,t,cat).canPerceive:sightLine(scene!,origin,t).clear)))
    .map((t) => {
      const actor = encounter?.actors.find(
        (a) =>
          a.id === t.actorId ||
          a.id === t.npcSourceActorId ||
          (!!t.characterId && a.characterId === t.characterId),
      )
      const relative = !actor
        ? 'unknown'
        : actor.side === side
          ? 'friendly'
          : actor.side === 'neutral' || side === 'neutral'
            ? 'unknown'
            : 'hostile'
      return {
        actorId: actor?.id ?? null,
        characterId: t.characterId ?? null,
        name: t.name,
        side: actor?.side ?? null,
        relative,
        participating: !!actor,
        statuses: tokenStatuses(
          room,
          t,
          t.npcId === npc.id || (!!npc.characterId && t.characterId === npc.characterId),
          false,
          cat,
        ),
        height:t.spatial?.height??0,layer:t.spatial?.layer??'material',
        x: t.x,
        y: t.y,
      }
    })
  const body=m1Entity(room.world,room.world.adventures[0]!,npc.id),cap=body?.c?runtimeDerived(body.c,cat).spatialCapabilities:body?.body?combatStats(body.actor??{id:body.id,characterId:null,npc:body.body,side:npc.side,initiative:null,surprised:false,turn:freshTurn()},room.world.characters,cat).spatialCapabilities:undefined
  return {
    followupAbilities:npcM5Capabilities(room.world,npc),
    // The same observer-specific whitelist as Web: no hidden spikes, DCs,
    // GM notes, source clocks or unseen contours reach dialogue/planning.
    terrain:ownToken&&scene?projectSceneEffects(room.world,room.world.adventures[0]!,scene,cat,false,[ownToken]).regions
      .filter(e=>e.movementMultiplier!==undefined).map(e=>({name:e.name,spellId:e.spellId,movementMultiplier:e.movementMultiplier,cells:(e.cellsByObserver?.[ownToken.id]??e.cells).slice(0,128)})):[],
    ownSpatial:ownToken?{height:ownToken.spatial?.height??0,layer:ownToken.spatial?.layer??'material',capabilities:cap,appearance:body?.state.effects?.find(f=>f.key==='alter-self'&&f.m3?.option==='appearance')?.m3?.description,pending:room.world.adventures[0]?.m3?.events.some(e=>e.status==='pending'&&e.entityId===body?.id)??false}:undefined,
    active: !!encounter,
    encounterId: encounter?.id ?? null,
    name: encounter?.name ?? null,
    round: encounter?.round ?? null,
    ownSide: side,
    currentActorId: units.some((u) => u.actorId === encounter?.actors[encounter.current]?.id)
      ? (encounter?.actors[encounter.current]?.id ?? null)
      : null,
    units,
  }
}
