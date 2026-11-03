import { catalogue } from './engine'
import { srd } from '../content/srd'
import { attackOptions, combatStats } from './combat-rules'
import { runtimeSpells, resources } from './runtime'
import { rulePowers } from './phb-powers'
import { spellCost } from '../online/combat-controls'
import type { MapWorld, MapScene, MapToken } from './map-types'
import type { NpcProfile, NpcDirective, NpcAbility } from './ai-types'
import { blocked, inside, occupied, distance } from './map'
import { sightLine, movementWalls } from './map-spatial'
import { abilityAvailable } from './npc-abilities'
import {S_SPELL_IDS,S_RULES,type SummonSpell} from './summon-rules'
import {projectM5} from './m5-view'

export function npcSummonCapabilities(world:MapWorld,n:NpcProfile):NpcAbility[]{const a=world.adventures.find(a=>a.ai?.npcs.some(v=>v.id===n.id));return (a?.summons?.instances??[]).filter(i=>i.controllerId===(n.characterId??n.id)&&i.control==='controlled'&&i.state==='present'&&i.kind!=='force').map(i=>({id:'s-command:'+i.id,key:'s-command:'+i.id,name:'指挥 '+i.body?.name,mode:'command',kind:'feature',enabled:true,note:'仅提议已存在本人受控伙伴的真实命令；detail填同一命令，targets填实际已感知对象，不得生成新的能力／知识／身份。'}))}
export function npcM5Capabilities(world:MapWorld,n:NpcProfile):NpcAbility[]{
 const a=world.adventures.find(a=>a.ai?.npcs.some(p=>p.id===n.id)),s=a?.scenes.find(s=>s.id===n.sceneId),t=s?.tokens.find(t=>t.npcId===n.id||!!n.characterId&&t.characterId===n.characterId)
 if(!a||!s||!t)return []
 return projectM5(world,a,s,false,[t]).abilities.map(e=>({id:'m5:'+e.effectId,name:e.name+' · 后续',kind:'feature',key:'m5:'+e.effectId,mode:e.spellId==='dragon-s-breath'?'breathe':['heat-metal','witch-bolt'].includes(e.spellId)?'heat':e.spellId==='spiritual-weapon'?'move-attack':e.spellId==='flame-blade'&&!e.held?'resummon':'attack',enabled:true,note:'只使用已生效来源，仍需实际动作与GM审核；targets填实际人物ID，灵体武器须destination，龙息angle为0–360度。不重新施法，不能自行确认伤害。'}))
}

