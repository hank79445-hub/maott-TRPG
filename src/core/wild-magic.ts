import type { Character, Runtime, ActiveEffect } from './types'
import { hasSubclass, slotLevels } from './growth-rules'
/** 2024 table: 25 four-point ranges; the 2014 table has a different layout. */
export const WILD_SURGES = [
  '一分钟内每次自己回合开始重掷本表，后续跳过 01—04。',
  '60 尺内随机空位出现由 GM 控制的友善生物，一分钟后消失；d4：二元魔冢、呋噜、单元魔冢、独角兽。',
  '一分钟内每次自己回合开始恢复 5 HP。',
  '一分钟内下一道需要豁免的法术，其目标豁免劣势。',
  'd8 外观／体型结果：音乐、增大一级、羽毛胡须、只能喊叫、蝴蝶、第三眼察觉优势、粉色泡泡、蓝皮；除蓝皮 24 小时外一分钟，羽毛打喷嚏结束。',
  '一分钟内动作时间法术改为附赠动作。',
  '进入星光位面至自己下回合结束，随后返回原位置或最近空位。',
  '一分钟内下一道伤害法术的伤害骰取满，不掷伤害骰。',
  '一分钟内抗所有伤害。',
  '盆栽形态至自己下回合开始：失能、所有伤害易伤；归零花盆碎裂并复原。',
  '一分钟内自己每回合可附赠动作传送至多 20 尺。',
  '自己和至多三名 30 尺内目标隐形一分钟，各在攻击／伤害／施法后结束。',
  '一分钟灵体盾：AC＋2，免疫魔法飞弹。',
  '本回合获得一个额外动作。',
  'd10 例外施法：困惑、火球、云雾、飞行（60 尺内随机目标）、油腻、浮空（自己）、五环魔法飞弹、镜影、变形（自己，失败变山羊）、识破隐形。无需通常的专注，至最大持续时间，不能超魔。',
  '一分钟内触碰未穿戴／携带的非魔法可燃物，1d4 火焰并起火。',
  '一小时内死亡则立即如转生术复活；新身体由 GM 决定。',
  '恐慌至自己下回合结束，GM 指定恐惧来源。',
  '立即传送至多 60 尺至可见空位。',
  '60 尺内随机生物中毒 d4 小时。',
  '一分钟 30 尺明亮光照；5 尺内生物回合末目盲至其下回合结束。',
  '30 尺内至多三个可见目标各 d10 黯蚀，自己恢复实际造成的总伤害。',
  '30 尺内至多三个可见目标各 4d10 闪电。',
  '一分钟内自己与 30 尺内所有生物易伤穿刺。',
  'd6：自己回 2d10 HP；300 尺内盟友回 2d10；自己回最低已耗环级一位；300 尺盟友回最低已耗一位；回全部术法点；17—20 的全部八项同时出现。',
]
export function wildMagic(
  c: Character,
  r: Runtime,
  dice: (s: number) => number,
  check: boolean,
  repeat = false,
): string {
  if (!hasSubclass(c.build, 'wild-magic')) return ''
  const forced = (r.resources['tides-chaos'] ?? 1) === 0
  if (!forced && !check && !repeat) return ''
  const die = (s: number) => {
    const n = dice(s)
    if (!Number.isInteger(n) || n < 1 || n > s) throw new Error('浪涌骰不合法')
    return n
  }
  if (forced && !repeat) r.resources['tides-chaos'] = 1
  const trigger = forced || repeat ? 20 : die(20)
  if (trigger !== 20) return '；狂野魔法 d20＝' + trigger + '，未浪涌'
  const n = die(100),
    row = Math.floor((n - 1) / 4),
    subs: number[] = [],
    id = crypto.randomUUID()
  if (repeat && n <= 4) return '；回合开始浪涌 d100＝' + n + '，按规则忽略 01—04，不生成新结果'
  const state = (r.advanced.surges ??= [])
  if (state.filter((s) => !s.settled).length >= 20) throw new Error('请先裁定已有浪涌结果')
  let duration = 1 / 60
  const effect = (key: string, fields: Partial<ActiveEffect> = {}, hours = duration) =>
    r.effects.push({
      id: crypto.randomUUID(),
      key,
      name: '狂野魔法 · ' + (row * 4 + 1) + '—' + (row * 4 + 4),
      sourceId: c.id,
      page: 0,
      concentration: false,
      expiresAt: null,
      encounterId: 'outside',
      phase: 'start',
      endsAt: r.hours + hours,
      note: WILD_SURGES[row]!,
      ...fields,
    })
  switch (row) {
    case 0:
      effect('wild-repeat')
      break
    case 1:
      subs.push(die(4))
      break
    case 2:
      effect('wild-regeneration')
      break
    case 3:
      effect('wild-save-disadvantage')
      break
    case 4:
      subs.push(die(8))
      effect('wild-cosmetic-' + subs[0], {}, subs[0] === 8 ? 24 : duration)
      break
    case 5:
      effect('wild-quick-casting')
      break
    case 6:
      duration = 1 / 600
      effect('wild-astral', {}, duration)
      break
    case 7:
      effect('wild-max-damage')
      break
    case 8:
      effect('wild-resistance')
      break
    case 9:
      duration = 1 / 600
      effect('wild-potted', { condition: 'incapacitated' }, duration)
      break
    case 10:
      effect('wild-teleport')
      break
    case 11:
      effect('wild-invisible', { condition: 'invisible' })
      break
    case 12:
      effect('wild-shield', { acBonus: 2 })
      break
    case 13:
      effect('wild-extra-action', {}, 1 / 600)
      break
    case 14:
      subs.push(die(10))
      break
    case 15:
      effect('wild-ignite')
      break
    case 16:
      duration = 1
      effect('wild-reincarnate', {}, duration)
      break
    case 17:
      duration = 1 / 600
      effect('wild-frightened', { condition: 'frightened' }, duration)
      break
    case 19:
      subs.push(die(4))
      duration = subs[0]!
      break
    case 20:
      effect('wild-light')
      break
    case 23:
      effect('wild-piercing-vulnerability')
      break
    case 24: {
      const sub = die(6)
      subs.push(sub)
      if (sub === 1) {
        const rolls = [die(10), die(10)]
        subs.push(...rolls)
        if (!r.death.dead && !r.effects.some((e) => e.blocksHealing)) r.hp += rolls[0]! + rolls[1]!
      }
      if (sub === 3) {
        const slots = slotLevels(c.build),
          i = slots.findIndex(
            (max, i) => max > (r.resources[i === 0 ? 'slots' : 'slots-' + (i + 1)] ?? 0),
          )
        if (i >= 0) r.resources[i === 0 ? 'slots' : 'slots-' + (i + 1)]!++
      }
      if (sub === 5) r.resources['sorcery-points'] = c.level
      if (sub === 6)
        for (let i = 1; i <= 8; i++) effect('wild-cosmetic-' + i, {}, i === 8 ? 24 : duration)
      break
    }
  }
  state.push({
    id,
    roll: n,
    subRolls: subs,
    detail: WILD_SURGES[row]!,
    startedAt: r.hours,
    endsAt: r.hours + duration,
    settled: false,
  })
  r.advanced.surges = [
    ...state.filter((s) => s.settled).slice(-20),
    ...state.filter((s) => !s.settled),
  ]
  return (
    '；' +
    (forced ? '混乱之潮重置并强制' : 'd20＝20，') +
    '浪涌 d100＝' +
    n +
    (subs.length ? '，追加骰 [' + subs + ']' : '') +
    '：' +
    WILD_SURGES[row] +
    '；结果已保存，需 GM 核对目标、位置和未自动部分'
  )
}
