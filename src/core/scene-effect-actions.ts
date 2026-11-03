import {itemCastFailed,itemWaivesMaterials} from './item-spells'
import {m5CastLayout,m5Created,m5Operation,applyM5Operation} from './spell-followups'
import {isM5WorldSpell,isM5ObjectSpell} from './m5-spell-rules'
import { isSupplySpell,validateSupplyCast,applySupplyCast,supplyOperation,applySupplyOperation } from './scene-supplies'
import {knownMetamagic} from './metamagic'
import { MAGIC_RULES, isMagicSceneSpell } from './scene-magic-rules'
import { validateMagicCast, consumeMagicMaterials, configureMagicRegion } from './scene-magic-cast'
import { queueMagic, silenced } from './scene-magic'
import { magicOperation, applyMagicOperation, magicCreated } from './scene-magic-actions'
import { TERRAIN_RULES, isTerrainSpell } from './scene-terrain-rules'
import { m3GroundAt } from './m3-ground'
import {
  terrainGeometry,
  validateTerrainFacts,
  terrainTurn,
  terrainEntityId,
  queueTerrain,
  pendingTerrain,
} from './scene-terrain'
import { terrainOperation, applyTerrainOperation } from './scene-terrain-actions'
import { sceneVision } from './scene-lighting'
import { tokenM3State } from './m3-map-perception'
import type { Adventure, MapWorld } from './map-types'
import type { Catalogue } from './engine'
import type {
  SceneEffectAction,
  SceneEffectCast,
  SceneEffect,
  SceneGeometry,
} from '../persistence/scene-effects-schema'
import { clone } from './engine'
import { m1Entity } from './m1-utility'
import { m3Caster, sourceHours } from './m3-world-cast'
import { m3ActionCost } from './m3-world-actions'
import { runtimeSpells, applyRuntime, castSlotLevel, rollDie } from './runtime'
import {
  explorationRuntime,
  explorationMember,
  assertExplorationReady,
  explorationSpend,
} from './exploration'
import { consumeNpcAbility } from './npc-abilities'
import { applyCombat } from './combat'
import {
  defaultEnvironment,
  customNpc,
  freshTurn,
  combatStats,
  attackRoll,
  rollDamage,
} from './combat-rules'
import { runtimeDerived } from './runtime'
import { reconcileWorld } from './combat-lifecycle'
import { reconcileM3World } from './m3-world-lifecycle'
import {
  sceneEffects,
  M4_SCENE_SPELLS,
  reconcileSceneEffects,
  effectEvent,
  endSceneCast,
  anchoredGeometry,
  tokenPoint,
} from './scene-effects'
import { physicalPropagation, regionContains } from './scene-propagation'
import { sceneCenter } from './scene-effect-geometry'
import { tokenPerception } from './m3-map-perception'
import { distance, mapEnvironment } from './map'

const pointGeometry = (
  p: { x: number; y: number; height: number },
  size: number,
): SceneGeometry => ({
  shape: 'sphere',
  ...p,
  size,
  heightFeet: 0,
  width: 5,
  angle: 0,
  originSpan: 1,
})
const range = (
  a: { x: number; y: number; height: number },
  b: { x: number; y: number; height: number },
  feet: number,
) => Math.max(Math.abs(a.x - b.x) * feet, Math.abs(a.y - b.y) * feet, Math.abs(a.height - b.height))
const within = (p: { x: number; y: number }, s: { grid: { columns: number; rows: number } }) =>
  p.x >= 0 && p.y >= 0 && p.x < s.grid.columns && p.y < s.grid.rows
