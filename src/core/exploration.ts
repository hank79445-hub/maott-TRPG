import {itemCastFailed,spellUsesSlot} from './item-spells'
import {validateGWorld} from './gm-spell-world'
import {summonPhase} from './summon-phase'
import {terrainPhase,clearTerrainTurn,pendingTerrain,terrainEntityId,queueTerrain} from './scene-terrain'
import {M4_EXCLUSIVE_SCENE_SPELLS} from './scene-effects'
import {endM3Blink} from './m3-world-lifecycle'
import { validateM3Choice } from './m3-spells'
import {reduceEnfeebled} from './m2-control'
import {concentrationMatches} from './spell-source-state'
import {rememberEndedCharms} from './social-effects'
import {refreshTruthZones} from './truth-zone'
import {assertDuelRoute,assertFrightenedRoute} from './control-movement'
import {validateControlSelection,charmEffective} from './m2-social-controls'
import {appliedEffects} from './effects'
import { explorationHealingSpell } from './exploration-healing-spells'
import {M1_UTILITY_SPELLS} from './m1-utility'
import {protectionSaveAdvantage} from './protection-evil'
import {spellRangeFeet} from './spell-range'
import { humanoidPlayerSpecies,actorCreatureType,validateControlTargets } from './control-spells'
import {dropFearHeldItems} from './control-movement'
import type { Catalogue } from './engine'
import type { Adventure, MapWorld, MapScene, MapToken, Position } from './map-types'
import type { ExplorationBudget, ExplorationCommand } from './exploration-types'
import {
  applyRuntime,
  runtimeState,
  runtimeDerived,
  runtimeSpells,
  castSlotLevel,
  resources,
  rollDie,
} from './runtime'
import { hasFeat } from './advanced-rules'
import { rulePowers } from './phb-powers'
import { areaTargets, areaEnvironment, spellAreaSpec, validateSpellArea } from './map-area'
import { zoneAlive } from './ongoing-spells'
import type { RuntimeCommand } from './runtime'
import { blocked, inside, occupied, directPath, tagsAt, distance } from './map'
import { movementWalls, sightLine } from './map-spatial'
import {
  combatStats,
  freshTurn,
  savingRoll,
  defenses,
  adjustDamage,
  rollDamage,
} from './combat-rules'
import type { Combatant, DamageType } from './combat-types'
import { runUpDistance, jumpCapacity } from './movement-rules'
import { defaultEnvironment, attackOptions } from './combat-rules'
import { applyCombat } from './combat'
import { spellEffect } from './combat-rules'
import { explorationSocialSpell } from './exploration-social-spells'
import { explorationSupportSpell } from './exploration-support-spells'
import { validateSupportSpell, resistanceReduction } from './support-spells'
import { createGmSpellRequest } from './spell-gm-resolution'

