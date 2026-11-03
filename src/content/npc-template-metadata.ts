import type { NpcTemplateMetadata as Meta } from '../core/npc-template-types'
type Ability = Meta['abilities'][number]
const auto = (id: string, name: string, detail: string, cost?: Ability['cost']): Ability => ({
  id,
  name,
  detail,
  cost,
  support: 'automatic',
})
const gm = (id: string, name: string, detail: string, cost?: Ability['cost']): Ability => ({
  id,
  name,
  detail,
  cost,
  support: 'gm',
})
const pack = auto(
  'pack-tactics',
  '集群战术',
  '地图NPC策略核查目标5尺内未失能盟友；攻击优势与劣势合并抵消。手动不经地图的攻击由GM填写环境。',
)
const nimble = [
  auto(
    'nimble-disengage',
    '灵巧逃脱：撤离',
    '消耗一次附赠动作撤离，持续至本回合结束；不额外授予移动力。',
    'bonus',
  ),
  gm(
    'nimble-hide',
    '灵巧逃脱：躲藏',
    '消耗附赠动作；视线／掩护、隐匿检定、隐形状态及解除由GM按隐藏规则处理。',
    'bonus',
  ),
]
const base = (
  englishName: string,
  category: Meta['category'],
  pages: number[],
  cr: string,
  xp: number,
  hitDice: string,
  extra: Partial<Meta> = {},
): Meta => ({
  englishName,
  category,
  pages,
  cr,
  xp,
  hitDice,
  sourceVersion: 'SRD 5.2.1',
  templateVersion: '1.0.0',
  proficiencyBonus: 2,
  alignment: '无阵营',
  skills: {},
  senses: [],
  passivePerception: 10,
  languages: [],
  movement: [],
  gear: [],
  abilities: [
    auto(
      'attacks',
      '基础攻击与伤害',
      '命中／重击、各类伤害、抗性及免疫复用战斗结算；可选GM效果另列。',
      'action',
    ),
  ],
  ...extra,
})
export const NPC_TEMPLATE_METADATA: Record<string, Meta> = {
  'srd-wolf': base('Wolf', 'beast', [364], '1/4', 50, '2d8+2', {
    skills: { perception: 5, stealth: 4 },
    senses: ['黑暗视觉60尺'],
    passivePerception: 15,
    abilities: [pack, auto('prone', '啃咬倒地', '最终命中中型或更小生物时使其倒地；无额外豁免。')],
  }),
  'srd-black-bear': base('Black Bear', 'beast', [345], '1/2', 100, '3d8+6', {
    skills: { perception: 5 },
    senses: ['黑暗视觉60尺'],
    passivePerception: 15,
    movement: [
      { kind: 'climb', feet: 30 },
      { kind: 'swim', feet: 30 },
    ],
    abilities: [
      auto('multiattack', '多重攻击', '一个动作撕裂两次；每次独立命中与结算。', 'action'),
    ],
  }),
  'srd-brown-bear': base('Brown Bear', 'beast', [346], '1', 200, '3d10+6', {
    skills: { perception: 3 },
    senses: ['黑暗视觉60尺'],
    passivePerception: 13,
    movement: [{ kind: 'climb', feet: 30 }],
    abilities: [
      auto(
        'multiattack',
        '多重攻击',
        '一个动作啃咬、利爪各一次，不能替换为两次同一攻击。',
        'action',
      ),
      auto('prone', '利爪倒地', '最终命中大型或更小生物时倒地；无额外豁免。'),
    ],
  }),
  'srd-guard': base('Guard', 'civilian', [296], '1/8', 25, '2d8+2', {
    alignment: '中立',
    skills: { perception: 2 },
    passivePerception: 12,
    languages: ['通用语'],
    gear: ['链甲衫', '盾牌', '长矛'],
    abilities: [
      auto('spear', '长矛近战', '触及5尺，+3命中，1d6+1穿刺。', 'action'),
      gm(
        'thrown',
        '长矛投掷',
        '20/60尺；投掷库存、落点和回收由GM核对，默认自动策略不用投掷。',
        'action',
      ),
    ],
  }),
  'srd-ghoul': base('Ghoul', 'undead', [288], '1', 200, '5d8', {
    alignment: '混乱邪恶',
    senses: ['黑暗视觉60尺'],
    languages: ['通用语'],
    abilities: [
      auto('multiattack', '多重攻击', '一个动作啃咬两次；穿刺与黯蚀分别结算。', 'action'),
      gm(
        'claw',
        '利爪麻痹',
        '命中非亡灵且非精灵的生物后DC10体质豁免，失败麻痹至目标下一回合结束。利爪是独立动作，自动策略仅用啃咬。',
        'action',
      ),
    ],
  }),
  'srd-goblin-minion': base('Goblin Minion', 'goblinoid', [290], '1/8', 25, '2d6', {
    alignment: '混乱中立',
    skills: { stealth: 6 },
    passivePerception: 9,
    senses: ['黑暗视觉60尺'],
    languages: ['通用语', '地精语'],
    gear: ['匕首×3'],
    abilities: [...nimble, gm('thrown', '匕首投掷', '20/60尺，需GM管理库存和回收。', 'action')],
  }),
  'srd-goblin-warrior': base('Goblin Warrior', 'goblinoid', [290], '1/4', 50, '3d6', {
    alignment: '混乱中立',
    skills: { stealth: 6 },
    passivePerception: 9,
    senses: ['黑暗视觉60尺'],
    languages: ['通用语', '地精语'],
    gear: ['皮甲', '弯刀', '盾牌', '短弓'],
    abilities: [
      ...nimble,
      auto(
        'advantage-damage',
        '优势额外伤害',
        '弯刀／短弓实际检定处于优势时增加1d4相同类型伤害；优势抵消后不增加，重击翻倍伤害骰。',
      ),
    ],
  }),
  'srd-hobgoblin-warrior': base('Hobgoblin Warrior', 'goblinoid', [298, 299], '1/2', 100, '2d8+2', {
    alignment: '守序邪恶',
    senses: ['黑暗视觉60尺'],
    languages: ['通用语', '地精语'],
    gear: ['半身板甲', '长弓', '长剑', '盾牌'],
    abilities: [
      pack,
      auto('bow-poison', '毒素长弓', '长弓伤害1d8+1穿刺加3d4毒素；没有额外毒素豁免。', 'action'),
    ],
  }),
  'srd-bugbear-warrior': base('Bugbear Warrior', 'goblinoid', [272], '1', 200, '6d8+6', {
    alignment: '混乱邪恶',
    skills: { stealth: 6, survival: 2 },
    senses: ['黑暗视觉60尺'],
    languages: ['通用语', '地精语'],
    gear: ['兽皮甲', '轻锤×3'],
    requiresManualTurn: true,
    abilities: [
      gm(
        'grab',
        '抓握',
        '触及10尺；2d6+2钝击，命中中型或更小生物使其擒抱，逃脱DC12；来源、体型与逃脱由GM处理。',
        'action',
      ),
      gm(
        'hammer',
        '轻锤优势',
        '目标被自身擒抱时有优势；触及10尺／投掷20/60尺，3d4+2钝击。库存、擒抱来源由GM核对。',
        'action',
      ),
      gm('abduct', '掳走', '拖动自身擒抱的生物不额外消耗移动力；棋子伴随和路径由GM处理。'),
    ],
  }),
  'srd-commoner': base('Commoner', 'civilian', [275], '0', 10, '1d8', {
    alignment: '中立',
    languages: ['通用语'],
    gear: ['木棒'],
    abilities: [
      auto('club', '木棒', '+2命中，1d4钝击。', 'action'),
      gm(
        'training',
        '训练',
        'GM选择一个熟练技能；使用该技能进行属性检定时具有优势，选择与检定由GM处理。',
      ),
    ],
  }),
  'srd-bandit': base('Bandit', 'civilian', [261], '1/8', 25, '2d8+2', {
    alignment: '中立',
    languages: ['通用语', '盗贼黑话'],
    gear: ['皮甲', '轻弩', '弯刀'],
  }),
  'srd-cultist': base('Cultist', 'civilian', [278], '1/8', 25, '2d8', {
    alignment: '中立',
    skills: { deception: 2, religion: 2 },
    languages: ['通用语'],
    gear: ['皮甲', '镰刀'],
    abilities: [
      auto(
        'ritual-sickle',
        '仪式镰刀',
        '1d4+1挥砍加固定1点黯蚀，分类型结算；重击不翻倍固定伤害。',
        'action',
      ),
    ],
  }),
  'srd-scout': base('Scout', 'civilian', [322], '1/2', 100, '3d8+3', {
    alignment: '中立',
    skills: { nature: 4, perception: 5, stealth: 6, survival: 5 },
    passivePerception: 15,
    languages: ['通用语', '另一种语言（GM选择）'],
    gear: ['皮甲', '长弓', '短剑'],
    abilities: [
      auto(
        'multiattack-choice',
        '任选组合多重攻击',
        '一个动作可使用短剑／长弓任意组合攻击两次；每次重新核查射程和目标。',
        'action',
      ),
    ],
  }),
  'srd-skeleton': base('Skeleton', 'undead', [325, 326], '1/4', 50, '2d8+4', {
    alignment: '守序邪恶',
    passivePerception: 9,
    senses: ['黑暗视觉60尺'],
    languages: ['理解通用语及另一种语言，不能说话'],
    gear: ['短弓', '短剑'],
    abilities: [
      auto(
        'vulnerability',
        '伤害易伤与免疫',
        '钝击易伤；毒素、力竭和中毒免疫，复用结算与状态校验。',
      ),
    ],
  }),
  'srd-zombie': base('Zombie', 'undead', [343, 344], '1/4', 50, '2d8+6', {
    alignment: '中立邪恶',
    passivePerception: 8,
    senses: ['黑暗视觉60尺'],
    languages: ['理解通用语及另一种语言，不能说话'],
    abilities: [
      auto(
        'undead-fortitude',
        '不死韧性',
        '单次伤害使HP降至0时，除光耀／重击外进行DC5＋实际所受伤害的体质豁免，成功保留1HP。按减伤／抗性后的伤害核对。',
      ),
    ],
  }),
  'srd-giant-rat': base('Giant Rat', 'beast', [353], '1/8', 25, '2d6', {
    skills: { perception: 2 },
    passivePerception: 12,
    senses: ['黑暗视觉60尺'],
    movement: [{ kind: 'climb', feet: 30 }],
    abilities: [pack],
  }),
  'srd-giant-spider': base('Giant Spider', 'beast', [353, 354], '1', 200, '4d10+4', {
    templateVersion: '1.0.1',
    skills: { perception: 4, stealth: 7 },
    passivePerception: 14,
    senses: ['黑暗视觉60尺'],
    movement: [{ kind: 'climb', feet: 30 }],
    requiresManualTurn: true,
    abilities: [
      auto('bite-poison', '毒素啃咬', '1d8+3穿刺加2d6毒素；没有2014版毒素豁免或麻痹。', 'action'),
      gm(
        'web',
        '蛛网',
        '充能5–6由回合开始资源池处理；60尺可见单目标DC13敏捷豁免，失败束缚至蛛网被破坏。蛛网AC10／HP5，火焰易伤，毒素和心灵免疫；豁免、物体及束缚解除由GM管理。',
        'action',
      ),
      gm(
        'spider-climb',
        '蜘蛛攀爬',
        '能攀爬困难表面和天花板而无需属性检定；首版特殊移动由GM处理。',
      ),
      gm(
        'web-walker',
        '蛛网行者',
        '忽略蛛网移动限制，并知道与同一蛛网接触的生物位置；空间感知由GM处理。',
      ),
    ],
  }),
  'srd-dire-wolf': base('Dire Wolf', 'beast', [347], '1', 200, '3d10+6', {
    skills: { perception: 5, stealth: 4 },
    passivePerception: 15,
    senses: ['黑暗视觉60尺'],
    abilities: [pack, auto('prone', '啃咬倒地', '最终命中大型或更小生物时倒地；无额外豁免。')],
  }),
  'srd-boar': base('Boar', 'beast', [346], '1/4', 50, '2d8+4', {
    passivePerception: 9,
    requiresManualTurn: true,
    abilities: [
      auto('bloodied-fury', '嗜血狂怒', '生命值不超过最大值一半时攻击优势，与劣势抵消。'),
      gm(
        'charge',
        '冲撞',
        '命中前紧接着朝目标直线移动至少20尺且目标为中型或更小生物时，额外1d6穿刺并倒地；GM核对完整条件后结算。',
      ),
    ],
  }),
  'srd-panther': base('Panther', 'beast', [358], '1/4', 50, '3d8', {
    skills: { perception: 4, stealth: 7 },
    passivePerception: 14,
    senses: ['黑暗视觉60尺'],
    movement: [{ kind: 'climb', feet: 40 }],
    abilities: nimble,
  }),
}
