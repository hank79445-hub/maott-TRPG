import {itemCastFailed} from './item-spells'
import type {Adventure,MapWorld} from './map-types'
import type {Catalogue} from './engine'
import type {M3Cast} from '../persistence/m3-world-schema'
import {m1Entity} from './m1-utility'
import {applyMap,mapEnvironment} from './map'
import {m3SpellEffect,validateM3Choice,validateM3Willing} from './m3-spells'
import {runtimeSpells,runtimeState,rollDie} from './runtime'
import {spellEffect,defaultEnvironment,savingRoll,freshTurn} from './combat-rules'
import {consumeNpcAbility} from './npc-abilities'
import {applyExploration,explorationMember,explorationSpend,assertExplorationReady} from './exploration'
import {tokenPerception} from './m3-map-perception'
import {distance} from './map'
import {sightLine} from './map-spatial'
import type {ActiveEffect} from './types'
export function castM3Creature(world:MapWorld,a:Adventure,action:M3Cast,cat:Catalogue,dice:(n:number)=>number=rollDie){
  const source=m1Entity(world,a,action.casterId),scene=a.scenes.find(s=>s.id===a.activeSceneId),from=source?.token
  if(!source||!scene||!from||!scene.tokens.includes(from))throw Error('来源不在实际场景')
  const grant=source.c?runtimeSpells(source.c,cat).find(g=>g.key===action.key):undefined
  const ability=source.body?.abilities?.find(b=>b.id===action.key),spell=grant?.spell??cat.spells.find(s=>s.id===ability?.spellId)
  if(!spell)throw Error('实际法术来源已变化')
  const ids=[...action.targets]
  if(spell.id==='pass-without-trace'&&!ids.includes(source.id))ids.push(source.id)
  const targets=ids.map(id=>m1Entity(world,a,id))
  if(targets.some(t=>!t?.token||!scene.tokens.includes(t.token)||t.dead))throw Error('实际受术者已离场或死亡')
  validateM3Willing(spell.id,action.willing,targets.some(t=>t!.id!==source.id))
  const battle=world.encounters.find(e=>e.id===scene.encounterId&&e.phase==='active')
  if(battle){
    const actor=battle.actors.find(t=>t.id===source.actor?.id||!!source.c&&t.characterId===source.c.id)
    if(!actor)throw Error('来源必须已加入实际战斗')
    const targetIds=targets.map(t=>battle.actors.find(x=>x.id===t?.actor?.id||!!t?.c&&x.characterId===t.c.id)?.id??'')
    if(targetIds.some(id=>!id))throw Error('战斗受术者须已加入本场遭遇')
    const envs=Object.fromEntries(targets.map((t,i)=>[targetIds[i]!,mapEnvironment(scene,from,t!.token!,defaultEnvironment(),null)]))
    const command=grant?{type:'cast' as const,actorId:actor.id,key:grant.key,mode:action.mode,targets:targetIds,env:envs[targetIds[0]!]!,targetEnvironments:envs,damageType:'force' as const,requirementsConfirmed:true,m3Choice:action.choice,willing:action.willing}:
      {type:'npc-ability' as const,actorId:actor.id,abilityId:ability!.id,targetIds,env:envs[targetIds[0]!]!,targetEnvironments:envs,confirmed:true,note:action.note,m3Choice:action.choice,willing:action.willing}
    Object.assign(world,applyMap(world,a.id,{type:'combat',sceneId:scene.id,command},cat,dice))
    if(grant&&itemCastFailed(world.characters.find(c=>c.id===source.c?.id),grant.key))return '卷轴施法检定失败，卷轴和行动已消耗，没有法术效果'
    return spell.name+'已进入实际施法／反制窗口'
  }
  if(grant&&source.c)return applyExploration(world,a,scene,{operation:'spell-cast',tokenId:from.id,key:grant.key,mode:action.mode,targets:targets.map(t=>t!.token!.id),m3Choice:action.choice,willing:action.willing,confirmed:true,note:action.note},cat,dice)
  if(!ability||!source.body)throw Error('NPC没有对应的实际施法能力')
  validateM3Choice(spell.id,action.choice)
  const profile=spellEffect(spell.id,1,ability.slotLevel??spell.level)
  if(targets.length>(profile.count??1))throw Error('目标数量超过实际施放环级')
  const range=spell.id==='pass-without-trace'?30:/touch/i.test(spell.range)?5:Number(spell.range.match(/\d+/)?.[0]??0)
  if(spell.range.startsWith('Self')&&spell.id!=='pass-without-trace'&&targets.some(t=>t!.id!==source.id))throw Error('此法术仅作用于自身')
  for(const target of targets){
    const token=target!.token!
    if(target!.id!==source.id&&!tokenPerception(world,a,scene,from,token,cat,true).sameInteractionSpace)throw Error('目标不在同一可互动空间')
    if(target!.id!==source.id&&(distance(scene,from,token)>range||!sightLine(scene,from,token,'blocksTargeting').clear))throw Error('目标超距或有实体阻隔')
    if(['haste','levitate','enlarge-reduce'].includes(spell.id)&&target!.id!==source.id&&!tokenPerception(world,a,scene,from,token,cat,true).canSee)throw Error('该法术要求实际可见目标')
  }
  const clock=world.characters.find(c=>a.party.includes(c.id)&&c.runtime)
  if(!clock?.runtime)throw Error('NPC法术需要实际冒险时钟')
  const budget=explorationMember(a,from.id)
  if(budget){assertExplorationReady(world,a,budget,cat);if(ability.cost!=='none')explorationSpend(budget,ability.cost,true)}
  consumeNpcAbility(source.body,ability.id)
  source.body.effects=source.body.effects.filter(f=>f.key!=='invisibility')
  const duration=spell.duration.match(/(\d+)\s*(minute|hour|day)/i),hours=duration?Number(duration[1])*(duration[2]!.toLowerCase()==='day'?24:duration[2]!.toLowerCase()==='hour'?1:1/60):1/60,castId=crypto.randomUUID()
  if(spell.concentration)source.body.concentration={spellId:spell.id,castId,clockSourceId:clock.id,endsAt:(clock.runtime.hours??0)+hours,encounterId:'outside'}
  const castAbility=ability.ability??source.body.spellcasting?.ability??'wis',mod=Math.floor((source.body.scores[castAbility]-10)/2),dc=source.body.spellcasting?.dc??8+(source.body.templateMetadata?.proficiencyBonus??2)+mod
  for(const target of targets){
    if(profile.save&&!(action.willing&&['levitate','enlarge-reduce'].includes(spell.id))){
      const actor=target!.actor??{id:target!.token!.id,characterId:target!.c?.id??null,npc:target!.body??null,side:'neutral' as const,initiative:null,surprised:false,turn:freshTurn()}
      const roll=savingRoll(actor,profile.save,defaultEnvironment(),world.characters,cat,dice)
      if(!roll.autoFail&&roll.total>=dc)continue
    }
    if(target!.c)target!.c.runtime=runtimeState(target!.c,cat)
    const state=target!.c?.runtime??target!.body!,metadata=m3SpellEffect(spell.id,action.choice,castAbility)??{}
    const effect:ActiveEffect={id:crypto.randomUUID(),key:metadata.key??spell.id,spellId:spell.id,spellLevel:ability.slotLevel??spell.level,castId,sourceId:source.id,clockSourceId:clock.id,name:spell.name,page:spell.source.page,concentration:spell.concentration,expiresAt:null,endsAt:(clock.runtime.hours??0)+hours,encounterId:'outside',phase:'start',note:'实际NPC法术能力与次数',...metadata}
    state.effects=(state.effects??[]).filter(f=>!(f.key===effect.key&&f.sourceId===source.id)).concat(effect)
  }
  if(spell.id==='expeditious-retreat'&&budget)budget.dash+=source.body.speed
  return spell.name+'已按实际NPC能力、次数、豁免和受术者结算'
}
