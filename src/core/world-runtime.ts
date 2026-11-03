import type { MapWorld } from './map-types'
import type { Catalogue } from './engine'
import { applyRuntime, runtimeState, rollDie, type RuntimeCommand } from './runtime'
import { worldBondBodies, reconcileWorldBonds } from './world-warding-bond'
import { bondIdentity } from './warding-bond'

/** World-level wrapper: a single-character reducer cannot mutate the other bond endpoint. */
export function applyWorldRuntime(world: MapWorld, characterId: string, cat: Catalogue, command: RuntimeCommand,
  dice: (s:number)=>number = rollDie) {
  reconcileWorldBonds(world)
  const index=world.characters.findIndex(c=>c.id===characterId)
  if(index<0)throw Error('角色不存在')
  const c=world.characters[index]!,bond=command.type==='damage' ? runtimeState(c,cat).effects.find(e=>e.wardingBond) : undefined
  let taken=0
  const next=applyRuntime(c,cat,command,dice,undefined,undefined,n=>{taken=n})
  world.characters[index]=next
  if(bond && taken>0){
    const body=worldBondBodies(world).find(b=>bondIdentity(b,bond.sourceId))
    if(!body)throw Error('守护之链来源缺失，需GM修正关联后结算')
    if(body.hp>0){
      const casterIndex=world.characters.findIndex(c=>c.id===body.id)
      if(casterIndex>=0)world.characters[casterIndex]=applyRuntime(world.characters[casterIndex]!,cat,
        {type:'damage',amount:taken,note:'守护之链关联伤害'},dice)
      else {
        const actors=world.encounters.flatMap(e=>e.actors)
        const n=actors.find(a=>a.npcId===body.id || body.aliases.includes(a.id))?.npc ??
          world.adventures.flatMap(a=>a.ai?.npcs??[]).find(n=>n.id===body.id)?.body ??
          world.adventures.flatMap(a=>a.scenes.flatMap(s=>s.tokens)).find(t=>t.id===body.id)?.npcBody
        if(!n)throw Error('守护之链来源没有有效数据卡')
        const absorbed=Math.min(n.temporaryHp,taken)
        n.temporaryHp-=absorbed;n.hp=Math.max(0,n.hp-(taken-absorbed))
        if(!n.hp){n.dead=true;delete n.concentration}
        else if(n.concentration)n.concentration.pendingDC=Math.max(n.concentration.pendingDC??0,10,Math.min(30,Math.floor(taken/2)))
      }
    }
  }
  reconcileWorldBonds(world)
}
