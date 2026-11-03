import {initialiseSceneEffects,validateInitialScene} from './scene-initial'
import { validateExploration } from './enclosed-exploration'
import {remapSocialOperations} from './practical-social-refs'
import {initialiseM3Scenes} from './m3-initial'
import {initialSpatialObjectSchema} from '../persistence/m3-initial-schema'
import { assertCalibrationReady } from './scene-art-state'
import { validateGrowthGuide } from './script-design'
import { validateQuests } from './quests'
import { missingNpcTokens } from './npc-token-repair'
import { validatePortals } from './map-portals'
import { validateNarrationSkills } from './narration-skills'
import { initialNpcState } from './npc-abilities'
import {
  scriptSchema,
  scriptNpcSchema,
  scriptSceneSchema,
  scriptAssetSchema,
  initialCharacterStateSchema,
  type ScriptDefinition,
  type ScriptAsset,
} from '../persistence/script-schema'
import { validateAsset } from '../persistence/map-schema'
import { packSchema } from '../persistence/schema'
import { clone, catalogue, validate } from './engine'
import { runtimeState, validateInventory, validateRuntimeArchive } from './runtime'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { isBuiltinPack } from '../content/builtin-ids'
import { newAdventure, validateAdventure, inside, occupied, position } from './map'
import { validateWalls } from './map-spatial'
import { rollDamage } from './combat-rules'
import { defaultAiSettings } from './ai'
import { newBroadcastSettings, validateBroadcasts } from './broadcast'
import type { MapWorld, MapAsset, MapScene, Adventure, MapToken } from './map-types'
import type { Character, Pack } from './types'
import { SKILLS } from './types'
import type { NpcProfile } from './ai-types'

export const roleReference = (id: string) => 'role:' + id
const uuid = () => crypto.randomUUID()
const requireRef = (ok: boolean, label: string) => {
  if (!ok) throw Error(label)
}
const unique = (ids: string[], label: string) =>
  requireRef(new Set(ids).size === ids.length, label + ' ID 重复')
export const scriptAssetMeta = (a: MapAsset): ScriptAsset => ({
  id: a.id,
  name: a.name,
  mime: a.mime,
  width: a.width,
  height: a.height,
  bytes: a.blob.size,
  ...(a.preview
    ? {
        preview: {
          mime: a.preview.mime,
          width: a.preview.width,
          height: a.preview.height,
          bytes: a.preview.blob.size,
        },
      }
    : {}),
})

export function newScript(name = '新的剧本'): ScriptDefinition {
  const a = newAdventure(name,'enclosed'),
    { encounterId: _e, template: _t, ...scene } = a.scenes[0]!
  return scriptSchema.parse({
    format: 'trpg-script',
    version: 1,
    metadata: {
      name,
      author: '',
      description: '',
      authorVersion: 'v.01',
      ruleset: 'DND2024',
      levels: { min: 1, max: 5 },
      players: { min: 1, max: 6 },
      startSceneId: scene.id,
      landing: { x: 0, y: 0 },
    },
    dependencies: BUILTIN_PACKS.map((p) => ({ id: p.id, version: p.version })),
    roles: [],
    scenes: [scene],
    npcs: [],
    characters: [],
    npcTemplates: [],
    ai: defaultAiSettings(),
    battles: [],
    broadcasts: [],
    packs: [],
    assets: [],
  })
}

