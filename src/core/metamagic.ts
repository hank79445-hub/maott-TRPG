import type { Character, Spell } from './types'
import type { DamageType, PendingAction } from './combat-types'
import { spellEffect } from './combat-rules'

export const METAMAGIC_NAMES: Record<string, string> = {
  careful: '谨慎法术',
  distant: '远距法术',
  empowered: '强效法术',
  extended: '延时法术',
  heightened: '升阶法术',
  quickened: '快捷法术',
  seeking: '追踪法术',
  subtle: '精妙法术',
  transmuted: '转化法术',
  twinned: '孪生法术',
}
export const ELEMENTS: DamageType[] = ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder']
export const metamagicCost = (id: string) => (['heightened', 'quickened'].includes(id) ? 2 : 1)
export const durationRounds = (s: Spell) => {
  const m = s.duration.match(/(\d+)\s+(minute|hour|day)/i)
  return m ? Number(m[1]) * ({ minute: 10, hour: 600, day: 14400 }[m[2]!.toLowerCase()] ?? 0) : 0
}
// Only spells whose SRD higher-slot text adds creatures. Damage-only upcasting
// (including Scorching Ray and Magic Missile) is deliberately excluded.
export const TWINNABLE = [
  'animal-friendship',
  'bane',
  'bless',
  'charm-person',
  'command',
  'enhance-ability',
  'hold-person',
  'invisibility',
  'longstrider',
  'fly',
  'heroism',
]
export function knownMetamagic(c: Character, option: string) {
  if (c.build.classId !== 'sorcerer' || c.level < 2 || !c.build.choices.metamagic?.includes(option))
    throw new Error('角色未习得此超魔法')
}
export function validateMetamagic(
  c: Character,
  s: Spell,
  slot: number,
  m: NonNullable<PendingAction['metamagic']>,
  ids: string[],
) {
  knownMetamagic(c, m.option)
  if (['empowered', 'seeking'].includes(m.option)) throw new Error('此超魔法请在待结算掷骰窗口使用')
  const p = spellEffect(s.id, c.level, slot || s.level || 1)
  if (m.option === 'careful' && !p.save) throw new Error('谨慎法术要求已支持的豁免法术')
  if (m.option === 'heightened' && (!p.save || !ids.includes(m.heightenedId)))
    throw new Error('升阶法术须选择一个豁免目标')
  if (
    m.option === 'distant' &&
    s.range !== 'Touch' &&
    Number(s.range.match(/(\d+) feet/)?.[1] ?? 0) < 5
  )
    throw new Error('远距法术要求至少 5 尺或接触射程')
  if (m.option === 'extended' && durationRounds(s) < 10)
    throw new Error('延时法术要求至少 1 分钟持续时间')
  if (m.option === 'quickened' && !/^(Action|1 Action)$/i.test(s.castingTime))
    throw new Error('快捷法术只能改变一个动作的施法时间')
  if (
    m.option === 'transmuted' &&
    (!p.type || !ELEMENTS.includes(p.type) || !ELEMENTS.includes(m.damageType))
  )
    throw new Error('转化法术要求已支持的六种元素伤害法术')
  if (m.option === 'twinned' && (!TWINNABLE.includes(s.id) || !slot))
    throw new Error('孪生法术要求可升环增加生物目标的法术位施法')
  if (m.option !== 'careful' && m.protectedIds.length) throw new Error('仅谨慎法术可指定保护目标')
  if (
    new Set(m.protectedIds).size !== m.protectedIds.length ||
    m.protectedIds.some((id) => !ids.includes(id))
  )
    throw new Error('保护目标必须是不同的法术目标')
}
