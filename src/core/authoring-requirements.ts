import {outputLanguageInstruction,type Locale} from '../shared/localization/locale'
import {localeSchema} from '../shared/localization/locale'
import { z } from 'zod'
import { NPC_LIMIT, AUTHORING_BRIEF_CHARACTERS } from './configuration-limits'
const preference = z.enum(['suggest', 'required', 'skip']).default('suggest')
export const authoringModulesSchema = z
  .object({
    characters: preference,
    knowledge: preference,
    commerce: preference,
    fog: preference,
    space: preference,
    mechanisms: preference,
    magic: preference,
  })
  .strict()
export const authoringRequirementsSchema = z
  .object({
    contentLocale: localeSchema.optional(),
    ordinary: z.number().int().min(0).max(NPC_LIMIT).nullable().default(null),
    resident: z.number().int().min(0).max(NPC_LIMIT).nullable().default(null),
    companions: z.boolean().default(false),
    companionCount: z.number().int().min(1).max(10).default(1),
    quests: z.boolean().default(false),
    growth: z.enum(['none', 'xp', 'milestone']).default('none'),
    players: z.number().int().min(1).max(10).nullable().default(null),
    startLevel: z.number().int().min(1).max(20).nullable().default(null),
    endLevel: z.number().int().min(1).max(20).nullable().default(null),
    hours: z.number().positive().max(1000).nullable().default(null),
    modules: authoringModulesSchema.default(() => authoringModulesSchema.parse({})),
  })
  .strict()
  .superRefine((r, ctx) => {
    if ((r.ordinary ?? 0) + (r.resident ?? 0) + (r.companions ? r.companionCount : 0) > NPC_LIMIT)
      ctx.addIssue({ code: 'custom', message: '普通、驻场重要及随队重要 NPC 合计超过100' })
    if (
      r.growth !== 'none' &&
      r.endLevel !== null &&
      r.startLevel !== null &&
      r.endLevel < r.startLevel
    )
      ctx.addIssue({ code: 'custom', message: '目标等级不能低于起始等级' })
  })
