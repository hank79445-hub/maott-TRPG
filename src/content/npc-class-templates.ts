import { customNpc } from '../core/combat-rules'
import type { NpcTemplate } from '../core/ai-types'
import type { NpcMonsterAbility } from '../core/npc-abilities'
type Spec = {
  id: string
  name: string
  hp: number
  ac: number
  damage: string
  range?: number
  type?: 'slashing' | 'piercing' | 'bludgeoning' | 'fire' | 'force'
  feature: string
  spell?: string
}
const specs: Spec[] = [
  {
    id: 'barbarian',
    name: '野蛮人斗士',
    hp: 38,
    ac: 13,
    damage: '1d12+3',
    feature: '狂暴：GM确认开启、持续与抗性；不自动追加伤害',
  },
  {
    id: 'bard',
    name: '吟游诗人旅者',
    hp: 24,
    ac: 14,
    damage: '1d8+2',
    type: 'piercing',
    feature: '吟游激励：GM确认受益者及激励骰使用，不自动改变检定',
    spell: 'healing-word',
  },
  {
    id: 'druid',
    name: '德鲁伊守林者',
    hp: 28,
    ac: 13,
    damage: '1d8+2',
    feature: '荒野变形：GM确认形态与属性；此入口不自动替换生命或移动方式',
    spell: 'healing-word',
  },
  {
    id: 'fighter',
    name: '战士老兵',
    hp: 36,
    ac: 17,
    damage: '1d8+3',
    feature: '回气：GM确认恢复数值，使用现有治疗入口；不重复刷新动作',
  },
  {
    id: 'monk',
    name: '武僧行者',
    hp: 28,
    ac: 15,
    damage: '1d6+3',
    type: 'bludgeoning',
    feature: '连击与身法：GM确认附赠动作、专注点与每次攻击；不赠送额外动作',
  },
  {
    id: 'paladin',
    name: '圣武士誓卫',
    hp: 36,
    ac: 18,
    damage: '1d8+3',
    feature: '神圣打击／圣疗：GM确认资源与结算；不无条件附加光耀伤害或灵光',
  },
  {
    id: 'ranger',
    name: '游侠猎手',
    hp: 30,
    ac: 14,
    damage: '1d8+3',
    range: 150,
    type: 'piercing',
    feature: '猎人标记：GM指定目标并核对专注、命中及额外伤害条件',
  },
  {
    id: 'rogue',
    name: '游荡者密探',
    hp: 26,
    ac: 14,
    damage: '1d4+3',
    range: 20,
    type: 'piercing',
    feature: '偷袭／灵巧动作：GM核对优势与友军条件、每回合次数；不无条件追加伤害',
  },
  {
    id: 'sorcerer',
    name: '术士觉醒者',
    hp: 24,
    ac: 13,
    damage: '2d10',
    range: 120,
    type: 'fire',
    feature: '超魔法：GM核对术法点、施法与选项兼容；不复制法师资源规则',
  },
  {
    id: 'warlock',
    name: '邪术师契约者',
    hp: 28,
    ac: 14,
    damage: '1d10+3',
    range: 120,
    type: 'force',
    feature: '契约魔法：GM确认法术与契约次数恢复；魔能攻击按下列自定义数据结算',
  },
]
export const NPC_CLASS_TEMPLATES: NpcTemplate[] = specs.map((s) => {
  const body = customNpc()
  body.name = s.name
  body.hp = body.maxHp = s.hp
  body.ac = s.ac
  body.speed = s.id === 'monk' ? 40 : 30
  body.scores = {
    str: s.range ? 10 : 16,
    dex: 14,
    con: 14,
    int: s.id === 'sorcerer' ? 12 : 10,
    wis: s.id === 'druid' ? 16 : 12,
    cha: ['bard', 'paladin', 'sorcerer', 'warlock'].includes(s.id) ? 16 : 10,
  }
  body.attacks = [
    {
      id: s.id + '-attack',
      name: s.range
        ? s.id === 'ranger'
          ? '长弓'
          : s.id === 'rogue'
            ? '投掷匕首'
            : '主题魔能攻击'
        : s.id === 'monk'
          ? '徒手攻击'
          : '近战武器',
      unarmed:s.id==='monk'||undefined,
      projectile:['ranger','rogue'].includes(s.id)?'ordinary':['sorcerer','warlock'].includes(s.id)?'energy':undefined,
      bonus: 5,
      damage: s.damage,
      damageType: s.type ?? 'slashing',
      reach: 5,
      range: s.range ?? 0,
      longRange: ['sorcerer', 'warlock'].includes(s.id) ? 0 : s.range ? s.range * 4 : 0,
      kind: ['sorcerer', 'warlock'].includes(s.id)
        ? 'spell'
        : s.id === 'rogue'
          ? 'thrown'
          : 'weapon',
    },
  ]
  const feature: NpcMonsterAbility = {
    id: s.id + '-feature',
    name: s.feature.split('：')[0]!,
    support: 'gm',
    cost:
      s.id === 'sorcerer'
        ? 'none'
        : ['rogue', 'barbarian', 'monk', 'fighter', 'bard', 'druid', 'paladin'].includes(s.id)
          ? 'bonus'
          : 'action',
    resourceId: 'feature-pool',
    note:
      s.feature +
      '。使用登记扣一次主题能力资源，实际效果由GM按所用规则处理；此为自定义NPC，不是完整玩家职业卡。',
  }
  body.abilities = [feature]
  body.resources = [
    {
      id: 'feature-pool',
      name: '主题能力（GM自定次数）',
      max: 2,
      remaining: 2,
      recovery: 'manual',
    },
  ]
  if (s.spell) {
    body.spellcasting = { ability: s.id === 'druid' ? 'wis' : 'cha', dc: 13, attackBonus: 5 }
    body.abilities.push({
      id: s.spell,
      name: '治愈真言',
      spellId: s.spell,
      slotLevel: 1,
      cost: 'bonus',
      support: 'automatic',
      resourceId: 'healing',
      note: '普通NPC每日次数，非玩家职业法术位',
    })
    body.resources.push({ id: 'healing', name: '治愈真言', max: 2, remaining: 2, recovery: 'day' })
  }
  const source = 'GM自定义职业主题 v.15；数值与次数为参考设计，强度及XP未标定'
  body.source = source
  const metadata: NonNullable<NpcTemplate['metadata']> = {
    sourceKind: 'custom',
    classIds: [s.id],
    englishName: s.id + ' archetype',
    category: 'civilian',
    sourceVersion: source,
    templateVersion: 'v15.1',
    proficiencyBonus: 2,
    alignment: '由GM配置',
    hitDice: 'GM自定生命值',
    skills: {},
    senses: [],
    passivePerception: 11,
    languages: ['通用语'],
    movement: [],
    gear: ['职业主题装备（参考）'],
    abilities: body.abilities.map((a) => ({
      id: a.id,
      name: a.name,
      support: a.support,
      detail: a.note,
      cost: a.cost,
    })),
  }
  body.templateMetadata = metadata
  return {
    id: 'custom-class-' + s.id,
    name: s.name,
    source,
    body,
    metadata,
    strategy: s.range ? 'ranged' : 'nearest',
    notes: [
      '普通NPC职业主题，不授予玩家职业等级；基础攻击可自动执行，主题特色按支持标签处理。',
      s.feature,
    ],
  }
})
