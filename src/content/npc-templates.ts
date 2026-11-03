import { customNpc } from '../core/combat-rules'
import { NPC_CLASS_TEMPLATES } from './npc-class-templates'
import { NPC_CLASS_COVERAGE } from './npc-class-template-index'
import { clone } from '../core/engine'
import type { NpcTemplate } from '../core/ai-types'
import type { Ability } from '../core/types'
import type { NpcAttack } from '../core/combat-types'
import { NPC_TEMPLATE_METADATA } from './npc-template-metadata'
import { NPC_ELITE_TEMPLATES } from './npc-elite-templates'
import { initialNpcState } from '../core/npc-abilities'

const attack = (
  id: string,
  name: string,
  bonus: number,
  damage: string,
  damageType: NpcAttack['damageType'],
  extras: Partial<NpcAttack> = {},
): NpcAttack => ({
  id,
  name,
  bonus,
  damage,
  damageType,
  reach: 5,
  range: 0,
  longRange: 0,
  kind: 'weapon',
  ...(['shortbow','longbow','crossbow','javelin','sling','spear-thrown'].includes(id)?{projectile:'ordinary' as const}:['rock','boulder'].includes(id)?{projectile:'massive' as const}:{}),
  ...extras,
})
function template(
  id: string,
  name: string,
  page: number,
  ac: number,
  hp: number,
  speed: number,
  values: number[],
  attacks: NpcAttack[],
  extras: Partial<NpcTemplate['body']> = {},
  notes: string[] = [],
): NpcTemplate {
  const keys: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const scores = Object.fromEntries(keys.map((k, i) => [k, values[i]!])) as Record<Ability, number>
  const saves = Object.fromEntries(
    keys.map((k) => [k, Math.floor((scores[k] - 10) / 2)]),
  ) as Record<Ability, number>
  const source = `SRD 5.2.1，第 ${page} 页；https://www.dndbeyond.com/srd`
  return {
    metadata: clone(NPC_TEMPLATE_METADATA[id]!),
    id,
    name,
    source,
    strategy: 'nearest',
    notes,
    body: {
      ...customNpc(),
      name,
      ac,
      hp,
      maxHp: hp,
      speed,
      scores,
      saves,
      initiativeBonus: saves.dex,
      attacks,
      source,
      creatureType: 'beast',
      size: 'medium',
      templateMetadata: clone(NPC_TEMPLATE_METADATA[id]!),
      ...extras,
    },
  }
}

