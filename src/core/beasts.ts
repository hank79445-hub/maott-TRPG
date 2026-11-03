import type { Ability } from './types'
import type { CombatNpc } from './combat-types'

export interface BeastForm {
  id: string
  name: string
  page: number
  cr: number
  fly: number
  climb: number
  ac: number
  hp: number
  speed: number
  scores: Record<Ability, number>
  saves: Partial<Record<Ability, number>>
  skills: Record<string, number>
  attack: {
    name: string
    bonus: number
    damage: string
    type: 'piercing' | 'slashing' | 'bludgeoning'
  }
  note: string
}
const scores = (str: number, dex: number, con: number, int: number, wis: number, cha: number) => ({
  str,
  dex,
  con,
  int,
  wis,
  cha,
})
// SRD 5.2.1 Animals. Special senses, movement modes and traits are explicit GM
// facts; their mere presence never grants a silent positional override.
export const BEASTS: BeastForm[] = [
  {
    id: 'brown-bear',
    name: '棕熊',
    page: 0,
    cr: 1,
    fly: 0,
    climb: 30,
    ac: 11,
    hp: 22,
    speed: 40,
    scores: scores(17, 12, 15, 2, 13, 7),
    saves: {},
    skills: { perception: 3 },
    attack: { name: '啃咬', bonus: 5, damage: '1d8+3', type: 'piercing' },
    note: 'MM2025／PHB 附录B勘误；大型、黑暗视觉60。多重攻击：啃咬一次和利爪一次，利爪1d4+3挥砍，大型或以下倒地；GM核对体型。',
  },
  {
    id: 'dire-wolf',
    name: '恐狼',
    page: 0,
    cr: 1,
    fly: 0,
    climb: 0,
    ac: 14,
    hp: 22,
    speed: 50,
    scores: scores(17, 14, 15, 3, 12, 7),
    saves: {},
    skills: { perception: 5, stealth: 4 },
    attack: { name: '啃咬', bonus: 5, damage: '1d10+3', type: 'piercing' },
    note: 'MM2025／PHB附录B勘误；大型、黑暗视觉60；集群战术由GM核对盟友，大型或以下命中倒地。',
  },
  {
    id: 'giant-spider',
    name: '巨蜘蛛',
    page: 0,
    cr: 1,
    fly: 0,
    climb: 30,
    ac: 14,
    hp: 26,
    speed: 30,
    scores: scores(14, 16, 12, 2, 11, 4),
    saves: {},
    skills: { perception: 4, stealth: 7 },
    attack: { name: '啃咬', bonus: 5, damage: '1d8+3', type: 'piercing' },
    note: 'MM2025／PHB附录B勘误；大型、黑暗视觉60、蛛行、蛛网行者；啃咬另2d6毒素。蛛网充能5–6，60尺单目标敏捷DC13失败束缚；网AC10/HP5，火焰易伤、毒素心灵免疫，GM管理网对象和充能。',
  },
  {
    id: 'giant-goat',
    name: '巨山羊',
    page: 351,
    cr: 0.5,
    fly: 0,
    climb: 30,
    ac: 11,
    hp: 19,
    speed: 40,
    scores: scores(17, 13, 12, 3, 12, 6),
    saves: { str: 5 },
    skills: { perception: 3 },
    attack: { name: '冲撞', bonus: 5, damage: '1d6+3', type: 'bludgeoning' },
    note: '大型；命中前径直移动至少 20 尺时，对大型或更小目标追加 2d4 钝击并倒地，由 GM 核对路径与体型；黑暗视觉 60 尺。',
  },
  {
    id: 'rat',
    name: '鼠',
    page: 359,
    cr: 0,
    fly: 0,
    climb: 20,
    ac: 10,
    hp: 1,
    speed: 20,
    scores: scores(2, 11, 9, 2, 10, 4),
    saves: {},
    skills: { perception: 2 },
    attack: { name: '啮咬', bonus: 2, damage: '1', type: 'piercing' },
    note: '黑暗视觉 30 尺；移动离开敌方触及不引发借机攻击。',
  },
  {
    id: 'riding-horse',
    name: '乘用马',
    page: 360,
    cr: 0.25,
    fly: 0,
    climb: 0,
    ac: 11,
    hp: 13,
    speed: 60,
    scores: scores(16, 13, 12, 2, 11, 7),
    saves: {},
    skills: {},
    attack: { name: '蹄击', bonus: 5, damage: '1d8+3', type: 'bludgeoning' },
    note: '大型；骑乘与体型由 GM 核对。',
  },
  {
    id: 'spider',
    name: '蜘蛛',
    page: 361,
    cr: 0,
    fly: 0,
    climb: 20,
    ac: 12,
    hp: 1,
    speed: 20,
    scores: scores(2, 14, 8, 1, 10, 2),
    saves: {},
    skills: { stealth: 4 },
    attack: { name: '啮咬', bonus: 4, damage: '1', type: 'piercing' },
    note: '啮咬另含 1d4 毒素伤害；蜘蛛攀爬、蛛网行者、黑暗视觉 30 尺。',
  },
  {
    id: 'wolf',
    name: '狼',
    page: 364,
    cr: 0.25,
    fly: 0,
    climb: 0,
    ac: 12,
    hp: 11,
    speed: 40,
    scores: scores(14, 15, 12, 3, 12, 6),
    saves: {},
    skills: { perception: 5, stealth: 4 },
    attack: { name: '啮咬', bonus: 4, damage: '1d6+2', type: 'piercing' },
    note: '集群战术；命中中型或更小目标使其倒地。体型、盟友与黑暗视觉 60 尺由 GM 核对。',
  },
  {
    id: 'cat',
    name: '猫',
    page: 346,
    cr: 0,
    fly: 0,
    climb: 40,
    ac: 12,
    hp: 2,
    speed: 40,
    scores: scores(3, 15, 10, 3, 12, 7),
    saves: { dex: 4 },
    skills: { perception: 3, stealth: 4 },
    attack: { name: '抓挠', bonus: 4, damage: '1', type: 'slashing' },
    note: '跳跃按敏捷；黑暗视觉 60 尺。',
  },
  {
    id: 'panther',
    name: '黑豹',
    page: 358,
    cr: 0.25,
    fly: 0,
    climb: 40,
    ac: 13,
    hp: 13,
    speed: 50,
    scores: scores(14, 16, 10, 3, 14, 7),
    saves: {},
    skills: { perception: 4, stealth: 7 },
    attack: { name: '撕裂', bonus: 5, damage: '1d6+3', type: 'slashing' },
    note: '附赠动作撤离或躲藏由 GM 裁定；黑暗视觉 60 尺。',
  },
  {
    id: 'owl',
    name: '猫头鹰',
    page: 358,
    cr: 0,
    fly: 60,
    climb: 0,
    ac: 11,
    hp: 1,
    speed: 5,
    scores: scores(3, 13, 8, 2, 12, 7),
    saves: {},
    skills: { perception: 5, stealth: 5 },
    attack: { name: '爪击', bonus: 3, damage: '1', type: 'slashing' },
    note: '飞掠（飞行离开触及不引发借机）；黑暗视觉 120 尺。1–5 级荒野形态不能选择。',
  },
]
export const DEFAULT_BEASTS = ['rat', 'riding-horse', 'spider', 'wolf']
export const beast = (id: string) => BEASTS.find((b) => b.id === id)
export function beastNpc(id: string): CombatNpc {
  const b = beast(id)
  if (!b) throw new Error('未知兽形')
  return {
    name: b.name,
    creatureType: 'beast',
    ac: b.ac,
    maxHp: b.hp,
    hp: b.hp,
    temporaryHp: 0,
    speed: b.speed,
    scores: { ...b.scores },
    saves: Object.fromEntries(
      Object.entries(b.scores).map(([a, n]) => [
        a,
        b.saves[a as Ability] ?? Math.floor((n - 10) / 2),
      ]),
    ) as Record<Ability, number>,
    initiativeBonus: Math.floor((b.scores.dex - 10) / 2),
    attacks: [
      {
        id: 'beast-' + b.id,
        name: b.attack.name,
        bonus: b.attack.bonus,
        damage: b.attack.damage,
        damageType: b.attack.type,
        reach: 5,
        range: 0,
        longRange: 0,
      },
      ...(b.id === 'brown-bear'
        ? [
            {
              id: 'beast-brown-bear-claw',
              name: '利爪',
              bonus: 5,
              damage: '1d4+3',
              damageType: 'slashing' as const,
              reach: 5,
              range: 0,
              longRange: 0,
            },
          ]
        : []),
    ],
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    conditionImmunities: [],
    conditions: [],
    effects: [],
    dead: false,
    source: (b.page ? 'SRD 5.2.1 p.' + b.page : 'PHB2024 附录B／MM2025') + '；' + b.note,
  }
}