export type AuthoringRequirements = z.infer<typeof authoringRequirementsSchema>
export const defaultAuthoringRequirements = () => authoringRequirementsSchema.parse({})
/** Migration never rewrites brief/JSON or replaces existing explicit numbers. */
export function restoreAuthoringRequirements(input: unknown, version?: number) {
  const parsed = authoringRequirementsSchema.safeParse(input ?? {})
  return {
    value: parsed.success ? parsed.data : defaultAuthoringRequirements(),
    notice: !parsed.success
      ? '旧结构化需求校验失败；原文字需求和JSON保留，请重新核对选项。'
      : version !== 2 && input
        ? '已保留旧草稿的结构化数值；请核对常显基础需求与原文，留空可取消原默认值。未改写创作JSON。'
        : '',
  }
}
export function authoringRequirementText(brief: string, options?: AuthoringRequirements, instructionLocale:Locale='zh-CN') {
  if (brief.length > AUTHORING_BRIEF_CHARACTERS) throw Error(`创作需求超过${AUTHORING_BRIEF_CHARACTERS}字符，请精简；不会静默截断`)
  if (!options) return brief
  const r = authoringRequirementsSchema.parse(options)
  if (r.startLevel !== null && r.startLevel > 5)
    throw Error('当前冒险创作及完整职业卡只支持1–5级；请调整起始等级，成长目标可单独作GM参考')
  const explicit = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null))
  if(instructionLocale==='en')return outputLanguageInstruction(r.contentLocale??'zh-CN')+'\nOriginal creative brief:\n'+brief+'\nStructured requirements (explicit numbers override prose; null or omitted values are unspecified):\n'+JSON.stringify(explicit)+'\nModule preferences: required = design it, suggest = use when appropriate, skip = no additional design; existing content is not deleted and runtime permissions are not granted. Companion count is part of the important-NPC total. companions=false means no recruitable companions; true permits recruitment design only, not automatic following. quests=false does not force additional quests; growth=none does not add advancement guidance. Adventure and full character cards support levels 1–5; a higher growth target is GM reference only.'
  return (
    outputLanguageInstruction(r.contentLocale ?? 'zh-CN') + '\n' + brief +
    '\n结构化需求（仅明确填写的数值优先；未指定数值以自由文本为准，仍缺少时由模型建议）：' +
    JSON.stringify(explicit) +
    '\n未列出的人数／等级／时长／NPC数量表示未指定。modules为创作偏好：required必须设计、suggest由模型建议、skip不额外设计；不删除已有作品内容，不授予运行权限。随队人数包含在重要NPC总量中。companions=false不要生成可随队人物；true仅表示可招募，不自动跟随。quests=false不额外强制生成任务，growth=none不额外设计升级。冒险level及完整职业卡仅支持1–5级；成长目标等级只作GM参考，不扩展引擎能力。'
  )
}
export const authoringDesignInstructions = `新场景推荐fog:{mode:"enclosed",enabled:true,shared:true,rangeFeet:60,initial:[],shading:{level1:0.35,level2:0.75},areas:[{id:"房间key",name:"内部GM名称",cells:["x,y"],doorIds:["同场景门互动点key"],initiallyRevealed:false,revealOnOpen:true,manualOnly:false}]}；室外可用空areas且全图公开，室内／混合场景按实际墙门划封闭区，区域不得重叠越界。门位于边界，公开起点不放入仅GM揭示密室。rangeFeet仅为显示半径；特殊隐藏、真实感知和行动限制保留。旧fog:{enabled,shared,rangeFeet,initial}兼容。仅写初始配置，不写areaRecords、探图历史或玩家分支。商人NPC可选merchantPolicy:{enabled:true,buy:false,buyRate:0.5,buyItems:[],blockedItems:[],autoPurchase:false,zeroPrice:false}与coinsGP（实际初始钱包）、stock:[{itemId,quantity,priceGP}]，引用共享规则物品。重要钥匙等禁止随意收购，填写blockedItems；缺少可靠价格须GM定价，不填零价冒充免费。商店库存与自身装备/消耗品分开，金币须实际配置。不得写交易会话、历史报价、已成交记录或运行物品实例。
NPC世界知识与组织：可选knowledgeDesign:{factions:[{id,name,description,hidden,initialScore,policies?:[{id,sceneId:场景key,pointId:该场景互动点key,outcome:"success"或"failure",contribution:-100到100,automatic:false,reason}]}],templates:[{id,name,version,layer,visibility,text}]}；NPC可选knowledgeProfile:{enabled,factionId,membership:"direct"或"associated",hiddenMembership,backgroundBias,lockedAttitude:null,lockReason:"",templateIds:[]}。组织ID与模板ID用稳定小写编号并正确引用。layer为world/region/culture/upbringing/profession/organization/script/gm；visibility为public或private；公共知识不得包含未来剧情、秘密组织身份或GM指导。按实际地区、成长与经历选择世界知识，不能从种族自动生成通用仇恨或全知。初始队伍声望-100到100、背景偏置默认0，关联成员不默认连带。声望策略仅一次性引用真实互动结果，默认不自动应用，GM可核对后授权；不会因重复走动／交谈刷分。全队声望不代表所有成员目击过事件；不填写本团经历、运行记忆、模型/Embedding/API密钥、Bot身份或自动开战指令。
S召唤：只能设计目录中实际职业卡已获法术或简明NPC已有能力及所需材料。运行中的召唤实例、HP、命令、控制期限、感官、骑手、Bot和权限不得写入创作JSON。野兽／妖精／亡灵灵魄由程序按原施放来源与实际环位计算，不能当永久NPC预置。寻获魔宠、异界坐骑、魅影驹、操纵死尸、隐形仆役均由开团后的召唤入口产生。昂贵材料须真实物件并在开团后GM登记；说明文字不代替库存。需要预置活体召唤物时暂不支持，给出GM合法施法准备说明，不能伪造施放历史。
V18出场：point.arrivalGroup为确认成功出场、failureArrivalGroup为确认失败出场；可分组或共组，一组只出场一次。scene.links的effects可为空数组（必须有arrivalGroups）；组引用限同场景。故意GM手动出场的arrivals填写manualReason，缺入口需预检警告。失败出场不自动开门或发奖。
NPC：普通NPC配置多条fixedReplies、fixedReplyMode:end/loop和fixedReplyEnd；进度按NPC共享，不按玩家分开。重要NPC按场景分工，type:important，importanceRole:resident/companion。每人有唯一key和初始落点，随队不生成跨场景副本，不设置followParty。publicSpeechStyle只写可公开的口吻、简短拒答风格；资料不足可说“无可奉告”，不解释模型或公开资料限制、不编造身世。秘密写secret，私密动机、加入/离队条件、个人目标与失败替代路线写gmDesign（role/motivation/joinConditions/leaveConditions/personalGoal/alternatives），不写进公开口吻或场景美术。
NPC空间代理：创作JSON不携带运行任务、观察历史或自动授权。出口继续使用合法场景和互动点key配对；开团后由GM明确告知NPC已知路线，并选择是否开启探索规划和安全移动，不因人物设定写“会旅行”就自动授权跨场景。
V17职业卡：NPC cardType:template时必须有template合法ID；cardType:character仅适用于type:important，必须有character:{build:完整一级构建,growth:[{targetLevel:2到5的连续等级,choices:本级完整选择,abilityIncreases:本级属性提升,hpMethod:fixed}]}。当前仅12职业1–5级单职业。build严格按Schema，不能带growth历史、任意GM调整或派生HP/AC/法术位。程序依玩家引擎校验、成长、生成装备与独立角色卡。需要职业的关键NPC须选择character，描述写职业不能替代卡。character-examples.json是12职业一级结构示例，character-catalogue.json提供合法目录；不得把不适用示例照抄给其他职业。未知选项明确报错后局部修复，不静默换模板；实际NPC姓名用name。成长保留原合法选项，法术书及准备数量遵守原引擎。
任务：quests的description是玩家可见目标，不写解法、未来剧情或秘密。gmDesign仅GM参考：completion/alternatives/notes/npcIds（引用NPC key）；main和current各最多一个。可选支线与替代路线避免关键NPC死亡/拒绝后剧情卡死。GM负责推进，不宣告自动发奖。
V16容器：chest必须有container:{items:[{itemId:目录内物品ID,quantity:正整数}],coins:非负GP,emptyReason?:刻意空容器原因,gmNote?:仅GM说明}；没有物品也无金币时必须说明刻意为空，描述不能自动造物。容器与ground独立，开箱不等于领取。
自定义物品只能引用GM已经定义并提供的规则包；需要时把完整合法的包放在顶层itemPacks数组中，不得自行编造物品、覆盖内置规则或只写一段描述。包内ID与container.items引用必须一致；没有提供自定义包时只用目录内置物品。
V16隐藏发现：hidden=true的点必须明确discovery:{method:proximity/gm/linked,range:20,skill:perception,dc:10}，数值可按设计调整；发现检定独立于point.check的使用检定。proximity有阻隔检查，每角色每分支一次，成功全队揭示；gm由GM揭示；linked必须有机关reveal效果。不能生成没有发现／揭示途径的关键线索。
V16机关关联：scene.links:[{key,name,color:#RRGGBB,source:本场景来源point.key,outcome:success/failure,effects:[{point:本场景目标key,operation:open/close/unlock/reveal/enable}],arrivalGroups?:出场组key数组}]。同组目标不重复；开关解锁只指向门；先校验整组再执行，默认一次，不递归联动。多组关系明确编号，不把颜色或关联秘密写入art。
V16小目标：quests可有steps:[{key,title,description,visibility:public/hidden,initialStatus:inactive/active/completed/failed,after:前置step.key数组,scene?:场景key,point?:互动点key,arrival?:出场组key,trigger?:point-success/scene-enter/arrival/battle-ended,alternatives?:仅GM替代路线,gmNote?:仅GM完成标准}]，pinnedStep可指定一个步骤key。各阶段有可执行入口和失败替代路线；公开当前步骤，后续默认隐藏。触发只建议完成，GM确认才推进，不自动发奖、升级或公开后续。
成长：可选growthGuide，mode:xp/milestone，players/startLevel/endLevel/hours，steps包含title/chapter、可选sceneId/questId（创作key）、kind:combat/exploration/social/quest/milestone、可选suggestedLevel与xp、allocation:team-total/per-person、sourceKind:rule/gm、source、reason、challengeKey。同一挑战key只列一次，击杀/说服/潜行是替代解法不重复计奖；里程碑不写xp。缺少可核实规则来源时sourceKind:gm、source明确“GM自定”，不能捏造经验表。全部仅GM参考，不执行升级、奖励、招募或权限变更。新字段必须符合schema，不添加凭据、运行历史或Bot绑定。`

