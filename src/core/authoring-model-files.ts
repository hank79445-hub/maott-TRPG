import {localizeSyntheticAuthoringExample} from '../content/authoring-example-language'
import {presentAuthoringProblem} from '../shared/localization/authoring'
import {designContextFiles,designContextText,type DesignNotebook} from './authoring-design-context'
import { ENGLISH_AUTHORING_GUIDE, ENGLISH_VALIDATION_GUIDE, ENGLISH_VISUAL_GUIDE, ENGLISH_MODULES,ENGLISH_CAPABILITIES } from './authoring-language'
import { outputLanguageInstruction, type Locale } from '../shared/localization/locale'
import {
  authoringRequirementText,
  authoringRequirementsSchema,
  authoringDesignInstructions,
  type AuthoringRequirements,
} from './authoring-requirements'
import {
  assertAuthoringBytes,
  NPC_LIMIT,
  AUTHORING_LIMITS,
  BROADCAST_LIMIT,
} from './configuration-limits'
import {authoringSceneInstructions,authoringSceneExample} from './authoring-scene-instructions'
import { authoringVisualInstructions } from './authoring-instructions'
import { z, ZodError } from 'zod'
import {preflightAuthoring} from './authoring-preflight'
import {AUTHORING_VALIDATION_GUIDE} from './authoring-validation-guide'
import { authoringSchema, authorSceneSchema, parseAuthoring } from '../persistence/script-authoring-schema'
import { authoringExample } from '../content/script-authoring-example'
import { authoringV16Example } from '../content/script-authoring-v16-example'
import { authoringDesignExample } from '../content/script-authoring-design-example'
import { authoringCatalogue } from './script-authoring'
import { BUILTIN_PACKS } from '../content/builtin-packs'
import { catalogue, getChoices } from './engine'
import { authoringCharacterSchema } from '../persistence/authoring-character-schema'
import type { Pack } from './types'
import characterExamples from '../content/authoring-character-examples.json'
import characterGrowthExamples from '../content/authoring-character-growth-examples.json'
import { authoringWorkbenchExample } from '../content/script-authoring-workbench-example'
import {
  AUTHORING_MODULES, AUTHORING_CONTRACT, AUTHORING_CAPABILITIES_VERSION,
  authoringModuleInstructions, authoringSupportMatrix,
} from './authoring-modules'

