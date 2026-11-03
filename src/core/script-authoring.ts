import {designContextFiles,designContextText,type DesignNotebook} from './authoring-design-context'
import { ENGLISH_AUTHORING_GUIDE, ENGLISH_VALIDATION_GUIDE, ENGLISH_VISUAL_GUIDE } from './authoring-language'
import { outputLanguageInstruction, type Locale } from '../shared/localization/locale'
import { stageIssues } from './authoring-stages'
import {AUTHORING_VALIDATION_GUIDE} from './authoring-validation-guide'
import { authoringArrivalWarnings } from './authoring-arrivals'
import { validateExploration } from './enclosed-exploration'
import {remapSocialOperations} from './practical-social-refs'
import {
  authoringRequirementText,
  authoringDesignInstructions,
  type AuthoringRequirements,
} from './authoring-requirements'
import { authoringBudget } from './authoring-budget'
import { authoringConfigurationFindings } from './authoring-readiness'
import { authoringModuleInstructions, AUTHORING_CAPABILITIES_VERSION } from './authoring-modules'
import {validateInitialScene} from './scene-initial'
import {authoringSceneInstructions} from './authoring-scene-instructions'
import { missingNpcTokens } from './npc-token-repair'
import { assertCapacity, assertAuthoringBytes, SCENE_CAPACITY } from './configuration-limits'
import { SCRIPT_DOCUMENT_BYTES } from '../persistence/script-schema'
import { authoringSpatialInstructions, authoringVisualInstructions } from './authoring-instructions'
import { z } from 'zod'
import {
  parseAuthoringValue,
  authoringSchema,
  authorSceneSchema,
  type Authoring,
  type AuthorScene,
} from '../persistence/script-authoring-schema'
import { newScript, inspectScript } from './script'
import { newScene, newPoint } from './map'
import { newNpcProfile } from './ai'
import { newBroadcastTemplate } from './broadcast'
import { scriptNpcSchema, scriptSceneSchema } from '../persistence/script-schema'
import { NPC_TEMPLATES, npcTemplate } from '../content/npc-templates'
import { clone, catalogue } from './engine'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import type { Pack } from './types'
import { compileAuthorWalls, validatePointFootprints } from './authoring-visual-layout'
import { compileNpcCharacter } from './authoring-character'
import { npcCapabilities } from './npc-strategy'
import characterExamples from '../content/authoring-character-examples.json'
import characterGrowthExamples from '../content/authoring-character-growth-examples.json'

export const authoringCatalogue = () =>
  NPC_TEMPLATES.map((t) => ({ id: t.id, name: t.name, english:t.metadata?.englishName, source: t.source }))