export function authoringRequirementWarnings(
  source: import('../persistence/script-authoring-schema').Authoring,
  options: AuthoringRequirements,
) {
  const r = authoringRequirementsSchema.parse(options),
    messages: string[] = []
  const ordinary = source.npcs.filter((n) => n.type === 'ordinary').length
  const companion = source.npcs.filter(
    (n) => n.type === 'important' && n.importanceRole === 'companion',
  ).length
  const resident = source.npcs.filter(
    (n) => n.type === 'important' && n.importanceRole !== 'companion',
  ).length
  if (r.players !== null && r.players !== source.players)
    messages.push(`玩家人数实际${source.players}名，需求${r.players}名`)
  if (r.startLevel !== null && r.startLevel !== source.level)
    messages.push(`冒险起始等级实际${source.level}，需求${r.startLevel}；当前创作与职业卡支持1–5级`)
  if (r.startLevel !== null && r.startLevel > 5)
    messages.push('需求起始等级超出当前1–5级创作范围，请调整；不会伪造高等级职业卡')
  if (r.ordinary !== null && r.ordinary !== ordinary)
    messages.push(`普通NPC实际${ordinary}名，需求${r.ordinary}名`)
  if (r.resident !== null && r.resident !== resident)
    messages.push(`驻场重要NPC实际${resident}名，需求${r.resident}名`)
  if ((r.companions ? r.companionCount : 0) !== companion)
    messages.push(`可随队NPC实际${companion}名，与需求不一致；未自动招募或改写`)
  if (r.quests && !source.quests?.length) messages.push('需求要求任务指引，但创作JSON尚未提供任务')
  if (r.growth !== 'none' && source.growthGuide?.mode !== r.growth)
    messages.push('成长参考方式与需求不一致或缺失')
  if (r.growth !== 'none' && source.growthGuide) {
    for (const [key, label] of [
      ['players', '人数'],
      ['startLevel', '起始等级'],
      ['endLevel', '目标等级'],
      ['hours', '预计小时'],
    ] as const)
      if (r[key] !== null && r[key] !== source.growthGuide[key])
        messages.push(`成长参考${label}与明确需求不一致`)
  }
  return messages
}
