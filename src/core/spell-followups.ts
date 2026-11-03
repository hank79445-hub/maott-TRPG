import type { MapWorld, Adventure, MapScene } from './map-types'
import type { Catalogue } from './engine'
import type {
  SceneEffect,
  SceneEffectCast,
  SceneEffectAction,
} from '../persistence/scene-effects-schema'
import type { CombatCommand, Combatant, Encounter, Environment } from './combat-types'
import { m5StateSchema, m5ChoiceSchema } from '../persistence/scene-m5-schema'
import { isM5WorldSpell, isM5ObjectSpell } from './m5-spell-rules'
import { m1Entity } from './m1-utility'
import { m3Caster } from './m3-world-cast'
import { m3RoundKey } from './m3-space-events'
import { m3ActionCost } from './m3-world-actions'
import { sceneEffects, tokenPoint, anchoredGeometry, endSceneEffect } from './scene-effects'
import { physicalPropagation } from './scene-propagation'
import { magicDistance } from './scene-magic'
import { runtimeDerived, runtimeSpells, runtimeState, rollDie } from './runtime'
import {steedRecoveredHP} from './summon-steed'
import { applyWorldRuntime } from './world-runtime'
import { savingRoll } from './combat-rules'
import { dropGround } from './ground-items'
import { findItem } from './runtime'
import { freeHandSlots } from './equipment'
import { newEncounter, applyCombat } from './combat'
import {
  combatStats,
  freshTurn,
  defaultEnvironment,
  attackRoll,
  rollDamage,
  customNpc,
} from './combat-rules'
import { geometryContains } from './scene-effect-geometry'
import { shapeContains } from './map-area'
import { mapEnvironment } from './map'
import { tokenSceneVision } from './scene-lighting'
import { tokenM3State, tokenPerception } from './m3-map-perception'
import { igniteM5Object, applyM5Movement } from './m5-world-outcomes'
import { dropNpcEquipment, registerNpcEquipment } from './m5-equipment'
import { applyWorldMark } from './m5-marks'

