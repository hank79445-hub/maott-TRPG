import { hasSubclass } from './growth-rules'
import type { Adventure, MapToken, MapWorld } from './map-types'
import type { Spell } from './types'
import type { Catalogue } from './engine'
import { applyRuntime, runtimeState } from './runtime'
import { rollDamage, spellEffect } from './combat-rules'
import { healingRollTotal, hpSpellBonus } from './spell-restoration'
export function explorationHealingSpell(world:MapWorld,a:Adventure,targets:MapToken[],casterId:string,
  spell:Spell,slot:number,modifier:number,cat:Catalogue,dice:(s:number)=>number) {
  if(!['cure-wounds','healing-word','mass-healing-word','false-life','spare-the-dying','prayer-of-healing'].includes(spell.id))return null
  const caster=world.characters.find(c=>c.id===casterId)!
  const profile=spellEffect(spell.id,caster.level,slot||1)
  const states=targets.map(t=>{
    const c=world.characters.find(c=>c.id===t.characterId),npc=a.ai?.npcs.find(n=>n.id===t.npcId)
    const actor=world.encounters.flatMap(e=>e.actors).find(q=>q.id===(t.actorId??npc?.actorId))
    const body=actor?.npc??npc?.body??t.npcBody,state=c?runtimeState(c,cat):body
    if(!state)throw Error('受术者缺少有效数据卡')
    const dead=c?runtimeState(c,cat).death.dead:body!.dead
    if(spell.id!=='false-life'&&dead)throw Error('普通治疗或维生术不能复活死者')
    if(spell.id==='spare-the-dying'&&state.hp!==0)throw Error('维生术需要活着的零HP生物')
    if(spell.id==='prayer-of-healing'&&state.prayerHealingSinceLongRest)throw Error('该受术者长休前不能再次受益于治疗祷言')
    if(profile.kind==='heal'&&state.effects.some(e=>e.blocksHealing))throw Error('当前效果禁止恢复生命值')
    return {c,npc,actor,body,state,t}
  })
  const rolled=profile.dice?rollDamage(profile.dice,
    profile.kind==='heal'&&states.every(q=>q.state.effects.some(e=>e.maximizeHealing))?s=>s:dice):null
  const results:string[]=[]
  for(const q of states){
    const amount=rolled?Math.max(0,healingRollTotal(q.state.effects,rolled)+(spell.id==='prayer-of-healing'?0:modifier)+(hasSubclass(caster.build,'life')&&slot>0?2+slot:0)):0
    if(q.c){
      const cmd=spell.id==='spare-the-dying'?{type:'stabilize' as const}:
        profile.kind==='temporary'?{type:'temporary' as const,amount:rolled!.total}:
        {type:'heal' as const,amount}
      let next=applyRuntime(q.c,cat,cmd,dice)
      if(spell.id==='prayer-of-healing'){
        next=applyRuntime(next,cat,{type:'rest',kind:'short',confirmed:true,useHitDie:false,arcaneRecovery:false},dice,undefined,
          {shortRestSpell:'prayer-of-healing',alreadyElapsed:q.c.id===casterId})
        next.runtime!.prayerHealingSinceLongRest=true
      }
      world.characters[world.characters.indexOf(q.c)]=next
    }else{
      if(profile.kind==='temporary')q.body!.temporaryHp=Math.max(q.body!.temporaryHp,rolled!.total)
      else if(profile.kind==='heal')q.body!.hp=Math.min(q.body!.maxHp+hpSpellBonus(q.body!.effects),q.body!.hp+amount)
      if(spell.id==='prayer-of-healing')q.body!.prayerHealingSinceLongRest=true
      if(q.npc)q.npc.body=q.body!
      if(q.actor)q.actor.npc=q.body!
      if(!q.npc&&!q.actor)q.t.npcBody=q.body
    }
    results.push(q.t.name+(spell.id==='spare-the-dying'?'已稳定':profile.kind==='temporary'?'获得临时HP '+rolled!.total:'恢复HP '+amount))
  }
  return results.join('；')+(spell.id==='prayer-of-healing'?'；GM已确认目标全程30尺内，10分钟施法完成；获得短休收益，长休前不可再次受益':'')
}
