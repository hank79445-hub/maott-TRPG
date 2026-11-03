import { hasSubclass } from './growth-rules'
import type { Character } from './types'
export interface ManualFeature {
  id: string
  name: string
  page: number
  cost: 'action' | 'bonus' | 'none'
  resource?: string
  amount: number
  detail: string
  once?: boolean
}
/** These actions charge their canonical costs; GM checks triggers and applies target results. */
export function manualFeatures(c: Character): ManualFeature[] {
  const result: ManualFeature[] = []
  const add = (
    id: string,
    name: string,
    page: number,
    cost: ManualFeature['cost'],
    detail: string,
    resource?: string,
    amount = 1,
    once = false,
  ) => result.push({ id: 'growth/' + id, name, page, cost, resource, amount, detail, once })
  const l = c.level,
    id = c.build.classId
  if (id === 'barbarian' && l >= 2)
    add(
      'reckless',
      '鲁莽攻击',
      29,
      'none',
      '本回合首次力量攻击时启用，力量攻击优势；针对你的攻击优势，至下次自己回合开始。',
    )
  if (id === 'cleric' && l >= 2) {
    add(
      'spark',
      '神圣火花',
      37,
      'action',
      '30 尺内另一可见生物；1d8+感知治疗，或体质豁免后黯蚀／光耀伤害，成功减半。',
      'channel-divinity',
    )
    add(
      'turn-undead',
      '驱散亡灵',
      37,
      'action',
      '30 尺内看见或听见你的亡灵感知豁免，逃离等效果按原文。' +
        (l >= 5 ? '焚灼亡灵可附加感知调整值（至少 1）个 d8 光耀，不提前结束驱散。' : ''),
      'channel-divinity',
    )
    if (hasSubclass(c.build, 'life'))
      add(
        'preserve-life',
        '保全生命',
        40,
        'action',
        '分配等级×5 HP，30 尺内濒血目标，不能超过各目标半血。分配明细由 GM 记录。',
        'channel-divinity',
      )
  }
  if (id === 'druid' && l >= 2) {
    add(
      'wild-shape',
      '荒野形态',
      42,
      'bonus',
      '已知野兽形态与 CR／飞行限制按原文；变形模板与特殊攻击由 GM 管理，不自动替换角色数值。',
      'wild-shape',
    )
    add(
      'companion',
      '荒野伙伴',
      44,
      'action',
      'Find Familiar，消耗荒野形态（或在法术入口使用法术位），无需材料。',
      'wild-shape',
    )
    if (hasSubclass(c.build, 'land'))
      add(
        'land-aid',
        '大地援助',
        46,
        'action',
        '60 尺内 10 尺半径区域；体质豁免 2d6 黯蚀，成功减半；其中一名生物 2d6 治疗。',
        'wild-shape',
      )
  }
  if (id === 'monk' && l >= 2) {
    add(
      'flurry',
      '疾风连击',
      51,
      'bonus',
      '进行两次徒手打击，伤害与三级散打效果由 GM 分步结算。',
      'focus',
    )
    add('defense', '坚韧防御', 51, 'bonus', '撤离并回避，直至下一回合开始。', 'focus')
    add('wind', '疾步', 51, 'bonus', '疾走与撤离，本回合跳跃距离翻倍。', 'focus')
    if (l >= 5)
      add(
        'stun',
        '震慑击',
        51,
        'none',
        '本回合徒手或武僧武器命中后；体质豁免 DC=8+熟练+感知。失败震慑至下次自己回合开始；成功速度减半、下一攻击优势。',
        'focus',
        1,
        true,
      )
  }
  if (hasSubclass(c.build, 'devotion'))
    add(
      'sacred-weapon',
      '圣武器',
      56,
      'none',
      '使用攻击动作时启用；持用近战武器，攻击加值至少 +1 魅力、可选光耀，持续十分钟。效果由 GM 管理。',
      'channel-divinity',
    )
  if (hasSubclass(c.build, 'hunter'))
    add(
      'hunter',
      '猎人猎物',
      61,
      'none',
      c.build.choices['hunter-choice']?.[0] === 'horde'
        ? '每回合一次，命中目标 5 尺内另一个生物追加同武器攻击，须符合射程。'
        : '每回合一次，命中非满血目标追加 1d8 武器伤害。',
      undefined,
      1,
      true,
    )
  if (id === 'rogue' && l >= 2) {
    add('cunning', '灵巧动作', 62, 'bonus', '疾走、撤离或躲藏；条件与检定由 GM 确认。')
    if (l >= 3) {
      add('steady-aim', '稳固瞄准', 62, 'bonus', '本回合未移动，下一攻击优势且速度归零；GM 核对。')
      if (hasSubclass(c.build, 'thief'))
        add(
          'fast-hands',
          '快手',
          64,
          'bonus',
          '巧手检定、使用动作或允许的魔法物品动作；由 GM 核对对象。',
        )
    }
    if (l >= 5)
      add(
        'cunning-strike',
        '狡诈打击',
        63,
        'none',
        '偷袭命中时放弃 1d6 换取毒击、绊摔或撤离；目标豁免与余下伤害由 GM 确认。',
      )
  }
  if (id === 'fighter' && l >= 2)
    add(
      'tactical-mind',
      '战术头脑',
      48,
      'none',
      '能力检定失败后加 1d10；仍失败不消耗回气。请在 GM 确认改变成功后再提交。',
      'second-wind',
    )
  return result
}