export function explorationCharacter(world: MapWorld, t: MapToken) {
  return world.characters.find((c) => c.id === t.characterId)
}
function npcControlDamage(actor:Combatant,world:MapWorld,cat:Catalogue,dice:(n:number)=>number,amount:number){
  const body=actor.npc
  if(!body||amount<=0)return
  body.effects=rememberEndedCharms(body.effects,body.effects.filter(f=>!['friends','sleep','hypnotic-pattern'].includes(f.key)&&!(f.key==='calm-emotions'&&f.supportChoice==='indifferent')))
  for(const effect of [...body.effects].filter(f=>f.key==='hideous-laughter'&&f.repeatSave)){
    const roll=savingRoll(actor,'wis',{...defaultEnvironment(),advantage:true},world.characters,cat,dice)
    if(!roll.autoFail&&roll.total>=effect.repeatSave!.dc)body.effects=body.effects.filter(f=>f.id!==effect.id)
  }
  if(!body.hp){body.dead=true;delete body.concentration}
  else if(body.concentration)body.concentration.pendingDC=Math.max(body.concentration.pendingDC??0,10,Math.min(30,Math.floor(amount/2)))
}
export function explorationActor(world: MapWorld, t: MapToken): Combatant {
  const n = world.adventures.flatMap((a) => a.ai?.npcs ?? []).find((n) => n.id === t.npcId)
  return (
    world.encounters.flatMap((e) => e.actors).find((a) => a.id === (t.actorId ?? n?.actorId)) ?? {
      id: t.npcSourceActorId ?? t.id,
      characterId: t.characterId,
      npc: n?.body ?? t.npcBody ?? null,
      side: n?.side ?? 'party',
      initiative: null,
      surprised: false,
      turn: freshTurn(),
    }
  )
}
export function explorationStats(world: MapWorld, t: MapToken, cat: Catalogue) {
  const c = explorationCharacter(world, t)
  if (c)
    return {
      speed: runtimeDerived(c, cat).speed,
      strength: runtimeDerived(c, cat).scores.str,
      conditions: runtimeDerived(c, cat).conditions,
    }
  if (t.npcBody) {
    const d = combatStats(
      {
        id: t.id,
        characterId: null,
        npc: t.npcBody,
        side: 'party',
        initiative: null,
        surprised: false,
        turn: freshTurn(),
      },
      world.characters,
      cat,
    )
    return { speed: d.speed, strength: d.scores.str, conditions: d.conditions }
  }
  const actor = world.encounters.flatMap((e) => e.actors).find((a) => a.id === t.actorId)
  if (actor) {
    const d = combatStats(actor, world.characters, cat)
    return { speed: d.speed, strength: d.scores.str, conditions: d.conditions }
  }
  const npc = explorationActor(world, t).npc
  const effective = npc ? combatStats(explorationActor(world, t), world.characters, cat) : null
  return {
    speed: effective?.speed ?? 0,
    strength: effective?.scores.str ?? 10,
    conditions: effective?.conditions ?? [],
  }
}
function fresh(t: MapToken): ExplorationBudget {
  return {
    tokenId: t.id,
    characterId: t.characterId,
    action: true,
    bonus: true,
    reaction: true,
    interaction: true,
    movement: 0,
    dash: 0,
    ended: false,
    deathSaved: false,
    slotSpent: false,
    jumpUsed: false,
    wind: false,
    surgeAction: false,
    surgeUsed: false,
    endProcessed: false,
    trail: [{ x: t.x, y: t.y }],
    flags: [],
  }
}
export function explorationMember(a: Adventure, tokenId: string) {
  return a.exploration &&
    a.exploration.status !== 'closed' &&
    a.exploration.sceneId === a.activeSceneId
    ? a.exploration.members.find((m) => m.tokenId === tokenId)
    : undefined
}
function characterMember(a: Adventure, id: string) {
  return a.exploration &&
    a.exploration.status !== 'closed' &&
    a.exploration.sceneId === a.activeSceneId
    ? a.exploration.members.find((m) => m.characterId === id)
    : undefined
}
export function assertExplorationReady(
  world: MapWorld,
  a: Adventure,
  m: ExplorationBudget,
  cat: Catalogue,
  allowDeath = false,
  walkedTerrain = false,
) {
  if (m.ended) throw Error('该角色已结束本轮探索回合')
  const c = world.characters.find((c) => c.id === m.characterId)
  if (c) {
    const r = runtimeState(c, cat)
    if (r.concentration?.pendingDC) throw Error('请先完成待结算专注豁免')
    if (!allowDeath && !r.hp && !r.death.stable && !r.death.dead && !m.deathSaved)
      throw Error('请先完成本轮死亡豁免')
  }
  const token=a.scenes.find(s=>s.id===a.exploration?.sceneId)?.tokens.find(t=>t.id===m.tokenId)
  if(token&&!c&&explorationActor(world,token).npc?.concentration?.pendingDC)throw Error('请先处理NPC待结算专注豁免')
  if(token&&a.summons?.events?.some(e=>e.status==='pending'&&[token.id,token.characterId,token.npcId,token.actorId].includes(e.targetId??e.instanceId)))throw Error('请先在快速审核处理该人物待结算的召唤物后果')
  if(!walkedTerrain&&token&&pendingTerrain(a,terrainEntityId(token)).length)throw Error('请先处理该人物待结算区域事件')
  const effects=token?combatStats(explorationActor(world,token),world.characters,cat).effects:[]
  m.flags=m.flags.filter(f=>!f.startsWith('rule-'))
  if(effects.some(f=>f.key==='stinking-cloud-turn'))m.flags.push('rule-stinking-cloud')
  if(effects.some(f=>f.key==='slow'))m.flags.push('rule-slow')
  if(effects.some(f=>f.key==='command'&&f.maintainedTick!==undefined)){m.flags.push('rule-command');if(effects.some(f=>f.key==='command'&&(f.directiveComplete||['halt','drop','grovel'].includes(f.supportChoice??''))))m.flags.push('rule-command-stop')}
  if(token&&explorationStats(world,token,cat).conditions.includes('frightened')&&effects.some(f=>f.key==='fear'&&!(f.fearContext?.contextId===a.exploration?.id&&f.fearContext?.tick===a.exploration?.round&&f.fearContext?.noSafeRoute)))m.flags.push('rule-fear')
  if (a.exploration?.triggers.some((t) => !t.resolved && t.tokenId === m.tokenId))
    throw Error('请由 GM 处理该角色的持续区域触发')
}
export function explorationSpend(
  m: ExplorationBudget,
  cost: 'action' | 'bonus' | 'reaction' | 'interaction',
  magic = false,
  action?:string,
) {
  if(cost!=='reaction'&&m.flags.includes('rule-stinking-cloud'))throw Error('臭云术中毒：本回合不能使用动作或附赠动作')
  if(m.flags.includes('rule-slow')&&(cost==='reaction'||cost==='action'&&m.flags.includes('budget-bonus')||cost==='bonus'&&m.flags.includes('budget-action')))throw Error('缓慢术禁止反应，且动作与附赠动作互斥')
  if(m.flags.includes('rule-command-stop')&&cost!=='reaction')throw Error('命令术：本回合不能继续行动')
  if(m.flags.includes('rule-command')&&cost!=='reaction'&&action!=='dash')throw Error('命令术：请先完成指定行为，不能改用其他行动')
  if(m.flags.includes('rule-fear')&&cost==='action'&&action!=='dash')throw Error('恐惧术须疾走，或由GM确认没有安全路线')
  if(cost==='action'||cost==='bonus')m.flags=[...new Set([...m.flags,'budget-'+cost])]
  if (cost === 'action' && !m.action && m.surgeAction && !magic) {
    m.surgeAction = false
    return
  }
  if (!m[cost])
    throw Error(
      `本轮${{ action: '动作', bonus: '附赠动作', reaction: '反应', interaction: '物品交互' }[cost]}已用完`,
    )
  m[cost] = false
}
export function explorationMove(
  world: MapWorld,
  a: Adventure,
  t: MapToken,
  path: Position[],
  cost: number,
  cat: Catalogue,
  gm = false,
) {
  const m = explorationMember(a, t.id)
  if (!m) {
    if (a.exploration?.status === 'active' && !gm) throw Error('该棋子未加入探索回合名单')
    return
  }
  if (gm) {
    m.trail = []
    return
  }
  assertExplorationReady(world, a, m, cat, false, true)
  const stats = explorationStats(world, t, cat)
  if (m.movement + cost > stats.speed + m.dash) throw Error('超过本轮剩余探索移动力')
  m.movement += cost
  if (stats.conditions.includes('prone')) m.trail = []
  else m.trail = [...(m.trail.length ? m.trail : [{ x: t.x, y: t.y }]), ...path].slice(-200)
  a.exploration!.acted = true
}
export function explorationRuntime(
  world: MapWorld,
  a: Adventure,
  id: string,
  cmd: RuntimeCommand,
  cat: Catalogue,
) {
  const m = characterMember(a, id)
  if (!m) {
    if (
      a.exploration?.status === 'active' &&
      a.party.includes(id) &&
      (['cast', 'equip', 'advanced', 'resource', 'origin', 'recover', 'death-save'].includes(
        cmd.type,
      ) ||
        (cmd.type === 'check' &&
          cmd.kind === 'skill' &&
          cmd.context?.purpose !== 'concentration') ||
        (cmd.type === 'item-remove' && cmd.consume))
    )
      throw Error('该角色未加入探索名单，请 GM 更新名单或收尾')
    return
  }
  const c = world.characters.find((c) => c.id === id)!
  if (
    [
      'portrait-set',
      'item-note',
      'item-move',
      'item-split',
      'concentration-result',
      'damage',
      'heal',
      'temporary',
      'condition',
      'effect-remove',
      'exhaustion',
      'stabilize',
      'resource-set',
      'end-effect',
      'inspiration',
      'item-add',
      'coins',
    ].includes(cmd.type) ||
    (cmd.type === 'check' && cmd.context?.purpose === 'concentration')
  )
    return
  if (cmd.type === 'time') return
  if (cmd.type === 'undo' || cmd.type === 'rest' || cmd.type === 'level-up')
    throw Error('请先由 GM 收尾探索轮，再撤销、休息或升级')
  if (cmd.type === 'death-save') {
    if (m.ended) throw Error('本角色已结束本轮')
    if (m.deathSaved) throw Error('本角色本轮死亡豁免已处理')
    m.deathSaved = true
    a.exploration!.acted = true
    return
  }
  assertExplorationReady(world, a, m, cat)
  if (cmd.type === 'cast') {
    const g = runtimeSpells(c, cat).find((g) => g.key === cmd.key)
    if (!g) throw Error('法术来源不可用')
    if (/minute|hour/i.test(g.spell.castingTime) || cmd.mode === 'ritual')
      throw Error('长时间施法请由 GM 收尾探索轮并推进实际时间')
    const slot = spellUsesSlot(cmd.mode) ? castSlotLevel(cmd.mode) : 0
    if (slot && m.slotSpent) throw Error('本回合已消耗法术位施法')
    const cost = /reaction/i.test(g.spell.castingTime)
      ? 'reaction'
      : /bonus/i.test(g.spell.castingTime)
        ? 'bonus'
        : 'action'
    explorationSpend(m, cost, true)
    if (slot) m.slotSpent = true
  } else if (cmd.type === 'equip') {
    const item = [...cat.items, ...c.build.customItems].find(
      (i) => i.id === c.inventory.find((r) => r.instanceId === cmd.instanceId)?.itemId,
    )
    if (item?.kind === 'armor') throw Error('穿脱护甲需要实际时间，请先收尾探索轮')
    if (m.interaction) explorationSpend(m, 'interaction')
    else explorationSpend(m, 'action')
  } else if (cmd.type === 'item-remove' && cmd.consume) {
    const row = c.inventory.find((i) => i.instanceId === cmd.instanceId),
      item = [...cat.items, ...c.build.customItems].find((i) => i.id === row?.itemId)
    explorationSpend(m, item?.id.includes('potion') || ['goodberry','chef-treat'].includes(item?.id??'') ? 'bonus' : 'action')
  } else if (cmd.type === 'advanced') {
    const power = rulePowers(c).find((p) => p.id === cmd.id)
    if (!power) throw Error('能力来源不可用')
    if (
      power.timing === 'rest' ||
      ['phb/chef-treats', 'phb/poisoner-craft', 'phb/war-bond'].includes(power.id)
    )
      throw Error('长时间或休息能力请先收尾探索轮')
    if (power.cost !== 'none') explorationSpend(m, power.cost, /魔法动作/.test(power.detail))
  } else if (cmd.type === 'resource' && cmd.amount > 0) {
    const detail = resources(c, cat).find((r) => r.id === cmd.id)?.detail ?? ''
    if (cmd.id === 'action-surge' || cmd.id === 'focus' || cmd.id === 'sorcery-points')
      throw Error('请使用对应具体行动入口，不可只扣资源绕过预算')
    if (/附赠动作/.test(detail)) explorationSpend(m, 'bonus')
    else if (/反应/.test(detail)) explorationSpend(m, 'reaction')
    else if (/动作/.test(detail)) explorationSpend(m, 'action')
  } else if (cmd.type === 'origin') {
    if (['craft', 'musician', 'chef-meal', 'inspiring-leader'].includes(cmd.id))
      throw Error('此能力需要较长时间或休息，请先收尾探索轮')
    if (cmd.id === 'revelation') explorationSpend(m, 'bonus')
    if (cmd.id === 'healer' || cmd.id === 'healing-hands')
      explorationSpend(m, 'action', cmd.id === 'healing-hands')
  } else if (cmd.type === 'recover') {
    if (cmd.id === 'magical-cunning') throw Error('奇秘异能需一分钟，请先收尾探索轮')
    if (cmd.id === 'font-slot') explorationSpend(m, 'bonus')
  } else if (
    cmd.type === 'check' &&
    cmd.context?.purpose !== 'concentration' &&
    cmd.kind === 'skill'
  )
    explorationSpend(m, 'action')
  m.trail = []
  a.exploration!.acted = true
}
function syncClocks(world: MapWorld, a: Adventure, cat: Catalogue) {
  const x = a.exploration!
  for (const c of world.characters.filter((c) => Object.hasOwn(x.clocks, c.id))) {
    const baseline = x.clocks[c.id]!,
      current = runtimeState(c, cat).hours
    const delta = x.acted ? Math.max(0, baseline + 1 / 600 - current) : 0
    if (delta > 1e-10)
      world.characters[world.characters.indexOf(c)] = applyRuntime(c, cat, {
        type: 'time',
        hours: delta,
      })
  }
}
// Reuse the character/NPC save and damage rules without creating a combat encounter.
function effectTiming(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  tokenId: string,
  cat: Catalogue,
  phase: 'start' | 'end',
  dice: (n: number) => number,
) {
  const t = s.tokens.find((t) => t.id === tokenId)
  if (!t) return ''
  const c = explorationCharacter(world, t)
  const actor = explorationActor(world, t)
  const effects = () =>
    c
      ? runtimeState(
          world.characters.find((q) => q.id === c.id)!,
          cat,
        ).effects
      : (actor.npc?.effects ?? [])
  const remove = (id: string) => {
    if (c) {
      const current = world.characters.find((q) => q.id === c.id)!,
        r = runtimeState(current, cat)
      r.effects = r.effects.filter((f) => f.id !== id)
      current.runtime = r
    } else if (actor.npc) actor.npc.effects = effects().filter((f) => f.id !== id)
  }
  if(phase==='start'){terrainPhase(world,a,s,t,'start',cat);summonPhase(world,a,s,t,'start',cat)}
  if(phase==='end')clearTerrainTurn(world,a,t)
  if(phase==='start')refreshTruthZones(world,a,s,t,[t],cat,dice,true)
  let detail = ''
  for (const f of appliedEffects(effects())) {
    if (
      f.endsAt !== undefined &&
      f.endsAt <=
        (c
          ? runtimeState(
              world.characters.find((q) => q.id === c.id)!,
              cat,
            ).hours
          : 0)
    )
      continue
    if(phase==='end'&&f.key==='fear'&&explorationStats(world,t,cat).conditions.includes('frightened')){
      if(!f.fearContext||f.fearContext.contextId!==a.exploration!.id||f.fearContext.tick!==a.exploration!.round||!f.fearContext.movementResolved)throw Error('请GM核对恐惧术本回合实际路线与视线')
      const member=explorationMember(a,t.id)
      if(!f.fearContext.noSafeRoute&&(!member||!member.flags.includes('fear-dash')))throw Error('恐惧术要求加入探索名单并先消耗实际疾走动作，再结束探索回合')
    }
    if(phase==='end'&&f.key==='command'&&f.maintainedTick!==undefined){if(['approach','flee'].includes(f.supportChoice??'')&&!f.directiveComplete)throw Error('请GM核对命令术实际移动结果');remove(f.id);continue}
    if(phase==='end'&&f.key==='crown-of-madness'&&charmEffective(effects())&&f.control?.turnKey!==a.exploration!.id+':'+a.exploration!.round)throw Error('请GM先核对疯狂冠冕维持动作及本回合近战结果')
    if (phase === 'end' && f.repeatSave&&!(f.key==='fear'&&f.fearContext?.sourceVisible!==false)) {
      a.exploration!.acted = true
      const roll = savingRoll(
        actor,
        f.repeatSave.ability,
        {...defaultEnvironment(),advantage:protectionSaveAdvantage(effects(),f)},
        world.characters,
        cat,
        dice,
        f.condition === 'charmed' ? 'charm' : f.condition === 'frightened' ? 'fear' : 'normal',
      )
      detail += `；${t.name} ${f.name}回合末豁免 ${roll.total}/DC ${f.repeatSave.dc}`
      if (!roll.autoFail && roll.total >= f.repeatSave.dc) remove(f.id)
      else if (f.key === 'sleep' && f.sleepStage === 'drowsy') {
        const current = effects().find((e) => e.id === f.id)
        if (current) {
          current.sleepStage = 'asleep'
          current.condition = 'unconscious'
          delete current.repeatSave
          if (c)
            world.characters.find((q) => q.id === c.id)!.runtime!.effects = effects().map((e) =>
              e.id === f.id ? current : e,
            )
        }
      }
    }
    if(phase==='start'&&f.key==='command'){f.maintainedTick=a.exploration!.round;if(['halt','grovel','drop'].includes(f.supportChoice??'')){const budget=explorationMember(a,t.id);if(budget){budget.action=false;budget.bonus=false}f.speedZero=true;if(f.supportChoice==='drop'&&c)dropFearHeldItems(world,s,c.id,cat);if(f.supportChoice==='grovel'){if(c)c.runtime!.conditions=[...new Set([...(c.runtime!.conditions??[]),'prone'])];else if(actor.npc&&!actor.npc.conditions.includes('prone'))actor.npc.conditions.push('prone')}}if(c)c.runtime!.effects=c.runtime!.effects!.map(e=>e.id===f.id?f:e)}
    if(phase==='start'&&f.key==='zone-of-truth'&&f.control?.inside&&f.control.result!==false&&f.control.turnKey!==a.exploration!.id+':'+a.exploration!.round){const roll=savingRoll(actor,'cha',defaultEnvironment(),world.characters,cat,dice);f.control.result=!roll.autoFail&&roll.total>=f.control.dc;f.control.turnKey=a.exploration!.id+':'+a.exploration!.round;if(c)c.runtime!.effects=c.runtime!.effects!.map(e=>e.id===f.id?f:e)}
    if (phase === 'start' && (f.startDamage || f.key === 'burning')) {
      const spec = f.startDamage ?? { dice: '1d4', damageType: 'fire', dc: 0 },
        raw = reduceEnfeebled(rollDamage(spec.dice,dice),f.spellId?(world.characters.find(c=>c.id===f.sourceId)?.runtime?.effects??world.encounters.flatMap(e=>e.actors).find(a=>[a.id,a.characterId,a.npcId].includes(f.sourceId))?.npc?.effects??[]):[],dice)
      const type = spec.damageType as DamageType,
        defense = defenses(actor, world.characters, cat),
        eligible = adjustDamage(raw.total, type, defense) > 0,
        reduction = eligible
          ? resistanceReduction(
              effects(),
              type,
              raw.total,
              'outside:' +
                Math.floor(
                  (c?.runtime?.hours ?? world.characters[0]?.runtime?.hours ?? 0) * 600 + 1e-7,
                ),
              dice,
              c ? world.characters.find((q) => q.id === c.id)!.runtime! : actor.npc!,
            )
          : 0,
        amount = adjustDamage(raw.total, type, defense, false, reduction)
      if (c && amount > 0) {
        const current = world.characters.find((q) => q.id === c.id)!
        const r = runtimeState(current, cat),
          previousDC = r.concentration?.pendingDC ?? 0
        if (r.concentration) r.concentration.pendingDC = null
        current.runtime = r
        world.characters[world.characters.indexOf(current)] = applyRuntime(
          current,
          cat,
          { type: 'damage', amount, note: `${f.name}回合开始；${raw.formula}=${raw.total}` },
          dice,
        )
        const next = world.characters.find((q) => q.id === c.id)!.runtime!
        if (next.concentration && previousDC)
          next.concentration.pendingDC = Math.max(previousDC, next.concentration.pendingDC ?? 0)
      } else if (actor.npc) {
        const absorbed = Math.min(actor.npc.temporaryHp, amount)
        actor.npc.temporaryHp -= absorbed
        actor.npc.hp = Math.max(0, actor.npc.hp - (amount - absorbed))
        npcControlDamage(actor,world,cat,dice,amount)
      }
      detail += `；${t.name} ${f.name}回合开始 ${raw.total}，实际伤害 ${amount}`
      if (f.startDamage) {
        const roll = savingRoll(actor, 'con', defaultEnvironment(), world.characters, cat, dice)
        detail += `，体质 ${roll.total}/DC ${spec.dc}`
        if (!roll.autoFail && roll.total >= spec.dc) remove(f.id)
      }
      a.exploration!.acted = true
    }
  }
  if (t.npcBody && actor.npc) t.npcBody = actor.npc
  return detail
}
function pending(world: MapWorld, a: Adventure, cat: Catalogue) {
  if (world.encounters.some((e) => e.pending)) throw Error('请先完成待结算攻击、伤害或反应')
  if (a.exploration?.triggers.some((t) => !t.resolved)) throw Error('请先处理持续区域触发')
  if(a.scenes.find(s=>s.id===a.activeSceneId)?.tokens.some(t=>!t.characterId&&explorationActor(world,t).npc?.concentration?.pendingDC))throw Error('请先处理NPC待结算专注豁免')
  for (const m of a.exploration?.members ?? []) {
    const c = world.characters.find((c) => c.id === m.characterId)
    if (c && runtimeState(c, cat).concentration?.pendingDC) throw Error('请先处理专注豁免')
    if (c) {
      const r = runtimeState(c, cat)
      if (!r.hp && !r.death.dead && !r.death.stable && !m.deathSaved)
        throw Error('请先完成本轮死亡豁免')
    }
  }
}
export function finishExploration(
  world: MapWorld,
  a: Adventure,
  cat: Catalogue,
  close: boolean,
  dice: (n: number) => number = rollDie,
) {
  const x = a.exploration
  if (!x || x.status === 'closed') return
  const scene = a.scenes.find((s) => s.id === x.sceneId)!
  for (const m of x.members)
    if (!m.endProcessed) {
      effectTiming(world, a, scene, m.tokenId, cat, 'end', dice)
      m.endProcessed = true
    }
  // A spell target need not be controllable or on the party's initiative roster.
  const processed = (x.effectEndProcessed ??= [])
  for (const token of scene.tokens.filter(
    (t) =>
      !x.members.some((m) => m.tokenId === t.id) &&
      !x.retired.some((m) => m.tokenId === t.id && m.endProcessed),
  )) {
    if (processed.includes(token.id)) continue
    const actor = explorationActor(world, token)
    const effects = token.characterId
      ? world.characters.find((c) => c.id === token.characterId)?.runtime?.effects
      : actor.npc?.effects
    if (!effects?.some((e) => e.repeatSave)) continue
    effectTiming(world, a, scene, token.id, cat, 'end', dice)
    processed.push(token.id)
  }
  for(const token of scene.tokens)for(const f of combatStats(explorationActor(world,token),world.characters,cat).effects.filter(f=>f.key==='crown-of-madness')){
    if(f.control?.maintenanceKey===x.id+':'+x.round)continue
    const source=world.characters.find(c=>c.id===f.sourceId)||world.characters.find(c=>world.encounters.some(e=>e.actors.some(a=>a.id===f.sourceId&&a.characterId===c.id)))
    if(source){source.runtime=runtimeState(source,cat);if(concentrationMatches(f,source.runtime.concentration))source.runtime.concentration=null}
    else{const actor=world.encounters.flatMap(e=>e.actors).find(a=>[a.id,a.npcId].includes(f.sourceId));if(actor?.npc&&concentrationMatches(f,actor.npc.concentration))delete actor.npc.concentration;const n=a.ai?.npcs.find(n=>n.actorId===f.sourceId||n.id===f.sourceId);if(n?.body&&concentrationMatches(f,n.body.concentration))delete n.body.concentration}
  }
  pending(world, a, cat)
  syncClocks(world, a, cat)
  if (close) {
    x.status = 'closed'
    return
  }
  const s = a.scenes.find((s) => s.id === x.sceneId)!
  x.members = x.members
    .map((m) => s.tokens.find((t) => t.id === m.tokenId))
    .filter((t): t is MapToken => !!t)
    .map(fresh)
  x.retired = []
  x.round++
  x.roundId = crypto.randomUUID()
  x.acted = false
  x.effectEndProcessed = []
  x.triggers = []
  x.clocks = Object.fromEntries(
    world.characters
      .filter((c) => a.party.includes(c.id) || x.members.some((m) => m.characterId === c.id))
      .map((c) => [c.id, runtimeState(c, cat).hours]),
  )
  for (const m of x.members) effectTiming(world, a, s, m.tokenId, cat, 'start', dice)
  collectExplorationTriggers(
    world,
    a,
    s,
    'start',
    x.members.map((m) => m.tokenId),
  )
}
export function collectExplorationTriggers(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  phase: 'enter' | 'start' | 'end',
  tokens: string[],
  turnTokenId?: string,
) {
  const x = a.exploration
  if (!x || x.status === 'closed') return
  const encounters = world.encounters.filter(
    (e) => e.session?.sceneId === s.id || e.id === s.encounterId,
  )
  for (const id of tokens)
    for (const e of encounters)
      for (const z of e.zones ?? []) {
        const t = s.tokens.find((t) => t.id === id)
        const target = e.actors.find(
          (actor) =>
            actor.id === t?.actorId ||
            actor.id === t?.npcSourceActorId ||
            (!!actor.characterId && actor.characterId === t?.characterId),
        )
        const caster = e.actors.find((actor) => actor.id === z.sourceId)
        const source = world.characters.find((c) => c.id === caster?.characterId)
        if (!t || !target || !zoneAlive(z, source) || z.excludedIds.includes(target.id)) continue
        if (z.spellId === 'hunger-of-hadar' ? phase === 'enter' : phase === 'start') continue
        if (z.template) {
          const template = { ...z.template }
          if (z.spellId === 'spirit-guardians') {
            const from = s.tokens.find(
              (t) => t.actorId === z.sourceId || t.characterId === caster?.characterId,
            )
            if (!from) continue
            Object.assign(template, { x: from.x, y: from.y, originSpan: from.span })
            delete template.origin
          }
          if (!areaTargets(s, template).some((r) => r.token.id === id && r.eligible)) continue
        }
        // No automatic damage. The GM confirms real three-dimensional contact and timing.
        if (
          !x.triggers.some(
            (t) =>
              t.tokenId === id &&
              t.turnTokenId === (turnTokenId ?? id) &&
              t.sourceId === z.id &&
              (z.spellId === 'hunger-of-hadar' || z.spellId === 'cordon-of-arrows'
                ? t.phase === phase
                : true),
          )
        )
          x.triggers.push({
            id: crypto.randomUUID(),
            tokenId: id,
            sourceId: z.id,
            encounterId: e.id,
            targetId: target.id,
            turnTokenId: turnTokenId ?? id,
            phase,
            resolved: false,
            note: '',
          })
      }
}
export function collectExplorationMovementTriggers(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  path: Position[],
) {
  if (a.exploration?.status !== 'active') return
  const final = { x: t.x, y: t.y }
  for (const p of path) {
    Object.assign(t, p)
    collectExplorationTriggers(world, a, s, 'enter', [t.id], t.id)
    const movedSource = world.encounters.some((e) =>
      e.zones?.some(
        (z) =>
          z.spellId === 'spirit-guardians' &&
          e.actors.some(
            (actor) =>
              actor.id === z.sourceId &&
              (actor.id === t.actorId || actor.characterId === t.characterId),
          ),
      ),
    )
    if (movedSource)
      collectExplorationTriggers(
        world,
        a,
        s,
        'enter',
        a.exploration.members.filter((m) => m.tokenId !== t.id).map((m) => m.tokenId),
        t.id,
      )
  }
  Object.assign(t, final)
}
export function jumpPreview(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  t: MapToken,
  to: Position,
  mode: 'normal' | 'magic',
  cat: Catalogue,
  runupConfirmed = false,
) {
  const c = explorationCharacter(world, t),
    stats = explorationStats(world, t, cat),
    m = explorationMember(a, t.id)
  const actor = world.encounters
    .filter((e) => e.phase === 'active')
    .flatMap((e) => e.actors)
    .find((a) => a.id === t.actorId)
  const turn = actor?.turn
  const effects = c
    ? runtimeState(c, cat).effects
    : combatStats(explorationActor(world,t),world.characters,cat).effects
  const magic = effects.some(
    (e) =>
      e.key === 'jump-2024' &&
      (e.endsAt === undefined || e.endsAt > (c ? runtimeState(c, cat).hours : 0)),
  )
  const athlete = c && hasFeat(c.build, 'athlete', cat),
    required = athlete ? 5 : 10
  const trail = m?.trail ?? (turn ? (turn.groundTrail ?? []) : (t.groundTrail ?? []))
  const run = runupConfirmed ? required : runUpDistance(trail, t, s.grid.feet)
  const bonus = effects.some((e) => e.key === 'peerless-athlete') ? 10 : 0
  const doubled = m?.wind || effects.some((e) => e.key === 'wind-jump')
  const capacity = jumpCapacity(stats.strength, run >= required, bonus, !!doubled)
  const max = mode === 'magic' ? 30 : capacity.long
  const feet = Math.max(Math.abs(t.x - to.x), Math.abs(t.y - to.y)) * s.grid.feet,
    cost = mode === 'magic' ? 10 : feet
  const errors: string[] = []
  if ((c && runtimeState(c, cat).death.dead) || stats.conditions.includes('incapacitated'))
    errors.push('死亡或失能时不能自行跳跃')
  if (!feet) errors.push('请选择不同落点')
  if (stats.speed === 0 || stats.conditions.includes('prone'))
    errors.push('当前不能跳跃；倒地时请先起身')
  if (mode === 'magic' && !magic) errors.push('未获得有效跳跃术效果')
  if (mode === 'magic' && (m?.jumpUsed || turn?.manualUsed?.includes('jump-2024')))
    errors.push('本回合已使用跳跃术特殊跳法')
  if (feet > max) errors.push('超过可跳距离')
  if (!occupied({ ...t, ...to }).every((p) => inside(s, p) && !blocked(s, p)))
    errors.push('落点无法占据')
  if (
    s.tokens.some(
      (other) =>
        other.id !== t.id &&
        occupied(other).some((p) =>
          occupied({ ...t, ...to }).some((q) => q.x === p.x && q.y === p.y),
        ),
    )
  )
    errors.push('落点已占用')
  if (movementWalls(s, t, t, to).length) errors.push('路线有墙门阻挡')
  const path = directPath(t, to)
  const crosses = s.regions.filter((r) =>
    path
      .slice(0, -1)
      .some((p) => occupied({ ...t, ...p }).some((q) => r.cells.includes(`${q.x},${q.y}`))),
  )
  if (crosses.some((r) => r.tags.includes('blocked') && !r.jumpable))
    errors.push('跨越的障碍未配置为可跳越')
  if (
    s.points.some(
      (p) =>
        p.kind === 'door' &&
        p.state !== 'open' &&
        path.some((q) => occupied({ ...t, ...q }).some((cell) => cell.x === p.x && cell.y === p.y)),
    )
  )
    errors.push('不能跳过关闭的门')
  const budget = m
    ? stats.speed + m.dash - m.movement
    : turn
      ? stats.speed + turn.dash - turn.movement
      : undefined
  if (budget !== undefined && cost > budget) errors.push('超过剩余移动力')
  return {
    feet,
    high: capacity.high,
    cost,
    max,
    run,
    required,
    magic,
    errors,
    requiresReview:
      runupConfirmed ||
      (!m && !turn) ||
      crosses.some((r) => r.jumpable && r.height !== null) ||
      tagsAt(s, to).includes('difficult') ||
      !!(bonus && doubled) ||
      s.regions.some((r) => r.height !== null && r.cells.includes(`${to.x},${to.y}`)),
    path,
  }
}
export function applyExploration(
  world: MapWorld,
  a: Adventure,
  s: MapScene,
  command: ExplorationCommand,
  cat: Catalogue,
  dice: (n: number) => number = rollDie,
) {
  if (a.activeSceneId !== s.id) throw Error('请先进入当前场景')
  const x = a.exploration
  const eligible = (t: MapToken) =>
    (!!t.characterId && a.party.includes(t.characterId)) ||
    !!t.companionKey ||
    (!!t.npcId &&
      a.ai?.npcs.some(
        (n) => n.id === t.npcId && n.enabled,
      ))
  const roster = (ids?: string[]) => {
    const tokens = ids
      ? s.tokens.filter((t) => ids.includes(t.id))
      : s.tokens.filter((t) => t.characterId && a.party.includes(t.characterId))
    if (
      (ids && (new Set(ids).size !== ids.length || tokens.length !== ids.length)) ||
      !tokens.length ||
      tokens.some((t) => !eligible(t))
    )
      throw Error('名单只能包含当前场景队伍角色、已启用NPC或行侣')
    return tokens
  }
  if (command.operation === 'toggle') {
    if (world.encounters.some((e) => e.phase === 'active')) throw Error('战斗中不能开启探索回合')
    if (!command.enabled) {
      if (x && x.status !== 'closed') x.status = 'paused'
      return '暂停探索回合；预算保留'
    }
    if (x && x.status !== 'closed' && x.sceneId === s.id) {
      x.status = 'active'
      return '恢复探索回合'
    }
    const tokens = roster(command.tokenIds)
    if (!tokens.length) throw Error('没有可加入探索回合的队伍棋子')
    a.exploration = {
      id: crypto.randomUUID(),
      sceneId: s.id,
      status: 'active',
      round: 1,
      roundId: crypto.randomUUID(),
      acted: false,
      members: tokens.map(fresh),
      retired: [],
      clocks: Object.fromEntries(
        world.characters
          .filter((c) => a.party.includes(c.id) || tokens.some((t) => t.characterId === c.id))
          .map((c) => [c.id, runtimeState(c, cat).hours]),
      ),
      triggers: [],
    }
    for (const m of a.exploration.members) effectTiming(world, a, s, m.tokenId, cat, 'start', dice)
    collectExplorationTriggers(
      world,
      a,
      s,
      'start',
      tokens.map((t) => t.id),
    )
    return '开启全队探索回合'
  }
  if (command.operation === 'finish') {
    if(pendingTerrain(a).length)throw Error('请先处理待结算区域事件再收尾探索轮')
    if(x&&x.status!=='closed'){for(const token of s.tokens){terrainPhase(world,a,s,token,'end',cat);summonPhase(world,a,s,token,'end',cat)}if(a.summons?.events?.some(e=>e.status==='pending'))return '请先处理召唤物后果后再收尾';if(pendingTerrain(a).length)return '已登记回合末区域后果，结算后再次收尾'}
    if (x && x.status !== 'closed') {
      collectExplorationTriggers(
        world,
        a,
        s,
        'end',
        x.members.filter((m) => !m.ended).map((m) => m.tokenId),
      )
      if (x.triggers.some((t) => !t.resolved)) return '已登记收尾区域候选，请 GM 裁定后再次收尾'
    }
    finishExploration(world, a, cat, command.close, dice)
    return command.close ? '收尾并封存探索轮' : 'GM 推进探索轮'
  }
  if (command.operation === 'trigger') {
    const trigger = x?.triggers.find((t) => t.id === command.triggerId)
    if (!trigger || trigger.resolved) throw Error('触发已处理或不存在')
    if (!command.note.trim()) throw Error('请记录覆盖、触发、豁免或不触发的裁定')
    trigger.resolved = true
    trigger.note = command.note
    return '记录探索区域裁定'
  }
  if (command.operation === 'zone-roll') {
    const trigger = x?.triggers.find((t) => t.id === command.triggerId && !t.resolved),
      index = world.encounters.findIndex((e) => e.id === trigger?.encounterId),
      e = world.encounters[index]
    if (!trigger || !e || e.phase === 'active' || !command.note.trim())
      throw Error('探索触发候选已变化')
    if (world.encounters.some((e) => e.pending)) throw Error('请先结算上一笔伤害')
    const zone = e.zones?.find((z) => z.id === trigger.sourceId)
    if (!zone) throw Error('区域已结束，请记录不触发裁定')
    const next = applyCombat(
      e,
      world.characters,
      cat,
      {
        type: 'zone-trigger',
        actorId: zone.sourceId,
        targetId: trigger.targetId,
        zoneId: zone.id,
        phase: trigger.phase,
        env: { ...defaultEnvironment(), areaConfirmed: true, note: command.note },
        note: command.note,
      },
      dice,
      { key: trigger.id, targetId: trigger.targetId, phase: trigger.phase },
    )
    world.encounters[index] = next.encounter
    world.characters = next.characters
    for (const token of s.tokens) {
      const actor = next.encounter.actors.find(
        (actor) => actor.id === (token.actorId ?? token.npcSourceActorId),
      )
      if (token.npcBody && actor?.npc) token.npcBody = actor.npc
    }
    trigger.resolved = true
    trigger.note = command.note
    return '区域豁免与伤害骰已生成；请 GM 确认伤害'
  }
  if (command.operation === 'zone-resolve') {
    const index = world.encounters.findIndex((e) => e.id === command.encounterId),
      e = world.encounters[index]
    if (
      !x ||
      e?.phase !== 'ended' ||
      !e.pending ||
      e.pending.mode !== 'zone' ||
      !x.triggers.some((t) => t.encounterId === e.id && t.resolved)
    )
      throw Error('没有可结算的探索区域伤害')
    const next = applyCombat(e, world.characters, cat, {
      type: 'resolve',
      nonlethal: false,
      savage: false,
      stone: false,
      relentless: false,
      pushConfirmed: false,
      healerReroll: false,
      tavernReroll: false,
    })
    world.encounters[index] = next.encounter
    world.characters = next.characters
    for (const token of s.tokens) {
      const actor = next.encounter.actors.find(
        (actor) => actor.id === (token.actorId ?? token.npcSourceActorId),
      )
      if (token.npcBody && actor?.npc) token.npcBody = actor.npc
    }
    x.acted = true
    return '探索区域伤害已确认保存'
  }
  if (command.operation === 'roster') {
    if (!x || x.status === 'closed') throw Error('尚未开启探索回合')
    const tokens = roster(command.tokenIds)
    if (tokens.some((t) => !t) || new Set(command.tokenIds).size !== tokens.length)
      throw Error('探索名单无效')
    const previous = [...x.members, ...x.retired]
    x.members = tokens.map((t) => previous.find((m) => m.tokenId === t!.id) ?? fresh(t!))
    x.retired = previous.filter((m) => !command.tokenIds.includes(m.tokenId))
    for (const m of x.members)
      if (m.characterId && !Object.hasOwn(x.clocks, m.characterId))
        x.clocks[m.characterId] = runtimeState(
          world.characters.find((c) => c.id === m.characterId)!,
          cat,
        ).hours
    const added = x.members.filter((m) => !previous.some((p) => p.tokenId === m.tokenId))
    for (const m of added) effectTiming(world, a, s, m.tokenId, cat, 'start', dice)
    collectExplorationTriggers(
      world,
      a,
      s,
      'start',
      added.map((m) => m.tokenId),
    )
    return 'GM 更新探索名单；已有预算保留'
  }
  const t = s.tokens.find((t) => t.id === command.tokenId)
  if (!t) throw Error('棋子不存在')
  if(a.m3?.events.some(e=>e.status==='pending'&&[t.id,t.characterId,t.actorId,t.npcId].includes(e.entityId))&&!['end','concentration'].includes(command.operation))throw Error('请先处理该人物待结算空间后果')
  if((t.spatial?.layer==='pocket'||t.spatial?.layer==='stone')&&!(command.operation==='spell-cast'&&t.spatial.layer==='stone'&&command.targets.every(id=>id===t.id))&&!['end','concentration','control-ruling'].includes(command.operation))throw Error('此空间中的操作请使用对应空间入口；石内仅可施放自身法术')
  const m = explorationMember(a, t.id),
    c = explorationCharacter(world, t)
  if (
    a.exploration?.status === 'active' &&
    !m &&
    c &&
    a.party.includes(c.id) &&
    command.operation !== 'concentration'
  )
    throw Error('该角色未加入探索名单，请 GM 更新名单或收尾')
  if(command.operation==='control-ruling'){
    if(!command.confirmed||!command.note.trim()||world.encounters.some(e=>e.phase==='active'))throw Error('请GM核对非战斗持续效果')
    const actor=explorationActor(world,t),state=c?runtimeState(c,cat):actor.npc
    if(!state)throw Error('目标没有数据卡')
    if(c)c.runtime=state as ReturnType<typeof runtimeState>
    const f=state.effects.find(f=>f.id===command.effectId),turn=(a.exploration?.id??'outside')+':'+(a.exploration?.round??0)
    if(!f)throw Error('持续效果已改变')
    const remove=()=>{if(c){const current=world.characters.find(v=>v.id===c.id)!;current.runtime=runtimeState(current,cat);current.runtime.effects=current.runtime.effects!.filter(e=>e.id!==f.id)}else actor.npc!.effects=actor.npc!.effects.filter(e=>e.id!==f.id)}
    if(command.kind==='end'){remove();return t.name+'结束'+f.name+'；'+command.note}
    if(command.kind==='wake'){
      if(!['sleep','hypnotic-pattern'].includes(f.key))throw Error('所选法术不能用动作摇醒')
      const waker=s.tokens.find(q=>q.id===command.wakerTokenId),member=waker&&explorationMember(a,waker.id)
      if(!waker||!member||a.exploration?.status!=='active')throw Error('请开启探索回合，并将实际唤醒者加入名单')
      if(distance(s,waker,t)>5||!sightLine(s,waker,t,'blocksTargeting').clear)throw Error('唤醒者须在目标5尺内且可实际接触')
      if(explorationStats(world,waker,cat).conditions.includes('incapacitated'))throw Error('失能者不能执行唤醒动作')
      assertExplorationReady(world,a,member,cat);explorationSpend(member,'action')
      state.effects=state.effects.filter(e=>!['sleep','hypnotic-pattern'].includes(e.key))
      a.exploration.acted=true
      return waker.name+'消耗实际动作唤醒'+t.name+'；'+command.note
    }
    if(command.kind==='fear-context'){
      if(f.key!=='fear')throw Error('所选来源不是恐惧术')
      f.fearContext={contextId:a.exploration?.id??s.id,tick:a.exploration?.round??0,noSafeRoute:!command.inside,sourceVisible:command.sourceVisible,movementResolved:true}
    }else if(command.kind==='command-complete'){
      if(f.key!=='command')throw Error('所选来源不是命令术')
      f.directiveComplete=true;f.speedZero=true;if(m){m.action=false;m.bonus=false}
    }else if(command.kind==='truth-presence'){
      if(f.key!=='zone-of-truth'||!f.control)throw Error('所选来源不是诚实之域')
      const rollNow=command.inside&&!f.control.inside&&f.control.turnKey!==turn&&f.control.result!==false
      f.control.inside=command.inside
      if(rollNow){const roll=savingRoll(actor,'cha',defaultEnvironment(),world.characters,cat,dice);f.control.result=!roll.autoFail&&roll.total>=f.control.dc;f.control.turnKey=turn}
    }else if(command.kind==='crown-no-target'){
      if(f.key!=='crown-of-madness')throw Error('所选来源不是疯狂冠冕')
      f.control={...f.control,dc:f.repeatSave!.dc,targets:[],text:'GM已确认当前触及内无合法近战目标',turnKey:turn,result:true}
    }else if(command.kind==='maintain-crown'){
      if(f.key!=='crown-of-madness')throw Error('所选来源不是疯狂冠冕')
      const source=s.tokens.find(q=>[q.id,q.characterId,q.actorId,q.npcId].includes(f.sourceId)),member=source&&explorationMember(a,source.id)
      if(!member)throw Error('请开启探索回合并把来源加入名单，以实际魔法动作维持')
      assertExplorationReady(world,a,member,cat);explorationSpend(member,'action',true);f.control??={dc:f.repeatSave!.dc,targets:[],text:''};f.control.maintenanceKey=turn
    }else if(command.kind==='illusion-study'){
      if(f.key!=='phantasmal-force'||!f.control||!m)throw Error('请为实际幻象受术者开启探索回合后使用研究动作')
      assertExplorationReady(world,a,m,cat);explorationSpend(m,'action')
      if(c){const result=applyRuntime(c,cat,{type:'check',kind:'skill',id:'investigation',dc:f.control.dc},dice);world.characters[world.characters.indexOf(c)]=result;if(result.runtime!.advanced!.lastCheck!.total>=f.control.dc)remove()}
      else if(dice(20)+(actor.npc!.templateMetadata?.skills.investigation??combatStats(actor,world.characters,cat).mods.int)>=f.control.dc)remove()
    }else if(command.kind==='end-damage'){
      if(!f.endDamage)throw Error('所选来源没有待结算的一次回合末伤害')
      const raw=rollDamage(f.endDamage.dice,dice),amount=adjustDamage(raw.total,f.endDamage.damageType,defenses(actor,world.characters,cat))
      if(c&&amount>0)world.characters[world.characters.indexOf(c)]=applyRuntime(c,cat,{type:'damage',amount,damageType:f.endDamage.damageType,note:'GM确认目标实际下一回合末：'+f.name},dice)
      else if(!c){const n=actor.npc!,absorbed=Math.min(n.temporaryHp,amount);n.temporaryHp-=absorbed;n.hp=Math.max(0,n.hp-(amount-absorbed));npcControlDamage(actor,world,cat,dice,amount)}
      remove()
    }else if(command.kind==='illusion-damage'){
      if(f.key!=='phantasmal-force'||!f.control)throw Error('所选来源不是幻象之力')
      const source=s.tokens.find(q=>[q.id,q.characterId,q.actorId,q.npcId].includes(f.sourceId)),member=source&&explorationMember(a,source.id)
      if(!member||member.ended||f.control.turnKey===turn)throw Error('须开启探索回合；仅来源尚未结束的回合可处理一次幻象伤害')
      f.control.turnKey=turn
      const value=reduceEnfeebled(rollDamage('2d8',dice),combatStats(explorationActor(world,source!),world.characters,cat).effects,dice),amount=adjustDamage(value.total,'psychic',defenses(actor,world.characters,cat))
      if(c&&amount>0)world.characters[world.characters.indexOf(c)]=applyRuntime(c,cat,{type:'damage',amount,damageType:'psychic',note:'幻象之力：'+command.note},dice)
      else if(!c){const n=actor.npc!,absorbed=Math.min(n.temporaryHp,amount);n.temporaryHp-=absorbed;n.hp=Math.max(0,n.hp-(amount-absorbed));npcControlDamage(actor,world,cat,dice,amount)}
    }
    if(a.exploration)a.exploration.acted=true
    return t.name+'完成持续效果核对；'+command.note
  }
  if (command.operation === 'zone-move') {
    if (!c || !command.confirmed || world.encounters.some((e) => e.phase === 'active'))
      throw Error('请由 GM 核对非战斗持续区域移动')
    if (explorationStats(world, t, cat).conditions.includes('incapacitated'))
      throw Error('失能时不能执行魔法动作')
    const e = world.encounters.find(
        (e) => e.session?.sceneId === s.id && e.zones?.some((z) => z.id === command.zoneId),
      ),
      z = e?.zones?.find((z) => z.id === command.zoneId),
      source = e?.actors.find((actor) => actor.id === z?.sourceId)
    if (
      !z ||
      source?.characterId !== c.id ||
      z.spellId !== 'cloud-of-daggers' ||
      !zoneAlive(z, c) ||
      !z.template
    )
      throw Error('没有可移动的实际匕首之云区域')
    if (
      z.template.shape !== 'cube' ||
      z.template.size !== 5 ||
      z.template.originRule !== 'center' ||
      !inside(s, command.to)
    )
      throw Error('请使用当前场景五尺中心立方区域')
    const from = z.template.origin ?? { x: z.template.x + 0.5, y: z.template.y + 0.5 },
      to = { x: command.to.x + 0.5, y: command.to.y + 0.5 },
      feet = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) * s.grid.feet
    if (feet > 30) throw Error('匕首之云移动不能超过三十尺')
    if (m) {
      assertExplorationReady(world, a, m, cat)
      explorationSpend(m, 'action', true)
      m.trail = []
      a.exploration!.acted = true
    }
    z.template = { ...z.template, ...command.to, origin: to }
    z.note += '；探索移动：' + command.note
    collectExplorationTriggers(
      world,
      a,
      s,
      'enter',
      s.tokens.map((q) => q.id),
      t.id,
    )
    return `${t.name}以魔法动作移动匕首之云 ${feet} 尺；${command.note}`
  }
  if (command.operation === 'concentration') {
    if (world.encounters.some((e) => e.phase === 'active'))
      throw Error('请使用当前角色的非战斗专注入口')
    if(!c){
      const actor=explorationActor(world,t),state=actor.npc,dc=state?.concentration?.pendingDC
      if(!state||!dc)throw Error('没有待定NPC专注豁免')
      const result=savingRoll(actor,'con',defaultEnvironment(),world.characters,cat,dice,'concentration'),success=!result.autoFail&&result.total>=dc
      if(success)delete state.concentration!.pendingDC;else delete state.concentration
      return t.name+'完成NPC专注豁免：'+result.total+'；'+(success?'维持专注':'专注结束')
    }
    const dc = runtimeState(c, cat).concentration?.pendingDC
    if (!dc) throw Error('没有待定专注豁免')
    const checked = applyRuntime(
        c,
        cat,
        {
          type: 'check',
          kind: 'save',
          id: 'con',
          context: { purpose: 'concentration' },
          dc,
        },
        dice,
      ),
      roll = checked.runtime!.advanced!.lastCheck!
    world.characters[world.characters.indexOf(c)] = applyRuntime(checked, cat, {
      type: 'concentration-result',
      success: !roll.autoFail && roll.total >= dc,
    })
    return `${t.name}完成专注豁免：${roll.total}；${!roll.autoFail && roll.total >= dc ? '维持专注' : '专注结束'}`
  }
  if (command.operation === 'end') {
    if (!m || command.roundId !== x?.roundId) throw Error('探索轮已变化，请刷新')
    assertExplorationReady(world, a, m, cat, true)
    if (c) {
      const r = runtimeState(c, cat)
      if (!r.hp && !r.death.stable && !r.death.dead && !m.deathSaved)
        throw Error('请先完成死亡豁免')
    }
    if(summonPhase(world,a,s,t,'end',cat))return '已登记回合末召唤物反应／后果，请处理后再次结束'
    terrainPhase(world,a,s,t,'end',cat)
    if(pendingTerrain(a,terrainEntityId(t)).length)return '已登记回合末区域后果，结算后再次结束'
    collectExplorationTriggers(world, a, s, 'end', [t.id])
    if (x!.triggers.some((t) => !t.resolved && t.tokenId === m.tokenId))
      return '已登记回合末区域触发；请 GM 裁定后再次结束'
    const timing = m.endProcessed ? '' : effectTiming(world, a, s, t.id, cat, 'end', dice)
    m.endProcessed = true
    endM3Blink(world,a,s,t,x!.roundId,dice)
    m.ended = true
    if (x!.members.every((m) => m.ended)) finishExploration(world, a, cat, false, dice)
    return `${t.name}结束探索回合${timing}`
  }
  if (command.operation === 'spell-cast') {
    if (!c || !command.confirmed || world.encounters.some((e) => e.phase === 'active'))
      throw Error('请提交 GM 审核非战斗施法')
    const g = runtimeSpells(c, cat).find((g) => g.key === command.key),
      targets = command.targets.map((id) => s.tokens.find((t) => t.id === id))
    if (!g || targets.some((t) => !t) || new Set(command.targets).size !== command.targets.length)
      throw Error('法术或目标已失效')
    if(command.dispelZoneId){
      const encounter=world.encounters.find(e=>(e.session?.sceneId===s.id||e.id===s.encounterId)&&e.zones?.some(z=>z.id===command.dispelZoneId))
      const zone=encounter?.zones?.find(z=>z.id===command.dispelZoneId),source=encounter?.actors.find(v=>v.id===zone?.sourceId)
      const owner=world.characters.find(v=>v.id===(source?.characterId??zone?.sourceId))
      if(g.spell.id!=='dispel-magic'||targets.length!==1||targets[0]!.id!==t.id||!zone||!zoneAlive(zone,owner))throw Error('请选择本场景仍有效的实际魔法区域与解除魔法来源')
      if(!Number.isFinite(command.dispelDistance)||command.dispelDistance!<0||command.dispelDistance!>120||!command.note.trim())throw Error('请GM确认区域内目标点在120尺内、无完全遮挡及实际依据')
    }else if(command.dispelDistance!==undefined)throw Error('区域距离必须关联实际魔法区域')
    if(M4_EXCLUSIVE_SCENE_SPELLS.includes(g.spell.id as typeof M4_EXCLUSIVE_SCENE_SPELLS[number]))throw Error('此法术须使用持续场景效果入口登记实际区域／光源');
    if(M1_UTILITY_SPELLS.includes(g.spell.id))throw Error('此法术请由GM使用“M1遗体、物件与光环结算”专用入口')
    if (command.template) {
      const spec = spellAreaSpec(g.spell)
      validateSpellArea(s, t, command.template, spec)
      for (const target of targets.filter(
        (target) => !['moonbeam', 'spirit-guardians', 'cordon-of-arrows'].includes(g.spell.id),
      ))
        areaEnvironment(
          s,
          t,
          target!,
          defaultEnvironment(),
          {
            distance: true,
            highGround: true,
            area: true,
            template: command.template,
            reason: '',
          },
          spec,
        )
    }
    validateGWorld(world,a,cat,g.spell.id,c.id,command.targets,command.gmChoice??{})
    validateM3Choice(g.spell.id,command.m3Choice)
    validateSupportSpell(g.spell.id, command)
    validateControlSelection(g.spell.id,command,command.targets)
    validateControlTargets(g.spell.id,(targets as MapToken[]).map(t=>explorationActor(world,t)),world.characters)
    const profile = spellEffect(
      g.spell.id,
      g.item?.casterLevel ?? c.level,
      castSlotLevel(command.mode) || g.spell.level || 1,
    )
    if (profile.dice && ['attack', 'save'].includes(profile.kind))
      throw Error('伤害型敌对施法请先提交战斗请求并按先攻执行')
    if (targets.length > (profile.count ?? (profile.area ? 100 : 1)))
      throw Error('法术目标数量超过当前施放方式')
    if (!targets.length) throw Error('请选择至少一个实际受术者')
    if (g.spell.range.startsWith('Self') && !['color-spray','fear','pass-without-trace'].includes(g.spell.id) && targets.some((target) => target!.characterId !== c.id))
      throw Error('自身法术只能以施法者为目标')
    if(g.spell.id==='fear'&&targets.some(target=>distance(s,t,target!)>30))throw Error('恐惧术须在实际30尺锥形内')
    if(g.spell.id==='color-spray'&&targets.some(target=>distance(s,t,target!)>15))
      throw Error('七彩喷射目标须在施法者15尺锥形内，方向由GM核对')
    const range = /\d+/.test(g.spell.range)
      ? Number(g.spell.range.match(/\d+/)?.[0])
      : g.spell.range === 'Touch'
        ? 5
        : g.spell.range.startsWith('Self')
          ? 0
          : 10000
    if (!profile.area && targets.some((target) => distance(s, t, target!) > spellRangeFeet(g.spell.id,g.spell.range,c.level,range)))
      throw Error('法术目标超出施放距离')
    if (targets.some((target) => !sightLine(s, t, target!, 'blocksTargeting').clear))
      throw Error('法术目标之间存在实体阻挡')
    if (['hold-person', 'blindness-deafness'].includes(g.spell.id)) {
      if (
        explorationStats(world, t, cat).conditions.includes('blinded') ||
        targets.some(
          (target) =>
            !sightLine(s, t, target!).clear ||
            explorationStats(world, target!, cat).conditions.includes('invisible'),
        )
      )
        throw Error('此法术需要施法者实际可见的目标')
      if (
        g.spell.id === 'hold-person' &&
        targets.some((target) => {
          return actorCreatureType(explorationActor(world,target!),world.characters,true)!=='humanoid'
        })
      )
        throw Error('定身类人需要已登记的类人生物目标')
    }
    const cmd: RuntimeCommand = {
      type: 'cast',
      key: command.key,
      mode: command.mode,
      requirementsConfirmed: true,
      hitDice: command.hitDice,
      deferEffects: !targets.some((t) => t!.characterId === c.id),
    }
    const next = applyRuntime(c, cat, cmd, dice)
    explorationRuntime(world, a, c.id, cmd, cat)
    world.characters[world.characters.indexOf(c)] = next
    if(itemCastFailed(next,command.key))return t.name+'卷轴施法检定失败，卷轴和行动已消耗，没有法术效果'
    if(runtimeState(c,cat).effects.some(f=>f.key==='slow')&&/(^|[,\s])S([,\s(]|$)/.test(g.spell.components)){const failure=rollDamage('1d4',dice).total===1;if(failure){if(g.spell.concentration)next.runtime!.concentration=null;return t.name+'受缓慢术影响，姿势成分施法失败；动作与已付资源保留消耗'}}
    // Compelled Duel ends on actual casting, including non-damaging harmful spells.
    const casterActor=explorationActor(world,t),harmful=g.spell.id!=='calm-emotions'&&['attack','save','automatic'].includes(profile.kind)&&!!(profile.dice||profile.effect)
    for(const victim of s.tokens){
      const victimActor=explorationActor(world,victim),character=world.characters.find(v=>v.id===victim.characterId),state=character?.runtime??victimActor.npc
      if(!state)continue
      state.effects=(state.effects??[]).filter(f=>{
        if(f.key!=='compelled-duel')return true
        const sourceToken=s.tokens.find(q=>[q.id,q.actorId,q.npcId,q.characterId].includes(f.sourceId))
        if(!sourceToken)return true
        const source=explorationActor(world,sourceToken),own=sourceToken.id===t.id
        return !((own&&(targets as MapToken[]).some(q=>q.id!==victim.id&&explorationActor(world,q).side!==casterActor.side&&explorationActor(world,q).side!=='neutral'))||(!own&&harmful&&source.side!=='neutral'&&source.side===casterActor.side&&command.targets.includes(victim.id)))
      })
    }
    const gmRequest = createGmSpellRequest(world, a, cat, {
      spell: g.spell, characterId: c.id, sceneId: s.id, targetIds: command.targets, choice:command.gmChoice??{},
      slotLevel: castSlotLevel(command.mode), question: command.note,
    })
    if (gmRequest) return `${t.name}施放${g.spell.name}；资源已登记，结果进入GM法术裁定`
    const supportResult = explorationSupportSpell(
      world,
      a,
      targets as MapToken[],
      c.id,
      g.spell,
      command,
      cat,
      castSlotLevel(command.mode),
      (g.item?.abilityModifier ?? runtimeDerived(next,cat).mods[g.ability]),
      dice,g.item?.dc,
    )
    if(supportResult&&g.spell.id==='expeditious-retreat'){const budget=explorationMember(a,t.id);if(budget)budget.dash+=explorationStats(world,t,cat).speed}
    if (supportResult) return t.name + '施放' + g.spell.name + '；' + supportResult + '；资源已登记'
    const healingResult = explorationHealingSpell(world,a,targets as MapToken[],c.id,g.spell,castSlotLevel(command.mode),(g.item?.abilityModifier ?? runtimeDerived(next,cat).mods[g.ability]),cat,dice)
    if(healingResult)return t.name+'施放'+g.spell.name+'；'+healingResult+'；资源已登记'
    if(g.spell.id==='goodberry')return t.name+'施放神莓术；10颗神莓已放入背包，24小时后消失'
    const socialResult = explorationSocialSpell(
      world,
      a,
      targets as MapToken[],
      c.id,
      g.spell,
      g.ability,
      cat,
      dice,
      command.supportChoice,
      castSlotLevel(command.mode),command,g.item?.dc,
    )
    if(g.spell.id==='zone-of-truth'&&command.template){const caster=world.characters.find(v=>v.id===c.id)!;caster.runtime=runtimeState(caster,cat);const castId=(targets as MapToken[]).flatMap(token=>{const char=world.characters.find(v=>v.id===token.characterId);return char?.runtime?.effects??explorationActor(world,token).npc?.effects??[]}).find(f=>f.key==='zone-of-truth'&&f.sourceId===c.id)?.castId;if(castId)caster.runtime.effects!.push({id:crypto.randomUUID(),key:'zone-of-truth-source',spellId:g.spell.id,spellLevel:castSlotLevel(command.mode),castId,name:g.spell.name,sourceId:c.id,page:g.spell.source.page,concentration:false,expiresAt:null,encounterId:'outside',phase:'start',clockSourceId:c.id,endsAt:caster.runtime.hours!+1/6,visibility:'owner',control:{dc:g.item?.dc??8+Math.ceil(c.level/4)+1+runtimeDerived(c,cat).mods[g.ability],targets:[],text:'诚实之域来源',region:{sceneId:s.id,template:command.template}},note:'来源私有豁免记录'})}
    if(g.spell.id==='fear')for(const token of targets as MapToken[]){const state=combatStats(explorationActor(world,token),world.characters,cat);if(state.effects.some(f=>f.key==='fear'&&f.sourceId===c.id)&&token.characterId)dropFearHeldItems(world,s,token.characterId,cat)}
    if (socialResult) return `${t.name}施放${g.spell.name}；${socialResult}；资源已登记`
    return `${t.name}向${targets.map((t) => t!.name).join('、')}施放${g.spell.name}；${command.note}；资源已登记，未自动化的目标效果由 GM 裁定`
  }
  if (command.operation === 'jump-cast') {
    if (world.encounters.some((e) => e.phase === 'active')) throw Error('战斗中请使用战斗施法入口')
    if (!c || !command.confirmed) throw Error('请由 GM 确认跳跃术目标与施法要求')
    const g = runtimeSpells(c, cat).find((g) => g.key === command.key)
    if (g?.spell.id !== 'jump') throw Error('请选择实际跳跃术来源')
    const targets = [...new Set(command.targets)]
    if (targets.length > Math.max(1, castSlotLevel(command.mode)))
      throw Error('跳跃术目标数量超过施放环级')
    const targetCharacters = targets.map((id) => world.characters.find((c) => c.id === id))
    if (
      targetCharacters.some((c) => !c) ||
      targets.some(
        (id) =>
          !s.tokens.some(
            (q) =>
              q.characterId === id &&
              distance(s, t, q) <= 5 &&
              sightLine(s, t, q, 'blocksTargeting').clear,
          ),
      )
    )
      throw Error('跳跃术需要五尺内的自愿目标角色')
    const cmd: RuntimeCommand = {
      type: 'cast',
      key: command.key,
      mode: command.mode,
      requirementsConfirmed: true,
    }
    const next = applyRuntime(c, cat, cmd)
    explorationRuntime(world, a, c.id, cmd, cat)
    world.characters[world.characters.indexOf(c)] = next
    for (const id of targets) {
      const target = world.characters.find((c) => c.id === id)!,
        r = runtimeState(target, cat)
      r.effects = r.effects.filter((e) => e.key !== 'jump-2024')
      r.effects.push({
        id: crypto.randomUUID(),
        key: 'jump-2024',
        name: '跳跃术',
        sourceId: c.id,
        page: 0,
        concentration: false,
        expiresAt: null,
        encounterId: 'outside',
        phase: 'start',
        endsAt: r.hours + 1 / 60,
        note: '实际自愿目标；每回合一次，10 尺移动换至多 30 尺跳跃',
      })
      target.runtime = r
    }
    return `${t.name}施放跳跃术；实际目标与期限已登记`
  }
  if (command.operation === 'jump') {
    if (m) assertExplorationReady(world, a, m, cat)
    const preview = jumpPreview(world, a, s, t, command.to, command.mode, cat, !!command.runup)
    if (preview.errors.length) throw Error(preview.errors.join('；'))
    if (preview.requiresReview && !command.confirmed)
      throw Error('此跳跃需要 GM 核对障碍高度或困难地形落地检定')
    const index = world.encounters.findIndex((e) => e.phase === 'active'),
      battle = world.encounters[index]
    if (battle) {
      const actor = battle.actors.find((actor) => actor.id === t.actorId)
      if (!actor || (battle.session?.sceneId && battle.session.sceneId !== s.id))
        throw Error('棋子未加入当前战斗')
      const opportunity = battle.actors.some(
        (other) =>
          other.side !== actor.side &&
          other.side !== 'neutral' &&
          other.turn.reaction &&
          !combatStats(other, world.characters, cat).conditions.includes('incapacitated') &&
          s.tokens.some(
            (enemy) =>
              enemy.actorId === other.id &&
              [t, ...preview.path].slice(0, -1).some(
                (p, i) =>
                  distance(s, { ...t, ...p }, enemy) <=
                    Math.max(
                      5,
                      ...attackOptions(other, world.characters, cat)
                        .filter((a) => !a.ranged)
                        .map((a) => a.reach),
                    ) &&
                  distance(s, { ...t, ...(preview.path[i] ?? command.to) }, enemy) >
                    Math.max(
                      5,
                      ...attackOptions(other, world.characters, cat)
                        .filter((a) => !a.ranged)
                        .map((a) => a.reach),
                    ),
              ),
          ),
      )
      if (
        opportunity &&
        !command.confirmed &&
        !combatStats(actor, world.characters, cat).effects.some((e) => e.key === 'disengage')
      )
        throw Error('此跳跃可能触发借机攻击，请先提交 GM 处理')
      const next = applyCombat(battle, world.characters, cat, {
        type: 'move',
        actorId: actor.id,
        distance: preview.cost,
        difficult: false,
        stand: false,
        note: '地图跳跃；' + command.note,
      })
      const moved = next.encounter.actors.find((a) => a.id === actor.id)!
      moved.turn.groundTrail = []
      if (command.mode === 'magic')
        moved.turn.manualUsed = [...(moved.turn.manualUsed ?? []), 'jump-2024']
      world.encounters[index] = next.encounter
      world.characters = next.characters
    }
    if (m) {
      m.movement += preview.cost
      m.trail = []
      if (command.mode === 'magic') m.jumpUsed = true
      a.exploration!.acted = true
    }
    const movementEffects=combatStats(explorationActor(world,t),world.characters,cat).effects
    assertDuelRoute(world,s,t,[command.to],movementEffects)
    if(explorationStats(world,t,cat).conditions.includes('frightened'))assertFrightenedRoute(world,s,t,[command.to],movementEffects)
    Object.assign(t, command.to)
    queueTerrain(world,a,s,t,'enter',crypto.randomUUID())
    refreshTruthZones(world,a,s,t,[t],cat,dice)
    t.groundTrail = []
    collectExplorationMovementTriggers(world, a, s, t, preview.path)
    return `${t.name}跳跃 ${preview.feet} 尺，消耗 ${preview.cost} 尺移动${command.note ? '；' + command.note : ''}`
  }
  if (!m) throw Error('请先开启探索回合并加入该角色')
  assertExplorationReady(world, a, m, cat)
  const stats = explorationStats(world, t, cat),
    action = command.action
  if (stats.conditions.includes('incapacitated')) throw Error('失能时不能执行动作或反应')
  if (
    ['hide', 'help', 'ready', 'reaction', 'cunning-hide', 'search', 'study', 'influence'].includes(
      action,
    ) &&
    (!command.confirmed || !command.note.trim())
  )
    throw Error('请提交 GM 核对检定、触发与条件说明')
  if (action === 'surge') {
    if (!c || c.build.classId !== 'fighter' || c.level < 2 || m.surgeUsed)
      throw Error('本回合无法使用动作如潮')
    const next = applyRuntime(
      c,
      cat,
      { type: 'resource', id: 'action-surge', amount: 1, note: '探索回合动作如潮' },
      dice,
    )
    world.characters[world.characters.indexOf(c)] = next
    m.surgeUsed = true
    m.surgeAction = true
    m.trail = []
  } else if (action === 'stand') {
    if (!c || !stats.conditions.includes('prone') || !stats.speed) throw Error('当前无法起身')
    const cost = hasFeat(c.build, 'athlete', cat) ? 5 : Math.floor(stats.speed / 2)
    if (m.movement + cost > stats.speed + m.dash) throw Error('剩余移动不足以起身')
    world.characters[world.characters.indexOf(c)] = applyRuntime(c, cat, {
      type: 'condition',
      id: 'prone',
      active: false,
    })
    const standing = world.characters.find((q) => q.id === c.id)!.runtime!
    standing.effects = standing.effects?.filter((e) => e.condition !== 'prone')
    m.movement += cost
    m.trail = []
  } else {
    if (action.startsWith('wind') && (!c || c.build.classId !== 'monk' || c.level < 2))
      throw Error('尚未获得疾步')
    if (action.startsWith('cunning-') && (!c || c.build.classId !== 'rogue' || c.level < 2))
      throw Error('尚未获得灵巧动作')
    const cost =
      action === 'reaction'
        ? 'reaction'
        : action.startsWith('wind') || action.startsWith('cunning-')
          ? 'bonus'
          : 'action'
    if (action === 'wind-focus') {
      const next = applyRuntime(c!, cat, {
        type: 'resource',
        id: 'focus',
        amount: 1,
        note: '疾步增强',
      })
      explorationSpend(m, cost,false,action)
      world.characters[world.characters.indexOf(c!)] = next
      m.wind = true
      m.flags.push('disengage')
    } else explorationSpend(m, cost,false,action)
    if (['dash', 'wind', 'wind-focus', 'cunning-dash'].includes(action)) m.dash += stats.speed
    if(action==='dash')m.flags.push('fear-dash')
    if (action === 'disengage' || action === 'cunning-disengage') m.flags.push('disengage')
    if (action === 'dodge') {
      m.flags.push('dodge')
      if (c) {
        const r = runtimeState(c, cat)
        r.effects = r.effects.filter((e) => e.key !== 'dodge')
        r.effects.push({
          id: crypto.randomUUID(),
          key: 'dodge',
          name: '闪避（探索轮）',
          sourceId: c.id,
          page: 0,
          concentration: false,
          expiresAt: null,
          encounterId: 'outside',
          phase: 'start',
          endsAt: r.hours + 1 / 600,
          note: '速度为零或失能时失效；至下一轮开始',
        })
        c.runtime = r
      }
    }
    m.trail = []
  }
  a.exploration!.acted = true
  return `${t.name}探索行动：${action}${command.note ? '；' + command.note : ''}`
}
