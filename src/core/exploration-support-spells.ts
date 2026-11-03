import { M3_NATIVE_SPELLS,m3SpellEffect,validateM3Willing } from './m3-spells'
import {combatStats,freshTurn,defaultEnvironment,savingRoll} from './combat-rules'
import { dispelSpellEffects,endDispelledZoneSource } from './spell-dispelling'
import type { ExplorationCommand } from './exploration-types'
import { connectWardingBond } from './warding-bond'
import { worldBondBodies } from './world-warding-bond'
import { equipmentLayout } from './equipment'
import {pbOf} from './growth-rules'
import type { Adventure, MapToken, MapWorld } from './map-types'
import type { Spell, ActiveEffect } from './types'
import type { Catalogue } from './engine'
import { runtimeState, runtimeSpells, applyRuntime, rollDie } from './runtime'
import { restoreCondition, SUPPORT_SPELLS, type SupportSpellChoice } from './support-spells'
import { addRestorationBuff, RESTORATION_BUFFS } from './spell-restoration'
export function explorationSupportSpell(
  world: MapWorld,
  adventure: Adventure,
  targets: MapToken[],
  casterId: string,
  spell: Spell,
  choice: SupportSpellChoice & Partial<Pick<Extract<ExplorationCommand,{operation:'spell-cast'}>,'dispelZoneId'|'dispelDistance'|'m3Choice'|'willing'>>,
  cat: Catalogue,
  slotLevel = 0,
  modifier = 0,
  dice: (s:number)=>number = rollDie,
  dcOverride?:number,
) {
  if (spell.id === 'bane' || ![...SUPPORT_SPELLS,...RESTORATION_BUFFS,...M3_NATIVE_SPELLS,'dispel-magic','warding-bond'].some(id=>id===spell.id)) return null
  const caster = world.characters.find((c) => c.id === casterId)!,
    clock = runtimeState(caster, cat).hours,
    castId = spell.concentration ? runtimeState(caster,cat).concentration?.castId??crypto.randomUUID() : crypto.randomUUID()
  if(spell.id==='dispel-magic'&&choice.dispelZoneId){
    const scene=adventure.scenes.find(s=>s.tokens.some(t=>t.id===targets[0]?.id))
    const encounter=world.encounters.find(e=>(e.session?.sceneId===scene?.id||e.id===scene?.encounterId)&&e.zones?.some(z=>z.id===choice.dispelZoneId))
    const zone=encounter?.zones?.find(z=>z.id===choice.dispelZoneId)
    if(!zone||!encounter)throw Error('待解除的实际区域已失效')
    const outcome=dispelSpellEffects([{id:zone.id,key:zone.spellId,spellId:zone.spellId,spellLevel:zone.slotLevel,castId:zone.castId??zone.id,name:zone.name,sourceId:zone.sourceId,page:0,concentration:false,expiresAt:null,encounterId:encounter.id,phase:'start',note:''}],slotLevel,dc=>{
      const current=world.characters.find(c=>c.id===casterId)!,ability=runtimeSpells(current,cat).find(g=>g.spell.id===spell.id)?.ability
      if(!ability)throw Error('解除魔法的施法来源已变化')
      const checked=applyRuntime(current,cat,{type:'check',kind:'ability',id:ability,dc},dice)
      world.characters[world.characters.indexOf(current)]=checked
      return checked.runtime!.advanced!.lastCheck!.total
    })
    if(outcome.removed.includes(zone.id)){encounter.zones=encounter.zones!.filter(z=>z.id!==zone.id);endDispelledZoneSource(zone,encounter,world.characters)}
    return outcome.text
  }
  if(spell.id==='pass-without-trace'){const self=adventure.scenes.flatMap(s=>s.tokens).find(t=>t.characterId===casterId);if(self&&!targets.some(t=>t.id===self.id))targets=[...targets,self]}
  for (const token of targets) {
    const c = world.characters.find((c) => c.id === token.characterId),
      npc = adventure.ai?.npcs.find((n) => n.id === token.npcId),
      actor = world.encounters
        .flatMap((e) => e.actors)
        .find((a) => a.id === (token.actorId ?? npc?.actorId)),
      body = actor?.npc ?? npc?.body ?? token.npcBody
    let state = c ? runtimeState(c, cat) : body
    if (!state) throw Error('受术者没有有效数据卡')
    if (spell.id === 'mage-armor' && c && equipmentLayout(c,cat).slots.armor?.length)
      throw Error('法师护甲目标必须未穿护甲')
    const duration = spell.duration.match(/(\d+)\s*(minute|hour|day)/i)
    const hours = duration ? Number(duration[1]) * (duration[2]!.toLowerCase()==='day'?24:duration[2]!.toLowerCase()==='hour'?1:1/60) : 1/60
    const base: ActiveEffect = {id:crypto.randomUUID(),key:spell.id,name:spell.name,
      sourceId:casterId,clockSourceId:casterId,spellId:spell.id,spellLevel:slotLevel||spell.level,castId,
      page:spell.source.page,concentration:spell.concentration,expiresAt:null,endsAt:clock+hours,
      encounterId:'outside',phase:'start',note:'2024实际来源型法术效果'}
    if(spell.id==='sanctuary')base.spellDc=dcOverride??8+modifier+pbOf(caster.build)
    if (spell.id === 'warding-bond') {
      connectWardingBond(worldBondBodies(world),casterId,c?.id ?? npc?.id ?? actor?.npcId ?? actor?.id ?? token.id,base)
      // The shared world body owns the actual effect array.
      continue
    }
    validateM3Willing(spell.id,choice.willing,token.characterId!==casterId)
    const spatialEffect=m3SpellEffect(spell.id,choice.m3Choice,runtimeSpells(caster,cat).find(g=>g.spell.id===spell.id)?.ability)
    if(spatialEffect){
      if(['levitate','enlarge-reduce'].includes(spell.id)&&!choice.willing){
        const target=actor??{id:token.id,characterId:c?.id??null,npc:body??null,side:'neutral' as const,initiative:null,surprised:false,turn:freshTurn()}
        const roll=savingRoll(target,'con',defaultEnvironment(),world.characters,cat,dice)
        if(!roll.autoFail&&roll.total>=(dcOverride??8+modifier+pbOf(caster.build)))continue
      }
      state.effects=state.effects.filter(f=>!(f.key===(spatialEffect.key??spell.id)&&f.sourceId===casterId))
      state.effects.push({...base,...spatialEffect})
    }else if(spell.id==='sanctuary'){
      state.effects=state.effects.filter(f=>!(f.key==='sanctuary'&&f.sourceId===casterId));state.effects.push(base)
    }else if (spell.id === 'dispel-magic') {
      const outcome=dispelSpellEffects(state.effects,slotLevel,(dc)=>{
        const current=world.characters.find(c=>c.id===casterId)!,ability=runtimeSpells(current,cat).find(g=>g.spell.id===spell.id)?.ability
        if(!ability)throw Error('解除魔法的施法来源已变化')
        const checked=applyRuntime(current,cat,{type:'check',kind:'ability',id:ability,dc},dice)
        world.characters[world.characters.indexOf(current)]=checked
        if(c?.id===casterId)state=runtimeState(checked,cat)
        return checked.runtime!.advanced!.lastCheck!.total
      })
      state.effects=outcome.effects
    }
    else if (spell.id === 'lesser-restoration') restoreCondition(state, choice.supportChoice!)
    else if (addRestorationBuff(state,spell,base,slotLevel,choice.supportChoice,modifier)) { /* applied to actual target */ }
    else {
      state.effects = state.effects.filter((e) => !(e.key === spell.id && e.sourceId === casterId))
      const effect: ActiveEffect = {
        id: crypto.randomUUID(),
        key: spell.id,
        name: spell.name,
        sourceId: casterId,
        clockSourceId: casterId,
        spellId:spell.id,spellLevel:slotLevel||spell.level,castId,
        page: spell.source.page,
        concentration: spell.concentration,
        expiresAt: null,
        endsAt: clock + 1 / 60,
        encounterId: 'outside',
        phase: 'start',
        supportChoice: choice.supportChoice,
        note:
          spell.id === 'guidance'
            ? '2024：所选技能检定持续获得1d4加值'
            : '2024：所选类型伤害每回合至多一次减1d4',
      }
      state.effects.push(effect)
    }
    if (c) world.characters.find(q=>q.id===c.id)!.runtime = state as ReturnType<typeof runtimeState>
    else {
      if (actor) actor.npc = state as NonNullable<typeof actor.npc>
      if (npc) npc.body = state as NonNullable<typeof npc.body>
      if (!actor && !npc) token.npcBody = state as NonNullable<typeof token.npcBody>
    }
  }
  return '实际受术者与所选效果已登记'
}