export function readAuthoringModelText(text: string) {
  assertAuthoringBytes(text)
  const normalized = text.replace(/^\uFEFF/, '')
  const match = normalized.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i)
  const cleaned = !!match || normalized !== text
  return { source: parseAuthoring(match ? match[1]! : normalized), cleaned }
}
export function authoringModelFiles(
  brief: string,
  requirements?: AuthoringRequirements,
  itemPacks: Pack[] = [],
  designNotebook?: DesignNotebook,
  instructionLocale?: Locale,
) {
  requirements = requirements ? authoringRequirementsSchema.parse(requirements) : undefined
  const readingLocale = instructionLocale ?? requirements?.contentLocale ?? 'zh-CN'
  const contentLocale = requirements?.contentLocale ?? 'zh-CN'
  const request = authoringRequirementText(brief, requirements,readingLocale)
  const files: Record<string, string> = {
    'validation-guide.txt': AUTHORING_VALIDATION_GUIDE,
    'requirements.txt': request,
    'capabilities.json': JSON.stringify({ contract: AUTHORING_CONTRACT, version: AUTHORING_CAPABILITIES_VERSION, characterLevels: [1, 5], classCount: 12, mechanisms: authoringSupportMatrix }, null, 2),
    'example-workbench.json': JSON.stringify(authoringWorkbenchExample(), null, 2),
    ...Object.fromEntries(AUTHORING_MODULES.map((m) => [`module-${m.id}.txt`, `${m.label}\n字段：${m.paths.join('、')}\n${m.instructions}\n完整作品见example-workbench.json；scene-magic示例仅是场景片段，不能作为整份作品导入。`])),
    'item-packs.json': JSON.stringify(itemPacks, null, 2),
    'character-examples.json': JSON.stringify(characterExamples, null, 2),
    'character-growth-examples.json': JSON.stringify(characterGrowthExamples, null, 2),
    'character-catalogue.json': JSON.stringify(
      (() => {
        const c = catalogue([...BUILTIN_PACKS, ...itemPacks])
        return {
          classes: c.classes,
          backgrounds: c.backgrounds,
          species: c.species,
          feats: c.feats.map((f) => ({ id: f.id, name: f.name, english: f.english })),
          spells: c.spells.map((s) => ({ id: s.id, name: s.name, english: s.english, level: s.level, lists: s.lists })),
          items: c.items.map((i) => ({ id: i.id, name: i.name, english: i.english, kind: i.kind })),
        }
      })(),
      null,
      2,
    ),
    'npc-task-growth-instructions.txt': authoringDesignInstructions,
    'prompt-short.txt': `可选openingPresentation:{opening,background,origin,identities:[{characterId:"player-1",text}]}配置四段开场，身份编号1至players，建立开团角色位；不公开其他角色身份。容器可选repeatAccess，默认true，只重复访问不再生库存。
编写DND2024剧本。需求：${request}\n容量：NPC总数最多${NPC_LIMIT}、场景最多${AUTHORING_LIMITS.scenes}、创作文件2MiB；正式广播（含自动生成）最多${BROADCAST_LIMIT}，不是推荐全部填满。长文件分步生成并保留全部引用，禁止静默省略。仅输出符合schema.json的trpg-authoring/1 JSON。example.json用于字段结构，catalogue.json用于合法模板及物品。保持内部引用和双向出口，楼层必须连通；先细化美术描述和互动对象外观，再安排位置和结构墙门；三层字段规则见visual-instructions.txt；场景光源、区域、机关、材料和补给见scene-magic-instructions.txt及example-scene-magic.json。互动点可选itemUse：match(all/any)、requirements[{itemId,quantity,mode(possess/use/attempt/success)}]、effect(open/prerequisite)、fallback(none/check/gm)。仅引用catalogue.json或自定义packs内的稳定物品编号，钥匙不得仅写在故事里；备用check须配check。开容器与领取分开，不自动借用队友物品。可选quests最多100项，填写主目标/当前目标、初始状态与场景/互动点引用；任务不自动发奖。NPC可选fixedReplies顺序台词、fixedReplyMode(end/loop)、自身consumables(不能替代交易stock)、importanceRole(resident/companion)，不能写运行游标。
${authoringDesignInstructions}\n不写程序、凭据或运行历史。未知能力不要捏造字段，列为工具外人工配置说明。`,
    'scene-magic-instructions.txt':authoringSceneInstructions,
    'example-scene-magic.json':JSON.stringify(authoringSceneExample,null,2),
    'visual-instructions.txt': authoringVisualInstructions,
    'instructions.txt':
      '先读manifest.json的recommendedFiles及requirements.txt，再读精简提示、完整Schema、合法目录和本次所需modules说明；无需一次上传全部12职业成长例子。example-workbench.json是三场景完整综合样本，含职业卡、公私知识、组织、商店、迷雾、实际灯光、钥匙、出场与小目标；例子的自定义包是明确提供的GM示例，不许可另造物品。character-examples.json和character-growth-examples.json按对应职业取用，不能只填写职业名称。example-design.json和example-xp.json展示任务与成长参考。example-scene-magic.json仅是场景片段。示例只用于结构，实际内容以需求为准。纯文字应用可直接使用工作台的模型提示词，不需要API或SDK；API应用也必须返回同一JSON契约，工作台当前没有直接API生成按钮。失败时下载局部修复资料；不传入运行凭据、旧记忆、模型或Bot绑定。',
    'schema.json': JSON.stringify(z.toJSONSchema(authoringSchema, { io: 'input' }), null, 2),
    'example.json': JSON.stringify(authoringExample(), null, 2),
    'example-v16.json': JSON.stringify(authoringV16Example(), null, 2),
    'example-design.json': JSON.stringify(authoringDesignExample(), null, 2),
    'example-xp.json': JSON.stringify(authoringDesignExample('xp'), null, 2),
    'catalogue.json': JSON.stringify(
      {
        npcs: authoringCatalogue(),
        items: catalogue([...BUILTIN_PACKS, ...itemPacks])
          .items.filter((i) => i.kind !== 'pack')
          .map((i) => ({ id: i.id, name: i.name, english:i.english, kind: i.kind })),
      },
      null,
      2,
    ),
  }
  Object.assign(files,designContextFiles(designNotebook))
  if(designNotebook) files['prompt-short.txt']+='\n先读story-design.json／specification-design.json（存在的文件），这是目标作品的独立设计附件，不把其内容并入创作需求字符额度；保持key，公开／本人／GM资料分层，不沿用无关示例剧情。'
  files['prompt-short.txt'] += '\n本次模块：\n' + authoringModuleInstructions(requirements)
  if (readingLocale === 'en') {
    const capabilities=JSON.parse(files['capabilities.json']!)
    capabilities.mechanisms=capabilities.mechanisms.map((row:{mechanism:string})=>({...row,...ENGLISH_CAPABILITIES[row.mechanism]}))
    files['capabilities.json']=JSON.stringify(capabilities,null,2)
    files['instructions.txt'] = `Read manifest.json/recommendedFiles, requirements.txt, prompt-short.txt, schema.json and the legal catalogues first. Output language: ${contentLocale}. Instruction language is English and does not override that target. Examples demonstrate structure; their existing Chinese prose is not a language requirement. Preserve supplied design keys and locked content. Downloaded files contain creative configuration only, never room history, credentials or Bot identities.\n${ENGLISH_AUTHORING_GUIDE}`
    files['prompt-short.txt'] = `${ENGLISH_AUTHORING_GUIDE}\n${outputLanguageInstruction(contentLocale)}\nCreation requirements:\n${request}\nRead story-design.json/specification-design.json when present. Return complete schema.json-compatible JSON; no Markdown or truncated documents. Capacity: ${NPC_LIMIT} total NPCs, ${AUTHORING_LIMITS.scenes} scenes, ${BROADCAST_LIMIT} compiled broadcasts, 2 MiB authoring JSON. These are upper limits, not quotas.`
    files['validation-guide.txt'] = ENGLISH_VALIDATION_GUIDE
    files['visual-instructions.txt'] = ENGLISH_VISUAL_GUIDE
    files['npc-task-growth-instructions.txt'] = ENGLISH_AUTHORING_GUIDE
    files['scene-magic-instructions.txt'] = `${ENGLISH_MODULES.magic!.instructions}\nRead module-schema/schema and example-scene-magic.json. That example is a scene fragment, not a complete authoring document.\n${ENGLISH_VISUAL_GUIDE}`
    for (const m of AUTHORING_MODULES) {
      const translated = ENGLISH_MODULES[m.id]!
      files[`module-${m.id}.txt`] = `${translated.label}\nFields: ${m.paths.join(', ')}\n${translated.instructions}\nPreference: ${requirements?.modules[m.id] ?? 'suggest'}. Follow schema.json exactly; example-workbench.json is a complete structural example.`
    }
  }
  if(contentLocale==='en')for(const name of Object.keys(files))if(/^example.*\.json$/.test(name))files[name]=JSON.stringify(localizeSyntheticAuthoringExample(JSON.parse(files[name]!),contentLocale),null,2)
  const selected = AUTHORING_MODULES.filter((m) => requirements?.modules[m.id] !== 'skip')
  const required = selected.filter((m) => requirements?.modules[m.id] === 'required')
  const recommendedFiles = [
    ...Object.keys(designContextFiles(designNotebook)),
    'instructions.txt', 'requirements.txt', 'prompt-short.txt', 'schema.json', 'catalogue.json',
    'visual-instructions.txt','validation-guide.txt',
    ...(required.length ? ['example-workbench.json'] : ['example.json']),
    ...required.map((m) => `module-${m.id}.txt`),
    ...(requirements?.modules.characters === 'required' ? ['character-catalogue.json', 'character-examples.json', 'character-growth-examples.json'] : []),
    ...(requirements?.modules.magic === 'required' ? ['scene-magic-instructions.txt', 'example-scene-magic.json'] : []),
  ]
  files['manifest.json'] = JSON.stringify({
    contract: AUTHORING_CONTRACT, capabilitiesVersion: AUTHORING_CAPABILITIES_VERSION,
    instructionLocale: readingLocale, contentLocale,
    role: 'authoring-input-only', characterLevels: [1, 5],
    modules: AUTHORING_MODULES.map((m) => ({ id: m.id, label: readingLocale === 'en' ? ENGLISH_MODULES[m.id]!.label : m.label, preference: requirements?.modules[m.id] ?? 'suggest', paths: m.paths, file: `module-${m.id}.txt` })),
    recommendedFiles,
    files: Object.entries(files).map(([name, text]) => ({ name, bytes: new TextEncoder().encode(text).length })),
    manifestFile: 'manifest.json',
    runtimeExcluded: ['memories', 'mem0-config', 'credentials', 'qq-bindings', 'fog-history', 'trade-sessions', 'npc-spatial-authorization', 'summoning-instances'],
  }, null, 2)
  return files
}
export function authoringRepairFiles(text: string, error: unknown, targetKey?: string, instructionLocale: Locale = 'zh-CN') {
  let input: unknown
  try {
    input = JSON.parse(text.replace(/^```(?:json)?\s*\n|\n```$/gi, ''))
  } catch {
    /* never send an unparsed full transcript */
  }
  const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const rowsOf = (value: unknown) =>
    Array.isArray(value) ? value.map(object).filter((v) => typeof v.key === 'string') : []
  const word = (value: unknown) => (typeof value === 'string' ? value.slice(0, 120) : undefined)
  const num = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
  const xy = (value: unknown) => {
    const o = object(value)
    return { x: num(o.x), y: num(o.y) }
  }
  const root = object(input),
    rows = rowsOf(root.scenes)
  const selectedKey = targetKey?.replace(/^(scene|npc):/, '')
  const scene = targetKey?.startsWith('npc:') ? undefined : rows.find((s) => s?.key === selectedKey)
  const npcs = rowsOf(root.npcs)
  const message = error instanceof Error ? error.message : ''
  const npc = npcs.find((n) => (!targetKey?.startsWith('scene:') && n.key === selectedKey) || message.startsWith('NPC ' + n.key + '：'))
  const npcPaths =
    error instanceof ZodError
      ? error.issues.filter((e) => e.path[0] === 'npcs').map((e) => Number(e.path[1]))
      : []
  // Repair data contains construction fields only, never NPC secrets, history or GM notes.
  const characterRepairs = (npc ? [npc] : npcs.filter((_, i) => npcPaths.includes(i))).map((n) => {
    const character = object(n.character),
      build = object(character.build)
    const keys = [
      'classId',
      'backgroundId',
      'speciesId',
      'method',
      'scores',
      'boosts',
      'rolls',
      'choices',
      'classEquipment',
      'backgroundEquipment',
      'equipmentChoices',
      'purchases',
      'equipped',
    ]
    return {
      key: word(n.key),
      cardType: word(n.cardType),
      template: word(n.template),
      character: {
        build: Object.fromEntries(keys.filter((k) => k in build).map((k) => [k, build[k]])),
        growth: Array.isArray(character.growth)?character.growth.map(step=>{
          const row=object(step)
          return Object.fromEntries(['targetLevel','choices','abilityIncreases','hpMethod'].filter(k=>k in row).map(k=>[k,row[k]]))
        }):character.growth,
      },
    }
  })
  const characterOptions = (npc ? [npc] : npcs.filter((_, i)=>npcPaths.includes(i))).map(n=>{
    const candidate=object(object(n.character).build),parsed=authoringCharacterSchema.shape.build.safeParse(candidate)
    const classId=word(candidate.classId)
    let levelOneChoices:ReturnType<typeof getChoices>=[]
    if(parsed.success)try{levelOneChoices=getChoices({...parsed.data,customItems:[],adjustments:[],story:'',appearance:'',name:''},catalogue())}catch{/* Broken selections must not prevent downloading the repair package. */}
    return {key:word(n.key),classId,
      levelOneChoices,
      growthExample:characterGrowthExamples.find(e=>e.classId===classId)?.character.growth,
    }
  })
  const geometry = scene
    ? {
        key: scene.key,
        width: num(scene.width),
        height: num(scene.height),
        landing: xy(scene.landing),
        walls: Array.isArray(scene.walls)
          ? scene.walls.map((w) => {
              const r = object(w)
              return {
                key: word(r.key),
                a: xy(r.a),
                b: xy(r.b),
                kind: word(r.kind),
                point: word(r.point),
              }
            })
          : [],
        floors: Array.isArray(scene.floors)
          ? scene.floors.map((f) => {
              const r = object(f)
              return { ...xy(r), width: num(r.width), height: num(r.height) }
            })
          : [],
        points: Array.isArray(scene.points)
          ? scene.points.map((p) => {
              const x = object(p),
                exit = object(x.exit)
              return {
                key: word(x.key),
                kind: word(x.kind),
                ...xy(x),
                appearance: x.appearance
                  ? {
                      width: num(object(x.appearance).width),
                      height: num(object(x.appearance).height),
                      rotation: num(object(x.appearance).rotation),
                    }
                  : undefined,
                exit: x.exit ? { scene: word(exit.scene), point: word(exit.point) } : undefined,
              }
            })
          : [],
      }
    : null
  // Validate each local module before projecting a structural whitelist. Never spread raw input.
  const safe = <T>(schema: z.ZodType<T>, value: unknown): T | undefined => {
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : undefined
  }
  const fog = safe(authorSceneSchema.shape.fog, scene?.fog)
  const spatial = safe(authorSceneSchema.shape.spatialSetup, scene?.spatialSetup)
  const effects = safe(authorSceneSchema.shape.effectSetup, scene?.effectSetup)
  const npcSchema = authoringSchema.shape.npcs.element
  const merchant = safe(npcSchema.shape.merchantPolicy, npc?.merchantPolicy)
  const stock = safe(npcSchema.shape.stock, npc?.stock)
  const coinsGP = safe(npcSchema.shape.coinsGP, npc?.coinsGP)
  const knowledge = safe(npcSchema.shape.knowledgeProfile, npc?.knowledgeProfile)
  const design = safe(authoringSchema.shape.knowledgeDesign, root.knowledgeDesign)
  const localModules = {
    scene: scene ? {
      key: word(scene.key), fog,
      spatialSetup: spatial ? { floorHeight: spatial.floorHeight, light: spatial.light, openSky: spatial.openSky, ceilingHeight: spatial.ceilingHeight, objects: spatial.objects.map(({ name: _name, ...o }) => o) } : undefined,
      effectSetup: effects ? {
        regions: effects.regions.map((r) => ({ id: r.id, spellId: r.spellId, geometry: r.geometry, sourceNpcId: r.sourceNpcId, objectId: r.objectId, pointId: r.pointId, slotLevel: r.slotLevel, dc: r.dc, hidden: r.hidden, light: r.light, remainingHours: r.remainingHours, terrain: r.terrain })),
        containers: effects.containers.map(({ name: _name, ...c }) => c),
        materials: effects.materials,
      } : undefined,
    } : undefined,
    npc: npc ? { key: word(npc.key), scene: word(npc.scene), merchantPolicy: merchant, stock, coinsGP, knowledgeProfile: knowledge } : undefined,
    knowledgeReferences: design ? {
      factions: design.factions.map((f) => ({ id: f.id, hidden: f.hidden })),
      templates: design.templates.map((t) => ({ id: t.id, version: t.version, layer: t.layer, visibility: t.visibility })),
    } : undefined,
    referencesOnly: true,
  }
  const relevantSchemas = scene ? authorSceneSchema.pick({ fog: true, spatialSetup: true, effectSetup: true })
    : npcSchema.pick({ merchantPolicy: true, stock: true, coinsGP: true, knowledgeProfile: true })
  const validation=preflightAuthoring(input)
  return {
    'preflight.json':JSON.stringify({issues:validation.issues.filter(i=>!targetKey||i.target===targetKey),options:validation.options.filter(i=>!targetKey||i.target===targetKey),blocked:validation.blocked,...(instructionLocale==='en'?{instructionLocale,presentation:validation.issues.filter(i=>!targetKey||i.target===targetKey).map(p=>({path:p.path,...presentAuthoringProblem(p,instructionLocale)}))}:{})},null,2),
    'local-modules.json': JSON.stringify(localModules, null, 2),
    'module-schema.json': JSON.stringify(z.toJSONSchema(relevantSchemas, { io: 'input' }), null, 2),
    'knowledge-design-schema.json': JSON.stringify(z.toJSONSchema(authoringSchema.shape.knowledgeDesign, { io: 'input' }), null, 2),
    ...(stock?.length ? { 'item-catalogue.json': JSON.stringify(catalogue().items.filter(i=>i.kind!=='pack').map(i=>({id:i.id,name:i.name})), null, 2) } : {}),
    ...(characterOptions.length?{'character-options.json':JSON.stringify(characterOptions,null,2),'character-schema.json':JSON.stringify(z.toJSONSchema(authoringCharacterSchema,{io:'input'}),null,2)}:{}),
    'validation-guide.txt':instructionLocale === 'en' ? ENGLISH_VALIDATION_GUIDE : AUTHORING_VALIDATION_GUIDE,
    'repair.txt': instructionLocale === 'en' ? `${ENGLISH_VALIDATION_GUIDE}\nRepair only the selected object and cited structural errors. local-modules.json is a referencesOnly structural slice: private knowledge, names, notes and passwords are intentionally omitted. Do not reconstruct omitted prose, secrets or unrelated objects. Apply the patch by path to the original document and rerun preflight. Preserve its contentLocale and existing prose language. Catalogue IDs only; never invent missing facts or materials.` :
      '只修复所选对象及指明的结构错误；保留未提供的文字、秘密和其他对象。local-modules是结构切片，不是完整场景或完整剧本，referencesOnly=true；已省略知识正文、名称、区域note、magic口令及触发描述。原文保留在本机，不得据此重建整份JSON。module-schema说明对应字段的完整契约；按路径在原JSON局部合并修改，重新预检。物品仅用目录或GM原文件实际提供的自定义包，不能猜造缺失人物知识或材料。',
    'errors.json': JSON.stringify(
      error instanceof ZodError
        ? error.issues.map((e) => ({ path: e.path, code: e.code, message: e.message }))
        : [{ message: error instanceof Error ? error.message.slice(0, 2000) : '预检失败' }],
      null,
      2,
    ),
    'local-structure.json': JSON.stringify(
      {
        scene: geometry,
        characterRepairs,
        sceneReferences: rows.map((s) => ({
          key: word(s.key),
          points: Array.isArray(s.points)
            ? s.points.map((p) => ({
                key: word(object(p).key),
                kind: word(object(p).kind),
              }))
            : [],
        })),
      },
      null,
      2,
    ),
  }
}