/** Structural checks always run, even when rules are not yet installed. */
export function inspectScript(input: unknown, installed: Pack[] = BUILTIN_PACKS) {
  const s = scriptSchema.parse(input)
  validateGrowthGuide(
    s.growthGuide,
    s.scenes.map((x) => x.id),
    (s.quests ?? []).map((q) => q.id),
  )
  validateQuests(
    { quests: s.quests, scenes: s.scenes as MapScene[] },
    [...s.characters.map((c) => c.id), ...s.roles.map((r) => roleReference(r.id))],
    s.npcs.map((n) => n.id),
  )
  for (const scene of s.scenes) {
    validateExploration(scene)
    scene.tokens.push(...missingNpcTokens(scene, s.npcs))
    scriptSceneSchema.parse(scene)
  }
  unique(
    s.scenes.map((x) => x.id),
    '场景',
  )
  unique(
    s.npcs.map((x) => x.id),
    'NPC',
  )
  unique(
    s.characters.map((x) => x.id),
    'NPC 角色',
  )
  unique(
    s.roles.map((x) => x.id),
    '角色位',
  )
  unique(
    s.npcs.flatMap((n) => (n.characterId ? [n.characterId] : [])),
    'NPC 专用角色关联',
  )
  unique(
    s.assets.map((x) => x.id),
    '图片',
  )
  unique(
    s.packs.map((x) => x.id),
    '规则包',
  )
  unique(
    s.dependencies.map((x) => x.id),
    '规则依赖',
  )
  validateNarrationSkills(
    s.ai,
    s.scenes.map((scene) => scene.id),
  )
  validatePortals({ scenes: s.scenes as MapScene[] })
  unique(
    s.npcTemplates.map((x) => x.id),
    'NPC 模板',
  )
  unique(
    s.battles.map((x) => x.id),
    '战斗预设',
  )
  unique(
    s.broadcasts.map((x) => x.id),
    '广播',
  )
  requireRef(
    s.packs.every((p) => !isBuiltinPack(p.id) && !['custom', 'local-custom'].includes(p.id)),
    '扩展包不能替换内置规则',
  )
  requireRef(
    s.characters.every((c) => !c.id.startsWith('role:')),
    'NPC 角色 ID 不能使用角色位前缀',
  )
  const chars = new Set(s.characters.map((c) => c.id)),
    roles = new Set(s.roles.map((r) => roleReference(r.id)))
  const characterRef = (id: string) => chars.has(id) || roles.has(id)
  requireRef(!s.openingPresentation?.identities.some(i=>!characterRef(i.characterId)), '开场身份引用缺失')
  for (const c of s.characters) {
    requireRef(
      s.npcs.some((n) => n.characterId === c.id),
      '剧本包含未关联 NPC 的角色',
    )
    unique(
      c.inventory.map((i) => i.instanceId),
      '背包物品',
    )
    unique(
      c.initialConsumableDurations.map((d) => d.instanceId),
      '初始物品时限',
    )
    for (const d of c.initialConsumableDurations)
      requireRef(
        c.inventory.some((i) => i.instanceId === d.instanceId && !!i.consumable),
        '初始时限引用的消耗品不存在',
      )
    for (const i of c.inventory) {
      requireRef(!i.spellEnchantments?.length,'创作初始物品不得带运行中的法术附魔实例')
      requireRef(
        !i.craftedBy && i.craftedAt === undefined && i.consumable?.expiresAt === undefined,
        '初始物品不能携带旧团制作人或过期时间',
      )
      requireRef(
        !i.containerId || c.inventory.some((t) => t.instanceId === i.containerId),
        '背包容器引用缺失',
      )
    }
    for (const p of c.packs)
      requireRef(
        s.dependencies.some((d) => d.id === p.id && d.version === p.version),
        'NPC 规则依赖未声明：' + p.id,
      )
  }
  const start = s.scenes.find((x) => x.id === s.metadata.startSceneId)
  requireRef(!!start && inside(start as MapScene, s.metadata.landing), '起始场景或入场位置无效')
  for (const scene of s.scenes) {
    validateWalls({ ...scene, encounterId: null, template: null } as MapScene)
    for (const [name, rows] of Object.entries({
      棋子: scene.tokens,
      互动点: scene.points,
      区域: scene.regions,
      门墙: scene.walls,
      标注: scene.annotations,
    }))
      unique(
        rows.map((x) => x.id),
        scene.name + name,
      )
    requireRef(
      !scene.background || s.assets.some((a) => a.id === scene.background!.assetId),
      '背景图片引用缺失',
    )
    for (const t of scene.tokens) {
      requireRef(
        occupied(t).every((p) => inside(scene as MapScene, p)),
        '棋子占格超出地图',
      )
      requireRef(!t.characterId || chars.has(t.characterId), '剧本棋子只能关联 NPC 角色')
      requireRef(
        !t.npcId || s.npcs.some((n) => n.id === t.npcId && n.sceneId === scene.id),
        '棋子的 NPC 引用缺失',
      )
      if (t.npcId)
        requireRef(
          s.npcs.find((n) => n.id === t.npcId)!.hidden === t.hidden,
          'NPC 与棋子隐藏设置不一致',
        )
      requireRef(!!(t.characterId || t.npcId || t.npcBody), '棋子没有 NPC 或初始战斗数据')
    }
    for (const g of scene.arrivalGroups ?? []) {
      requireRef(
        g.npcIds.every((id) =>
          s.npcs.some((n) => n.id === id && n.sceneId === scene.id && n.initiallyAbsent),
        ),
        '出场组NPC引用缺失',
      )
    }
    for (const p of scene.points) {
      if(p.itemUse){
        const items=catalogue([...installed,...s.packs]).items
        requireRef(!p.consume,'物品条件不能同时包含旧消耗')
        requireRef(p.itemUse.effect!=='open'||['door','chest'].includes(p.kind),'直接打开仅适用门或容器')
        requireRef(p.itemUse.fallback!=='check'||!!p.check,'备用检定缺少检定配置')
        for(const r of p.itemUse.requirements)requireRef(items.some(i=>i.id===r.itemId&&i.kind!=='pack'),'互动条件物品引用缺失：'+r.itemId)
      }
      requireRef(
        ![...(p.arrivalGroupIds??[]),...(p.failureArrivalGroupIds??[])].some((id) => !scene.arrivalGroups?.some((g) => g.id === id)),
        '出场组引用缺失',
      )
      requireRef(
        !p.storyResults?.some((r) => !s.npcs.some((n) => n.id === r.npcId)),
        '剧情结果 NPC 引用缺失',
      )
      requireRef(inside(scene as MapScene, p), '互动点超出地图')
      requireRef(
        !p.check ||
          (p.check.kind === 'skill'
            ? Object.hasOwn(SKILLS, p.check.id)
            : ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(p.check.id)),
        '互动判定引用未知技能或属性',
      )
      requireRef(
        !p.targetSceneId || s.scenes.some((x) => x.id === p.targetSceneId),
        '出口场景引用缺失',
      )
      if (p.targetSceneId)
        requireRef(
          inside(s.scenes.find((x) => x.id === p.targetSceneId)! as MapScene, p.landing),
          '出口入场位置超出目标地图',
        )
      requireRef(
        !p.battlePresetId ||
          s.battles.some((b) => b.id === p.battlePresetId && b.sceneId === scene.id),
        '互动点战斗预设引用缺失',
      )
    }
    for (const region of scene.regions) {
      unique(region.cells, '区域格')
      requireRef(
        region.cells.every((c) => inside(scene as MapScene, position(c))),
        '区域格超出地图',
      )
    }
    const heights = new Map<string, number>()
    for (const region of scene.regions)
      if (region.height !== null)
        for (const cell of region.cells) {
          requireRef(!heights.has(cell) || heights.get(cell) === region.height, '重叠区域高度冲突')
          heights.set(cell, region.height)
        }
    for (const annotation of scene.annotations)
      requireRef(inside(scene as MapScene, annotation), '标注超出地图')
    for (const wall of scene.walls)
      requireRef(
        !wall.pointId || scene.points.some((p) => p.id === wall.pointId),
        '门墙互动点引用缺失',
      )
  }
  for(const f of s.knowledgeDesign?.factions??[])for(const p of f.policies??[])requireRef(s.scenes.some(scene=>scene.id===p.sceneId&&scene.points.some(point=>point.id===p.pointId)),'声望策略场景／互动点引用缺失')
  for (const n of s.npcs) {
    const objects=s.scenes.find(scene=>scene.id===n.sceneId)?.spatialSetup?.objects??[]
    for(const gear of n.body?.equipment??[]){
      requireRef(objects.some(o=>o.id===gear.objectId&&o.enabled),'NPC初始装备缺少本场景实际物件：'+n.name)
      requireRef(gear.attackIds.length>0&&gear.attackIds.every(id=>n.body!.attacks.some(at=>at.id===id&&!at.unarmed&&at.kind!=='spell')),'NPC初始装备须关联实际武器攻击：'+n.name)
      requireRef(catalogue([...BUILTIN_PACKS,...s.packs]).items.some(i=>i.id===gear.itemId&&i.kind==='weapon'),'NPC初始装备规则武器引用缺失：'+n.name)
    }
    requireRef(
      s.scenes.some((x) => x.id === n.sceneId),
      'NPC 场景引用缺失',
    )
    requireRef(
      inside(s.scenes.find((x) => x.id === n.sceneId)! as MapScene, n.position),
      'NPC 位置超出地图',
    )
    requireRef(!(n.npcType === 'ordinary' && n.followParty), '普通 NPC 不能跟随队伍')
    requireRef(
      !(n.npcType === 'important' && n.turnMode === 'automatic') &&
        !(n.npcType === 'ordinary' && n.turnMode === 'plan'),
      'NPC 回合方式与类型不匹配',
    )
    requireRef(!n.characterId || n.npcType === 'important', '普通 NPC 不使用完整角色卡')
    requireRef(!n.characterId || chars.has(n.characterId), 'NPC 专用角色引用缺失')
    requireRef(
      !n.guardOrigin || s.scenes.some((x) => x.id === n.guardOrigin!.sceneId),
      'NPC 守卫场景引用缺失',
    )
    if (n.guardOrigin)
      requireRef(
        inside(s.scenes.find((x) => x.id === n.guardOrigin!.sceneId)! as MapScene, n.guardOrigin),
        'NPC 守卫位置超出地图',
      )
    unique(
      n.secrets.map((f) => f.id),
      'NPC 秘密',
    )
    unique(
      n.dialogue.map((d) => d.id),
      'NPC 台词',
    )
    unique(
      n.abilities.map((d) => d.id),
      'NPC 能力',
    )
    unique(
      n.stock.map((d) => d.id??d.itemId),
      'NPC 库存',
    )
    requireRef(
      !n.combatPolicy.protectCharacterId || characterRef(n.combatPolicy.protectCharacterId),
      'NPC 保护目标引用缺失',
    )
    requireRef(
      (n.initialMemories ?? []).every((m) => !m.characterId || characterRef(m.characterId)) &&
        (n.initialRelations ?? []).every((r) => characterRef(r.characterId)),
      'NPC 初始记忆／关系角色引用缺失',
    )
    requireRef(
      n.activity.scope === 'party' || n.activity.characterIds.every(characterRef),
      'NPC 活动角色引用缺失',
    )
    for (const t of n.activity.templates ?? []) {
      requireRef(
        !t.sceneId || s.scenes.some((scene) => scene.id === t.sceneId),
        'NPC 回应场景引用缺失',
      )
      requireRef(
        !t.pointId ||
          s.scenes.some(
            (scene) =>
              (!t.sceneId || scene.id === t.sceneId) &&
              scene.points.some((p) => p.id === t.pointId),
          ),
        'NPC 回应互动点引用缺失',
      )
    }
    requireRef(
      n.preauthorization.revealIds.every((id) => n.secrets.some((f) => f.id === id)),
      'NPC 预授权秘密引用缺失',
    )
    requireRef((n.practicalSocial?.rules??[]).every(r=>[...r.success.revealIds,...r.failure.revealIds].every(id=>n.secrets.some(s=>s.id===id))),'NPC交涉结果线索引用缺失')
    for(const r of n.practicalSocial?.rules??[])for(const op of [...r.success.operations??[],...r.failure.operations??[]]){if(op.kind==='interaction')requireRef(!!s.scenes.find(sc=>sc.id===n.sceneId)?.points.some(p=>p.id===op.pointId),'NPC交涉互动后果引用缺失');if(op.kind==='battle-support')requireRef(s.battles.some(p=>p.id===op.presetId&&p.sceneId===n.sceneId),'NPC交涉战斗后果引用缺失')}
    requireRef((n.spatialPolicy?.practical?.pointIds??[]).every(id=>s.scenes.find(scene=>scene.id===n.sceneId)?.points.some(p=>p.id===id)),'NPC自动互动点引用缺失')
  }
  for (const body of [
    ...s.npcs.flatMap((n) => (n.body ? [n.body] : [])),
    ...s.npcTemplates.map((t) => t.body),
    ...s.scenes.flatMap((scene) => scene.tokens.flatMap((t) => (t.npcBody ? [t.npcBody] : []))),
  ]) {
    unique(
      body.attacks.map((a) => a.id),
      'NPC 攻击',
    )
    requireRef(
      (body.multiattack ?? []).every((id) => body.attacks.some((a) => a.id === id)),
      '多重攻击引用缺失',
    )
    for (const attack of body.attacks) {
      rollDamage(attack.damage, () => 1)
      for (const part of attack.extraDamage ?? []) rollDamage(part.formula, () => 1)
    }
  }
  for (const b of s.battles) {
    const scene = s.scenes.find((x) => x.id === b.sceneId)
    requireRef(!!scene, '战斗预设场景缺失')
    unique(
      b.participants.map((p) => p.kind + ':' + p.id),
      '战斗预设参与者',
    )
    for (const p of b.participants)
      requireRef(
        p.kind === 'character'
          ? characterRef(p.id)
          : p.kind === 'npc'
            ? s.npcs.some((n) => n.id === p.id && n.sceneId === b.sceneId)
            : scene!.tokens.some((t) => t.id === p.id),
        '战斗预设参与者引用缺失',
      )
  }
  for (const b of s.broadcasts) {
    const scene = s.scenes.find((x) => x.id === b.sceneId)
    requireRef(!b.sceneId || !!scene, '广播场景引用缺失')
    requireRef(
      !['point', 'wall', 'region', 'scene'].includes(b.trigger) || !!scene,
      '广播需要有效场景',
    )
    if (
      b.trigger === 'point' ||
      (b.trigger === 'event' && b.eventType === 'point.result' && b.targetId)
    )
      requireRef(
        scene!.points.some((p) => p.id === b.targetId),
        '广播互动点引用缺失',
      )
    if (b.trigger === 'wall')
      requireRef(
        scene!.walls.some((p) => p.id === b.targetId && p.kind === 'door'),
        '广播门引用缺失',
      )
    if (b.trigger === 'region')
      requireRef(
        scene!.regions.some((p) => p.id === b.targetId),
        '广播区域引用缺失',
      )
    requireRef(b.trigger !== 'event' || !!b.eventType, '事件广播缺少事件类型')
    requireRef(b.audience.characterIds.every(characterRef), '广播接收角色引用缺失')
    if (b.audience.kind === 'party')
      requireRef(
        b.audience.characterIds.every((id) => roles.has(id)),
        '队伍广播不能包含 NPC 角色',
      )
    if (['public', 'gm'].includes(b.audience.kind))
      requireRef(!b.audience.characterIds.length, '公开或 GM 广播不能包含角色绑定')
  }
  const available = [...installed, ...s.packs]
  const missingDependencies = s.dependencies.filter(
    (d) => !available.some((p) => p.id === d.id && p.version === d.version),
  )
  if (!missingDependencies.length) {
    const world = buildInstance(s, {}, [], true).world,
      cat = catalogue(available)
    for (const c of world.characters) {
      requireRef(
        validate(c.build, cat, { existingCharacter: true }).length === 0,
        'NPC 角色构筑不符合规则',
      )
      validateInventory(c, cat)
      validateRuntimeArchive(c, cat)
    }
    for(const scene of world.adventures[0]!.scenes)if(scene.effectSetup)validateInitialScene(scene,scene.effectSetup,world.adventures[0]!.ai?.npcs.map(n=>n.id)??[],world.adventures[0]!.ai?.npcs)
    validateAdventure(world.adventures[0]!, world, cat)
    validateBroadcasts(world.adventures[0]!, world)
  }
  return {
    definition: s,
    missingDependencies,
    ready: !missingDependencies.length && !s.scenes.some((scene) => scene.artCalibration),
  }
}