const uid = () => crypto.randomUUID()
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message)
}
function index<T extends { key: string }>(rows: T[], label: string) {
  need(new Set(rows.map((r) => r.key)).size === rows.length, label + '编号重复')
  return new Map(rows.map((r) => [r.key, r]))
}
export function floorCells(scene: AuthorScene) {
  const cells = new Set<string>()
  for (const r of scene.floors) {
    need(r.x + r.width <= scene.width && r.y + r.height <= scene.height, scene.name + '楼层越界')
    for (let y = r.y; y < r.y + r.height; y++)
      for (let x = r.x; x < r.x + r.width; x++) cells.add(`${x},${y}`)
  }
  const reached = new Set<string>(),
    queue = [`${scene.landing.x},${scene.landing.y}`]
  need(cells.has(queue[0]!), scene.name + '入场落点不在楼层')
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i]!
    if (reached.has(k)) continue
    reached.add(k)
    const [x, y] = k.split(',').map(Number)
    for (const [a, b] of [
      [x! - 1, y!],
      [x! + 1, y!],
      [x!, y! - 1],
      [x!, y! + 1],
    ]) {
      const next = `${a},${b}`
      if (cells.has(next) && !reached.has(next)) queue.push(next)
    }
  }
  need(reached.size === cells.size, scene.name + '楼层存在不可达区域，请补充通道')
  return cells
}
export function compileAuthoring(input: unknown, inputText?: string) {
  if (inputText !== undefined) assertAuthoringBytes(inputText)
  assertAuthoringBytes(JSON.stringify(input))
  const source = parseAuthoringValue(input),
    scenes = index(source.scenes, '场景'),
    npcs = index(source.npcs, 'NPC')
  const suppliedPacks = source.itemPacks ?? []
  need(
    !suppliedPacks.some((p) => BUILTIN_PACKS.some((b) => b.id === p.id)),
    '自定义物品包不能覆盖内置规则',
  )
  const ruleItems = catalogue([...BUILTIN_PACKS, ...suppliedPacks]).items.filter((i) => i.kind !== 'pack')
  const itemExists = (id: string) => ruleItems.some((i) => i.id === id)
  for (const n of source.npcs) {
    index(n.consumables ?? [], 'NPC ' + n.key + '消耗品')
    for (const [kind, rows] of [['stock', n.stock ?? []], ['consumables', n.consumables ?? []]] as const)
      for (const row of rows) need(itemExists(row.itemId), `NPC ${n.key}：${kind}物品引用缺失：${row.itemId}`)
    for (const id of [...n.merchantPolicy?.buyItems ?? [], ...n.merchantPolicy?.blockedItems ?? []])
      need(itemExists(id), `NPC ${n.key}：交易策略物品引用缺失：${id}`)
  }
  const arrivals = index(source.arrivals, '出场组'),
    battles = index(source.battles, '战斗')
  for(const d of [source.designNotebook?.story,source.designNotebook?.specification])if(d){const errors=stageIssues(d,d.stage==='specification'?source.designNotebook?.story:undefined).filter(i=>i.level==='error');need(!errors.length,'设计书引用错误：'+errors.map(i=>i.path+':'+i.message).join('；'))}
  const capacity = authoringBudget(
    source,
    new TextEncoder().encode(inputText ?? JSON.stringify(input)).length,
  )
  need(scenes.has(source.start), '起始场景引用缺失')
  const sceneIds = new Map(source.scenes.map((s) => [s.key, uid()])),
    npcIds = new Map(source.npcs.map((n) => [n.key, uid()]))
  const groupIds = new Map(source.arrivals.map((g) => [g.key, uid()])),
    battleIds = new Map(source.battles.map((g) => [g.key, uid()]))
  const supplyIds=new Map(source.npcs.flatMap(n=>(n.consumables??[]).map(r=>[n.key+'/'+r.key,uid()] as const)))
  const spatialIds=new Map(source.scenes.flatMap(s=>(s.spatialSetup?.objects??[]).map(o=>[s.key+'/'+o.id,uid()] as const)))
  const pointIds = new Map<string, string>(),
    floors = new Map<string, Set<string>>()
  const s = newScript(source.title)
  s.designNotebook = source.designNotebook ? clone(source.designNotebook) : undefined
  const factionIds=new Map(source.knowledgeDesign?.factions.map(f=>[f.id,uid()])??[]),knowledgeIds=new Map(source.knowledgeDesign?.templates.map(t=>[t.id,uid()])??[])
  need(factionIds.size===(source.knowledgeDesign?.factions.length??0)&&knowledgeIds.size===(source.knowledgeDesign?.templates.length??0),'阵营／知识模板编号重复')
  s.knowledgeDesign=source.knowledgeDesign?{factions:source.knowledgeDesign.factions.map(f=>({...f,...(f.practical?{practical:{...f.practical,enabled:false}}:{}),id:factionIds.get(f.id)!})),templates:source.knowledgeDesign.templates.map(t=>({...t,id:knowledgeIds.get(t.id)!}))}:undefined
  s.packs = clone(suppliedPacks)
  s.dependencies.push(...suppliedPacks.map((p) => ({ id: p.id, version: p.version })))
  if (source.contentLocale) s.ai.contentLocale = source.contentLocale
  s.metadata = {
    ...s.metadata,
    ...(source.contentLocale ? {contentLocale:source.contentLocale} : {}),
    author: source.author,
    description: source.description,
    levels: { min: source.level, max: source.level },
    players: { min: source.players, max: source.players },
    startSceneId: sceneIds.get(source.start)!,
    landing: scenes.get(source.start)!.landing,
  }
  s.scenes = source.scenes.map((a) => {
    index(a.points, a.name + '互动点')
    index(a.ground, a.name + '物品')
    for (const p of a.points) pointIds.set(a.key + '/' + p.key, uid())
    const floor = floorCells(a)
    for (const cell of a.fog?.initial ?? []) {
      const [x, y] = cell.split(',').map(Number)
      need(x! >= 0 && y! >= 0 && x! < a.width && y! < a.height, `场景 ${a.key}：fog.initial包含越界格：${cell}`)
    }
    floors.set(a.key, floor)
    const { encounterId: _e, template: _t, ...scene } = newScene(a.name)
    scene.id = sceneIds.get(a.key)!
    scene.note = a.description
    if(a.fog){
      need(new Set(a.fog.areas?.map(r=>r.id)??[]).size===(a.fog.areas?.length??0),`场景 ${a.key}：封闭区域ID重复`)
      scene.fog={...clone(a.fog),areas:a.fog.areas?.map(r=>({...clone(r),id:uid(),doorIds:r.doorIds.map(id=>{const mapped=pointIds.get(a.key+'/'+id);need(mapped,`场景 ${a.key}：封闭区域的门引用不存在：${id}`);return mapped})}))}
    }
    if (a.art) scene.art = {...clone(a.art), ...(source.contentLocale ? {contentLocale:source.contentLocale} : {})}
    if(a.spatialSetup){scene.spatialSetup=clone(a.spatialSetup);scene.spatialSetup.objects=scene.spatialSetup.objects.map(o=>({...o,id:spatialIds.get(a.key+'/'+o.id)!}));for(const o of scene.spatialSetup.objects)need(o.x<a.width&&o.y<a.height,'初始空间物件超出场景：'+o.name)}
    scene.grid = { ...scene.grid, columns: a.width, rows: a.height }
    const enclose =
      (a.boundaryWalls ??
        (a.environment && a.environment !== 'indoor' ? 'explicit-only' : 'auto-enclose')) ===
      'auto-enclose'
    if (a.environment) scene.environment = a.environment
    if (a.environment || a.boundaryWalls)
      scene.boundaryWalls = enclose ? 'auto-enclose' : 'explicit-only'
    scene.walls = []
    const blocked: string[] = []
    for (let y = 0; y < a.height; y++)
      for (let x = 0; x < a.width; x++) if (!floor.has(`${x},${y}`)) blocked.push(`${x},${y}`)
    if (blocked.length)
      scene.regions.push({
        id: uid(),
        name: a.environment ? '不可通行区域' : '结构墙体',
        cells: blocked,
        tags: ['blocked'],
        height: null,
        hidden: false,
        color: '#313b40',
        note: '',
      })
    for (const k of enclose ? floor : []) {
      const [x, y] = k.split(',').map(Number)
      const edges = [
        { nx: x! - 1, ny: y!, a: { x: x!, y: y! }, b: { x: x!, y: y! + 1 } },
        { nx: x! + 1, ny: y!, a: { x: x! + 1, y: y! }, b: { x: x! + 1, y: y! + 1 } },
        { nx: x!, ny: y! - 1, a: { x: x!, y: y! }, b: { x: x! + 1, y: y! } },
        { nx: x!, ny: y! + 1, a: { x: x!, y: y! + 1 }, b: { x: x! + 1, y: y! + 1 } },
      ]
      for (const edge of edges)
        if (!floor.has(`${edge.nx},${edge.ny}`))
          scene.walls.push({
            id: uid(),
            name: '结构墙',
            a: edge.a,
            b: edge.b,
            kind: 'wall',
            state: 'closed',
            pointId: null,
            blocksMovement: true,
            blocksSight: true,
            blocksTargeting: true,
            hidden: false,
            color: '#313b40',
          })
    }
    scene.walls = compileAuthorWalls(a, scene.walls, pointIds)
    assertCapacity(
      `场景${a.name}编译墙段 [scenes.${a.key}.compiledWalls]`,
      scene.walls.length,
      SCENE_CAPACITY.walls,
    )
    capacity.metrics.push({
      path: `scenes.${a.key}.compiledWalls`,
      label: `${a.name}·编译墙段`,
      current: scene.walls.length,
      maximum: SCENE_CAPACITY.walls,
    })
    if (scene.walls.length >= SCENE_CAPACITY.walls * 0.8)
      capacity.warnings.push(
        `${a.name}编译墙段已达80%预算：${scene.walls.length}／${SCENE_CAPACITY.walls}`,
      )
    validatePointFootprints(a, floor)
    return scriptSceneSchema.parse(scene)
  })
  const assigned = new Set<string>()
  for (const g of source.arrivals) {
    need(scenes.has(g.scene), '出场组场景引用缺失')
    need(new Set(g.npcs).size === g.npcs.length, '出场组成员重复')
    for (const k of g.npcs) {
      need(npcs.get(k)?.scene === g.scene && !assigned.has(k), '出场组NPC引用无效或重复分组')
      assigned.add(k)
    }
    s.scenes.find((a) => a.id === sceneIds.get(g.scene))!.arrivalGroups ??= []
    s.scenes
      .find((a) => a.id === sceneIds.get(g.scene))!
      .arrivalGroups!.push({
        id: groupIds.get(g.key)!,
        name: g.name,
        npcIds: g.npcs.map((k) => npcIds.get(k)!),
        battleMode: g.battleMode,
        intro: g.intro,
        ...(g.manualReason?{manualReason:g.manualReason}:{}),
      })
  }
  const occupied = new Map<string, Set<string>>()
  for(const faction of s.knowledgeDesign?.factions??[])for(const policy of faction.policies??[]){const scene=sceneIds.get(policy.sceneId),point=pointIds.get(policy.sceneId+'/'+policy.pointId);need(scene&&point,'声望策略场景或互动点引用缺失');policy.id=uid();policy.sceneId=scene;policy.pointId=point;if(policy.proxyNpcIds)policy.proxyNpcIds=policy.proxyNpcIds.map(id=>{need(npcIds.has(id),'声望代理NPC引用缺失');return npcIds.get(id)!})}
  s.npcs = source.npcs.map((a) => {
    need(scenes.has(a.scene), a.name + '场景引用缺失')
    need(!a.initialSupport || a.initialHeight !== undefined, `NPC ${a.key}：初始支撑必须同时填写initialHeight`)
    need(a.cardType === 'character' || a.template, a.name + '模板简明卡缺少template')
    const template = npcTemplate(a.template ?? 'srd-wolf'),
      n = newNpcProfile(sceneIds.get(a.scene)!, a.type)
    const span =
      template.body.size === 'large'
        ? 2
        : template.body.size === 'huge'
          ? 3
          : template.body.size === 'gargantuan'
            ? 4
            : 1
    const used = occupied.get(a.scene) ?? new Set<string>()
    occupied.set(a.scene, used)
    for (let y = a.y; y < a.y + span; y++)
      for (let x = a.x; x < a.x + span; x++) {
        const k = `${x},${y}`
        need(floors.get(a.scene)!.has(k), a.name + '落点无效')
        need(!used.has(k), a.name + '落点重叠')
        used.add(k)
        const landing = scenes.get(a.scene)!.landing
        need(k !== `${landing.x},${landing.y}`, a.name + '占据入场落点')
      }
    n.id = npcIds.get(a.key)!
    if(a.knowledgeProfile){const p=a.knowledgeProfile;need(!p.factionId||factionIds.has(p.factionId),'NPC组织引用缺失');need(p.templateIds.every(id=>knowledgeIds.has(id)),'NPC知识模板引用缺失');n.knowledgeProfile={...p,factionId:p.factionId?factionIds.get(p.factionId)!:null,templateIds:p.templateIds.map(id=>knowledgeIds.get(id)!)}}
    n.name = a.name
    n.merchantPolicy=a.merchantPolicy?{...clone(a.merchantPolicy),practical:a.merchantPolicy.practical?{...clone(a.merchantPolicy.practical),enabled:false}:undefined}:undefined
    n.stock=a.stock?.map(row=>({...row,id:uid()}))??[]
    n.position = { x: a.x, y: a.y }
    n.side = a.side
    n.hidden = a.hidden
    n.initiallyAbsent = assigned.has(a.key)
    n.description = a.description
    n.personality = a.personality
    n.persona = a.persona ? clone(a.persona) : undefined
    n.publicSpeechStyle = a.publicSpeechStyle
    n.gmDesign = a.gmDesign ? clone(a.gmDesign) : undefined
    need(a.type === 'important' || a.importanceRole !== 'companion', '普通NPC不能设为可随队')
    n.knowledge = a.knowledge
    n.publicKnowledge = a.knowledge ? [{ id: uid(), text: a.knowledge }] : []
    n.publicDialogue = a.description
    n.secrets = a.secret ? [{ id: uid(), text: a.secret }] : []
    if(a.resourceStrategy)n.combatPolicy.resourceStrategy=a.resourceStrategy
    if(a.practicalSocial){
      const effect=(value:typeof a.practicalSocial.rules[number]['success'])=>({...clone(value),operations:remapSocialOperations(value.operations,id=>{const ref=pointIds.get(a.scene+'/'+id);need(ref,'交涉互动后果须引用本场景已有互动点');return ref!},id=>{const ref=battleIds.get(id);need(ref,'交涉战斗支援预设引用缺失');return ref!}),revealIds:value.revealIds.map(id=>{need(id==='secret'&&n.secrets[0],'交涉公开线索只能引用本NPC已填写的secret');return n.secrets[0]!.id})})
      n.practicalSocial={enabled:false,rules:a.practicalSocial.rules.map(r=>({...clone(r),id:uid(),success:effect(r.success),failure:effect(r.failure)}))}
    }
    if(a.spatialPolicy)n.spatialPolicy={...clone(a.spatialPolicy),enabled:false,autoMove:false,autoPlan:false,knownExits:a.spatialPolicy.knownExits.map(k=>{need(sceneIds.has(k.sceneId)&&pointIds.has(k.sceneId+'/'+k.pointId),'NPC已知出口引用缺失');return {sceneId:sceneIds.get(k.sceneId)!,pointId:pointIds.get(k.sceneId+'/'+k.pointId)!}}),practical:a.spatialPolicy.practical?{...clone(a.spatialPolicy.practical),enabled:false,pointIds:a.spatialPolicy.practical.pointIds.map(id=>{need(pointIds.has(a.scene+'/'+id),'NPC自动互动引用缺失');return pointIds.get(a.scene+'/'+id)!})}:undefined}
    n.fallbackReply = a.dialogue || n.fallbackReply
    if (a.importanceRole) n.importanceRole = a.importanceRole
    if (a.fixedReplies) n.fixedReplies = a.fixedReplies.map((r) => ({ id: uid(), text: r.text, ...(r.localized ? {localized:clone(r.localized)} : {}) }))
    if (a.fixedReplyMode) n.fixedReplyMode = a.fixedReplyMode
    if (a.fixedReplyEndLocales) n.fixedReplyEndLocales = clone(a.fixedReplyEndLocales)
    if (a.fixedReplyEnd) n.fixedReplyEnd = a.fixedReplyEnd
    if (a.consumables)
      n.consumables = a.consumables.map((r) => ({
        id: supplyIds.get(a.key+'/'+r.key)!,
        itemId: r.itemId,
        quantity: r.quantity,
      }))
    n.body = template.body
    n.body.name = a.name
    if (a.cardType === 'character') {
      need(a.type === 'important' && a.character, '完整职业卡仅供重要NPC，必须填写character')
      let card
      try {
        card = compileNpcCharacter(
          a.character,
          a.name,
          n.id,
          catalogue([...BUILTIN_PACKS, ...s.packs]),
        )
      } catch (e) {
        throw Error('NPC ' + a.key + '：' + (e instanceof Error ? e.message : '职业卡无效'))
      }
      s.characters.push(card)
      n.characterId = card.id
      n.body = null
      n.abilities = []
    } else need(!a.character, '模板卡不能同时携带character职业卡')
    const character = s.characters.find((c) => c.id === n.characterId)
    if(a.coinsGP!==undefined){if(character)character.coins=a.coinsGP;else n.coins=a.coinsGP}
    n.abilities = npcCapabilities(
      {
        adventures: [],
        encounters: [],
        packs: s.packs,
        characters: character
          ? [
              {
                ...character,
                status: 'complete',
                purpose: 'npc',
                npcOwnerId: n.id,
                revision: 0,
                runtime: null,
                journal: [],
                createdAt: new Date(0).toISOString(),
                updatedAt: new Date(0).toISOString(),
              },
            ]
          : [],
      },
      n,
      true,
    )
    // Serialize only static fields; no runtime memories, effects or authorization.
    const value = Object.fromEntries(
      Object.keys(scriptNpcSchema.shape).map((k) => [
        k,
        (n as unknown as Record<string, unknown>)[k],
      ]),
    )
    const body = n.body ? (({ effects: _effects, ...body }) => body)(n.body) : null
    const {
      characterIds: _c,
      remaining: _r,
      expiresAt: _at,
      ...preauthorization
    } = n.preauthorization
    return scriptNpcSchema.parse({ ...value, body, preauthorization })
  })
  s.battles = source.battles.map((b) => {
    need(scenes.has(b.scene), '战斗场景引用缺失')
    need(new Set(b.npcs).size === b.npcs.length, '战斗成员重复')
    for (const k of b.npcs) need(npcs.get(k)?.scene === b.scene, '战斗NPC引用或场景无效')
    return {
      practical:b.practical?{...clone(b.practical),enabled:false,entry:b.practical.entry?.map(entry=>{need(npcIds.has(entry.npcId),'参战策略NPC引用缺失');return {...clone(entry),npcId:npcIds.get(entry.npcId)!}})}:undefined,
      id: battleIds.get(b.key)!,
      sceneId: sceneIds.get(b.scene)!,
      name: b.name,
      intro: b.intro,
      participants: b.npcs.map((k) => ({
        kind: 'npc' as const,
        id: npcIds.get(k)!,
        side: npcs.get(k)!.side,
      })),
    }
  })
  const arrivalCells = new Map<string, string[]>()
  for (const a of source.scenes) {
    const cells: string[] = [],
      pending = [`${a.landing.x},${a.landing.y}`],
      seen = new Set(pending)
    for (let i = 0; i < pending.length && cells.length < Math.max(9, source.players); i++) {
      const cell = pending[i]!
      cells.push(cell)
      const [x, y] = cell.split(',').map(Number)
      for (const [nx, ny] of [
        [x! - 1, y!],
        [x! + 1, y!],
        [x!, y! - 1],
        [x!, y! + 1],
      ]) {
        const k = `${nx},${ny}`
        if (!seen.has(k) && floors.get(a.key)!.has(k) && !occupied.get(a.key)?.has(k)) {
          seen.add(k)
          pending.push(k)
        }
      }
    }
    need(cells.length >= source.players, a.name + '入场区域不足以容纳队伍')
    arrivalCells.set(a.key, cells)
  }
  function broadcast(
    title: string,
    text: string,
    trigger: 'story' | 'scene' | 'point' | 'manual',
    scene: string | null = null,
    point: string | null = null,
    result: 'any' | 'success' | 'failure' = 'any',
    audience: 'public' | 'gm' = 'public',
  ) {
    if (!text) return
    const outcome = trigger === 'point' && result !== 'any'
    s.broadcasts.push({
      ...newBroadcastTemplate(),
      title: title.slice(0, 120),
      text,
      trigger: outcome ? 'event' : trigger,
      ...(outcome ? { eventType: 'point.result' } : {}),
      sceneId: scene,
      targetId: point,
      policy: trigger === 'manual' ? 'manual' : 'once',
      result,
      audience: { kind: audience, characterIds: [] },
    })
  }
  s.openingPresentation=source.openingPresentation ? clone(source.openingPresentation) : undefined
  if(s.openingPresentation)s.openingPresentation.identities=s.openingPresentation.identities.map(i=>{const match=/^player-([1-9]\d*)$/.exec(i.characterId);if(!match||Number(match[1])>source.players)throw Error('开场身份须用player-1至player-'+source.players+'关联角色位');const role={id:uid(),name:'玩家身份 '+match[1],required:true};s.roles.push(role);return {...i,characterId:'role:'+role.id}})
  broadcast('故事开场', source.opening, 'story')
  for (const a of source.scenes) {
    const scene = s.scenes.find((x) => x.id === sceneIds.get(a.key))!
    broadcast(a.name + '开场', a.intro, 'scene', scene.id)
    scene.points = a.points.map((p) => {
      need(floors.get(a.key)!.has(`${p.x},${p.y}`), a.name + '/' + p.name + '落点无效')
      const out = {
        ...newPoint(p.kind, { x: p.x, y: p.y }),
        id: pointIds.get(a.key + '/' + p.key)!,
        name: p.name,
        note: p.text,
        revealed: p.text,
        hidden: p.hidden,
        ...(p.repeatAccess!==undefined?{repeatAccess:p.repeatAccess}:{}),
        ...(p.discovery ? { discovery: clone(p.discovery) } : {}),
        ...(p.appearance ? { appearance: clone(p.appearance) } : {}),
      }
      const door = scene.walls.find((w) => w.kind === 'door' && w.pointId === out.id)
      if (door) out.state = door.state
      need(p.kind !== 'exit' || p.exit, '出口缺少目标场景与配对点')
      if (p.check) out.check = { kind: 'skill', id: p.check.skill, dc: p.check.dc }
      if (p.itemUse) {
        const items = catalogue([...BUILTIN_PACKS, ...s.packs]).items
        for (const r of p.itemUse.requirements) need(items.some(i=>i.id===r.itemId && i.kind!=='pack'), '互动条件物品引用缺失：'+r.itemId)
        need(p.itemUse.effect!=='open' || ['door','chest'].includes(p.kind), '直接打开只适用门／容器')
        need(p.itemUse.fallback!=='check' || !!p.check, '备用检定必须配置检定')
        out.itemUse = clone(p.itemUse)
      }
      if (p.container) {
        need(p.kind === 'chest', '容器战利品只能放入宝箱／物品堆')
        const items = catalogue([...BUILTIN_PACKS, ...s.packs]).items
        for (const item of p.container.items)
          need(
            items.some((i) => i.id === item.itemId && i.kind !== 'pack'),
            '容器物品引用缺失：' + item.itemId,
          )
        need(
          new Set(p.container.items.map((i) => i.itemId)).size === p.container.items.length,
          '容器物品引用重复，请合并数量',
        )
        out.loot = clone(p.container.items)
        out.coins = p.container.coins
        out.containerDesign = {
          ...(p.container.emptyReason ? { emptyReason: p.container.emptyReason } : {}),
          ...(p.container.gmNote ? { gmNote: p.container.gmNote } : {}),
        }
      }
      if (p.exit) {
        const to = scenes.get(p.exit.scene)?.points.find((q) => q.key === p.exit!.point)
        need(
          p.kind === 'exit' && p.exit.scene !== a.key && to?.kind === 'exit',
          '出口引用缺失或类型错误',
        )
        need(to.exit?.scene === a.key && to.exit.point === p.key, '出口必须互相配对')
        out.targetSceneId = sceneIds.get(p.exit.scene)!
        out.landing = scenes.get(p.exit.scene)!.landing
        out.portal = {
          targetPointId: pointIds.get(p.exit.scene + '/' + p.exit.point)!,
          bidirectional: true,
          arrival: { anchor: a.landing, cells: arrivalCells.get(a.key)!, relative: true },
        }
      }
      if (p.rescueNpc) {
        need(npcs.get(p.rescueNpc)?.scene === a.key, '解救NPC引用缺失')
        out.storyResults = [
          {
            id: uid(),
            type: 'rescued',
            npcId: npcIds.get(p.rescueNpc)!,
            outcome: 'success',
            text: p.text || p.name,
            requiresGM: true,
          },
        ]
      }
      if (p.arrivalGroup) {
        need(arrivals.get(p.arrivalGroup)?.scene === a.key, '互动出场组引用缺失')
        out.arrivalGroupIds = [groupIds.get(p.arrivalGroup)!]
      }
      if(p.failureArrivalGroup){
        need(arrivals.get(p.failureArrivalGroup)?.scene===a.key,'失败出场组引用缺失或跨场景');
        out.failureArrivalGroupIds=[groupIds.get(p.failureArrivalGroup)!];
      }
      if (p.battle) {
        need(battles.get(p.battle)?.scene === a.key, '互动战斗引用缺失')
        out.battlePresetId = battleIds.get(p.battle)!
      }
      broadcast(p.name + '成功', p.success ?? '', 'point', scene.id, out.id, 'success')
      broadcast(p.name + '失败', p.failure ?? '', 'point', scene.id, out.id, 'failure')
      return scriptSceneSchema.shape.points.element.parse(out)
    })
    scene.pointLinks = a.links?.map((g) => ({
      id: uid(),
      name: g.name,
      color: g.color,
      sourcePointId: pointIds.get(a.key + '/' + g.source) ?? g.source,
      outcome: g.outcome,
      effects: g.effects.map((e) => ({
        pointId: pointIds.get(a.key + '/' + e.point) ?? e.point,
        operation: e.operation,
      })),
      arrivalGroupIds: g.arrivalGroups?.map((id) => groupIds.get(id) ?? id),
    }))
    scene.groundItems = a.ground.map((g) => {
      need(floors.get(a.key)!.has(`${g.x},${g.y}`), '地面物品落点无效')
      need(itemExists(g.item), `场景 ${a.key}：地面物品引用缺失：${g.item}`)
      return {
        id: uid(),
        x: g.x,
        y: g.y,
        itemId: g.item,
        name: g.item,
        icon: '◆',
        color: '#b78846',
        note: '',
        initialQuantity: g.quantity,
        quantity: g.quantity,
        hidden: g.hidden,
        enabled: true,
        range: 5,
        requiresGM: false,
        cost: 'free' as const,
      }
    })
  }
  for (const b of source.broadcasts) {
    need(!b.scene || scenes.has(b.scene), '广播场景引用缺失')
    const p = b.point && b.scene ? pointIds.get(b.scene + '/' + b.point) : undefined
    need(!b.point || p, '广播互动点引用缺失')
    need(b.trigger !== 'scene' || b.scene, '场景广播缺场景')
    need(b.trigger !== 'point' || p, '互动广播缺目标')
    broadcast(
      b.title,
      b.text,
      b.trigger,
      b.scene ? sceneIds.get(b.scene)! : null,
      p ?? null,
      b.result,
      b.audience,
    )
  }
  if (source.quests) {
    index(source.quests, '任务')
    s.quests = source.quests.map((q) => {
      need(!q.scene || sceneIds.has(q.scene), '任务场景引用缺失')
      need(!q.point || (!!q.scene && pointIds.has(q.scene + '/' + q.point)), '任务互动点引用缺失')
      const stepIds = new Map(q.steps?.map((s) => [s.key, uid()]) ?? [])
      need(stepIds.size === (q.steps?.length ?? 0), '小目标编号重复')
      return {
        id: uid(),
        gmDesign: q.gmDesign
          ? {
              ...clone(q.gmDesign),
              npcIds: q.gmDesign.npcIds.map((k) => {
                need(npcIds.has(k), '任务关联NPC引用缺失')
                return npcIds.get(k)!
              }),
            }
          : undefined,
        title: q.title,
        chapter: q.chapter,
        description: q.description,
        initialStatus: q.initialStatus,
        visibility: q.visibility,
        characterIds: [],
        main: q.main,
        current: q.current,
        sceneId: q.scene ? sceneIds.get(q.scene)! : null,
        pointId: q.point && q.scene ? pointIds.get(q.scene + '/' + q.point)! : null,
        pinnedStepId: q.pinnedStep ? (stepIds.get(q.pinnedStep) ?? q.pinnedStep) : undefined,
        steps: q.steps?.map((step) => ({
          id: stepIds.get(step.key)!,
          title: step.title,
          description: step.description,
          initialStatus: step.initialStatus,
          visibility: step.visibility,
          afterIds: step.after.map((id) => stepIds.get(id) ?? id),
          sceneId: step.scene ? (sceneIds.get(step.scene) ?? step.scene) : undefined,
          pointId:
            step.point && step.scene
              ? (pointIds.get(step.scene + '/' + step.point) ?? step.point)
              : undefined,
          arrivalGroupId: step.arrival ? (groupIds.get(step.arrival) ?? step.arrival) : undefined,
          trigger: step.trigger,
          alternatives: step.alternatives,
          gmNote: step.gmNote,
          automatic:step.automatic,activateNext:step.activateNext,attribution:step.attribution,proxyNpcIds:step.proxyNpcIds?.map(id=>{need(npcIds.has(id),'任务代理NPC引用缺失');return npcIds.get(id)!}),
        })),
      }
    })
    capacity.metrics.push({
      path: 'quests',
      label: '任务',
      current: source.quests.length,
      maximum: 100,
    })
  }
  if (source.growthGuide) {
    const questIds = new Map((source.quests ?? []).map((q, i) => [q.key, s.quests![i]!.id]))
    s.growthGuide = {
      ...clone(source.growthGuide),
      steps: source.growthGuide.steps.map((step) => {
        need(!step.sceneId || sceneIds.has(step.sceneId), '成长参考场景引用缺失')
        need(!step.questId || questIds.has(step.questId), '成长参考任务引用缺失')
        return {
          ...clone(step),
          sceneId: step.sceneId ? sceneIds.get(step.sceneId)! : undefined,
          questId: step.questId ? questIds.get(step.questId)! : undefined,
        }
      }),
    }
  }
  for(const authored of source.scenes)if(authored.effectSetup){const scene=s.scenes.find(s=>s.id===sceneIds.get(authored.key))!,setup=clone(authored.effectSetup),object=(id:string)=>{const out=spatialIds.get(authored.key+'/'+id);need(out,'初始场景物件引用缺失：'+id);return out},npc=(id:string)=>{const mapped=npcIds.get(id);need(mapped,'初始来源NPC引用缺失：'+id);return mapped},point=(id:string)=>{const mapped=pointIds.get(authored.key+'/'+id);need(mapped,'初始互动点引用缺失：'+id);return mapped};setup.regions=setup.regions.map(e=>({...e,id:uid(),sourceNpcId:e.sourceNpcId?npc(e.sourceNpcId):undefined,objectId:e.objectId?object(e.objectId):undefined,pointId:e.pointId?point(e.pointId):undefined,terrain:e.terrain?{...e.terrain,supportIds:e.terrain.supportIds.map(object)}:undefined,magic:e.magic?{...e.magic,excludedIds:e.magic.excludedIds.map(id=>{const mapped=npcIds.get(id);need(mapped,'初始排除人物引用缺失');return mapped}),pointId:undefined}:undefined}));setup.containers=setup.containers.map(c=>({...c,id:uid(),objectId:object(c.objectId)}));setup.materials=setup.materials.map(m=>{const npc=npcIds.get(m.npcId),row=supplyIds.get(m.npcId+'/'+m.consumableId);need(npc&&row,'初始材料须对应NPC已定义consumables');return {...m,id:uid(),npcId:npc,consumableId:row}});scene.effectSetup=setup;validateInitialScene(scene,setup,s.npcs.map(n=>n.id),s.npcs)}
  for (const scene of s.scenes) {
    validateExploration(scene)
    scene.tokens.push(...missingNpcTokens(scene, s.npcs))
    for(const t of scene.tokens){const npc=source.npcs.find(n=>npcIds.get(n.key)===t.npcId);if(npc?.initialHeight!==undefined){
      const support=npc.initialSupport?spatialIds.get(npc.scene+'/'+npc.initialSupport):undefined
      need(!npc.initialSupport||!!support,'初始空间支撑引用缺失：'+npc.name)
      t.initialSpatialHeight=npc.initialHeight;t.initialSupportId=support;t.spatial={height:npc.initialHeight,layer:'material',...(support?{supportId:support}:{})}
    }}
  }
  const documentBytes = new TextEncoder().encode(JSON.stringify(s)).length
  assertCapacity('正式剧本文档 [definition]', documentBytes, SCRIPT_DOCUMENT_BYTES)
  capacity.metrics.push({
    path: 'definition',
    label: '正式剧本文档',
    current: documentBytes,
    maximum: SCRIPT_DOCUMENT_BYTES,
    bytes: true,
  })
  if (documentBytes >= SCRIPT_DOCUMENT_BYTES * 0.8)
    capacity.warnings.push('正式剧本文档已达80%预算')
  const definition = inspectScript(s).definition
  return {
    source,
    definition,
    layouts: source.scenes,
    capacity,
    warnings: [
      ...capacity.warnings,
      ...authoringArrivalWarnings(source),
      ...authoringConfigurationFindings(source).map((f) => `[${f.path}] ${f.message}`),
      ...(source.quests ?? []).flatMap((q) =>
        !q.steps?.length
          ? [q.title + '未设计阶段小目标；请补充当前可执行步骤与替代路线']
          : q.steps.flatMap((s) => [
              ...(!s.scene ? [q.title + '/' + s.title + '未关联可执行场景入口'] : []),
              ...(!s.alternatives?.trim()
                ? [q.title + '/' + s.title + '缺少失败替代路线说明']
                : []),
            ]),
      ),
      ...source.scenes.flatMap((a) => {
        const warnings: string[] = []
        if (!a.art) warnings.push(a.name + '未提供细化美术资料；不会自动把剧情说明传给生图模型。')
        for (const p of a.points)
          if (p.kind === 'chest' && !p.container)
            warnings.push(
              a.name +
                '/' +
                p.name +
                '未提供容器战利品设计；新创作需填写物品或刻意为空的原因（旧JSON兼容）',
            )
        for (const p of a.points)
          if (p.hidden && !p.discovery)
            warnings.push(
              a.name +
                '/' +
                p.name +
                '未设计隐藏点发现方式；新创作需明确proximity、gm或linked（旧JSON兼容）',
            )
        const missing = a.points.filter(
          (p) => ['chest', 'trap', 'clue'].includes(p.kind) && !p.appearance,
        ).length
        if (missing)
          warnings.push(
            a.name +
              '有' +
              missing +
              '个互动点未提供外观，生图包不会绘制这些对象；纯触发点可明确设为omit。',
          )
        for (const p of a.points.filter((p) => p.kind === 'door'))
          if (!a.walls?.some((w) => w.kind === 'door' && w.point === p.key))
            warnings.push(a.name + '/' + p.name + '只有门互动点，尚未关联结构门。')
        return warnings
      }),
      '程序地图不包含NPC或秘密标记；重要NPC可选择模板简明卡或已校验的完整职业卡。',
      '开战名单仍需GM加入实际玩家角色并确认先攻；导入不自动开战或播放广播。',
    ],
  }
}
export type CompiledAuthoring = ReturnType<typeof compileAuthoring>
export function checkSceneLocks(source: Authoring, snapshots: Record<string, AuthorScene>) {
  for (const [key, saved] of Object.entries(snapshots))
    need(
      JSON.stringify(source.scenes.find((s) => s.key === key)) === JSON.stringify(saved),
      '场景已锁定：' + saved.name + '；请先解锁再修改或替换',
    )
}
export function replaceAuthorScene(source: Authoring, input: unknown, locked: string[]) {
  const next = authorSceneSchema.parse(input)
  need(!locked.includes(next.key), '场景已锁定，请先解锁')
  need(
    source.scenes.some((s) => s.key === next.key),
    '替换场景编号不存在',
  )
  const result = clone(source)
  result.scenes = result.scenes.map((s) => (s.key === next.key ? next : s))
  compileAuthoring(result)
  return result
}
export function authoringPrompt(
  brief: string,
  example: Authoring,
  requirements?: AuthoringRequirements,
  itemPacks: Pack[] = [],
  designNotebook?: DesignNotebook,
  instructionLocale?: Locale,
) {
  if ((instructionLocale ?? requirements?.contentLocale) === 'en') {
    const c = catalogue([...BUILTIN_PACKS, ...itemPacks])
    return `${ENGLISH_AUTHORING_GUIDE}\n${ENGLISH_VALIDATION_GUIDE}\n${ENGLISH_VISUAL_GUIDE}\n${outputLanguageInstruction(requirements?.contentLocale ?? 'zh-CN')}\nRequirements:\n${authoringRequirementText(brief, requirements, 'en')}\nIndependent design attachments (preserve all keys and locked content):\n${designContextText(designNotebook)}\nModule preferences:\n${JSON.stringify(requirements?.modules ?? {})}\nNPC catalogue:\n${JSON.stringify(authoringCatalogue())}\nLegal character choices:\n${JSON.stringify({classes:c.classes,backgrounds:c.backgrounds,species:c.species,feats:c.feats,spells:c.spells.map(s=>({id:s.id,name:s.name,english:s.english,level:s.level,lists:s.lists})),items:c.items})}\nSupplied custom item packs:\n${JSON.stringify(itemPacks)}\nClass build and growth examples (structure only; select only the matching class):\n${JSON.stringify(characterGrowthExamples.filter(row=>example.npcs.some(n=>n.character?.build.classId===row.classId)))}\nStructural example (existing sample prose is not the requested output language):\n${JSON.stringify(example)}\nFull schema:\n${JSON.stringify(z.toJSONSchema(authoringSchema,{io:'input'}))}`
  }
  const request =
    authoringRequirementText(brief, requirements) + designContextText(designNotebook) +
    '\n完整职业卡构建：下载ZIP提供12职业的一级和2–5级示例，纯文本仅附当前示例所需职业；其他职业按完整Schema与合法目录选择，不复制不适用职业选项。' +
    JSON.stringify(characterExamples.filter((row) => example.npcs.some((n) => n.character?.build.classId === row.classId))) +
    '\n当前示例所需逐级成长：' +
    JSON.stringify(characterGrowthExamples.filter((row) => example.npcs.some((n) => n.character?.build.classId === row.classId)).map(e=>({classId:e.classId,growth:e.character.growth})))+
    (itemPacks.length
      ? '\nGM已提供自定义物品包（需要时复制到itemPacks，不自行造包）：' + JSON.stringify(itemPacks)
      : '')
  return `制作DND2024工具剧本。契约trpg-authoring/1，能力版本${AUTHORING_CAPABILITIES_VERSION}。仅返回trpg-authoring/1 JSON，不附Markdown或代码。使用下方例子的完整字段结构，保持同类字段类型；不得添加运行历史、代码、密钥、权限或自动结算指令。地图楼层为整数矩形并集，必须连通；所有点位在楼层，NPC占格不得重叠或占入场点。出口双向对应；已有引用修改时保持一致。重要NPC可使用模板简明卡，不伪造职业卡。固定广播直接播放，秘密只能在NPC secret或GM受众广播中。只选目录内模板和工具已有物品。钥匙等物品条件必须使用points[].itemUse结构：match(all/any)、requirements[{itemId,quantity,mode(possess/use/attempt/success)}]、effect(open/prerequisite)、fallback(none/check/gm)；引用工具物品或GM提供itemPacks的稳定ID，备用检定另填check。开容器与领取分开，不默认借队友物品，不仅在文字中写钥匙。\n${authoringVisualInstructions}\n${authoringSpatialInstructions}\n${authoringSceneInstructions}\n${authoringDesignInstructions}\n${AUTHORING_VALIDATION_GUIDE}\n本次模块说明：${authoringModuleInstructions(requirements)}\n需求：${request}\n模板目录：${JSON.stringify(authoringCatalogue())}\n合法物品目录：${JSON.stringify(catalogue([...BUILTIN_PACKS, ...itemPacks]).items.filter(i=>i.kind!=='pack').map(i=>({id:i.id,name:i.name,kind:i.kind})))}\n结构示例：${JSON.stringify(example)}\n完整字段Schema：${JSON.stringify(z.toJSONSchema(authoringSchema, { io: 'input' }))}`
}
