import type { AttackSpec, CombatCommand, TurnBudget } from './combat-types'
import type { Character } from './types'
import type { Catalogue } from './engine'
import { hasFeat } from './advanced-rules'
import { hasSubclass } from './growth-rules'
import { equippedInventory } from './equipment'
import { runtimeState, runtimeDerived } from './runtime'
import { martialArtsEligible } from './weapon-rules'

export type AttackCost = Extract<CombatCommand, { type: 'attack' }>['cost']
export const ATTACK_COSTS: Record<AttackCost, string> = {
  action: '攻击动作',
  haste:'加速 · 一次攻击',
  light: '轻型 · 附赠动作',
  nick: 'Nick · 攻击动作内额外一次',
  cleave: 'Cleave · 额外攻击',
  martial: '武艺 · 附赠徒手',
  flurry: '疾风 · 已付费用的徒手',
  opportunity: '借机 · 反应（GM 确认）',
  dual: '双持客 · 附赠动作',
  pole: '长柄反端 · 附赠动作',
  hew: '巨武器斩击 · 附赠动作',
  'war-priest': '战争祭司 · 附赠＋资源',
  psychic: '第二心刃 · 附赠动作',
  star: '星耀射手 · 附赠／激活首发',
  agile: '舞蹈灵巧打击',
}
export interface AttackMethod {
  cost: AttackCost
  label: string
  enabled: boolean
  reason: string
  remaining: number
  activation?: boolean
}
export interface AttackMethodContext {
  actor: {
    id: string
    turn: TurnBudget
    companion?: { source: string; ownerId: string }
    npc?: { effects: import('./types').ActiveEffect[] } | null
  }
  currentId: string | null | undefined
  active: boolean
  pending: boolean
  character?: Character
  cat: Catalogue
  spec: AttackSpec
  targetDown?: boolean
}
export function attackMethods(ctx: AttackMethodContext): AttackMethod[] {
  const { actor: a, character: c, spec: s, cat } = ctx,
    t = a.turn
  const r = c ? runtimeState(c, cat) : null,
    d = c ? runtimeDerived(c, cat) : null
  const last = t.lastAttack,
    unarmed = s.id === 'unarmed'
  const light = t.lightWeapons ?? (t.lightWeapon ? [t.lightWeapon] : [])
  const differentLight = light.some((id) => id !== s.instanceId)
  const own =
    ctx.currentId === a.id ||
    (a.companion?.source === 'primal-companion' && ctx.currentId === a.companion.ownerId)
  const effects = r?.effects ?? a.npc?.effects ?? [],
    prepaid = effects.some((f) => f.key === 'maneuver-commanded'),
    rangedCommand = effects.some((f) => f.key === 'maneuver-commanded' && f.sourceId !== a.id)
  const common = !ctx.active
    ? '战斗尚未开始'
    : ctx.pending
      ? '请先结算当前行动'
      : d?.conditions.includes('incapacitated') || r?.death.dead
        ? '失能或死亡时无法攻击'
        : ''
  const out: AttackMethod[] = []
  const add = (
    cost: AttackCost,
    source: boolean,
    reason = '',
    remaining = 1,
    activation = false,
  ) => {
    if (!source) return
    const why = common || (cost !== 'opportunity' && !own ? '等待自己的回合' : '') || reason
    out.push({
      cost,
      label: ATTACK_COSTS[cost],
      enabled: !why,
      reason: why,
      remaining,
      ...(activation ? { activation } : {}),
    })
  }
  add('haste',effects.some(f=>f.key==='haste'),t.manualUsed?.includes('haste-action')?'加速动作已用':'')
  const bonus = t.bonus ? '' : '附赠动作已用'
  add(
    'action',
    !['star-arrow'].includes(s.id),
    t.action || (t.attacksLeft ?? 0) > 0 ? '' : '行动资源已用：攻击动作已用，且无剩余攻击',
    (t.attacksLeft ?? 0) || 1,
  )
  add(
    'light',
    s.properties.includes('light'),
    t.lightUsed
      ? '轻型额外攻击已用（与 Nick 共用）'
      : !differentLight
        ? '轻型额外攻击需要本回合攻击过不同的轻型武器'
        : bonus,
  )
  add(
    'nick',
    s.mastery === 'Nick',
    t.lightUsed || t.nickUsed
      ? '轻型额外攻击／Nick 已用'
      : !differentLight
        ? '轻型额外攻击需要本回合攻击过不同的轻型武器'
        : '',
  )
  const monk = c?.build.classId === 'monk'
  add(
    'martial',
    !!monk && unarmed,
    !c || !martialArtsEligible(c, equippedInventory(c, cat), [...cat.items, ...c.build.customItems])
      ? '武艺要求无甲无盾且仅持用武僧武器'
      : bonus,
  )
  const flurryReady = (t.flurryLeft ?? 0) > 0
  const canActivate =
    !!monk && c!.level >= 2 && !!t.bonus && (r?.resources.focus ?? 0) >= 1 && own && !common
  add(
    'flurry',
    !!monk && c!.level >= 2 && unarmed,
    flurryReady
      ? ''
      : !t.bonus
        ? '附赠动作已用，且无剩余疾风连击'
        : !(r?.resources.focus ?? 0)
          ? '疾风连击专注不足'
          : '先明确启用疾风：附赠动作＋1 点专注',
    t.flurryLeft ?? 0,
    !flurryReady && canActivate,
  )
  add(
    'opportunity',
    !s.ranged || rangedCommand,
    !t.reaction && !prepaid
      ? '反应已用'
      : effects.some((f) => f.noReaction || f.key === 'shocking-grasp')
        ? '当前不能借机攻击'
        : '',
  )
  add(
    'cleave',
    s.mastery === 'Cleave',
    t.cleaveUsed
      ? 'Cleave 已用'
      : !r?.effects.some((f) => f.key === 'cleave-ready')
        ? '须先触发 Cleave'
        : '',
  )
  add(
    'dual',
    !!c &&
      hasFeat(c.build, 'dual-wielder', cat) &&
      !s.ranged &&
      !s.properties.some((p) => p.startsWith('two-handed')),
    !differentLight ? '须先以另一把轻型武器攻击' : bonus,
  )
  add(
    'pole',
    !!c &&
      hasFeat(c.build, 'polearm-master', cat) &&
      !s.ranged &&
      (['quarterstaff', 'spear'].includes(s.weaponId ?? '') ||
        (s.properties.includes('heavy') && s.properties.includes('reach'))),
    !last || last.weaponId !== s.weaponId ? '须先以同一武器完成攻击动作' : bonus,
  )
  add(
    'hew',
    !!c && hasFeat(c.build, 'great-weapon-master', cat) && !s.ranged && !!s.weaponId,
    !last ||
      last.ranged ||
      last.weaponId !== s.weaponId ||
      !(last.critical || ctx.targetDown || last.targetDown)
      ? '须刚以同一武器暴击或使目标归零'
      : bonus,
  )
  add(
    'war-priest',
    !!c && hasSubclass(c.build, 'war'),
    !(r?.resources['war-priest'] ?? 0) ? '战争祭司资源不足' : bonus,
  )
  add(
    'psychic',
    !!c && hasSubclass(c.build, 'soulknife') && s.properties.includes('psychic-blade'),
    last?.weaponId !== 'psychic-blade'
      ? '须先以心刃攻击'
      : c?.runtime?.grapples?.length
        ? '第二心刃要求另一只手空闲，不能被擒抱占用'
        : bonus,
  )
  add('star', s.id === 'star-arrow', t.manualUsed?.includes('star-ready') ? '' : bonus)
  add(
    'agile',
    !!c && hasSubclass(c.build, 'dance') && unarmed,
    t.manualUsed?.includes('dance-ready') ? '' : '须先在动作中消耗激励',
  )
  return out
}