export const m5State = (a: Adventure) => (sceneEffects(a).m5 ??= m5StateSchema.parse({}))
const actualId = (t: NonNullable<ReturnType<typeof m1Entity>>) => t.id
function freeHand(w: MapWorld, a: Adventure, id: string, cat: Catalogue) {
  const c = m1Entity(w, a, id)
  return c?.c
    ? freeHandSlots(
        {
          ...c.c,
          runtime: c.c.runtime
            ? {
                ...c.c.runtime,
                effects: (c.c.runtime.effects ?? []).filter((f) => f.key !== 'flame-blade-held'),
              }
            : null,
        },
        cat,
      ).length > 0
    : (c?.body?.equipment
        ?.filter((g) => g.held)
        .reduce(
          (n, g) =>
            n +
            (cat.items.find((i) => i.id === g.itemId)?.properties?.includes('two-handed') ? 2 : 1),
          0,
        ) ?? 0) < 2
}
function bladeHand(w: MapWorld, a: Adventure, e: SceneEffect, held: boolean, cat: Catalogue) {
  const entity = m1Entity(w, a, e.sourceId)
  if (!entity) return
  entity.state.effects = (entity.state.effects ?? []).filter(
    (f) => !(f.key === 'flame-blade-held' && f.castId === e.castId),
  )
  if (!held) return
  const slot = entity.c ? freeHandSlots(entity.c, cat)[0] : 'main-hand'
  if (!slot) throw Error('没有空手持握火焰刀')
  entity.state.effects.push({
    id: crypto.randomUUID(),
    key: 'flame-blade-held',
    spellId: 'flame-blade',
    castId: e.castId,
    name: '持握火焰刀',
    sourceId: e.sourceId,
    page: 0,
    concentration: true,
    expiresAt: null,
    encounterId: 'outside',
    phase: 'start',
    endsAt: e.endsAt,
    clockSourceId: e.clockSourceId,
    supportChoice: slot,
    note: '实际效应物占用一只手，不是普通武器',
  })
}
export function m5CastLayout(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  spellId: string,
  op: SceneEffectCast,
  cat: Catalogue,
) {
  if (isM5ObjectSpell(spellId)) {
    const caster = m3Caster(w, a, op.casterId, cat),
      o = a.m3?.entities.find((o) => o.id === op.objectId && o.enabled && o.sceneId === s.id),
      body = a.sceneEffects?.objectBodies.find((b) => b.objectId === o?.id && b.hp > 0)
    if (!o || !body || op.points.length || op.m5?.targetIds.length)
      throw Error('物件法术攻击须实际物件及已核实AC／HP，不能同时指定人物或落点')
    const from = tokenPoint(caster.token!),
      to = { x: o.x + 0.5, y: o.y + 0.5, height: o.height, layer: o.layer ?? 'material' }
    if (
      to.layer !== from.layer ||
      magicDistance(from, to, s.grid.feet) > (spellId === 'fire-bolt' ? 120 : 60) ||
      !physicalPropagation(a, s, from, to, 'effect').clear
    )
      throw Error('物件超出实际法术攻击距离或被实体完全遮挡')
    return {
      locations: [{ x: o.x, y: o.y, height: o.height }],
      anchor: { kind: 'object' as const, id: o.id, offsetHeight: 0 },
      choice: m5ChoiceSchema.parse({}),
      targetId: undefined,
    }
  }
  if (!isM5WorldSpell(spellId)) return
  const choice = m5ChoiceSchema.parse(op.m5 ?? {}),
    caster = m3Caster(w, a, op.casterId, cat),
    targets = choice.targetIds.map((id) => m1Entity(w, a, id)),
    from = tokenPoint(caster.token!)
  if (
    new Set(choice.targetIds).size !== choice.targetIds.length ||
    targets.some((t) => !t?.token || !s.tokens.includes(t.token) || t.dead)
  )
    throw Error('M5法术须引用本场景实际存活人物')
  const target = targets[0],
    object = a.m3?.entities.find((o) => o.id === op.objectId && o.enabled && o.sceneId === s.id)
  if (spellId === 'dragon-s-breath' && (targets.length !== 1 || !choice.willing))
    throw Error('龙息术须一名真实自愿受术者')
  if (['mind-spike', 'vampiric-touch', 'witch-bolt'].includes(spellId) && targets.length !== 1)
    throw Error('本法术须选择一个真实初始目标')
  if (spellId === 'flame-blade' && (!freeHand(w, a, caster.id, cat) || targets.length))
    throw Error('火焰刀须真实空手，生成时不附带攻击')
  if (
    spellId === 'heat-metal' &&
    (!object || !m5State(a).metals.some((m) => m.objectId === object.id))
  )
    throw Error('灼热金属须已由GM核实的真实人造金属物件')
  if (spellId === 'spiritual-weapon' && (op.points.length !== 1 || targets.length > 1))
    throw Error('灵体武器须一个实际落点，可选一个初始攻击目标')
  if (spellId !== 'spiritual-weapon' && op.points.length)
    throw Error('此法术锚定实际人物／物件，不另选落点')
  const p =
    spellId === 'spiritual-weapon'
      ? op.points[0]!
      : object
        ? { x: object.x, y: object.y, height: object.height }
        : spellId === 'dragon-s-breath' || spellId === 'mind-spike'
          ? {
              x: target!.token!.x,
              y: target!.token!.y,
              height: target!.token!.spatial?.height ?? 0,
            }
          : { x: caster.token!.x, y: caster.token!.y, height: caster.token!.spatial?.height ?? 0 }
  const range =
    spellId === 'spiritual-weapon' || spellId === 'heat-metal' || spellId === 'witch-bolt'
      ? 60
      : spellId === 'mind-spike'
        ? 120
        : 5
  const position = ['vampiric-touch', 'witch-bolt'].includes(spellId)
    ? tokenPoint(target!.token!)
    : {
        ...p,
        x: p.x + 0.5,
        y: p.y + 0.5,
        layer: object?.layer ?? target?.token?.spatial?.layer ?? from.layer,
      }
  if (
    magicDistance(from, position, s.grid.feet) > range ||
    !physicalPropagation(a, s, from, position, 'effect').clear ||
    (position.layer ?? 'material') !== from.layer
  )
    throw Error('初始目标超出实际距离、空间层或被实体阻隔')
  if (
    spellId === 'mind-spike' &&
    target &&
    !tokenPerception(w, a, s, caster.token!, target.token!, cat).canSee
  )
    throw Error('心灵尖刺初始目标须实际可见')
  if (
    spellId === 'spiritual-weapon' &&
    target &&
    magicDistance({ ...p, x: p.x + 0.5, y: p.y + 0.5 }, tokenPoint(target.token!), s.grid.feet) > 5
  )
    throw Error('灵体武器初始攻击须在实际武器5尺内')
  const anchor = object
    ? { kind: 'object' as const, id: object.id, offsetHeight: 0 }
    : spellId === 'spiritual-weapon'
      ? { kind: 'point' as const, offsetHeight: 0 }
      : {
          kind: 'creature' as const,
          id: spellId === 'dragon-s-breath' || spellId === 'mind-spike' ? target!.id : caster.id,
          offsetHeight: 0,
        }
  return { locations: [p], anchor, choice, targetId: target?.id }
}
function bodyActor(w: MapWorld, a: Adventure, id: string): Combatant {
  const t = m1Entity(w, a, id)
  if (!t) throw Error('实际数据卡已失效')
  return {
    id: t.actor?.id ?? t.id,
    characterId: t.c?.id ?? null,
    npc: t.c ? null : structuredClone(t.body!),
    npcId: t.n?.id,
    side: t.actor?.side ?? 'neutral',
    initiative: 0,
    surprised: false,
    turn: freshTurn(),
  }
}
function syncBodies(w: MapWorld, a: Adventure, e: Encounter) {
  for (const actor of e.actors) {
    if (!actor.npc) continue
    const ent = m1Entity(w, a, actor.npcId ?? actor.id)
    if (ent?.body) Object.assign(ent.body, structuredClone(actor.npc))
    if (ent?.n) ent.n.body = structuredClone(actor.npc)
    if (ent?.token && !ent.n) ent.token.npcBody = structuredClone(actor.npc)
  }
}
/** The server supplies a previously offered rule command for this saved private frame.
 * This does not create a second encounter or a free-standing attack. */
