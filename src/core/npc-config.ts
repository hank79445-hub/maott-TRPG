import { NPC_LIMIT, BROADCAST_LIMIT } from './configuration-limits'
import {remapSocialOperations} from './practical-social-refs'
import type { CombatNpc } from './combat-types'
import { initialNpcState } from './npc-abilities'
import { clone, catalogue, validate } from './engine'
import { aiState, newNpcProfile, validateAdventureAi } from './ai'
import { newBroadcastTemplate, gmAudience } from './broadcast'
import { runtimeState, runtimeSpells, validateInventory, validateRuntimeArchive } from './runtime'
import { scriptCharacter } from './character-config'
import { npcBody } from './npc-map'
import { inside, blocked, occupied } from './map'
import { rollDamage, attackOptions } from './combat-rules'
import type { Combatant } from './combat-types'
import {
  npcConfigSchema,
  configMappingSchema,
  broadcastTextsSchema,
  type NpcConfigDocument,
  type ConfigMapping,
  type ConfigImportCommand,
} from '../persistence/npc-config-schema'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { isBuiltinPack } from '../content/builtin-ids'
import { CONDITIONS } from '../content/conditions'
import { npcCapabilities } from './npc-strategy'
import { validateGrowthArchive } from './growth'
import { CONFIG_FILE_BYTES } from '../persistence/npc-config-schema'
import type { MapWorld, Adventure, MapToken } from './map-types'
import type { Character } from './types'

