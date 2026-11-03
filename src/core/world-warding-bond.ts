import type { MapWorld } from './map-types'
import type { BondBody } from './warding-bond'
import { reconcileWardingBonds } from './warding-bond'

export function worldBondBodies(world: MapWorld): BondBody[] {
  const bodies: BondBody[] = world.characters.filter(c => c.runtime).map(c => ({
    id:c.id, aliases:world.encounters.flatMap(e => e.actors.filter(a => a.characterId === c.id).map(a => a.id)),
    hp:c.runtime!.hp, effects:c.runtime!.effects ?? (c.runtime!.effects = []),
  }))
  for (const e of world.encounters) for (const a of e.actors) {
    if (!a.npc || bodies.some(b => b.id === (a.npcId ?? a.id))) continue
    bodies.push({id:a.npcId ?? a.id,aliases:[a.id],hp:a.npc.hp,effects:a.npc.effects})
  }
  for (const adventure of world.adventures) for (const n of adventure.ai?.npcs ?? []) {
    if (!n.body || bodies.some(b => b.id === n.id || b.aliases.includes(n.actorId ?? ''))) continue
    bodies.push({id:n.id,aliases:n.actorId ? [n.actorId] : [],hp:n.body.hp,effects:n.body.effects})
  }
  for (const adventure of world.adventures) for (const s of adventure.scenes) for (const t of s.tokens) {
    if (!t.npcBody || bodies.some(b => [t.npcId,t.actorId,t.id].some(id => id && (id === b.id || b.aliases.includes(id))))) continue
    bodies.push({id:t.npcId ?? t.actorId ?? t.id,aliases:[t.id],hp:t.npcBody.hp,effects:t.npcBody.effects})
  }
  return bodies
}
export function reconcileWorldBonds(world: MapWorld) {
  const bodies = worldBondBodies(world)
  const locations = (body: BondBody) => world.adventures.flatMap(a => a.scenes.flatMap(s =>
    s.tokens.filter(t => [t.characterId,t.npcId,t.actorId,t.id].some(id => id && (id === body.id || body.aliases.includes(id))))
      .map(token => ({scene:s,token}))))
  reconcileWardingBonds(bodies, (caster,target) => {
    const from=locations(caster),to=locations(target)
    if (!from.length && !to.length) return undefined // standalone encounter: GM supplies distances
    for (const a of from) for (const b of to) if (a.scene.id === b.scene.id) {
      const gap=(x:number,n:number,y:number,m:number) => Math.max(0,y-(x+n-1),x-(y+m-1))
      return Math.max(gap(a.token.x,a.token.span??1,b.token.x,b.token.span??1),
        gap(a.token.y,a.token.span??1,b.token.y,b.token.span??1))*a.scene.grid.feet
    }
    return Infinity
  })
}
