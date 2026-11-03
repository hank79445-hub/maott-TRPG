import type { AuthoringRequirements } from './authoring-requirements'

export type AuthoringModuleId = keyof AuthoringRequirements['modules']
export const AUTHORING_CONTRACT = 'trpg-authoring/1'
export const AUTHORING_CAPABILITIES_VERSION = 'workbench-sync/5-persona-three-stage'
export const AUTHORING_MODULES = [
  {
    id: 'characters',
    label: '完整职业NPC',
    paths: ['npcs[].cardType', 'npcs[].character','npcs[].practicalSocial','npcs[].resourceStrategy'],
    instructions:
      '重要NPC明确选择template简明卡或character完整职业卡。完整卡只支持12职业1–5级单职业，按真实一级构建和逐级成长计算；不把职业名称当能力。查character-catalogue.json与对应职业示例，不必复制全部12职业。随队仅表示可招募，不授予跟随、参战、自动移动或Bot权限。',
  },
  {
    id: 'knowledge',
    label: '世界知识与组织',
    paths: ['knowledgeDesign', 'npcs[].knowledgeProfile','knowledgeDesign.factions[].practical'],
    instructions:
      '设计组织factions和分层templates，NPC用knowledgeProfile引用。public和private区分，组织身份可隐藏；知识仅描述初始背景及可信事实，不写本团记忆、Mem0配置或密钥。声望策略引用同场景真实互动结果，automatic默认false；开团由GM核对授权。公开简介、美术和广播不得泄露私密模板或未来剧情。',
  },
  {
    id: 'commerce',
    label: '商店与经济',
    paths: ['npcs[].merchantPolicy', 'npcs[].coinsGP', 'npcs[].stock'],
    instructions:
      '商人写enabled的merchantPolicy、实际coinsGP钱包和stock库存。出售、现金收购、纯易物分别考虑，buy=true要有资金或在GM设计说明刻意零资金。autoPurchase默认false。物品ID允许命名空间，必须实际存在于内置目录或GM提供的itemPacks；关键钥匙列blockedItems，不因回复免审授权交易。装备、consumables和stock分别登记，不默认同一份物品可同时使用和出售。',
  },
  {
    id: 'fog',
    label: '封闭探索与光暗遮罩',
    paths: ['scenes[].fog'],
    instructions:
      '新场景推荐fog:{mode:"enclosed",enabled:true,shared:true,rangeFeet:60,initial:[],shading:{level1:0.35,level2:0.75},areas:[]}。开放地形默认公开，仅未知封闭房间写areas:[{id:区域key,name:内部GM名称,cells:["x,y"],doorIds:[同场景门互动点key],initiallyRevealed:false,revealOnOpen:true,manualOnly:false}]。区域不重叠、不越界；门是共享边界，核对关联门段，不把门外格当内部。开启门仅揭示直接房间、不串联密室；特殊区域manualOnly。室内/混合场景明确规划封闭区与公开入口；室外不凭边缘自动围墙。rangeFeet在enclosed模式仅为遮罩显示半径，不是规则视距。光暗与视距不隐藏已公开区普通标记，也不允许穿墙行动。无mode旧fog仍按逐格兼容；不写explored、areaRecords、observerId、分支或运行历史。每场景有合法入场点；黑暗环境登记空间照度与实际光源。GM制作图不将黑雾画进底图。',
  },
  {
    id: 'space',
    label: '空间与通路',
    paths: ['scenes[].spatialSetup', 'npcs[].initialHeight', 'npcs[].initialSupport','npcs[].spatialPolicy'],
    instructions:
      'spatialSetup为初始空间，室内写实际ceilingHeight，objects类型为object/rope/stone/surface/liquid/plants，坐标为格，高度和尺寸为尺。NPC支撑引用同场景实际物件。出口双向配对；运行中NPC已知路线和自主旅行由GM另行授权。不把地面边界当外墙，室外/混合仅显式建筑墙门。',
  },
  {
    id: 'mechanisms',
    label: '任务、机关与发现',
    paths: ['quests[].steps', 'scenes[].links', 'scenes[].points'],
    instructions:
      '设计可执行当前小目标和失败替代路线。隐藏点明确proximity/gm/linked发现入口；钥匙用itemUse，宝箱用container；链接指定success/failure及同场景目标，可触发arrivalGroups。point.arrivalGroup与failureArrivalGroup分别对应确认成功/失败出场。结果只建议小目标完成，GM确认才推进，不自动发奖。',
  },
  {
    id: 'magic',
    label: '场景魔法与补给',
    paths: ['scenes[].effectSetup', 'npcs[].consumables'],
    instructions:
      'effectSetup只设计已支持的初始区域、实际灯光、容器水食和真实材料引用。M1–M5法术能力属于真实角色/简明能力，不是所有法术都能放进regions。G类保留GM裁定；S召唤只能准备实际来源和材料，不能预置召唤实体、已施法记录或控制期限。scene-magic-instructions.txt给字段和片段。',
  },
] as const

export function authoringModuleInstructions(requirements?: AuthoringRequirements) {
  return AUTHORING_MODULES.filter((m) => requirements?.modules?.[m.id] !== 'skip')
    .map(
      (m) =>
        `${m.label}（${requirements?.modules?.[m.id] === 'required' ? '必须设计' : '按剧情需要建议'}）：${m.instructions}`,
    )
    .join('\n')
}

export const authoringSupportMatrix = [
  {
    mechanism: '职业法术与职业能力',
    source: '已校验的1–5级职业卡／真实模板能力',
    boundary: '程序计算资源；初始描述不替代实际能力和装备',
  },
  {
    mechanism: '持续区域、光照与空间',
    source: 'spatialSetup / effectSetup',
    boundary: '只接受初始场景引擎支持的效果，编译检查来源和引用',
  },
  {
    mechanism: 'G类叙事法术',
    source: '实际法术能力与规则裁定入口',
    boundary: '解释、知识和结果由GM裁定，不伪造自动结论',
  },
  {
    mechanism: 'S类召唤',
    source: '实际可用法术与材料',
    boundary: '开团后合法施放；不预置召唤实例或历史',
  },
  {
    mechanism: 'NPC记忆、模型、QQ与自主授权',
    source: '开团后的运行配置',
    boundary: '可带默认关闭的practicalSocial、spatialPolicy、resourceStrategy等初始设计；不包含旧记忆、凭据、Bot、运行授权或执行历史',
  },
]