// Stat blocks checked against the official SRD 5.2.1, not the 2014 monster entries.
export const NPC_TEMPLATES: NpcTemplate[] = [
  template(
    'srd-wolf',
    '狼',
    364,
    12,
    11,
    40,
    [14, 15, 12, 3, 12, 6],
    [
      attack('bite', '啃咬', 4, '1d6+2', 'piercing', {
        proneMaxSize: 'medium',
      }),
    ],
    { packTactics: true },
    [
      '集群战术：至少一名未失能盟友在目标 5 尺内时攻击具有优势（自动）。',
      '黑暗视觉 60 尺；察觉 +5、隐匿 +4、被动察觉 15（感官由 GM 核对）。',
    ],
  ),
  template(
    'srd-black-bear',
    '黑熊',
    345,
    11,
    19,
    30,
    [15, 12, 14, 2, 12, 7],
    [attack('rend', '撕裂', 4, '1d6+2', 'slashing')],
    { multiattack: ['rend', 'rend'] },
    [
      '多重攻击：一次动作撕裂两次（自动）。',
      '攀爬／游泳各 30 尺；黑暗视觉 60 尺；察觉 +5、被动察觉 15（特殊移动／感官由 GM 核对）。',
    ],
  ),
  template(
    'srd-brown-bear',
    '棕熊',
    346,
    11,
    22,
    40,
    [17, 12, 15, 2, 13, 7],
    [
      attack('bite', '啃咬', 5, '1d8+3', 'piercing'),
      attack('claw', '利爪', 5, '1d4+3', 'slashing', {
        proneMaxSize: 'large',
      }),
    ],
    { size: 'large', multiattack: ['bite', 'claw'] },
    [
      '多重攻击：一次动作啃咬、利爪各一次（自动）。',
      '攀爬 30 尺；黑暗视觉 60 尺；察觉 +3、被动察觉 13（特殊移动／感官由 GM 核对）。',
    ],
  ),
  template(
    'srd-guard',
    '普通守卫',
    296,
    16,
    11,
    30,
    [13, 12, 12, 10, 11, 10],
    [
      attack('spear', '长矛（近战）', 3, '1d6+1', 'piercing'),
      attack('spear-thrown', '长矛（投掷）', 3, '1d6+1', 'piercing', {
        kind: 'thrown',
        range: 20,
        longRange: 60,
        manualOnly: true,
      }),
    ],
    { creatureType: 'humanoid' },
    [
      '小型或中型类人；模板默认中型。装备链甲衫、盾牌、长矛，AC 已包含装备。',
      '察觉 +2、被动察觉 12；通用语。投掷需 GM 确认长矛库存／回收，固定自动策略使用近战。',
    ],
  ),
  template(
    'srd-ghoul',
    '食尸鬼',
    288,
    12,
    22,
    30,
    [13, 15, 10, 7, 10, 6],
    [
      attack('bite', '啃咬', 4, '1d6+2', 'piercing', {
        extraDamage: [{ formula: '1d6', type: 'necrotic' }],
      }),
      attack('claw', '利爪', 4, '1d4+2', 'slashing', {
        manualOnly: true,
        effectNote:
          '最终命中非亡灵、非精灵目标：DC 10 体质豁免，失败麻痹至目标下一回合结束。GM 核对免疫、豁免和时限后处理。',
      }),
    ],
    {
      creatureType: 'undead',
      multiattack: ['bite', 'bite'],
      immunities: ['poison'],
      conditionImmunities: ['charmed', 'exhaustion', 'poisoned'],
    },
    [
      '多重攻击：啃咬两次；每次穿刺与黯蚀分开结算（自动）。',
      '利爪为单独动作，麻痹由 GM 裁定，自动策略使用啃咬。',
      '黑暗视觉 60 尺；被动察觉 10；通用语（感官由 GM 核对）。',
    ],
  ),
  template(
    'srd-goblin-minion',
    '地精杂兵',
    290,
    12,
    7,
    30,
    [8, 15, 10, 10, 8, 8],
    [
      attack('dagger', '匕首', 4, '1d4+2', 'piercing'),
      attack('dagger-thrown', '匕首（投掷）', 4, '1d4+2', 'piercing', {
        range: 20,
        longRange: 60,
        kind: 'thrown',
        manualOnly: true,
      }),
    ],
    { size: 'small', creatureType: 'fey', nimbleEscape: true },
  ),
  template(
    'srd-goblin-warrior',
    '地精战士',
    290,
    15,
    10,
    30,
    [8, 15, 10, 10, 8, 8],
    [
      attack('scimitar', '弯刀', 4, '1d6+2', 'slashing', {
        extraDamage: [{ formula: '1d4', type: 'slashing', when: 'advantage' }],
      }),
      attack('shortbow', '短弓', 4, '1d6+2', 'piercing', {
        range: 80,
        longRange: 320,
        extraDamage: [{ formula: '1d4', type: 'piercing', when: 'advantage' }],
      }),
    ],
    { size: 'small', creatureType: 'fey', nimbleEscape: true },
  ),
  template(
    'srd-hobgoblin-warrior',
    '大地精战士',
    298,
    18,
    11,
    30,
    [13, 12, 12, 10, 10, 9],
    [
      attack('longsword', '长剑', 3, '2d10+1', 'slashing'),
      attack('longbow', '长弓', 3, '1d8+1', 'piercing', {
        range: 150,
        longRange: 600,
        extraDamage: [{ formula: '3d4', type: 'poison' }],
      }),
    ],
    { creatureType: 'fey', initiativeBonus: 3, packTactics: true },
  ),
  template(
    'srd-bugbear-warrior',
    '熊地精战士',
    272,
    14,
    33,
    30,
    [15, 14, 13, 8, 11, 9],
    [
      attack('grab', '抓握', 4, '2d6+2', 'bludgeoning', {
        reach: 10,
        effectNote:
          'GM核对中型或更小目标后施加来自本NPC的擒抱，逃脱DC12；掳走、擒抱来源和释放由GM处理。',
      }),
      attack('hammer', '轻锤', 4, '3d4+2', 'bludgeoning', {
        reach: 10,
        advantageWhileGrappling: true,
      }),
      attack('hammer-thrown', '轻锤（投掷）', 4, '3d4+2', 'bludgeoning', {
        range: 20,
        longRange: 60,
        kind: 'thrown',
        manualOnly: true,
        advantageWhileGrappling: true,
        effectNote: '核对轻锤库存／回收。',
      }),
    ],
    { creatureType: 'fey' },
  ),
  template(
    'srd-commoner',
    '平民',
    275,
    10,
    4,
    30,
    [10, 10, 10, 10, 10, 10],
    [attack('club', '木棒', 2, '1d4', 'bludgeoning')],
    { creatureType: 'humanoid' },
  ),
  template(
    'srd-bandit',
    '匪徒',
    261,
    12,
    11,
    30,
    [11, 12, 12, 10, 10, 10],
    [
      attack('scimitar', '弯刀', 3, '1d6+1', 'slashing'),
      attack('crossbow', '轻弩', 3, '1d8+1', 'piercing', { range: 80, longRange: 320 }),
    ],
    { creatureType: 'humanoid' },
  ),
  template(
    'srd-cultist',
    '邪教徒',
    278,
    12,
    9,
    30,
    [11, 12, 10, 10, 11, 10],
    [
      attack('ritual-sickle', '仪式镰刀', 3, '1d4+1', 'slashing', {
        extraDamage: [{ formula: '1', type: 'necrotic' }],
      }),
    ],
    { creatureType: 'humanoid', saves: { str: 0, dex: 1, con: 0, int: 0, wis: 2, cha: 0 } },
  ),
  template(
    'srd-scout',
    '斥候',
    322,
    13,
    16,
    30,
    [11, 14, 12, 11, 13, 11],
    [
      attack('shortsword', '短剑', 4, '1d6+2', 'piercing'),
      attack('longbow', '长弓', 4, '1d8+2', 'piercing', { range: 150, longRange: 600 }),
    ],
    {
      creatureType: 'humanoid',
      multiattackChoice: { count: 2, attackIds: ['shortsword', 'longbow'] },
    },
  ),
  template(
    'srd-skeleton',
    '骷髅',
    325,
    14,
    13,
    30,
    [10, 16, 15, 6, 8, 5],
    [
      attack('shortsword', '短剑', 5, '1d6+3', 'piercing'),
      attack('shortbow', '短弓', 5, '1d6+3', 'piercing', { range: 80, longRange: 320 }),
    ],
    {
      creatureType: 'undead',
      vulnerabilities: ['bludgeoning'],
      immunities: ['poison'],
      conditionImmunities: ['exhaustion', 'poisoned'],
    },
  ),
  template(
    'srd-zombie',
    '僵尸',
    343,
    8,
    15,
    20,
    [13, 6, 16, 3, 6, 5],
    [attack('slam', '猛击', 3, '1d8+1', 'bludgeoning')],
    {
      creatureType: 'undead',
      undeadFortitude: true,
      immunities: ['poison'],
      conditionImmunities: ['exhaustion', 'poisoned'],
      saves: { str: 1, dex: -2, con: 3, int: -4, wis: 0, cha: -3 },
    },
  ),
  template(
    'srd-giant-rat',
    '巨鼠',
    353,
    13,
    7,
    30,
    [7, 16, 11, 2, 10, 4],
    [attack('bite', '啃咬', 5, '1d4+3', 'piercing')],
    {
      size: 'small',
      packTactics: true,
      saves: { str: -2, dex: 5, con: 0, int: -4, wis: 0, cha: -3 },
    },
  ),
  template(
    'srd-giant-spider',
    '巨蜘蛛',
    353,
    14,
    26,
    30,
    [14, 16, 12, 2, 11, 4],
    [
      attack('bite', '啃咬', 5, '1d8+3', 'piercing', {
        extraDamage: [{ formula: '2d6', type: 'poison' }],
      }),
    ],
    {
      size: 'large',
      abilities: [
        {
          id: 'web',
          name: '蛛网',
          cost: 'action',
          support: 'gm',
          resourceId: 'web',
          note: 'GM处理DC13敏捷、束缚、蛛网对象和解除；本入口扣动作及充能',
        },
      ],
      resources: [
        {
          id: 'web',
          name: '蛛网充能5–6',
          max: 1,
          remaining: 1,
          recovery: 'recharge',
          rechargeMin: 5,
        },
      ],
    },
  ),
  template(
    'srd-dire-wolf',
    '恐狼',
    347,
    14,
    22,
    50,
    [17, 15, 15, 3, 12, 7],
    [attack('bite', '啃咬', 5, '1d10+3', 'piercing', { proneMaxSize: 'large' })],
    { size: 'large', packTactics: true },
  ),
  template(
    'srd-boar',
    '野猪',
    346,
    11,
    13,
    40,
    [13, 11, 14, 2, 9, 5],
    [
      attack('gore', '獠牙', 3, '1d6+1', 'piercing', {
        extraDamage: [{ formula: '1d6', type: 'piercing', when: 'charge' }],
        proneMaxSize: 'medium',
        proneRequiresCharge: true,
        effectNote:
          '冲撞：GM核对紧接攻击前朝目标直线移动至少20尺；攻击前勾选确认后，合并额外伤害和倒地。不符合时不触发。',
      }),
    ],
    { bloodiedFury: true },
  ),
  template(
    'srd-panther',
    '豹',
    358,
    13,
    13,
    50,
    [14, 16, 10, 3, 14, 7],
    [attack('rend', '撕裂', 5, '1d6+3', 'slashing')],
    { nimbleEscape: true },
  ),
  ...NPC_ELITE_TEMPLATES,
  ...NPC_CLASS_TEMPLATES,
]
for (const [classId, templateId] of Object.entries(NPC_CLASS_COVERAGE)) {
  const t = NPC_TEMPLATES.find((t) => t.id === templateId)
  if (t?.metadata) {
    t.metadata.classIds = [classId]
    t.body.templateMetadata = clone(t.metadata)
  }
}

export function npcTemplate(id: string, custom: NpcTemplate[] = []) {
  const source = [...NPC_TEMPLATES, ...custom].find((t) => t.id === id)
  if (!source) throw Error('NPC 模板不存在')
  const result = clone(source)
  // Earlier GM copies keep their source snapshot in the body only.
  result.metadata ??= result.body.templateMetadata && clone(result.body.templateMetadata)
  result.body.hp = result.body.maxHp
  result.body.temporaryHp = 0
  result.body.conditions = []
  result.body.effects = []
  result.body.dead = false
  result.body = initialNpcState(result.body)
  return result
}