/** Current initial values must be explicitly acknowledged; consumed loot cannot be reconstructed. */
export function extractScript(
  world: MapWorld,
  assets: MapAsset[],
  adventureId: string,
  confirmedCurrentInitialState = false,
): ScriptDefinition {
  requireRef(confirmedCurrentInitialState, '请明确确认当前门锁、战利品和 NPC 状态作为剧本初始值')
  const a = world.adventures.find((x) => x.id === adventureId)
  requireRef(!!a, '冒险不存在')
  const script = newScript(a!.name),
    npcs = clone(a!.ai?.npcs ?? []),
    npcChars = new Set(npcs.flatMap((n) => (n.characterId ? [n.characterId] : [])))
  for (const n of npcs)
    if (n.initiallyAbsent && n.arrivalOrigin) {
      n.sceneId = n.arrivalOrigin.sceneId
      n.position = { x: n.arrivalOrigin.x, y: n.arrivalOrigin.y }
    }
  for (const n of npcs)
    n.hidden ||= a!.scenes.some((scene) => scene.tokens.some((t) => t.npcId === n.id && t.hidden))
  const roleIds = new Map<string, string>()
  const ref = (id: string) => {
    if (npcChars.has(id)) return id
    const c = world.characters.find((x) => x.id === id)
    requireRef(!!c && c.purpose !== 'npc' && !c.npcOwnerId, '玩家绑定目标角色不存在')
    if (!roleIds.has(id)) {
      const r = uuid()
      roleIds.set(id, r)
      script.roles.push({ id: r, name: c!.build.name || '玩家角色位', required: true })
    }
    return roleReference(roleIds.get(id)!)
  }
  script.npcs = npcs.map((n) => {
    const {
      fixedReplyCursor: _fixedReplyCursor,
      consumablesUsed: _consumablesUsed,
      actorId: _actor,
      revision: _rev,
      turnHold: _hold,
      arrivalOrigin: _arrivalOrigin,
      appeared: _appeared,
      experiences: _experiences,
      experienceOmitted: _omitted,
      relations: _relations,
      memory: _memory,
      revealedIds: _reveal,
      urgingCooldowns: _urge,
      behaviorState: _behavior,
      body,
      preauthorization,
      ...config
    } = n
    const liveBody =
      world.encounters.flatMap((e) => e.actors).find((actor) => actor.id === n.actorId)?.npc ?? body
    const { effects: _effects, ...initialBody } = liveBody
      ? initialNpcState(liveBody)
      : { effects: [] }
    const {
      characterIds: _ids,
      remaining: _remaining,
      expiresAt: _expires,
      ...authorization
    } = preauthorization
    config.combatPolicy.protectCharacterId = config.combatPolicy.protectCharacterId
      ? ref(config.combatPolicy.protectCharacterId)
      : null
    config.initialMemories = config.initialMemories?.map((m) => ({
      ...m,
      characterId: m.characterId ? ref(m.characterId) : null,
    }))
    config.initialRelations = config.initialRelations?.map((r) => ({
      ...r,
      characterId: ref(r.characterId),
    }))
    config.activity.characterIds =
      config.activity.scope === 'party' ? [] : config.activity.characterIds.map(ref)
    return scriptNpcSchema.parse({
      ...config,
      stock:config.stock.map(row=>({...clone(row),inventoryState:row.inventoryState?{...clone(row.inventoryState),source:'剧本初始商店',note:'',craftedBy:undefined,craftedAt:undefined,consumable:undefined,spellEnchantments:undefined}:undefined})),
      body: liveBody ? initialBody : null,
      preauthorization: authorization,
    })
  })
  script.characters = [...npcChars].map((id) => {
    const c = clone(world.characters.find((x) => x.id === id))
    requireRef(!!c && c.status === 'complete', 'NPC 专用角色不存在或未完成')
    const {
      revision: _rev,
      createdAt: _created,
      updatedAt: _updated,
      journal: _journal,
      runtime,
      purpose: _purpose,
      npcOwnerId: _owner,
      status: _status,
      ...config
    } = c!
    const initialConsumableDurations: ScriptDefinition['characters'][number]['initialConsumableDurations'] =
      []
    for (const row of config.inventory) {
      delete row.spellEnchantments
      delete row.craftedBy
      delete row.craftedAt
      if (row.consumable) {
        if (row.consumable.expiresAt !== undefined)
          initialConsumableDurations.push({
            instanceId: row.instanceId,
            hours: Math.max(0, row.consumable.expiresAt - (runtime?.hours ?? 0)),
          })
        delete row.consumable.expiresAt
      }
    }
    const initial = runtime
      ? Object.fromEntries(
          Object.keys(initialCharacterStateSchema.shape)
            .filter((k) => Object.hasOwn(runtime, k))
            .map((k) => [k, runtime[k as keyof typeof runtime]]),
        )
      : {}
    return { ...config, initial, initialConsumableDurations }
  })
  script.scenes = a!.scenes.map((scene) => {
    const {
      encounterId,
      template: _template,
      defeatedTokens: _retired,
      linkRuns: _links,
      discoveryAttempts: _discovery,
      pausedRoutes: _routes,
      tokens,
      ...config
    } = clone(scene)
    const encounter = world.encounters.find((e) => e.id === encounterId)
    // Export was explicitly confirmed as current initial state. Copy physical gear
    // facts only; never live enchantments, receipts, HP or private cast metadata.
    const gearIds=new Set(script.npcs.filter(n=>n.sceneId===scene.id).flatMap(n=>n.body?.equipment?.map(g=>g.objectId)??[]))
    if(gearIds.size){
      const environment=a!.m3?.environments.find(e=>e.sceneId===scene.id)
      requireRef(!!config.spatialSetup||!!environment,'导出NPC装备前请登记场景实际地面和室内／室外环境')
      config.spatialSetup??={floorHeight:environment!.floorHeight,openSky:environment!.openSky,ceilingHeight:environment!.ceilingHeight,objects:[]}
      for(const id of gearIds){
        const object=a!.m3?.entities.find(o=>o.id===id&&o.sceneId===scene.id&&o.enabled)
        requireRef(!!object,'导出NPC装备缺少实际物件：'+id)
        const clean=initialSpatialObjectSchema.parse(Object.fromEntries(Object.keys(initialSpatialObjectSchema.shape).filter(k=>Object.hasOwn(object!,k)).map(k=>[k,object![k as keyof typeof object]])))
        config.spatialSetup.objects=config.spatialSetup.objects.filter(o=>o.id!==id);config.spatialSetup.objects.push(clean)
      }
    }
    return scriptSceneSchema.parse({
      ...config,
      arrivalGroups: config.arrivalGroups?.map(
        ({ status, reason, requestId, sourceEventId, ...g }) => g,
      ),
      groundItems: config.groundItems?.map((g) => ({ ...g, inventoryState:undefined, quantity: g.initialQuantity })),
      tokens: tokens
        .filter((t) => !npcs.some((n) => n.id === t.npcId && n.initiallyAbsent))
        .filter((t) => !t.companionKey && (!t.characterId || npcChars.has(t.characterId)))
        .map((t) => {
          const {
            actorId,
            npcSourceActorId: _source,
            companionKey: _companion,
            groundTrail: _groundTrail,
            npcBody,spatial:_spatial,baseSpan:_baseSpan,effectiveSize:_effectiveSize,
            ...token
          } = t
          const body = npcBody ?? encounter?.actors.find((actor) => actor.id === actorId)?.npc
          const { effects: _effects, ...initialBody } = body
            ? initialNpcState(body)
            : { effects: [] }
          return {
            ...token,
            spatial:{height:token.initialSpatialHeight??0,layer:'material',...(token.initialSupportId?{supportId:token.initialSupportId}:{})},
            ...(token.npcId
              ? { hidden: npcs.find((n) => n.id === token.npcId)?.hidden ?? token.hidden }
              : {}),
            ...(body ? { npcBody: initialBody } : {}),
          }
        }),
    })
  })
  script.battles = clone(a!.battles?.presets ?? []).map((b) => ({
    ...b,
    participants: b.participants.map((p) => (p.kind === 'character' ? { ...p, id: ref(p.id) } : p)),
  }))
  script.metadata.contentLocale = a!.contentLocale
  script.designNotebook = a!.designNotebook ? clone(a!.designNotebook) : undefined
  script.openingPresentation = a!.openingPresentation ? {...clone(a!.openingPresentation),identities:a!.openingPresentation.identities.map(i=>({...i,characterId:ref(i.characterId)}))} : undefined
  script.growthGuide = a!.growthGuide ? clone(a!.growthGuide) : undefined
  script.quests = (a!.quests ?? []).map(
    ({ status: _status, stepSuggestions: _suggestions, ...q }) => ({
      ...clone(q),
      steps: q.steps?.map(({ status: _stepStatus, ...step }) => clone(step)),
      characterIds: q.characterIds.map(ref),
    }),
  )
  script.broadcasts = clone(a!.broadcast?.templates ?? []).map((b) => ({
    ...b,
    audience: { ...b.audience, characterIds: b.audience.characterIds.map(ref) },
  }))
  script.ai = clone(a!.ai?.settings ?? defaultAiSettings())
  script.knowledgeDesign=a!.ai?.knowledgeDesign?clone(a!.ai.knowledgeDesign):undefined
  if (script.ai.qqDialogueReview)
    script.ai.qqDialogueReview = {
      ...script.ai.qqDialogueReview,
      enabled: false,
      paused: false,
      revision: 0,
    }
  script.npcTemplates = clone(a!.ai?.templates ?? []).map((t) => {
    const { effects: _effects, ...body } = t.body
    return { ...t, body }
  })
  script.packs = clone(world.packs)
    .filter((p) => !isBuiltinPack(p.id))
    .map((p) => packSchema.parse(p))
  script.dependencies = [...BUILTIN_PACKS, ...script.packs].map((p) => ({
    id: p.id,
    version: p.version,
  }))
  const refs = new Set(script.scenes.flatMap((s) => (s.background ? [s.background.assetId] : [])))
  script.assets = assets.filter((a) => refs.has(a.id)).map(scriptAssetMeta)
  script.metadata.startSceneId = script.scenes[0]!.id
  return inspectScript(script).definition
}