function dancingLayout(
  points: SceneEffectCast['points'],
  combined: boolean,
  from: ReturnType<typeof tokenPoint>,
  feet: number,
) {
  if (!points.length || points.length > 4 || (combined && points.length !== 1))
    throw Error('舞光须为1至4个光点，合并形态须选1点')
  if (!combined && points.length === 1)
    throw Error('独立舞光须有另一个光点在20尺内；也可将四光合并为一个中型光形')
  if (points.some((p) => range({ x: p.x + 0.5, y: p.y + 0.5, height: p.height }, from, feet) > 120))
    throw Error('舞光必须在施法者120尺内')
  if (
    !combined &&
    points.length > 1 &&
    points.some((p, i) => !points.some((q, j) => i !== j && range(p, q, feet) <= 20))
  )
    throw Error('每个舞光须在另一个舞光20尺内')
}
/** Internal world route. The combat root pays once and retains the reaction stack. */
export function sceneEffectCast(
  world: MapWorld,
  a: Adventure,
  action: Extract<SceneEffectAction, { operation: 'cast' | 'dispel' }>,
  cat: Catalogue,
  dice: (n: number) => number = rollDie,
  settle = false,
) {
  const state = sceneEffects(a),
    scene = a.scenes.find((s) => s.id === a.activeSceneId)
  if (!scene) throw Error('请先进入实际场景')
  const caster = m3Caster(world, a, action.casterId, cat),
    from = caster.token!
  if (pendingTerrain(a, caster.id).length) throw Error('请先结算该人物已经触发的区域后果')
  if (caster.state.effects?.some((f) => f.key === 'stinking-cloud-turn'))
    throw Error('臭云术中毒：本回合不能以动作／附赠动作施法')
  if (!scene.tokens.includes(from)) throw Error('施法者须在当前实际场景')
  const layer = from.spatial?.layer ?? 'material',
    spaceAnchorId = from.spatial?.anchorId
  if (a.m3?.events.some((e) => e.status === 'pending' && e.entityId === caster.id))
    throw Error('请先处理施法者待结算空间后果')
  const grant = caster.c
      ? runtimeSpells(caster.c, cat).find((g) => g.key === action.key)
      : undefined,
    ability = caster.body?.abilities?.find((b) => b.id === action.key)
  const spell = grant?.spell ?? cat.spells.find((s) => s.id === ability?.spellId)
  if (
    !spell ||
    !(action.operation === 'dispel'
      ? spell.id === 'dispel-magic'
      : M4_SCENE_SPELLS.includes(spell.id as (typeof M4_SCENE_SPELLS)[number])||isM5WorldSpell(spell.id)||isM5ObjectSpell(spell.id)&&action.operation==='cast'&&!!action.objectId)
  )
    throw Error('请选择实际可用的光照、黑暗、雾云或解除魔法来源')
  if (
    (layer === 'stone' && spell.id !== 'produce-flame') ||
    (layer === 'pocket' &&
      !(
        action.operation === 'cast' &&
        (spell.id === 'produce-flame' ||
          (['light', 'continual-flame'].includes(spell.id) && !!action.inventoryInstanceId))
      ))
  )
    throw Error(
      '石内仅支持自身燃火术；魔绳内部本批支持自身火焰和本人背包光源，其他区域需要独立内部空间',
    )
  if (!settle && (grant ? !grant.modes.includes(action.mode) : action.mode !== 'npc'))
    throw Error('须使用本人实际法术来源和施法方式')
  const slot = castSlotLevel(action.mode) || ability?.slotLevel || spell.level
  if ((spell.level === 0 && slot !== 0) || (spell.level > 0 && slot < spell.level))
    throw Error('实际施法环级不能低于法术基础环级，戏法不能升环')
  const battle = world.encounters.find((e) => e.id === scene.encounterId && e.phase === 'active'),
    actor = battle?.actors.find(
      (t) =>
        (!!caster.c && t.characterId === caster.c.id) ||
        t.id === caster.actor?.id ||
        (!!caster.n && t.npcId === caster.n.id),
    )
  const now = () =>
    sourceHours(
      world,
      caster.c?.id ?? world.characters.find((c) => a.party.includes(c.id) && c.runtime)?.id ?? '',
    )
  const points = action.operation === 'cast' ? action.points : []
  if (points.some((p) => !within(p, scene))) throw Error('效果起点须位于实际场景内')
  const object =
    action.operation === 'cast'
      ? a.m3?.entities.find((o) => o.id === action.objectId && o.enabled && o.sceneId === scene.id)
      : undefined
  const inventory =
    action.operation === 'cast'
      ? caster.c?.inventory.find(
          (i) => i.instanceId === action.inventoryInstanceId && i.quantity > 0,
        )
      : undefined
  const magicLayout=action.operation==='cast'&&isMagicSceneSpell(spell.id)?validateMagicCast(world,a,scene,caster,action,spell.id,slot,cat):undefined
  const m5Layout=action.operation==='cast'?m5CastLayout(world,a,scene,spell.id,action,cat):undefined
  const supplyLayout=action.operation==='cast'&&isSupplySpell(spell.id)?validateSupplyCast(world,a,scene,spell.id,action,slot):undefined
  let anchor: SceneEffect['anchor'] = { kind: 'point', offsetHeight: 0 },
    locations = points
  const touch = () => {
    const p = object
      ? {
          x: object.x + 0.5,
          y: object.y + 0.5,
          height: object.height,
          layer: object.layer ?? 'material',
          anchorId: object.anchorId,
        }
      : tokenPoint(from)
    if (
      range(tokenPoint(from), p, scene.grid.feet) > 5 ||
      !physicalPropagation(a, scene, tokenPoint(from), p, 'effect').clear
    )
      throw Error('物件须在5尺内可触及且没有完全遮挡')
  }
  if (action.operation === 'dispel') {
    const target = state.regions.find((e) => e.id === action.effectId && e.status === 'active'),
      g = target && anchoredGeometry(world, a, target)
    const chosen = g
      ? {
          ...(action.to
            ? { x: action.to.x + 0.5, y: action.to.y + 0.5, height: action.to.height }
            : sceneCenter(g.geometry)),
          layer: g.layer,
          anchorId: g.anchorId,
        }
      : undefined
    if (
      action.to &&
      (!within(action.to, scene) ||
        !target ||
        !g ||
        !chosen ||
        (!target.covered && !regionContains(world, a, scene, target, chosen)) ||
        (target.covered &&
          range(chosen, sceneCenter(g.geometry), scene.grid.feet) > scene.grid.feet / 2))
    )
      throw Error('解除点必须落在实际效果内；遮盖中的光源须指定实际锚点')
    if (
      !target ||
      !g ||
      g.scene.id !== scene.id ||
      (g.layer ?? 'material') !== layer ||
      (g.layer === 'pocket' && g.anchorId !== spaceAnchorId) ||
      !chosen ||
      range(tokenPoint(from), chosen, scene.grid.feet) > 120 ||
      !physicalPropagation(a, scene, tokenPoint(from), chosen, 'effect').clear
    )
      throw Error('请选择120尺内、没有完全遮挡的实际法术区域')
    if(target.spellId==='mundane-light'||isSupplySpell(target.spellId))throw Error('普通照明／实物补给不是可解除的持续法术')
    if (target.spellId === 'plant-growth')
      throw Error('植物滋长是已产生的物理结果，不能用解除魔法撤回')
    if (target.slotLevel > 3) throw Error('本批区域为0–3环；更高环区域请使用GM明确裁定')
  } else if(m5Layout){anchor=m5Layout.anchor;locations=m5Layout.locations
  } else if(supplyLayout){ locations=supplyLayout.locations
  } else if (magicLayout) {
    anchor=magicLayout.anchor;locations=magicLayout.locations
  } else if (spell.id === 'produce-flame') {
    if (object || action.objectId || inventory || action.inventoryInstanceId || points.length)
      throw Error('燃火术产生在自己手中，不另选落点或物件')
    anchor = { kind: 'creature', id: caster.id, offsetHeight: 0 }
    locations = [{ x: from.x, y: from.y, height: from.spatial?.height ?? 0 }]
  } else if (['light', 'continual-flame'].includes(spell.id)) {
    if (
      !!object === !!inventory ||
      points.length ||
      (action.objectId && !object) ||
      (action.inventoryInstanceId && !inventory)
    )
      throw Error('须选择一个实际物件或本人实际背包条目')
    if (
      object &&
      ((object.layer ?? 'material') !== layer ||
        (spell.id === 'light' &&
          object.boundCharacterId &&
          object.boundCharacterId !== caster.id &&
          object.boundCharacterId !== caster.c?.id))
    )
      throw Error('不能用光亮术触碰他人携带／着装的物件')
    if (
      spell.id === 'light' &&
      object &&
      Math.max(object.width, object.depth, object.heightFeet) > 10
    )
      throw Error('光亮术物件不能超过大型占地')
    if (inventory && inventory.quantity !== 1) throw Error('光源须绑定单件真实物品，请先拆分堆叠')
    touch()
    anchor = {
      kind: object ? 'object' : 'inventory',
      id: object?.id ?? inventory!.instanceId,
      ...(!object ? { ownerId: caster.c!.id } : {}),
      offsetHeight: 0,
    }
    locations = [
      object
        ? { x: object.x, y: object.y, height: object.height }
        : { x: from.x, y: from.y, height: from.spatial?.height ?? 0 },
    ]
  } else if (object || action.objectId) {
    if (
      !object ||
      !['daylight', 'darkness'].includes(spell.id) ||
      !object.loose ||
      object.boundCharacterId ||
      (object.layer ?? 'material') !== layer ||
      points.length ||
      action.inventoryInstanceId
    )
      throw Error('此版本须选择未着装、未携带的实际物件，不同时选位置')
    anchor = { kind: 'object', id: object.id, offsetHeight: 0 }
    locations = [{ x: object.x, y: object.y, height: object.height }]
  } else {
    if (action.inventoryInstanceId || (spell.id !== 'dancing-lights' && points.length !== 1))
      throw Error('须指定一个实际起点；舞光可指定至多四点')
    if (spell.id === 'dancing-lights')
      dancingLayout(points, action.combined, tokenPoint(from), scene.grid.feet)
  }
  if (
    action.operation === 'cast' &&
    !['produce-flame', 'light', 'continual-flame'].includes(spell.id)
  ) {
    const max =
      (isM5ObjectSpell(spell.id)?(spell.id==='fire-bolt'?120:60):isM5WorldSpell(spell.id)?(spell.id==='mind-spike'?120:spell.id==='heat-metal'||spell.id==='spiritual-weapon'||spell.id==='witch-bolt'?60:5):undefined)??(isSupplySpell(spell.id)?30:undefined) ?? MAGIC_RULES[spell.id]?.range ?? TERRAIN_RULES[spell.id]?.range ??
      (spell.id === 'fog-cloud' || spell.id === 'dancing-lights' ? 120 : 60)
    if (
      locations.some(
        (p) =>
          range(
            tokenPoint(from),
            { x: p.x + 0.5, y: p.y + 0.5, height: p.height },
            scene.grid.feet,
          ) > max ||
          !physicalPropagation(
            a,
            scene,
            tokenPoint(from),
            { x: p.x + 0.5, y: p.y + 0.5, height: p.height, layer, anchorId: spaceAnchorId },
            'effect',
          ).clear,
      )
    )
      throw Error('起点超出实际施法距离或被完全遮挡')
  }
  const terrain = TERRAIN_RULES[spell.id]
  const terrainFacts = action.operation === 'cast' ? action.terrain : undefined
  // The catalogue contains both Plant Growth casting times. Select the recipe
  // explicitly; the generic runtime's first /hours/ match must not charge 8h
  // for the Action variant. The enrichment time is advanced below, once.
  const castCatalogue =
    spell.id === 'plant-growth'
      ? {
          ...cat,
          spells: cat.spells.map((s) => (s.id === spell.id ? { ...s, castingTime: 'Action' } : s)),
        }
      : cat
  const plantCells =
    terrain && action.operation === 'cast'
      ? validateTerrainFacts(
          a,
          scene,
          spell.id,
          terrainGeometry(spell.id, locations[0]!, terrainFacts?.webSupport === 'surface'),
          terrainFacts,
        )
      : []
  if (terrain?.ground && locations[0]!.height !== m3GroundAt(a, scene, locations[0]!))
    throw Error('地面区域起点须位于已核实地面／平台')
  if (
    terrainFacts?.enrichment &&
    state.regions.some(
      (e) =>
        e.spellId === 'plant-growth' &&
        e.terrain?.enrichment &&
        e.status === 'active' &&
        (e.endsAt ?? 0) > now() &&
        e.terrain.supportIds.some((id) => terrainFacts.plantIds.includes(id)),
    )
  )
    throw Error('这些实际植物在本年度已经受益于植物滋长，不能重复叠加丰产')
  if (
    terrainFacts?.enrichment &&
    (spell.id !== 'plant-growth' || battle || a.exploration?.status === 'active')
  )
    throw Error('丰产分支需要8小时施法，不能在战斗或探索回合中完成')
  if (action.operation === 'cast' && spell.id === 'continual-flame' && !settle && !itemWaivesMaterials(grant)) {
    const material = state.materials.find(
        (m) => m.ownerId === caster.id && m.instanceId === action.materialId && m.kind==='ruby-dust' && m.valueGP >= 50,
      ),
      row = caster.c?.inventory.find(
        (i) => i.instanceId === material?.instanceId && i.quantity >= 1,
      ),
      supply = caster.n?.consumables?.find((i) => i.id === material?.instanceId)
    if (
      !material ||
      (!row && (!supply || supply.quantity - (caster.n?.consumablesUsed?.[supply.id] ?? 0) < 1))
    )
      throw Error('不灭明焰须消耗已核验、价值至少50GP的实际红宝石尘；不能用金币或整颗宝石代替')
  }
  const subtle=action.operation==='cast'&&action.subtle===true
  if(subtle){if(!caster.c)throw Error('模板NPC不能凭标记获得精妙法术');knownMetamagic(caster.c,'subtle')}
  if(!settle&&!subtle&&silenced(world,a,scene,from)&&/(^|[,\s])V([,\s(]|$)/.test(spell.components))throw Error('沉默区域中不能使用言语成分施法')
  let saved = settle
    ? state.casts.find(
        (c) => c.id === battle?.pending?.sceneEffectCastId && !c.settled && !c.canceled,
      )
    : undefined
  if (settle) {
    if (
      !saved ||
      (saved.spaceLayer && saved.spaceLayer !== layer) ||
      saved.spaceAnchorId !== spaceAnchorId ||
      JSON.stringify(saved.action) !== JSON.stringify(action) ||
      !battle?.pending
    )
      throw Error('原施法已被反制、结算或窗口已变化')
    delete battle.pending.sceneEffectCastId
    const result = applyCombat(
      battle,
      world.characters,
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
    world.encounters[world.encounters.indexOf(battle)] = result.encounter
    world.characters = result.characters
  } else {
    if (state.casts.length >= 2000 || state.regions.length + locations.length > 3000)
      throw Error('场景效果记录达到上限，请先归档')
    const id = crypto.randomUUID(),
      clockSourceId =
        caster.c?.id ?? world.characters.find((c) => a.party.includes(c.id) && c.runtime)?.id
    if (!clockSourceId) throw Error('施法需要实际冒险时钟')
    const duration = isM5WorldSpell(spell.id)?spell.id==='flame-blade'?1/6:spell.id==='mind-spike'?1:1/60:isMagicSceneSpell(spell.id)?MAGIC_RULES[spell.id]?.hours:terrain
      ? terrainFacts?.enrichment
        ? 365 * 24
        : terrain.hours
      : spell.id === 'dancing-lights'
        ? 1 / 60
        : spell.id === 'produce-flame' || spell.id === 'darkness'
          ? 1 / 6
          : spell.id === 'continual-flame'
            ? undefined
            : 1
    saved = {
      id,
      castId: id,
      action: clone(action),
      spellId: spell.id,
      sourceId: caster.id,
      sceneId: scene.id,
      spaceLayer: layer,
      spaceAnchorId,
      clockSourceId,
      slotLevel: slot,
      createdHour: now(),
      endsAt: duration === undefined ? undefined : now() + duration,
      settled: false,
      canceled: false,
      ...(battle ? { encounterId: battle.id } : {}),
    }
    if (battle) {
      if (!actor || battle.pending) throw Error('请先处理待结算，施法者须加入当前战斗')
      const command = grant
        ? {
            type: 'cast' as const,
            actorId: actor.id,
            key: grant.key,
            mode: action.mode,
            targets: [actor.id],
            env: { ...defaultEnvironment(), note: action.note },
            damageType: 'force' as const,
            requirementsConfirmed: true,
            sceneEffectCastId: id,
            ...(subtle?{metamagic:{option:'subtle',protectedIds:[],heightenedId:'',damageType:'force' as const}}:{}),
          }
        : {
            type: 'npc-ability' as const,
            actorId: actor.id,
            abilityId: ability!.id,
            targetIds: [actor.id],
            env: defaultEnvironment(),
            confirmed: true,
            note: action.note,
            sceneEffectCastId: id,
          }
      const result = applyCombat(battle, world.characters, castCatalogue, command, dice)
      if(grant&&itemCastFailed(result.characters.find(c=>c.id===caster.c?.id),grant.key)){world.encounters[world.encounters.indexOf(battle)]=result.encounter;world.characters=result.characters;return '卷轴施法检定失败，卷轴和行动已消耗，没有法术效果'}
      if (!result.encounter.pending) throw Error('未能建立实际施法窗口，费用未提交')
      result.encounter.pending.sceneEffectCastId = id
      world.encounters[world.encounters.indexOf(battle)] = result.encounter
      world.characters = result.characters
    } else if (grant && caster.c) {
      const command = {
        type: 'cast' as const,
        key: grant.key,
        mode: action.mode,
        requirementsConfirmed: true,
        deferEffects: true,
      }
      if(subtle)world.characters[world.characters.indexOf(caster.c)]=applyRuntime(caster.c,castCatalogue,{type:'resource',id:'sorcery-points',amount:1,note:'精妙法术'},dice)
      const liveCaster=world.characters.find(c=>c.id===caster.c!.id)!
      explorationRuntime(world, a, caster.c.id, command, castCatalogue)
      world.characters[world.characters.findIndex(c=>c.id===caster.c!.id)] = applyRuntime(
        liveCaster,
        castCatalogue,
        command,
        dice,undefined,subtle?{subtle:true}:undefined,
      )
      if(itemCastFailed(world.characters.find(c=>c.id===caster.c!.id),grant.key))return '卷轴施法检定失败，卷轴和行动已消耗，没有法术效果'
    } else {
      if (!ability) throw Error('NPC没有实际施法能力')
      const budget = explorationMember(a, from.id)
      if (budget) {
        assertExplorationReady(world, a, budget, cat)
        if (ability.cost !== 'none') explorationSpend(budget, ability.cost, true)
      }
      consumeNpcAbility(caster.body!, ability.id)
      caster.body!.effects = caster.body!.effects.filter((f) => f.key !== 'invisibility')
      if (spell.concentration)
        caster.body!.concentration = {
          spellId: spell.id,
          castId: id,
          clockSourceId,
          endsAt: saved.endsAt,
          encounterId: 'outside',
        }
    }
    if (action.operation === 'cast' && spell.id === 'continual-flame' && !itemWaivesMaterials(grant)) {
      const live = m1Entity(world, a, caster.id)!
      if (live.c) {
        const row = live.c.inventory.find((i) => i.instanceId === action.materialId)!
        row.quantity--
        if (!row.quantity) live.c.inventory = live.c.inventory.filter((i) => i !== row)
      } else {
        live.n!.consumablesUsed ??= {}
        live.n!.consumablesUsed[action.materialId!] =
          (live.n!.consumablesUsed[action.materialId!] ?? 0) + 1
      }
    }
    if(action.operation==='cast'&&magicLayout){consumeMagicMaterials(world,a,caster,action,spell.id,cat)
      if(!caster.c){const time=spell.castingTime.match(/(\d+)\s+(minute|hour)/i);if(time){for(const clock of world.characters.filter(c=>a.party.includes(c.id)&&c.runtime))clock.runtime!.hours=(clock.runtime!.hours??0)+(Number(time[1])*(time[2]!.toLowerCase()==='hour'?1:1/60));if(caster.body)delete caster.body.concentration}}
    }
    if (spell.concentration) {
      const live = m1Entity(world, a, caster.id)
      saved.castId =
        live?.c?.runtime?.concentration?.castId ?? live?.body?.concentration?.castId ?? id
    }
    const elapsed = (saved.endsAt ?? saved.createdHour) - saved.createdHour
    saved.createdHour = now()
    if (saved.endsAt !== undefined) saved.endsAt = saved.createdHour + elapsed
    if (spell.concentration) {
      const live = m1Entity(world, a, caster.id),
        conc = live?.c?.runtime?.concentration ?? live?.body?.concentration
      if (typeof conc?.endsAt === 'number') saved.endsAt = conc.endsAt
    }
    state.casts.push(saved)
    if (battle) return '实际施法费用与目标已保存，等待反制及最终确认；区域尚未生效'
  }
  if (terrainFacts?.enrichment) {
    const live = m1Entity(world, a, caster.id)
    if (live?.c?.runtime) live.c.runtime.concentration = null
    else if (live?.body) delete live.body.concentration
    for (const c of world.characters.filter((c) => a.party.includes(c.id) && c.runtime))
      c.runtime!.hours = (c.runtime!.hours ?? 0) + 8
    saved!.createdHour = now()
    saved!.endsAt = now() + 365 * 24
  }
  saved!.settled = true
  if (action.operation === 'dispel') {
    const target = state.regions.find((e) => e.id === action.effectId)!
    endSceneCast(world, a, target.castId, '解除魔法已确认')
    return '已解除所选施法来源的全部区域，未重复扣费'
  }
  if (['light', 'produce-flame'].includes(spell.id))
    for (const old of state.regions.filter(
      (e) => e.status === 'active' && e.sourceId === caster.id && e.spellId === spell.id,
    ))
      endSceneCast(world, a, old.castId, '同一来源再次施放')
  const bright = spell.id === 'dancing-lights' ? 0 : spell.id === 'daylight' ? 60 : 20,
    dim = spell.id === 'dancing-lights' ? 10 : spell.id === 'daylight' ? 60 : 20,
    size = spell.id === 'darkness' ? 15 : spell.id === 'fog-cloud' ? 20 * slot : bright + dim
  for (const p of locations) {
    const geometry = terrain
      ? terrainGeometry(spell.id, p, terrainFacts?.webSupport === 'surface')
      : pointGeometry(p, size)
    if (anchor.kind === 'object' && ['daylight', 'darkness'].includes(spell.id)) {
      geometry.shape = 'emanation'
      geometry.size = spell.id === 'darkness' ? 15 : 60
    }
    const region: SceneEffect = {
      id: crypto.randomUUID(),
      castId: saved!.castId,
      spellId: spell.id,
      name: spell.name,
      sceneId: scene.id,
      sourceId: caster.id,
      sourceKind: caster.c ? 'character' : 'npc',
      clockSourceId: saved!.clockSourceId,
      slotLevel: slot,
      createdHour: saved!.createdHour,
      endsAt: saved!.endsAt,
      concentration: terrain
        ? ['entangle', 'web', 'spike-growth', 'sleet-storm', 'stinking-cloud'].includes(spell.id)
        : spell.concentration,
      status: 'active',
      layer,
      spaceAnchorId,
      geometry,
      anchor: clone(anchor),
      hidden: terrain ? false : from.hidden,
      covered: false,
      channels: [],
      obscurity:
        terrain?.obscurity ??
        (spell.id === 'darkness'
          ? 'magical-darkness'
          : spell.id === 'fog-cloud'
            ? 'heavy'
            : 'none'),
      requiresGeometry: false,
      note: action.note,
      ...(!terrain && !['darkness', 'fog-cloud'].includes(spell.id)
        ? {
            light: {
              bright,
              dimExtra: dim,
              sunlight: spell.id === 'daylight',
              magical: true,
              color: action.color,
            },
          }
        : {}),
    }
    if (terrain) {
      const attr = grant?.ability ?? ability?.ability ?? caster.body?.spellcasting?.ability ?? 'wis'
      const dc = grant?.item?.dc ?? (caster.c
        ? 8 + Math.ceil(caster.c.level / 4) + 1 + runtimeDerived(caster.c, cat).mods[attr]
        : (caster.body?.spellcasting?.dc ??
          8 + 2 + Math.floor(((caster.body?.scores[attr] ?? 10) - 10) / 2)))
      region.terrain = {
        dc,
        multiplier: terrain.multiplier,
        groundOnly: terrain.ground,
        plantCells,
        excludedCells: terrainFacts?.excludedCells ?? [],
        knownTo: [caster.id],
        supportIds:
          spell.id === 'plant-growth'
            ? (terrainFacts?.plantIds ?? [])
            : (terrainFacts?.supportIds ?? []),
        webSupport: terrainFacts?.webSupport,
        createdTurn: terrainTurn(world, a, scene),
        burns: [],
        travel: [],
        enrichment: terrainFacts?.enrichment ?? false,
      }
      if (spell.id === 'plant-growth' && region.terrain.enrichment) region.terrain.multiplier = 1
      // Preserve actual witnessing now; later visibility must not rewrite historical knowledge.
      if (spell.id === 'spike-growth')
        for (const t of scene.tokens) {
          const senses = tokenM3State(world, a, t, cat),
            vision = sceneVision(
              world,
              a,
              scene,
              tokenPoint(t),
              { ...p, x: p.x + 0.5, y: p.y + 0.5 },
              senses,
            )
          const canSee =
            !senses.blinded ||
            (senses.blindsight > 0 &&
              range(tokenPoint(t), { ...p, x: p.x + 0.5, y: p.y + 0.5 }, scene.grid.feet) <=
                senses.blindsight)
          if (canSee && vision.ray.clear && vision.illuminated)
            region.terrain.knownTo.push(terrainEntityId(t))
        }
    }
    if (spell.id === 'dancing-lights') {
      region.combined = action.combined
      region.lightUnits = action.combined ? 4 : 1
    }
    if(magicLayout)configureMagicRegion(world,a,scene,caster,action,region,cat)
    state.regions.push(region)
    if(m5Layout)m5Created(world,a,scene,region,action,cat,dice)
    if(supplyLayout)applySupplyCast(world,a,scene,region,action)
    if(magicLayout)magicCreated(world,a,scene,region,action,cat,dice)
    effectEvent(a, region, 'created', '实际施法结算')
    if (terrain)
      for (const t of scene.tokens) queueTerrain(world, a, scene, t, 'created', region.id, region)
    if (spell.id === 'sleet-storm')
      for (const flame of state.regions.filter(
        (e) =>
          e.spellId === 'mundane-light' &&
          e.light?.flame &&
          !e.covered &&
          e.status === 'active' &&
          e.geometry &&
          regionContains(world, a, scene, region, {
            x: e.geometry.x + 0.5,
            y: e.geometry.y + 0.5,
            height: e.geometry.height,
          }),
      ))
        endSceneCast(world, a, flame.castId, '雪雨暴浇熄暴露明火')
  }
  return spell.name + '已生成持续场景效果；按来源、时钟、专注与实际阻隔结算'
}

export function applySceneEffectAction(
  input: MapWorld,
  adventureId: string,
  action: SceneEffectAction,
  cat: Catalogue,
  dice: (n: number) => number = rollDie,
) {
  const world = clone(input),
    a = world.adventures.find((a) => a.id === adventureId)
  if (!a) throw Error('冒险不存在')
  reconcileSceneEffects(world)
  const state = sceneEffects(a),
    beforeEvents = new Set(state.events.map((e) => e.id))
  let detail = ''
  if(m5Operation(action.operation))detail=applyM5Operation(world,a,action,cat,dice)
  else if(supplyOperation(action.operation))detail=applySupplyOperation(world,a,action,cat)
  else if(magicOperation(action.operation))detail=applyMagicOperation(world,a,action,cat,dice)
  else if (terrainOperation(action.operation))
    detail = applyTerrainOperation(
      world,
      a,
      action as Extract<
        SceneEffectAction,
        {
          operation:
            | 'hazard'
            | 'hazard-order'
            | 'escape'
            | 'search-terrain'
            | 'burn-web'
            | 'clear-growth'
            | 'environment-round'
            | 'resume-route'
        }
      >,
      cat,
      dice,
    )
  else if (action.operation === 'cast' || action.operation === 'dispel')
    detail = sceneEffectCast(world, a, action, cat, dice)
  else if (action.operation === 'object-durability') {
    const object = a.m3?.entities.find((o) => o.id === action.objectId && o.enabled)
    if (!object || object.boundCharacterId || action.hp > action.maxHp)
      throw Error('须选择未绑定生物的实际物件并核实合法AC／HP与材质抗性')
    state.objectBodies = state.objectBodies
      .filter((o) => o.objectId !== object.id)
      .concat({
        objectId: object.id,
        combustible: action.combustible,
        ac: action.ac,
        hp: action.hp,
        maxHp: action.maxHp,
        fire: action.fire,
        note: action.note,
      })
    if (!action.hp) object.enabled = false
    detail = '已核验物件耐久与火焰抗性，不将物件伪装为NPC'
  } else if (action.operation === 'fixture-light') {
    const object = a.m3?.entities.find(
        (o) => o.id === action.objectId && o.enabled && (o.layer ?? 'material') === 'material',
      ),
      clock = world.characters.find((c) => a.party.includes(c.id) && c.runtime)
    if (!object || !clock || (!action.bright && !action.dimExtra))
      throw Error('须关联实际物件、有效时钟及非零照明范围')
    for (const old of state.regions.filter(
      (e) => e.sourceKind === 'scenario' && e.anchor.id === object.id && e.status === 'active',
    ))
      endSceneCast(world, a, old.castId, 'GM重新核实物件照明')
    const id = crypto.randomUUID(),
      e: SceneEffect = {
        id,
        castId: id,
        spellId: 'mundane-light',
        name: object.name + ' · 非魔法光源',
        sourceId: object.id,
        sourceKind: 'scenario',
        clockSourceId: clock.id,
        sceneId: object.sceneId,
        slotLevel: 0,
        createdHour: clock.runtime!.hours ?? 0,
        status: 'active',
        concentration: false,
        geometry: pointGeometry(
          { x: object.x, y: object.y, height: object.height },
          action.bright + action.dimExtra,
        ),
        anchor: { kind: 'object', id: object.id, offsetHeight: 0 },
        hidden: object.hidden,
        covered: false,
        obscurity: 'none',
        channels: [],
        requiresGeometry: false,
        note: action.note,
        light: {
          bright: action.bright,
          dimExtra: action.dimExtra,
          color: action.color,
          magical: false,
          protected:action.protected,flame: action.flame ?? false,
          sunlight: false,
        },
      }
    if (state.regions.length >= 3000) throw Error('场景效果达到上限')
    state.regions.push(e)
    effectEvent(a, e, 'created', 'GM核实实际非魔法光源')
    detail = '已登记非魔法物件照明，黑暗术会抑制而不解除它'
  } else if (action.operation === 'material') {
    const owner = m1Entity(world, a, action.ownerId),
      row = owner?.c?.inventory.find((i) => i.instanceId === action.instanceId && i.quantity > 0),
      supply = owner?.n?.consumables?.find(
        (i) =>
          i.id === action.instanceId && i.quantity - (owner.n?.consumablesUsed?.[i.id] ?? 0) > 0,
      )
    if (!owner || (!row && !supply)) throw Error('材料须关联人物实际持有的背包／NPC消耗品条目')
    state.materials = state.materials
      .filter((m) => m.ownerId !== owner.id || m.instanceId !== action.instanceId)
      .concat({ ...action, ownerId: owner.id })
      .map(({ ownerId, instanceId, kind, valueGP }) => ({ ownerId, instanceId, kind, valueGP }))
    detail = '已核验实际材料种类与价值，不自动生成材料'
  } else {
    if (!('effectId' in action)) throw Error('无效场景操作')
    const e = state.regions.find((e) => e.id === action.effectId && e.status === 'active')
    if (!e) throw Error('效果已结束或不存在')
    const current = anchoredGeometry(world, a, e)
    if (action.operation === 'legacy-geometry') {
      if (!e.legacy) throw Error('仅用于补登记旧区域的实际几何')
      const encounter = world.encounters.find((x) => x.id === e.legacy!.encounterId),
        zone = encounter?.zones?.find((z) => z.id === e.legacy!.zoneId)
      if (!zone || action.geometry.shape === 'wall') throw Error('原区域不存在或形状不适用')
      const g = action.geometry
      zone.template = {
        shape: g.shape as Exclude<typeof g.shape, 'wall'>,
        x: g.x,
        y: g.y,
        size: g.size,
        angle: g.angle,
        width: g.width,
        originSpan: g.originSpan,
      }
      e.geometry = clone(g)
      e.requiresGeometry = false
      effectEvent(a, e, 'located', 'GM核实原区域，保留原执行记录')
      detail = '已补登记旧区域位置'
    } else if (action.operation === 'disperse') {
      if (!['fog-cloud', 'stinking-cloud'].includes(e.spellId))
        throw Error('强风驱散仅适用于雾云／臭云术')
      endSceneCast(world, a, e.castId, 'GM已核实强风驱散')
      detail = '强风已驱散该来源雾云'
    } else if (action.operation === 'cover') {
      if (!['object', 'inventory'].includes(e.anchor.kind) || !current)
        throw Error('仅物件光源／造暗锚点可被不透明物完全遮盖')
      if (action.actorId) {
        const actor = m3Caster(world, a, action.actorId, cat)
        if (
          !current.scene.tokens.includes(actor.token!) ||
          (actor.token!.spatial?.layer ?? 'material') !== (current.layer ?? 'material') ||
          (current.layer === 'pocket' && actor.token!.spatial?.anchorId !== current.anchorId) ||
          range(tokenPoint(actor.token!), sceneCenter(current.geometry), current.scene.grid.feet) >
            5 ||
          !physicalPropagation(
            a,
            current.scene,
            tokenPoint(actor.token!),
            { ...sceneCenter(current.geometry), layer: current.layer, anchorId: current.anchorId },
            'effect',
          ).clear
        )
          throw Error('操作物件须在5尺内实际可触及')
        m3ActionCost(world, a, actor.id, 'action', cat)
      }
      if (e.covered === action.covered) throw Error('遮盖状态没有变化，未重复扣费')
      e.covered = action.covered
      effectEvent(a, e, action.covered ? 'covered' : 'uncovered', action.note)
      detail = action.covered ? '光线／黑暗已被完全遮盖' : '已移开遮盖'
    } else if (action.operation === 'end') {
      if (action.actorId !== e.sourceId || !e.concentration)
        throw Error('只能主动结束本人专注；其他法术须到期、重施或解除魔法')
      endSceneCast(world, a, e.castId, '来源主动结束专注')
      detail = '本人专注与该来源区域已结束'
    } else if (action.operation === 'move-lights') {
      if (e.spellId !== 'dancing-lights' || action.actorId !== e.sourceId || !current)
        throw Error('只能移动本人有效舞光')
      const caster = m3Caster(world, a, action.actorId, cat),
        rows = state.regions.filter((r) => r.castId === e.castId && r.status === 'active')
      if (
        !current.scene.tokens.includes(caster.token!) ||
        (caster.token!.spatial?.layer ?? 'material') !== (current.layer ?? 'material') ||
        (current.layer === 'pocket' && caster.token!.spatial?.anchorId !== current.anchorId)
      )
        throw Error('舞光与施法者不在同一场景／空间')
      dancingLayout(
        action.points,
        action.combined,
        tokenPoint(caster.token!),
        current.scene.grid.feet,
      )
      const units = rows.reduce((n, r) => n + (r.lightUnits ?? 1), 0)
      if (action.combined ? units !== 4 : action.points.length > units)
        throw Error('不能重建已经消失的舞光；合并中型光形需要四个有效光点')
      const origins = rows.flatMap((r) =>
          Array.from({ length: r.lightUnits ?? 1 }, () => r.geometry!),
        ),
        destinations = action.combined
          ? Array.from({ length: 4 }, () => action.points[0]!)
          : action.points
      const assign = (index: number, used: Set<number>): boolean =>
        index === destinations.length ||
        origins.some(
          (g, i) =>
            !used.has(i) &&
            range(g, destinations[index]!, current.scene.grid.feet) <= 60 &&
            physicalPropagation(
              a,
              current.scene,
              { ...sceneCenter(g), layer: current.layer, anchorId: current.anchorId },
              {
                x: destinations[index]!.x + 0.5,
                y: destinations[index]!.y + 0.5,
                height: destinations[index]!.height,
                layer: current.layer,
                anchorId: current.anchorId,
              },
              'effect',
            ).clear &&
            assign(index + 1, new Set([...used, i])),
        )
      if (action.points.some((p) => !within(p, current.scene)) || !assign(0, new Set()))
        throw Error('每个光点移动至多60尺且不能穿过完全遮挡')
      if (state.regions.length + action.points.length > 3000)
        throw Error('场景效果记录达到上限，请先归档')
      m3ActionCost(world, a, caster.id, 'bonus', cat)
      // Changing the combined representation never recreates a dispelled/expired casting.
      rows.forEach((r) => {
        r.status = 'ended'
        r.reason = '同次舞光布局调整'
      })
      for (const p of action.points) {
        const next = {
          ...clone(e),
          id: crypto.randomUUID(),
          status: 'active' as const,
          geometry: pointGeometry(p, 10),
          reason: undefined,
          combined: action.combined,
          lightUnits: action.combined ? 4 : 1,
        }
        state.regions.push(next)
        effectEvent(
          a,
          next,
          'moved',
          action.note,
          crypto.randomUUID(),
          world.characters.find((c) => c.id === e.clockSourceId)?.runtime?.hours ?? e.createdHour,
        )
      }
      detail = '舞光已移动，已消耗一次附赠动作'
    } else if (action.operation === 'throw-flame') {
      if (e.spellId !== 'produce-flame' || e.sourceId !== action.casterId || !current)
        throw Error('须使用自己手中有效燃火术')
      const caster = m3Caster(world, a, action.casterId, cat),
        battle = world.encounters.find(
          (x) => x.id === current.scene.encounterId && x.phase === 'active',
        ),
        target = m1Entity(world, a, action.targetId)
      const object = a.m3?.entities.find(
          (o) =>
            o.id === action.targetId &&
            o.enabled &&
            o.sceneId === current.scene.id &&
            (o.layer ?? 'material') === 'material' &&
            !o.boundCharacterId,
        ),
        durability = state.objectBodies.find((o) => o.objectId === object?.id && o.hp > 0)
      if (object) {
        if ((caster.token!.spatial?.layer ?? 'material') !== (object.layer ?? 'material'))
          throw Error('燃火攻击不能跨空间影响物件')
        if (!durability) throw Error('物件须先由GM核实AC、HP和火焰抗性，不能凭图片或名称假定可破坏')
        const to = {
          ...object,
          spatial: { height: object.height, layer: 'material' as const },
          span: 1,
          id: object.id,
          characterId: null,
          actorId: null,
          name: object.name,
          hidden: object.hidden,
          color: '#777777',
          facing: 0,
        }
        if (distance(current.scene, caster.token!, to) > 60)
          throw Error('物件在燃火术60尺攻击距离外')
        const env = mapEnvironment(
          current.scene,
          caster.token!,
          to,
          { ...defaultEnvironment(), note: action.note },
          'spell',
        )
        if (env.cover === 'total') throw Error('实际物件被完全遮挡')
        env.attackerSees =
          sceneVision(
            world,
            a,
            current.scene,
            tokenPoint(caster.token!),
            tokenPoint(to),
            tokenM3State(world, a, caster.token!, cat),
          ).ray.clear &&
          sceneVision(
            world,
            a,
            current.scene,
            tokenPoint(caster.token!),
            tokenPoint(to),
            tokenM3State(world, a, caster.token!, cat),
          ).illuminated
        const saved = state.casts.find(
          (c) => c.castId === e.castId && c.action.operation === 'cast',
        )
        if (!saved || saved.action.operation !== 'cast') throw Error('原燃火来源缺失')
        const originalKey = saved.action.key,
          grant = caster.c
            ? runtimeSpells(caster.c, cat).find((g) => g.key === originalKey)
            : undefined,
          ability = caster.body?.abilities?.find((b) => b.id === originalKey),
          attr = grant?.ability ?? ability?.ability ?? caster.body?.spellcasting?.ability ?? 'wis'
        if (!grant && !ability) throw Error('原燃火法术来源已不可用')
        m3ActionCost(world, a, caster.id, 'action', cat, true)
        const live = m1Entity(world, a, caster.id)!,
          attacker = world.encounters
            .flatMap((e) => e.actors)
            .find((t) => (!!live.c && t.characterId === live.c.id) || t.id === live.actor?.id) ?? {
            id: live.id,
            characterId: live.c?.id ?? null,
            npc: live.body ?? null,
            side: 'party' as const,
            initiative: null,
            surprised: false,
            turn: freshTurn(),
          },
          body = customNpc(),
          target = {
            id: object.id,
            characterId: null,
            npc: { ...body, ac: durability.ac, hp: durability.hp, maxHp: durability.maxHp },
            side: 'neutral' as const,
            initiative: null,
            surprised: false,
            turn: freshTurn(),
          },
          stats = combatStats(attacker, world.characters, cat),
          level = live.c?.level ?? live.body?.spellcasting?.level ?? 1,
          mod = stats.mods[attr],
          diceCount = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1
        const spec = {
          id: saved.action.key,
          name: '燃火术',
          bonus: live.c
            ? mod + runtimeDerived(live.c, cat).pb - stats.exhaustion * 2
            : (live.body?.spellcasting?.attackBonus ?? mod + 2),
          ability: attr,
          modifier: 0,
          damage: diceCount + 'd8',
          type: 'fire' as const,
          ranged: true,
          reach: 0,
          range: 60,
          longRange: 60,
          weaponId: null,
          instanceId: null,
          properties: [],
          mastery: null,
          page: cat.spells.find((s) => s.id === 'produce-flame')!.source.page,
        }
        const roll = attackRoll(attacker, target, spec, env, world.characters, cat, dice),
          critical = roll.chosen === 20,
          hit =
            critical ||
            (roll.chosen !== 1 &&
              roll.total >=
                durability.ac +
                  (env.cover === 'half' ? 2 : env.cover === 'three-quarters' ? 5 : 0)),
          damage = hit ? rollDamage(spec.damage, dice, critical) : undefined,
          amount = damage?.total ?? 0,
          finalDamage =
            durability.fire === 'immune'
              ? 0
              : durability.fire === 'resistant'
                ? Math.floor(amount / 2)
                : durability.fire === 'vulnerable'
                  ? amount * 2
                  : amount
        durability.hp = Math.max(0, durability.hp - finalDamage)
        if (!durability.hp) object.enabled = false
        if (state.objectAttacks.length >= 5000) throw Error('物件攻击记录达到上限，请先归档')
        state.objectAttacks.push({
          id: crypto.randomUUID(),
          castId: e.castId,
          sourceId: caster.id,
          objectId: object.id,
          attackRolls: roll.dice,
          attackTotal: roll.total,
          hit,
          critical,
          damageRolls: damage?.dice ?? [],
          damageTotal: amount,
          finalDamage,
          remainingHP: durability.hp,
          atHour:
            world.characters.find((c) => c.id === e.clockSourceId)?.runtime?.hours ?? e.createdHour,
        })
        effectEvent(a, e, 'attack', '已结算真实物件攻击')
        detail = `燃火术对${object.name}：${hit ? '命中' : '未命中'}，火焰伤害${finalDamage}，物件剩余HP ${durability.hp}；手中火焰仍持续`
      } else {
        if (!battle) throw Error('敌对生物攻击须先开启实际战斗；物件可在有明确动作预算时操作')
        const actor = battle.actors.find(
            (x) =>
              (x.characterId === caster.c?.id && !!caster.c) ||
              x.id === caster.actor?.id ||
              (!!caster.n && x.npcId === caster.n.id),
          ),
          victim =
            target &&
            battle.actors.find(
              (x) =>
                (!!target.c && x.characterId === target.c.id) ||
                x.id === target.actor?.id ||
                (!!target.n && x.npcId === target.n.id),
            )
        if (
          target?.token &&
          !tokenPerception(world, a, current.scene, caster.token!, target.token, cat)
            .sameInteractionSpace
        )
          throw Error('燃火攻击不能跨空间影响生物')
        if (
          !actor ||
          !victim ||
          !target?.token ||
          distance(current.scene, caster.token!, target.token) > 60
        )
          throw Error(
            '燃火目标须是60尺内本场战斗实际目标；独立物件须先登记有AC／HP的物件战斗数据卡',
          )
        const saved = state.casts.find(
          (c) => c.castId === e.castId && c.action.operation === 'cast',
        )
        if (!saved || saved.action.operation !== 'cast') throw Error('原燃火来源记录缺失')
        const env = mapEnvironment(
          current.scene,
          caster.token!,
          target.token,
          { ...defaultEnvironment(), note: action.note },
          'spell',
        )
        env.attackerSees = tokenPerception(
          world,
          a,
          current.scene,
          caster.token!,
          target.token,
          cat,
        ).canSee
        env.targetSees = tokenPerception(
          world,
          a,
          current.scene,
          target.token,
          caster.token!,
          cat,
        ).canSee
        const result = applyCombat(
          battle,
          world.characters,
          cat,
          {
            type: 'scene-flame',
            actorId: actor.id,
            targetId: victim.id,
            key: saved.action.key,
            env,
          },
          dice,
        )
        world.encounters[world.encounters.indexOf(battle)] = result.encounter
        world.characters = result.characters
        detail = '燃火远程法术攻击已进入实际攻击窗口；手中火焰仍持续，未重复消耗法术资源'
      }
    }
  }
  reconcileWorld(world)
  reconcileM3World(world, cat, dice)
  reconcileSceneEffects(world)
  for (const event of state.events)
    if (!beforeEvents.has(event.id)) {
      const region = state.regions.find((e) => e.id === event.effectId)
      if (region)
        event.atHour =
          world.characters.find((c) => c.id === region.clockSourceId)?.runtime?.hours ??
          event.atHour
    }
  return { world, detail }
}