export function npcCapabilities(world: MapWorld, n: NpcProfile, configured = false) {
  const cat = catalogue([srd, ...world.packs]),
    c = world.characters.find((c) => c.id === n.characterId)
  if (!c) {
    const body = configured
      ? n.body
      : (world.encounters.flatMap((e) => e.actors).find((a) => a.id === n.actorId)?.npc ?? n.body)
    return [...(body?.abilities ?? [])
      .filter((a) => a.cost !== 'reaction' && a.support !== 'unsupported')
      .map((a) => ({
        id: 'monster:' + a.id,
        name: a.name,
        kind: a.spellId ? ('spell' as const) : ('feature' as const),
        key: 'monster:' + a.id,
        mode: 'monster',
        enabled: true,
        note:
          a.note +(a.spellId&&(S_SPELL_IDS as readonly string[]).includes(a.spellId)?'；S召唤须destination明确空位，summon={form,materialId}（引用已登记实际材料）；形态：'+S_RULES[a.spellId as SummonSpell].forms.join('/')+'。不得伪造材料或提前声明实体成功，长施法交GM。':'')+
          (a.resourceId
            ? '；资源池：' +
              a.resourceId +
              '；剩余' +
              body?.resources?.find((r) => r.id === a.resourceId)?.remaining
            : ''),
      })),...(!configured?[...npcM5Capabilities(world,n),...npcSummonCapabilities(world,n)]:[])]
  }
  const spells = runtimeSpells(c, cat)
    .filter((g) => spellCost(g.spell) !== 'reaction')
    .map((g) => ({
      id: 'spell:' + g.key,
      name: g.spell.name,
      kind: 'spell' as const,
      key: g.key,
      mode: g.modes.find((m) => m !== 'ritual') ?? g.modes[0] ?? '',
      enabled: true,
      note: '来源：' + g.source,
    }))
  const defs = resources(c, cat),
    powers = rulePowers(c)
      .filter((p) => p.cost !== 'reaction')
      .map((p) => ({
        id: 'feature:' + p.id,
        name: p.name,
        kind: 'feature' as const,
        key: p.id,
        mode: '',
        enabled: true,
        note: p.detail ?? '',
      }))
  const basic = defs
    .filter((r) =>
      ['second-wind', 'rage', 'lay-on-hands', 'bardic-inspiration', 'breath'].includes(r.id),
    )
    .map((r) => ({
      id: 'feature:' + r.id,
      name: r.name,
      kind: 'feature' as const,
      key: r.id,
      mode: '',
      enabled: true,
      note: '按原有触发、资源和用量核对',
    }))
  return [...new Map([...spells, ...powers, ...basic,...(!configured?[...npcM5Capabilities(world,n),...npcSummonCapabilities(world,n)]:[])].map((a) => [a.id, a])).values()]
}
/** A bounded path search for suggestions; execution still goes through the original map reducer. */
export function reachableNpcCells(scene: MapScene, token: MapToken, maxFeet: number) {
  const start = { x: token.x, y: token.y, path: [] as { x: number; y: number }[], cost: 0 },
    queue = [start],
    seen = new Set([`${token.x},${token.y}`]),
    result = [start]
  for (let i = 0; i < queue.length && queue.length < 6400; i++) {
    const current = queue[i]!
    for (const dx of [-1, 0, 1])
      for (const dy of [-1, 0, 1]) {
        if (!dx && !dy) continue
        const p = { x: current.x + dx, y: current.y + dy },
          key = `${p.x},${p.y}`
        if (
          seen.has(key) ||
          !occupied({ ...token, ...p }).every((p) => inside(scene, p) && !blocked(scene, p)) ||
          scene.tokens.some(
            (t) =>
              t.id !== token.id &&
              occupied(t).some((o) =>
                occupied({ ...token, ...p }).some((p) => p.x === o.x && p.y === o.y),
              ),
          ) ||
          movementWalls(scene, token, current, p).length > 0
        )
          continue
        const difficult = scene.regions.some(
            (r) => r.tags.includes('difficult') && r.cells.includes(key),
          ),
          cost = current.cost + scene.grid.feet * (difficult ? 2 : 1)
        if (cost > maxFeet) continue
        seen.add(key)
        const next = { ...p, cost, path: [...current.path, p] }
        queue.push(next)
        result.push(next)
      }
  }
  return result
}
export function scriptedNpcPlan(world: MapWorld, n: NpcProfile): NpcDirective[] {
  const a = world.adventures.find((a) => a.scenes.some((s) => s.id === n.sceneId))!,
    scene = a.scenes.find((s) => s.id === n.sceneId)!,
    e = world.encounters.find((e) => e.id === scene.encounterId),
    actor = e?.actors.find((t) => t.id === n.actorId),
    token = scene.tokens.find((t) => t.actorId === actor?.id)
  if (
    !e ||
    !actor ||
    !token ||
    e.phase !== 'active' ||
    e.actors[e.current]?.id !== actor.id ||
    e.pending
  )
    throw Error('NPC 规划需要自己的回合且没有待结算行动')
  const cat = catalogue([srd, ...world.packs]),
    stats = combatStats(actor, world.characters, cat)
  if (stats.dead || stats.hp <= 0 || stats.conditions.includes('incapacitated')) return []
  const targets = scene.tokens
    .filter(
      (t) =>
        !t.hidden &&
        t.actorId &&
        actor.side !== 'neutral' &&
        e.actors.some((a) => a.id === t.actorId && a.side !== actor.side && a.side !== 'neutral') &&
        sightLine(scene, token, t).clear,
    )
    .filter((t) => {
      const a = e.actors.find((a) => a.id === t.actorId)!
      const state = combatStats(a, world.characters, cat)
      return !state.dead && state.hp > 0
    })
  const cells = reachableNpcCells(
    scene,
    token,
    Math.max(0, stats.speed + actor.turn.dash - actor.turn.movement),
  )
  if (
    n.combatPolicy.strategy === 'retreat' &&
    stats.hp * 100 <= stats.maxHp * n.combatPolicy.retreatPercent &&
    targets.length
  ) {
    if (
      actor.npc?.nimbleEscape &&
      actor.turn.bonus &&
      !stats.effects.some((f) => f.key === 'disengage')
    )
      return [
        { kind: 'action', action: 'disengage', actionCost: 'bonus', detail: '灵巧逃脱后再撤退' },
      ]
    const far = [...cells].sort(
      (p, q) =>
        Math.min(...targets.map((t) => distance(scene, q, t))) -
        Math.min(...targets.map((t) => distance(scene, p, t))),
    )[0]!
    return far.path.length
      ? [
          {
            kind: 'flee',
            destination: { x: far.x, y: far.y },
            detail: '低生命撤退建议；GM 须确认借机触发',
          },
        ]
      : actor.turn.action
        ? [{ kind: 'action', action: 'dodge' }]
        : []
  }
  const protectedToken = scene.tokens.find(
    (t) => t.characterId === n.combatPolicy.protectCharacterId,
  )
  targets.sort(
    (p, q) =>
      distance(
        scene,
        n.combatPolicy.strategy === 'protect' && protectedToken ? protectedToken : token,
        p,
      ) -
      distance(
        scene,
        n.combatPolicy.strategy === 'protect' && protectedToken ? protectedToken : token,
        q,
      ),
  )
  const monsterAbilities = (actor.npc?.abilities ?? [])
    .filter(
      (a) =>
        a.support === 'automatic' &&
        a.cost !== 'reaction' &&
        abilityAvailable(actor.npc!, a.id) &&
        n.combatPolicy.monsterAbilityIds?.includes(a.id) &&
        n.abilities.some((c) => c.enabled && c.id === 'monster:' + a.id) &&
        n.allowed.includes('ability') &&
        (a.cost === 'none' || actor.turn[a.cost]),
    )
    .sort((a, b) => Number(b.spellId === 'healing-word') - Number(a.spellId === 'healing-word'))
  const allies = scene.tokens.filter(
    (t) =>
      !t.hidden && t.actorId && e.actors.some((a) => a.id === t.actorId && a.side === actor.side),
  )
  for (const ability of monsterAbilities) {
    const spell = cat.spells.find((s) => s.id === ability.spellId)
    if (
      !spell ||
      actor.npc?.concentration?.spellId === spell.id ||
      !['healing-word', 'bless', 'hold-person', 'invisibility'].includes(spell.id)
    )
      continue
    let chosen =
      spell.id === 'invisibility'
        ? token
        : spell.id === 'healing-word'
          ? allies.find((t) => {
              const s = combatStats(
                e.actors.find((a) => a.id === t.actorId)!,
                world.characters,
                cat,
              )
              return !s.dead && s.hp * 100 < s.maxHp * (n.combatPolicy.healPercent ?? 40)
            })
          : spell.id === 'bless'
            ? !actor.npc?.concentration
              ? allies.find(
                  (t) =>
                    !combatStats(
                      e.actors.find((a) => a.id === t.actorId)!,
                      world.characters,
                      cat,
                    ).effects.some((f) => f.key === 'bless'),
                )
              : undefined
            : targets.find(
                (t) =>
                  e.actors.find((a) => a.id === t.actorId)?.npc?.creatureType === 'humanoid' ||
                  !!e.actors.find((a) => a.id === t.actorId)?.characterId,
              )
    if (!chosen || !sightLine(scene, token, chosen).clear) continue
    const range = /touch/i.test(spell.range) ? 5 : Number(spell.range.match(/\d+/)?.[0] ?? 0)
    if (chosen.id !== token.id && distance(scene, token, chosen) > range) continue
    return [
      {
        kind: 'ability',
        abilityId: 'monster:' + ability.id,
        targets: [chosen.actorId!],
        detail: '普通NPC合法法术策略；服务端核对次数、目标与预算',
      },
    ]
  }
  const target = targets[0]
  if (!target)
    return actor.turn.action
      ? [{ kind: 'action', action: 'dodge', detail: '无有效敌对目标，按已授权策略闪避后结束回合' }]
      : []
  const attacks = attackOptions(actor, world.characters, cat).filter(
    (a) =>
      (!n.combatPolicy.attackIds.length || n.combatPolicy.attackIds.includes(a.id)) &&
      !a.properties.includes('gm-adjudication') &&
      (!actor.turn.npcMultiattackLeft?.length || actor.turn.npcMultiattackLeft.includes(a.id)) &&
      (!actor.turn.npcMultiattackOptions || actor.turn.npcMultiattackOptions.includes(a.id)),
  )
  if (n.combatPolicy.strategy === 'ranged')
    attacks.sort((a, b) => Number(b.ranged) - Number(a.ranged))
  const attack = attacks.find(
    (a) =>
      distance(scene, token, target) <= (a.ranged ? a.range : a.reach) &&
      sightLine(scene, token, target, 'blocksTargeting').clear,
  )
  if (attack && (actor.turn.action || (actor.turn.attacksLeft ?? 0) > 0))
    return [{ kind: 'attack', attackId: attack.id, targetId: target.actorId! }]
  if (!attacks.length) return actor.turn.action ? [{ kind: 'action', action: 'dodge' }] : []
  const near = [...cells]
    .filter(
      (p) =>
        n.combatPolicy.strategy !== 'guard' ||
        distance(scene, n.guardOrigin?.sceneId === scene.id ? n.guardOrigin : n.position, p) <=
          n.combatPolicy.guardRadius,
    )
    .sort((p, q) => distance(scene, p, target) - distance(scene, q, target))[0]
  return near?.path.length
    ? [{ kind: 'move', destination: { x: near.x, y: near.y }, detail: '接近目标，移动后重新规划' }]
    : actor.turn.action
      ? [{ kind: 'action', action: 'dodge' }]
      : []
}