function buildInstance(
  s: ScriptDefinition,
  bindings: Record<string, string>,
  players: Character[],
  inspection = false,
) {
  const ids = new Map<string, string>(),
    map = (key: string) => {
      if (!ids.has(key)) ids.set(key, uuid())
      return ids.get(key)!
    }
  const sceneId = (id: string) => map('scene:' + id)
  const nested = (scene: string, kind: string, id: string) => map(scene + ':' + kind + ':' + id)
  const npcBody=(body:NonNullable<ScriptDefinition['npcs'][number]['body']>,scene:string)=>({...clone(body),effects:[],equipment:body.equipment?.map(g=>({...clone(g),id:map('npc-weapon:'+g.id),objectId:nested(scene,'spatial-object',g.objectId)}))})
  const disabled: { kind: string; id: string; reason: string }[] = []
  const characterRef = (id: string): string | null =>
    id.startsWith('role:') ? (bindings[id.slice(5)] ?? null) : map('character:' + id)
  const missing = (refs: (string | null)[]) =>
    refs.some((id) => !!id && id.startsWith('role:') && !bindings[id.slice(5)])
  const cat = catalogue([...BUILTIN_PACKS, ...s.packs]),
    at = new Date().toISOString()
  const characters: Character[] = s.characters.map((c) => {
    const { initial, initialConsumableDurations, ...config } = clone(c)
    const local = new Map(config.inventory.map((i) => [i.instanceId, uuid()]))
    for (const row of config.inventory) {
      const duration = initialConsumableDurations.find((d) => d.instanceId === row.instanceId)
      if (duration && row.consumable) row.consumable.expiresAt = duration.hours
      row.instanceId = local.get(row.instanceId)!
      if (row.containerId) row.containerId = local.get(row.containerId)!
    }
    const result: Character = {
      ...config,
      id: characterRef(c.id)!,
      npcOwnerId: map('npc:' + s.npcs.find((n) => n.characterId === c.id)!.id),
      purpose: 'npc',
      revision: 0,
      status: 'complete',
      createdAt: at,
      updatedAt: at,
      journal: [],
      runtime: null,
    }
    result.runtime = {
      ...runtimeState(result, cat),
      ...initial,
      resources: { ...runtimeState(result, cat).resources, ...initial.resources },
    }
    return result
  })
  const scenes: MapScene[] = s.scenes.map((source) => ({
    ...clone(source),
    id: sceneId(source.id),
    fog:source.fog?{...clone(source.fog),areas:source.fog.areas?.map(r=>({...clone(r),id:nested(source.id,'exploration-area',r.id),doorIds:r.doorIds.map(id=>nested(source.id,'point',id))}))}:undefined,
    effectSetup:source.effectSetup?{regions:source.effectSetup.regions.map(e=>({...clone(e),id:nested(source.id,'scene-effect',e.id),sourceNpcId:e.sourceNpcId?map('npc:'+e.sourceNpcId):undefined,objectId:e.objectId?nested(source.id,'spatial-object',e.objectId):undefined,pointId:e.pointId?nested(source.id,'point',e.pointId):undefined,terrain:e.terrain?{...clone(e.terrain),supportIds:e.terrain.supportIds.map(id=>nested(source.id,'spatial-object',id))}:undefined,magic:e.magic?{...clone(e.magic),excludedIds:e.magic.excludedIds.map(id=>map('npc:'+id))}:undefined})),containers:source.effectSetup.containers.map(c=>({...clone(c),id:nested(source.id,'supply-container',c.id),objectId:nested(source.id,'spatial-object',c.objectId)})),materials:source.effectSetup.materials.map(m=>({...clone(m),id:nested(source.id,'scene-material',m.id),npcId:map('npc:'+m.npcId),consumableId:map('npc-supply:'+m.npcId+':'+m.consumableId)}))}:undefined,
    spatialSetup:source.spatialSetup?{...clone(source.spatialSetup),objects:source.spatialSetup.objects.map(o=>({...clone(o),id:nested(source.id,'spatial-object',o.id)}))}:undefined,
    encounterId: null,
    pointLinks: source.pointLinks?.map((g) => ({
      ...clone(g),
      id: nested(source.id, 'point-link', g.id),
      sourcePointId: nested(source.id, 'point', g.sourcePointId),
      effects: g.effects.map((e) => ({ ...e, pointId: nested(source.id, 'point', e.pointId) })),
      arrivalGroupIds: g.arrivalGroupIds?.map((id) => nested(source.id, 'arrival', id)),
    })),
    template: null,
    arrivalGroups: source.arrivalGroups?.map((g) => ({
      ...clone(g),
      id: nested(source.id, 'arrival', g.id),
      npcIds: g.npcIds.map((id) => map('npc:' + id)),
      status: 'waiting',
      reason: undefined,
      requestId: undefined,
      sourceEventId: undefined,
    })),
    groundItems: source.groundItems?.map((g) => ({
      ...clone(g),
      inventoryState:undefined,
      id: nested(source.id, 'ground', g.id),
      quantity: g.initialQuantity,
      inventoryInstanceId: g.inventoryInstanceId
        ? nested(source.id, 'ground-instance', g.id)
        : undefined,
    })),
    background: source.background
      ? { ...source.background, assetId: map('asset:' + source.background.assetId) }
      : null,
    regions: source.regions.map((r) => ({ ...clone(r), id: nested(source.id, 'region', r.id) })),
    annotations: source.annotations.map((t) => ({
      ...clone(t),
      id: nested(source.id, 'annotation', t.id),
    })),
    walls: source.walls.map((w) => ({
      ...clone(w),
      id: nested(source.id, 'wall', w.id),
      pointId: w.pointId ? nested(source.id, 'point', w.pointId) : null,
    })),
    points: source.points.map((p) => ({
      ...clone(p),
      id: nested(source.id, 'point', p.id),
      targetSceneId: p.targetSceneId ? sceneId(p.targetSceneId) : null,
      portal: p.portal
        ? {
            ...clone(p.portal),
            targetPointId:
              p.portal.targetPointId && p.targetSceneId
                ? nested(p.targetSceneId, 'point', p.portal.targetPointId)
                : null,
          }
        : undefined,
      battlePresetId: p.battlePresetId ? map('battle:' + p.battlePresetId) : null,
      arrivalGroupIds: p.arrivalGroupIds?.map((id) => nested(source.id, 'arrival', id)),
      failureArrivalGroupIds: p.failureArrivalGroupIds?.map((id) => nested(source.id, 'arrival', id)),
      storyResults: p.storyResults?.map((r) => ({
        ...r,
        id: map('story:' + r.id),
        npcId: map('npc:' + r.npcId),
      })),
    })),
    tokens: source.tokens.map(
      (t) =>
        ({
          ...clone(t),
          id: nested(source.id, 'token', t.id),
          actorId: null,
          spatial:{height:t.initialSpatialHeight??0,layer:'material',...(t.initialSupportId?{supportId:nested(source.id,'spatial-object',t.initialSupportId)}:{})},
          initialSupportId:t.initialSupportId?nested(source.id,'spatial-object',t.initialSupportId):undefined,
          characterId: t.characterId ? characterRef(t.characterId) : null,
          ...(t.npcId ? { npcId: map('npc:' + t.npcId) } : {}),
          ...(t.npcBody ? { npcBody: npcBody(t.npcBody,source.id) } : {}),
        }) as MapToken,
    ),
  }))
  const npcs: NpcProfile[] = s.npcs.map((n) => {
    const config = clone(n),
      activityMissing = config.activity.scope !== 'party' && missing(config.activity.characterIds),
      protectMissing = missing([config.combatPolicy.protectCharacterId])
    const permissions=[config.practicalSocial?.enabled?'交涉':null,config.spatialPolicy?.enabled||config.spatialPolicy?.autoMove||config.spatialPolicy?.autoPlan||config.spatialPolicy?.practical?.enabled?'探索':null,config.merchantPolicy?.practical?.enabled?'交易':null,config.preauthorization.trade?'临时预授权':null].filter(Boolean)
    if(permissions.length)disabled.push({kind:'practical-policy',id:n.id,reason:`${n.name}：${permissions.join('／')}在新团需GM重新确认；初始设计保留。开团后前往AI旁白与NPC的对应NPC权限配置。`})
    if (activityMissing)
      disabled.push({ kind: 'npc-activity', id: n.id, reason: '活动角色位未绑定' })
    if (protectMissing)
      disabled.push({
        kind: 'npc-protection',
        id: n.id,
        reason: '保护角色位未绑定；须由 GM 重新配置',
      })
    const initialMemories = config.initialMemories?.flatMap((m) => {
      const ref = m.characterId ? characterRef(m.characterId) : null
      if (m.characterId && !ref) {
        disabled.push({ kind: 'npc-memory', id: n.id, reason: '初始记忆角色位未绑定' })
        return []
      }
      return [{ ...m, id: map('initial-memory:' + n.id + ':' + m.id), characterId: ref }]
    })
    const initialRelations = config.initialRelations?.flatMap((r) => {
      const ref = characterRef(r.characterId)
      if (!ref) {
        disabled.push({ kind: 'npc-relationship', id: n.id, reason: '初始关系角色位未绑定' })
        return []
      }
      return [{ ...r, characterId: ref }]
    })
    const secrets = new Map(n.secrets.map((f) => [f.id, map('secret:' + n.id + ':' + f.id)]))
    return {
      ...config,
      stock:config.stock.map((row,i)=>({...clone(row),id:map('stock:'+n.id+':'+(row.id??i)),inventoryState:row.inventoryState?{...clone(row.inventoryState),instanceId:map('stock-instance:'+n.id+':'+row.inventoryState.instanceId)}:undefined})),
      id: map('npc:' + n.id),
      merchantPolicy:config.merchantPolicy?{...clone(config.merchantPolicy),practical:config.merchantPolicy.practical?{...clone(config.merchantPolicy.practical),enabled:false}:undefined}:undefined,
      knowledgeProfile:config.knowledgeProfile?{...config.knowledgeProfile,factionId:config.knowledgeProfile.factionId?map('faction:'+config.knowledgeProfile.factionId):null,templateIds:config.knowledgeProfile.templateIds.map(id=>map('knowledge:'+id))}:undefined,
      spatialPolicy:config.spatialPolicy?{...clone(config.spatialPolicy),enabled:false,autoMove:false,autoPlan:false,practical:config.spatialPolicy.practical?{...clone(config.spatialPolicy.practical),enabled:false,pointIds:config.spatialPolicy.practical.pointIds.map(id=>nested(n.sceneId,'point',id))}:undefined,knownExits:config.spatialPolicy.knownExits.map(k=>({sceneId:sceneId(k.sceneId),pointId:nested(k.sceneId,'point',k.pointId)}))}:undefined,
      revision: 0,
      consumables:config.consumables?.map(c=>({...clone(c),id:map('npc-supply:'+n.id+':'+c.id)})),
      actorId: null,
      characterId: n.characterId ? characterRef(n.characterId) : null,
      sceneId: sceneId(n.sceneId),
      enabled: n.enabled && !protectMissing,
      guardOrigin: n.guardOrigin
        ? { ...n.guardOrigin, sceneId: sceneId(n.guardOrigin.sceneId) }
        : undefined,
      templateId:
        n.templateId && s.npcTemplates.some((t) => t.id === n.templateId)
          ? 'custom-' + map('npc-template:' + n.templateId)
          : n.templateId,
      body: n.body ? npcBody(n.body,n.sceneId) : null,
      combatPolicy: {
        ...config.combatPolicy,
        protectCharacterId: config.combatPolicy.protectCharacterId
          ? characterRef(config.combatPolicy.protectCharacterId)
          : null,
      },
      activity: {
        ...config.activity,
        enabled: config.activity.enabled && !activityMissing,
        templates: config.activity.templates?.map((t) => ({
          ...t,
          id: map('response:' + n.id + ':' + t.id),
          sceneId: t.sceneId ? sceneId(t.sceneId) : null,
          pointId: t.pointId
            ? nested(
                s.scenes.find(
                  (sc) =>
                    (!t.sceneId || sc.id === t.sceneId) &&
                    sc.points.some((p) => p.id === t.pointId),
                )!.id,
                'point',
                t.pointId,
              )
            : null,
        })),
        characterIds: config.activity.characterIds
          .map(characterRef)
          .filter((id): id is string => !!id),
      },
      secrets: config.secrets.map((f) => ({ ...f, id: secrets.get(f.id)! })),
      practicalSocial:config.practicalSocial?{enabled:false,rules:config.practicalSocial.rules.map(r=>({...clone(r),id:map('social:'+n.id+':'+r.id),success:{...clone(r.success),operations:remapSocialOperations(r.success.operations,id=>nested(n.sceneId,'point',id),id=>map('battle:'+id)),revealIds:r.success.revealIds.map(id=>secrets.get(id)!)},failure:{...clone(r.failure),operations:remapSocialOperations(r.failure.operations,id=>nested(n.sceneId,'point',id),id=>map('battle:'+id)),revealIds:r.failure.revealIds.map(id=>secrets.get(id)!)}}))}:undefined,
      dialogue: config.dialogue.map((d) => ({ ...d, id: map('dialogue:' + n.id + ':' + d.id) })),
      abilities: config.abilities.map((d) => ({
        ...d,
        id: d.key.startsWith('monster:') ? d.id : map('ability:' + n.id + ':' + d.id),
      })),
      preauthorization: {
        ...config.preauthorization,
        trade: false,
        revealIds: config.preauthorization.revealIds.map((id) => secrets.get(id)!),
        characterIds: [],
        remaining: 0,
        expiresAt: null,
      },
      initialMemories,
      initialRelations,
      relations: clone(initialRelations ?? []),
      experiences: [],
      experienceOmitted: 0,
      memory: [],
      urgingCooldowns: [],
      revealedIds: [],
      behaviorState: 'none',
    }
  })
  const presets = s.battles.flatMap((b) => {
    if (missing(b.participants.filter((p) => p.kind === 'character').map((p) => p.id))) {
      disabled.push({ kind: 'battle', id: b.id, reason: '参战角色位未绑定' })
      return []
    }
    return [
      {
        ...clone(b),
        id: map('battle:' + b.id),
        practical:b.practical?{...clone(b.practical),enabled:false,entry:b.practical.entry?.map(e=>({...clone(e),npcId:map('npc:'+e.npcId)}))}:undefined,
        sceneId: sceneId(b.sceneId),
        participants: b.participants.map((p) => ({
          ...p,
          id:
            p.kind === 'character'
              ? characterRef(p.id)!
              : p.kind === 'npc'
                ? map('npc:' + p.id)
                : nested(b.sceneId, 'token', p.id),
        })),
      },
    ]
  })
  for (const scene of scenes)
    for (const p of scene.points)
      if (p.battlePresetId && !presets.some((b) => b.id === p.battlePresetId)) {
        p.battlePresetId = null
        disabled.push({
          kind: 'point-battle',
          id: p.id,
          reason: '关联战斗触发因未绑定而停用；其他互动保留',
        })
      }
  const templates = s.broadcasts.map((b) => {
    const unbound = missing(b.audience.characterIds)
    if (unbound) disabled.push({ kind: 'broadcast', id: b.id, reason: '接收角色位未绑定' })
    // Unbound personal broadcasts become disabled GM-only placeholders, never public.
    return {
      ...clone(b),
      id: map('broadcast:' + b.id),
      enabled: b.enabled && !unbound,
      sceneId: b.sceneId ? sceneId(b.sceneId) : null,
      targetId:
        b.targetId && b.sceneId && b.trigger === 'event' && b.eventType === 'point.result'
          ? nested(b.sceneId, 'point', b.targetId)
          : b.targetId && b.sceneId && ['point', 'region', 'wall'].includes(b.trigger)
            ? nested(b.sceneId, b.trigger, b.targetId)
            : b.targetId,
      audience: unbound
        ? { kind: 'gm' as const, characterIds: [] }
        : {
            kind: b.audience.kind,
            characterIds: b.audience.characterIds
              .map(characterRef)
              .filter((id): id is string => !!id),
          },
    }
  })
  const adventure: Adventure = {
    ...(s.metadata.contentLocale ? {contentLocale:s.metadata.contentLocale} : {}),
    designNotebook: s.designNotebook ? clone(s.designNotebook) : undefined,
    growthGuide: s.growthGuide
      ? {
          ...clone(s.growthGuide),
          steps: s.growthGuide.steps.map((step) => ({
            ...clone(step),
            sceneId: step.sceneId ? sceneId(step.sceneId) : undefined,
            questId: step.questId ? map('quest:' + step.questId) : undefined,
          })),
        }
      : undefined,
    quests: (s.quests ?? []).map((q) => {
      const unbound = missing(q.characterIds)
      if (unbound)
        disabled.push({ kind: 'quest', id: q.id, reason: '任务接收角色位未绑定，保持隐藏' })
      return {
        ...clone(q),
        id: map('quest:' + q.id),
        steps: q.steps?.map((step) => ({
          ...clone(step),
          id: map('quest-step:' + q.id + ':' + step.id),
          afterIds: step.afterIds.map((id) => map('quest-step:' + q.id + ':' + id)),
          automatic:false,
          proxyNpcIds:step.proxyNpcIds?.map(id=>map('npc:'+id)),
          sceneId: step.sceneId ? sceneId(step.sceneId) : undefined,
          pointId:
            step.pointId && step.sceneId ? nested(step.sceneId, 'point', step.pointId) : undefined,
          arrivalGroupId:
            step.arrivalGroupId && step.sceneId
              ? nested(step.sceneId, 'arrival', step.arrivalGroupId)
              : undefined,
          status: step.initialStatus,
        })),
        pinnedStepId: q.pinnedStepId ? map('quest-step:' + q.id + ':' + q.pinnedStepId) : undefined,
        gmDesign: q.gmDesign
          ? { ...clone(q.gmDesign), npcIds: q.gmDesign.npcIds.map((id) => map('npc:' + id)) }
          : undefined,
        sceneId: q.sceneId ? sceneId(q.sceneId) : null,
        pointId: q.pointId && q.sceneId ? nested(q.sceneId, 'point', q.pointId) : null,
        characterIds: q.characterIds.map(characterRef).filter((id): id is string => !!id),
        visibility: unbound ? ('hidden' as const) : q.visibility,
        status: q.initialStatus,
      }
    }),
    version: 1,
    id: uuid(),
    name: s.metadata.name,
    revision: 0,
    party: inspection ? [] : players.map((c) => c.id),
    activeSceneId: null,
    scenes,
    log: [],
    checkpoints: [],
    ai: {
      knowledgeDesign:s.knowledgeDesign?{factions:s.knowledgeDesign.factions.map(f=>({...clone(f),...(f.practical?{practical:{...clone(f.practical),enabled:false}}:{}),id:map('faction:'+f.id),policies:f.policies?.map(p=>({...clone(p),proxyNpcIds:p.proxyNpcIds?.map(id=>map('npc:'+id)),id:map('reputation-policy:'+p.id),sceneId:sceneId(p.sceneId),pointId:nested(p.sceneId,'point',p.pointId)}))})),templates:s.knowledgeDesign.templates.map(t=>({...clone(t),id:map('knowledge:'+t.id)}))}:undefined,
      settings: {
        ...clone(s.ai),
        sceneNarrationSkills: Object.fromEntries(
          Object.entries(s.ai.sceneNarrationSkills ?? {}).map(([id, skill]) => [
            sceneId(id),
            skill,
          ]),
        ),
        ...(s.ai.qqDialogueReview
          ? {
              qqDialogueReview: {
                ...clone(s.ai.qqDialogueReview),
                enabled: false,
                paused: false,
                revision: 0,
              },
            }
          : {}),
      },
      npcs,
      templates: s.npcTemplates.map((t) => ({
        ...clone(t),
        id: 'custom-' + map('npc-template:' + t.id),
        body: { ...clone(t.body), effects: [] },
      })),
    },
    battles: { presets, requests: [], history: [] },
    openingPresentation: s.openingPresentation ? {...clone(s.openingPresentation),identities:s.openingPresentation.identities.flatMap(i=>{const id=characterRef(i.characterId);return id?[{...i,characterId:id}]:[]})} : undefined,
    broadcast: { ...newBroadcastSettings(), templates },
  }
  const world: MapWorld = {
    adventures: [adventure],
    characters: [...characters, ...clone(players)],
    encounters: [],
    packs: clone(s.packs),
  }
  initialiseM3Scenes(adventure)
  if(!inspection)initialiseSceneEffects(world,adventure,catalogue([...BUILTIN_PACKS,...s.packs]))
  return {
    world,
    disabled,
    startSceneId: sceneId(s.metadata.startSceneId),
    landing: clone(s.metadata.landing),
    assetIds: Object.fromEntries(s.assets.map((a) => [a.id, map('asset:' + a.id)])),
  }
}

