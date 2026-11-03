import {validateInventory} from './runtime'
import {itemCastFailed,spellUsesSlot} from './item-spells'
import {spellWorkflowPolicy} from './spell-workflow-policies'
import {isM5Appendix,iceBurstPending,lightningReplacement} from './m5a-spells'
import {prepareHitSpell,hitSpellCritical,hitSpellMinimum,attachHitSpellDamage,resumeHitSpell,isM5HitSpell,assertHitSpellLink} from './spell-attack-windows'
import {validateEnchantment,actualWeapon,replaceNpcWeaponModifier} from './spell-weapon-riders'
import {isM5Spell,isM5WorldSpell} from './m5-spell-rules'
import {M4_EXCLUSIVE_SCENE_SPELLS} from './scene-effects'
import {M3_EXCLUSIVE_WORLD_SPELLS} from './m3-world-cast'
import { rememberEndedHaste } from './m3-lifecycle'
import { M3_NATIVE_SPELLS, m3SpellEffect, validateM3Choice, validateM3Willing } from './m3-spells'
import { withInventoryClocks } from './inventory-clock'
import {protectionBlocks,protectionSaveAdvantage} from './protection-evil'
import {spellRangeFeet} from './spell-range'
import {socialControlEffect,validateControlSelection,charmEffective} from './m2-social-controls'
import {m2ControlEffect,slowed,enfeebled,reduceEnfeebled} from './m2-control'
import {concentrationMatches} from './spell-source-state'
import {M1_UTILITY_SPELLS} from './m1-utility'
import { resolutionAbilities } from './combat-resolution-options'
import { createGoodberries } from './spell-consumables'
import { dispelSpellEffects,endDispelledZoneSource } from './spell-dispelling'
import { humanoidPlayerSpecies,actorCreatureType,controlAutoSave,validateControlTargets } from './control-spells'
import { applyOriginParty, checkedOriginDie, hasOrigin, consumeMedicalKit } from './origins'
import {
  abilityAvailable,
  consumeNpcAbility,
  refreshNpcRecharge,
  restoreNpcResources,
} from './npc-abilities'
import { automaticDamageItem } from './combat-items'
import { annotateDamageRoll, manualDiceActive, prepareDice } from './dice-source'
import { beast, beastNpc } from './beasts'
import { martialArtsEligible } from './weapon-rules'
import { attackMethods } from './attack-methods'
import { reconcileGrapples } from './grapples'
import { previewWeaponHandling, validateHandling } from './weapon-handling'
import {
  TWINNABLE,
  knownMetamagic,
  validateMetamagic,
  metamagicCost,
  METAMAGIC_NAMES,
} from './metamagic'
import { manualFeatures } from './manual-growth'
import { wildMagic } from './wild-magic'
import { reconcileEncounter } from './combat-lifecycle'
import { isZoneSpell, zoneAlive, zoneDamage } from './ongoing-spells'
import { sourceCaption } from './rule-sources'
import { advancedCombat } from './advanced-combat'
import { hasFeat } from './advanced-rules'
import { HIT_TRIGGER_SPELLS } from './phb-spell-rules'
import { primalCompanion, spellSummon } from './phb-companions'
import { restorationBuff, hpSpellBonus, healingRollTotal } from './spell-restoration'
import { connectWardingBond } from './warding-bond'
import { hasInvocation, hasStyle, pbOf, hasSubclass } from './growth-rules'
import { clone, one, featIds, weaponProficient, type Catalogue } from './engine'
import { ABILITIES, type Ability, type ActiveEffect, type Character } from './types'
import {
  applyRuntime,
  castSlotLevel,
  runtimeState,
  runtimeDerived,
  runtimeSpells,
  resources,
  rollDie,
  findItem,
  checkDetail,
  type RuntimeCommand,
} from './runtime'
import {
  equipmentLayout,
  equippedInventory,
  assignedSlot,
  handSlot,
  gripOf,
  freeHandSlots,
} from './equipment'
import { appliedEffects } from './effects'
import {
  validateSupportSpell,
  restoreCondition,
  resistanceReduction,
  guidanceBonus,
} from './support-spells'
import { CONDITIONS } from '../content/conditions'
import type {
  AttackSpec,
  CombatCommand,
  Combatant,
  CombatSnapshot,
  DamagePart,
  DamageReroll,
  Encounter,
  Environment,
  PendingTarget,
  PendingAction,
} from './combat-types'
import { DAMAGE_TYPES, DEFENSE_NAMES } from './combat-types'
import {
  adjustDamage,
  attackOptions,
  attackRoll,
  senseBypassesImages,
  checkedDie,
  combatCharacter,
  combatStats,
  d20,
  defaultEnvironment,
  defenses,
  freshTurn,
  rollDamage,
  savingRoll as baseSavingRoll,
  spellEffect,
} from './combat-rules'

