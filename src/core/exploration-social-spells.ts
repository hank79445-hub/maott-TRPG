import {socialControlEffect,validateControlSelection,type ControlSelection} from './m2-social-controls'
import { humanoidPlayerSpecies,actorCreatureType } from './control-spells'
import {m2ControlEffect} from './m2-control'
import type { Adventure, MapToken, MapWorld } from './map-types'
import type { ActiveEffect, Ability, Spell } from './types'
import type { Catalogue } from './engine'
import type { Combatant } from './combat-types'
import { combatStats, defaultEnvironment, freshTurn, savingRoll } from './combat-rules'
import { runtimeDerived, runtimeState } from './runtime'
import { rememberEndedCharms } from './social-effects'
import {appliedEffects} from './effects'

/** GM-approved noncombat social spells share real saves and persistent source effects. */
export function explorationSocialSpell(
  world: MapWorld,
  adventure: Adventure,
  targets: MapToken[],
  casterId: string,
  spell: Spell,
  ability: Ability,
  cat: Catalogue,
  dice: (n: number) => number,
  choice?: string,
  slotLevel = spell.level,
  selection:ControlSelection={},
  dcOverride?:number,
) {
  if (
    ![
      'calm-emotions','suggestion','compelled-duel','bestow-curse','phantasmal-force','command','fear','crown-of-madness','zone-of-truth',
      'hold-person',
      'blindness-deafness',
      'color-spray',
      'slow',
      'ray-of-enfeeblement',
      'enthrall',
      'friends',
      'charm-person',
      'hideous-laughter',
      'sleep',
      'animal-friendship',
      'hypnotic-pattern',
    ].includes(spell.id)
  )
    return null
  validateControlSelection(spell.id,{...selection,supportChoice:choice},targets.map(t=>t.id))
  const caster = world.characters.find((c) => c.id === casterId)!,
    r = runtimeState(caster, cat)
  caster.runtime = r
  const dc = dcOverride ?? 8 + Math.ceil(caster.level / 4) + 1 + runtimeDerived(caster, cat).mods[ability]
  const castingId=spell.concentration?r.concentration?.castId??crypto.randomUUID():crypto.randomUUID()
  const duration = spell.id==='suggestion'?8:spell.id==='zone-of-truth'?1/6:spell.id==='command'?1/600:spell.id === 'charm-person' ? 1 : spell.id === 'animal-friendship' ? 24 : spell.id==='color-spray'?1/600:1 / 60
  const details: string[] = []
  // Forcing this save ends any earlier Friends casting, including on another NPC.
  for (const c of world.characters)
    if (c.runtime)
      c.runtime.effects = rememberEndedCharms(
        c.runtime.effects!,
        c.runtime.effects!.filter(
          (e) =>
            !(
              e.key === 'friends' &&
              (e.sourceId === casterId ||
                world.encounters.some((enc) =>
                  enc.actors.some((a) => a.id === e.sourceId && a.characterId === casterId),
                ))
            ),
        ),
      )
  for (const n of adventure.ai?.npcs ?? []) {
    const actor = world.encounters.flatMap((e) => e.actors).find((a) => a.id === n.actorId),
      body = actor?.npc ?? n.body
    if (body)
      body.effects = rememberEndedCharms(
        body.effects,
        body.effects.filter(
          (e) =>
            !(
              e.key === 'friends' &&
              (e.sourceId === casterId ||
                world.encounters.some((enc) =>
                  enc.actors.some((a) => a.id === e.sourceId && a.characterId === casterId),
                ))
            ),
        ),
      )
  }
  for (const token of targets) {
    const c = world.characters.find((c) => c.id === token.characterId),
      n = adventure.ai?.npcs.find((n) => n.id === token.npcId),
      existing = world.encounters
        .flatMap((e) => e.actors)
        .find((a) => a.id === (token.actorId ?? n?.actorId)),
      body = existing?.npc ?? n?.body ?? token.npcBody ?? null,
      actor: Combatant = existing ?? {
        id: token.id,
        characterId: c?.id ?? null,
        npc: body,
        side: 'neutral',
        initiative: null,
        surprised: false,
        turn: freshTurn(),
      }
    if (!c && !body) throw Error('受术者没有有效数据卡')
    const stats = combatStats(actor, world.characters, cat)
    if (stats.dead || stats.hp <= 0) throw Error('受术者已死亡或倒地，请先由GM核对合法目标')
    const state = c ? (c.id === casterId ? r : runtimeState(c, cat)) : body!,
      effects = state.effects ?? []
    if (c) c.runtime = state as ReturnType<typeof runtimeState>
    const targetId = c?.id ?? n?.id ?? token.id
    let automatic =
      !!actorCreatureType(actor,world.characters,true) &&
      actorCreatureType(actor,world.characters,true) !== 'humanoid' &&
      ['friends', 'charm-person'].includes(spell.id)
    if (spell.id === 'animal-friendship') automatic = actorCreatureType(actor,world.characters,true) !== 'beast'
    if (spell.id === 'sleep')
      automatic = c?.build.speciesId === 'elf' || !!body?.conditionImmunities.includes('exhaustion')
    if (spell.id === 'hold-person')
      automatic = actorCreatureType(actor,world.characters,true) !== 'humanoid'
    if (spell.id === 'friends') {
      automatic ||= r.effects.some(
        (e) =>
          e.key.startsWith('friends-history:') &&
          (e.socialTargetId === targetId || e.key === 'friends-history:' + targetId) &&
          (e.endsAt ?? 0) > r.hours,
      )
      r.effects = r.effects.filter(
        (e) => !(e.key.startsWith('friends-history:') && e.socialTargetId === targetId),
      )
      r.effects.push({
        id: crypto.randomUUID(),
        key: 'friends-history:' + targetId,
        name: '交友术施放记录',
        sourceId: casterId,
        page: spell.source.page,
        concentration: false,
        expiresAt: null,
        encounterId: 'outside',
        phase: 'start',
        endsAt: r.hours + 24,
        socialTargetId: targetId,
        note: '包括豁免成功的施放',
      })
    }
    if(spell.id==='zone-of-truth')automatic=true
    const roll = automatic
      ? null
      : savingRoll(
          actor,
          spell.id==='calm-emotions'?'cha':spell.id==='phantasmal-force'?'int':['blindness-deafness','color-spray','ray-of-enfeeblement'].includes(spell.id) ? 'con' : 'wis',
          {...defaultEnvironment(),advantage:!!body?.magicResistance},
          world.characters,
          cat,
          dice,
          spell.id==='fear'?'fear':['friends','animal-friendship','charm-person','hypnotic-pattern','crown-of-madness','suggestion'].includes(spell.id)?'charm':'normal',
        )
    const saved = automatic || (!!roll && !roll.autoFail && roll.total >= dc)
    const immune = [...(body?.conditionImmunities ?? []),...appliedEffects(effects).flatMap(f=>f.conditionImmunities??[])]
    const conditions = (
      spell.id === 'hold-person'
        ? ['paralyzed']
        : spell.id==='color-spray' ? ['blinded'] : spell.id === 'blindness-deafness'
          ? [choice!]
          : spell.id === 'hideous-laughter'
            ? ['incapacitated', 'prone']
            : spell.id === 'hypnotic-pattern'
              ? ['charmed', 'incapacitated']
              : spell.id === 'sleep'
                ? ['incapacitated']
                : ['charmed']
    ).filter((id) => !immune.includes(id))
    if (spell.id === 'hypnotic-pattern' && immune.includes('charmed')) conditions.length = 0
    const control=socialControlEffect(spell.id,dc,selection.controlChoices?.[token.id]??choice,selection.controlTargets,selection.controlText)??m2ControlEffect(spell.id,dc)??(spell.id==='command'?{supportChoice:choice,note:'下个实际回合执行命令，由GM确认路径与结果'}:spell.id==='fear'?{condition:'frightened',repeatSave:{ability:'wis',dc},visibility:'public' as const,note:'掉落持有物；GM确认安全路线与失去来源视线后的再豁免'}:spell.id==='crown-of-madness'?{condition:'charmed',repeatSave:{ability:'wis',dc},control:{dc,targets:[],text:'GM须确认当前是否有合法近战目标',maintenanceKey:adventure.exploration?.id+':'+adventure.exploration?.round},note:'指定目标、维持魔法动作和移动前近战攻击由GM在探索回合核对'}:spell.id==='zone-of-truth'?{control:{dc,targets:[],text:'区域进入与离开须GM核对',inside:true},visibility:'owner' as const,note:'首次进入／回合开始魅力豁免；失败在区域内不能故意说谎，可拒答'}:null)
    if(control)conditions.length=0
    if(control?.condition&&immune.includes(control.condition)){
      details.push(token.name+'：免疫'+control.condition+'，未施加对应控制')
      continue
    }
    if(saved&&spell.id==='ray-of-enfeeblement')state.effects.push({id:crypto.randomUUID(),key:'enfeeblement-next-attack',name:spell.name,sourceId:casterId,
      page:spell.source.page,concentration:false,expiresAt:null,encounterId:'outside',phase:'start',attackDisadvantage:true,
      spellId:spell.id,spellLevel:slotLevel||spell.level,castId:crypto.randomUUID(),clockSourceId:casterId,endsAt:r.hours+1/600,note:'成功豁免：来源下回合开始前的下一次攻击劣势'})
    if ((!saved||spell.id==='zone-of-truth') && (conditions.length||control)) {
      const effect: ActiveEffect = {
        id: crypto.randomUUID(),
        key: spell.id,
        spellId:spell.id,spellLevel:slotLevel||spell.level,castId:castingId,
        name: spell.name,
        sourceId: casterId,
        page: spell.source.page,
        concentration: spell.concentration,
        clockSourceId: casterId,
        expiresAt: null,
        encounterId: 'outside',
        phase: 'start',
        endsAt: r.hours + duration,
        note: 'GM已确认非战斗目标与施法要求',
        ...(control??(spell.id==='color-spray'?{condition:'blinded',visibility:'public' as const}:['hold-person', 'blindness-deafness'].includes(spell.id)
          ? {
              condition: conditions[0],
              repeatSave: {
                ability: spell.id === 'hold-person' ? ('wis' as const) : ('con' as const),
                dc,
              },
              visibility: 'public' as const,
            }
          : spell.id === 'hypnotic-pattern'
            ? { conditions, speedZero: true, visibility: 'public' }
            : spell.id === 'sleep'
              ? {
                  condition: 'incapacitated',
                  sleepStage: 'drowsy',
                  repeatSave: { ability: 'wis', dc },
                  visibility: 'public',
                }
              : spell.id === 'hideous-laughter'
                ? { conditions, repeatSave: { ability: 'wis', dc }, visibility: 'public' }
                : { condition: 'charmed', visibility: 'owner' })),
      }
      state.effects = effects.filter((e) => !(e.key === spell.id && e.sourceId === casterId))
      state.effects.push(effect)
    }
    details.push(
      `${token.name}：${automatic ? '依目标／24小时限制自动豁免成功' : `${['blindness-deafness','color-spray','ray-of-enfeeblement'].includes(spell.id) ? '体质' : '感知'}豁免 ${roll!.total}/DC ${dc}，${saved ? '成功' : conditions.length||control ? '效果生效' : '免疫状态'}`}`,
    )
  }
  return details.join('；')
}