export function applyPrivateM5Command(w:MapWorld,a:Adventure,eventId:string,command:CombatCommand,cat:Catalogue,dice:(n:number)=>number=rollDie){
 const event=a.sceneEffects?.m5?.resolutions.find(r=>r.id===eventId&&!r.encounterId&&r.frame)
 if(!event?.frame||!['inspiration','reaction-shield','reaction-counterspell','npc-reaction','reaction-defense','spell-reroll','damage-roll','resolve','concentration-roll'].includes(command.type))throw Error('法术后续的实际私有帧或选项已变化')
 if(command.type==='resolve'&&event.frame.pending?.id===event.pendingId)event.targets=event.frame.pending.targets.map(t=>({id:m1Entity(w,a,t.id)?.id??event.targets.find(v=>m1Entity(w,a,v.id)?.actor?.id===t.id)?.id??t.id,hit:t.hit}))
 const result=applyCombat(event.frame,w.characters,cat,command,dice)
 w.characters=result.characters;event.frame=result.encounter;syncBodies(w,a,result.encounter);retainPrivateFrame(w,a,event,result.encounter)
 return result.encounter.log.at(-1)?.detail??'实际后续帧已更新'
}
function retainPrivateFrame(
  w: MapWorld,
  a: Adventure,
  event: ReturnType<typeof m5State>['resolutions'][number],
  frame: Encounter,
) {
  if (event.encounterId) return
  // A private frame is only a continuation, never a second world or an undo history.
  for (const actor of frame.actors)
    if (actor.npc) {
      const current = m1Entity(w, a, actor.npcId ?? actor.id)
      if (current?.body) actor.npc = structuredClone(current.body)
    }
  frame.log = frame.log.slice(-12).map((row) => ({ ...row, before: null }))
  if (
    event.status === 'resolved' &&
    !frame.actors.some((actor) =>
      actor.characterId
        ? w.characters.find((c) => c.id === actor.characterId)?.runtime?.concentration?.pendingDC
        : actor.npc?.concentration?.pendingDC,
    )
  )
    delete event.frame
  else event.frame = frame
}
function completeM5Result(
  w: MapWorld,
  a: Adventure,
  event: ReturnType<typeof m5State>['resolutions'][number],
  frame: Encounter,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const effect = a.sceneEffects?.regions.find((e) => e.id === event.effectId),
    config = effect?.m5,
    log = [...frame.log]
      .reverse()
      .find((l) => l.damageResults?.some((r) => r.pendingId === event.pendingId)),
    source = effect && m1Entity(w, a, effect.sourceId)
  if (!effect || !config || !source || !log) throw Error('缺少原来源及实际伤害结算记录')
  if (effect.spellId === 'vampiric-touch') {
    const hpBefore=source.state.hp
    const total = (log.damageResults ?? [])
        .filter((d) => d.pendingId === event.pendingId)
        .reduce(
          (sum, d) =>
            sum +
            (d.receivedTypes?.necrotic ??
              d.typeAmounts?.necrotic ??
              (d.types === 'necrotic' ? (d.damageReceived ?? d.damage) : 0)),
          0,
        ),
      healing = Math.floor(total / 2)
    if (source.c && healing)
      applyWorldRuntime(
        w,
        source.c.id,
        cat,
        { type: 'heal', amount: healing, note: '吸血鬼之触：原攻击实际暗蚀伤害一半' },
        dice,
      )
    else if (
      source.body &&
      !source.body.dead &&
      healing &&
      !source.body.effects.some((f) => f.blocksHealing)
    )
      source.body.hp = Math.min(source.body.maxHp, source.body.hp + healing)
    steedRecoveredHP(w,a,source.id,Math.max(0,(m1Entity(w,a,source.id)?.state.hp??hpBefore)-hpBefore))
  }
  if (effect.spellId === 'mind-spike') config.held = !!event.targets[0]?.hit
  if (effect.spellId === 'heat-metal') {
    const fact = m5State(a).metals.find((m) => m.objectId === effect.anchor.id),
      object = a.m3?.entities.find((o) => o.id === effect.anchor.id)
    if (fact && object)
      for (const row of event.targets) {
        const target = m1Entity(w, a, row.id),
          actor =
            target &&
            frame.actors.find((at) => [at.id, at.characterId, at.npcId].includes(target.id)),
          hurt =
            actor &&
            (log.damageResults ?? []).some(
              (d) =>
                d.pendingId === event.pendingId &&
                d.actorId === actor.id &&
                (d.damageReceived ?? d.damage) > 0,
            )
        if (!target || !actor || !hurt) continue
        const gearRow = target.c?.inventory.find(
            (r) => r.instanceId === object.inventoryInstanceId,
          ),
          item = gearRow && target.c ? findItem(target.c, cat, gearRow.itemId) : undefined,
          check = savingRoll(actor, 'con', defaultEnvironment(), w.characters, cat, dice),
          cannotDrop =
            fact.cannotDropIds.includes(target.id) ||
            (!!gearRow?.equipped && ['armor', 'shield'].includes(item?.kind ?? '')),
          dropped = !check.autoFail && check.total >= config.dc ? false : !cannotDrop
        if (dropped) {
          if (target.c && gearRow && target.state.hp > 0) {
            gearRow.equipped = false
            gearRow.equipmentSlot = null
            gearRow.grip = null
            dropGround(
              w,
              a,
              a.scenes.find((s) => s.id === event.sceneId)!,
              {
                type: 'ground-drop',
                sceneId: event.sceneId,
                characterId: target.c.id,
                instanceId: gearRow.instanceId,
                cost: 'free',
              },
              cat,
              dice,
              crypto.randomUUID(),
              true,
            )
          }
          for (const gear of target.body?.equipment ?? [])
            if (gear.objectId === object.id && gear.held)
              dropNpcEquipment(
                w,
                a,
                a.scenes.find((s) => s.id === event.sceneId)!,
                target.id,
                gear.id,
                cat,
              )
          object.boundCharacterId = undefined
          if (target.token) {
            object.x = target.token.x
            object.y = target.token.y
            object.height = target.token.spatial?.height ?? 0
          }
          fact.contactIds = fact.contactIds.filter((id) => id !== target.id)
        }
        if (!dropped) {
          const clock =
            w.characters.find((c) => c.id === effect.clockSourceId)?.runtime?.hours ??
            effect.createdHour
          ;(target.state.effects ??= []).push({
            id: crypto.randomUUID(),
            key: 'heat-metal-disadvantage',
            spellId: 'heat-metal',
            castId: effect.castId,
            name: '灼热金属：未丢弃',
            sourceId: effect.sourceId,
            page: 0,
            concentration: false,
            expiresAt: null,
            encounterId: 'outside',
            phase: 'start',
            clockSourceId: effect.clockSourceId,
            endsAt: clock + 1 / 600,
            attackDisadvantage: true,
            note: '未丢弃金属，至来源下回合开始，属性检定劣势',
          })
        }
      }
  }
  event.status = 'resolved'
  retainPrivateFrame(w, a, event, frame)
}
function targetsInScene(w: MapWorld, a: Adventure, s: MapScene) {
  return s.tokens.flatMap((t) => {
    const e = m1Entity(w, a, t.characterId ?? t.npcId ?? t.actorId ?? t.id)
    return e ? [e] : []
  })
}
function startM5Strike(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  actorId: string,
  targetIds: string[],
  cost: 'action' | 'bonus' | 'none',
  cat: Catalogue,
  dice: (n: number) => number,
  initial = false,
) {
  const config = e.m5!,
    operator = m3Caster(w, a, actorId, cat),
    battle = w.encounters.find((x) => x.id === s.encounterId && x.phase === 'active'),
    frame = battle ?? newEncounter('M5探索后续结算'),
    entities = targetsInScene(w, a, s),
    source = m1Entity(w, a, e.sourceId)!
  if (
    m5State(a).resolutions.some(
      (r) =>
        r.status === 'pending' &&
        (r.actorId === operator.id ||
          r.targets.some((t) => t.id === operator.id || targetIds.includes(t.id)) ||
          targetIds.includes(r.actorId)),
    )
  )
    throw Error('相关人物尚有待结算法术后续，请先处理原窗口')
  if (!targetIds.length || new Set(targetIds).size !== targetIds.length)
    throw Error('请选择至少一个不重复的实际目标')
  if (!battle) {
    frame.phase = 'active'
    frame.round = 1
    frame.actors = entities.map((t) => bodyActor(w, a, t.id))
    frame.current = frame.actors.findIndex((t) =>
      [t.id, t.characterId, t.npcId].includes(operator.id),
    )
  }
  const acting = frame.actors.find((t) => [t.id, t.characterId, t.npcId].includes(operator.id))
  if (!acting || frame.pending) throw Error('请先处理待结算，操作人物须在实际结算帧')
  const targetRows = targetIds.map((id) => {
    const target = m1Entity(w, a, id),
      actor = target && frame.actors.find((t) => [t.id, t.characterId, t.npcId].includes(target.id))
    if (!target?.token || !actor || target.dead || !s.tokens.includes(target.token))
      throw Error('目标不在本场景或已死亡')
    return { target, actor }
  })
  const origin = anchoredGeometry(w, a, e)?.geometry
  if (e.spellId === 'spiritual-weapon' && !origin) throw Error('效应武器的实际位置不存在')
  const from =
    e.spellId === 'spiritual-weapon'
      ? { ...origin!, x: origin!.x + 0.5, y: origin!.y + 0.5, layer: e.layer ?? 'material' }
      : tokenPoint(operator.token!)
  const envs: Record<string, Environment> = {}
  for (const { target, actor } of targetRows) {
    const to = tokenPoint(target.token!),
      d = magicDistance(from, to, s.grid.feet)
    if (to.layer !== from.layer || !physicalPropagation(a, s, from, to, 'effect').clear)
      throw Error('后续能力不能穿实体阻隔或跨空间层')
    if (['spiritual-weapon', 'flame-blade', 'vampiric-touch'].includes(e.spellId) && d > 5)
      throw Error('实际攻击目标须在效应武器／触及5尺内')
    const originToken = {
      ...operator.token!,
      x: from.x - 0.5,
      y: from.y - 0.5,
      spatial: {
        ...operator.token!.spatial,
        height: from.height ?? 0,
        layer: from.layer ?? 'material',
      },
    }
    envs[actor.id] = mapEnvironment(
      s,
      originToken,
      target.token!,
      { ...defaultEnvironment(), distance: d, note: '服务器核对M5实际效应、目标与位置' },
      'spell',
    )
    envs[actor.id]!.attackerSees = tokenPerception(w, a, s, originToken, target.token!, cat).canSee
    envs[actor.id]!.targetSees = tokenPerception(w, a, s, target.token!, originToken, cat).canSee
  }
  const kind =
      e.spellId === 'heat-metal' || (e.spellId === 'witch-bolt' && !initial)
        ? 'automatic'
        : ['dragon-s-breath', 'mind-spike'].includes(e.spellId)
          ? 'save'
          : 'attack',
    command: Extract<CombatCommand, { type: 'm5-strike' }> = {
      type: 'm5-strike',
      actorId: acting.id,
      targetIds: targetRows.map((t) => t.actor.id),
      effectId: e.id,
      spellId: e.spellId,
      cost: battle ? cost : 'none',
      kind,
      formula: e.spellId === 'witch-bolt' && initial ? e.slotLevel + 1 + 'd12' : config.formula,
      damageType: config.damageType,
      ability: config.ability,
      modifier: kind === 'attack' && e.spellId !== 'witch-bolt' ? config.modifier : 0,
      attackBonus: config.attackBonus,
      dc: config.dc,
      save: kind === 'save' ? (e.spellId === 'dragon-s-breath' ? 'dex' : 'wis') : undefined,
      half: kind === 'save',
      envs,
    }
  if (!battle && cost !== 'none') m3ActionCost(w, a, operator.id, cost, cat, true)
  const result = applyCombat(frame, w.characters, cat, command, dice)
  w.characters = result.characters
  if (battle) w.encounters[w.encounters.indexOf(battle)] = result.encounter
  else syncBodies(w, a, result.encounter)
  const pending = result.encounter.pending!
  if (!pending?.id) throw Error('未生成实际后续结算帧')
  m5State(a).resolutions.push({
    id: crypto.randomUUID(),
    effectId: e.id,
    actorId: operator.id,
    sceneId: s.id,
    ...(battle ? { encounterId: battle.id } : { frame: result.encounter }),
    pendingId: pending.id,
    status: 'pending',
    targets: pending.targets.map((t) => ({
      id: targetRows.find((r) => r.actor.id === t.id)!.target.id,
      hit: t.hit,
    })),
  })
  return source
}
export function m5Created(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  op: SceneEffectCast,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  if (isM5ObjectSpell(e.spellId)) {
    resolveObjectCantrip(w, a, s, e, op, cat, dice)
    return
  }
  const caster = m3Caster(w, a, e.sourceId, cat),
    grant = caster.c ? runtimeSpells(caster.c, cat).find((g) => g.key === op.key) : undefined,
    ability = caster.body?.abilities?.find((b) => b.id === op.key),
    attr = grant?.ability ?? ability?.ability ?? caster.body?.spellcasting?.ability ?? 'wis',
    mod = caster.c
      ? runtimeDerived(caster.c, cat).mods[attr]
      : Math.floor(((caster.body?.scores[attr] ?? 10) - 10) / 2),
    choice = m5ChoiceSchema.parse(op.m5 ?? {}),
    slot = e.slotLevel
  delete e.light
  e.geometry!.size = 0.1
  e.m5 = {
    sourceKey: op.key,
    ability: attr,
    dc: caster.body?.spellcasting?.dc ?? 8 + Math.ceil((caster.c?.level ?? 1) / 4) + 1 + mod,
    attackBonus:
      caster.body?.spellcasting?.attackBonus ?? Math.ceil((caster.c?.level ?? 1) / 4) + 1 + mod,
    modifier: mod,
    damageType:
      e.spellId === 'dragon-s-breath'
        ? choice.damageType
        : e.spellId === 'spiritual-weapon'
          ? 'force'
          : e.spellId === 'mind-spike'
            ? 'psychic'
            : e.spellId === 'vampiric-touch'
              ? 'necrotic'
              : 'fire',
    formula:
      e.spellId === 'flame-blade'
        ? slot + 1 + 'd6'
        : e.spellId === 'spiritual-weapon'
          ? slot - 1 + 'd8'
          : e.spellId === 'heat-metal'
            ? slot + 'd8'
            : e.spellId === 'mind-spike'
              ? slot + 1 + 'd8'
              : slot + 'd6',
    held: true,
    uses: [],
  }
  if (choice.targetIds[0]) e.m5.targetId = m1Entity(w, a, choice.targetIds[0])!.id
  if (e.spellId === 'witch-bolt') {
    e.m5.damageType = 'lightning'
    e.m5.formula = '1d12'
  }
  e.m5.uses.push('created:' + m3RoundKey(w, a, s))
  if (e.spellId === 'flame-blade') {
    bladeHand(w, a, e, true, cat)
    e.light = { bright: 10, dimExtra: 10, magical: true, sunlight: false, color: '#ed8741' }
    e.geometry!.size = 20
  }
  if (e.spellId === 'mind-spike') {
    e.hidden = true
    e.m5.held = false
  }
  if (
    ['vampiric-touch', 'mind-spike', 'witch-bolt'].includes(e.spellId) ||
    (e.spellId === 'spiritual-weapon' && choice.targetIds.length)
  )
    startM5Strike(w, a, s, e, e.sourceId, choice.targetIds, 'none', cat, dice, true)
  if (e.spellId === 'heat-metal') {
    const contacts = m5State(a).metals.find((m) => m.objectId === e.anchor.id)!.contactIds
    if (contacts.length) startM5Strike(w, a, s, e, e.sourceId, contacts, 'none', cat, dice)
  }
}
function resolveObjectCantrip(
  w: MapWorld,
  a: Adventure,
  s: MapScene,
  e: SceneEffect,
  op: SceneEffectCast,
  cat: Catalogue,
  dice: (n: number) => number,
) {
  const source = m3Caster(w, a, e.sourceId, cat),
    object = a.m3!.entities.find((o) => o.id === op.objectId)!,
    body = sceneEffects(a).objectBodies.find((b) => b.objectId === object.id)!,
    grant = source.c ? runtimeSpells(source.c, cat).find((g) => g.key === op.key) : undefined,
    ability = source.body?.abilities?.find((b) => b.id === op.key),
    attr = grant?.ability ?? ability?.ability ?? source.body?.spellcasting?.ability ?? 'wis',
    actor = bodyActor(w, a, source.id),
    stats = combatStats(actor, w.characters, cat),
    level = source.c?.level ?? source.body?.spellcasting?.level ?? 1,
    amount = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1
  const targetToken = {
      ...source.token!,
      id: object.id,
      characterId: null,
      actorId: null,
      npcId: undefined,
      x: object.x,
      y: object.y,
      span: 1,
      name: object.name,
      spatial: { height: object.height, layer: object.layer ?? 'material' },
    },
    env = mapEnvironment(s, source.token!, targetToken, defaultEnvironment(), 'spell'),
    vision = tokenSceneVision(
      w,
      a,
      s,
      source.token!,
      targetToken,
      tokenM3State(w, a, source.token!, cat),
    )
  env.attackerSees = vision.ray.clear && vision.illuminated
  const spec = {
    id: op.key,
    name: e.name,
    bonus: source.c
      ? stats.mods[attr] + runtimeDerived(source.c, cat).pb - stats.exhaustion * 2
      : (source.body?.spellcasting?.attackBonus ?? stats.mods[attr] + 2),
    ability: attr,
    modifier: 0,
    damage: amount + (e.spellId === 'fire-bolt' ? 'd10' : 'd8'),
    type: e.spellId === 'fire-bolt' ? ('fire' as const) : ('radiant' as const),
    ranged: true,
    reach: 0,
    range: e.spellId === 'fire-bolt' ? 120 : 60,
    longRange: 0,
    weaponId: null,
    instanceId: null,
    properties: ['spell-attack'],
    mastery: null,
    page: 0,
  }
  const target = {
      ...actor,
      id: object.id,
      characterId: null,
      npc: { ...customNpc(), ac: body.ac, hp: body.hp, maxHp: body.maxHp },
    },
    roll = attackRoll(actor, target, spec, env, w.characters, cat, dice),
    critical = roll.chosen === 20,
    hit =
      critical ||
      (roll.chosen !== 1 &&
        roll.total >=
          body.ac + (env.cover === 'half' ? 2 : env.cover === 'three-quarters' ? 5 : 0)),
    damage = hit ? rollDamage(spec.damage, dice, critical) : undefined,
    raw = damage?.total ?? 0,
    final =
      e.spellId === 'fire-bolt'
        ? body.fire === 'immune'
          ? 0
          : body.fire === 'resistant'
            ? Math.floor(raw / 2)
            : body.fire === 'vulnerable'
              ? raw * 2
              : raw
        : raw
  body.hp = Math.max(0, body.hp - final)
  if (sceneEffects(a).objectAttacks.length >= 5000) throw Error('物件攻击账本已满')
  sceneEffects(a).objectAttacks.push({
    id: crypto.randomUUID(),
    castId: e.castId,
    sourceId: source.id,
    objectId: object.id,
    attackRolls: roll.dice,
    attackTotal: roll.total,
    hit,
    critical,
    damageRolls: damage?.dice ?? [],
    damageTotal: raw,
    finalDamage: final,
    remainingHP: body.hp,
    atHour: e.createdHour,
  })
  if (hit && e.spellId === 'fire-bolt') igniteM5Object(a, object.id, source.id, e.spellId, e.castId)
  if (hit && e.spellId === 'starry-wisp')
    (object.effects ??= []).push({
      id: crypto.randomUUID(),
      key: 'starry-wisp',
      spellId: e.spellId,
      castId: e.castId,
      name: '星光缕微光',
      sourceId: source.id,
      page: 0,
      concentration: false,
      expiresAt: null,
      encounterId: 'outside',
      phase: 'end',
      clockSourceId: e.clockSourceId,
      endsAt: e.createdHour + 1 / 600,
      visibility: 'public',
      note: '10尺微光，不能受益隐形；仅持续至来源下回合末',
    })
  if (!body.hp) object.enabled = false
  e.geometry!.size = 0.1
  delete e.light
  endSceneEffect(a, e, '实际物件攻击已完成；独立燃烧／微光事实按自身期限保留')
}
export function m5Operation(op: string) {
  return op.startsWith('m5-')
}
export function applyM5Operation(
  w: MapWorld,
  a: Adventure,
  op: SceneEffectAction,
  cat: Catalogue,
  dice: (n: number) => number = rollDie,
) {
  if(op.operation==='m5-close'){
    const state=m5State(a)
    if(op.kind==='movement'){const event=state.outcomes.find(e=>e.id===op.eventId&&e.status==='pending'&&e.targetId);if(!event)throw Error('该地图后果已经处理或不存在');event.status=op.disposition==='manual-completed'?'resolved':'skipped';event.note='GM接管：'+op.note;return 'GM已记录地图后果处理结果；原伤害与费用保留，未额外移动、掷骰或触发区域'}
    const event=state.resolutions.find(e=>e.id===op.eventId&&e.status==='pending');if(!event)throw Error('该后续已经处理或不存在')
    if(op.disposition!=='canceled')throw Error('伤害后续须走实际结算；仅支持明确终止，不伪造已完成伤害')
    const frame=event.encounterId?w.encounters.find(e=>e.id===event.encounterId):event.frame
    if(frame?.pending?.reactionFrame||frame?.pending&&frame.pending.id!==event.pendingId)throw Error('请先完成独立反应，不能关闭其他实际攻击')
    if(frame?.pending)frame.pending=null
    event.status='canceled';delete event.frame
    return 'GM已终止未结算后续：'+op.note+'；保留原动作、次数、法术位与消费凭据，不撤回已确认伤害'
  }
  if (op.operation === 'm5-move') return applyM5Movement(w, a, op, cat)
  const state = m5State(a),
    s = a.scenes.find((s) => s.id === a.activeSceneId)!
  if (!s) throw Error('请先进入场景')
  if (op.operation === 'm5-mark' || op.operation === 'm5-search')
    return applyWorldMark(w, a, s, op, cat, dice)
  if (op.operation === 'm5-equipment-drop')
    return dropNpcEquipment(w, a, s, op.actorId, op.equipmentId, cat)
  if (op.operation === 'm5-metal') {
    const object = a.m3?.entities.find(
      (o) => o.id === op.objectId && o.enabled && o.sceneId === s.id,
    )
    if (
      !object ||
      new Set(op.contactIds).size !== op.contactIds.length ||
      op.contactIds.some((id) => {
        const t = m1Entity(w, a, id)
        return (
          !t?.token ||
          !s.tokens.includes(t.token) ||
          magicDistance(
            tokenPoint(t.token),
            { x: object.x + 0.5, y: object.y + 0.5, height: object.height },
            s.grid.feet,
          ) > 5
        )
      }) ||
      op.cannotDropIds.some((id) => !op.contactIds.includes(id))
    )
      throw Error('金属事实须引用同场景实际物件及触及内接触者')
    state.metals = state.metals.filter((m) => m.objectId !== op.objectId)
    state.metals.push({
      objectId: op.objectId,
      manufactured: true,
      contactIds: op.contactIds,
      cannotDropIds: op.cannotDropIds,
    })
    return 'GM已核实人造金属及接触事实'
  }
  if (op.operation === 'm5-equipment') return registerNpcEquipment(w, a, s, op, cat)
  if (op.operation === 'm5-response') {
    const event = state.resolutions.find((r) => r.id === op.eventId),
      frame =
        event &&
        (event.encounterId ? w.encounters.find((e) => e.id === event.encounterId) : event.frame),
      acting = frame?.actors.find((t) => [t.id, t.characterId, t.npcId].includes(op.actorId))
    if (
      !event ||
      !frame ||
      !acting ||
      (event.status !== 'pending' && op.response !== 'concentration')
    )
      throw Error('实际法术后续帧或响应人物已失效')
    let command: CombatCommand
    if (op.response === 'confirm-reaction') {
      if (!frame.pending?.reactionFrame) throw Error('没有待确认反应施法')
      command = {
        type: 'resolve',
        nonlethal: false,
        savage: false,
        stone: false,
        relentless: false,
        pushConfirmed: false,
      }
    } else if (op.response === 'shield')
      command = {
        type: 'reaction-shield',
        actorId: acting.id,
        key: op.key,
        mode: op.mode,
        requirementsConfirmed: true,
      }
    else if (op.response === 'defense')
      command = {
        type: 'reaction-defense',
        actorId: acting.id,
        targetIndex: op.targetIndex,
        kind: op.defense,
      }
    else if (op.response === 'concentration')
      command = {
        type: acting.characterId ? 'concentration' : 'npc-concentration',
        actorId: acting.id,
      }
    else {
      const from = m1Entity(w, a, acting.characterId ?? acting.npcId ?? acting.id),
        target = frame.pending && frame.actors.find((t) => t.id === frame.pending!.actorId),
        to = target && m1Entity(w, a, target.characterId ?? target.npcId ?? target.id)
      if (!from?.token || !to?.token) throw Error('NPC反应须实际地图人物')
      command = {
        type: 'npc-reaction',
        actorId: acting.id,
        abilityId: op.key,
        targetIndex: op.targetIndex,
        confirmed: true,
        note: op.note,
        env: mapEnvironment(s, from.token, to.token, defaultEnvironment(), 'spell'),
      }
    }
    const result = applyCombat(frame, w.characters, cat, command, dice)
    w.characters = result.characters
    if (event.encounterId) w.encounters[w.encounters.indexOf(frame)] = result.encounter
    else {
      event.frame = result.encounter
      syncBodies(w, a, result.encounter)
    }
    retainPrivateFrame(w, a, event, result.encounter)
    return '已依实际能力／资源处理后续反应，原攻击与骰值保留'
  }
  if (op.operation === 'm5-resolve') {
    const event = state.resolutions.find((r) => r.id === op.eventId && r.status === 'pending')
    if (!event) throw Error('本次后续已经结算或不存在')
    const frame = event.encounterId
      ? w.encounters.find((e) => e.id === event.encounterId)
      : event.frame
    if (!frame) throw Error('实际结算帧不存在')
    if (
      !frame.pending &&
      frame.log.some((l) => l.damageResults?.some((r) => r.pendingId === event.pendingId))
    ) {
      completeM5Result(w, a, event, frame, cat, dice)
      return '原伤害已结算，仅完成一次法术后果'
    }
    if (!frame.pending || frame.pending.id !== event.pendingId || !frame.pending.m5EffectId)
      throw Error('实际结算窗口已变化，请先完成反应或由GM核对')
    event.targets = frame.pending.targets.map((t) => ({
      id:
        m1Entity(w, a, t.id)?.id ??
        event.targets.find((r) => [r.id, m1Entity(w, a, r.id)?.actor?.id].includes(t.id))?.id ??
        t.id,
      hit: t.hit,
    }))
    const result = applyCombat(
      frame,
      w.characters,
      cat,
      {
        type: 'resolve',
        nonlethal: false,
        savage: false,
        stone: false,
        relentless: false,
        pushConfirmed: false,
      },
      dice,
    )
    w.characters = result.characters
    if (event.encounterId) w.encounters[w.encounters.indexOf(frame)] = result.encounter
    else {
      event.frame = result.encounter
      syncBodies(w, a, result.encounter)
    }
    completeM5Result(w, a, event, result.encounter, cat, dice)
    return 'M5后续结算完成，未重新施法或扣位'
  }
  if (op.operation !== 'm5-use') throw Error('未知M5操作')
  const e = a.sceneEffects?.regions.find(
      (e) => e.id === op.effectId && e.status === 'active' && e.m5,
    ),
    config = e?.m5,
    operator = m3Caster(w, a, op.actorId, cat)
  if (!e || !config || state.resolutions.some((r) => r.effectId === e.id && r.status === 'pending'))
    throw Error('原法术已结束或尚有待结算后续')
  if (operator.id !== (e.spellId === 'dragon-s-breath' ? config.targetId : e.sourceId))
    throw Error('只能使用本人实际获得的后续能力')
  if (config.uses.includes(op.receipt)) throw Error('本次后续请求已处理')
  if (state.resolutions.length >= 2000 || config.uses.length >= 2000)
    throw Error('后续能力账本已满，请归档')
  const turn = m3RoundKey(w, a, s),
    key = turn + ':' + (e.spellId === 'spiritual-weapon' ? 'bonus-use' : op.use)
  if (config.uses.includes(key)) throw Error('本次回合已使用该后续能力')
  if (
    ['witch-bolt', 'heat-metal', 'spiritual-weapon'].includes(e.spellId) &&
    config.uses.includes('created:' + turn)
  )
    throw Error('本法术的附赠后续须在后续回合使用')
  if (op.use === 'put-away' && e.spellId === 'flame-blade') {
    config.held = false
    bladeHand(w, a, e, false, cat)
    delete e.light
    config.uses.push(op.receipt)
    return '已放下火焰刀，未结束原专注'
  }
  if (op.use === 'resummon' && e.spellId === 'flame-blade') {
    if (config.held || !freeHand(w, a, operator.id, cat)) throw Error('须已放下且有实际空手')
    m3ActionCost(w, a, operator.id, 'bonus', cat, true)
    config.held = true
    bladeHand(w, a, e, true, cat)
    e.light = { bright: 10, dimExtra: 10, magical: true, sunlight: false, color: '#ed8741' }
    config.uses.push(op.receipt, key)
    return '原火焰刀重新唤出，期限及法术位不刷新'
  }
  if (e.spellId === 'flame-blade' && (!config.held || !freeHand(w, a, operator.id, cat)))
    throw Error('须持握实际火焰刀且空手未被其他物品占用')
  if (e.spellId === 'spiritual-weapon' && op.use === 'move-attack') {
    if (!op.to) throw Error('请选择实际效应物落点')
    const g = anchoredGeometry(w, a, e)!
    if (
      magicDistance(
        { ...g.geometry, x: g.geometry.x + 0.5, y: g.geometry.y + 0.5 },
        { ...op.to, x: op.to.x + 0.5, y: op.to.y + 0.5 },
        s.grid.feet,
      ) > 20 ||
      op.to.x >= s.grid.columns ||
      op.to.y >= s.grid.rows ||
      !physicalPropagation(
        a,
        s,
        { ...g.geometry, x: g.geometry.x + 0.5, y: g.geometry.y + 0.5 },
        { ...op.to, x: op.to.x + 0.5, y: op.to.y + 0.5 },
        'movement',
      ).clear
    )
      throw Error('灵体武器移动须20尺内且不穿实体阻隔')
    Object.assign(e.geometry!, op.to)
  }
  const expected =
    e.spellId === 'dragon-s-breath'
      ? 'breathe'
      : e.spellId === 'heat-metal' || e.spellId === 'witch-bolt'
        ? 'heat'
        : 'attack'
  if (op.use !== expected && !(e.spellId === 'spiritual-weapon' && op.use === 'move-attack'))
    throw Error('所选后续与实际法术不符')
  let ids = op.targetIds
  if (e.spellId === 'witch-bolt') {
    const target = m1Entity(w, a, config.targetId ?? '')
    if (
      !target?.token ||
      !s.tokens.includes(target.token) ||
      magicDistance(tokenPoint(operator.token!), tokenPoint(target.token), s.grid.feet) > 60 ||
      !physicalPropagation(a, s, tokenPoint(operator.token!), tokenPoint(target.token), 'effect')
        .clear
    )
      throw Error('巫术箭链接因距离／完全掩护或场景变化结束')
    ids = [target.id]
  }
  if (e.spellId === 'dragon-s-breath') {
    const p = tokenPoint(operator.token!),
      angle = (op.angle * Math.PI) / 180
    ids = targetsInScene(w, a, s)
      .filter((t) => t.id !== operator.id)
      .filter((t) => {
        const to = tokenPoint(t.token!),
          dx = (to.x - p.x) * s.grid.feet,
          dy = (to.y - p.y) * s.grid.feet,
          d = Math.hypot(dx, dy),
          f = dx * Math.cos(angle) + dy * Math.sin(angle),
          side = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle))
        return (
          to.layer === p.layer &&
          Math.abs(to.height - p.height) <= 15 &&
          shapeContains(
            s.grid,
            {
              x: operator.token!.x,
              y: operator.token!.y,
              shape: 'cone',
              size: 15,
              angle: op.angle,
              width: 5,
              origin: { x: p.x, y: p.y },
              includeOrigin: false,
            },
            t.token!,
          ) &&
          physicalPropagation(a, s, p, to, 'effect').clear
        )
      })
      .map(actualId)
    if (
      op.targetIds.length &&
      (new Set(ids).size !== op.targetIds.length ||
        op.targetIds.some((id) => !ids.includes(m1Entity(w, a, id)?.id ?? id)))
    )
      throw Error('吐息名单与服务器实际锥形覆盖不一致')
  }
  if (e.spellId === 'heat-metal') {
    const object = a.m3?.entities.find((o) => o.id === e.anchor.id && o.enabled),
      fact = state.metals.find((m) => m.objectId === object?.id)
    if (
      !object ||
      !fact ||
      magicDistance(
        tokenPoint(operator.token!),
        { ...object, x: object.x + 0.5, y: object.y + 0.5 },
        s.grid.feet,
      ) > 60
    )
      throw Error('后续加热实际金属须仍在60尺内')
    ids = fact.contactIds.filter((id) => {
      const t = m1Entity(w, a, id)
      return (
        !!t?.token &&
        s.tokens.includes(t.token) &&
        (!object.boundCharacterId || object.boundCharacterId === t.id)
      )
    })
  }
  const cost = ['spiritual-weapon', 'heat-metal', 'witch-bolt'].includes(e.spellId)
    ? 'bonus'
    : 'action'
  if (
    !ids.length &&
    ((e.spellId === 'spiritual-weapon' && op.use === 'move-attack') ||
      e.spellId === 'heat-metal' ||
      e.spellId === 'dragon-s-breath')
  ) {
    m3ActionCost(w, a, operator.id, cost, cat, true)
    config.uses.push(op.receipt, key)
    return '已执行无受伤目标的实际后续并扣动作，未虚构目标'
  }
  startM5Strike(w, a, s, e, operator.id, ids, cost, cat, dice)
  config.uses.push(op.receipt, key)
  return 'M5后续已扣实际动作并保存骰／伤害窗口，请最终结算'
}
