import {reconcileSummons} from './summon-world'
import {initialiseSceneEffects} from './scene-initial'
import {reconcileSceneEffects} from './scene-effects'
import {rememberEndedHaste} from './m3-lifecycle'
import { hpSpellBonus } from './spell-restoration'
import { reconcileWardingBonds } from './warding-bond'
import { reconcileWorldBonds } from './world-warding-bond'
import type { Encounter } from './combat-types'
import type { Character } from './types'
import type { MapWorld } from './map-types'
import { zoneAlive } from './ongoing-spells'
import { primalCompanion } from './phb-companions'
import { clone,catalogue, type Catalogue } from './engine'
import { srd } from '../content/srd'
import { combatStats,freshTurn } from './combat-rules'
import { reconcileGrapples } from './grapples'
import { rememberEndedCharms } from './social-effects'
import {concentrationMatches} from './spell-source-state'
/** Run inside the enclosing saved transaction, including out-of-combat rests. */
export function reconcileEncounter(
  e: Encounter,
  characters: Character[],
  cat: Catalogue = catalogue(),
) {
  reconcileGrapples(e, characters, cat)
  const bondBodies = e.actors.flatMap(a => {
    const c = characters.find(c => c.id === a.characterId), state = c?.runtime ?? a.npc
    return state ? [{id:c?.id ?? a.npcId ?? a.id, aliases:[a.id],hp:state.hp,effects:state.effects ?? []}] : []
  })
  for (const c of characters) if (c.runtime && !bondBodies.some(b => b.id === c.id))
    bondBodies.push({id:c.id,aliases:[],hp:c.runtime.hp,effects:c.runtime.effects ?? []})
  // Historical encounters do not contain every live NPC. Only world reconciliation
  // can decide that a source is missing; a local encounter must not erase it.
  reconcileWardingBonds(bondBodies,undefined,true)
  e.zones = (e.zones ?? []).filter((z) => {
    const owner = e.actors.find((a) => a.id === z.sourceId),
      c = characters.find((c) => c.id === owner?.characterId)
    return zoneAlive(z, c)
  })
  for (const a of e.actors) {
    if (a.npc) {
      const clock =
        characters.find(
          (c) => c.id === e.actors.find((owner) => owner.id === a.companion?.ownerId)?.characterId,
        ) ?? characters[0]
      a.npc.effects = rememberEndedCharms(
        a.npc.effects,
        a.npc.effects.filter(
          (f) => f.endsAt === undefined || f.endsAt > ((f.clockSourceId?characters.find(c=>c.id===f.clockSourceId):clock)?.runtime?.hours ?? 0),
        ),
      )
      a.npc.hp = Math.min(a.npc.hp, a.npc.maxHp + hpSpellBonus(a.npc.effects))
    }
    const c = characters.find((c) => c.id === a.characterId),
      r = c?.runtime ?? a.npc
    if (!r) continue
    const expired =
      r.effects?.filter(
        (f) =>
          f.key === 'tree-thp' &&
          !characters.some(
            (c) =>
              c.runtime?.rage &&
              (c.id === f.sourceId ||
                e.actors.some((a) => a.characterId === c.id && a.id === f.sourceId)),
          ),
      ) ?? []
    if (expired.length) {
      r.temporaryHp = 0
      r.effects = r.effects?.filter((f) => !expired.some((x) => x.id === f.id)) ?? []
    }
  }
  for (const a of e.actors)
    if (a.companion) {
      const owner = e.actors.find((x) => x.id === a.companion!.ownerId),
        c = characters.find((c) => c.id === owner?.characterId)
      if (a.companion.source === 'spell-summon' && ['summon-beast','summon-fey','summon-undead'].includes(a.companion.spellId??'')) {
        if(!a.companion.castId)continue // Legacy unknown provenance is quarantined by world migration, never inferred from a same-name cast.
        if ((!a.companion.worldManaged||owner)&&(!(c?.runtime?.concentration??owner?.npc?.concentration) || !a.npc?.hp || (c?.runtime?.concentration??owner?.npc?.concentration)?.spellId !== a.companion.spellId || a.companion.castId&&(c?.runtime?.concentration??owner?.npc?.concentration)?.castId!==a.companion.castId))
          a.companion.dismissed = true
        continue
      }
      if (a.companion.source === 'wild-surge') {
        if (!c || !a.npc?.hp || (c.runtime?.hours ?? 0) >= (a.companion.expiresHour ?? 0))
          a.companion.dismissed = true
        continue
      }
      if (a.companion.source === 'primal-companion') {
        if (!c || c.runtime?.death?.dead) a.companion.dismissed = true
        if (!a.npc?.hp && a.companion.deathAt == null) a.companion.deathAt = c?.runtime?.hours ?? 0
        if (c && a.companion.reviveAt != null && (c.runtime?.hours ?? 0) >= a.companion.reviveAt) {
          a.npc!.hp = a.npc!.maxHp
          a.npc!.dead = false
          a.companion.deathAt = null
          a.companion.reviveAt = null
        }
        continue
      }
      if (!a.companion.worldManaged&&(!c || !a.npc?.hp || (c.runtime?.lastLongRestEnd ?? null) !== a.companion.expiresAfterRest))
        a.companion.dismissed = true
    }
}
export function reconcileWorld(world: MapWorld) {
  const hasteBefore=new Map<string,import('./types').ActiveEffect[]>()
  for(const c of world.characters)hasteBefore.set(c.id,clone(c.runtime?.effects??[]))
  for(const a of world.adventures)for(const n of a.ai?.npcs??[])if(n.body)hasteBefore.set(n.id,clone(world.encounters.flatMap(e=>e.actors).find(x=>x.id===n.actorId)?.npc?.effects??n.body.effects))

  reconcileWorldBonds(world)
  const cat = catalogue(
    world.packs.some((p) => p.id === srd.id) ? world.packs : [srd, ...world.packs],
  )
  for (const e of world.encounters)
    for (const a of e.actors)
      if (a.companion?.source === 'primal-companion' && !a.companion.dismissed && a.npc) {
        const owner = world.characters.find(
            (c) => c.id === e.actors.find((o) => o.id === a.companion!.ownerId)?.characterId,
          ),
          oldLevel =
            a.companion.ownerLevel ??
            (a.companion.form === 'sky' ? (a.npc.maxHp - 4) / 4 : (a.npc.maxHp - 5) / 5)
        if (owner && oldLevel !== owner.level) {
          const old = a.npc,
            next = primalCompanion(owner, cat, a.companion.form ?? 'land')
          next.hp =
            old.hp > 0 ? Math.max(1, Math.min(next.maxHp, old.hp + next.maxHp - old.maxHp)) : 0
          next.temporaryHp = old.temporaryHp
          next.dead = old.dead
          next.effects = old.effects
          next.conditions = old.conditions
          a.npc = next
          a.companion.ownerLevel = owner.level
        }
      }
  const sourceOf = (id: string) =>
    world.characters.find((c) => c.id === id) ??
    world.characters.find((c) =>
      world.encounters.some((e) => e.actors.some((a) => a.id === id && a.characterId === c.id)),
    )
  const concentrationOf = (id: string) => {
    const character = sourceOf(id)
    if (character) return character.runtime?.concentration
    const profile=world.adventures.flatMap(a=>a.ai?.npcs??[]).find(n=>n.id===id||n.actorId===id)
    const actors=world.encounters.flatMap(e=>e.actors)
    const actor=actors.find(a=>a.id===(profile?.actorId??id))??actors.find(a=>a.npcId===id)
    const body=actor?.npc??profile?.body
    if(!body)return undefined
    const stats=combatStats(actor??{id:profile?.id??id,characterId:null,npc:body,side:'neutral',initiative:null,surprised:false,turn:freshTurn()},world.characters,cat)
    if(body.hp<=0||body.dead||stats.conditions.includes('incapacitated')){delete body.concentration;return undefined}
    const conc=body.concentration
    if(conc?.endsAt!==undefined&&conc.clockSourceId&&((sourceOf(conc.clockSourceId)?.runtime?.hours??0)>=conc.endsAt)){delete body.concentration;return undefined}
    return body.concentration
  }
  for (const c of world.characters)
    if (c.runtime?.effects)
      c.runtime.effects = rememberEndedCharms(
        c.runtime.effects,
        c.runtime.effects.filter((f) => {
          if(f.endsAt!==undefined&&f.endsAt<=((f.clockSourceId?sourceOf(f.clockSourceId)?.runtime?.hours:c.runtime?.hours)??0))return false
          if (f.weapon && !c.inventory.some((row) => row.instanceId === f.weapon!.instanceId))
            return false
          if (!f.concentration) return true
          return concentrationMatches(f,concentrationOf(f.sourceId))
        }),
      )
  for (const e of world.encounters)
    for (const a of e.actors)
      if (a.npc)
        a.npc.effects = rememberEndedCharms(
          a.npc.effects,
          a.npc.effects.filter(
            (f) => !f.concentration || concentrationMatches(f,concentrationOf(f.sourceId)),
          ),
        )
  // NPCs that have never entered combat still have a live body and timed effects.
  for (const adventure of world.adventures)
    for (const n of adventure.ai?.npcs ?? []) {
      if (
        !n.body ||
        world.encounters.some((e) => e.actors.some((a) => a.id === n.actorId && a.npc))
      )
        continue
      const hours =
        world.characters.find((c) => adventure.party.includes(c.id))?.runtime?.hours ?? 0
      n.body.effects = rememberEndedCharms(
        n.body.effects,
        n.body.effects.filter(
          (f) =>
            (f.endsAt === undefined || f.endsAt > (f.clockSourceId?sourceOf(f.clockSourceId)?.runtime?.hours??hours:hours)) &&
            (!f.concentration || concentrationMatches(f,concentrationOf(f.sourceId))),
        ),
      )
      n.body.hp = Math.min(n.body.hp, n.body.maxHp + hpSpellBonus(n.body.effects))
    }
  for (const c of world.characters)
    c.inventory = c.inventory.filter((row) => {
      if (
        row.consumable?.expiresAt !== undefined &&
        row.consumable.expiresAt <= (row.consumable.clockSourceId ? sourceOf(row.consumable.clockSourceId)?.runtime?.hours ?? -1 : c.runtime?.hours ?? 0)
      )
        return false
      if (!row.craftedBy) return true
      const owner = world.characters.find((c) => c.id === row.craftedBy)
      return !owner || (owner.runtime?.lastLongRestEnd ?? 0) <= (row.craftedAt ?? 0)
    })
  for(const c of world.characters)if(c.runtime)c.runtime.effects=rememberEndedHaste(hasteBefore.get(c.id)??[],c.runtime.effects??[],{hours:c.runtime.hours??0,clockSourceId:c.id})
  for(const a of world.adventures)for(const n of a.ai?.npcs??[]){const body=world.encounters.flatMap(e=>e.actors).find(x=>x.id===n.actorId)?.npc??n.body;if(body)body.effects=rememberEndedHaste(hasteBefore.get(n.id)??[],body.effects,{hours:world.characters[0]?.runtime?.hours??0,clockSourceId:world.characters[0]?.id})}
  for (const e of world.encounters) reconcileEncounter(e, world.characters, cat)
  for (const adventure of world.adventures)
    for (const scene of adventure.scenes) {
      const e = world.encounters.find((e) => e.id === scene.encounterId)
      for (const token of scene.tokens)
        if (e?.actors.some((a) => a.id === token.actorId && a.companion?.dismissed))
          token.hidden = true
    }
  for(const a of world.adventures)initialiseSceneEffects(world,a,cat)
  reconcileSceneEffects(world)
  reconcileSummons(world)
}