export const newEncounter = (name = '新的遭遇'): Encounter => ({
  id: crypto.randomUUID(),
  name: name.trim() || '新的遭遇',
  version: 1,
  phase: 'setup',
  round: 0,
  tick: 0,
  current: 0,
  actors: [],
  pending: null,
  zones: [],
  slotSpent: [],
  lastDamage: null,
  log: [],
})
export function nextTurnTick(e: Encounter, actorId: string) {
  const index = e.actors.findIndex((a) => a.id === actorId)
  return e.tick + ((index - e.current + e.actors.length) % e.actors.length || e.actors.length)
}
function insertSummonedInitiative(
  e: Encounter,
  oldIds: string[],
  currentId: string,
  cs: Character[],
) {
  e.actors.sort((a, b) => b.initiative! - a.initiative!)
  const paired = e.actors.filter(
      (a) => a.companion && ['spell-summon', 'primal-companion'].includes(a.companion.source)&&!['find-familiar','animate-dead'].includes(a.companion.spellId??'')&&e.actors.some(owner=>owner.id===a.companion!.ownerId),
    ),
    normal = e.actors.filter((a) => !paired.includes(a))
  e.actors = normal.flatMap((a) => [a, ...paired.filter((p) => p.companion!.ownerId === a.id)])
  e.current = e.actors.findIndex((a) => a.id === currentId)
  rebaseTurnExpiries(e, oldIds, currentId, cs)
}
export function rebaseTurnExpiries(
  e: Encounter,
  oldIds: string[],
  currentId: string,
  cs: Character[],
) {
  const oldCurrent = oldIds.indexOf(currentId),
    oldCount = oldIds.length
  if (!oldCount) return
  for (const a of e.actors) {
    const list = cs.find((c) => c.id === a.characterId)?.runtime?.effects ?? a.npc?.effects ?? []
    for (const effect of list)
      if (effect.encounterId === e.id && effect.expiresAt !== null && effect.expiresAt > e.tick) {
        const remaining = effect.expiresAt - e.tick,
          rounds = Math.floor((remaining - 1) / oldCount)
        const destination = oldIds[(oldCurrent + remaining) % oldCount]!,
          index = e.actors.findIndex((a) => a.id === destination)
        const offset = (index - e.current + e.actors.length) % e.actors.length || e.actors.length
        effect.expiresAt = e.tick + rounds * e.actors.length + offset
      }
  }
}
const integer = (n: number, min = 0, max = 100000) => {
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`请输入 ${min} 至 ${max} 的整数`)
  return n
}
const reason = (s: string) => {
  if (!s.trim() || s.length > 2000) throw new Error('请填写 GM 裁定或操作原因（最多 2000 字）')
  return s.trim()
}
export function validateEncounter(e: Encounter, cs: Character[], cat: Catalogue) {
  if (e.actors.length > 100) throw new Error('单个遭遇最多包含 100 名参与者')
  if (
    new Set(e.actors.map((a) => a.id)).size !== e.actors.length ||
    new Set(e.actors.filter((a) => a.characterId).map((a) => a.characterId)).size !==
      e.actors.filter((a) => a.characterId).length
  )
    throw new Error('遭遇参与者重复')
  if (
    e.phase === 'active' &&
    (!e.actors.length ||
      e.current >= e.actors.length ||
      e.actors.some((a) => a.initiative === null))
  )
    throw new Error('遭遇回合数据不完整')
  for (const a of e.actors) {
    if ((combatCharacter(a, cs)?.runtime?.effects ?? a.npc?.effects ?? []).length > 100)
      throw new Error('单名参与者最多保留 100 个来源效果，请先处理旧效果')
    if (!!a.characterId === !!a.npc) throw new Error('参与者必须且只能引用角色或 NPC')
    if (a.characterId) {
      const c = combatCharacter(a, cs)!
      if (c.status !== 'complete') throw new Error('遭遇只能引用已完成角色')
    } else {
      const n = a.npc!
      integer(n.ac, 0, 100)
      integer(n.maxHp, 1)
      integer(n.hp, 0, n.maxHp + hpSpellBonus(n.effects))
      integer(n.temporaryHp)
      integer(n.speed, 0, 300)
      for (const x of ABILITIES) {
        integer(n.scores[x], 1, 30)
        integer(n.saves[x], -30, 50)
      }
      if (!n.name.trim()) throw new Error('请填写 NPC 名称')
      if (new Set(n.attacks.map((a) => a.id)).size !== n.attacks.length)
        throw new Error('NPC 攻击 ID 重复')
      if (
        n.multiattack &&
        (n.multiattack.length < 1 ||
          n.multiattack.length > 8 ||
          n.multiattack.some((id) => !n.attacks.some((a) => a.id === id)))
      )
        throw new Error('多重攻击须引用数据卡中的1–8次攻击')
      if (n.multiattackChoice) {
        integer(n.multiattackChoice.count, 1, 8)
        if (
          n.multiattack ||
          !n.multiattackChoice.attackIds.length ||
          new Set(n.multiattackChoice.attackIds).size !== n.multiattackChoice.attackIds.length ||
          n.multiattackChoice.attackIds.some((id) => !n.attacks.some((a) => a.id === id))
        )
          throw Error('任选多重攻击配置无效')
      }
      if (
        [...n.resistances, ...n.immunities, ...n.vulnerabilities].some(
          (t) => !DAMAGE_TYPES.includes(t),
        )
      )
        throw new Error('未知伤害类型')
      if (
        [...n.conditions, ...n.conditionImmunities].some((x) => !CONDITIONS.some((c) => c.id === x))
      )
        throw new Error('未知 NPC 状态')
      for (const w of n.attacks) {
        integer(w.bonus, -30, 50)
        integer(w.reach, 0, 300)
        integer(w.range, 0, 2000)
        integer(w.longRange, w.range, 2000)
        rollDamage(w.damage, () => 1)
        for (const part of w.extraDamage ?? []) {
          if (!DAMAGE_TYPES.includes(part.type)) throw new Error('未知额外伤害类型')
          rollDamage(part.formula, () => 1)
        }
      }
    }
    if (
      a.companion &&
      !e.actors.some((owner) => owner.id === a.companion!.ownerId && (owner.characterId||a.companion!.worldManaged&&owner.npc))&&!(a.companion.worldManaged&&a.companion.instanceId&&a.companion.sourceEntityId)
    )
      throw new Error('伙伴来源角色不存在')
    combatStats(a, cs, cat)
  }
  for (const zone of e.zones ?? [])
    if (
      !e.actors.some((a) => a.id === zone.sourceId && a.characterId) ||
      zone.excludedIds.some((id) => !e.actors.some((a) => a.id === id)) ||
      [...Object.keys(zone.triggered), ...Object.keys(zone.phaseTriggered ?? {})].some(
        (id) => !e.actors.some((a) => a.id === id),
      )
    )
      throw new Error('持续区域的来源或目标引用不存在')
  if (
    e.pending?.metamagic &&
    (e.pending.metamagic.protectedIds.some((id) => !e.pending!.targets.some((t) => t.id === id)) ||
      (e.pending.metamagic.option === 'heightened' &&
        !e.pending.targets.some((t) => t.id === e.pending!.metamagic!.heightenedId)))
  )
    throw new Error('超魔法目标引用不存在')
  if (
    e.pending &&
    (!e.actors.some((a) => a.id === e.pending!.actorId) ||
      e.pending.targets.some((t) => !e.actors.some((a) => a.id === t.id)))
  )
    throw new Error('待结算目标不存在')
}
export function applyCombat(...args:Parameters<typeof applyCombatInternal>):ReturnType<typeof applyCombatInternal> {
  return withInventoryClocks(args[1],()=>{
   if(args[3].type==='hit-spell'){
    const prepared=prepareHitSpell(args[0],args[1],args[2],args[3]),input=clone(args[0]);
    input.pending=null;input.attackParents=[...(input.attackParents??[]),prepared.parent];input.attackWindows=[...(input.attackWindows??[]).slice(-199),prepared.window];
    const result=applyCombatInternal(input,args[1],args[2],prepared.command,args[4],args[5]);
    if(result.encounter.pending)result.encounter.pending.attackWindowId=prepared.window.id;
    const event=result.encounter.log.at(-1);if(event?.before){const {log,...prior}=clone(args[0]);event.before.encounter=prior}
    return result
   }
   return applyCombatInternal(...args)
  })
}
function applyCombatInternal(
  original: Encounter,
  originalCharacters: Character[],
  cat: Catalogue,
  command: CombatCommand,
  dice: (n: number) => number = rollDie,
  explorationTiming?: { key: string; targetId: string; phase: 'enter' | 'start' | 'end' },
) {
  const e = clone(original),
    cs = clone(originalCharacters),
    { log: _, ...state } = clone(original)
  if ('actorId' in command && (command.type !== 'move' || command.stand)) {
    const mover = e.actors.find((a) => a.id === command.actorId)
    if (mover && !(command.type === 'action' && command.action === 'dash'))
      mover.turn.groundTrail = []
  }
  const before: CombatSnapshot = {
    encounter: state,
    characters: Object.fromEntries(
      original.actors
        .filter((a) => a.characterId)
        .map((a) => {
          const c = combatCharacter(a, originalCharacters)!
          return [
            c.id,
            {
              state: clone({ runtime: c.runtime, inventory: c.inventory, coins: c.coins }),
              revision: c.revision,
              journal: clone(c.journal ?? []),
            },
          ]
        }),
    ),
  }
  const outcomes: NonNullable<import('./combat-types').CombatEvent['outcomes']> = []
  const damageResults: NonNullable<import('./combat-types').CombatEvent['damageResults']> = []
  let detail = ''
  const actor = (id: string) => {
    const a = e.actors.find((a) => a.id === id)
    if (!a) throw new Error('参与者不存在')
    return a
  }
  const stats = (a: Combatant) => combatStats(a, cs, cat)
  const character = (a: Combatant) => combatCharacter(a, cs)
  const withinSize = (a: Combatant, max: 'medium' | 'large') => {
    const c = character(a),
      size = c
        ? c.runtime?.wildShape
          ? beastNpc(c.runtime.wildShape.formId).size
          : runtimeDerived(c, cat).currentSize
        : (a.npc?.size ?? 'medium')
    const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']
    return !!size && sizes.indexOf(size) >= 0 && sizes.indexOf(size) <= sizes.indexOf(max)
  }
  const effects = (a: Combatant): ActiveEffect[] => {
    const c = character(a)
    if (c) {
      c.runtime = runtimeState(c, cat)
      return c.runtime.effects!
    }
    return a.npc!.effects
  }
  const setEffects = (a: Combatant, list: ActiveEffect[]) => {
    const c = character(a)
    if (c) {
      c.runtime = runtimeState(c, cat)
      c.runtime.effects = list
    } else a.npc!.effects = list
  }
  const runtime = (a: Combatant, cmd: RuntimeCommand, internal?:Parameters<typeof applyRuntime>[5]) => {
    const c = character(a)
    if (!c) throw new Error('此操作仅适用于角色')
    const index = cs.findIndex((x) => x.id === c.id)
    cs[index] = applyRuntime(c, cat, cmd, dice,undefined,internal)
  }
  const active = () => {
    if (e.phase !== 'active') throw new Error('请先开始遭遇')
  }
  const canAct = (a: Combatant) => {
    if(stats(a).effects.some(f=>f.key==='gaseous-form')&&['attack','cast','npc-ability','unarmed','item-use'].includes(command.type))throw Error('气化形体不能攻击、施法或使用物品')
    if (a.npc?.concentration?.pendingDC) throw new Error('请先处理NPC待结算专注豁免')
    if (a.companion?.dismissed || stats(a).dead || stats(a).conditions.includes('incapacitated'))
      throw new Error('失能或死亡时不能行动')
  }
  const own = (a: Combatant) => {
    active()
    if (
      e.actors[e.current]?.id !== a.id &&
      !(
        a.companion?.source === 'primal-companion' &&
        e.actors[e.current]?.id === a.companion.ownerId
      )
    )
      throw new Error('当前不是该参与者的回合')
    canAct(a)
    if(charmEffective(stats(a).effects))for(const f of stats(a).effects.filter(f=>f.key==='crown-of-madness'&&f.maintainedTick===undefined)){
      if(f.control?.turnKey!==e.id+':'+e.tick)throw Error('请GM先指定疯狂冠冕本回合的近战目标，或确认没有合法目标')
      if(f.control.targets.length&&!f.control.result&&command.type!=='attack')throw Error('疯狂冠冕要求在移动前以动作近战攻击指定目标')
    }
    if(slowed(stats(a).effects))a.turn.attacksLeft=0
  }
  const spend = (a: Combatant, cost: 'action' | 'bonus' | 'reaction') => {
    if(a.companion?.controlledMount&&cost==='action'&&!(command.type==='action'&&['dash','disengage','dodge'].includes(command.action)))throw Error('受控坐骑动作只能疾走、撤离或回避')
    if(a.companion?.spellId==='find-familiar'&&['attack','unarmed','npc-ability'].includes(command.type))throw Error('普通魔宠不能攻击；链契例外须使用主人明确牺牲攻击的专用入口')
    if(a.companion?.worldManaged&&!a.companion.controllerExpired&&a.companion.source==='spell-summon'&&['summon-beast','summon-fey','summon-undead','animate-dead'].includes(a.companion.spellId??'')&&!a.companion.commandText&&cost!=='reaction'&&!(command.type==='action'&&command.action==='dodge')&&command.type!=='effect-action-cost')throw Error('未经指挥的召唤物默认回避并仅避开危险；请先下达真实命令')
    if(cost!=='reaction'&&stats(a).effects.some(f=>f.key==='stinking-cloud-turn'))throw Error('臭云术中毒：本回合不能使用动作或附赠动作')
    for(const f of stats(a).effects.filter(f=>f.key==='command'&&f.maintainedTick===e.tick))if(cost!=='reaction'&&(['halt','grovel','drop'].includes(f.supportChoice??'')||f.directiveComplete||!(command.type==='action'&&command.action==='dash')))throw Error('命令术：当前回合须先执行指定命令，不能改为其他行动')
    if(cost==='action'&&stats(a).conditions.includes('frightened')&&stats(a).effects.some(f=>f.key==='fear'&&!(f.fearContext?.contextId===e.id&&f.fearContext?.tick===e.tick&&f.fearContext.noSafeRoute))&&!(command.type==='action'&&command.action==='dash'))
      throw Error('恐惧术要求使用疾走并沿安全路线远离来源；无安全路线须GM确认')
    if(cost==='action'&&!a.turn.manualUsed?.includes('curse-dodge')&&stats(a).effects.some(f=>f.key==='bestow-curse'&&f.supportChoice==='dodge'&&f.control?.turnKey===e.id+':'+e.tick&&f.control.result===false)&&!(command.type==='action'&&command.action==='dodge'))throw Error('降咒本回合须先执行闪避动作')
    if(slowed(stats(a).effects)&&cost!=='reaction'&&((cost==='action'&&(!a.turn.bonus||a.turn.manualUsed?.includes('budget-bonus')))||(cost==='bonus'&&(!a.turn.action||a.turn.manualUsed?.includes('budget-action')))))
      throw Error('缓慢术：本回合只能使用动作或附赠动作之一')
    if (cost === 'reaction') {
      active()
      canAct(a)
      if (stats(a).effects.some((x) => x.noReaction || x.key === 'arms-of-hadar'))
        throw new Error('当前效果禁止反应')
    } else own(a)
    if (
      cost === 'action' &&
      a.companion?.source === 'primal-companion' &&
      a.companion.commandedTick !== e.tick &&
      !(command.type === 'action' && command.action === 'dodge') &&
      !stats(actor(a.companion.ownerId)).conditions.includes('incapacitated')
    )
      throw new Error('原初兽未经命令默认只能回避')
    if (!a.turn[cost]) throw new Error('该行动资源已经使用')
    a.turn[cost] = false
    if(cost!=='reaction')a.turn.manualUsed=[...new Set([...(a.turn.manualUsed??[]),'budget-'+cost])]
    if (cost === 'action') {
      a.turn.attacksLeft = 0
      a.turn.surgeAction = false
    }
  }
  const noPending = () => {
    if (e.pending) throw new Error('请先完成当前待结算行动')
  }
  const context = (env: Environment) => {
    if (!Number.isFinite(env.distance) || env.distance < 0 || env.distance > 10000)
      throw new Error('距离必须为 0 至 10000 尺')
    if (!['none', 'half', 'three-quarters', 'total'].includes(env.cover))
      throw new Error('未知遮蔽类型')
    if (!env.targetLocationConfirmed)
      throw new Error('请确认目标位置；猜错位置的攻击应由 GM 记录为未命中')
  }
  const targetable = (env: Environment, range: number, area = false, see = false) => {
    context(env)
    if (!area && env.cover === 'total') throw new Error('全遮蔽目标不能直接选取')
    if (env.distance > range) throw new Error('目标超出射程或触及范围')
    if (see && !env.attackerSees) throw new Error('此效果要求看见目标')
    if (area && !env.areaConfirmed) throw new Error('请由 GM 确认范围覆盖与遮蔽路径')
  }
  const weakenDamage=(a:Combatant,parts:DamagePart[])=>{
    for(const part of parts)reduceEnfeebled(part.roll,stats(a).effects,dice)
    return parts
  }
  const guardSanctuary=(pending:PendingAction,a:Combatant)=>{
    const failures=new Set(pending.sanctuaryFailures??[]),passed=new Set(pending.sanctuaryPassed??[])
    for(const entry of pending.targets){const ward=stats(actor(entry.id)).effects.find(f=>f.key==='sanctuary');if(!ward)continue
      if(ward.spellDc===undefined)throw Error('庇护术缺少来源DC，请GM核对')
      if(!failures.has(entry.id)&&!passed.has(entry.id)){const save=savingRoll(a,'wis',{...defaultEnvironment(),advantage:!!a.npc?.magicResistance},cs,cat,dice);if(save.autoFail||save.total<ward.spellDc)failures.add(entry.id);else passed.add(entry.id)}
      if(failures.has(entry.id)){entry.sanctuaryBlocked=true;entry.hit=false}
    }
    pending.sanctuaryFailures=[...failures];pending.sanctuaryPassed=[...passed]
  }
  const breakDuelsForSpell=(a:Combatant,targets:Combatant[],harmful:boolean)=>{
    for(const victim of e.actors)setEffects(victim,effects(victim).filter(f=>{if(f.key!=='compelled-duel')return true;const source=e.actors.find(c=>sourceMatches(f.sourceId,c));return !(source&&((source.id===a.id&&targets.some(t=>t.id!==victim.id&&t.side!==a.side&&t.side!=='neutral'))||(harmful&&source.id!==a.id&&source.side!=='neutral'&&source.side===a.side&&targets.some(t=>t.id===victim.id))))}))
  }
  const rememberTruth=(target:Combatant,mark:ActiveEffect)=>{
    const source=e.actors.find(a=>[a.id,a.characterId,a.npcId].includes(mark.sourceId))
    if(!source)return
    const saved=effects(source).find(f=>f.key==='zone-of-truth-source'&&f.castId===mark.castId)
    if(saved?.control){saved.control.trials=[...(saved.control.trials??[]).filter(r=>r.targetId!==target.id),{targetId:target.id,success:mark.control!.result!}]}
  }
  const sourceMatches = (id: string, a: Combatant) =>
    id === a.id || id === a.characterId || id === a.npcId
  const effectsOfKnownSource=(id:string)=>{const source=e.actors.find(a=>sourceMatches(id,a));return source?stats(source).effects:cs.find(c=>c.id===id)?.runtime?.effects??[]}
  const addEffect = (
    a: Combatant,
    key: string,
    name: string,
    source: Combatant,
    page: number,
    partial: Partial<ActiveEffect> = {},
  ) => {
    const effect: ActiveEffect = {
      id: crypto.randomUUID(),
      key,
      name,
      sourceId: isM5Spell(key)||key==='magic-weapon-source'?(source.characterId??source.npcId??source.id):source.id,
      page,
      concentration: false,
      expiresAt: null,
      encounterId: e.id,
      phase: 'start',
      note: '',
      ...partial,
    }
    effect.sourceCreatureType ??= actorCreatureType(source,cs,true)
    if(key==='hypnotic-pattern'&&(a.npc?.conditionImmunities.includes('charmed')||stats(a).effects.some(f=>f.conditionImmunities?.includes('charmed'))||protectionBlocks(effects(a),effect.sourceCreatureType,effect.sourceId))){detail+='；目标免疫此来源魅惑，催眠图纹未生效';return effect}
    if(protectionBlocks(effects(a),effect.sourceCreatureType,effect.sourceId)){
      if(['charmed','frightened','possessed'].includes(effect.condition??'')){
        detail+='；防护善恶阻止对应来源状态';return effect
      }
      if(effect.conditions)effect.conditions=effect.conditions.filter(c=>!['charmed','frightened','possessed'].includes(c))
    }
    if (effect.conditions) {
      effect.conditions = effect.conditions.filter((c) => !a.npc?.conditionImmunities.includes(c))
      if (!effect.conditions.length) {
        detail += '；' + stats(a).name + '免疫该状态'
        return effect
      }
    }
    if (
      effect.condition &&
      (a.npc?.conditionImmunities.includes(effect.condition) || stats(a).effects.some(f=>f.conditionImmunities?.includes(effect.condition!)) ||
        (effect.condition === 'poisoned' && stats(a).conditions.includes('petrified')))
    ) {
      detail += '；' + stats(a).name + '免疫该状态'
      return effect
    }
    // A new casting refreshes this source only. Other castings remain dormant
    // and can resume when the strongest/latest casting ends (p.106).
    setEffects(
      a,
      effects(a).filter(
        (x) => x.key !== key || (key !== 'bardic-inspiration' && x.sourceId !== effect.sourceId),
      ),
    )
    const c =
      (effect.clockSourceId ? cs.find((c) => c.id === effect.clockSourceId) : undefined) ??
      character(a) ??
      (a.companion && character(actor(a.companion.ownerId))) ??
      character(source) ??
      cs[0]
    if (c && effect.expiresAt !== null)
      effect.endsAt =
        runtimeState(c, cat).hours +
        Math.max(0, effect.expiresAt - e.tick + (effect.phase === 'end' ? 1 : 0)) /
          (600 * Math.max(1, e.actors.length))
    effects(a).push(effect)
    return effect
  }
  const expires = (source: Combatant, rounds: number, phase: 'start' | 'end' = 'start') => ({
    expiresAt: rounds === 1 ? nextTurnTick(e, source.id) : e.tick + rounds * e.actors.length,
    phase,
  })
  const hasteBefore=new Map(e.actors.map(a=>[a.id,clone(effects(a))]))
  const cleanup = () => {
    for(const person of e.actors){const c=character(person);setEffects(person,effects(person).filter(f=>f.key!=='shillelagh'||(c?c.inventory.some(r=>r.instanceId===f.note&&r.equipped&&handSlot(assignedSlot(c,cat,r))):person.npc?.equipment?.some(g=>g.id===f.note&&g.held))))}

    for (const a of e.actors) {
      const c = character(a)
      if (c) {
        c.runtime = runtimeState(c, cat)
        if (c.runtime.wildShape) c.runtime.revelation = null
        if (c.runtime.revelation && c.runtime.hours! >= c.runtime.revelation.endsAt - 1e-9)
          c.runtime.revelation = null
        if (
          c.runtime.wildShape &&
          (c.runtime.hours! >= c.runtime.wildShape.endsAt ||
            stats(a).conditions.includes('incapacitated') ||
            stats(a).dead)
        )
          c.runtime.wildShape = null
        if (stats(a).conditions.includes('incapacitated')) {
          c.runtime.concentration = null
          c.runtime.rage = false
        }
        if (!c.runtime.rage)
          setEffects(
            a,
            effects(a).filter((x) => x.key !== 'rage-turn'),
          )
        if (stats(a).conditions.includes('unconscious') && !c.runtime.conditions.includes('prone'))
          c.runtime.conditions.push('prone')
        if (stats(a).conditions.includes('unconscious')) {
          const heldIds = new Set(
            c.inventory
              .filter((row) => handSlot(assignedSlot(c, cat, row)))
              .map((row) => row.instanceId),
          )
          c.inventory.forEach((row) => {
            if (heldIds.has(row.instanceId)) {
              row.equipped = false
              row.equipmentSlot = null
              row.grip = null
            }
          })
        }
      }
    }
    for (const source of e.actors) {
      const c = character(source)
      if (
        (c?.runtime?.concentration?.spellId??source.npc?.concentration?.spellId) === 'crown-of-madness' &&
        effects(source).some(
          (f) => f.key === 'crown-maintenance' && f.maintainedTick !== undefined,
        ) &&
        !e.actors.some((t) =>
          effects(t).some(
            (f) =>
              f.key === 'crown-of-madness' && f.condition === 'charmed' && f.sourceId === source.id,
          ),
        )
      )
        {if(c)runtime(source, { type: 'end-effect', effect: 'concentration' });else if(source.npc)delete source.npc.concentration}
    }
    e.zones = (e.zones ?? []).filter((z) => {
      const source = e.actors.find((a) => a.id === z.sourceId),
        c = source && character(source)
      return zoneAlive(z, c ?? undefined)
    })
    for (const a of e.actors) {
      if (a.companion) {
        const owner = e.actors.find((x) => x.id === a.companion!.ownerId),
          c = owner && character(owner)
        if (a.companion.source === 'wild-surge') {
          if (!c || !a.npc?.hp || runtimeState(c, cat).hours >= (a.companion.expiresHour ?? 0))
            a.companion.dismissed = true
          continue
        }
        if (a.companion.source === 'spell-summon'&&['summon-beast','summon-fey','summon-undead'].includes(a.companion.spellId??'')) {
          const actualConcentration=c?runtimeState(c,cat).concentration:owner?.npc?.concentration
          if ((!a.companion.worldManaged||owner)&&(!a.npc?.hp||actualConcentration?.spellId!==a.companion.spellId||a.companion.castId&&actualConcentration?.castId!==a.companion.castId))
            a.companion.dismissed = true
          continue
        }
        if (a.companion.source === 'primal-companion') {
          if (!c || runtimeState(c, cat).death.dead) a.companion.dismissed = true
          if (!a.npc?.hp && a.companion.deathAt == null)
            a.companion.deathAt = c ? runtimeState(c, cat).hours : 0
          if (
            c &&
            a.companion.reviveAt !== undefined &&
            a.companion.reviveAt !== null &&
            runtimeState(c, cat).hours >= a.companion.reviveAt
          ) {
            a.npc!.hp = a.npc!.maxHp
            a.npc!.dead = false
            a.companion.deathAt = null
            a.companion.reviveAt = null
          }
          continue
        }
        if (!a.companion.worldManaged&&(
          !c ||
          !a.npc?.hp ||
          runtimeState(c, cat).lastLongRestEnd !== a.companion.expiresAfterRest
        ))
          a.companion.dismissed = true
      }
      if (
        a.npc?.concentration &&
        (stats(a).dead ||
          stats(a).conditions.includes('incapacitated') ||
          (a.npc.concentration.encounterId === e.id &&
            (a.npc.concentration.expiresAt ?? Infinity) <= e.tick))
      )
        delete a.npc.concentration
      setEffects(
        a,
        effects(a).filter((x) => {
          if (!x.concentration) return true
          const src = e.actors.find((s) => sourceMatches(x.sourceId, s)),
            c = (src && character(src)) ?? cs.find((c) => c.id === x.sourceId)
          return c
            ? concentrationMatches(x,runtimeState(c, cat).concentration)
            : !!src?.npc?.concentration &&
                concentrationMatches(x,src.npc.concentration) &&
                !stats(src).dead &&
                !stats(src).conditions.includes('incapacitated')
        }),
      )
    }
    reconcileEncounter(e, cs, cat)
    for(const a of e.actors){
      setEffects(a,rememberEndedHaste(hasteBefore.get(a.id)??[],effects(a),{hours:character(a)?.runtime?.hours??cs[0]?.runtime?.hours??0,encounterId:e.id,nextEndTick:nextTurnTick(e,a.id),tick:e.tick,actors:e.actors.length,clockSourceId:character(a)?.id??cs[0]?.id}))
      hasteBefore.set(a.id,clone(effects(a)))
    }
  }
  const supportAdjustedDamage = (
    target: Combatant,
    amount: number,
    type: import('./combat-types').DamageType,
    def = defenses(target, cs, cat),
    half = false,
    reduction = 0,
  ) => {
    const turnKey = 'resistance:' + e.tick
    const targetEffects = effects(target)
    const budgetState = character(target) ? character(target)!.runtime! : target.npc!
    const outsideTurn =
      'outside:' +
      Math.floor((character(target)?.runtime?.hours ?? cs[0]?.runtime?.hours ?? 0) * 600 + 1e-7)
    const enteringSpentTurn =
      e.tick === 0 && budgetState.resistanceUsedTurn?.endsWith('|' + outsideTurn)
    const eligible =
      !enteringSpentTurn &&
      adjustDamage(amount, type, def, half, reduction) > 0 &&
      !target.turn.manualUsed?.includes(turnKey)
    const resisted = eligible
      ? resistanceReduction(
          targetEffects,
          type,
          Math.max(0, (half ? Math.floor(amount / 2) : amount) - reduction),
          e.id + ':' + e.tick,
          dice,
          budgetState,
          outsideTurn,
        )
      : 0
    if (resisted) {
      target.turn.manualUsed = [
        ...(target.turn.manualUsed ?? []).filter((k) => !k.startsWith('resistance:')),
        turnKey,
      ]
      detail += '；抵抗术减伤 ' + resisted
    }
    return adjustDamage(amount, type, def, half, reduction + resisted)
  }
  const damage = (
    a: Combatant,
    amount: number,
    critical = false,
    nonlethal = false,
    relentless = false,
    sourceId?: string,
    damageTypes: import('./combat-types').DamageType[] = [],
    bondTransfer = false,
  ): void => {
    if (!amount) return
    const bond = !bondTransfer ? effects(a).find(f => f.wardingBond) : undefined
    const wardBefore = character(a)?.runtime?.advanced?.ward ?? 0
    const transferBond = (): void => {
      if (!bond || amount <= wardBefore) return
      const caster = e.actors.find(t => sourceMatches(bond.sourceId, t))
      if (!caster) throw Error('守护之链施法者不在当前战斗名单，须先接入双方再结算伤害')
      if (stats(caster).hp > 0) {
        detail += '；守护之链关联伤害'
        damage(caster, amount - wardBefore, false, false, false, sourceId, damageTypes, true)
        concentration(caster)
      }
    }
    if (effects(a).some((x) => x.key === 'fey-mirthful'))
      setEffects(
        a,
        effects(a).filter((x) => x.key !== 'fey-mirthful'),
      )
    if (effects(a).some((x) => ['sleep', 'hypnotic-pattern'].includes(x.key)))
      setEffects(
        a,
        effects(a).filter((x) => !['sleep', 'hypnotic-pattern'].includes(x.key)),
      )
    const c = character(a)
    if (nonlethal && stats(a).hp > 0 && amount >= stats(a).hp + stats(a).temporaryHp) {
      const old = stats(a)
      if (c) {
        if (old.temporaryHp) runtime(a, { type: 'temporary', amount: 0, replace: true })
        if (old.hp > 1) runtime(a, { type: 'damage', amount: old.hp - 1 })
      } else {
        a.npc!.hp = 1
        a.npc!.temporaryHp = 0
        a.npc!.dead = false
      }
      addEffect(a, 'knockout', '近战击倒：1 HP 并昏迷', actor(e.pending!.actorId), 17, {
        condition: 'unconscious',
        ...expires(actor(e.pending!.actorId), 600),
        note: '自动开始短休，一小时结束时苏醒；恢复 HP 或 DC10 医药急救可提前结束，休息中断由 GM 处理',
      })
      detail += '；近战击倒，保留 1 HP 并昏迷'
      transferBond()
      cleanup()
      return
    }
    if (c) {
      runtime(a, { type: 'damage', amount, critical, relentless })
      const after = character(a)!
      if (nonlethal && after.runtime!.hp === 0 && !after.runtime!.death!.dead)
        runtime(a, { type: 'stabilize' })
    } else {
      const n = a.npc!,
        absorbed = Math.min(n.temporaryHp, amount),
        alive = n.hp > 0 && !n.dead
      n.temporaryHp -= absorbed
      n.hp = Math.max(0, n.hp - (amount - absorbed))
      if (
        alive &&
        n.hp === 0 &&
        n.undeadFortitude &&
        !nonlethal &&
        !critical &&
        !damageTypes.includes('radiant')
      ) {
        const roll = savingRoll(a, 'con', defaultEnvironment(), cs, cat, dice),
          dc = 5 + amount
        detail += `；不死韧性体质豁免 ${roll.total}/DC ${dc}`
        if (!roll.autoFail && roll.total >= dc) {
          n.hp = 1
          n.dead = false
          detail += '，成功保留1HP'
        } else detail += '，失败'
      }
      if (n.hp === 0) n.dead = !nonlethal
      if (n.concentration) {
        if (!n.hp) delete n.concentration
        else
          n.concentration.pendingDC = Math.max(
            n.concentration.pendingDC ?? 0,
            10,
            Math.floor(amount / 2),
          )
      }
    }
    const damageSource = e.actors.find((t) => t.id === (sourceId ?? e.pending?.actorId))
    if(damageSource&&amount>0)endInvisibility(damageSource)
    if(damageSource&&amount>0)setEffects(damageSource,effects(damageSource).filter(f=>f.key!=='sanctuary'))
    for (const target of e.actors)
      setEffects(
        target,
        effects(target).filter((f) => {
          if (
            f.key === 'friends' &&
            (target.id === a.id || (damageSource && sourceMatches(f.sourceId, damageSource)))
          )
            return false
          if (
            ['charm-person', 'animal-friendship','suggestion'].includes(f.key) &&
            target.id === a.id &&
            damageSource
          ) {
            const caster = e.actors.find((c) => sourceMatches(f.sourceId, c))
            if (
              caster &&
              (caster.id === damageSource.id ||
                (caster.side === damageSource.side && caster.side !== 'neutral'))
            )
              return false
          }
          if(f.key==='compelled-duel'&&target.id===a.id&&damageSource){const caster=e.actors.find(c=>sourceMatches(f.sourceId,c));if(caster&&caster.id!==damageSource.id&&caster.side!=='neutral'&&caster.side===damageSource.side)return false}
          if(f.key==='calm-emotions'&&f.supportChoice==='indifferent'&&target.id===a.id)return false
          return true
        }),
      )
    e.lastDamage = {
      actorId: a.id,
      sourceId: sourceId ?? e.pending?.actorId ?? e.actors[e.current]?.id ?? '',
      tick: e.tick,
    }
    for (const f of [...effects(a)].filter((f) => f.key === 'hideous-laughter' && f.repeatSave)) {
      const roll = savingRoll(a, 'wis', { ...defaultEnvironment(), advantage: true }, cs, cat, dice)
      detail += `；${f.name}受伤优势豁免 ${roll.total}/DC ${f.repeatSave!.dc}`
      if (!roll.autoFail && roll.total >= f.repeatSave!.dc)
        setEffects(
          a,
          effects(a).filter((x) => x.id !== f.id),
        )
    }
    detail += `；${stats(a).name}受到 ${amount} 伤害，HP ${stats(a).hp}/${stats(a).maxHp}`
    transferBond()
    cleanup()
  }
  const heal = (a: Combatant, n: number) => {
    if (n <= 0) return
    if (stats(a).hp < stats(a).maxHp)
      setEffects(
        a,
        effects(a).filter((x) => x.key !== 'knockout'),
      )
    if (effects(a).some((x) => x.blocksHealing)) throw new Error('当前效果禁止恢复生命值')
    if (character(a)) runtime(a, { type: 'heal', amount: Math.max(1, n) })
    else {
      if (a.npc!.dead) throw new Error('普通治疗不能复活')
      a.npc!.hp = Math.min(stats(a).maxHp, a.npc!.hp + n)
    }
  }
  const temp = (a: Combatant, n: number) => {
    if (character(a)) runtime(a, { type: 'temporary', amount: Math.max(0, n) })
    else a.npc!.temporaryHp = Math.max(a.npc!.temporaryHp, n)
  }
  const savingRoll = (...args: Parameters<typeof baseSavingRoll>) => {
    if (args[0].npc?.magicResistance && e.pending?.spellId && args[6] !== 'concentration')
      args[2] = { ...args[2], advantage: true }
    const result = baseSavingRoll(...args)
    const c=character(args[0]),state=c?(c.runtime??=runtimeState(c,cat)):args[0].npc!
    state.effects=state.effects!.filter(f=>!['lucky-own-roll','mind-sliver','portent-roll','restore-balance-roll','tides-chaos-roll'].includes(f.key))
    return result
  }
  const concentration = (a: Combatant) => {
    const c = character(a)
    if (!c) return
    const dc = runtimeState(c, cat).concentration?.pendingDC
    if (!dc) return
    const roll = savingRoll(a, 'con', defaultEnvironment(), cs, cat, dice, 'concentration')
    outcomes.push({
      actorId: a.id,
      kind: 'concentration',
      total: roll.total,
      success: !roll.autoFail && roll.total >= dc,
    })
    runtime(a, { type: 'concentration-result', success: !roll.autoFail && roll.total >= dc })
    detail += `；${stats(a).name}专注豁免 ${roll.total} / DC ${dc}，${character(a)!.runtime!.concentration ? '维持' : '结束'}`
    cleanup()
  }
  const expire = (phase: 'start' | 'end') => {
    for (const a of e.actors) {
      const expired = effects(a).filter(
        (x) =>
          x.encounterId === e.id &&
          x.phase === phase &&
          x.expiresAt !== null &&
          x.expiresAt <= e.tick,
      )
      if (!expired.length) continue
      setEffects(
        a,
        effects(a).filter((x) => !expired.some((expiredEffect) => expiredEffect.id === x.id)),
      )
      if (expired.some((x) => x.key === 'rage-turn') && character(a)) {
        runtime(a, { type: 'end-effect', effect: 'rage' })
      }
      detail += '；到期：' + expired.map((x) => x.name).join('、')
    }
    cleanup()
  }
  const extendRage = (a: Combatant) => {
    const c = character(a)
    if (c && runtimeState(c, cat).rage) {
      const found = effects(a).find((x) => x.key === 'rage-turn')
      if (found) {
        found.expiresAt = nextTurnTick(e, a.id)
        found.endsAt =
          runtimeState(c, cat).hours + (found.expiresAt - e.tick + 1) / (600 * e.actors.length)
      }
    }
  }
  const castResource = (
    a: Combatant,
    key: string,
    mode: string,
    confirmed: boolean,
    wildCheck = false,
    subtle = false,
  ) => {
    const c = character(a)
    if (!c) throw new Error('NPC 法术请通过 GM 裁定入口记录')
    const grant = runtimeSpells(c, cat).find((g) => g.key === key)
    if (!grant) throw new Error('法术来源不可用')
    if (e.phase === 'active' && spellUsesSlot(mode) && e.slotSpent.includes(a.id))
      throw new Error('2024 规则：同一个回合只能消耗一个法术位施法')
    if (
      mode === 'ritual' ||
      (/minute|hour/i.test(grant.spell.castingTime) &&
        !(grant.key.startsWith('chain:') && mode === 'at-will'))
    )
      throw new Error('分钟或小时施法及仪式请在战斗外进行，不能作为即时战斗施法')
    runtime(a, {
      type: 'cast',
      key,
      mode,
      requirementsConfirmed: confirmed,
      wildCheck,
      deferEffects: true,
    },subtle?{subtle:true}:undefined)
    if(itemCastFailed(character(a),key))return grant
    if (grant.spell.concentration)
      e.zones = (e.zones ?? []).filter(
        (z) => z.sourceId !== a.id || z.spellId === 'cordon-of-arrows',
      )
    if (grant.spell.concentration)
      for (const target of e.actors)
        setEffects(
          target,
          effects(target).filter((x) => !(x.concentration && sourceMatches(x.sourceId, a))),
        )
    setEffects(a,effects(a).filter(f=>f.key!=='sanctuary'))
    if (spellUsesSlot(mode)) e.slotSpent.push(a.id)
    if (effects(a).some((f) => f.key === 'wild-extra-action')) {
      a.turn.action = true
      setEffects(
        a,
        effects(a).filter((f) => f.key !== 'wild-extra-action'),
      )
    }
    setEffects(
      a,
      effects(a).filter((f) => f.key !== 'wild-invisible'),
    )
    cleanup()
    return grant
  }
  const pushReaction = (a:Combatant, spellId:'shield'|'counterspell', key:string, slot:number, dc?:number, env?:Environment) => {
    if(!e.pending)throw Error('原结算窗口已失效')
    if((e.reactionParents?.length??0)>=16)throw Error('反应嵌套达到16层，请GM接管当前保存窗口；原行动与骰值保留')
    ;(e.reactionParents??=[]).push(clone(e.pending))
    e.pending={id:crypto.randomUUID(),kind:'automatic',actorId:a.id,name:spellId==='shield'?'护盾术':'法术反制',page:spellId==='shield'?161:125,spellId,
      sourceKey:key,slotLevel:slot,attack:null,targets:[{id:a.id,env:defaultEnvironment(),roll:null,hit:true,critical:false,ac:stats(a).ac}],
      damage:[],save:null,dc:null,half:false,effectKey:spellId==='shield'?'shield':null,modifier:0,mode:'buff',notes:['反应施法；原结算与骰值已保存'],sneak:false,mastery:false,startedAt:e.tick,
      reactionFrame:{kind:spellId,dc,env}}
  }
  const resumeReaction = () => {
    if(e.pending||!e.reactionParents?.length)return
    e.pending=e.reactionParents.pop()!
    // Shield changed AC without changing or rerolling the original attack.
    if(e.pending.kind==='attack')for(const entry of e.pending.targets){
      if(!entry.roll)continue
      const t=actor(entry.id),roll=entry.roll
      entry.ac=stats(t).ac+(entry.env.cover==='half'?2:entry.env.cover==='three-quarters'?5:0)+(entry.acBonus??0)
      entry.hit=criticalAttack(actor(e.pending.actorId),roll.chosen,e.pending.spellId)||(roll.chosen!==1&&roll.total>=entry.ac)
      entry.critical=entry.hit&&(criticalAttack(actor(e.pending.actorId),roll.chosen,e.pending.spellId)||(entry.env.distance<=5&&stats(t).conditions.some(c=>['paralyzed','unconscious'].includes(c))))
    }
  }
  const counterPending = (reactor:Combatant, dc:number, env:Environment) => {
    const pending=e.pending
    if(!pending?.spellId||pending.damageRolled||pending.actorId===reactor.id)throw Error('没有可反制的其他生物施法窗口')
    const caster=actor(pending.actorId)
    breakDuelsForSpell(reactor,[caster],true)
    const roll=savingRoll(caster,'con',env,cs,cat,dice)
    detail='法术反制：施法者体质豁免 '+roll.total+'/DC '+dc
    if(!roll.autoFail&&roll.total>=dc){detail+='，成功，原法术继续';return}
    const c=character(caster)
    if(c){
      const r=runtimeState(c,cat)
      if(pending.slotReceipt){
        const pool=pending.slotReceipt.created?r.createdSlots:r.resources
        pool[pending.slotReceipt.resourceId]=(pool[pending.slotReceipt.resourceId]??0)+1
        e.slotSpent=e.slotSpent.filter(id=>id!==caster.id)
      }
      if(pending.itemReceipt){const proof=r.itemCasts.find(i=>i.id===pending.itemReceipt!.receiptId);if(proof&&!proof.returned){const item=clone(pending.itemReceipt.item),row=c.inventory.find(i=>i.instanceId===item.instanceId);if(row)row.quantity+=1;else {if(cs.some(other=>other.inventory.some(i=>i.instanceId===item.instanceId)))item.instanceId=crypto.randomUUID();c.inventory.push({...item,quantity:1,equipped:false,equipmentSlot:null,grip:null,containerId:null})}proof.returned=true;validateInventory(c,cat)}}
      if(r.concentration?.spellId===pending.spellId)r.concentration=null
      c.runtime=r
    }else if(caster.npc?.concentration?.spellId===pending.spellId)delete caster.npc.concentration
    e.pending=null
    detail+='，失败，原法术被打断；原动作已用，原法术位保留，其他已支付费用不退还'
  }
  const expendWeapon = (a: Combatant, spec: AttackSpec) => {
    if (spec.properties.includes('psychic-blade')) return
    if (spec.properties.some((p) => p.startsWith('ammunition'))) {
      const c = character(a)!
      const ammoId = spec.weaponId?.includes('crossbow')
        ? 'bolt'
        : spec.weaponId === 'sling'
          ? 'sling-bullet'
          : ['musket', 'pistol'].includes(spec.weaponId ?? '')
            ? 'firearm-bullet'
            : spec.weaponId === 'blowgun'
              ? 'needle'
              : 'arrow'
      const row = c.inventory.find((x) => x.itemId === ammoId && x.quantity > 0)
      if (!row) throw new Error('缺少所需弹药')
      if (
        !spec.properties.includes('two-handed') &&
        !(hasFeat(c.build, 'crossbow-expert', cat) && spec.weaponId?.includes('crossbow')) &&
        freeHandSlots(c, cat).length === 0
      )
        throw new Error('装填单手弹药武器需要空闲手')
      runtime(a, {
        type: 'item-remove',
        instanceId: row.instanceId,
        quantity: 1,
        consume: true,
        note: '战斗射击消耗',
      })
    }

    if (
      spec.ranged &&
      spec.weaponId &&
      spec.properties.some((p) => p.startsWith('thrown')) &&
      character(a)
    ) {
      runtime(a, { type: 'equip', instanceId: spec.instanceId!, equipped: false })
      const row = character(a)!.inventory.find((i) => i.instanceId === spec.instanceId)
      if (row)
        runtime(a, {
          type: 'item-note',
          instanceId: row.instanceId,
          note: (row.note + '；已投掷离手，落点与拾回由 GM 管理').slice(0, 2000),
        })
    }
  }
  const criticalAttack = (a: Combatant, n: number, spellId: string | null) =>
    n === 20 ||
    (n === 19 &&
      !!character(a) &&
      hasSubclass(character(a)!.build, 'champion') &&
      (!spellId || spellId === 'true-strike'))
  const endInvisibility = (a: Combatant) => {
    const sources = effects(a)
      .filter((f) => f.key === 'invisibility')
      .map((f) => f.sourceId)
    setEffects(
      a,
      effects(a).filter((f) => f.key !== 'invisibility'),
    )
    for (const id of sources) {
      const source = e.actors.find((a) => sourceMatches(id,a))
      if (
        source?.npc?.concentration?.spellId === 'invisibility' &&
        !e.actors.some((a) => effects(a).some((f) => f.key === 'invisibility' && f.sourceId === id))
      )
        delete source.npc.concentration
    }
  }
  const beginAttack = (
    a: Combatant,
    t: Combatant,
    spec: AttackSpec,
    env: Environment,
    sneak: boolean,
    mastery: boolean,
    spellId: string | null = null,
  ) => {
    if (
      effects(a).some(
        (x) =>
          x.condition === 'charmed' && charmEffective(stats(a).effects) && stats(a).conditions.includes('charmed') &&
          (sourceMatches(x.sourceId, t) || x.charmSources?.some((id) => sourceMatches(id, t))),
      )
    )
      throw new Error('魅惑状态禁止攻击魅惑来源')
    if(charmEffective(stats(a).effects))for(const f of stats(a).effects.filter(f=>f.key==='crown-of-madness'&&f.maintainedTick===undefined&&f.control?.turnKey===e.id+':'+e.tick&&!f.control.result)){if(spec.ranged||!f.control!.targets.includes(t.id))throw Error('疯狂冠冕须近战攻击GM指定的触及内目标');const stored=effects(a).find(e=>e.id===f.id);if(stored?.control)stored.control.result=true}
    targetable(env, spec.ranged ? spec.longRange || spec.range : spec.reach)
    const ward=stats(t).effects.find(f=>f.key==='sanctuary')
    if(ward){
      if(ward.spellDc===undefined)throw Error('庇护术缺少施法DC，请GM核对来源')
      const save=savingRoll(a,'wis',{...defaultEnvironment(),advantage:!!a.npc?.magicResistance},cs,cat,dice)
      if(save.autoFail||save.total<ward.spellDc){
        e.pending={kind:'attack',actorId:a.id,name:spec.name,page:spec.page,spellId,attack:clone(spec),targets:[{id:t.id,env:clone(env),roll:null,hit:false,critical:false,ac:stats(t).ac,sanctuaryBlocked:true}],
          damage:[],save:null,dc:null,half:false,effectKey:null,modifier:spec.modifier,mode:'attack',notes:['庇护术感知豁免失败：须重选目标或放弃本次攻击；尚未掷攻击骰、消耗弹药'],sneak,mastery,startedAt:e.tick,sanctuaryFailures:[t.id]}
        detail='庇护术阻止选定目标，感知豁免 '+save.total+'；可重选合法目标或确认失去本次攻击';return
      }
    }

    if (a.npc?.bloodiedFury && stats(a).hp <= stats(a).maxHp / 2)
      env = {
        ...env,
        attackAdvantages: [...(env.attackAdvantages ?? []), '嗜血狂怒：负伤时攻击优势'],
      }
    if (a.npc && spec.advantageWhileGrappling && env.npcGrappleConfirmed)
      env = { ...env, attackAdvantages: [...(env.attackAdvantages ?? []), 'GM确认目标被本NPC擒抱'] }
    for(const victim of e.actors)setEffects(victim,effects(victim).filter(f=>!(f.key==='compelled-duel'&&sourceMatches(f.sourceId,a)&&victim.id!==t.id)))
    if(slowed(stats(a).effects)){if(a.turn.manualUsed?.includes('slow-attack'))throw Error('缓慢术：自己回合至多一次攻击，额外动作／多重攻击不能绕过');a.turn.manualUsed=[...(a.turn.manualUsed??[]),'slow-attack']}
    expendWeapon(a, spec)
    const caster = character(a),
      ignoreCover =
        !!caster &&
        ((hasFeat(caster.build, 'sharpshooter', cat) && !!spec.weaponId && spec.ranged) ||
          (hasFeat(caster.build, 'spell-sniper', cat) && !!spellId))
    if (ignoreCover) env = { ...env, cover: env.cover === 'total' ? 'total' : 'none' }
    if (
      caster &&
      hasSubclass(caster.build, 'assassin') &&
      e.round === 1 &&
      e.actors.indexOf(t) > e.current
    )
      env = {
        ...env,
        attackAdvantages: [...(env.attackAdvantages ?? []), '刺客：目标尚未执行首回合'],
      }
    const roll = attackRoll(a, t, spec, env, cs, cat, dice),
      ac =
        stats(t).ac +
        (env.cover === 'half' ? 2 : env.cover === 'three-quarters' ? 5 : 0) +
        (!spec.ranged
          ? Math.max(
              0,
              ...effects(t)
                .filter((f) => f.key === 'defensive-duelist')
                .map((f) => Number(f.note) || 0),
            )
          : 0),
      hit = !env.windWallMiss && (criticalAttack(a, roll.chosen, spellId) || (roll.chosen !== 1 && roll.total >= ac)),
      critical =
        hit &&
        (criticalAttack(a, roll.chosen, spellId) ||
          (env.distance <= 5 &&
            stats(t).conditions.some((x) => ['paralyzed', 'unconscious'].includes(x))))
    setEffects(
      a,
      effects(a).filter(
        (x) =>
          ![
            'steady-aim',
            'fey-fuming',
            'lucky-own-roll',
            'portent-roll',
            'restore-balance-roll',
            'warding-flare-roll',
            'tides-chaos-roll',
          ].includes(x.key),
      ),
    )
    setEffects(
      t,
      effects(t).filter((x) => !['stun-opening', 'lucky-defense'].includes(x.key)),
    )
    if (sneak) {
      const c = character(a)
      if (
        c?.build.classId !== 'rogue' ||
        !(spec.properties.includes('finesse') || (spec.ranged && spec.weaponId)) ||
        a.turn.sneakUsed ||
        roll.mode === 'disadvantage'
      )
        throw new Error('偷袭需要游荡者、灵巧或远程武器且本回合未使用、无劣势')
      if (roll.mode !== 'advantage' && !env.note.trim())
        throw new Error('没有优势时，请说明五尺内非失能盟友满足偷袭条件')
    }
    e.pending = {
      kind: 'attack',
      actorId: a.id,
      name: spec.name,
      page: spec.page,
      spellId,
      attack: spec,
      targets: [{ id: t.id, env: clone(env), roll, hit, critical, ac }],
      damage: [],
      save: null,
      dc: null,
      half: false,
      effectKey: spellId,
      modifier: spec.modifier,
      mode: '',
      notes: [],
      sneak,
      mastery,
      startedAt: e.tick,
    }
    endInvisibility(a)
    for (const t of e.actors)
      setEffects(
        t,
        effects(t).filter((f) => !(f.key === 'friends' && sourceMatches(f.sourceId, a))),
      )
    detail = `${stats(a).name} → ${stats(t).name}：${spec.name}，d20 [${roll.dice}] ${spec.bonus >= 0 ? '+' : ''}${spec.bonus}${roll.bonusDice.length ? '，效果骰 ' + roll.bonusDice.join(',') : ''} = ${roll.total} / AC ${ac}；${hit ? (critical ? '重击' : '命中') : '未命中'}，等待反应与结算；SRD p.${spec.page}, 15–17`
    if (roll.reasons.length) detail += '；' + roll.reasons.join('；')
    if (env.spatial) detail += '；' + env.spatial
    setEffects(
      a,
      effects(a).filter((x) => !['sap', 'vicious-mockery', 'wild-invisible','enfeeblement-next-attack','sanctuary','fey-fuming'].includes(x.key)),
    )
    setEffects(
      t,
      effects(t).filter(
        (x) =>
          x.key !== 'guiding-bolt' && !(x.key==='summon-help'&&x.supportChoice!==a.id&&x.supportChoice!==a.companion?.instanceId) &&
          !(x.key === 'vex' && x.sourceId === a.id) &&
          !(x.key === 'maneuver-distracting' && x.sourceId !== a.id),
      ),
    )
    if (t.side !== a.side) extendRage(a)
  }
  const mirrorInterception = (p:PendingAction,entry:PendingTarget) => {
    if(p.kind!=='attack'||!entry.hit||entry.mirror)return
    const attacker=actor(p.actorId),target=actor(entry.id)
    if(!entry.env.attackerSees||stats(attacker).conditions.includes('blinded')||senseBypassesImages(attacker,cs,cat,entry.env.distance))return
    const image=stats(target).effects.find(f=>f.key==='mirror-image'&&(f.m3?.images??0)>0)
    if(!image)return
    prepareDice(image.m3!.images!,6,'镜影术：每个剩余幻象的d6',dice)
    const rolls=Array.from({length:image.m3!.images!},()=>checkedDie(dice,6)),destroyed=rolls.some(n=>n>=3)
    entry.mirror={effectId:image.id,rolls,destroyed}
    if(destroyed){
      setEffects(target,effects(target).map(f=>f.id===image.id?{...f,m3:{...f.m3,images:f.m3!.images!-1}}:f))
      entry.hit=false;entry.critical=false
      detail+='；镜影术 d6 ['+rolls.join(',')+']，摧毁一个幻象，原攻击未击中本体'
    }
  }
  const prepareAttackDamage = (
    p: PendingAction,
    entry: PendingTarget,
    command: Pick<Extract<CombatCommand, { type: 'resolve' }>, 'savage' | 'tavernReroll'>,
  ): DamagePart[] => {
    if(entry.sanctuaryBlocked)return []
    mirrorInterception(p,entry)
    if(p.spellId==='acid-arrow'&&!entry.hit&&p.attack)return [{type:'acid',roll:rollDamage(p.attack.damage,dice)}]
    const a = actor(p.actorId),
      t = actor(entry.id),
      spec = p.attack,
      caster = character(a),
      cantrip = cat.spells.some((s) => s.id === p.spellId && s.level === 0),
      potentHalf =
        !entry.hit &&
        !!caster &&
        hasSubclass(caster.build, 'evoker') &&
        cantrip &&
        p.sourceKey?.startsWith('class-cantrips:')
    const damageDice = p.triggered?.includes('wild-max-damage') ? (sides: number) => sides : dice
    let parts = clone(p.damage)
    if (spec && entry.hit) {
      const sizeEffect=stats(a).effects.find(f=>f.key==='enlarge-reduce')
      if(sizeEffect&&(!p.spellId||p.spellId==='true-strike')){
        const extra=rollDamage('1d4',damageDice,entry.critical&&sizeEffect.m3?.option!=='reduce')
        if(sizeEffect.m3?.option==='reduce'){extra.total=-extra.total;extra.formula='−'+extra.formula}
        parts.push({type:spec.type,roll:extra})
      }
      if(stats(t).effects.some(f=>f.key==='bestow-curse'&&f.supportChoice==='damage'&&sourceMatches(f.sourceId,a)))parts.push({type:'necrotic',roll:rollDamage('1d8',dice,entry.critical)})
      const c = character(a),
        r = c && runtimeState(c, cat),
        weapon = !!spec.weaponId&&(!p.spellId || p.spellId === 'true-strike')
      const layout = c && equipmentLayout(c, cat),
        row = c?.inventory.find((x) => x.instanceId === spec.instanceId),
        great = !!(
          weapon &&
          c &&
          hasStyle(c.build, 'great-weapon-fighting', cat) &&
          row?.grip === 'two-handed' &&
          !spec.ranged &&
          (spec.properties.includes('two-handed') ||
            spec.properties.some((x) => x.startsWith('versatile')))
        )
      let flat =
        weapon && spec.damage !== '1'
          ? spec.modifier
          : spec.damage === '1' && spec.id === 'unarmed'
            ? spec.modifier
            : spec.modifier
      const enchantments = weapon
        ? stats(a).effects.filter((f) => f.weapon?.instanceId === spec.instanceId)
        : []
      flat += Math.max(
        0,
        ...enchantments.filter((f) => f.key === 'magic-weapon').map((f) => f.weapon!.bonus),
      )
      flat += spec.damageBonus ?? 0
      if (r?.rage && spec.ability === 'str') flat += 2
      if (
        c &&
        hasFeat(c.build, 'great-weapon-master', cat) &&
        spec.properties.includes('heavy') &&
        p.triggered?.includes('attack-action') &&
        e.actors[e.current]?.id === a.id
      )
        flat += pbOf(c.build)
      if (
        c &&
        weapon &&
        spec.weaponId &&
        !spec.ranged &&
        hasStyle(c.build, 'dueling', cat) &&
        !!row &&
        gripOf(c, cat, row) !== 'two-handed' &&
        ![...(layout?.slots['main-hand'] ?? []), ...(layout?.slots['off-hand'] ?? [])].some(
          (h) => h.instanceId !== spec.instanceId && findItem(c, cat, h.itemId)?.kind === 'weapon',
        )
      )
        flat += 2
      if (
        c &&
        weapon &&
        spec.ranged &&
        spec.properties.some((p) => p.startsWith('thrown')) &&
        hasStyle(c.build, 'thrown-weapon-fighting', cat)
      )
        flat += 2
      const tavern =
        !!c &&
        spec.id === 'unarmed' &&
        hasOrigin(c, cat, 'tavern-brawler') &&
        command.tavernReroll !== false
      const tavernRerolls: DamageReroll[] = []
      let tavernDieIndex = 0
      const base = rollDamage(
        spec.damage,
        tavern
          ? (sides) => {
              const index = tavernDieIndex++,
                from = checkedOriginDie(damageDice, sides)
              if (from !== 1) return from
              const to = checkedOriginDie(damageDice, sides)
              tavernRerolls.push({ index, from, to, reason: 'tavern-brawler' })
              return to
            }
          : damageDice,
        entry.critical,
        great
          ? 3
          : c &&
              p.spellId &&
              hasFeat(c.build, 'elemental-adept', cat) &&
              one(c.build, 'feat-element') === spec.type
            ? 2
            : 1,
      )
      if (tavernRerolls.length) base.rerolls = tavernRerolls
      base.formula += flat ? (flat > 0 ? '+' : '') + flat : ''
      base.flat += flat
      base.total = Math.max(0, base.total + flat)
      if (command.savage) {
        if (
          !c ||
          !featIds(c.build, cat).includes('savage-attacker') ||
          !spec.weaponId ||
          a.turn.savageUsed
        )
          throw new Error('凶蛮打手仅每回合一次武器命中可用')
        const again = rollDamage(
          spec.damage + (flat >= 0 ? '+' : '') + flat,
          dice,
          entry.critical,
          great ? 3 : 1,
        )
        a.turn.savageUsed = true
        if (again.total > base.total) Object.assign(base, again)
        detail += '；凶蛮打手取较高伤害'
      }
      if (p.spellId === 'sorcerous-burst') {
        let extra = 0,
          triggers = base.dice.filter((n) => n === 8).length
        while (triggers > 0 && extra < Math.max(0, p.modifier)) {
          const v = checkedDie(dice, 8)
          base.dice.push(v)
          base.total += v
          extra++
          triggers--
          if (v === 8) triggers++
        }
      }
      if (p.spellId === 'chromatic-orb' && new Set(base.dice).size < base.dice.length)
        detail +=
          '；Chromatic Orb 满足弹跳：GM 选择 30 尺内另一个目标并裁定一次新攻击及新伤害，不重复扣动作或法术位'
      parts = [
        { type: spec.type, roll: base },
        ...(spec.extraDamage ?? [])
          .filter(
            (part) =>
              !part.when ||
              (part.when === 'advantage'
                ? entry.roll?.mode === 'advantage'
                : !!entry.env.npcChargeConfirmed && withinSize(t, 'medium')),
          )
          .map((part) => ({
            type: part.type,
            roll: rollDamage(part.formula, dice, entry.critical),
          })),
        ...clone(p.bonusDamage ?? []),
      ]
      if (
        entry.env.crusaderActive &&
        (spec.weaponId ||
          spec.id === 'unarmed' ||
          (a.npc && !p.spellId&&!spec.properties.includes('spell-attack')&&!spec.properties.includes('npc-spell'))) &&
        e.actors.some(
          (source) =>
            source.side === a.side &&
            effects(source).some((f) => f.key === 'crusaders-mantle') &&
            (character(source)?.runtime?.concentration?.spellId??source.npc?.concentration?.spellId) === 'crusaders-mantle',
        )
      )
        parts.push({ type: 'radiant', roll: rollDamage('1d4', dice, entry.critical) })
      for (const f of enchantments.filter((f) => f.weapon?.dice && f.weapon.damageType))
        parts.push({
          type: f.weapon!.damageType as import('./combat-types').DamageType,
          roll: rollDamage(f.weapon!.dice!, dice, entry.critical),
        })
      for (const effect of effects(a).filter(
        (f) =>
          f.key === 'maneuver-commanded-damage' ||
          (f.key === 'maneuver-feint' && f.note === t.id) ||
          (f.key === 'maneuver-lunging' && !spec.ranged),
      )) {
        if (p.triggered?.includes('maneuver')) throw new Error('同次攻击不能叠加战技')
        parts.push({ type: spec.type, roll: rollDamage('1d8', dice, entry.critical) })
        p.triggered = [...(p.triggered ?? []), 'maneuver']
        setEffects(
          a,
          effects(a).filter((f) => f.id !== effect.id),
        )
      }
      if (c && hasFeat(c.build, 'piercer', cat) && entry.critical && spec.type === 'piercing')
        parts.push({
          type: spec.type,
          roll: rollDamage('1d' + (Number(spec.damage.match(/d(\d+)/)?.[1]) || 6), dice),
        })
      if (
        c &&
        hasSubclass(c.build, 'zealot') &&
        r?.rage &&
        e.actors[e.current]?.id === a.id &&
        !a.turn.manualUsed?.includes('divine-fury-auto')
      ) {
        parts.push({
          type: 'radiant',
          roll: rollDamage('1d6+' + Math.floor(c.level / 2), dice, entry.critical),
        })
        a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'divine-fury-auto']
      }
      if (
        c &&
        hasSubclass(c.build, 'fey-wanderer') &&
        spec.weaponId &&
        !a.turn.manualUsed?.includes('fey-auto:' + t.id + ':' + e.tick)
      ) {
        parts.push({ type: 'psychic', roll: rollDamage('1d4', dice, entry.critical) })
        a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'fey-auto:' + t.id + ':' + e.tick]
      }
      if (spec.id === 'beast-spider' && !p.spellId)
        parts.push({ type: 'poison', roll: rollDamage('1d4', dice, entry.critical) })
      if (spec.id === 'beast-giant-spider' && !p.spellId)
        parts.push({ type: 'poison', roll: rollDamage('2d6', dice, entry.critical) })
      if (
        !!c &&
        hasSubclass(c.build, 'berserker') &&
        r?.rage &&
        spec.ability === 'str' &&
        effects(a).some((e) => e.key === 'reckless') &&
        e.actors[e.current]?.id === a.id &&
        !a.turn.manualUsed?.includes('frenzy')
      ) {
        parts.push({ type: spec.type, roll: rollDamage('2d6', dice, entry.critical) })
        a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'frenzy']
      }
      if (p.spellId === 'true-strike' && (c?.level ?? a.npc?.spellcasting?.level ?? 1) >= 5)
        parts.push({ type: 'radiant', roll: rollDamage('1d6', dice, entry.critical,great?3:1) })
      if (p.sneak) {
        if (c && hasSubclass(c.build, 'assassin') && e.round === 1) base.total += c.level
        parts.push({
          type: spec.type,
          roll: rollDamage(
            Math.ceil((c?.level ?? 1) / 2) + 'd6',
            dice,
            entry.critical,
            great ? 3 : 1,
          ),
        })
        a.turn.sneakUsed = true
      }
      for (const x of effects(t).filter(
        (x) => ['hex', 'hunter-s-mark'].includes(x.key) && sourceMatches(x.sourceId,a),
      ))
        parts.push({
          type: x.key === 'hex' ? 'necrotic' : 'force',
          roll: rollDamage('1d6', dice, entry.critical, great ? 3 : 1),
        })
      if (weapon && effects(a).some((x) => x.key === 'divine-favor'))
        parts.push({
          type: 'radiant',
          roll: rollDamage('1d4', dice, entry.critical, great ? 3 : 1),
        })
    } else if (spec && !entry.hit) {
      parts = potentHalf ? [{ type: spec.type, roll: rollDamage(spec.damage, dice) }] : []
      if (p.mastery && spec.mastery === 'Graze')
        parts = [
          {
            type: spec.type,
            roll: {
              formula: 'Graze',
              dice: [],
              flat: Math.max(0, spec.modifier),
              total: Math.max(0, spec.modifier),
            },
          },
        ]
    }

    weakenDamage(a,parts)
    parts.push(...structuredClone(entry.hitSpellDamage??[]))
    for (const part of parts) annotateDamageRoll(part.type, part.roll)
    return parts
  }
  switch (command.type) {
    case 'control-ruling':{
      noPending();active();reason(command.note)
      if(!command.confirmed)throw Error('请GM确认实际感知、位置与裁定条件')
      const a=actor(command.actorId),f=effects(a).find(f=>f.id===command.effectId),op=command.operation
      if(!f)throw Error('持续效果已经变化')
      if(op==='activity-complete'||op==='witness-harm'){
        if(op==='activity-complete'&&f.key!=='suggestion'||op==='witness-harm'&&!(f.key==='calm-emotions'&&f.supportChoice==='indifferent'))throw Error('结束条件与所选法术不符')
        setEffects(a,effects(a).filter(e=>e.id!==f.id))
      }else if(op==='duel-distance'){
        if(f.key!=='compelled-duel'||!command.inside&&e.actors[e.current]?.id!==e.actors.find(c=>sourceMatches(f.sourceId,c))?.id)throw Error('强令对决距离须在来源回合末核对')
        if(!command.inside)setEffects(a,effects(a).filter(e=>e.id!==f.id));else if(f.control)f.control.turnKey=e.id+':'+e.tick
      }else if(op==='crown-target'){
        if(f.key!=='crown-of-madness'||f.maintainedTick!==undefined||e.actors[e.current]?.id!==a.id)throw Error('须在受疯狂冠冕影响者当前回合指定合法近战目标')
        if(command.targetId===a.id)throw Error('疯狂冠冕不能指定受术者自己')
        if(command.targetId)actor(command.targetId)
        f.control={dc:f.repeatSave!.dc,targets:command.targetId?[command.targetId]:[],text:command.note,lastTick:e.tick,turnKey:e.id+':'+e.tick,result:!command.targetId}
      }else if(op==='illusion-study'){
        if(f.key!=='phantasmal-force'||!f.control)throw Error('目标没有此幻象')
        spend(a,'action')
        const c=character(a),roll=c?(()=>{runtime(a,{type:'check',kind:'skill',id:'investigation',dc:f.control!.dc});return runtimeState(character(a)!,cat).advanced.lastCheck!.total})():checkedDie(dice,20)+(a.npc?.templateMetadata?.skills?.investigation??stats(a).mods.int)
        detail+='；调查 '+roll+'/'+f.control.dc
        if(roll>=f.control.dc)setEffects(a,effects(a).filter(e=>e.id!==f.id))
      }else if(op==='illusion-damage'){
        if(f.key!=='phantasmal-force'||!f.control)throw Error('目标没有危险幻象')
        const source=e.actors.find(c=>sourceMatches(f.sourceId,c))
        if(!source||e.actors[e.current]?.id!==source.id||f.control.turnKey===e.id+':'+e.tick)throw Error('仅来源自己的回合可结算一次幻象伤害')
        f.control.lastTick=e.tick;f.control.turnKey=e.id+':'+e.tick
        const rolled=weakenDamage(source,[{type:'psychic',roll:rollDamage('2d8',dice)}])[0]!.roll;damage(a,supportAdjustedDamage(a,rolled.total,'psychic'),false,false,false,source.id,['psychic'])
        detail+='；幻象2d8心灵 '+rolled.total
      }else if(op==='truth-presence'){
        if(!['zone-of-truth','zone-of-truth-source'].includes(f.key)||!f.control)throw Error('请选择实际诚实之域来源或受术者')
        const target=command.targetId?actor(command.targetId):a
        let mark=effects(target).find(e=>e.key==='zone-of-truth'&&e.castId===f.castId)
        if(!mark){if(f.key!=='zone-of-truth-source')throw Error('须选择区域来源登记新的进入者');mark=addEffect(target,'zone-of-truth','诚实之域',e.actors.find(c=>sourceMatches(f.sourceId,c))!,f.page,{...clone(f),id:crypto.randomUUID(),key:'zone-of-truth',control:{...f.control,targets:[],inside:false},note:'失败后区域内不能故意说谎，可拒答或回避'})}
        if(!mark.control)throw Error('诚实之域缺少区域数据')
        const eligible=command.inside&&mark.control.inside!==true&&mark.control.turnKey!==e.id+':'+e.tick&&mark.control.result!==false
        mark.control.inside=command.inside
        if(eligible){const roll=savingRoll(target,'cha',defaultEnvironment(),cs,cat,dice);mark.control.lastTick=e.tick;mark.control.turnKey=e.id+':'+e.tick;mark.control.result=!roll.autoFail&&roll.total>=mark.control.dc;rememberTruth(target,mark);detail+='；诚实之域豁免已保存，仅GM与来源可查看'}
      }else throw Error('该区域裁定尚无匹配来源')
      detail+='；GM核对持续法术：'+command.note;break
    }
    case 'command-complete':{
      active();reason(command.note)
      if(!command.confirmed)throw Error('请GM核对命令术实际路线与结果')
      const a=actor(command.actorId),f=effects(a).find(f=>f.id===command.effectId&&f.key==='command'&&f.maintainedTick===e.tick)
      if(!f||e.actors[e.current]?.id!==a.id)throw Error('目标尚未进入执行命令的回合或该命令已结束')
      a.turn.action=false;a.turn.bonus=false;a.turn.attacksLeft=0;f.speedZero=true
      f.directiveComplete=true
      detail='GM确认命令已执行，本回合不能继续行动：'+command.note;break
    }
    case 'fear-context': {
      active();reason(command.note)
      if(!command.confirmed)throw Error('请GM确认恐惧术的实际路线和视线条件')
      const f=effects(actor(command.actorId)).find(f=>f.id===command.effectId&&f.key==='fear')
      if(!f)throw Error('该恐惧术来源已结束')
      f.fearContext={contextId:e.id,tick:e.tick,noSafeRoute:command.noSafeRoute,sourceVisible:command.sourceVisible,movementResolved:command.movementResolved}
      detail='GM已核对恐惧术路线、移动及视线：'+command.note;break
    }
    case 'sanctuary-retarget': {
      active()
      const p=e.pending,entry=p?.targets[command.targetIndex],a=actor(command.actorId),target=actor(command.targetId)
      if(!p||p.actorId!==a.id||!entry?.sanctuaryBlocked||p.damageRolled||p.sanctuaryFailures?.includes(target.id))throw Error('庇护术重选窗口或新目标无效，不能重复对同一目标刷豁免')
      canAct(a)
      const old=clone(p)
      let result:PendingTarget
      if(p.attack){
        beginAttack(a,target,p.attack,command.env,p.sneak,p.mastery,p.spellId)
        result=e.pending!.targets[0]!
      }else{
        const spell=cat.spells.find(s=>s.id===p.spellId)
        if(!spell)throw Error('原法术来源不存在')
        const range=spellRangeFeet(spell.id,spell.range,character(a)?.level??1)
        targetable(command.env,range,false)
        const ward=stats(target).effects.find(f=>f.key==='sanctuary')
        let blocked=false
        if(ward&&!p.sanctuaryPassed?.includes(target.id)){
          if(ward.spellDc===undefined)throw Error('庇护术缺少来源DC，请GM核对')
          const save=savingRoll(a,'wis',{...defaultEnvironment(),advantage:!!a.npc?.magicResistance},cs,cat,dice)
          blocked=save.autoFail||save.total<ward.spellDc
        }
        const roll=!blocked&&p.save?savingRoll(target,p.save,command.env,cs,cat,dice):null
        result={id:target.id,env:clone(command.env),roll,hit:!blocked&&(!roll||roll.autoFail||roll.total<p.dc!),critical:false,ac:stats(target).ac,sanctuaryBlocked:blocked}
      }
      const failures=[...(old.sanctuaryFailures??[]),...(result.sanctuaryBlocked?[target.id]:[])]
      e.pending={...old,id:crypto.randomUUID(),targets:old.targets.map((t,i)=>i===command.targetIndex?result:t),sanctuaryFailures:[...new Set(failures)],sanctuaryPassed:[...new Set([...(old.sanctuaryPassed??[]),...(!result.sanctuaryBlocked?[target.id]:[])])]}
      break
    }
    case 'resolution-draft': {
      if(!e.pending?.id||e.pending.id!==command.pendingId)throw Error('待结算行动已改变，请刷新后选择');
      const options=resolutionAbilities(e,cs,cat),keys=[...new Set(command.keys)];
      if(keys.some(key=>!options.some(o=>o.key===key&&o.choice&&!o.reason)))throw Error('能力选择已不可用，请重新核对');
      if(options.filter(o=>keys.includes(o.key)&&o.choice==='revelation').length>1)throw Error('只能选择一种天启效果');
      e.pending.resolutionDraft=keys;detail='保存待结算能力选择（不消耗资源）';break;
    }
    case 'add-character': {
      if (e.phase !== 'setup') throw new Error('开始后不能改变参与者，请建立新的遭遇')
      const c = cs.find((c) => c.id === command.characterId)
      if (!c || c.status !== 'complete') throw new Error('请选择已完成角色')
      if (e.actors.some((a) => a.characterId === c.id)) throw new Error('角色已在遭遇中')
      e.actors.push({
        id: c.id,
        characterId: c.id,
        npc: null,
        side: command.side,
        initiative: null,
        surprised: false,
        turn: freshTurn(),
      })
      detail = '加入角色：' + c.build.name
      break
    }
    case 'add-npc':
      if (e.phase !== 'setup') throw new Error('开始后不能改变参与者')
      e.actors.push({
        id: crypto.randomUUID(),
        characterId: null,
        npc: clone(command.npc),
        side: command.side,
        initiative: null,
        surprised: false,
        turn: freshTurn(),
      })
      detail = '加入 NPC：' + command.npc.name
      break
    case 'remove-actor':
      if (e.phase !== 'setup') throw new Error('开始后不能改变参与者')
      detail = '移除：' + stats(actor(command.actorId)).name
      e.actors = e.actors.filter((a) => a.id !== command.actorId)
      break
    case 'initiative': {
      if (e.phase !== 'setup') throw new Error('先攻仅能在开始前调整')
      const a = actor(command.actorId)
      a.initiative = command.value === null ? null : integer(command.value, -100, 100)
      delete a.initiativeRoll
      a.surprised = command.surprised
      detail = 'GM 指定先攻：' + stats(a).name + ' ' + a.initiative
      break
    }
    case 'roll-initiative': {
      if (e.phase !== 'setup') throw new Error('先攻仅能在开始前掷骰')
      const entries = e.actors.map((a) => {
        const c = character(a),
          s = stats(a),
          d = c ? checkDetail(c, cat, 'initiative', 'dex', { disadvantage: a.surprised }) : null
        const adv = d?.adv ?? (s.conditions.includes('invisible') ? ['隐形'] : []),
          dis = d?.dis ?? (a.surprised ? ['突袭'] : [])
        return { a, c, s, d, adv, dis, count: !!adv.length !== !!dis.length ? 2 : 1 }
      })
      const bases = new Map<string, number[]>()
      if (manualDiceActive()) {
        prepareDice(
          entries.reduce((n, x) => n + x.count, 0),
          20,
          '先攻批量：' + entries.map((x) => x.s.name + `（${x.count}颗）`).join('、'),
          dice,
        )
        for (const x of entries) {
          prepareDice(x.count, 20, '先攻 · ' + x.s.name, dice)
          bases.set(
            x.a.id,
            Array.from({ length: x.count }, () => dice(20)),
          )
        }
      }
      for (const { a, c, s, d, adv, dis } of entries) {
        if (bases.has(a.id)) prepareDice(0, 20, '先攻 · ' + s.name + '（后续重掷）', dice)
        const roll = d20(
          d?.bonus ?? a.npc!.initiativeBonus,
          adv,
          dis,
          dice,
          c?.build.speciesId === 'halfling' && !c.runtime?.wildShape,
          [],
          false,
          undefined,
          1,
          false,
          bases.get(a.id),
        )
        a.initiative = roll.total
        a.initiativeRoll=clone(roll)
        detail += `${s.name} [${roll.dice}] = ${roll.total}${a.surprised ? '（突袭劣势）' : ''}；`
      }
      e.actors.sort((a, b) => b.initiative! - a.initiative!)
      detail += '同值顺序由 GM 调整；Alert 的自愿交换也在开始前指定'
      break
    }
    case 'initiative-reroll': {
      if(e.phase!=='setup')throw Error('先攻选项仅能在开战前使用')
      const a=actor(command.actorId),c=character(a),roll=a.initiativeRoll
      if(!c||!roll||!runtimeState(c,cat).heroicInspiration)throw Error('缺少实际先攻骰或英雄激励')
      runtime(a,{type:'inspiration',active:false,note:'先攻检定重掷一个骰子'})
      const index=roll.dice.indexOf(roll.chosen),value=checkedDie(dice,20)
      roll.dice[index]=value;roll.chosen=roll.mode==='advantage'?Math.max(...roll.dice):roll.mode==='disadvantage'?Math.min(...roll.dice):value
      roll.total=roll.chosen+roll.bonus+roll.bonusDice.reduce((n,v)=>n+v,0);a.initiative=roll.total
      detail='英雄激励重掷先攻：'+stats(a).name+' = '+roll.total
      break
    }
    case 'initiative-swap': {
      if(e.phase!=='setup')throw Error('先攻交换只能在开战前进行')
      const a=actor(command.actorId),b=actor(command.targetId),c=character(a)
      if(a.id===b.id||a.side!==b.side||!c||!featIds(c.build,cat).includes('alert')||a.initiative===null||b.initiative===null||stats(a).conditions.includes('incapacitated')||stats(b).conditions.includes('incapacitated'))throw Error('警觉先攻交换资格不成立')
      const value=a.initiative;a.initiative=b.initiative;b.initiative=value
      delete a.initiativeRoll;delete b.initiativeRoll
      detail='双方同意交换实际先攻值：'+stats(a).name+' 与 '+stats(b).name
      break
    }
    case 'order': {
      if (e.phase !== 'setup') throw new Error('开始后先攻顺序固定')
      if (
        new Set(command.ids).size !== e.actors.length ||
        command.ids.some((id) => !e.actors.some((a) => a.id === id))
      )
        throw new Error('顺序须包含每位参与者一次')
      e.actors = command.ids.map(actor)
      detail = 'GM 确认同先攻顺序'
      break
    }
    case 'start': {
      for (const a of e.actors.filter(
        (a) => a.companion && ['spell-summon', 'primal-companion'].includes(a.companion.source)&&!['find-familiar','animate-dead'].includes(a.companion.spellId??'')&&e.actors.some(owner=>owner.id===a.companion!.ownerId),
      ))
        a.initiative = actor(a.companion!.ownerId).initiative
      if (e.phase !== 'setup' || e.actors.length < 2 || e.actors.some((a) => a.initiative === null))
        throw new Error('至少两名参与者并完成先攻后才能开始')
      e.actors.sort((a, b) => b.initiative! - a.initiative!)
      const paired = e.actors.filter(
        (a) => a.companion && ['spell-summon', 'primal-companion'].includes(a.companion.source)&&!['find-familiar','animate-dead'].includes(a.companion.spellId??'')&&e.actors.some(owner=>owner.id===a.companion!.ownerId),
      )
      e.actors = e.actors
        .filter((a) => !paired.includes(a))
        .flatMap((a) => [a, ...paired.filter((p) => p.companion!.ownerId === a.id)])
      e.phase = 'active'
      e.round = 1
      e.current = 0
      e.tick = 0
      for (const a of e.actors) {
        a.turn = freshTurn()
        const c = character(a)
        if (c && runtimeState(c, cat).rage)
          addEffect(a, 'rage-turn', '狂暴维持期限', a, 29, { ...expires(a, 1, 'end') })
      }
      const first = e.actors[0]!
      if (character(first) && hasSubclass(character(first)!.build, 'gloom-stalker'))
        addEffect(first, 'dread-ambusher', '恐惧伏击：首回合速度', first, 0, {
          speedBonus: 10,
          expiresAt: e.tick,
          phase: 'end',
        })
      detail = `开始 ${e.name}，第 1 轮：${stats(e.actors[0]!).name}`
      if (first.npc)
        detail +=
          '；' + refreshNpcRecharge(first.npc, e.tick, () => checkedDie(dice, 6), e.id).join('；')
      if (effects(first).some((f) => f.key === 'burning')) {
        damage(
          first,
          supportAdjustedDamage(first, rollDamage('1d4', dice).total, 'fire'),
          false,
          false,
          false,
          undefined,
          ['fire'],
        )
        concentration(first)
        detail += '；燃烧危害：回合开始 1d4 火焰伤害'
      }
      break
    }
    case 'end-turn':
      if (command.encounterId !== e.id || command.expectedTick !== e.tick)
        throw new Error('回合已变化，请刷新后重新确认')
      if (e.actors[e.current]?.id !== command.actorId)
        throw new Error('只能结束当前参与者自己的回合')
    case 'next': {
      active()
      noPending()
      const currentCharacter = character(e.actors[e.current]!)
      if (currentCharacter) {
        const r = runtimeState(currentCharacter, cat)
        if (!r.hp && !r.death.dead && !r.death.stable && !e.actors[e.current]!.turn.deathSaveDone)
          throw new Error('请先处理本回合开始的死亡豁免')
      }
      for (const a of e.actors) {
        if (a.npc?.concentration?.pendingDC) throw new Error('请先处理NPC待结算专注豁免')
        const c = character(a)
        if (c && runtimeState(c, cat).concentration?.pendingDC)
          throw new Error('请先处理待结算专注豁免')
      }
      detail = '结束回合：' + stats(e.actors[e.current]!).name
      const ending = e.actors[e.current]!
      if(charmEffective(stats(ending).effects))for(const f of stats(ending).effects.filter(f=>f.key==='crown-of-madness'&&f.maintainedTick===undefined))if(f.control?.turnKey!==e.id+':'+e.tick||!f.control.result)throw Error('请GM指定疯狂冠冕近战目标并执行攻击，或确认无合法目标')
      if(!stats(ending).conditions.includes('incapacitated')&&!ending.turn.manualUsed?.includes('curse-dodge')&&stats(ending).effects.some(f=>f.key==='bestow-curse'&&f.supportChoice==='dodge'&&f.control?.turnKey===e.id+':'+e.tick&&f.control.result===false))throw Error('请先执行降咒强制的闪避动作')
      for(const victim of e.actors)for(const f of stats(victim).effects.filter(f=>f.key==='compelled-duel'&&sourceMatches(f.sourceId,ending)))if(f.control?.turnKey!==e.id+':'+e.tick)throw Error('请GM先确认强令对决来源回合末30尺距离')
      for(const f of appliedEffects(effects(ending)).filter(f=>f.key==='command'&&f.maintainedTick===e.tick)){
        if(['approach','flee'].includes(f.supportChoice??'')&&!f.directiveComplete)throw Error('请GM先核对命令术的实际移动路线及完成结果')
      }
      for(const f of appliedEffects(effects(ending)).filter(f=>f.key==='fear'&&stats(ending).conditions.includes('frightened'))){
        const context=f.fearContext?.contextId===e.id&&f.fearContext?.tick===e.tick?f.fearContext:undefined
        if(!context||(!context.noSafeRoute&&!context.movementResolved))throw Error('请GM先确认恐惧术安全路线已执行，或当前没有可行路线')
        if(!context.noSafeRoute&&ending.turn.action)throw Error('恐惧术要求先使用疾走动作')
      }
      for (const f of appliedEffects(effects(ending)).filter(
        (f) => f.repeatSave && !(f.encounterId === e.id && (f.repeatAfterTick ?? 0) > e.tick)&&!(f.key==='fear'&&f.fearContext?.sourceVisible!==false),
      )) {
        const roll = savingRoll(
          ending,
          f.repeatSave!.ability,
          {
            ...defaultEnvironment(),
            advantage: (!!ending.npc?.magicResistance && cat.spells.some((s) => s.id === f.key)) || protectionSaveAdvantage(effects(ending),f),
          },
          cs,
          cat,
          dice,
          f.condition === 'charmed' ? 'charm' : f.condition === 'frightened' ? 'fear' : 'normal',
        )
        detail += `；${f.name}回合末豁免 ${roll.total}/DC ${f.repeatSave!.dc}`
        if (!roll.autoFail && roll.total >= f.repeatSave!.dc)
          setEffects(
            ending,
            effects(ending).filter((x) => x.id !== f.id),
          )
        else if (f.key === 'sleep' && f.sleepStage === 'drowsy') {
          setEffects(
            ending,
            effects(ending).map((current) => {
              if (current.id !== f.id) return current
              const { repeatSave: _save, ...retained } = current
              return { ...retained, sleepStage: 'asleep' as const, condition: 'unconscious' }
            }),
          )
        }
      }
      if (
        effects(ending).some(
          (f) =>
            f.key === 'crown-maintenance' &&
            f.maintainedTick !== undefined &&
            f.maintainedTick !== e.tick,
        )
      ) {
        if(character(ending))runtime(ending, { type: 'end-effect', effect: 'concentration' });else if(ending.npc)delete ending.npc.concentration
        detail += '；未以魔法动作维持疯狂冠冕，法术结束'
      }
      for(const f of appliedEffects(effects(ending)).filter(f=>f.endDamage)){const raw=rollDamage(f.endDamage!.dice,dice),amount=supportAdjustedDamage(ending,raw.total,f.endDamage!.damageType);if(amount){damage(ending,amount,false,false,false,f.sourceId,[f.endDamage!.damageType]);concentration(ending)}setEffects(ending,effects(ending).filter(x=>!(x.key===f.key&&x.endDamage)));detail+='；'+f.name+'回合末一次伤害 '+amount}
      expire('end')
      let advances = 0
      do {
        e.current = (e.current + 1) % e.actors.length
        advances++
        if (!e.current) e.round++
      } while (
        e.actors[e.current]?.companion?.source === 'primal-companion' ||
        e.actors[e.current]?.companion?.dismissed
      )
      e.tick += advances
      e.slotSpent = []
      const current = e.actors[e.current]!
      current.turn = { ...freshTurn(), reaction: true }
      if(current.companion?.worldManaged&&!current.companion.controllerExpired&&!current.companion.commandText&&['summon-beast','summon-fey','summon-undead','animate-dead'].includes(current.companion.spellId??'')&&current.npc?.hp){addEffect(current,'dodge','未经指挥：默认回避',current,0,expires(current,1));current.turn.action=false}
      if (current.npc)
        detail +=
          '；' + refreshNpcRecharge(current.npc, e.tick, () => checkedDie(dice, 6), e.id).join('；')
      for (const a of e.actors) {
        a.turn.sneakUsed = false
        a.turn.savageUsed = false
        a.turn.cleaveUsed = false
        a.turn.levelSpellCast = false
        a.turn.quickenedCast = false
        const c = character(a)
        if (c) runtime(a, { type: 'time', hours: advances / (600 * e.actors.length) })
      }
      expire('start')
      for (const f of [...effects(current)].filter((f) => f.startDamage)) {
        const burning = f.startDamage!,
          raw = reduceEnfeebled(rollDamage(burning.dice, dice),f.spellId?effectsOfKnownSource(f.sourceId):[],dice),
          amount = supportAdjustedDamage(current, raw.total, burning.damageType as import('./combat-types').DamageType)
        if (amount) {
          damage(current, amount, false, false, false, f.sourceId, [burning.damageType as import('./combat-types').DamageType])
          concentration(current)
        }
        if(f.key==='ensnaring-strike'){detail+='；诱捕藤蔓回合初穿刺 '+amount;continue}
        const roll = savingRoll(current, 'con', defaultEnvironment(), cs, cat, dice)
        detail += `；${f.name}回合开始 ${raw.formula}＝${raw.total}，体质 ${roll.total}/DC ${burning.dc}`
        if (!roll.autoFail && roll.total >= burning.dc)
          setEffects(
            current,
            effects(current).filter((x) => x.id !== f.id),
          )
      }
      if (effects(current).some((f) => f.key === 'burning')) {
        const raw = rollDamage('1d4', dice)
        damage(
          current,
          supportAdjustedDamage(current, raw.total, 'fire'),
          false,
          false,
          false,
          undefined,
          ['fire'],
        )
        concentration(current)
        detail += '；燃烧危害：回合开始受到 1d4 火焰伤害'
      }
      for (const companion of e.actors.filter(
        (a) =>
          a.companion?.source === 'primal-companion' &&
          a.companion.ownerId === current.id &&
          !a.companion.dismissed,
      )) {
        companion.turn = freshTurn()
        if (stats(companion).hp)
          addEffect(companion, 'dodge', '原初兽默认回避', companion, 0, expires(current, 1))
      }
      if (effects(current).some((f) => f.key === 'aura-of-vitality'))
        current.turn.manualUsed = [...(current.turn.manualUsed ?? []), 'vitality-ready']
      if (effects(current).some((f) => f.key === 'wild-regeneration')) heal(current, 5)
      if (effects(current).some((f) => f.key === 'wild-repeat') && character(current)) {
        const c = character(current)!
        const currentRuntime = runtimeState(c, cat)
        c.runtime = currentRuntime
        detail += wildMagic(c, currentRuntime, dice, false, true)
      }
      if (
        e.round === 1 &&
        character(current) &&
        hasSubclass(character(current)!.build, 'gloom-stalker')
      )
        addEffect(current, 'dread-ambusher', '恐惧伏击：首回合速度', current, 0, {
          speedBonus: 10,
          expiresAt: e.tick,
          phase: 'end',
        })
      if (effects(current).some((f) => f.key === 'wild-extra-action')) {
        current.turn.action = true
        setEffects(
          current,
          effects(current).filter((f) => f.key !== 'wild-extra-action'),
        )
      }
      for (const effect of stats(current).effects.filter((x) => x.key === 'heroism'))
        temp(current, Math.max(0, Number(effect.note) || 0))
      for(const f of appliedEffects(effects(current)).filter(f=>f.key==='zone-of-truth'&&f.control?.inside&&f.control.result!==false)){
        const roll=savingRoll(current,'cha',defaultEnvironment(),cs,cat,dice);f.control!.lastTick=e.tick;f.control!.result=!roll.autoFail&&roll.total>=f.control!.dc;f.control!.turnKey=e.id+':'+e.tick;rememberTruth(current,f)
        detail+='；诚实之域豁免已保存，仅GM与来源可查看'
      }
      for(const f of appliedEffects(effects(current)).filter(f=>f.key==='bestow-curse'&&f.supportChoice==='dodge'&&f.control)){
        const roll=savingRoll(current,'wis',defaultEnvironment(),cs,cat,dice);f.control!.lastTick=e.tick;f.control!.turnKey=e.id+':'+e.tick;f.control!.result=!roll.autoFail&&roll.total>=f.control!.dc
        detail+='；降咒回合开始豁免 '+roll.total+'/'+f.control!.dc
      }
      for(const f of appliedEffects(effects(current)).filter(f=>f.key==='command')){
        f.maintainedTick=e.tick
        if(['halt','grovel','drop'].includes(f.supportChoice??'')){
          current.turn.action=false;current.turn.bonus=false;current.turn.attacksLeft=0;f.speedZero=true
          if(f.supportChoice==='grovel'){
            if(character(current))runtime(current,{type:'condition',id:'prone',active:true})
            else if(!current.npc!.conditions.includes('prone'))current.npc!.conditions.push('prone')
          }
        }
      }
      detail += `；第 ${e.round} 轮：${stats(current).name}`
      break
    }
    case 'end':
      active()
      noPending()
      e.phase = 'ended'
      detail = '结束遭遇；持续法术与角色状态保留，需按剩余时长继续处理'
      break
    case 'item-use': {
      noPending()
      const a = actor(command.actorId),
        t = actor(command.targetId),
        c = character(a)
      own(a)
      if (
        effects(a).some(
          (f) =>
            f.condition === 'charmed' && charmEffective(stats(a).effects) && stats(a).conditions.includes('charmed') &&
            (sourceMatches(f.sourceId, t) || f.charmSources?.some((id) => sourceMatches(id, t))),
        )
      )
        throw Error('魅惑状态禁止伤害魅惑来源')
      if (!c) throw Error('使用背包物品需要角色')
      const row = c.inventory.find((r) => r.instanceId === command.instanceId && r.quantity > 0)
      if (!row) throw Error('背包物品已不可用')
      const item = findItem(c, cat, row.itemId)!
      const known = automaticDamageItem(item)
      if (known) targetable(command.env, 20, false, true)
      else {
        context(command.env)
        reason(command.note)
      }
      if (known && (a.turn.attacksLeft ?? 0) > 0) {
        if (c.build.classId === 'warlock') throw Error('契约武器的额外攻击不能替换为丢出物品')
        a.turn.attacksLeft!--
      } else {
        const cost = known ? 'action' : (command.manualCost ?? 'action')
        if (cost !== 'free') spend(a, cost)
        if (cost === 'action')
          a.turn.attacksLeft =
            known &&
            c.level >= 5 &&
            ['barbarian', 'fighter', 'monk', 'paladin', 'ranger'].includes(c.build.classId)
              ? 1
              : 0
      }
      const dc = 8 + stats(a).mods.dex + pbOf(c.build)
      const roll = known ? savingRoll(t, 'dex', command.env, cs, cat, dice) : null
      const hit = roll ? roll.autoFail || roll.total < dc : true
      const creatureType = character(t)
        ? character(t)!.runtime?.wildShape
          ? 'beast'
          : 'humanoid'
        : t.npc?.creatureType
      const holyTarget = ['undead', 'fiend'].includes(creatureType ?? '')
      if (known && item.id === 'holy-water' && !creatureType)
        throw Error('圣水目标生物类型未确认，请 GM 配置后再使用')
      const formula = item.id === 'acid' ? '2d6' : item.id === 'alchemists-fire' ? '1d4' : '2d8'
      const damageType =
        item.id === 'acid'
          ? ('acid' as const)
          : item.id === 'alchemists-fire'
            ? ('fire' as const)
            : ('radiant' as const)
      runtime(a, {
        type: 'item-remove',
        instanceId: row.instanceId,
        quantity: 1,
        consume: false,
        note: '物品使用已扣库存，目标效果另行结算：' + (command.note || item.name),
      })
      e.pending = {
        kind: known ? 'save' : 'manual',
        actorId: a.id,
        name: item.name,
        page: item.source.page,
        spellId: null,
        attack: null,
        targets: [
          { id: t.id, env: clone(command.env), roll, hit, critical: false, ac: stats(t).ac },
        ],
        damage:
          known && (item.id !== 'holy-water' || holyTarget)
            ? [{ type: damageType, roll: rollDamage(formula, dice) }]
            : [],
        save: known ? 'dex' : null,
        dc: known ? dc : null,
        half: false,
        effectKey: known && item.id === 'alchemists-fire' ? 'item-burning' : null,
        modifier: 0,
        mode: known ? '' : 'manual',
        notes: known
          ? ['PHB 2024 冒险装备；攻击动作替换一次攻击']
          : ['自定义/未自动化物品；GM 按原文裁定动作、射程、效果与结果', command.note],
        sneak: false,
        mastery: false,
        startedAt: e.tick,
      }
      if (roll) outcomes.push({ actorId: t.id, kind: 'save', total: roll.total, success: !hit })
      if (known && t.side !== a.side) extendRage(a)
      detail = `${stats(a).name}使用${item.name}，消耗 1 件；${known ? '目标敏捷豁免，等待 GM 结算' : '动作及消耗已记录，等待 GM 按原文裁定结果'}`
      break
    }
    case 'move': {
      noPending()
      const a = actor(command.actorId)
      own(a)
      const speed = command.mode?stats(a).spatialCapabilities[command.mode]:stats(a).speed
      let cost =
        integer(command.distance, 0, 1000) * (command.difficult ? 2 : 1) +
        integer(command.extraCost ?? 0, 0, 1000)
      if (command.stand) {
        if (!stats(a).conditions.includes('prone') || speed === 0)
          throw new Error('只有倒地且速度大于零才能起身')
        cost +=
          character(a) && hasFeat(character(a)!.build, 'athlete', cat) ? 5 : Math.floor(speed / 2)
        if (character(a)) runtime(a, { type: 'condition', id: 'prone', active: false })
        else a.npc!.conditions = a.npc!.conditions.filter((x) => x !== 'prone')
        if (effects(a).some((x) => x.condition === 'prone' || x.conditions?.includes('prone')))
          throw new Error('来源效果仍使其倒地，请先按规则结束来源')
      }
      if (a.turn.movement + cost > speed + a.turn.dash) throw new Error('移动额度不足')
      a.turn.movement += cost
      detail = `${stats(a).name}移动 ${command.distance} 尺，消耗 ${cost} 尺${command.stand ? '（起身）' : ''}；位置与借机触发由 GM 确认：${command.note}`
      break
    }
    // Internal only: the originating effect has already authorized this exact action.
    // Keep turn, pending, incapacity and budget checks, without requiring Nimble Escape.
    case 'effect-action-cost': {
      noPending()
      const a=actor(command.actorId)
      if(command.magic&&a.turn.surgeAction)throw Error('动作如潮不能提供魔法动作')
      spend(a,command.cost)
      detail='已消耗来源效果授予的实际行动资源'
      break
    }
    case 'action': {
      noPending()
      const a = actor(command.actorId)
      if (
        command.cost === 'bonus' &&
        !((a.npc?.nimbleEscape && ['disengage','hide'].includes(command.action)) || (command.action==='dash'&&stats(a).effects.some(f=>f.key==='expeditious-retreat')))
      )
        throw Error('此NPC没有该附赠动作能力')
      if(command.action==='magic'&&a.turn.surgeAction)throw Error('动作如潮不能提供魔法动作')
      if(command.cost==='haste'){
        own(a)
        if(!['dash','disengage','hide','utilize'].includes(command.action)||!stats(a).effects.some(f=>f.key==='haste')||a.turn.manualUsed?.includes('haste-action'))throw Error('加速动作仅可用于一次攻击、疾走、撤离、躲藏或使用物品')
        a.turn.manualUsed=[...(a.turn.manualUsed??[]),'haste-action']
      }else spend(a, command.cost ?? 'action')
      if (command.action === 'dash') a.turn.dash += stats(a).speed
      if (command.action === 'dodge'){addEffect(a, 'dodge', '闪避', a, 10, expires(a, 1));a.turn.manualUsed=[...(a.turn.manualUsed??[]),'curse-dodge']}
      if (command.action === 'disengage')
        addEffect(a, 'disengage', '撤离', a, 16, { expiresAt: e.tick, phase: 'end' })
      if (command.action === 'extinguish') {
        if (!effects(a).some((f) => f.key === 'burning')) throw Error('当前没有燃烧危害')
        setEffects(
          a,
          effects(a).filter((f) => f.key !== 'burning'),
        )
        if (character(a)) runtime(a, { type: 'condition', id: 'prone', active: true })
        else if (!a.npc!.conditions.includes('prone')) a.npc!.conditions.push('prone')
      }
      detail = stats(a).name + '采取 ' + command.action + '；' + command.note
      if (['help', 'ready', 'hide', 'search', 'study', 'influence'].includes(command.action))
        reason(command.note)
      break
    }
    case 'grapple-release': {
      noPending()
      const a = actor(command.actorId),
        t = actor(command.targetId)
      canAct(a)
      if (!effects(t).some((f) => f.grapple && f.sourceId === a.id)) throw Error('没有此来源的擒抱')
      setEffects(
        t,
        effects(t).filter((f) => !(f.grapple && f.sourceId === a.id)),
      )
      detail = `${stats(a).name}释放${stats(t).name}，无需动作`
      break
    }
    case 'grapple-escape': {
      noPending()
      const a = actor(command.actorId),
        f = effects(a).find((f) => f.grapple && f.sourceId === command.sourceId)
      if (!f?.grapple) throw Error('没有可挣脱的擒抱来源')
      if (!['athletics', 'acrobatics'].includes(command.skill)) throw Error('请选择运动或体操')
      spend(a, 'action')
      const c = character(a)
      let check: { autoFail: boolean; total: number }
      if (c) {
        runtime(a, {
          type: 'check',
          kind: 'skill',
          id: command.skill,
          dc: f.grapple.dc,
          context: {
            purpose: 'grapple',
            advantage: command.env.advantage,
            disadvantage: command.env.disadvantage,
            fearVisible: command.env.fearVisible,
          },
        })
        check = runtimeState(character(a)!, cat).advanced.lastCheck!
      } else {
        const s = stats(a),
          ability = command.skill === 'athletics' ? 'str' : 'dex'
        check = d20(
          a.npc?.templateMetadata?.skills[command.skill] ?? s.mods[ability],
          command.env.advantage ? ['GM 情境'] : [],
          [
            ...(command.env.disadvantage ? ['GM 情境'] : []),
            ...(s.conditions.includes('poisoned') ? ['中毒'] : []),
            ...(s.conditions.includes('frightened') && command.env.fearVisible
              ? ['恐惧来源可见']
              : []),
          ],
          dice,
        )
        check.total += guidanceBonus(effects(a), command.skill, dice)
      }
      const success = !check.autoFail && check.total >= f.grapple.dc
      if (success)
        setEffects(
          a,
          effects(a).filter((x) => x.id !== f.id),
        )
      outcomes.push({ actorId: a.id, kind: 'check', total: check.total, success })
      detail = `${stats(a).name}挣脱擒抱：${check.total} / DC ${f.grapple.dc}，${success ? '成功' : '失败'}，消耗动作`
      break
    }
    case 'unarmed': {
      noPending()
      if (command.handling) {
        const a = actor(command.actorId),
          c = character(a)
        own(a)
        if (!c) throw Error('逐次拔收需要完整角色卡')
        validateHandling(c, cat, command.handling, command.cost)
        for (const op of command.handling.before) runtime(a, op)
      }
      const a = actor(command.actorId),
        t = actor(command.targetId),
        c = character(a)
      const spec = attackOptions(a, cs, cat).find((s) => s.id === 'unarmed')
      if (!c || !spec || a.id === t.id) throw Error('请选择角色的徒手打击与另一目标')
      if (
        effects(a).some(
          (f) =>
            f.condition === 'charmed' && charmEffective(stats(a).effects) && stats(a).conditions.includes('charmed') &&
            (sourceMatches(f.sourceId, t) || f.charmSources?.some((id) => sourceMatches(id, t))),
        )
      )
        throw Error('魅惑状态禁止攻击魅惑来源')
      if (
        !['grapple', 'prone', 'push'].includes(command.kind) ||
        !['str', 'dex'].includes(command.save)
      )
        throw Error('徒手选项或目标豁免不合法')
      const method = attackMethods({
        actor: a,
        currentId: e.actors[e.current]?.id,
        active: e.phase === 'active',
        pending: false,
        character: c,
        cat,
        spec,
      }).find((m) => m.cost === command.cost)
      if (!method?.enabled) throw Error(method?.reason || '当前不能使用该徒手方式')
      targetable(command.env, spec.reach)
      const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']
      const size = runtimeDerived(c, cat).currentSize,
        tc = character(t),
        targetSize = tc ? runtimeDerived(tc, cat).currentSize : (t.npc?.size ?? 'medium')
      if (sizes.indexOf(targetSize) > sizes.indexOf(size) + 1)
        throw Error('目标体型不能比自己大超过一个级别')
      if (
        command.kind === 'grapple' &&
        (!freeHandSlots(c, cat).includes(command.hand) ||
          effects(t).some((f) => f.grapple && f.sourceId === a.id))
      )
        throw Error('擒抱需要指定空闲的手，且不能重复擒抱同一目标')
      if (command.kind === 'grapple' && command.handling?.after.length) {
        const projected = clone(c)
        projected.runtime = runtimeState(c, cat)
        projected.runtime.grapples = [
          ...projected.runtime.grapples!,
          { encounterId: e.id, targetId: t.id, hand: command.hand },
        ]
        previewWeaponHandling(projected, cat, command.handling.after)
      }
      if (command.cost === 'action') {
        own(a)
        if ((a.turn.attacksLeft ?? 0) > 0) {
          if (c.build.classId === 'warlock') throw Error('渴饮之刃额外攻击只能使用契约武器')
          a.turn.attacksLeft!--
        } else {
          spend(a, 'action')
          a.turn.attacksLeft =
            c.level >= 5 &&
            ['barbarian', 'fighter', 'monk', 'paladin', 'ranger'].includes(c.build.classId)
              ? 1
              : 0
        }
      } else if (command.cost === 'flurry') {
        own(a)
        a.turn.flurryLeft!--
      } else if (command.cost === 'agile') {
        own(a)
        a.turn.manualUsed = a.turn.manualUsed!.filter((x) => x !== 'dance-ready')
      } else if (command.cost === 'opportunity') {
        reason(command.env.note)
        if (!command.env.attackerSees) throw Error('借机攻击要求看见目标')
        spend(a, 'reaction')
      } else spend(a, 'bonus')
      const mods = runtimeDerived(c, cat).mods
      const dcMod = martialArtsEligible(c, equippedInventory(c, cat), [
        ...cat.items,
        ...c.build.customItems,
      ])
        ? Math.max(mods.str, mods.dex)
        : mods.str
      const dc = 8 + pbOf(c.build) + dcMod,
        roll = savingRoll(t, command.save, command.env, cs, cat, dice),
        failed = roll.autoFail || roll.total < dc
      e.pending = {
        id: crypto.randomUUID(),
        kind: 'save',
        actorId: a.id,
        name: { grapple: '徒手擒抱', prone: '徒手推撞：倒地', push: '徒手推撞：推离 5 尺' }[
          command.kind
        ],
        page: 0,
        spellId: null,
        attack: null,
        targets: [{ id: t.id, env: clone(command.env), roll, hit: failed, critical: false, ac: 0 }],
        damage: [],
        save: command.save,
        dc,
        half: false,
        effectKey: null,
        modifier: dcMod,
        mode: 'unarmed',
        notes: ['目标选择力量或敏捷豁免；不掷攻击骰、不造成伤害'],
        sneak: false,
        mastery: false,
        startedAt: e.tick,
        unarmed: {
          kind: command.kind,
          hand: command.hand,
          range: spec.reach,
          ...(command.pushTo ? { pushTo: clone(command.pushTo) } : {}),
        },
      }
      if (command.handling?.after.length) e.pending.afterWeapon = clone(command.handling.after)
      if (character(a)?.runtime?.rage)
        addEffect(a, 'rage-turn', '本回合迫使豁免维持狂暴', a, 0, expires(a, 1, 'end'))
      detail = `${stats(a).name}：${e.pending.name}，目标${command.save === 'str' ? '力量' : '敏捷'}豁免 ${roll.total} / DC ${dc}；等待结算`
      break
    }
    case 'familiar-strike': {noPending();active();const a=actor(command.actorId),owner=actor(command.ownerId),c=character(owner),marker='chain-authorized:'+a.id+':'+command.receipt;if(!c||!hasInvocation(c.build,'chain')||e.actors[e.current]?.id!==owner.id||a.companion?.spellId!=='find-familiar'||a.companion.ownerId!==owner.id||!owner.turn.manualUsed?.includes(marker))throw Error('链契反应缺少真实主人已牺牲的攻击');const spec=attackOptions(a,cs,cat)[0];if(!spec)throw Error('魔宠缺少实际攻击数据');spend(a,'reaction');owner.turn.manualUsed=owner.turn.manualUsed.filter(x=>x!==marker);beginAttack(a,actor(command.targetId),spec,command.env,false,false);detail='真实链契主人牺牲一次攻击，魔宠使用一次反应攻击；没有重新施法';break}
    case 'm5-strike': {
      noPending();const a=actor(command.actorId),targets=command.targetIds.map(actor)
      canAct(a);if(command.cost!=='none'){if(command.cost==='action'&&a.turn.surgeAction)throw Error('动作如潮不能用于魔法动作');spend(a,command.cost)}
      if(!targets.length)throw Error('请选择实际伤害目标')
      if(command.kind==='attack'){
       const t=targets[0]!,spec:AttackSpec={id:'m5-followup',name:command.spellId,bonus:command.attackBonus,ability:command.ability,modifier:command.modifier,damage:command.formula,type:command.damageType,ranged:command.spellId==='witch-bolt',reach:command.spellId==='witch-bolt'?0:5,range:command.spellId==='witch-bolt'?60:0,longRange:0,weaponId:null,instanceId:null,properties:['spell-attack'],mastery:null,page:0}
       beginAttack(a,t,spec,command.envs[t.id]!,false,false,command.spellId)
      }else {
       const rows=targets.map(t=>{const env=command.envs[t.id]!;targetable(env,10000);const roll=command.save?savingRoll(t,command.save,env,cs,cat,dice):null;return {id:t.id,env,roll,hit:!roll||roll.autoFail||roll.total<command.dc,critical:false,ac:stats(t).ac}})
       e.pending={kind:command.kind,actorId:a.id,name:command.spellId,page:0,spellId:command.spellId,attack:null,targets:rows,damage:[{type:command.damageType,roll:rollDamage(command.formula,dice)}],save:command.save??null,dc:command.save?command.dc:null,half:command.half,effectKey:null,modifier:0,mode:'m5-followup',notes:[],sneak:false,mastery:false,startedAt:e.tick}
      }
      e.pending!.notCasting=true;e.pending!.m5EffectId=command.effectId;detail='原法术后续能力，未重新施法或扣位，等待原伤害／反应结算';break
    }
    case 'scene-flame': {
      noPending()
      const a=actor(command.actorId),t=actor(command.targetId),c=character(a),grant=c?runtimeSpells(c,cat).find(g=>g.key===command.key&&g.spell.id==='produce-flame'):undefined,ability=a.npc?.abilities?.find(b=>b.id===command.key&&b.spellId==='produce-flame')
      if(!grant&&!ability)throw Error('原燃火术能力来源不可用')
      const attr=grant?.ability??ability?.ability??a.npc?.spellcasting?.ability??'wis',mod=stats(a).mods[attr],level=c?.level??a.npc?.spellcasting?.level??1
      const spell=cat.spells.find(s=>s.id==='produce-flame')!
      const spec:AttackSpec={id:'scene-flame',name:spell.name,bonus:c?mod+pbOf(c.build)-stats(a).exhaustion*2:(a.npc?.spellcasting?.attackBonus??mod+(a.npc?.templateMetadata?.proficiencyBonus??2)),ability:attr,modifier:0,damage:(level>=17?4:level>=11?3:level>=5?2:1)+'d8',type:'fire',ranged:true,reach:0,range:60,longRange:60,weaponId:null,instanceId:null,properties:[],mastery:null,page:spell.source.page}
      if(a.turn.surgeAction)throw Error('动作如潮的额外动作不能用于魔法动作')
      spend(a,'action');endInvisibility(a);beginAttack(a,t,spec,command.env,false,false,'produce-flame')
      if(e.pending)e.pending.notCasting=true
      detail='燃火术魔法动作攻击，手中火焰不结束；未重复施法或扣法术位';break
    }
    case 'attack': {
      noPending()
      const holdingActor = actor(command.actorId),
        holdingCharacter = character(holdingActor)
      if (command.handling) {
        own(holdingActor)
        if (!holdingCharacter) throw Error('逐次拔收需要完整角色卡')
        validateHandling(holdingCharacter, cat, command.handling, command.cost)
        for (const op of command.handling.before) runtime(holdingActor, op)
      }
      const a = actor(command.actorId),
        t = actor(command.targetId),
        spec = attackOptions(a, cs, cat).find((x) => x.id === command.attackId)
      if(a.companion?.spellId==='find-familiar')throw Error('普通魔宠不能攻击；链契须主人牺牲攻击并由魔宠使用反应')
      if (!spec) throw new Error('请选择当前可用攻击')
      if (
        spec.ranged &&
        spec.properties.some((p) => p.startsWith('thrown')) &&
        command.handling?.after.some((op) => op.instanceId === spec.instanceId)
      )
        throw Error('已投出的武器不能在攻击后收回手中')
      const method = attackMethods({
        actor: a,
        currentId: e.actors[e.current]?.id,
        active: e.phase === 'active',
        pending: false,
        character: character(a),
        cat,
        spec,
        targetDown: a.turn.lastAttack ? stats(actor(a.turn.lastAttack.targetId)).hp === 0 : false,
      }).find((m) => m.cost === command.cost)
      if (!method?.enabled) throw new Error(method?.reason || '当前没有此攻击方式来源')
      if (
        a.companion?.source === 'primal-companion' &&
        command.cost !== 'opportunity' &&
        a.companion.commandedTick !== e.tick &&
        !stats(actor(a.companion.ownerId)).conditions.includes('incapacitated')
      )
        throw new Error('原初兽须主人附赠动作或替换攻击命令，默认只能回避')
      if (a.companion?.source === 'spell-summon') {
        reason(command.env.note)
        setEffects(
          a,
          effects(a).filter((e) => e.key !== 'dodge'),
        )
      }
      if (
        ['dual', 'pole', 'hew', 'war-priest', 'psychic', 'star', 'agile'].includes(command.cost)
      ) {
        const c = character(a)
        if (!c) throw new Error('此额外攻击须角色使用')
        own(a)
        const last = a.turn.lastAttack
        if (command.cost === 'dual') {
          if (
            !hasFeat(c.build, 'dual-wielder', cat) ||
            !(a.turn.lightWeapons ?? (a.turn.lightWeapon ? [a.turn.lightWeapon] : [])).some(
              (id) => id !== spec.instanceId,
            ) ||
            spec.ranged ||
            spec.properties.includes('two-handed')
          )
            throw new Error('双持客须先攻击过轻型武器，再用另一非双手近战武器')
          if (!hasStyle(c.build, 'two-weapon-fighting', cat))
            spec.modifier = Math.min(0, spec.modifier)
        }
        if (command.cost === 'pole') {
          if (
            !hasFeat(c.build, 'polearm-master', cat) ||
            !last ||
            last.tick !== e.tick ||
            last.weaponId !== spec.weaponId ||
            (!['quarterstaff', 'spear'].includes(spec.weaponId ?? '') &&
              !(spec.properties.includes('heavy') && spec.properties.includes('reach')))
          )
            throw new Error('长柄反端须先以同一合格武器完成攻击动作')
          spec.damage = '1d4'
          spec.type = 'bludgeoning'
        }
        if (
          command.cost === 'hew' &&
          (!hasFeat(c.build, 'great-weapon-master', cat) ||
            !last ||
            last.ranged ||
            last.tick !== e.tick ||
            last.weaponId !== spec.weaponId ||
            !(last.critical || stats(actor(last.targetId)).hp === 0))
        )
          throw new Error('斩击须刚以同一近战武器重击或使目标归零')
        if (command.cost === 'war-priest') {
          if (!hasSubclass(c.build, 'war')) throw new Error('未获得战争祭司')
          const r = runtimeState(c, cat)
          if (!r.resources['war-priest']) throw new Error('战争祭司资源不足')
          r.resources['war-priest']!--
          c.runtime = r
        }
        if (command.cost === 'psychic') {
          const layout = equipmentLayout(c, cat)
          if (
            !hasSubclass(c.build, 'soulknife') ||
            !last ||
            last.weaponId !== 'psychic-blade' ||
            !spec.properties.includes('psychic-blade') ||
            freeHandSlots(c, cat).length < 2
          )
            throw new Error('第二心刃须先使用心刃攻击，另一只手空闲')
          spec.damage = '1d4'
        }
        if (command.cost === 'star' && spec.id !== 'star-arrow')
          throw new Error('星耀射手请选择光箭')
        if (command.cost === 'agile') {
          if (
            !hasSubclass(c.build, 'dance') ||
            spec.id !== 'unarmed' ||
            !a.turn.manualUsed?.includes('dance-ready')
          )
            throw new Error('灵巧打击须刚在动作中消耗激励且无甲无盾')
          a.turn.manualUsed = a.turn.manualUsed.filter((x) => x !== 'dance-ready')
        } else if (command.cost === 'star' && a.turn.manualUsed?.includes('star-ready'))
          a.turn.manualUsed = a.turn.manualUsed.filter((x) => x !== 'star-ready')
        else spend(a, 'bonus')
      } else if (command.cost === 'opportunity') {
        if (stats(a).effects.some((x) => x.key === 'shocking-grasp'))
          throw new Error('电爪效果禁止借机攻击')
        if (
          !command.env.attackerSees ||
          (spec.ranged &&
            !effects(a).some((f) => f.key === 'maneuver-commanded' && f.sourceId !== a.id))
        )
          throw new Error('借机攻击必须看见目标并进行近战攻击')
        reason(command.env.note)
        if (effects(a).some((f) => f.key === 'maneuver-commanded'))
          setEffects(
            a,
            effects(a).map((f) =>
              f.key === 'maneuver-commanded' ? { ...f, key: 'maneuver-commanded-damage' } : f,
            ),
          )
        else spend(a, 'reaction')
      } else if (command.cost === 'flurry') {
        own(a)
        if (spec.id !== 'unarmed' || !(a.turn.flurryLeft ?? 0))
          throw new Error('请先启用疾风连击，并选择徒手打击')
        a.turn.flurryLeft!--
      } else if (command.cost === 'martial') {
        const c = character(a)
        if (
          c?.build.classId !== 'monk' ||
          spec.id !== 'unarmed' ||
          !martialArtsEligible(c, equippedInventory(c, cat), [...cat.items, ...c.build.customItems])
        )
          throw new Error('当前不能进行武艺附赠徒手打击')
        spend(a, 'bonus')
      } else if (command.cost === 'cleave') {
        own(a)
        if (
          a.turn.cleaveUsed ||
          !effects(a).some((x) => x.key === 'cleave-ready') ||
          spec.mastery !== 'Cleave'
        )
          throw new Error('当前没有可用 Cleave 额外攻击')
        reason(command.env.note)
        a.turn.cleaveUsed = true
        setEffects(
          a,
          effects(a).filter((x) => x.key !== 'cleave-ready'),
        )
        spec.modifier = Math.min(0, spec.modifier)
      } else if (command.cost === 'light' || command.cost === 'nick') {
        own(a)
        if (
          a.turn.lightUsed ||
          !(a.turn.lightWeapons ?? (a.turn.lightWeapon ? [a.turn.lightWeapon] : [])).some(
            (id) => id !== spec.instanceId,
          ) ||
          !spec.properties.includes('light')
        )
          throw new Error('轻型额外攻击需要本回合攻击过不同的轻型武器')
        if (command.cost === 'nick') {
          if (spec.mastery !== 'Nick' || a.turn.nickUsed) throw new Error('当前不能使用 Nick')
          a.turn.nickUsed = true
        } else spend(a, 'bonus')
        a.turn.lightUsed = true
        const c = character(a)
        if (
          !c ||
          !(
            hasStyle(c.build, 'two-weapon-fighting', cat) ||
            (hasFeat(c.build, 'crossbow-expert', cat) && !!spec.weaponId?.includes('crossbow'))
          )
        )
          spec.modifier = Math.min(0, spec.modifier)
      } else if(command.cost==='haste'){
        own(a)
        if(!stats(a).effects.some(f=>f.key==='haste')||a.turn.manualUsed?.includes('haste-action'))throw Error('当前没有可用加速攻击')
        a.turn.manualUsed=[...(a.turn.manualUsed??[]),'haste-action']
      } else {
        own(a)
        if ((a.turn.attacksLeft ?? 0) > 0) {
          if (a.turn.npcMultiattackOptions && !a.turn.npcMultiattackOptions.includes(spec.id))
            throw Error('任选多重攻击不允许此攻击')
          if (a.turn.npcMultiattackLeft) {
            const index = a.turn.npcMultiattackLeft.indexOf(spec.id)
            if (index < 0) throw new Error('多重攻击的剩余次数不包含该攻击')
            a.turn.npcMultiattackLeft.splice(index, 1)
          }
          a.turn.attacksLeft!--
          const c = character(a)
          if (c?.build.classId === 'warlock' && one(c.build, 'pact-weapon') !== spec.weaponId)
            throw new Error('渴饮之刃的额外攻击只能使用契约武器')
        } else {
          const c = character(a)
          spend(a, 'action')
          const multi = a.npc?.multiattack
          const choice = a.npc?.multiattackChoice
          delete a.turn.npcMultiattackOptions
          if (choice?.attackIds.includes(spec.id)) {
            a.turn.npcMultiattackOptions = [...choice.attackIds]
            delete a.turn.npcMultiattackLeft
          }
          if (multi?.includes(spec.id)) {
            if (multi.some((id) => !a.npc!.attacks.some((attack) => attack.id === id)))
              throw new Error('多重攻击引用了未知攻击')
            a.turn.npcMultiattackLeft = [...multi]
            a.turn.npcMultiattackLeft.splice(a.turn.npcMultiattackLeft.indexOf(spec.id), 1)
          } else delete a.turn.npcMultiattackLeft
          a.turn.attacksLeft = a.turn.npcMultiattackLeft
            ? a.turn.npcMultiattackLeft.length
            : a.turn.npcMultiattackOptions && choice
              ? choice.count - 1
              : c &&
                  c.level >= 5 &&
                  (['barbarian', 'fighter', 'monk', 'paladin', 'ranger'].includes(
                    c.build.classId,
                  ) ||
                    (hasInvocation(c.build, 'thirsting') &&
                      one(c.build, 'pact-weapon') === spec.weaponId))
                ? 1
                : c?.runtime?.wildShape?.formId === 'brown-bear'
                  ? 1
                  : a.companion?.source === 'spell-summon'
                    ? Math.max(0, Math.floor((a.companion.slotLevel ?? 2) / 2) - 1)
                    : 0
        }
        if (spec.properties.includes('light') && spec.instanceId) {
          a.turn.lightWeapons = [
            ...new Set([
              ...(a.turn.lightWeapons ?? (a.turn.lightWeapon ? [a.turn.lightWeapon] : [])),
              spec.instanceId,
            ]),
          ]
          a.turn.lightWeapon = spec.instanceId
        }
      }
      if (command.cost === 'action' && character(a)?.runtime?.wildShape?.formId === 'brown-bear') {
        const key = 'brown-multiattack:' + spec.id
        if (a.turn.manualUsed?.includes(key))
          throw new Error('棕熊多重攻击须啃咬与利爪各一次，不能重复同一项')
        a.turn.manualUsed = [...(a.turn.manualUsed ?? []), key]
      }
      if (
        spec.properties.includes('loading') &&
        !(
          character(a) &&
          hasFeat(character(a)!.build, 'crossbow-expert', cat) &&
          spec.weaponId?.includes('crossbow')
        )
      ) {
        const loadingCost = ['light', 'martial'].includes(command.cost)
          ? 'bonus'
          : command.cost === 'opportunity'
            ? 'reaction'
            : 'action'
        const loadingKey = `${spec.instanceId}:${loadingCost}`
        if (a.turn.loading.includes(loadingKey))
          throw new Error('装填武器在同一动作、附赠动作或反应中只能发射一次')
        a.turn.loading.push(loadingKey)
      }
      beginAttack(a, t, spec, command.env, command.sneak, command.mastery)
      if (command.handling?.after.length) e.pending!.afterWeapon = clone(command.handling.after)
      if (command.cost === 'action') e.pending!.triggered = ['attack-action']
      break
    }
    case 'npc-resource-restore': {
      noPending()
      const n = actor(command.actorId).npc
      if (!n) throw Error('此入口只用于怪物资源')
      reason(command.note)
      if (command.resourceId && !n.resources?.some((r) => r.id === command.resourceId))
        throw Error('资源池不存在')
      restoreNpcResources(n, command.recovery, command.resourceId)
      detail = `${n.name}：GM${command.resourceId ? '强制恢复指定资源' : '推进每日／手动恢复节点'}；${command.note}`
      break
    }
    case 'npc-concentration': {
      active()
      noPending()
      const a = actor(command.actorId),
        n = a.npc
      if (!n?.concentration) throw Error('NPC当前没有维持专注')
      if (command.end) {
        delete n.concentration
        detail = n.name + '主动结束专注'
      } else {
        const dc = n.concentration.pendingDC
        if (!dc) throw Error('NPC当前没有待处理的专注豁免')
        const roll = savingRoll(a, 'con', defaultEnvironment(), cs, cat, dice, 'concentration')
        if (roll.autoFail || roll.total < dc) delete n.concentration
        else delete n.concentration.pendingDC
        detail = `${n.name}专注豁免${roll.total}/DC${dc}：${n.concentration ? '维持' : '结束'}`
      }
      cleanup()
      break
    }
    case 'npc-ability': {
      noPending()
      const a = actor(command.actorId),
        n = a.npc
      if (!n) throw Error('此入口只用于怪物能力')
      if (n.concentration?.pendingDC) throw Error('请先处理NPC专注豁免')
      const ability = n.abilities?.find((x) => x.id === command.abilityId)
      if (!ability || !abilityAvailable(n, ability.id))
        throw Error('怪物能力不存在、未支持或次数不足')
      const spatialReaction=!!command.m3WorldId&&ability.spellId==='feather-fall'
      if(spatialReaction)canAct(a);else own(a)
      if (ability.cost === 'reaction'&&!spatialReaction) throw Error('反应请在对应待结算窗口使用')
      if (ability.support === 'gm' && !command.confirmed)
        throw Error('此能力需要GM确认按原书处理效果')
      if (ability.support === 'gm') reason(command.note)
      const spell = ability.spellId ? cat.spells.find((s) => s.id === ability.spellId) : undefined
      if(spell&&(isM5Appendix(spell.id)||spellWorkflowPolicy(spell.id))&&(ability.slotLevel??spell.level)<spell.level)throw Error('实际NPC施法环位低于法术最低环级')
      if(spell)assertHitSpellLink(e,command.attackWindowId,a.id,spell.id)
      if(spell&&isM5HitSpell(spell.id)&&!command.attackWindowId)throw Error('此法术须从未结算攻击的真实命中后窗口施放')
      if (ability.spellId && !spell) throw Error('怪物法术规则依赖缺失')
      if(spell&&isZoneSpell(spell.id)&&!command.sceneEffectCastId)throw Error('此持续伤害区域请使用完整施法角色卡与区域入口；模板能力不能只扣次数而省略区域')
      if(spell&&M1_UTILITY_SPELLS.includes(spell.id)&&spell.id!=='aura-of-vitality')
        throw Error('此高影响法术需要完整角色卡和M1专用材料／遗体结算，不以模板能力登记代替实际效果')
      if(spell&&isM5WorldSpell(spell.id)&&!command.sceneEffectCastId)throw Error('此法术须使用M5持续能力／实际物件入口')
      const targets = command.targetIds.map(actor)
      if(spell?.id==='pass-without-trace'&&!targets.some(t=>t.id===a.id))targets.push(a)
      if(spell)validateControlTargets(spell.id,targets,cs)
      if (new Set(command.targetIds).size !== command.targetIds.length) throw Error('怪物法术目标不能重复')
      const slot = ability.slotLevel ?? (spell ? spell.level : 0),
        profile = spell ? spellEffect(spell.id, n.spellcasting?.level??1, slot || 1) : null
      if((command.m3WorldId||command.sceneEffectCastId||command.summonDraftId)&&profile){profile.kind='buff';profile.count=100;profile.area=false;profile.dice=undefined;profile.effect=undefined;profile.save=undefined}
      if (spell && !targets.length) throw Error('请选择法术目标')
      if(spell&&['magic-weapon','elemental-weapon'].includes(spell.id)){if(targets.length!==1)throw Error('须一个实际武器持有人');validateEnchantment(targets[0]!,cs,cat,command.weaponId,spell.id,a.characterId??a.npcId??a.id);if(spell.id==='elemental-weapon'&&!['acid','cold','fire','lightning','thunder'].includes(command.damageType??''))throw Error('请选择合法元素')}
      if(spell?.id==='vicious-mockery'&&!command.env.attackerSees&&command.env.attackerHears===false)throw Error('恶言相加须来源实际看见或听见目标')
      if(spell?.id==='hex'&&!ABILITIES.includes(command.supportChoice as Ability))throw Error('请选择脆弱诅咒属性')
      if(spell?.id==='shillelagh'){const weapon=actualWeapon(a,cs,cat,command.weaponId);if(!weapon.gear?.held||!['club','quarterstaff'].includes(weapon.item.id)||!n.attacks.some(at=>weapon.gear!.attackIds.includes(at.id)&&at.ability))throw Error('NPC须已登记、持握且核实攻击属性的短棒／长棍')}
      if (profile?.area && !command.confirmed) throw Error('范围法术目标名单需GM确认')
      if (profile?.count && targets.length > profile.count) throw Error('超过法术目标数量')
      if (spell) {
        validateSupportSpell(spell.id,command)
        validateControlSelection(spell.id,command,targets.map(t=>t.id))
        if(M4_EXCLUSIVE_SCENE_SPELLS.includes(spell.id as typeof M4_EXCLUSIVE_SCENE_SPELLS[number])&&!command.sceneEffectCastId)throw Error('此法术请使用“持续区域 · 光照与遮蔽”入口登记实际光源与位置');
      if(M3_EXCLUSIVE_WORLD_SPELLS.includes(spell.id)&&!command.m3WorldId)throw Error('该法术须使用空间／物件施法入口登记真实目标及环境')
      if(!command.m3WorldId){validateM3Choice(spell.id,command.m3Choice);validateM3Willing(spell.id,command.willing,targets.some(t=>t.id!==a.id))}
      breakDuelsForSpell(a,targets,spell.id!=='calm-emotions'&&['attack','save','automatic'].includes(profile!.kind)&&!!(profile!.dice||profile!.effect))
        if(command.dispelZoneId){if(spell.id!=='dispel-magic'||targets.length!==1||targets[0]!.id!==a.id||!e.zones?.some(z=>z.id===command.dispelZoneId))throw Error('请选择实际魔法区域与解除魔法来源');targetable(command.env,120);reason(command.note)}
        if (spell.id === 'warding-bond' && targets.some(t=>t.id===a.id))
          throw Error('守护之链须选择另一名生物')
        const range = /touch/i.test(spell.range) ? 5 : Number(spell.range.match(/\d+/)?.[0] ?? 0)
        for (const t of targets)
          if (t.id !== a.id)
            targetable(
              command.targetEnvironments?.[t.id] ?? command.env,
              range || 10000,
              !!profile?.area,
              ['healing-word', 'hold-person', 'blindness-deafness', 'command'].includes(spell.id),
            )
        if (
          spell.id === 'hold-person' &&
          targets.some(t=>actorCreatureType(t,cs,true)!=='humanoid')
        )
          throw Error('人类定身术需要类人生物目标')
        if (
          spell.id === 'invisibility' &&
          targets.some((t) => t.id !== a.id) &&
          n.templateMetadata?.englishName === 'Imp'
        )
          throw Error('小魔鬼隐形只能作用于自身')
        if (spell.id === 'invisibility' && targets.length > (profile?.count??1))
          throw Error('此怪物隐形术的环级只能选择一个目标')
        if (
          ability.support === 'automatic' &&
          spell.id !== 'invisibility' &&
          !['heal', 'buff', 'save', 'automatic'].includes(profile!.kind) && !isM5Spell(spell.id)&&!isM5Appendix(spell.id)&&!spellWorkflowPolicy(spell.id)
        )
          throw Error('此法术效果需要GM裁定入口')
      }
      if(spatialReaction)spend(a,'reaction');else if (ability.cost !== 'none') spend(a, ability.cost)
      consumeNpcAbility(n, ability.id)
      if(spell)setEffects(a,effects(a).filter(f=>f.key!=='sanctuary'))
      endInvisibility(a)
      if(spell&&slowed(stats(a).effects)&&/(^|[,\s])S([,\s(]|$)/.test(spell.components)&&checkedDie(dice,4)===1){if(spell.concentration)delete n.concentration;detail='缓慢术使NPC姿势成分施法失败，动作与实际次数已消耗';cleanup();break}
      if (spell?.concentration) {
        delete n.concentration
        cleanup()
        const duration = spell.duration.match(/(\d+)\s+(minute|hour)/i),
          rounds = duration
            ? Number(duration[1]) * (duration[2]!.toLowerCase() === 'hour' ? 600 : 10)
            : 1
        n.concentration = {
          spellId: spell.id,
          castId:crypto.randomUUID(),
          clockSourceId:cs[0]?.id,
          endsAt:cs[0]?(runtimeState(cs[0],cat).hours+(['hex','hunter-s-mark'].includes(spell.id)?slot>=3?8:spell.id==='hex'&&slot===2?4:1:rounds/600)):undefined,
          expiresAt: expires(a,['hex','hunter-s-mark'].includes(spell.id)?(slot>=3?8:spell.id==='hex'&&slot===2?4:1)*600:rounds).expiresAt,
          encounterId: e.id,
        }
      }
      if (ability.id === 'shape-shift') {
        if (!command.shape) throw Error('请选择小魔鬼形态')
        n.shape = command.shape
        n.speed = 20
      }
      if (!spell || ability.support === 'gm'&&!command.summonDraftId&&!command.attackWindowId&&!command.m3WorldId&&!command.sceneEffectCastId&&!isM5Spell(spell.id)&&!isM5Appendix(spell.id)&&!spellWorkflowPolicy(spell.id)&&!(M3_NATIVE_SPELLS as readonly string[]).includes(spell.id)) {
        detail = `${n.name}使用${ability.name}，预算／次数已登记；效果仍需GM裁定：${command.note || ability.note}`
        break
      }
      if(!command.m3WorldId){validateM3Choice(spell.id,command.m3Choice);validateM3Willing(spell.id,command.willing,targets.some(t=>t.id!==a.id))}
      const mod = stats(a).mods[ability.ability ?? n.spellcasting?.ability ?? 'wis']
      if(spell.id==='divine-smite'&&targets.some(t=>['fiend','undead'].includes(actorCreatureType(t,cs,true)??'')))profile!.dice=((slot||1)+2)+'d8'
      if(spell.id==='lightning-arrow'){const parent=e.attackParents?.at(-1);if(!command.attackWindowId||!parent)throw Error('闪电箭矢须真实远程攻击窗口');const ids=command.areaTargets??command.targetIds,envs=command.areaEnvironments??command.targetEnvironments??Object.fromEntries(ids.map(id=>[id,command.env]));e.pending=lightningReplacement(e,a,parent,ids.map(actor),envs,slot,n.spellcasting?.dc??8+(n.templateMetadata?.proficiencyBonus??2)+mod,cs,cat,dice);e.pending.attackWindowId=command.attackWindowId;detail='NPC闪电箭矢替换原攻击，未结算原伤害';break}
      if(profile?.kind==='attack'){
       let spec:AttackSpec={id:spell.id,name:spell.name,bonus:n.spellcasting?.attackBonus??mod+(n.templateMetadata?.proficiencyBonus??2),ability:ability.ability??n.spellcasting?.ability??'wis',modifier:0,damage:profile.dice??'0',type:profile.type??'force',ranged:spell.range!=='Touch'&&spell.id!=='thorn-whip',reach:spell.id==='thorn-whip'?30:5,range:Number(spell.range.match(/\d+/)?.[0]??0),longRange:0,weaponId:null,instanceId:null,properties:['spell-attack'],mastery:null,page:spell.source.page}
       if(spell.id==='true-strike'){const weapon=attackOptions(a,cs,cat).find(w=>w.instanceId===command.weaponId&&w.weaponId);if(!weapon||!weapon.abilityKnown||!n.equipment?.find(g=>g.id===weapon.instanceId)?.proficient||(cat.items.find(i=>i.id===weapon.weaponId)?.cost??0)<.01)throw Error('NPC克敌机先须已登记且明确熟练、价值至少1CP的武器和原攻击属性');const oldModifier=Math.floor((n.scores[weapon.ability]-10)/2);spec={...weapon,bonus:weapon.bonus-oldModifier+mod,damage:replaceNpcWeaponModifier(weapon.damage,weapon.modifier?0:oldModifier),modifier:mod,type:command.damageType==='radiant'?'radiant':weapon.type}}
       beginAttack(a,targets[0]!,spec,command.targetEnvironments?.[targets[0]!.id]??command.env,false,false,spell.id);if(e.pending){if(spell.id==='ice-knife')e.pending.iceBurst={targetIds:command.areaTargets??[targets[0]!.id],envs:command.areaEnvironments??Object.fromEntries(targets.map(t=>[t.id,command.env])),slot,dc:n.spellcasting?.dc??8+(n.templateMetadata?.proficiencyBonus??2)+mod};e.pending.effectKey=profile.effect??null;e.pending.modifier=mod;e.pending.slotLevel=slot;e.pending.sourceKey='npc:'+ability.id}detail=n.name+'施放'+spell.name+'，等待攻击结算';break
      }
      e.pending = {
        kind: profile!.kind === 'save' ? 'save' : profile!.kind==='manual'?'manual':'automatic',
        actorId: a.id,
        name: spell.name,
        page: spell.source.page,
        spellId: spell.id,gmChoice:command.gmChoice,
        sourceKey: 'npc:' + ability.id,dispelZoneId:command.dispelZoneId,
        boundWeaponId:command.weaponId,
        slotLevel: slot,
        attack: null,
        targets: targets.map((t) => ({
          id: t.id,
          env: clone(command.targetEnvironments?.[t.id] ?? command.env),
          roll: null,
          hit: true,
          critical: false,
          ac: stats(t).ac,
        })),
        damage: profile!.dice
          ? [{ type: profile!.type ?? 'radiant', roll: rollDamage(profile!.dice, dice, hitSpellCritical(e,command.attackWindowId)) }]
          : [],
        save: profile!.save ?? null,
        dc: profile!.save
          ? (n.spellcasting?.dc ?? 8 + (n.templateMetadata?.proficiencyBonus ?? 2) + mod)
          : null,
        half: profile!.half ?? false,
        effectKey: profile!.effect ?? null,
        m3WorldId:command.m3WorldId,sceneEffectCastId:command.sceneEffectCastId,summonDraftId:command.summonDraftId,
        m3Choice:command.m3Choice,
        supportChoice: command.supportChoice,
        controlChoices:command.controlChoices,controlTargets:command.controlTargets,controlText:command.controlText,
        modifier: mod,
        mode: profile!.kind,
        notes: spell.id==='shillelagh'?[command.weaponId??'',ability.ability??n.spellcasting?.ability??'wis',command.damageType??'original']:['',command.damageType??'fire'],
        sneak: false,
        mastery: false,
        startedAt: e.tick,
      }
      if(profile!.dice&&['save','automatic'].includes(profile!.kind)&&!profile!.area)guardSanctuary(e.pending,a)
      if(profile!.save)for(const victim of e.actors)setEffects(victim,effects(victim).filter(f=>!(f.key==='friends'&&sourceMatches(f.sourceId,a))))
      if(profile!.save)for(const target of e.pending.targets){
        if(target.sanctuaryBlocked||(['levitate','enlarge-reduce'].includes(spell.id)&&command.willing))continue
        const t=actor(target.id)
        if(spell.id==='friends'){const stable=t.characterId??t.npcId??t.id,clock=cs[0],hours=clock?runtimeState(clock,cat).hours:undefined;if(hours===undefined)throw Error('NPC交友术需要已登记的游戏时钟以核对24小时限制');const recent=n.effects.some(f=>f.socialTargetId===stable&&f.key.startsWith('friends-history:')&&(f.endsAt??0)>hours);n.effects=n.effects.filter(f=>!(f.socialTargetId===stable&&f.key.startsWith('friends-history:')));n.effects.push({id:crypto.randomUUID(),key:'friends-history:'+stable,socialTargetId:stable,name:'交友术施放记录',sourceId:a.id,page:spell.source.page,concentration:false,expiresAt:null,encounterId:'outside',phase:'start',clockSourceId:clock!.id,endsAt:hours+24,visibility:'owner',note:'包含豁免成功的施放'});if(recent){target.hit=false;continue}}
        if(controlAutoSave(spell.id,a,t,cs,e.phase==='active')){target.hit=false;continue}
        const roll=savingRoll(t,profile!.save,spell.id==='ensnaring-strike'&&!withinSize(t,'medium')?{...target.env,advantage:true}:spell.id==='charm-person'&&t.side!==a.side&&t.side!=='neutral'&&a.side!=='neutral'?{...target.env,advantage:true}:target.env,cs,cat,dice,
          ['friends','charm-person','animal-friendship','hypnotic-pattern','crown-of-madness','suggestion'].includes(spell.id)?'charm':'normal')
        target.roll=roll;target.hit=roll.autoFail||roll.total<e.pending.dc!
      }
      if(command.attackWindowId){e.pending!.attackWindowId=command.attackWindowId;if(spell&&isM5HitSpell(spell.id))e.pending!.damageAlways=true}
      detail = `${n.name}使用${ability.name}：已扣怪物预算／次数，等待原流程豁免及效果结算`
      break
    }
    case 'npc-reaction': {
      active()
      const a = actor(command.actorId),
        n = a.npc,
        p = e.pending,
        entry = p?.targets[command.targetIndex]
      const ability = n?.abilities?.find((x) => x.id === command.abilityId)
      if (
        !n ||
        !ability ||
        !abilityAvailable(n, ability.id) ||
        ability.cost !== 'reaction' ||
        !p ||
        p.damageRolled
      )
        throw Error('怪物反应或窗口不可用')
      if (!command.confirmed) throw Error('请GM确认反应触发条件')
      reason(command.note)
      if (ability.support === 'gm'||ability.reaction==='counterspell') {
        if (
          ability.reaction === 'redirect' &&
          (!entry || entry.id !== a.id || p.kind !== 'attack' || !entry.hit)
        )
          throw Error('转移攻击须响应自身被命中的攻击')
        if (ability.reaction === 'counterspell' && (!p.spellId||p.notCasting))
          throw Error('法术反制须响应实际法术的待结算窗口')
        if (!['redirect', 'counterspell'].includes(ability.reaction ?? ''))
          throw Error('此GM反应没有登记支持')
        spend(a, 'reaction')
        consumeNpcAbility(n, ability.id)
        if(ability.reaction==='counterspell'){
          setEffects(a,effects(a).filter(f=>f.key!=='sanctuary'))
          endInvisibility(a)
          pushReaction(a,'counterspell','npc:'+ability.id,ability.slotLevel??3,n.spellcasting?.dc??8+(n.templateMetadata?.proficiencyBonus??2)+stats(a).mods[n.spellcasting?.ability??'int'],command.env??{...defaultEnvironment(),note:command.note})
          break
        }
        detail = `${n.name}登记${ability.name}：已扣反应／共用次数；没有改变原结算，GM须另行按原书裁定：${command.note}`
        break
      }
      if (!entry || entry.id !== a.id || (p.kind !== 'attack' && p.spellId !== 'magic-missile'))
        throw Error('此反应必须响应自身被攻击的待结算窗口')
      if(p.attackLocked||p.damageRolled)throw Error('命中窗口已锁定或已掷伤害，不能再改变命中')
      if (ability.reaction === 'parry' && (p.kind !== 'attack' || !entry.hit || p.attack?.ranged))
        throw Error('格挡只响应命中的近战攻击')
      if (!['parry', 'shield'].includes(ability.reaction ?? ''))
        throw Error('此复杂反应仍需GM裁定，不能在此自动结算')
      if (ability.reaction === 'shield' && p.kind === 'attack' && !entry.hit)
        throw Error('护盾术须响应命中')
      spend(a, 'reaction')
      consumeNpcAbility(n, ability.id)
      const bonus = ability.reaction === 'parry' ? 2 : 5
      if(ability.reaction==='shield')setEffects(a,effects(a).filter(f=>f.key!=='sanctuary'))
      if (ability.reaction === 'parry') entry.acBonus = (entry.acBonus ?? 0) + 2
      if (ability.reaction === 'shield'){endInvisibility(a);pushReaction(a,'shield','npc:'+ability.id,ability.slotLevel??1);detail=n.name+'反应施放护盾术，原攻击已保存';break}
      entry.ac += bonus
      if (entry.roll) {
        entry.hit =
          entry.roll.chosen === 20 || (entry.roll.chosen !== 1 && entry.roll.total >= entry.ac)
        if (!entry.hit) entry.critical = false
      }
      detail = `${n.name}使用${ability.name}：反应及共用次数扣除，待结算AC更新`
      break
    }
    case 'escape-vines': {
      noPending();const a=actor(command.actorId),t=actor(command.targetId),f=effects(t).find(f=>f.id===command.effectId&&f.key==='ensnaring-strike')
      if(!f?.startDamage)throw Error('诱捕藤蔓已经结束')
      if(a.id!==t.id)targetable(command.env,5)
      spend(a,'action');const c=character(a);let total:number
      if(c){runtime(a,{type:'check',kind:'skill',id:'athletics',dc:f.startDamage.dc,context:{advantage:command.env.advantage,disadvantage:command.env.disadvantage}});total=runtimeState(character(a)!,cat).advanced.lastCheck!.total}
      else {total=d20(stats(a).mods.str,[],[],dice).total}
      const success=total>=f.startDamage.dc;if(success)setEffects(t,effects(t).filter(x=>x.id!==f.id));outcomes.push({actorId:a.id,kind:'check',total,success});detail='诱捕脱困运动 '+total+'/DC '+f.startDamage.dc;break
    }
    case 'transfer-mark': {
     noPending();const a=actor(command.actorId),t=actor(command.targetId),old=e.actors.find(t=>effects(t).some(f=>f.id===command.effectId)),f=old&&effects(old).find(f=>f.id===command.effectId)
     if(!old||!f||!['hex','hunter-s-mark'].includes(f.key)||!sourceMatches(f.sourceId,a)||stats(old).hp!==0)throw Error('须本人仍有效且原目标已归零的印记')
     if(f.key==='hex'&&f.m5AppliedTick===e.tick)throw Error('脆弱诅咒须后续回合转移')
     targetable(command.env,90,false,true);spend(a,'bonus');setEffects(old,effects(old).filter(v=>v.id!==f.id));setEffects(t,[...effects(t),{...f,id:crypto.randomUUID()}]);detail='原来源印记转移，保留期限和专注，未重新扣法术位';break
    }
    case 'hit-spell': throw Error('请从命中窗口提交')
    case 'cast': {
      const lightningOriginal = command.attackWindowId&&e.attackWindows?.some(w=>w.id===command.attackWindowId&&w.spellId==='lightning-arrow')?clone(e.attackParents!.at(-1)!):null
      if (!lightningOriginal) noPending()
      const a = actor(command.actorId),
        c = character(a)
      if (!c) throw new Error('NPC 施法请使用 GM 裁定入口')
      const grant = runtimeSpells(c, cat).find((g) => g.key === command.key)
      if (!grant) throw new Error('法术来源不可用')
      assertHitSpellLink(e,command.attackWindowId,a.id,grant.spell.id)
      if(isM5HitSpell(grant.spell.id)&&!command.attackWindowId)throw Error('此法术须从未结算攻击的真实命中后窗口施放')
      const spell = grant.spell,
        wildMaximum = effects(a).find((f) => f.key === 'wild-max-damage'),
        wildSaveDis = effects(a).find((f) => f.key === 'wild-save-disadvantage'),
        meta = command.metamagic,
        effectiveSlot = castSlotLevel(command.mode) + (meta?.option === 'twinned' ? 1 : 0),
        profile = spellEffect(spell.id, grant.item?.casterLevel ?? c.level, effectiveSlot || spell.level || 1),
        targets = command.targets.map(actor)
      if(isM5WorldSpell(spell.id)&&!command.sceneEffectCastId)throw Error('此法术须使用M5持续能力／实际物件入口')
      if(command.m3WorldId||command.sceneEffectCastId||command.summonDraftId){profile.kind='buff';profile.count=100;profile.area=false;profile.dice=undefined;profile.effect=undefined;profile.save=undefined}
      if(spell.id==='pass-without-trace'&&!targets.some(t=>t.id===a.id))targets.push(a)
      validateControlTargets(spell.id,targets,cs)
      breakDuelsForSpell(a,targets,spell.id!=='calm-emotions'&&['attack','save','automatic'].includes(profile.kind)&&!!(profile.dice||profile.effect))
      if(M1_UTILITY_SPELLS.includes(spell.id)&&spell.id!=='aura-of-vitality')throw Error('此法术请由GM使用“M1遗体、物件与光环结算”入口，避免仅扣资源而遗漏实际效果')
      if(command.dispelZoneId){
        if(spell.id!=='dispel-magic'||targets.length!==1||targets[0]?.id!==a.id||!e.zones?.some(z=>z.id===command.dispelZoneId))throw Error('请选择本遭遇实际存在的魔法区域，并使用解除魔法来源')
        targetable(command.env,120,false)
        reason(command.env.note)
      }
      if(!command.m3WorldId){validateM3Choice(spell.id,command.m3Choice);validateM3Willing(spell.id,command.willing,targets.some(t=>t.id!==a.id))}
      if((M3_EXCLUSIVE_WORLD_SPELLS.includes(spell.id)||M4_EXCLUSIVE_SCENE_SPELLS.includes(spell.id as typeof M4_EXCLUSIVE_SCENE_SPELLS[number]))&&!command.m3WorldId&&!command.sceneEffectCastId)throw Error('此法术需要实际空间／物件施法入口')
      validateSupportSpell(spell.id, command)
      validateControlSelection(spell.id,command,targets.map(t=>t.id))
      if (spell.id === 'warding-bond' && targets.some(t => t.id === a.id))
        throw Error('守护之链须选择另一名生物')
      if (
        spell.id === 'hold-person' &&
        command.targets
          .map(actor)
          .some(t=>actorCreatureType(t,cs,true)!=='humanoid')
      )
        throw Error('定身类人需要已登记的类人生物目标')
      if (
        spell.id === 'shillelagh' &&
        !attackOptions(a, cs, cat).some(
          (w) => w.id === command.weaponId && ['club', 'quarterstaff'].includes(w.weaponId ?? ''),
        )
      )
        throw Error('请先选择当前手持木棒或长棍武器')
      if (
        ['attack', 'save', 'automatic'].includes(profile.kind) &&
        (profile.dice || profile.effect) &&
        targets.some((target) =>
          effects(a).some(
            (f) =>
              f.condition === 'charmed' && charmEffective(stats(a).effects) && stats(a).conditions.includes('charmed') &&
              (sourceMatches(f.sourceId, target) ||
                f.charmSources?.some((id) => sourceMatches(id, target))),
          ),
        )
      )
        throw new Error('魅惑状态禁止以伤害或有害法术影响魅惑来源')
      if (
        hasSubclass(c.build, 'great-old-one') &&
        /^(class-|subclass:|tome-)/.test(grant.key) &&
        command.damageType === 'psychic'
      )
        profile.type = 'psychic'
      if (
        spell.id === 'lightning-arrow' &&
        (!lightningOriginal ||
          lightningOriginal.kind !== 'attack' ||
          lightningOriginal.actorId !== a.id ||
          !lightningOriginal.attack?.ranged ||
          !lightningOriginal.attack.weaponId)
      )
        throw new Error(
          '闪电箭矢须在自己的武器远程攻击待结算窗口替换伤害；不能在原伤害扣除后重复加伤',
        )
      if (
        [
          'hail-of-thorns',
          'thunderous-smite',
          'wrathful-smite',
          'blinding-smite',
          'searing-smite',
        ].includes(spell.id) && !command.attackWindowId
      ) {
        const last = a.turn.lastAttack
        if (
          !command.triggerConfirmed ||
          !last ||
          !last.hit ||
          last.tick !== e.tick ||
          !command.targets.includes(last.targetId) ||
          e.log.at(-1)?.kind !== 'resolve'
        )
          throw new Error('须刚完成符合条件的命中，并由 GM 确认立即触发')
        if (
          spell.id === 'hail-of-thorns' &&
          (!last.weaponId ||
            !cat.items.find((i) => i.id === last.weaponId)?.category?.endsWith('ranged'))
        )
          throw new Error('荆棘之雨须远程武器命中，投掷近战武器不满足此 2024 条文')
        if (spell.id !== 'hail-of-thorns' && (last.ranged || !(last.weaponId || last.unarmed)))
          throw new Error('此惩击须近战武器或徒手命中')
      }
      if (meta) {
        validateMetamagic(c, spell, castSlotLevel(command.mode), meta, command.targets)
        if (
          meta.protectedIds.length > Math.max(1, stats(a).mods.cha) ||
          meta.protectedIds.includes(a.id)
        )
          throw new Error('谨慎法术只能保护至多魅力调整值（至少 1）名其他生物')
      }
      if (a.turn.quickenedCast && spell.level > 0)
        throw new Error('快捷法术后本回合不能再施放一环及以上法术')
      if (meta?.option === 'quickened' && a.turn.levelSpellCast)
        throw new Error('本回合已施放一环及以上法术，不能使用快捷法术')
      if (!targets.length) throw new Error('请选择目标')
      if (
        new Set(command.targets).size !== command.targets.length &&
        !['magic-missile', 'eldritch-blast', 'scorching-ray'].includes(spell.id)
      )
        throw new Error('目标不能重复')
      if (TWINNABLE.includes(spell.id) && !['bane', 'bless'].includes(spell.id))
        profile.count = 1 + Math.max(0, (effectiveSlot || spell.level) - spell.level)
      if (isZoneSpell(spell.id)) {
        profile.kind = 'buff'
        profile.count = 100
        profile.dice = undefined
        profile.save = undefined
        profile.effect = undefined
      }
      if (
        command.excludedIds?.length &&
        !['spirit-guardians', 'cordon-of-arrows'].includes(spell.id)
      )
        throw new Error('此法术不能指定持续区域豁免名单')
      if (command.excludedIds?.some((id) => !e.actors.some((a) => a.id === id)))
        throw new Error('区域豁免目标不存在')
      if (profile.count && targets.length > profile.count)
        throw new Error('超过当前施放环级的目标数量')
      if (command.ammunition && spell.id !== 'cordon-of-arrows')
        throw new Error('弹药配置仅用于警戒箭阵')
      if (spell.id === 'cordon-of-arrows'&&!command.sceneEffectCastId) {
        const ammo = command.ammunition,
          row = c.inventory.find((x) => x.instanceId === ammo?.instanceId)
        if (!ammo || !row || !['arrow', 'bolt'].includes(row.itemId))
          throw new Error('请选择背包中的非魔法箭矢或弩矢')
        integer(ammo.count, 1, 4 + 2 * Math.max(0, effectiveSlot - 2))
        if (ammo.count > row.quantity) throw new Error('警戒箭阵弹药不足')
      }
      if (['magic-weapon', 'elemental-weapon'].includes(spell.id)) {
        if(targets.length!==1)throw Error('附魔只选择一件武器的持有人')
        validateEnchantment(targets[0]!,cs,cat,command.weaponId,spell.id,a.characterId??a.npcId??a.id)
        if (
          spell.id === 'elemental-weapon' &&
          !['acid', 'cold', 'fire', 'lightning', 'thunder'].includes(command.damageType)
        )
          throw new Error('元素武器须选择五种允许的元素伤害之一')
      }
      if (command.hitDice !== undefined && spell.id !== 'arcane-vigor')
        throw new Error('生命骰数量参数仅用于复苏秘法')
      if (spell.id === 'arcane-vigor') {
        const r = runtimeState(c, cat),
          count = integer(command.hitDice ?? Math.min(2, r.hitDice), 1, effectiveSlot || 2)
        if (count > r.hitDice) throw new Error('复苏秘法：生命骰不足')
        if (targets.length !== 1 || targets[0]!.id !== a.id) throw new Error('复苏秘法只能治疗自身')
        profile.dice = count + 'd' + cat.classes.find((cl) => cl.id === c.build.classId)!.hitDie
      }
      if (
        spell.id === 'toll-the-dead' &&
        targets[0] &&
        stats(targets[0]).hp < stats(targets[0]).maxHp
      )
        profile.dice = (c.level >= 5 ? 2 : 1) + 'd12'
      if(spell.id==='divine-smite'&&targets.some(t=>['fiend','undead'].includes(actorCreatureType(t,cs,true)??'')))profile.dice=(effectiveSlot+2)+'d8'
      if (!profile.area && !profile.count && targets.length > 1)
        throw new Error('此法术当前只能选择一个目标')
      const trueWeapon =
        spell.id === 'true-strike'
          ? attackOptions(a, cs, cat).find((w) => w.id === command.weaponId)
          : null
      const match = spell.range.match(/(\d+) feet/),
        baseRange = match
          ? Number(match[1])
          : spell.range === 'Touch'
            ? 5
            : profile.area
              ? 10000
              : 0,
        range =
          meta?.option === 'distant' ? (spell.range === 'Touch' ? 30 : spellRangeFeet(spell.id,spell.range,c.level,baseRange) * 2) : spellRangeFeet(spell.id,spell.range,c.level,baseRange)
      const cost =
        meta?.option === 'quickened'
          ? 'bonus'
          : /Reaction/i.test(spell.castingTime)
            ? 'reaction'
            : /Bonus Action/i.test(spell.castingTime)
              ? 'bonus'
              : 'action'
      if (
        cost === 'reaction' ||
        /immediately after/i.test(spell.castingTime) ||
        HIT_TRIGGER_SPELLS.includes(spell.id)
      ) {
        if (!command.triggerConfirmed) throw new Error('请由 GM 确认反应或命中后的触发时机')
        reason(command.env.note)
      }
      if(spell.id==='hex'&&!ABILITIES.includes(command.supportChoice as Ability))throw Error('脆弱诅咒须选择属性检定劣势的属性')
      if (spell.id === 'shield') throw new Error('Shield 请在待结算窗口使用')
      if (
        spell.id === 'hellish-rebuke' &&
        (!e.lastDamage ||
          e.lastDamage.actorId !== a.id ||
          e.lastDamage.sourceId !== targets[0]!.id ||
          e.lastDamage.tick !== e.tick)
      )
        throw new Error('Hellish Rebuke 需要本回合刚受到该目标的伤害')
      for (const t of targets)
        if (t.id !== a.id)
          targetable(
            command.targetEnvironments?.[t.id] ?? command.env,
            t.id === a.id
              ? 10000
              : trueWeapon
                ? trueWeapon.ranged
                  ? trueWeapon.longRange
                  : trueWeapon.reach
                : HIT_TRIGGER_SPELLS.includes(spell.id)
                  ? 10000
                  : range,
            profile.area,
            [
              'hold-person',
              'crown-of-madness',
              'blindness-deafness',
              'healing-word',
              'hex',
              'hunter-s-mark',
              'hellish-rebuke',
              'bane',
              'magic-missile',
              'sacred-flame',
              'dissonant-whispers',
              'animal-friendship',
              'charm-person',
              'command',
              'hideous-laughter',
              'floating-disk',
            ].includes(spell.id),
          )
      if(spell.id==='vicious-mockery'&&!command.env.attackerSees){if(command.env.attackerHears===false)throw Error('恶言相加须来源实际看见或听见目标');if(command.env.attackerHears===undefined)reason(command.env.note)}
      if (
        [
          'expeditious-retreat','blur','mirror-image','see-invisibility','alter-self','blink',
          'false-life',
          'goodberry',
          'divine-favor',
          'shillelagh',
          'blade-ward',
          'armor-of-agathys',
          'arcane-vigor',
          'speak-with-animals',
        ].includes(spell.id) &&
        (targets.length!==1 || targets[0]?.id !== a.id)
      )
        throw new Error('此法术只作用于自身')
      if (grant.key.startsWith('shadows:') && targets[0]?.id !== a.id)
        throw new Error('幽影护甲只能对自身使用')
      if (spell.id === 'magic-missile' && targets.length !== profile.count)
        throw new Error('请为当前环级的每个飞弹分别选择目标')
      if (cost === 'action' && a.turn.surgeAction)
        throw new Error('动作如潮的额外动作不能用于魔法动作')
      if (spell.id === 'cordon-of-arrows' && e.phase !== 'active') {
        canAct(a)
        runtime(a, { type: 'time', hours: 1 / 600 })
      } else spend(a, cost)
      const mod = grant.item?.abilityModifier ?? stats(a).mods[grant.ability],
        dc =
          grant.item?.dc ?? (8 + mod + pbOf(c.build) + (grant.sorcerer && runtimeState(c, cat).innateSorcery ? 1 : 0))
      if (meta)
        runtime(a, {
          type: 'resource',
          id: 'sorcery-points',
          amount: metamagicCost(meta.option),
          note: METAMAGIC_NAMES[meta.option] ?? meta.option,
        })
      castResource(a, command.key, command.mode, command.requirementsConfirmed, !!command.wildCheck,meta?.option==='subtle')
      if(itemCastFailed(character(a),command.key)){detail='卷轴施法检定失败，卷轴与行动已消耗；没有法术效果';break}
      endInvisibility(a)
      if(meta?.option!=='subtle'&&slowed(stats(a).effects)&&/(^|[,\s])S([,\s(]|$)/.test(spell.components)&&checkedDie(dice,4)===1){
        if(spell.concentration){const current=character(a)!,r=runtimeState(current,cat);r.concentration=null;current.runtime=r}
        detail='缓慢术：姿势成分施法失败，动作及已支付法术位不退还';cleanup();break
      }
      if (profile.save)
        for (const t of e.actors)
          setEffects(
            t,
            effects(t).filter((f) => !(f.key === 'friends' && sourceMatches(f.sourceId, a))),
          )
      a.turn.lastSpell = {
        id: spell.id,
        school: spell.school,
        slot: castSlotLevel(command.mode),
        token: crypto.randomUUID(),
      }
      if (!command.summonDraftId && ['summon-beast', 'summon-fey', 'summon-undead'].includes(spell.id)) {
        if (e.actors.length >= 100) throw new Error('遭遇参与者已满')
        const form =
            command.summonForm ??
            (spell.id === 'summon-beast'
              ? 'land'
              : spell.id === 'summon-fey'
                ? 'fuming'
                : 'ghostly'),
          npc = spellSummon(
            character(a)!,
            cat,
            spell.id,
            effectiveSlot || spell.level,
            form,
            grant.ability,
          ),
          oldIds = e.actors.map((a) => a.id),
          currentId = e.actors[e.current]!.id
        for (const previous of e.actors.filter(
          (x) => x.companion?.ownerId === a.id && x.companion.source === 'spell-summon',
        ))
          previous.companion!.dismissed = true
        e.actors.push({
          id: crypto.randomUUID(),
          characterId: null,
          npc,
          side: a.side,
          initiative: a.initiative,
          surprised: false,
          turn: freshTurn(),
          companion: {
            ownerId: a.id,
            source: 'spell-summon',
            instanceId:crypto.randomUUID(),castId:character(a)!.runtime!.concentration?.castId,sourceEntityId:character(a)!.id,
            spellId: spell.id,
            castingAbility: grant.ability,
            slotLevel: effectiveSlot || spell.level,
            form,
            expiresAfterRest: null,
            dismissed: false,
          },
        })
        insertSummonedInitiative(e, oldIds, currentId, cs)
        detail =
          '灵魄已按核对的数据加入，紧随主人行动；' + npc.source + '；GM确认材料及90尺内可见空位'
        break
      }
      if (spell.id === 'lightning-arrow') {
        if(!lightningOriginal||!command.triggerConfirmed||!command.env.areaConfirmed)throw Error('请确认真实远程攻击窗口及10尺范围');const ids=command.areaTargets??targets.map(t=>t.id),envs=command.areaEnvironments??command.targetEnvironments??Object.fromEntries(ids.map(id=>[id,command.env]));e.pending=lightningReplacement(e,a,lightningOriginal,ids.map(actor),envs,effectiveSlot,dc,cs,cat,dice);e.pending.sourceKey=grant.key;e.pending.attackWindowId=command.attackWindowId;detail='闪电箭矢替换原攻击伤害及效果';break
      }
      if (spell.id === 'arcane-vigor') {
        const source = character(a)!,
          r = runtimeState(source, cat)
        r.hitDice -= Number(profile.dice!.match(/^\d+/)![0])
        source.runtime = r
      }
      if (spell.level > 0) a.turn.levelSpellCast = true
      if (spell.id === 'magic-weapon')
        for (const target of e.actors)
          setEffects(
            target,
            effects(target).filter((f) => !(f.key === spell.id && f.sourceId === a.id)),
          )
      if (meta?.option === 'quickened') a.turn.quickenedCast = true
      if (meta?.option === 'extended' && character(a)!.runtime!.concentration) {
        const conc = character(a)!.runtime!.concentration!,
          r = character(a)!.runtime!
        conc.extended = true
        if (conc.endsAt != null) conc.endsAt = r.hours! + Math.min(24, (conc.endsAt - r.hours!) * 2)
      }
      if (profile.kind === 'attack') {
        let spec: AttackSpec = {
          id: grant.key,
          name: spell.name,
          bonus: (grant.item?.attackBonus ?? (mod + pbOf(c.build))) - stats(a).exhaustion * 2,
          ability: grant.ability,
          modifier:
            (grant.key.startsWith('class-cantrips:') || grant.key.startsWith('tome-cantrips:')) &&
            hasInvocation(c.build, 'agonizing:' + spell.id)
              ? stats(a).mods.cha
              : 0,
          damage: profile.dice ?? '0',
          type:
            meta?.option === 'transmuted' ? meta.damageType : (profile.type ?? command.damageType),
          ranged: spell.range !== 'Touch' && spell.id !== 'thorn-whip',
          reach:
            spell.id === 'thorn-whip'
              ? range
              : spell.range === 'Touch' && meta?.option === 'distant'
                ? 30
                : 5,
          range,
          longRange: range,
          weaponId: null,
          instanceId: null,
          properties: [],
          mastery: null,
          page: spell.source.page,
        }
        if (['chromatic-orb', 'sorcerous-burst'].includes(spell.id)) {
          const allowed =
            spell.id === 'chromatic-orb'
              ? ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder']
              : ['acid', 'cold', 'fire', 'lightning', 'poison', 'psychic', 'thunder']
          if (
            !allowed.includes(command.damageType) &&
            !(
              hasSubclass(c.build, 'great-old-one') &&
              /^(class-|subclass:|tome-)/.test(grant.key) &&
              command.damageType === 'psychic'
            )
          )
            throw new Error('该法术不支持所选伤害类型')
          spec.type = command.damageType
        }
        if (meta?.option === 'transmuted') spec.type = meta.damageType
        if (spell.id === 'true-strike') {
          const w = attackOptions(a, cs, cat).find((x) => x.id === command.weaponId && x.weaponId)
          if (!w) throw new Error('True Strike 需要选择可用武器')
          const material=findItem(c,cat,w.weaponId!)
          if(!material||material.cost<0.01||!weaponProficient(c.build,cat,material.id))throw Error('克敌机先需要价值至少1CP且本人熟练的真实武器')
          spec = {
            ...w,
            name: spell.name + ' · ' + w.name,
            ability: grant.ability,
            modifier:
              mod +
              ((grant.key.startsWith('class-cantrips:') ||
                grant.key.startsWith('tome-cantrips:')) &&
              hasInvocation(c.build, 'agonizing:' + spell.id)
                ? stats(a).mods.cha
                : 0),
            bonus: mod + (w.bonus - w.modifier),
            type: command.damageType === 'radiant' ? 'radiant' : w.type,
            page: spell.source.page,
          }
        }
        beginAttack(
          a,
          targets[0]!,
          spec,
          command.targetEnvironments?.[targets[0]!.id] ?? command.env,
          false,
          false,
          spell.id,
        )
        if (targets.length > 1) {
          const pending = clone(e.pending!)
          for (const t of targets.slice(1)) {
            beginAttack(
              a,
              t,
              spec,
              command.targetEnvironments?.[t.id] ?? command.env,
              false,
              false,
              spell.id,
            )
            pending.targets.push(...e.pending!.targets)
          }
          e.pending = pending
        }
        if(spell.id==='ice-knife')e.pending!.iceBurst={targetIds:command.areaTargets??targets.map(t=>t.id),envs:command.areaEnvironments??Object.fromEntries(targets.map(t=>[t.id,command.env])),slot:effectiveSlot,dc}
        e.pending!.sourceKey = grant.key
        e.pending!.slotLevel = effectiveSlot
        e.pending!.modifier = mod
        e.pending!.notes = profile.note ? [profile.note] : []
      } else {
        const ts: PendingTarget[] = targets.map((t) => ({
          id: t.id,
          env: clone(command.targetEnvironments?.[t.id] ?? command.env),
          roll: null,
          hit: true,
          critical: false,
          ac: stats(t).ac,
        }))
        e.pending = {
          kind:
            profile.kind === 'save' ? 'save' : profile.kind === 'manual' ? 'manual' : 'automatic',
          actorId: a.id,
          name: spell.name,
          page: spell.source.page,
          spellId: spell.id,gmChoice:command.gmChoice,
          m3Choice:command.m3Choice,
        supportChoice: command.supportChoice,
        controlChoices:command.controlChoices,controlTargets:command.controlTargets,controlText:command.controlText,
          dispelZoneId:command.dispelZoneId,
          slotLevel: effectiveSlot,
          sourceKey: grant.key,
          ...(['magic-weapon', 'elemental-weapon'].includes(spell.id)
            ? { boundWeaponId: command.weaponId }
            : {}),
          attack: null,
          targets: ts,
          damage: [],
          save: profile.save ?? null,
          dc: profile.save ? dc : null,
          half: profile.half ?? false,
          effectKey: profile.effect ?? null,
          modifier: mod,
          mode: profile.kind,
          notes:
            spell.id === 'shillelagh'
              ? [command.weaponId ?? '', grant.ability,command.damageType]
              : [profile.note ?? '', command.damageType],
          sneak: false,
          mastery: false,
          startedAt: e.tick,
        }
        if(command.attackWindowId)e.pending.attackWindowId=command.attackWindowId
        if (['thunderous-smite', 'wrathful-smite'].includes(spell.id)) e.pending.damageAlways = true
        if (profile.dice)
          e.pending.damage = [
            {
              type:
                meta?.option === 'transmuted'
                  ? meta.damageType
                  : (profile.type ?? command.damageType),
              roll: rollDamage(
                profile.dice,
                wildMaximum ? (sides: number) => sides : dice,
                command.attackWindowId?hitSpellCritical(e,command.attackWindowId):['thunderous-smite', 'wrathful-smite', 'blinding-smite'].includes(spell.id) && !!a.turn.lastAttack?.critical,
                hitSpellMinimum(e,cs,cat,command.attackWindowId),
              ),
            },
          ]
        if (
          profile.kind === 'save' &&
          spell.level === 0 &&
          (grant.key.startsWith('class-cantrips:') || grant.key.startsWith('tome-cantrips:')) &&
          hasInvocation(c.build, 'agonizing:' + spell.id) &&
          e.pending.damage[0]
        ) {
          const roll = e.pending.damage[0].roll
          roll.total = Math.max(0, roll.total + stats(a).mods.cha)
          roll.formula += '+' + stats(a).mods.cha
        }
        if(profile.dice&&['save','automatic'].includes(profile.kind)&&!profile.area)guardSanctuary(e.pending,a)
        for (const t of ts)
          if (profile.save && !t.sanctuaryBlocked && !(['levitate','enlarge-reduce'].includes(spell.id)&&command.willing)) {
            if(spell.id==='enthrall'&&actor(t.id).side!==a.side&&actor(t.id).side!=='neutral'&&a.side!=='neutral'){
              t.hit=false;continue
            }
            if (spell.id === 'animal-friendship' && actorCreatureType(actor(t.id),cs,true) !== 'beast') {
              t.hit = false
              continue
            }
            if (
              spell.id === 'sleep' &&
              (character(actor(t.id))?.build.speciesId === 'elf' ||
                actor(t.id).npc?.conditionImmunities.includes('exhaustion'))
            ) {
              t.hit = false
              continue
            }
            if (spell.id === 'friends') {
              const target = actor(t.id),
                historyKey = 'friends-history:' + (target.characterId ?? target.npcId ?? target.id),
                hours = runtimeState(character(a)!, cat).hours
              const recent = effects(a).some(
                (f) =>
                  f.key.startsWith('friends-history:') &&
                  (f.socialTargetId === (target.characterId ?? target.npcId ?? target.id) ||
                    f.key === historyKey) &&
                  (f.endsAt ?? 0) > hours,
              )
              addEffect(a, historyKey, '交友术施放记录', a, spell.source.page, {
                expiresAt: null,
                encounterId: 'outside',
                endsAt: hours + 24,
                socialTargetId: target.characterId ?? target.npcId ?? target.id,
                note: '24小时限制记录，包括豁免成功的施放',
              })
              if (
                (actorCreatureType(target,cs,true) && actorCreatureType(target,cs,true) !== 'humanoid') ||
                recent ||
                (e.phase === 'active' &&
                  target.side !== a.side &&
                  target.side !== 'neutral' &&
                  a.side !== 'neutral')
              ) {
                t.hit = false
                continue
              }
            }
            if (
              ['hold-person', 'crown-of-madness', 'charm-person'].includes(spell.id) &&
              actorCreatureType(actor(t.id),cs,true) &&
              actorCreatureType(actor(t.id),cs,true) !== 'humanoid'
            ) {
              t.hit = false
              continue
            }
            const roll = savingRoll(
              actor(t.id),
              profile.save,
              (meta?.option === 'heightened' && t.id === meta.heightenedId) || !!wildSaveDis
                ? { ...t.env, disadvantage: true }
                : spell.id === 'charm-person' &&
                    e.phase === 'active' &&
                    actor(t.id).side !== a.side &&
                    actor(t.id).side !== 'neutral' &&
                    a.side !== 'neutral'
                  ? { ...t.env, advantage: true }
                  : spell.id==='ensnaring-strike'&&!withinSize(actor(t.id),'medium')?{...t.env,advantage:true}:t.env,
              cs,
              cat,
              dice,
              [
                'crown-of-madness',
                'friends',
                'charm-person',
                'animal-friendship',
                'hypnotic-pattern','suggestion',
              ].includes(spell.id)
                ? 'charm'
                : 'normal',
              spell.id === 'sacred-flame',
            )
            t.roll = roll
            t.hit = roll.autoFail || roll.total < dc
          }
        detail = `${stats(a).name}施放 ${spell.name}；${grant.source} / ${command.mode}；${sourceCaption(spell.source)}；${profile.note ?? '等待 GM 检查目标与反应后结算'}`
      }
      if (isZoneSpell(spell.id)&&!command.sceneEffectCastId) {
        const r = runtimeState(character(a)!, cat)
        if(!e.pending)throw Error('持续区域缺少待结算施法记录')
        e.pending.zoneCreation={
          id: crypto.randomUUID(),
          sourceId: a.id,castId:spell.concentration?r.concentration?.castId:crypto.randomUUID(),
          spellId: spell.id,
          createdTick: e.tick,
          ...(spell.id === 'cordon-of-arrows' ? { ammunition: command.ammunition!.count } : {}),
          name: spell.name,
          dc,
          slotLevel: effectiveSlot || spell.level,
          damageType:
            spell.id === 'moonbeam'
              ? 'radiant'
              : command.damageType === 'necrotic'
                ? 'necrotic'
                : 'radiant',
          expiresHour: spell.id === 'cordon-of-arrows' ? r.hours + 8 : r.concentration!.endsAt!,
          excludedIds: [
            ...new Set([
              ...(command.excludedIds ?? []),
              ...(spell.id === 'cordon-of-arrows' ? [a.id] : []),
            ]),
          ],
          triggered: {},
          note:
            'GM 核对区域／移动／进入／回合结束时机；每个生物每回合至多一次；' + command.env.note,
        }
        if(spell.id==='cordon-of-arrows')e.pending.zoneAmmo=clone(command.ammunition!)
        detail='持续区域施法已支付动作与法术位，等待反制及确认后才创建区域'
      }
      if(e.pending&&command.summonDraftId)e.pending.summonDraftId=command.summonDraftId
      if (meta && e.pending) {
        e.pending!.metamagic = clone(meta)
        e.pending!.notes.push(
          '超魔法：' + METAMAGIC_NAMES[meta.option] + '；术法点 ×' + metamagicCost(meta.option),
        )
        if (meta.option === 'careful')
          for (const entry of e.pending!.targets)
            if (meta.protectedIds.includes(entry.id)) {
              entry.hit = false
              if (entry.roll) {
                entry.roll.autoFail = false
                entry.roll.reasons.push('谨慎法术：自动成功，成功减半的伤害改为 0')
              }
            }
      }
      if (e.pending && wildMaximum && (profile.dice || profile.kind === 'attack')) {
        e.pending.triggered = [...(e.pending.triggered ?? []), 'wild-max-damage']
        setEffects(
          a,
          effects(a).filter((f) => f.id !== wildMaximum.id),
        )
      }
      if (wildSaveDis && profile.save)
        setEffects(
          a,
          effects(a).filter((f) => f.id !== wildSaveDis.id),
        )
      break
    }
    case 'reaction-counterspell': {
      if(e.pending?.notCasting)throw Error('这是已生效法术的后续攻击，不是正在施法，不能法术反制')
      active()
      const a=actor(command.actorId),p=e.pending,c=character(a),env=command.env
      if(!p?.spellId||p.damageRolled||p.actorId!==command.targetId||p.actorId===a.id)throw Error('原施法窗口已变化')
      if(!c||!runtimeSpells(c,cat).some(g=>g.key===command.key&&g.spell.id==='counterspell'))throw Error('没有可用法术反制来源')
      if(!command.requirementsConfirmed||!env.targetLocationConfirmed||!env.attackerSees||!Number.isFinite(env.distance)||env.distance>60||env.distance<0||env.cover==='total')throw Error('法术反制需要60尺内可见且正在施法的目标及合法成分')
      canAct(a)
      spend(a,'reaction')
      const grant=castResource(a,command.key,command.mode,true)
      if(itemCastFailed(character(a),command.key)){detail='卷轴反应检定失败，未产生法术反制';break}
      a.turn.levelSpellCast=true
      endInvisibility(a)
      pushReaction(a,'counterspell',grant.key,castSlotLevel(command.mode)||3,grant.item?.dc??8+stats(a).mods[grant.ability]+pbOf(c.build),env)
      break
    }
    case 'reaction-shield': {
      active()
      const a = actor(command.actorId),
        p = e.pending
      if (p?.kind === 'attack' && (p.damageRolled||p.attackLocked)) throw new Error('护盾术须在掷攻击伤害之前使用')
      if (
        !p ||
        !p.targets.some(
          (t) => t.id === a.id && ((p.kind === 'attack' && t.hit) || p.spellId === 'magic-missile'),
        )
      )
        throw new Error('Shield 只能响应命中的攻击或魔法飞弹')
      const c = character(a)!
      if (!runtimeSpells(c, cat).some((g) => g.key === command.key && g.spell.id === 'shield'))
        throw new Error('请选择可用 Shield 来源')
      if (a.turn.quickenedCast) throw new Error('快捷法术后本回合不能再施放一环及以上法术')
      spend(a, 'reaction')
      castResource(a, command.key, command.mode, command.requirementsConfirmed)
      if(itemCastFailed(character(a),command.key)){detail='卷轴反应检定失败，未产生护盾';break}
      endInvisibility(a)
      pushReaction(a,'shield',command.key,castSlotLevel(command.mode)||1)
      a.turn.levelSpellCast = true
      detail = stats(a).name + '反应施放护盾术：等待反制／确认，原攻击骰值保留'
      break
    }
    case 'reaction-defense': {
      active()
      const a = actor(command.actorId),
        p = e.pending,
        entry = p?.targets[command.targetIndex],
        c = character(a)
      if (!p || !entry || entry.id !== a.id || entry.defense || !c)
        throw new Error('防御反应目标或窗口不可用')
      if (command.kind !== 'stone' && (p.kind !== 'attack' || !entry.hit))
        throw new Error('此反应只能响应命中的攻击')
      if (
        command.kind === 'uncanny' &&
        (c.build.classId !== 'rogue' || c.level < 5 || !entry.env.targetSees)
      )
        throw new Error('诡异闪避须五级盗贼看见攻击者')
      if (
        command.kind === 'deflect' &&
        (c.build.classId !== 'monk' ||
          c.level < 3 ||
          ![p.attack?.type, ...p.damage.map((x) => x.type)].some((x) =>
            ['bludgeoning', 'piercing', 'slashing'].includes(x ?? ''),
          ))
      )
        throw new Error('偏转攻击须三级武僧受到含物理伤害的攻击')
      if (
        command.kind === 'stone' &&
        (c.runtime?.wildShape ||
          c.build.speciesId !== 'goliath' ||
          one(c.build, 'ancestry') !== 'stone' ||
          (!p.attack && !p.damage.some((x) => x.roll.total > 0)))
      )
        throw new Error('石之坚韧须响应伤害并拥有石巨人血统')
      if (
        command.kind === 'stone' &&
        ((p.kind === 'attack' && !entry.hit) ||
          (p.kind === 'save' && !entry.hit && !p.half) ||
          p.metamagic?.protectedIds.includes(a.id) ||
          ['heal', 'temporary', 'buff'].includes(p.mode))
      )
        throw new Error('石之坚韧须响应实际伤害')
      spend(a, 'reaction')
      let reduction = 0
      if (command.kind === 'stone') {
        runtime(a, { type: 'resource', id: 'giant-ancestry', amount: 1, note: '石之坚韧' })
        reduction = Math.max(0, checkedDie(dice, 12) + stats(a).mods.con)
      }
      if (command.kind === 'deflect')
        reduction = Math.max(0, checkedDie(dice, 10) + stats(a).mods.dex + c.level)
      entry.defense = { kind: command.kind, reduction }
      detail =
        stats(a).name +
        '防御反应已记录：' +
        DEFENSE_NAMES[command.kind] +
        '；仅作用于第 ' +
        (command.targetIndex + 1) +
        ' 个命中；减伤 ' +
        reduction
      break
    }
    case 'spell-reroll': {
      active()
      const a = actor(command.actorId),
        c = character(a),
        p = e.pending
      if (!c || !p?.spellId || p.actorId !== a.id)
        throw new Error('必须在自己的法术待结算窗口使用超魔法')
      knownMetamagic(c, command.kind)
      if ((runtimeState(c, cat).resources['sorcery-points'] ?? 0) < 1) throw new Error('术法点不足')
      const marker =
        command.kind + ':' + (command.kind === 'seeking' ? command.targetIndex : 'damage')
      if (p.triggered?.includes(marker)) throw new Error('该掷骰已经使用此超魔法')
      if (command.kind === 'seeking') {
        if (p.damageRolled) throw new Error('伤害已掷出；追踪法术须在攻击伤害阶段之前使用')
        const entry = p.targets[command.targetIndex]
        if (p.kind !== 'attack' || !entry?.roll || entry.hit || !p.attack)
          throw new Error('追踪法术须选择未命中的法术攻击')
        const roll = entry.roll,
          old = roll.chosen,
          value = checkedDie(dice, 20)
        roll.dice[roll.dice.indexOf(old)] = value
        roll.chosen = value
        roll.total += value - old
        roll.reasons.push('追踪法术：必须使用新的 d20')
        entry.hit = criticalAttack(a, value, p.spellId) || (value !== 1 && roll.total >= entry.ac)
        entry.critical =
          entry.hit &&
          (criticalAttack(a, value, p.spellId) ||
            (entry.env.distance <= 5 &&
              stats(actor(entry.id)).conditions.some((x) =>
                ['paralyzed', 'unconscious'].includes(x),
              )))
      } else {
        const damageParts = p.kind === 'attack' && p.damageRolled
          ? p.targets.flatMap((entry) => entry.damageOverride ?? []) : p.damage
        const all = damageParts.flatMap((part) => part.roll.dice.map((_, index) => ({ part, index })))
        if (['heal', 'temporary'].includes(p.mode))
          throw new Error('强效法术只能重掷伤害骰，不能重掷治疗或临时生命骰')
        const indices = command.diceIndices
        if (
          !indices.length ||
          new Set(indices).size !== indices.length ||
          indices.length > Math.max(1, stats(a).mods.cha) ||
          indices.some((i) => !all[i])
        )
          throw new Error('请在已掷出的法术伤害骰中选择至多魅力调整值（至少 1）个不同骰子')
        for (const index of indices) {
          const { part, index: i } = all[index]!,
            sides = Number(part.roll.formula.match(/^\d+d(\d+)/)?.[1])
          if (!sides) throw new Error('此伤害公式须由 GM 裁定重掷')
          const old = part.roll.dice[i]!,
            n = checkedDie(dice, sides)
          part.roll.dice[i] = n
          part.roll.total += n - old
        }
      }
      runtime(a, {
        type: 'resource',
        id: 'sorcery-points',
        amount: 1,
        note: METAMAGIC_NAMES[command.kind]!,
      })
      p.triggered = [...(p.triggered ?? []), marker]
      detail = stats(a).name + '使用 ' + METAMAGIC_NAMES[command.kind] + '；术法点 ×1；新掷骰已保存'
      break
    }
    case 'trigger-feature': {
      active()
      const a = actor(command.actorId),
        c = character(a),
        p = e.pending,
        entry = p?.targets[command.targetIndex]
      if (
        !c ||
        c.build.classId !== 'monk' ||
        c.level < 5 ||
        !p ||
        p.actorId !== a.id ||
        p.kind !== 'attack' ||
        !entry?.hit ||
        !p.attack ||
        p.attack.ranged ||
        p.spellId ||
        (!p.attack.weaponId && p.attack.id !== 'unarmed')
      )
        throw new Error('震慑打击须五级武僧用徒手打击或武僧武器命中')
      const monkWeapon = p.attack.weaponId && findItem(c, cat, p.attack.weaponId)
      if (
        monkWeapon &&
        !(
          monkWeapon.category === 'simple-melee' ||
          (monkWeapon.category === 'martial-melee' && monkWeapon.properties?.includes('light'))
        )
      )
        throw new Error('震慑打击要求徒手、简易近战武器或轻型军用近战武器')
      own(a)
      reason(command.note)
      if (a.turn.manualUsed?.includes('stun')) throw new Error('本回合已使用震慑打击')
      if ((runtimeState(c, cat).resources.focus ?? 0) < 1) throw new Error('专注点不足')
      const t = actor(entry.id),
        dc = 8 + pbOf(c.build) + stats(a).mods.wis,
        roll = savingRoll(t, 'con', entry.env, cs, cat, dice)
      runtime(a, { type: 'resource', id: 'focus', amount: 1, note: '震慑打击' })
      a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'stun']
      if (roll.autoFail || roll.total < dc)
        addEffect(t, 'stun', '震慑打击', a, 51, { condition: 'stunned', ...expires(a, 1) })
      else {
        addEffect(t, 'stun-slow', '震慑打击：速度减半', a, 51, {
          speedPenalty: Math.ceil(stats(t).speed / 2),
          ...expires(a, 1),
        })
        addEffect(t, 'stun-opening', '震慑打击：下一次对其攻击优势', a, 51, expires(a, 1))
      }
      detail = '震慑打击：CON ' + roll.total + '/DC ' + dc + '；' + command.note
      break
    }
    case 'damage-roll': {
      if(e.pending?.utilityId)throw Error('专用法术无通用伤害骰阶段，请先处理反制并从地图最终结算')
      if(e.pending?.targets.some(t=>t.sanctuaryBlocked))throw Error('请先重选庇护术目标，或直接确认放弃被阻止的攻击')
      active()
      const pending = e.pending
      if (
        !pending ||
        pending.kind !== 'attack' ||
        pending.actorId !== command.actorId ||
        !pending.attack
      )
        throw new Error('须当前攻击者的待结算攻击')
      if (pending.damageRolled) throw new Error('该攻击伤害已经掷出，不能重复掷骰')
      for (const entry of pending.targets)
        entry.damageOverride = prepareAttackDamage(pending, entry, {
          savage: !!command.savage,
          tavernReroll: command.tavernReroll,
        })
      pending.damageRolled = true
      pending.damageChoices = { savage: !!command.savage, tavernReroll: command.tavernReroll !== false }
      detail =
        '攻击伤害已掷出并保存，尚未扣血；可提交命中／伤害特性，最终合并伤害只结算一次专注豁免；' +
        detail
      break
    }
    case 'resolve': {
      if(e.pending?.concentrationSave){
        const p=e.pending,frame=p.concentrationSave!,a=actor(frame.actorId),c=character(a),current=c?runtimeState(c,cat).concentration:a.npc?.concentration
        if(!current||current.spellId!==frame.spellId||frame.castId&&current.castId!==frame.castId)throw Error('专注来源已变化，不能结算旧豁免')
        const target=p.targets[0]!,success=!target.hit
        if(c)runtime(a,{type:'concentration-result',success})
        else if(a.npc?.concentration){if(!success)delete a.npc.concentration;else delete a.npc.concentration.pendingDC}
        outcomes.push({actorId:a.id,kind:'concentration',total:target.roll!.total,success})
        e.pending=null;detail=stats(a).name+'专注豁免 '+target.roll!.total+' / DC '+frame.dc+'，'+(success?'维持':'结束');cleanup();break
      }
      if(e.pending?.sceneEffectCastId)throw Error('场景效果须从原房间结算，不能绕过实际目标');
      if(e.pending?.m3WorldId)throw Error('空间／物件法术须从原房间结算，不能绕过实际环境与目标')
      if(e.pending?.reactionFrame?.kind==='counterspell'){
        const frame=e.pending,reactor=actor(frame.actorId),parent=e.reactionParents?.pop()
        if(!parent)throw Error('法术反制缺少原结算帧')
        e.pending=parent
        counterPending(reactor,frame.reactionFrame!.dc!,frame.reactionFrame!.env??defaultEnvironment())
        resumeReaction()
        break
      }

      if(e.pending?.utilityId)throw Error('专用法术须从所在场景地图完成结算，不能绕过世界目标与耗材记录')
      const p = e.pending
      if (!p) throw new Error('当前没有待结算行动')
      if (p.mode !== 'zone'&&!(p.zoneCreation?.spellId==='cordon-of-arrows'&&e.phase!=='active')) active()
      const a = actor(p.actorId),
        spec = p.attack,
        profile = p.spellId
          ? spellEffect(
              p.spellId,
              character(a)?.level ?? 1,
              p.slotLevel || cat.spells.find((s) => s.id === p.spellId)?.level || 1,
            )
          : null
      if(p.zoneCreation){
        const z=clone(p.zoneCreation),c=character(a)
        if(!c)throw Error('持续区域需要完整施法来源')
        if(z.spellId!=='cordon-of-arrows'&&!concentrationMatches({key:z.spellId,castId:z.castId},runtimeState(c,cat).concentration))throw Error('区域来源专注已经结束，请GM取消此施法')
        if(p.zoneAmmo){const row=c.inventory.find(r=>r.instanceId===p.zoneAmmo!.instanceId);if(!row||row.quantity<p.zoneAmmo.count)throw Error('已确认箭阵材料发生变化，请GM修复；不能重复扣位或凭空创建箭矢');row.quantity-=p.zoneAmmo.count;c.inventory=c.inventory.filter(r=>r.quantity>0)}
        if((e.zones??[]).some(old=>old.id===z.id))throw Error('区域已经创建，不能重复结算')
        ;(e.zones??=[]).push(z);e.pending=null;detail='确认创建持续区域 '+z.name+'；后续触发沿原区域规则';break
      }
      const uniqueTargets = [...new Set(p.targets.map((t) => t.id))]
      const reactionTarget = (enabled: boolean, id?: string) => {
        if (!enabled) return ''
        const chosen = id || (uniqueTargets.length === 1 ? uniqueTargets[0]! : '')
        if (!uniqueTargets.includes(chosen)) throw new Error('请为目标特性明确选择一个待结算目标')
        return chosen
      }
      if (command.uncanny && command.deflect) throw new Error('一次反应只能选择一个防御特性')
      const defenseTarget = reactionTarget(
        !!(command.uncanny || command.deflect),
        command.defenseTargetId,
      )
      let defenseUsed = false
      const stoneTarget = reactionTarget(command.stone, command.stoneTargetId)
      const selectedTargets = (ids: string[] | undefined, enabled: boolean) => {
        if (!ids) return undefined
        if ((!enabled && ids.length) || new Set(ids).size !== ids.length || ids.some((id) => !uniqueTargets.includes(id)))
          throw new Error('能力目标必须是本次不重复的待结算目标')
        return ids
      }
      const nonlethalTargets = selectedTargets(command.nonlethalTargetIds, command.nonlethal)
      const relentlessTargets = selectedTargets(command.relentlessTargetIds, command.relentless)
      const relentlessTarget = relentlessTargets ? '' : reactionTarget(command.relentless, command.relentlessTargetId)
      const revelationTarget = command.revelationTargetId
        ? reactionTarget(!!command.revelationBonus, command.revelationTargetId) : ''
      if (command.revelationTargetId && !command.revelationBonus) throw new Error('未启用天启加伤')
      if (nonlethalTargets?.length && (p.kind !== 'attack' || !spec || spec.ranged))
        throw new Error('近战击倒仅适用于本次近战攻击')
      // New explicit selections use the same candidate query as the GM UI. Legacy commands retain their existing checks.
      const candidates = resolutionAbilities(e, cs, cat)
      const usedRelentlessTargets = new Set<string>()
      for (const targetId of relentlessTargets ?? []) {
        if (!candidates.some((o) => o.choice === 'relentless' && o.actorId === targetId && !o.reason))
          throw new Error('该目标的顽强不屈在当前阶段不可用')
        if (nonlethalTargets?.includes(targetId)) throw new Error('同一目标不能同时选择近战击倒与顽强不屈')
      }
      if (revelationTarget && !candidates.some((o) => o.choice === 'revelation' && p.targets[o.targetIndex]?.id === revelationTarget && !o.reason))
        throw new Error('该目标的天启加伤在当前阶段不可用')
      let stoneUsed = false
      if (p.targets.some((t) => t.defense && (t.id === defenseTarget || t.id === stoneTarget)))
        throw new Error('该目标已提交防御反应，不能在结算时再次勾选')
      detail = '结算 ' + p.name
      for (const entry of p.targets) {
        if(entry.sanctuaryBlocked){detail+='；庇护术重选未完成，本次攻击／法术对该目标无效';continue}
        const t = actor(entry.id),
          s = stats(t),
          cover = entry.env.cover === 'half' ? 2 : entry.env.cover === 'three-quarters' ? 5 : 0
        if (p.kind === 'attack'&&!p.attackLocked) {
          entry.ac =
            s.ac +
            cover +
            (entry.acBonus ?? 0) +
            (!spec?.ranged
              ? Math.max(
                  0,
                  ...s.effects
                    .filter((f) => f.key === 'defensive-duelist')
                    .map((f) => Number(f.note) || 0),
                )
              : 0)
          entry.hit =
            criticalAttack(a, entry.roll!.chosen, p.spellId) ||
            (entry.roll!.chosen !== 1 && entry.roll!.total >= entry.ac)
          entry.critical =
            entry.hit &&
            (criticalAttack(a, entry.roll!.chosen, p.spellId) ||
              (entry.env.distance <= 5 &&
                s.conditions.some((x) => ['paralyzed', 'unconscious'].includes(x))))
          detail += `；${s.name}：${entry.hit ? (entry.critical ? '重击' : '命中') : '未命中'}（${entry.roll!.total} / AC ${entry.ac}）`
        }
        if (
          p.spellId === 'magic-missile' &&
          s.effects.some((x) => ['shield', 'wild-shield'].includes(x.key))
        ) {
          detail += '；Shield 阻止飞弹'
          continue
        }
        if(entry.mirror?.destroyed){entry.hit=false;entry.critical=false}
        const caster = character(a),
          cantrip = cat.spells.find((s) => s.id === p.spellId)?.level === 0,
          potentHalf =
            !entry.hit &&
            !!caster &&
            hasSubclass(caster.build, 'evoker') &&
            cantrip &&
            p.sourceKey?.startsWith('class-cantrips:')
        let parts: DamagePart[] = clone(entry.damageOverride ?? p.damage)
        if (spec && !p.damageRolled) parts = prepareAttackDamage(p, entry, command)
        else if (spec && !entry.hit&&p.spellId!=='acid-arrow') parts = []
        if (p.kind === 'manual') {
          const m = command.manual
          if (!m) throw new Error('请填写 GM 裁定结果')
          reason(m.note)
          integer(m.damage)
          integer(m.heal)
          integer(m.rounds, 0, 14400)
          const ruling: Partial<ActiveEffect> = {
            ...(m.repeatSave
              ? {
                  repeatSave: {
                    ability: m.repeatSave,
                    dc: p.dc ?? 8 + (character(a) ? pbOf(character(a)!.build) : 2) + p.modifier,
                  },
                }
              : {}),
            ...(m.acBonus !== undefined ? { acBonus: integer(m.acBonus, -10, 10) } : {}),
            ...(m.speedPenalty !== undefined
              ? { speedPenalty: integer(m.speedPenalty, 0, 300) }
              : {}),
          }
          if (m.damage)
            parts = [
              {
                type: m.damageType,
                roll: { formula: 'GM 裁定', dice: [], flat: m.damage, total: m.damage },
              },
            ]
          if (m.heal) heal(t, m.heal)
          if (m.condition) {
            if (!CONDITIONS.some((x) => x.id === m.condition) || m.condition === 'exhaustion')
              throw new Error('请选择状态，力竭请用 GM 调整')
            addEffect(t, p.spellId ?? 'gm-effect', p.name, a, p.page, {
              condition: m.condition,
              ...ruling,
              concentration:
                !!character(a)?.runtime?.concentration &&
                character(a)!.runtime!.concentration!.spellId === p.spellId,
              ...(m.rounds ? expires(a, m.rounds) : {}),
              note: m.note,
            })
          }
          const spell = cat.spells.find((s) => s.id === p.spellId),
            duration = spell?.duration.match(/(\d+)\s+(minute|hour)/i),
            rounds =
              m.rounds ||
              (duration
                ? Number(duration[1]) * (duration[2]?.toLowerCase() === 'hour' ? 600 : 10)
                : 0)
          if (p.spellId === 'jump') {
            addEffect(t, 'jump-2024', '跳跃术', a, p.page, {
              concentration: false,
              expiresAt: null,
              endsAt: (character(t)?.runtime?.hours ?? character(a)?.runtime?.hours ?? 0) + 1 / 60,
              note: '实际自愿目标；每回合一次，10 尺移动换至多 30 尺跳跃',
            })
          } else if (!m.condition && (rounds || Object.keys(ruling).length))
            addEffect(t, p.spellId ?? 'gm-ruling', p.name + ' · GM 裁定', a, p.page, {
              concentration: !!spell?.concentration,
              ...(rounds ? expires(a, rounds) : {}),
              ...ruling,
              note: m.note,
            })
          detail += '；GM 裁定：' + m.note
        }
        if (p.mode === 'heal') {
          if (
            caster &&
            hasOrigin(caster, cat, 'healer') &&
            command.healerReroll !== false &&
            !p.triggered?.includes('healer-rerolled')
          ) {
            p.triggered = [...(p.triggered ?? []), 'healer-rerolled']
            const healing = p.damage[0]!.roll
            const old = healing.dice.reduce((n, x) => n + x, 0)
            const sides = Number(healing.formula.match(/d(\d+)/)?.[1] ?? 0)
            healing.dice = healing.dice.map((from, index) => {
              if (from !== 1) return from
              const to = checkedOriginDie(dice, sides)
              healing.rerolls = [...(healing.rerolls ?? []), { index, from, to, reason: 'healer' }]
              return to
            })
            healing.total += healing.dice.reduce((n, x) => n + x, 0) - old
            for (const reroll of healing.rerolls ?? [])
              detail += `；医疗师实际重掷：治疗骰 ${reroll.index + 1}，${reroll.from} → ${reroll.to}`
          }
          const n = Math.max(
            0,
            healingRollTotal(effects(t), p.damage[0]!.roll) +
              p.modifier +
              (!!character(a) && hasSubclass(character(a)!.build, 'life') && (p.slotLevel ?? 0) > 0
                ? 2 + p.slotLevel!
                : 0),
          )
          heal(t, n)
          detail += `；治疗 ${p.damage[0]!.roll.formula} [${p.damage[0]!.roll.dice}] = ${p.damage[0]!.roll.total}`
          detail += `；${s.name}恢复 ${n} HP`
          parts = []
        }
        if (p.mode === 'temporary') {
          temp(
            t,
            p.spellId === 'false-life' &&
              hasInvocation(character(a)!.build, 'vigor') &&
              p.slotLevel === 0
              ? 12
              : p.damage[0]!.roll.total,
          )
          detail += `；${s.name}临时 HP ${stats(t).temporaryHp}`
          parts = []
        }
        if (p.metamagic?.option === 'careful' && p.metamagic.protectedIds.includes(t.id)) parts = []
        if(!spec&&p.spellId&&parts.some(part=>part.roll.total>0)&&!(p.kind==='save'&&!entry.hit&&!p.half)&&stats(t).effects.some(f=>f.key==='bestow-curse'&&f.supportChoice==='damage'&&sourceMatches(f.sourceId,a)))parts.push({type:'necrotic',roll:rollDamage('1d8',dice)})
        if(attachHitSpellDamage(e,p,t.id,parts))parts=[]
        let total = 0
        const effectiveDamageTypes: import('./combat-types').DamageType[] = []
        const grouped = new Map<string, { type: DamagePart['type']; amount: number }>()
        for (const part of parts) {
          if (p.kind === 'save' && !entry.hit && !p.half && !potentHalf && !p.damageAlways) continue
          const prev = grouped.get(part.type)
          grouped.set(part.type, { type: part.type, amount: (prev?.amount ?? 0) + part.roll.total })
          detail += `；${part.type} ${part.roll.formula} [${part.roll.dice}] = ${part.roll.total}`
          for (const reroll of part.roll.rerolls ?? [])
            detail += `；酒馆斗殴者实际重掷：伤害骰 ${reroll.index + 1}，${reroll.from} → ${reroll.to}`
        }
        if(spec&&entry.hit&&stats(a).effects.some(f=>f.key==='enlarge-reduce'&&f.m3?.option==='reduce')&&(!p.spellId||p.spellId==='true-strike')){const reduced=grouped.get(spec.type);if(reduced)reduced.amount=Math.max(1,reduced.amount)}
        const interceptionKinds = new Map<string, number>()
        for (const i of entry.interceptions ?? [])
          interceptionKinds.set(
            i.kind ?? 'interception',
            Math.max(interceptionKinds.get(i.kind ?? 'interception') ?? 0, i.reduction),
          )
        let interception = [...interceptionKinds.values()].reduce((sum, n) => sum + n, 0)
        let reduction = entry.defense?.reduction ?? 0
        const unreduced = [...grouped.values()].reduce(
          (sum, part) =>
            sum +
            adjustDamage(
              part.amount,
              part.type,
              defenses(t, cs, cat),
              p.kind === 'save' && !entry.hit && p.half||p.spellId==='acid-arrow'&&!entry.hit,
            ),
          0,
        )
        if (!stoneUsed && t.id === stoneTarget && unreduced > 0) {
          const c = character(t)
          if (
            c?.runtime?.wildShape ||
            c?.build.speciesId !== 'goliath' ||
            one(c.build, 'ancestry') !== 'stone'
          )
            throw new Error('此目标没有石之坚韧')
          spend(t, 'reaction')
          runtime(t, { type: 'resource', id: 'giant-ancestry', amount: 1, note: '石之坚韧' })
          stoneUsed = true
          reduction = Math.max(0, checkedDie(dice, 12) + s.mods.con)
          detail += `；石之坚韧减免 ${reduction}`
        }
        let defenseThisEntry = entry.defense?.kind === 'uncanny'
        if (!defenseUsed && t.id === defenseTarget) {
          const defender = character(t)
          if (p.kind !== 'attack' || !entry.hit || !defender)
            throw new Error('防御反应须由被命中角色使用')
          if (
            command.uncanny &&
            (defender.build.classId !== 'rogue' || defender.level < 5 || !entry.env.targetSees)
          )
            throw new Error('诡异闪避须五级盗贼看见攻击者')
          if (
            command.deflect &&
            (defender.build.classId !== 'monk' ||
              defender.level < 3 ||
              ![...grouped.keys()].some((t) => ['bludgeoning', 'piercing', 'slashing'].includes(t)))
          )
            throw new Error('偏转攻击须三级武僧受到含物理伤害的攻击')
          spend(t, 'reaction')
          defenseUsed = true
          defenseThisEntry = true
          if (command.deflect) {
            if (reduction) throw new Error('不能使用第二个减伤反应')
            reduction = checkedDie(dice, 10) + stats(t).mods.dex + defender.level
            detail += '；偏转攻击减伤 ' + reduction + '，降至零后的反击由 GM 另行裁定'
          }
        }
        const typeAmounts:Partial<Record<import('./combat-types').DamageType,number>>={}
        for (const part of grouped.values()) {
          const half =
            ((p.kind === 'save' && !entry.hit && p.half||p.spellId==='acid-arrow'&&!entry.hit)) ||
            !!potentHalf ||
            (defenseThisEntry && (!!command.uncanny || entry.defense?.kind === 'uncanny'))
          const defender = character(t)
          if (
            p.kind === 'attack' &&
            entry.hit &&
            defender &&
            hasFeat(defender.build, 'heavy-armor-master', cat) &&
            ['bludgeoning', 'piercing', 'slashing'].includes(part.type) &&
            defender.inventory.some(
              (row) => row.equipped && findItem(defender, cat, row.itemId)?.category === 'heavy',
            )
          )
            part.amount = Math.max(0, part.amount - pbOf(defender.build))
          const intercepted = Math.min(interception, part.amount)
          part.amount -= intercepted
          interception -= intercepted
          const use = Math.min(reduction, half ? Math.floor(part.amount / 2) : part.amount)
          const def = defenses(t, cs, cat)
          if (
            caster &&
            ((p.spellId &&
              hasFeat(caster.build, 'elemental-adept', cat) &&
              one(caster.build, 'feat-element') === part.type) ||
              (hasFeat(caster.build, 'poisoner', cat) && part.type === 'poison'))
          )
            def.resistances = def.resistances.filter((type) => type !== part.type)
          const effective = supportAdjustedDamage(t, part.amount, part.type, def, half, use)
          total += effective;typeAmounts[part.type]=(typeAmounts[part.type]??0)+effective
          if (effective > 0) effectiveDamageTypes.push(part.type)
          reduction -= use
        }
        if (
          total &&
          caster?.runtime?.revelation &&
          command.revelationBonus &&
          (!revelationTarget || t.id === revelationTarget) &&
          e.actors[e.current]?.id === a.id &&
          (p.kind === 'attack' || !!p.spellId) &&
          !a.turn.manualUsed?.includes('revelation-damage')
        ) {
          const type = caster.runtime.revelation.mode === 'shroud' ? 'necrotic' : 'radiant'
          const revelationDamage = supportAdjustedDamage(t, pbOf(caster.build), type)
          total += revelationDamage
          if (revelationDamage > 0) effectiveDamageTypes.push(type)
          a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'revelation-damage']
          detail += '；天启本回合一次 ' + type + ' ' + pbOf(caster.build)
        }
        const coating = caster?.runtime?.effects?.find(
          (f) => f.key === 'poisoner-coating' && f.note.split('|')[0] === spec?.instanceId,
        )
        if (entry.hit && coating && total > (character(t)?.runtime?.advanced?.ward ?? 0)) {
          const dc = Number(coating.note.split('|')[1]),
            save = savingRoll(t, 'con', entry.env, cs, cat, dice)
          setEffects(
            a,
            effects(a).filter((f) => f.id !== coating.id),
          )
          if (save.autoFail || save.total < dc) {
            const poison = rollDamage('2d8', dice),
              def = defenses(t, cs, cat)
            def.resistances = def.resistances.filter((k) => k !== 'poison')
            total += supportAdjustedDamage(t, poison.total, 'poison', def)
            addEffect(t, 'poisoner-dose', '强效毒剂', a, 0, {
              condition: 'poisoned',
              ...expires(a, 1, 'end'),
              note: '体质豁免失败；至使用者下回合结束',
            })
            detail += '；强效毒剂 2d8＝' + poison.total
          } else detail += '；强效毒剂豁免成功；涂层已消耗'
        }
        if (
          entry.hit &&
          spec &&
          caster &&
          entry.critical &&
          spec.type === 'bludgeoning' &&
          hasFeat(caster.build, 'crusher', cat)
        )
          addEffect(t, 'crusher-critical', '碾压者重击', a, 0, expires(a, 1))
        if (
          entry.hit &&
          spec &&
          caster &&
          spec.type === 'slashing' &&
          hasFeat(caster.build, 'slasher', cat)
        ) {
          if (!a.turn.manualUsed?.includes('slasher-speed')) {
            addEffect(t, 'slasher-speed', '挥砍者减速', a, 0, {
              speedPenalty: 10,
              ...expires(a, 1),
            })
            a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'slasher-speed']
          }
          if (entry.critical)
            addEffect(t, 'slasher-critical', '挥砍者重击', a, 0, {
              attackDisadvantage: true,
              ...expires(a, 1),
            })
        }
        if (p.spellId === 'witch-bolt'&&!p.m5EffectId)
          addEffect(t, 'witch-bolt', p.name, a, p.page, {
            concentration: true,
            ...expires(a, 10),
            note: '六十尺／全遮蔽结束，GM 在触发前核对',
          })
        let wardRemaining=character(t)?.runtime?.advanced?.ward??0
        const receivedTypes:Partial<Record<import('./combat-types').DamageType,number>>={}
        for(const [kind,amount] of Object.entries(typeAmounts)){const absorbed=Math.min(wardRemaining,amount??0);wardRemaining-=absorbed;receivedTypes[kind as import('./combat-types').DamageType]=(amount??0)-absorbed}
        damageResults.push({
          damageReceived:Math.max(0,total-(character(t)?.runtime?.advanced?.ward??0)),receivedTypes,
          actorId: t.id,
          pendingId: p.id ?? null,
          damage: total,
          types: [...grouped.keys()].join(','),typeAmounts,
        })
        if (spec)
          a.turn.lastAttack = {
            targetId: t.id,
            weaponId: spec.weaponId,
            unarmed: spec.id === 'unarmed'||spec.properties.includes('unarmed'),
            ranged: spec.ranged,
            type: spec.type,
            critical: entry.critical,
            hit: entry.hit,
            damaged: total > 0,
            tick: e.tick,
            token: crypto.randomUUID(),
          }
        if (total) {
          if (spec)
            a.turn.lastAttack = {
              targetId: t.id,
              weaponId: spec.weaponId,
              unarmed: spec.id === 'unarmed',
              ranged: spec.ranged,
              type: spec.type,
              critical: entry.critical,
              hit: entry.hit,
              damaged: true,
              tick: e.tick,
              token: crypto.randomUUID(),
            }
          const damageAfterWard = Math.max(0, total - (character(t)?.runtime?.advanced?.ward ?? 0))
          const useRelentless = (relentlessTargets ? relentlessTargets.includes(t.id) : t.id === relentlessTarget) &&
            !usedRelentlessTargets.has(t.id) && s.hp > 0 && damageAfterWard >= s.hp + s.temporaryHp &&
            damageAfterWard < s.hp + s.temporaryHp + s.maxHp
          damage(
            t,
            total,
            entry.critical,
            command.nonlethal && (!nonlethalTargets || nonlethalTargets.includes(t.id)) && !!spec && !spec.ranged,
            useRelentless,
            undefined,
            effectiveDamageTypes,
          )
          if (useRelentless) usedRelentlessTargets.add(t.id)
          concentration(t)
        }
        if (spec && a.turn.lastAttack) a.turn.lastAttack.targetDown = stats(t).hp === 0
        if (
          entry.hit &&
          spec?.proneMaxSize &&
          (!spec.proneRequiresCharge || entry.env.npcChargeConfirmed) &&
          !stats(t).dead &&
          !t.npc?.conditionImmunities.includes('prone')
        ) {
          const c = character(t)
          if (withinSize(t, spec.proneMaxSize)) {
            if (c) runtime(t, { type: 'condition', id: 'prone', active: true })
            else if (!t.npc!.conditions.includes('prone')) t.npc!.conditions.push('prone')
            detail += '；命中倒地，体型符合限制'
          }
        }
        if (
          entry.hit &&
          spec &&
          !spec.ranged &&
          s.effects.some((effect) => effect.key === 'armor-of-agathys') &&
          s.temporaryHp > 0
        ) {
          const cold = Number(s.effects.find((effect) => effect.key === 'armor-of-agathys')!.note)
          if (!Number.isInteger(cold) || cold < 5 || cold > 45)
            throw new Error('黯冰狱铠的来源伤害记录不合法')
          damage(a, supportAdjustedDamage(a, cold, 'cold'), false, false, false, undefined, [
            'cold',
          ])
          concentration(a)
          detail += '；黯冰狱铠命中返伤 ' + cold + ' 寒冷'
        }
        if (stats(t).temporaryHp === 0)
          setEffects(
            t,
            effects(t).filter((effect) => effect.key !== 'armor-of-agathys'),
          )
        if (
          entry.hit &&
          total &&
          spec?.id === 'unarmed' &&
          caster &&
          hasOrigin(caster, cat, 'tavern-brawler') &&
          p.triggered?.includes('attack-action') &&
          command.pushConfirmed &&
          e.actors[e.current]?.id === a.id &&
          !a.turn.manualUsed?.includes('tavern-push')
        ) {
          a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'tavern-push']
          detail += '；酒馆斗殴者推离 5 尺（本回合一次），GM 更新目标位置'
        }
        const hit = entry.hit
        if (hit && a.companion?.spellId === 'summon-undead') {
          if (a.companion.form === 'ghostly')
            addEffect(t, 'undead-fear', '亡灵灵魄：致死之触', a, 0, {
              condition: 'frightened',
              ...expires(t, 1, 'end'),
            })
          if (a.companion.form === 'putrid' && s.conditions.includes('poisoned'))
            addEffect(t, 'undead-paralysis', '亡灵灵魄：腐灭爪击', a, 0, {
              condition: 'paralyzed',
              ...expires(t, 1, 'end'),
            })
        }
        if (p.mastery && spec && hit) {
          switch (spec.mastery) {
            case 'Sap':
              addEffect(t, 'sap', 'Sap：下一次攻击劣势', a, 91, {
                attackDisadvantage: true,
                ...expires(a, 1),
              })
              break
            case 'Slow':
              if (total)
                addEffect(t, 'slow', 'Slow：速度 −10', a, 91, {
                  speedPenalty: 10,
                  ...expires(a, 1),
                })
              break
            case 'Vex':
              if (total) addEffect(t, 'vex', 'Vex：来源下一次攻击优势', a, 91, expires(a, 1, 'end'))
              break
            case 'Topple': {
              const dc = 8 + (character(a) ? pbOf(character(a)!.build) : 2) + spec.modifier,
                roll = savingRoll(t, 'con', entry.env, cs, cat, dice)
              detail += `；Topple ${roll.total}/DC ${dc}`
              if (roll.autoFail || roll.total < dc) {
                if (character(t)) runtime(t, { type: 'condition', id: 'prone', active: true })
                else t.npc!.conditions.push('prone')
              }
              break
            }
            case 'Push':
              detail +=
                '；Push：至多推离 10 尺，体型及位置由 GM 确认' +
                (command.pushConfirmed ? '（已确认）' : '')
              break
            case 'Cleave':
              addEffect(a, 'cleave-ready', 'Cleave 可选额外攻击', a, 91, {
                expiresAt: e.tick,
                phase: 'end',
              })
              break
          }
        }
        const key = p.effectKey
        if(key==='ray-of-enfeeblement'&&!hit)addEffect(t,'enfeeblement-next-attack',p.name,a,p.page,{attackDisadvantage:true,...expires(a,1)})
        if (p.unarmed && hit) {
          if (p.unarmed.kind === 'grapple') {
            const c = character(a)
            if (!c || !freeHandSlots(c, cat).includes(p.unarmed.hand))
              throw Error('擒抱结算时所选手已被占用')
            addEffect(t, 'unarmed-grapple', '擒抱', a, 0, {
              condition: 'grappled',
              grapple: { hand: p.unarmed.hand, dc: p.dc!, range: p.unarmed.range },
              note: '目标可用动作进行运动／体操检定挣脱；来源可免费释放',
            })
          } else if (p.unarmed.kind === 'prone') {
            if (character(t)) runtime(t, { type: 'condition', id: 'prone', active: true })
            else if (
              !t.npc!.conditionImmunities.includes('prone') &&
              !t.npc!.conditions.includes('prone')
            )
              t.npc!.conditions.push('prone')
          } else {
            detail += '；目标推离 5 尺，地图自动校验落点；独立战斗桌由 GM 更新位置'
          }
        }
        if (key && (hit || p.mode === 'buff')) {
          const spell = cat.spells.find((s) => s.id === p.spellId),
            duration = spell?.duration.match(/(\d+)\s+(minute|hour)/i),
            rounds = duration
              ? Number(duration[1]) * (duration[2]!.toLowerCase() === 'hour' ? 600 : 10)
              : 1,
            concentrating = spell?.concentration ?? false,
            base: Partial<ActiveEffect> = {
              spellId: p.spellId ?? undefined, spellLevel: p.slotLevel ?? spell?.level ?? 0, castId: spell?.concentration ? character(a)?.runtime?.concentration?.castId??a.npc?.concentration?.castId??p.castingId??p.id : p.castingId??p.id,
              clockSourceId:character(a)?.id??a.npc?.concentration?.clockSourceId??cs[0]?.id,
              concentration: concentrating,
              ...expires(
                a,
                p.metamagic?.option === 'extended' ? Math.min(14400, rounds * 2) : rounds,
              ),
            }
          const spatialEffect=m3SpellEffect(key,p.m3Choice,character(a)?runtimeSpells(character(a)!,cat).find(g=>g.key===p.sourceKey)?.ability:a.npc?.abilities?.find(b=>'npc:'+b.id===p.sourceKey)?.ability??a.npc?.spellcasting?.ability??'wis')
          if(spatialEffect){
            addEffect(t,spatialEffect.key??key,p.name,a,p.page,{...base,...spatialEffect,sourceId:a.characterId??a.npcId??a.id,clockSourceId:character(a)?.id??a.npc?.concentration?.clockSourceId??cs[0]?.id})
            if(key==='expeditious-retreat'&&t.id===a.id)a.turn.dash+=stats(a).speed
            continue
          }
          const control=socialControlEffect(key,p.dc!,p.controlChoices?.[t.id]??p.supportChoice,p.controlTargets,p.controlText)
          if(control){addEffect(t,key,p.name,a,p.page,{...base,...control});continue}
          const restoration = restorationBuff(key,p.slotLevel??spell?.level??0,p.supportChoice,p.modifier)
          if (restoration && spell) {
            if (key === 'mage-armor' && character(t) && equipmentLayout(character(t)!,cat).slots.armor?.length)
              throw Error('法师护甲目标必须未穿护甲')
            const previous = hpSpellBonus(effects(t))
            if (key === 'protection-from-poison') {
              const state = character(t) ? runtimeState(character(t)!,cat) : t.npc!
              restoreCondition(state,'poisoned')
              if (character(t)) character(t)!.runtime = state as ReturnType<typeof runtimeState>
            }
            addEffect(t,key,p.name,a,p.page,{...base,...restoration,
              sourceId:character(a)?.id??a.id,clockSourceId:character(a)?.id})
            if (key === 'aid') {
              const increase = Math.max(0,hpSpellBonus(effects(t))-previous)
              if (character(t)) { const state=runtimeState(character(t)!,cat);state.hp+=increase;character(t)!.runtime=state }
              else t.npc!.hp+=increase
            }
            continue
          }
          switch (key) {
            case 'warding-bond': {
              const bodies = e.actors.map(actor => ({id: actor.characterId ?? actor.npcId ?? actor.id,
                aliases: [actor.id, actor.characterId, actor.npcId].filter((id): id is string => !!id),
                hp: stats(actor).hp, effects: effects(actor)}))
              connectWardingBond(bodies, a.characterId ?? a.npcId ?? a.id, t.characterId ?? t.npcId ?? t.id,
                {id:crypto.randomUUID(),key,name:p.name,sourceId:a.id,page:p.page,
                  concentration:false,expiresAt:null,encounterId:e.id,phase:'start',note:'守护之链：双方60尺内，施法者归零或任一方重新连接即终止',...base,
                  clockSourceId:(character(a) ?? cs[0])?.id,
                  endsAt:((character(a) ?? cs[0]) ? runtimeState((character(a) ?? cs[0])!,cat).hours : 0)+1})
              bodies.forEach((b,i) => setEffects(e.actors[i]!, b.effects))
              break
            }
            case 'goodberry': {
              const c=character(a)
              if(!c||t.id!==a.id)throw Error('神莓须由有完整背包的施法者生成在自己手里')
              createGoodberries(c,cat,p.id!)
              detail+='；生成10颗神莓，24小时期限按施法者时钟'
              break
            }
            case 'dispel-magic': {
              if(p.dispelZoneId){
                const z=e.zones?.find(z=>z.id===p.dispelZoneId)
                if(!z)throw Error('待解除区域已结束，请GM核对，不能转而解除角色身上的效果')
                const rows:ActiveEffect[]=[{id:z.id,key:z.spellId,spellId:z.spellId,spellLevel:z.slotLevel,castId:z.id,name:z.name,
                  sourceId:z.sourceId,page:0,concentration:false,expiresAt:null,encounterId:e.id,phase:'start',note:''}]
                const result=dispelSpellEffects(rows,p.slotLevel??3,dc=>{
                  const c=character(a),ability=c&&runtimeSpells(c,cat).find(g=>g.key===p.sourceKey)?.ability
                  if(!c){if(!a.npc?.spellcasting)throw Error('解除魔法施法来源已改变');return checkedDie(dice,20)+p.modifier}
                  if(!ability)throw Error('解除魔法施法来源已改变')
                  const checked=applyRuntime(c,cat,{type:'check',kind:'ability',id:ability,dc},dice);c.runtime=checked.runtime
                  return checked.runtime!.advanced!.lastCheck!.total
                })
                if(result.removed.includes(z.id)){e.zones=e.zones!.filter(v=>v.id!==z.id);endDispelledZoneSource(z,e,cs)}
                detail+='；'+result.text;break
              }
              const outcome=dispelSpellEffects(effects(t),p.slotLevel??3,(dc)=>{
                const caster=character(a)
                if(caster){const ability=runtimeSpells(caster,cat).find(g=>g.key===p.sourceKey)?.ability
                  if(!ability)throw Error('解除魔法的施法来源已变化，须GM重新核对')
                  const checked=applyRuntime(caster,cat,{type:'check',kind:'ability',id:ability,dc},dice)
                  caster.runtime=checked.runtime
                  return checked.runtime!.advanced!.lastCheck!.total
                }
                return checkedDie(dice,20)+p.modifier
              })
              setEffects(t,outcome.effects);detail+='；'+outcome.text
              break
            }
            case 'lesser-restoration': {
              const state = character(t) ? runtimeState(character(t)!, cat) : t.npc!
              restoreCondition(state, p.supportChoice!)
              if (character(t)) character(t)!.runtime = state as ReturnType<typeof runtimeState>
              break
            }
            case 'guidance':
            case 'resistance': {
              const used = effects(t).find(
                (f) => f.key === 'resistance' && f.resistanceUsedTurn === e.id + ':' + e.tick,
              )?.resistanceUsedTurn
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                sourceId: a.characterId ?? a.id,
                clockSourceId: a.characterId ?? undefined,
                supportChoice: p.supportChoice,
                ...(key === 'resistance' && used ? { resistanceUsedTurn: used } : {}),
              })
              break
            }
            case 'item-burning':
              addEffect(t, 'burning', '燃烧危害', a, p.page, {
                expiresAt: null,
                note: '每回合开始 1d4 火焰伤害；动作打滚熄灭并倒地，或 GM 确认浇灭/扑灭',
              })
              break
            case 'searing-smite':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                startDamage: {
                  dice: (p.slotLevel || 1) + 'd6',
                  damageType: 'fire',
                  dc: a.npc?.spellcasting?.dc ?? 8 + (character(a)?pbOf(character(a)!.build):2) + p.modifier,
                },
              })
              break
            case 'slow':
            case 'ray-of-enfeeblement':
              addEffect(t,key,p.name,a,p.page,{...base,...m2ControlEffect(key,p.dc!),clockSourceId:a.characterId??undefined,
                endsAt:character(a)?runtimeState(character(a)!,cat).hours+1/60:undefined})
              break
            case 'fear':
              addEffect(t,key,p.name,a,p.page,{...base,condition:'frightened',repeatSave:{ability:'wis',dc:p.dc!},visibility:'public',note:'弃下持有物；疾走沿安全路线远离；仅回合末失去来源视线才再豁免。路线和物件须GM核对。'})
              break
            case 'sanctuary':
              addEffect(t,key,p.name,a,p.page,{...base,spellDc:a.npc?.spellcasting?.dc??8+p.modifier+(character(a)?pbOf(character(a)!.build):(a.npc?.templateMetadata?.proficiencyBonus??2)),note:'攻击或单体伤害法术须感知豁免；范围不受保护；受术者攻击、施法或造成伤害结束'})
              break
            case 'zone-of-truth':
              addEffect(t,key,p.name,a,p.page,{...base,visibility:'owner',control:{dc:8+p.modifier+(character(a)?pbOf(character(a)!.build):(a.npc?.templateMetadata?.proficiencyBonus??2)),targets:[],text:'范围及进入／离开由GM核对',inside:true},note:'区域内首次进入／回合开始魅力豁免；失败不能故意说谎，可拒答或回避。仅来源知道豁免结果；不自动识谎'})
              addEffect(a,'zone-of-truth-source',p.name+'：区域来源',a,p.page,{...base,visibility:'owner',control:{dc:8+p.modifier+(character(a)?pbOf(character(a)!.build):(a.npc?.templateMetadata?.proficiencyBonus??2)),targets:p.targets.map(t=>t.id),text:'半径15尺，GM确认区域及进出',region:p.controlRegion},note:'10分钟；区域存在时GM可登记新进入者；结果只向施法者与GM开放'})
              break
            case 'command':
              addEffect(t,key,p.name,a,p.page,{...base,supportChoice:p.supportChoice,expiresAt:nextTurnTick(e,t.id),phase:'end',note:'下个回合执行指定命令：'+p.supportChoice+'；移动路线及结果由GM核对，不能获得额外行动'})
              break
            case 'enthrall':
              addEffect(t,key,p.name,a,p.page,{...base,...m2ControlEffect(key,p.dc!)})
              break
            case 'hold-person':
            case 'blindness-deafness':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                condition: key === 'hold-person' ? 'paralyzed' : p.supportChoice!,
                clockSourceId: a.characterId ?? undefined,
                endsAt: character(a) ? runtimeState(character(a)!, cat).hours + 1 / 60 : undefined,
                visibility: 'public',
                repeatSave: { ability: p.save!, dc: p.dc! },
                note: key === 'hold-person' ? 'GM 已确认目标为类人生物' : '目标回合末重投体质豁免',
              })
              break
            case 'magic-weapon':
            case 'elemental-weapon':
              if (
                !p.boundWeaponId ||
                !((character(t)?.inventory.some((row) => row.instanceId === p.boundWeaponId))||t.npc?.equipment?.some(g=>g.id===p.boundWeaponId))
              )
                throw new Error('附魔武器实例已不可用')
              if(key==='magic-weapon')addEffect(a,'magic-weapon-source',p.name,a,p.page,{...base,note:p.boundWeaponId})
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                weapon: {
                  instanceId: p.boundWeaponId,
                  bonus: key === 'magic-weapon' && (p.slotLevel ?? 2) >= 3 ? 2 : 1,
                  ...(key === 'elemental-weapon' ? { dice: '1d4', damageType: p.notes[1] } : {}),
                },
              })
              break
            case 'crown-of-madness':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                condition: 'charmed',
                repeatSave: { ability: 'wis', dc: p.dc! },
                note: 'GM 确认类人；移动前须以动作攻击指定触及内目标，无适用目标时正常行动',
              })
              addEffect(a, 'crown-maintenance', '疯狂冠冕：每回合魔法动作维持', a, p.page, {
                ...base,
                maintainedTick: e.tick,
              })
              // Use the spell key so concentration cleanup is shared; distinguish the caster by metadata.
              break
            case 'friends':
            case 'charm-person':
            case 'animal-friendship':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                sourceId: a.characterId ?? a.npcId ?? a.id,
                clockSourceId: a.characterId ?? undefined,
                condition: 'charmed',
                note:
                  key === 'animal-friendship'
                    ? '对来源魅惑；来源或其盟友造成伤害结束'
                    : '按2024规则对来源生效；结束后目标知情',
              })
              break
            case 'sleep':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                clockSourceId: a.characterId ?? undefined,
                sourceId: a.characterId ?? a.npcId ?? a.id,
                condition: 'incapacitated',
                sleepStage: 'drowsy',
                repeatAfterTick: nextTurnTick(e, t.id),
                repeatSave: { ability: 'wis', dc: p.dc! },
                visibility: 'public',
                note: '回合末失败转昏迷；受伤或他人动作唤醒',
              })
              break
            case 'hypnotic-pattern':
              if (t.npc?.conditionImmunities.includes('charmed')) break
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                clockSourceId: a.characterId ?? undefined,
                sourceId: a.characterId ?? a.npcId ?? a.id,
                conditions: ['charmed', 'incapacitated'],
                speedZero: true,
                visibility: 'public',
                note: '受伤或他人动作唤醒；魅惑、失能且速度为0',
              })
              break
            case 'hideous-laughter':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                clockSourceId: a.characterId ?? undefined,
                sourceId: a.characterId ?? a.npcId ?? a.id,
                conditions: ['incapacitated', 'prone'],
                repeatSave: { ability: 'wis', dc: p.dc! },
                visibility: 'public',
                note: '2024：不能自行结束倒地；每回合末、每次受伤（优势）感知豁免',
              })
              break
            case 'speak-with-animals':
              addEffect(a, key, p.name, a, p.page, {
                ...base,
                concentration: false,
                note: '可以理解并语言沟通野兽；不改变知识、态度或服从',
              })
              break
            case 'thunderous-smite':
              addEffect(t, key, p.name, a, p.page, {
                condition: 'prone',
                note: '力量失败；推離十尺由 GM 更新位置',
              })
              break
            case 'wrathful-smite':
              addEffect(t, key, p.name, a, p.page, {
                condition: 'frightened',
                repeatSave: { ability: 'wis', dc: p.dc! },
                ...expires(a, 10),
                note: '一分钟；目标每回合末感知豁免成功结束，DC ' + p.dc,
              })
              break
            case 'acid-arrow':
              addEffect(t,'acid-arrow',p.name,a,p.page,{expiresAt:null,concentration:false,endDamage:{dice:Math.max(1,p.slotLevel||2)+'d4',damageType:'acid'},note:'命中后的目标下回合末一次强酸伤害，保留原来源；跨场景不取消'});break
            case 'ensnaring-strike':
              addEffect(t,key,p.name,a,p.page,{...base,condition:'restrained',startDamage:{dice:(p.slotLevel||1)+'d6',damageType:'piercing',dc:p.dc!},note:'回合初穿刺；自身或触及内他人动作力量运动检定脱困'})
              break
            case 'shining-smite':
              addEffect(t,key,p.name,a,p.page,{...base,visibility:'public',note:'5尺明亮光；攻击优势且不能受益隐形'})
              break
            case 'blinding-smite':
              addEffect(t, key, p.name, a, p.page, {
                condition: 'blinded',
                repeatSave: { ability: 'con', dc: p.dc ?? (character(a) ? 8 + pbOf(character(a)!.build) + p.modifier : a.npc?.spellcasting?.dc ?? 10) },
                ...expires(a, 10),
                note: '无需初次豁免；目标回合末体质豁免成功结束',
              })
              break
            case 'shield':
              addEffect(t,key,p.name,a,p.page,{...base,acBonus:5,...expires(a,1)});break
            case 'blade-ward':
            case 'crusaders-mantle':
              addEffect(t, key, p.name, a, p.page, base)
              break
            case 'mind-sliver':
              addEffect(t, key, p.name, a, p.page, { saveDie: -4, ...expires(a, 1, 'end') })
              break
            case 'arms-of-hadar':
              addEffect(t, key, p.name, a, p.page, {
                ...expires(t, 1),
                noReaction: true,
                note: '不能执行反应，至目标下次回合开始',
              })
              break
            case 'armor-of-agathys':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                note: String(5 * (p.slotLevel || 1)),
              })
              break
            case 'aura-of-vitality':
              addEffect(a, key, p.name, a, p.page, base)
              a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'vitality-ready']
              break
            case 'feign-death':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                condition: 'incapacitated',
                speedZero:true,conditionImmunities:['poisoned'],
                note: '自愿目标；假死不是死亡，非心灵抗性和中毒免疫',
              })
              addEffect(t, key + '-blinded', p.name, a, p.page, { ...base, condition: 'blinded' })
              break
            case 'bless':
              addEffect(t, key, p.name, a, p.page, { ...base, attackDie: 4, saveDie: 4 })
              break
            case 'bane':
              addEffect(t, key, p.name, a, p.page, { ...base, attackDie: -4, saveDie: -4 })
              break
            case 'shield-of-faith':
              addEffect(t, key, p.name, a, p.page, { ...base, acBonus: 2 })
              break
            case 'mage-armor': {
              const c = character(t)
              if (c && equipmentLayout(c, cat).slots.armor?.length)
                throw new Error('Mage Armor 的目标必须未穿护甲')
              addEffect(t, key, p.name, a, p.page, { ...base, acBase: 13 })
              break
            }
            case 'longstrider':
              addEffect(t, key, p.name, a, p.page, { ...base, speedBonus: 10 })
              break
            case 'heroism':
              addEffect(t, key, p.name, a, p.page, { ...base, note: String(p.modifier) })
              break
            case 'divine-favor':
            case 'hex':
            case 'hunter-s-mark':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                supportChoice:p.supportChoice, m5AppliedTick:e.tick,m5AppliedHour:character(a)?.runtime?.hours??cs[0]?.runtime?.hours??0,
                ...(['hex','hunter-s-mark'].includes(key)?{expiresAt:null,encounterId:'outside',clockSourceId:character(a)?.id??a.npc?.concentration?.clockSourceId,endsAt:character(a)?.runtime?.concentration?.endsAt??a.npc?.concentration?.endsAt}:{}),
                note: '攻击检定命中加伤；脆弱诅咒只影响所选属性的属性检定，转移不重施',
              })
              break
            case 'faerie-fire':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                note: '可见目标攻击优势；不能受益于隐形',
              })
              break
            case 'entangle':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                condition: 'restrained',
                note: '力量（运动）检定逃脱及困难地形由 GM 管理',
              })
              break
            case 'chill-touch':
              addEffect(t, key, p.name, a, p.page, { blocksHealing: true, ...expires(a, 1, 'end') })
              break
            case 'ray-of-frost':
              addEffect(t, key, p.name, a, p.page, { speedPenalty: 10, ...expires(a, 1) })
              break
            case 'shocking-grasp':
              addEffect(t, key, p.name, a, p.page, {
                ...expires(t, 1),
                note: '不能进行借机攻击，其他反应仍可使用',
              })
              break
            case 'ray-of-sickness':
              if (!t.npc?.conditionImmunities.includes('poisoned'))
                addEffect(t, key, p.name, a, p.page, {
                  condition: 'poisoned',
                  ...expires(a, 1, 'end'),
                })
              break
            case 'vicious-mockery':
              addEffect(t, key, p.name, a, p.page, {
                attackDisadvantage: true,
                ...expires(t, 1, 'end'),
              })
              break
            case 'guiding-bolt':
              addEffect(t, key, p.name, a, p.page, expires(a, 1, 'end'))
              break
            case 'color-spray':
              addEffect(t, key, p.name, a, p.page, {
                ...base,
                visibility:'public',
                condition: 'blinded',
                ...expires(a, 1, 'end'),
              })
              break
            case 'starry-wisp':
              addEffect(t, key, p.name, a, p.page, {
                ...expires(a, 1, 'end'),
                visibility:'public',note: '10尺微光及不可获得隐形，保留原隐形来源',
              })
              break
            case 'spare-the-dying':
              if (character(t)) runtime(t, { type: 'stabilize' })
              else {
                if (t.npc!.hp || t.npc!.dead) throw new Error('需要活着的零 HP 生物')
                t.npc!.dead = false
              }
              break
            case 'shillelagh': {
              const w = attackOptions(a, cs, cat).find(
                (w) => (w.id === p.notes[0]||w.instanceId===p.notes[0]) && ['club', 'quarterstaff'].includes(w.weaponId ?? ''),
              )
              if (!w) throw new Error('请先选择当前手持木棒或长棍')
              addEffect(a, key, p.name, a, p.page, {
                ...base,
                note: w.instanceId!,
                ability: p.notes[1] as Ability,
                supportChoice:p.notes[2]==='force'?'force':'original',
              })
              break
            }
            case 'dissonant-whispers':
              if (t.turn.reaction && !s.conditions.includes('incapacitated')) {
                t.turn.reaction = false
                detail += '；目标消耗反应远离，路线与借机触发由 GM 确认'
              }
              break
            case 'thunderwave':
              detail += '；失败目标被推离 10 尺，位置由 GM 管理'
              break
          }
        }
      }
      if (p.afterWeapon?.length) {
        if (stats(a).dead || stats(a).conditions.includes('incapacitated'))
          detail += '；来源失能，攻击后拔收未执行'
        else for (const op of p.afterWeapon) runtime(a, op)
      }
      if(p.spellId==='lightning-arrow'&&p.attackWindowId){const window=e.attackWindows?.find(w=>w.id===p.attackWindowId);if(window)window.status='attached';if(e.attackParents?.at(-1)?.id===window?.attackId)e.attackParents?.pop()}
      e.pending = iceBurstPending(e,p,a,cs,cat,dice)??null
      cleanup()
      break
    }
    case 'zone-trigger': {
      noPending()
      cleanup()
      const a = actor(command.actorId),
        t = actor(command.targetId),
        z = e.zones?.find((z) => z.id === command.zoneId && z.sourceId === a.id)
      if (!z) throw new Error('持续区域已结束或来源不符')
      if (z.excludedIds.includes(t.id)) throw new Error('此目标在该区域的排除名单中')
      const phase = command.phase ?? 'enter',
        stamp =
          e.phase === 'active'
            ? e.tick
            : 1000001 + Math.floor(runtimeState(character(a)!, cat).hours * 600),
        perPhase = z.spellId === 'hunger-of-hadar' || z.spellId === 'cordon-of-arrows'
      if (z.spellId === 'hunger-of-hadar' && !['start', 'end'].includes(phase))
        throw new Error('哈达之欲仅在目标回合开始或结束触发')
      if (z.spellId === 'cordon-of-arrows' && !['enter', 'end'].includes(phase))
        throw new Error('警戒箭阵仅在首次进入或回合末触发')
      if (phase === 'start' && z.spellId !== 'hunger-of-hadar')
        throw new Error('该区域不在回合开始触发；请选择进入、移动或回合结束')
      if (
        explorationTiming &&
        (e.phase === 'active' ||
          explorationTiming.targetId !== t.id ||
          explorationTiming.phase !== phase)
      )
        throw Error('探索触发上下文不匹配')
      if ((phase === 'start' || phase === 'end') && !explorationTiming) {
        active()
        if (e.actors[e.current]?.id !== t.id) throw new Error('必须在该目标自己的回合处理此时机')
      }
      if (phase === 'created' && z.createdTick !== e.tick) throw new Error('区域创造触发已过期')
      if (
        explorationTiming
          ? z.explorationTriggered?.includes(explorationTiming.key)
          : perPhase
            ? z.phaseTriggered?.[t.id]?.[phase as 'start' | 'end' | 'enter'] === stamp
            : z.triggered[t.id] === stamp
      )
        throw new Error('此生物本回合已触发该区域的此伤害时机')
      reason(command.note)
      context(command.env)
      if (!command.env.areaConfirmed) throw new Error('请由 GM 确认区域覆盖与触发时机')
      const profile = zoneDamage(z, phase),
        ability = profile.save,
        roll = ability ? savingRoll(t, ability, command.env, cs, cat, dice) : null,
        hit = !roll || roll.autoFail || roll.total < z.dc
      if (explorationTiming)
        z.explorationTriggered = [...(z.explorationTriggered ?? []), explorationTiming.key].slice(
          -2000,
        )
      else if (perPhase) {
        const phases = (z.phaseTriggered ??= {})
        ;(phases[t.id] ??= {})[phase as 'start' | 'end' | 'enter'] = stamp
      } else z.triggered[t.id] = stamp
      if (z.spellId === 'cordon-of-arrows') z.ammunition!--
      if (z.spellId === 'moonbeam' && hit && character(t)?.runtime?.wildShape) {
        character(t)!.runtime!.wildShape = null
        addEffect(t, 'moonbeam', '月光束：离开圆柱前不能变形', a, 151, {
          concentration: true,
          note: '离开该区域后由 GM 移除此效果',
        })
      }
      e.pending = {
        kind: ability ? 'save' : 'automatic',
        actorId: a.id,
        name: z.name + ' · 持续触发',
        page: cat.spells.find((s) => s.id === z.spellId)?.source.page ?? 0,
        spellId: z.spellId,
        slotLevel: z.slotLevel,
        attack: null,
        targets: [
          { id: t.id, env: clone(command.env), roll, hit, critical: false, ac: stats(t).ac },
        ],
        damage: [{ type: profile.type, roll: rollDamage(profile.formula, dice) }],
        save: ability,
        dc: z.dc,
        half: profile.half,
        effectKey: null,
        modifier: 0,
        mode: 'zone',
        notes: [command.note],
        sneak: false,
        mastery: false,
        startedAt: e.tick,
      }
      detail = z.name + '持续触发：' + stats(t).name + '；' + command.note
      break
    }
    case 'zone-end': {
      noPending()
      const z = e.zones?.find((z) => z.id === command.zoneId && z.sourceId === command.actorId)
      if (!z) throw new Error('持续区域不存在')
      reason(command.note)
      if (z.spellId !== 'cordon-of-arrows')
        runtime(actor(z.sourceId), { type: 'end-effect', effect: 'concentration' })
      e.zones = (e.zones ?? []).filter((x) => x.id !== z.id)
      cleanup()
      detail = '结束持续区域 ' + z.name + '；' + command.note
      break
    }
    case 'zone-move': {
      noPending()
      cleanup()
      const a = actor(command.actorId),
        z = e.zones?.find((z) => z.id === command.zoneId && z.sourceId === a.id)
      if (!z || z.spellId !== 'cloud-of-daggers') throw new Error('此入口只用于移动匕首之云')
      if (!Number.isFinite(command.distance) || command.distance < 0 || command.distance > 30)
        throw new Error('匕首之云移动距离须在零至三十尺')
      reason(command.note)
      spend(a, 'action')
      detail = `魔法动作移动匕首之云 ${command.distance} 尺；${command.note}`
      break
    }
    case 'maintain-spell': {
      noPending()
      const a = actor(command.actorId)
      if (!effects(a).some((f) => f.key === 'crown-maintenance' && f.maintainedTick !== undefined))
        throw new Error('没有需要维持的疯狂冠冕')
      reason(command.note)
      spend(a, 'action')
      for (const f of effects(a).filter(
        (f) => f.key === 'crown-maintenance' && f.maintainedTick !== undefined,
      ))
        f.maintainedTick = e.tick
      detail = '魔法动作维持疯狂冠冕；' + command.note
      break
    }
    case 'companion-power': {
      noPending()
      active()
      cleanup()
      const a = actor(command.actorId),
        t = actor(command.targetId),
        companion = a.companion,
        owner = companion && actor(companion.ownerId),
        c = owner && character(owner)
      if(companion?.worldManaged)throw Error('稳定召唤物特能须从召唤与伙伴入口执行，保留世界位置、区域和能力记录')
      if (!companion || companion.dismissed || !c || companion.source !== 'spell-summon')
        throw new Error('请选择在场的相应灵魄')
      canAct(a)
      reason(command.note)
      context(command.env)
      const ability =
          companion.castingAbility ??
          (c.build.classId === 'wizard' ? 'int' : c.build.classId === 'druid' ? 'wis' : 'cha'),
        dc = 8 + stats(owner!).mods[ability] + pbOf(c.build)
      if (command.kind === 'fey-step') {
        if (companion.spellId !== 'summon-fey') throw new Error('只有妖精灵魄可以使用妖精步伐')
        spend(a, 'bonus')
        if (companion.form === 'fuming')
          addEffect(a, 'fey-fuming', '愤怒妖精：下次攻击优势', a, 0, {
            attackAdvantage: true,
            expiresAt: e.tick,
            phase: 'end',
          })
        if (companion.form === 'tricksy')
          addEffect(a, 'fey-darkness', '诡诈妖精：十尺立方魔法黑暗', a, 0, {
            ...expires(a, 1, 'end'),
            note:
              'GM 核对五尺内的黑暗原点、特殊视觉与覆盖，至灵魄下回合结束；传送落点 ' +
              JSON.stringify(command.destination ?? '由 GM 记录'),
          })
        if (companion.form === 'mirthful') {
          targetable(command.env, 10, false, true)
          const roll = savingRoll(t, 'wis', command.env, cs, cat, dice, 'charm')
          if (roll.autoFail || roll.total < dc)
            addEffect(t, 'fey-mirthful', '欢欣妖精：魅惑', a, 0, {
              condition: 'charmed',
              ...expires(a, 10),
              note: '受施法者和灵魄魅惑，任意伤害提前结束',
              charmSources: [a.id, owner!.id],
            })
          detail += `；感知 ${roll.total}/DC ${dc}`
        }
        detail = '妖精步伐：附赠动作传送至多三十尺；' + command.note + detail
      } else {
        if (companion.spellId !== 'summon-undead' || companion.form !== 'putrid')
          throw new Error('只有腐尸灵魄具有腐灭灵光')
        if (e.actors[e.current]?.id !== t.id || t.id === owner!.id)
          throw new Error('腐灭灵光仅在非施法者目标自己的回合开始触发')
        if (command.env.distance > 5 || !command.env.areaConfirmed)
          throw new Error('请确认目标在灵魄五尺光环内')
        const key = 'putrid-aura:' + a.id + ':' + e.tick
        if (t.turn.manualUsed?.includes(key)) throw new Error('本回合已处理该腐灭灵光')
        t.turn.manualUsed = [...(t.turn.manualUsed ?? []), key]
        const roll = savingRoll(t, 'con', command.env, cs, cat, dice, 'poison')
        if (roll.autoFail || roll.total < dc)
          addEffect(t, 'putrid-aura', '腐灭灵光：中毒', a, 0, {
            condition: 'poisoned',
            ...expires(t, 1),
          })
        detail = `腐灭灵光：体质 ${roll.total}/DC ${dc}；${command.note}`
      }
      break
    }
    case 'surge-npc': {
      noPending()
      active()
      const a = actor(command.actorId),
        c = character(a),
        surge = c && runtimeState(c, cat).advanced.surges?.find((s) => s.id === command.surgeId)
      if (!c || !hasSubclass(c.build, 'wild-magic') || !surge || surge.roll < 5 || surge.roll > 8)
        throw new Error('请选择已保存的 05–08 友善生物浪涌结果')
      if (runtimeState(c, cat).hours >= surge.startedAt + 1 / 60)
        throw new Error('该浪涌生物的一分钟存在期限已结束')
      if (
        e.actors.some(
          (other) => other.companion?.ownerId === a.id && other.companion.surgeId === surge.id,
        )
      )
        throw new Error('同一浪涌结果已建立生物，不能重复生成')
      reason(command.note)
      const oldIds = e.actors.map((a) => a.id),
        currentId = e.actors[e.current]!.id,
        roll = d20(command.npc.initiativeBonus, [], [], dice)
      e.actors.push({
        id: crypto.randomUUID(),
        characterId: null,
        npc: clone(command.npc),
        side: 'party',
        initiative: roll.total,
        surprised: false,
        turn: freshTurn(),
        companion: {
          ownerId: a.id,
          source: 'wild-surge',
          surgeId: surge.id,
          expiresHour: surge.startedAt + 1 / 60,
          expiresAfterRest: null,
          dismissed: false,
        },
      })
      insertSummonedInitiative(e, oldIds, currentId, cs)
      const state = runtimeState(character(a)!, cat)
      state.advanced.surges!.find((s) => s.id === surge.id)!.settled = true
      character(a)!.runtime = state
      detail =
        'GM 根据已保存浪涌 d100＝' +
        surge.roll +
        '、追加骰 [' +
        surge.subRolls +
        '] 建立友善生物 ' +
        command.npc.name +
        '；独立先攻 ' +
        roll.total +
        '；至原结果开始后一分钟；' +
        command.note
      break
    }
    case 'beast-forms': {
      noPending()
      const a = actor(command.actorId),
        c = character(a)
      if (!c || c.build.classId !== 'druid' || c.level < 2)
        throw new Error('只有二级及以上德鲁伊可以配置已知兽形')
      reason(command.note)
      const max = c.level >= 4 ? 6 : 4
      if (
        command.ids.length !== max ||
        new Set(command.ids).size !== max ||
        command.ids.some((id) => {
          const b = beast(id)
          return (
            !b ||
            b.fly > 0 ||
            b.cr >
              (hasSubclass(c.build, 'moon') ? Math.floor(c.level / 3) : c.level >= 4 ? 0.5 : 0.25)
          )
        })
      )
        throw new Error('请按等级选择 ' + max + ' 种不带飞行速度且符合 CR 的兽形')
      c.runtime = runtimeState(c, cat)
      c.runtime.knownBeasts = [...command.ids]
      detail = 'GM 确认长休／初次选择的已知兽形：' + command.note
      break
    }
    case 'wild-shape': {
      noPending()
      const a = actor(command.actorId),
        c = character(a)
      if(command.formId&&effects(a).some(f=>f.key==='moonbeam-no-shape'))throw Error('此月华之光来源阻止再次变形，须先离开区域')
      if (!c || c.build.classId !== 'druid' || c.level < 2) throw new Error('尚未获得荒野形态')
      spend(a, 'bonus')
      reason(command.note)
      c.runtime = runtimeState(c, cat)
      if (!command.formId) {
        if (!c.runtime.wildShape) throw new Error('当前未处于荒野形态')
        c.runtime.wildShape = null
        detail = '结束荒野形态；恢复原本属性与装备'
        break
      }
      if (effects(a).some((x) => x.key === 'moonbeam'))
        throw new Error('请先由 GM 确认已离开月光束并移除变形禁止效果')
      const b = beast(command.formId)
      if (
        !b ||
        b.fly ||
        b.cr >
          (hasSubclass(c.build, 'moon') ? Math.floor(c.level / 3) : c.level >= 4 ? 0.5 : 0.25) ||
        !c.runtime.knownBeasts!.includes(b.id)
      )
        throw new Error('须选择已知且符合等级 CR／飞行限制的兽形')
      runtime(a, { type: 'resource', id: 'wild-shape', amount: 1, note: '荒野形态' })
      const now = character(a)!
      now.runtime!.wildShape = {
        formId: b.id,
        endsAt: now.runtime!.hours! + Math.floor(c.level / 2),
        equipment: 'merge',
      }
      temp(a, hasSubclass(c.build, 'moon') ? 3 * c.level : c.level)
      detail =
        '荒野形态：' +
        b.name +
        '；临时 HP ' +
        (hasSubclass(c.build, 'moon') ? 3 * c.level : c.level) +
        '；原本 HP／精神属性／专注保留；装备融入；' +
        b.note +
        '；' +
        command.note
      break
    }
    case 'wild-companion': {
      noPending()
      if (e.actors.length >= 100) throw new Error('遭遇参与者已满，请在下一个遭遇继续召唤')
      const a = actor(command.actorId),
        c = character(a),
        b = beast(command.formId)
      if (!c || c.build.classId !== 'druid' || c.level < 2 || !b || b.cr !== 0)
        throw new Error('荒野伙伴须二级德鲁伊，选择 CR 0 形态')
      if (runtimeState(c, cat).wildShape) throw new Error('荒野形态中不能施放寻找魔宠')
      reason(command.note)
      spend(a, 'action')
      if (a.turn.surgeAction) throw new Error('动作如潮不能用于魔法动作')
      if (command.mode === 'wild-shape')
        runtime(a, { type: 'resource', id: 'wild-shape', amount: 1, note: '荒野伙伴' })
      else {
        if (e.slotSpent.includes(a.id)) throw new Error('同回合只能消耗一个法术位施法')
        c.runtime = runtimeState(c, cat)
        const level = castSlotLevel(command.mode),
          key = level === 1 ? 'slots' : 'slots-' + level,
          resource = level === 1 ? 'slots' : 'slots-' + level
        if ((c.runtime.createdSlots![key] ?? 0) > 0) c.runtime.createdSlots![key]!--
        else {
          if (!(c.runtime.resources[resource] ?? 0)) throw new Error('法术位不足')
          c.runtime.resources[resource]!--
        }
        e.slotSpent.push(a.id)
      }
      if (a.turn.quickenedCast) throw new Error('快捷法术后不能施放一环及以上法术')
      a.turn.levelSpellCast = true
      for (const previous of e.actors.filter(
        (x) => x.companion?.ownerId === a.id && x.companion.source === 'wild-companion',
      ))
        previous.companion!.dismissed = true
      const npc = beastNpc(b.id),
        id = crypto.randomUUID()
      npc.name = stats(a).name + '的荒野伙伴 · ' + b.name
      npc.attacks = []
      npc.source += '；Fey；不能攻击；零 HP 或主人完成长休时消失；操控与棋子由 GM 分配'
      const oldIds = e.actors.map((a) => a.id),
        currentId = e.actors[e.current]!.id
      e.actors.push({
        id,
        characterId: null,
        npc,
        side: a.side,
        initiative: checkedDie(dice, 20) + npc.initiativeBonus,
        surprised: false,
        turn: freshTurn(),
        companion: {
          ownerId: a.id,
          source: 'wild-companion',
          expiresAfterRest: runtimeState(character(a)!, cat).lastLongRestEnd,
          dismissed: false,
        },
      })
      insertSummonedInitiative(e, oldIds, currentId, cs)
      detail =
        '荒野伙伴已按独立先攻加入遭遇 ' +
        e.actors.find((a) => a.id === id)!.initiative +
        '；同值时新伙伴排后；GM 核对棋子位置；' +
        command.note
      break
    }
    case 'dismiss-companion': {
      noPending()
      const a = actor(command.actorId),
        target = actor(command.targetId)
      if (target.companion?.ownerId !== a.id) throw new Error('只能解散自己的荒野伙伴')
      spend(a, 'action')
      reason(command.note)
      target.companion.dismissed = true
      detail = '永久解散荒野伙伴；' + command.note
      break
    }
    case 'concentration-roll': {
      active();noPending()
      const a=actor(command.actorId),c=character(a),current=c?runtimeState(c,cat).concentration:a.npc?.concentration
      if(!current?.pendingDC)throw Error('当前没有待处理的实际专注豁免')
      const roll=savingRoll(a,'con',defaultEnvironment(),cs,cat,dice,'concentration'),dc=current.pendingDC
      e.pending={id:crypto.randomUUID(),concentrationSave:{actorId:a.id,spellId:current.spellId,castId:current.castId,dc},notCasting:true,kind:'save',actorId:a.id,name:'维持专注',page:0,spellId:null,attack:null,targets:[{id:a.id,env:defaultEnvironment(),roll,hit:roll.autoFail||roll.total<dc,critical:false,ac:0}],damage:[],save:'con',dc,half:false,effectKey:null,modifier:0,mode:'concentration',notes:['专注骰值已保存，先完成可选重掷再提交结果'],sneak:false,mastery:false,startedAt:e.tick}
      detail=stats(a).name+'的专注豁免已掷出，等待可选重掷；尚未结束效果';break
    }
    case 'concentration':
      active()
      noPending()
      if (!character(actor(command.actorId))?.runtime?.concentration?.pendingDC)
        throw new Error('当前没有待处理的专注豁免')
      concentration(actor(command.actorId))
      break
    case 'end-concentration': {
      active()
      const a = actor(command.actorId)
      if (!character(a)?.runtime?.concentration) throw new Error('当前没有维持专注')
      runtime(a, { type: 'end-effect', effect: 'concentration' })
      cleanup()
      detail = stats(a).name + '自愿结束专注（不消耗动作）'
      break
    }
    case 'wake': {
      noPending()
      const a = actor(command.actorId),
        t = actor(command.targetId)
      own(a)
      targetable(command.env, 5)
      reason(command.note)
      if (a.id === t.id) throw Error('不能用自身动作唤醒自己')
      if (!effects(t).some((f) => ['sleep', 'hypnotic-pattern'].includes(f.key)))
        throw Error('目标没有可用动作解除的睡眠／催眠图纹效果')
      spend(a, 'action')
      setEffects(
        t,
        effects(t).filter((f) => !['sleep', 'hypnotic-pattern'].includes(f.key)),
      )
      detail = `${stats(a).name}使用动作唤醒${stats(t).name}；${command.note}`
      break
    }
    case 'interact': {
      noPending()
      const a = actor(command.actorId)
      own(a)
      reason(command.note)
      if (command.cost === 'free') {
        if (!a.turn.objectInteraction) throw new Error('本回合免费物品交互已使用，请选择使用动作')
        a.turn.objectInteraction = false
      } else spend(a, command.cost)
      detail = `${stats(a).name}场景互动：${command.note}`
      break
    }
    case 'inventory': {
      noPending()
      const a = actor(command.actorId)
      own(a)
      if (!command.requirementsConfirmed) throw new Error('请由 GM 确认物品交互与穿脱用时')
      if (
        !['equip', 'item-remove', 'item-move', 'item-note', 'item-split', 'portrait-set'].includes(
          command.command.type,
        )
      )
        throw new Error('购买与添加物品请在战斗外操作，GM 奖励可另行记录')
      const inventoryCommand = command.command
      const heldRow =
        inventoryCommand.type === 'equip'
          ? character(a)?.inventory.find((r) => r.instanceId === inventoryCommand.instanceId)
          : undefined
      const item = heldRow && findItem(character(a)!, cat, heldRow.itemId)
      const gripOnly =
        inventoryCommand.type === 'equip' &&
        inventoryCommand.equipped &&
        heldRow?.equipped &&
        handSlot(assignedSlot(character(a)!, cat, heldRow)) &&
        (!inventoryCommand.slot ||
          inventoryCommand.slot === assignedSlot(character(a)!, cat, heldRow))
      if (inventoryCommand.type === 'equip' && item?.kind === 'shield' && command.cost !== 'action')
        throw Error('盾牌穿戴／脱下需要 Utilize 使用动作')
      if (!gripOnly && !['portrait-set', 'item-note'].includes(inventoryCommand.type)) {
        if (
          inventoryCommand.type === 'item-remove' &&
          inventoryCommand.consume &&
          character(a)!.inventory.find((x) => x.instanceId === inventoryCommand.instanceId)
            ?.itemId &&
          ['healing-potion', 'chef-treat','goodberry'].includes(
            character(a)!.inventory.find((x) => x.instanceId === inventoryCommand.instanceId)!
              .itemId,
          )
        )
          spend(a, 'bonus')
        else if (command.cost === 'free') {
          if (!a.turn.objectInteraction) throw new Error('本回合免费物品交互已使用，请选择使用动作')
          a.turn.objectInteraction = false
        } else spend(a, command.cost)
      }
      runtime(a, command.command)
      detail = `${stats(a).name}物品交互：${command.note || 'GM 确认用时与操作合法'}`
      break
    }
    case 'social-check': {
      active()
      noPending()
      const a = actor(command.actorId)
      canAct(a)
      reason(command.note)
      if (command.cost === 'action') spend(a, 'action')
      runtime(a, {
        type: 'check',
        kind: 'skill',
        id: command.skill,
        dc: command.dc,
        context: {
          advantage: command.advantage,
          disadvantage: command.disadvantage,
          fearVisible: command.fearVisible,
        },
      })
      const check = runtimeState(character(a)!, cat).advanced.lastCheck!
      outcomes.push({
        actorId: a.id,
        kind: 'check',
        total: check.total,
        success: !check.autoFail && check.total >= command.dc,
      })
      detail =
        stats(a).name + '影响检定：' + check.total + ' / DC ' + command.dc + '；GM：' + command.note
      break
    }
    case 'save': {
      active()
      noPending()
      reason(command.note)
      const a = actor(command.actorId)
      integer(command.dc, 1, 100)
      const roll = savingRoll(a, command.ability, command.env, cs, cat, dice, command.purpose)
      outcomes.push({
        actorId: a.id,
        kind: 'save',
        total: roll.total,
        success: !roll.autoFail && roll.total >= command.dc,
      })
      detail = `${stats(a).name} ${command.ability} 豁免：[${roll.dice}] + ${roll.bonus}${roll.bonusDice.length ? ' + 效果骰 [' + roll.bonusDice + ']' : ''} = ${roll.total} / DC ${command.dc}，${!roll.autoFail && roll.total >= command.dc ? '成功' : '失败'}；${roll.reasons.join('；')}；GM 依据：${command.note}`
      break
    }
    case 'death-save': {
      active()
      noPending()
      const a = actor(command.actorId)
      if (e.actors[e.current]?.id !== a.id) throw new Error('请在该角色回合开始处理死亡豁免')
      if (a.turn.deathSaveDone) throw new Error('本回合死亡豁免已经处理')
      const c = character(a)!
      const r = runtimeState(c, cat)
      if (command.lucky) {
        if (!hasOrigin(c, cat, 'lucky') || !(r.resources.lucky ?? 0))
          throw new Error('幸运点不足或没有专长')
        runtime(a, {
          type: 'resource-set',
          id: 'lucky',
          amount: r.resources.lucky! - 1,
          reason: '死亡豁免：掷骰前使用幸运',
        })
      }
      const roll = d20(
        0,
        [
        ...(command.lucky ? ['幸运点'] : []),
        ...appliedEffects(r.effects).filter(e=>e.deathSaveAdvantage).map(e=>e.name),
          ...(hasFeat(c.build, 'durable', cat) ? ['耐性'] : []),
        ],
        [],
        dice,
        c.build.speciesId === 'halfling' && !c.runtime?.wildShape,
        appliedEffects(r.effects)
          .filter((e) => e.saveDie)
          .map((e) => e.saveDie!),
      )
      runtime(a, {
        type: 'death-save',
        roll: roll.chosen,
        advantageHandled: true,
        bonus: roll.bonusDice.reduce((s, n) => s + n, 0),
      })
      outcomes.push({
        actorId: a.id,
        kind: 'death-save',
        total: roll.chosen + roll.bonusDice.reduce((s, n) => s + n, 0) - 2 * r.exhaustion,
        success:
          !!character(a)!.runtime!.hp ||
          runtimeState(character(a)!, cat).death.successes > r.death.successes,
      })
      a.turn.deathSaveDone = true
      detail = stats(a).name + '死亡豁免已记录'
      break
    }
    case 'feature': {
      if (
        ['phb/primal-companion', 'phb/companion-command', 'phb/companion-restore'].includes(
          command.id,
        )
      ) {
        noPending()
        const a = actor(command.actorId),
          c = character(a)
        if (!c || !hasSubclass(c.build, 'beast-master')) throw new Error('须驯兽师子职业')
        reason(command.note)
        own(a)
        const previous = e.actors.find(
          (x) =>
            x.companion?.source === 'primal-companion' &&
            x.companion.ownerId === a.id &&
            !x.companion.dismissed,
        )
        if (command.id === 'phb/primal-companion') {
          if (e.actors.length >= 100) throw new Error('遭遇参与者已满')
          const r = runtimeState(c, cat)
          if (
            previous &&
            (r.lastRest?.kind !== 'long' ||
              r.lastRest.endedAt !== r.hours ||
              effects(a).some(
                (e) => e.key === 'primal-rest-use' && e.note === String(r.lastRest!.endedAt),
              ))
          )
            throw new Error('已有原初兽，替换须刚完成长休且每次一次')
          if (previous) previous.companion!.dismissed = true
          const form = command.rule?.choice ?? 'land',
            npc = primalCompanion(c, cat, form),
            oldIds = e.actors.map((a) => a.id),
            currentId = e.actors[e.current]!.id
          e.actors.push({
            id: crypto.randomUUID(),
            characterId: null,
            npc,
            side: a.side,
            initiative: a.initiative,
            surprised: false,
            turn: freshTurn(),
            companion: {
              ownerId: a.id,
              source: 'primal-companion',
              ownerLevel: c.level,
              form,
              expiresAfterRest: null,
              dismissed: false,
            },
          })
          addEffect(a, 'primal-rest-use', '原初兽替换记录', a, 0, {
            note: String(r.lastRest?.endedAt ?? -1),
          })
          insertSummonedInitiative(e, oldIds, currentId, cs)
          detail = '原初行侣已登记，与主人同回合、默认回避；' + npc.source
        } else {
          if (!previous) throw new Error('没有可命令／复活的原初兽')
          if (command.id === 'phb/companion-command') {
            if (!previous.npc!.hp) throw new Error('死亡原初兽不能接受命令')
            if (command.rule?.choice === 'replace-attack') {
              if ((a.turn.attacksLeft ?? 0) > 0) a.turn.attacksLeft!--
              else {
                spend(a, 'action')
                a.turn.attacksLeft = c.level >= 5 ? 1 : 0
              }
            } else spend(a, 'bonus')
            previous.companion!.commandedTick = e.tick
            setEffects(
              previous,
              effects(previous).filter((e) => e.key !== 'dodge'),
            )
            detail = '已支付原初兽命令成本，原初兽可在本回合进行一次数据卡攻击／所命令动作'
          } else {
            const r = runtimeState(c, cat),
              death = previous.companion!.deathAt
            if (previous.npc!.hp || death === undefined || death === null || r.hours - death > 1)
              throw new Error('须死亡一小时以内的原初兽')
            spend(a, 'action')
            const slot = command.rule?.count ?? 1
            if (slot > 3 || !(r.resources[slot === 1 ? 'slots' : 'slots-' + slot] ?? 0))
              throw new Error('复活需要一枚现有法术位')
            r.resources[slot === 1 ? 'slots' : 'slots-' + slot]!--
            c.runtime = r
            previous.companion!.reviveAt = r.hours + 1 / 60
            detail = '已消费法术位，原初兽将在一分钟后满血复活'
          }
        }
        break
      }
      if (command.id.startsWith('phb/')) {
        detail = advancedCombat(e, cs, cat, command, dice, {
          spend,
          own,
          damage,
          heal,
          temp,
          concentration,
          addEffect,
        })
        break
      }
      if (command.id.startsWith('origin/')) {
        active()
        const a = actor(command.actorId),
          t = actor(command.targetId),
          c = character(a)
        if (!c) throw new Error('起源能力须角色使用')
        reason(command.note)
        const id = command.id.slice(7),
          env = command.targetEnvironments?.[t.id] ?? command.env
        if (!['lucky-own', 'lucky-defense'].includes(id)) canAct(a)
        else if (stats(a).dead) throw new Error('死亡时不能使用幸运点')
        if (id === 'interception') {
          const p = e.pending,
            entry = p?.targets[command.amount]
          if (
            !p ||
            p.kind !== 'attack' ||
            !entry ||
            entry.id !== t.id ||
            !entry.hit ||
            a.id === t.id ||
            a.id === p.actorId
          )
            throw new Error('拦截须响应另一生物被命中的具体攻击')
          if (!hasStyle(c.build, 'interception', cat) || c.runtime?.wildShape)
            throw new Error('未获得可用拦截风格')
          if (env.distance > 5 || !env.attackerSees)
            throw new Error('须在受击者 5 尺内并看见攻击者')
          const layout = equipmentLayout(c, cat),
            held = [...(layout.slots['main-hand'] ?? []), ...(layout.slots['off-hand'] ?? [])]
          if (
            !held.some(
              (h) =>
                findItem(c, cat, h.itemId)?.kind === 'shield' ||
                (findItem(c, cat, h.itemId)?.kind === 'weapon' &&
                  /^(simple|martial)/.test(findItem(c, cat, h.itemId)?.category ?? '')),
            )
          )
            throw new Error('拦截须持盾或简易／军用武器')
          spend(a, 'reaction')
          const reduction = checkedDie(dice, 10) + pbOf(c.build)
          entry.interceptions = [...(entry.interceptions ?? []), { sourceId: a.id, reduction }]
          detail = '拦截减伤 ' + reduction + '；多个同名效果取最大值，不叠加；' + command.note
          break
        }
        noPending()
        if (['lucky-own', 'lucky-defense'].includes(id)) {
          if (t.id !== a.id || !hasOrigin(c, cat, 'lucky'))
            throw new Error('幸运须选择自身，且拥有该专长')
          const key = id === 'lucky-own' ? 'lucky-own-roll' : 'lucky-defense'
          if (effects(a).some((e) => e.key === key)) throw new Error('本次幸运已登记，请先完成检定')
          runtime(a, { type: 'resource', id: 'lucky', amount: 1, note: command.note })
          addEffect(a, key, '幸运点', a, 0, {
            ...(key === 'lucky-own-roll' ? { attackAdvantage: true } : {}),
            expiresAt: e.tick,
            phase: 'end',
            note: 'GM 确认已宣告检定／攻击且尚未掷骰；只用于下一笔对应 d20',
          })
          detail =
            '幸运点已按宣告登记；下一笔' +
            (id === 'lucky-own' ? '自身检定优势' : '针对自身攻击劣势') +
            '；不消耗反应；' +
            command.note
          break
        }
        if (id === 'protection') {
          if (
            !hasStyle(c.build, 'protection', cat) ||
            c.runtime?.wildShape ||
            ![
              ...(equipmentLayout(c, cat).slots['main-hand'] ?? []),
              ...(equipmentLayout(c, cat).slots['off-hand'] ?? []),
            ].some((h) => findItem(c, cat, h.itemId)?.kind === 'shield')
          )
            throw new Error('守护须获得风格且手持盾牌')
          if ((command.triggerActorId ?? e.actors[e.current]?.id) === a.id)
            throw new Error('守护须响应另一生物已经宣告的攻击')
          if (a.id === t.id || env.distance > 5 || !env.attackerSees)
            throw new Error('须保护 5 尺内另一目标，并看见即将攻击的生物')
          spend(a, 'reaction')
          addEffect(t, 'protection', '守护攻击劣势', a, 0, {
            ...expires(a, 1),
            note: command.note + '；每次攻击仍须核对保护者在 5 尺内',
          })
          detail =
            '守护已响应攻击宣告，触发攻击及保持距离时的后续攻击劣势，至保护者下回合开始；请随后提交触发攻击'
          break
        }
        if (id === 'healer' || id === 'healing-hands') {
          targetable(env, 5)
          if (id === 'healing-hands' && a.turn.surgeAction)
            throw new Error('动作如潮不能用于魔法动作')
          spend(a, 'action')
          if (id === 'healer' && !character(t))
            throw new Error('此入口需要有生命骰记录的角色；NPC 由 GM 按数据卡裁定')
          if (character(t)) {
            const cmd = {
              type: 'origin' as const,
              id: id === 'healer' ? ('healer' as const) : ('healing-hands' as const),
              targets: [character(t)!.id],
              mode: 'wings' as const,
              itemId: '',
              kitId:
                command.kitId ??
                c.inventory.find((row) => row.itemId === 'healers-kit' && !row.containerId)
                  ?.instanceId ??
                '',
              confirmed: true,
              reroll: true,
              note: command.note,
            }
            const next = applyOriginParty(cs, c.id, cat, cmd, dice)
            cs.splice(0, cs.length, ...next)
          } else {
            runtime(a, { type: 'resource', id: 'healing-hands', amount: 1, note: command.note })
            heal(
              t,
              Array.from({ length: pbOf(c.build) }, () => checkedDie(dice, 4)).reduce(
                (n, x) => n + x,
                0,
              ),
            )
          }
          detail = '起源治疗已结算；' + command.note
          break
        }
        if (id === 'revelation' || id === 'end-revelation') {
          if (t.id !== a.id) throw new Error('天启须选择自身')
          if (id === 'revelation') spend(a, 'bonus')
          const mode = command.amount === 1 ? 'radiance' : command.amount === 2 ? 'shroud' : 'wings'
          runtime(a, {
            type: 'origin',
            id,
            targets: [c.id],
            mode,
            itemId: '',
            kitId: '',
            confirmed: true,
            reroll: false,
            note: command.note,
          })
          if (id === 'revelation' && mode === 'shroud') {
            for (const tid of command.targets ?? []) {
              const target = actor(tid),
                env = command.targetEnvironments?.[tid] ?? command.env
              if (tid === a.id || target.side === a.side) throw new Error('死灵环绕排除自身和盟友')
              if (env.distance > 10 || !env.targetSees) throw new Error('目标须在 10 尺内且看见你')
              const roll = savingRoll(target, 'cha', env, cs, cat, dice),
                dc = 8 + pbOf(c.build) + stats(a).mods.cha
              if (roll.autoFail || roll.total < dc)
                addEffect(target, 'aasimar-shroud', '死灵环绕恐惧', a, 0, {
                  condition: 'frightened',
                  ...expires(a, 1, 'end'),
                })
            }
          }
          detail = '天启 ' + (id === 'end-revelation' ? '结束' : mode) + '；' + command.note
          break
        }
        if (id === 'radiance') {
          own(a)
          if (c.runtime?.revelation?.mode !== 'radiance' || a.turn.manualUsed?.includes('radiance'))
            throw new Error('须内耀辉光，每个自己回合结束一次')
          for (const tid of command.targets?.length ? command.targets : [t.id]) {
            const target = actor(tid),
              env = command.targetEnvironments?.[tid] ?? command.env
            if (env.distance > 10) throw new Error('辉光目标须在 10 尺内')
            damage(
              target,
              supportAdjustedDamage(target, pbOf(c.build), 'radiant'),
              false,
              false,
              false,
              undefined,
              ['radiant'],
            )
            concentration(target)
          }
          a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'radiance']
          detail = '内耀辉光：GM 已确认回合结束及全部 10 尺内生物；' + command.note
          break
        }
        if (id === 'grapple-damage') {
          own(a)
          if (
            !hasStyle(c.build, 'unarmed-fighting', cat) ||
            !a.turn.action ||
            !a.turn.bonus ||
            a.turn.movement ||
            a.turn.manualUsed?.includes('unarmed-grapple') ||
            !effects(t).some((e) => e.condition === 'grappled' && e.sourceId === a.id)
          )
            throw new Error('须徒手战斗，自己回合开始，目标擒抱来源为自己')
          const n = checkedDie(dice, 4)
          damage(t, supportAdjustedDamage(t, n, 'bludgeoning'), false, false, false, undefined, [
            'bludgeoning',
          ])
          a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'unarmed-grapple']
          detail = '徒手战斗擒抱伤害 1d4=' + n
          break
        }
        throw new Error('未知起源能力')
      }
      noPending()
      const a = actor(command.actorId),
        t = actor(command.targetId),
        c = character(a)
      if (!c) throw new Error('NPC 特性请由 GM 裁定')
      if (command.id.startsWith('growth/meta-'))
        throw new Error('超魔法须与施法或掷骰一起提交，不能单独扣资源')
      if (
        ['growth/flurry', 'growth/defense', 'growth/wind', 'growth/steady-aim'].includes(command.id)
      ) {
        const feature = manualFeatures(c).find((f) => f.id === command.id)
        if (!feature) throw new Error('尚未获得此特性')
        if (command.id === 'growth/steady-aim' && a.turn.movement > 0)
          throw new Error('稳固瞄准要求本回合未移动')
        spend(a, 'bonus')
        if (feature.resource)
          runtime(a, {
            type: 'resource',
            id: feature.resource,
            amount: feature.amount,
            note: feature.name,
          })
        if (command.id === 'growth/flurry') a.turn.flurryLeft = 2
        if (command.id === 'growth/steady-aim') {
          addEffect(a, 'steady-aim', '稳固瞄准：下一次攻击优势', a, 62, {
            attackAdvantage: true,
            expiresAt: e.tick,
            phase: 'end',
          })
          addEffect(a, 'steady-speed', '稳固瞄准：本回合速度为零', a, 62, {
            speedPenalty: 300,
            expiresAt: e.tick,
            phase: 'end',
          })
        }
        if (command.id === 'growth/defense')
          addEffect(a, 'dodge', '坚韧防御：回避', a, 53, expires(a, 1))
        if (command.id === 'growth/wind') {
          a.turn.dash += stats(a).speed
          addEffect(a, 'wind-jump', '疾步增强：本回合跳距加倍', a, 53, {
            expiresAt: e.tick,
            phase: 'end',
          })
        }
        if (['growth/defense', 'growth/wind'].includes(command.id))
          addEffect(a, 'disengage', feature.name + '：撤离', a, 53, {
            expiresAt: e.tick,
            phase: 'end',
          })
        detail = feature.name + '：动作、资源与效果已统一记录'
        break
      }
      if (command.id === 'growth/stun') throw new Error('震慑打击请在命中后待结算窗口提交')
      if (['growth/wild-shape', 'growth/companion'].includes(command.id))
        throw new Error('请使用荒野形态／伙伴专用入口，统一保存属性、对象与资源')
      const manual = manualFeatures(c).find((f) => f.id === command.id)
      if (manual) {
        reason(command.note)
        if (manual.cost === 'none') own(a)
        else spend(a, manual.cost)
        if (manual.once && a.turn.manualUsed?.includes(manual.id))
          throw new Error('本回合已使用此特性')
        if (manual.resource) {
          const remaining = runtimeState(c, cat).resources[manual.resource] ?? 0
          if (remaining < manual.amount) throw new Error('资源不足')
          runtime(a, {
            type: 'resource-set',
            id: manual.resource,
            amount: remaining - manual.amount,
            reason: manual.name + '；' + command.note,
          })
        }
        if (manual.id === 'growth/reckless') {
          if (!a.turn.action) throw new Error('鲁莽攻击须在本回合首次攻击时启用')
          addEffect(a, 'reckless', '鲁莽攻击', a, 29, expires(a, 1, 'start'))
          detail = '力量攻击优势，针对自身的攻击优势，至下次回合开始'
          break
        }
        if (manual.once) a.turn.manualUsed = [...(a.turn.manualUsed ?? []), manual.id]
        targetable(command.env, 10000)
        const ids = command.targets?.length ? command.targets : [t.id]
        e.pending = {
          kind: 'manual',
          actorId: a.id,
          name: manual.name,
          page: manual.page,
          spellId: null,
          attack: null,
          targets: ids.map((id) => ({
            id: actor(id).id,
            env: clone(command.targetEnvironments?.[id] ?? command.env),
            roll: null,
            hit: true,
            critical: false,
            ac: stats(actor(id)).ac,
          })),
          damage: [],
          save: null,
          dc: null,
          half: false,
          effectKey: null,
          modifier: 0,
          mode: 'manual',
          notes: [manual.detail, command.note],
          sneak: false,
          mastery: false,
          startedAt: e.tick,
        }
        detail = '职业特性资源与动作已记录；等待 GM 按原文确认触发并分配目标结果：' + manual.detail
        break
      }
      if (
        runtimeState(c, cat).wildShape &&
        ['adrenaline', 'breath', 'giant-ancestry', 'stonecunning'].includes(command.id)
      )
        throw new Error('荒野形态未保留此物种特性')
      const def = resources(c, cat).find((r) => r.id === command.id)
      if (!def) throw new Error('此角色没有该资源')
      if (command.id === 'breath') {
        const targets = command.targets?.length ? command.targets : [command.targetId]
        if (new Set(targets).size !== targets.length) throw new Error('吐息目标不能重复')
        for (const id of command.targets?.length ? command.targets : [command.targetId])
          targetable(command.targetEnvironments?.[id] ?? command.env, 30, true)
        own(a)
        if ((a.turn.attacksLeft ?? 0) > 0) {
          if (a.turn.manualUsed?.includes('breath-action'))
            throw new Error('每个攻击动作最多替换一次吐息')
          a.turn.attacksLeft!--
        } else {
          spend(a, 'action')
          a.turn.attacksLeft =
            c.level >= 5 &&
            ['barbarian', 'fighter', 'monk', 'paladin', 'ranger'].includes(c.build.classId)
              ? 1
              : 0
        }
        a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'breath-action']
        runtime(a, {
          type: 'resource',
          id: 'breath',
          amount: 1,
          note: command.note || 'GM 确认吐息覆盖',
        })
        const ids = command.targets?.length ? command.targets : [command.targetId],
          dc = 8 + pbOf(c.build) + stats(a).mods.con
        const resistance = defenses(a, cs, cat).resistances[0] ?? 'fire'
        e.pending = {
          kind: 'save',
          actorId: a.id,
          name: '龙裔吐息',
          page: 84,
          spellId: null,
          attack: null,
          targets: ids.map((id) => {
            const target = actor(id),
              env = command.targetEnvironments?.[id] ?? command.env,
              roll = savingRoll(target, 'dex', env, cs, cat, dice)
            return {
              id,
              env: clone(env),
              roll,
              hit: roll.autoFail || roll.total < dc,
              critical: false,
              ac: stats(target).ac,
            }
          }),
          damage: [{ type: resistance, roll: rollDamage(c.level >= 5 ? '2d10' : '1d10', dice) }],
          save: 'dex',
          dc,
          half: true,
          effectKey: null,
          modifier: stats(a).mods.con,
          mode: '',
          notes: ['GM 确认 15 尺锥形或 30 尺长 5 尺宽线形覆盖；一次伤害骰用于全部目标'],
          sneak: false,
          mastery: false,
          startedAt: e.tick,
        }
      } else if (command.id === 'action-surge') {
        own(a)
        if (a.turn.surgeUsed || a.turn.action || (a.turn.attacksLeft ?? 0) > 0)
          throw new Error('请先完成当前动作，每回合最多一次动作如潮')
        runtime(a, { type: 'resource', id: def.id, amount: 1 })
        a.turn.action = true
        a.turn.surgeUsed = true
        a.turn.surgeAction = true
        a.turn.manualUsed = a.turn.manualUsed?.filter((id) => id !== 'breath-action')
        a.turn.loading = a.turn.loading.filter((x) => !x.endsWith(':action'))
      } else if (command.id === 'second-wind') {
        spend(a, 'bonus')
        runtime(a, { type: 'resource', id: def.id, amount: 1, roll: checkedDie(dice, 10) })
      } else if (command.id === 'lay-on-hands') {
        if (t.id !== a.id) targetable(command.targetEnvironments?.[t.id] ?? command.env, 5)
        spend(a, 'bonus')
        const n = command.purify ? 5 : integer(command.amount, 1)
        runtime(a, {
          type: 'resource',
          id: def.id,
          amount: n,
          target: 'other',
          note: stats(t).name,
        })
        if (command.purify) {
          const r = character(t)
          if (r) {
            runtime(t, { type: 'condition', id: 'poisoned', active: false })
            setEffects(
              t,
              effects(t).filter((x) => x.condition !== 'poisoned'),
            )
          } else {
            t.npc!.conditions = t.npc!.conditions.filter((x) => x !== 'poisoned')
            setEffects(
              t,
              effects(t).filter((x) => x.condition !== 'poisoned'),
            )
          }
          detail = '圣疗消耗 5 点去除中毒，不同时治疗'
        } else heal(t, n)
      } else if (
        command.id === 'rage' ||
        command.id === 'innate-sorcery' ||
        command.id === 'adrenaline'
      ) {
        spend(a, 'bonus')
        runtime(a, { type: 'resource', id: def.id, amount: 1 })
        if (command.id === 'rage')
          addEffect(a, 'rage-turn', '狂暴维持期限', a, 29, expires(a, 1, 'end'))
        if (command.id === 'adrenaline') a.turn.dash += stats(a).speed
      } else if (command.id === 'bardic-inspiration') {
        const env = command.targetEnvironments?.[t.id] ?? command.env
        context(env)
        if (env.distance > 60) throw new Error('吟游激励的目标须在 60 尺内')
        if (!env.targetSees) reason(command.note)
        if (a.id === t.id) throw new Error('吟游激励给予其他生物')
        spend(a, 'bonus')
        runtime(a, { type: 'resource', id: def.id, amount: 1, note: stats(t).name })
        if (hasSubclass(c.build, 'dance'))
          a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'dance-ready']
        addEffect(t, 'bardic-inspiration', c.level >= 5 ? '吟游激励 d8' : '吟游激励 d6', a, 31, {
          ...(hasSubclass(c.build, 'valor') ? { variant: 'valor' as const } : {}),
          ...expires(a, 600),
          note:
            '目标能看见或听见吟游诗人；一小时内在失败的 D20 检定后可消耗此骰。' +
            (!env.targetSees ? 'GM 确认听见：' + command.note : ''),
        })
      } else if (
        ['stonecunning', 'large-form', 'draconic-flight'].includes(command.id) ||
        (command.id === 'giant-ancestry' && one(c.build, 'ancestry') === 'cloud')
      ) {
        reason(command.note)
        spend(a, 'bonus')
        runtime(a, {
          type: 'resource',
          id: def.id,
          amount: command.amount || 1,
          note: command.note,
        })
        detail = '特性空间与目标效果由 GM 确认：' + command.note
      } else throw new Error('此特性的触发时机与目标效果请从 GM 裁定记录，不能作为普通附赠动作使用')
      detail = `${stats(a).name}使用 ${def.name}；` + detail
      break
    }
    case 'adjudicate': {
      active()
      noPending()
      reason(command.note)
      const a = actor(command.actorId)
      if (command.cost !== 'none') spend(a, command.cost)
      integer(command.damage)
      integer(command.heal)
      integer(command.rounds, 0, 14400)
      if (!command.targetIds.length || new Set(command.targetIds).size !== command.targetIds.length)
        throw new Error('请选择不重复的目标')
      detail = `GM 裁定（${command.cost}）：${command.note}`
      for (const id of command.targetIds) {
        const t = actor(id)
        if (command.damage) {
          damage(
            t,
            supportAdjustedDamage(t, command.damage, command.damageType),
            false,
            false,
            false,
            undefined,
            [command.damageType],
          )
          concentration(t)
        }
        if (command.heal) heal(t, command.heal)
        if (command.condition) {
          if (
            !CONDITIONS.some((c) => c.id === command.condition) ||
            command.condition === 'exhaustion'
          )
            throw new Error('请选择有效状态')
          if (command.active)
            addEffect(t, 'gm-' + command.condition, command.condition, a, 0, {
              condition: command.condition,
              ...(command.rounds ? expires(a, command.rounds) : {}),
              note: command.note,
            })
          else {
            setEffects(
              t,
              effects(t).filter((x) => x.condition !== command.condition),
            )
            if (character(t))
              runtime(t, { type: 'condition', id: command.condition, active: false })
            else t.npc!.conditions = t.npc!.conditions.filter((x) => x !== command.condition)
          }
        }
      }
      break
    }
    case 'inspiration': {
      active()
      const p = e.pending,
        entry = p?.targets[command.targetIndex]
      if (!p || !entry?.roll) throw new Error('没有可调整的待结算 D20 检定')
      if (p.damageRolled||p.attackLocked) throw new Error('命中选择已锁定或伤害已掷出；D20 重掷／激励须在攻击伤害阶段之前使用')
      const rollingId = p.kind === 'attack' ? p.actorId : entry.id
      if (rollingId !== command.actorId) throw new Error('必须由该检定的掷骰者使用激励')
      const a = actor(rollingId),
        roll = entry.roll
      if (roll.autoFail) throw new Error('依状态自动失败的豁免不能用重掷或激励改变')
      if (command.kind === 'bardic') {
        const inspiration = effects(a).find((x) => x.key === 'bardic-inspiration')
        if (!inspiration) throw new Error('没有吟游激励')
        const failed = p.kind === 'attack' ? !entry.hit : entry.hit
        if (!failed) throw new Error('吟游激励在失败检定后使用')
        const sides = Number(inspiration.name.match(/d(6|8)/)?.[1] ?? 6),
          bonus = checkedDie(dice, sides)
        roll.bonusDice.push(bonus)
        roll.total += bonus
        setEffects(
          a,
          effects(a).filter((x) => x.id !== inspiration.id),
        )
        detail = `使用吟游激励 d${sides}=${bonus}`
      } else {
        const c = character(a)
        if (!c || !runtimeState(c, cat).heroicInspiration) throw new Error('没有英雄激励')
        runtime(a, { type: 'inspiration', active: false, note: '战斗中重掷一个骰子' })
        const index = roll.dice.indexOf(roll.chosen),
          value = checkedDie(dice, 20)
        roll.dice[index] = value
        roll.chosen = roll.mode === 'advantage' ? Math.max(...roll.dice) : Math.min(...roll.dice)
        roll.total = roll.chosen + roll.bonus + roll.bonusDice.reduce((s, n) => s + n, 0)
        detail = `使用英雄激励重掷 d20=${value}`
      }
      if (p.kind === 'attack') {
        entry.hit =
          criticalAttack(actor(p.actorId), roll.chosen, p.spellId) ||
          (roll.chosen !== 1 && roll.total >= entry.ac)
        entry.critical =
          entry.hit &&
          (criticalAttack(actor(p.actorId), roll.chosen, p.spellId) ||
            (entry.env.distance <= 5 &&
              stats(actor(entry.id)).conditions.some((c) =>
                ['paralyzed', 'unconscious'].includes(c),
              )))
      } else entry.hit = roll.autoFail || roll.total < p.dc!
      break
    }
    case 'convert': {
      noPending()
      const a = actor(command.actorId)
      own(a)
      if (command.command.id === 'magical-cunning')
        throw new Error('魔法诡计需要一分钟，请在战斗外进行')
      if (command.command.id === 'font-slot') spend(a, 'bonus')
      if (command.command.id === 'wild-resurgence') {
        if (a.turn.manualUsed?.includes('wild-resurgence'))
          throw new Error('荒野复苏每回合最多一次')
        a.turn.manualUsed = [...(a.turn.manualUsed ?? []), 'wild-resurgence']
      }
      runtime(a, command.command)
      detail = '特性资源转换 ' + command.command.id + '，动作与资源按规则记录'
      break
    }
    case 'runtime': {
      active()
      noPending()
      reason(command.reason)
      const a = actor(command.actorId)
      if (['undo', 'cast', 'rest', 'time', 'level-up', 'recover'].includes(command.command.type))
        throw new Error('此操作请使用专用战斗入口或战斗外入口')
      if (command.command.type === 'damage')
        damage(
          a,
          command.command.damageType
            ? supportAdjustedDamage(a, command.command.amount, command.command.damageType, {
                resistances: [],
                immunities: [],
                vulnerabilities: [],
              })
            : command.command.amount,
          !!command.command.critical,
          false,
          !!command.command.relentless,
        )
      else runtime(a, command.command)
      cleanup()
      detail = 'GM 战斗调整：' + stats(a).name + '；' + command.reason
      break
    }
    case 'end-effect': {
      noPending()
      const a = actor(command.actorId),
        found = effects(a).find((x) => x.id === command.effectId)
      if (!found) throw new Error('效果已不存在')
      reason(command.reason)
      setEffects(
        a,
        effects(a).filter((x) => x.id !== found.id),
      )
      detail = '结束效果 ' + found.name + '：' + command.reason
      break
    }
    case 'undo': {
      const last = [...e.log].reverse().find((x) => !x.undone && x.before)
      if (!last?.before) throw new Error('没有可以撤销的遭遇操作')
      for (const [id, revision] of Object.entries(last.revisions)) {
        const c = cs.find((c) => c.id === id)
        if (!c || c.revision !== revision)
          throw new Error('角色在遭遇外已改变，无法安全撤销此笔操作')
      }
      delete e.reactionParents
      Object.assign(e, clone(last.before.encounter))
      for (const [id, snap] of Object.entries(last.before.characters)) {
        const c = cs.find((c) => c.id === id)
        if (!c) throw new Error('原角色已不存在')
        Object.assign(c, clone(snap.state))
        c.revision++
        c.updatedAt = new Date().toISOString()
        c.journal = (c.journal ?? []).map((x) => ({ ...x, before: null }))
        for (const event of e.log)
          if (event.revisions[id] !== undefined) event.revisions[id] = c.revision
      }
      last.undone = true
      detail = '撤销整笔遭遇操作：' + last.detail
      e.log.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind: 'undo',
        detail,
        before: null,
        revisions: {},
        undone: false,
      })
      return { encounter: e, characters: cs }
    }
  }
  if((command.type==='cast'||command.type==='reaction-shield'||command.type==='reaction-counterspell')&&e.pending&&spellUsesSlot(command.mode)){
    const source=e.actors.find(a=>a.id===command.actorId),c=source&&character(source),old=originalCharacters.find(c=>c.id===source?.characterId)
    if(c&&old){const key=castSlotLevel(command.mode)===1?'slots':'slots-'+castSlotLevel(command.mode)
      const before=runtimeState(old,cat),after=runtimeState(c,cat)
      if((before.createdSlots[key]??0)>(after.createdSlots[key]??0))e.pending.slotReceipt={resourceId:key,created:true}
      else if((before.resources[key]??0)>(after.resources[key]??0))e.pending.slotReceipt={resourceId:key,created:false}
    }
  }
  if((command.type==='cast'||command.type==='reaction-shield'||command.type==='reaction-counterspell')&&e.pending?.actorId===command.actorId){const source=e.actors.find(a=>a.id===command.actorId),c=source&&character(source),old=originalCharacters.find(c=>c.id===source?.characterId),receipt=c?.runtime?.itemCasts?.at(-1),grant=old&&runtimeSpells(old,cat).find(g=>g.key===command.key),row=old?.inventory.find(i=>i.instanceId===grant?.item?.instanceId);if(receipt?.success&&!receipt.returned&&receipt.key===command.key&&receipt.id!==old?.runtime?.itemCasts?.at(-1)?.id&&row&&grant?.item&&!grant.item.definition.charges)e.pending.itemReceipt={receiptId:receipt.id,item:{...clone(row),quantity:1}}}
  if (e.pending && !e.pending.id) e.pending.id = crypto.randomUUID()
  if(e.pending?.spellId&&!e.pending.castingId)e.pending.castingId=e.pending.id
  if(e.pending&&e.pending.kind!=='attack'&&!['heal','temporary'].includes(e.pending.mode)&&e.pending.damage.length&&!e.pending.enfeeblementReduced&&(e.pending.castingId??e.pending.id)!==(original.pending?.castingId??original.pending?.id)){
    weakenDamage(actor(e.pending.actorId),e.pending.damage);e.pending.enfeeblementReduced=true
  }
  resumeReaction()
  resumeHitSpell(e)
  cleanup()
  for (const target of e.actors) {
    const old = original.actors.find((t) => t.id === target.id),
      oldCharacter = originalCharacters.find((c) => c.id === old?.characterId)
    const previous = oldCharacter?.runtime?.effects ?? old?.npc?.effects ?? []
    for (const f of previous.filter((f) => ['friends', 'charm-person'].includes(f.key))) {
      if (effects(target).some((v) => v.id === f.id)) continue
      const source = e.actors.find((a) => a.id === f.sourceId) ?? target
      addEffect(
        target,
        'awareness:' + f.key + ':' + f.sourceId,
        '已知：曾受' + f.name + '影响',
        source,
        f.page,
        {
          sourceId: f.sourceId,
          expiresAt: null,
          visibility: 'owner',
          note: '法术已结束，目标按2024规则知情；不是仍处于魅惑',
        },
      )
    }
  }
  reconcileGrapples(e, cs, cat)
  validateEncounter(e, cs, cat)
  for (const a of e.actors) {
    const c = character(a),
      old = c && originalCharacters.find((x) => x.id === c.id)
    if (!c || !old) continue
    const changed =
      JSON.stringify([c.runtime, c.inventory, c.coins]) !==
      JSON.stringify([old.runtime, old.inventory, old.coins])
    if (changed) {
      if (c.revision === old.revision) c.revision++
      c.updatedAt = new Date().toISOString()
      c.journal = (old.journal ?? []).map((x) => ({ ...x, before: null }))
      c.journal.push({
        id: crypto.randomUUID(),
        at: c.updatedAt,
        revision: c.revision,
        kind: 'combat',
        detail: e.name + '：' + detail,
        before: null,
        undone: false,
      })
      c.journal = c.journal.slice(-60)
    }
  }
  for (const part of e.pending?.damage ?? []) annotateDamageRoll(part.type, part.roll)
  e.log.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind: command.type,
    ...(outcomes.length ? { outcomes } : {}),
    ...(damageResults.length ? { damageResults } : {}),
    detail,
    before,
    revisions: Object.fromEntries(
      e.actors.filter((a) => a.characterId).map((a) => [a.characterId!, character(a)!.revision]),
    ),
    undone: false,
  })
  e.log = e.log.slice(-80)
  const encoder = new TextEncoder()
  while (encoder.encode(JSON.stringify(e.log)).byteLength > 4 * 1024 * 1024) {
    const first = e.log.find((x) => x.before)
    if (!first) break
    first.before = null
  }
  return { encounter: e, characters: cs }
}