/** Concurrency fingerprint, not an authorization token. */
export function configStamp(world: MapWorld, a: Adventure) {
  const s = JSON.stringify([
    a.revision,
    a.ai?.npcs,
    a.broadcast?.templates,
    a.scenes.map((s) => [s.id, s.grid, s.tokens, s.regions, s.walls, s.points]),
    world.characters,
    world.packs,
  ])
  let h = 2166136261,
    g = 5381
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    g = Math.imul(g, 33) ^ s.charCodeAt(i)
  }
  return (h >>> 0).toString(16) + '-' + (g >>> 0).toString(16)
}
const uuid = () => crypto.randomUUID()
function knowledgeSignature(value:unknown){let h=2166136261;for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16)}
const factionSignature=(f:{name:string;description:string;hidden:boolean})=>knowledgeSignature([f.name,f.description,f.hidden])
const templateSignature=(t:{name:string;layer:string;visibility:string;text:string;version:number})=>knowledgeSignature([t.name,t.layer,t.visibility,t.text,t.version])
const unique = (values: string[], label: string) => {
  if (new Set(values).size !== values.length) throw Error(label + '编号重复')
}
export function parseNpcConfig(input: unknown): NpcConfigDocument {
  if (new TextEncoder().encode(JSON.stringify(input)).length > CONFIG_FILE_BYTES)
    throw Error('配置文件超过16MiB')
  const d = npcConfigSchema.parse(input)
  unique(
    d.npcs.map((n) => n.id),
    'NPC',
  )
  unique(
    d.scenes.map((s) => s.id),
    '场景',
  )
  unique(
    d.subjects.map((s) => s.id),
    '对象',
  )
  unique(
    d.characters.map((c) => c.id),
    '角色',
  )
  unique(
    d.packs.map((p) => p.id),
    '规则包',
  )
  const refs = new Set([...d.subjects.map((s) => s.id), ...d.characters.map((c) => c.id)])
  unique(
    d.npcs.flatMap((n) => (n.characterId ? [n.characterId] : [])),
    'NPC专用角色',
  )
  unique([...d.subjects.map((s) => s.id), ...d.characters.map((c) => c.id)], '人物引用')
  for (const c of d.characters) {
    if (!d.npcs.some((n) => n.characterId === c.id)) throw Error('孤立角色卡：' + c.build.name)
    unique(
      c.inventory.map((i) => i.instanceId),
      c.build.name + '背包',
    )
    if (
      c.inventory.some(
        (i) => i.containerId && !c.inventory.some((j) => j.instanceId === i.containerId),
      )
    )
      throw Error(c.build.name + '：背包容器引用断裂')
    unique(
      c.initialConsumableDurations.map((i) => i.instanceId),
      c.build.name + '物品期限',
    )
    if (
      c.initialConsumableDurations.some(
        (i) => !c.inventory.some((j) => j.instanceId === i.instanceId && j.consumable),
      )
    )
      throw Error(c.build.name + '：物品期限引用断裂')
  }
  for (const n of d.npcs) {
    if (!d.scenes.some((s) => s.id === n.sceneId)) throw Error(n.name + '：场景引用断裂')
    if (
      n.characterId &&
      (!d.characters.some((c) => c.id === n.characterId) || n.npcType !== 'important' || n.body)
    )
      throw Error(n.name + '：专用角色关联无效或同时有两份战斗数据')
    for (const id of [
      n.combatPolicy.protectCharacterId,
      ...n.activity.characterIds,
      ...(n.initialMemories ?? []).map((m) => m.characterId),
      ...(n.initialRelations ?? []).map((r) => r.characterId),
    ].filter(Boolean))
      if (!refs.has(id!)) throw Error(n.name + '：人物引用断裂')
    if (n.npcType === 'ordinary' && n.body && n.body.attacks.length > 8)
      throw Error(n.name + '：普通NPC最多8种攻击')
    if (n.body) {
      unique(
        n.body.attacks.map((a) => a.id),
        n.name + '攻击',
      )
      for (const a of n.body.attacks) {
        rollDamage(a.damage, () => 1)
        for (const e of a.extraDamage ?? []) rollDamage(e.formula, () => 1)
      }
      for (const id of [...(n.body.multiattack ?? []), ...n.combatPolicy.attackIds])
        if (!n.body.attacks.some((a) => a.id === id)) throw Error(n.name + '：攻击引用断裂')
      if (n.body.hp > n.body.maxHp) throw Error(n.name + '：当前HP超过上限')
      for (const c of n.body.conditions)
        if (!CONDITIONS.some((x) => x.id === c)) throw Error(n.name + '：未知状态 ' + c)
    }
  }
  return d
}
export function exportNpcConfig(
  world: MapWorld,
  a: Adventure,
  ids: string[],
  healthy = false,
  subjectNames: { id: string; name: string }[] = [],
): NpcConfigDocument {
  const source = (a.ai?.npcs ?? []).filter((n) => ids.includes(n.id)),
    subjects = new Map<string, string>()
  if (ids.some((id) => !source.some((n) => n.id === id)))
    throw Error('所选NPC已变化或不存在，请刷新配置后重新选择')
  const ref = (id: string) => {
    if (source.some((n) => n.characterId === id)) return id
    if (!subjects.has(id)) subjects.set(id, 'subject-' + subjects.size)
    return subjects.get(id)!
  }
  const characters = source.flatMap((n) => {
    const c = world.characters.find((c) => c.id === n.characterId)
    if (!c) return []
    const value = scriptCharacter(c)
    // Perishable-item shelf life is inventory metadata, not an active effect.
    // scriptCharacter stores its remaining hours independently of the old clock.
    if (healthy)
      value.initial = {
        ...(value.initial.preparedSpells ? { preparedSpells: value.initial.preparedSpells } : {}),
        ...(value.initial.knownBeasts ? { knownBeasts: value.initial.knownBeasts } : {}),
      }
    return [value]
  })
  const npcs = source.map((n) => {
    const {
      fixedReplyCursor: _fixedReplyCursor,
      consumablesUsed: _consumablesUsed,
      actorId: _a,
      revision: _r,
      turnHold: _h,
      arrivalOrigin: _arrivalOrigin,
      appeared: _appeared,
      experiences: _experiences,
      experienceOmitted: _omitted,
      relations: _relations,
      memory: _m,
      revealedIds: _v,
      urgingCooldowns: _u,
      behaviorState: _b,
      preauthorization,
      body: _body,
      ...p
    } = clone(n)
    const live = npcBody(world, n),
      { effects: _fx, ...body } = live ? clone(live) : { effects: [] }
    if (healthy && live)
      Object.assign(body, initialNpcState(body as CombatNpc), {
        hp: live.maxHp,
        temporaryHp: 0,
        conditions: [],
        dead: false,
      })
    delete p.templateId
    if (p.combatPolicy.protectCharacterId)
      p.combatPolicy.protectCharacterId = ref(p.combatPolicy.protectCharacterId)
    p.initialMemories = p.initialMemories?.map((m) => ({
      ...m,
      characterId: m.characterId ? ref(m.characterId) : null,
    }))
    p.initialRelations = p.initialRelations?.map((r) => ({ ...r, characterId: ref(r.characterId) }))
    p.activity.characterIds = p.activity.scope === 'party' ? [] : p.activity.characterIds.map(ref)
    return {
      ...p,
      body: live ? body : null,
      preauthorization: {
        trade: false,
        revealIds: [],
        maxQuantity: 1,
        maxDiscountGP: 0,
        maxValueGP: 0,
      },
    }
  })
  return parseNpcConfig({
    format: 'trpg-npc-config',
    version: 1,
    npcs,
    characters,
    scenes: a.scenes
      .filter((s) =>
        source.some(
          (n) =>
            n.sceneId === s.id ||
            n.spatialPolicy?.knownExits.some(e=>e.sceneId===s.id) ||
            n.activity.templates?.some(
              (t) => t.sceneId === s.id || s.points.some((p) => p.id === t.pointId),
            ),
        ),
      )
      .map((s) => ({
        id: s.id,
        name: s.name,
        presets:a.battles?.presets.filter(p=>p.sceneId===s.id).map(p=>({id:p.id,name:p.name})),
        points: s.points.map((p) => ({ id: p.id, name: p.name })),
      })),
    subjects: [...subjects].map(([old, id]) => ({
      id,
      name:
        subjectNames.find((c) => c.id === old)?.name ??
        world.characters.find((c) => c.id === old)?.build.name ??
        old.replace(/^role:/, '角色位：'),
    })),
    knowledgeReferences:a.ai?.knowledgeDesign?{factions:a.ai.knowledgeDesign.factions.filter(f=>source.some(n=>n.knowledgeProfile?.factionId===f.id)).map(f=>({id:f.id,name:f.name,signature:factionSignature(f)})),templates:a.ai.knowledgeDesign.templates.filter(t=>source.some(n=>n.knowledgeProfile?.templateIds.includes(t.id))).map(t=>({id:t.id,name:t.name,signature:templateSignature(t)}))}:undefined,
    packs: world.packs.filter((p) => !isBuiltinPack(p.id)),
    dependencies: [...BUILTIN_PACKS, ...world.packs.filter((p) => !isBuiltinPack(p.id))].map(
      (p) => ({ id: p.id, version: p.version }),
    ),
  })
}
export function duplicateConfig(d: NpcConfigDocument, count: number) {
  if (!Number.isInteger(count) || count < 1 || count * d.npcs.length > NPC_LIMIT)
    throw Error('复制份数超过NPC容量')
  const result = clone(d)
  result.npcs = []
  result.characters = []
  for (let i = 0; i < count; i++) {
    const ids = new Map(d.characters.map((c) => [c.id, uuid()]))
    result.characters.push(...d.characters.map((c) => ({ ...clone(c), id: ids.get(c.id)! })))
    result.npcs.push(
      ...d.npcs.map((n) => ({
        ...clone(n),
        id: uuid(),
        name: n.name.slice(0, 110) + ' · 副本' + (i + 1),
        initialMemories: n.initialMemories?.map((m) => ({
          ...m,
          id: uuid(),
          characterId: m.characterId ? (ids.get(m.characterId) ?? m.characterId) : null,
        })),
        initialRelations: n.initialRelations?.map((r) => ({
          ...r,
          characterId: ids.get(r.characterId) ?? r.characterId,
        })),
        characterId: n.characterId ? ids.get(n.characterId)! : null,
        combatPolicy: {
          ...n.combatPolicy,
          protectCharacterId: n.combatPolicy.protectCharacterId
            ? (ids.get(n.combatPolicy.protectCharacterId) ?? n.combatPolicy.protectCharacterId)
            : null,
        },
        activity: {
          ...n.activity,
          templates: n.activity.templates?.map((t) => ({ ...t, id: uuid() })),
          characterIds: n.activity.characterIds.map((id) => ids.get(id) ?? id),
        },
      })),
    )
  }
  return parseNpcConfig(result)
}
export function defaultConfigMapping(d: NpcConfigDocument): ConfigMapping {
  return {
    scenes: {},
    subjects: {},
    entries: d.npcs.map((n) => ({
      id: n.id,
      name: n.name,
      ...n.position,
      enabled: false,
      protect: false,
      activity: false,
      follow: false,
      autoReply: false,
    })),
  }
}
export function appendNpcConfig(
  world: MapWorld,
  a: Adventure,
  input: unknown,
  mapInput: unknown,
  roleIds: string[] = [],
) {
  const d = parseNpcConfig(input),
    m = configMappingSchema.parse(mapInput)
  if (!d.npcs.length) throw Error('没有待导入NPC')
  if (aiState(a).npcs.length + d.npcs.length > NPC_LIMIT)
    throw Error(`NPC总数超过${NPC_LIMIT}，请减少导入数量`)
  if (world.characters.length + d.characters.length > 100) throw Error('角色总数超过100')
  unique(
    m.entries.map((e) => e.id),
    '预览',
  )
  if (
    m.entries.length !== d.npcs.length ||
    d.npcs.some((n) => !m.entries.some((e) => e.id === n.id))
  )
    throw Error('预览必须包含全部NPC')
  for (const p of d.packs) {
    if (isBuiltinPack(p.id) || ['local-custom', 'custom'].includes(p.id))
      throw Error('扩展包不能替换内置规则')
    const prior = world.packs.find((x) => x.id === p.id)
    if (prior && JSON.stringify(prior) !== JSON.stringify(p)) throw Error('规则包冲突：' + p.id)
    if (!prior) world.packs.push(clone(p))
  }
  if (world.packs.length > 20) throw Error('规则包数量超过20')
  for (const dep of d.dependencies)
    if (
      ![...BUILTIN_PACKS, ...world.packs].some((p) => p.id === dep.id && p.version === dep.version)
    )
      throw Error('缺少规则依赖：' + dep.id + '@' + dep.version)
  const cat = catalogue([...BUILTIN_PACKS, ...world.packs]),
    npcIds = new Map(d.npcs.map((n) => [n.id, uuid()])),
    charIds = new Map(d.characters.map((c) => [c.id, uuid()]))
  const pointRef=(sourceSceneId:string,id:string)=>{const original=d.scenes.find(s=>s.id===sourceSceneId)?.points?.find(p=>p.id===id),scene=a.scenes.find(s=>s.id===m.scenes[sourceSceneId]),matches=scene?.points.filter(p=>p.name===original?.name)??[];if(matches.length!==1)throw Error('实用策略互动点需唯一同名映射：'+(original?.name??id));return matches[0]!.id}
  const knowledgeRef=(kind:'factions'|'templates',id:string)=>{const metadata=d.knowledgeReferences?.[kind].find(r=>r.id===id),rows=a.ai?.knowledgeDesign?.[kind]??[],matches=rows.filter(row=>row.id===id||metadata&&row.name===metadata.name&&metadata.signature===(kind==='factions'?factionSignature(row as Parameters<typeof factionSignature>[0]):templateSignature(row as Parameters<typeof templateSignature>[0])));if(matches.length!==1)throw Error('组织／知识模板需已有的相同定义，请先导入或配置：'+(metadata?.name??id));return matches[0]!.id}
  const battleRef=(sourceSceneId:string,id:string)=>{const original=d.scenes.find(s=>s.id===sourceSceneId)?.presets?.find(p=>p.id===id),matches=a.battles?.presets.filter(p=>p.sceneId===m.scenes[sourceSceneId]&&p.name===original?.name)??[];if(matches.length!==1)throw Error('交涉战斗支援需在目标场景配置唯一同名预设：'+(original?.name??id));return matches[0]!.id}
  const inventoryMaps = new Map<string, Map<string, string>>()
  const bound = (id: string) => {
    if (charIds.has(id)) return charIds.get(id)!
    const target = m.subjects[id]
    if (
      !target ||
      (!world.characters.some((c) => c.id === target && !c.npcOwnerId) && !roleIds.includes(target))
    )
      throw Error('对象未绑定：' + (d.subjects.find((s) => s.id === id)?.name ?? id))
    return target
  }
  const characters: Character[] = d.characters.map((c) => {
    const { initial, initialConsumableDurations: durations, ...base } = clone(c),
      entry = m.entries.find((e) => e.id === d.npcs.find((n) => n.characterId === c.id)!.id)!,
      itemIds = new Map(base.inventory.map((r) => [r.instanceId, uuid()]))
    inventoryMaps.set(c.id, itemIds)
    for (const row of base.inventory) {
      row.instanceId = itemIds.get(row.instanceId)!
      if (row.containerId) row.containerId = itemIds.get(row.containerId)!
    }
    const value: Character = {
      ...base,
      id: charIds.get(c.id)!,
      status: 'complete',
      purpose: 'npc',
      npcOwnerId: npcIds.get(d.npcs.find((n) => n.characterId === c.id)!.id)!,
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      journal: [],
      runtime: null,
    }
    value.build.name = entry.name
    const issues = validate(value.build, cat, { existingCharacter: true })
    if (issues.length) throw Error(entry.name + '：' + issues.map((x) => x.message).join('；'))
    const r = runtimeState(value, cat)
    value.runtime = {
      ...r,
      ...initial,
      resources: { ...r.resources, ...initial.resources, ...entry.resources },
      ...(entry.hp !== undefined ? { hp: entry.hp } : {}),
      ...(entry.conditions ? { conditions: entry.conditions } : {}),
    }
    for (const d of durations) {
      const row = value.inventory.find((i) => i.instanceId === itemIds.get(d.instanceId))
      if (row?.consumable) row.consumable.expiresAt = (value.runtime.hours ?? 0) + d.hours
    }
    validateGrowthArchive(value, cat)
    validateInventory(value, cat)
    validateRuntimeArchive(value, cat)
    return value
  })
  world.characters.push(...characters)
  for (const original of d.npcs) {
    const n = clone(original),
      entry = m.entries.find((e) => e.id === n.id)!,
      scene = a.scenes.find((s) => s.id === m.scenes[n.sceneId])
    if (!scene) throw Error(n.name + '：请选择目标场景')
    const attackIds = new Map((n.body?.attacks ?? []).map((t) => [t.id, uuid()]))
    if (n.characterId) {
      const items = inventoryMaps.get(n.characterId)!
      n.combatPolicy.attackIds = n.combatPolicy.attackIds.map(
        (id) =>
          items.get(id) ??
          (id.endsWith(':ranged') && items.has(id.slice(0, -7))
            ? items.get(id.slice(0, -7))! + ':ranged'
            : id),
      )
    }
    if (n.body) {
      n.body.name = entry.name
      n.body.attacks.forEach((t) => (t.id = attackIds.get(t.id)!))
      if (n.body.multiattack)
        n.body.multiattack = n.body.multiattack.map((id) => attackIds.get(id)!)
      if (n.body.multiattackChoice)
        n.body.multiattackChoice.attackIds = n.body.multiattackChoice.attackIds.map((id) =>
          attackIds.get(id)!,
        )
      n.combatPolicy.attackIds = n.combatPolicy.attackIds.map((id) => attackIds.get(id)!)
      if (entry.hp !== undefined) n.body.hp = entry.hp
      if (entry.conditions) n.body.conditions = clone(entry.conditions)
      if (
        n.body.hp > n.body.maxHp ||
        n.body.conditions.some((c) => !CONDITIONS.some((x) => x.id === c))
      )
        throw Error(entry.name + '：初始HP或状态不合法')
      if (entry.resources && Object.keys(entry.resources).length)
        throw Error(entry.name + '：简明卡没有职业资源')
    }
    const socialSecretIds=new Map(n.secrets.map(s=>[s.id,uuid()]))
    const p = {
      ...newNpcProfile(scene.id, n.npcType),
      ...n,
      id: npcIds.get(n.id)!,
      revision: 1,
      initialMemories: n.initialMemories?.map((m) => ({
        ...m,
        id: uuid(),
        characterId: m.characterId ? bound(m.characterId) : null,
      })),
      initialRelations: n.initialRelations?.map((r) => ({
        ...r,
        characterId: bound(r.characterId),
      })),
      relations: n.initialRelations?.map((r) => ({ ...r, characterId: bound(r.characterId) })),
      experiences: [],
      experienceOmitted: 0,
      actorId: null,
      characterId: n.characterId ? charIds.get(n.characterId)! : null,
      knowledgeProfile:n.knowledgeProfile?{...clone(n.knowledgeProfile),factionId:n.knowledgeProfile.factionId?knowledgeRef('factions',n.knowledgeProfile.factionId):null,templateIds:n.knowledgeProfile.templateIds.map(id=>knowledgeRef('templates',id))}:undefined,
      name: entry.name,
      sceneId: scene.id,
      position: { x: entry.x, y: entry.y },
      guardOrigin: { sceneId: scene.id, x: entry.x, y: entry.y },
      body: n.body ? { ...n.body, effects: [] } : null,
      enabled: entry.enabled,
      followParty: entry.follow,
      autoDialogue: entry.autoReply,
      combatPolicy: {
        ...n.combatPolicy,
        strategy:
          !entry.protect && n.combatPolicy.strategy === 'protect'
            ? ('guard' as const)
            : n.combatPolicy.strategy,
        protectCharacterId:
          entry.protect && n.combatPolicy.protectCharacterId
            ? bound(n.combatPolicy.protectCharacterId)
            : null,
      },
      activity: {
        ...n.activity,
        enabled: entry.activity,
        templates: n.activity.templates?.map((t) => {
          const sourceScene = d.scenes.find(
            (s) =>
              (!t.sceneId || s.id === t.sceneId) &&
              (t.pointId
                ? s.points?.some((p) => p.id === t.pointId)
                : s.id === (t.sceneId ?? n.sceneId)),
          )
          const mappedSceneId = t.sceneId ? m.scenes[t.sceneId] : scene.id
          const targetScene = a.scenes.find((s) => s.id === mappedSceneId)
          if (!targetScene) throw Error(entry.name + '：回应场景需映射')
          const sourcePoint = sourceScene?.points?.find((p) => p.id === t.pointId)
          const points = t.pointId
            ? targetScene.points.filter((p) => p.name === sourcePoint?.name)
            : []
          if (t.pointId && points.length !== 1)
            throw Error(
              entry.name + '：请在目标场景配置唯一同名互动点：' + (sourcePoint?.name ?? t.pointId),
            )
          return {
            ...t,
            id: uuid(),
            sceneId: t.sceneId ? targetScene.id : null,
            pointId: points[0]?.id ?? null,
          }
        }),
        characterIds: entry.activity ? n.activity.characterIds.map(bound) : [],
      },
      secrets: n.secrets.map((s) => ({ ...s, id: socialSecretIds.get(s.id)! })),
      // Importing a design is never automatic authority in the destination room.
      practicalSocial:n.practicalSocial?{enabled:false,rules:n.practicalSocial.rules.map(r=>({...clone(r),id:uuid(),success:{...clone(r.success),operations:remapSocialOperations(r.success.operations,id=>pointRef(n.sceneId,id),id=>battleRef(n.sceneId,id)),revealIds:r.success.revealIds.map(id=>socialSecretIds.get(id)!)},failure:{...clone(r.failure),operations:remapSocialOperations(r.failure.operations,id=>pointRef(n.sceneId,id),id=>battleRef(n.sceneId,id)),revealIds:r.failure.revealIds.map(id=>socialSecretIds.get(id)!)}}))}:undefined,
      spatialPolicy:n.spatialPolicy?{...clone(n.spatialPolicy),enabled:false,autoMove:false,autoPlan:false,knownExits:n.spatialPolicy.knownExits.map(e=>{const sceneId=m.scenes[e.sceneId];if(!sceneId)throw Error('已知出口场景需映射');return {sceneId,pointId:pointRef(e.sceneId,e.pointId)}}),practical:n.spatialPolicy.practical?{...clone(n.spatialPolicy.practical),enabled:false,pointIds:n.spatialPolicy.practical.pointIds.map(id=>pointRef(n.sceneId,id))}:undefined}:undefined,
      merchantPolicy:n.merchantPolicy?{...clone(n.merchantPolicy),practical:n.merchantPolicy.practical?{...clone(n.merchantPolicy.practical),enabled:false}:undefined}:undefined,
      dialogue: n.dialogue.map((t) => ({ ...t, id: uuid() })),
      abilities: n.abilities.map((b) => ({ ...b, id: uuid() })),
      preauthorization: {
        trade: false,
        revealIds: [],
        characterIds: [],
        remaining: 0,
        maxQuantity: 1,
        maxDiscountGP: 0,
        maxValueGP: 0,
        expiresAt: null,
      },
    }
    const span =
      p.body?.size === 'large'
        ? 2
        : p.body?.size === 'huge'
          ? 3
          : p.body?.size === 'gargantuan'
            ? 4
            : 1
    const token: MapToken = {
      id: uuid(),
      name: p.name,
      npcId: p.id,
      characterId: p.characterId,
      actorId: null,
      ...p.position,
      span,
      hidden: p.hidden,
      color: '#c98459',
      facing: 0,
    }
    if (
      !occupied(token).every(
        (pos) =>
          inside(scene, pos) &&
          !blocked(scene, pos) &&
          !scene.tokens.some((t) => occupied(t).some((q) => q.x === pos.x && q.y === pos.y)),
      )
    )
      throw Error(entry.name + '：落点被占用、阻挡或超出网格')
    const available = npcCapabilities(world, p)
    if (p.characterId) {
      const attacks = attackOptions(
        { characterId: p.characterId, companion: null } as unknown as Combatant,
        world.characters,
        cat,
      )
      if (p.combatPolicy.attackIds.some((id) => !attacks.some((t) => t.id === id)))
        throw Error(p.name + '：角色武器攻击引用无效')
    }
    for (const b of p.abilities)
      if (
        !available.some(
          (x) =>
            x.kind === b.kind &&
            x.key === b.key &&
            (b.kind !== 'spell' ||
              runtimeSpells(
                world.characters.find((c) => c.id === p.characterId)!,
                cat,
              ).some((g) => g.key === b.key && g.modes.includes(b.mode))),
        )
      )
        throw Error(p.name + '：能力来源或施放方式无效 ' + b.name)
    scene.tokens.push(token)
    aiState(a).npcs.push(p)
  }
  validateAdventureAi(a, world, cat, roleIds)
}
export function applyConfigImport(
  world: MapWorld,
  a: Adventure,
  c: ConfigImportCommand,
  roleIds: string[] = [],
) {
  if (configStamp(world, a) !== c.expectedStamp)
    throw Error('配置版本已变化，请刷新预览后重新确认；原输入已保留')
  if (c.type === 'npc-config-import') appendNpcConfig(world, a, c.document, c.mapping, roleIds)
  else {
    const d = broadcastTextsSchema.parse(c.document)
    if (!d.templates.length) throw Error('没有待导入文案')
    a.broadcast ??= { templates: [], played: [], storyStarted: false }
    if (a.broadcast.templates.length + d.templates.length > BROADCAST_LIMIT)
      throw Error(`广播模板总数超过${BROADCAST_LIMIT}`)
    a.broadcast.templates.push(
      ...d.templates.map((t) => ({
        ...newBroadcastTemplate(),
        ...t,
        id: uuid(),
        audience: gmAudience(),
        narration: 'direct' as const,
        trigger: 'manual' as const,
        policy: 'manual' as const,
        enabled: true,
        sceneId: null,
        targetId: null,
      })),
    )
  }
}
