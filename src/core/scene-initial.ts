import type { Adventure, MapWorld, MapScene } from './map-types'
import type { Catalogue } from './engine'
import { sceneEffects, M4_SCENE_SPELLS, tokenPoint } from './scene-effects'
import { sceneEffectSchema } from '../persistence/scene-effects-schema'
import { sceneMagicSchema } from '../persistence/scene-magic-schema'
import { MAGIC_RULES } from './scene-magic-rules'
import { TERRAIN_RULES } from './scene-terrain-rules'
import { supplyState, containerPlace } from './scene-supplies'
import { magicTouches } from './scene-magic'
import { configureMagicRegion } from './scene-magic-cast'
import { m3Caster } from './m3-world-cast'
import { m1Entity } from './m1-utility'
import type { InitialSceneEffects } from '../persistence/scene-initial-schema'
import { srd } from '../content/srd'
export function validateInitialScene(
  s: Pick<MapScene, 'id' | 'grid' | 'points' | 'spatialSetup'>,
  setup: InitialSceneEffects,
  npcIds: string[],
  profiles?: Pick<
    NonNullable<Adventure['ai']>['npcs'][number],
    'id' | 'consumables' | 'characterId'
  >[],
) {
  const objects = s.spatialSetup?.objects ?? []
  for (const c of setup.containers) {
    if (!objects.some((o) => o.id === c.objectId && o.enabled))
      throw Error('初始容器须引用启用的真实空间物件：' + c.name)
  }
  for (const m of setup.materials) {
    if (!npcIds.includes(m.npcId)) throw Error('初始材料须引用真实NPC库存')
    const n = profiles?.find((n) => n.id === m.npcId)
    if (profiles && (!n?.consumables?.some((c) => c.id === m.consumableId) || n.characterId))
      throw Error('初始材料须对应模板NPC真实消耗品；完整职业卡材料请开团后登记实际背包')
  }
  for (const e of setup.regions) {
    const spell = srd.spells?.find((sp) => sp.id === e.spellId),
      rule = MAGIC_RULES[e.spellId] ?? TERRAIN_RULES[e.spellId]
    if (spell && (e.slotLevel < spell.level || (spell.level === 0 && e.slotLevel !== 0)))
      throw Error('预置法术环级不符合实际规则')
    if (
      rule &&
      (e.geometry.shape !== rule.shape ||
        e.geometry.size !== rule.size ||
        e.geometry.heightFeet !==
          (e.spellId === 'web' && e.terrain?.webSupport === 'surface' ? 5 : rule.height))
    )
      throw Error('预置区域形状／尺寸须采用法术规则，不能用自定义大范围冒充标准法术')
    if (e.remainingHours && rule?.hours && e.remainingHours > rule.hours)
      throw Error('预置剩余期限不能超过标准法术上限')
    if (
      e.spellId === 'wind-wall' &&
      (!e.geometry.points ||
        e.geometry.points
          .slice(1)
          .reduce(
            (n, p, i) =>
              n +
              Math.hypot(
                (p.x - e.geometry.points![i]!.x) * s.grid.feet,
                (p.y - e.geometry.points![i]!.y) * s.grid.feet,
              ),
            0,
          ) > 50 ||
        e.geometry.width !== 1)
    )
      throw Error('预置风墙须为至多50尺连续路径、1尺厚')
    const object = e.objectId ? objects.find((o) => o.id === e.objectId) : undefined,
      point = e.pointId ? s.points.find((p) => p.id === e.pointId) : undefined
    if (
      object &&
      (e.geometry.x !== object.x ||
        e.geometry.y !== object.y ||
        e.geometry.height < object.height ||
        e.geometry.height > object.height + object.heightFeet)
    )
      throw Error('预置锚点须与真实物件位置／高度一致')
    if (point && (e.geometry.x !== point.x || e.geometry.y !== point.y))
      throw Error('预置门锁／装置须与所关联互动点重合')
    if (e.spellId === 'arcane-lock' && point && !['door', 'chest'].includes(point.kind))
      throw Error('秘法锁仅能预置在实际关闭门／容器')
    if (['create-or-destroy-water', 'create-food-and-water', 'knock'].includes(e.spellId))
      throw Error('瞬间法术结果请使用实际容器内容／门锁状态，不得伪装为活动区域')
    if (['alarm', 'magic-mouth', 'glyph-of-warding'].includes(e.spellId) && !e.magic?.trigger)
      throw Error('初始装置须有明确结构化触发条件')
    if (e.spellId === 'magic-mouth' && (!e.magic?.message || !e.magic.wordCountConfirmed))
      throw Error('魔嘴预置须有完整原文与25词确认')
    if (
      e.spellId === 'plant-growth' &&
      (!e.terrain?.plantCells.length || !e.terrain.supportIds.length)
    )
      throw Error('初始繁茂植物须明确实际植物及覆盖格')
    if (e.spellId === 'web' && !e.terrain?.webSupport) throw Error('初始蛛网须明确支撑条件')
    if (e.terrain?.supportIds.some((id) => !objects.some((o) => o.id === id && o.enabled)))
      throw Error('初始区域支撑／植物引用缺失')
    if (![...M4_SCENE_SPELLS, 'mundane-light'].includes(e.spellId))
      throw Error('初始区域法术不在M4已支持目录：' + e.spellId)
    if (e.geometry.x >= s.grid.columns || e.geometry.y >= s.grid.rows)
      throw Error('初始区域起点超出地图')
    if (
      (e.objectId && !objects.some((o) => o.id === e.objectId && o.enabled)) ||
      (e.pointId && !s.points.some((p) => p.id === e.pointId && p.enabled))
    )
      throw Error('初始区域引用的真实物件／互动点不存在')
    if (e.sourceNpcId && !npcIds.includes(e.sourceNpcId)) throw Error('初始区域来源NPC不存在')
    if (
      ['gust-of-wind', 'spirit-guardians', 'tiny-hut', 'conjure-animals'].includes(e.spellId) &&
      !e.sourceNpcId
    )
      throw Error('该初始区域需要真实NPC来源，不能捏造无主光环')
    if (['arcane-lock', 'knock'].includes(e.spellId) && !e.pointId)
      throw Error('初始门锁须关联真实门／容器')
    if (['magic-mouth', 'glyph-of-warding'].includes(e.spellId) && !e.objectId)
      throw Error('初始装置须关联真实物件')
    if (e.spellId === 'glyph-of-warding' && e.magic?.glyph === 'spell')
      throw Error('初始储法刻文须在开团后从真实已准备来源布设；不能在预置配置中捏造已支付配方')
    if (
      [
        'entangle',
        'grease',
        'web',
        'spike-growth',
        'sleet-storm',
        'stinking-cloud',
        'gust-of-wind',
        'wind-wall',
        'moonbeam',
        'spirit-guardians',
        'flaming-sphere',
        'call-lightning',
        'conjure-animals',
        'glyph-of-warding',
        'magic-circle',
      ].includes(e.spellId) &&
      !e.dc
    )
      throw Error('预置危险区域须由GM明确DC，不能生成未知施法数据')
    if (e.spellId === 'alarm' && e.magic?.alarm === 'mental' && !e.sourceNpcId)
      throw Error('预置心灵警报必须有实际施法来源')
    if (e.spellId === 'mundane-light' && !e.light) throw Error('初始普通光源须明确光照参数')
  }
}
export function initialiseSceneEffects(w: MapWorld, a: Adventure, cat: Catalogue) {
  const clock = w.characters.find((c) => a.party.includes(c.id) && c.runtime)
  if (!clock) return
  for (const s of a.scenes) {
    const setup = s.effectSetup
    if (!setup) continue
    validateInitialScene(
      s,
      {
        regions: setup.regions.filter((e) => !a.sceneEffects?.regions.some((r) => r.id === e.id)),
        containers: setup.containers.filter(
          (c) => !a.sceneEffects?.supplies?.containers.some((r) => r.id === c.id),
        ),
        materials: setup.materials.filter((m) => !a.sceneEffects?.initialised?.includes(m.id)),
      },
      a.ai?.npcs.map((n) => n.id) ?? [],
      a.ai?.npcs,
    )
    const state = sceneEffects(a),
      now = clock.runtime!.hours ?? 0
    for (const c of setup.containers) {
      if (state.supplies?.containers.some((x) => x.id === c.id)) continue
      const supply = supplyState(a)
      supply.containers.push({
        id: c.id,
        sceneId: s.id,
        objectId: c.objectId,
        name: c.name,
        open: c.open,
        waterCapacity: c.waterCapacity,
        foodCapacity: c.foodCapacity,
        hidden: c.hidden,
      })
      containerPlace(w, a, supply.containers.at(-1)!)
      for (const [kind, units] of [
        ['water', c.water],
        ['food', c.food],
      ] as const)
        if (units)
          supply.batches.push({
            id: crypto.randomUUID(),
            castId: c.id,
            clockSourceId: clock.id,
            sceneId: s.id,
            containerId: c.id,
            kind,
            units,
            createdHour: now,
            rotten: false,
            origin: 'scenario',
            appearance: kind === 'water' ? '原有水' : '原有食物',
            hidden: c.hidden,
          })
    }
    for (const material of setup.materials) {
      state.initialised ??= []
      if (state.initialised.includes(material.id)) continue
      if (
        state.materials.some(
          (m) => m.ownerId === material.npcId && m.instanceId === material.consumableId,
        )
      )
        continue
      const n = a.ai?.npcs.find((n) => n.id === material.npcId)
      if (!n?.consumables?.some((c) => c.id === material.consumableId && c.quantity > 0))
        throw Error('预置材料不存在对应实际NPC库存')
      state.materials.push({
        ownerId: n.id,
        instanceId: material.consumableId,
        kind: material.kind,
        valueGP: material.valueGP,
      })
      state.initialised.push(material.id)
    }
    for (const e of setup.regions) {
      if (state.regions.some((r) => r.id === e.id)) continue
      const rule = MAGIC_RULES[e.spellId],
        terrain = TERRAIN_RULES[e.spellId],
        source = e.sourceNpcId ? m1Entity(w, a, e.sourceNpcId) : undefined,
        m = e.magic
      if (e.sourceNpcId && (!source?.token || !s.tokens.includes(source.token))) continue
      const region = sceneEffectSchema.parse({
        id: e.id,
        castId: e.id,
        spellId: e.spellId,
        name: cat.spells.find((sp) => sp.id === e.spellId)?.name ?? '普通光源',
        sceneId: s.id,
        sourceId: source?.id ?? e.id,
        sourceKind: 'scenario',
        clockSourceId: clock.id,
        slotLevel: e.slotLevel,
        createdHour: now,
        endsAt:
          (e.remainingHours ?? rule?.hours ?? terrain?.hours)
            ? now + (e.remainingHours ?? rule?.hours ?? terrain!.hours!)
            : undefined,
        concentration: false,
        status: 'active',
        geometry: { ...e.geometry, ...(e.spellId === 'conjure-animals' ? { originSpan: 2 } : {}) },
        anchor: {
          kind: e.objectId
            ? 'object'
            : ['gust-of-wind', 'spirit-guardians'].includes(e.spellId)
              ? 'creature'
              : 'point',
          id: e.objectId ?? source?.id,
          offsetHeight: e.objectId
            ? e.geometry.height -
              (a.m3?.entities.find((o) => o.id === e.objectId)?.height ?? e.geometry.height)
            : 0,
        },
        hidden: e.hidden,
        covered: false,
        light:
          e.light ??
          ([
            'light',
            'produce-flame',
            'continual-flame',
            'daylight',
            'dancing-lights',
            'moonbeam',
            'flaming-sphere',
          ].includes(e.spellId)
            ? {
                bright: ['dancing-lights', 'moonbeam'].includes(e.spellId)
                  ? 0
                  : e.spellId === 'daylight'
                    ? 60
                    : 20,
                dimExtra:
                  e.spellId === 'daylight'
                    ? 60
                    : e.spellId === 'dancing-lights'
                      ? 10
                      : e.spellId === 'moonbeam'
                        ? 5
                        : 20,
                magical: true,
                sunlight: e.spellId === 'daylight',
                flame: e.spellId === 'flaming-sphere',
                color: '#dabb77',
              }
            : undefined),
        obscurity: ['darkness'].includes(e.spellId)
          ? 'magical-darkness'
          : e.spellId === 'hunger-of-hadar'
            ? 'absolute-darkness'
            : ['fog-cloud', 'stinking-cloud', 'sleet-storm'].includes(e.spellId)
              ? 'heavy'
              : e.spellId === 'web'
                ? 'light'
                : 'none',
        channels: [],
        requiresGeometry: false,
        note: '剧本预置GM事实（非玩家施法／非资源支付凭证）：' + e.note,
        ...(rule
          ? {
              magic: sceneMagicSchema.parse({
                dc: e.dc ?? 10,
                createdTurn: 'scenario-initial',
                angle: m?.angle ?? e.geometry.angle,
                excludedIds: m?.excludedIds ?? [],
                allowedIds: m?.excludedIds ?? [],
                ammunition: e.spellId === 'cordon-of-arrows' ? (e.slotLevel >= 3 ? 6 : 4) : 0,
                pointId: e.pointId,
                damageType:
                  m?.damageType ?? (e.spellId === 'glyph-of-warding' ? 'fire' : 'radiant'),
                storm: m?.storm ?? false,
                password: m?.password ?? '',
                alarm: m?.alarm ?? 'audible',
                trigger: m?.trigger,
                message: m?.message ?? '',
                repeat: m?.repeat ?? false,
                glyph: m?.glyph ?? 'explosive',
                origin: { x: e.geometry.x + 0.5, y: e.geometry.y + 0.5, height: e.geometry.height },
                types: m?.types ?? [],
                reverse: m?.reverse ?? false,
                hutLight: m?.hutLight ?? 'dim',
              }),
            }
          : {}),
        ...(terrain
          ? {
              terrain: {
                dc: e.dc ?? 10,
                multiplier: terrain.multiplier,
                groundOnly: terrain.ground,
                plantCells: e.terrain?.plantCells ?? [],
                excludedCells: e.terrain?.excludedCells ?? [],
                knownTo: [],
                supportIds: e.terrain?.supportIds ?? [],
                webSupport: e.terrain?.webSupport,
                createdTurn: 'scenario-initial',
                burns: [],
                enrichment: false,
                travel: [],
              },
            }
          : {}),
      })
      if (e.spellId === 'tiny-hut' && source) {
        configureMagicRegion(
          w,
          a,
          s,
          m3Caster(w, a, source.id, cat),
          {
            operation: 'cast',
            casterId: source.id,
            key: 'scenario-initial',
            mode: 'npc',
            points: [],
            combined: false,
            color: '#b39b78',
            confirmed: true,
            note: e.note,
            magic: e.magic,
          },
          region,
          cat,
        )
        region.concentration = false
      }

      state.regions.push(region)
    }
  }
}