export function instantiateScript(
  input: unknown,
  assets: MapAsset[],
  players: Character[] = [],
  bindings: Record<string, string> = {},
  source?: NonNullable<Adventure['sourceScript']>,
) {
  const { definition: s, missingDependencies } = inspectScript(input)
  assertCalibrationReady(s.scenes)
  requireRef(
    !missingDependencies.length,
    '剧本缺少规则依赖：' + missingDependencies.map((p) => p.id).join('、'),
  )
  unique(
    players.map((c) => c.id),
    '玩家角色',
  )
  requireRef(
    players.every((c) => c.status === 'complete' && c.purpose !== 'npc' && !c.npcOwnerId),
    '队伍包含 NPC 或未完成角色',
  )
  requireRef(players.length+s.characters.length<=100,'开团人物总量超过100（玩家与完整职业NPC共用容量），请减少选择或拆分剧本')
  for (const [id, characterId] of Object.entries(bindings))
    requireRef(
      s.roles.some((r) => r.id === id) && players.some((c) => c.id === characterId),
      '角色位绑定无效',
    )
  requireRef(
    s.roles.every((r) => !r.required || bindings[r.id]),
    '必需角色位未绑定',
  )
  for (const a of s.assets) {
    const file = assets.find((x) => x.id === a.id)
    if (file) validateAsset(file)
    requireRef(
      !!file &&
        JSON.stringify(scriptAssetSchema.parse(scriptAssetMeta(file))) === JSON.stringify(a),
      '剧本图片缺失或元数据不一致',
    )
  }
  const result = buildInstance(s, bindings, players)
  if (source) result.world.adventures[0]!.sourceScript = clone(source)
  const cat = catalogue([...BUILTIN_PACKS, ...s.packs])
  for (const c of result.world.characters) {
    requireRef(
      validate(c.build, cat, { existingCharacter: true }).length === 0,
      '开团角色构筑不符合规则',
    )
    for (const p of c.packs)
      requireRef(
        [...BUILTIN_PACKS, ...s.packs].some((x) => x.id === p.id && x.version === p.version),
        '开团角色缺少规则包：' + p.id,
      )
    validateInventory(c, cat)
    validateRuntimeArchive(c, cat)
  }
  for(const scene of result.world.adventures[0]!.scenes)if(scene.effectSetup)validateInitialScene(scene,scene.effectSetup,result.world.adventures[0]!.ai?.npcs.map(n=>n.id)??[],result.world.adventures[0]!.ai?.npcs)
  validateAdventure(result.world.adventures[0]!, result.world, cat)
  validateBroadcasts(result.world.adventures[0]!, result.world)
  return {
    ...result,
    assets: s.assets.map((a) => {
      const file = assets.find((x) => x.id === a.id)!
      return {
        ...file,
        id: result.assetIds[a.id]!,
        ...(file.preview ? { preview: { ...file.preview } } : {}),
        ...(file.importInfo ? { importInfo: { ...file.importInfo } } : {}),
      }
    }),
  }
}
